import fs from 'node:fs';
import path from 'node:path';
import { createClient } from './github.mjs';
import { render } from './render.mjs';

const input = (name, fallback = '') => (process.env[`INPUT_${name}`] ?? '').trim() || fallback;
const flag = (name, fallback) => {
  const v = input(name).toLowerCase();
  return v ? v === 'true' : fallback;
};

const user = input('USERNAME', process.env.GITHUB_REPOSITORY_OWNER || '');
const token = input('TOKEN', process.env.GITHUB_TOKEN || '');
const themeName = input('THEME', 'dark').toLowerCase();
const output = input('OUTPUT', 'loc.svg');
const exclude = new Set(input('EXCLUDE_REPOS').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
const includeForks = flag('INCLUDE_FORKS', false);
const hideDeleted = flag('HIDE_DELETED', false);
const showLanguages = flag('SHOW_LANGUAGES', true);

if (!/^[A-Za-z0-9-]{1,39}$/.test(user)) {
  console.error(`Invalid or missing username: "${user}"`);
  process.exit(1);
}

const gh = createClient(token);

async function pool(items, size, fn) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift());
    })
  );
}

const all = await gh.paginate(`/users/${user}/repos?type=owner`);
const repos = all.filter(
  (r) => !exclude.has(r.name.toLowerCase()) && (includeForks || !r.fork)
);
console.log(`Analyzing ${repos.length} repos for ${user}...`);

let added = 0, deleted = 0, skipped = 0;
const langBytes = {};

await pool(repos, 4, async (repo) => {
  const stats = await gh.get(`/repos/${repo.full_name}/stats/contributors`);
  if (!Array.isArray(stats)) {
    skipped++;
    console.warn(`  skipped ${repo.name} (stats unavailable, will retry next run)`);
  } else {
    const me = stats.find((c) => c.author?.login?.toLowerCase() === user.toLowerCase());
    for (const w of me?.weeks ?? []) {
      added += w.a;
      deleted += w.d;
    }
  }
  if (showLanguages) {
    const langs = await gh.get(`/repos/${repo.full_name}/languages`);
    for (const [name, bytes] of Object.entries(langs ?? {})) {
      langBytes[name] = (langBytes[name] ?? 0) + bytes;
    }
  }
});

const langs = Object.entries(langBytes).map(([name, bytes]) => ({ name, bytes }));
const svg = render({
  user,
  added,
  deleted,
  repoCount: repos.length,
  langs,
  themeName,
  hideDeleted,
  updated: new Date().toISOString().slice(0, 10),
});

fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(output, svg);
console.log(`Wrote ${output}: +${added} -${deleted} (${skipped} repos skipped)`);

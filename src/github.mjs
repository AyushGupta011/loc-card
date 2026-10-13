const API = 'https://api.github.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createClient(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'loc-card-action',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  // Returns parsed JSON, or null if unavailable (empty repo, still computing, error).
  async function get(path, { retries = 6 } = {}) {
    for (let i = 0; i < retries; i++) {
      const res = await fetch(API + path, { headers });

      if (res.status === 202) {            // stats are being computed, retry
        await sleep(2000 * (i + 1));
        continue;
      }
      if (res.status === 204) return null; // empty repo
      if ((res.status === 403 || res.status === 429) &&
          res.headers.get('x-ratelimit-remaining') === '0') {
        throw new Error('GitHub API rate limit reached. Try again later.');
      }
      if (!res.ok) return null;
      return res.json();
    }
    return null;
  }

  async function paginate(path) {
    const out = [];
    for (let page = 1; ; page++) {
      const sep = path.includes('?') ? '&' : '?';
      const batch = await get(`${path}${sep}per_page=100&page=${page}`);
      if (!Array.isArray(batch) || batch.length === 0) break;
      out.push(...batch);
      if (batch.length < 100) break;
    }
    return out;
  }

  return { get, paginate };
}

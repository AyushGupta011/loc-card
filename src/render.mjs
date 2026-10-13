import { THEMES, LANG_COLORS } from './themes.mjs';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => new Intl.NumberFormat('en-US').format(n);

function topLanguages(langs, max = 6) {
  const total = langs.reduce((s, l) => s + l.bytes, 0);
  if (!total) return [];
  const sorted = [...langs].sort((a, b) => b.bytes - a.bytes);
  const top = sorted.slice(0, max);
  const rest = sorted.slice(max).reduce((s, l) => s + l.bytes, 0);
  if (rest > 0) top.push({ name: 'Other', bytes: rest });
  return top.map((l) => ({ ...l, pct: (l.bytes / total) * 100 }));
}

export function render({ user, added, deleted, repoCount, langs, themeName, hideDeleted, updated }) {
  const t = THEMES[themeName] ?? THEMES.dark;
  const W = 495;
  const font = `font-family="'Segoe UI', Ubuntu, 'Helvetica Neue', Arial, sans-serif"`;

  // stat columns
  const items = [{ v: added, label: 'lines added' }];
  if (!hideDeleted) items.push({ v: deleted, label: 'lines deleted' });
  items.push({ v: added - deleted, label: 'net lines' });
  const colW = (W - 50) / items.length;
  const stats = items
    .map((it, i) => {
      const x = 25 + i * colW;
      return `<text x="${x}" y="78" fill="${t.number}" font-size="30" font-weight="700">${fmt(it.v)}</text>
    <text x="${x}" y="98" fill="${t.text}" font-size="13">${it.label}</text>`;
    })
    .join('\n    ');

  // language bar
  const top = topLanguages(langs ?? []);
  let langSvg = '';
  let H = 132;
  if (top.length) {
    const barY = 134, barX = 25, barW = W - 50;
    let x = barX;
    const segs = top
      .map((l) => {
        const w = (l.pct / 100) * barW;
        const seg = `<rect x="${x.toFixed(2)}" y="${barY}" width="${w.toFixed(2)}" height="8" fill="${LANG_COLORS[l.name] ?? '#8b949e'}"/>`;
        x += w;
        return seg;
      })
      .join('');
    const legendY0 = 170;
    const legend = top
      .map((l, i) => {
        const lx = 25 + (i % 2) * 225;
        const ly = legendY0 + Math.floor(i / 2) * 22;
        return `<circle cx="${lx + 5}" cy="${ly - 4}" r="5" fill="${LANG_COLORS[l.name] ?? '#8b949e'}"/>
    <text x="${lx + 16}" y="${ly}" fill="${t.text}" font-size="12">${esc(l.name)} ${l.pct.toFixed(1)}%</text>`;
      })
      .join('\n    ');
    const rows = Math.ceil(top.length / 2);
    H = legendY0 + (rows - 1) * 22 + 20;
    langSvg = `
    <clipPath id="bar"><rect x="${barX}" y="${barY}" width="${barW}" height="8" rx="4"/></clipPath>
    <g clip-path="url(#bar)"><rect x="${barX}" y="${barY}" width="${barW}" height="8" fill="${t.border}"/>${segs}</g>
    ${legend}`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(user)}'s lines of code">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="6" fill="${t.bg}" stroke="${t.border}"/>
  <g ${font}>
    <text x="25" y="35" fill="${t.title}" font-size="18" font-weight="600">${esc(user)}'s Lines of Code</text>
    ${stats}
    <text x="25" y="120" fill="${t.muted}" font-size="11">${fmt(repoCount)} repos · updated ${esc(updated)}</text>${langSvg}
  </g>
</svg>
`;
}

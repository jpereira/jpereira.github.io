#!/usr/bin/env node
// Regenera a seção de projetos do index.html a partir da API do GitHub.
// Uso: node scripts/update-projects.js   (GITHUB_TOKEN opcional, evita rate limit)
const fs = require('fs');
const path = require('path');

const USER = 'jpereira';
const FEATURED = ['softgre', 'zapbot', 'getright', 'libclosedcaption', 'php-dhcpdleases', 'freeradius-server'];
const MAX = 24;
const EXCLUDE = ['freeradius-tls-openssl', 'libcouchbase', 'ansible-tools', 'libsed', 'daloradius', 'source', 'acutest'];
const EXCLUDE_PARENT_OWNERS = ['blinktrade']; // forks de..., ignorados
const FILE = path.join(__dirname, '..', 'index.html');

const COLORS = {
  C: '#555555', 'C++': '#f34b7d', JavaScript: '#f1e05a', PHP: '#4F5D95', Kotlin: '#A97BFF',
  'Vim Script': '#199f4b', Python: '#3572A5', Shell: '#89e051', Go: '#00ADD8', Rust: '#dea584',
  TypeScript: '#3178c6',
};

const ICON_WEB = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>';
const ICON_GH = '<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.22 1.88.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function main() {
  const headers = { 'User-Agent': USER + '-site', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
  const res = await fetch(`https://api.github.com/users/${USER}/repos?per_page=100&type=owner&sort=pushed`, { headers });
  if (!res.ok) throw new Error(`GitHub API: ${res.status} ${res.statusText}`);
  let repos = (await res.json()).filter((r) => !r.archived && !r.private && r.name !== `${USER}.github.io` && r.name !== USER);

  // a listagem não traz o parent dos forks, então busca o detalhe só deles
  const forks = repos.filter((r) => r.fork && !EXCLUDE.includes(r.name));
  const details = await Promise.all(forks.map(async (r) => {
    const d = await fetch(r.url, { headers });
    return d.ok ? [r.name, (await d.json()).parent?.owner?.login?.toLowerCase()] : [r.name, null];
  }));
  const parentOf = Object.fromEntries(details);
  repos = repos.filter((r) => !EXCLUDE.includes(r.name) &&
    !EXCLUDE_PARENT_OWNERS.includes(parentOf[r.name]));

  const rank = (r) => {
    const f = FEATURED.indexOf(r.name);
    return f >= 0 ? f : 100 + (r.fork ? 1000 : 0);
  };
  repos.sort((a, b) => rank(a) - rank(b) || b.stargazers_count - a.stargazers_count ||
    new Date(b.pushed_at) - new Date(a.pushed_at));
  repos = repos.slice(0, MAX);

  const cards = repos.map((r) => {
    const feat = FEATURED.includes(r.name);
    const lang = r.language
      ? `<span><i class="dot" style="--lc:${COLORS[r.language] || '#888'}"></i>${esc(r.language)}</span>` : '';
    // ícones (site + repo) só para projetos com website (GitHub Pages)
    const links = r.has_pages
      ? `<span class="ico"><a target="_blank" rel="noopener noreferrer" href="https://${USER}.github.io/${esc(r.name)}/" title="Website" aria-label="Website">${ICON_WEB}</a>`
        + `<a target="_blank" rel="noopener noreferrer" href="${esc(r.html_url)}" title="GitHub repo" aria-label="GitHub repo">${ICON_GH}</a></span>` : '';
    return `    <div class="card${feat ? ' feat' : ''}">
      <h3><a target="_blank" rel="noopener noreferrer" href="${esc(r.html_url)}">${esc(r.name)}</a>${feat ? '<span class="badge star">featured</span>' : ''}${r.fork ? '<span class="badge">fork</span>' : ''}</h3>
      <p>${esc(r.description || '')}</p>
      <div class="meta">${lang}<span>★ ${r.stargazers_count}</span><span>⑂ ${r.forks_count}</span>${links}</div>
    </div>`;
  }).join('\n');

  let html = fs.readFileSync(FILE, 'utf8');
  const re = /(<!-- PROJECTS:START -->)[\s\S]*?(<!-- PROJECTS:END -->)/;
  if (!re.test(html)) throw new Error('markers PROJECTS não encontrados');
  html = html.replace(re, `$1\n${cards}\n$2`);
  html = html.replace(/(<!-- UPDATED -->)[\s\S]*?(<!-- \/UPDATED -->)/, `$1${new Date().toISOString().slice(0, 10)}$2`);
  fs.writeFileSync(FILE, html);
  console.log(`ok: ${repos.length} projetos`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });

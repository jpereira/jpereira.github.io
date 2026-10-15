#!/usr/bin/env node
// Regenera a seção de projetos do index.html a partir da API do GitHub.
// Uso: node scripts/update-projects.js   (GITHUB_TOKEN opcional, evita rate limit)
const fs = require('fs');
const path = require('path');

const USER = 'jpereira';
const FEATURED = ['softgre', 'getright'];
const MAX = 24;
const FILE = path.join(__dirname, '..', 'index.html');

const COLORS = {
  C: '#555555', 'C++': '#f34b7d', JavaScript: '#f1e05a', PHP: '#4F5D95', Kotlin: '#A97BFF',
  'Vim Script': '#199f4b', Python: '#3572A5', Shell: '#89e051', Go: '#00ADD8', Rust: '#dea584',
  TypeScript: '#3178c6',
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function main() {
  const headers = { 'User-Agent': USER + '-site', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
  const res = await fetch(`https://api.github.com/users/${USER}/repos?per_page=100&type=owner&sort=pushed`, { headers });
  if (!res.ok) throw new Error(`GitHub API: ${res.status} ${res.statusText}`);
  let repos = (await res.json()).filter((r) => !r.archived && !r.private && r.name !== `${USER}.github.io` && r.name !== USER);

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
    return `    <div class="card${feat ? ' feat' : ''}">
      <h3><a href="${esc(r.html_url)}">${esc(r.name)}</a>${feat ? '<span class="badge star">featured</span>' : ''}${r.fork ? '<span class="badge">fork</span>' : ''}</h3>
      <p>${esc(r.description || '')}</p>
      <div class="meta">${lang}<span>★ ${r.stargazers_count}</span><span>⑂ ${r.forks_count}</span></div>
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

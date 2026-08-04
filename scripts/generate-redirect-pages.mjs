import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const projectRoot = new URL('../', import.meta.url);
const redirectsPath = new URL('public/_redirects', projectRoot);
const distPath = new URL('dist/', projectRoot);
const basePath = (process.env.BASE_PATH || '').replace(/\/$/, '');
const source = await readFile(redirectsPath, 'utf8');

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const redirects = new Map();
for (const line of source.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [from, to] = trimmed.split(/\s+/);
  if (!from?.startsWith('/') || !to?.startsWith('/')) continue;
  const normalized = from.replace(/^\/+|\/+$/g, '');
  if (normalized) redirects.set(normalized, to);
}

for (const [from, to] of redirects) {
  // Preserve historical Mozello URLs ending in .html as real files. Other
  // routes use GitHub Pages' directory/index.html convention.
  const outputFile = from.toLowerCase().endsWith('.html')
    ? join(distPath.pathname, from)
    : join(distPath.pathname, from, 'index.html');
  await mkdir(dirname(outputFile), { recursive: true });
  const target = escapeHtml(to);
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="refresh" content="0;url=${target}">
    <link rel="canonical" href="https://digitalhumanities.lv${target}">
    <title>Redirecting…</title>
    <script>const target=new URL(${JSON.stringify(`${basePath}${to}`)},location.origin);target.search=location.search;location.replace(target.href);</script>
  </head>
  <body><p><a href="${target}">Continue to digitalhumanities.lv</a></p></body>
</html>`;
  await writeFile(outputFile, html);
}

console.log(`Izveidotas ${redirects.size} statiskās pāradresācijas lapas.`);

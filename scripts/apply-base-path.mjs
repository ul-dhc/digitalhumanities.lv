import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const basePath = (process.env.BASE_PATH || '').replace(/^\/*|\/*$/g, '');
if (!basePath) {
  console.log('Bāzes ceļš nav norādīts, saites paliek domēna saknē.');
  process.exit(0);
}

const distDirectory = new URL('../dist/', import.meta.url).pathname;
const supportedExtensions = new Set(['.html', '.css', '.js', '.xml', '.webmanifest']);
let updatedFiles = 0;

const updateFile = async (filePath) => {
  const extension = extname(filePath);
  if (!supportedExtensions.has(extension)) return;
  const original = await readFile(filePath, 'utf8');
  let updated = original
    .replace(/((?:href|src|srcset|action)=['"])\/(?!\/|digitalhumanities\.lv(?:\/|['"]))/g, `$1/${basePath}/`)
    .replace(/(content=['"]\d+;url=)\/(?!\/|digitalhumanities\.lv(?:\/|['"]))/g, `$1/${basePath}/`)
    .replace(/(url\(['"]?)\/(?!\/|digitalhumanities\.lv(?:\/|['"]))/g, `$1/${basePath}/`)
    .replace(/(['"`])\/(?=(?:assets|media|lv|en|favicon|apple-touch-icon|site\.js)(?:\/|\?|['"`]))/g, `$1/${basePath}/`);
  if (updated === original) return;
  await writeFile(filePath, updated);
  updatedFiles += 1;
};

const walk = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else await updateFile(path);
  }
};

await walk(distDirectory);
console.log(`Bāzes ceļš /${basePath}/ pievienots ${updatedFiles} būvējuma failiem.`);

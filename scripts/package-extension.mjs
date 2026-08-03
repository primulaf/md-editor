import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const stagingRoot = join(dist, '.staging');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const appVersion = packageJson.version;
const archiveName = `md-editor-${appVersion}.zip`;
const archivePath = join(dist, archiveName);
const fixedTimestamp = new Date(1980, 0, 1);

const packageItems = [
  'manifest.json',
  'index.html',
  'theme-init.js',
  'app.js',
  'recent-files.js',
  'mermaid-tools.js',
  'image-assets.js',
  'document-stats.js',
  'pending-file-storage.js',
  'mermaid-renderer.mjs',
  'mermaid-capability.mjs',
  'mermaid-capability.json',
  'background.js',
  'content.js',
  'style.css',
  'icons',
  'fonts',
  'lib/github-dark.min.css',
  'lib/github.min.css',
  'lib/highlight.min.js',
  'lib/markdown-it.min.js',
  'lib/markdownItAnchor.umd.js',
  'lib/markdownItTaskLists.min.js',
  'lib/markdownItFootnote.min.js',
  'lib/purify.min.js',
  'lib/mermaid'
];

async function copyItem(item) {
  const source = join(root, item);
  const target = join(stagingRoot, item);
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, { recursive: true });
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return nested.flat().sort();
}

async function writeZip(sourceDirectory, destination) {
  const files = await listFiles(sourceDirectory);
  const entries = {};
  for (const file of files) {
    const archivePath = relative(sourceDirectory, file).replaceAll('\\', '/');
    entries[archivePath] = [
      new Uint8Array(await readFile(file)),
      { mtime: fixedTimestamp }
    ];
  }
  await writeFile(destination, zipSync(entries, { level: 9 }));
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

await rm(dist, { recursive: true, force: true });
await mkdir(stagingRoot, { recursive: true });
await Promise.all(packageItems.map(copyItem));
await writeZip(stagingRoot, archivePath);
await rm(stagingRoot, { recursive: true, force: true });

const digest = await sha256(archivePath);
await writeFile(
  join(dist, 'SHA256SUMS.txt'),
  `${digest}  ${archiveName}\n`,
  'utf8'
);

const bytes = (await stat(archivePath)).size;
console.log(`${archiveName} (${bytes} bytes)`);
console.log('SHA-256 已写入 dist/SHA256SUMS.txt');

import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const fullRoot = join(dist, 'full');
const liteRoot = join(dist, 'lite');
const dependencyRoot = join(dist, 'dependency');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const appVersion = packageJson.version;
const mermaidVersion = packageJson.dependencies.mermaid;
const fixedTimestamp = new Date(1980, 0, 1);

const commonItems = [
  'manifest.json',
  'index.html',
  'app.js',
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
  'lib/purify.min.js'
];

async function copyItem(item, targetRoot) {
  const source = join(root, item);
  const target = join(targetRoot, item);
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
await Promise.all([
  mkdir(fullRoot, { recursive: true }),
  mkdir(liteRoot, { recursive: true }),
  mkdir(dependencyRoot, { recursive: true })
]);

await Promise.all(commonItems.flatMap((item) => [
  copyItem(item, fullRoot),
  copyItem(item, liteRoot)
]));
await copyItem('lib/mermaid', fullRoot);

const fullCapability = JSON.parse(await readFile(join(root, 'mermaid-capability.json'), 'utf8'));
const liteCapability = {
  ...fullCapability,
  available: false
};
await writeFile(
  join(liteRoot, 'mermaid-capability.json'),
  `${JSON.stringify(liteCapability, null, 2)}\n`,
  'utf8'
);

await copyItem('mermaid-capability.json', dependencyRoot);
await copyItem('lib/mermaid', dependencyRoot);

const archiveNames = {
  full: `md-editor-full-${appVersion}.zip`,
  lite: `md-editor-lite-${appVersion}.zip`,
  dependency: `md-editor-mermaid-${mermaidVersion}.zip`
};
const archivePaths = Object.fromEntries(
  Object.entries(archiveNames).map(([key, name]) => [key, join(dist, name)])
);

await Promise.all([
  writeZip(fullRoot, archivePaths.full),
  writeZip(liteRoot, archivePaths.lite),
  writeZip(dependencyRoot, archivePaths.dependency)
]);

const checksumLines = [];
for (const name of Object.values(archiveNames)) {
  checksumLines.push(`${await sha256(join(dist, name))}  ${name}`);
}
await writeFile(join(dist, 'SHA256SUMS.txt'), `${checksumLines.join('\n')}\n`, 'utf8');

for (const [kind, path] of Object.entries(archivePaths)) {
  const bytes = (await stat(path)).size;
  console.log(`${kind}: ${archiveNames[kind]} (${bytes} bytes)`);
}
console.log('SHA-256 已写入 dist/SHA256SUMS.txt');

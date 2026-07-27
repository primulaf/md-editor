import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const sourceRoot = new URL('node_modules/mermaid/dist/', root);
const outputRoot = new URL('lib/mermaid/', root);
const sourceChunks = new URL('chunks/mermaid.esm.min/', sourceRoot);
const outputChunks = new URL('chunks/mermaid.esm.min/', outputRoot);
const browserVendorFiles = [
  ['node_modules/markdown-it/dist/markdown-it.min.js', 'lib/markdown-it.min.js'],
  ['node_modules/markdown-it-anchor/dist/markdownItAnchor.umd.js', 'lib/markdownItAnchor.umd.js'],
  ['node_modules/dompurify/dist/purify.min.js', 'lib/purify.min.js']
];

await Promise.all(browserVendorFiles.map(([source, destination]) => (
  copyFile(new URL(source, root), new URL(destination, root))
)));

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputChunks, { recursive: true });

await copyFile(
  new URL('mermaid.esm.min.mjs', sourceRoot),
  new URL('mermaid.esm.min.mjs', outputRoot)
);

const chunkNames = (await readdir(sourceChunks))
  .filter((name) => name.endsWith('.mjs'))
  .sort();

await Promise.all(chunkNames.map((name) => (
  copyFile(new URL(name, sourceChunks), new URL(name, outputChunks))
)));

const entrySize = (await stat(new URL('mermaid.esm.min.mjs', outputRoot))).size;
const chunkSizes = await Promise.all(
  chunkNames.map(async (name) => (await stat(new URL(name, outputChunks))).size)
);
const totalBytes = entrySize + chunkSizes.reduce((total, size) => total + size, 0);

console.log(`浏览器依赖已同步；Mermaid：${chunkNames.length} 个分块，${totalBytes} bytes`);

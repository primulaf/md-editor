import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const sourceRoot = new URL('node_modules/mermaid/dist/', root);
const outputRoot = new URL('lib/mermaid/', root);
const sourceChunks = new URL('chunks/mermaid.esm.min/', sourceRoot);
const outputChunks = new URL('chunks/mermaid.esm.min/', outputRoot);
const katexSourceRoot = new URL('node_modules/katex/dist/', root);
const katexOutputRoot = new URL('lib/katex/', root);
const katexSourceFonts = new URL('fonts/', katexSourceRoot);
const katexOutputFonts = new URL('fonts/', katexOutputRoot);
const browserVendorFiles = [
  ['node_modules/markdown-it/dist/markdown-it.min.js', 'lib/markdown-it.min.js'],
  ['node_modules/markdown-it-anchor/dist/markdownItAnchor.umd.js', 'lib/markdownItAnchor.umd.js'],
  ['node_modules/markdown-it-task-lists/dist/markdown-it-task-lists.min.js', 'lib/markdownItTaskLists.min.js'],
  ['node_modules/markdown-it-footnote/dist/markdown-it-footnote.min.js', 'lib/markdownItFootnote.min.js'],
  ['node_modules/dompurify/dist/purify.min.js', 'lib/purify.min.js'],
  ['node_modules/markdown-it-texmath/texmath.js', 'lib/texmath.js'],
  ['node_modules/katex/dist/katex.min.js', 'lib/katex/katex.min.js']
];

await rm(katexOutputRoot, { recursive: true, force: true });
await mkdir(katexOutputFonts, { recursive: true });
await Promise.all(browserVendorFiles.map(([source, destination]) => (
  copyFile(new URL(source, root), new URL(destination, root))
)));

const katexCss = (await readFile(new URL('katex.min.css', katexSourceRoot), 'utf8'))
  .replace(
    /,url\(fonts\/[^)]+\.(?:woff|ttf)\) format\("(?:woff|truetype)"\)/g,
    ''
  );
await writeFile(new URL('katex.min.css', katexOutputRoot), katexCss, 'utf8');

const katexFontNames = (await readdir(katexSourceFonts))
  .filter((name) => name.endsWith('.woff2'))
  .sort();
await Promise.all(katexFontNames.map((name) => (
  copyFile(new URL(name, katexSourceFonts), new URL(name, katexOutputFonts))
)));
await writeFile(
  new URL('version.json', katexOutputRoot),
  `${JSON.stringify({
    name: 'katex',
    version: packageJson.dependencies.katex,
    parser: 'markdown-it-texmath',
    parserVersion: packageJson.dependencies['markdown-it-texmath'],
    fonts: katexFontNames.length
  }, null, 2)}\n`,
  'utf8'
);

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

const dependencyManifest = {
  name: 'mermaid',
  version: packageJson.dependencies.mermaid,
  rendererApi: 1,
  entry: 'mermaid.esm.min.mjs',
  chunkDirectory: 'chunks/mermaid.esm.min',
  chunks: chunkNames.length
};
await writeFile(
  new URL('version.json', outputRoot),
  `${JSON.stringify(dependencyManifest, null, 2)}\n`,
  'utf8'
);

const entrySize = (await stat(new URL('mermaid.esm.min.mjs', outputRoot))).size;
const chunkSizes = await Promise.all(
  chunkNames.map(async (name) => (await stat(new URL(name, outputChunks))).size)
);
const totalBytes = entrySize + chunkSizes.reduce((total, size) => total + size, 0);

console.log(
  `浏览器依赖已同步；Mermaid：${chunkNames.length} 个分块，${totalBytes} bytes；KaTeX：${katexFontNames.length} 个字体`
);

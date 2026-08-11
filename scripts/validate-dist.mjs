import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8, unzipSync } from 'fflate';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const appVersion = packageJson.version;
const mermaidVersion = packageJson.dependencies.mermaid;
const archiveName = `md-editor-${appVersion}.zip`;
const archivePath = join(dist, archiveName);

const requiredFiles = [
  'manifest.json',
  'index.html',
  'theme-init.js',
  'app.js',
  'code-block-tools.js',
  'math-rendering.js',
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
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
  'fonts/jetbrains-mono.woff2',
  'lib/github-dark.min.css',
  'lib/github.min.css',
  'lib/highlight.min.js',
  'lib/markdown-it.min.js',
  'lib/markdownItAnchor.umd.js',
  'lib/markdownItTaskLists.min.js',
  'lib/markdownItFootnote.min.js',
  'lib/texmath.js',
  'lib/purify.min.js',
  'lib/katex/katex.min.js',
  'lib/katex/katex.min.css',
  'lib/katex/version.json',
  'lib/katex/fonts/KaTeX_Main-Regular.woff2',
  'lib/mermaid/version.json',
  'lib/mermaid/mermaid.esm.min.mjs'
];
const forbiddenPrefixes = [
  '.claude/',
  '.git/',
  'dist/',
  'docs/',
  'node_modules/',
  'tests/'
];

function requireEntries(entries, required) {
  const missing = required.filter((name) => !entries[name]);
  if (missing.length) {
    throw new Error(`扩展包缺少文件：${missing.join(', ')}`);
  }
}

function parseJsonEntry(entries, name) {
  if (!entries[name]) throw new Error(`扩展包缺少 ${name}`);
  return JSON.parse(strFromU8(entries[name]));
}

function validateNoDevelopmentFiles(entries) {
  const names = Object.keys(entries);
  const forbidden = names.filter((name) => (
    forbiddenPrefixes.some((prefix) => name.startsWith(prefix))
    || name === 'AGENTS.md'
    || name.endsWith('.zip')
  ));
  if (forbidden.length) {
    throw new Error(`扩展包包含开发文件：${forbidden.slice(0, 5).join(', ')}`);
  }
}

const archive = unzipSync(new Uint8Array(await readFile(archivePath)));
requireEntries(archive, requiredFiles);
validateNoDevelopmentFiles(archive);

const manifest = parseJsonEntry(archive, 'manifest.json');
const capability = parseJsonEntry(archive, 'mermaid-capability.json');
const dependencyManifest = parseJsonEntry(archive, 'lib/mermaid/version.json');
const katexManifest = parseJsonEntry(archive, 'lib/katex/version.json');
if (manifest.version !== appVersion) {
  throw new Error(`扩展包版本不一致：manifest=${manifest.version}, package=${appVersion}`);
}
if (
  katexManifest.name !== 'katex'
  || katexManifest.version !== packageJson.dependencies.katex
  || katexManifest.parser !== 'markdown-it-texmath'
  || katexManifest.parserVersion !== packageJson.dependencies['markdown-it-texmath']
) {
  throw new Error('扩展包的 KaTeX 依赖清单版本不匹配');
}
const katexFonts = Object.keys(archive).filter(
  (name) => name.startsWith('lib/katex/fonts/') && name.endsWith('.woff2')
);
if (katexFonts.length !== 20 || katexManifest.fonts !== katexFonts.length) {
  throw new Error(`扩展包的 KaTeX 字体不完整：${katexFonts.length}`);
}
const katexCss = strFromU8(archive['lib/katex/katex.min.css']);
if (/fonts\/[^)]*\.(?:woff|ttf)\b/.test(katexCss)) {
  throw new Error('扩展包的 KaTeX CSS 引用了未打包的旧字体格式');
}
if (capability.available !== true) {
  throw new Error('扩展包的 Mermaid 能力标记未启用');
}
for (const descriptor of [capability, dependencyManifest]) {
  if (
    descriptor.name !== 'mermaid'
    || descriptor.version !== mermaidVersion
    || descriptor.rendererApi !== 1
  ) {
    throw new Error('扩展包的 Mermaid 能力标记或依赖清单版本不匹配');
  }
}

const mermaidChunks = Object.keys(archive).filter(
  (name) => name.startsWith('lib/mermaid/chunks/mermaid.esm.min/') && name.endsWith('.mjs')
);
if (mermaidChunks.length < 100) {
  throw new Error(`扩展包的 Mermaid 分块不完整：${mermaidChunks.length}`);
}
if (dependencyManifest.chunks !== mermaidChunks.length) {
  throw new Error(
    `Mermaid 分块数不一致：清单 ${dependencyManifest.chunks}，实际 ${mermaidChunks.length}`
  );
}

const checksums = (await readFile(join(dist, 'SHA256SUMS.txt'), 'utf8'))
  .trim()
  .split(/\r?\n/);
if (checksums.length !== 1) {
  throw new Error(`SHA256SUMS.txt 应仅包含 1 条记录，实际为 ${checksums.length}`);
}
const digest = createHash('sha256')
  .update(await readFile(archivePath))
  .digest('hex');
if (checksums[0] !== `${digest}  ${archiveName}`) {
  throw new Error(`${archiveName} 的 SHA-256 记录不匹配`);
}

const archiveBytes = (await readFile(archivePath)).byteLength;
if (archiveBytes > 3 * 1024 * 1024) {
  throw new Error(`扩展包超过 3 MB 体积门槛：${archiveBytes} bytes`);
}

const distEntries = (await readdir(dist)).sort();
const expectedDistEntries = ['SHA256SUMS.txt', archiveName].sort();
if (JSON.stringify(distEntries) !== JSON.stringify(expectedDistEntries)) {
  throw new Error(`dist 目录包含非预期产物：${distEntries.join(', ')}`);
}

console.log(
  `发行产物校验通过：${archiveName}，${archiveBytes} bytes，包含 ${mermaidChunks.length} 个 Mermaid 分块与 ${katexFonts.length} 个 KaTeX 字体`
);

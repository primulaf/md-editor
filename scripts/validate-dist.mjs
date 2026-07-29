import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8, unzipSync } from 'fflate';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const appVersion = packageJson.version;
const mermaidVersion = packageJson.dependencies.mermaid;
const archiveNames = {
  full: `md-editor-full-${appVersion}.zip`,
  lite: `md-editor-lite-${appVersion}.zip`,
  dependency: `md-editor-mermaid-${mermaidVersion}.zip`
};
const commonFiles = [
  'manifest.json',
  'index.html',
  'app.js',
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
  'lib/purify.min.js'
];
const forbiddenPrefixes = [
  '.claude/',
  '.git/',
  'dist/',
  'docs/',
  'node_modules/',
  'tests/'
];

function requireEntries(entries, required, label) {
  const missing = required.filter((name) => !entries[name]);
  if (missing.length) {
    throw new Error(`${label} 缺少文件：${missing.join(', ')}`);
  }
}

function parseJsonEntry(entries, name, label) {
  if (!entries[name]) throw new Error(`${label} 缺少 ${name}`);
  return JSON.parse(strFromU8(entries[name]));
}

function validateNoDevelopmentFiles(entries, label) {
  const names = Object.keys(entries);
  const forbidden = names.filter((name) => (
    forbiddenPrefixes.some((prefix) => name.startsWith(prefix))
    || name === 'AGENTS.md'
    || name.endsWith('.zip')
  ));
  if (forbidden.length) {
    throw new Error(`${label} 包含开发文件：${forbidden.slice(0, 5).join(', ')}`);
  }
}

function requireSameEntry(left, right, name, label) {
  const leftBytes = left[name];
  const rightBytes = right[name];
  if (
    !leftBytes
    || !rightBytes
    || Buffer.compare(Buffer.from(leftBytes), Buffer.from(rightBytes)) !== 0
  ) {
    throw new Error(`${label} 文件内容不一致：${name}`);
  }
}

async function readArchive(name) {
  return unzipSync(new Uint8Array(await readFile(join(dist, name))));
}

const [full, lite, dependency] = await Promise.all([
  readArchive(archiveNames.full),
  readArchive(archiveNames.lite),
  readArchive(archiveNames.dependency)
]);

requireEntries(full, [
  ...commonFiles,
  'lib/mermaid/version.json',
  'lib/mermaid/mermaid.esm.min.mjs'
], 'Full');
requireEntries(lite, commonFiles, 'Lite');
requireEntries(dependency, [
  'mermaid-capability.json',
  'lib/mermaid/version.json',
  'lib/mermaid/mermaid.esm.min.mjs'
], 'Dependency');

for (const [label, entries] of Object.entries({ Full: full, Lite: lite, Dependency: dependency })) {
  validateNoDevelopmentFiles(entries, label);
}

const fullCapability = parseJsonEntry(full, 'mermaid-capability.json', 'Full');
const liteCapability = parseJsonEntry(lite, 'mermaid-capability.json', 'Lite');
const dependencyCapability = parseJsonEntry(
  dependency,
  'mermaid-capability.json',
  'Dependency'
);
if (fullCapability.available !== true || dependencyCapability.available !== true) {
  throw new Error('Full 或 Dependency 的 Mermaid 能力标记未启用');
}
if (liteCapability.available !== false) {
  throw new Error('Lite 的 Mermaid 能力标记未关闭');
}

commonFiles
  .filter((name) => name !== 'mermaid-capability.json')
  .forEach((name) => requireSameEntry(full, lite, name, 'Full 与 Lite'));
requireSameEntry(full, dependency, 'mermaid-capability.json', 'Full 与 Dependency');

const liteMermaidFiles = Object.keys(lite).filter((name) => name.startsWith('lib/mermaid/'));
if (liteMermaidFiles.length) {
  throw new Error(`Lite 不应包含 Mermaid 依赖：${liteMermaidFiles[0]}`);
}
const fullChunks = Object.keys(full).filter(
  (name) => name.startsWith('lib/mermaid/chunks/mermaid.esm.min/') && name.endsWith('.mjs')
);
if (fullChunks.length < 100) {
  throw new Error(`Full 的 Mermaid 分块不完整：${fullChunks.length}`);
}
const dependencyUnexpected = Object.keys(dependency).filter(
  (name) => name !== 'mermaid-capability.json' && !name.startsWith('lib/mermaid/')
);
if (dependencyUnexpected.length) {
  throw new Error(`Dependency 包含无关文件：${dependencyUnexpected[0]}`);
}
Object.keys(dependency)
  .filter((name) => name.startsWith('lib/mermaid/'))
  .forEach((name) => requireSameEntry(full, dependency, name, 'Full 与 Dependency'));

const checksums = await readFile(join(dist, 'SHA256SUMS.txt'), 'utf8');
for (const name of Object.values(archiveNames)) {
  const digest = createHash('sha256')
    .update(await readFile(join(dist, name)))
    .digest('hex');
  if (!checksums.includes(`${digest}  ${name}`)) {
    throw new Error(`${name} 的 SHA-256 记录不匹配`);
  }
}

console.log(
  `发行产物校验通过：Full ${fullChunks.length} 个 Mermaid 分块，Lite 无运行库，Dependency 可覆盖安装`
);

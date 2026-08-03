import { access, readFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readText = (path) => readFile(new URL(path, root), 'utf8');

const [html, manifestText, packageText] = await Promise.all([
  readText('index.html'),
  readText('manifest.json'),
  readText('package.json')
]);

const manifest = JSON.parse(manifestText);
const packageJson = JSON.parse(packageText);

if (manifest.version !== packageJson.version) {
  throw new Error(`版本号不一致：manifest=${manifest.version}, package=${packageJson.version}`);
}

for (const permission of ['storage', 'alarms']) {
  if (!manifest.permissions?.includes(permission)) {
    throw new Error(`manifest.json 缺少权限：${permission}`);
  }
}
const markdownContentScript = manifest.content_scripts?.find((entry) => (
  entry.matches?.includes('file:///*.md')
));
if (
  !markdownContentScript
  || markdownContentScript.js?.[0] !== 'pending-file-storage.js'
  || !markdownContentScript.js.includes('content.js')
) {
  throw new Error('Markdown content script 必须先加载 pending-file-storage.js');
}

if (packageJson.dependencies?.mermaid !== '11.16.0') {
  throw new Error(`Mermaid 必须锁定为 11.16.0，当前为 ${packageJson.dependencies?.mermaid || '未安装'}`);
}

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) {
  throw new Error(`index.html 存在重复 id：${[...new Set(duplicates)].join(', ')}`);
}

const requiredIds = [
  'editor',
  'preview',
  'toc',
  'openBtn',
  'saveBtn',
  'saveAsBtn',
  'exportHtmlBtn',
  'editModeBtn',
  'sourceAccessDialog',
  'mermaidInstallDialog'
];
const missingIds = requiredIds.filter((id) => !ids.includes(id));
if (missingIds.length) {
  throw new Error(`index.html 缺少必要控件：${missingIds.join(', ')}`);
}

const imageAssetsScriptIndex = html.indexOf('src="./image-assets.js"');
const pendingFilesScriptIndex = html.indexOf('src="./pending-file-storage.js"');
const appScriptIndex = html.indexOf('src="./app.js"');
if (
  pendingFilesScriptIndex < 0
  || pendingFilesScriptIndex > appScriptIndex
  || pendingFilesScriptIndex > imageAssetsScriptIndex
  || imageAssetsScriptIndex < 0
  || appScriptIndex < 0
  || imageAssetsScriptIndex > appScriptIndex
) {
  throw new Error('pending-file-storage.js 和 image-assets.js 必须在 app.js 之前加载');
}

const requiredFiles = [
  'app.js',
  'image-assets.js',
  'pending-file-storage.js',
  'mermaid-renderer.mjs',
  'mermaid-capability.mjs',
  'mermaid-capability.json',
  'background.js',
  'content.js',
  'style.css',
  'lib/markdown-it.min.js',
  'lib/purify.min.js',
  'lib/highlight.min.js',
  'lib/mermaid/mermaid.esm.min.mjs',
  'lib/mermaid/version.json'
];
await Promise.all(requiredFiles.map((path) => access(new URL(path, root))));

const capability = JSON.parse(await readText('mermaid-capability.json'));
const dependencyManifest = JSON.parse(await readText('lib/mermaid/version.json'));
if (capability.available !== true) {
  throw new Error('源码工作区必须启用 Mermaid 能力标记');
}
for (const descriptor of [capability, dependencyManifest]) {
  if (
    descriptor.name !== 'mermaid'
    || descriptor.version !== '11.16.0'
    || descriptor.rendererApi !== 1
  ) {
    throw new Error('Mermaid 能力标记或依赖清单版本不匹配');
  }
}

const mermaidChunks = (await readdir(new URL('lib/mermaid/chunks/mermaid.esm.min/', root)))
  .filter((name) => name.endsWith('.mjs'));
if (mermaidChunks.length < 100) {
  throw new Error(`Mermaid 运行分块不完整：仅发现 ${mermaidChunks.length} 个`);
}
if (dependencyManifest.chunks !== mermaidChunks.length) {
  throw new Error(
    `Mermaid 依赖清单分块数不一致：清单 ${dependencyManifest.chunks}，实际 ${mermaidChunks.length}`
  );
}

const mermaidEntry = await readText('lib/mermaid/mermaid.esm.min.mjs');
const requiredDiagramDetectors = [
  'architecture',
  'block',
  'classDiagram',
  'cynefin',
  'erDiagram',
  'eventmodeling',
  'flowchart',
  'gantt',
  'gitGraph',
  'ishikawa',
  'journey',
  'kanban',
  'mindmap',
  'packet',
  'pie',
  'quadrantChart',
  'radar',
  'railroad',
  'requirementDiagram',
  'sankey',
  'sequenceDiagram',
  'stateDiagram',
  'timeline',
  'treemap',
  'venn',
  'wardley',
  'xychart'
];
const missingDetectors = requiredDiagramDetectors.filter(
  (diagramType) => !mermaidEntry.includes(diagramType)
);
if (missingDetectors.length) {
  throw new Error(`Mermaid 完整图表入口缺少检测器：${missingDetectors.join(', ')}`);
}

console.log(`项目结构校验通过（v${manifest.version}）`);

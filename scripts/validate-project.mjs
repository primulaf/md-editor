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

if (packageJson.dependencies?.mermaid !== '11.16.1') {
  throw new Error(`Mermaid 必须锁定为 11.16.1，当前为 ${packageJson.dependencies?.mermaid || '未安装'}`);
}
if (packageJson.dependencies?.dompurify !== '3.4.13') {
  throw new Error('DOMPurify 必须锁定为已修复安全问题的 3.4.13');
}
if (packageJson.dependencies?.katex !== '0.18.4') {
  throw new Error('KaTeX 必须锁定为 0.18.4');
}
if (packageJson.dependencies?.['markdown-it-texmath'] !== '1.0.0') {
  throw new Error('markdown-it-texmath 必须锁定为 1.0.0');
}
if (packageJson.dependencies?.['markdown-it-task-lists'] !== '2.1.1') {
  throw new Error('markdown-it-task-lists 必须锁定为 2.1.1');
}
if (packageJson.dependencies?.['markdown-it-footnote'] !== '4.0.0') {
  throw new Error('markdown-it-footnote 必须锁定为 4.0.0');
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
  'exportPdfBtn',
  'themeBtn',
  'recentBtn',
  'recentMenu',
  'recentList',
  'moreBtn',
  'moreMenu',
  'fontSizeControl',
  'editModeBtn',
  'sourceAccessDialog',
  'mermaidInstallDialog'
];
const missingIds = requiredIds.filter((id) => !ids.includes(id));
if (missingIds.length) {
  throw new Error(`index.html 缺少必要控件：${missingIds.join(', ')}`);
}

const imageAssetsScriptIndex = html.indexOf('src="./image-assets.js"');
const documentStatsScriptIndex = html.indexOf('src="./document-stats.js"');
const themeInitScriptIndex = html.indexOf('src="./theme-init.js"');
const styleSheetIndex = html.indexOf('href="./style.css"');
const katexStyleIndex = html.indexOf('href="./lib/katex/katex.min.css"');
const pendingFilesScriptIndex = html.indexOf('src="./pending-file-storage.js"');
const recentFilesScriptIndex = html.indexOf('src="./recent-files.js"');
const mermaidToolsScriptIndex = html.indexOf('src="./mermaid-tools.js"');
const codeBlockToolsScriptIndex = html.indexOf('src="./code-block-tools.js"');
const mathRenderingScriptIndex = html.indexOf('src="./math-rendering.js"');
const katexScriptIndex = html.indexOf('src="./lib/katex/katex.min.js"');
const texmathScriptIndex = html.indexOf('src="./lib/texmath.js"');
const appScriptIndex = html.indexOf('src="./app.js"');
if (
  pendingFilesScriptIndex < 0
  || themeInitScriptIndex < 0
  || styleSheetIndex < 0
  || katexStyleIndex < 0
  || themeInitScriptIndex > styleSheetIndex
  || katexStyleIndex > styleSheetIndex
  || pendingFilesScriptIndex > appScriptIndex
  || pendingFilesScriptIndex > imageAssetsScriptIndex
  || imageAssetsScriptIndex < 0
  || documentStatsScriptIndex < 0
  || recentFilesScriptIndex < 0
  || mermaidToolsScriptIndex < 0
  || codeBlockToolsScriptIndex < 0
  || mathRenderingScriptIndex < 0
  || katexScriptIndex < 0
  || texmathScriptIndex < 0
  || appScriptIndex < 0
  || imageAssetsScriptIndex > appScriptIndex
  || documentStatsScriptIndex > appScriptIndex
  || recentFilesScriptIndex > appScriptIndex
  || mermaidToolsScriptIndex > appScriptIndex
  || codeBlockToolsScriptIndex > appScriptIndex
  || mathRenderingScriptIndex > appScriptIndex
  || katexScriptIndex > appScriptIndex
  || texmathScriptIndex > appScriptIndex
  || katexScriptIndex > texmathScriptIndex
) {
  throw new Error('主题和核心辅助脚本的加载顺序不正确');
}

const requiredFiles = [
  'app.js',
  'code-block-tools.js',
  'math-rendering.js',
  'theme-init.js',
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
  'lib/markdown-it.min.js',
  'lib/markdownItTaskLists.min.js',
  'lib/markdownItFootnote.min.js',
  'lib/texmath.js',
  'lib/purify.min.js',
  'lib/katex/katex.min.js',
  'lib/katex/katex.min.css',
  'lib/katex/version.json',
  'lib/katex/fonts/KaTeX_Main-Regular.woff2',
  'lib/highlight.min.js',
  'lib/mermaid/mermaid.esm.min.mjs',
  'lib/mermaid/version.json'
];
await Promise.all(requiredFiles.map((path) => access(new URL(path, root))));

const capability = JSON.parse(await readText('mermaid-capability.json'));
const dependencyManifest = JSON.parse(await readText('lib/mermaid/version.json'));
const katexManifest = JSON.parse(await readText('lib/katex/version.json'));
if (capability.available !== true) {
  throw new Error('源码工作区必须启用 Mermaid 能力标记');
}

if (
  katexManifest.name !== 'katex'
  || katexManifest.version !== packageJson.dependencies.katex
  || katexManifest.parser !== 'markdown-it-texmath'
  || katexManifest.parserVersion !== packageJson.dependencies['markdown-it-texmath']
) {
  throw new Error('KaTeX 依赖清单版本不匹配');
}
const katexFonts = (await readdir(new URL('lib/katex/fonts/', root)))
  .filter((name) => name.endsWith('.woff2'));
if (katexFonts.length !== 20 || katexManifest.fonts !== katexFonts.length) {
  throw new Error(`KaTeX 字体不完整：${katexFonts.length}`);
}
const katexCss = await readText('lib/katex/katex.min.css');
if (/fonts\/[^)]*\.(?:woff|ttf)\b/.test(katexCss)) {
  throw new Error('KaTeX CSS 引用了未打包的旧字体格式');
}
for (const descriptor of [capability, dependencyManifest]) {
  if (
    descriptor.name !== 'mermaid'
    || descriptor.version !== packageJson.dependencies.mermaid
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

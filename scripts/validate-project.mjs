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
  'sourceAccessDialog'
];
const missingIds = requiredIds.filter((id) => !ids.includes(id));
if (missingIds.length) {
  throw new Error(`index.html 缺少必要控件：${missingIds.join(', ')}`);
}

const requiredFiles = [
  'app.js',
  'mermaid-renderer.mjs',
  'background.js',
  'content.js',
  'style.css',
  'lib/markdown-it.min.js',
  'lib/purify.min.js',
  'lib/highlight.min.js',
  'lib/mermaid/mermaid.esm.min.mjs'
];
await Promise.all(requiredFiles.map((path) => access(new URL(path, root))));

const mermaidChunks = (await readdir(new URL('lib/mermaid/chunks/mermaid.esm.min/', root)))
  .filter((name) => name.endsWith('.mjs'));
if (mermaidChunks.length < 100) {
  throw new Error(`Mermaid 运行分块不完整：仅发现 ${mermaidChunks.length} 个`);
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

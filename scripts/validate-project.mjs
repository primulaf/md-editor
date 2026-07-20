import { access, readFile } from 'node:fs/promises';

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
  'background.js',
  'content.js',
  'style.css',
  'lib/markdown-it.min.js',
  'lib/purify.min.js',
  'lib/highlight.min.js'
];
await Promise.all(requiredFiles.map((path) => access(new URL(path, root))));

console.log(`项目结构校验通过（v${manifest.version}）`);

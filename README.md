# md.

离线 Markdown 阅读与编辑 Chrome 扩展。GitHub 风格白底界面，支持默认阅读、按需编辑、源文件保存、目录导航、图片粘贴和 HTML 导出，可直接打开本地 .md 文件。

当前稳定版本：**v1.5.0**。可从 [GitHub Releases](https://github.com/primulaf/md-editor/releases/latest) 下载扩展压缩包，详细改动见 [v1.5.0 版本说明](docs/releases/v1.5.0.md)。

## 功能

- **默认阅读模式** — 打开文件后只显示目录和预览，点击“编辑文档”后再显示编辑区
- **源文件保存** — 工具内打开的文件可直接写回；双击接管的文件首次保存时引导选择源文件
- **保存与另存为** — 保存写回当前目标，另存为创建新的 Markdown 文件
- **实时编辑与预览** — 编辑区和预览区同步滚动，可调整双栏比例或单独显示
- **可折叠目录** — 按标题层级展开或收起，单击跳转，滚动时自动高亮，长标题自适应省略
- **GitHub 风格界面** — 白底黑字、系统字体、默认预览优先
- **五档字号** — 小 / 中 / 大 / 特大 / 超大，侧边栏、编辑区和预览区同步缩放
- **图片处理** — 支持粘贴、拖拽图片，自动转为 DataURL 内嵌
- **HTML 导出** — 完整自包含 HTML 文件，保留样式和代码高亮
- **拖拽 .md 文件** — 将 .md 文件拖入编辑器直接加载
- **双击 .md 关联打开** — 设置后双击 .md 文件自动用 Chrome 打开渲染
- **未保存提醒** — 关闭标签页时检测未保存更改
- **标签页状态隔离** — 多个文档的内容、文件名和未保存状态互不影响
- **文件名标签页** — 多个文档同时打开时直接通过标签页标题区分
- **代码高亮** — 支持 JS / TS / Python / Bash / SQL / HTML / CSS / JSON

## 安装

### 方式一：加载已解压的扩展

1. 从 [GitHub Releases](https://github.com/primulaf/md-editor/releases/latest) 下载 `md-editor-extension.zip` 并解压
2. 打开 Chrome，地址栏输入 `chrome://extensions`
3. 开启右上角「**开发者模式**」
4. 点击「**加载已解压的扩展程序**」
5. 选择解压后的文件夹

### 方式二：从源码构建

```bash
git clone https://github.com/primulaf/md-editor.git
cd md-editor
npm install
npx esbuild --bundle --format=iife --global-name=hljs _hljs_bundle.cjs --outfile=lib/highlight.min.js
```

然后在 `chrome://extensions` 中加载项目目录。

## 关联 .md 文件

让双击 .md 文件直接用编辑器打开：

1. 在 `chrome://extensions` 找到 **md.** 扩展
2. 点击「详细信息」，开启「**允许访问文件网址**」
3. 在 Windows 中将 `.md` 文件关联到 Chrome：
   - 右键任意 .md 文件 → 打开方式 → 选择其他应用
   - 勾选「始终使用此应用打开 .md 文件」→ 选择 Chrome

之后双击 .md 文件即可自动渲染。

## 阅读与保存

- 文件打开后默认进入阅读模式，点击预览区右上角的「编辑文档」进入编辑模式。
- 从工具内点击「打开」并选择文件后，首次写入可能需要确认权限，后续「保存」直接写回该文件。
- 双击 `.md` 由扩展接管时，Chrome 不会把源文件写入权限交给扩展。修改后首次点击「保存」，请选择原文件完成授权，或使用「另存为」创建新文件。
- 「导出 HTML」只生成 HTML，不会改变 Markdown 的保存目标，也不会清除 Markdown 的未保存状态。

## 快捷键

| 快捷键 | 操作 |
|---|---|
| `Ctrl/Cmd + S` | 保存当前 Markdown |
| `Ctrl/Cmd + Shift + S` | 另存为 Markdown |
| `Ctrl/Cmd + E` | 导出 HTML |
| `Ctrl/Cmd + O` | 打开 .md 文件 |

## 技术栈

- **Markdown 渲染**：[markdown-it](https://github.com/markdown-it/markdown-it) + markdown-it-anchor
- **XSS 防护**：[DOMPurify](https://github.com/cure53/DOMPurify)
- **代码高亮**：[highlight.js](https://highlightjs.org/)（精简子集，9 种语言）
- **字体**：GitHub 风格系统字体栈，编辑区与代码块使用系统等宽字体
- **扩展框架**：Chrome Extension Manifest V3

## 项目结构

```
├── manifest.json      # Chrome 扩展配置 (MV3)
├── background.js      # Service Worker：工具栏图标 + 文件关联跳转
├── content.js         # Content Script：拦截 file://*.md 读取内容
├── index.html         # 主页面
├── app.js             # 全部业务逻辑
├── style.css          # 样式系统
├── docs/              # 迭代 Spec 与实施计划
├── icons/             # 扩展图标 (16/48/128)
├── lib/               # 第三方依赖（本地化）
│   ├── markdown-it.min.js
│   ├── markdownItAnchor.umd.js
│   ├── purify.min.js
│   ├── highlight.min.js
│   └── github*.min.css
└── fonts/
    └── jetbrains-mono.woff2
```

## 许可

MIT

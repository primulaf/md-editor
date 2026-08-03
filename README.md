# md.

离线 Markdown 阅读与编辑 Chrome 扩展。采用 GitHub 风格明暗主题，支持 Mermaid 图表、最近文件、任务列表、脚注、源文件保存、目录导航、图片粘贴和 HTML 导出，可直接打开本地 .md 文件。

当前稳定版本：**v1.7.0**，可从 [GitHub Releases](https://github.com/primulaf/md-editor/releases/latest) 下载。完整改动见 [v1.7.0 版本说明](docs/releases/v1.7.0.md)。

## 功能

- **离线 Mermaid 图表** — 完整运行库随扩展提供，支持缩放及单图下载 SVG / PNG
- **明暗主题** — GitHub 风格浅色与深色模式即时切换，多标签页同步偏好
- **最近文件** — 记住最多 12 个工具内打开或双击关联的文件；有句柄时尽量恢复直接保存，关联文件按只读来源重新读取
- **任务列表与脚注** — 预览及 HTML 导出均支持，Markdown 源码保持不变
- **默认阅读模式** — 打开文件后只显示目录和预览，点击“编辑文档”后再显示编辑区
- **源文件保存** — 工具内打开的文件可直接写回；双击接管的文件首次保存时引导选择源文件
- **保存与另存为** — 保存写回当前目标，另存为创建新的 Markdown 文件
- **实时编辑与预览** — 编辑区和预览区同步滚动，可调整双栏比例或单独显示
- **可折叠目录** — 按标题层级展开或收起，单击跳转，滚动时自动高亮，长标题自适应省略
- **GitHub 风格界面** — 白底黑字、系统字体、默认预览优先
- **三档字号** — 小 / 中 / 大，侧边栏、编辑区和预览区同步缩放
- **紧凑侧栏** — 文档与编辑操作分组，低频命令按需展开；目录下方提供排除图片编码和图表源码的阅读摘要
- **图片处理** — 支持粘贴、拖拽图片；编辑时以短引用呈现，保存时自动还原为可移植的 DataURL
- **HTML 导出** — 完整自包含 HTML 文件，保留样式和代码高亮
- **拖拽 .md 文件** — 将 .md 文件拖入编辑器直接加载
- **双击 .md 关联打开** — 设置后双击 .md 文件自动用 Chrome 打开渲染
- **未保存提醒** — 关闭标签页时检测未保存更改
- **标签页状态隔离** — 多个文档的内容、文件名和未保存状态互不影响
- **文件名标签页** — 多个文档同时打开时直接通过标签页标题区分
- **代码高亮** — 支持 JS / TS / Python / Bash / SQL / HTML / CSS / JSON

## 安装

### 方式一：加载发行包

v1.6.2 起统一提供单一完整扩展包。v1.7.0 发行包为 `md-editor-1.7.0.zip`，其中已包含 Mermaid 离线运行库。

1. 从 [GitHub Releases](https://github.com/primulaf/md-editor/releases/latest) 下载 `md-editor-1.7.0.zip`，并解压到一个新的空文件夹
2. 打开 Chrome，地址栏输入 `chrome://extensions`
3. 开启右上角「**开发者模式**」
4. 点击「**加载已解压的扩展程序**」
5. 选择解压后的文件夹

从旧版 Full 或 Lite 包升级时，请使用新的空文件夹，不要覆盖旧目录。发布附件同时提供 `SHA256SUMS.txt`，可用于核对 ZIP 完整性。

### 方式二：从源码构建

```bash
git clone https://github.com/primulaf/md-editor.git
cd md-editor
npm install
npm run vendor
npm test
npm run package
```

`npm run package` 会在 `dist/` 中生成 `md-editor-<version>.zip` 和单行 `SHA256SUMS.txt`。开发时也可以直接在 `chrome://extensions` 中加载项目目录。

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
- 工具内打开和双击关联的文件都会进入「最近」列表。双击文件再次打开时读取磁盘上的最新内容，但仍需在保存时选择源文件取得写入权限。
- 「导出 HTML」只生成 HTML，不会改变 Markdown 的保存目标，也不会清除 Markdown 的未保存状态。

## Mermaid 图表

使用语言标记为 `mermaid` 的代码围栏：

````markdown
```mermaid
mindmap
  root((项目))
    设计
    开发
```
````

- 图表类型由 Mermaid 自动识别，支持当前锁定版本内置的全部类型。
- 扩展仅在本地能力标记和依赖清单均有效时加载 Mermaid。
- 运行库缺失、版本不兼容或依赖损坏时显示源码，并在第一个 Mermaid 块提供重新安装说明。
- 图表完全离线渲染，不会请求 CDN 或远程脚本。
- 图表语法错误时会在对应位置显示源码，不影响其他内容。
- 将鼠标移入图表可缩放或下载 SVG / PNG；缩放只影响当前预览，不影响 HTML 导出。
- 单篇文档最多渲染 50 个图表，单图最多 50000 个字符。
- 为保持完全离线，图表中的远程图片和远程样式不会加载。
- HTML 导出会直接内联 SVG，导出文件不需要 Mermaid 运行库。

## 快捷键

| 快捷键 | 操作 |
|---|---|
| `Ctrl/Cmd + S` | 保存当前 Markdown |
| `Ctrl/Cmd + Shift + S` | 另存为 Markdown |
| `Ctrl/Cmd + E` | 导出 HTML |
| `Ctrl/Cmd + O` | 打开 .md 文件 |

## 技术栈

- **Markdown 渲染**：[markdown-it](https://github.com/markdown-it/markdown-it) + anchor / task-lists / footnote 插件
- **图表渲染**：[Mermaid](https://mermaid.js.org/) 11.16.0（完整内置图表、按需 ESM 分块）
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
├── image-assets.js    # 图片 DataURL 短引用、恢复与去重
├── document-stats.js  # 正文字数、阅读时间与标题统计
├── recent-files.js    # 最近文件句柄/关联地址、排序与去重
├── pending-file-storage.js # 关联文件临时数据与过期清理
├── mermaid-renderer.mjs # Mermaid 异步渲染、缓存与安全控制
├── mermaid-tools.js   # Mermaid 缩放与 SVG/PNG 下载
├── mermaid-capability.mjs # Mermaid 组件能力与版本探测
├── mermaid-capability.json # 当前构建是否包含 Mermaid
├── style.css          # 样式系统
├── scripts/           # 依赖同步、单包打包与校验
├── docs/              # 迭代 Spec 与实施计划
├── icons/             # 扩展图标 (16/48/128)
├── lib/               # 第三方依赖（本地化）
│   ├── markdown-it.min.js
│   ├── markdownItAnchor.umd.js
│   ├── purify.min.js
│   ├── highlight.min.js
│   ├── mermaid/        # Mermaid 版本清单、ESM 入口与类型分块
│   └── github*.min.css
└── fonts/
    └── jetbrains-mono.woff2
```

## 许可

MIT

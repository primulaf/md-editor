# md.

离线 Markdown 编辑器 Chrome 扩展。简洁扁平化设计，支持实时预览、深色模式、目录导航、图片粘贴、HTML 导出，可直接打开本地 .md 文件。

## 功能

- **实时编辑与预览** — 三栏布局，编辑区和预览区同步滚动
- **目录自动生成** — 单击跳转，滚动时高亮当前章节
- **深色 / 浅色模式** — 暖色调暗色默认，可切换浅色
- **三档字号** — 小 / 中 / 大，侧边栏和预览区跟随缩放
- **图片处理** — 支持粘贴、拖拽图片，自动转为 DataURL 内嵌
- **HTML 导出** — 完整自包含 HTML 文件，保留样式和代码高亮
- **拖拽 .md 文件** — 将 .md 文件拖入编辑器直接加载
- **双击 .md 关联打开** — 设置后双击 .md 文件自动用 Chrome 打开渲染
- **未保存提醒** — 关闭标签页时检测未保存更改
- **代码高亮** — 支持 JS / TS / Python / Bash / SQL / HTML / CSS / JSON

## 安装

### 方式一：加载已解压的扩展

1. 下载 `md-editor-extension.zip` 并解压
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

## 快捷键

| 快捷键 | 操作 |
|---|---|
| `Ctrl/Cmd + S` | 保存下载 .md |
| `Ctrl/Cmd + E` | 导出 HTML |
| `Ctrl/Cmd + O` | 打开 .md 文件 |

## 技术栈

- **Markdown 渲染**：[markdown-it](https://github.com/markdown-it/markdown-it) + markdown-it-anchor
- **XSS 防护**：[DOMPurify](https://github.com/cure53/DOMPurify)
- **代码高亮**：[highlight.js](https://highlightjs.org/)（精简子集，9 种语言）
- **字体**：JetBrains Mono（本地 woff2）
- **扩展框架**：Chrome Extension Manifest V3

## 项目结构

```
├── manifest.json      # Chrome 扩展配置 (MV3)
├── background.js      # Service Worker：工具栏图标 + 文件关联跳转
├── content.js         # Content Script：拦截 file://*.md 读取内容
├── index.html         # 主页面
├── app.js             # 全部业务逻辑
├── style.css          # 样式系统
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

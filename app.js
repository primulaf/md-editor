const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const toc = document.getElementById("toc");
const fileInput = document.getElementById("fileInput");
const openBtn = document.getElementById("openBtn");
const saveBtn = document.getElementById("saveBtn");
const exportHtmlBtn = document.getElementById("exportHtmlBtn");
const themeBtn = document.getElementById("themeBtn");
const newBtn = document.getElementById("newBtn");
const fileNameEl = document.getElementById("fileName");
const statusEl = document.getElementById("status");
const hljsThemeEl = document.getElementById("hljs-theme");

const statChars = document.getElementById("statChars");
const statLines = document.getElementById("statLines");
const statHeadings = document.getElementById("statHeadings");
const statReadTime = document.getElementById("statReadTime");

// 文件名对话框相关元素
const filenameDialog = document.getElementById("filenameDialog");
const filenameInput = document.getElementById("filenameInput");
const filenameCancelBtn = document.getElementById("filenameCancelBtn");
const filenameConfirmBtn = document.getElementById("filenameConfirmBtn");
const filenameDialogTitle = document.getElementById("filenameDialogTitle");

const STORAGE_KEY = "md-editor-content";
const STORAGE_FILE_NAME_KEY = "md-editor-file-name";
const STORAGE_THEME_KEY = "md-editor-theme";

let currentFileName = "未命名文档.md";
let syncingFrom = null;
let lastHighlightError = false;
let isTocScrolling = false;

// 文件名对话框状态
let pendingFilenameCallback = null;
let pendingOperationType = null; // 'save' 或 'export'

/**
 * 显示文件名输入对话框
 * @param {string} title - 对话框标题
 * @param {string} defaultValue - 输入框默认值
 * @param {string} operationType - 操作类型 ('save' 或 'export')
 * @param {Function} callback - 确认回调函数，接收输入的文件名
 */
function showFilenameDialog(title, defaultValue, operationType, callback) {
  if (!filenameDialog || !filenameInput || !filenameDialogTitle) return;
  
  pendingFilenameCallback = callback;
  pendingOperationType = operationType;
  
  filenameDialogTitle.textContent = title;
  filenameInput.value = defaultValue;
  filenameInput.focus();
  filenameDialog.hidden = false;
  
  // 确保对话框在最前面
  requestAnimationFrame(() => {
    filenameDialog.style.display = 'flex';
  });
}

/**
 * 隐藏文件名输入对话框
 */
function hideFilenameDialog() {
  if (!filenameDialog) return;
  
  filenameDialog.hidden = true;
  filenameDialog.style.display = 'none';
  filenameInput.value = '';
  pendingFilenameCallback = null;
  pendingOperationType = null;
}

/**
 * 处理文件名确认
 */
function handleFilenameConfirm() {
  if (!pendingFilenameCallback) {
    hideFilenameDialog();
    return;
  }
  
  const newFilename = filenameInput.value.trim();
  if (!newFilename) {
    // 如果用户没有输入，使用默认值
    const defaultName = pendingOperationType === 'export' 
      ? `${(currentFileName || "Markdown导出").replace(/\.md$/i, "")}.html`
      : currentFileName || "未命名文档.md";
    
    pendingFilenameCallback(defaultName);
  } else {
    pendingFilenameCallback(newFilename);
  }
  
  hideFilenameDialog();
}

/**
 * 处理文件名取消
 */
function handleFilenameCancel() {
  hideFilenameDialog();
  setStatus(pendingOperationType === 'export' ? '已取消 HTML 导出' : '已取消保存');
}

/**
 * 验证文件名（确保有合适的扩展名）
 * @param {string} filename - 要验证的文件名
 * @param {string} expectedExt - 期望的扩展名（如 '.md' 或 '.html'）
 * @returns {string} 验证后的文件名（已确保正确的扩展名）
 */
function validateFilename(filename, expectedExt) {
  if (!filename || filename.trim() === '') {
    return `未命名文档${expectedExt}`;
  }
  
  let validated = filename.trim();
  const lowerExpected = expectedExt.toLowerCase();
  const lowerValidated = validated.toLowerCase();
  
  // 如果已经有正确的扩展名，直接返回
  if (lowerValidated.endsWith(lowerExpected)) {
    return validated;
  }
  
  // 如果有其他扩展名，替换它
  const lastDotIndex = validated.lastIndexOf('.');
  if (lastDotIndex > 0) {
    // 有扩展名，替换它
    validated = validated.substring(0, lastDotIndex) + expectedExt;
  } else {
    // 没有扩展名，添加它
    validated += expectedExt;
  }
  
  return validated;
}

/**
 * 生成适合标题锚点的 slug
 */
function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\u4e00-\u9fa5a-z0-9\-]/g, "")
    .replace(/\-+/g, "-")
    .replace(/^\-|\-$/g, "") || "section";
}

/**
 * HTML 转义
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * CSS.escape 兼容封装
 */
function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }
  return String(value).replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
}

/**
 * 防抖
 */
function debounce(fn, delay = 120) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * 设置状态
 */
function setStatus(text) {
  if (statusEl) {
    statusEl.textContent = text;
  }
}

/**
 * 提取标题纯文本（排除标题锚点和隐藏辅助文本）
 */
function getHeadingPlainText(heading) {
  const clone = heading.cloneNode(true);
  clone.querySelectorAll(".header-anchor").forEach((el) => el.remove());
  clone.querySelectorAll(".visually-hidden").forEach((el) => el.remove());
  return (clone.textContent || "").trim();
}

/**
 * markdown-it 初始化
 */
const md = window.markdownit({
  html: true,
  linkify: true,
  breaks: true,
  typographer: true,
  highlight(str, lang) {
    if (lang && window.hljs && hljs.getLanguage(lang)) {
      try {
        const highlighted = hljs.highlight(str, {
          language: lang,
          ignoreIllegals: true
        }).value;
        return `<pre class="hljs"><code>${highlighted}</code></pre>`;
      } catch (err) {
        console.error("代码高亮失败：", err);
        lastHighlightError = true;
      }
    }
    const escaped = md.utils.escapeHtml(str);
    return `<pre class="hljs"><code>${escaped}</code></pre>`;
  }
});

if (window.markdownitAnchor) {
  md.use(window.markdownitAnchor, {
    slugify,
    permalink: window.markdownitAnchor.permalink.linkInsideHeader({
      symbol: "#",
      placement: "after",
      class: "header-anchor",
      assistiveText: (title) => `跳转到标题：${title}`,
      visuallyHiddenClass: "visually-hidden"
    })
  });
}

/**
 * 渲染 Markdown
 */
function renderMarkdown() {
  lastHighlightError = false;
  const source = editor.value || "";
  const rawHtml = md.render(source);

  const safeHtml = DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel", "class", "id", "aria-hidden", "aria-label"]
  });

  preview.innerHTML = safeHtml;

  // 所有外链新窗口打开
  preview.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (href.startsWith("http://") || href.startsWith("https://")) {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    }
  });

  buildToc();
  updateStats();
  persist();
  updateActiveTocOnScroll();
  setStatus(lastHighlightError ? "已渲染（部分代码高亮暂不可用）" : "已渲染");
}

/**
 * 生成目录
 */
function buildToc() {
  const headings = preview.querySelectorAll("h1, h2, h3, h4, h5, h6");

  if (!headings.length) {
    toc.innerHTML = `<div class="toc-empty">当前文档还没有标题</div>`;
    return;
  }

  const usedIds = new Set();
  const items = [];

  headings.forEach((heading, index) => {
    let id = (heading.id || "").trim();
    const text = getHeadingPlainText(heading);

    if (!id) {
      id = slugify(text) || `heading-${index + 1}`;
    }

    // 保证唯一
    let uniqueId = id;
    let counter = 2;
    while (usedIds.has(uniqueId)) {
      uniqueId = `${id}-${counter}`;
      counter += 1;
    }

    heading.id = uniqueId;
    usedIds.add(uniqueId);

    const level = Number(heading.tagName.replace("H", ""));

    items.push(`
      <div class="toc-item level-${level}">
        <a
          href="#${encodeURIComponent(uniqueId)}"
          class="toc-link"
          data-target="${uniqueId}"
          title="${escapeHtml(text)}"
        >
          ${escapeHtml(text)}
        </a>
      </div>
    `);
  });

  toc.innerHTML = items.join("");
}

/**
 * 高亮当前目录项
 */
function highlightActiveToc(activeId) {
  toc.querySelectorAll(".toc-link").forEach((link) => {
    const isActive = link.dataset.target === activeId;
    link.classList.toggle("active", isActive);
  });
}

/**
 * 根据预览区滚动位置更新当前目录高亮
 */
function updateActiveTocOnScroll() {
  if (isTocScrolling) return;
  const headings = Array.from(preview.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  if (!headings.length) return;

  const previewRect = preview.getBoundingClientRect();
  let current = headings[0];

  for (const heading of headings) {
    const rect = heading.getBoundingClientRect();
    if (rect.top - previewRect.top <= 40) {
      current = heading;
    } else {
      break;
    }
  }

  if (current && current.id) {
    highlightActiveToc(current.id);
  }
}

/**
 * 更新统计信息
 */
function updateStats() {
  const content = editor.value || "";
  const lines = content ? content.split(/\r?\n/).length : 0;
  const chars = content.replace(/\s+/g, "").length;
  const headingCount = (content.match(/^#{1,6}\s+/gm) || []).length;
  const minutes = Math.max(1, Math.ceil(chars / 300));

  if (statChars) statChars.textContent = String(chars);
  if (statLines) statLines.textContent = String(lines);
  if (statHeadings) statHeadings.textContent = String(headingCount);
  if (statReadTime) statReadTime.textContent = `${minutes} 分钟`;
}

/**
 * 本地持久化
 */
function persist() {
  localStorage.setItem(STORAGE_KEY, editor.value);
  localStorage.setItem(STORAGE_FILE_NAME_KEY, currentFileName);
}

/**
 * 恢复本地内容
 */
function restore() {
  const cachedContent = localStorage.getItem(STORAGE_KEY);
  const cachedFileName = localStorage.getItem(STORAGE_FILE_NAME_KEY);

  currentFileName = cachedFileName || "未命名文档.md";
  if (fileNameEl) {
    fileNameEl.textContent = currentFileName;
  }

  if (cachedContent && cachedContent.trim()) {
    editor.value = cachedContent;
  } else {
    editor.value = defaultMarkdown();
  }
}

/**
 * 主题控制
 */
function applyTheme(theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);

  // 如果页面中有 hljs 主题 link，则同步切换
  if (hljsThemeEl) {
    hljsThemeEl.href =
      theme === "dark"
        ? "https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github-dark.min.css"
        : "https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css";
  }

  localStorage.setItem(STORAGE_THEME_KEY, theme);

  if (themeBtn) {
    themeBtn.textContent =
      theme === "dark" ? "切换浅色模式" : "切换深色模式";
  }
}

function restoreTheme() {
  const saved = localStorage.getItem(STORAGE_THEME_KEY) || "light";
  applyTheme(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "dark" ? "light" : "dark");
}

/**
 * 打开 .md 文件
 */
function openMarkdownFile() {
  fileInput.click();
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    editor.value = typeof reader.result === "string" ? reader.result : "";
    currentFileName = file.name || "未命名文档.md";
    if (fileNameEl) fileNameEl.textContent = currentFileName;
    renderMarkdown();
    setStatus(`已打开：${currentFileName}`);
    fileInput.value = "";
  };
  reader.onerror = () => {
    const error = reader.error;
    let message = "文件读取失败";
    if (error) {
      if (error.name === "NotFoundError") {
        message = "文件不存在或已被移动";
      } else if (error.name === "SecurityError") {
        message = "安全限制，无法读取文件";
      } else if (error.name === "NotReadableError") {
        message = "文件不可读（可能被其他程序占用）";
      } else if (error.name === "EncodingError") {
        message = "文件编码不支持（请使用 UTF-8 编码）";
      }
    }
    setStatus(message);
    fileInput.value = "";
  };
  reader.readAsText(file, "utf-8");
});

/**
 * 实际保存 Markdown 文件（内部函数）
 * @param {string} filename - 要保存的文件名
 */
function _saveMarkdownFile(filename) {
  const validatedFilename = validateFilename(filename, '.md');
  
  // 更新当前文件名和 UI
  currentFileName = validatedFilename;
  if (fileNameEl) fileNameEl.textContent = currentFileName;
  persist(); // 更新本地存储
  
  const blob = new Blob([editor.value], {
    type: "text/markdown;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = currentFileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  setStatus(`已保存：${currentFileName}`);
}

/**
 * 保存 Markdown（带文件名提示）
 */
function saveMarkdownFile() {
  showFilenameDialog(
    "保存 Markdown 文件",
    currentFileName || "未命名文档.md",
    'save',
    (filename) => {
      _saveMarkdownFile(filename);
    }
  );
}

/**
 * 生成 HTML 导出模板
 */
function generateHtmlTemplate(title, renderedHtml, theme) {
  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="${theme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: ${theme === "dark" ? "#0f172a" : "#ffffff"};
      --text: ${theme === "dark" ? "#e5e7eb" : "#1f2937"};
      --border: ${theme === "dark" ? "#243041" : "#e5e7eb"};
      --blockquote-bg: ${theme === "dark" ? "#101827" : "#f8fafc"};
      --blockquote-border: ${theme === "dark" ? "#334155" : "#cbd5e1"};
      --inline-code-bg: ${theme === "dark" ? "#1f2937" : "#f3f4f6"};
      --pre-bg: ${theme === "dark" ? "#0b1220" : "#f6f8fa"};
      --table-th-bg: ${theme === "dark" ? "#111827" : "#f9fafb"};
      --link: ${theme === "dark" ? "#60a5fa" : "#2563eb"};
    }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family:
        -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
        "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 32px 20px 64px;
      line-height: 1.8;
    }
    .container h1, .container h2, .container h3, .container h4, .container h5, .container h6 {
      margin-top: 1.6em;
      margin-bottom: 0.8em;
      line-height: 1.35;
    }
    .container h1 {
      font-size: 2em;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.3em;
    }
    .container h2 {
      font-size: 1.5em;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.3em;
    }
    .container pre {
      background: var(--pre-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 16px;
      overflow: auto;
    }
    .container code {
      font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
        "Liberation Mono", "Courier New", monospace;
      font-size: 0.92em;
    }
    .container :not(pre) > code {
      background: var(--inline-code-bg);
      border-radius: 6px;
      padding: 0.15em 0.4em;
    }
    .container blockquote {
      margin: 1em 0;
      padding: 0.8em 1em;
      background: var(--blockquote-bg);
      border-left: 4px solid var(--blockquote-border);
      border-radius: 8px;
      color: ${theme === "dark" ? "#9ca3af" : "#475569"};
    }
    .container table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
      display: block;
      overflow-x: auto;
    }
    .container th, .container td {
      border: 1px solid var(--border);
      padding: 8px 12px;
      text-align: left;
    }
    .container th {
      background: var(--table-th-bg);
    }
    .container img {
      max-width: 100%;
      border-radius: 10px;
    }
    .container a {
      color: var(--link);
      text-decoration: none;
    }
    .container a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <main class="container">
    ${renderedHtml}
  </main>
</body>
</html>`;
}

/**
 * 下载 HTML 文件
 */
function downloadHtmlFile(content, filename) {
  const blob = new Blob([content], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  
  return a.download;
}

/**
 * 实际导出 HTML 文件（内部函数）
 * @param {string} filename - 要导出的 HTML 文件名
 */
function _exportHtmlFile(filename) {
  const validatedFilename = validateFilename(filename, '.html');
  const title = validatedFilename.replace(/\.html$/i, "");
  const renderedHtml = preview.innerHTML;
  const theme = document.documentElement.getAttribute("data-theme") || "light";

  const htmlContent = generateHtmlTemplate(title, renderedHtml, theme);
  const downloadedFilename = downloadHtmlFile(htmlContent, validatedFilename);
  
  setStatus(`已导出 HTML：${downloadedFilename}`);
}

/**
 * 导出 HTML（带文件名提示）
 */
function exportHtmlFile() {
  const defaultHtmlName = `${(currentFileName || "Markdown导出").replace(/\.md$/i, "")}.html`;
  
  showFilenameDialog(
    "导出 HTML 文件",
    defaultHtmlName,
    'export',
    (filename) => {
      _exportHtmlFile(filename);
    }
  );
}

/**
 * 新建文档
 */
function newDocument() {
  const ok = window.confirm("确定要新建文档吗？当前未保存的更改可能会丢失。");
  if (!ok) return;

  currentFileName = "未命名文档.md";
  if (fileNameEl) fileNameEl.textContent = currentFileName;
  editor.value = defaultMarkdown();
  renderMarkdown();
  setStatus("已新建文档");
}

/**
 * 默认示例内容
 */
function defaultMarkdown() {
  return `# Markdown 编辑器增强版

欢迎使用这个增强版小工具。

## 新增的 5 个实用功能

- 同步滚动
- 深色模式
- 导出 HTML
- 拖拽 / 粘贴图片自动插入
- 文档统计信息

## 代码高亮示例

\`\`\`js
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet("Markdown"));
\`\`\`

## 图片示例

你可以：
1. 直接粘贴一张图片到编辑区
2. 把图片拖进编辑区

它会自动变成 Markdown 图片语法。

## 表格示例

| 功能 | 状态 |
|---|---|
| 编辑 | ✅ |
| 预览 | ✅ |
| 目录 | ✅ |
| 导出 HTML | ✅ |

## 链接示例

https://www.markdownguide.org/

## 使用提示

- Ctrl / Cmd + S：保存 Markdown
- Ctrl / Cmd + E：导出 HTML
- 左侧滚动时，右侧预览会同步滚动`;
}

/**
 * 在光标位置插入文本
 */
function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;

  textarea.value = value.slice(0, start) + text + value.slice(end);
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
  textarea.focus();
}

/**
 * 处理图片文件 -> 转 DataURL -> 插入 Markdown 图片语法
 */
function handleImageFile(file) {
  if (!file || !file.type.startsWith("image/")) return;

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result || "");
    const alt = (file.name || "image").replace(/\.[^.]+$/, "");
    const markdown = `\n![${alt}](${dataUrl})\n`;
    insertAtCursor(editor, markdown);
    renderMarkdown();
    setStatus(`已插入图片：${file.name || "image"}`);
  };
  reader.onerror = () => {
    const error = reader.error;
    let message = "图片读取失败";
    if (error) {
      if (error.name === "NotFoundError") {
        message = "图片文件不存在或已被移动";
      } else if (error.name === "SecurityError") {
        message = "安全限制，无法读取图片";
      } else if (error.name === "NotReadableError") {
        message = "图片文件不可读（可能损坏）";
      }
    }
    setStatus(message);
  };
  reader.readAsDataURL(file);
}

/**
 * 粘贴图片
 */
editor.addEventListener("paste", (e) => {
  const items = e.clipboardData?.items || [];
  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      e.preventDefault();
      const file = item.getAsFile();
      handleImageFile(file);
      return;
    }
  }
});

/**
 * 拖拽图片
 */
editor.addEventListener("dragover", (e) => {
  e.preventDefault();
});

editor.addEventListener("drop", (e) => {
  e.preventDefault();
  const files = e.dataTransfer?.files || [];
  if (!files.length) return;

  const firstImage = Array.from(files).find((file) => file.type.startsWith("image/"));
  if (firstImage) {
    handleImageFile(firstImage);
  }
});

/**
 * 同步滚动：编辑区 -> 预览区
 */
function syncEditorToPreview() {
  if (syncingFrom === "preview") return;
  if (isTocScrolling) return;

  syncingFrom = "editor";
  requestAnimationFrame(() => {
    const editorMax = editor.scrollHeight - editor.clientHeight;
    const previewMax = preview.scrollHeight - preview.clientHeight;

    const ratio = editorMax > 0 ? editor.scrollTop / editorMax : 0;
    preview.scrollTop = ratio * previewMax;

    syncingFrom = null;
  });
}

/**
 * 同步滚动：预览区 -> 编辑区
 */
function syncPreviewToEditor() {
  if (syncingFrom === "editor") return;
  if (isTocScrolling) return;

  syncingFrom = "preview";
  requestAnimationFrame(() => {
    const previewMax = preview.scrollHeight - preview.clientHeight;
    const editorMax = editor.scrollHeight - editor.clientHeight;

    const ratio = previewMax > 0 ? preview.scrollTop / previewMax : 0;
    editor.scrollTop = ratio * editorMax;

    syncingFrom = null;
  });
}

/**
 * 目录点击：事件委托（只绑定一次）
 */
toc.addEventListener("click", (e) => {
  const link = e.target.closest("a.toc-link");
  if (!link) return;

  e.preventDefault();

  const rawTargetId = link.dataset.target || "";
  if (!rawTargetId) return;

  console.log('目录点击调试:');
  console.log('  rawTargetId:', rawTargetId);
  
  // 优先使用 getElementById，避免 CSS 选择器转义问题
  let target = document.getElementById(rawTargetId);
  console.log('  getElementById结果:', target);
  
  // 如果找不到，回退到 querySelector（带转义）
  if (!target) {
    console.log('  getElementById未找到，尝试querySelector');
    target = preview.querySelector(`#${cssEscape(rawTargetId)}`);
    console.log('  querySelector结果:', target);
  }
  
  if (!target) return;

  console.log('  目标元素位置:', target.getBoundingClientRect());
  console.log('  preview滚动位置前:', preview.scrollTop);
  
  // 标记目录点击触发的滚动，防止其他滚动监听器干扰
  isTocScrolling = true;
  
  // 计算目标元素的准确滚动位置
  const targetRect = target.getBoundingClientRect();
  const previewRect = preview.getBoundingClientRect();
  const targetTopRelative = targetRect.top - previewRect.top;
  const scrollMargin = 16; // 与 CSS 中的 scroll-margin-top 一致
  let targetScrollTop = preview.scrollTop + targetTopRelative - scrollMargin;
  
  // 确保滚动位置在有效范围内
  const maxScrollTop = preview.scrollHeight - preview.clientHeight;
  targetScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
  
  console.log('  目标相对位置:', targetTopRelative);
  console.log('  计算滚动位置:', targetScrollTop);
  console.log('  最大滚动位置:', maxScrollTop);
  
  // 使用平滑滚动到计算位置
  preview.scrollTo({
    top: targetScrollTop,
    behavior: "smooth"
  });

  // 延迟记录滚动后位置，并清除滚动标志
  setTimeout(() => {
    console.log('  preview滚动位置后:', preview.scrollTop);
    console.log('  目标元素滚动后位置:', target.getBoundingClientRect());
    isTocScrolling = false;
  }, 800);

  history.replaceState(null, "", `#${encodeURIComponent(rawTargetId)}`);
  highlightActiveToc(rawTargetId);
});

/**
 * 快捷键
 */
document.addEventListener("keydown", (e) => {
  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const mod = isMac ? e.metaKey : e.ctrlKey;

  if (mod && e.key.toLowerCase() === "s") {
    e.preventDefault();
    saveMarkdownFile();
  }

  if (mod && e.key.toLowerCase() === "e") {
    e.preventDefault();
    exportHtmlFile();
  }

  if (mod && e.key.toLowerCase() === "o") {
    e.preventDefault();
    openMarkdownFile();
  }
});

/**
 * 绑定事件
 */
openBtn?.addEventListener("click", openMarkdownFile);
saveBtn?.addEventListener("click", saveMarkdownFile);
exportHtmlBtn?.addEventListener("click", exportHtmlFile);
themeBtn?.addEventListener("click", toggleTheme);
newBtn?.addEventListener("click", newDocument);

// 文件名对话框事件
filenameCancelBtn?.addEventListener("click", handleFilenameCancel);
filenameConfirmBtn?.addEventListener("click", handleFilenameConfirm);
filenameInput?.addEventListener("keydown", (e) => {
  if (e.key === 'Enter') {
    handleFilenameConfirm();
  } else if (e.key === 'Escape') {
    handleFilenameCancel();
  }
});

// 点击对话框外部关闭
filenameDialog?.addEventListener("click", (e) => {
  if (e.target === filenameDialog) {
    handleFilenameCancel();
  }
});

editor.addEventListener("input", debounce(renderMarkdown, 100));
editor.addEventListener("scroll", syncEditorToPreview, { passive: true });
preview.addEventListener("scroll", syncPreviewToEditor, { passive: true });
preview.addEventListener("scroll", debounce(updateActiveTocOnScroll, 50), {
  passive: true
});

/**
 * 初始化
 */
restoreTheme();
restore();
if (fileNameEl) fileNameEl.textContent = currentFileName;
renderMarkdown();
setStatus("已就绪");
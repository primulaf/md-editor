const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const toc = document.getElementById("toc");
const fileInput = document.getElementById("fileInput");
const openBtn = document.getElementById("openBtn");
const saveBtn = document.getElementById("saveBtn");
const saveAsBtn = document.getElementById("saveAsBtn");
const exportHtmlBtn = document.getElementById("exportHtmlBtn");
const fontSizeBtn = document.getElementById("fontSizeBtn");
const newBtn = document.getElementById("newBtn");
const editModeBtn = document.getElementById("editModeBtn");
const skipLink = document.getElementById("skipLink");
const fileNameEl = document.getElementById("fileName");
const previewFileNameEl = document.getElementById("previewFileName");
const statusEl = document.getElementById("status");

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
const sourceAccessDialog = document.getElementById("sourceAccessDialog");
const sourceAccessCancelBtn = document.getElementById("sourceAccessCancelBtn");
const sourceAccessSaveAsBtn = document.getElementById("sourceAccessSaveAsBtn");
const sourceAccessConnectBtn = document.getElementById("sourceAccessConnectBtn");

const IS_MAC = navigator.platform.toUpperCase().includes('MAC');
const STORAGE_KEY = "md-editor-content";
const STORAGE_FILE_NAME_KEY = "md-editor-file-name";
const STORAGE_BASELINE_KEY = "md-editor-last-saved-content";
const STORAGE_SOURCE_KIND_KEY = "md-editor-source-kind";
const STORAGE_FONT_SIZE_KEY = "md-editor-font-size";
const LAYOUT_STORAGE_KEY = "md-editor-layout";

const SOURCE_KIND = Object.freeze({
  NEW: 'new',
  LINKED: 'linked',
  UNLINKED: 'unlinked'
});

const MARKDOWN_FILE_OPTIONS = {
  id: 'markdown-documents',
  types: [{
    description: 'Markdown 文档',
    accept: {
      'text/markdown': ['.md', '.markdown']
    }
  }],
  excludeAcceptAllOption: false
};

let currentFileName = "未命名文档.md";

// 布局状态
const app = document.querySelector('.app');
const sidebarEl = document.querySelector('.sidebar');
const editorPane = document.querySelector('.editor-pane');
const previewPane = document.querySelector('.preview-pane');
const resizeHandle = document.getElementById('resizeHandle');
const sidebarToggle = document.getElementById('sidebarToggle');
const previewSidebarToggle = document.getElementById('previewSidebarToggle');
const closeEditorBtn = document.getElementById('closeEditorBtn');
const closePreviewBtn = document.getElementById('closePreviewBtn');

const layout = {
  sidebarVisible: false,
  editorVisible: false,
  previewVisible: true,
  splitRatio: 0.5
};

let isResizing = false;
let syncingFrom = null;
let lastHighlightError = false;
let isTocScrolling = false;
let lastRenderedSource = null;
let pendingRender = false;
let lastHeadingHash = '';
let isPageVisible = true;
let dirtyWhileHidden = false;
let cachedHeadings = [];
let tocCollapseState = new Map();
let tocParentById = new Map();
let tocItemById = new Map();
let tocLinkById = new Map();
let activeTocId = '';
let resizePending = false;
let lastSavedContent = null;
let isDirty = false;
let isEditing = false;
let sourceKind = SOURCE_KIND.NEW;
let currentFileHandle = null;
let sourceLastModified = null;
let sourceLineEnding = '\n';
let sourceHasBom = false;
let fileSystemAccessDisabled = false;

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
  const operationType = pendingOperationType;
  hideFilenameDialog();
  setStatus(operationType === 'export' ? '已取消 HTML 导出' : '已取消保存');
}

function showSourceAccessDialog() {
  if (!sourceAccessDialog) return;
  sourceAccessDialog.hidden = false;
  requestAnimationFrame(() => {
    sourceAccessDialog.style.display = 'flex';
    sourceAccessConnectBtn?.focus();
  });
}

function hideSourceAccessDialog() {
  if (!sourceAccessDialog) return;
  sourceAccessDialog.hidden = true;
  sourceAccessDialog.style.display = 'none';
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
function setStatus(text, tone = '') {
  if (statusEl) {
    statusEl.textContent = text;
    if (tone) {
      statusEl.dataset.tone = tone;
    } else {
      delete statusEl.dataset.tone;
    }
  }
}

function updateDirtyIndicator() {
  if (isDirty) {
    if (sourceKind === SOURCE_KIND.LINKED) {
      setStatus('未保存 · 可直接保存', 'danger');
    } else if (sourceKind === SOURCE_KIND.NEW) {
      setStatus('未保存 · 首次保存将选择位置', 'danger');
    } else {
      setStatus('未保存 · 保存时需要选择源文件', 'danger');
    }
  } else if (!isEditing) {
    setStatus('阅读模式');
  } else if (sourceKind === SOURCE_KIND.LINKED) {
    setStatus('编辑模式 · 可直接保存', 'success');
  } else if (sourceKind === SOURCE_KIND.NEW) {
    setStatus('编辑模式 · 尚未保存为文件', 'notice');
  } else {
    setStatus('编辑模式 · 保存时需要选择源文件', 'notice');
  }

  if (fileNameEl) fileNameEl.textContent = isDirty ? `${currentFileName} *` : currentFileName;
  if (previewFileNameEl) {
    previewFileNameEl.textContent = isDirty ? `${currentFileName} *` : currentFileName;
  }
  document.title = `${isDirty ? '* ' : ''}${currentFileName || '未命名文档.md'} · md.`;
}

function markDocumentChanged() {
  isDirty = lastSavedContent === null || editor.value !== lastSavedContent;
  updateDirtyIndicator();
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
function renderMarkdown(force) {
  const source = editor.value || "";

  // 内容未变化则跳过（force=true 强制渲染）
  if (!force && source === lastRenderedSource) return;

  // 页面不在前台时标记脏数据，等恢复后再渲染
  if (!isPageVisible && !force) {
    dirtyWhileHidden = true;
    return;
  }

  // 使用 RAF 批处理，避免同一帧内多次渲染
  if (pendingRender && !force) return;
  pendingRender = true;

  requestAnimationFrame(() => {
    pendingRender = false;

    try {
      // RAF 回调中再次检查内容是否已变化
      const currentSource = editor.value || "";
      if (!force && currentSource === lastRenderedSource) return;
      lastRenderedSource = currentSource;

      lastHighlightError = false;
      const rawHtml = md.render(currentSource);

      const safeHtml = DOMPurify.sanitize(rawHtml, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ["target", "rel", "class", "id", "aria-hidden", "aria-label"]
      });

      preview.innerHTML = safeHtml;
      refreshHeadings();
      ensureHeadingIds();

      // 所有外链新窗口打开
      preview.querySelectorAll("a[href]").forEach((a) => {
        const href = a.getAttribute("href") || "";
        if (href.startsWith("http://") || href.startsWith("https://")) {
          a.setAttribute("target", "_blank");
          a.setAttribute("rel", "noopener noreferrer");
        }
      });

      // 仅当标题结构变化时才重建目录
      const headingHash = computeHeadingHash();
      if (headingHash !== lastHeadingHash) {
        lastHeadingHash = headingHash;
        buildToc();
      }

      updateActiveTocOnScroll();
      // 渲染成功后同步修改状态，避免渲染提示覆盖保存状态。
      if (lastSavedContent !== null) {
        markDocumentChanged();
        if (lastHighlightError && !isDirty) {
          setStatus('已渲染 · 部分代码高亮暂不可用', 'notice');
        }
      }
    } catch (err) {
      console.error('渲染异常：', err);
      setStatus('渲染失败，请刷新页面', 'danger');
    }
  });
}

/** 重置 TOC 渲染状态，强制下次渲染重建目录 */
function resetTocState() {
  lastHeadingHash = '';
  cachedHeadings = [];
  lastRenderedSource = null;
  tocCollapseState = new Map();
  tocParentById = new Map();
  tocItemById = new Map();
  tocLinkById = new Map();
  activeTocId = '';
}

/** 计算标题结构的快速哈希，用于判断 TOC 是否需要重建 */
function computeHeadingHash() {
  return JSON.stringify(Array.from(cachedHeadings, (heading) => [
    heading.tagName,
    heading.id,
    getHeadingPlainText(heading)
  ]));
}

/** 每次预览重建后都恢复稳定锚点，确保现有目录链接仍指向新节点 */
function ensureHeadingIds() {
  const usedIds = new Set();

  Array.from(cachedHeadings).forEach((heading, index) => {
    const text = getHeadingPlainText(heading);
    const baseId = (heading.id || '').trim() || slugify(text) || `heading-${index + 1}`;
    let uniqueId = baseId;
    let counter = 2;

    while (usedIds.has(uniqueId)) {
      uniqueId = `${baseId}-${counter}`;
      counter += 1;
    }

    heading.id = uniqueId;
    usedIds.add(uniqueId);
  });
}

/**
 * 生成目录
 */
function buildToc() {
  const headings = Array.from(preview.querySelectorAll("h1, h2, h3, h4, h5, h6"));

  if (!headings.length) {
    toc.innerHTML = `<div class="toc-empty">当前文档还没有标题</div>`;
    tocCollapseState = new Map();
    tocParentById = new Map();
    tocItemById = new Map();
    tocLinkById = new Map();
    activeTocId = '';
    return;
  }

  const roots = [];
  const stack = [];
  const previousCollapseState = tocCollapseState;
  const nextCollapseState = new Map();
  const nextItemById = new Map();
  const nextLinkById = new Map();
  tocParentById = new Map();

  headings.forEach((heading) => {
    const id = heading.id;
    const text = getHeadingPlainText(heading);

    const level = Number(heading.tagName.replace("H", ""));
    const node = { id, text, level, children: [] };

    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
      tocParentById.set(node.id, parent.id);
    } else {
      roots.push(node);
    }
    stack.push(node);
  });

  function renderNodes(nodes) {
    const list = document.createElement('ul');
    list.className = 'toc-list';

    nodes.forEach((node) => {
      const item = document.createElement('li');
      item.className = `toc-item level-${node.level}`;
      item.dataset.nodeId = node.id;
      nextItemById.set(node.id, item);

      const row = document.createElement('div');
      row.className = 'toc-row';

      if (node.children.length) {
        const collapsed = previousCollapseState.has(node.id)
          ? previousCollapseState.get(node.id)
          : node.level >= 2;
        nextCollapseState.set(node.id, collapsed);

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'toc-toggle';
        toggle.dataset.target = node.id;
        toggle.setAttribute('aria-expanded', String(!collapsed));
        toggle.setAttribute('aria-label', `${collapsed ? '展开' : '折叠'} ${node.text}`);
        toggle.title = `${collapsed ? '展开' : '折叠'} ${node.text}`;
        row.appendChild(toggle);

        const children = renderNodes(node.children);
        children.classList.add('toc-children');
        children.hidden = collapsed;
        item.append(row, children);
      } else {
        const spacer = document.createElement('span');
        spacer.className = 'toc-toggle-spacer';
        spacer.setAttribute('aria-hidden', 'true');
        row.appendChild(spacer);
        item.appendChild(row);
      }

      const link = document.createElement('a');
      link.href = `#${encodeURIComponent(node.id)}`;
      link.className = 'toc-link';
      link.dataset.target = node.id;
      link.title = node.text;
      link.textContent = node.text;
      nextLinkById.set(node.id, link);
      row.appendChild(link);
      list.appendChild(item);
    });

    return list;
  }

  const tree = renderNodes(roots);
  tocCollapseState = nextCollapseState;
  tocItemById = nextItemById;
  tocLinkById = nextLinkById;
  activeTocId = '';
  toc.replaceChildren(tree);
}

function setTocNodeCollapsed(nodeId, collapsed) {
  const item = tocItemById.get(nodeId);
  if (!item) return;

  const toggle = item.querySelector(':scope > .toc-row > .toc-toggle');
  const children = item.querySelector(':scope > .toc-children');
  if (!toggle || !children) return;

  tocCollapseState.set(nodeId, collapsed);
  toggle.setAttribute('aria-expanded', String(!collapsed));
  const label = item.querySelector(':scope > .toc-row > .toc-link')?.textContent || '';
  toggle.setAttribute('aria-label', `${collapsed ? '展开' : '折叠'} ${label}`);
  toggle.title = `${collapsed ? '展开' : '折叠'} ${label}`;
  children.hidden = collapsed;
}

function expandTocAncestors(activeId) {
  let parentId = tocParentById.get(activeId);
  while (parentId) {
    setTocNodeCollapsed(parentId, false);
    parentId = tocParentById.get(parentId);
  }
}

function scrollTocLinkIntoView(link) {
  if (!link) return;

  const tocRect = toc.getBoundingClientRect();
  const linkRect = link.getBoundingClientRect();
  const visibleTop = tocRect.top + toc.clientTop;
  const visibleBottom = visibleTop + toc.clientHeight;

  if (linkRect.top < visibleTop) {
    toc.scrollTop -= visibleTop - linkRect.top;
  } else if (linkRect.bottom > visibleBottom) {
    toc.scrollTop += linkRect.bottom - visibleBottom;
  }
}

/**
 * 高亮当前目录项
 */
function highlightActiveToc(activeId) {
  expandTocAncestors(activeId);
  if (activeTocId && activeTocId !== activeId) {
    tocLinkById.get(activeTocId)?.classList.remove('active');
  }

  const activeLink = tocLinkById.get(activeId) || null;
  activeLink?.classList.add('active');
  activeTocId = activeLink ? activeId : '';

  // 自动滚动目录面板，确保激活项可见
  if (activeLink) {
    scrollTocLinkIntoView(activeLink);
  }
}

/**
 * 根据预览区滚动位置更新当前目录高亮
 */
function refreshHeadings() {
  cachedHeadings = preview.querySelectorAll("h1, h2, h3, h4, h5, h6");
}

function updateActiveTocOnScroll() {
  if (isTocScrolling || !cachedHeadings.length) return;

  const previewRect = preview.getBoundingClientRect();
  let current = cachedHeadings[0];

  for (let i = 0; i < cachedHeadings.length; i++) {
    const rect = cachedHeadings[i].getBoundingClientRect();
    if (rect.top - previewRect.top <= 40) {
      current = cachedHeadings[i];
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
  sessionStorage.setItem(STORAGE_KEY, editor.value);
  sessionStorage.setItem(STORAGE_FILE_NAME_KEY, currentFileName);
  sessionStorage.setItem(STORAGE_BASELINE_KEY, lastSavedContent ?? '');
  sessionStorage.setItem(
    STORAGE_SOURCE_KIND_KEY,
    sourceKind === SOURCE_KIND.NEW ? SOURCE_KIND.NEW : SOURCE_KIND.UNLINKED
  );
}

/**
 * 恢复本地内容
 */
function restore() {
  let cachedContent = sessionStorage.getItem(STORAGE_KEY);
  let cachedFileName = sessionStorage.getItem(STORAGE_FILE_NAME_KEY);
  let cachedBaseline = sessionStorage.getItem(STORAGE_BASELINE_KEY);
  const cachedSourceKind = sessionStorage.getItem(STORAGE_SOURCE_KIND_KEY);

  // v1.4.0 及更早版本将文档存在 localStorage；只迁移一次，随后按标签页隔离。
  if (cachedContent === null) {
    cachedContent = localStorage.getItem(STORAGE_KEY);
    cachedFileName = localStorage.getItem(STORAGE_FILE_NAME_KEY);
    cachedBaseline = cachedContent;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_FILE_NAME_KEY);
  }
  const hasCachedDocument = cachedContent !== null;

  currentFileName = cachedFileName || "未命名文档.md";
  if (fileNameEl) {
    fileNameEl.textContent = currentFileName;
  }

  if (cachedContent !== null) {
    editor.value = cachedContent;
  } else {
    editor.value = defaultMarkdown();
  }
  lastSavedContent = cachedBaseline !== null ? cachedBaseline : editor.value;
  sourceKind = cachedSourceKind === SOURCE_KIND.NEW || !hasCachedDocument
    ? SOURCE_KIND.NEW
    : SOURCE_KIND.UNLINKED;
  currentFileHandle = null;
  sourceLastModified = null;
  isDirty = editor.value !== lastSavedContent;
}

/**
 * 保存布局状态
 */
function saveLayout() {
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({
    sidebarVisible: layout.sidebarVisible,
    splitRatio: layout.splitRatio
  }));
}

/**
 * 恢复布局状态
 */
function restoreLayoutState() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY));
    if (saved) {
      layout.sidebarVisible = saved.sidebarVisible ?? false;
      layout.splitRatio = Math.max(0.2, Math.min(0.8, saved.splitRatio ?? 0.5));
    }
  } catch (e) { /* ignore */ }
}

/**
 * 更新布局：根据 layout 状态设置 CSS 变量和类名
 */
function updateLayout() {
  const sidebarW = layout.sidebarVisible ? '280px' : '0px';
  sidebarEl.classList.toggle('collapsed', !layout.sidebarVisible);
  app.classList.toggle('is-editing', isEditing);

  const bothVisible = layout.editorVisible && layout.previewVisible;
  const handleW = bothVisible ? '4px' : '0px';

  let editorW;
  if (!layout.editorVisible) {
    editorW = '0px';
  } else if (layout.previewVisible) {
    editorW = `${layout.splitRatio}fr`;
  } else {
    editorW = '1fr';
  }
  editorPane.classList.toggle('collapsed', !layout.editorVisible);
  editorPane.inert = !layout.editorVisible;
  editorPane.setAttribute('aria-hidden', String(!layout.editorVisible));

  let previewW;
  if (!layout.previewVisible) {
    previewW = '32px';
  } else if (layout.editorVisible) {
    previewW = `${1 - layout.splitRatio}fr`;
  } else {
    previewW = '1fr';
  }
  previewPane.classList.toggle('collapsed', !layout.previewVisible);

  app.style.setProperty('--grid-sidebar', sidebarW);
  app.style.setProperty('--grid-editor', editorW);
  app.style.setProperty('--grid-handle', handleW);
  app.style.setProperty('--grid-preview', previewW);

  saveLayout();
}

/**
 * 切换侧边栏
 */
function toggleSidebar() {
  layout.sidebarVisible = !layout.sidebarVisible;
  updateLayout();
}

/**
 * 关闭 / 恢复面板
 */
function closePane(pane) {
  if (pane === 'editor') {
    setEditingMode(false);
    return;
  } else if (pane === 'preview') {
    layout.previewVisible = false;
    layout.editorVisible = true;
  }
  updateLayout();
}

function restorePane(pane) {
  if (pane === 'editor') {
    setEditingMode(true, { focusEditor: true });
    return;
  } else if (pane === 'preview') {
    layout.previewVisible = true;
  }
  updateLayout();
}

function showPreviewOnly() {
  isEditing = false;
  layout.editorVisible = false;
  layout.previewVisible = true;
  updateLayout();
  if (editModeBtn) {
    editModeBtn.textContent = '编辑文档';
    editModeBtn.setAttribute('aria-pressed', 'false');
  }
  if (skipLink) {
    skipLink.href = '#preview';
    skipLink.textContent = '跳到预览区';
  }
  updateDirtyIndicator();
}

function setEditingMode(enabled, options = {}) {
  isEditing = Boolean(enabled);
  layout.editorVisible = isEditing;
  layout.previewVisible = true;
  updateLayout();

  if (editModeBtn) {
    editModeBtn.textContent = isEditing ? '完成编辑' : '编辑文档';
    editModeBtn.setAttribute('aria-pressed', String(isEditing));
  }
  if (skipLink) {
    skipLink.href = isEditing ? '#editor' : '#preview';
    skipLink.textContent = isEditing ? '跳到编辑区' : '跳到预览区';
  }

  updateDirtyIndicator();
  if (isEditing && options.focusEditor) {
    requestAnimationFrame(() => editor.focus());
  }
}

function toggleEditingMode() {
  setEditingMode(!isEditing, { focusEditor: !isEditing });
}

/**
 * 分栏拖拽
 */
function initResizeHandle() {
  resizeHandle.addEventListener('mousedown', (e) => {
    if (!layout.editorVisible || !layout.previewVisible) return;
    isResizing = true;
    resizeHandle.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(() => {
      resizePending = false;
      const appRect = app.getBoundingClientRect();
      const sidebarW = layout.sidebarVisible ? 280 : 0;
      const handleW = 4;
      const available = appRect.width - sidebarW - handleW;
      if (available <= 0) return;
      let ratio = (e.clientX - appRect.left - sidebarW) / available;
      ratio = Math.max(0.2, Math.min(0.8, ratio));
      layout.splitRatio = ratio;
      updateLayout();
    });
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    resizeHandle.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}

/**
 * 字号控制
 */
const FONT_SIZE_TIERS = ['small', 'medium', 'large', 'xlarge', 'xxlarge'];
const FONT_SIZE_LABELS = {
  small: '字号：小',
  medium: '字号：中',
  large: '字号：大',
  xlarge: '字号：特大',
  xxlarge: '字号：超大'
};

function applyFontSize(tier) {
  const validTier = FONT_SIZE_TIERS.includes(tier) ? tier : 'small';
  document.documentElement.setAttribute('data-font-size', validTier === 'small' ? '' : validTier);
  if (fontSizeBtn) fontSizeBtn.textContent = FONT_SIZE_LABELS[validTier];
  localStorage.setItem(STORAGE_FONT_SIZE_KEY, validTier);
}

function toggleFontSize() {
  const current = document.documentElement.getAttribute('data-font-size') || 'small';
  const idx = FONT_SIZE_TIERS.indexOf(current);
  const next = FONT_SIZE_TIERS[(idx + 1) % FONT_SIZE_TIERS.length];
  applyFontSize(next);
}

function restoreFontSize() {
  const saved = localStorage.getItem(STORAGE_FONT_SIZE_KEY) || 'small';
  applyFontSize(saved);
}

/**
 * 打开 .md 文件
 */
function supportsFilePicker(methodName) {
  return !fileSystemAccessDisabled && typeof window[methodName] === 'function';
}

function confirmDocumentReplacement(action) {
  if (!isDirty) return true;
  return window.confirm(`当前文档有未保存修改。${action}将丢失这些修改，是否继续？`);
}

function isUserCancellation(error) {
  return error && error.name === 'AbortError';
}

function isUnsupportedFileSystemAccess(error) {
  return error?.name === 'SecurityError' || error?.name === 'NotSupportedError';
}

function reportFileError(error, action) {
  if (isUserCancellation(error)) {
    if (isDirty) {
      updateDirtyIndicator();
    } else {
      setStatus(`已取消${action}`);
    }
    return;
  }

  console.error(`${action}失败：`, error);
  if (error?.name === 'NotAllowedError') {
    setStatus(`未获得文件写入权限，${action}未完成`, 'danger');
  } else if (error?.name === 'NotFoundError') {
    setStatus(`文件不存在或已被移动，${action}未完成`, 'danger');
  } else if (error?.name === 'NotReadableError') {
    setStatus(`文件当前不可读，${action}未完成`, 'danger');
  } else {
    setStatus(`${action}失败，请重试`, 'danger');
  }
}

async function readMarkdownFile(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const hasBom = bytes.length >= 3
    && bytes[0] === 0xEF
    && bytes[1] === 0xBB
    && bytes[2] === 0xBF;
  const contentBytes = hasBom ? bytes.subarray(3) : bytes;
  const decoded = new TextDecoder('utf-8').decode(contentBytes);
  const lineEnding = decoded.includes('\r\n') ? '\r\n' : (decoded.includes('\r') ? '\r' : '\n');

  return {
    content: decoded.replace(/\r\n?/g, '\n'),
    lineEnding,
    hasBom
  };
}

function serializeCurrentDocument() {
  const content = sourceLineEnding === '\n'
    ? editor.value
    : editor.value.replace(/\n/g, sourceLineEnding);
  return sourceHasBom ? `\uFEFF${content}` : content;
}

function applyLoadedDocument(file, fileData, handle, nextSourceKind) {
  editor.value = fileData.content;
  currentFileName = file.name || '未命名文档.md';
  currentFileHandle = handle || null;
  sourceKind = nextSourceKind;
  sourceLastModified = Number.isFinite(file.lastModified) ? file.lastModified : null;
  sourceLineEnding = fileData.lineEnding;
  sourceHasBom = fileData.hasBom;
  lastSavedContent = editor.value;
  isDirty = false;
  resetTocState();
  showPreviewOnly();
  renderMarkdown(true);
  updateStats();
  persist();
  updateDirtyIndicator();
}

async function loadSelectedMarkdown(file, handle = null, nextSourceKind = SOURCE_KIND.UNLINKED) {
  try {
    const fileData = await readMarkdownFile(file);
    applyLoadedDocument(file, fileData, handle, nextSourceKind);
  } catch (error) {
    reportFileError(error, '打开文件');
  }
}

async function openMarkdownFile() {
  if (!confirmDocumentReplacement('打开其他文件')) return;

  if (!supportsFilePicker('showOpenFilePicker')) {
    fileInput.click();
    return;
  }

  try {
    const [handle] = await window.showOpenFilePicker(MARKDOWN_FILE_OPTIONS);
    const file = await handle.getFile();
    await loadSelectedMarkdown(file, handle, SOURCE_KIND.LINKED);
  } catch (error) {
    if (isUnsupportedFileSystemAccess(error)) {
      fileSystemAccessDisabled = true;
      setStatus('系统文件访问不可用，已切换兼容打开方式', 'notice');
      fileInput.click();
      return;
    }
    reportFileError(error, '打开文件');
  }
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;
  await loadSelectedMarkdown(file, null, SOURCE_KIND.UNLINKED);
  fileInput.value = '';
});

async function ensureWritePermission(handle) {
  if (!handle || typeof handle.queryPermission !== 'function') return true;

  const options = { mode: 'readwrite' };
  let permission = await handle.queryPermission(options);
  if (permission === 'prompt' && typeof handle.requestPermission === 'function') {
    permission = await handle.requestPermission(options);
  }
  return permission === 'granted';
}

async function hasExternalFileChange(handle) {
  if (!handle || sourceLastModified === null) return false;
  const diskFile = await handle.getFile();
  if (diskFile.lastModified === sourceLastModified) return false;

  const diskData = await readMarkdownFile(diskFile);
  return diskData.content !== lastSavedContent;
}

async function writeCurrentDocumentToHandle(handle, options = {}) {
  const { checkConflict = true } = options;
  let writable = null;

  try {
    if (!(await ensureWritePermission(handle))) {
      setStatus('未获得文件写入权限，文件未保存', 'danger');
      return false;
    }

    if (checkConflict && await hasExternalFileChange(handle)) {
      const overwrite = window.confirm('磁盘上的文件已被其他程序修改。继续保存将覆盖外部修改，是否继续？');
      if (!overwrite) {
        setStatus('已取消保存，磁盘文件未更改', 'notice');
        return false;
      }
    }

    writable = await handle.createWritable();
    await writable.write(serializeCurrentDocument());
    await writable.close();
    writable = null;

    const savedFile = await handle.getFile();
    currentFileHandle = handle;
    currentFileName = handle.name || currentFileName;
    sourceKind = SOURCE_KIND.LINKED;
    sourceLastModified = Number.isFinite(savedFile.lastModified) ? savedFile.lastModified : null;
    lastSavedContent = editor.value;
    isDirty = false;
    persist();
    updateDirtyIndicator();
    setStatus(`已保存到 ${currentFileName}`, 'success');
    return true;
  } catch (error) {
    if (writable && typeof writable.abort === 'function') {
      try {
        await writable.abort();
      } catch (abortError) {
        console.warn('无法中止未完成的写入：', abortError);
      }
    }
    reportFileError(error, '保存');
    return false;
  }
}

function downloadMarkdownCopy(filename) {
  const validatedFilename = validateFilename(filename, '.md');
  const blob = new Blob([serializeCurrentDocument()], {
    type: 'text/markdown;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = validatedFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  currentFileName = validatedFilename;
  currentFileHandle = null;
  sourceKind = SOURCE_KIND.UNLINKED;
  sourceLastModified = null;
  lastSavedContent = editor.value;
  isDirty = false;
  persist();
  updateDirtyIndicator();
  setStatus(`副本已下载：${currentFileName} · 源文件未更改`, 'notice');
}

async function saveMarkdownAs() {
  const suggestedName = validateFilename(currentFileName || '未命名文档.md', '.md');

  if (!supportsFilePicker('showSaveFilePicker')) {
    showFilenameDialog('另存为 Markdown 文件', suggestedName, 'save-as', downloadMarkdownCopy);
    return;
  }

  try {
    const handle = await window.showSaveFilePicker({
      ...MARKDOWN_FILE_OPTIONS,
      suggestedName
    });
    await writeCurrentDocumentToHandle(handle, { checkConflict: false });
  } catch (error) {
    if (isUnsupportedFileSystemAccess(error)) {
      fileSystemAccessDisabled = true;
      showFilenameDialog('另存为 Markdown 文件', suggestedName, 'save-as', downloadMarkdownCopy);
      return;
    }
    reportFileError(error, '另存为');
  }
}

async function connectSourceAndSave() {
  hideSourceAccessDialog();

  if (!supportsFilePicker('showOpenFilePicker')) {
    setStatus('当前环境无法连接源文件，请另存为新文件', 'notice');
    saveMarkdownAs();
    return;
  }

  try {
    const [handle] = await window.showOpenFilePicker(MARKDOWN_FILE_OPTIONS);
    if (handle.name !== currentFileName) {
      const useDifferentFile = window.confirm(
        `所选文件“${handle.name}”与当前文件“${currentFileName}”名称不同。是否仍写入所选文件？`
      );
      if (!useDifferentFile) {
        setStatus('已取消连接源文件');
        return;
      }
    }

    if (!(await ensureWritePermission(handle))) {
      setStatus('未获得源文件写入权限，文件未保存', 'danger');
      return;
    }

    const diskFile = await handle.getFile();
    const diskData = await readMarkdownFile(diskFile);
    if (diskData.content !== lastSavedContent && diskData.content !== editor.value) {
      const overwriteDifferentContent = window.confirm(
        '所选文件的内容与打开时不同。继续保存将覆盖所选文件，是否继续？'
      );
      if (!overwriteDifferentContent) {
        setStatus('已取消保存，所选文件未更改', 'notice');
        return;
      }
    }

    currentFileHandle = handle;
    sourceKind = SOURCE_KIND.LINKED;
    sourceLastModified = diskFile.lastModified;
    sourceLineEnding = diskData.lineEnding;
    sourceHasBom = diskData.hasBom;
    await writeCurrentDocumentToHandle(handle, { checkConflict: false });
  } catch (error) {
    if (isUnsupportedFileSystemAccess(error)) {
      fileSystemAccessDisabled = true;
      setStatus('当前环境无法连接源文件，请另存为新文件', 'notice');
      saveMarkdownAs();
      return;
    }
    reportFileError(error, '连接源文件');
  }
}

function saveMarkdownFile() {
  if (!isDirty && sourceKind !== SOURCE_KIND.NEW) {
    setStatus('当前没有需要保存的修改');
    return;
  }

  if (sourceKind === SOURCE_KIND.LINKED && currentFileHandle) {
    writeCurrentDocumentToHandle(currentFileHandle);
  } else if (sourceKind === SOURCE_KIND.NEW) {
    saveMarkdownAs();
  } else {
    showSourceAccessDialog();
  }
}

/**
 * 生成 HTML 导出模板
 */
function generateHtmlTemplate(title, renderedHtml) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: #ffffff;
      --text: #24292f;
      --muted: #57606a;
      --border: #d0d7de;
      --accent: #0969da;
      --blockquote-bg: #f6f8fa;
      --blockquote-border: #d0d7de;
      --inline-code-bg: rgba(175, 184, 193, 0.2);
      --inline-code-border: transparent;
      --pre-bg: #f6f8fa;
      --table-th-bg: #f6f8fa;
      --table-stripe: #f6f8fa;
    }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
      font-size: 14px;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 32px 20px 64px;
      line-height: 1.8;
    }
    .container h1, .container h2, .container h3,
    .container h4, .container h5, .container h6 {
      margin-top: 1.6em;
      margin-bottom: 0.8em;
      line-height: 1.35;
      font-weight: 600;
    }
    .container h1 {
      font-size: 1.6em;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.4em;
    }
    .container h2 {
      font-size: 1.35em;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.3em;
    }
    .container h3 { font-size: 1.15em; }
    .container pre {
      background: var(--pre-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 16px 20px;
      overflow: auto;
    }
    .container code {
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 0.88em;
    }
    .container :not(pre) > code {
      background: var(--inline-code-bg);
      border: 1px solid var(--inline-code-border);
      border-radius: 6px;
      padding: 0.1em 0.4em;
      color: var(--accent);
    }
    .container blockquote {
      margin: 1em 0;
      padding: 0.8em 1.2em;
      background: var(--blockquote-bg);
      border-left: 3px solid var(--blockquote-border);
      border-radius: 0;
      color: var(--muted);
    }
    .container table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
      display: block;
      overflow-x: auto;
      font-size: 0.95em;
    }
    .container th, .container td {
      border: 1px solid var(--border);
      padding: 8px 14px;
      text-align: left;
    }
    .container th {
      background: var(--table-th-bg);
      font-weight: 600;
      color: var(--muted);
      font-size: 0.9em;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }
    .container tr:nth-child(even) td {
      background: var(--table-stripe);
    }
    .container img {
      max-width: 100%;
      border-radius: 6px;
      border: 1px solid var(--border);
    }
    .container a {
      color: var(--accent);
      text-decoration: none;
      border-bottom: 1px solid transparent;
      transition: border-color 120ms ease;
    }
    .container a:hover {
      border-bottom-color: var(--accent);
    }
    .container hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 2em 0;
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

  const htmlContent = generateHtmlTemplate(title, renderedHtml);
  const downloadedFilename = downloadHtmlFile(htmlContent, validatedFilename);
  
  setStatus(
    isDirty
      ? `已导出 HTML：${downloadedFilename} · Markdown 仍未保存`
      : `已导出 HTML：${downloadedFilename}`,
    isDirty ? 'notice' : 'success'
  );
}

/**
 * 导出 HTML（带文件名提示）
 */
async function exportHtmlFile() {
  const defaultHtmlName = `${(currentFileName || "Markdown导出").replace(/\.md$/i, "")}.html`;

  if (supportsFilePicker('showSaveFilePicker')) {
    let writable = null;
    try {
      const handle = await window.showSaveFilePicker({
        id: 'markdown-html-exports',
        suggestedName: defaultHtmlName,
        types: [{
          description: 'HTML 文档',
          accept: { 'text/html': ['.html'] }
        }]
      });
      const filename = validateFilename(handle.name || defaultHtmlName, '.html');
      const title = filename.replace(/\.html$/i, '');
      const htmlContent = generateHtmlTemplate(title, preview.innerHTML);
      writable = await handle.createWritable();
      await writable.write(htmlContent);
      await writable.close();
      writable = null;
      setStatus(
        isDirty
          ? `已导出 HTML：${filename} · Markdown 仍未保存`
          : `已导出 HTML：${filename}`,
        isDirty ? 'notice' : 'success'
      );
      return;
    } catch (error) {
      if (writable && typeof writable.abort === 'function') {
        try {
          await writable.abort();
        } catch (abortError) {
          console.warn('无法中止 HTML 导出写入：', abortError);
        }
      }
      if (isUnsupportedFileSystemAccess(error)) {
        fileSystemAccessDisabled = true;
        showFilenameDialog('导出 HTML 文件', defaultHtmlName, 'export', _exportHtmlFile);
        return;
      }
      reportFileError(error, '导出 HTML');
      return;
    }
  }

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
  if (!confirmDocumentReplacement('新建文档')) return;

  currentFileName = "未命名文档.md";
  editor.value = defaultMarkdown();
  currentFileHandle = null;
  sourceKind = SOURCE_KIND.NEW;
  sourceLastModified = null;
  sourceLineEnding = '\n';
  sourceHasBom = false;
  lastSavedContent = editor.value;
  isDirty = false;
  resetTocState();
  setEditingMode(true, { focusEditor: true });
  renderMarkdown(true);
  updateStats();
  persist();
  updateDirtyIndicator();
}

/**
 * 默认示例内容
 */
function defaultMarkdown() {
  return `# md. — 离线 Markdown 编辑器

欢迎使用 **md.**，一款精致的离线 Markdown 编辑工具。

## 功能一览

| 功能 | 说明 |
|---|---|
| 编辑 | 实时 Markdown 编辑 |
| 预览 | 同步渲染预览 |
| 目录 | 折叠浏览与自动定位 |
| 导出 | 一键导出 HTML |
| 图片 | 拖拽 / 粘贴自动插入 |
| 主题 | GitHub 风格白底阅读 |

## 代码高亮

\`\`\`js
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet("md."));
\`\`\`

\`\`\`python
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b
\`\`\`

## 图片示例

你可以：
1. **直接粘贴**一张图片到编辑区
2. **拖拽图片**到编辑区

图片会自动转换为 Markdown 语法。

## 链接

https://www.markdownguide.org/

> **提示** — ^S 保存 · ^E 导出 HTML · ^O 打开文件`;
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
    markDocumentChanged();
    renderMarkdown(true);
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
 * 拖拽文件：图片 → 插入 Markdown 语法；.md → 加载内容
 */
editor.addEventListener("dragover", (e) => {
  e.preventDefault();
});

editor.addEventListener("drop", async (e) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer?.files || []);
  if (!files.length) return;

  // 优先处理 .md / .markdown 文件：直接加载内容
  const mdFile = files.find((f) =>
    f.name.endsWith('.md') || f.name.endsWith('.markdown') ||
    f.type === 'text/markdown' || f.type === 'text/x-markdown'
  );
  if (mdFile) {
    if (!confirmDocumentReplacement('打开拖入的文件')) return;
    e.stopPropagation();
    let handle = null;
    const matchingItem = Array.from(e.dataTransfer?.items || []).find((item) => {
      const itemFile = item.kind === 'file' ? item.getAsFile() : null;
      return itemFile && itemFile.name === mdFile.name && itemFile.size === mdFile.size;
    });
    if (matchingItem && typeof matchingItem.getAsFileSystemHandle === 'function') {
      try {
        handle = await matchingItem.getAsFileSystemHandle();
        if (handle?.kind !== 'file') handle = null;
      } catch (error) {
        console.warn('无法取得拖入文件的句柄：', error);
      }
    }
    await loadSelectedMarkdown(
      mdFile,
      handle,
      handle ? SOURCE_KIND.LINKED : SOURCE_KIND.UNLINKED
    );
    return;
  }

  // 其次处理图片
  const firstImage = files.find((f) => f.type.startsWith('image/'));
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
  const toggle = e.target.closest('button.toc-toggle');
  if (toggle) {
    const nodeId = toggle.dataset.target || '';
    if (nodeId) setTocNodeCollapsed(nodeId, toggle.getAttribute('aria-expanded') === 'true');
    return;
  }

  const link = e.target.closest("a.toc-link");
  if (!link) return;

  e.preventDefault();

  const rawTargetId = link.dataset.target || "";
  if (!rawTargetId) return;

  let target = document.getElementById(rawTargetId);
  if (!target) {
    target = preview.querySelector(`#${cssEscape(rawTargetId)}`);
  }
  if (!target) return;

  isTocScrolling = true;

  const targetRect = target.getBoundingClientRect();
  const previewRect = preview.getBoundingClientRect();
  const targetTopRelative = targetRect.top - previewRect.top;
  const scrollMargin = 16;
  let targetScrollTop = preview.scrollTop + targetTopRelative - scrollMargin;

  const maxScrollTop = preview.scrollHeight - preview.clientHeight;
  targetScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));

  preview.scrollTo({
    top: targetScrollTop,
    behavior: "smooth"
  });

  const previewMax = preview.scrollHeight - preview.clientHeight;
  const editorMax = editor.scrollHeight - editor.clientHeight;
  const editorTarget = previewMax > 0 ? (targetScrollTop / previewMax) * editorMax : 0;
  editor.scrollTo({ top: editorTarget, behavior: 'smooth' });

  setTimeout(() => { isTocScrolling = false; }, 800);

  history.replaceState(null, "", `#${encodeURIComponent(rawTargetId)}`);
  highlightActiveToc(rawTargetId);
  // 确保被点击的目录项在面板中可见
  scrollTocLinkIntoView(link);
});

/**
 * 快捷键
 */
document.addEventListener("keydown", (e) => {
  if (e.key === 'Escape' && sourceAccessDialog && !sourceAccessDialog.hidden) {
    e.preventDefault();
    hideSourceAccessDialog();
    updateDirtyIndicator();
    return;
  }

  const mod = IS_MAC ? e.metaKey : e.ctrlKey;

  if (mod && e.shiftKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    saveMarkdownAs();
  } else if (mod && e.key.toLowerCase() === "s") {
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
saveAsBtn?.addEventListener("click", saveMarkdownAs);
exportHtmlBtn?.addEventListener("click", exportHtmlFile);
fontSizeBtn?.addEventListener("click", toggleFontSize);
newBtn?.addEventListener("click", newDocument);
editModeBtn?.addEventListener("click", toggleEditingMode);

// 布局控制事件
sidebarToggle?.addEventListener("click", toggleSidebar);
previewSidebarToggle?.addEventListener("click", toggleSidebar);
closeEditorBtn?.addEventListener("click", () => closePane('editor'));
closePreviewBtn?.addEventListener("click", () => closePane('preview'));

document.querySelectorAll('.pane-restore').forEach(btn => {
  btn.addEventListener('click', () => {
    const pane = btn.dataset.restore;
    if (pane) restorePane(pane);
  });
});

initResizeHandle();

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

sourceAccessCancelBtn?.addEventListener('click', () => {
  hideSourceAccessDialog();
  updateDirtyIndicator();
});
sourceAccessSaveAsBtn?.addEventListener('click', () => {
  hideSourceAccessDialog();
  saveMarkdownAs();
});
sourceAccessConnectBtn?.addEventListener('click', connectSourceAndSave);
sourceAccessDialog?.addEventListener('click', (e) => {
  if (e.target === sourceAccessDialog) {
    hideSourceAccessDialog();
    updateDirtyIndicator();
  }
});

const renderAfterInput = debounce(renderMarkdown, 200);
editor.addEventListener("input", () => {
  markDocumentChanged();
  renderAfterInput();
});
editor.addEventListener("scroll", syncEditorToPreview, { passive: true });

// 合并的预览滚动处理：同步滚动 + 目录高亮
let tocHighlightTimer = null;
preview.addEventListener("scroll", () => {
  syncPreviewToEditor();
  if (!tocHighlightTimer) {
    tocHighlightTimer = setTimeout(() => {
      tocHighlightTimer = null;
      updateActiveTocOnScroll();
    }, 60);
  }
}, { passive: true });

// 页面不可见时停止渲染，恢复时重新渲染
document.addEventListener("visibilitychange", () => {
  isPageVisible = !document.hidden;
  if (isPageVisible && dirtyWhileHidden) {
    dirtyWhileHidden = false;
    renderMarkdown(true);
  }
});

// 低频周期：持久化 + 统计（避免每 200ms 渲染时都执行）
const persistInterval = setInterval(() => {
  if (isPageVisible) {
    persist();
    updateStats();
  }
}, 2000);

// 页面关闭前：清理定时器 + 未保存更改提醒 + 持久化
window.addEventListener('beforeunload', (e) => {
  clearInterval(persistInterval);
  if (tocHighlightTimer) {
    clearTimeout(tocHighlightTimer);
    tocHighlightTimer = null;
  }
  persist();
  if (isDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/**
 * 初始化
 */
restoreFontSize();
restore();
restoreLayoutState();
showPreviewOnly();
renderMarkdown(true);
updateStats();

// 文件关联启动：通过 URL 参数 ?file=<nonce> 识别来自 content script 的加载
// 避免 chrome.storage.local 残留污染正常打开的标签页
function loadFileContent(content, filename) {
  const normalizedContent = String(content || '').replace(/\r\n?/g, '\n');
  editor.value = normalizedContent;
  currentFileName = filename || '未命名文档.md';
  currentFileHandle = null;
  sourceKind = SOURCE_KIND.UNLINKED;
  sourceLastModified = null;
  sourceLineEnding = String(content || '').includes('\r\n') ? '\r\n' : '\n';
  sourceHasBom = false;
  lastSavedContent = normalizedContent;
  isDirty = false;
  resetTocState();
  showPreviewOnly();
  renderMarkdown(true);
  updateStats();
  persist();
  updateDirtyIndicator();
}

(function checkFileLaunch() {
  const params = new URLSearchParams(window.location.search);
  const nonce = params.get('file');
  if (!nonce) return;

  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

  const contentKey = 'file:' + nonce;
  const nameKey = 'name:' + nonce;
  chrome.storage.local.get([contentKey, nameKey], (data) => {
    const content = data[contentKey];
    if (typeof content === 'string') {
      loadFileContent(content, data[nameKey] || 'untitled.md');
      chrome.storage.local.remove([contentKey, nameKey]);
    }
  });
})();

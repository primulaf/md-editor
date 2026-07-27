const MAX_DIAGRAMS = 50;
const MAX_SOURCE_CHARS = 50000;
const CACHE_ENTRY_LIMIT = 24;
const CACHE_BYTE_LIMIT = 4 * 1024 * 1024;
const RENDER_TIMEOUT = 12000;
const MERMAID_MODULE_URL = './lib/mermaid/mermaid.esm.min.mjs';
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif';

const svgCache = new Map();
let cachedBytes = 0;
let mermaidModulePromise = null;
let mermaidQueue = Promise.resolve();
let initializedConfigSignature = '';
let renderId = 0;

function isCurrent(root, revision) {
  return root.isConnected && root.dataset.mermaidRevision === revision;
}

function wait(delay) {
  if (!delay) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function withTimeout(promise, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`图表渲染超过 ${timeout / 1000} 秒`));
    }, timeout);

    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function hashSource(source) {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function getCacheKey(source, index, fontSize) {
  return `${index}:${fontSize}:${source.length}:${hashSource(source)}`;
}

function readCache(key, source) {
  const cached = svgCache.get(key);
  if (!cached || cached.source !== source) return null;
  svgCache.delete(key);
  svgCache.set(key, cached);
  return cached.svg;
}

function deleteCache(key) {
  const cached = svgCache.get(key);
  if (!cached) return;
  cachedBytes -= cached.bytes;
  svgCache.delete(key);
}

function writeCache(key, source, svg) {
  const previous = svgCache.get(key);
  if (previous) {
    deleteCache(key);
  }

  const entry = { source, svg, bytes: source.length + svg.length };
  svgCache.set(key, entry);
  cachedBytes += entry.bytes;

  while (svgCache.size > CACHE_ENTRY_LIMIT || cachedBytes > CACHE_BYTE_LIMIT) {
    const oldestKey = svgCache.keys().next().value;
    if (oldestKey === undefined) break;
    const oldest = svgCache.get(oldestKey);
    deleteCache(oldestKey);
  }
}

function getSource(block) {
  return block.querySelector('.mermaid-source code')?.textContent || '';
}

function setLoading(block) {
  block.classList.remove('is-rendered', 'has-error', 'is-wide');
  const canvas = block.querySelector('.mermaid-canvas');
  const source = block.querySelector('.mermaid-source');
  if (!canvas) return;

  canvas.replaceChildren();
  canvas.setAttribute('aria-busy', 'true');

  const message = document.createElement('span');
  message.className = 'mermaid-loading';
  message.textContent = '正在渲染图表...';
  canvas.appendChild(message);
  if (source) source.hidden = true;
}

function getFriendlyError(error) {
  const message = String(error?.message || error || '').trim();
  if (/图表渲染超过/.test(message)) {
    return '图表渲染超时，已显示 Mermaid 源码。';
  }
  if (/unknown diagram|no diagram type detected|diagram .* not found/i.test(message)) {
    return '无法识别图表类型，已显示 Mermaid 源码。';
  }
  if (/maximum text size|maxtextsize|too many edges|maxedges/i.test(message)) {
    return '图表内容超出安全限制，已显示 Mermaid 源码。';
  }
  return '图表语法有误，已显示 Mermaid 源码。';
}

function hasBlockedResourceReference(source) {
  const hasImageProperty = /@\{[\s\S]{0,4000}?\b(?:img|src)\s*:/i.test(source);
  const hasRemoteCss = /@import\s+(?:url\()?[\s"'']*(?:https?:)?\/\//i.test(source)
    || /url\(\s*['"]?(?:https?:)?\/\//i.test(source);
  return hasImageProperty || hasRemoteCss;
}

function showError(block, message, detail = '') {
  block.classList.remove('is-rendered', 'is-wide');
  block.classList.add('has-error');

  const canvas = block.querySelector('.mermaid-canvas');
  const source = block.querySelector('.mermaid-source');
  if (canvas) {
    canvas.replaceChildren();
    canvas.removeAttribute('aria-busy');

    const error = document.createElement('div');
    error.className = 'mermaid-error';
    error.setAttribute('role', 'alert');
    if (detail) error.title = detail;

    const title = document.createElement('strong');
    title.textContent = 'Mermaid 图表无法渲染';
    const description = document.createElement('span');
    description.textContent = message;
    error.append(title, description);
    canvas.appendChild(error);
  }
  if (source) source.hidden = false;
}

function sanitizeSvg(svg) {
  if (!globalThis.DOMPurify) {
    throw new Error('DOMPurify 未加载');
  }

  const sanitized = globalThis.DOMPurify.sanitize(svg, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    ADD_ATTR: [
      'aria-describedby',
      'aria-labelledby',
      'aria-roledescription',
      'dominant-baseline',
      'marker-end',
      'marker-mid',
      'marker-start',
      'preserveAspectRatio',
      'role',
      'viewBox',
      'xmlns'
    ]
  });

  const parsed = new DOMParser().parseFromString(sanitized, 'image/svg+xml');
  if (parsed.querySelector('parsererror') || parsed.documentElement.tagName.toLowerCase() !== 'svg') {
    throw new Error('Mermaid 返回的 SVG 无法解析');
  }

  parsed.querySelectorAll('[href], [src], [xlink\\:href]').forEach((element) => {
    ['href', 'src', 'xlink:href'].forEach((attribute) => {
      const value = element.getAttribute(attribute);
      if (value && !value.trim().startsWith('#')) {
        element.removeAttribute(attribute);
      }
    });
  });

  parsed.querySelectorAll('style').forEach((style) => {
    style.textContent = style.textContent
      .replace(/@import\s+[^;]+;?/gi, '')
      .replace(/url\(\s*(['"]?)(?:https?:|data:|javascript:|\/\/)[^)]*\)/gi, 'none');
  });
  parsed.querySelectorAll('[style]').forEach((element) => {
    const value = element.getAttribute('style') || '';
    element.setAttribute(
      'style',
      value.replace(/url\(\s*(['"]?)(?:https?:|data:|javascript:|\/\/)[^)]*\)/gi, 'none')
    );
  });

  return new XMLSerializer().serializeToString(parsed.documentElement);
}

function applySvg(block, svg) {
  const canvas = block.querySelector('.mermaid-canvas');
  const source = block.querySelector('.mermaid-source');
  if (!canvas) return;

  canvas.innerHTML = svg;
  canvas.removeAttribute('aria-busy');

  const svgElement = canvas.querySelector('svg');
  if (!svgElement) {
    throw new Error('Mermaid 未返回有效 SVG');
  }

  svgElement.classList.add('mermaid-svg');
  svgElement.removeAttribute('height');

  const viewBox = svgElement.viewBox?.baseVal;
  const aspectRatio = viewBox?.height ? viewBox.width / viewBox.height : 0;
  block.classList.toggle('is-wide', aspectRatio > 2.4);
  block.classList.remove('has-error');
  block.classList.add('is-rendered');
  if (source) source.hidden = true;
}

function getMermaidConfig(fontSize) {
  const diagramFontSize = `${Math.max(12, Math.round(fontSize))}px`;
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    logLevel: 'fatal',
    maxTextSize: MAX_SOURCE_CHARS,
    maxEdges: 500,
    secure: [
      'secure',
      'securityLevel',
      'startOnLoad',
      'maxTextSize',
      'suppressErrorRendering',
      'maxEdges',
      'theme',
      'themeCSS',
      'themeVariables',
      'fontFamily',
      'altFontFamily',
      'htmlLabels',
      'dompurifyConfig'
    ],
    theme: 'base',
    htmlLabels: false,
    fontFamily: FONT_FAMILY,
    themeVariables: {
      background: '#ffffff',
      primaryColor: '#f6f8fa',
      primaryTextColor: '#24292f',
      primaryBorderColor: '#8c959f',
      secondaryColor: '#ddf4ff',
      secondaryTextColor: '#24292f',
      secondaryBorderColor: '#54aeff',
      tertiaryColor: '#fff8c5',
      tertiaryTextColor: '#24292f',
      tertiaryBorderColor: '#d4a72c',
      lineColor: '#57606a',
      textColor: '#24292f',
      titleColor: '#24292f',
      edgeLabelBackground: '#ffffff',
      clusterBkg: '#f6f8fa',
      clusterBorder: '#d0d7de',
      fontFamily: FONT_FAMILY,
      fontSize: diagramFontSize
    },
    flowchart: {
      htmlLabels: false,
      useMaxWidth: true
    },
    sequence: {
      useMaxWidth: true
    },
    gantt: {
      useMaxWidth: true
    }
  };
}

async function getMermaid(fontSize) {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import(MERMAID_MODULE_URL)
      .then((module) => module.default || module)
      .catch((error) => {
        mermaidModulePromise = null;
        throw error;
      });
  }

  const mermaid = await mermaidModulePromise;
  const signature = String(fontSize);
  if (initializedConfigSignature !== signature) {
    mermaid.initialize(getMermaidConfig(fontSize));
    initializedConfigSignature = signature;
  }
  return mermaid;
}

async function renderPending(root, revision, pending, fontSize) {
  if (!isCurrent(root, revision)) return { stale: true };

  let mermaid;
  try {
    mermaid = await getMermaid(fontSize);
  } catch (error) {
    pending.forEach(({ block }) => {
      if (block.isConnected) {
        showError(block, 'Mermaid 运行库加载失败，已显示源码。', String(error));
      }
    });
    return { total: pending.length, rendered: 0, failed: pending.length };
  }

  let rendered = 0;
  let failed = 0;

  for (const item of pending) {
    if (!isCurrent(root, revision)) return { stale: true, rendered, failed };
    if (!item.block.isConnected) continue;

    const id = `mermaid-${Date.now().toString(36)}-${renderId += 1}`;
    try {
      const result = await withTimeout(mermaid.render(id, item.source), RENDER_TIMEOUT);
      if (!isCurrent(root, revision) || !item.block.isConnected) {
        return { stale: true, rendered, failed };
      }

      const safeSvg = sanitizeSvg(result.svg);
      writeCache(item.cacheKey, item.source, safeSvg);
      applySvg(item.block, safeSvg);
      rendered += 1;
    } catch (error) {
      console.warn('Mermaid 图表渲染失败：', error);
      showError(item.block, getFriendlyError(error), String(error?.message || error));
      failed += 1;
    }
  }

  return { total: pending.length, rendered, failed };
}

export async function renderMermaidBlocks(root, options = {}) {
  const revision = String(options.revision || '');
  const fontSize = Number(options.fontSize) || 14;
  const delay = Math.max(0, Number(options.delay) || 0);
  const blocks = Array.from(root.querySelectorAll('.mermaid-block'));

  if (!blocks.length || !isCurrent(root, revision)) {
    return { total: 0, rendered: 0, failed: 0 };
  }

  let renderedFromCache = 0;
  let failed = 0;
  const pending = [];

  blocks.forEach((block, index) => {
    const source = getSource(block);
    if (index >= MAX_DIAGRAMS) {
      showError(block, `单篇文档最多渲染 ${MAX_DIAGRAMS} 个图表。`);
      failed += 1;
      return;
    }
    if (!source.trim()) {
      showError(block, '图表内容为空，已显示 Mermaid 源码。');
      failed += 1;
      return;
    }
    if (source.length > MAX_SOURCE_CHARS) {
      showError(block, `单个图表不能超过 ${MAX_SOURCE_CHARS} 个字符。`);
      failed += 1;
      return;
    }
    if (hasBlockedResourceReference(source)) {
      showError(block, '离线模式不加载外部图片或样式，已显示 Mermaid 源码。');
      failed += 1;
      return;
    }

    const cacheKey = getCacheKey(source, index, fontSize);
    const cachedSvg = readCache(cacheKey, source);
    if (cachedSvg) {
      try {
        applySvg(block, cachedSvg);
        renderedFromCache += 1;
      } catch {
        deleteCache(cacheKey);
        setLoading(block);
        pending.push({ block, source, cacheKey });
      }
      return;
    }

    setLoading(block);
    pending.push({ block, source, cacheKey });
  });

  if (!pending.length) {
    return {
      total: blocks.length,
      rendered: renderedFromCache,
      failed
    };
  }

  await wait(delay);
  if (!isCurrent(root, revision)) {
    return { stale: true, rendered: renderedFromCache, failed };
  }

  const task = () => renderPending(root, revision, pending, fontSize);
  mermaidQueue = mermaidQueue.catch(() => undefined).then(task);
  const result = await mermaidQueue;

  return {
    ...result,
    total: blocks.length,
    rendered: renderedFromCache + (result.rendered || 0),
    failed: failed + (result.failed || 0)
  };
}

export function clearMermaidCache() {
  svgCache.clear();
  cachedBytes = 0;
}

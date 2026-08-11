(function initMathRendering(globalScope, factory) {
  const api = factory(globalScope);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (globalScope) {
    globalScope.mdMathRendering = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function createMathRenderingApi(globalScope) {
  "use strict";

  const KATEX_CSS_PATH = "lib/katex/katex.min.css";
  const KATEX_FONT_FILES = Object.freeze([
    "KaTeX_AMS-Regular.woff2",
    "KaTeX_Caligraphic-Bold.woff2",
    "KaTeX_Caligraphic-Regular.woff2",
    "KaTeX_Fraktur-Bold.woff2",
    "KaTeX_Fraktur-Regular.woff2",
    "KaTeX_Main-Bold.woff2",
    "KaTeX_Main-BoldItalic.woff2",
    "KaTeX_Main-Italic.woff2",
    "KaTeX_Main-Regular.woff2",
    "KaTeX_Math-BoldItalic.woff2",
    "KaTeX_Math-Italic.woff2",
    "KaTeX_SansSerif-Bold.woff2",
    "KaTeX_SansSerif-Italic.woff2",
    "KaTeX_SansSerif-Regular.woff2",
    "KaTeX_Script-Regular.woff2",
    "KaTeX_Size1-Regular.woff2",
    "KaTeX_Size2-Regular.woff2",
    "KaTeX_Size3-Regular.woff2",
    "KaTeX_Size4-Regular.woff2",
    "KaTeX_Typewriter-Regular.woff2"
  ]);

  const MATH_LAYOUT_CSS = `
.container eq { display: inline-block; }
.container eqn { display: block; max-width: 100%; overflow-x: auto; overflow-y: hidden; }
.container section:has(> eqn) { margin: 1.2em 0; max-width: 100%; }
.container section.eqno { display: flex; align-items: center; }
.container section.eqno > eqn { flex: 1; min-width: 0; margin-left: 3em; }
.container section.eqno > span { width: 3em; text-align: right; }
.container .katex-display { margin: 0; overflow: visible; }
`;

  let exportStylesPromise = null;

  function createTexmathOptions(katexEngine) {
    return {
      engine: katexEngine,
      delimiters: ["dollars"],
      outerSpace: false,
      katexOptions: {
        output: "htmlAndMathml",
        throwOnError: false,
        trust: false,
        strict: "warn",
        maxExpand: 1000,
        maxSize: 20,
        errorColor: "#cf222e"
      }
    };
  }

  function hasRenderedMath(root) {
    return Boolean(root?.querySelector?.(".katex"));
  }

  function resourceUrl(path) {
    if (globalScope?.chrome?.runtime?.getURL) {
      return globalScope.chrome.runtime.getURL(path);
    }
    return new URL(path, globalScope?.location?.href || "http://localhost/").href;
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }

  function rewriteKatexFontUrls(cssText, fontDataUrls) {
    return String(cssText || "").replace(
      /url\((["']?)fonts\/([^)'"\s]+)\1\)/g,
      (match, quote, filename) => {
        const dataUrl = fontDataUrls[filename];
        return dataUrl ? `url("${dataUrl}")` : match;
      }
    );
  }

  async function fetchResource(path, fetchImpl) {
    const response = await fetchImpl(resourceUrl(path));
    if (!response.ok) {
      throw new Error(`无法读取公式资源：${path} (${response.status})`);
    }
    return response;
  }

  async function loadExportStyles(fetchImpl = globalScope?.fetch?.bind(globalScope)) {
    if (!fetchImpl) throw new Error("当前环境无法读取 KaTeX 导出资源");
    const cssResponse = await fetchResource(KATEX_CSS_PATH, fetchImpl);
    const cssText = await cssResponse.text();

    const fontEntries = await Promise.all(KATEX_FONT_FILES.map(async (filename) => {
      const response = await fetchResource(`lib/katex/fonts/${filename}`, fetchImpl);
      const base64 = arrayBufferToBase64(await response.arrayBuffer());
      return [filename, `data:font/woff2;base64,${base64}`];
    }));

    return `${rewriteKatexFontUrls(cssText, Object.fromEntries(fontEntries))}\n${MATH_LAYOUT_CSS}`;
  }

  async function getExportStyles(root, fetchImpl) {
    if (!hasRenderedMath(root)) return "";
    if (!exportStylesPromise) {
      exportStylesPromise = loadExportStyles(fetchImpl).catch((error) => {
        exportStylesPromise = null;
        throw error;
      });
    }
    return exportStylesPromise;
  }

  return {
    KATEX_FONT_FILES,
    createTexmathOptions,
    getExportStyles,
    hasRenderedMath,
    rewriteKatexFontUrls
  };
});

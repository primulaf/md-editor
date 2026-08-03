(function initMermaidTools(globalScope, factory) {
  const api = factory(globalScope);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (globalScope) {
    globalScope.mdMermaidTools = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function createMermaidToolsApi(globalScope) {
  "use strict";

  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 3;
  const ZOOM_STEP = 0.25;
  const PNG_SCALE = 2;
  const PNG_MAX_EDGE = 8192;
  const PNG_MAX_PIXELS = 32_000_000;

  function clampZoom(value) {
    const rounded = Math.round(Number(value) / ZOOM_STEP) * ZOOM_STEP;
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, rounded || 1));
  }

  function calculatePngSize(width, height, requestedScale = PNG_SCALE) {
    const sourceWidth = Number(width);
    const sourceHeight = Number(height);
    if (!(sourceWidth > 0) || !(sourceHeight > 0)) {
      throw new TypeError("SVG dimensions must be positive");
    }

    const scale = Math.min(
      Math.max(Number(requestedScale) || 1, 0.01),
      PNG_MAX_EDGE / sourceWidth,
      PNG_MAX_EDGE / sourceHeight,
      Math.sqrt(PNG_MAX_PIXELS / (sourceWidth * sourceHeight))
    );
    if (!(scale > 0)) throw new RangeError("PNG dimensions exceed the export limit");

    return {
      width: Math.max(1, Math.floor(sourceWidth * scale)),
      height: Math.max(1, Math.floor(sourceHeight * scale)),
      scale
    };
  }

  function createDiagramFilename(documentName, index, extension) {
    const baseName = String(documentName || "Markdown")
      .replace(/\.(?:md|markdown)$/i, "")
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .trim() || "Markdown";
    const diagramIndex = Math.max(1, Math.floor(Number(index) || 1));
    const safeExtension = extension === "png" ? "png" : "svg";
    return `${baseName}-diagram-${diagramIndex}.${safeExtension}`;
  }

  function getSvgDimensions(svg) {
    const viewBox = svg?.viewBox?.baseVal;
    if (viewBox?.width > 0 && viewBox?.height > 0) {
      return { width: viewBox.width, height: viewBox.height };
    }

    const width = parseFloat(svg?.getAttribute("width"));
    const height = parseFloat(svg?.getAttribute("height"));
    if (width > 0 && height > 0) return { width, height };

    const rect = svg?.getBoundingClientRect?.();
    if (rect?.width > 0 && rect?.height > 0) {
      return { width: rect.width, height: rect.height };
    }
    throw new Error("无法确定图表尺寸");
  }

  function serializeSvg(svg) {
    const clone = svg.cloneNode(true);
    const dimensions = getSvgDimensions(svg);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(Math.ceil(dimensions.width)));
    clone.setAttribute("height", String(Math.ceil(dimensions.height)));
    clone.classList.remove("mermaid-svg");
    clone.removeAttribute("data-base-width");
    clone.removeAttribute("data-zoom");
    clone.style.removeProperty("width");
    clone.style.removeProperty("min-width");
    clone.style.removeProperty("max-width");
    clone.style.removeProperty("--mermaid-width");
    return {
      dimensions,
      source: new XMLSerializer().serializeToString(clone)
    };
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function downloadSvg(svg, filename) {
    const { source } = serializeSvg(svg);
    downloadBlob(new Blob([source], { type: "image/svg+xml;charset=utf-8" }), filename);
  }

  async function loadSvgImage(source) {
    const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("SVG 无法栅格化"));
        image.src = url;
      });
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function downloadPng(svg, filename) {
    const { source, dimensions } = serializeSvg(svg);
    const output = calculatePngSize(dimensions.width, dimensions.height);
    const image = await loadSvgImage(source);
    const canvas = document.createElement("canvas");
    canvas.width = output.width;
    canvas.height = output.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器无法创建 PNG 画布");
    context.drawImage(image, 0, 0, output.width, output.height);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error("PNG 生成失败")),
        "image/png"
      );
    });
    downloadBlob(blob, filename);
  }

  function updateZoomControls(block, scale) {
    const toolbar = block.querySelector(".mermaid-toolbar");
    if (!toolbar) return;
    const zoomOut = toolbar.querySelector('[data-mermaid-action="zoom-out"]');
    const zoomIn = toolbar.querySelector('[data-mermaid-action="zoom-in"]');
    const reset = toolbar.querySelector('[data-mermaid-action="reset"]');
    if (zoomOut) zoomOut.disabled = scale <= MIN_ZOOM;
    if (zoomIn) zoomIn.disabled = scale >= MAX_ZOOM;
    if (reset) reset.textContent = `${Math.round(scale * 100)}%`;
  }

  function resetZoom(block) {
    const svg = block.querySelector(".mermaid-svg");
    if (!svg) return;
    svg.style.removeProperty("width");
    svg.style.removeProperty("min-width");
    svg.style.removeProperty("max-width");
    svg.removeAttribute("data-base-width");
    svg.dataset.zoom = "1";
    updateZoomControls(block, 1);
  }

  function applyZoom(block, nextScale) {
    const svg = block.querySelector(".mermaid-svg");
    if (!svg) return;
    const scale = clampZoom(nextScale);
    if (scale === 1) {
      resetZoom(block);
      return;
    }

    let baseWidth = Number(svg.dataset.baseWidth);
    if (!(baseWidth > 0)) {
      baseWidth = svg.getBoundingClientRect().width;
      if (!(baseWidth > 0)) baseWidth = getSvgDimensions(svg).width;
      svg.dataset.baseWidth = String(baseWidth);
    }
    svg.style.width = `${Math.round(baseWidth * scale * 100) / 100}px`;
    svg.style.minWidth = "0";
    svg.style.maxWidth = "none";
    svg.dataset.zoom = String(scale);
    updateZoomControls(block, scale);
  }

  function makeButton(action, label, title) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.mermaidAction = action;
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    return button;
  }

  function createToolbar(block, index, options) {
    const toolbar = document.createElement("div");
    toolbar.className = "mermaid-toolbar";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", `图表 ${index} 操作`);
    toolbar.append(
      makeButton("zoom-out", "−", "缩小图表"),
      makeButton("reset", "100%", "恢复原始大小"),
      makeButton("zoom-in", "+", "放大图表"),
      makeButton("download-svg", "SVG", "下载 SVG"),
      makeButton("download-png", "PNG", "下载 PNG")
    );

    toolbar.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-mermaid-action]");
      const svg = block.querySelector(".mermaid-svg");
      if (!button || !svg) return;
      const action = button.dataset.mermaidAction;
      const currentScale = Number(svg.dataset.zoom) || 1;

      try {
        if (action === "zoom-out") applyZoom(block, currentScale - ZOOM_STEP);
        if (action === "zoom-in") applyZoom(block, currentScale + ZOOM_STEP);
        if (action === "reset") resetZoom(block);
        if (action === "download-svg") {
          downloadSvg(svg, createDiagramFilename(options.getFileName?.(), index, "svg"));
          options.onStatus?.(`已下载第 ${index} 个图表的 SVG`, "success");
        }
        if (action === "download-png") {
          button.disabled = true;
          await downloadPng(svg, createDiagramFilename(options.getFileName?.(), index, "png"));
          options.onStatus?.(`已下载第 ${index} 个图表的 PNG`, "success");
        }
      } catch (error) {
        console.error("图表操作失败：", error);
        options.onStatus?.(
          action === "download-png"
            ? "PNG 生成失败，可改为下载 SVG"
            : "图表下载失败，请重试",
          "danger"
        );
      } finally {
        if (action === "download-png") button.disabled = false;
      }
    });
    return toolbar;
  }

  function enhanceMermaidBlocks(root, options = {}) {
    const allBlocks = Array.from(root.querySelectorAll(".mermaid-block"));
    allBlocks.filter((block) => block.classList.contains("is-rendered")).forEach((block) => {
      const index = allBlocks.indexOf(block) + 1;
      block.querySelector(".mermaid-toolbar")?.remove();
      const toolbar = createToolbar(block, index, options);
      block.insertBefore(toolbar, block.querySelector(".mermaid-canvas"));
      resetZoom(block);
    });
  }

  function cleanExportClone(root) {
    root.querySelectorAll(".mermaid-toolbar").forEach((toolbar) => toolbar.remove());
    root.querySelectorAll(".mermaid-svg").forEach((svg) => {
      svg.removeAttribute("data-base-width");
      svg.removeAttribute("data-zoom");
      svg.style.removeProperty("width");
      svg.style.removeProperty("min-width");
      svg.style.removeProperty("max-width");
    });
  }

  return {
    MAX_ZOOM,
    MIN_ZOOM,
    applyZoom,
    calculatePngSize,
    cleanExportClone,
    createDiagramFilename,
    enhanceMermaidBlocks,
    resetZoom,
    serializeSvg
  };
});

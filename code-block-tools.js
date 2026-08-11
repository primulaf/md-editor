(function initCodeBlockTools(globalScope, factory) {
  const api = factory(globalScope);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (globalScope) {
    globalScope.mdCodeBlockTools = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function createCodeBlockToolsApi(globalScope) {
  "use strict";

  const LANGUAGE_ALIASES = Object.freeze({
    bash: "shell",
    csharp: "csharp",
    cs: "csharp",
    html: "html",
    js: "javascript",
    jsonc: "jsonc",
    jsx: "jsx",
    md: "markdown",
    plaintext: "text",
    ps1: "powershell",
    py: "python",
    rb: "ruby",
    rs: "rust",
    sh: "shell",
    shell: "shell",
    text: "text",
    ts: "typescript",
    tsx: "tsx",
    txt: "text",
    yml: "yaml"
  });

  const LANGUAGE_DETAILS = Object.freeze({
    c: { extension: "c", mime: "text/x-c", label: "C" },
    cpp: { extension: "cpp", mime: "text/x-c++src", label: "C++" },
    csharp: { extension: "cs", mime: "text/plain", label: "C#" },
    css: { extension: "css", mime: "text/css", label: "CSS" },
    go: { extension: "go", mime: "text/x-go", label: "Go" },
    html: { extension: "html", mime: "text/html", label: "HTML" },
    java: { extension: "java", mime: "text/x-java-source", label: "Java" },
    javascript: { extension: "js", mime: "text/javascript", label: "JavaScript" },
    json: { extension: "json", mime: "application/json", label: "JSON" },
    jsonc: { extension: "jsonc", mime: "application/json", label: "JSONC" },
    jsx: { extension: "jsx", mime: "text/javascript", label: "JSX" },
    kotlin: { extension: "kt", mime: "text/plain", label: "Kotlin" },
    markdown: { extension: "md", mime: "text/markdown", label: "Markdown" },
    php: { extension: "php", mime: "text/x-php", label: "PHP" },
    powershell: { extension: "ps1", mime: "text/plain", label: "PowerShell" },
    python: { extension: "py", mime: "text/x-python", label: "Python" },
    ruby: { extension: "rb", mime: "text/x-ruby", label: "Ruby" },
    rust: { extension: "rs", mime: "text/x-rust", label: "Rust" },
    shell: { extension: "sh", mime: "text/x-shellscript", label: "Shell" },
    sql: { extension: "sql", mime: "application/sql", label: "SQL" },
    swift: { extension: "swift", mime: "text/plain", label: "Swift" },
    text: { extension: "txt", mime: "text/plain", label: "纯文本" },
    toml: { extension: "toml", mime: "application/toml", label: "TOML" },
    tsx: { extension: "tsx", mime: "text/typescript", label: "TSX" },
    typescript: { extension: "ts", mime: "text/typescript", label: "TypeScript" },
    xml: { extension: "xml", mime: "application/xml", label: "XML" },
    yaml: { extension: "yaml", mime: "application/yaml", label: "YAML" }
  });

  const rootOptions = new WeakMap();

  function normalizeLanguage(language) {
    const normalized = String(language || "")
      .trim()
      .split(/\s+/, 1)[0]
      .replace(/^language-/i, "")
      .replace(/^\./, "")
      .toLowerCase();
    return LANGUAGE_ALIASES[normalized] || normalized || "text";
  }

  function getLanguageDetails(language) {
    const normalized = normalizeLanguage(language);
    return LANGUAGE_DETAILS[normalized] || {
      extension: "txt",
      mime: "text/plain",
      label: String(language || "").trim() || "纯文本"
    };
  }

  function createCodeFilename(documentName, index, language) {
    const baseName = String(documentName || "Markdown")
      .replace(/\.(?:md|markdown)$/i, "")
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .trim() || "Markdown";
    const codeIndex = Math.max(1, Math.floor(Number(index) || 1));
    const { extension } = getLanguageDetails(language);
    return `${baseName}-code-${String(codeIndex).padStart(2, "0")}.${extension}`;
  }

  function inferLanguage(wrapper, code) {
    if (wrapper?.dataset.language) return wrapper.dataset.language;
    const languageClass = Array.from(code?.classList || [])
      .find((className) => className.startsWith("language-"));
    return languageClass ? languageClass.slice("language-".length) : "text";
  }

  function createToolButton(documentRef, action, label, languageLabel) {
    const button = documentRef.createElement("button");
    button.type = "button";
    button.dataset.codeAction = action;
    button.textContent = label;
    button.title = `${label} ${languageLabel} 代码`;
    button.setAttribute("aria-label", button.title);
    return button;
  }

  function enhanceCodeBlocks(root) {
    if (!root?.querySelectorAll) return;
    let codeIndex = 0;

    root.querySelectorAll("pre > code").forEach((code) => {
      if (code.closest(".mermaid-block")) return;
      codeIndex += 1;

      const pre = code.parentElement;
      let wrapper = pre.closest(".code-block");
      if (!wrapper || !root.contains(wrapper)) {
        wrapper = root.ownerDocument.createElement("div");
        wrapper.className = "code-block";
        pre.before(wrapper);
        wrapper.appendChild(pre);
      }

      const language = normalizeLanguage(inferLanguage(wrapper, code));
      const details = getLanguageDetails(language);
      wrapper.dataset.language = language;
      wrapper.dataset.codeIndex = String(codeIndex);

      let toolbar = wrapper.querySelector(":scope > .code-block-toolbar");
      if (!toolbar) {
        toolbar = root.ownerDocument.createElement("div");
        toolbar.className = "code-block-toolbar";

        const languageLabel = root.ownerDocument.createElement("span");
        languageLabel.className = "code-block-language";
        toolbar.appendChild(languageLabel);

        const actions = root.ownerDocument.createElement("div");
        actions.className = "code-block-actions";
        actions.append(
          createToolButton(root.ownerDocument, "copy", "复制", details.label),
          createToolButton(root.ownerDocument, "download", "下载", details.label)
        );
        toolbar.appendChild(actions);
        wrapper.insertBefore(toolbar, pre);
      }

      const languageLabel = toolbar.querySelector(".code-block-language");
      if (languageLabel) languageLabel.textContent = details.label;
    });
  }

  async function copyCode(text, documentRef) {
    const clipboard = globalScope?.navigator?.clipboard;
    if (clipboard?.writeText) {
      await clipboard.writeText(text);
      return;
    }

    const textarea = documentRef.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    documentRef.body.appendChild(textarea);
    textarea.select();
    const copied = documentRef.execCommand?.("copy");
    textarea.remove();
    if (!copied) throw new Error("浏览器未提供剪贴板权限");
  }

  function downloadCode(text, filename, mime, documentRef) {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = documentRef.createElement("a");
    link.href = url;
    link.download = filename;
    documentRef.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function showButtonFeedback(button, text) {
    if (!button) return;
    const previousText = button.textContent;
    button.textContent = text;
    button.disabled = true;
    setTimeout(() => {
      if (!button.isConnected) return;
      button.textContent = previousText;
      button.disabled = false;
    }, 1200);
  }

  async function handleToolClick(root, button) {
    const wrapper = button.closest(".code-block");
    const code = wrapper?.querySelector(":scope > pre > code");
    if (!wrapper || !code) return;

    const options = rootOptions.get(root) || {};
    const language = wrapper.dataset.language || "text";
    const details = getLanguageDetails(language);
    const codeText = code.textContent || "";

    try {
      if (button.dataset.codeAction === "copy") {
        await copyCode(codeText, root.ownerDocument);
        showButtonFeedback(button, "已复制");
        options.onStatus?.(`已复制 ${details.label} 代码`);
        return;
      }

      if (button.dataset.codeAction === "download") {
        const filename = createCodeFilename(
          options.getFileName?.(),
          wrapper.dataset.codeIndex,
          language
        );
        downloadCode(codeText, filename, details.mime, root.ownerDocument);
        showButtonFeedback(button, "已下载");
        options.onStatus?.(`已下载代码：${filename}`, "success");
      }
    } catch (error) {
      console.error("代码块操作失败：", error);
      showButtonFeedback(button, "失败");
      options.onStatus?.("代码块操作失败，请检查浏览器权限", "danger");
    }
  }

  function bindCodeBlockTools(root, options = {}) {
    if (!root?.addEventListener) return;
    rootOptions.set(root, options);
    if (root.dataset.codeToolsBound === "true") return;
    root.dataset.codeToolsBound = "true";
    root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-code-action]");
      if (!button || !root.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      handleToolClick(root, button);
    });
  }

  function cleanExportClone(root) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll(".code-block-toolbar").forEach((toolbar) => toolbar.remove());
    root.querySelectorAll(".code-block").forEach((wrapper) => {
      const pre = wrapper.querySelector(":scope > pre");
      if (pre) wrapper.replaceWith(pre);
    });
    root.removeAttribute?.("data-code-tools-bound");
  }

  return {
    bindCodeBlockTools,
    cleanExportClone,
    createCodeFilename,
    enhanceCodeBlocks,
    getLanguageDetails,
    normalizeLanguage
  };
});

(function initDocumentStats(globalScope, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (globalScope) {
    globalScope.mdDocumentStats = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function createDocumentStatsApi() {
  "use strict";

  const CJK_CHARACTER_PATTERN = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff]/gu;
  const LATIN_WORD_PATTERN = /[a-z0-9]+(?:['’_-][a-z0-9]+)*/giu;
  const DATA_URL_PATTERN = /data:image\/[a-z0-9.+-]+(?:;[a-z0-9.+-]+=[^;,\s)]+)*;base64,[a-z0-9+/=]+/giu;

  function stripFencedCodeBlocks(markdown) {
    const lines = String(markdown || "").split(/\r\n|\r|\n/);
    let fenceMarker = "";
    let fenceLength = 0;

    return lines.map((line) => {
      if (!fenceMarker) {
        const opening = line.match(/^ {0,3}(`{3,}|~{3,})/);
        if (!opening) return line;
        fenceMarker = opening[1][0];
        fenceLength = opening[1].length;
        return "";
      }

      const closing = line.match(/^ {0,3}(`+|~+)\s*$/);
      if (
        closing
        && closing[1][0] === fenceMarker
        && closing[1].length >= fenceLength
      ) {
        fenceMarker = "";
        fenceLength = 0;
      }
      return "";
    }).join("\n");
  }

  function countHeadings(markdownWithoutFences) {
    const lines = String(markdownWithoutFences || "").split("\n");
    let count = 0;

    lines.forEach((line, index) => {
      if (/^ {0,3}#{1,6}(?:[ \t]+|$)/.test(line)) {
        count += 1;
        return;
      }

      if (
        index > 0
        && /^ {0,3}(?:=+|-+)\s*$/.test(line)
        && lines[index - 1].trim()
      ) {
        count += 1;
      }
    });

    return count;
  }

  function stripMathExpressions(markdown) {
    return String(markdown || "")
      .replace(/^ {0,3}\$\$\s*$[\s\S]*?^ {0,3}\$\$\s*$/gm, " ")
      .replace(/(^|[^\\\d])\$\$([^\r\n$]+?)\$\$(?!\d)/g, "$1 ")
      .replace(/(^|[^\\\d])\$((?:[^\s\\])|(?:\S[^\r\n]*?[^\s\\]))\$(?!\d)/g, "$1 ");
  }

  function toReadableText(markdownWithoutFences) {
    return stripMathExpressions(String(markdownWithoutFences || ""))
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(DATA_URL_PATTERN, " ")
      .replace(/!\[((?:\\.|[^\]\r\n])*)\]\([^\r\n)]*\)/g, "$1")
      .replace(/!\[((?:\\.|[^\]\r\n])*)\]\[[^\]\r\n]*\]/g, "$1")
      .replace(/^ {0,3}\[[^\]\r\n]+\]:\s*\S+.*$/gm, " ")
      .replace(/(`+)([^`\r\n]*?)\1/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/\[([^\]\r\n]+)\]\([^\r\n)]*\)/g, "$1")
      .replace(/\[([^\]\r\n]+)\]\[[^\]\r\n]*\]/g, "$1")
      .replace(/^ {0,3}\[\^[^\]]+\]:\s*/gm, "")
      .replace(/\[\^[^\]]+\]/g, " ")
      .replace(/^ {0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+/gm, "")
      .replace(/^ {0,3}\[[ xX]\]\s+/gm, "")
      .replace(/&(?:#\d+|#x[a-f0-9]+|[a-z][a-z0-9]+);/gi, " ")
      .replace(/\\([\\`*{}\[\]()#+.!_>~-])/g, "$1")
      .replace(/[*_~|]/g, " ");
  }

  function calculateDocumentStats(markdown) {
    const source = String(markdown || "");
    const withoutFences = stripFencedCodeBlocks(source);
    const readableText = toReadableText(withoutFences);
    const cjkCharacters = readableText.match(CJK_CHARACTER_PATTERN) || [];
    const latinWords = readableText.match(LATIN_WORD_PATTERN) || [];
    const wordCount = cjkCharacters.length + latinWords.length;
    const readingUnits = (cjkCharacters.length / 300) + (latinWords.length / 200);

    return {
      wordCount,
      lineCount: source ? source.split(/\r\n|\r|\n/).length : 0,
      headingCount: countHeadings(withoutFences),
      readingMinutes: wordCount ? Math.max(1, Math.ceil(readingUnits)) : 0,
      cjkCharacterCount: cjkCharacters.length,
      latinWordCount: latinWords.length
    };
  }

  function formatReadingTime(minutes) {
    const value = Number(minutes);
    return !Number.isFinite(value) || value <= 1
      ? "少于 1 分钟"
      : `约 ${Math.ceil(value)} 分钟`;
  }

  return {
    calculateDocumentStats,
    formatReadingTime,
    stripMathExpressions,
    stripFencedCodeBlocks
  };
});

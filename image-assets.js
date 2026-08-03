(function initImageAssets(globalScope, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (globalScope) {
    globalScope.mdImageAssets = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function createImageAssetsApi() {
  "use strict";

  const SNAPSHOT_VERSION = 1;
  const DATA_URL_PATTERN = /^data:image\/[a-z0-9.+-]+(?:;[a-z0-9.+-]+=[^;,\s)]+)*;base64,[a-z0-9+/=]+$/i;
  const INLINE_DATA_URL_PATTERN = /(!\[(?:\\.|[^\]\r\n])*\]\(\s*)(data:image\/[a-z0-9.+-]+(?:;[a-z0-9.+-]+=[^;,\s)]+)*;base64,[a-z0-9+/=]+)(\s*(?:(?:"[^"\r\n]*")|(?:'[^'\r\n]*'))?\s*\))/gi;
  const SHORT_REFERENCE_PATTERN = /(!\[(?:\\.|[^\]\r\n])*\]\(\s*)md-image:([1-9]\d*)(\s*(?:(?:"[^"\r\n]*")|(?:'[^'\r\n]*'))?\s*\))/g;

  function isImageDataUrl(value) {
    return DATA_URL_PATTERN.test(String(value || ""));
  }

  function escapeAltText(value) {
    return String(value || "image")
      .replace(/\\/g, "\\\\")
      .replace(/\]/g, "\\]");
  }

  function mapPosition(position, replacements) {
    let delta = 0;
    for (const replacement of replacements) {
      if (position < replacement.start) break;

      const originalLength = replacement.end - replacement.start;
      if (position <= replacement.end) {
        return replacement.start
          + delta
          + Math.min(position - replacement.start, replacement.newLength);
      }
      delta += replacement.newLength - originalLength;
    }
    return position + delta;
  }

  function createStore(initialSnapshot) {
    const assets = new Map();
    const idsByDataUrl = new Map();
    let nextId = 1;
    let revision = 0;

    function add(dataUrl) {
      const value = String(dataUrl || "");
      if (!isImageDataUrl(value)) {
        throw new TypeError("Invalid image DataURL");
      }

      const existingId = idsByDataUrl.get(value);
      if (existingId) return existingId;

      const id = String(nextId++);
      assets.set(id, value);
      idsByDataUrl.set(value, id);
      revision += 1;
      return id;
    }

    function clear() {
      assets.clear();
      idsByDataUrl.clear();
      nextId = 1;
      revision += 1;
    }

    function restore(snapshot) {
      assets.clear();
      idsByDataUrl.clear();
      nextId = 1;
      if (!snapshot || snapshot.version !== SNAPSHOT_VERSION || !Array.isArray(snapshot.assets)) {
        revision += 1;
        return false;
      }

      let highestId = 0;
      for (const entry of snapshot.assets) {
        if (!Array.isArray(entry) || entry.length !== 2) continue;
        const [rawId, dataUrl] = entry;
        const id = String(rawId);
        if (!/^[1-9]\d*$/.test(id) || !isImageDataUrl(dataUrl) || assets.has(id)) continue;
        assets.set(id, dataUrl);
        if (!idsByDataUrl.has(dataUrl)) idsByDataUrl.set(dataUrl, id);
        highestId = Math.max(highestId, Number(id));
      }

      const requestedNextId = Number(snapshot.nextId);
      nextId = Number.isSafeInteger(requestedNextId) && requestedNextId > highestId
        ? requestedNextId
        : highestId + 1;
      revision += 1;
      return true;
    }

    function snapshot() {
      return {
        version: SNAPSHOT_VERSION,
        nextId,
        assets: Array.from(assets.entries())
      };
    }

    function compact(markdown) {
      const source = String(markdown || "");
      const replacements = [];
      let added = 0;

      const content = source.replace(
        INLINE_DATA_URL_PATTERN,
        (match, prefix, dataUrl, suffix, offset) => {
          const sizeBefore = assets.size;
          const id = add(dataUrl);
          if (assets.size > sizeBefore) added += 1;
          const replacement = `${prefix}md-image:${id}${suffix}`;
          replacements.push({
            start: offset,
            end: offset + match.length,
            newLength: replacement.length
          });
          return replacement;
        }
      );

      return {
        content,
        replacements,
        added,
        count: replacements.length
      };
    }

    function expand(markdown) {
      const missingIds = [];
      const content = String(markdown || "").replace(
        SHORT_REFERENCE_PATTERN,
        (match, prefix, id, suffix) => {
          const dataUrl = assets.get(id);
          if (!dataUrl) {
            if (!missingIds.includes(id)) missingIds.push(id);
            return match;
          }
          return `${prefix}${dataUrl}${suffix}`;
        }
      );
      return { content, missingIds };
    }

    if (initialSnapshot) restore(initialSnapshot);

    return {
      add,
      clear,
      compact,
      expand,
      restore,
      snapshot,
      get size() {
        return assets.size;
      },
      get revision() {
        return revision;
      }
    };
  }

  return {
    createStore,
    escapeAltText,
    isImageDataUrl,
    mapPosition
  };
});

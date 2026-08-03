(function initRecentFiles(globalScope, factory) {
  const api = factory(globalScope);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (globalScope) {
    globalScope.mdRecentFiles = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function createRecentFilesApi(globalScope) {
  "use strict";

  const DB_NAME = "md-editor-recent-files";
  const DB_VERSION = 1;
  const STORE_NAME = "recent-files";
  const MAX_RECENT_FILES = 12;

  function isFileHandle(handle) {
    return Boolean(
      handle
      && handle.kind === "file"
      && typeof handle.getFile === "function"
    );
  }

  function normalizeFileUrl(value) {
    try {
      const url = new URL(String(value || ""));
      const pathname = decodeURIComponent(url.pathname || "");
      if (url.protocol !== "file:" || !/\.(?:md|markdown)$/i.test(pathname)) return "";
      url.hash = "";
      url.search = "";
      return url.href;
    } catch {
      return "";
    }
  }

  function normalizeEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    const handle = isFileHandle(entry.handle) ? entry.handle : null;
    const fileUrl = normalizeFileUrl(entry.fileUrl);
    if (!handle && !fileUrl) return null;
    const id = String(entry.id || "").trim();
    const name = String(entry.name || handle?.name || "").trim();
    const openedAt = Number(entry.openedAt);
    if (!id || !name || !Number.isFinite(openedAt) || openedAt <= 0) return null;
    return {
      id,
      name,
      size: Number.isFinite(Number(entry.size)) ? Math.max(0, Number(entry.size)) : 0,
      lastModified: Number.isFinite(Number(entry.lastModified))
        ? Math.max(0, Number(entry.lastModified))
        : 0,
      openedAt,
      handle,
      fileUrl
    };
  }

  function sortAndLimit(entries, limit = MAX_RECENT_FILES) {
    const normalizedLimit = Math.max(0, Math.floor(Number(limit) || 0));
    return entries
      .map(normalizeEntry)
      .filter(Boolean)
      .sort((left, right) => right.openedAt - left.openedAt)
      .slice(0, normalizedLimit);
  }

  function calculateMenuPosition(anchorRect, menuSize, viewportSize, margin = 8, gap = 6) {
    const viewportWidth = Math.max(0, Number(viewportSize?.width) || 0);
    const viewportHeight = Math.max(0, Number(viewportSize?.height) || 0);
    const menuWidth = Math.max(0, Number(menuSize?.width) || 0);
    const menuHeight = Math.max(0, Number(menuSize?.height) || 0);
    const anchorLeft = Number(anchorRect?.left) || 0;
    const anchorTop = Number(anchorRect?.top) || 0;
    const anchorBottom = Number(anchorRect?.bottom) || anchorTop;
    const safeMargin = Math.max(0, Number(margin) || 0);
    const safeGap = Math.max(0, Number(gap) || 0);
    const maxLeft = Math.max(safeMargin, viewportWidth - menuWidth - safeMargin);
    const left = Math.min(Math.max(safeMargin, anchorLeft), maxLeft);
    const preferredTop = anchorBottom + safeGap;
    const top = preferredTop + menuHeight <= viewportHeight - safeMargin
      ? preferredTop
      : Math.max(safeMargin, anchorTop - menuHeight - safeGap);
    return { left: Math.round(left), top: Math.round(top) };
  }

  async function findMatchingEntryIds(entries, handle) {
    if (!isFileHandle(handle) || typeof handle.isSameEntry !== "function") return [];
    const matches = [];
    for (const entry of entries) {
      if (!isFileHandle(entry.handle)) continue;
      try {
        if (await handle.isSameEntry(entry.handle)) matches.push(entry.id);
      } catch {
        // Ignore stale handles and continue comparing the remaining entries.
      }
    }
    return matches;
  }

  function findMatchingUrlEntryIds(entries, fileUrl) {
    const normalizedUrl = normalizeFileUrl(fileUrl);
    if (!normalizedUrl) return [];
    return entries
      .filter((entry) => entry.fileUrl === normalizedUrl)
      .map((entry) => entry.id);
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
    });
  }

  function transactionComplete(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
    });
  }

  function createId(now) {
    const randomPart = globalScope.crypto?.randomUUID?.()
      || Math.random().toString(36).slice(2, 10);
    return `${Math.floor(now).toString(36)}-${randomPart}`;
  }

  function createStore(indexedDb = globalScope.indexedDB) {
    if (!indexedDb || typeof indexedDb.open !== "function") {
      throw new Error("IndexedDB is unavailable");
    }

    let databasePromise = null;

    function openDatabase() {
      if (databasePromise) return databasePromise;
      databasePromise = new Promise((resolve, reject) => {
        const request = indexedDb.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(STORE_NAME)) {
            database.createObjectStore(STORE_NAME, { keyPath: "id" });
          }
        };
        request.onsuccess = () => {
          const database = request.result;
          database.onversionchange = () => {
            database.close();
            databasePromise = null;
          };
          resolve(database);
        };
        request.onerror = () => {
          databasePromise = null;
          reject(request.error || new Error("Unable to open recent files database"));
        };
      });
      return databasePromise;
    }

    async function list() {
      const database = await openDatabase();
      const transaction = database.transaction(STORE_NAME, "readonly");
      const completed = transactionComplete(transaction);
      const records = await requestResult(transaction.objectStore(STORE_NAME).getAll());
      await completed;
      return sortAndLimit(records);
    }

    async function writeRecord(existing, record, matchingIds) {
      const nextEntries = sortAndLimit([
        record,
        ...existing.filter((entry) => !matchingIds.includes(entry.id))
      ]);
      const keepIds = new Set(nextEntries.map((entry) => entry.id));
      const deleteIds = existing
        .map((entry) => entry.id)
        .filter((id) => !keepIds.has(id) || (matchingIds.includes(id) && id !== record.id));

      const database = await openDatabase();
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const completed = transactionComplete(transaction);
      const store = transaction.objectStore(STORE_NAME);
      store.put(record);
      deleteIds.forEach((id) => store.delete(id));
      await completed;
      return nextEntries;
    }

    async function upsert(handle, file, openedAt = Date.now()) {
      if (!isFileHandle(handle)) throw new TypeError("A file handle is required");
      const existing = await list();
      const matchingIds = await findMatchingEntryIds(existing, handle);
      const record = normalizeEntry({
        id: matchingIds[0] || createId(openedAt),
        name: file?.name || handle.name,
        size: file?.size,
        lastModified: file?.lastModified,
        openedAt,
        handle,
        fileUrl: ""
      });
      if (!record) throw new TypeError("Recent file metadata is invalid");
      return writeRecord(existing, record, matchingIds);
    }

    async function upsertUrl(fileUrl, metadata = {}, openedAt = Date.now()) {
      const normalizedUrl = normalizeFileUrl(fileUrl);
      if (!normalizedUrl) throw new TypeError("A local Markdown file URL is required");
      const existing = await list();
      const matchingIds = findMatchingUrlEntryIds(existing, normalizedUrl);
      const record = normalizeEntry({
        id: matchingIds[0] || createId(openedAt),
        name: metadata.name,
        size: metadata.size,
        lastModified: metadata.lastModified,
        openedAt,
        handle: null,
        fileUrl: normalizedUrl
      });
      if (!record) throw new TypeError("Recent file metadata is invalid");
      return writeRecord(existing, record, matchingIds);
    }

    async function remove(id) {
      const database = await openDatabase();
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const completed = transactionComplete(transaction);
      transaction.objectStore(STORE_NAME).delete(String(id));
      await completed;
    }

    return { list, remove, upsert, upsertUrl };
  }

  function isSupported(scope = globalScope) {
    return Boolean(
      scope?.indexedDB
      && typeof scope.indexedDB.open === "function"
      && typeof scope.showOpenFilePicker === "function"
    );
  }

  return {
    MAX_RECENT_FILES,
    calculateMenuPosition,
    createStore,
    findMatchingEntryIds,
    findMatchingUrlEntryIds,
    isFileHandle,
    isSupported,
    normalizeFileUrl,
    normalizeEntry,
    sortAndLimit
  };
});

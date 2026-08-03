(function initPendingFileStorage(globalScope, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (globalScope) {
    globalScope.mdPendingFiles = api;
  }
})(typeof self !== "undefined" ? self : globalThis, function createPendingFileStorageApi() {
  "use strict";

  const PENDING_PREFIX = "pending:";
  const LEGACY_FILE_PREFIX = "file:";
  const LEGACY_NAME_PREFIX = "name:";
  const CLEANUP_ALARM_PREFIX = "md-pending-cleanup:";
  const PENDING_MAX_AGE_MS = 30 * 60 * 1000;
  const NONCE_PATTERN = /^[a-z0-9_-]{6,64}$/i;

  function normalizeNonce(value) {
    const nonce = String(value || "");
    return NONCE_PATTERN.test(nonce) ? nonce : "";
  }

  function pendingKey(nonce) {
    const normalized = normalizeNonce(nonce);
    return normalized ? `${PENDING_PREFIX}${normalized}` : "";
  }

  function legacyFileKey(nonce) {
    const normalized = normalizeNonce(nonce);
    return normalized ? `${LEGACY_FILE_PREFIX}${normalized}` : "";
  }

  function legacyNameKey(nonce) {
    const normalized = normalizeNonce(nonce);
    return normalized ? `${LEGACY_NAME_PREFIX}${normalized}` : "";
  }

  function cleanupAlarmName(nonce) {
    const normalized = normalizeNonce(nonce);
    return normalized ? `${CLEANUP_ALARM_PREFIX}${normalized}` : "";
  }

  function nonceFromCleanupAlarm(name) {
    const value = String(name || "");
    if (!value.startsWith(CLEANUP_ALARM_PREFIX)) return "";
    return normalizeNonce(value.slice(CLEANUP_ALARM_PREFIX.length));
  }

  function createEnvelope(content, name, timestamp = Date.now()) {
    return {
      content: String(content || ""),
      name: String(name || "untitled.md"),
      ts: Number(timestamp)
    };
  }

  function isValidEnvelope(value) {
    return Boolean(
      value
      && typeof value === "object"
      && typeof value.content === "string"
      && typeof value.name === "string"
      && Number.isFinite(value.ts)
      && value.ts > 0
    );
  }

  function isFreshEnvelope(value, options = {}) {
    if (!isValidEnvelope(value)) return false;
    const now = Number.isFinite(options.now) ? options.now : Date.now();
    const maxAgeMs = Number.isFinite(options.maxAgeMs)
      ? options.maxAgeMs
      : PENDING_MAX_AGE_MS;
    return Math.abs(now - value.ts) <= maxAgeMs;
  }

  function collectCleanupKeys(entries, options = {}) {
    const values = entries && typeof entries === "object" ? entries : {};
    const now = Number.isFinite(options.now) ? options.now : Date.now();
    const maxAgeMs = Number.isFinite(options.maxAgeMs)
      ? options.maxAgeMs
      : PENDING_MAX_AGE_MS;
    const currentKey = pendingKey(options.currentNonce);
    const cleanupKeys = [];

    for (const [key, value] of Object.entries(values)) {
      if (key.startsWith(LEGACY_FILE_PREFIX) || key.startsWith(LEGACY_NAME_PREFIX)) {
        cleanupKeys.push(key);
        continue;
      }
      if (!key.startsWith(PENDING_PREFIX) || key === currentKey) continue;

      if (
        !isFreshEnvelope(value, { now, maxAgeMs })
      ) {
        cleanupKeys.push(key);
      }
    }

    return cleanupKeys;
  }

  return {
    CLEANUP_ALARM_PREFIX,
    LEGACY_FILE_PREFIX,
    LEGACY_NAME_PREFIX,
    PENDING_MAX_AGE_MS,
    PENDING_PREFIX,
    cleanupAlarmName,
    collectCleanupKeys,
    createEnvelope,
    isFreshEnvelope,
    isValidEnvelope,
    legacyFileKey,
    legacyNameKey,
    nonceFromCleanupAlarm,
    normalizeNonce,
    pendingKey
  };
});

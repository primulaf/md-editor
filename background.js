importScripts('pending-file-storage.js');

const pendingFiles = globalThis.mdPendingFiles;

function removePendingEntry(nonce) {
  const storageKey = pendingFiles.pendingKey(nonce);
  if (storageKey) chrome.storage.local.remove(storageKey);
}

// 工具栏图标 → 新建标签页打开编辑器
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'index.html' });
});

// content script 在 file://*.md 页面运行后发来消息 → 将当前标签页跳转到编辑器
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const nonce = pendingFiles.normalizeNonce(message?.nonce);
  if (message?.action !== 'openMd' || !sender.tab || !nonce) return false;

  chrome.tabs.update(sender.tab.id, {
    url: chrome.runtime.getURL(`index.html?file=${nonce}`)
  }, () => {
    if (chrome.runtime.lastError) {
      removePendingEntry(nonce);
      sendResponse({ ok: false });
      return;
    }

    chrome.alarms.create(pendingFiles.cleanupAlarmName(nonce), {
      delayInMinutes: 1
    });
    sendResponse({ ok: true });
  });
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  const nonce = pendingFiles.nonceFromCleanupAlarm(alarm.name);
  if (nonce) removePendingEntry(nonce);
});

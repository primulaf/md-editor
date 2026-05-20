// 在 file://*.md 页面运行，读取 Markdown 内容并触发跳转
(function () {
  const pre = document.querySelector('pre');
  const content = pre ? pre.textContent : (document.body.textContent || '');
  const pathname = decodeURIComponent(window.location.pathname || '');
  const filename = pathname.split('/').pop() || document.title || 'untitled.md';
  const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  chrome.storage.local.set(
    { ['file:' + nonce]: content, ['name:' + nonce]: filename },
    () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to store file content:', chrome.runtime.lastError.message);
        return;
      }
      chrome.runtime.sendMessage({ action: 'openMd', nonce: nonce });
    }
  );
})();

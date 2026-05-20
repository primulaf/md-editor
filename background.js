// 工具栏图标 → 新建标签页打开编辑器
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'index.html' });
});

// content script 在 file://*.md 页面运行后发来消息 → 将当前标签页跳转到编辑器
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'openMd' && sender.tab && message.nonce) {
    chrome.tabs.update(sender.tab.id, {
      url: chrome.runtime.getURL('index.html?file=' + message.nonce)
    });
  }
});

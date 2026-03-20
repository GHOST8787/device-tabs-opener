// background.js - Service Worker

// 取得所有裝置的分頁，按裝置分組
async function getDeviceTabs() {
  return new Promise((resolve) => {
    chrome.sessions.getDevices({}, (devices) => {
      if (!devices || devices.length === 0) {
        resolve([]);
        return;
      }

      const result = devices.map(device => {
        const tabs = [];
        device.sessions.forEach(session => {
          if (session.window && session.window.tabs) {
            session.window.tabs.forEach(tab => {
              if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-native://')) {
                tabs.push({
                  url: tab.url,
                  title: tab.title || tab.url,
                  favIconUrl: tab.favIconUrl || ''
                });
              }
            });
          }
        });
        return {
          deviceName: device.deviceName,
          tabs: tabs
        };
      }).filter(d => d.tabs.length > 0);

      resolve(result);
    });
  });
}

// 批次開啟指定的分頁
async function openTabs(urls) {
  if (!urls || urls.length === 0) return { success: false, count: 0 };

  const firstWindow = await chrome.windows.create({ url: urls[0] });

  for (let i = 1; i < urls.length; i++) {
    await chrome.tabs.create({
      windowId: firstWindow.id,
      url: urls[i]
    });
  }

  return { success: true, count: urls.length };
}

// 監聯來自 popup 的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getDeviceTabs") {
    getDeviceTabs().then(devices => sendResponse({ devices }));
    return true;
  }

  if (message.action === "openTabs") {
    openTabs(message.urls).then(result => sendResponse(result));
    return true;
  }
});

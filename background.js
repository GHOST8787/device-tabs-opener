// background.js — Service Worker (v2.2.0)

// Fetch all device tabs, grouped by device.
// Each device exposes deviceName, modifiedTime (epoch ms, latest session), tabs[].
async function getDeviceTabs() {
  return new Promise((resolve) => {
    chrome.sessions.getDevices({}, (chromeDevices) => {
      if (!chromeDevices || chromeDevices.length === 0) {
        resolve([]);
        return;
      }

      const result = chromeDevices.map((device) => {
        const tabs = [];
        let latestModifiedSec = 0;

        device.sessions.forEach((session) => {
          if (session.lastModified && session.lastModified > latestModifiedSec) {
            latestModifiedSec = session.lastModified;
          }
          if (session.window && session.window.tabs) {
            session.window.tabs.forEach((tab) => {
              if (
                tab.url &&
                !tab.url.startsWith("chrome://") &&
                !tab.url.startsWith("chrome-native://") &&
                !tab.url.startsWith("chrome-extension://")
              ) {
                tabs.push({
                  url: tab.url,
                  title: tab.title || tab.url,
                  favIconUrl: tab.favIconUrl || ""
                });
              }
            });
          }
        });

        return {
          deviceName: device.deviceName,
          modifiedTime: latestModifiedSec ? latestModifiedSec * 1000 : null,
          tabs: tabs
        };
      }).filter((d) => d.tabs.length > 0);

      resolve(result);
    });
  });
}

// Batch-open given URLs in a new window.
async function openTabs(urls) {
  if (!urls || urls.length === 0) return { success: false, count: 0 };

  const firstWindow = await chrome.windows.create({ url: urls[0], focused: true });

  for (let i = 1; i < urls.length; i++) {
    await chrome.tabs.create({
      windowId: firstWindow.id,
      url: urls[i],
      active: false
    });
  }

  return { success: true, count: urls.length };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getDeviceTabs") {
    getDeviceTabs().then((devices) => sendResponse({ devices }));
    return true;
  }
  if (message.action === "openTabs") {
    openTabs(message.urls).then((result) => sendResponse(result));
    return true;
  }
});

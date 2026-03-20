// popup.js

const content = document.getElementById('content');
const openAllSection = document.getElementById('openAllSection');
const btnOpenAll = document.getElementById('btnOpenAll');

let allDevices = [];

document.addEventListener('DOMContentLoaded', loadDevices);

async function loadDevices() {
  try {
    const response = await chrome.runtime.sendMessage({ action: "getDeviceTabs" });
    allDevices = response.devices || [];

    if (allDevices.length === 0) {
      showEmpty();
    } else {
      renderDevices(allDevices);
    }
  } catch (err) {
    showError(err);
  }
}

function renderDevices(devices) {
  content.innerHTML = '';
  let totalCount = 0;

  devices.forEach(device => {
    totalCount += device.tabs.length;
    const card = document.createElement('div');
    card.className = 'device-card';

    const icon = getDeviceIcon(device.deviceName);
    const previewTabs = device.tabs.slice(0, 4);
    const remaining = device.tabs.length - previewTabs.length;

    // Header
    const header = document.createElement('div');
    header.className = 'device-header';

    const openBtn = document.createElement('button');
    openBtn.className = 'device-open-btn';
    openBtn.textContent = `開啟全部`;

    header.innerHTML = `
      <span class="device-icon">${icon}</span>
      <span class="device-name">${escapeHtml(device.deviceName)}</span>
      <span class="device-count">${device.tabs.length} 個</span>
    `;
    header.appendChild(openBtn);
    card.appendChild(header);

    // Tab preview
    const preview = document.createElement('div');
    preview.className = 'tab-preview';

    previewTabs.forEach(tab => {
      const item = document.createElement('div');
      item.className = 'tab-preview-item';
      const hostname = getHostname(tab.url);
      const faviconHtml = tab.favIconUrl
        ? `<img src="${tab.favIconUrl}" onerror="this.textContent='🌐';this.style.display='none'">`
        : '';
      item.innerHTML = `${faviconHtml}<span>${escapeHtml(tab.title || hostname)}</span>`;
      preview.appendChild(item);
    });

    if (remaining > 0) {
      const more = document.createElement('div');
      more.className = 'tab-preview-more';
      more.textContent = `⋯ 還有 ${remaining} 個分頁`;
      preview.appendChild(more);
    }

    card.appendChild(preview);
    content.appendChild(card);

    // 點擊開啟該裝置的所有分頁
    openBtn.addEventListener('click', () => {
      openDeviceTabs(device, openBtn);
    });
  });

  // 多於一個裝置才顯示「開啟全部」
  if (devices.length > 1) {
    openAllSection.style.display = 'block';
    btnOpenAll.textContent = `🚀 開啟全部 ${totalCount} 個分頁`;
  }
}

async function openDeviceTabs(device, btn) {
  btn.disabled = true;
  btn.textContent = '⏳ 開啟中...';

  const urls = device.tabs.map(t => t.url);
  const result = await chrome.runtime.sendMessage({ action: "openTabs", urls });

  if (result && result.success) {
    btn.textContent = `✓ 已開啟 ${result.count} 個`;
    btn.classList.add('success');
  } else {
    btn.textContent = '失敗，請重試';
    btn.disabled = false;
  }
}

// 開啟全部裝置分頁
btnOpenAll.addEventListener('click', async () => {
  btnOpenAll.disabled = true;
  btnOpenAll.textContent = '⏳ 開啟中...';

  const allUrls = allDevices.flatMap(d => d.tabs.map(t => t.url));
  const result = await chrome.runtime.sendMessage({ action: "openTabs", urls: allUrls });

  if (result && result.success) {
    btnOpenAll.textContent = `✓ 已開啟 ${result.count} 個分頁！`;
    btnOpenAll.classList.add('success');
  } else {
    btnOpenAll.textContent = '失敗，請重試';
    btnOpenAll.disabled = false;
  }
});

function showEmpty() {
  content.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📭</div>
      <div class="empty-title">找不到裝置同步分頁</div>
      <div class="empty-desc">
        請確認：<br>
        1. 已登入 Google 帳號<br>
        2. 裝置已開啟 Chrome 同步<br>
        3. 裝置上有開啟的分頁
      </div>
    </div>
  `;
}

function showError(err) {
  content.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⚠️</div>
      <div class="empty-title">讀取失敗</div>
      <div class="empty-desc">${escapeHtml(err.message || '未知錯誤')}</div>
    </div>
  `;
}

function getDeviceIcon(name) {
  const n = name.toLowerCase();
  if (n.includes('iphone')) return '📱';
  if (n.includes('ipad')) return '📟';
  if (n.includes('mac')) return '💻';
  if (n.includes('android')) return '🤖';
  return '📱';
}

function getHostname(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

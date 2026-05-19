// popup.js — v2.2.0

const content = document.getElementById("content");
const footer = document.getElementById("footer");
const btnOpen = document.getElementById("btnOpen");
const btnLabel = document.getElementById("btnLabel");
const langToggle = document.getElementById("langToggle");

// Devices snapshot. Each tab gets an `_id` for selection tracking.
let devices = [];
const selected = new Set();

// Language override stored in chrome.storage.local — overrides browser default.
// Values: "zh_TW" | "en" | null (use browser default).
let langOverride = null;
let messages = {};

// ---------- i18n helpers ----------

// Built-in messages for the override path. Mirror _locales/<lang>/messages.json.
const MESSAGES = {
  zh_TW: {
    headerEyebrow: "CHROME EXTENSION",
    headerTitle: "裝置分頁",
    devicesLabel: "裝置",
    tabs: "個分頁",
    selectAll: "全選",
    deselectAll: "取消",
    openSelectedPrefix: "開啟選取的",
    openSelectedSuffix: "個分頁",
    openInProgress: "開啟中",
    openSuccess: "已開啟",
    openFail: "失敗,請重試",
    syncTimeMinutes: (n) => `${n} 分鐘`,
    syncTimeHours: (n) => `${n} 小時`,
    syncTimeDays: (n) => `${n} 天`,
    syncTimeJustNow: "剛才",
    syncTimePattern: (time) => `${time}前同步`,
    emptyTitle: "找不到裝置同步分頁",
    emptyDescLine1: "請確認下列三件事:",
    emptyDescLine2: "1. 已登入 Google 帳號",
    emptyDescLine3: "2. 手機 / 平板 Chrome 已開啟同步",
    emptyDescLine4: "3. 裝置上目前有開啟的分頁",
    errorTitle: "讀取失敗",
    loading: "讀取中"
  },
  en: {
    headerEyebrow: "CHROME EXTENSION",
    headerTitle: "Device Tabs",
    devicesLabel: "DEVICES",
    tabs: "tabs",
    selectAll: "All",
    deselectAll: "None",
    openSelectedPrefix: "Open",
    openSelectedSuffix: "tabs",
    openInProgress: "Opening",
    openSuccess: "Opened",
    openFail: "Failed, please retry",
    syncTimeMinutes: (n) => `${n} min`,
    syncTimeHours: (n) => `${n} hr`,
    syncTimeDays: (n) => `${n} d`,
    syncTimeJustNow: "just now",
    syncTimePattern: (time) => `Synced ${time} ago`,
    emptyTitle: "No synced device tabs found",
    emptyDescLine1: "Please check:",
    emptyDescLine2: "1. Signed in to your Google account",
    emptyDescLine3: "2. Chrome Sync enabled on your iPhone / iPad",
    emptyDescLine4: "3. Tabs currently open on your device",
    errorTitle: "Failed to load",
    loading: "Loading"
  }
};

function detectLang() {
  if (langOverride) return langOverride;
  const ui = (chrome.i18n.getUILanguage() || "en").toLowerCase();
  if (ui.startsWith("zh")) return "zh_TW";
  return "en";
}

function t(key, ...args) {
  const lang = detectLang();
  const dict = MESSAGES[lang] || MESSAGES.en;
  const val = dict[key];
  if (typeof val === "function") return val(...args);
  return val ?? key;
}

function applyStaticI18n() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    const text = t(key);
    if (text) el.textContent = text;
  });
  // Lang toggle shows the OTHER language label.
  langToggle.textContent = detectLang() === "zh_TW" ? "EN" : "中";
  langToggle.setAttribute("aria-label",
    detectLang() === "zh_TW" ? "Switch to English" : "切換為中文");
}

// ---------- time formatting ----------

function formatSyncTime(timestampMs) {
  if (!timestampMs) return "";
  const diffSec = Math.max(0, (Date.now() - timestampMs) / 1000);
  let timeStr;
  if (diffSec < 60) timeStr = t("syncTimeJustNow");
  else if (diffSec < 3600) timeStr = t("syncTimeMinutes", Math.floor(diffSec / 60));
  else if (diffSec < 86400) timeStr = t("syncTimeHours", Math.floor(diffSec / 3600));
  else timeStr = t("syncTimeDays", Math.floor(diffSec / 86400));
  return diffSec < 60 ? timeStr : t("syncTimePattern", timeStr);
}

// ---------- rendering ----------

function deviceIconSvg(deviceName) {
  const n = (deviceName || "").toLowerCase();
  // Default = iPad (tablet rect); iPhone if name hints at phone.
  if (n.includes("iphone") || n.includes("phone") || n.includes("android")) {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/>
    </svg>`;
  }
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="11" y1="18.5" x2="13" y2="18.5"/>
  </svg>`;
}

function isPhone(deviceName) {
  const n = (deviceName || "").toLowerCase();
  return n.includes("iphone") || n.includes("phone") || n.includes("android");
}

const checkSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

function render() {
  if (devices.length === 0) {
    renderEmpty();
    return;
  }

  content.innerHTML = "";

  const label = document.createElement("div");
  label.className = "section-label";
  label.textContent = `${t("devicesLabel")} · ${devices.length}`;
  content.appendChild(label);

  devices.forEach((device) => {
    const card = document.createElement("div");
    card.className = "device-card";

    const header = document.createElement("div");
    header.className = "device-header";

    const iconBox = document.createElement("div");
    iconBox.className = "device-icon" + (isPhone(device.deviceName) ? " iphone" : "");
    iconBox.innerHTML = deviceIconSvg(device.deviceName);
    header.appendChild(iconBox);

    const info = document.createElement("div");
    info.className = "device-info";
    const name = document.createElement("div");
    name.className = "device-name";
    name.textContent = device.deviceName || "—";
    const meta = document.createElement("div");
    meta.className = "device-meta";
    const tabsWord = device.tabs.length === 1 ? t("tabs") : t("tabs");
    const sync = formatSyncTime(device.modifiedTime);
    meta.textContent = sync
      ? `${sync} · ${device.tabs.length} ${tabsWord}`
      : `${device.tabs.length} ${tabsWord}`;
    info.appendChild(name);
    info.appendChild(meta);
    header.appendChild(info);

    const selectBtn = document.createElement("button");
    selectBtn.className = "select-toggle";
    selectBtn.type = "button";
    const allSelected = device.tabs.every(tab => selected.has(tab._id));
    selectBtn.textContent = allSelected ? t("deselectAll") : t("selectAll");
    selectBtn.addEventListener("click", () => {
      if (allSelected) device.tabs.forEach(tab => selected.delete(tab._id));
      else device.tabs.forEach(tab => selected.add(tab._id));
      render();
    });
    header.appendChild(selectBtn);
    card.appendChild(header);

    const list = document.createElement("div");
    list.className = "tab-list";

    device.tabs.forEach((tab) => {
      const item = document.createElement("div");
      item.className = "tab-item" + (selected.has(tab._id) ? " checked" : "");
      item.setAttribute("role", "checkbox");
      item.setAttribute("aria-checked", selected.has(tab._id) ? "true" : "false");
      item.setAttribute("tabindex", "0");

      const box = document.createElement("div");
      box.className = "tab-checkbox";
      box.innerHTML = checkSvg;

      const title = document.createElement("div");
      title.className = "tab-title";
      title.textContent = tab.title || tab.url;
      title.title = tab.url;

      item.appendChild(box);
      item.appendChild(title);

      const toggle = () => {
        if (selected.has(tab._id)) selected.delete(tab._id);
        else selected.add(tab._id);
        render();
      };
      item.addEventListener("click", toggle);
      item.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          toggle();
        }
      });

      list.appendChild(item);
    });

    card.appendChild(list);
    content.appendChild(card);
  });

  updateFooter();
}

function renderEmpty() {
  content.innerHTML = `
    <div class="state">
      <svg class="state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="6" width="18" height="14" rx="2"/>
        <path d="M3 10h18"/>
        <path d="M9 14h2"/>
      </svg>
      <div class="state-title">${escapeHtml(t("emptyTitle"))}</div>
      <div class="state-desc">
        ${escapeHtml(t("emptyDescLine1"))}<br>
        ${escapeHtml(t("emptyDescLine2"))}<br>
        ${escapeHtml(t("emptyDescLine3"))}<br>
        ${escapeHtml(t("emptyDescLine4"))}
      </div>
    </div>
  `;
  footer.style.display = "none";
}

function renderError(err) {
  content.innerHTML = `
    <div class="state">
      <svg class="state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div class="state-title">${escapeHtml(t("errorTitle"))}</div>
      <div class="state-desc">${escapeHtml(err.message || "")}</div>
    </div>
  `;
  footer.style.display = "none";
}

function updateFooter() {
  footer.style.display = "block";
  const count = selected.size;
  btnLabel.textContent = `${t("openSelectedPrefix")} ${count} ${t("openSelectedSuffix")}`;
  btnOpen.disabled = count === 0;
  btnOpen.classList.remove("success");
}

// ---------- data loading ----------

async function loadDevices() {
  try {
    const response = await chrome.runtime.sendMessage({ action: "getDeviceTabs" });
    const raw = response?.devices || [];

    // Assign stable ids per tab + flatten into our shape.
    let counter = 0;
    devices = raw.map(d => ({
      deviceName: d.deviceName,
      modifiedTime: d.modifiedTime,
      tabs: (d.tabs || []).map(tab => ({
        _id: `t${counter++}`,
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl
      }))
    }));

    // Default: nothing selected. User picks.
    selected.clear();

    render();
  } catch (err) {
    renderError(err);
  }
}

// ---------- open action ----------

async function openSelected() {
  if (selected.size === 0) return;

  const urls = [];
  devices.forEach(d => d.tabs.forEach(tab => {
    if (selected.has(tab._id)) urls.push(tab.url);
  }));

  btnOpen.disabled = true;
  btnLabel.textContent = t("openInProgress");

  try {
    const result = await chrome.runtime.sendMessage({ action: "openTabs", urls });
    if (result?.success) {
      btnOpen.classList.add("success");
      btnLabel.textContent = `${t("openSuccess")} ${result.count}`;
      // Close popup shortly after success so the new window can come forward.
      setTimeout(() => window.close(), 600);
    } else {
      btnLabel.textContent = t("openFail");
      btnOpen.disabled = false;
    }
  } catch (err) {
    btnLabel.textContent = t("openFail");
    btnOpen.disabled = false;
  }
}

// ---------- language toggle ----------

function toggleLang() {
  const next = detectLang() === "zh_TW" ? "en" : "zh_TW";
  langOverride = next;
  chrome.storage?.local?.set({ langOverride: next });
  applyStaticI18n();
  render();
}

// ---------- boot ----------

async function init() {
  // Load language override if set.
  try {
    const stored = await chrome.storage?.local?.get?.("langOverride");
    if (stored && stored.langOverride) langOverride = stored.langOverride;
  } catch (e) { /* ignore */ }

  applyStaticI18n();

  btnOpen.addEventListener("click", openSelected);
  langToggle.addEventListener("click", toggleLang);

  loadDevices();
}

document.addEventListener("DOMContentLoaded", init);

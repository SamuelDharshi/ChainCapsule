// ChainCapsule — Chrome Extension Background Service Worker (MV3)
// Handles click when extension icon is pressed directly (no popup fallback).

const APP_URL = "https://chain-capsule.vercel.app";

// Open app in a focused existing tab, or create a new one
chrome.action.onClicked.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: `${APP_URL}/*` });
  if (tabs.length > 0 && tabs[0].id != null) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    const win = await chrome.windows.get(tabs[0].windowId);
    if (win.id != null) await chrome.windows.update(win.id, { focused: true });
  } else {
    chrome.tabs.create({ url: APP_URL });
  }
});

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "OPEN_APP") {
    chrome.tabs.create({ url: msg.url || APP_URL });
    sendResponse({ ok: true });
  }
  if (msg.type === "OPEN_TAB") {
    chrome.tabs.create({ url: msg.url });
    sendResponse({ ok: true });
  }
});

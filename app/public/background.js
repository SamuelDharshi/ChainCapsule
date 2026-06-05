// ChainCapsule — Chrome Extension Background Service Worker
// When the user clicks the extension icon, open ChainCapsule in a new tab.

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
});

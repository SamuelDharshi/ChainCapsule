// ChainCapsule — Popup Script (MV3 compatible, no inline JS)

const APP_BASE = "https://chain-capsule.vercel.app";
const GITHUB   = "https://github.com/SamuelDharshi/ChainCapsule";

function openTab(url) {
  chrome.runtime.sendMessage({ type: "OPEN_TAB", url });
  window.close();
}

// Main "Open App" button
document.getElementById("btn-open").addEventListener("click", () => {
  openTab(APP_BASE);
});

// Quick nav buttons (data-path attribute)
document.querySelectorAll(".btn-nav[data-path]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const path = btn.getAttribute("data-path");
    openTab(`${APP_BASE}${path}`);
  });
});

// Footer links
document.getElementById("link-github").addEventListener("click", (e) => {
  e.preventDefault();
  openTab(GITHUB);
});

document.getElementById("link-vercel").addEventListener("click", (e) => {
  e.preventDefault();
  openTab(APP_BASE);
});

// Animate status text with live clock
function updateStatus() {
  const el = document.getElementById("status-text");
  if (!el) return;
  const now = new Date();
  const t = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  el.textContent = `LIVE ON SUI TESTNET — ${t}`;
}
updateStatus();
setInterval(updateStatus, 1000);

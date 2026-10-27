// Runs on Band Blender only. Tells the page the extension is installed, and keeps what the
// person chose to send so the Suno tab can pick it up. Nothing else is read or stored.
(() => {
  const VERSION = chrome.runtime.getManifest().version;
  document.documentElement.dataset.bbExtension = VERSION;

  const MAX = { title: 100, style: 1000, exclude: 1000, lyrics: 5000 };
  const clean = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const msg = event.data;
    if (!msg || msg.source !== "band-blender" || msg.type !== "send-to-suno") return;
    const p = msg.payload || {};
    const pending = {
      title: clean(p.title, MAX.title),
      style: clean(p.style, MAX.style),
      exclude: clean(p.exclude, MAX.exclude),
      lyrics: clean(p.lyrics, MAX.lyrics),
      at: Date.now(),
    };
    chrome.storage.local.set({ pending }, () => {
      window.postMessage({ source: "bb-extension", type: "stored" }, location.origin);
    });
  });
})();

// Runs on Band Blender only. Tells the page the extension is installed, and keeps what the
// person chose to send so the Suno (or Gemini / ElevenLabs) tab can pick it up. Nothing else is
// read or stored.
(() => {
  const VERSION = chrome.runtime.getManifest().version;
  document.documentElement.dataset.bbExtension = VERSION;
  document.documentElement.dataset.bbEngines = "suno,gemini,eleven";

  const MAX = { title: 100, style: 1000, exclude: 1000, lyrics: 5000, field: 6000 };
  const clean = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
  const ENGINES = new Set(["gemini", "eleven"]);

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const msg = event.data;
    if (!msg || msg.source !== "band-blender") return;
    const p = msg.payload || {};

    if (msg.type === "send-to-suno") {
      const pending = {
        title: clean(p.title, MAX.title),
        style: clean(p.style, MAX.style),
        exclude: clean(p.exclude, MAX.exclude),
        lyrics: clean(p.lyrics, MAX.lyrics),
        artists: Array.isArray(p.artists) ? p.artists.filter((a) => typeof a === "string").slice(0, 3).map((a) => a.slice(0, 80)) : [],
        at: Date.now(),
      };
      chrome.storage.local.set({ pending }, () => {
        window.postMessage({ source: "bb-extension", type: "stored" }, location.origin);
      });
    }

    if (msg.type === "send-to-engine" && ENGINES.has(p.engine)) {
      const fields = (Array.isArray(p.fields) ? p.fields : [])
        .filter((f) => f && typeof f.label === "string" && typeof f.value === "string" && f.value.trim())
        .slice(0, 6)
        .map((f) => ({ label: f.label.slice(0, 40), value: f.value.slice(0, MAX.field), main: f.main === true }));
      const pendingEngine = { engine: p.engine, fields, at: Date.now() };
      chrome.storage.local.set({ pendingEngine }, () => {
        window.postMessage({ source: "bb-extension", type: "stored" }, location.origin);
      });
    }
  });
})();

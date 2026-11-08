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
      // 1.1: Suno's advanced options, the Instrumental switch, and alternate takes.
      if (p.vocalGender === "male" || p.vocalGender === "female") pending.vocalGender = p.vocalGender;
      for (const k of ["weirdness", "styleInfluence"]) {
        if (typeof p[k] === "number" && Number.isFinite(p[k])) pending[k] = Math.round(Math.min(100, Math.max(0, p[k])));
      }
      if (typeof p.instrumental === "boolean") pending.instrumental = p.instrumental;
      if (Array.isArray(p.takes) && p.takes.length > 1) {
        pending.takes = p.takes
          .filter((t) => t && typeof t.label === "string" && typeof t.style === "string")
          .slice(0, 7)
          .map((t) => ({ label: t.label.slice(0, 30), style: clean(t.style, MAX.style), exclude: clean(t.exclude, MAX.exclude) }));
        pending.activeTake = Number.isInteger(p.activeTake) && p.activeTake >= 0 && p.activeTake < pending.takes.length ? p.activeTake : 0;
      }
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

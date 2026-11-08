// The toolbar button: shows whether a song is waiting and links to Suno, Band Blender and the guide.
// Reads only the extension's own storage ("pending"); no tabs, no history, no new permissions.
(() => {
  const FRESH_MS = 2 * 60 * 60 * 1000;
  document.getElementById("ver").textContent = `v${chrome.runtime.getManifest().version}`;
  document.getElementById("settings").onclick = () => chrome.runtime.openOptionsPage();

  const ago = (ms) => {
    const m = Math.round(ms / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    return `${Math.round(m / 60)} h ago`;
  };

  chrome.storage.local.get("pending", ({ pending }) => {
    if (!pending) return;
    if (!pending.at || Date.now() - pending.at > FRESH_MS) {
      chrome.storage.local.remove("pending"); // older than 2 hours: delete it
      return;
    }
    const box = document.getElementById("status");
    box.textContent = "";
    const b = document.createElement("b");
    b.textContent = `Waiting: ${pending.title || "Untitled song"}`;
    const s = document.createElement("span");
    s.className = "muted";
    const takes = Array.isArray(pending.takes) && pending.takes.length > 1 ? ` · ${pending.takes.length} takes` : "";
    s.textContent = `Sent ${ago(Date.now() - pending.at)}${takes}. Open Suno's Create page and press Fill on the Band Blender panel. It's deleted once filled.`;
    const clear = document.createElement("a");
    clear.textContent = "Clear it";
    clear.href = "#";
    clear.style.cssText = "display:block;margin-top:4px;color:#8f86ff;font-size:12px;text-decoration:none";
    clear.onclick = (e) => {
      e.preventDefault();
      chrome.storage.local.remove("pending", () => location.reload());
    };
    box.append(b, s, clear);
  });
})();

// Runs on suno.com. When Band Blender sent something in the last 2 hours, shows a small panel
// that fills Suno's Create boxes when you press Fill. It never presses Create, never reads your
// songs or account, and sends nothing anywhere.
(() => {
  const FRESH_MS = 2 * 60 * 60 * 1000;
  const FIELDS = [
    { key: "title", label: "Title", match: /\btitle\b|song name/i, avoid: /lyric|style|exclude/i },
    { key: "style", label: "Style", match: /style|genre|describe/i, avoid: /exclude|lyric|title/i },
    { key: "exclude", label: "Exclude styles", match: /exclude/i, avoid: /lyric/i },
    { key: "lyrics", label: "Lyrics", match: /lyric/i, avoid: /style|exclude/i },
  ];

  const describe = (el) =>
    [el.getAttribute("placeholder"), el.getAttribute("aria-label"), el.getAttribute("name"), el.getAttribute("data-testid"), el.id]
      .filter(Boolean)
      .join(" ");

  function findField(f) {
    const els = document.querySelectorAll('textarea, input[type="text"], input:not([type]), [contenteditable="true"]');
    for (const el of els) {
      if (el.closest("#bb-suno-panel-host")) continue;
      const d = describe(el);
      if (d && f.match.test(d) && !f.avoid.test(d) && el.offsetParent !== null) return el;
    }
    return null;
  }

  // React-controlled inputs ignore a plain .value change; use the native setter and fire events.
  function setValue(el, value) {
    el.focus();
    if (el.isContentEditable) {
      el.textContent = value;
    } else {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.blur();
  }

  function panel(pending) {
    if (document.getElementById("bb-suno-panel-host")) return;
    const host = document.createElement("div");
    host.id = "bb-suno-panel-host";
    host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        .p{font:13px/1.4 system-ui,-apple-system,sans-serif;background:#14141c;color:#eee;border:1px solid #3b3b55;border-radius:12px;padding:12px;width:300px;box-shadow:0 10px 30px rgba(0,0,0,.4)}
        .h{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:600}
        .x{background:none;border:0;color:#999;cursor:pointer;font-size:16px}
        .row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;border-top:1px solid #26263a}
        .row span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#bbb;font-size:12px}
        button.b{background:#6d5cff;color:#fff;border:0;border-radius:8px;padding:8px 10px;cursor:pointer;font-weight:600;width:100%;margin-top:8px}
        button.c{background:#26263a;color:#ddd;border:0;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:12px}
        .msg{font-size:12px;color:#a9a9c8;margin-top:6px}
      </style>
      <div class="p">
        <div class="h">Band Blender <button class="x" title="Dismiss">×</button></div>
        <div class="rows"></div>
        <button class="b">Fill Suno's boxes</button>
        <div class="msg">Fills the boxes only. Check them, then press Create yourself.</div>
      </div>`;
    const rows = root.querySelector(".rows");
    for (const f of FIELDS) {
      const v = pending[f.key];
      if (!v) continue;
      const row = document.createElement("div");
      row.className = "row";
      const s = document.createElement("span");
      s.textContent = `${f.label}: ${v.replace(/\s+/g, " ").slice(0, 60)}`;
      const copy = document.createElement("button");
      copy.className = "c";
      copy.textContent = "Copy";
      copy.onclick = () => navigator.clipboard.writeText(v).then(() => (copy.textContent = "Copied"));
      row.append(s, copy);
      rows.append(row);
    }
    const msg = root.querySelector(".msg");
    root.querySelector(".b").onclick = () => {
      const missed = [];
      for (const f of FIELDS) {
        const v = pending[f.key];
        if (!v) continue;
        const el = findField(f);
        if (el) setValue(el, v);
        else missed.push(f.label);
      }
      msg.textContent = missed.length
        ? `Couldn't find: ${missed.join(", ")}. Turn on Custom mode (and open "More options" for Exclude), then press Fill again, or use Copy.`
        : "Filled. Check the boxes, then press Create.";
    };
    root.querySelector(".x").onclick = () => {
      chrome.storage.local.remove("pending");
      host.remove();
    };
    document.body.append(host);
  }

  chrome.storage.local.get("pending", ({ pending }) => {
    if (pending && Date.now() - pending.at < FRESH_MS) panel(pending);
  });
  chrome.storage.onChanged.addListener((changes) => {
    const next = changes.pending && changes.pending.newValue;
    if (next) {
      document.getElementById("bb-suno-panel-host")?.remove();
      panel(next);
    }
  });
})();

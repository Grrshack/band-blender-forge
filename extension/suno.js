// Runs on suno.com. Two things, both on the person's click only:
//  1. When Band Blender sent something in the last 2 hours, a panel fills Suno's Create boxes
//     when you press Fill.
//  2. A small "Band Blender check" badge reads what's in the Style, Exclude and Lyrics boxes as you
//     type (Suno's limits, artist names, contradictions, soft vocals, clean endings) and offers
//     fixes that change a box only when you press them.
// It never presses Create, never reads your songs, library or account, and sends nothing anywhere.
(() => {
  const FRESH_MS = 2 * 60 * 60 * 1000;
  const live = globalThis.__bbLive;
  const FIELDS = [
    { key: "title", label: "Title", match: /\btitle\b|song name/i, avoid: /lyric|style|exclude/i },
    { key: "style", label: "Style", match: /style|genre|describe/i, avoid: /exclude|lyric|title/i },
    { key: "exclude", label: "Exclude styles", match: /exclude/i, avoid: /lyric/i },
    { key: "lyrics", label: "Lyrics", match: /lyric/i, avoid: /style|exclude/i },
  ];
  const byKey = (k) => FIELDS.find((f) => f.key === k);
  let liveEnabled = true;
  let artists = [];
  let open = false;
  let host = null;
  let root = null;
  let lastKey = "";

  const describe = (el) =>
    [el.getAttribute("placeholder"), el.getAttribute("aria-label"), el.getAttribute("name"), el.getAttribute("data-testid"), el.id]
      .filter(Boolean)
      .join(" ");

  function findField(f) {
    const els = document.querySelectorAll('textarea, input[type="text"], input:not([type]), [contenteditable="true"]');
    for (const el of els) {
      if (el.closest("#bb-suno-panel-host") || el.closest("#bb-live-host")) continue;
      const d = describe(el);
      if (d && f.match.test(d) && !f.avoid.test(d) && el.offsetParent !== null) return el;
    }
    return null;
  }

  const readField = (el) => (el ? (el.isContentEditable ? el.innerText : el.value) || "" : "");

  // React-controlled inputs ignore a plain .value change; use the native setter and fire events.
  function setValue(el, value) {
    el.focus();
    if (el.isContentEditable) {
      document.execCommand("selectAll", false);
      if (!document.execCommand("insertText", false, value)) el.textContent = value;
    } else {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.blur();
  }

  const STYLE = `
    .p{font:13px/1.4 system-ui,-apple-system,sans-serif;background:#14141c;color:#eee;border:1px solid #3b3b55;border-radius:12px;padding:12px;width:300px;box-shadow:0 10px 30px rgba(0,0,0,.4)}
    .h{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:600}
    .x{background:none;border:0;color:#999;cursor:pointer;font-size:16px}
    .row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;border-top:1px solid #26263a}
    .row span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#bbb;font-size:12px}
    button.b{background:#6d5cff;color:#fff;border:0;border-radius:8px;padding:8px 10px;cursor:pointer;font-weight:600;width:100%;margin-top:8px}
    button.c{background:#26263a;color:#ddd;border:0;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:12px;flex-shrink:0}
    .msg{font-size:12px;color:#a9a9c8;margin-top:6px}
    .pill{font:600 12px system-ui,-apple-system,sans-serif;border:1px solid #3b3b55;border-radius:999px;padding:6px 12px;cursor:pointer;color:#eee;background:#14141c;box-shadow:0 6px 18px rgba(0,0,0,.35)}
    .ok{color:#5ee08a}.warn{color:#f5c04a}.stop{color:#ff6b6b}
    .counts{display:flex;gap:10px;font-size:11px;color:#a9a9c8;margin-bottom:6px}
    .issue{display:flex;gap:8px;align-items:flex-start;padding:5px 0;border-top:1px solid #26263a;font-size:12px}
    .dot{width:7px;height:7px;border-radius:50%;margin-top:5px;flex-shrink:0}
    .issue .t{flex:1}
  `;

  // ------------------------------------------------------------------ 1. Fill panel

  function panel(pending) {
    if (document.getElementById("bb-suno-panel-host")) return;
    const host = document.createElement("div");
    host.id = "bb-suno-panel-host";
    host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>${STYLE}</style>
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
      runCheck();
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
    if (changes.liveCheck) {
      liveEnabled = changes.liveCheck.newValue !== false;
      lastKey = "";
    }
    if (next && Array.isArray(next.artists)) artists = next.artists.filter((a) => typeof a === "string");
  });

  // ------------------------------------------------------------------ 2. Live check

  if (!live) return; // live.js missing: keep the Fill panel working on its own.

  chrome.storage.local.get(["liveCheck", "pending"], ({ liveCheck, pending }) => {
    liveEnabled = liveCheck !== false;
    if (pending && Array.isArray(pending.artists)) artists = pending.artists.filter((a) => typeof a === "string");
    runCheck();
  });

  function ensureHost() {
    if (host && document.body.contains(host)) return;
    host = document.createElement("div");
    host.id = "bb-live-host";
    // Sits left of the Fill panel's corner so the two never overlap.
    host.style.cssText = "position:fixed;left:16px;bottom:16px;z-index:2147483646;";
    root = host.attachShadow({ mode: "open" });
    document.body.append(host);
  }

  function render(state) {
    const key = JSON.stringify(state) + open;
    if (key === lastKey && host && document.body.contains(host)) return; // nothing changed
    lastKey = key;
    ensureHost();
    const { issues, counts } = state;
    const stops = issues.filter((i) => i.level === "stop").length;
    const tone = stops ? "stop" : issues.length ? "warn" : "ok";
    const label = stops ? `${stops} to fix` : issues.length ? `${issues.length} to check` : "Looks good";
    if (!open) {
      root.innerHTML = `<style>${STYLE}</style><button class="pill" title="Band Blender check"><span class="${tone}">●</span> Band Blender: ${label}</button>`;
      root.querySelector(".pill").onclick = () => {
        open = true;
        lastKey = "";
        runCheck();
      };
      return;
    }
    root.innerHTML = `<style>${STYLE}</style>
      <div class="p">
        <div class="h"><span><span class="${tone}">●</span> Band Blender check</span><span><button class="x off" title="Turn off on Suno">⏻</button><button class="x min" title="Minimize">–</button></span></div>
        <div class="counts"></div>
        <div class="list"></div>
        <div class="msg">Reads only what's in the boxes. Fixes change a box only when you press them.</div>
      </div>`;
    const c = root.querySelector(".counts");
    for (const [name, n, max] of counts) {
      const s = document.createElement("span");
      s.className = n > max ? "stop" : n > max * 0.9 ? "warn" : "";
      s.textContent = `${name} ${n.toLocaleString()}/${max.toLocaleString()}`;
      c.append(s);
    }
    const list = root.querySelector(".list");
    if (!issues.length) {
      const d = document.createElement("div");
      d.className = "issue";
      d.textContent = "No problems found. Suno is random, so judge takes by listening.";
      list.append(d);
    }
    for (const i of issues) {
      const row = document.createElement("div");
      row.className = "issue";
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = i.level === "stop" ? "#ff6b6b" : "#f5c04a";
      const t = document.createElement("span");
      t.className = "t";
      t.textContent = i.message;
      row.append(dot, t);
      if (i.fix) {
        const b = document.createElement("button");
        b.className = "c";
        b.textContent = "Fix";
        b.onclick = () => applyFix(i.fix);
        row.append(b);
      }
      list.append(row);
    }
    root.querySelector(".min").onclick = () => {
      open = false;
      lastKey = "";
      runCheck();
    };
    root.querySelector(".off").onclick = () => {
      chrome.storage.local.set({ liveCheck: false });
      liveEnabled = false;
      host.remove();
    };
  }

  function applyFix(kind) {
    if (kind === "placeVocal") {
      const el = findField(byKey("style"));
      if (el) setValue(el, live.placeVocal(readField(el)));
    } else if (kind === "removeNames") {
      const el = findField(byKey("style"));
      if (el) setValue(el, live.removeNames(readField(el), artists));
    } else if (kind === "cleanEnding") {
      const el = findField(byKey("lyrics"));
      if (el) setValue(el, live.cleanEnding(readField(el)));
    }
    runCheck();
  }

  let timer = 0;
  function runCheck() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!liveEnabled) {
        host?.remove();
        return;
      }
      const styleEl = findField(byKey("style"));
      const lyricsEl = findField(byKey("lyrics"));
      if (!styleEl && !lyricsEl) {
        host?.remove(); // not on a page with Create boxes
        return;
      }
      const style = readField(styleEl);
      const exclude = readField(findField(byKey("exclude")));
      const lyrics = readField(lyricsEl);
      const issues = live.check({ style, exclude, lyrics, artists });
      const L = live.limits;
      const counts = [
        ["Style", style.length, L.style],
        ["Exclude", exclude.length, L.exclude],
        ["Lyrics", lyrics.length, L.lyrics],
      ];
      render({ issues, counts });
    }, 300);
  }

  // Re-check as the person types, and when Suno swaps its page around.
  document.addEventListener("input", (e) => {
    if (e.target && e.target.closest && (e.target.closest("#bb-live-host") || e.target.closest("#bb-suno-panel-host"))) return;
    runCheck();
  }, true);
  setInterval(runCheck, 2500);
})();

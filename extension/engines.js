// Runs on gemini.google.com and elevenlabs.io. When Band Blender sent a song for that app in the
// last 2 hours, a small panel offers to put the prompt into the app's main prompt box when you
// press Fill, with a Copy button for each part. It never presses send or generate, reads nothing
// else on the page, and sends nothing anywhere.
(() => {
  const FRESH_MS = 2 * 60 * 60 * 1000;
  const HERE = location.hostname.endsWith("elevenlabs.io") ? "eleven" : location.hostname === "gemini.google.com" ? "gemini" : null;
  if (!HERE) return;
  const APP = HERE === "eleven" ? "ElevenLabs" : "Gemini";

  // The prompt box: the biggest visible text box or rich editor on the page.
  function promptBox() {
    const els = [...document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]')].filter(
      (el) => !el.closest("#bb-engine-host") && el.offsetParent !== null,
    );
    let best = null;
    let area = 0;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width * r.height > area) {
        best = el;
        area = r.width * r.height;
      }
    }
    return best;
  }

  function setValue(el, value) {
    el.focus();
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      // Rich editors keep their own model; typing via insertText keeps it in step.
      document.execCommand("selectAll", false);
      if (!document.execCommand("insertText", false, value)) {
        el.textContent = value;
        el.dispatchEvent(new InputEvent("input", { bubbles: true }));
      }
    }
  }

  function panel(pending) {
    if (document.getElementById("bb-engine-host")) return;
    const host = document.createElement("div");
    host.id = "bb-engine-host";
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
        button.c{background:#26263a;color:#ddd;border:0;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:12px;flex-shrink:0}
        .msg{font-size:12px;color:#a9a9c8;margin-top:6px}
      </style>
      <div class="p">
        <div class="h">Band Blender → ${APP} <button class="x" title="Dismiss">×</button></div>
        <div class="rows"></div>
        <button class="b">Fill the prompt box</button>
        <div class="msg">Puts the prompt in the box. Check it, then send it yourself.</div>
      </div>`;
    const rows = root.querySelector(".rows");
    for (const f of pending.fields) {
      const row = document.createElement("div");
      row.className = "row";
      const s = document.createElement("span");
      s.textContent = `${f.label}: ${f.value.replace(/\s+/g, " ").slice(0, 60)}`;
      const copy = document.createElement("button");
      copy.className = "c";
      copy.textContent = "Copy";
      copy.onclick = () => navigator.clipboard.writeText(f.value).then(() => (copy.textContent = "Copied"));
      row.append(s, copy);
      rows.append(row);
    }
    const main = pending.fields.find((f) => f.main) || pending.fields[0];
    const msg = root.querySelector(".msg");
    root.querySelector(".b").onclick = () => {
      const el = promptBox();
      if (!el || !main) {
        msg.textContent = `Couldn't find ${APP}'s prompt box on this page. Open the music page, or use Copy.`;
        return;
      }
      setValue(el, main.value);
      msg.textContent = "Filled. Check it, then send it yourself.";
    };
    root.querySelector(".x").onclick = () => {
      chrome.storage.local.remove("pendingEngine");
      host.remove();
    };
    document.body.append(host);
  }

  const show = (p) => {
    if (p && p.engine === HERE && Array.isArray(p.fields) && p.fields.length && Date.now() - p.at < FRESH_MS) panel(p);
  };
  chrome.storage.local.get("pendingEngine", ({ pendingEngine }) => show(pendingEngine));
  chrome.storage.onChanged.addListener((changes) => {
    const next = changes.pendingEngine && changes.pendingEngine.newValue;
    if (next) {
      document.getElementById("bb-engine-host")?.remove();
      show(next);
    }
  });
})();

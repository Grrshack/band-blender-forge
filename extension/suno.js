// Runs on suno.com. Two things, both on the person's click only:
//  1. When Band Blender sent something in the last 2 hours, a panel fills Suno's Create page
//     when you press Fill: the boxes you tick, the take you pick, and (1.1+) Instrumental, vocal
//     gender and the Weirdness / Style Influence sliders. Undo puts things back.
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

  const describe = (el) => {
    const by = el.getAttribute("aria-labelledby");
    const labelled = by ? by.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ") : "";
    const inner = el.isContentEditable ? el.querySelector("[data-placeholder]")?.getAttribute("data-placeholder") : "";
    return [el.getAttribute("placeholder"), el.getAttribute("aria-label"), el.getAttribute("aria-placeholder"), el.getAttribute("data-placeholder"), inner, labelled, el.getAttribute("name"), el.getAttribute("data-testid"), el.id]
      .filter(Boolean)
      .join(" ");
  };

  // Plain boxes and rich editors (Suno rebuilt its lyrics editor in July 2026).
  const EDITABLE = 'textarea, input[type="text"], input:not([type]), [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"], [role="textbox"]';
  const LABELS = { title: /^(song )?title( \(optional\))?$/i, style: /^(styles?|style of music)$/i, exclude: /^exclude( styles)?$/i, lyrics: /^lyrics$/i };
  const foundBy = {};

  function editables() {
    const out = [];
    for (const el of document.querySelectorAll(EDITABLE)) {
      if (el.closest("#bb-suno-panel-host") || el.closest("#bb-live-host") || el.offsetParent === null) continue;
      if (out.some((o) => o.contains(el))) continue; // inside an editor already listed
      out.push(el);
    }
    return out;
  }

  function findField(f, guess = false) {
    const els = editables();
    for (const el of els) {
      const d = describe(el);
      if (d && f.match.test(d) && !f.avoid.test(d)) return ((foundBy[f.key] = "attribute"), el);
    }
    // A label next to the box ("Lyrics") when the box itself has no placeholder or name.
    const label = typeof findLabel === "function" && LABELS[f.key] ? findLabel(LABELS[f.key]) : null;
    if (label) {
      const roots = near(label, EDITABLE).map((el) => els.find((o) => o === el || o.contains(el))).filter(Boolean);
      if (roots[0]) return ((foundBy[f.key] = "label"), roots[0]);
    }
    // Lyrics only, on Fill: the tallest multi-line box that isn't the title, style or exclude box.
    if (guess && f.key === "lyrics") {
      const taken = FIELDS.filter((x) => x.key !== "lyrics").map((x) => findField(x)).filter(Boolean);
      const tall = els
        .filter((el) => !taken.includes(el) && el.tagName !== "INPUT" && el.getBoundingClientRect().height >= 60)
        .sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
      if (tall) return ((foundBy[f.key] = "size"), tall);
    }
    return null;
  }

  const readField = (el) => (el ? (el.isContentEditable ? el.innerText : el.value) || "" : "");

  // React-controlled inputs ignore a plain .value change; use the native setter and fire events.
  const squash = (t) => (t || "").replace(/\s+/g, " ").trim();
  /** True when the box now holds the text (rich editors may reformat line breaks). */
  const holds = (el, value) => {
    const want = squash(value);
    const got = squash(readField(el));
    return want === "" ? got === "" : got.includes(want.slice(0, 40)) && got.length >= want.length * 0.8;
  };

  function setValue(el, value) {
    el.focus();
    if (el.isContentEditable) {
      document.execCommand("selectAll", false);
      if (!document.execCommand("insertText", false, value)) el.textContent = value;
      if (!holds(el, value)) {
        // Some editors only take text the way a paste arrives.
        document.execCommand("selectAll", false);
        const dt = new DataTransfer();
        dt.setData("text/plain", value);
        el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
      }
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

  const VERSION = chrome.runtime.getManifest().version;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ours = (el) => el.closest("#bb-suno-panel-host") || el.closest("#bb-live-host");
  const visible = (el) => el && el.offsetParent !== null;
  const textOf = (el) => (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  const labelOf = (el) =>
    [el.getAttribute("aria-label"), el.getAttribute("title"), el.getAttribute("data-testid"), el.getAttribute("name"), el.id, textOf(el)]
      .filter(Boolean)
      .join(" ");

  /** The smallest element whose own text matches, e.g. the "Weirdness" label. */
  function findLabel(re) {
    const all = document.querySelectorAll("label, span, div, p, h3, h4, button");
    let best = null;
    for (const el of all) {
      if (ours(el) || !visible(el)) continue;
      const t = textOf(el);
      if (t.length > 60 || !re.test(t)) continue;
      if (!best || t.length < textOf(best).length) best = el;
    }
    return best;
  }

  /** Looks for a control near a label: up to 4 levels of its containers. */
  function near(labelEl, selector) {
    let box = labelEl;
    for (let i = 0; i < 5 && box; i++, box = box.parentElement) {
      const found = [...box.querySelectorAll(selector)].filter((el) => !ours(el) && visible(el));
      if (found.length) return found;
    }
    return [];
  }

  /** Suno keeps Exclude, vocal gender and the sliders under "More options": open it if it's closed. */
  async function openMoreOptions() {
    const btn = [...document.querySelectorAll("button, [role=button], summary")].find(
      (el) => !ours(el) && visible(el) && /more options|advanced options|advanced/i.test(labelOf(el)) && labelOf(el).length < 40,
    );
    if (!btn) return false;
    if (btn.getAttribute("aria-expanded") === "true") return true;
    btn.click();
    await sleep(350);
    return true;
  }

  // Toggles: read "on" from whatever the control exposes.
  function isOn(el) {
    if (!el) return null;
    if ("checked" in el && el.type === "checkbox") return el.checked;
    for (const a of ["aria-checked", "aria-pressed", "aria-selected"]) {
      const v = el.getAttribute(a);
      if (v === "true") return true;
      if (v === "false") return false;
    }
    const st = el.getAttribute("data-state");
    if (st) return /^(on|checked|active|open)$/.test(st);
    return null;
  }

  function findInstrumental() {
    const direct = [...document.querySelectorAll("[role=switch], input[type=checkbox], button")].find(
      (el) => !ours(el) && visible(el) && /instrumental/i.test(labelOf(el)) && labelOf(el).length < 40,
    );
    if (direct) return direct;
    const label = findLabel(/^instrumental$/i);
    return label ? near(label, "[role=switch], input[type=checkbox], button")[0] || null : null;
  }

  function findGender(which) {
    const re = which === "male" ? /^male$/i : /^female$/i;
    const label = findLabel(/^vocal gender$|^vocals?$|^gender$/i);
    const pool = label ? near(label, "button, [role=radio], [role=tab], label") : [...document.querySelectorAll("button, [role=radio]")];
    return pool.find((el) => !ours(el) && visible(el) && re.test(textOf(el))) || null;
  }

  function findSlider(re) {
    const label = findLabel(re);
    if (!label) return null;
    return near(label, 'input[type=range], [role=slider]')[0] || null;
  }

  const sliderValue = (el) => (el.tagName === "INPUT" ? Number(el.value) : Number(el.getAttribute("aria-valuenow")));

  /** Sets a slider to a percentage: native range inputs directly, custom sliders with the keyboard. */
  async function setSlider(el, pct) {
    if (el.tagName === "INPUT") {
      const min = Number(el.min || 0);
      const max = Number(el.max || 100);
      const v = String(Math.round(min + ((max - min) * pct) / 100));
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return Math.abs(sliderValue(el) - Number(v)) <= 1;
    }
    const min = Number(el.getAttribute("aria-valuemin") || 0);
    const max = Number(el.getAttribute("aria-valuemax") || 100);
    const target = min + ((max - min) * pct) / 100;
    const key = (k) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, code: k, bubbles: true }));
    el.focus();
    key("Home");
    await sleep(30);
    for (let i = 0; i < 220 && sliderValue(el) < target - 0.5; i++) {
      const before = sliderValue(el);
      key("ArrowRight");
      if (i % 10 === 9) await sleep(0);
      if (sliderValue(el) === before && i > 3) break; // not responding to keys
    }
    el.blur();
    return Math.abs(sliderValue(el) - target) <= Math.max(2, (max - min) / 50);
  }

  /** What the panel would fill, for the chosen take. */
  function itemsFor(pending, takeIndex) {
    const take = Array.isArray(pending.takes) && pending.takes[takeIndex];
    const items = [];
    const text = (key, label, value) => value && items.push({ kind: "text", key, label, value });
    text("title", "Title", pending.title);
    text("style", "Style", take ? take.style : pending.style);
    text("exclude", "Exclude styles", take ? take.exclude : pending.exclude);
    text("lyrics", "Lyrics", pending.lyrics);
    if (typeof pending.instrumental === "boolean") items.push({ kind: "instrumental", key: "instrumental", label: "Instrumental", value: pending.instrumental });
    if (pending.vocalGender) items.push({ kind: "gender", key: "gender", label: "Vocal gender", value: pending.vocalGender });
    if (typeof pending.weirdness === "number") items.push({ kind: "slider", key: "weirdness", label: "Weirdness", value: pending.weirdness, re: /^weirdness/i });
    if (typeof pending.styleInfluence === "number") items.push({ kind: "slider", key: "styleInfluence", label: "Style Influence", value: pending.styleInfluence, re: /^style influence/i });
    return items;
  }

  const shown = (it) =>
    it.kind === "text"
      ? it.value.replace(/\s+/g, " ").slice(0, 52)
      : it.kind === "instrumental"
        ? (it.value ? "on" : "off")
        : it.kind === "gender"
          ? (it.value === "male" ? "Male" : "Female")
          : `${it.value}%`;

  let lastReport = { found: {}, fill: "" };

  function panel(pending) {
    if (document.getElementById("bb-suno-panel-host")) return;
    const panelHost = document.createElement("div");
    panelHost.id = "bb-suno-panel-host";
    panelHost.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;";
    const proot = panelHost.attachShadow({ mode: "open" });
    proot.innerHTML = `
      <style>${STYLE}
        .take{display:flex;gap:6px;align-items:center;margin-bottom:6px;font-size:12px;color:#bbb}
        .take select{flex:1;background:#26263a;color:#eee;border:1px solid #3b3b55;border-radius:6px;padding:3px}
        .row label{display:flex;gap:6px;align-items:center;min-width:0;cursor:pointer}
        .row input{accent-color:#6d5cff}
        .btns{display:flex;gap:6px}.btns .b{flex:1}
        button.u{background:#26263a;color:#ddd;border:0;border-radius:8px;padding:8px 10px;cursor:pointer;margin-top:8px}
        button.u:disabled{opacity:.4;cursor:default}
        .foot{display:flex;justify-content:space-between;margin-top:8px;font-size:11px}
        .foot a{color:#8f86ff;cursor:pointer;text-decoration:none}
      </style>
      <div class="p">
        <div class="h">Band Blender <button class="x" title="Dismiss">×</button></div>
        <div class="takes"></div>
        <div class="rows"></div>
        <div class="btns"><button class="b">Fill Suno</button><button class="u" disabled title="Put Suno's boxes back as they were">Undo</button></div>
        <div class="msg">Untick anything you want to keep as it is in Suno. Then check, and press Create yourself.</div>
        <div class="foot"><a class="report">Report a problem</a><span style="color:#666">v${VERSION}</span></div>
      </div>`;
    const rowsEl = proot.querySelector(".rows");
    const msg = proot.querySelector(".msg");
    const undoBtn = proot.querySelector(".u");
    let takeIndex = Number.isInteger(pending.activeTake) ? pending.activeTake : 0;
    const unticked = new Set();
    let items = [];
    let undo = null;

    if (Array.isArray(pending.takes) && pending.takes.length > 1) {
      const wrap = proot.querySelector(".takes");
      wrap.className = "take";
      const lab = document.createElement("span");
      lab.textContent = "Take";
      const sel = document.createElement("select");
      sel.setAttribute("aria-label", "Which take to fill");
      pending.takes.forEach((t, i) => {
        const o = document.createElement("option");
        o.value = String(i);
        o.textContent = t.label;
        if (i === takeIndex) o.selected = true;
        sel.append(o);
      });
      sel.onchange = () => {
        takeIndex = Number(sel.value);
        draw();
        msg.textContent = "Switched take. Press Fill to put its style and exclude list in (untick Lyrics to keep yours).";
      };
      wrap.append(lab, sel);
    }

    function draw() {
      items = itemsFor(pending, takeIndex);
      rowsEl.textContent = "";
      for (const it of items) {
        const row = document.createElement("div");
        row.className = "row";
        const lab = document.createElement("label");
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = !unticked.has(it.key);
        box.onchange = () => (box.checked ? unticked.delete(it.key) : unticked.add(it.key));
        const s = document.createElement("span");
        s.textContent = `${it.label}: ${shown(it)}`;
        lab.append(box, s);
        row.append(lab);
        if (it.kind === "text") {
          const copy = document.createElement("button");
          copy.className = "c";
          copy.textContent = "Copy";
          copy.onclick = () => navigator.clipboard.writeText(it.value).then(() => (copy.textContent = "Copied"));
          row.append(copy);
        }
        rowsEl.append(row);
      }
    }
    draw();

    proot.querySelector(".b").onclick = async () => {
      const chosen = items.filter((it) => !unticked.has(it.key));
      const missed = [];
      const check = [];
      const snap = [];
      const found = {};
      // Only press "More options" when its controls aren't showing, so an open section isn't closed.
      const hidden = !findField(byKey("exclude")) && !findLabel(/^weirdness|^vocal gender$/i);
      if (hidden && chosen.some((it) => it.kind !== "text" || it.key === "exclude")) found.moreOptions = await openMoreOptions();
      for (const it of chosen) {
        if (it.kind === "text") {
          const el = findField(byKey(it.key), true);
          found[it.key] = el ? `${foundBy[it.key]}, ${el.isContentEditable ? "editor" : el.tagName.toLowerCase()}` : false;
          if (!el) {
            missed.push(it.label);
            continue;
          }
          snap.push({ kind: "text", el, value: readField(el) });
          setValue(el, it.value);
          await sleep(60);
          if (!holds(el, it.value)) check.push(`${it.label} (press its Copy button and paste it in)`);
        } else if (it.kind === "instrumental") {
          const el = findInstrumental();
          found.instrumental = el ? el.getAttribute("role") || el.tagName.toLowerCase() : false;
          if (!el) {
            missed.push("Instrumental switch");
            continue;
          }
          const was = isOn(el);
          if (was !== it.value) {
            el.click();
            await sleep(150);
            snap.push({ kind: "toggle", el });
          }
          if (isOn(el) !== it.value) check.push(`Instrumental (${it.value ? "on" : "off"})`);
        } else if (it.kind === "gender") {
          const el = findGender(it.value);
          found.gender = el ? el.getAttribute("role") || el.tagName.toLowerCase() : false;
          if (!el) {
            missed.push("Vocal gender");
            continue;
          }
          if (isOn(el) !== true) {
            el.click();
            await sleep(120);
          }
          if (isOn(el) === false) check.push(`Vocal gender (${shown(it)})`);
          if (isOn(el) === null) check.push(`that ${shown(it)} is selected`);
        } else if (it.kind === "slider") {
          const el = findSlider(it.re);
          found[it.key] = el ? (el.tagName === "INPUT" ? "range" : "slider") : false;
          if (!el) {
            missed.push(it.label);
            continue;
          }
          const before = sliderValue(el);
          const ok = await setSlider(el, it.value);
          snap.push({ kind: "slider", el, value: before, pct: null });
          if (!ok) check.push(`${it.label} (set it to ${it.value}%)`);
        }
      }
      undo = snap;
      undoBtn.disabled = !snap.length;
      // Filled: delete the stored song. This panel keeps it in memory, so you can still switch takes and Fill again.
      chrome.storage.local.remove("pending");
      const parts = [];
      if (missed.length) parts.push(`Couldn't find: ${missed.join(", ")}. Turn on Custom mode and open "More options", then press Fill again, or set them yourself.`);
      if (check.length) parts.push(`Please check ${check.join(", ")}.`);
      msg.textContent = parts.length ? parts.join(" ") : "Filled. Check the boxes, then press Create.";
      lastReport = { found, fill: msg.textContent };
      runCheck();
    };

    undoBtn.onclick = async () => {
      if (!undo) return;
      for (const u of undo.slice().reverse()) {
        if (u.kind === "text") setValue(u.el, u.value);
        else if (u.kind === "toggle") u.el.click();
        else if (u.kind === "slider" && Number.isFinite(u.value)) {
          const min = u.el.tagName === "INPUT" ? Number(u.el.min || 0) : Number(u.el.getAttribute("aria-valuemin") || 0);
          const max = u.el.tagName === "INPUT" ? Number(u.el.max || 100) : Number(u.el.getAttribute("aria-valuemax") || 100);
          await setSlider(u.el, ((u.value - min) / (max - min || 1)) * 100);
        }
      }
      undo = null;
      undoBtn.disabled = true;
      msg.textContent = "Put back as it was before Fill (vocal gender stays as chosen; change it in Suno if needed).";
      runCheck();
    };

    proot.querySelector(".report").onclick = () => {
      const f = lastReport.found;
      const mark = (k, label) => `${label} ${f[k] === undefined ? "–" : f[k] ? `found${typeof f[k] === "string" ? ` (${f[k]})` : ""}` : "NOT found"}`;
      const text = [
        `Band Blender extension ${VERSION} on ${location.hostname}${location.pathname}`,
        [
          mark("title", "Title"),
          mark("style", "Style"),
          mark("exclude", "Exclude"),
          mark("lyrics", "Lyrics"),
          mark("moreOptions", "More options"),
          mark("instrumental", "Instrumental"),
          mark("gender", "Vocal gender"),
          mark("weirdness", "Weirdness"),
          mark("styleInfluence", "Style Influence"),
        ].join(" · "),
        `Last fill: ${lastReport.fill || "not pressed yet"}`,
        `Boxes on the page: ${editables()
          .slice(0, 8)
          .map((el) => {
            const r = el.getBoundingClientRect();
            const kind = el.isContentEditable ? "editor" : el.tagName.toLowerCase();
            const name = (describe(el) || "no name").replace(/\s+/g, " ").slice(0, 50);
            return `${kind}[${name}] ${Math.round(r.width)}x${Math.round(r.height)}`;
          })
          .join(" · ") || "none"}`,
        `Custom mode: ${findLabel(/^lyrics$/i) || findField(byKey("lyrics")) ? "looks on" : "lyrics box not seen (Simple mode?)"}`,
        `Browser: ${navigator.userAgent.match(/(Edg|Chrome|Brave|Firefox)\/[\d.]+/g)?.join(" ") || "unknown"}`,
      ].join("\n");
      navigator.clipboard.writeText(text).then(() => {
        msg.textContent = "Copied a short report (which of Suno's controls were found, no song text). Paste it into Send feedback on Band Blender.";
      });
    };

    proot.querySelector(".x").onclick = () => {
      chrome.storage.local.remove("pending");
      panelHost.remove();
    };
    document.body.append(panelHost);
  }

  chrome.storage.local.get("pending", ({ pending }) => {
    if (!pending) return;
    if (Date.now() - pending.at < FRESH_MS) panel(pending);
    else chrome.storage.local.remove("pending"); // older than 2 hours: delete it
  });
  // Lets Send to Suno switch to this tab instead of opening another (only the page path is shared).
  chrome.runtime.sendMessage({ type: "suno-tab" }).catch(() => {});
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg && msg.type === "where") reply({ path: location.pathname });
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

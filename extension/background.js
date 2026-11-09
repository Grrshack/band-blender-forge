// Send to Suno: switch to a Suno Create tab that's already open instead of opening another.
// No permissions needed: Suno tabs say hello (suno.js), we keep their tab ids for this browser
// session only, and ask a tab where it is before switching to it. No URLs or history are read.
const KEY = "sunoTabs";
const getIds = async () => (await chrome.storage.session.get(KEY))[KEY] || [];
const setIds = (ids) => chrome.storage.session.set({ [KEY]: ids.slice(-10) });

async function openSuno(from) {
  const ids = await getIds();
  const alive = [];
  let target = null;
  for (const id of ids.slice().reverse()) {
    try {
      const where = await chrome.tabs.sendMessage(id, { type: "where" });
      if (!where) continue;
      alive.unshift(id);
      if (!target && /^\/create/.test(where.path)) target = id;
    } catch {
      // closed, or no longer on Suno
    }
  }
  await setIds(alive);
  if (target !== null) {
    const tab = await chrome.tabs.update(target, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
    return { how: "focused" };
  }
  const near = from && typeof from.index === "number" ? { index: from.index + 1, openerTabId: from.id } : {};
  await chrome.tabs.create({ url: "https://suno.com/create", ...near });
  return { how: "opened" };
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg && msg.type === "suno-tab" && sender.tab && sender.tab.id != null) {
    const id = sender.tab.id;
    getIds().then((ids) => setIds([...ids.filter((i) => i !== id), id]));
    return false;
  }
  if (msg && msg.type === "open-suno") {
    openSuno(sender.tab).then(reply, () => reply({ how: "failed" }));
    return true; // answer comes later
  }
  return false;
});

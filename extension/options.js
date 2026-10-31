const box = document.getElementById("live");
const saved = document.getElementById("saved");
chrome.storage.local.get("liveCheck", ({ liveCheck }) => {
  box.checked = liveCheck !== false;
});
box.addEventListener("change", () => {
  chrome.storage.local.set({ liveCheck: box.checked }, () => {
    saved.style.display = "block";
    setTimeout(() => (saved.style.display = "none"), 1500);
  });
});

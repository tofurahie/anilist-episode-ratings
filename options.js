const DEFAULTS = { episodes: true, badges: true };

chrome.storage.sync.get(DEFAULTS).then(s => {
  for (const k in DEFAULTS) {
    const el = document.getElementById(k);
    el.checked = s[k];
    el.onchange = () => chrome.storage.sync.set({ [k]: el.checked });
  }
});

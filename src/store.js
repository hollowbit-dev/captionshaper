// Settings and recent videos, saved as JSON in the app's data folder.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const defaults = { theme: 'dark', model: 'best', language: 'auto', style: 'clean', outDir: '' };
let state = { settings: { ...defaults }, recent: [] };
const file = () => path.join(app.getPath('userData'), 'captionshaper.json');

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(file(), 'utf8'));
    state = { settings: { ...defaults, ...(raw.settings || {}) }, recent: Array.isArray(raw.recent) ? raw.recent : [] };
  } catch (e) { /* first run */ }
}
let timer = null;
function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try { fs.mkdirSync(path.dirname(file()), { recursive: true }); fs.writeFileSync(file(), JSON.stringify(state)); } catch (e) { console.error('Captionshaper: could not save settings', e); }
  }, 150);
}
module.exports = {
  load,
  get settings() { return state.settings; },
  get recent() { return state.recent.filter((r) => fs.existsSync(r.file)); },
  setSettings(patch) { Object.assign(state.settings, patch); save(); },
  addRecent(item) { state.recent = [item, ...state.recent.filter((r) => r.file !== item.file)].slice(0, 12); save(); },
};

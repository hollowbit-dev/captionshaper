// Update check, shared by Hollowbit apps.
// Once a day, if the user hasn't turned it off, ask GitHub for the latest release's version number.
// Nothing about the user or their files is sent. A newer version shows a notice with a link to download it.
const { net } = require('electron');

const newer = (a, b) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};

// opts: { app, repo, getSettings(), setSettings(patch), send(state) }
function setupUpdates(opts) {
  const { app, repo, getSettings, setSettings, send } = opts;
  let found = null;

  async function check({ manual = false } = {}) {
    if (!app.isPackaged && !process.env.HOLLOWBIT_TEST_UPDATES) return { state: 'latest', version: app.getVersion() };
    try {
      const url = process.env.HOLLOWBIT_TEST_UPDATES || `https://api.github.com/repos/${repo}/releases/latest`;
      const res = await net.fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) throw new Error(String(res.status));
      const rel = await res.json();
      const v = String(rel.tag_name || '').replace(/^v/, '');
      if (v && newer(v, app.getVersion())) {
        found = { state: 'available', version: v, url: rel.html_url || `https://github.com/${repo}/releases/latest` };
        // Don't nag about a version the user already dismissed, unless they asked.
        if (manual || getSettings().skipVersion !== v) send(found);
        return found;
      }
      return { state: 'latest', version: app.getVersion() };
    } catch {
      return { state: 'error' };
    }
  }

  function schedule() {
    const run = () => {
      const s = getSettings();
      if (s.autoUpdate === false) return;
      if (Date.now() - (s.lastUpdateCheck || 0) < 20 * 3600 * 1000 && !process.env.HOLLOWBIT_TEST_UPDATES) return;
      setSettings({ lastUpdateCheck: Date.now() });
      check();
    };
    setTimeout(run, 6000);
    setInterval(run, 3600 * 1000);
  }

  return { check, schedule, current: () => found };
}

module.exports = { setupUpdates, newer };

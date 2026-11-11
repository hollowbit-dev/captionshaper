// For every caption preset: draws the live-preview frame (canvas) and the burned-in frame (libass)
// at the same moment, side by side, so they can be compared by eye.
// Run: npx electron scripts/compare-styles.cjs [outDir]
const { app, BrowserWindow } = require('electron');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const R = require('../src/core/render.js');
const Fonts = require('../src/core/fonts.js');

const root = path.join(__dirname, '..');
const ffmpeg = path.join(root, 'vendor/ffmpeg', `${process.platform}-${process.arch}`, 'ffmpeg');
const out = path.resolve(process.argv[2] || path.join(root, 'test/out/styles'));
fs.mkdirSync(out, { recursive: true });
setTimeout(() => app.exit(1), 120000);
const W = 1080; const H = 1920;
const cap = { start: 1, end: 3.2, words: [
  { text: 'This', start: 1, end: 1.3 }, { text: 'is', start: 1.3, end: 1.5 }, { text: 'how', start: 1.5, end: 1.8 }, { text: 'captions', start: 1.8, end: 2.3 }, { text: 'should', start: 2.3, end: 2.6 }, { text: 'look.', start: 2.6, end: 3.0 },
], lineBreaks: [3] };
const T = 2.0; // inside "captions" (active word 3)

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } });
  await win.loadURL('data:text/html,<body></body>');
  const src = ['captions.js', 'fonts.js', 'render.js'].map((f) => fs.readFileSync(path.join(root, 'src/core', f), 'utf8')).join('\n;\n');
  const fontData = Fonts.FONTS.map((f) => ({ id: f.id, b64: fs.readFileSync(path.join(root, 'assets/fonts', f.file)).toString('base64') }));
  await win.webContents.executeJavaScript(`${src}; window.__fonts = ${JSON.stringify(fontData)}; 0`);
  const results = await win.webContents.executeJavaScript(`(async () => {
    for (const f of window.__fonts) { const ff = new FontFace(CaptionFonts.css(f.id), 'url(data:font/ttf;base64,' + f.b64 + ')'); await ff.load(); document.fonts.add(ff); }
    const mc = document.createElement('canvas').getContext('2d'); const cache = new Map();
    const measure = (text, font, em) => { const k = font + '|' + text; if (!cache.has(k)) { mc.font = '100px "' + CaptionFonts.css(font) + '"'; cache.set(k, mc.measureText(text).width); } return cache.get(k) * em / 100; };
    const cap = ${JSON.stringify(cap)}; const res = [];
    for (const p of CaptionRender.PRESETS) {
      const style = CaptionRender.fromPreset(p.id);
      const words = cap.words.slice(0, style.maxWords || 6);
      const c = { ...cap, words, lineBreaks: style.maxLines === 1 || words.length < 4 ? [] : [3], end: style.maxWords ? words[words.length - 1].end + 0.2 : cap.end };
      const t = Math.min(${T}, c.end - 0.05);
      const cv = document.createElement('canvas'); cv.width = ${W}; cv.height = ${H};
      const g = cv.getContext('2d'); g.fillStyle = '#3a4a5a'; g.fillRect(0, 0, ${W}, ${H});
      CaptionRender.drawFrame(g, c, style, t, { W: ${W}, H: ${H}, measure });
      res.push({ id: p.id, t, png: cv.toDataURL('image/png').split(',')[1], ass: CaptionRender.toASS([c], style, { width: ${W}, height: ${H}, measure }) });
    }
    return res;
  })()`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-cmp-'));
  fs.mkdirSync(path.join(dir, 'fonts'));
  for (const f of Fonts.FONTS) fs.copyFileSync(path.join(root, 'assets/fonts', f.file), path.join(dir, 'fonts', f.file));
  for (const r of results) {
    fs.writeFileSync(path.join(dir, 'p.png'), Buffer.from(r.png, 'base64'));
    fs.writeFileSync(path.join(dir, 's.ass'), r.ass);
    execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `color=0x3a4a5a:s=${W}x${H}:d=4:r=50`, '-vf', 'ass=s.ass:fontsdir=fonts', '-ss', String(r.t), '-frames:v', '1', 'b.png'], { cwd: dir });
    execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', 'p.png', '-i', 'b.png', '-filter_complex', '[0]crop=1080:900:0:510,scale=432:-2[a];[1]crop=1080:900:0:510,scale=432:-2[b];[a][b]hstack', path.join(out, `${r.id}.png`)], { cwd: dir });
    console.log('wrote', r.id);
  }
  fs.rmSync(dir, { recursive: true, force: true });
  app.exit(0);
});

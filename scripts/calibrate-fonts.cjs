// Measures how libass (the burn-in renderer) sizes each caption font compared with the browser,
// then prints the `scale` value for src/core/fonts.js and checks that text widths agree.
// Run: npx electron scripts/calibrate-fonts.cjs
const { app, BrowserWindow, nativeImage } = require('electron');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { FONTS } = require('../src/core/fonts.js');

const root = path.join(__dirname, '..');
const ffmpeg = path.join(root, 'vendor/ffmpeg', `${process.platform}-${process.arch}`, 'ffmpeg');
const FS = 200; // ASS font size used for the test
const SAMPLE = 'HELLO WORLD';
setTimeout(() => app.exit(1), 60000);

function measurePng(file, rows) {
  const img = nativeImage.createFromPath(file);
  const { width, height } = img.getSize();
  const bmp = img.toBitmap(); // BGRA
  return rows.map(([y0, y1]) => {
    let minX = 1e9; let maxX = -1; let minY = 1e9; let maxY = -1;
    for (let y = y0; y < Math.min(y1, height); y++) {
      for (let x = 0; x < width; x++) {
        if (bmp[(y * width + x) * 4 + 1] > 128) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
    }
    return { w: maxX - minX + 1, h: maxY - minY + 1 };
  });
}

app.whenReady().then(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-cal-'));
  const rowH = 320; const W = 2400; const H = rowH * FONTS.length * 2;
  const events = [];
  FONTS.forEach((f, i) => {
    events.push(`Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,{\\an7\\pos(40,${i * 2 * rowH + 40})\\fn${f.ass}\\fs${FS}}H`);
    events.push(`Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,{\\an7\\pos(40,${(i * 2 + 1) * rowH + 40})\\fn${f.ass}\\fs${FS}}${SAMPLE}`);
  });
  fs.writeFileSync(path.join(dir, 'c.ass'), `[Script Info]\nScriptType: v4.00+\nPlayResX: ${W}\nPlayResY: ${H}\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Geist SemiBold,${FS},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${events.join('\n')}\n`);
  fs.mkdirSync(path.join(dir, 'fonts'));
  for (const f of FONTS) fs.copyFileSync(path.join(root, 'assets/fonts', f.file), path.join(dir, 'fonts', f.file));
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `color=black:s=${W}x${H}:d=0.1`, '-vf', 'ass=c.ass:fontsdir=fonts', '-frames:v', '1', 'out.png'], { cwd: dir });
  const rows = FONTS.flatMap((_, i) => [[i * 2 * rowH, (i * 2 + 1) * rowH], [(i * 2 + 1) * rowH, (i * 2 + 2) * rowH]]);
  const m = measurePng(path.join(dir, 'out.png'), rows);

  const win = new BrowserWindow({ show: false });
  await win.loadURL('data:text/html,<canvas id=c></canvas>');
  const canvasM = await win.webContents.executeJavaScript(`(async () => {
    const out = [];
    for (const f of ${JSON.stringify(FONTS)}) {
      const ff = new FontFace('cal-' + f.id, 'url(data:font/ttf;base64,' + f.b64 + ')');
      await ff.load(); document.fonts.add(ff);
      const g = document.getElementById('c').getContext('2d');
      g.font = '100px "cal-' + f.id + '"';
      const h = g.measureText('H'); const s = g.measureText(${JSON.stringify(SAMPLE)});
      out.push({ cap: h.actualBoundingBoxAscent + h.actualBoundingBoxDescent, ink: s.actualBoundingBoxLeft + s.actualBoundingBoxRight });
    }
    return out;
  })()`.replace(JSON.stringify(FONTS), JSON.stringify(FONTS.map((f) => ({ ...f, b64: fs.readFileSync(path.join(root, 'assets/fonts', f.file)).toString('base64') })))));
  FONTS.forEach((f, i) => {
    const capAss = m[i * 2].h; const widthAss = m[i * 2 + 1].w;
    const em = capAss / (canvasM[i].cap / 100); // ASS em in pixels
    const scale = FS / em;
    const widthErr = (widthAss / (canvasM[i].ink * em / 100) - 1) * 100;
    console.log(`${f.id.padEnd(22)} scale ${scale.toFixed(3)} (was ${f.scale})   width difference ${widthErr.toFixed(1)}%`);
  });
  fs.rmSync(dir, { recursive: true, force: true });
  app.exit(0);
});

// Renders a built page to PNG for checking: npx electron scripts/site-shot.cjs <html> <out.png> [width]
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const [file, out, w = '1440'] = process.argv.slice(2);
setTimeout(() => app.exit(1), 40000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: +w, height: 900, show: false, enableLargerThanScreen: true, paintWhenInitiallyHidden: true });
  await win.loadFile(file);
  await new Promise((r) => setTimeout(r, 900));
  await win.webContents.executeJavaScript('document.querySelectorAll(".rise").forEach(e=>e.classList.add("in")); 0');
  const hgt = await win.webContents.executeJavaScript('document.documentElement.scrollHeight');
  win.setContentSize(+w, Math.min(hgt, 9000));
  await new Promise((r) => setTimeout(r, 1200));
  fs.writeFileSync(out, (await win.webContents.capturePage()).toPNG());
  app.exit(0);
});

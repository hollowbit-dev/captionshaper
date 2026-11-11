// Captionshaper — main process. Window, local file serving, speech recognition and exports.
// Video and audio never leave this computer. The only network request is the one-time
// speech model download, from Hugging Face, which the user starts.
const { app, BrowserWindow, ipcMain, dialog, shell, protocol, nativeTheme, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { Readable } = require('stream');
const { transcribe, peaksFor } = require('./core/transcribe');
const Captions = require('./core/captions');
const store = require('./store');

const isMac = process.platform === 'darwin';
// Tests run with their own data folder.
if (process.env.CAPTIONSHAPER_USERDATA) app.setPath('userData', process.env.CAPTIONSHAPER_USERDATA);
if (process.env.CAPTIONSHAPER_SCALE) app.commandLine.appendSwitch('force-device-scale-factor', process.env.CAPTIONSHAPER_SCALE); // sharp website screenshots
const appRoot = path.join(__dirname, '..');

protocol.registerSchemesAsPrivileged([{
  scheme: 'captionshaper',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
}]);

// ---------- Bundled tools ----------
const plat = `${process.platform}-${process.arch}`;
const bins = app.isPackaged ? {
  ffmpeg: path.join(process.resourcesPath, 'ffmpeg', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
  whisperDir: path.join(process.resourcesPath, 'whisper'),
  vadModel: path.join(process.resourcesPath, 'models', 'ggml-silero-v5.1.2.bin'),
} : {
  ffmpeg: path.join(appRoot, 'vendor', 'ffmpeg', plat, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
  whisperDir: path.join(appRoot, 'vendor', 'whisper', plat),
  vadModel: path.join(appRoot, 'vendor', 'models', 'ggml-silero-v5.1.2.bin'),
};
const fontsDir = path.join(appRoot, 'assets', 'fonts');

// ---------- Speech models ----------
const MODELS = [
  { id: 'best', file: 'ggml-large-v3-turbo-q5_0.bin', size: 574041195, sha256: '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2' },
  { id: 'max', file: 'ggml-large-v3-q5_0.bin', size: 1081140203, sha256: 'd75795ecff3f83b5faa89d1900604ad8c780abd5739fae406de19f23ecd98ad1' },
  { id: 'fast', file: 'ggml-base-q5_1.bin', size: 59707625, sha256: '422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898' },
];
const modelsDir = () => process.env.CAPTIONSHAPER_MODELS || path.join(app.getPath('userData'), 'models');
const modelPath = (m) => path.join(modelsDir(), m.file);
function modelState() {
  return MODELS.map((m) => {
    let installed = false;
    try { installed = fs.statSync(modelPath(m)).size === m.size; } catch (e) { /* missing */ }
    return { id: m.id, size: m.size, installed, downloading: downloads.has(m.id) };
  });
}
const downloads = new Map();
async function downloadModel(id) {
  const m = MODELS.find((x) => x.id === id);
  if (!m) throw new Error('Unknown model');
  if (downloads.has(id)) return;
  const ctrl = new AbortController();
  downloads.set(id, ctrl);
  fs.mkdirSync(modelsDir(), { recursive: true });
  const part = `${modelPath(m)}.part`;
  const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${m.file}`;
  let lastSent = 0;
  const sizeOf = () => { try { return fs.statSync(part).size; } catch (e) { return 0; } };
  try {
    // Big downloads drop now and then: resume from where it stopped, a few times.
    for (let attempt = 0; ; attempt++) {
      let have = sizeOf();
      if (have > m.size) { fs.rmSync(part, { force: true }); have = 0; }
      if (have === m.size) break;
      try {
        const res = await net.fetch(url, { signal: ctrl.signal, headers: have ? { Range: `bytes=${have}-` } : {} });
        if (have && res.status !== 206) { fs.rmSync(part, { force: true }); have = 0; }
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        const out = fs.createWriteStream(part, { flags: have ? 'a' : 'w' });
        const reader = res.body.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            have += value.length;
            if (!out.write(value)) await new Promise((r) => out.once('drain', r));
            const now = Date.now();
            if (now - lastSent > 150) { lastSent = now; send('model-progress', { id, got: have, total: m.size }); }
          }
        } finally { await new Promise((r) => out.end(r)); }
      } catch (e) {
        if (ctrl.signal.aborted || attempt >= 6) throw e;
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    send('model-progress', { id, got: m.size, total: m.size, verifying: true });
    const hash = crypto.createHash('sha256');
    await new Promise((r, j) => fs.createReadStream(part).on('data', (d) => hash.update(d)).on('end', r).on('error', j));
    if (hash.digest('hex') !== m.sha256) { fs.rmSync(part, { force: true }); throw new Error('The download was damaged. Please try again.'); }
    fs.renameSync(part, modelPath(m));
    send('model-progress', { id, got: m.size, total: m.size, done: true });
  } catch (e) {
    // A cancelled download keeps its .part file, so the next try resumes.
    send('model-progress', { id, error: ctrl.signal.aborted ? 'cancelled' : e.message });
  } finally {
    downloads.delete(id);
  }
}

// ---------- Local files ----------
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.m4v': 'video/mp4',
  '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.aac': 'audio/aac',
};
function serveFile(file, request) {
  let stat;
  try { stat = fs.statSync(file); } catch (e) { return new Response('Not found', { status: 404 }); }
  if (!stat.isFile()) return new Response('Not found', { status: 404 });
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = request.headers.get('range');
  const base = { 'Content-Type': type, 'Accept-Ranges': 'bytes' };
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
    if (!m || start >= stat.size) return new Response('', { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } });
    end = Math.min(end, stat.size - 1);
    return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })), {
      status: 206, headers: { ...base, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': String(end - start + 1) },
    });
  }
  return new Response(Readable.toWeb(fs.createReadStream(file)), { status: 200, headers: { ...base, 'Content-Length': String(stat.size) } });
}
// Only files the user opened (and the app's own files) can be served.
const allowed = new Set();
function registerProtocol() {
  protocol.handle('captionshaper', (request) => {
    const url = new URL(request.url);
    if (url.host === 'app') {
      const p = path.normalize(path.join(appRoot, decodeURIComponent(url.pathname)));
      if (!p.startsWith(appRoot)) return new Response('Forbidden', { status: 403 });
      return serveFile(p, request);
    }
    if (url.host === 'file') {
      const p = decodeURIComponent(url.pathname.slice(1));
      if (!allowed.has(p)) return new Response('Forbidden', { status: 403 });
      return serveFile(p, request);
    }
    return new Response('Not found', { status: 404 });
  });
}

// ---------- ffmpeg ----------
function ffmpeg(args, { duration = 0, onProgress = () => {}, signal, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(bins.ffmpeg, ['-hide_banner', '-y', '-nostats', '-progress', 'pipe:1', ...args], { windowsHide: true, cwd });
    let tail = ''; let buf = '';
    p.stdout.on('data', (d) => {
      buf += d; const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        const m = /^out_time_(?:us|ms)=(\d+)/.exec(line);
        if (m && duration > 0) onProgress(Math.min(99.5, (parseInt(m[1], 10) / 1e6 / duration) * 100));
      }
    });
    p.stderr.on('data', (d) => { tail = (tail + d).slice(-4000); });
    const abort = () => { try { p.kill('SIGKILL'); } catch (e) { /* gone */ } };
    if (signal) { if (signal.aborted) abort(); signal.addEventListener('abort', abort, { once: true }); }
    p.on('error', reject);
    p.on('close', (code) => {
      if (signal && signal.aborted) return reject(Object.assign(new Error('Cancelled'), { cancelled: true }));
      if (code === 0) { onProgress(100); resolve(); } else reject(new Error(tail.trim().split('\n').slice(-3).join('\n') || `ffmpeg exited with ${code}`));
    });
  });
}
function probe(file) {
  return new Promise((resolve) => {
    const p = spawn(bins.ffmpeg, ['-hide_banner', '-i', file], { windowsHide: true });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', () => resolve({ duration: 0, hasVideo: false, hasAudio: false }));
    p.on('close', () => {
      const d = /Duration: (\d+):(\d+):(\d+\.?\d*)/.exec(err);
      const duration = d ? (+d[1]) * 3600 + (+d[2]) * 60 + parseFloat(d[3]) : 0;
      const videoLine = (err.match(/Stream #.*Video: .*/g) || []).find((l) => !/attached pic/.test(l));
      const audioLine = (err.match(/Stream #.*Audio: .*/g) || [])[0];
      let width = 0; let height = 0; let fps = 30;
      if (videoLine) {
        const s = /, (\d{2,5})x(\d{2,5})/.exec(videoLine); if (s) { width = +s[1]; height = +s[2]; }
        const f = /([\d.]+) fps/.exec(videoLine); if (f) fps = parseFloat(f[1]);
        if (/rotation of -?90|rotate\s*:\s*-?90|rotate\s*:\s*270/.test(err)) [width, height] = [height, width];
      }
      const vcodec = videoLine ? (/Video: (\w+)/.exec(videoLine) || [])[1] : '';
      resolve({ duration, hasVideo: !!videoLine, hasAudio: !!audioLine, width, height, fps, vcodec });
    });
  });
}

// ---------- Projects (captions saved per video, so reopening keeps your edits) ----------
const projectsDir = () => path.join(app.getPath('userData'), 'projects');
function projectId(file) {
  const st = fs.statSync(file);
  return crypto.createHash('sha1').update(`${file}|${st.size}|${Math.round(st.mtimeMs)}`).digest('hex').slice(0, 16);
}

// ---------- Window ----------
let win;
function send(ch, data) { if (win && !win.isDestroyed()) win.webContents.send(ch, data); }
function createWindow() {
  nativeTheme.themeSource = store.settings.theme || 'dark';
  win = new BrowserWindow({
    width: 1320, height: 840, minWidth: 980, minHeight: 640, title: 'Captionshaper',
    backgroundColor: '#141415',
    titleBarStyle: 'hidden',
    ...(isMac ? { trafficLightPosition: { x: 16, y: 16 } } : { titleBarOverlay: { color: '#00000000', symbolColor: '#ececef', height: 44 } }),
    icon: path.join(appRoot, 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  const sendFs = () => send('fullscreen', win.isFullScreen());
  win.on('enter-full-screen', sendFs); win.on('leave-full-screen', sendFs);
  win.loadURL('captionshaper://app/src/renderer/index.html');
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('captionshaper://')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
}

// Files opened before the window is ready (Open With, drag onto the Dock icon).
let pendingOpen = [];
app.on('open-file', (e, file) => { e.preventDefault(); if (win && rendererReady) send('open-files', [file]); else pendingOpen.push(file); });
let rendererReady = false;

const jobs = new Map();

function registerIpc() {
  ipcMain.handle('renderer-ready', () => { rendererReady = true; const f = pendingOpen; pendingOpen = []; return f; });
  ipcMain.handle('get-state', () => ({ settings: store.settings, recent: store.recent, version: app.getVersion(), models: modelState(), platform: process.platform, available: fs.existsSync(path.join(bins.whisperDir, process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli')) }));
  ipcMain.handle('set-settings', (_e, patch) => { store.setSettings(patch); if (patch.theme) nativeTheme.themeSource = patch.theme; return store.settings; });
  ipcMain.handle('pick-video', async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Video or audio', extensions: ['mp4', 'mov', 'm4v', 'mkv', 'webm', 'avi', 'mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus'] }] });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('open-media', async (_e, file) => {
    if (!file || !fs.existsSync(file)) throw new Error('That file is no longer there.');
    allowed.add(file);
    const info = await probe(file);
    if (!info.hasAudio) throw new Error('This file has no sound to caption.');
    const id = projectId(file);
    let project = null;
    try { project = JSON.parse(fs.readFileSync(path.join(projectsDir(), `${id}.json`), 'utf8')); } catch (e) { /* new */ }
    store.addRecent({ file, name: path.basename(file), duration: info.duration, at: Date.now(), id });
    return { file, name: path.basename(file), id, info, project };
  });
  ipcMain.handle('save-project', (_e, { id, project }) => {
    fs.mkdirSync(projectsDir(), { recursive: true });
    fs.writeFileSync(path.join(projectsDir(), `${id}.json`), JSON.stringify(project));
    return true;
  });
  ipcMain.handle('models', () => modelState());
  ipcMain.handle('download-model', (_e, id) => { downloadModel(id); return true; });
  ipcMain.handle('cancel-download', (_e, id) => { const c = downloads.get(id); if (c) c.abort(); return true; });
  ipcMain.handle('delete-model', (_e, id) => { const m = MODELS.find((x) => x.id === id); if (m) fs.rmSync(modelPath(m), { force: true }); return modelState(); });

  ipcMain.handle('transcribe', async (_e, { jobId, file, modelId, language, translate }) => {
    const m = MODELS.find((x) => x.id === modelId) || MODELS[0];
    if (!fs.existsSync(modelPath(m))) throw new Error('Download the speech model first.');
    const ctrl = new AbortController(); jobs.set(jobId, ctrl);
    try {
      return await transcribe(bins, {
        input: file, model: modelPath(m), language, translate, signal: ctrl.signal,
        onProgress: (p) => send('job-progress', { jobId, ...p }),
      });
    } finally { jobs.delete(jobId); }
  });
  ipcMain.handle('peaks', (_e, file) => peaksFor(bins, file));
  ipcMain.handle('cancel-job', (_e, jobId) => { const c = jobs.get(jobId); if (c) c.abort(); return true; });

  ipcMain.handle('export-text', async (_e, { file, format, content }) => {
    const base = path.basename(file, path.extname(file));
    const r = await dialog.showSaveDialog(win, { defaultPath: path.join(store.settings.outDir || path.dirname(file), `${base}.${format}`), filters: [{ name: format.toUpperCase(), extensions: [format] }] });
    if (r.canceled) return null;
    fs.writeFileSync(r.filePath, format === 'srt' || format === 'txt' ? '﻿' + content : content, 'utf8');
    return r.filePath;
  });

  ipcMain.handle('burn', async (_e, { jobId, file, ass, info, quality }) => {
    const base = path.basename(file, path.extname(file));
    const r = await dialog.showSaveDialog(win, { defaultPath: path.join(store.settings.outDir || path.dirname(file), `${base} (captions).mp4`), filters: [{ name: 'MP4 video', extensions: ['mp4'] }] });
    if (r.canceled) return null;
    // Work in a temp folder so the subtitle and font paths need no escaping in the filter.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'captionshaper-burn-'));
    fs.writeFileSync(path.join(dir, 'subs.ass'), ass, 'utf8');
    fs.mkdirSync(path.join(dir, 'fonts'));
    for (const f of fs.readdirSync(fontsDir)) if (f.endsWith('.ttf')) fs.copyFileSync(path.join(fontsDir, f), path.join(dir, 'fonts', f));
    const ctrl = new AbortController(); jobs.set(jobId, ctrl);
    const crf = quality === 'small' ? '24' : '18';
    try {
      await ffmpeg(['-i', file, '-map', '0:v:0', '-map', '0:a?', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,ass=subs.ass:fontsdir=fonts',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', crf, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', r.filePath],
      { duration: info.duration, cwd: dir, signal: ctrl.signal, onProgress: (pct) => send('job-progress', { jobId, stage: 'burn', pct }) });
      return r.filePath;
    } catch (e) {
      try { fs.rmSync(r.filePath, { force: true }); } catch (x) { /* nothing */ }
      throw e;
    } finally { jobs.delete(jobId); fs.rmSync(dir, { recursive: true, force: true }); }
  });
  ipcMain.handle('show-in-folder', (_e, p) => shell.showItemInFolder(p));
  ipcMain.handle('open-external', (_e, u) => { if (/^https:\/\//.test(u)) shell.openExternal(u); });
}

app.whenReady().then(() => {
  store.load();
  registerProtocol();
  registerIpc();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (!isMac) app.quit(); });
if (!isMac) {
  // Windows passes "Open with" files as arguments.
  const f = process.argv.slice(1).find((a) => /\.(mp4|mov|m4v|mkv|webm)$/i.test(a));
  if (f) pendingOpen.push(f);
}
module.exports = { Captions };

// End-to-end check of the real app: open a clip, transcribe, edit, export SRT, burn a video.
// Needs the speech model in ~/Library/Application Support/Captionshaper/models (or CAPTIONSHAPER_MODELS).
import { _electron as electron } from 'playwright';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { execFileSync } from 'child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'test', 'out', 'e2e'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const shots = path.join(root, 'test', 'shots'); fs.mkdirSync(shots, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-e2e-'));
const clip = path.join(root, 'test', 'media', process.env.CLIP || 'demo-vertical.mp4');
const models = process.env.CAPTIONSHAPER_MODELS || path.join(os.homedir(), 'Library/Application Support/Captionshaper/models');
let pass = 0; let fail = 0;
const check = (name, ok, extra = '') => { if (ok) pass++; else fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };

const app = await electron.launch({ args: [root], env: { ...process.env, CAPTIONSHAPER_USERDATA: userData, CAPTIONSHAPER_MODELS: models } });
const win = await app.firstWindow();
await win.setViewportSize({ width: 1320, height: 840 });
await win.waitForSelector('.dropzone');
await win.screenshot({ path: path.join(shots, 'home.png') });
check('home shows drop zone', true);

// Save dialogs answer themselves.
await app.evaluate(({ dialog }, dir) => {
  dialog.showSaveDialog = async (_w, o) => ({ canceled: false, filePath: `${dir}/${o.defaultPath.split(/[\\/]/).pop()}` });
}, out);

const t0 = Date.now();
await win.evaluate((f) => window.__cs.openFile(f), clip);
await win.waitForSelector('.wk-w', { timeout: 60000 }).catch(() => {});
await win.waitForTimeout(1500);
await win.screenshot({ path: path.join(shots, 'working.png') });
check('words appear live while transcribing', await win.locator('.wk-w').count() > 5);
await win.waitForSelector('.editor .row', { timeout: 180000 });
check('transcribed', true, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
const n = await win.locator('.row').count();
check('captions listed', n >= 6, `${n} captions`);
const first = await win.locator('.row .tx').first().innerText();
check('first caption text', /okay, so today/i.test(first), JSON.stringify(first));

// Seek into the first caption: the preview shows it.
await win.evaluate(() => { window.__cs.current.video.currentTime = 2.5; });
await win.waitForTimeout(400);
const inked = await win.evaluate(() => { const c = document.querySelector('#overlay canvas'); if (!c) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++; return n; });
check('preview draws the caption', inked > 500, `${inked} pixels`);
await win.waitForTimeout(300);
await win.screenshot({ path: path.join(shots, 'editor.png') });
check('waveform drawn', await win.evaluate(() => { const c = document.querySelector('#tl-wave'); return !!c && c.width > 0 && !!window.__cs.current.project.peaks; }));
await win.evaluate(() => { window.__cs.current.video.currentTime = 3.6; });
await win.waitForTimeout(300);
check('spoken word lit in list', await win.locator('.tx .wd.sp').count() === 1);

// Edit caption 1.
const tx = win.locator('.row .tx').first();
await tx.click();
await win.keyboard.press('Meta+A');
await win.keyboard.type('Okay, so today I want to show');
await win.keyboard.press('Escape');
await win.waitForTimeout(200);
const edited = await win.evaluate(() => window.__cs.current.project.captions[0].words.map((w) => w.text).join(' '));
check('edit applied', edited === 'Okay, so today I want to show', edited);
await win.keyboard.press('Meta+Z');
const undone = await win.evaluate(() => window.__cs.current.project.captions[0].words.length);
check('undo restores', undone > 7, `${undone} words`);

// Find & replace.
await win.fill('#find', 'TikTok');
await win.fill('#repl', 'Reels');
await win.click('#repl-all');
const hasReels = await win.evaluate(() => window.__cs.current.project.captions.some((c) => c.words.some((w) => /Reels/.test(w.text))));
check('replace all', hasReels);

// Style: Pop preset re-splits into short captions.
await win.click('#tabs button[data-t="style"]');
await win.click('.preset[data-k="bold"]');
const nPop = await win.evaluate(() => window.__cs.current.project.captions.length);
check('pop preset re-splits', nPop > n, `${n} -> ${nPop}`);
await win.evaluate(() => { window.__cs.current.video.currentTime = 9.0; });
await win.waitForTimeout(400);
await win.screenshot({ path: path.join(shots, 'style-pop.png') });
await win.locator('#player').screenshot({ path: path.join(shots, 'preview-frame.png') });

// SRT export.
await win.evaluate(() => window.__cs.current && document.querySelector('#export').click());
await win.click('.menu button:has-text("Subtitles")');
await win.waitForTimeout(500);
const srtFile = path.join(out, path.basename(clip).replace(/\.mp4$/, '.srt'));
const srt = fs.existsSync(srtFile) ? fs.readFileSync(srtFile, 'utf8') : '';
check('srt exported', /^﻿?1\n00:00:01,\d{3} --> /.test(srt), srt.slice(0, 60).replace(/\n/g, '⏎'));

// Burn in.
await win.click('#export');
await win.click('.menu button:has-text("Video with captions")');
const mp4 = path.join(out, path.basename(clip).replace(/\.mp4$/, ' (captions).mp4'));
for (let i = 0; i < 240 && !(await win.evaluate(() => !document.querySelector('.burn-card') && document.querySelector('.toast')?.innerText.includes('Saved'))); i++) await win.waitForTimeout(500);
check('mp4 burned', fs.existsSync(mp4) && fs.statSync(mp4).size > 100000);
if (fs.existsSync(mp4)) {
  const ffmpeg = path.join(root, 'vendor/ffmpeg/darwin-arm64/ffmpeg');
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '9.0', '-i', mp4, '-frames:v', '1', '-vf', 'scale=540:-2', path.join(shots, 'burned-frame.png')]);
  check('frame grabbed', fs.existsSync(path.join(shots, 'burned-frame.png')));
}

// Reopen: edits persisted.
await win.evaluate(() => window.__cs.renderHome());
await win.waitForSelector('.recent-row');
await win.click('.recent-row');
await win.waitForSelector('.editor .row', { timeout: 10000 });
const persisted = await win.evaluate(() => window.__cs.current.project.style.preset);
check('project reopens with edits', persisted === 'bold', persisted);

await app.close();
fs.rmSync(userData, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

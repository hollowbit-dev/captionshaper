// Social preview images (1200x630), one per website language: headline, tagline and the app screenshot.
import { execFileSync } from 'child_process';
import fs from 'fs'; import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ff = process.env.FFMPEG || '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg';
const fontFor = (lang, w) => (lang === 'zh' ? '/System/Library/Fonts/Hiragino Sans GB.ttc' : path.join(root, `assets/fonts/Geist-${w}.ttf`));
// Splits a headline into lines of about `max` characters (CJK has no spaces, so it splits by length).
function lines(text, max, cjk) {
  if (cjk) { const out = []; for (let i = 0; i < text.length; i += max) out.push(text.slice(i, i + max)); return out; }
  const out = ['']; for (const w of text.split(' ')) { if ((out[out.length - 1] + ' ' + w).trim().length > max) out.push(w); else out[out.length - 1] = (out[out.length - 1] + ' ' + w).trim(); } return out;
}
const q = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\u2019").replace(/:/g, '\\:').replace(/%/g, '\\%');
for (const lang of ['en', 'es', 'fr', 'de', 'ru', 'zh']) {
  const t = JSON.parse(fs.readFileSync(path.join(root, 'site/locales', `${lang}.json`), 'utf8'));
  const cjk = lang === 'zh';
  let hl = lines(t.hero.h1, cjk ? 4 : 15, cjk);
  // Never leave punctuation alone on a line.
  hl = hl.reduce((a, l) => (/^[\p{P}\s]+$/u.test(l) && a.length ? (a[a.length - 1] += l, a) : [...a, l]), []).slice(0, 4);
  const size = hl.length > 3 ? 50 : 58;
  const tag = t.footer.tagline;
  const draws = [
    `drawtext=fontfile='${fontFor('en', 'Bold')}':text='Captionshaper':fontcolor=white:fontsize=34:x=164:y=92`,
    ...hl.map((l, i) => `drawtext=fontfile='${fontFor(lang, 'Black')}':text='${q(l)}':fontcolor=${i === 1 ? '0xc6ff3d' : 'white'}:fontsize=${size}:x=64:y=${200 + i * (size + 12)}`),
    `drawtext=fontfile='${fontFor(lang, 'Medium')}':text='${q(tag)}':fontcolor=0xa9b0a4:fontsize=21:x=64:y=${200 + hl.length * (size + 12) + 30}`,
  ].join(',');
  execFileSync(ff, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'gradients=s=1200x630:c0=0x1c2a0c:c1=0x08090a:x0=900:y0=0:x1=300:y1=630:d=1',
    '-i', path.join(root, 'site/assets/img/app-editor.png'), '-i', path.join(root, 'assets/icon.png'),
    '-filter_complex', `[1]crop=1400:1100:0:66,scale=560:-2[s];[2]scale=84:84[i];[0][s]overlay=660:150[a];[a][i]overlay=64:70,${draws}`,
    '-frames:v', '1', path.join(root, 'site/assets/og', `og-${lang}.png`)]);
  console.log('og', lang);
}

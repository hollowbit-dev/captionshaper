// Accuracy check on clips with a known script and known timing.
// Each phrase is spoken by macOS `say`, then placed at a known time over silence, a music-like
// bed or noise. We measure:
//   WER          word error rate of the full transcript (lower is better)
//   start error  how far each phrase's first caption starts from the moment the voice starts
//   leaks        words that appear while nobody speaks (music, noise, silence)
// Usage: node test/accuracy.mjs [model file name]   (default: ggml-large-v3-turbo-q5_0.bin)
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs'; import os from 'os'; import path from 'path';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { transcribe } = require(path.join(root, 'src/core/transcribe.js'));
const C = require(path.join(root, 'src/core/captions.js'));
const bins = { ffmpeg: path.join(root, 'vendor/ffmpeg/darwin-arm64/ffmpeg'), whisperDir: path.join(root, 'vendor/whisper/darwin-arm64'), vadModel: path.join(root, 'vendor/models/ggml-silero-v5.1.2.bin') };
const modelName = process.argv[2] || 'ggml-large-v3-turbo-q5_0.bin';
const model = path.join(os.homedir(), 'Library/Application Support/Captionshaper/models', modelName);
const work = path.join(root, 'test', 'out', 'accuracy'); fs.mkdirSync(work, { recursive: true });

const CLIPS = [
  { name: 'vlog-en', lang: 'en', bed: 'music', phrases: [
    ['Samantha', 'Hey everyone, welcome back to the channel.'],
    ['Samantha', 'Today we are testing three cheap microphones under twenty dollars.'],
    ['Samantha', "The first one sounds surprisingly good, but the cable feels flimsy."],
    ['Samantha', 'Let me know in the comments which one you would buy.'],
  ] },
  { name: 'interview-en', lang: 'en', bed: 'noise', phrases: [
    ['Daniel', 'So when did you first start making furniture?'],
    ['Karen', 'About twelve years ago, in my grandfather\'s garage.'],
    ['Daniel', 'And what was the hardest part of turning it into a business?'],
    ['Karen', 'Honestly, pricing. I charged far too little for the first two years.'],
  ] },
  { name: 'fast-en', lang: 'en', bed: 'silence', rate: 230, phrases: [
    ['Alex', 'Quick tip: if your videos look blurry on Instagram, export at 1080 by 1920.'],
    ['Alex', 'Keep the bitrate high, around twelve megabits, and upload over Wi-Fi.'],
  ] },
  { name: 'tutorial-es', lang: 'es', bed: 'music', phrases: [
    ['Mónica', 'Hola a todos, hoy vamos a preparar una tortilla de patatas.'],
    ['Mónica', 'Primero, cortamos las patatas en rodajas finas.'],
    ['Mónica', 'Después las freímos a fuego lento durante veinte minutos.'],
  ] },
  { name: 'tutorial-de', lang: 'de', bed: 'silence', phrases: [
    ['Anna', 'Willkommen zurück. Heute zeige ich euch meinen Schreibtisch.'],
    ['Anna', 'Der Monitor ist neu, und die Tastatur habe ich selbst gebaut.'],
  ] },
];

const ff = (args) => execFileSync(bins.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args]);

function voiceOnset(wav) {
  // First sample louder than -40 dBFS.
  const b = fs.readFileSync(wav); const data = b.indexOf('data') + 8;
  for (let i = data; i + 1 < b.length; i += 2) if (Math.abs(b.readInt16LE(i)) > 330) return (i - data) / 2 / 16000;
  return 0;
}
function durationOf(wav) { const b = fs.readFileSync(wav); return (b.length - (b.indexOf('data') + 8)) / 2 / 16000; }

const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/twelve/g, '12').replace(/twenty/g, '20').replace(/three/g, '3').replace(/two/g, '2').replace(/veinte/g, '20')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
function wer(ref, hyp) {
  const r = norm(ref); const h = norm(hyp);
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 1; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++) for (let j = 1; j <= h.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
  }
  return { errors: d[r.length][h.length], words: r.length };
}

function buildClip(clip) {
  const dir = path.join(work, clip.name); fs.mkdirSync(dir, { recursive: true });
  const parts = []; let t = 2.5; // starts after 2.5 s of bed only
  clip.phrases.forEach(([voice, text], i) => {
    const aiff = path.join(dir, `p${i}.aiff`); const wav = path.join(dir, `p${i}.wav`);
    execFileSync('say', ['-v', voice, ...(clip.rate ? ['-r', String(clip.rate)] : []), '-o', aiff, text]);
    ff(['-i', aiff, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
    const onset = voiceOnset(wav); const dur = durationOf(wav);
    parts.push({ wav, at: t, onset: t + onset, end: t + dur, text });
    t += dur + (i % 2 ? 2.2 : 0.9); // alternate short and long pauses
  });
  const total = t + 2.5;
  const bed = clip.bed === 'music'
    ? `sine=f=196:d=${total},volume=0.05[m1];sine=f=247:d=${total},volume=0.04[m2];sine=f=294:d=${total},volume=0.04[m3];[m1][m2][m3]amix=3,apulsator=hz=2[bed]`
    : clip.bed === 'noise' ? `anoisesrc=d=${total}:c=pink:a=0.02[bed]` : `anullsrc=r=16000:cl=mono,atrim=0:${total}[bed]`;
  const inputs = parts.flatMap((p) => ['-i', p.wav]);
  const delays = parts.map((p, i) => `[${i}]adelay=${Math.round(p.at * 1000)}[d${i}]`).join(';');
  const mix = `${delays};${bed};[bed]${parts.map((_, i) => `[d${i}]`).join('')}amix=inputs=${parts.length + 1}:normalize=0[a]`;
  const audio = path.join(dir, 'mix.wav');
  ff([...inputs, '-filter_complex', mix, '-map', '[a]', '-ar', '44100', '-ac', '2', audio]);
  const video = path.join(dir, `${clip.name}.mp4`);
  ff(['-f', 'lavfi', '-i', `color=c=0x334455:s=720x1280:r=30:d=${total}`, '-i', audio, '-shortest', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', video]);
  return { video, parts, total };
}

let totalErr = 0; let totalWords = 0; const startErrs = []; let leaks = 0; let secs = 0; let audioSecs = 0;
for (const clip of CLIPS) {
  const { video, parts, total } = buildClip(clip);
  const t0 = Date.now();
  const r = await transcribe(bins, { input: video, model, language: 'auto' });
  secs += (Date.now() - t0) / 1000; audioSecs += total;
  const caps = C.buildCaptions(r.words, { noSpace: r.noSpace });
  const hyp = r.words.map((w) => w.text).join(' ');
  const ref = parts.map((p) => p.text).join(' ');
  const w = wer(ref, hyp); totalErr += w.errors; totalWords += w.words;
  const errs = parts.map((p) => {
    const c = caps.reduce((best, c) => (Math.abs(c.start - p.onset) < Math.abs(best.start - p.onset) ? c : best), caps[0]);
    return c ? c.start - p.onset : 9;
  });
  startErrs.push(...errs);
  const leaked = r.words.filter((x) => !parts.some((p) => (x.start + x.end) / 2 >= p.onset - 0.3 && (x.start + x.end) / 2 <= p.end + 0.3));
  leaks += leaked.length;
  console.log(`${clip.name.padEnd(13)} lang ${r.language}${r.language === clip.lang ? ' ' : '!'} WER ${(100 * w.errors / w.words).toFixed(1).padStart(4)}%  start err ${errs.map((e) => (e >= 0 ? '+' : '') + e.toFixed(2)).join(' ')}  leaks ${leaked.length}${leaked.length ? ' (' + leaked.map((x) => x.text).join(' ') + ')' : ''}`);
  if (w.errors) console.log(`   heard: ${hyp}`);
}
const abs = startErrs.map(Math.abs).sort((a, b) => a - b);
console.log(`\nOverall WER ${(100 * totalErr / totalWords).toFixed(1)}%  |  caption start error: median ${abs[abs.length >> 1].toFixed(2)} s, worst ${abs[abs.length - 1].toFixed(2)} s  |  leaked words ${leaks}  |  speed ${(audioSecs / secs).toFixed(1)}x real time`);

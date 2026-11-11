// Runs speech recognition on this computer: ffmpeg pulls out the audio, Silero VAD finds
// where people speak, everything else is silenced in place (so timings stay true),
// then whisper.cpp writes words with token-level (DTW) timestamps.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Captions = require('./captions');

// Paths are passed in so this module works both inside Electron and in plain node tests.
//   bins = { ffmpeg, whisperDir, vadModel }
function whisperExe(bins, name) {
  return path.join(bins.whisperDir, process.platform === 'win32' ? `${name}.exe` : name);
}
function whisperEnv(bins) {
  // ggml loads its GPU backend from a file next to the binary.
  const env = { ...process.env };
  const metal = path.join(bins.whisperDir, 'libggml-metal.so');
  if (process.platform === 'darwin' && fs.existsSync(metal)) env.GGML_BACKEND_PATH = metal;
  return env;
}

function run(cmd, args, { env, signal, onStderr, onStdout } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env, windowsHide: true });
    let out = ''; let err = '';
    p.stdout.on('data', (d) => { out += d; if (onStdout) onStdout(String(d)); });
    p.stderr.on('data', (d) => { const s = String(d); err = (err + s).slice(-20000); if (onStderr) onStderr(s); });
    const abort = () => { try { p.kill('SIGKILL'); } catch (e) { /* gone */ } };
    if (signal) { if (signal.aborted) abort(); signal.addEventListener('abort', abort, { once: true }); }
    p.on('error', reject);
    p.on('close', (code, sig) => {
      if (signal) signal.removeEventListener('abort', abort);
      if (signal && signal.aborted) return reject(Object.assign(new Error('Cancelled'), { cancelled: true }));
      if (code === 0) resolve({ out, err });
      else reject(new Error(`${path.basename(cmd)} failed (${sig || code}): ${err.trim().split('\n').slice(-3).join(' ')}`));
    });
  });
}

// 16 kHz mono 16-bit WAV, written with a plain 44-byte header.
async function extractAudio(bins, input, out, signal) {
  await run(bins.ffmpeg, ['-hide_banner', '-y', '-i', input, '-vn', '-map', '0:a:0', '-ac', '1', '-ar', '16000',
    '-c:a', 'pcm_s16le', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', out], { signal });
}

function readWav(file) {
  const b = fs.readFileSync(file);
  let off = 12; let dataOff = -1; let dataLen = 0;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4); const len = b.readUInt32LE(off + 4);
    if (id === 'data') { dataOff = off + 8; dataLen = Math.min(len, b.length - off - 8); break; }
    off += 8 + len + (len % 2);
  }
  if (dataOff < 0) throw new Error('No audio found in this file.');
  return { buf: b, dataOff, samples: Math.floor(dataLen / 2) };
}

// Loudness overview for the timeline: one 0..1 value per bucket (about 25 per second).
function computePeaks(wav) {
  const { buf, dataOff, samples } = readWav(wav);
  const n = Math.max(1, Math.min(6000, Math.ceil(samples / 16000 * 25)));
  const per = samples / n;
  const peaks = new Array(n).fill(0);
  for (let k = 0; k < n; k++) {
    const a = Math.floor(k * per); const b = Math.min(samples, Math.floor((k + 1) * per));
    let m = 0;
    for (let i = a; i < b; i += 4) { const v = Math.abs(buf.readInt16LE(dataOff + i * 2)); if (v > m) m = v; }
    peaks[k] = m / 32768;
  }
  // Normalise so quiet recordings still show shape.
  const top = Math.max(0.05, ...peaks);
  return peaks.map((v) => Math.round(Math.min(1, v / top) * 100) / 100);
}

async function peaksFor(bins, input) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'captionshaper-'));
  try { const wav = path.join(dir, 'a.wav'); await extractAudio(bins, input, wav); return computePeaks(wav); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// Speech regions in seconds, padded and with tiny gaps merged.
async function detectSpeech(bins, wav, signal) {
  const { out } = await run(whisperExe(bins, 'whisper-vad-speech-segments'), [
    '-f', wav, '-vm', bins.vadModel, '-np', '-vt', '0.45', '-vspd', '200', '-vsd', '250', '-vp', '120',
  ], { env: whisperEnv(bins), signal });
  const regions = [];
  for (const m of out.matchAll(/start = ([\d.]+), end = ([\d.]+)/g)) regions.push({ start: +m[1] / 100, end: +m[2] / 100 });
  const merged = [];
  for (const r of regions) {
    const last = merged[merged.length - 1];
    if (last && r.start - last.end < 0.3) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
}

// Silences everything outside speech so whisper can't caption music or noise,
// while every sample stays where it was.
function gateAudio(wavIn, wavOut, regions) {
  const { buf, dataOff, samples } = readWav(wavIn);
  const sr = 16000; const fade = 160; // 10 ms fades avoid clicks
  const keep = new Uint8Array(samples);
  for (const r of regions) {
    const a = Math.max(0, Math.floor((r.start - 0.15) * sr)); const b = Math.min(samples, Math.ceil((r.end + 0.15) * sr));
    keep.fill(1, a, b);
  }
  // Distance (in samples) to the nearest kept sample, from both sides, for a short fade.
  const dist = new Uint16Array(samples).fill(65535);
  let last = -1e9;
  for (let i = 0; i < samples; i++) { if (keep[i]) last = i; dist[i] = Math.min(65535, i - last); }
  last = 1e9;
  for (let i = samples - 1; i >= 0; i--) { if (keep[i]) last = i; dist[i] = Math.min(dist[i], last - i); }
  for (let i = 0; i < samples; i++) {
    if (keep[i]) continue;
    const gain = dist[i] < fade ? 1 - dist[i] / fade : 0;
    const o = dataOff + i * 2;
    buf.writeInt16LE(Math.round(buf.readInt16LE(o) * gain), o);
  }
  fs.writeFileSync(wavOut, buf);
}

function wavHeader(nSamples) {
  const h = Buffer.alloc(44); const bytes = nSamples * 2;
  h.write('RIFF', 0); h.writeUInt32LE(36 + bytes, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(16000, 24);
  h.writeUInt32LE(32000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(bytes, 40);
  return h;
}

// Groups speech regions into chunks of up to ~28 s, cut in the middle of pauses.
function makeChunks(regions, duration, maxLen = 28) {
  const chunks = [];
  let cur = null;
  for (const r of regions) {
    const s = Math.max(0, r.start - 0.4); const e = Math.min(duration, r.end + 0.4);
    if (cur && e - cur.start <= maxLen) { cur.end = e; continue; }
    if (cur) chunks.push(cur);
    cur = { start: s, end: e };
  }
  if (cur) chunks.push(cur);
  // Neighbouring chunks must not overlap: split the shared pause.
  for (let i = 1; i < chunks.length; i++) {
    if (chunks[i].start < chunks[i - 1].end) { const mid = (chunks[i].start + chunks[i - 1].end) / 2; chunks[i - 1].end = mid; chunks[i].start = mid; }
  }
  return chunks;
}

// Which model preset goes with which file, for DTW timestamps.
const DTW_PRESET = {
  'ggml-large-v3-turbo-q5_0.bin': 'large.v3.turbo',
  'ggml-large-v3-turbo.bin': 'large.v3.turbo',
  'ggml-large-v3-q5_0.bin': 'large.v3',
  'ggml-small-q5_1.bin': 'small',
  'ggml-base-q5_1.bin': 'base',
  'ggml-small.bin': 'small',
  'ggml-base.bin': 'base',
};

// A short, punctuated sentence in the spoken language. Whisper copies the style of its prompt,
// so this keeps capitals and punctuation on clips where it would otherwise drop them.
const PRIMERS = {
  en: 'Okay. So, here we go.', es: 'Bueno. Entonces, vamos allá.', fr: 'Bon. Alors, on y va.',
  de: 'Okay. Also, los geht’s.', it: 'Allora. Bene, andiamo.', pt: 'Então. Bom, vamos lá.',
  nl: 'Oké. Nou, daar gaan we.', pl: 'Dobra. No to, zaczynamy.', ru: 'Итак. Ну что, поехали.',
  uk: 'Отже. Ну що, поїхали.', lt: 'Gerai. Tai, pradedam.', lv: 'Labi. Tātad, sākam.',
  sv: 'Okej. Så, nu kör vi.', da: 'Okay. Så, nu kører vi.', no: 'Ok. Så, da kjører vi.',
  fi: 'No niin. Eli, aloitetaan.', cs: 'Dobře. Takže, jdeme na to.', tr: 'Tamam. Peki, başlayalım.',
  zh: '好的。那么，我们开始吧。', ja: 'はい。では、始めましょう。', ko: '네. 자, 시작해 볼게요.',
};

async function detectLanguage(bins, model, wav, signal) {
  const { err } = await run(whisperExe(bins, 'whisper-cli'), ['-m', model, '-f', wav, '-l', 'auto', '-dl', '-nt'], { env: whisperEnv(bins), signal });
  const m = /auto-detected language: (\w+)/.exec(err);
  return m ? m[1] : null;
}

/**
 * transcribe(bins, { input, model, language, translate, onProgress, signal })
 * -> { language, noSpace, words, regions, duration }
 * onProgress({ stage: 'audio'|'speech'|'words', pct })
 */
async function transcribe(bins, opts) {
  const { input, model, language = 'auto', translate = false, onProgress = () => {}, signal, threads, prompt } = opts;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'captionshaper-'));
  const raw = path.join(dir, 'audio.wav');
  const gated = path.join(dir, 'speech.wav');
  try {
    onProgress({ stage: 'audio', pct: 0 });
    await extractAudio(bins, input, raw, signal);
    const { samples } = readWav(raw);
    const duration = samples / 16000;
    const peaks = computePeaks(raw);
    onProgress({ stage: 'speech', pct: 0, peaks });
    const regions = await detectSpeech(bins, raw, signal);
    if (!regions.length) return { language: language === 'auto' ? 'en' : language, noSpace: false, words: [], regions, duration, peaks };
    onProgress({ stage: 'speech', pct: 100, regions });
    gateAudio(raw, gated, regions);
    onProgress({ stage: 'words', pct: 0 });
    let lang0 = language;
    if (lang0 === 'auto' && !translate) lang0 = (await detectLanguage(bins, model, gated, signal)) || 'auto';
    const primer = prompt || (!translate && PRIMERS[lang0]) || '';
    // Speech is cut at pauses into chunks of about 30 s (whisper's own window) and all chunks go to
    // one whisper run, so the model loads once. Each chunk's result is written as soon as it's done,
    // which lets the window show words while the rest is still being written.
    const chunks = makeChunks(regions, duration);
    const { buf, dataOff } = readWav(gated);
    const files = chunks.map((c, i) => {
      const f = path.join(dir, `chunk${String(i).padStart(4, '0')}.wav`);
      const a = Math.floor(c.start * 16000); const z = Math.min(samples, Math.ceil(c.end * 16000));
      fs.writeFileSync(f, Buffer.concat([wavHeader(z - a), buf.subarray(dataOff + a * 2, dataOff + z * 2)]));
      return f;
    });
    const preset = DTW_PRESET[path.basename(model)];
    const args = [
      '-m', model, '-l', lang0, '-ojf', '-np',
      '-t', String(threads || Math.max(2, Math.min(8, os.cpus().length - 1))),
      '-sns', // keep [Music], (applause) and the like out of the text
      '-mc', '96', // shorter text memory: fewer repetition loops
    ];
    if (preset) args.push('-dtw', preset, '-nfa'); // DTW timestamps need flash attention off
    if (translate) args.push('-tr');
    if (primer) args.push('--prompt', primer);
    args.push(...files);
    const total = chunks.reduce((t, c) => t + (c.end - c.start), 0);
    const results = new Array(chunks.length).fill(null);
    let detected = null;
    const collect = () => {
      let doneDur = 0; const fresh = [];
      chunks.forEach((c, i) => {
        if (!results[i]) {
          try {
            const json = JSON.parse(fs.readFileSync(`${files[i]}.json`, 'utf8'));
            if (json.result && json.result.language) detected = detected || json.result.language;
            const { words } = Captions.wordsFromWhisper(json, { lang: translate ? 'en' : (lang0 === 'auto' ? detected || 'en' : lang0) });
            results[i] = words.map((w) => ({ ...w, start: w.start + c.start, end: w.end + c.start }));
            fresh.push(...Captions.alignToSpeech(results[i], regions));
          } catch (e) { /* not written yet, or half written */ }
        }
        if (results[i]) doneDur += c.end - c.start;
      });
      if (fresh.length) onProgress({ stage: 'words', pct: Math.round(100 * doneDur / total), words: fresh });
    };
    const poll = setInterval(collect, 250);
    try {
      await run(whisperExe(bins, 'whisper-cli'), args, { env: whisperEnv(bins), signal });
    } finally { clearInterval(poll); }
    collect();
    const lang = translate ? 'en' : (lang0 === 'auto' ? detected || 'en' : lang0);
    const noSpace = Captions.isNoSpace(lang);
    const words = results.flatMap((r) => r || []);
    const aligned = Captions.alignToSpeech(dedupeLoops(words), regions);
    return { language: lang, noSpace, words: aligned, regions, duration, peaks };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Whisper sometimes repeats one phrase over and over; keep the first two.
function dedupeLoops(words) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    out.push(words[i]);
    for (let n = 1; n <= 6; n++) {
      if (out.length < n * 3) continue;
      const a = out.slice(-n).map((w) => w.text.toLowerCase()).join(' ');
      const b = out.slice(-2 * n, -n).map((w) => w.text.toLowerCase()).join(' ');
      const c = out.slice(-3 * n, -2 * n).map((w) => w.text.toLowerCase()).join(' ');
      if (a === b && b === c) { out.splice(-n, n); break; }
    }
  }
  return out;
}

module.exports = { transcribe, computePeaks, peaksFor, makeChunks, detectSpeech, extractAudio, gateAudio, whisperExe, whisperEnv, run, DTW_PRESET };

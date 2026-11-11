// Unit checks for the caption engine (no Electron, no models needed).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const C = require('../src/core/captions.js');
const R = require('../src/core/render.js');
let pass = 0; let fail = 0;
const t = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };

// A made-up talk: 4 words per second, a long pause after the first sentence.
const text = 'So this is the first sentence we say. After a pause, we keep talking about subtitles, line breaks and timing, because good captions are easy to read. The end.';
let time = 1;
const words = text.split(' ').map((w) => {
  const s = time; time += 0.25 + (w.endsWith('.') ? 0.2 : 0);
  if (w === 'say.') time += 1.5;
  return { text: w, start: s, end: s + 0.22, p: 0.9 };
});

const caps = C.buildCaptions(words, {});
t('every word kept, in order', caps.flatMap((c) => c.words.map((w) => w.text)).join(' ') === text);
t('lines fit 42 chars', caps.every((c) => C.captionLines(c).every((l) => l.length <= 42)), caps.map((c) => C.captionLines(c).join(' / ')).join(' | '));
t('at most 2 lines', caps.every((c) => C.captionLines(c).length <= 2));
t('no overlaps', caps.every((c, i) => i === 0 || c.start >= caps[i - 1].end));
t('min duration', caps.every((c) => c.end - c.start >= 0.85 || c === caps[caps.length - 1]));
t('long pause splits captions', !caps.some((c) => c.words.some((w) => w.text === 'say.') && c.words.some((w) => w.text === 'After')));
t('caption does not end on "the"/"a"/"and"', caps.slice(0, -1).every((c) => !['the', 'a', 'and', 'to'].includes(c.words[c.words.length - 1].text.toLowerCase())));

const pop = C.buildCaptions(words, { maxChars: 16, maxLines: 2, maxWords: 4 });
t('social: max 4 words', pop.every((c) => c.words.length <= 4));
const one = C.buildCaptions(words, { maxChars: 14, maxLines: 1, maxWords: 1 });
t('one word per caption', one.length === words.length);

// Editing
const c0 = caps[0];
const edited = C.applyText(c0, C.captionLines(c0).join(' ').replace('first', 'very first'), { maxChars: 42, maxLines: 2 });
t('edit with more words retimes inside caption', edited.words.length === c0.words.length + 1 && edited.words[0].start === c0.start && edited.words[edited.words.length - 1].end <= c0.words[c0.words.length - 1].end + 1e-9);
const same = C.applyText(c0, C.captionLines(c0).join('\n').replace('sentence', 'Sentence'));
t('edit with same word count keeps timings', same.words.every((w, i) => w.start === c0.words[i].start));
const twoLines = C.applyText(c0, 'So this is\nthe first sentence we say.');
t('typed line break kept', C.captionLines(twoLines).length === 2 && C.captionLines(twoLines)[0] === 'So this is');

// Exports
const srt = C.toSRT(caps);
t('srt format', /^1\n00:00:01,000 --> 00:00:\d\d,\d{3}\nSo this is/.test(srt), srt.slice(0, 50).replace(/\n/g, '⏎'));
t('vtt format', C.toVTT(caps).startsWith('WEBVTT\n\n00:00:01.000 --> '));
const popStyle = R.fromPreset('bold');
const ass = R.toASS(pop, popStyle, { width: 1080, height: 1920 });
t('ass has play res', /PlayResX: 1080\nPlayResY: 1920/.test(ass));
t('ass uses the preset font', /\\fnMontserrat Black/.test(ass));
t('ass highlights the spoken word', ass.includes('\\1c&H3FD2FF&'));
t('ass pops the spoken word', ass.includes('\\t(0,80,\\fscx120\\fscy120)'));
t('ass upper-cases for bold', /\}SO\b|\}THIS\b/.test(ass));
t('ass escapes braces', !R.toASS([{ start: 0, end: 1, words: [{ text: '{x}', start: 0, end: 1 }], lineBreaks: [] }], R.fromPreset('clean')).includes('{x}'));
const hl = R.toASS(pop.slice(0, 2), R.fromPreset('highlight'), { width: 1080, height: 1920 });
t('highlight box is drawn', /\\p1\}m /.test(hl));
const rv = R.toASS([pop[0]], R.fromPreset('reveal'), { width: 1080, height: 1920 });
const firstSlice = rv.split('\n').filter((l) => l.startsWith('Dialogue')).filter((l) => l.includes(',0:00:01.00,'));
t('reveal hides words not spoken yet', firstSlice.length === 1, `${firstSlice.length} words in first slice`);
const L = R.layout({ start: 0, end: 1, words: Array.from({ length: 12 }, (_, i) => ({ text: 'extraordinarily', start: i * 0.1 })), lineBreaks: [] }, R.fromPreset('bold'), { W: 1080, H: 1920 });
t('wide captions shrink to fit the safe area', L.lines[0].width <= 1080 * 0.76 + 1, `${Math.round(L.lines[0].width)} px`);
const old = R.normalizeStyle({ preset: 'pop', weight: 900, highlight: true, caps: 'upper', size: 11 });
t('old saved styles are migrated', old.v === 2 && old.highlight === 'color' && old.font === 'geist-black' && old.size === 11);
for (const p of R.PRESETS) { const a = R.toASS(pop.slice(0, 3), R.fromPreset(p.id), { width: 1920, height: 1080 }); if (!/Dialogue/.test(a)) t(`preset ${p.id} renders`, false); }
t('every preset renders', true);
t('txt paragraphs on long pause', C.toTXT(caps).includes('say.\n\nAfter'));

// Whisper JSON -> words
const json = { result: { language: 'en' }, transcription: [{ offsets: { from: 0, to: 2000 }, tokens: [
  { text: '[_BEG_]', offsets: { from: 0, to: 0 }, t_dtw: -1, p: 1 },
  { text: ' Hel', offsets: { from: 0, to: 300 }, t_dtw: 40, p: 0.9 },
  { text: 'lo', offsets: { from: 300, to: 500 }, t_dtw: 55, p: 0.9 },
  { text: ',', offsets: { from: 500, to: 520 }, t_dtw: 60, p: 0.9 },
  { text: ' world', offsets: { from: 600, to: 1000 }, t_dtw: 80, p: 0.3 },
  { text: '.', offsets: { from: 1000, to: 1100 }, t_dtw: 100, p: 0.9 },
] }] };
const r = C.wordsFromWhisper(json);
t('tokens join into words', r.words.map((w) => w.text).join('|') === 'Hello,|world.', r.words.map((w) => w.text).join('|'));
t('dtw start used', Math.abs(r.words[0].start - 0.3) < 1e-9 && Math.abs(r.words[1].start - 0.7) < 1e-9, `${r.words[0].start} ${r.words[1].start}`);
const aligned = C.alignToSpeech([...r.words, { text: 'ghost', start: 5, end: 5.3, p: 0.2 }], [{ start: 0.25, end: 1.2 }]);
t('words outside speech dropped', aligned.length === 2);
t('first word snapped to speech start', aligned[0].start === 0.25);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

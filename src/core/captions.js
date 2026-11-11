// Captionshaper caption engine: turns whisper tokens into timed words, words into
// well-broken captions, and captions into SRT / VTT / ASS / TXT.
// Pure functions only, so it runs in the app, in tests and in the browser.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Captions = factory();
}(typeof self !== 'undefined' ? self : this, () => {
  // Languages written without spaces between words: each token is its own word.
  const NO_SPACE_LANGS = new Set(['zh', 'ja', 'th', 'lo', 'my', 'km', 'yue']);
  // A line should not end on these (English and the other UI languages' most common ones).
  const WEAK = new Set(('a an the and or but nor so to of in on at by for with from as into onto than that ' +
    'my your his her its our their these those i we he she they ' +
    'if when while because which who whose not very ' +
    'el la los las un una y o de del en con por para que su sus ' +
    'le la les un une des et ou de du en au aux avec pour que qui ' +
    'der die das ein eine und oder zu von mit für im in auf den dem des ' +
    'и в на с к по о от для не а но что как').split(/\s+/));
  // DTW token times land a little after the sound starts; this pulls them back.
  const DTW_LEAD = 0.1;

  const isSpecial = (t) => /^\[_.*\]$/.test(t.text) || /^<\|.*\|>$/.test(t.text);
  const isPunct = (s) => /^[\s.,!?;:…'"”’)\]»%\-–—。，、！？；：」』]+$/.test(s);
  const endsSentence = (w) => /[.!?…。！？]["”’»)]*$/.test(w);
  const endsClause = (w) => /[,;:，、；：—–]["”’»)]*$/.test(w);
  const bare = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

  // whisper -ojf output -> [{ text, start, end, p }] in seconds, on the real timeline.
  function wordsFromWhisper(json, { lang } = {}) {
    const language = lang || (json.result && json.result.language) || 'en';
    const noSpace = NO_SPACE_LANGS.has(language);
    const words = [];
    for (const seg of json.transcription || []) {
      const segFrom = seg.offsets.from / 1000;
      const segTo = seg.offsets.to / 1000;
      for (const t of seg.tokens || []) {
        if (isSpecial(t) || !t.text) continue;
        const raw = t.text;
        const dtw = typeof t.t_dtw === 'number' && t.t_dtw >= 0 ? t.t_dtw / 100 - DTW_LEAD : null;
        const from = dtw != null ? dtw : t.offsets.from / 1000;
        const startsWord = noSpace ? !isPunct(raw) : /^\s/.test(raw);
        const last = words[words.length - 1];
        if (last && (isPunct(raw.trim()) || (!startsWord && !noSpace)) && raw.trim()) {
          // Punctuation or a word piece: glue onto the previous word.
          last.text += raw.trim();
          last.end = Math.max(last.end, t.offsets.to / 1000);
          last.pSum += t.p; last.pN += 1;
          continue;
        }
        if (!raw.trim()) continue;
        words.push({
          text: raw.trim(),
          start: Math.max(segFrom - 0.05, from),
          end: Math.min(segTo, t.offsets.to / 1000),
          pSum: t.p, pN: 1,
        });
      }
    }
    // Starts must increase; ends sit between their start and the next start.
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (i > 0 && w.start < words[i - 1].start + 0.02) w.start = words[i - 1].start + 0.02;
    }
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const next = words[i + 1];
      if (next) {
        w.end = Math.min(Math.max(w.end, w.start + 0.12), next.start);
        // Connected speech: a word lasts until the next one starts.
        if (next.start - w.end < 0.3 && !endsSentence(w.text)) w.end = next.start;
      }
      else w.end = Math.max(w.end, w.start + 0.25);
      w.p = w.pSum / w.pN; delete w.pSum; delete w.pN;
    }
    return { language, noSpace, words };
  }

  // Voice activity regions [{start,end}] keep captions off silence and music:
  // words that fall outside speech are dropped (that is where whisper invents text),
  // and words that touch a region's edge are snapped to it (VAD edges are sharp, DTW is not).
  function alignToSpeech(words, regions, { pad = 0.25 } = {}) {
    if (!regions || !regions.length) return words;
    const inRegion = (t) => regions.findIndex((r) => t >= r.start - pad && t <= r.end + pad);
    const kept = [];
    for (const w of words) {
      const mid = (w.start + w.end) / 2;
      const ri = inRegion(mid) >= 0 ? inRegion(mid) : inRegion(w.start);
      if (ri < 0) continue;
      kept.push({ ...w, region: ri });
    }
    for (let i = 0; i < kept.length; i++) {
      const w = kept[i];
      const r = regions[w.region];
      const prev = kept[i - 1];
      const next = kept[i + 1];
      // First word of a speech region starts when the voice starts.
      if (!prev || prev.region !== w.region) {
        if (Math.abs(w.start - r.start) < 1.0) w.start = r.start;
      }
      // Last word of a region ends when the voice stops.
      if (!next || next.region !== w.region) {
        w.end = Math.min(Math.max(w.end, w.start + 0.15), r.end + 0.05);
        if (r.end - w.end < 1.5 && r.end > w.end) w.end = r.end;
      }
      w.start = Math.max(w.start, r.start - 0.05);
      if (w.end > r.end + 0.1) w.end = r.end + 0.1;
      if (w.end <= w.start) w.end = w.start + 0.12;
    }
    for (const w of kept) delete w.region;
    return kept;
  }

  const DEFAULTS = {
    maxChars: 42, // per line
    maxLines: 2,
    minDuration: 0.9,
    maxDuration: 6,
    linger: 0.5, // keep a caption up a little after the voice stops, when there's room
    gap: 0.08, // smallest gap between two captions
    pauseBreak: 0.6, // a silence this long always starts a new caption
    maxWords: 0, // 0 = no limit (social presets use 2-4)
  };

  const joinWords = (ws, noSpace) => ws.map((w) => w.text).join(noSpace ? '' : ' ');
  const textLen = (s) => [...s].length;

  // Best place to split a caption's words into lines. Returns arrays of word indexes per line.
  function wrap(ws, maxChars, maxLines, noSpace) {
    const n = ws.length;
    const len = (a, b) => textLen(joinWords(ws.slice(a, b), noSpace));
    if (len(0, n) <= maxChars || maxLines === 1) return [[0, n]];
    let best = null;
    for (let k = 1; k < n; k++) {
      const l1 = len(0, k); const l2 = len(k, n);
      if (l1 > maxChars || l2 > maxChars) continue;
      const lastTop = ws[k - 1].text;
      let cost = Math.abs(l1 - l2) / maxChars * 3;
      if (endsSentence(lastTop)) cost -= 3;
      else if (endsClause(lastTop)) cost -= 2;
      else if (WEAK.has(bare(lastTop))) cost += 3;
      if (l2 > l1) cost -= 0.2; // slightly bottom-heavy reads best
      if (!best || cost < best.cost) best = { cost, k };
    }
    if (!best) return null;
    return [[0, best.k], [best.k, n]];
  }

  // Splits words into captions with dynamic programming: every possible caption is scored
  // for where it breaks (sentence end > clause > plain > after a weak word), how full it is,
  // how long it stays up and whether it straddles a pause; the cheapest total wins.
  function buildCaptions(words, options = {}) {
    const o = { ...DEFAULTS, ...options };
    const noSpace = !!o.noSpace;
    const n = words.length;
    if (!n) return [];
    const capacity = o.maxChars * o.maxLines;
    const best = new Array(n + 1).fill(Infinity);
    const from = new Array(n + 1).fill(-1);
    best[0] = 0;
    for (let j = 1; j <= n; j++) {
      for (let i = j - 1; i >= 0; i--) {
        const ws = words.slice(i, j);
        const count = j - i;
        const text = joinWords(ws, noSpace);
        const chars = textLen(text);
        const dur = ws[count - 1].end - ws[0].start;
        if (count > 1) {
          if (chars > capacity) break;
          if (o.maxWords && count > o.maxWords) break;
          if (dur > o.maxDuration) break;
        }
        let lines = wrap(ws, o.maxChars, o.maxLines, noSpace);
        let cost = 1; // each caption costs a little, so they fill up
        if (!lines) {
          if (count > 1) continue;
          lines = [[0, 1]];
          cost += 10; // a single word longer than a line
        }
        // A long pause inside a caption is wrong: speech stops but text stays.
        for (let k = i + 1; k < j; k++) {
          const gap = words[k].start - words[k - 1].end;
          if (gap >= o.pauseBreak) cost += 50;
          else if (gap > 0.3) cost += 0.5 + (gap - 0.3) * 3;
        }
        // A sentence ending mid-caption with plenty more after it reads badly.
        for (let k = i; k < j - 1; k++) {
          if (endsSentence(words[k].text) && (j - 1 - k) >= 2) cost += 1.5;
        }
        const last = ws[count - 1].text;
        const isEnd = j === n;
        if (!isEnd) {
          const gapAfter = words[j].start - ws[count - 1].end;
          if (endsSentence(last)) cost += 0;
          else if (endsClause(last)) cost += 0.6;
          else if (gapAfter >= o.pauseBreak) cost += 0.2;
          else cost += 2;
          if (!endsClause(last) && !endsSentence(last) && WEAK.has(bare(last))) cost += 4;
        }
        const fill = chars / capacity;
        cost += (1 - fill) * (1 - fill) * (o.maxWords ? 0.5 : 2.5);
        if (dur < o.minDuration * 0.6 && !isEnd && count < 2) cost += 1.5;
        const total = best[i] + cost;
        if (total < best[j]) { best[j] = total; from[j] = i; }
      }
    }
    const spans = [];
    for (let j = n; j > 0; j = from[j]) spans.unshift([from[j], j]);
    const caps = spans.map(([i, j], idx) => {
      const ws = words.slice(i, j).map((w) => ({ ...w }));
      const lines = wrap(ws, o.maxChars, o.maxLines, noSpace) || [[0, ws.length]];
      return {
        id: `c${idx + 1}`,
        start: ws[0].start,
        end: ws[ws.length - 1].end,
        words: ws,
        lineBreaks: lines.slice(1).map((l) => l[0]),
      };
    });
    return retime(caps, o);
  }

  // Gives captions readable durations without overlapping each other.
  function retime(caps, options = {}) {
    const o = { ...DEFAULTS, ...options };
    for (let k = 0; k < caps.length; k++) {
      const c = caps[k];
      const next = caps[k + 1];
      const limit = next ? next.start - o.gap : Infinity;
      const speechEnd = c.words.length ? c.words[c.words.length - 1].end : c.end;
      let end = Math.max(speechEnd + o.linger, c.start + o.minDuration);
      end = Math.min(end, limit, c.start + Math.max(o.maxDuration, speechEnd - c.start));
      // A caption the next one crowds out still keeps its words on screen.
      c.end = Math.max(end, Math.min(speechEnd, limit));
      if (next && next.start - c.end < o.gap * 2 && next.start - c.end > 0) c.end = next.start - o.gap; // close tiny flickers
      if (c.end <= c.start) c.end = c.start + 0.2;
    }
    return caps;
  }

  // Caption text with its line breaks as plain lines.
  function captionLines(c, noSpace) {
    const breaks = [0, ...(c.lineBreaks || []), c.words.length];
    const lines = [];
    for (let k = 0; k < breaks.length - 1; k++) lines.push(joinWords(c.words.slice(breaks[k], breaks[k + 1]), noSpace));
    return lines.filter((l) => l.length);
  }

  // After the user edits a caption's text, keep timings: words that match keep theirs,
  // the rest share the caption's time by length.
  function applyText(c, newText, { noSpace = false, maxChars = 42, maxLines = 2 } = {}) {
    const typedLines = newText.split('\n').map((l) => l.trim()).filter(Boolean);
    const toks = typedLines.map((l) => (noSpace ? [...l] : l.split(/\s+/)).filter(Boolean));
    const flat = toks.flat();
    const old = c.words;
    let words;
    if (flat.length === old.length) {
      words = flat.map((t, i) => ({ ...old[i], text: t }));
    } else {
      const total = flat.reduce((s, t) => s + textLen(t) + 1, 0) || 1;
      const span = (old.length ? old[old.length - 1].end : c.end) - c.start;
      let acc = 0;
      words = flat.map((t) => {
        const s = c.start + (acc / total) * span;
        acc += textLen(t) + 1;
        return { text: t, start: s, end: c.start + (acc / total) * span, p: 1 };
      });
    }
    let lineBreaks;
    if (typedLines.length > 1) {
      lineBreaks = []; let acc = 0;
      for (let k = 0; k < toks.length - 1; k++) { acc += toks[k].length; lineBreaks.push(acc); }
    } else {
      const l = wrap(words, maxChars, maxLines, noSpace);
      lineBreaks = l ? l.slice(1).map((x) => x[0]) : [];
    }
    return { ...c, words, lineBreaks };
  }

  // ---------- Exports ----------
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  function stamp(t, sep) {
    const ms = Math.max(0, Math.round(t * 1000));
    return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}${sep}${pad(ms % 1000, 3)}`;
  }

  function applyCase(s, mode) {
    if (mode === 'upper') return s.toLocaleUpperCase();
    if (mode === 'lower') return s.toLocaleLowerCase();
    return s;
  }
  function stripPunct(s) { return s.replace(/[.,!?;:…，、。！？；：]+(?=\s|$)/g, ''); }

  function toSRT(caps, { noSpace } = {}) {
    return caps.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${captionLines(c, noSpace).join('\n')}\n`).join('\n');
  }
  function toVTT(caps, { noSpace } = {}) {
    return 'WEBVTT\n\n' + caps.map((c) => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${captionLines(c, noSpace).join('\n')}\n`).join('\n');
  }
  function toTXT(caps, { noSpace } = {}) {
    // Paragraphs: a new one after a long pause.
    let out = ''; let prevEnd = null;
    for (const c of caps) {
      const t = joinWords(c.words, noSpace);
      if (prevEnd != null) out += c.start - prevEnd > 1.5 ? '\n\n' : (noSpace ? '' : ' ');
      out += t; prevEnd = c.words.length ? c.words[c.words.length - 1].end : c.end;
    }
    return out.trim() + '\n';
  }

  // ---------- Styles (shared by the live preview and the burned-in video) ----------
  const STYLES = {
    clean: { name: 'Clean', font: 'Geist', weight: 600, size: 5.2, color: '#ffffff', outline: 0.32, outlineColor: '#000000', shadow: 0.0, box: false, boxColor: '#000000', boxOpacity: 0.6, highlight: false, highlightColor: '#ffd23f', caps: 'none', position: 'bottom', margin: 7, maxChars: 42, maxLines: 2, maxWords: 0 },
    box: { name: 'Box', font: 'Geist', weight: 600, size: 5.0, color: '#ffffff', outline: 0, outlineColor: '#000000', shadow: 0, box: true, boxColor: '#000000', boxOpacity: 0.72, highlight: false, highlightColor: '#ffd23f', caps: 'none', position: 'bottom', margin: 7, maxChars: 42, maxLines: 2, maxWords: 0 },
    pop: { name: 'Pop', font: 'Geist', weight: 900, size: 11, color: '#ffffff', outline: 0.55, outlineColor: '#000000', shadow: 0.25, box: false, boxColor: '#000000', boxOpacity: 0.6, highlight: true, highlightColor: '#ffd23f', caps: 'upper', position: 'middle', margin: 30, maxChars: 16, maxLines: 2, maxWords: 4 },
    karaoke: { name: 'Word by word', font: 'Geist', weight: 900, size: 14, color: '#ffffff', outline: 0.6, outlineColor: '#000000', shadow: 0.3, box: false, boxColor: '#000000', boxOpacity: 0.6, highlight: true, highlightColor: '#b48cff', caps: 'upper', position: 'middle', margin: 30, maxChars: 14, maxLines: 1, maxWords: 1 },
  };
  // size, outline and shadow are % of the video's shorter side (so vertical and wide videos
  // both look right); margin is % of the height from the edge.
  // ASS font sizes measure ascent + descent; Geist's is 1.35 em. The preview divides by this.
  const FONT_SCALE = 1.35;

  // How many characters fit on one line of this video at this style.
  function fitChars(style, width, height) {
    const em = Math.min(width, height) * style.size / 100 / FONT_SCALE;
    const avgChar = em * (style.caps === 'upper' ? 0.7 : 0.56) * (style.weight >= 900 ? 1.08 : 1);
    // Vertical videos keep clear of the like/share buttons TikTok, Reels and Shorts put on the right.
    return Math.max(8, Math.min(style.maxChars || 42, Math.floor((width * (height > width * 1.2 ? 0.74 : 0.88)) / avgChar)));
  }

  const FONT_FILES = { 500: 'Geist-Medium', 600: 'Geist-SemiBold', 700: 'Geist-Bold', 900: 'Geist-Black' };
  const ASS_FONT_NAMES = { 500: 'Geist Medium', 600: 'Geist SemiBold', 700: 'Geist', 900: 'Geist Black' };

  function assColor(hex, alpha = 0) {
    const h = hex.replace('#', '');
    const r = h.slice(0, 2); const g = h.slice(2, 4); const b = h.slice(4, 6);
    const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
    return `&H${a}${b}${g}${r}`.toUpperCase();
  }
  // Inline override colour: &HBBGGRR&
  const inlineColor = (hex) => { const x = hex.replace('#', ''); return `&H${x.slice(4, 6)}${x.slice(2, 4)}${x.slice(0, 2)}&`.toUpperCase(); };
  const assTime = (t) => {
    const cs = Math.max(0, Math.round(t * 100));
    return `${Math.floor(cs / 360000)}:${pad(Math.floor(cs / 6000) % 60)}:${pad(Math.floor(cs / 100) % 60)}.${pad(cs % 100)}`;
  };
  const assEscape = (s) => s.replace(/\\/g, '\\\\').replace(/{/g, '(').replace(/}/g, ')');

  function toASS(caps, style, { width = 1920, height = 1080, noSpace = false } = {}) {
    const s = { ...STYLES.clean, ...style };
    const ref = Math.min(width, height);
    const size = Math.round(ref * s.size / 100);
    const outline = (ref * s.outline / 100).toFixed(1);
    const shadow = (ref * s.shadow / 100).toFixed(1);
    const align = s.position === 'top' ? 8 : s.position === 'middle' ? 5 : 2;
    const marginV = Math.round(height * s.margin / 100);
    const marginH = Math.round(width * (height > width * 1.2 ? 0.12 : 0.06));
    const font = ASS_FONT_NAMES[s.weight] || 'Geist';
    // BorderStyle 3 draws an opaque box behind each line; 1 draws an outline.
    const borderStyle = s.box ? 3 : 1;
    const back = s.box ? assColor(s.boxColor, 1 - s.boxOpacity) : assColor(s.outlineColor, 0.35);
    const outlineCol = s.box ? assColor(s.boxColor, 1 - s.boxOpacity) : assColor(s.outlineColor);
    const boxPad = s.box ? (size * 0.22).toFixed(1) : outline;
    const head = `[Script Info]
; Made with Captionshaper by Hollowbit
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${font},${size},${assColor(s.color)},${assColor(s.highlightColor)},${outlineCol},${back},0,0,0,0,100,100,0,0,${borderStyle},${boxPad},${s.box ? 0 : shadow},${align},${marginH},${marginH},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
    const lines = [];
    const fmtWord = (w) => assEscape(applyCase(s.caps === 'strip' ? stripPunct(w.text) : w.text, s.caps));
    const sep = noSpace ? '' : ' ';
    const render = (c, activeIdx) => {
      const breaks = new Set(c.lineBreaks || []);
      let out = '';
      c.words.forEach((w, i) => {
        if (i > 0) out += breaks.has(i) ? '\\N' : sep;
        const t = fmtWord(w);
        out += i === activeIdx ? `{\\c${inlineColor(s.highlightColor)}}${t}{\\c${inlineColor(s.color)}}` : t;
      });
      return out;
    };
    for (const c of caps) {
      if (!s.highlight || !c.words.length) {
        lines.push(`Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Default,,0,0,0,,${render(c, -1)}`);
        continue;
      }
      // One event per word: the caption stays put and the spoken word lights up.
      for (let i = 0; i < c.words.length; i++) {
        const st = i === 0 ? c.start : c.words[i].start;
        const en = i === c.words.length - 1 ? c.end : c.words[i + 1].start;
        if (en - st < 0.01) continue;
        lines.push(`Dialogue: 0,${assTime(st)},${assTime(en)},Default,,0,0,0,,${render(c, i)}`);
      }
    }
    return head + lines.join('\n') + '\n';
  }

  return {
    isNoSpace: (lang) => NO_SPACE_LANGS.has(lang),
    DEFAULTS, STYLES, FONT_FILES, WEAK, FONT_SCALE, fitChars,
    wordsFromWhisper, alignToSpeech, buildCaptions, retime, wrap, captionLines, applyText,
    toSRT, toVTT, toTXT, toASS, stamp, applyCase, stripPunct, joinWords,
  };
}));

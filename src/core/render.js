// Captionshaper caption renderer.
// One layout, two outputs: a canvas frame for the live preview and an ASS script for the burned-in
// video. Every word is measured and placed by us (not left to the subtitle renderer), so the preview
// and the export match: same font, size, position, outline, highlight and animation timing.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./captions.js'), require('./fonts.js'));
  else root.CaptionRender = factory(root.Captions, root.CaptionFonts);
}(typeof self !== 'undefined' ? self : this, (C, Fonts) => {
  // ---------- Styles ----------
  // Sizes (size, outline, shadow, glow) are % of the video's shorter side. margin is % of height.
  const BASE = {
    font: 'geist-semibold', size: 5.2, color: '#ffffff', caps: 'none', stripPunct: false,
    outline: 0.3, outlineColor: '#000000', shadow: 0, shadowColor: '#000000', shadowOpacity: 0.7,
    glow: 0, glowColor: '#3dffb0',
    box: false, boxColor: '#000000', boxOpacity: 0.7,
    highlight: 'none', highlightColor: '#ffd23f', highlightText: '#000000',
    animation: 'none', upcoming: 'show',
    position: 'bottom', margin: 8, lineSpacing: 1.12,
    maxChars: 42, maxLines: 2, maxWords: 0,
  };
  const PRESETS = [
    { id: 'clean', name: 'Clean', style: { font: 'geist-semibold', size: 5.2, outline: 0.32, shadow: 0.18, shadowOpacity: 0.5 } },
    { id: 'box', name: 'Subtitle box', style: { font: 'geist-semibold', size: 5, outline: 0, box: true, boxOpacity: 0.72 } },
    { id: 'bold', name: 'Bold', style: { font: 'montserrat-black', size: 9.5, caps: 'upper', outline: 0.75, shadow: 0.55, shadowOpacity: 1, highlight: 'color', highlightColor: '#ffd23f', animation: 'pop', position: 'middle', margin: 30, maxChars: 16, maxLines: 2, maxWords: 3, lineSpacing: 1.05 } },
    { id: 'highlight', name: 'Highlight', style: { font: 'poppins-black', size: 8.6, caps: 'upper', outline: 0.45, shadow: 0.35, shadowOpacity: 0.6, highlight: 'box', highlightColor: '#c6ff3d', highlightText: '#08090a', animation: 'pop', position: 'middle', margin: 30, maxChars: 16, maxLines: 2, maxWords: 4, lineSpacing: 1.08 } },
    { id: 'word', name: 'One word', style: { font: 'anton', size: 15, caps: 'upper', outline: 0.7, shadow: 0.7, shadowOpacity: 1, animation: 'pop', position: 'middle', margin: 30, maxChars: 14, maxLines: 1, maxWords: 1 } },
    { id: 'reveal', name: 'Reveal', style: { font: 'montserrat-extrabold', size: 8, outline: 0.5, shadow: 0.3, shadowOpacity: 0.6, upcoming: 'hide', animation: 'fade', position: 'middle', margin: 30, maxChars: 18, maxLines: 2, maxWords: 6, lineSpacing: 1.08 } },
    { id: 'neon', name: 'Neon', style: { font: 'bebas', size: 13, caps: 'upper', outline: 0.2, outlineColor: '#0b3b2c', glow: 1.6, glowColor: '#3dffb0', highlight: 'color', highlightColor: '#c6ff3d', animation: 'pop', position: 'middle', margin: 30, maxChars: 16, maxLines: 2, maxWords: 3, lineSpacing: 1.0 } },
    { id: 'comic', name: 'Comic', style: { font: 'bangers', size: 11, color: '#ffe14d', outline: 0.8, shadow: 0.7, shadowOpacity: 1, highlight: 'color', highlightColor: '#ffffff', animation: 'pop', position: 'middle', margin: 30, maxChars: 16, maxLines: 2, maxWords: 3, lineSpacing: 1.02 } },
    { id: 'minimal', name: 'Minimal', style: { font: 'geist-semibold', size: 4.4, caps: 'lower', stripPunct: true, outline: 0, shadow: 0.25, shadowOpacity: 0.55, animation: 'slide', position: 'bottom', margin: 10, maxChars: 34, maxLines: 1 } },
  ];
  const presetById = Object.fromEntries(PRESETS.map((p) => [p.id, p]));
  const OLD_IDS = { pop: 'bold', karaoke: 'word' };
  const fromPreset = (id) => { const k = presetById[id] ? id : OLD_IDS[id] || 'clean'; return { ...BASE, ...presetById[k].style, preset: k, v: 2 }; };

  // Styles saved by Captionshaper 1.0.x used a different shape: bring them over.
  function normalizeStyle(s = {}) {
    if (s.v === 2) return { ...BASE, ...s };
    const old = { ...s };
    const out = fromPreset({ clean: 'clean', box: 'box', pop: 'bold', karaoke: 'word' }[old.preset] || 'clean');
    for (const k of ['size', 'color', 'outlineColor', 'highlightColor', 'position', 'margin', 'maxChars', 'maxLines', 'maxWords', 'boxColor', 'boxOpacity', 'stripPunct']) if (old[k] != null) out[k] = old[k];
    if (old.weight) out.font = old.weight >= 900 ? 'geist-black' : old.weight >= 700 ? 'geist-bold' : 'geist-semibold';
    if (typeof old.highlight === 'boolean') out.highlight = old.highlight ? 'color' : 'none';
    if (typeof old.box === 'boolean') out.box = old.box;
    if (old.caps === 'upper' || old.caps === 'none') out.caps = old.caps;
    if (old.outline != null) out.outline = old.outline;
    return { ...out, v: 2 };
  }

  // ---------- Measuring ----------
  // measure(text, fontId, emPx) -> width in px. The app passes a canvas-based one; tests use this estimate.
  const AVG = { geist: 0.56, montserrat: 0.66, poppins: 0.62, anton: 0.46, bebas: 0.4, bangers: 0.5 };
  const roughMeasure = (text, fontId, em) => [...text].length * em * (AVG[fontId.split('-')[0]] || 0.56);

  const isVertical = (W, H) => H > W * 1.2;
  // Characters per line that fit this video (used to split captions before layout).
  function fitChars(style, W, H) {
    const s = { ...BASE, ...style };
    const f = Fonts.get(s.font);
    const em = Math.min(W, H) * s.size / 100 / f.scale;
    const avg = em * (AVG[s.font.split('-')[0]] || 0.56) * (s.caps === 'upper' ? 1.18 : 1);
    return Math.max(6, Math.min(s.maxChars || 42, Math.floor((W * (isVertical(W, H) ? 0.76 : 0.88)) / avg)));
  }

  const display = (text, s) => C.applyCase(s.stripPunct ? (C.stripPunct(text) || text) : text, s.caps);

  // ---------- Layout ----------
  // Returns every word's box in video pixels; lines are centred and kept inside the safe width.
  function layout(c, style, { W, H, measure = roughMeasure, noSpace = false }) {
    const s = { ...BASE, ...style };
    const f = Fonts.get(s.font);
    const ref = Math.min(W, H);
    let assSize = ref * s.size / 100;
    let em = assSize / f.scale;
    const maxW = W * (isVertical(W, H) ? 0.76 : 0.88);
    const breaks = new Set(c.lineBreaks || []);
    const rows = [[]];
    c.words.forEach((w, i) => { if (i > 0 && breaks.has(i)) rows.push([]); rows[rows.length - 1].push(i); });
    const texts = c.words.map((w) => display(w.text, s));
    // A highlight box needs room around the word, so its neighbours sit further away.
    const gapAt = (e) => (noSpace ? 0 : measure(' ', s.font, e)) + (s.highlight === 'box' ? e * 0.3 : 0);
    const widthAt = (e) => rows.map((r) => {
      const ws = r.map((i) => measure(texts[i], s.font, e));
      return ws.reduce((a, b) => a + b, 0) + gapAt(e) * (r.length - 1);
    });
    // Shrink a caption that would run off the screen.
    const widest = Math.max(...widthAt(em));
    if (widest > maxW) { const k = maxW / widest; em *= k; assSize *= k; }
    const space = gapAt(em);
    const step = em * s.lineSpacing * (s.box ? 1.25 : 1); // distance between baselines
    const capH = em * f.cap;
    // Block: from the first line's cap top to the last line's baseline (+ a little for descenders).
    const blockH = capH + step * (rows.length - 1);
    let top;
    if (s.position === 'top') top = H * s.margin / 100;
    else if (s.position === 'middle') top = H / 2 - blockH / 2;
    else top = H - H * s.margin / 100 - blockH - em * 0.2;
    const lines = rows.map((r, li) => {
      const baseline = top + capH + step * li;
      const ws = r.map((i) => measure(texts[i], s.font, em));
      const total = ws.reduce((a, b) => a + b, 0) + space * (r.length - 1);
      let x = W / 2 - total / 2;
      const words = r.map((i, k) => { const w = { i, text: texts[i], x, w: ws[k], cx: x + ws[k] / 2 }; x += ws[k] + space; return w; });
      return { baseline, x0: W / 2 - total / 2, width: total, words };
    });
    // libass places a line by its ascent+descent box; this is the centre of that box for a baseline.
    const centerFromBaseline = (b) => b - em * f.asc + em * (f.asc + f.desc) / 2;
    return { s, f, em, assSize, capH, lines, centerFromBaseline, ref };
  }

  // ---------- Timing ----------
  const wordStart = (c, i) => (i === 0 ? c.start : Math.max(c.start, c.words[i].start));
  const activeAt = (c, t) => { let a = -1; for (let i = 0; i < c.words.length; i++) if (t >= wordStart(c, i)) a = i; return a; };
  // Pop: 1 -> peak in 80 ms -> rest in another 80 ms (linear, like ASS \t).
  function popScale(s, te) {
    const rest = s.highlight !== 'none' ? 1.06 : 1;
    const peak = rest + 0.14;
    if (te < 0) return 1;
    if (te < 0.08) return 1 + (peak - 1) * (te / 0.08);
    if (te < 0.16) return peak + (rest - peak) * ((te - 0.08) / 0.08);
    return rest;
  }

  // ---------- Preview: draw one frame on a canvas ----------
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
  function roundRectPath(g, x, y, w, h, r) {
    // Same corner curves as the ASS drawing below.
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.bezierCurveTo(x + w, y, x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.bezierCurveTo(x + w, y + h, x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.bezierCurveTo(x, y + h, x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.bezierCurveTo(x, y, x, y, x + r, y); g.closePath();
  }
  function boxFor(L, word, scale) {
    const padX = L.em * 0.16; const padTop = L.em * 0.14; const padBot = L.em * 0.16;
    const w = word.w * scale + padX * 2; const h = (L.capH + padTop + padBot) * scale;
    return { w, h, r: Math.min(h * 0.28, L.em * 0.22) };
  }
  function lineBox(L, line) {
    const padX = L.em * 0.35; const padTop = L.em * 0.22; const padBot = L.em * 0.3;
    return { x: line.x0 - padX, y: line.baseline - L.capH - padTop, w: line.width + padX * 2, h: L.capH + padTop + padBot, r: L.em * 0.18 };
  }

  // Draws caption `c` at time `t` into a canvas context whose units are video pixels.
  function drawFrame(g, c, style, t, opts) {
    const L = layout(c, style, opts);
    const { s, f, em } = L;
    const active = activeAt(c, t);
    const tc = t - c.start;
    const ref = L.ref;
    let dy = 0; let capAlpha = 1;
    if (s.animation === 'slide' && tc < 0.18) { const k = tc / 0.18; dy = em * 0.4 * (1 - k); capAlpha = k; }
    if (s.animation === 'slide' && c.end - t < 0.1) capAlpha *= Math.max(0, (c.end - t) / 0.1);
    g.save();
    g.font = `${em}px "${Fonts.css(s.font)}"`;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.miterLimit = 2;
    if (s.box) {
      for (const line of L.lines) {
        const b = lineBox(L, line);
        g.globalAlpha = capAlpha; g.fillStyle = hexA(s.boxColor, s.boxOpacity);
        roundRectPath(g, b.x, b.y + dy, b.w, b.h, b.r); g.fill();
      }
    }
    for (const line of L.lines) {
      for (const w of line.words) {
        const i = w.i; const ws = wordStart(c, i);
        let alpha = capAlpha;
        if (i > active) { if (s.upcoming === 'hide') continue; if (s.upcoming === 'dim') alpha *= 0.4; }
        if (s.animation === 'fade' && i <= active) alpha *= Math.min(1, (t - ws) / 0.1);
        const isActive = i === active;
        const scale = s.animation === 'pop' && isActive ? popScale(s, t - ws) : (isActive && s.highlight !== 'none' && s.animation === 'pop' ? 1.06 : 1);
        const cx = w.cx; const by = line.baseline + dy;
        g.save();
        g.globalAlpha = alpha;
        // Scale around the word's visual centre (cap-height middle).
        const cy = by - L.capH / 2;
        g.translate(cx, cy); g.scale(scale, scale); g.translate(-cx, -cy);
        if (isActive && s.highlight === 'box') {
          const b = boxFor(L, w, 1);
          g.fillStyle = s.highlightColor;
          roundRectPath(g, cx - b.w / 2, by - L.capH - em * 0.14, b.w, b.h, b.r); g.fill();
        }
        const fill = isActive && s.highlight === 'color' ? s.highlightColor : isActive && s.highlight === 'box' ? s.highlightText : s.color;
        const bord = isActive && s.highlight === 'box' ? 0 : ref * s.outline / 100;
        const shad = isActive && s.highlight === 'box' ? 0 : ref * s.shadow / 100;
        if (s.glow > 0) {
          const gl = ref * s.glow / 100;
          g.save(); g.filter = `blur(${gl * 0.9}px)`; g.strokeStyle = s.glowColor; g.lineWidth = gl * 2;
          g.strokeText(w.text, cx, by); g.restore();
        }
        if (shad > 0) {
          g.save(); g.translate(shad, shad);
          g.fillStyle = hexA(s.shadowColor, s.shadowOpacity); g.strokeStyle = g.fillStyle;
          if (bord > 0) { g.lineWidth = bord * 2; g.strokeText(w.text, cx, by); }
          g.fillText(w.text, cx, by); g.restore();
        }
        if (bord > 0) { g.strokeStyle = s.outlineColor; g.lineWidth = bord * 2; g.strokeText(w.text, cx, by); }
        g.fillStyle = fill; g.fillText(w.text, cx, by);
        g.restore();
      }
    }
    g.restore();
  }

  // ---------- Export: ASS ----------
  const pad2 = (n) => String(n).padStart(2, '0');
  const assTime = (t) => { const cs = Math.max(0, Math.round(t * 100)); return `${Math.floor(cs / 360000)}:${pad2(Math.floor(cs / 6000) % 60)}:${pad2(Math.floor(cs / 100) % 60)}.${pad2(cs % 100)}`; };
  const bgr = (hex) => { const x = hex.replace('#', ''); return `&H${x.slice(4, 6)}${x.slice(2, 4)}${x.slice(0, 2)}&`.toUpperCase(); };
  const alphaHex = (a) => `&H${Math.round((1 - a) * 255).toString(16).padStart(2, '0').toUpperCase()}&`;
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\{/g, '(').replace(/\}/g, ')');
  const r1 = (n) => Math.round(n * 10) / 10;
  function rrDrawing(w, h, r) {
    const a = (n) => Math.round(n);
    return `m ${a(r)} 0 l ${a(w - r)} 0 b ${a(w)} 0 ${a(w)} 0 ${a(w)} ${a(r)} l ${a(w)} ${a(h - r)} b ${a(w)} ${a(h)} ${a(w)} ${a(h)} ${a(w - r)} ${a(h)} l ${a(r)} ${a(h)} b 0 ${a(h)} 0 ${a(h)} 0 ${a(h - r)} l 0 ${a(r)} b 0 0 0 0 ${a(r)} 0`;
  }

  function toASS(caps, style, { width = 1920, height = 1080, measure = roughMeasure, noSpace = false } = {}) {
    const W = width; const H = height;
    const s0 = { ...BASE, ...style };
    const f0 = Fonts.get(s0.font);
    const head = `[Script Info]
; Made with Captionshaper by Hollowbit
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${f0.ass},${Math.round(Math.min(W, H) * s0.size / 100)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
    const out = [];
    const ev = (layer, a, b, text) => { if (b - a >= 0.01) out.push(`Dialogue: ${layer},${assTime(a)},${assTime(b)},Default,,0,0,0,,${text}`); };
    for (const c of caps) {
      if (!c.words.length) continue;
      const L = layout(c, s0, { W, H, measure, noSpace });
      const { s, f, em } = L;
      const ref = L.ref;
      const fs = r1(L.assSize);
      const bordPx = r1(ref * s.outline / 100); const shadPx = r1(ref * s.shadow / 100); const glowPx = r1(ref * s.glow / 100);
      // Slices: the caption changes look whenever a new word is spoken.
      const perWord = s.highlight !== 'none' || s.animation === 'pop' || s.animation === 'fade' || s.upcoming !== 'show';
      const slices = perWord ? c.words.map((_, i) => [i, wordStart(c, i), i + 1 < c.words.length ? wordStart(c, i + 1) : c.end]) : [[-1, c.start, c.end]];
      const slide = s.animation === 'slide';
      const slideD = r1(em * 0.4);
      const fadeTag = slide ? '\\fad(180,100)' : '';
      if (s.box) {
        for (const line of L.lines) {
          const b = lineBox(L, line);
          const cx = r1(b.x + b.w / 2); const cy = r1(b.y + b.h / 2);
          const pos = slide ? `\\move(${cx},${r1(cy + slideD)},${cx},${cy},0,180)` : `\\pos(${cx},${cy})`;
          ev(0, c.start, c.end, `{\\an5${pos}\\bord0\\shad0\\1c${bgr(s.boxColor)}\\1a${alphaHex(s.boxOpacity)}${fadeTag}\\p1}${rrDrawing(b.w, b.h, b.r)}`);
        }
      }
      slices.forEach(([active, a, b], si) => {
        const first = si === 0;
        for (const line of L.lines) {
          for (const w of line.words) {
            const i = w.i;
            if (perWord && i > active && s.upcoming === 'hide') continue;
            const isActive = perWord && i === active;
            const cx = r1(w.cx);
            const cy = r1(L.centerFromBaseline(line.baseline));
            const pos = slide && first ? `\\move(${cx},${r1(cy + slideD)},${cx},${cy},0,180)` : `\\pos(${cx},${cy})`;
            const org = '';
            let anim = '';
            if (isActive && s.animation === 'pop') {
              const rest = s.highlight !== 'none' ? 106 : 100; const peak = rest + 14;
              anim = `\\fscx100\\fscy100\\t(0,80,\\fscx${peak}\\fscy${peak})\\t(80,160,\\fscx${rest}\\fscy${rest})`;
            }
            let alpha = 1;
            if (perWord && i > active && s.upcoming === 'dim') alpha = 0.4;
            const fadeIn = s.animation === 'fade' && isActive ? '\\fad(100,0)' : '';
            const last = si === slices.length - 1;
            const capFade = slide && (first || last) ? `\\fad(${first ? 180 : 0},${last ? 100 : 0})` : '';
            const fade = fadeIn || capFade;
            if (isActive && s.highlight === 'box') {
              const bx = boxFor(L, w, 1);
              const boxCy = r1(line.baseline - L.capH - em * 0.14 + bx.h / 2);
              ev(1, a, b, `{\\an5\\pos(${cx},${boxCy})${org}\\bord0\\shad0\\1c${bgr(s.highlightColor)}${anim}${fade}\\p1}${rrDrawing(bx.w, bx.h, bx.r)}`);
            }
            const fill = isActive && s.highlight === 'color' ? s.highlightColor : isActive && s.highlight === 'box' ? s.highlightText : s.color;
            const bord = isActive && s.highlight === 'box' ? 0 : bordPx;
            const shad = isActive && s.highlight === 'box' ? 0 : shadPx;
            const base = `\\an5${pos}${org}\\fn${f.ass}\\fs${fs}`;
            const a1 = alpha < 1 ? `\\alpha${alphaHex(alpha)}` : '';
            if (glowPx > 0) ev(0, a, b, `{${base}\\1a&HFF&\\bord${glowPx}\\blur${r1(glowPx * 0.9)}\\shad0\\3c${bgr(s.glowColor)}${a1 ? `\\3a${alphaHex(alpha)}` : ''}${anim}${fade}}${esc(w.text)}`);
            ev(2, a, b, `{${base}\\1c${bgr(fill)}\\bord${bord}\\3c${bgr(s.outlineColor)}\\shad${shad}\\4c${bgr(s.shadowColor)}\\4a${alphaHex(alpha * s.shadowOpacity)}${a1}${anim}${fade}}${esc(w.text)}`);
          }
        }
      });
    }
    return head + out.join('\n') + '\n';
  }

  return { BASE, PRESETS, fromPreset, normalizeStyle, layout, drawFrame, toASS, fitChars, roughMeasure, activeAt, wordStart };
}));

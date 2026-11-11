// Captionshaper window: home (drop a video), progress, and the caption editor.
const C = window.Captions;
const cs = window.cs;
const $ = (sel, el = document) => el.querySelector(sel);
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = $('#view');

const ICON = {
  film: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 15h4M13 15h4M7 11.5h10"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14" stroke-width="3"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  merge: '<svg viewBox="0 0 24 24"><path d="M8 4v5a4 4 0 0 0 4 4h0a4 4 0 0 1 4 4v3M16 4v5a4 4 0 0 1-4 4"/></svg>',
  split: '<svg viewBox="0 0 24 24"><path d="M12 3v18M5 8l-3 4 3 4M19 8l3 4-3 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  redo: '<svg viewBox="0 0 24 24"><path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/></svg>',
};

const LANGS = [['auto', 'Detect automatically'], ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['nl', 'Dutch'], ['pl', 'Polish'], ['ru', 'Russian'], ['uk', 'Ukrainian'], ['lt', 'Lithuanian'], ['lv', 'Latvian'], ['sv', 'Swedish'], ['no', 'Norwegian'], ['da', 'Danish'], ['fi', 'Finnish'], ['cs', 'Czech'], ['ro', 'Romanian'], ['hu', 'Hungarian'], ['el', 'Greek'], ['tr', 'Turkish'], ['ar', 'Arabic'], ['he', 'Hebrew'], ['hi', 'Hindi'], ['zh', 'Chinese'], ['ja', 'Japanese'], ['ko', 'Korean'], ['vi', 'Vietnamese'], ['th', 'Thai'], ['id', 'Indonesian']];
const LANG_NAME = Object.fromEntries(LANGS);
const MODEL_INFO = {
  best: { name: 'Recommended', d: 'Large v3 Turbo. Accurate and quick: about 5x faster than real time on Apple Silicon.' },
  max: { name: 'Most accurate', d: 'Large v3. Best for languages other than English and for hard audio. About half the speed of Recommended.' },
  fast: { name: 'Fast', d: 'Base. Quick drafts and slower computers. More mistakes.' },
};

let S = null; // state from the main process
let current = null; // { media, project, history, future }
const fmtTime = (t, ms = false) => {
  t = Math.max(0, t || 0);
  const m = Math.floor(t / 60); const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}${ms ? '.' + String(Math.floor((t % 1) * 10)) : ''}`;
};
const fmtMB = (b) => `${Math.round(b / 1e6)} MB`;

function toast(msg, { bad = false, action, onAction, ms = 4200 } = {}) {
  const el = h(`<div class="toast${bad ? ' bad' : ''}"><span>${esc(msg)}</span>${action ? `<button>${esc(action)}</button>` : ''}</div>`);
  if (action) el.querySelector('button').onclick = () => { onAction(); el.remove(); };
  $('#toasts').append(el);
  setTimeout(() => el.remove(), ms);
}

// ---------- Home ----------
async function renderHome() {
  if (current && current.video) { current.video.pause(); }
  current = null;
  S = await cs.getState();
  const m = S.models.find((x) => x.id === S.settings.model) || S.models[0];
  const el = h(`<div class="home"><div class="home-inner">
    <div class="brand"><img src="../../assets/icon.png" alt=""><div><h1>Captionshaper</h1><div class="by">by Hollowbit</div></div></div>
    <div class="dropzone" id="dz">
      <div class="demo" aria-hidden="true"><div class="wave">${'<i></i>'.repeat(36)}</div><div class="line" id="demo-line"></div></div>
      <div class="t">Drop a video to caption it</div>
      <div class="d">Captionshaper listens on this computer and writes every word with its timing. Then fix anything it got wrong and export.</div>
      <button class="btn primary big" id="choose">Choose video</button>
    </div>
    <div class="opts">
      <div class="opt">Language <select class="sel" id="lang">${LANGS.map(([k, v]) => `<option value="${k}"${k === S.settings.language ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="opt">Model <div class="seg" id="model">${S.models.map((x) => `<button data-id="${x.id}" class="${x.id === m.id ? 'on' : ''}">${MODEL_INFO[x.id].name}</button>`).join('')}</div></div>
      <label class="opt check"><input type="checkbox" id="tr"${S.settings.translate ? ' checked' : ''}> Translate to English</label>
    </div>
    <div id="model-slot"></div>
    ${S.available ? '' : '<div class="model-card"><div class="t">Speech engine missing</div><div class="d">This build has no speech engine for this computer yet.</div></div>'}
    ${S.recent.length ? `<div class="recent"><h2>Recent</h2>${S.recent.map((r) => `<button class="recent-row" data-file="${esc(r.file)}"><span class="n">${esc(r.name)}</span><span class="m num">${fmtTime(r.duration)}</span></button>`).join('')}</div>` : ''}
    <div class="foot"><span class="dot"></span>Offline. Your videos never leave this computer. <span>·</span> <button class="btn ghost" id="theme" style="height:22px;padding:0 6px">${S.settings.theme === 'light' ? 'Dark mode' : 'Light mode'}</button></div>
  </div></div>`);
  view.replaceChildren(el);
  $('#choose', el).onclick = async () => { const f = await cs.pickVideo(); if (f) openFile(f); };
  $('#lang', el).onchange = (e) => cs.setSettings({ language: e.target.value });
  $('#tr', el).onchange = (e) => cs.setSettings({ translate: e.target.checked });
  $('#theme', el).onclick = async () => { const t = S.settings.theme === 'light' ? 'dark' : 'light'; await cs.setSettings({ theme: t }); applyTheme(t); renderHome(); };
  el.querySelectorAll('#model button').forEach((b) => { b.onclick = async () => { await cs.setSettings({ model: b.dataset.id }); renderHome(); }; });
  el.querySelectorAll('.recent-row').forEach((b) => { b.onclick = () => openFile(b.dataset.file); });
  const dz = $('#dz', el);
  dz.addEventListener('dragover', () => dz.classList.add('over'));
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  renderModelCard();
  startDemo();
}

// The home screen shows what Captionshaper makes: a caption lighting up word by word.
const DEMO = [['Every', 'word,'], ['right', 'on', 'time.'], ['Nothing', 'gets', 'uploaded.']];
let demoTimer = null;
function startDemo() {
  clearInterval(demoTimer);
  const line = $('#demo-line'); if (!line) return;
  line.parentElement.querySelectorAll('.wave i').forEach((b, i) => { b.style.animationDelay = `${(i * 97) % 1400}ms`; });
  let p = 0; let w = -1;
  const step = () => {
    if (!document.body.contains(line)) return clearInterval(demoTimer);
    const words = DEMO[p];
    w++;
    if (w >= words.length + 2) { p = (p + 1) % DEMO.length; w = 0; }
    const ws = DEMO[p];
    line.innerHTML = ws.map((x, i) => `<span class="${i === w ? 'on' : i > w ? 'off' : ''}">${x}</span>`).join(' ');
  };
  step(); demoTimer = setInterval(step, 420);
}

function renderModelCard() {
  const slot = $('#model-slot'); if (!slot || !S) return;
  const m = S.models.find((x) => x.id === S.settings.model) || S.models[0];
  if (m.installed) { slot.replaceChildren(); return; }
  const info = MODEL_INFO[m.id];
  const card = h(`<div class="model-card">
    <div class="t">Download the speech model once</div>
    <div class="d">${info.name}: ${fmtMB(m.size)}. It's saved on this computer, so after this Captionshaper works without the internet.</div>
    <div class="acts">${m.downloading ? '<button class="btn" id="dl-cancel">Cancel</button>' : '<button class="btn primary" id="dl">Download</button>'}</div>
    ${m.downloading ? '<div class="bar"><i id="dl-bar"></i></div>' : ''}
  </div>`);
  slot.replaceChildren(card);
  const dl = $('#dl', card); if (dl) dl.onclick = () => startDownload(m.id);
  const c = $('#dl-cancel', card); if (c) c.onclick = () => cs.cancelDownload(m.id);
}
let afterDownload = null;
async function startDownload(id) {
  await cs.downloadModel(id);
  S.models = await cs.models();
  renderModelCard();
}
cs.onModelProgress(async (p) => {
  const bar = $('#dl-bar');
  if (bar && p.total) bar.style.width = `${(100 * p.got / p.total).toFixed(1)}%`;
  if (p.done || p.error) {
    S.models = await cs.models();
    if (p.error && p.error !== 'cancelled') toast(p.error, { bad: true });
    if (!current) renderModelCard();
    if (p.done && afterDownload) { const f = afterDownload; afterDownload = null; openFile(f); }
  }
});

// ---------- Opening a file ----------
async function openFile(file) {
  let media;
  try { media = await cs.openMedia(file); } catch (e) { toast(e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), { bad: true }); return; }
  if (media.project && media.project.captions) return renderEditor(media, media.project);
  S = await cs.getState();
  const m = S.models.find((x) => x.id === S.settings.model) || S.models[0];
  if (!m.installed) {
    if (current) await renderHome();
    afterDownload = file;
    if (!m.downloading) await startDownload(m.id);
    toast('Downloading the speech model first. Your video opens when it’s done.');
    return;
  }
  runTranscription(media, m.id);
}

// Draws the audio overview. Speech regions are lit; `upto` (0..1) lights everything before it.
function drawWave(canvas, peaks, { regions = [], duration = 1, upto = null, sweep = null } = {}) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth; const hh = canvas.clientHeight;
  if (!w || !hh) return;
  if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr); }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, hh);
  if (!peaks || !peaks.length) return;
  const bar = 2; const gap = 1; const n = Math.floor(w / (bar + gap));
  const speech = (t) => regions.some((r) => t >= r.start && t <= r.end);
  const lit = g.createLinearGradient(0, 0, 0, hh); lit.addColorStop(0, '#d8ff6a'); lit.addColorStop(1, '#3dffb0');
  for (let i = 0; i < n; i++) {
    const t0 = i / n; const k = Math.floor(t0 * peaks.length);
    const v = Math.max(0.04, peaks[Math.min(peaks.length - 1, k)]);
    const bh = Math.max(2, v * (hh - 6));
    const x = i * (bar + gap); const y = (hh - bh) / 2;
    const isSpeech = regions.length ? speech(t0 * duration) : true;
    const done = upto == null || t0 <= upto;
    g.fillStyle = isSpeech && done ? lit : 'rgba(214,255,190,.16)';
    g.globalAlpha = isSpeech ? 1 : 0.7;
    g.fillRect(x, y, bar, bh);
  }
  g.globalAlpha = 1;
  if (sweep != null) {
    const x = sweep * w;
    const sg = g.createLinearGradient(x - 60, 0, x, 0); sg.addColorStop(0, 'rgba(198,255,61,0)'); sg.addColorStop(1, 'rgba(198,255,61,.35)');
    g.fillStyle = sg; g.fillRect(x - 60, 0, 60, hh);
  }
}

async function runTranscription(media, modelId) {
  const jobId = `t${Date.now()}`;
  const el = h(`<div class="working"><div class="work-card">
    <div class="wk-head"><div class="name">${esc(media.name)}</div><div class="wk-stage" id="wk-stage">Reading the audio</div></div>
    <div class="wk-wave"><canvas id="wk-canvas"></canvas></div>
    <div class="wk-bar"><i id="wk-bar"></i></div>
    <div class="wk-text" id="wk-text"><span class="wk-ph">Words appear here as they’re written…</span></div>
    <div class="wk-foot"><span class="note">${fmtTime(media.info.duration)} of audio · everything happens on this computer</span><button class="btn" id="cancel">Cancel</button></div>
  </div></div>`);
  view.replaceChildren(el);
  const canvas = $('#wk-canvas', el); const textBox = $('#wk-text', el);
  const st = { peaks: null, regions: [], pct: 0, shown: 0, queue: [], stage: 'audio', t0: performance.now() };
  const STAGE = { audio: 'Reading the audio', speech: 'Finding speech', words: 'Writing the words' };
  const setPct = (x) => { st.pct = Math.max(st.pct, x); $('#wk-bar', el).style.width = `${st.pct}%`; };
  progressHandlers.set(jobId, (p) => {
    if (p.stage !== st.stage) { st.stage = p.stage; $('#wk-stage', el).textContent = STAGE[p.stage] || ''; }
    if (p.peaks) st.peaks = p.peaks;
    if (p.regions) st.regions = p.regions;
    if (p.stage === 'audio') setPct(3);
    if (p.stage === 'speech') setPct(p.regions ? 14 : 8);
    if (p.stage === 'words' && p.pct != null) setPct(14 + p.pct * 0.86);
    if (p.words) st.queue.push(...p.words);
  });
  // Animation: the wave sweeps while working; words type in one by one.
  let raf;
  const frame = () => {
    if (!document.body.contains(canvas)) return;
    const dur = media.info.duration || 1;
    const upto = st.stage === 'words' ? Math.max(0, (st.pct - 14) / 86) : (st.regions.length ? 1 : 0);
    const sweep = st.stage === 'speech' && !st.regions.length ? ((performance.now() - st.t0) / 1400) % 1 : null;
    drawWave(canvas, st.peaks, { regions: st.regions, duration: dur, upto: st.stage === 'words' ? upto : 1, sweep });
    if (st.queue.length && performance.now() - (st.lastWord || 0) > Math.max(18, 90 - st.queue.length * 3)) {
      st.lastWord = performance.now();
      const w = st.queue.shift();
      const ph = textBox.querySelector('.wk-ph'); if (ph) ph.remove();
      const span = document.createElement('span'); span.className = 'wk-w'; span.textContent = (st.shown ? ' ' : '') + w.text;
      textBox.append(span); st.shown++;
      textBox.scrollTop = textBox.scrollHeight;
    }
    raf = requestAnimationFrame(frame);
  };
  frame();
  let cancelled = false;
  $('#cancel', el).onclick = () => { cancelled = true; cs.cancelJob(jobId); };
  try {
    const r = await cs.transcribe({ jobId, file: media.file, modelId, language: S.settings.language, translate: !!S.settings.translate });
    if (!r.words.length) { toast('No speech found in this file.', { bad: true }); return renderHome(); }
    // Let the last words finish typing.
    setPct(100);
    for (let i = 0; i < 40 && st.queue.length; i++) await new Promise((res) => setTimeout(res, 50));
    await new Promise((res) => setTimeout(res, 350));
    const style = { ...C.STYLES[S.settings.style] || C.STYLES.clean, preset: S.settings.style || 'clean' };
    const captions = C.buildCaptions(r.words, { noSpace: r.noSpace, maxChars: lineChars(style, media.info), maxLines: style.maxLines, maxWords: style.maxWords });
    const project = { v: 1, language: r.language, noSpace: r.noSpace, regions: r.regions, peaks: r.peaks, style, captions, model: modelId };
    renderEditor(media, project);
    saveNow();
    const strong = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ja', 'zh', 'ko', 'ru', 'pl'];
    if (modelId !== 'max' && !strong.includes(r.language)) {
      toast(`For ${LANG_NAME[r.language] || 'this language'}, the Most accurate model makes fewer mistakes.`, { action: 'Use it', ms: 9000, onAction: () => retranscribeMenu($('#redo-tx')) });
    }
  } catch (e) {
    if (cancelled || /Cancelled/.test(e.message)) return renderHome();
    toast(e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), { bad: true, ms: 8000 });
    renderHome();
  } finally { progressHandlers.delete(jobId); cancelAnimationFrame(raf); }
}
const progressHandlers = new Map();
cs.onProgress((p) => { const f = progressHandlers.get(p.jobId); if (f) f(p); });

// ---------- Editor ----------
function renderEditor(media, project) {
  current = { media, project, history: [], future: [], active: -1, editing: null };
  const { info } = media;
  const el = h(`<div class="editor">
    <div class="topbar">
      <button class="btn ghost icon" id="back" title="Back">${ICON.back}</button>
      <div class="file">${esc(media.name)}</div>
      <div class="meta num">${fmtTime(info.duration)} · ${esc(LANG_NAME[project.language] || project.language)}</div>
      <div class="sp"></div>
      <span class="saved" id="saved"></span>
      <button class="btn ghost icon" id="undo" title="Undo (⌘Z)">${ICON.undo}</button>
      <button class="btn ghost icon" id="redo" title="Redo (⇧⌘Z)">${ICON.redo}</button>
      <button class="btn" id="redo-tx" title="Transcribe again">Re-transcribe</button>
      <button class="btn primary" id="export">Export ${ICON.down}</button>
    </div>
    <div class="ed-body">
      <div class="left">
        <div class="stage-wrap"><div class="player${info.hasVideo ? '' : ' audio-only'}${isVertical(info) ? ' phone' : ''}" id="player">
          <video id="video" src="${cs.fileUrl(media.file)}" preload="auto" playsinline></video>
          ${isVertical(info) ? PHONE_UI : ''}
          <div class="overlay" id="overlay"></div>
        </div></div>
        <div class="transport">
          <div class="tp-row">
            <button class="btn icon" id="play" title="Play (Space)">${ICON.play}</button>
            <span class="time" id="time">0:00 / ${fmtTime(info.duration)}</span>
            <div class="sp" style="flex:1"></div>
            ${isVertical(info) ? '<button class="btn ghost" id="phone-toggle" title="Show the app buttons that cover your video">Phone view</button>' : ''}
            <span class="time" id="count"></span>
          </div>
          <div class="timeline" id="timeline"></div>
        </div>
      </div>
      <div class="right">
        <div class="tabs"><div class="seg" id="tabs"><button data-t="captions" class="on">Captions</button><button data-t="style">Style</button></div><div class="sp"></div></div>
        <div class="panel" id="panel"></div>
      </div>
    </div>
  </div>`);
  view.replaceChildren(el);
  const video = $('#video', el);
  current.video = video;
  current.tab = 'captions';
  $('#back', el).onclick = () => renderHome();
  $('#undo', el).onclick = undo; $('#redo', el).onclick = redo;
  $('#export', el).onclick = (e) => exportMenu(e.currentTarget);
  $('#redo-tx', el).onclick = () => retranscribeMenu($('#redo-tx', el));
  $('#play', el).onclick = togglePlay;
  video.addEventListener('play', () => { $('#play').innerHTML = ICON.pause; });
  video.addEventListener('pause', () => { $('#play').innerHTML = ICON.play; });
  video.addEventListener('click', togglePlay);
  el.querySelectorAll('#tabs button').forEach((b) => { b.onclick = () => { el.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x === b)); current.tab = b.dataset.t; renderPanel(); }; });
  const tl = $('#timeline', el);
  tl.addEventListener('pointerdown', (e) => {
    const seek = (ev) => { const r = tl.getBoundingClientRect(); video.currentTime = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * info.duration; };
    seek(e); tl.setPointerCapture(e.pointerId);
    tl.onpointermove = seek; tl.onpointerup = () => { tl.onpointermove = null; };
  });
  const pt = $('#phone-toggle', el);
  if (pt) {
    pt.classList.add('on');
    pt.onclick = () => { const p = $('#player'); p.classList.toggle('phone-ui-off'); pt.classList.toggle('on', !p.classList.contains('phone-ui-off')); };
  }
  renderPanel();
  renderTimeline();
  if (!project.peaks) cs.peaks(media.file).then((pk) => { if (current && current.project === project) { project.peaks = pk; renderTimeline(); scheduleSave(); } }).catch(() => {});
  new ResizeObserver(() => drawTimelineWave()).observe(tl);
  tick();
}

const isVertical = (info) => info.hasVideo && info.height > info.width * 1.2;
// The buttons TikTok, Reels and Shorts lay over a vertical video, so you can see what your captions must avoid.
const PHONE_UI = `<div class="phone-ui" aria-hidden="true">
  <div class="pu-side">
    <span class="pu-av"></span>
    <span class="pu-ic"><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.3-8.8-8.7C1.9 8 4 4.8 7.2 4.8c1.9 0 3.4 1 4.8 2.8 1.4-1.8 2.9-2.8 4.8-2.8 3.2 0 5.3 3.2 4 6.5C19 15.7 12 20 12 20z" fill="#fff" stroke="none"/></svg><b>12.4K</b></span>
    <span class="pu-ic"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 1 3.5 6.6L4 20l1.3-3.6A7.9 7.9 0 0 1 4 12z" fill="#fff" stroke="none"/></svg><b>318</b></span>
    <span class="pu-ic"><svg viewBox="0 0 24 24"><path d="M13 5l8 7-8 7v-4c-5 0-8 1.5-10 5 .5-6 3.5-10 10-11V5z" fill="#fff" stroke="none"/></svg><b>Share</b></span>
  </div>
  <div class="pu-bottom"><b>@you</b><span>your caption goes here #fyp</span><i>♫ original sound</i></div>
</div>`;

function togglePlay() { const v = current && current.video; if (!v) return; if (v.paused) v.play(); else v.pause(); }

function tick() {
  if (!current || !current.video) return;
  const v = current.video;
  const t = v.currentTime;
  const caps = current.project.captions;
  let idx = -1;
  for (let i = 0; i < caps.length; i++) { if (t >= caps[i].start && t < caps[i].end) { idx = i; break; } if (caps[i].start > t) break; }
  drawOverlay(idx, t);
  if (idx !== current.active) {
    current.active = idx;
    document.querySelectorAll('.row.on').forEach((r) => r.classList.remove('on'));
    document.querySelectorAll('.blk.on').forEach((r) => r.classList.remove('on'));
    if (idx >= 0) {
      const row = document.querySelector(`.row[data-i="${idx}"]`);
      if (row) { row.classList.add('on'); if (current.editing == null) row.scrollIntoView({ block: v.paused ? 'center' : 'nearest', behavior: 'smooth' }); }
      const blk = document.querySelector(`.blk[data-i="${idx}"]`); if (blk) blk.classList.add('on');
    }
  }
  // Light up the spoken word in the caption list too.
  let wi = -1;
  if (idx >= 0) { const c = caps[idx]; for (let i = 0; i < c.words.length; i++) if (t >= (i === 0 ? c.start : c.words[i].start)) wi = i; }
  const wkey = `${idx}:${wi}`;
  if (wkey !== current.wordKey) {
    current.wordKey = wkey;
    document.querySelectorAll('.wd.sp').forEach((x) => x.classList.remove('sp'));
    if (idx >= 0 && current.editing !== idx) { const x = document.querySelector(`.tx[data-i="${idx}"] .wd[data-w="${wi}"]`); if (x) x.classList.add('sp'); }
  }
  const head = $('#tl-head'); if (head) head.style.left = `${(100 * t / current.media.info.duration).toFixed(3)}%`;
  const time = $('#time'); if (time) time.textContent = `${fmtTime(t)} / ${fmtTime(current.media.info.duration)}`;
  requestAnimationFrame(tick);
}

// Live preview: the same style numbers as the burned-in ASS file, in CSS.
let lastDraw = '';
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function drawOverlay(idx, t) {
  const ov = $('#overlay'); if (!ov) return;
  const s = current.project.style;
  const c = current.project.captions[idx];
  let active = -1;
  if (c && s.highlight) { for (let i = 0; i < c.words.length; i++) if (t >= (i === 0 ? c.start : c.words[i].start)) active = i; }
  const key = `${idx}|${active}|${current.styleRev || 0}|${current.textRev || 0}`;
  if (key === lastDraw) return; lastDraw = key;
  if (!c) { ov.replaceChildren(); return; }
  const breaks = new Set(c.lineBreaks || []);
  const lines = [[]];
  c.words.forEach((w, i) => { if (i > 0 && breaks.has(i)) lines.push([]); lines[lines.length - 1].push(i); });
  const sep = current.project.noSpace ? '' : ' ';
  const word = (i) => {
    let tx = c.words[i].text; if (s.caps === 'strip' || s.stripPunct) tx = C.stripPunct(tx);
    tx = C.applyCase(tx, s.caps);
    return `<span class="w" style="${i === active ? `color:${s.highlightColor}` : ''}">${esc(tx)}</span>`;
  };
  const pos = s.position === 'top' ? `top:${s.margin}cqh` : s.position === 'middle' ? 'top:50%;transform:translateY(-50%)' : `bottom:${s.margin}cqh`;
  const stroke = s.box ? '' : `-webkit-text-stroke:${(s.outline * 2).toFixed(3)}cqmin ${s.outlineColor};`;
  const shadow = !s.box && s.shadow ? `text-shadow:${s.shadow}cqmin ${s.shadow}cqmin 0 ${hexA(s.outlineColor, 0.65)};` : '';
  const box = s.box ? `background:${hexA(s.boxColor, s.boxOpacity)};padding:0 ${(s.size * 0.22).toFixed(3)}cqmin;` : '';
  ov.innerHTML = `<div class="cap${s.box ? ' boxed' : ''}" style="${pos};font-family:Geist;font-weight:${s.weight};font-size:${(s.size / C.FONT_SCALE).toFixed(3)}cqmin;color:${s.color};${stroke}${shadow}">${
    lines.map((ln) => `<span class="ln"><span class="txt" style="${box}">${ln.map(word).join(sep)}</span></span>`).join('')}</div>`;
}

function drawTimelineWave() {
  const cv = $('#tl-wave'); if (!cv || !current) return;
  drawWave(cv, current.project.peaks, { regions: current.project.regions || [], duration: current.media.info.duration || 1 });
}
function renderTimeline() {
  const tl = $('#timeline'); if (!tl) return;
  const d = current.media.info.duration || 1;
  const caps = current.project.captions;
  tl.innerHTML = '<canvas id="tl-wave"></canvas>'
    + caps.map((c, i) => `<div class="blk" data-i="${i}" style="left:${100 * c.start / d}%;width:${Math.max(0.15, 100 * (c.end - c.start) / d)}%">${esc(C.joinWords(c.words, current.project.noSpace))}</div>`).join('')
    + '<div class="head" id="tl-head"></div>';
  const count = $('#count'); if (count) count.textContent = `${caps.length} captions`;
  current.active = -2;
  requestAnimationFrame(drawTimelineWave);
}

// ---------- Panels ----------
function renderPanel() {
  const p = $('#panel'); if (!p) return;
  if (current.tab === 'style') return renderStyle(p);
  renderCaptions(p);
}

function captionHTML(c, findRe) {
  const sep = current.project.noSpace ? '' : ' ';
  const breaks = new Set(c.lineBreaks || []);
  return c.words.map((w, i) => {
    let t = esc(w.text);
    if (findRe) t = t.replace(findRe, (m) => `<mark>${m}</mark>`);
    const lo = w.p != null && w.p < 0.45;
    t = `<span class="wd${lo ? ' lo' : ''}" data-w="${i}"${lo ? ' title="Not sure about this word"' : ''}>${t}</span>`;
    return (i === 0 ? '' : breaks.has(i) ? '\n' : sep) + t;
  }).join('');
}

function renderCaptions(p) {
  const caps = current.project.captions;
  const find = current.find || '';
  const findRe = find ? new RegExp(esc(find).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi') : null;
  const el = h(`<div>
    <div class="find"><input id="find" placeholder="Find" value="${esc(find)}"><input id="repl" placeholder="Replace with" value="${esc(current.repl || '')}"><button class="btn" id="repl-all"${find ? '' : ' disabled'}>Replace all</button></div>
    <div class="caps-list" id="caps-list">${caps.length ? caps.map((c, i) => {
      const cps = C.joinWords(c.words, current.project.noSpace).length / Math.max(0.1, c.end - c.start);
      return `<div class="row" data-i="${i}">
        <button class="tc num" data-seek="${i}" title="Play from here">${fmtTime(c.start, true)}<br>${fmtTime(c.end, true)}</button>
        <div class="tx" contenteditable="plaintext-only" spellcheck="true" data-i="${i}">${captionHTML(c, findRe)}</div>
        ${cps > 25 ? '<div class="warn">Fast to read. Consider shortening.</div>' : ''}
        <div class="acts"><button data-act="split" title="Split at cursor">${ICON.split}</button><button data-act="merge" title="Merge with next">${ICON.merge}</button><button data-act="del" title="Delete">${ICON.trash}</button></div>
      </div>`;
    }).join('') : '<div class="empty">No captions.</div>'}</div>
  </div>`);
  p.replaceChildren(el);
  const findIn = $('#find', el);
  findIn.oninput = () => { current.find = findIn.value; const pos = findIn.selectionStart; renderCaptions(p); const f = $('#find'); f.focus(); f.setSelectionRange(pos, pos); };
  $('#repl', el).oninput = (e) => { current.repl = e.target.value; };
  $('#repl-all', el).onclick = () => replaceAll(current.find, current.repl || '');
  el.querySelectorAll('[data-seek]').forEach((b) => { b.onclick = () => { const c = caps[+b.dataset.seek]; current.video.currentTime = c.start + 0.001; current.video.play(); }; });
  el.querySelectorAll('.tx').forEach((tx) => {
    tx.addEventListener('focus', () => {
      current.editing = +tx.dataset.i;
      tx.textContent = C.captionLines(caps[+tx.dataset.i], current.project.noSpace).join('\n');
      const v = current.video; const c = caps[+tx.dataset.i];
      if (v.paused && (v.currentTime < c.start || v.currentTime >= c.end)) v.currentTime = c.start + 0.001;
    });
    tx.addEventListener('blur', () => { commitText(+tx.dataset.i, tx.innerText); current.editing = null; });
    tx.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const i = +tx.dataset.i; tx.blur();
        const next = document.querySelector(`.tx[data-i="${i + 1}"]`); if (next) next.focus();
      }
      if (e.key === 'Escape') { e.preventDefault(); tx.blur(); }
    });
  });
  el.querySelectorAll('.acts button').forEach((b) => {
    b.onmousedown = (e) => e.preventDefault(); // keep the caret where it is
    b.onclick = () => {
      const row = b.closest('.row'); const i = +row.dataset.i;
      if (b.dataset.act === 'del') deleteCaption(i);
      if (b.dataset.act === 'merge') mergeCaption(i);
      if (b.dataset.act === 'split') splitCaption(i, row.querySelector('.tx'));
    };
  });
  if (current.active >= 0) { const r = el.querySelector(`.row[data-i="${current.active}"]`); if (r) r.classList.add('on'); }
}

function renderStyle(p) {
  const s = current.project.style;
  const pv = (k) => {
    const st = C.STYLES[k];
    const txt = st.caps === 'upper' ? 'LIKE <b style="color:' + st.highlightColor + '">THIS</b>' : 'Captions like this';
    const css = st.box ? `background:rgba(0,0,0,.72);padding:3px 7px;border-radius:3px;font-weight:${st.weight};font-size:13px`
      : `font-weight:${st.weight};-webkit-text-stroke:${st.outline > .4 ? 3 : 2}px #000;paint-order:stroke fill;font-size:${st.caps === 'upper' ? 18 : 14}px`;
    return `<button class="preset${s.preset === k ? ' on' : ''}" data-k="${k}"><span class="pv" style="${css}">${txt}</span><span class="nm">${st.name}</span></button>`;
  };
  const el = h(`<div class="style-panel">
    <div class="presets">${Object.keys(C.STYLES).map(pv).join('')}</div>
    <div class="sub-h">Text</div>
    <label class="field">Size<input type="range" id="size" min="2.5" max="14" step="0.1" value="${s.size}"></label>
    <div class="grid2">
      <label class="field">Position<div class="seg" id="pos">${['top', 'middle', 'bottom'].map((x) => `<button data-v="${x}" class="${s.position === x ? 'on' : ''}">${x[0].toUpperCase() + x.slice(1)}</button>`).join('')}</div></label>
      <label class="field">Weight<div class="seg" id="weight">${[[600, 'Regular'], [700, 'Bold'], [900, 'Heavy']].map(([v, n]) => `<button data-v="${v}" class="${s.weight === v ? 'on' : ''}">${n}</button>`).join('')}</div></label>
    </div>
    <label class="field">Distance from edge<input type="range" id="margin" min="2" max="45" step="0.5" value="${s.margin}"${s.position === 'middle' ? ' disabled' : ''}></label>
    <div class="colors">
      <label>Text <input type="color" id="color" value="${s.color}"></label>
      <label>${s.box ? 'Box' : 'Outline'} <input type="color" id="ocolor" value="${s.box ? s.boxColor : s.outlineColor}"></label>
      <label>Highlight <input type="color" id="hcolor" value="${s.highlightColor}"></label>
    </div>
    <label class="check"><input type="checkbox" id="hl"${s.highlight ? ' checked' : ''}> Highlight the word being spoken</label>
    <label class="check"><input type="checkbox" id="box"${s.box ? ' checked' : ''}> Background box</label>
    <label class="check"><input type="checkbox" id="upper"${s.caps === 'upper' ? ' checked' : ''}> ALL CAPS</label>
    <label class="check"><input type="checkbox" id="strip"${s.stripPunct ? ' checked' : ''}> Hide commas and full stops</label>
    <div class="sub-h">Caption length</div>
    <div class="seg" id="len">${[['1', 'One word'], ['short', 'Short'], ['medium', 'Medium'], ['long', 'Two lines']].map(([v, n]) => `<button data-v="${v}" class="${lenKey(s) === v ? 'on' : ''}">${n}</button>`).join('')}</div>
    <p class="note">Changing the length splits the captions again from your corrected words. Your text edits are kept.</p>
  </div>`);
  p.replaceChildren(el);
  const set = (patch, resplit = false) => { pushHistory(); Object.assign(current.project.style, patch); if (resplit) resegment(); styleChanged(); };
  el.querySelectorAll('.preset').forEach((b) => { b.onclick = () => { const st = C.STYLES[b.dataset.k]; set({ ...st, preset: b.dataset.k, stripPunct: false }, true); cs.setSettings({ style: b.dataset.k }); renderPanel(); }; });
  $('#size', el).oninput = (e) => { Object.assign(current.project.style, { size: +e.target.value }); styleChanged(); };
  $('#size', el).onchange = () => pushHistory();
  $('#margin', el).oninput = (e) => { Object.assign(current.project.style, { margin: +e.target.value }); styleChanged(); };
  el.querySelectorAll('#pos button').forEach((b) => { b.onclick = () => { set({ position: b.dataset.v, margin: b.dataset.v === 'middle' ? s.margin : Math.min(s.margin, 20) }); renderPanel(); }; });
  el.querySelectorAll('#weight button').forEach((b) => { b.onclick = () => { set({ weight: +b.dataset.v }); renderPanel(); }; });
  $('#color', el).oninput = (e) => { current.project.style.color = e.target.value; styleChanged(); };
  $('#ocolor', el).oninput = (e) => { current.project.style[s.box ? 'boxColor' : 'outlineColor'] = e.target.value; styleChanged(); };
  $('#hcolor', el).oninput = (e) => { current.project.style.highlightColor = e.target.value; styleChanged(); };
  $('#hl', el).onchange = (e) => set({ highlight: e.target.checked });
  $('#box', el).onchange = (e) => { set({ box: e.target.checked }); renderPanel(); };
  $('#upper', el).onchange = (e) => set({ caps: e.target.checked ? 'upper' : 'none' });
  $('#strip', el).onchange = (e) => set({ stripPunct: e.target.checked });
  el.querySelectorAll('#len button').forEach((b) => { b.onclick = () => { set(LENGTHS[b.dataset.v], true); renderPanel(); }; });
}
const LENGTHS = {
  1: { maxWords: 1, maxLines: 1, maxChars: 14 },
  short: { maxWords: 4, maxLines: 2, maxChars: 16 },
  medium: { maxWords: 0, maxLines: 1, maxChars: 32 },
  long: { maxWords: 0, maxLines: 2, maxChars: 42 },
};
function lenKey(s) { return Object.keys(LENGTHS).find((k) => LENGTHS[k].maxWords === s.maxWords && LENGTHS[k].maxLines === s.maxLines && LENGTHS[k].maxChars === s.maxChars) || ''; }

// Characters per line for this video: the style's limit, or less if the text wouldn't fit.
function lineChars(style, info) {
  if (!info.hasVideo || !info.width) return style.maxChars;
  return C.fitChars(style, info.width, info.height);
}
function styleChanged() { current.styleRev = (current.styleRev || 0) + 1; lastDraw = ''; scheduleSave(); }

function resegment() {
  const words = current.project.captions.flatMap((c) => c.words);
  const s = current.project.style;
  current.project.captions = C.buildCaptions(words, { noSpace: current.project.noSpace, maxChars: lineChars(s, current.media.info), maxLines: s.maxLines, maxWords: s.maxWords });
  captionsChanged();
}

// ---------- Editing ----------
const snapshot = () => JSON.stringify({ captions: current.project.captions, style: current.project.style });
function pushHistory() { current.history.push(snapshot()); if (current.history.length > 200) current.history.shift(); current.future = []; }
function restore(snap) { const o = JSON.parse(snap); current.project.captions = o.captions; current.project.style = o.style; captionsChanged(); styleChanged(); renderPanel(); }
function undo() { if (!current || !current.history.length) return; current.future.push(snapshot()); restore(current.history.pop()); }
function redo() { if (!current || !current.future.length) return; current.history.push(snapshot()); restore(current.future.pop()); }

function captionsChanged() {
  current.textRev = (current.textRev || 0) + 1; lastDraw = '';
  current.project.captions.forEach((c, i) => { c.id = `c${i + 1}`; });
  renderTimeline();
  scheduleSave();
}

function commitText(i, text) {
  const c = current.project.captions[i]; if (!c) return;
  const before = C.captionLines(c, current.project.noSpace).join('\n');
  const clean = text.replace(/ /g, ' ').replace(/\n{2,}/g, '\n').trim();
  if (clean === before) { renderRow(i); return; }
  pushHistory();
  if (!clean) { current.project.captions.splice(i, 1); captionsChanged(); renderPanel(); return; }
  const s = current.project.style;
  current.project.captions[i] = C.applyText(c, clean, { noSpace: current.project.noSpace, maxChars: lineChars(s, current.media.info), maxLines: s.maxLines });
  captionsChanged(); renderRow(i);
}
function renderRow(i) {
  const tx = document.querySelector(`.tx[data-i="${i}"]`);
  if (tx && document.activeElement !== tx) tx.innerHTML = captionHTML(current.project.captions[i]);
}
function deleteCaption(i) { pushHistory(); current.project.captions.splice(i, 1); captionsChanged(); renderPanel(); }
function mergeCaption(i) {
  const caps = current.project.captions; if (i >= caps.length - 1) return;
  pushHistory();
  const a = caps[i]; const b = caps[i + 1];
  const words = [...a.words, ...b.words];
  const s = current.project.style;
  const lines = C.wrap(words, lineChars({ ...s, maxChars: Math.max(s.maxChars, 42) }, current.media.info), 2, current.project.noSpace) || [[0, words.length]];
  caps.splice(i, 2, { id: a.id, start: a.start, end: b.end, words, lineBreaks: lines.slice(1).map((l) => l[0]) });
  captionsChanged(); renderPanel();
}
function splitCaption(i, tx) {
  const caps = current.project.captions; const c = caps[i];
  if (c.words.length < 2) return;
  // Word index at the caret (or the middle).
  let k = Math.ceil(c.words.length / 2);
  const sel = window.getSelection();
  if (sel.rangeCount && tx.contains(sel.anchorNode)) {
    const r = document.createRange(); r.selectNodeContents(tx); r.setEnd(sel.anchorNode, sel.anchorOffset);
    const before = r.toString().trim();
    if (before) k = Math.min(c.words.length - 1, Math.max(1, (current.project.noSpace ? [...before.replace(/\s/g, '')].length : before.split(/\s+/).length)));
  }
  pushHistory();
  const s = current.project.style;
  const mk = (ws, start, end) => {
    const l = C.wrap(ws, lineChars(s, current.media.info), s.maxLines, current.project.noSpace) || [[0, ws.length]];
    return { id: '', start, end, words: ws, lineBreaks: l.slice(1).map((x) => x[0]) };
  };
  const a = c.words.slice(0, k); const b = c.words.slice(k);
  caps.splice(i, 1, mk(a, c.start, Math.max(a[a.length - 1].end, b[0].start - 0.04)), mk(b, b[0].start, c.end));
  captionsChanged(); renderPanel();
}
function replaceAll(find, repl) {
  if (!find) return;
  const re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  let n = 0; pushHistory();
  const s = current.project.style;
  current.project.captions = current.project.captions.map((c) => {
    const text = C.captionLines(c, current.project.noSpace).join('\n');
    if (!re.test(text)) return c; re.lastIndex = 0;
    const next = text.replace(re, () => { n++; return repl; });
    return next.trim() ? C.applyText(c, next, { noSpace: current.project.noSpace, maxChars: lineChars(s, current.media.info), maxLines: s.maxLines }) : null;
  }).filter(Boolean);
  captionsChanged(); current.find = ''; renderPanel();
  toast(n ? `Replaced ${n} ${n === 1 ? 'match' : 'matches'}.` : 'No matches.');
}

// ---------- Saving ----------
let saveTimer = null;
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 500); const el = $('#saved'); if (el) el.textContent = 'Saving…'; }
async function saveNow() {
  if (!current) return;
  await cs.saveProject({ id: current.media.id, project: current.project });
  const el = $('#saved'); if (el) el.textContent = 'Saved';
}

// ---------- Export ----------
function closeMenu() { $('#menu-root').replaceChildren(); }
function showMenu(anchor, items) {
  closeMenu();
  const r = anchor.getBoundingClientRect();
  const m = h(`<div class="menu">${items.map((it, i) => (it === '-' ? '<hr>' : `<button data-i="${i}"><span>${esc(it.t)}</span><span class="d">${esc(it.d || '')}</span></button>`)).join('')}</div>`);
  m.style.top = `${r.bottom + 6}px`; m.style.right = `${window.innerWidth - r.right}px`;
  m.querySelectorAll('button').forEach((b) => { b.onclick = () => { closeMenu(); items[+b.dataset.i].run(); }; });
  $('#menu-root').append(m);
  setTimeout(() => document.addEventListener('mousedown', function off(e) { if (!m.contains(e.target)) { closeMenu(); document.removeEventListener('mousedown', off); } }), 0);
}
function exportMenu(anchor) {
  const items = [];
  if (current.media.info.hasVideo) items.push({ t: 'Video with captions', d: 'MP4', run: burn }, '-');
  items.push(
    { t: 'Subtitles', d: '.srt', run: () => exportText('srt') },
    { t: 'Web subtitles', d: '.vtt', run: () => exportText('vtt') },
    { t: 'Styled subtitles', d: '.ass', run: () => exportText('ass') },
    { t: 'Transcript', d: '.txt', run: () => exportText('txt') },
  );
  showMenu(anchor, items);
}
function retranscribeMenu(anchor) {
  showMenu(anchor, S.models.map((m) => ({
    t: `Transcribe again: ${MODEL_INFO[m.id].name}`, d: m.installed ? '' : `download ${fmtMB(m.size)}`,
    run: async () => {
      if (!m.installed) { await cs.setSettings({ model: m.id }); afterDownload = current.media.file; await cs.downloadModel(m.id); toast('Downloading the model. Transcription starts when it’s done.'); return; }
      if (!confirm('Transcribe again? Your edits to these captions will be replaced.')) return;
      const media = current.media; current.video.pause(); current = null; runTranscription(media, m.id);
    },
  })));
}
async function exportText(format) {
  const { project, media } = current;
  const caps = project.captions; const o = { noSpace: project.noSpace };
  const content = format === 'srt' ? C.toSRT(caps, o) : format === 'vtt' ? C.toVTT(caps, o) : format === 'txt' ? C.toTXT(caps, o) : assFor();
  const out = await cs.exportText({ file: media.file, format, content });
  if (out) toast(`Saved ${out.split(/[\\/]/).pop()}`, { action: 'Show', onAction: () => cs.showInFolder(out) });
}
function assFor() {
  const { project, media } = current;
  const s = { ...project.style };
  let caps = project.captions;
  if (s.stripPunct) caps = caps.map((c) => ({ ...c, words: c.words.map((w) => ({ ...w, text: C.stripPunct(w.text) || w.text })) }));
  const w = media.info.width || 1920; const hgt = media.info.height || 1080;
  return C.toASS(caps, s, { width: w - (w % 2), height: hgt - (hgt % 2), noSpace: project.noSpace });
}
async function burn() {
  const jobId = `b${Date.now()}`;
  const card = h('<div class="burn-card"><div class="r"><b>Making your video</b><span class="sp"></span><span class="num" id="b-pct">0%</span></div><div class="bar"><i id="b-bar"></i></div><div class="r"><span class="note">Keep Captionshaper open.</span><span class="sp"></span><button class="btn" id="b-cancel">Cancel</button></div></div>');
  let shown = false;
  progressHandlers.set(jobId, (p) => {
    if (!shown) { document.body.append(card); shown = true; }
    $('#b-pct', card).textContent = `${Math.floor(p.pct)}%`; $('#b-bar', card).style.width = `${p.pct}%`;
  });
  $('#b-cancel', card).onclick = () => cs.cancelJob(jobId);
  try {
    const out = await cs.burn({ jobId, file: current.media.file, ass: assFor(), info: current.media.info });
    if (out) toast(`Saved ${out.split(/[\\/]/).pop()}`, { action: 'Show', onAction: () => cs.showInFolder(out), ms: 8000 });
  } catch (e) {
    if (!/Cancelled/.test(e.message)) toast(e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), { bad: true, ms: 8000 });
  } finally { progressHandlers.delete(jobId); card.remove(); }
}

// ---------- Window-wide ----------
function applyTheme(t) { document.documentElement.dataset.theme = t === 'light' ? 'light' : 'dark'; }
document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
  if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); cs.pickVideo().then((f) => f && openFile(f)); }
  if (!current) return;
  if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
  if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); const f = $('#find'); if (f) f.focus(); }
  if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); exportMenu($('#export')); }
  if (typing) return;
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    const caps = current.project.captions; const t = current.video.currentTime;
    const i = e.key === 'ArrowRight' ? caps.findIndex((c) => c.start > t + 0.01) : (() => { let k = -1; caps.forEach((c, j) => { if (c.start < t - 0.3) k = j; }); return k; })();
    if (i >= 0) current.video.currentTime = caps[i].start + 0.001;
  }
});
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; if (current) $('#drop-overlay').classList.add('show'); });
window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('#drop-overlay').classList.remove('show'); });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault(); dragDepth = 0; $('#drop-overlay').classList.remove('show');
  document.querySelectorAll('.dropzone.over').forEach((d) => d.classList.remove('over'));
  const f = e.dataTransfer.files[0]; if (f) openFile(cs.pathFor(f));
});
cs.onOpenFiles((files) => { if (files[0]) openFile(files[0]); });
cs.onFullscreen((v) => { if (v) document.documentElement.dataset.fullscreen = ''; else delete document.documentElement.dataset.fullscreen; });
window.addEventListener('beforeunload', () => { if (current) saveNow(); });

(async () => {
  document.documentElement.dataset.platform = cs.platform;
  S = await cs.getState();
  applyTheme(S.settings.theme);
  await renderHome();
  const pending = await cs.rendererReady();
  if (pending && pending[0]) openFile(pending[0]);
  window.__cs = { get current() { return current; }, openFile, renderHome, C };
})();

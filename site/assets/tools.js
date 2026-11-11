// Captionshaper free online subtitle tools. Everything runs in this page; files never leave the device.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  // ---------- Parsing ----------
  const toSec = (h, m, s, ms) => (+h) * 3600 + (+m) * 60 + (+s) + (+ms) / 1000;
  function parse(text) {
    const cues = [];
    const blocks = text.replace(/\r/g, '').replace(/^﻿/, '').split(/\n{2,}/);
    for (const b of blocks) {
      const lines = b.split('\n');
      const i = lines.findIndex((l) => l.includes('-->'));
      if (i < 0) continue;
      const m = /(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})\s*-->\s*(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})/.exec(lines[i]);
      if (!m) continue;
      const ms = (x) => x.padEnd(3, '0');
      cues.push({ start: toSec(m[1] || 0, m[2], m[3], ms(m[4])), end: toSec(m[5] || 0, m[6], m[7], ms(m[8])), text: lines.slice(i + 1).join('\n').trim() });
    }
    return cues;
  }
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const stamp = (t, sep) => {
    const ms = Math.max(0, Math.round(t * 1000));
    return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}${sep}${pad(ms % 1000, 3)}`;
  };
  const toSRT = (c) => c.map((x, i) => `${i + 1}\n${stamp(x.start, ',')} --> ${stamp(x.end, ',')}\n${x.text}\n`).join('\n');
  const toVTT = (c) => `WEBVTT\n\n${c.map((x) => `${stamp(x.start, '.')} --> ${stamp(x.end, '.')}\n${x.text}\n`).join('\n')}`;
  const toTXT = (c) => {
    let out = ''; let prev = null;
    for (const x of c) {
      const t = x.text.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').replace(/\n/g, ' ').trim();
      if (prev != null) out += x.start - prev > 2 ? '\n\n' : ' ';
      out += t; prev = x.end;
    }
    return `${out.trim()}\n`;
  };
  // ---------- UI ----------
  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function mount(el) {
    const kind = el.dataset.tool;
    el.innerHTML = `<div class="tool">
      <label class="drop"><input type="file" accept=".srt,.vtt,text/vtt,application/x-subrip" hidden>
        <b>Drop a subtitle file here</b><span>or click to choose an .srt or .vtt file. It stays on your device.</span></label>
      <textarea placeholder="…or paste subtitles here" spellcheck="false"></textarea>
      ${kind === 'shift' ? '<div class="tool-row"><label>Move every caption by <input type="number" step="0.1" value="1.0" class="shift"> seconds</label><span class="fine">Negative numbers move captions earlier.</span></div>' : ''}
      <div class="tool-row"><button class="btn btn-primary" disabled>${{ convert: 'Convert', shift: 'Shift and download', text: 'Get the text' }[kind]}</button><span class="tool-msg"></span></div>
    </div>`;
    const input = $('input[type=file]', el); const ta = $('textarea', el); const btn = $('button', el); const msg = $('.tool-msg', el);
    let name = 'subtitles.srt';
    const update = () => {
      const cues = parse(ta.value);
      btn.disabled = !cues.length;
      const isVtt = /^\s*WEBVTT/.test(ta.value);
      if (kind === 'convert') btn.textContent = isVtt ? 'Convert to SRT' : 'Convert to VTT';
      msg.textContent = ta.value.trim() ? (cues.length ? `${cues.length} captions found` : 'No captions found in this text') : '';
    };
    const load = (file) => { if (!file) return; name = file.name; file.text().then((t) => { ta.value = t; update(); }); };
    input.onchange = () => load(input.files[0]);
    const drop = $('.drop', el);
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); load(e.dataTransfer.files[0]); });
    ta.oninput = update;
    btn.onclick = () => {
      const cues = parse(ta.value); const base = name.replace(/\.(srt|vtt)$/i, '');
      const isVtt = /^\s*WEBVTT/.test(ta.value);
      if (kind === 'convert') download(`${base}.${isVtt ? 'srt' : 'vtt'}`, isVtt ? toSRT(cues) : toVTT(cues));
      if (kind === 'shift') {
        const d = parseFloat($('.shift', el).value) || 0;
        const moved = cues.map((c) => ({ ...c, start: Math.max(0, c.start + d), end: Math.max(0, c.end + d) })).filter((c) => c.end > 0);
        download(`${base}-shifted.${isVtt ? 'vtt' : 'srt'}`, isVtt ? toVTT(moved) : toSRT(moved));
      }
      if (kind === 'text') download(`${base}.txt`, toTXT(cues));
      msg.textContent = 'Saved to your downloads.';
    };
  }
  document.querySelectorAll('[data-tool]').forEach(mount);
})();

// Captionshaper site: OS-aware download button, a live caption on the hero, gentle entrances.
document.documentElement.classList.add('js');
(() => {
  const CS = window.CS || { lang: 'en', langs: ['en'] };
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
  // First visit: send people to their own language once. A manual choice always wins afterwards.
  if (!store.get('cs-lang') && CS.lang === 'en' && !CS.english) {
    const pref = (navigator.languages || [navigator.language || 'en']).map((l) => l.toLowerCase().slice(0, 2)).find((l) => CS.langs.includes(l));
    store.set('cs-lang', pref || 'en');
    if (pref && pref !== 'en') { location.replace(`${pref}/${location.pathname.split('/').pop()}${location.hash}`); return; }
  }
  document.querySelectorAll('[data-set-lang]').forEach((a) => a.addEventListener('click', () => store.set('cs-lang', a.dataset.setLang)));
  document.addEventListener('click', (e) => { const open = document.querySelector('details.lang[open]'); if (open && !open.contains(e.target)) open.removeAttribute('open'); });
  // Highlight the download card for the visitor's own system.
  const isWin = /Windows/i.test(navigator.userAgent);
  document.querySelectorAll(`[data-os-card="${isWin ? 'win' : 'mac'}"]`).forEach((c) => c.classList.add('mine'));
  // Put the visitor's own OS first.
  const win = /Windows/i.test(navigator.userAgent);
  document.querySelectorAll('.cta').forEach((c) => {
    const mac = c.querySelector('[data-os="mac"]'); const w = c.querySelector('[data-os="win"]');
    if (win && mac && w) { c.insertBefore(w, mac); w.classList.replace('btn-ghost', 'btn-primary'); mac.classList.replace('btn-primary', 'btn-ghost'); }
  });
  // Word-by-word caption chip.
  const el = document.querySelector('.live-words');
  if (el) {
    const words = el.dataset.words.split('|');
    el.innerHTML = words.map((w) => `<span>${w}</span>`).join(' ');
    const spans = [...el.children]; let i = 0;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) spans.forEach((s) => s.classList.add('done'));
    else setInterval(() => {
      spans.forEach((s, k) => { s.classList.toggle('on', k === i); s.classList.toggle('done', k < i); });
      i = (i + 1) % (spans.length + 3);
    }, 380);
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Scroll progress bar and nav shade.
  const bar = document.querySelector('.progress'); const navEl = document.querySelector('.nav');
  const onScroll = () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.setProperty('--p', h > 0 ? (scrollY / h).toFixed(4) : 0);
    if (navEl) navEl.classList.toggle('scrolled', scrollY > 10);
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  // Hero: a playhead runs along the waveform; the word being "spoken" in the headline gets a lime box.
  const wave = document.querySelector('.hero-wave');
  const words = [...document.querySelectorAll('.kara .hw')];
  if (wave && !reduce) {
    const bars = [...wave.querySelectorAll('.hw-bars i')]; const head = wave.querySelector('.hw-head');
    const loop = 7000; const t0 = performance.now() + 1200;
    const frame = (now) => {
      const k = Math.max(0, ((now - t0) % loop) / loop);
      const on = now >= t0;
      head.style.left = `${(on ? k : 0) * 100}%`;
      const lit = on ? Math.floor(k * bars.length) : -1;
      bars.forEach((x, i) => x.classList.toggle('lit', i <= lit));
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  // Card spotlight follows the cursor.
  document.querySelectorAll('.spot').forEach((c) => c.addEventListener('pointermove', (e) => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`); c.style.setProperty('--my', `${e.clientY - r.top}px`);
  }));
  // Fade sections in as they scroll into view.
  const items = document.querySelectorAll('.split-text, .shot:not(.hero-shot), .card, .nums-in > div, .priv .wrap, .end .wrap, h2.center, .panel, .release, .cell, .guide-list li');
  items.forEach((x) => x.classList.add('rise'));
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  items.forEach((x) => io.observe(x));
})();

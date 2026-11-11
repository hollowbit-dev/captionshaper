// Captionshaper site: OS-aware download button, a live caption on the hero, gentle entrances.
document.documentElement.classList.add('js');
(() => {
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
  // Hero screenshot follows the cursor a little after it has tilted into place.
  const shot = document.querySelector('.hero-shot');
  if (shot && !reduce) {
    setTimeout(() => shot.classList.add('ready'), 1900);
    addEventListener('mousemove', (e) => {
      if (!shot.classList.contains('ready')) return;
      const r = shot.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / innerWidth; const y = (e.clientY - (r.top + r.height / 2)) / innerHeight;
      shot.style.setProperty('--ry', `${(x * 6).toFixed(2)}deg`); shot.style.setProperty('--rx', `${(-y * 5).toFixed(2)}deg`);
    }, { passive: true });
  }
  // Card spotlight follows the cursor.
  document.querySelectorAll('.spot').forEach((c) => c.addEventListener('pointermove', (e) => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`); c.style.setProperty('--my', `${e.clientY - r.top}px`);
  }));
  // Stats count up when they come into view (keeps each language's number format).
  const counters = document.querySelectorAll('[data-count]');
  const cio = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; cio.unobserve(e.target);
    const el = e.target; const final = el.dataset.count;
    const m = /^(\D*)(\d+)(?:([.,])(\d+))?(.*)$/.exec(final);
    if (!m || reduce) { el.classList.add('counted'); return; }
    const [, pre, int, sep, frac = '', post] = m;
    const target = parseFloat(`${int}.${frac || 0}`); const dec = frac.length;
    const t0 = performance.now(); const dur = 1400;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur); const v = target * (1 - Math.pow(1 - k, 3));
      let txt = v.toFixed(dec); if (sep) txt = txt.replace('.', sep);
      el.textContent = pre + txt + post;
      if (k < 1) requestAnimationFrame(step); else { el.textContent = final; el.classList.add('counted'); }
    };
    requestAnimationFrame(step);
  }), { threshold: .6 });
  counters.forEach((c) => cio.observe(c));
  // Fade sections in as they scroll into view.
  const items = document.querySelectorAll('.split-text, .shot:not(.hero-shot), .card, .nums-in > div, .priv .wrap, .faq, .end .wrap, h2.center, .dl-grid .card, .steps > div');
  items.forEach((x) => x.classList.add('rise'));
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  items.forEach((x) => io.observe(x));
})();

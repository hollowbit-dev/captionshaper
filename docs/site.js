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
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) spans.forEach((s) => s.classList.add('done'));
    else setInterval(() => {
      spans.forEach((s, k) => { s.classList.toggle('on', k === i); s.classList.toggle('done', k < i); });
      i = (i + 1) % (spans.length + 3);
    }, 380);
  }
  // Fade sections in as they scroll into view.
  const items = document.querySelectorAll('.split-text, .shot:not(.hero-shot), .card, .nums-in > div, .priv .wrap, .faq, .end .wrap');
  items.forEach((x) => x.classList.add('rise'));
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  items.forEach((x) => io.observe(x));
})();

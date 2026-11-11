// Builds the Captionshaper website into docs/ (served by GitHub Pages at captionshaper.app).
// 8 pages x 6 languages, plus English search guides, free browser tools, 404, sitemap, robots and llms.txt.
// Run: npm run site
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { GUIDES, UPDATED } from './guides.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '..');
const out = path.join(root, 'docs');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const V = pkg.version;
const SITE = { url: 'https://captionshaper.app', github: 'https://github.com/hollowbit-dev/captionshaper', tip: 'https://ko-fi.com/hollowbit', fileshaper: 'https://fileshaper.app' };
const FILES = { mac: `Captionshaper-${V}-mac-arm64.dmg`, win: `Captionshaper-Setup-${V}-win-x64.exe` };
const DL = `${SITE.github}/releases/latest/download/`;
const LANGS = [
  { code: 'en', name: 'English', html: 'en' }, { code: 'es', name: 'Español', html: 'es' }, { code: 'fr', name: 'Français', html: 'fr' },
  { code: 'de', name: 'Deutsch', html: 'de' }, { code: 'ru', name: 'Русский', html: 'ru' }, { code: 'zh', name: '简体中文', html: 'zh-Hans' },
];
const PAGES = ['index', 'features', 'download', 'changelog', 'faq', 'about', 'support', 'privacy'];
const T = Object.fromEntries(LANGS.map((l) => [l.code, JSON.parse(fs.readFileSync(path.join(here, 'locales', `${l.code}.json`), 'utf8'))]));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Checksums of the installers in dist/, when they've been built.
function sha(file) {
  const p = path.join(root, 'dist', file);
  return fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') : 'build the installers to fill this in';
}
const SUMS = { mac: sha(FILES.mac), win: sha(FILES.win) };

// ---------- Structured data ----------
const ORG_LD = { '@context': 'https://schema.org', '@type': 'Organization', name: 'Hollowbit', url: SITE.url, logo: `${SITE.url}/img/icon-256.png`, founder: { '@type': 'Person', name: 'Elvis Zygmanta' }, sameAs: [SITE.github, SITE.fileshaper] };
const APP_LD = (desc, lang) => ({
  '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Captionshaper', applicationCategory: 'MultimediaApplication',
  operatingSystem: 'macOS 12 or later (Apple Silicon), Windows 10, Windows 11', softwareVersion: V, inLanguage: lang, description: desc,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, downloadUrl: `${SITE.url}/download.html`, license: 'https://www.gnu.org/licenses/gpl-3.0.html',
  publisher: { '@type': 'Organization', name: 'Hollowbit' }, image: `${SITE.url}/og/og-en.png`, screenshot: `${SITE.url}/img/app-editor.webp`,
  featureList: ['Automatic subtitles and captions from speech, offline', 'Word-level timing with voice activity detection', 'TikTok, Reels and Shorts caption styles with word highlight and animation', 'Export SRT, VTT, ASS, TXT or MP4 with burned-in captions', 'About 99 languages, translation to English', 'Free, no watermark, nothing uploaded'],
});
const FAQ_LD = (items) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });

// ---------- Icons ----------
const I = (d) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICON = {
  apple: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="none" d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9s-2-.9-3.3-.9C6.1 7 4.5 8 3.6 9.6c-1.8 3.2-.5 7.9 1.3 10.4.9 1.3 1.9 2.7 3.2 2.6 1.3 0 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1.1-2.8-4.6zM14 5.2c.7-.9 1.2-2 1-3.2-1 .1-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z"/></svg>',
  win: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="none" d="M3 5.6 10.4 4.6v7H3zM11.6 4.4 21 3v8.6h-9.4zM3 12.6h7.4v7L3 18.6zM11.6 12.6H21V21l-9.4-1.4z"/></svg>',
  gh: I('<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>'),
  heart: I('<path d="M12 20s-7-4.3-8.8-8.7C1.9 8 4 4.8 7.2 4.8c1.9 0 3.4 1 4.8 2.8 1.4-1.8 2.9-2.8 4.8-2.8 3.2 0 5.3 3.2 4 6.5C19 15.7 12 20 12 20z"/>'),
  check: I('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  globe: I('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5s1.1-6.1 3.5-8.5z"/>'),
  down: I('<path d="M12 4v12M6.5 10.5 12 16l5.5-5.5"/><path d="M4 20h16"/>'),
  arrow: I('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  doc: I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
  tool: I('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>'),
};
const FEAT_ICONS = [
  '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/><path d="M3 3l18 18"/>',
  '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  '<path d="M4 7h16M4 12h11M4 17h14"/>',
  '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10 18.5h4"/>',
  '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
  '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
];
const GREETINGS = ['Hello', 'Hola', 'Bonjour', 'Hallo', 'Ciao', 'Olá', 'Привет', 'Labas', 'Cześć', 'Merhaba', 'こんにちは', '你好', '안녕하세요', 'مرحبا', 'नमस्ते', 'Hej', 'Γεια σου', 'Sveiki', 'Xin chào', 'Shalom', 'Ahoj', 'Hei', 'Szia', 'Halo'];
const WAVE = Array.from({ length: 96 }, (_, i) => {
  const env = 0.35 + 0.65 * Math.abs(Math.sin(i / 9)) * (0.6 + 0.4 * Math.sin(i / 3.3));
  return `<i style="--h:${Math.max(0.06, env * ((i % 37 > 31) ? 0.08 : 1)).toFixed(2)}"></i>`;
}).join('');

// ---------- Layout ----------
// o.prefix: path to this language's root (guides and tools live one folder down, English only)
// o.path: fixed page path for pages that exist in English only
function layout(L, t, page, title, body, o = {}) {
  const prefix = o.prefix || '';
  const base = (L.code === 'en' ? '' : '../') + prefix;
  const href = (p) => prefix + (p === 'index' ? './' : `${p}.html`);
  const pagePath = (code) => `${code === 'en' ? '' : `${code}/`}${page === 'index' ? '' : `${page}.html`}`;
  const langHref = (code) => (o.path != null ? `${base}${code === 'en' ? '' : `${code}/`}` : `${L.code === 'en' ? '' : '../'}${pagePath(code)}`) || './';
  const abs = (code) => `${SITE.url}/${o.path ?? pagePath(code)}`;
  const desc = o.desc || t.meta.desc;
  const ogImg = `${SITE.url}/og/og-${o.path != null ? 'en' : L.code}.png`;
  const alternates = o.path != null
    ? `<link rel="alternate" hreflang="en" href="${abs('en')}">`
    : `${LANGS.map((l) => `<link rel="alternate" hreflang="${l.html}" href="${abs(l.code)}">`).join('\n')}\n<link rel="alternate" hreflang="x-default" href="${abs('en')}">`;
  const ld = [ORG_LD, ...(o.jsonld || [])].map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n');
  const nav = [['features', t.nav.features], ['download', t.nav.download], ['changelog', t.nav.changelog], ['faq', t.nav.faq], ['about', t.nav.about]];
  return `<!doctype html>
<html lang="${o.path != null ? 'en' : L.html}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>document.documentElement.classList.add('js')</script>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#08090a">
<meta name="author" content="Hollowbit">
<meta property="og:type" content="${o.article ? 'article' : 'website'}">
<meta property="og:site_name" content="Captionshaper">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${abs(L.code)}">
<meta property="og:image" content="${ogImg}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${L.html.replace('-', '_')}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${ogImg}">
<link rel="canonical" href="${abs(L.code)}">
${alternates}
${ld}
<link rel="icon" type="image/png" href="${base}favicon.png">
<link rel="preload" href="${base}fonts/Geist-Variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${base}style.css?v=${V}">
</head>
<body data-page="${page}">
<div class="progress" aria-hidden="true"><i></i></div>
<a class="skip" href="#main">${esc(t.nav.skip)}</a>
<header class="nav"><div class="wrap nav-in">
  <a class="logo" href="${href('index')}"><img src="${base}favicon.png" alt="" width="26" height="26">Captionshaper</a>
  <nav class="links" aria-label="Main">${nav.map(([p, l]) => `<a href="${href(p)}"${p === page ? ' aria-current="page"' : ''}>${esc(l)}</a>`).join('')}</nav>
  <div class="nav-end">
    <details class="lang"><summary aria-label="${esc(t.nav.language)}">${ICON.globe}<span>${L.code.toUpperCase()}</span></summary>
      <div class="lang-menu">${LANGS.map((l) => `<a href="${langHref(l.code)}" hreflang="${l.html}" lang="${l.html}" data-set-lang="${l.code}"${l.code === L.code ? ' aria-current="true"' : ''}>${l.name}</a>`).join('')}</div></details>
    <a class="btn btn-ghost btn-sm kofi" href="${SITE.tip}" target="_blank" rel="noopener">${ICON.heart}<span>Ko-fi</span></a>
    <a class="btn btn-primary btn-sm" href="${href('download')}">${esc(t.common.cta)}</a>
  </div>
</div></header>
<main id="main">
${body}
</main>
<footer class="foot"><div class="wrap foot-grid">
  <div class="foot-brand"><a class="logo" href="${href('index')}"><img src="${base}favicon.png" alt="" width="24" height="24">Captionshaper</a><p>${esc(t.footer.tagline)}</p></div>
  <div class="foot-col"><p class="foot-h">${esc(t.footer.product)}</p><a href="${href('features')}">${esc(t.nav.features)}</a><a href="${href('download')}">${esc(t.nav.download)}</a><a href="${href('changelog')}">${esc(t.nav.changelog)}</a><a href="${base}tools/">${esc(t.nav.tools)}</a><a href="${base}guides/">${esc(t.nav.guides)}</a></div>
  <div class="foot-col"><p class="foot-h">${esc(t.footer.help)}</p><a href="${href('faq')}">${esc(t.nav.faq)}</a><a href="${href('support')}">${esc(t.footer.support)}</a><a href="${href('privacy')}">${esc(t.nav.privacy)}</a></div>
  <div class="foot-col"><p class="foot-h">${esc(t.footer.studio)}</p><a href="${href('about')}">${esc(t.footer.about)}</a><a href="${SITE.fileshaper}">Fileshaper</a><a href="${SITE.github}" rel="noopener">${esc(t.footer.github)}</a></div>
</div>
<div class="wrap foot-legal"><span>${esc(t.footer.made)}</span><span>${esc(t.footer.legal)}</span></div></footer>
<script>window.CS=${JSON.stringify({ lang: L.code, langs: LANGS.map((l) => l.code), english: o.path != null })};</script>
<script src="${base}site.js?v=${V}" defer></script>
${o.tools ? `<script src="${base}tools.js?v=${V}" defer></script>` : ''}
</body>
</html>
`;
}

const dlButtons = (t, cls = 'cta') => `<div class="${cls}">
  <a class="btn btn-primary btn-lg" data-os="mac" href="${DL}${FILES.mac}">${ICON.apple}${esc(t.hero.mac)}</a>
  <a class="btn btn-ghost btn-lg" data-os="win" href="${DL}${FILES.win}">${ICON.win}${esc(t.hero.win)}</a>
</div>`;
const pageHero = (h1, lead = '', extra = '', wide = false) => `<section class="page-hero"><div class="wrap${wide ? '' : ' narrow'}"><h1>${esc(h1)}</h1>${lead ? `<p class="lede">${esc(lead)}</p>` : ''}${extra}</div></section>`;

// ---------- Pages ----------
function home(L, t, base) {
  return `
<section class="hero"><div class="wrap">
  <p class="cue-head"><span class="tags">${esc(t.hero.eyebrow)}</span></p>
  <h1 class="kara">${t.hero.h1.split(' ').map((w, i) => `<span class="hw" style="--i:${i}">${esc(w)}</span>`).join(' ')}</h1>
  <p class="lede">${esc(t.hero.sub)}</p>
  ${dlButtons(t)}
  <p class="note">${esc(t.hero.note)}</p>
  <div class="hero-wave" aria-hidden="true"><div class="hw-bars">${WAVE}</div><div class="hw-head"></div></div>
  <div class="shot hero-shot">
    <img src="${base}img/app-editor.webp" width="1600" height="1018" alt="Captionshaper editor: a vertical video in a phone frame with bold captions, the caption list and a waveform timeline">
    <div class="live-chip" aria-hidden="true"><span class="dot"></span><span class="live-words" data-words="Every|word,|right|on|time."></span></div>
  </div>
</div></section>
<div class="marquee" aria-hidden="true"><div class="mq-track">${[0, 1].map(() => `<span>${GREETINGS.map((g) => `<b>${g}</b>`).join('<i>·</i>')}<i>·</i></span>`).join('')}</div></div>
<section class="split" id="live"><div class="wrap split-in">
  <div class="split-text"><h2>${esc(t.live.h)}</h2><p>${esc(t.live.p)}</p></div>
  <div class="shot"><img src="${base}img/app-working.webp" width="1440" height="792" alt="Words appearing live while Captionshaper transcribes, above a waveform" loading="lazy"></div>
</div></section>
<section id="features"><div class="wrap">
  <h2 class="center">${esc(t.feat.h)}</h2>
  <div class="grid">${t.feat.items.map(([h, p], i) => `<div class="card spot" style="--d:${i}"><svg class="ic fi" viewBox="0 0 24 24">${FEAT_ICONS[i]}</svg><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join('')}</div>
  <p class="center more"><a class="link" href="features.html">${esc(t.featuresPage.h1)} ${ICON.arrow}</a></p>
</div></section>
<section class="split rev" id="styles"><div class="wrap split-in">
  <div class="split-text"><h2>${esc(t.styles.h)}</h2><p>${esc(t.styles.p)}</p></div>
  <div class="shot"><img src="${base}img/app-style.webp" width="1600" height="1018" alt="Captionshaper caption styles: nine presets with fonts, highlight, animation, outline, shadow and glow controls" loading="lazy"></div>
</div></section>
<section class="nums"><div class="wrap nums-in">${t.nums.map(([n, l]) => `<div class="stat"><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join('')}</div></section>
<section id="privacy" class="priv"><div class="wrap narrow center">
  <h2>${esc(t.priv.h)}</h2><p class="lede">${esc(t.priv.p)}</p>
  <ul class="ticks">${t.priv.items.map((x) => `<li>${ICON.check}${esc(x)}</li>`).join('')}</ul>
</div></section>
<section id="faq"><div class="wrap narrow">
  <h2>${esc(t.faq.h)}</h2>
  <div class="faq">${t.faq.items.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
  <p class="more"><a class="link" href="faq.html">${esc(t.faqPage.h1)} ${ICON.arrow}</a></p>
</div></section>
<section class="extras"><div class="wrap two-col">
  <a class="panel link-panel" href="${base}tools/">${ICON.tool}<h3>${esc(t.nav.tools)}</h3><p>SRT ↔ VTT, shift subtitle timing, subtitles to text. In your browser, nothing uploaded.</p></a>
  <a class="panel link-panel" href="${base}guides/">${ICON.doc}<h3>${esc(t.nav.guides)}</h3><p>${GUIDES.slice(0, 3).map((g) => esc(g.h1)).join(' · ')}</p></a>
</div></section>
<section class="end"><div class="wrap center">
  <h2>${esc(t.hero.h1)}</h2>
  ${dlButtons(t)}
  <p class="note">${esc(t.hero.note)}</p>
</div></section>`;
}

function features(L, t, base) {
  const f = t.featuresPage;
  return `${pageHero(f.h1, f.lead, `<nav class="jump">${f.sections.map((s) => `<a href="#${s.id}">${esc(s.h)}</a>`).join('')}</nav>`, true)}
${f.sections.map((s, i) => `
<section class="split fam${i % 2 ? ' rev' : ''}" id="${s.id}"><div class="wrap split-in">
  <div class="split-text"><h2>${esc(s.h)}</h2><p>${esc(s.p)}</p>
  <ul class="tool-list">${s.items.map(([n, d]) => `<li><b>${esc(n)}</b><span>${esc(d)}</span></li>`).join('')}</ul></div>
  <div class="shot"><img src="${base}img/${s.img}.webp" alt="${esc(s.h)}" loading="lazy" width="1600" height="1018"></div>
</div></section>`).join('')}
<section class="end"><div class="wrap center"><h2>${esc(t.hero.h1)}</h2>${dlButtons(t)}<p class="note">${esc(t.hero.note)}</p></div></section>`;
}

function download(L, t) {
  const d = t.dl; const m = t.downloadMore;
  return `${pageHero(d.h, d.sub.replace('{v}', V), `<p class="fine">${esc(t.common.released)}</p>`)}
<section class="tight"><div class="wrap narrow">
  <div class="dl-grid">
    <div class="card dl" data-os-card="mac"><div class="dl-os">${ICON.apple}<h2>${esc(d.mac)}</h2></div><p>${esc(d.macReq)}</p><a class="btn btn-primary" href="${DL}${FILES.mac}">${ICON.down}${esc(d.macBtn)}</a><p class="fine">${esc(m.no_intel)}</p></div>
    <div class="card dl" data-os-card="win"><div class="dl-os">${ICON.win}<h2>${esc(d.win)}</h2></div><p>${esc(d.winReq)}</p><a class="btn btn-primary" href="${DL}${FILES.win}">${ICON.down}${esc(d.winBtn)}</a></div>
  </div>
  <h2 class="mt">${esc(d.firstH)}</h2>
  <div class="steps"><div><h3>${esc(d.mac)}</h3><ol>${d.macSteps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div><div><h3>${esc(d.win)}</h3><ol>${d.winSteps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div></div>
  <p class="fine mt-s">${esc(d.why)}</p>
  <h2 class="mt">${esc(m.req_h2)}</h2>
  <table class="kv">${m.req.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
  <h2 class="mt">${esc(m.verify_h2)}</h2><p class="prose">${esc(m.verify_p)}</p>
  <table class="kv sums"><tr><th scope="row">${esc(d.mac)}</th><td><code>${SUMS.mac}</code></td></tr><tr><th scope="row">${esc(d.win)}</th><td><code>${SUMS.win}</code></td></tr></table>
  <p class="mt-s"><a class="link" href="${SITE.github}/releases" rel="noopener">${ICON.gh}${esc(d.src)}</a></p>
</div></section>`;
}

function changelog(L, t) {
  const c = t.changelog;
  return `${pageHero(c.h1, c.lead)}
<section class="tight"><div class="wrap narrow">${c.entries.map((e) => `
  <article class="release"><div class="rel-meta"><span class="ver">${esc(e.v)}</span><time>${esc(e.date)}</time></div>
  <div><h2>${esc(e.name)}</h2><ul>${e.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></article>`).join('')}
</div></section>`;
}

const allFaq = (t) => [...t.faq.items, ...t.faqPage.more];
function faq(L, t) {
  return `${pageHero(t.faqPage.h1)}
<section class="tight"><div class="wrap narrow"><div class="faq">${allFaq(t).map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></div></section>`;
}

function about(L, t) {
  const a = t.about;
  return `<section class="page-hero"><div class="wrap narrow about-in">
  <div class="mono-mark" aria-hidden="true">EZ</div>
  <div><h1>${esc(a.h1)}</h1><p class="lede">${esc(a.lead)}</p>
  <div class="cta cta-left"><a class="btn btn-ghost" href="https://github.com/hollowbit-dev" rel="noopener">${ICON.gh}${esc(a.github)}</a></div></div>
</div></section>
<section class="tight"><div class="wrap narrow"><h2>${esc(a.why_h2)}</h2>${a.why.map((p) => `<p class="prose">${esc(p)}</p>`).join('')}</div></section>
<section class="tight"><div class="wrap narrow"><h2>${esc(a.rules_h2)}</h2>
  <dl class="facts">${a.rules.map(([k, v]) => `<div><dt>${ICON.check}${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div></section>
<section class="tight"><div class="wrap narrow"><h2>${esc(a.tech_h2)}</h2>
  <div class="grid3">${a.tech.map(([k, v]) => `<div class="cell"><h3>${esc(k)}</h3><p>${esc(v)}</p></div>`).join('')}</div></div></section>
<section class="tight"><div class="wrap narrow"><a class="panel link-panel" href="${SITE.fileshaper}"><h3>${esc(a.other_h2)}</h3><p>${esc(a.other_p)}</p></a></div></section>`;
}

function support(L, t) {
  const s = t.support;
  return `${pageHero(s.h1)}
<section class="tight"><div class="wrap narrow two-col">
  <div class="panel"><h2>${esc(s.help_h2)}</h2><p>${esc(s.help_p)}</p><a class="btn btn-ghost" href="${SITE.github}/issues/new" rel="noopener">${ICON.gh}${esc(s.help_btn)}</a></div>
  <div class="panel"><h2>${esc(s.give_h2)}</h2><p>${esc(s.give_p)}</p><div class="row"><a class="btn btn-primary" href="${SITE.tip}" rel="noopener">${ICON.heart}${esc(s.tip_btn)}</a><a class="btn btn-ghost" href="${SITE.github}" rel="noopener">${esc(s.star_btn)}</a></div></div>
</div></section>`;
}

function privacy(L, t) {
  const p = t.privacyFull;
  return `${pageHero(t.privacyPage.h, '', `<p class="fine">${esc(p.updated)}</p>`)}
<section class="tight"><div class="wrap narrow"><p class="callout">${esc(p.short)}</p>${p.sections.map(([h, b]) => `<h2>${esc(h)}</h2><p class="prose">${esc(b)}</p>`).join('')}</div></section>`;
}

const notfound = (t) => `<section class="page-hero nf"><div class="wrap center"><h1>${esc(t.notfound.h)}</h1><p class="lede">${esc(t.notfound.p)}</p><div class="cta"><a class="btn btn-primary" href="/">${esc(t.notfound.home)}</a></div></div></section>`;

// ---------- Guides and tools (English) ----------
function guidePage(g) {
  const others = GUIDES.filter((x) => x.slug !== g.slug).slice(0, 3);
  return `<section class="page-hero guide-hero"><div class="wrap narrow">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="../">Captionshaper</a><span>/</span><a href="./">Guides</a></nav>
  <h1>${esc(g.h1)}</h1>
  <div class="answer"><p>${esc(g.answer)}</p></div>
  <p class="fine">Updated ${new Date(UPDATED).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · Hollowbit</p>
  ${dlButtons(T.en, 'cta cta-left')}
</div></section>
<section class="tight"><div class="wrap narrow">
  <h2>Step by step</h2>
  <ol class="howto">${g.steps.map(([n, d], i) => `<li id="step-${i + 1}"><b>${esc(n)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
  <div class="shot mt-s"><img src="../img/${g.shot}.webp" alt="Captionshaper" loading="lazy" width="1600" height="1018"></div>
  ${g.sections.map(([h, b]) => `<h2>${esc(h)}</h2><p class="prose">${esc(b)}</p>`).join('')}
  <h2>Questions</h2>
  <div class="faq">${g.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
  <h2>More guides</h2>
  <ul class="guide-list">${others.map((x) => `<li><a href="${x.slug}.html"><b>${esc(x.h1)}</b><span>${esc(x.desc)}</span></a></li>`).join('')}</ul>
</div></section>`;
}
const guideIndex = () => `${pageHero('Guides', 'Plain answers to everyday caption and subtitle questions, each done for free on your own computer.')}
<section class="tight"><div class="wrap narrow"><ul class="guide-list">${GUIDES.map((x) => `<li><a href="${x.slug}.html"><b>${esc(x.h1)}</b><span>${esc(x.desc)}</span></a></li>`).join('')}</ul></div></section>`;
const guideLd = (g) => {
  const url = `${SITE.url}/guides/${g.slug}.html`;
  return [
    { '@context': 'https://schema.org', '@type': 'HowTo', name: g.h1, description: g.answer, totalTime: 'PT3M', tool: [{ '@type': 'HowToTool', name: 'Captionshaper (free app for Mac and Windows)' }], step: g.steps.map(([n, d], i) => ({ '@type': 'HowToStep', position: i + 1, name: n, text: d, url: `${url}#step-${i + 1}` })) },
    FAQ_LD(g.faq),
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Captionshaper', item: `${SITE.url}/` }, { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE.url}/guides/` }, { '@type': 'ListItem', position: 3, name: g.h1, item: url }] },
    { '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.desc, dateModified: UPDATED, author: { '@type': 'Organization', name: 'Hollowbit' }, publisher: { '@type': 'Organization', name: 'Hollowbit' }, image: `${SITE.url}/og/og-en.png`, mainEntityOfPage: url },
  ];
};
const TOOLS = [
  ['convert', 'Convert SRT to VTT (or VTT to SRT)', 'Drop either format and get the other. VTT is for HTML5 video on websites; SRT is for video editors and YouTube.'],
  ['shift', 'Shift subtitle timing', 'Subtitles running early or late? Move every caption by the same number of seconds.'],
  ['text', 'Subtitles to plain text', 'Strip the numbers and timestamps from an SRT or VTT file and get a clean transcript.'],
];
const toolsPage = () => `${pageHero('Free online subtitle tools', 'Convert, re-time and clean up subtitle files right here in your browser. Your files never leave your device. To make subtitles from a video in the first place, use the free Captionshaper app.', `<nav class="jump">${TOOLS.map(([id, n]) => `<a href="#${id}">${esc(n)}</a>`).join('')}</nav>`)}
<section class="tight"><div class="wrap narrow">${TOOLS.map(([id, n, d]) => `<div class="tool-sec" id="${id}"><h2>${esc(n)}</h2><p class="prose">${esc(d)}</p><div data-tool="${id}"></div></div>`).join('')}
  <div class="panel mt"><h2>Need subtitles from a video?</h2><p>Captionshaper listens to your video and writes word-timed captions on your own computer, then exports SRT, VTT or a video with the captions burned in.</p>${dlButtons(T.en, 'cta cta-left')}</div>
</div></section>`;

// Per-page description and structured data
const OPTS = {
  index: (t, L) => ({ jsonld: [APP_LD(t.meta.desc, L.html), FAQ_LD(t.faq.items)] }),
  features: (t) => ({ desc: t.featuresPage.lead }),
  download: (t, L) => ({ desc: `${t.dl.h}. ${t.dl.sub.replace('{v}', V)} ${t.hero.note}`, jsonld: [APP_LD(t.meta.desc, L.html)] }),
  changelog: (t) => ({ desc: t.changelog.lead }),
  faq: (t) => ({ desc: allFaq(t).slice(0, 3).map((x) => x[0]).join(' '), jsonld: [FAQ_LD(allFaq(t))] }),
  about: (t) => ({ desc: t.about.lead }),
  support: (t) => ({ desc: t.support.help_p }),
  privacy: (t) => ({ desc: t.privacyFull.short }),
};
const RENDER = { index: home, features, download, changelog, faq, about, support, privacy };
const TITLE = (t, p) => (p === 'index' ? t.meta.title : `${{ features: t.featuresPage.title, download: t.dl.title, changelog: t.changelog.title, faq: t.faqPage.title, about: t.about.title, support: t.support.title, privacy: t.privacyPage.title }[p]} · Captionshaper`);

// ---------- Write ----------
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const L of LANGS) {
  const t = T[L.code];
  const dir = L.code === 'en' ? out : path.join(out, L.code);
  fs.mkdirSync(dir, { recursive: true });
  const base = L.code === 'en' ? '' : '../';
  for (const p of PAGES) fs.writeFileSync(path.join(dir, `${p}.html`), layout(L, t, p, TITLE(t, p), RENDER[p](L, t, base), OPTS[p](t, L)));
}
// 404: absolute links, since GitHub serves it for any missing path.
fs.writeFileSync(path.join(out, '404.html'), layout(LANGS[0], T.en, '404', `${T.en.notfound.title} · Captionshaper`, notfound(T.en))
  .replace(/(href|src)="(?!https?:|#|\/|data:)([^"]*)"/g, (m, a, h) => `${a}="/${h.replace(/^\.\//, '')}"`));
fs.mkdirSync(path.join(out, 'guides'), { recursive: true });
for (const g of GUIDES) fs.writeFileSync(path.join(out, 'guides', `${g.slug}.html`), layout(LANGS[0], T.en, 'guides', `${g.title} · Captionshaper`, guidePage(g), { prefix: '../', path: `guides/${g.slug}.html`, desc: g.desc, jsonld: guideLd(g), article: true }));
fs.writeFileSync(path.join(out, 'guides', 'index.html'), layout(LANGS[0], T.en, 'guides', 'Caption and subtitle guides · Captionshaper', guideIndex(), { prefix: '../', path: 'guides/', desc: 'Free guides: add subtitles to a video, make TikTok-style captions, create an SRT file, transcribe video to text, burn subtitles in, translate to English. All offline with Captionshaper.' }));
fs.mkdirSync(path.join(out, 'tools'), { recursive: true });
fs.writeFileSync(path.join(out, 'tools', 'index.html'), layout(LANGS[0], T.en, 'tools', 'Free online subtitle tools: SRT to VTT, shift timing · Captionshaper', toolsPage(), { prefix: '../', path: 'tools/', tools: true,
  desc: 'Free subtitle tools that run in your browser and never upload your files: convert SRT to VTT and VTT to SRT, shift subtitle timing, turn subtitles into plain text.',
  jsonld: [{ '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Captionshaper subtitle tools', url: `${SITE.url}/tools/`, applicationCategory: 'MultimediaApplication', operatingSystem: 'Any (web browser)', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, publisher: { '@type': 'Organization', name: 'Hollowbit' } }] }));

const assets = path.join(here, 'assets');
for (const f of ['style.css', 'site.js', 'tools.js', 'favicon.png']) fs.copyFileSync(path.join(assets, f), path.join(out, f));
// Search-engine ownership files must stay on the site to remain verified.
for (const f of fs.readdirSync(assets)) if (/^google[a-z0-9]+\.html$|^BingSiteAuth\.xml$/.test(f)) fs.copyFileSync(path.join(assets, f), path.join(out, f));
fs.cpSync(path.join(assets, 'fonts'), path.join(out, 'fonts'), { recursive: true });
fs.mkdirSync(path.join(out, 'img'));
for (const f of fs.readdirSync(path.join(assets, 'img'))) if (/\.webp$|^icon-256\.png$/.test(f)) fs.copyFileSync(path.join(assets, 'img', f), path.join(out, 'img', f));
if (fs.existsSync(path.join(assets, 'og'))) fs.cpSync(path.join(assets, 'og'), path.join(out, 'og'), { recursive: true });
fs.writeFileSync(path.join(out, '.nojekyll'), '');
fs.writeFileSync(path.join(out, 'CNAME'), `${new URL(SITE.url).host}\n`); // custom domain for GitHub Pages

// Sitemap, robots, llms.txt
const urlOf = (code, p) => `${SITE.url}/${code === 'en' ? '' : `${code}/`}${p === 'index' ? '' : `${p}.html`}`;
const sm = [];
for (const p of PAGES) for (const L of LANGS) sm.push(`<url><loc>${urlOf(L.code, p)}</loc><lastmod>${UPDATED}</lastmod>${LANGS.map((a) => `<xhtml:link rel="alternate" hreflang="${a.html}" href="${urlOf(a.code, p)}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${urlOf('en', p)}"/></url>`);
sm.push(`<url><loc>${SITE.url}/guides/</loc><lastmod>${UPDATED}</lastmod></url>`, `<url><loc>${SITE.url}/tools/</loc><lastmod>${UPDATED}</lastmod></url>`);
for (const g of GUIDES) sm.push(`<url><loc>${SITE.url}/guides/${g.slug}.html</loc><lastmod>${UPDATED}</lastmod></url>`);
fs.writeFileSync(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${sm.join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(out, 'robots.txt'), `# Search engines and AI assistants are welcome.\nUser-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`);
const e = T.en;
fs.writeFileSync(path.join(out, 'llms.txt'), `# Captionshaper

> Captionshaper is a free, open-source desktop app for macOS (Apple Silicon) and Windows that makes subtitles and captions from video or audio, fully offline. It recognises speech with OpenAI's Whisper model running locally, times every word, splits the text into readable captions, and exports SRT, VTT, ASS, plain text, or an MP4 with TikTok-style captions burned in. Files are never uploaded. Made by Hollowbit (Elvis Zygmanta). Licence: GPL-3.0. Current version: ${V}.

## Key facts
- Price: free, no account, no watermark, no limit on video length.
- Platforms: macOS 12 or newer on Apple Silicon; Windows 10 and 11 (64-bit). Intel Macs are not supported yet.
- Privacy: speech recognition runs on the user's computer (whisper.cpp). The only network request is a one-time speech model download from Hugging Face. No analytics.
- Accuracy: 0.7% word error rate on test clips with known scripts in English, Spanish and German; captions start within 0.15 s of the voice.
- Speed: about 5x faster than real time on Apple Silicon; roughly 1-2x on a recent Windows PC (CPU only).
- Languages: about 99 spoken languages, detected automatically; translation of any of them into English. Website in English, Spanish, French, German, Russian and Chinese.
- Caption quality: voice activity detection (no captions over music or silence), word-level timestamps, line breaks at sentence and clause ends, at most two lines, safe area for vertical video.
- Styles: Clean, Subtitle box, Bold, Highlight, One word, Reveal, Neon, Comic, Minimal; 11 fonts; spoken-word highlight (colour or box); pop, fade and slide animations; outline, shadow and glow. The preview matches the exported video exactly.
- Exports: MP4 with burned-in captions (H.264), SRT, VTT, ASS, TXT.

## Links
- [Download](${SITE.url}/download.html)
- [Features](${SITE.url}/features.html)
- [FAQ](${SITE.url}/faq.html)
- [Changelog](${SITE.url}/changelog.html)
- [Privacy policy](${SITE.url}/privacy.html)
- [Source code](${SITE.github})

## Free online tools (run in the browser, nothing uploaded)
- [Subtitle tools](${SITE.url}/tools/): convert SRT to VTT and back, shift subtitle timing, subtitles to plain text.

## Guides
${GUIDES.map((g) => `- [${g.h1}](${SITE.url}/guides/${g.slug}.html): ${g.answer}`).join('\n')}

## FAQ
${allFaq(e).map(([q, a]) => `### ${q}\n${a}`).join('\n\n')}
`);
console.log(`Built ${LANGS.length} languages x ${PAGES.length} pages, ${GUIDES.length} guides and the tools page into docs/`);

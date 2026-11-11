// Builds the Captionshaper website into docs/ (served by GitHub Pages).
// 3 pages x 6 languages + 404, sitemap, robots and llms.txt. Run: npm run site
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'docs');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const V = pkg.version;
const BASE = 'https://hollowbit-dev.github.io/captionshaper';
const REPO = 'https://github.com/hollowbit-dev/captionshaper';
const DL = `${REPO}/releases/latest/download`;
const MAC = `${DL}/Captionshaper-${V}-mac-arm64.dmg`;
const WIN = `${DL}/Captionshaper-Setup-${V}-win-x64.exe`;
const KOFI = 'https://ko-fi.com/hollowbit';
const FILESHAPER = 'https://fileshaper.app';
const LANGS = ['en', 'es', 'fr', 'de', 'ru', 'zh'];
const L = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(fs.readFileSync(path.join(root, 'site/locales', `${l}.json`), 'utf8'))]));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const prefix = (lang) => (lang === 'en' ? '' : `${lang}/`);
const url = (lang, page) => `${BASE}/${prefix(lang)}${page === 'index' ? '' : `${page}.html`}`;
// Relative path from a page in `lang` back to the site root.
const up = (lang) => (lang === 'en' ? '' : '../');

const ICON = {
  apple: '<svg class="ic" viewBox="0 0 24 24"><path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.8zM14.2 5.8c.6-.8 1.1-1.8 1-2.8-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.7-1 2.7 1 .1 2-.5 2.7-1.3z" fill="currentColor" stroke="none"/></svg>',
  win: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 5.5l7.5-1v7H3zM11.5 4.3L21 3v8.5h-9.5zM3 12.5h7.5v7L3 18.5zM11.5 12.5H21V21l-9.5-1.3z" fill="currentColor" stroke="none"/></svg>',
  gh: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z" fill="currentColor" stroke="none"/></svg>',
  heart: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 20s-7-4.3-8.8-8.7C1.9 8 4 4.8 7.2 4.8c1.9 0 3.4 1 4.8 2.8 1.4-1.8 2.9-2.8 4.8-2.8 3.2 0 5.3 3.2 4 6.5C19 15.7 12 20 12 20z"/></svg>',
  check: '<svg class="ic" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  globe: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg>',
};
const FEAT_ICONS = [
  '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/><path d="M3 3l18 18"/>',
  '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  '<path d="M4 7h16M4 12h11M4 17h14"/>',
  '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10 18.5h4"/>',
  '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
  '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
];

function head(lang, page, title, desc) {
  const t = L[lang];
  const alt = LANGS.map((l) => `<link rel="alternate" hreflang="${l === 'zh' ? 'zh-Hans' : l}" href="${url(l, page)}">`).join('\n  ');
  const ld = page === 'index' ? `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Captionshaper', operatingSystem: 'macOS, Windows',
    applicationCategory: 'MultimediaApplication', description: t.meta.desc, softwareVersion: V, url: url(lang, 'index'),
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, author: { '@type': 'Organization', name: 'Hollowbit' },
    downloadUrl: [MAC, WIN], license: 'https://www.gnu.org/licenses/gpl-3.0.html',
  })}</script>
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: t.faq.items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  })}</script>` : '';
  return `<!doctype html>
<html lang="${lang === 'zh' ? 'zh-Hans' : lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${url(lang, page)}">
  ${alt}
  <link rel="alternate" hreflang="x-default" href="${url('en', page)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url(lang, page)}">
  <meta property="og:image" content="${BASE}/img/og.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#08090a">
  <link rel="icon" type="image/png" href="${up(lang)}favicon.png">
  <link rel="preload" href="${up(lang)}fonts/Geist-Variable.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${up(lang)}style.css?v=${V}">
  ${ld}
</head>`;
}

// A fixed, speech-like waveform for the hero (same every build).
const WAVE = Array.from({ length: 96 }, (_, i) => {
  const env = 0.35 + 0.65 * Math.abs(Math.sin(i / 9)) * (0.6 + 0.4 * Math.sin(i / 3.3));
  const gap = (i % 37 > 31) ? 0.08 : 1; // short pauses, like speech
  return `<i style="--h:${Math.max(0.06, env * gap).toFixed(2)}"></i>`;
}).join('');
const CUE_TIMES = ['00:00:04,200 --&gt; 00:00:06,000', '00:00:06,080 --&gt; 00:00:07,900', '00:00:08,000 --&gt; 00:00:09,600'];

// Shown scrolling under the hero: Captionshaper hears about 99 languages.
const GREETINGS = ['Hello', 'Hola', 'Bonjour', 'Hallo', 'Ciao', 'Olá', 'Привет', 'Labas', 'Cześć', 'Merhaba', 'こんにちは', '你好', '안녕하세요', 'مرحبا', 'नमस्ते', 'Hej', 'Γεια σου', 'Sveiki', 'Xin chào', 'Shalom', 'Ahoj', 'Hei', 'Szia', 'Halo'];

function nav(lang, page) {
  const t = L[lang]; const u = up(lang); const home = lang === 'en' ? u || './' : './';
  const sec = (id) => (page === 'index' ? `#${id}` : `${home}#${id}`);
  return `<div class="progress" aria-hidden="true"><i></i></div>
<a class="skip" href="#main">Skip to content</a>
<header class="nav"><div class="wrap nav-in">
  <a class="logo" href="${home}"><img src="${u}favicon.png" alt="" width="26" height="26">Captionshaper</a>
  <nav class="links" aria-label="Main">
    <a href="${sec('features')}">${t.nav.features}</a><a href="${sec('styles')}">${t.nav.styles}</a><a href="${sec('privacy')}">${t.nav.privacy}</a><a href="${sec('faq')}">${t.nav.faq}</a>
  </nav>
  <div class="nav-end">
    <a class="btn btn-ghost btn-sm kofi" href="${KOFI}" target="_blank" rel="noopener">${ICON.heart}<span>Ko-fi</span></a>
    <a class="btn btn-primary btn-sm" href="download.html"${page === 'download' ? ' aria-current="page"' : ''}>${t.nav.download}</a>
  </div>
</div></header>`;
}

function footer(lang, page) {
  const t = L[lang]; const u = up(lang);
  const sw = LANGS.map((l) => `<a href="${u}${prefix(l)}${page === 'index' ? (l === 'en' && !u ? './' : '') : `${page}.html`}"${l === lang ? ' aria-current="true"' : ''} hreflang="${l}">${L[l].name}</a>`).join('');
  return `<footer class="foot"><div class="wrap foot-in">
  <div class="foot-brand"><img src="${u}favicon.png" alt="" width="22" height="22"><span>${t.foot.by}</span><span class="dim">·</span><a href="${FILESHAPER}">${t.foot.other}</a></div>
  <div class="foot-links"><a href="${REPO}">${ICON.gh}${t.foot.source}</a><a href="privacy.html">${t.foot.privacy}</a><span class="dim">${t.foot.license}</span></div>
  <div class="langs">${ICON.globe}${sw}</div>
</div></footer>
<script src="${u}site.js?v=${V}" defer></script>
</body></html>`;
}

const dlButtons = (t) => `<div class="cta">
  <a class="btn btn-primary btn-lg" data-os="mac" href="${MAC}">${ICON.apple}${t.hero.mac}</a>
  <a class="btn btn-ghost btn-lg" data-os="win" href="${WIN}">${ICON.win}${t.hero.win}</a>
</div>`;

function indexPage(lang) {
  const t = L[lang]; const u = up(lang);
  return `${head(lang, 'index', t.meta.title, t.meta.desc)}
<body>
${nav(lang, 'index')}
<main id="main">
<section class="hero">
  <div class="wrap">
  <p class="cue-head"><span class="tc">00:00:01,900 --&gt; 00:00:03,300</span><span class="tags">${t.hero.eyebrow}</span></p>
  <h1 class="kara">${t.hero.h1.split(' ').map((w, i) => `<span class="hw" style="--i:${i}">${w}</span>`).join(' ')}</h1>
  <p class="lede">${t.hero.sub}</p>
  ${dlButtons(t)}
  <p class="note">${t.hero.note}</p>
  </div>
  <div class="wrap">
  <div class="hero-wave" aria-hidden="true"><div class="hw-bars">${WAVE}</div><div class="hw-head"></div></div>
  <div class="shot hero-shot">
    <img src="${u}img/app-editor.webp" width="1600" height="1018" alt="Captionshaper editor: a vertical video in a phone frame with bold captions, the caption list and a waveform timeline">
    <div class="scan" aria-hidden="true"></div>
    <div class="live-chip" aria-hidden="true"><span class="dot"></span><span class="live-words" data-words="Every|word,|right|on|time."></span></div>
  </div>
</div></section>

<div class="marquee" aria-hidden="true"><div class="mq-track">${[0, 1].map(() => `<span>${GREETINGS.map((g) => `<b>${g}</b>`).join('<i>·</i>')}<i>·</i></span>`).join('')}</div></div>

<section class="split" id="live"><div class="wrap split-in">
  <div class="split-text"><h2>${t.live.h}</h2><p>${t.live.p}</p></div>
  <div class="shot"><img src="${u}img/app-working.webp" width="1440" height="792" alt="Words appearing live while Captionshaper transcribes, above a waveform" loading="lazy"></div>
</div></section>

<section id="features"><div class="wrap">
  <h2 class="center">${t.feat.h}</h2>
  <div class="grid">${t.feat.items.map(([h, p], i) => `<div class="card spot b${i}" style="--d:${i}"><svg class="ic fi" viewBox="0 0 24 24">${FEAT_ICONS[i]}</svg><h3>${h}</h3><p>${p}</p></div>`).join('')}</div>
</div></section>

<section class="split rev" id="styles"><div class="wrap split-in">
  <div class="split-text"><h2>${t.styles.h}</h2><p>${t.styles.p}</p></div>
  <div class="shot"><img src="${u}img/app-style.webp" width="1600" height="1018" alt="Caption style options: Clean, Box, Pop and Word by word, with size, position and colours" loading="lazy"></div>
</div></section>

<section class="nums"><div class="wrap nums-in">${t.nums.map(([n, l], i) => `<div class="srt"><span class="srt-tc">${CUE_TIMES[i]}</span><b>${n}</b><span class="srt-l">${l}</span></div>`).join('')}</div></section>

<section id="privacy" class="priv"><div class="wrap narrow center">
  <h2>${t.priv.h}</h2><p class="lede">${t.priv.p}</p>
  <ul class="ticks">${t.priv.items.map((x) => `<li>${ICON.check}${x}</li>`).join('')}</ul>
</div></section>

<section id="faq"><div class="wrap narrow">
  <h2>${t.faq.h}</h2>
  <div class="faq">${t.faq.items.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>
</div></section>

<section class="end"><div class="wrap center">
  <h2>${t.hero.h1}</h2>
  ${dlButtons(t)}
  <p class="note">${t.hero.note}</p>
</div></section>
</main>
${footer(lang, 'index')}`;
}

function downloadPage(lang) {
  const t = L[lang]; const d = t.dl;
  return `${head(lang, 'download', `${d.title} · Captionshaper`, t.meta.desc)}
<body>
${nav(lang, 'download')}
<main id="main" class="page"><div class="wrap narrow">
  <h1>${d.h}</h1><p class="lede">${d.sub.replace('{v}', V)}</p>
  <div class="dl-grid">
    <div class="card dl"><div class="dl-os">${ICON.apple}<h2>${d.mac}</h2></div><p>${d.macReq}</p><a class="btn btn-primary" href="${MAC}">${d.macBtn}</a></div>
    <div class="card dl"><div class="dl-os">${ICON.win}<h2>${d.win}</h2></div><p>${d.winReq}</p><a class="btn btn-primary" href="${WIN}">${d.winBtn}</a></div>
  </div>
  <h2 class="mt">${d.firstH}</h2>
  <div class="steps"><div><h3>${d.mac}</h3><ol>${d.macSteps.map((s) => `<li>${s}</li>`).join('')}</ol></div><div><h3>${d.win}</h3><ol>${d.winSteps.map((s) => `<li>${s}</li>`).join('')}</ol></div></div>
  <p class="dim mt-s">${d.why}</p>
  <p class="mt-s"><a class="link" href="${REPO}/releases">${ICON.gh}${d.src}</a></p>
</div></main>
${footer(lang, 'download')}`;
}

function privacyPage(lang) {
  const t = L[lang]; const p = t.privacyPage;
  return `${head(lang, 'privacy', `${p.title} · Captionshaper`, p.body[0])}
<body>
${nav(lang, 'privacy')}
<main id="main" class="page"><div class="wrap narrow prose">
  <h1>${p.h}</h1>${p.body.map((x) => `<p>${x}</p>`).join('')}
</div></main>
${footer(lang, 'privacy')}`;
}

function notFound() {
  const t = L.en;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${t.nf.title} · Captionshaper</title>
<link rel="icon" href="/captionshaper/favicon.png"><link rel="stylesheet" href="/captionshaper/style.css?v=${V}"></head>
<body><main class="page"><div class="wrap narrow center"><h1>${t.nf.h}</h1><p class="mt-s"><a class="btn btn-primary" href="/captionshaper/">${t.nf.home}</a></p></div></main></body></html>`;
}

// ---------- Write ----------
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const assets = path.join(root, 'site/assets');
for (const f of ['style.css', 'site.js', 'favicon.png']) fs.copyFileSync(path.join(assets, f), path.join(out, f));
for (const d of ['fonts', 'img']) fs.cpSync(path.join(assets, d), path.join(out, d), { recursive: true, filter: (p) => !p.endsWith('.png') || p.endsWith('og.png') || fs.statSync(p).isDirectory() });
for (const lang of LANGS) {
  const dir = path.join(out, prefix(lang)); fs.mkdirSync(dir, { recursive: true });
  // Pages in a language folder load shared files from the root.
  fs.writeFileSync(path.join(dir, 'index.html'), indexPage(lang));
  fs.writeFileSync(path.join(dir, 'download.html'), downloadPage(lang));
  fs.writeFileSync(path.join(dir, 'privacy.html'), privacyPage(lang));
}
// Language folders reuse root images via ../img
fs.writeFileSync(path.join(out, '404.html'), notFound());
fs.writeFileSync(path.join(out, '.nojekyll'), '');
fs.writeFileSync(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);
fs.writeFileSync(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${['index', 'download', 'privacy'].flatMap((p) => LANGS.map((l) => `<url><loc>${url(l, p)}</loc>${LANGS.map((x) => `<xhtml:link rel="alternate" hreflang="${x}" href="${url(x, p)}"/>`).join('')}</url>`)).join('\n')}
</urlset>
`);
const e = L.en;
fs.writeFileSync(path.join(out, 'llms.txt'), `# Captionshaper

> ${e.meta.desc}

Captionshaper by Hollowbit is a free, open-source (GPL-3.0) desktop app for macOS (Apple Silicon) and Windows that makes subtitles and captions from video or audio, fully offline. Version ${V}.

## What it does
${e.feat.items.map(([h, p]) => `- ${h}: ${p}`).join('\n')}

## FAQ
${e.faq.items.map(([q, a]) => `### ${q}\n${a}`).join('\n\n')}

## Links
- Download: ${BASE}/download.html
- Source: ${REPO}
- Privacy: ${BASE}/privacy.html
`);
console.log(`Built ${LANGS.length * 3 + 1} pages into docs/`);

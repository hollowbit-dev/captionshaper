// "Made by Hollowbit Studio" pieces shared by every Hollowbit product site (same file in each repo).
// Adds a Hollowbit pill next to the logo, a badge above the hero headline and a studio card in the footer.
const STUDIO = 'https://hollowbit.dev/';
const T = {
  en: { pill: 'Hollowbit', badge: 'A free app by Hollowbit Studio', card: '{app} is made by Hollowbit Studio, who also make {others}. Free tools that never upload your files.', visit: 'Visit hollowbit.dev', and: 'and' },
  es: { pill: 'Hollowbit', badge: 'Una app gratis de Hollowbit Studio', card: '{app} es obra de Hollowbit Studio, que también hace {others}. Herramientas gratis que nunca suben tus archivos.', visit: 'Visitar hollowbit.dev', and: 'y' },
  fr: { pill: 'Hollowbit', badge: 'Une appli gratuite de Hollowbit Studio', card: '{app} est fait par Hollowbit Studio, qui fait aussi {others}. Des outils gratuits qui n’envoient jamais vos fichiers.', visit: 'Visiter hollowbit.dev', and: 'et' },
  de: { pill: 'Hollowbit', badge: 'Eine kostenlose App von Hollowbit Studio', card: '{app} stammt von Hollowbit Studio, die auch {others} machen. Kostenlose Werkzeuge, die deine Dateien nie hochladen.', visit: 'hollowbit.dev besuchen', and: 'und' },
  ru: { pill: 'Hollowbit', badge: 'Бесплатное приложение от Hollowbit Studio', card: '{app} сделан Hollowbit Studio — авторами {others}. Бесплатные инструменты, которые никогда не загружают ваши файлы.', visit: 'Перейти на hollowbit.dev', and: 'и' },
  zh: { pill: 'Hollowbit', badge: 'Hollowbit Studio 出品的免费应用', card: '{app} 由 Hollowbit Studio 制作，他们也做了 {others}。从不上传你文件的免费工具。', visit: '访问 hollowbit.dev', and: '和' },
};
const APPS = ['Fileshaper', 'Captionshaper', 'Diskshaper', 'Writeshaper', 'Startshaper', 'Fuseduo'];
const MARK = '<svg class="hbm" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M6 2h12a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4Zm9 13.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/></svg>';
const ARROW = '<svg class="hba" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg>';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const t = (lang) => T[lang] || T.en;

export const studioPill = (lang) => `<a class="hb-pill" href="${STUDIO}" title="Hollowbit Studio">${MARK}<span>${esc(t(lang).pill)}</span></a>`;
export const studioBadge = (lang) => `<a class="hb-badge" href="${STUDIO}">${MARK}<span>${esc(t(lang).badge)}</span>${ARROW}</a>`;
export const studioCard = (lang, app) => {
  const s = t(lang), others = APPS.filter((a) => a !== app);
  return `<a class="hb-card" href="${STUDIO}"><span class="hb-tile">${MARK}</span><span class="hb-txt"><b>Hollowbit Studio</b><span>${esc(s.card.replace('{app}', app).replace('{others}', `${others.slice(0, -1).join(lang === 'zh' ? '、' : ', ')} ${s.and} ${others[others.length - 1]}`))}</span></span><span class="hb-go">${esc(s.visit)}${ARROW}</span></a>`;
};
export const studioCss = `
/* Hollowbit Studio links (site/studio.mjs) */
.hb-pill { display: inline-flex; align-items: center; gap: 6px; margin-left: 10px; padding: 4px 10px 4px 8px; border-radius: 999px; border: 1px solid rgba(255,255,255,.12); color: rgba(255,255,255,.62); font-size: 12.5px; font-weight: 560; letter-spacing: 0; transition: color .2s, border-color .2s, background .2s; white-space: nowrap; }
.hb-pill:hover { color: #fff; border-color: rgba(255,255,255,.28); background: rgba(255,255,255,.05); }
.hb-pill .hbm { width: 13px; height: 13px; }
.hb-badge { display: inline-flex; align-items: center; gap: 8px; margin: 0 auto 22px; padding: 6px 12px 6px 9px; border-radius: 999px; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.03); color: #f2f2f2; font-size: 14px; font-weight: 520; transition: border-color .2s, background .2s; }
.hb-badge:hover { border-color: color-mix(in srgb, var(--hb-accent, #fff) 55%, transparent); background: color-mix(in srgb, var(--hb-accent, #fff) 9%, transparent); }
.hb-badge .hbm { width: 15px; height: 15px; color: var(--hb-accent, #fff); }
.hb-badge .hba { width: 14px; height: 14px; opacity: .6; transition: transform .2s, opacity .2s; }
.hb-badge:hover .hba { transform: translateX(3px); opacity: 1; }
.hb-card { display: flex; align-items: center; gap: 18px; padding: 22px 24px; margin: 0 0 48px; border-radius: 20px; border: 1px solid rgba(255,255,255,.09); background: rgba(255,255,255,.025); color: inherit; text-decoration: none; transition: border-color .25s, transform .3s cubic-bezier(.22,1,.36,1); }
.hb-card:hover { border-color: rgba(255,255,255,.18); transform: translateY(-2px); }
.hb-tile { width: 50px; height: 50px; border-radius: 14px; background: #f4f4f1; color: #0b0b0d; display: grid; place-items: center; flex: none; }
.hb-tile .hbm { width: 25px; height: 25px; }
.hb-txt { display: grid; gap: 3px; font-size: 14.5px; color: rgba(255,255,255,.62); line-height: 1.5; }
.hb-txt b { color: #fff; font-size: 16px; }
.hb-go { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; color: #fff; font-weight: 580; white-space: nowrap; font-size: 15px; }
.hb-go .hba { width: 16px; height: 16px; transition: transform .2s; }
.hb-card:hover .hb-go .hba { transform: translateX(4px); }
@media (max-width: 700px) { .hb-pill span { display: none; } .hb-pill { padding: 5px; margin-left: 6px; } .hb-card { flex-wrap: wrap; } .hb-go { margin-left: 0; } }
`;

// Caption fonts bundled with Captionshaper (all SIL Open Font License).
// asc/desc/cap = Windows ascent, descent and cap height in em (libass lays lines out with these).
// `scale` = ASS font size / CSS em size for this font, measured by scripts/calibrate-fonts.cjs
// so the live preview and the burned-in video come out the same size.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CaptionFonts = factory();
}(typeof self !== 'undefined' ? self : this, () => {
  const FONTS = [
    { id: 'geist-semibold', label: 'Geist SemiBold', file: 'Geist-SemiBold.ttf', ass: 'Geist SemiBold', scale: 1.352, asc: 1.088, desc: 0.262, cap: 0.71 },
    { id: 'geist-bold', label: 'Geist Bold', file: 'Geist-Bold.ttf', ass: 'Geist Bold', scale: 1.352, asc: 1.088, desc: 0.262, cap: 0.71 },
    { id: 'geist-black', label: 'Geist Black', file: 'Geist-Black.ttf', ass: 'Geist Black', scale: 1.352, asc: 1.088, desc: 0.262, cap: 0.71 },
    { id: 'montserrat-extrabold', label: 'Montserrat ExtraBold', file: 'Montserrat-ExtraBold.ttf', ass: 'Montserrat ExtraBold', scale: 1.556, asc: 1.109, desc: 0.453, cap: 0.7 },
    { id: 'montserrat-black', label: 'Montserrat Black', file: 'Montserrat-Black.ttf', ass: 'Montserrat Black', scale: 1.556, asc: 1.109, desc: 0.453, cap: 0.7 },
    { id: 'poppins-bold', label: 'Poppins Bold', file: 'Poppins-Bold.ttf', ass: 'Poppins Bold', scale: 1.755, asc: 1.135, desc: 0.627, cap: 0.705 },
    { id: 'poppins-extrabold', label: 'Poppins ExtraBold', file: 'Poppins-ExtraBold.ttf', ass: 'Poppins ExtraBold', scale: 1.762, asc: 1.135, desc: 0.627, cap: 0.709 },
    { id: 'poppins-black', label: 'Poppins Black', file: 'Poppins-Black.ttf', ass: 'Poppins Black', scale: 1.748, asc: 1.135, desc: 0.627, cap: 0.713 },
    { id: 'anton', label: 'Anton', file: 'Anton-Regular.ttf', ass: 'Anton', scale: 1.736, asc: 1.404, desc: 0.329, cap: 0.859 },
    { id: 'bebas', label: 'Bebas Neue', file: 'BebasNeue-Regular.ttf', ass: 'Bebas Neue', scale: 1.296, asc: 0.95, desc: 0.35, cap: 0.7 },
    { id: 'bangers', label: 'Bangers', file: 'Bangers-Regular.ttf', ass: 'Bangers', scale: 1.746, asc: 1.401, desc: 0.356, cap: 0.721 },
  ];
  const byId = Object.fromEntries(FONTS.map((f) => [f.id, f]));
  // CSS family name used by the preview (registered with FontFace).
  const css = (id) => `cs-${id}`;
  return { FONTS, byId, css, get: (id) => byId[id] || byId['geist-semibold'] };
}));

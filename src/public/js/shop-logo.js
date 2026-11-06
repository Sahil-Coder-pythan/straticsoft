/* Stratic Market — automatic shop logo + banner. Pure code: no API, no images.
   Same file runs in the browser (window.StraticLogo) and on the server (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.StraticLogo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var counter = 0;
  function hash(str) { var h = 2166136261; str = String(str || '').toLowerCase().trim(); for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function initials(name) {
    var words = Array.from(String(name || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean));
    if (!words.length) return 'S';
    var a = Array.from(words[0])[0] || 'S', b = words.length > 1 ? (Array.from(words[1])[0] || '') : '';
    return (a + b).toUpperCase().slice(0, 2);
  }
  var PALETTES = [
    ['#0b0910', '#2a1745'],   // black plum
    ['#1b1040', '#4b2bd0'],   // royal violet
    ['#0b1a2e', '#0f4c75'],   // midnight blue
    ['#1d0b12', '#5a1230'],   // wine
    ['#0a1a14', '#0f5a41'],   // emerald
    ['#16101f', '#3b2a6b']    // dusk
  ];
  var GOLD = ['#fff0b8', '#f0c35a', '#b9811c'];
  var EMBLEMS = [
    { n: 'crown',   d: 'M18 70 L12 34 L36 52 L50 22 L64 52 L88 34 L82 70 Z M18 77 H82 V86 H18 Z' },
    { n: 'diamond', d: 'M50 14 L86 44 L50 88 L14 44 Z', facets: 'M14 44 H86 M34 44 L50 14 L66 44 L50 88 Z' },
    { n: 'bag',     d: 'M22 40 H78 L85 88 H15 Z', handle: 'M36 40 V32 A14 14 0 0 1 64 32 V40' },
    { n: 'star',    d: 'M50 10 L61 38 L91 40 L68 59 L76 88 L50 72 L24 88 L32 59 L9 40 L39 38 Z' },
    { n: 'bolt',    d: 'M58 8 L24 56 H47 L40 92 L76 42 H53 Z' },
    { n: 'leaf',    d: 'M18 82 C16 40 48 14 86 14 C86 54 62 86 18 82 Z', facets: 'M22 78 L68 34' },
    { n: 'shield',  d: 'M50 10 L86 22 V50 C86 72 70 84 50 92 C30 84 14 72 14 50 V22 Z', facets: 'M50 24 V78 M30 40 H70' },
    { n: 'heart',   d: 'M50 86 L17 52 C5 38 19 16 36 22 C44 25 48 30 50 34 C52 30 56 25 64 22 C81 16 95 38 83 52 Z' }
  ];
  function sparkle(x, y, r, fill, op) { return '<path d="M' + x + ' ' + (y - r) + ' L' + (x + r * 0.28) + ' ' + (y - r * 0.28) + ' L' + (x + r) + ' ' + y + ' L' + (x + r * 0.28) + ' ' + (y + r * 0.28) + ' L' + x + ' ' + (y + r) + ' L' + (x - r * 0.28) + ' ' + (y + r * 0.28) + ' L' + (x - r) + ' ' + y + ' L' + (x - r * 0.28) + ' ' + (y - r * 0.28) + ' Z" fill="' + fill + '" opacity="' + op + '"/>'; }

  function logoSvg(name, size) {
    size = size || 120;
    var h = hash(name), id = 'sl' + h.toString(36) + (counter++);
    var pal = PALETTES[h % PALETTES.length], em = EMBLEMS[(h >>> 3) % EMBLEMS.length], layout = (h >>> 7) % 3;
    var ini = esc(initials(name));
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="' + size + '" height="' + size + '" role="img" aria-label="' + esc(name) + ' logo">' +
      '<defs>' +
      '<linearGradient id="' + id + 'b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + pal[0] + '"/><stop offset="1" stop-color="' + pal[1] + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + GOLD[0] + '"/><stop offset="0.5" stop-color="' + GOLD[1] + '"/><stop offset="1" stop-color="' + GOLD[2] + '"/></linearGradient>' +
      '<radialGradient id="' + id + 'r" cx="0.3" cy="0.2" r="0.9"><stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>' +
      '</defs>' +
      '<rect width="240" height="240" rx="46" fill="url(#' + id + 'b)"/><rect width="240" height="240" rx="46" fill="url(#' + id + 'r)"/>' +
      '<rect x="7" y="7" width="226" height="226" rx="40" fill="none" stroke="url(#' + id + 'g)" stroke-width="2" opacity="0.55"/>';
    // gold wave along the bottom
    s += '<path d="M0 186 C36 166 76 208 120 186 S204 168 240 186 V240 H0 Z" fill="url(#' + id + 'g)" opacity="0.22"/>' +
         '<path d="M-4 190 C36 170 76 212 120 190 S204 172 244 190" fill="none" stroke="url(#' + id + 'g)" stroke-width="3.5" stroke-linecap="round"/>';
    if (layout === 1) {
      // big monogram
      s += '<text x="120" y="142" text-anchor="middle" font-family="Georgia,\'Times New Roman\',serif" font-weight="700" font-size="' + (ini.length > 1 ? 92 : 120) + '" fill="url(#' + id + 'g)" letter-spacing="2">' + ini + '</text>';
      s += sparkle(190, 54, 12, '#fff0b8', 0.9) + sparkle(52, 84, 6, '#f0c35a', 0.8);
    } else {
      var sc = layout === 2 ? 1.05 : 1.35, tx = 120 - 50 * sc, ty = layout === 2 ? 28 : 40;
      s += '<g transform="translate(' + tx.toFixed(1) + ' ' + ty + ') scale(' + sc + ')">';
      if (em.handle) s += '<path d="' + em.handle + '" fill="none" stroke="url(#' + id + 'g)" stroke-width="7" stroke-linecap="round"/>';
      s += '<path d="' + em.d + '" fill="url(#' + id + 'g)" fill-rule="evenodd"/>';
      if (em.facets) s += '<path d="' + em.facets + '" fill="none" stroke="' + pal[0] + '" stroke-width="2.4" opacity="0.55" stroke-linejoin="round" stroke-linecap="round"/>';
      s += '</g>';
      if (layout === 2) s += '<text x="120" y="176" text-anchor="middle" font-family="Georgia,\'Times New Roman\',serif" font-weight="700" font-size="34" fill="url(#' + id + 'g)" letter-spacing="3">' + ini + '</text>';
      s += sparkle(194, 50, 11, '#fff0b8', 0.9) + sparkle(46, 72, 6, '#f0c35a', 0.8);
    }
    return s + '</svg>';
  }

  function bannerSvg(name) {
    var h = hash(name), id = 'sb' + h.toString(36) + (counter++), pal = PALETTES[(h >>> 2) % PALETTES.length];
    var a = (h % 5) * 40 + 120, b = ((h >>> 5) % 5) * 55 + 300;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 360" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">' +
      '<defs>' +
      '<linearGradient id="' + id + 'b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + pal[0] + '"/><stop offset="0.6" stop-color="' + pal[1] + '"/><stop offset="1" stop-color="#7b4dff"/></linearGradient>' +
      '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + GOLD[0] + '"/><stop offset="0.5" stop-color="' + GOLD[1] + '"/><stop offset="1" stop-color="' + GOLD[2] + '"/></linearGradient>' +
      '<radialGradient id="' + id + 'o" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>' +
      '</defs>' +
      '<rect width="1200" height="360" fill="url(#' + id + 'b)"/>' +
      '<circle cx="' + b + '" cy="60" r="260" fill="url(#' + id + 'o)"/><circle cx="' + a + '" cy="330" r="220" fill="url(#' + id + 'o)"/>' +
      '<path d="M0 250 C200 190 380 330 620 262 S1000 190 1200 250 V360 H0 Z" fill="#ffffff" opacity="0.07"/>' +
      '<path d="M0 282 C220 230 400 350 640 292 S1010 226 1200 282" fill="none" stroke="url(#' + id + 'g)" stroke-width="5" stroke-linecap="round" opacity="0.9"/>' +
      '<path d="M0 304 C240 262 420 366 660 314 S1020 262 1200 304" fill="none" stroke="url(#' + id + 'g)" stroke-width="2" stroke-linecap="round" opacity="0.5"/>' +
      sparkle(160, 80, 16, '#fff0b8', 0.9) + sparkle(1010, 70, 22, '#fff0b8', 0.85) + sparkle(1110, 170, 10, '#f0c35a', 0.8) + sparkle(560, 46, 9, '#ffffff', 0.7) + sparkle(820, 150, 7, '#f0c35a', 0.7) +
      '</svg>';
  }
  return { logoSvg: logoSvg, bannerSvg: bannerSvg, initials: initials, hash: hash };
});

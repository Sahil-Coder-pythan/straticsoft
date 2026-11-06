/* Stratic Market — luxury website wiring (loads after shop.js; shop.js stays untouched) */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  // ---- top loading line: shows on every fetch, so navigation never feels frozen/hung ----
  (function () {
    var bar = $('lw-bar'); if (!bar || !window.fetch) return;
    var n = 0, hideT = null;
    function start() { n++; clearTimeout(hideT); bar.style.opacity = '1'; requestAnimationFrame(function () { bar.style.width = '72%'; }); }
    function done() { n = Math.max(0, n - 1); if (n) return; bar.style.width = '100%'; hideT = setTimeout(function () { bar.style.opacity = '0'; setTimeout(function () { bar.style.width = '0'; }, 300); }, 160); }
    var of = window.fetch;
    window.fetch = function () { start(); return of.apply(this, arguments).then(function (r) { done(); return r; }, function (e) { done(); throw e; }); };
  })();

  // ---- header: subtle elevation once the page scrolls ----
  ready(function () {
    var head = document.querySelector('.am-top'); if (!head) return;
    function onScroll() { head.classList.toggle('scrolled', window.scrollY > 6); }
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  });

  // ---- website nav / footer links reuse the app's own working buttons (no duplicate logic) ----
  ready(function () {
    var map = {
      sell: function () { var b = $('open-sell'); if (b) b.click(); },
      stores: function () { var h = $('nav-home'); if (h) h.click(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
      cats: function () { var c = $('nav-cats'); if (c) c.click(); document.querySelector('.am-sheet').scrollIntoView({ behavior: 'smooth', block: 'start' }); },
      deals: function () { var c = document.querySelector('.am-chip[data-c="Deals"]'); if (c) c.click(); document.querySelector('.am-sheet').scrollIntoView({ behavior: 'smooth', block: 'start' }); },
      help: function () { var b = $('open-help'); if (b) b.click(); },
      chat: function () { var b = $('open-chat'); if (b) b.click(); },
      cart: function () { var b = $('open-cart2') || $('open-cart'); if (b) b.click(); },
      gateway: function () { var b = $('lx-burger'); if (b) b.click(); }
    };
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-go]') : null; if (!t) return;
      var fn = map[t.getAttribute('data-go')]; if (fn) { e.preventDefault(); fn(); }
    });
  });

  // ---- cart badge: mirror the app's own counter onto the website cart icon ----
  ready(function () {
    var src = $('cart-n'), dst = $('lw-cart-n'); if (!src || !dst) return;
    function sync() { var n = src.textContent.trim(); dst.textContent = n; dst.hidden = !n || n === '0'; }
    sync(); new MutationObserver(sync).observe(src, { childList: true, characterData: true, subtree: true });
  });

  // ---- category chips: swap the emoji icons for clean line-art SVGs (website look, not app emoji) ----
  var CHIP_SVG = {
    All: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
    Mobiles: '<rect x="7" y="2" width="10" height="20" rx="2.4"/><path d="M11 18h2"/>',
    Fashion: '<path d="M8 4l4 3 4-3M9 4L4 7l2 4 2-1v10h8V10l2 1 2-4-5-3"/>',
    Electronics: '<rect x="4" y="4" width="16" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>',
    Home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    Deals: '<path d="M20 12l-8-8H5v7l8 8z"/><circle cx="8.5" cy="8.5" r="1.5"/>',
    Jewellery: '<path d="M7 9l5-6 5 6-5 11z"/><path d="M7 9h10M12 3v6"/>',
    'Books & Learning': '<path d="M4 5h7a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4z"/><path d="M20 5h-7a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h7z"/>',
    'Toys & Kids': '<circle cx="12" cy="7" r="3"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>',
    'Beauty & Care': '<path d="M9 2h6M10 2v4l-3 3v11h10V9l-3-3V2"/>',
    'Home & Living': '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    'Shoes & Sneakers': '<path d="M3 17c2-1 3-1 5-1l3-4 6 2c3 1 4 2 4 3v2H3z"/>',
    'Health & Household': '<path d="M12 4v16M4 12h16"/>',
    Furniture: '<path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M4 10v9M20 10v9M4 15h16"/>',
    'Garden & Outdoor': '<path d="M12 21c0-7 4-9 7-9-1 5-3 9-7 9z"/><path d="M12 21c0-7-4-9-7-9 1 5 3 9 7 9zM12 3v6"/>',
    'Grocery & Gourmet': '<path d="M6 7h13l-1.5 10h-10z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/>',
    'Sports & Fitness': '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16"/>',
    'Cars & Motorbike': '<path d="M4 16V11l2-5h12l2 5v5"/><circle cx="7.5" cy="16.5" r="1.6"/><circle cx="16.5" cy="16.5" r="1.6"/>',
    "Tools & Home Improvement": '<path d="M21 3l-6 6M14 10l-9 9 1 1 9-9M8 8l-4 4"/>',
    'Movies & Music': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.2"/>'
  };
  function swapChipIcons() {
    document.querySelectorAll('.am-chip .chip-ico').forEach(function (ico) {
      if (ico.querySelector('svg')) return;
      var label = (ico.parentNode.textContent || '').trim(), key = Object.keys(CHIP_SVG).find(function (k) { return label.indexOf(k) === 0; });
      var d = CHIP_SVG[key] || CHIP_SVG.All;
      ico.innerHTML = '<svg class="lw-keep" viewBox="0 0 24 24" fill="none" stroke="currentColor">' + d + '</svg>';
    });
  }
  ready(function () {
    var t = $('tabs'); if (!t) return;
    swapChipIcons(); new MutationObserver(swapChipIcons).observe(t, { childList: true, subtree: true });
  });
})();

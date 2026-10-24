
setTimeout(function(){ try{ setAvatar(null);}catch(e){} },0);
function setAvatar(user){
  var av = document.getElementById('top-avatar');
  if (!av) return;
  // Keep bell icon UI; title shows who is signed in
  if (user && (user.name || user.email)) {
    av.title = (user.name || user.email) + ' — Account';
    av.classList.remove('guest');
  } else {
    av.title = 'Account';
    av.classList.add('guest');
  }
}
(function () {
  var CATS = ['All', 'Mobiles', 'Fashion', 'Electronics', 'Home', 'Deals'];
  var CAT_ICO = {
    All: '▦', Mobiles: '📱', Fashion: '👕', Electronics: '⚡', Home: '🔌',
    Deals: '🏷', Laptops: '💻', TV: '📺', Women: '👗', Kids: '🧸', Footwear: '👟',
    Watches: '⌚', Jewellery: '💍', Beauty: '💄', Health: '💊', Furniture: '🛋',
    Garden: '🌿', Grocery: '🛒', Sports: '⚽', Automotive: '🚗', Tools: '🔧',
    Books: '📚', Movies: '🎬', Gaming: '🎮', Toys: '🎯', Pet: '🐾', Office: '📎',
    Luggage: '🧳', Handmade: '✋', Pharmacy: '💉', Other: '📦'
  };
  var all = [], cat = 'All', cart = {}, me = null, after = null;
  try { cart = JSON.parse(localStorage.getItem('sgm_cart') || '{}') || {}; } catch (e) { cart = {}; }
  var $ = function (i) { return document.getElementById(i); };
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function money(n, c) { try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: c || 'INR', maximumFractionDigits: 0 }).format(n); } catch (e) { return '₹' + n; } }
  function api(url, opt) {
    opt = opt || {};
    opt.headers = Object.assign({ 'x-sgm': '1' }, opt.headers || {});
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, 60000);
    opt.signal = ctrl.signal;
    return fetch(url, opt).then(function (r) {
      clearTimeout(t);
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || 'Something went wrong. Try again.');
        return d;
      });
    }).catch(function (e) {
      clearTimeout(t);
      if (e.name === 'AbortError') throw new Error('Server is waking up or slow. Please wait and refresh.');
      throw e;
    });
  }
  function jpost(url, body, method) { return api(url, { method: method || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  function saveCart() {
    try { localStorage.setItem('sgm_cart', JSON.stringify(cart)); } catch (e) {}
    var n = Object.keys(cart).reduce(function (s, k) { return s + cart[k]; }, 0);
    if ($('cart-n')) $('cart-n').textContent = n;
    var b = $('cart-n2');
    if (b) { b.textContent = n; b.setAttribute('data-zero', n ? '0' : '1'); }
  }
  function addCart(id) { cart[id] = Math.min((cart[id] || 0) + 1, 10); saveCart(); }
  function needLogin(fn) { if (me) return fn(); after = fn; authScreen('login'); }
  function tabs() {
    var t = $('tabs'); if (!t) return; t.textContent = '';
    CATS.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'am-chip' + (c === cat ? ' on' : '');
      b.setAttribute('data-c', c);
      var ico = document.createElement('span');
      ico.className = 'chip-ico';
      ico.textContent = CAT_ICO[c] || '•';
      b.appendChild(ico);
      b.appendChild(document.createTextNode(c === 'Home' ? 'Home' : c));
      b.onclick = function () { cat = c; tabs(); render(); };
      t.appendChild(b);
    });
  }
  function openBuy(p) {
    var d = $('buy');
    $('buy-title').textContent = p.title;
    $('buy-price').textContent = money(p.price, p.currency);
    $('buy-seller').textContent = p.seller + (p.city ? ' · ' + p.city : '');
    var ph = p.phone || '';
    $('buy-phone').textContent = ph || 'Not shared';
    $('buy-call').href = ph ? ('tel:' + ph.replace(/\s/g, '')) : '#';
    $('buy-call').style.display = ph ? '' : 'none';
    $('buy-wa').href = ph ? ('https://wa.me/' + ph.replace(/\D/g, '')) : '#';
    $('buy-wa').style.display = ph ? '' : 'none';
    if (!d.open) d.showModal();
  }
  function render() {
    var q = $('q').value.trim().toLowerCase(), s = $('sort').value;
    var l = all.filter(function (p) {
      return (cat === 'All' || (cat === 'Deals' ? p.off > 0 : p.category === cat)) &&
        (!q || (p.title + ' ' + p.seller + ' ' + (p.description || '')).toLowerCase().indexOf(q) > -1);
    });
    if (s === 'lo') l.sort(function (a, b) { return a.price - b.price; });
    else if (s === 'hi') l.sort(function (a, b) { return b.price - a.price; });
    $('head').textContent = cat === 'All' ? 'All products' : cat;
    var g = $('grid'); g.textContent = '';
    if (!l.length) {
      var box = document.createElement('div');
      box.className = 'am-empty-box';
      box.innerHTML = all.length
        ? '<h2 class="empty-title">No matches</h2><p class="empty-sub">Try another search or category</p>'
        : '<div class="empty-illu" aria-hidden="true"><svg width="160" height="140" viewBox="0 0 160 140" fill="none"><path d="M30 55l50-22 50 22v50l-50 22-50-22V55z" fill="#E8C9A0" stroke="#C4A574" stroke-width="2"/><path d="M30 55l50 22 50-22" stroke="#C4A574" stroke-width="2"/><path d="M80 77v50" stroke="#C4A574" stroke-width="2"/><path d="M55 40l25-12 40 18-25 12-40-18z" fill="#D4B48A" stroke="#C4A574" stroke-width="2"/></svg></div><h2 class="empty-title">Your Bazaar is Empty</h2><p class="empty-sub">Be the first to sell from your city to the World</p><button type="button" class="am-cta" id="empty-sell">Sell Your First Product +</button>';
      g.appendChild(box);
      var es = document.getElementById('empty-sell');
      if (es) es.onclick = function () { var s = $('open-sell'); if (s) s.click(); };
      return;
    }
    l.forEach(function (p) {
      var c = el('div', 'am-card'), im = el('img');
      im.src = p.img || p.image || ''; im.alt = p.title; im.loading = 'lazy';
      var pr = el('div', 'am-price');
      pr.appendChild(el('b', '', money(p.price, p.currency)));
      if (p.mrp && p.mrp > p.price) {
        pr.appendChild(el('s', '', money(p.mrp, p.currency)));
        var off = Math.round((1 - p.price / p.mrp) * 100);
        pr.appendChild(el('em', '', off + '% off'));
      }
      var bt = el('div', 'am-btns');
      var a = el('button', 'am-pb d', 'Add to Cart');
      var b = el('button', 'am-pb y', 'Buy Now');
      a.onclick = function () { addCart(p.id); a.textContent = 'Added ✓'; setTimeout(function () { a.textContent = 'Add to Cart'; }, 900); };
      b.onclick = function () { openBuy(p); };
      if (p.mine) { a.disabled = b.disabled = true; a.style.opacity = b.style.opacity = '.4'; }
      bt.append(a, b);
      var top = el('div', 'am-card-top');
      top.appendChild(im);
      if (p.mine) {
        var menu = el('button', 'am-dots', '⋮');
        menu.type = 'button';
        menu.onclick = function (e) {
          e.stopPropagation();
          if (confirm('Delete this listing?')) {
            api('/shop/api/products/' + p.id, { method: 'DELETE' }).then(load).catch(function (err) { alert(err.message); });
          }
        };
        top.appendChild(menu);
      }
      var body = el('div', 'am-card-body');
      body.appendChild(el('div', 't', p.title));
      body.appendChild(el('div', 'am-s', p.seller + (p.city ? ' · ' + p.city : '')));
      body.appendChild(pr);
      body.appendChild(el('div', 'am-s', '🚚 ' + (p.days || 5) + ' days'));
      body.appendChild(bt);
      c.append(top, body);
      g.appendChild(c);
    });
  }
  function load() {
    var c = (me && me.country) || localStorage.getItem('sgm_country') || '';
    var url = '/shop/api/products' + (c ? ('?country=' + encodeURIComponent(c)) : '');
    api(url).then(function (d) {
      all = d.products || [];
      render();
    }).catch(function (e) {
      if ($('grid')) $('grid').innerHTML = '<p class="am-empty">' + (e.message || 'Could not load') + '</p>';
    });
  }
  function openCart() {
    var l = $('cart-list'); l.textContent = '';
    var tot = {}, n = 0;
    Object.keys(cart).forEach(function (id) {
      var p = all.find(function (x) { return x.id === id; });
      if (!p) return; n++;
      tot[p.currency] = (tot[p.currency] || 0) + p.price * cart[id];
      var r = el('div', 'ci'), im = el('img'); im.src = p.img || p.image || '';
      var d = el('div'); d.append(el('div', '', p.title), el('b', '', cart[id] + ' × ' + money(p.price, p.currency)));
      var x = el('button', 'am-x', '✕');
      x.onclick = function () { delete cart[id]; saveCart(); openCart(); };
      r.append(im, d, x); l.appendChild(r);
    });
    l.appendChild(el('p', '', n ? 'Total: ' + Object.keys(tot).map(function (c) { return money(tot[c], c); }).join(' + ') : 'Your cart is empty.'));
    if (n) {
      var ck = el('button', 'am-btn y', 'Checkout');
      ck.style.width = '100%';
      ck.onclick = function () { needLogin(function () { $('cart').close(); $('co').showModal(); }); };
      l.appendChild(ck);
    }
    if (!$('cart').open) $('cart').showModal();
  }
  $('open-cart').onclick = $('open-cart2').onclick = function (e) { e.preventDefault(); openCart(); };
  $('cart-close').onclick = function () { $('cart').close(); };
  $('buy-close').onclick = function () { $('buy').close(); };
  $('q').oninput = render; $('sort').onchange = render;

  var scr = $('auth');
  function authScreen(mode) {
    var reg = mode === 'register';
    var scr = $('auth');
    scr.hidden = false;
    scr.dataset.mode = mode;
    $('au-h').textContent = reg ? 'Create account' : 'Sign in';
    $('au-name-l').hidden = !reg;
    if ($('au-phone-l')) $('au-phone-l').hidden = !reg;
    if ($('au-country-l')) $('au-country-l').hidden = !reg;
    if ($('au-lang-l')) $('au-lang-l').hidden = !reg;
    $('au-go').textContent = reg ? 'Create account' : 'Sign in';
    $('au-sw').textContent = reg ? 'Already have an account? Sign in' : 'Create your account';
    $('au-m').textContent = '';
  }
  function authClose() { scr.hidden = true; document.body.style.overflow = ''; }
  if ($('au-sw')) $('au-sw').onclick = function (e) { e.preventDefault(); authScreen(scr.dataset.mode === 'login' ? 'register' : 'login'); };
  $('au-skip').onclick = function (e) { e.preventDefault(); try { sessionStorage.setItem('sgm_skip', '1'); } catch (x) {} after = null; authClose(); };
  $('au-form').onsubmit = function (e) {
    e.preventDefault();
    var f = e.target, reg = $('auth').dataset.mode === 'register';
    var body = { email: f.email.value, password: f.password.value };
    if (reg) {
      body.name = f.name.value;
      body.phone = f.phone.value;
      body.country = f.country.value;
      body.lang = f.lang.value;
      if (!body.phone) { $('au-m').textContent = 'Mobile number required.'; return; }
    }
    $('au-m').textContent = reg ? 'Creating…' : 'Signing in…';
    jpost(reg ? '/shop/api/register' : '/shop/api/login', body).then(function (d) {
      me = d.user; setAvatar(d.user);
      try { localStorage.setItem('sgm_country', me.country || ''); localStorage.setItem('sgm_lang', me.lang || 'en'); } catch (x) {}
      $('auth').hidden = true; document.body.style.overflow = '';
      if (after) { var fn = after; after = null; fn(); } else load();
    }).catch(function (er) { $('au-m').textContent = er.message; });
  };
  function accView() {
    if (!me) { authScreen('login'); return; }
    var b = $('acc-body'); b.textContent = '';
    b.appendChild(el('p', '', 'Signed in as ' + me.name + ' (' + (me.email || '') + ')'));
    b.appendChild(el('p', 'am-s', '📱 ' + (me.phone || '—') + ' · ' + (me.country || 'IN') + ' · ' + (me.lang || 'en')));
    [['My orders', function () { showOrders('mine'); }],
     ['Orders received (seller)', function () { showOrders('sell'); }],
     ['My listings', function () {
       $('acc').close();
       var mine = all.filter(function (p) { return p.mine; });
       var g = $('grid'); g.textContent = '';
       $('head').textContent = 'My listings';
       if (!mine.length) { g.appendChild(el('p', 'am-empty', 'No listings yet.')); return; }
       mine.forEach(function (p) {
         var c = el('div', 'am-card');
         var im = el('img'); im.src = p.img || ''; im.loading = 'lazy';
         c.append(im, el('div', 'am-t', p.title), el('div', 'am-s', money(p.price, p.currency)));
         var d = el('button', 'am-btn', 'Delete listing');
         d.style.width = '100%'; d.style.marginTop = '8px';
         d.onclick = function () {
           if (confirm('Delete?')) api('/shop/api/products/' + p.id, { method: 'DELETE' }).then(function () { load(); accView(); }).catch(function (e) { alert(e.message); });
         };
         c.appendChild(d);
         g.appendChild(c);
       });
     }],
     ['Language / Country', function () {
       var lang = prompt('Language code (en/hi/ta/te/mr)', me.lang || 'en');
       var country = prompt('Country code (IN/US/GB/AE)', me.country || 'IN');
       if (!lang && !country) return;
       jpost('/shop/api/profile', { lang: lang || me.lang, country: (country || me.country || 'IN').toUpperCase() }, 'PATCH')
         .then(function (d) {
           me = d.user; setAvatar(d.user);
           try { localStorage.setItem('sgm_country', me.country); localStorage.setItem('sgm_lang', me.lang); } catch (x) {}
           load();
           accView();
         }).catch(function (e) { alert(e.message); });
     }],
     ['Help', function () { $('acc').close(); if ($('help-dlg')) $('help-dlg').showModal(); }],
     ['Sign out', function () {
       api('/shop/api/logout', { method: 'POST' }).then(function () {
         me = null; try { sessionStorage.removeItem('sgm_skip'); } catch (x) {}
         $('acc').close(); load(); authScreen('login');
       });
     }]].forEach(function (x) {
      var k = el('button', 'am-btn dark', x[0]); k.style.width = '100%'; k.style.marginTop = '8px'; k.onclick = x[1]; b.appendChild(k);
    });
    if (!$('acc').open) $('acc').showModal();
  }
  $('open-acc').onclick = function (e) { e.preventDefault(); accView(); };
  $('acc-close').onclick = function () { $('acc').close(); };

  var STAT = ['CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  function showOrders(kind, note) {
    var sell = kind === 'sell', b = $('ord-body');
    $('ord-h').textContent = sell ? 'Orders received' : 'My orders';
    b.textContent = 'Loading…';
    $('acc').close(); $('co').close(); $('cart').close();
    if (!$('ord').open) $('ord').showModal();
    api('/shop/api/' + (sell ? 'seller-orders' : 'orders')).then(function (d) {
      b.textContent = '';
      if (note) b.appendChild(el('div', 'am-ok', note));
      if (!d.orders.length) b.appendChild(el('p', 'am-note', 'No orders yet.'));
      d.orders.forEach(function (o) {
        var c = el('div', 'oc');
        c.appendChild(el('span', 'st', o.status));
        c.appendChild(el('b', '', o.ref));
        c.appendChild(el('div', 'am-s', new Date(o.createdAt).toLocaleString() + ' · COD'));
        o.items.forEach(function (i) { c.appendChild(el('div', '', i.qty + ' × ' + i.title + ' — ' + money(i.price, o.currency))); });
        c.appendChild(el('b', '', 'Total: ' + money(o.total, o.currency)));
        if (!sell && o.seller && o.seller.phone) c.appendChild(el('div', 'am-s', 'Seller: ' + o.seller.shop + ' · ' + o.seller.phone));
        if (sell) {
          var box = el('div', 'buy-box');
          box.appendChild(el('div', 'buy-label', 'Buyer details (new order)'));
          box.appendChild(el('div', '', o.buyer.name));
          box.appendChild(el('div', 'buy-phone', o.buyer.phone));
          box.appendChild(el('div', 'am-s', o.buyer.address + ', ' + o.buyer.city + ' ' + o.buyer.pincode + ', ' + o.buyer.country));
          var links = el('div', 'am-btns');
          var call = el('a', 'am-btn y', '📞 Call buyer');
          call.href = 'tel:' + String(o.buyer.phone).replace(/\s/g, '');
          call.style.textAlign = 'center'; call.style.textDecoration = 'none';
          var wa = el('a', 'am-btn', 'WhatsApp');
          wa.href = 'https://wa.me/' + String(o.buyer.phone).replace(/\D/g, '');
          wa.target = '_blank';
          wa.style.background = '#25d366'; wa.style.color = '#fff';
          wa.style.textAlign = 'center'; wa.style.textDecoration = 'none';
          links.appendChild(call); links.appendChild(wa);
          box.appendChild(links);
          c.appendChild(box);
        }
        var ac = el('div', 'ac'), done = o.status === 'DELIVERED' || o.status === 'CANCELLED';
        function setS(s) { jpost('/shop/api/orders/' + o.ref + '/status', { status: s }, 'PATCH').then(function () { showOrders(kind); }).catch(function (e) { alert(e.message); }); }
        if (sell && !done) STAT.forEach(function (s) {
          if (s !== o.status) { var k = el('button', '', s[0] + s.slice(1).toLowerCase()); k.onclick = function () { setS(s); }; ac.appendChild(k); }
        });
        if (!sell && o.status === 'PLACED') {
          var k = el('button', '', 'Cancel order');
          k.onclick = function () { if (confirm('Cancel this order?')) setS('CANCELLED'); };
          ac.appendChild(k);
        }
        if (ac.children.length) c.appendChild(ac);
        b.appendChild(c);
      });
    }).catch(function (e) { b.textContent = e.message; });
  }
  $('ord-close').onclick = function () { $('ord').close(); };
  $('co-close').onclick = function () { $('co').close(); };
  $('co-form').onsubmit = function (e) {
    e.preventDefault();
    var f = e.target, m = $('co-msg');
    m.textContent = 'Placing order…';
    var items = Object.keys(cart).map(function (id) { return { id: id, qty: cart[id] }; });
    jpost('/shop/api/orders', {
      name: f.name.value, phone: f.phone.value, address: f.address.value,
      city: f.city.value, pincode: f.pincode.value, country: f.country.value, items: items
    }).then(function (d) {
      cart = {}; saveCart(); f.reset(); m.textContent = '';
      $('co').close();
      var refs = (d.orders || []).map(function (o) { return o.ref; }).join(', ');
      if ($('ok-ref')) $('ok-ref').textContent = refs ? ('Order ID: ' + refs) : 'Order placed successfully';
      if ($('ok-order') && $('ok-order').showModal) $('ok-order').showModal();
      else showOrders('mine', 'Order placed!');
    }).catch(function (er) { m.textContent = er.message; });
  };

  // Photo: white background + studio look
  var blob = null;
  function loadImg(f) { return new Promise(function (ok, no) { var u = URL.createObjectURL(f), i = new Image(); i.onload = function () { URL.revokeObjectURL(u); ok(i); }; i.onerror = no; i.src = u; }); }
  function cvs(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function studio(img, remove) {
    var sc = Math.min(1, 900 / Math.max(img.width, img.height)), w = Math.round(img.width * sc), h = Math.round(img.height * sc), n = w * h;
    var c = cvs(w, h), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
    var id = x.getImageData(0, 0, w, h), d = id.data, bg = new Uint8Array(n), ok = false, minX = 0, minY = 0, maxX = w - 1, maxY = h - 1;
    if (remove) {
      var R = 0, G = 0, B = 0, k = 0, i, o;
      function border(f) { for (var xx = 0; xx < w; xx++) { f(xx); f((h - 1) * w + xx); } for (var yy = 1; yy < h - 1; yy++) { f(yy * w); f(yy * w + w - 1); } }
      border(function (j) { o = j * 4; R += d[o]; G += d[o + 1]; B += d[o + 2]; k++; }); R /= k; G /= k; B /= k;
      var q = new Int32Array(n), qt = 0, qh = 0;
      function far(j, r, g, b) { var p = j * 4; return Math.abs(d[p] - r) + Math.abs(d[p + 1] - g) + Math.abs(d[p + 2] - b); }
      border(function (j) { if (!bg[j] && far(j, R, G, B) < 110) { bg[j] = 1; q[qt++] = j; } });
      while (qh < qt) {
        i = q[qh++]; o = i * 4; var r = d[o], g = d[o + 1], b = d[o + 2], px = i % w, nb = [];
        if (px > 0) nb.push(i - 1); if (px < w - 1) nb.push(i + 1); if (i >= w) nb.push(i - w); if (i < n - w) nb.push(i + w);
        for (var t = 0; t < nb.length; t++) { var j = nb[t]; if (!bg[j] && far(j, r, g, b) <= 22 && far(j, R, G, B) <= 150) { bg[j] = 1; q[qt++] = j; } }
      }
      var frac = qt / n; ok = frac > 0.12 && frac < 0.92;
    }
    var bright = 1, turned = 0;
    if (ok) {
      for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) { if (bg[yy * w + xx]) d[(yy * w + xx) * 4 + 3] = 0; }
      x.putImageData(id, 0, 0);
      var sm = cvs(w, h), sx = sm.getContext('2d'); if ('filter' in sx) sx.filter = 'blur(0.7px)'; sx.drawImage(c, 0, 0); c = sm;
      var ls = 0, lc = 0, pts = [];
      for (var j2 = 0; j2 < n; j2 += 7) { if (!bg[j2]) { var o2 = j2 * 4; ls += 0.299 * d[o2] + 0.587 * d[o2 + 1] + 0.114 * d[o2 + 2]; lc++; pts.push(j2 % w - w / 2, ((j2 / w) | 0) - h / 2); } }
      if (lc) bright = Math.min(1.3, Math.max(0.92, 135 / (ls / lc)));
      var area = function (a) {
        var cs = Math.cos(a), sn = Math.sin(a), x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (var p = 0; p < pts.length; p += 2) {
          var X = pts[p] * cs - pts[p + 1] * sn, Y = pts[p] * sn + pts[p + 1] * cs;
          if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
        }
        return (x1 - x0) * (y1 - y0);
      };
      var a0 = area(0), ba = a0, best = 0;
      for (var dg = -40; dg <= 40; dg += 0.5) { var ar = area(dg * Math.PI / 180); if (ar < ba) { ba = ar; best = dg; } }
      if (ba < a0 * 0.96 && Math.abs(best) >= 1) {
        var D = Math.ceil(Math.hypot(w, h)), rc = cvs(D, D), rx = rc.getContext('2d');
        rx.translate(D / 2, D / 2); rx.rotate(best * Math.PI / 180); rx.drawImage(c, -w / 2, -h / 2); c = rc; turned = best;
      }
      var cd = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, cw = c.width, ch = c.height;
      minX = cw; minY = ch; maxX = 0; maxY = 0;
      for (var y2 = 0; y2 < ch; y2++) for (var x2 = 0; x2 < cw; x2++) {
        if (cd[(y2 * cw + x2) * 4 + 3] > 40) {
          if (x2 < minX) minX = x2; if (x2 > maxX) maxX = x2;
          if (y2 < minY) minY = y2; if (y2 > maxY) maxY = y2;
        }
      }
    }
    var S = 640, out = cvs(S, S), ox = out.getContext('2d');
    ox.fillStyle = '#fff'; ox.fillRect(0, 0, S, S);
    var bw = maxX - minX + 1, bh = maxY - minY + 1, f = Math.min(520 / bw, 520 / bh), dw = bw * f, dh = bh * f;
    if ('filter' in ox) ox.filter = 'contrast(1.08) saturate(1.12) brightness(' + (1.04 * bright).toFixed(2) + ')';
    if (ok) { ox.shadowColor = 'rgba(0,0,0,.2)'; ox.shadowBlur = 22; ox.shadowOffsetY = 12; }
    ox.drawImage(c, minX, minY, bw, bh, (S - dw) / 2, (S - dh) / 2 - (ok ? 6 : 0), dw, dh);
    return new Promise(function (res) { out.toBlob(function (b) { res({ blob: b, removed: ok, turned: turned }); }, 'image/jpeg', 0.82); });
  }
  var file = null;
  function run() {
    if (!file) return;
    $('proc').textContent = 'Processing photo…';
    loadImg(file).then(function (img) { return studio(img, $('rm').checked); }).then(function (r) {
      blob = r.blob;
      var p = $('prev'); p.src = URL.createObjectURL(blob); p.hidden = false;
      $('prev-t').hidden = true;
      $('proc').textContent = !$('rm').checked ? 'Original background kept.' :
        r.removed ? 'White background ✓ · studio look ready' + (r.turned ? ' · straightened' : '') :
        'Could not separate background. Use plain lit background.';
    }).catch(function () { $('proc').textContent = 'Could not read this photo.'; blob = null; });
  }
  ['photo-cam', 'photo-gal'].forEach(function (i) {
    $(i).onchange = function () { file = this.files[0] || null; run(); };
  });
  $('rm').onchange = run;

  var dlg = $('sell'), form = $('sell-form'), msg = $('sell-msg');
  function prefill() {
    try {
      var sv = JSON.parse(localStorage.getItem('sgm_seller') || '{}');
      ['seller', 'phone', 'address'].forEach(function (k) { if (sv[k] && !form[k].value) form[k].value = sv[k]; });
    } catch (x) {}
  }
  $('open-sell').onclick = function () { needLogin(function () { prefill(); dlg.showModal(); }); };
  ['sell-close', 'sell-cancel'].forEach(function (i) { $(i).onclick = function () { dlg.close(); }; });
  form.onsubmit = function (e) {
    e.preventDefault();
    if (!blob) { msg.textContent = 'Add a product photo first (Camera or Gallery).'; return; }
    var exp = form.expiresAt && form.expiresAt.value;
    if (exp) {
      var ed = new Date(exp); ed.setHours(23, 59, 59, 999);
      if (ed < new Date()) {
        msg.textContent = 'EXPIRED PRODUCT REJECTED. Do not list expired items.';
        return;
      }
    }
    var btn = form.querySelector('[type=submit]');
    if (btn) { btn.disabled = true; btn.textContent = 'Posting…'; }
    var fd = new FormData(form);
    fd.append('photo', blob, 'product.jpg');
    msg.textContent = 'Posting product…';
    msg.style.color = '#0f1111';
    api('/shop/api/products', { method: 'POST', body: fd }).then(function (d) {
      try { localStorage.setItem('sgm_seller', JSON.stringify({ seller: form.seller.value, phone: form.phone.value, address: form.address.value })); } catch (x) {}
      form.reset(); blob = null; file = null;
      $('prev').hidden = true; $('prev-t').hidden = false; $('proc').textContent = ''; msg.textContent = '';
      if (btn) { btn.disabled = false; btn.textContent = 'Post product'; }
      dlg.close();
      cat = 'All'; tabs();
      // optimistic show
      if (d && d.product) { all.unshift(d.product); render(); }
      load();
    }).catch(function (er) {
      msg.textContent = er.message || 'Upload failed. Try again.';
      msg.style.color = '#b12704';
      if (btn) { btn.disabled = false; btn.textContent = 'Post product'; }
    });
  };

  tabs(); saveCart();
  if ($('empty-sell')) $('empty-sell').onclick = function () { var s = $('open-sell'); if (s) s.click(); };
  // chip row click (static fallback chips in HTML)
  if ($('tabs')) $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-c]');
    if (!b || !$('tabs').contains(b)) return;
    cat = b.getAttribute('data-c') || 'All';
    tabs(); render();
  });
  function finishAuthBoot() {
    load();
    if (me) {
      try { $('auth').hidden = true; } catch (e) {}
      try { document.body.style.overflow = ''; } catch (e) {}
      setAvatar(me);
      return;
    }
    var sk = false; try { sk = sessionStorage.getItem('sgm_skip'); } catch (x) {}
    if (!sk) authScreen('login');
  }
  // After Google redirect ?ok=1 — force session read + clean URL
  if (location.search.indexOf('ok=1') >= 0 || location.search.indexOf('needphone=1') >= 0 || location.search.indexOf('gerr=') >= 0) {
    try { history.replaceState({}, '', '/shop'); } catch (e) {}
  }
  api('/shop/api/me').then(function (d) {
    me = d && d.user ? d.user : null;
    setAvatar(me);
    finishAuthBoot();
  }).catch(function () {
    me = null; setAvatar(null); finishAuthBoot();
  });

  // Categories dialog + shopping nav (inside IIFE)
  if ($('nav-cats')) {
    $('nav-cats').onclick = function (e) {
      e.preventDefault();
      if ($('cats-dlg') && $('cats-dlg').showModal) $('cats-dlg').showModal();
    };
  }
  if ($('cats-close')) $('cats-close').onclick = function () { $('cats-dlg').close(); };
  if ($('cat-list')) {
    $('cat-list').onclick = function (e) {
      var btn = e.target.closest('[data-c]');
      if (!btn) return;
      cat = btn.getAttribute('data-c') || 'All';
      Array.prototype.forEach.call($('cat-list').querySelectorAll('.cat-item'), function (x) {
        x.classList.toggle('on', x.getAttribute('data-c') === cat);
      });
      tabs(); render();
      if ($('cats-dlg')) $('cats-dlg').close();
    };
  }
  if ($('ok-close')) $('ok-close').onclick = function () { $('ok-order').close(); };
  if ($('ok-view')) $('ok-view').onclick = function () { $('ok-order').close(); showOrders('mine'); };
  if ($('nav-home')) {
    $('nav-home').onclick = function (e) {
      e.preventDefault();
      cat = 'All'; tabs(); render();
    };
  }


  if ($('open-help')) $('open-help').onclick = function () { if ($('help-dlg')) $('help-dlg').showModal(); };
  if ($('help-close')) $('help-close').onclick = function () { $('help-dlg').close(); };
  if ($('gphone-form')) {
    $('gphone-form').onsubmit = function (e) {
      e.preventDefault();
      var f = e.target;
      jpost('/shop/api/google/complete', { phone: f.phone.value, country: f.country.value, lang: f.lang.value })
        .then(function (d) { me = d.user; setAvatar(d.user); $('gphone').close(); load(); })
        .catch(function (er) { $('gphone-msg').textContent = er.message; });
    };
  }
  if (location.search.indexOf('needphone=1') >= 0 && $('gphone')) $('gphone').showModal();

  if (location.search.indexOf('gerr=') >= 0) {
    try {
      authScreen('login');
      var ge = (location.search.match(/gerr=([^&]+)/) || [])[1] || '';
      $('au-m').textContent = 'Google login failed (' + decodeURIComponent(ge) + '). Check GOOGLE_CLIENT_ID, SECRET, REDIRECT_URI match Google Console exactly.';
    } catch (e) {}
  }


  setInterval(load, 45000);
})();

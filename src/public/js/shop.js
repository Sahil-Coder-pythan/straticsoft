(function () {
  var CATS = ['All', 'Mobiles', 'Fashion', 'Electronics', 'Home & Kitchen', 'Deals'];
  var all = [], cat = 'All', cart = {}, me = null, after = null;
  try { cart = JSON.parse(localStorage.getItem('sgm_cart') || '{}') || {}; } catch (e) { cart = {}; }
  var $ = function (i) { return document.getElementById(i); };
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function money(n, c) { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(n); } catch (e) { return c + ' ' + n; } }
  function api(url, opt) { opt = opt || {}; opt.headers = Object.assign({ 'x-sgm': '1' }, opt.headers || {}); return fetch(url, opt).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Something went wrong. Try again.'); return d; }); }); }
  function jpost(url, body, method) { return api(url, { method: method || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  function saveCart() { try { localStorage.setItem('sgm_cart', JSON.stringify(cart)); } catch (e) {} $('cart-n').textContent = Object.keys(cart).reduce(function (s, k) { return s + cart[k]; }, 0); }
  function addCart(id) { cart[id] = Math.min((cart[id] || 0) + 1, 10); saveCart(); }
  function needLogin(fn) { if (me) return fn(); after = fn; authScreen('login'); }
  function tabs() { var t = $('tabs'); t.textContent = ''; CATS.forEach(function (c) { var b = el('button', c === cat ? 'on' : '', c); b.onclick = function () { cat = c; tabs(); render(); }; t.appendChild(b); }); }
  function render() {
    var q = $('q').value.trim().toLowerCase(), s = $('sort').value;
    var l = all.filter(function (p) { return (cat === 'All' || (cat === 'Deals' ? p.off > 0 : p.category === cat)) && (!q || (p.title + ' ' + p.seller).toLowerCase().indexOf(q) > -1); });
    if (s === 'lo') l.sort(function (a, b) { return a.price - b.price; }); else if (s === 'hi') l.sort(function (a, b) { return b.price - a.price; });
    $('head').textContent = cat === 'All' ? 'All products' : cat; var g = $('grid'); g.textContent = '';
    if (!l.length) { g.appendChild(el('p', 'sh-empty', all.length ? 'No products found.' : 'No products yet. Tap + to sell the first one!')); return; }
    l.forEach(function (p) {
      var c = el('div', 'sh-card'), im = el('img'); im.src = p.image; im.alt = p.title; im.loading = 'lazy';
      var pr = el('div', 'sh-p'); pr.appendChild(el('b', '', money(p.price, p.currency)));
      if (p.mrp) { pr.appendChild(el('s', '', money(p.mrp, p.currency))); pr.appendChild(el('em', '', p.off + '% off')); }
      var bt = el('div', 'sh-btns'), a = el('button', 'c', 'Add to Cart'), b = el('button', 'b', 'Buy Now');
      a.onclick = function () { addCart(p.id); a.textContent = 'Added ✓'; setTimeout(function () { a.textContent = 'Add to Cart'; }, 900); };
      b.onclick = function () { addCart(p.id); openCart(); };
      if (p.mine) { a.disabled = b.disabled = true; a.style.opacity = b.style.opacity = '.4'; }
      bt.append(a, b);
      c.append(im, el('div', 'sh-t', p.title), el('div', 'sh-s', p.seller + (p.city ? ' · ' + p.city : '')), pr, el('div', 'sh-d', '🚚 Delivery in ' + p.days + ' days'));
      if (p.mine) { var d = el('button', 'sh-del', 'Delete my product'); d.onclick = function () { if (confirm('Delete this product?')) api('/shop/api/products/' + p.id, { method: 'DELETE' }).then(load).catch(function (e) { alert(e.message); }); }; c.appendChild(d); }
      c.appendChild(bt); g.appendChild(c);
    });
  }
  function load() { api('/shop/api/products').then(function (d) { all = d.products; render(); }).catch(function () { $('grid').textContent = 'Could not load products. Please refresh.'; }); }
  function openCart() {
    var l = $('cart-list'); l.textContent = ''; var tot = {}, n = 0;
    Object.keys(cart).forEach(function (id) { var p = all.find(function (x) { return x.id === id; }); if (!p) return; n++;
      tot[p.currency] = (tot[p.currency] || 0) + p.price * cart[id];
      var r = el('div', 'ci'), im = el('img'); im.src = p.image; var d = el('div'); d.append(el('div', '', p.title), el('b', '', cart[id] + ' × ' + money(p.price, p.currency)));
      var x = el('button', 'sh-x', '✕'); x.onclick = function () { delete cart[id]; saveCart(); openCart(); }; r.append(im, d, x); l.appendChild(r); });
    l.appendChild(el('p', '', n ? 'Total: ' + Object.keys(tot).map(function (c) { return money(tot[c], c); }).join(' + ') : 'Your cart is empty.'));
    if (n) { var ck = el('button', 'sh-btn y', 'Checkout'); ck.style.width = '100%'; ck.onclick = function () { needLogin(function () { $('cart').close(); $('co').showModal(); }); }; l.appendChild(ck); }
    if (!$('cart').open) $('cart').showModal();
  }
  $('open-cart').onclick = $('open-cart2').onclick = function (e) { e.preventDefault(); openCart(); };
  $('cart-close').onclick = function () { $('cart').close(); };
  $('q').oninput = render; $('sort').onchange = render;
  // ---- account ----
  var scr = $('auth');
  function authScreen(mode) {
    var reg = mode === 'register';
    $('au-h').textContent = reg ? 'Create account' : 'Sign in'; $('au-name-l').hidden = !reg;
    $('au-go').textContent = reg ? 'Create your Stratic Market account' : 'Continue';
    $('au-sw-t').textContent = reg ? 'Already have an account?' : 'New to Stratic Market?'; $('au-sw').textContent = reg ? 'Sign in' : 'Create your account';
    $('au-m').textContent = ''; scr.dataset.mode = mode; scr.hidden = false; document.body.style.overflow = 'hidden';
  }
  function authClose() { scr.hidden = true; document.body.style.overflow = ''; }
  $('au-sw').onclick = function () { authScreen(scr.dataset.mode === 'login' ? 'register' : 'login'); };
  $('au-skip').onclick = function (e) { e.preventDefault(); try { sessionStorage.setItem('sgm_skip', '1'); } catch (x) {} after = null; authClose(); };
  $('au-form').onsubmit = function (e) { e.preventDefault(); var f = e.target; $('au-m').textContent = 'Please wait…';
    jpost('/shop/api/' + scr.dataset.mode, { name: f.name.value, email: f.email.value, password: f.password.value }).then(function (d) { me = d.user; f.reset(); authClose(); load(); if (after) { var fn = after; after = null; fn(); } })
      .catch(function (er) { $('au-m').textContent = er.message; }); };
  function accView() {
    if (!me) { authScreen('login'); return; }
    var b = $('acc-body'); b.textContent = '';
    b.appendChild(el('p', '', 'Signed in as ' + me.name + ' (' + me.email + ')'));
    [['My orders', function () { showOrders('mine'); }], ['Orders received (seller)', function () { showOrders('sell'); }], ['Sign out', function () { api('/shop/api/logout', { method: 'POST' }).then(function () { me = null; try { sessionStorage.removeItem('sgm_skip'); } catch (x) {} $('acc').close(); load(); authScreen('login'); }); }]].forEach(function (x) { var k = el('button', 'sh-btn dark', x[0]); k.style.width = '100%'; k.onclick = x[1]; b.appendChild(k); });
    if (!$('acc').open) $('acc').showModal();
  }
  $('open-acc').onclick = function (e) { e.preventDefault(); accView(); };
  $('acc-close').onclick = function () { $('acc').close(); };
  // ---- orders ----
  var STAT = ['CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  function showOrders(kind, note) {
    var sell = kind === 'sell', b = $('ord-body'); $('ord-h').textContent = sell ? 'Orders received' : 'My orders'; b.textContent = 'Loading…'; $('acc').close(); $('co').close(); $('cart').close(); if (!$('ord').open) $('ord').showModal();
    api('/shop/api/' + (sell ? 'seller-orders' : 'orders')).then(function (d) {
      b.textContent = ''; if (note) b.appendChild(el('div', 'sh-ok', note));
      if (!d.orders.length) b.appendChild(el('p', 'sh-note', 'No orders yet.'));
      d.orders.forEach(function (o) {
        var c = el('div', 'oc'); c.appendChild(el('span', 'st', o.status)); c.appendChild(el('b', '', o.ref)); c.appendChild(el('div', 'sh-s', new Date(o.createdAt).toLocaleString() + ' · Cash on Delivery'));
        o.items.forEach(function (i) { c.appendChild(el('div', '', i.qty + ' × ' + i.title + ' — ' + money(i.price, o.currency))); });
        c.appendChild(el('b', '', 'Total: ' + money(o.total, o.currency)));
        if (!sell && o.seller && o.seller.phone) c.appendChild(el('div', 'sh-s', 'Seller: ' + o.seller.shop + ' · ' + o.seller.phone));
        if (sell) c.appendChild(el('div', 'sh-s', 'Deliver to: ' + o.buyer.name + ', ' + o.buyer.phone + ', ' + o.buyer.address + ', ' + o.buyer.city + ' ' + o.buyer.pincode + ', ' + o.buyer.country));
        var ac = el('div', 'ac'), done = o.status === 'DELIVERED' || o.status === 'CANCELLED';
        function setS(s) { jpost('/shop/api/orders/' + o.ref + '/status', { status: s }, 'PATCH').then(function () { showOrders(kind); }).catch(function (e) { alert(e.message); }); }
        if (sell && !done) STAT.forEach(function (s) { if (s !== o.status) { var k = el('button', '', s[0] + s.slice(1).toLowerCase()); k.onclick = function () { setS(s); }; ac.appendChild(k); } });
        if (!sell && o.status === 'PLACED') { var k = el('button', '', 'Cancel order'); k.onclick = function () { if (confirm('Cancel this order?')) setS('CANCELLED'); }; ac.appendChild(k); }
        if (ac.children.length) c.appendChild(ac); b.appendChild(c);
      });
    }).catch(function (e) { b.textContent = e.message; });
  }
  $('ord-close').onclick = function () { $('ord').close(); };
  $('co-close').onclick = function () { $('co').close(); };
  $('co-form').onsubmit = function (e) { e.preventDefault(); var f = e.target, m = $('co-msg'); m.textContent = 'Placing order…';
    var items = Object.keys(cart).map(function (id) { return { id: id, qty: cart[id] }; });
    var body = { items: items }; ['name', 'phone', 'address', 'city', 'country', 'pincode'].forEach(function (k) { body[k] = f[k].value; });
    jpost('/shop/api/orders', body).then(function (d) { cart = {}; saveCart(); m.textContent = ''; showOrders('mine', 'Order placed! ' + d.orders.map(function (o) { return o.ref; }).join(', ') + ' — the seller will confirm it.'); })
      .catch(function (er) { m.textContent = er.message; }); };
  // ---- photo: white background + studio look, done in the browser (no API) ----
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
      while (qh < qt) { i = q[qh++]; o = i * 4; var r = d[o], g = d[o + 1], b = d[o + 2], px = i % w, nb = [];
        if (px > 0) nb.push(i - 1); if (px < w - 1) nb.push(i + 1); if (i >= w) nb.push(i - w); if (i < n - w) nb.push(i + w);
        for (var t = 0; t < nb.length; t++) { var j = nb[t]; if (!bg[j] && far(j, r, g, b) <= 22 && far(j, R, G, B) <= 150) { bg[j] = 1; q[qt++] = j; } } }
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
      var area = function (a) { var cs = Math.cos(a), sn = Math.sin(a), x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (var p = 0; p < pts.length; p += 2) { var X = pts[p] * cs - pts[p + 1] * sn, Y = pts[p] * sn + pts[p + 1] * cs; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; } return (x1 - x0) * (y1 - y0); };
      var a0 = area(0), ba = a0, best = 0;
      for (var dg = -40; dg <= 40; dg += 0.5) { var ar = area(dg * Math.PI / 180); if (ar < ba) { ba = ar; best = dg; } }
      if (ba < a0 * 0.96 && Math.abs(best) >= 1) {
        var D = Math.ceil(Math.hypot(w, h)), rc = cvs(D, D), rx = rc.getContext('2d'); rx.translate(D / 2, D / 2); rx.rotate(best * Math.PI / 180); rx.drawImage(c, -w / 2, -h / 2); c = rc; turned = best;
      }
      var cd = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, cw = c.width, ch = c.height; minX = cw; minY = ch; maxX = 0; maxY = 0;
      for (var y2 = 0; y2 < ch; y2++) for (var x2 = 0; x2 < cw; x2++) { if (cd[(y2 * cw + x2) * 4 + 3] > 40) { if (x2 < minX) minX = x2; if (x2 > maxX) maxX = x2; if (y2 < minY) minY = y2; if (y2 > maxY) maxY = y2; } }
    }
    var S = 640, out = cvs(S, S), ox = out.getContext('2d'); ox.fillStyle = '#fff'; ox.fillRect(0, 0, S, S);
    var bw = maxX - minX + 1, bh = maxY - minY + 1, f = Math.min(520 / bw, 520 / bh), dw = bw * f, dh = bh * f;
    if ('filter' in ox) ox.filter = 'contrast(1.08) saturate(1.12) brightness(' + (1.04 * bright).toFixed(2) + ')';
    if (ok) { ox.shadowColor = 'rgba(0,0,0,.2)'; ox.shadowBlur = 22; ox.shadowOffsetY = 12; }
    ox.drawImage(c, minX, minY, bw, bh, (S - dw) / 2, (S - dh) / 2 - (ok ? 6 : 0), dw, dh);
    return new Promise(function (res) { out.toBlob(function (b) { res({ blob: b, removed: ok, turned: turned }); }, 'image/jpeg', 0.82); });
  }
  var file = null;
  function run() { if (!file) return; $('proc').textContent = 'Processing photo…';
    loadImg(file).then(function (img) { return studio(img, $('rm').checked); }).then(function (r) {
      blob = r.blob; var p = $('prev'); p.src = URL.createObjectURL(blob); p.hidden = false;
      $('proc').textContent = !$('rm').checked ? 'Original background kept.' : r.removed ? 'Background white ✓ · brightened ✓' + (r.turned ? ' · straightened ' + Math.abs(r.turned) + '° ✓' : '') : 'Could not separate the background (it is too similar to the product). Use a plain, evenly lit background and try again.';
    }).catch(function () { $('proc').textContent = 'Could not read this photo.'; blob = null; }); }
  ['photo-cam', 'photo-gal'].forEach(function (i) { $(i).onchange = function () { file = this.files[0] || null; run(); }; }); $('rm').onchange = run;
  var dlg = $('sell'), form = $('sell-form'), msg = $('sell-msg');
  function prefill() { try { var sv = JSON.parse(localStorage.getItem('sgm_seller') || '{}'); ['seller', 'phone', 'address'].forEach(function (k) { if (sv[k] && !form[k].value) form[k].value = sv[k]; }); } catch (x) {} }
  $('open-sell').onclick = function () { needLogin(function () { prefill(); dlg.showModal(); }); };
  ['sell-close', 'sell-cancel'].forEach(function (i) { $(i).onclick = function () { dlg.close(); }; });
  form.onsubmit = function (e) { e.preventDefault(); if (!blob) { msg.textContent = 'Add a product photo first.'; return; }
    var fd = new FormData(form); fd.delete('photoFile'); fd.append('photo', blob, 'product.jpg'); msg.textContent = 'Posting…';
    api('/shop/api/products', { method: 'POST', body: fd }).then(function () {
      try { localStorage.setItem('sgm_seller', JSON.stringify({ seller: form.seller.value, phone: form.phone.value, address: form.address.value })); } catch (x) {}
      form.reset(); blob = null; file = null; $('prev').hidden = true; $('prev-t').hidden = false; $('proc').textContent = ''; msg.textContent = ''; dlg.close(); cat = 'All'; tabs(); load();
    }).catch(function (er) { msg.textContent = er.message; }); };
  tabs(); saveCart();
  api('/shop/api/me').then(function (d) { me = d.user; }).catch(function () {}).then(function () { load(); var sk = false; try { sk = sessionStorage.getItem('sgm_skip'); } catch (x) {} if (!me && !sk) authScreen('login'); });
  setInterval(load, 30000);
})();

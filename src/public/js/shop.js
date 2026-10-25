
setTimeout(function(){ try{ setAvatar(null);}catch(e){} },0);
function setAvatar(user){
  // Profile lives only in the bottom bar. The top-right icon stays a plain bell (no letter).
  var av = document.getElementById('top-avatar');
  if (!av) return;
  var svg = av.querySelector('svg');
  var letter = av.querySelector('.am-avatar-letter');
  if (svg) svg.hidden = false;
  if (letter) letter.hidden = true;
  av.classList.remove('is-signed-in');
  av.setAttribute('aria-label', 'Notifications');
  av.title = 'Notifications';
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
  function isHi() { return window.SGM_I18N && window.SGM_I18N.lang() === 'hi'; }
  function T(en, hi) { return window.SGM_I18N ? window.SGM_I18N.t(en, hi) : en; }
  function toast(m) {
    var t = el('div', ''); t.textContent = m;
    t.style.cssText = 'position:fixed;left:50%;bottom:92px;transform:translateX(-50%);background:#111;color:#fff;padding:10px 16px;border-radius:99px;font-size:13px;z-index:99999;max-width:86vw;text-align:center';
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
  }
  function detectCountry() {
    try {
      var tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || '';
      if (/Kolkata|Calcutta/.test(tz)) return 'IN';
      var r = (navigator.language || '').split('-')[1];
      if (r) return r.toUpperCase();
    } catch (e) {}
    return 'IN';
  }
  function money(n, c) { try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: c || 'INR', maximumFractionDigits: 0 }).format(n); } catch (e) { return '₹' + n; } }
  function showDeleteDialog(title, onConfirm) {
    var old = document.getElementById('am-delete-dialog'); if (old) old.remove();
    var overlay = el('div', 'am-delete-overlay'); overlay.id = 'am-delete-dialog';
    var box = el('div', 'am-delete-dialog'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    var icon = el('div', 'am-delete-icon', '⌫');
    var heading = el('h2', 'am-delete-title', 'Delete this listing?');
    var message = el('p', 'am-delete-message', '“' + (title || 'This product') + '” will be removed from your shop. This action cannot be undone.');
    var actions = el('div', 'am-delete-actions');
    var cancel = el('button', 'am-delete-cancel', 'Keep listing'); cancel.type = 'button';
    var del = el('button', 'am-delete-confirm', 'Delete listing'); del.type = 'button';
    function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    cancel.onclick = close; overlay.onclick = function (e) { if (e.target === overlay) close(); };
    del.onclick = function () { close(); onConfirm(); };
    actions.append(cancel, del); box.append(icon, heading, message, actions); overlay.appendChild(box); document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey); cancel.focus();
  }
  function api(url, opt) {
    opt = opt || {};
    opt.headers = Object.assign({ 'x-sgm': '1' }, opt.headers || {});
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, 60000);
    opt.signal = ctrl.signal;
    return fetch(url, opt).then(function (r) {
      clearTimeout(t);
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(T(d.error || 'Something went wrong. Try again.'));
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
  var single = null;
  function buyNow(p) {
    needLogin(function () {
      single = [{ id: p.id, qty: 1 }];
      var f = $('co-form');
      if (me) {
        if (!f.name.value) f.name.value = me.name || '';
        if (!f.phone.value && me.phone) f.phone.value = me.phone;
      }
      $('co-msg').textContent = '';
      $('co-item').textContent = p.title + ' — ' + money(p.price, p.currency);
      $('co-item').hidden = false;
      coOpen();
    });
  }
  var viewedNow = {};
  function pingView(p) {
    if (!p || !p.id || viewedNow[p.id]) return;
    viewedNow[p.id] = 1;
    try { api('/shop/api/products/' + p.id + '/view', { method: 'POST' }).catch(function () {}); } catch (e) {}
  }
  function openGallery(p) {
    pingView(p);
    var g = $('gal'); if (!g) return;
    var list = (p.imgs && p.imgs.length) ? p.imgs : [p.img];
    var big = $('gal-big'), th = $('gal-th'); th.textContent = '';
    $('gal-title').textContent = p.title;
    $('gal-price').textContent = money(p.price, p.currency);
    function show(i) { big.src = list[i]; Array.prototype.forEach.call(th.children, function (c, k) { c.classList.toggle('on', k === i); }); }
    list.forEach(function (u, i) { var t = el('img'); t.src = u; t.alt = ''; t.onclick = function () { show(i); }; th.appendChild(t); });
    show(0);
    var add = $('gal-add'), buy = $('gal-buy');
    add.disabled = buy.disabled = !!p.mine;
    add.onclick = function () { addCart(p.id); add.textContent = 'Added ✓'; setTimeout(function () { add.textContent = 'Add to Cart'; }, 900); };
    buy.onclick = function () { g.close(); buyNow(p); };
    if (!g.open) g.showModal();
  }
  function openBuy(p) {
    pingView(p);
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
        : '<div class="empty-illu" aria-hidden="true"><svg width="300" height="250" viewBox="0 0 300 250" fill="none"><g stroke="#28211b" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round"><path d="M75 92 151 51 230 84 153 126Z" fill="#d8c3a8"/><path d="M75 92 42 58 131 28 151 51Z" fill="#dfccb4"/><path d="M151 51 176 25 266 53 230 84Z" fill="#e3d1b9"/><path d="M75 92 46 126 113 157 153 126Z" fill="#d6bea0"/><path d="M230 84 263 125 190 157 153 126Z" fill="#d8c3a8"/><path d="M75 92 153 126 230 84" fill="#bfa98d"/><path d="M75 92 75 190 153 222 153 126Z" fill="#d9c4a8"/><path d="M153 126 230 84 230 184 153 222Z" fill="#cbb697"/><path d="M42 58 58 61M69 54l15-4M186 44l57 18M61 133l50 21M199 145l42-19" stroke-width="1.5"/><path d="M85 100 135 122M168 128l48-29M85 182l1 7M94 192l8 3M215 190l-7 3M169 213l34-13" stroke-width="1.5"/><path d="M153 126v96" stroke-width="1.5"/></g></svg></div><h2 class="empty-title">Your Bazaar is Empty</h2><p class="empty-sub">Be the first to sell from your city to the World</p><button type="button" class="am-cta" id="empty-sell">Sell Your First Product +</button>';
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
      b.onclick = function () { buyNow(p); };
      if (p.mine) { a.disabled = b.disabled = true; a.style.opacity = b.style.opacity = '.4'; }
      bt.append(a, b);
      var top = el('div', 'am-card-top');
      top.appendChild(im);
      if (p.imgs && p.imgs.length > 1) { top.appendChild(el('span', 'am-multi', '▦ ' + p.imgs.length)); }
      im.style.cursor = 'zoom-in';
      im.onclick = function () { openGallery(p); };
      var lk = el('button', 'am-like' + (p.liked ? ' on' : ''), (p.liked ? '♥ ' : '♡ ') + (p.likes || 0));
      lk.type = 'button';
      if (p.mine) lk.classList.add('own');
      lk.onclick = function (e) {
        e.stopPropagation();
        if (p.mine) { toast(T('You cannot like your own product. Other people can like it.', 'अपने प्रोडक्ट को आप लाइक नहीं कर सकते। दूसरे लोग लाइक कर सकते हैं।')); return; }
        if (!me) { authScreen('login'); return; }
        if (!me.phone) { alert('Add your mobile number first: log out and log in with Google once, then enter your number.'); return; }
        lk.disabled = true;
        api('/shop/api/products/' + p.id + '/like', { method: 'POST' }).then(function (r) {
          p.likes = r.count; p.liked = r.liked;
          lk.className = 'am-like' + (r.liked ? ' on' : '');
          lk.textContent = (r.liked ? '♥ ' : '♡ ') + r.count;
          lk.disabled = false;
        }).catch(function (er) { lk.disabled = false; alert(er.message); });
      };
      top.appendChild(lk);
      if (p.mine) {
        var menu = el('button', 'am-dots', '⋮');
        menu.type = 'button';
        menu.onclick = function (e) {
          e.stopPropagation();
          showDeleteDialog(p.title, function () {
            api('/shop/api/products/' + p.id, { method: 'DELETE' }).then(load).catch(function (err) { alert(err.message); });
          });
        };
        top.appendChild(menu);
      }
      var body = el('div', 'am-card-body');
      var ttl = el('div', 't', p.title); ttl.setAttribute('data-notr', '1'); body.appendChild(ttl);
      body.appendChild(el('div', 'am-s', p.seller + (p.city ? ' · ' + p.city : '')));
      body.appendChild(pr);
      body.appendChild(el('div', 'am-s', '🚚 ' + (p.days || 5) + ' ' + T('days')));
      body.appendChild(bt);
      c.append(top, body);
      g.appendChild(c);
    });
  }
  function load() {
    var c = (me && me.country) || localStorage.getItem('sgm_country') || detectCountry();
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
      ck.onclick = function () { needLogin(function () {
        single = null; $('co-item').hidden = true; $('co-msg').textContent = '';
        var f = $('co-form');
        if (me) { if (!f.name.value) f.name.value = me.name || ''; if (!f.phone.value && me.phone) f.phone.value = me.phone; }
        $('cart').close(); coOpen();
      }); };
      l.appendChild(ck);
    }
    if (!$('cart').open) $('cart').showModal();
  }
  $('open-cart').onclick = $('open-cart2').onclick = function (e) { e.preventDefault(); openCart(); };
  $('cart-close').onclick = function () { $('cart').close(); };
  $('buy-close').onclick = function () { $('buy').close(); };
  if ($('gal-close')) $('gal-close').onclick = function () { $('gal').close(); };
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
      try { localStorage.setItem('sgm_country', me.country || ''); if (!localStorage.getItem('sgm_lang') && me.lang && window.SGM_I18N) window.SGM_I18N.setLang(me.lang); } catch (x) {}
      $('auth').hidden = true; document.body.style.overflow = '';
      if (after) { var fn = after; after = null; fn(); } else load();
    }).catch(function (er) { $('au-m').textContent = er.message; });
  };
  function accView() {
    if (!me) { authScreen('login'); return; }
    var b = $('acc-body'); b.textContent = '';
    b.appendChild(el('p', '', 'Signed in as ' + me.name + ' (' + (me.email || '') + ')'));
    b.appendChild(el('p', 'am-s', '📱 ' + (me.phone || '—') + ' · ' + (me.country || 'IN') + ' · ' + (me.lang || 'en')));
    [['My orders', '🧾', 'orders', function () { showOrders('mine'); }],
     ['My Product', '📦', 'products', function () {
       $('acc').close(); $('ord-h').textContent = 'Your products uploaded'; $('ord-body').textContent = 'Loading your products…';
       if (!$('ord').open) $('ord').showModal();
       api('/shop/api/my-products').then(function (d) {
         var b = $('ord-body'); b.textContent = '';
         if (!d.products.length) { b.appendChild(el('p', 'am-empty', 'You have not uploaded any products yet.')); return; }
         d.products.forEach(function (p) { var c = el('div', 'oc'), r = el('div', 'ci'), im = el('img'); im.src = p.img; im.alt = p.title; r.append(im, el('div', '', p.title), el('b', '', money(p.price, p.currency))); c.appendChild(r); c.appendChild(el('div', 'am-s', '♥ ' + (p.likes || 0) + ' likes')); var del = el('button', 'am-btn', 'Delete listing'); del.style.marginTop = '8px'; del.onclick = function () { showDeleteDialog(p.title, function () { api('/shop/api/products/' + p.id, { method: 'DELETE' }).then(function () { load(); api('/shop/api/my-products').then(function (x) { del.closest('.oc').remove(); if (!x.products.length) $('ord-body').appendChild(el('p', 'am-empty', 'You have not uploaded any products yet.')); }).catch(function(e){alert(e.message);}); }).catch(function(e){alert(e.message);}); }); }; c.appendChild(del); b.appendChild(c); });
       }).catch(function (e) { $('ord-body').textContent = e.message; });
     }],
     ['My Product Dashboard', '📊', 'dashboard', function () {
       $('acc').close(); $('ord-h').textContent = 'My Product Dashboard'; $('ord-body').textContent = 'Loading sales and likes…';
       if (!$('ord').open) $('ord').showModal();
       api('/shop/api/product-dashboard').then(function (d) {
         var b = $('ord-body'); b.textContent = '';
         if (!d.products.length) { b.appendChild(el('p', 'am-empty', 'Upload a product to start your dashboard.')); return; }
         var CN = { IN: 'India', US: 'United States', GB: 'United Kingdom', AE: 'UAE', OTHER: 'Other' };
         function cname(c) { return T(CN[c] || c); }
         var grid = el('div', ''); grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px';
         [['Products', d.totalProducts], ['Views', d.totalViews], ['Likes', d.totalLikes], ['Buyers', d.totalBuyers], ['Orders', d.totalOrders], ['Online paid', d.totalOnline], ['Cash on Delivery orders', d.totalCod], ['Cancelled', d.totalCancelled], ['Units sold', d.totalSold]].forEach(function (x) {
           var t = el('div', 'oc'); t.style.margin = '0';
           t.appendChild(el('div', 'am-s', x[0])); var n = el('b', '', String(x[1] || 0)); n.style.fontSize = '22px'; t.appendChild(n); grid.appendChild(t);
         });
         b.appendChild(grid);
         function bars(title, rows, color) {
           var box = el('div', 'oc'); box.appendChild(el('b', '', title));
           var mx = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
           if (!rows.length) box.appendChild(el('div', 'am-s', '—'));
           rows.forEach(function (r) {
             var line = el('div', 'gr-line'), lab = el('span', 'gr-l', r.l), tr = el('span', 'gr-t'), fi = el('i', 'gr-f'), val = el('b', 'gr-v', String(r.v));
             fi.style.width = Math.max(r.v ? 4 : 0, Math.round(r.v / mx * 100)) + '%'; fi.style.background = r.c || color;
             tr.appendChild(fi); line.append(lab, tr, val); box.appendChild(line);
           });
           b.appendChild(box);
         }
         var short = function (t) { return t.length > 14 ? t.slice(0, 13) + '…' : t; };
         bars(T('❤️ Likes per product'), d.products.map(function (p) { return { l: short(p.title), v: p.likes || 0 }; }), '#e11d48');
         bars(T('👁 Views per product'), d.products.map(function (p) { return { l: short(p.title), v: p.views || 0 }; }), '#2563eb');
         bars(T('🛒 Units sold per product'), d.products.map(function (p) { return { l: short(p.title), v: p.unitsSold || 0 }; }), '#16a34a');
         var dk = Object.keys(d.daily || {});
         bars(T('📈 Orders in the last 7 days'), dk.map(function (k) { return { l: k.slice(5), v: d.daily[k] }; }), '#f45b08');
         var sk = Object.keys(d.states || {}).sort(function (a, b2) { return d.states[b2] - d.states[a]; });
         bars(T('📍 Orders by state'), sk.map(function (k) { return { l: short(k), v: d.states[k] }; }), '#7c3aed');
         var cb = Object.keys(d.countriesBought || {});
         var cc = el('div', 'oc');
         cc.appendChild(el('b', '', T('Countries')));
         cc.appendChild(el('div', 'am-s', cb.length ? T('Bought from') + ': ' + cb.map(function (c) { return cname(c) + ' (' + d.countriesBought[c] + ')'; }).join(', ') : T('Bought from') + ': —'));
         cc.appendChild(el('div', 'am-s', T('No purchase from') + ': ' + ((d.countriesNotBought || []).length ? d.countriesNotBought.map(cname).join(', ') : '—')));
         b.appendChild(cc);
         d.products.forEach(function (p) {
           var c = el('div', 'oc');
           var h = el('div', ''); h.style.cssText = 'display:flex;justify-content:space-between;gap:8px';
           h.append(el('b', '', p.title), el('b', '', money(p.price, p.currency))); c.appendChild(h);
           c.appendChild(el('div', 'am-s', '👁 ' + T('Views') + ': ' + (p.views || 0) + ' · ♥ ' + T('Likes') + ': ' + (p.likes || 0)));
           c.appendChild(el('div', 'am-s', T('Orders') + ': ' + (p.orderCount || 0) + ' · ' + T('Units sold') + ': ' + (p.unitsSold || 0) + ' · ' + T('Cancelled') + ': ' + (p.cancelledCount || 0)));
           c.appendChild(el('div', 'am-s', T('Online paid') + ': ' + (p.onlineCount || 0) + ' · ' + T('Cash on Delivery orders') + ': ' + (p.codCount || 0)));
           var pc = Object.keys(p.countries || {});
           c.appendChild(el('div', 'am-s', pc.length ? T('Bought from') + ': ' + pc.map(function (k) { return cname(k) + ' (' + p.countries[k] + ')'; }).join(', ') : T('No orders yet.')));
           b.appendChild(c);
         });
       }).catch(function (e) { $('ord-body').textContent = e.message; });
     }],
     ['Language', '🌐', 'language', function () { langDialog(); }],
     ['Help', '❔', 'help', function () { $('acc').close(); if ($('help-dlg')) $('help-dlg').showModal(); }],
     ['Sign out', '↪', 'signout', function () {
       api('/shop/api/logout', { method: 'POST' }).then(function () {
         me = null; try { sessionStorage.removeItem('sgm_skip'); } catch (x) {}
         $('acc').close(); load(); authScreen('login');
       });
     }]].forEach(function (x) {
      var k = el('button', 'account-action', ''); k.type = 'button'; k.dataset.profileAction = x[2];
      var ico = el('span', 'account-action-icon', x[1]);
      var copy = el('span', 'account-action-copy', ''); copy.appendChild(el('strong', '', x[0]));
      var desc = {orders:'Track purchases and delivery updates',products:'View products you have uploaded',dashboard:'Sales, likes and buyer locations',language:'Choose your language',help:'Learn how to use the marketplace',signout:'Securely sign out of this account'}[x[2]];
      copy.appendChild(el('small', '', desc));
      k.append(ico, copy, el('span', 'account-action-arrow', '›')); k.onclick = x[3]; b.appendChild(k);
    });
    var assistant = el('button', 'account-assistant-entry', ''); assistant.type = 'button'; assistant.onclick = function () { $('acc').close(); openAssistant(); };
    assistant.append(el('span', 'account-assistant-mark', '✦'));
    var assistantCopy = el('span', 'account-action-copy', ''); assistantCopy.appendChild(el('strong', '', 'AI Assistant')); assistantCopy.appendChild(el('small', '', 'Get help finding any feature'));
    assistant.append(assistantCopy, el('span', 'account-action-arrow', '›')); b.appendChild(assistant);
    if (!$('acc').open) $('acc').showModal();
  }
  $('open-acc').onclick = function (e) { e.preventDefault(); accView(); };
  // The small top-right avatar opens the same real account/profile panel.
  $('acc-close').onclick = function () { $('acc').close(); };

  // ---- Checkout (Amazon-style): payment choice, price details, seller QR, trust points, more products ----
  var COD_FEE = 49;
  function coItems() {
    var items = single || Object.keys(cart).map(function (id) { return { id: id, qty: cart[id] }; });
    return items.map(function (it) {
      var p = all.find(function (x) { return x.id === (it.id || it.productId); });
      return p ? { p: p, qty: Math.min(Math.max(Number(it.qty) || 1, 1), 10) } : null;
    }).filter(Boolean);
  }
  function coRefresh() {
    var f = $('co-form'), its = coItems(), pay = (f.pay && f.pay.value) || 'COD';
    $('co-on-s').textContent = T('Exact product price. No extra charge');
    $('co-pay-h').textContent = T('Payment method');
    $('co-cod-t').textContent = T('Cash on Delivery');
    $('co-cod-s').textContent = T('Pay when the parcel arrives · +₹49 delivery fee per order');
    $('co-on-t').textContent = T('Pay online (UPI / QR)');
    // price details
    var sellers = {}, itemsTotal = {}, fee = 0, units = 0;
    its.forEach(function (x) {
      sellers[x.p.seller + '|' + x.p.id.slice(0, 0)] = 1;
      itemsTotal[x.p.currency] = (itemsTotal[x.p.currency] || 0) + x.p.price * x.qty; units += x.qty;
    });
    var bySeller = {};
    its.forEach(function (x) { bySeller[x.p.seller] = x.p.currency; });
    Object.keys(bySeller).forEach(function (k) { if (pay === 'COD' && bySeller[k] === 'INR') fee += COD_FEE; });
    var sum = $('co-sum'); sum.textContent = '';
    sum.appendChild(el('b', '', T('Price details')));
    function row(a, b2, strong) { var r = el('div', 'co-row' + (strong ? ' tot' : '')); r.append(el('span', '', a), el('span', '', b2)); sum.appendChild(r); }
    var cur = Object.keys(itemsTotal);
    row(T('Items') + ' (' + units + ')', cur.map(function (c) { return money(itemsTotal[c], c); }).join(' + ') || '—');
    row(T('Delivery fee'), pay === 'COD' ? (fee ? money(fee, 'INR') : '—') : T('FREE'));
    var totals = cur.map(function (c) { return money(itemsTotal[c] + (c === 'INR' ? fee : 0), c); }).join(' + ') || '—';
    row(T('Total to pay'), totals, true);
    if (its.length) sum.appendChild(el('div', 'am-s', '🚚 ' + T('Delivery in') + ' ' + Math.max.apply(null, its.map(function (x) { return x.p.days || 5; })) + ' ' + T('days')));
    // online payment: the Stratic QR appears; it disappears again as soon as the order is placed
    var q = $('co-qr'); q.hidden = pay !== 'ONLINE';
    var qt = $('co-qr-top'); qt.textContent = '';
    if (pay === 'ONLINE') {
      qt.appendChild(el('p', 'am-s', T('Scan this QR with any UPI app and pay the exact total amount.')));
      var amt = el('div', 'co-amt'); amt.append(el('span', '', T('Amount to pay')), el('b', '', totals)); qt.appendChild(amt);
      var im = el('img'); im.src = '/static/img/pay-qr.jpg'; im.alt = 'QR'; qt.appendChild(im);
      $('co-txn-t').textContent = T('Transaction ID / UTR (from your payment app)');
    }
    var tr = $('co-trust'); tr.textContent = '';
    [T('✅ Easy cancellation within 24 hours'), T('🔒 Safe & secure ordering'), T('📞 Seller will call to confirm your order')].forEach(function (t) { tr.appendChild(el('li', '', t)); });
    // more products
    var ids = {}; its.forEach(function (x) { ids[x.p.id] = 1; });
    var more = all.filter(function (x) { return !ids[x.id] && !x.mine; }).slice(0, 8);
    var mw = $('co-more-w'), mb = $('co-more'); mb.textContent = ''; mw.hidden = !more.length;
    $('co-more-h').textContent = T('More products you may like');
    more.forEach(function (x) {
      var c = el('div', 'co-mc'), im = el('img'); im.src = x.img; im.alt = x.title; im.loading = 'lazy';
      var ad = el('button', 'am-pb d', T('Add to Cart')); ad.type = 'button';
      ad.onclick = function () { addCart(x.id); toast(T('Added to cart')); };
      c.append(im, el('div', 'co-mt', x.title), el('b', '', money(x.price, x.currency)), ad); mb.appendChild(c);
    });
    $('co-place').textContent = pay === 'ONLINE' ? T('I have paid · Place order') : T('Place order');
    $('co-cancel').textContent = T('Cancel');
  }
  function coOpen() {
    var f = $('co-form'); if (f.pay) f.pay.value = 'COD';
    coRefresh(); $('co').showModal();
  }
  Array.prototype.forEach.call($('co-form').querySelectorAll('input[name=pay]'), function (r) { r.onchange = coRefresh; });
  $('co-cancel').onclick = function () { single = null; $('co').close(); };

  // ---- Cancel order dialog (reason required, only within 24 hours) ----
  function cancelDialog(o, done) {
    var d = document.createElement('dialog'); d.className = 'cx-dlg';
    var reasons = [T('Ordered by mistake', 'गलती से ऑर्डर हो गया'), T('Found a better price', 'कहीं और सस्ता मिला'), T('Delivery is too slow', 'डिलीवरी में देरी'), T('Want to change product / address', 'प्रोडक्ट या पता बदलना है'), T('Other', 'दूसरा कारण')];
    d.appendChild(el('h2', '', T('Cancel order', 'ऑर्डर कैंसिल करें')));
    d.appendChild(el('p', 'am-s', o.ref));
    var lab = el('label', '', T('Why are you cancelling?', 'आप कैंसिल क्यों कर रहे हैं?'));
    var sel = document.createElement('select'); reasons.forEach(function (r) { var op = document.createElement('option'); op.textContent = r; sel.appendChild(op); });
    lab.appendChild(sel); d.appendChild(lab);
    var ta = document.createElement('textarea'); ta.rows = 2; ta.maxLength = 150; ta.placeholder = T('Write your reason (needed for Other)', 'अपना कारण लिखें (दूसरा कारण चुनने पर ज़रूरी)'); d.appendChild(ta);
    var m = el('p', 'am-s', ''); m.style.color = '#b12704'; d.appendChild(m);
    var row = el('div', 'co-actions');
    var no = el('button', 'am-btn dark', T('Keep order', 'ऑर्डर रखें')); no.type = 'button'; no.onclick = function () { d.close(); d.remove(); };
    var yes = el('button', 'am-btn y', T('Cancel order', 'कैंसिल करें')); yes.type = 'button';
    yes.onclick = function () {
      var reason = sel.value === reasons[4] ? ta.value.trim() : (sel.value + (ta.value.trim() ? ' - ' + ta.value.trim() : ''));
      if (!reason) { m.textContent = T('Please write your reason.', 'कृपया कारण लिखें।'); return; }
      yes.disabled = true;
      jpost('/shop/api/orders/' + o.ref + '/status', { status: 'CANCELLED', reason: reason }, 'PATCH').then(function () { d.close(); d.remove(); done(); toast(T('Order cancelled', 'ऑर्डर कैंसिल हो गया')); }).catch(function (e) { yes.disabled = false; m.textContent = e.message; });
    };
    row.append(no, yes); d.appendChild(row);
    document.body.appendChild(d); d.showModal();
  }

  // ---- Language dialog: every text in the app changes to the chosen language ----
  function langDialog() {
    var I = window.SGM_I18N; if (!I) return;
    var chosen = I.lang(), d = $('lang-dlg');
    if (d) d.remove();
    d = document.createElement('dialog'); d.id = 'lang-dlg'; d.className = 'lg-dlg';
    var ico = el('div', 'lg-ico', '🌐'), h = el('h2', '', 'Choose language'), sub = el('p', 'lg-sub', 'This changes the app language only on this device.');
    var list = el('div', 'lg-list');
    function paint() {
      list.textContent = '';
      I.langs.forEach(function (L) {
        var b = el('button', 'lg-item' + (L[0] === chosen ? ' on' : ''), ''); b.type = 'button';
        b.appendChild(el('span', 'lg-n', L[1] + (L[0] === 'en' ? '' : ' · ' + L[2])));
        b.appendChild(el('span', 'lg-c', L[0].toUpperCase()));
        if (L[0] === chosen) b.appendChild(el('span', 'lg-ok', '✓'));
        b.setAttribute('data-notr', '1');
        b.onclick = function () { chosen = L[0]; paint(); };
        list.appendChild(b);
      });
    }
    paint();
    var row = el('div', 'lg-row');
    var no = el('button', 'lg-btn', 'Cancel'); no.type = 'button'; no.onclick = function () { d.close(); d.remove(); };
    var ok = el('button', 'lg-btn pri', 'Save'); ok.type = 'button';
    ok.onclick = function () {
      I.setLang(chosen);
      d.close(); d.remove();
      if (me) { api('/shop/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-sgm': '1' }, body: JSON.stringify({ lang: chosen }) }).then(function (r) { if (r && r.user) me = r.user; }).catch(function () {}); }
      tabs(); load(); try { if ($('acc').open) accView(); } catch (e) {}
      setTimeout(function () { I.apply(); }, 60);
    };
    row.append(no, ok);
    d.append(ico, h, sub, list, row);
    document.body.appendChild(d); d.showModal(); I.apply();
  }

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
        c.appendChild(el('div', 'am-s', new Date(o.createdAt).toLocaleString() + ' · ' + (o.payment === 'ONLINE' ? T('Online payment') + ' · ' + T('Paid ✓') : T('Cash on Delivery') + ' · ' + T('Pay on delivery'))));
        o.items.forEach(function (i) { c.appendChild(el('div', '', i.qty + ' × ' + i.title + ' — ' + money(i.price, o.currency))); });
        if (o.deliveryCharge) c.appendChild(el('div', 'am-s', T('Delivery fee') + ': ' + money(o.deliveryCharge, o.currency)));
        c.appendChild(el('b', '', 'Total: ' + money(o.total, o.currency)));
        if (o.status === 'CANCELLED' && o.cancelReason) c.appendChild(el('div', 'am-s', T('Cancel reason') + ': ' + o.cancelReason));
        if (!sell && o.seller && o.seller.phone) c.appendChild(el('div', 'am-s', 'Seller: ' + o.seller.shop + ' · ' + o.seller.phone));
        if (sell) {
          var box = el('div', 'buy-box');
          box.appendChild(el('div', 'buy-label', 'Buyer details (new order)'));
          box.appendChild(el('div', '', o.buyer.name));
          box.appendChild(el('div', 'buy-phone', o.buyer.phone));
          box.appendChild(el('div', 'am-s', o.buyer.address + ', ' + o.buyer.city + (o.buyer.state ? ', ' + o.buyer.state : '') + ' ' + o.buyer.pincode + ', ' + o.buyer.country));
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
        if (!sell && o.status === 'CONFIRMED') {
          var dots = el('button', 'ord-dots', '⋮'); dots.type = 'button';
          var menu = el('div', 'ord-menu'); menu.hidden = true;
          if (o.canCancel) {
            var hrs = Math.max(0, Math.ceil((new Date(o.cancelBy).getTime() - Date.now()) / 3600000));
            var cb = el('button', '', T('Cancel order', 'ऑर्डर कैंसिल करें')); cb.type = 'button';
            cb.onclick = function () { menu.hidden = true; cancelDialog(o, function () { showOrders(kind); }); };
            menu.appendChild(cb); menu.appendChild(el('small', '', T('Cancel allowed for ' + hrs + 'h more', 'अभी ' + hrs + ' घंटे और कैंसिल कर सकते हैं')));
          } else menu.appendChild(el('small', '', T('Cancellation time (24 hours) is over', 'कैंसिल का समय (24 घंटे) खत्म हो गया')));
          dots.onclick = function () { menu.hidden = !menu.hidden; };
          c.style.position = 'relative'; c.append(dots, menu);
        }
        if (ac.children.length) c.appendChild(ac);
        b.appendChild(c);
      });
    }).catch(function (e) { b.textContent = e.message; });
  }
  $('ord-close').onclick = function () { $('ord').close(); };
  $('co-close').onclick = function () { single = null; $('co').close(); };
  $('co-form').onsubmit = function (e) {
    e.preventDefault();
    var f = e.target, m = $('co-msg');
    m.textContent = T('Loading…');
    var items = single || Object.keys(cart).map(function (id) { return { id: id, qty: cart[id] }; });
    if (!items.length) { m.textContent = T('Your cart is empty.'); return; }
    if (f.pay && f.pay.value === 'ONLINE' && !/^[A-Za-z0-9]{8,30}$/.test((f.txn.value || '').replace(/\s/g, ''))) { m.textContent = T('Enter the Transaction ID shown in your payment app after paying.'); return; }
    jpost('/shop/api/orders', {
      name: f.name.value, phone: f.phone.value, address: f.address.value,
      city: f.city.value, state: f.state.value, pincode: f.pincode.value, country: f.country.value, items: items, paymentMethod: (f.pay && f.pay.value) || 'COD', txnId: (f.txn && f.txn.value || '').replace(/\s/g, '')
    }).then(function (d) {
      if (!single) { cart = {}; saveCart(); }
      single = null; f.reset(); f.country.value = 'India'; m.textContent = '';
      $('co').close();
      if (d.orders && d.orders[0] && d.orders[0].buyer) { me = Object.assign({}, me, { phone: me.phone || d.orders[0].buyer.phone }); }
      var refs = (d.orders || []).map(function (o) { return o.ref; }).join(', ');
      if ($('ok-ref')) $('ok-ref').textContent = refs ? ('Order ID: ' + refs) : 'Order placed successfully';
      var okEl = $('ok-order');
      if (okEl) { okEl.hidden = false; document.body.style.overflow = 'hidden'; }
      else showOrders('mine', 'Order placed!');
      load();
    }).catch(function (er) { m.textContent = er.message; });
  };

  // Photo: up to 5 own photos (white studio background). Missing ones are auto-created from the FIRST photo.
  var blob = null, extras = [], prepping = false;
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
    return new Promise(function (res) { out.toBlob(function (b) { res({ blob: b, removed: ok, turned: turned, cut: c, box: [minX, minY, bw, bh] }); }, 'image/jpeg', 0.82); });
  }
  function toBlob(cv) { return new Promise(function (res) { cv.toBlob(res, 'image/jpeg', 0.84); }); }
  function filt(x, extra) { if ('filter' in x) x.filter = 'contrast(1.05) saturate(1.08) brightness(1.03)' + (extra || ''); }
  // Auto photos: SAME product pixels, always pure white background, clean studio angles.
  function variants(r) {
    var S = 640, c = r.cut, bx = r.box[0], by = r.box[1], bw = r.box[2], bh = r.box[3], real = r.removed, outs = [];
    function canvas() { var k = cvs(S, S), x = k.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, S, S); return { k: k, x: x }; }
    function floorShadow(x, cx, y, w, a) {
      var g = x.createRadialGradient(cx, y, 2, cx, y, w / 2);
      g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.save(); x.translate(0, y); x.scale(1, 0.14); x.translate(0, -y); x.fillStyle = g;
      x.beginPath(); x.arc(cx, y, w / 2, 0, 7); x.fill(); x.restore();
    }
    // 1) close-up of the upper / front detail
    var a1 = canvas(), cw = bw * 0.8, ch = bh * 0.5, f1 = Math.min(560 / cw, 560 / ch);
    filt(a1.x); a1.x.drawImage(c, bx + (bw - cw) / 2, by, cw, ch, (S - cw * f1) / 2, (S - ch * f1) / 2, cw * f1, ch * f1);
    outs.push(a1.k);
    // 2) glossy white floor reflection
    var a2 = canvas(), f2 = Math.min(380 / bw, 380 / bh), w2 = bw * f2, h2 = bh * f2, t2 = (S - h2 * 1.4) / 2;
    var rc = cvs(S, S), rx = rc.getContext('2d');
    rx.save(); rx.translate(0, t2 + h2 * 2); rx.scale(1, -1); filt(rx); rx.drawImage(c, bx, by, bw, bh, (S - w2) / 2, t2, w2, h2); rx.restore();
    rx.globalCompositeOperation = 'destination-in';
    var mg = rx.createLinearGradient(0, t2 + h2, 0, t2 + h2 * 1.45); mg.addColorStop(0, 'rgba(0,0,0,.28)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
    rx.fillStyle = mg; rx.fillRect(0, t2 + h2, S, h2 * 0.5);
    a2.x.drawImage(rc, 0, 0);
    if (real) floorShadow(a2.x, S / 2, t2 + h2 + 2, w2 * 0.9, 0.22);
    filt(a2.x); a2.x.drawImage(c, bx, by, bw, bh, (S - w2) / 2, t2, w2, h2);
    outs.push(a2.k);
    // 3) gentle 3/4 view (small angle) with soft floor shadow
    var a3 = canvas(), f3 = Math.min(420 / bw, 420 / bh), w3 = bw * f3, h3 = bh * f3;
    if (real) floorShadow(a3.x, S / 2 + 6, S / 2 + h3 / 2 + 10, w3 * 1.1, 0.25);
    a3.x.save(); a3.x.translate(S / 2, S / 2); a3.x.rotate(7 * Math.PI / 180); filt(a3.x);
    a3.x.drawImage(c, bx, by, bw, bh, -w3 / 2, -h3 / 2, w3, h3); a3.x.restore();
    outs.push(a3.k);
    // 4) product on a soft pedestal, white background
    var a4 = canvas(), f4 = Math.min(320 / bw, 340 / bh), w4 = bw * f4, h4 = bh * f4, yb = S * 0.74;
    a4.x.fillStyle = '#f3f3f5'; a4.x.beginPath(); a4.x.ellipse(S / 2, yb + 6, 200, 34, 0, 0, 7); a4.x.fill();
    a4.x.fillStyle = '#e9e9ed'; a4.x.beginPath(); a4.x.ellipse(S / 2, yb, 200, 34, 0, 0, 7); a4.x.fill();
    if (real) floorShadow(a4.x, S / 2, yb + 2, w4 * 0.9, 0.3);
    filt(a4.x); a4.x.drawImage(c, bx, by, bw, bh, (S - w4) / 2, yb - h4 + 4, w4, h4);
    outs.push(a4.k);
    return Promise.all(outs.map(toBlob));
  }
  var shots = [], autos = [], tok = 0;
  function hint() {
    var n = shots.length, need = Math.max(0, 5 - n);
    $('sp-hint').textContent = !n ? T('Add up to 5 photos. Missing photos are created automatically.', '5 फ़ोटो तक डालें। बाकी फ़ोटो अपने आप बन जाएँगी।')
      : T(n + ' of 5 uploaded', '5 में से ' + n + ' अपलोड') + (need ? ' · ' + T(need + ' auto-created', need + ' अपने आप बनेंगी') : ' · ' + T('no auto photos needed', 'ऑटो फ़ोटो की ज़रूरत नहीं'));
  }
  function strip() {
    var st = $('prev-strip'); st.textContent = '';
    shots.forEach(function (sh, i) {
      var w = el('div', 'sp-th'), im = el('img'); im.alt = ''; if (sh.blob) im.src = URL.createObjectURL(sh.blob);
      w.appendChild(im);
      w.appendChild(el('span', 'sp-tag', i === 0 ? T('Main', 'मुख्य') : String(i + 1)));
      var x = el('button', 'sp-x', '✕'); x.type = 'button'; x.title = T('Remove', 'हटाएँ');
      x.onclick = function () { shots.splice(i, 1); rebuild(); };
      w.appendChild(x); st.appendChild(w);
    });
    autos.forEach(function (bb) {
      var w = el('div', 'sp-th auto'), im = el('img'); im.alt = ''; im.src = URL.createObjectURL(bb);
      w.appendChild(im); w.appendChild(el('span', 'sp-tag a', T('Auto', 'ऑटो'))); st.appendChild(w);
    });
    if (shots.length && shots.length < 5) {
      var plus = el('button', 'sp-th sp-plus', '+'); plus.type = 'button'; plus.title = T('Add another photo', 'दूसरी फ़ोटो जोड़ें');
      plus.onclick = function () { $('photo-gal').click(); };
      st.appendChild(plus);
    }
    st.hidden = !shots.length;
  }
  function rebuild() {
    var my = ++tok; prepping = true; autos = []; blob = null; extras = [];
    hint(); strip();
    if (!shots.length) { prepping = false; $('proc').textContent = ''; return; }
    $('proc').textContent = T('Preparing photos…', 'फ़ोटो तैयार हो रही हैं…');
    var rm = $('rm').checked;
    var chain = Promise.resolve();
    shots.forEach(function (sh) {
      if (sh.blob && sh.rm === rm) return;
      chain = chain.then(function () { return loadImg(sh.file); }).then(function (img) { return studio(img, rm); }).then(function (r) { sh.r = r; sh.blob = r.blob; sh.rm = rm; });
    });
    chain.then(function () {
      if (my !== tok) return;
      strip();
      var need = 5 - shots.length;
      return need > 0 ? variants(shots[0].r).then(function (arr) { return arr.slice(0, need); }) : [];
    }).then(function (arr) {
      if (my !== tok) return;
      autos = arr || [];
      blob = shots[0].blob;
      extras = shots.slice(1).map(function (x) { return x.blob; }).concat(autos);
      prepping = false; strip(); hint();
      var r0 = shots[0].r;
      $('proc').textContent = !rm ? T('Original background kept.', 'असली बैकग्राउंड रखा गया।')
        : r0.removed ? T('White background ✓ · studio look ready', 'सफ़ेद बैकग्राउंड ✓ · स्टूडियो लुक तैयार') : T('Could not separate background. Use a plain, well-lit background.', 'बैकग्राउंड अलग नहीं हो पाया। सादा और रोशनी वाला बैकग्राउंड रखें।');
    }).catch(function () { if (my !== tok) return; prepping = false; $('proc').textContent = T('Could not read this photo.', 'यह फ़ोटो पढ़ी नहीं जा सकी।'); shots.pop(); rebuild(); });
  }
  function addFiles(list) {
    var arr = [].slice.call(list || []), room = 5 - shots.length;
    if (!room) { toast(T('Maximum 5 photos', 'अधिकतम 5 फ़ोटो')); return; }
    arr.slice(0, room).forEach(function (f) { shots.push({ file: f, blob: null, r: null, rm: null }); });
    if (arr.length > room) toast(T('Only 5 photos allowed', 'सिर्फ़ 5 फ़ोटो ही डाल सकते हैं'));
    rebuild();
  }
  ['photo-cam', 'photo-gal'].forEach(function (i) {
    $(i).onchange = function () { var fl = this.files; addFiles(fl); this.value = ''; };
  });
  function rmLabel() { $('rm-t').textContent = T('Auto white background') + ': ' + ($('rm').checked ? T('ON') : T('OFF')); }
  $('rm').onchange = function () { rmLabel(); shots.forEach(function (x) { x.blob = null; }); rebuild(); };
  function sellTexts() {
    $('sp-cam-t').textContent = T('Camera', 'कैमरा'); $('sp-gal-t').textContent = T('Gallery', 'गैलरी');
    rmLabel(); hint();
  }

  var dlg = $('sell'), form = $('sell-form'), msg = $('sell-msg');
  function prefill() {
    try {
      var sv = JSON.parse(localStorage.getItem('sgm_seller') || '{}');
      ['seller', 'phone', 'address'].forEach(function (k) { if (sv[k] && !form[k].value) form[k].value = sv[k]; });
    } catch (x) {}
  }
  $('open-sell').onclick = function () { needLogin(function () { prefill(); sellTexts(); dlg.showModal(); }); };
  ['sell-close', 'sell-cancel'].forEach(function (i) { $(i).onclick = function () { dlg.close(); }; });
  form.onsubmit = function (e) {
    e.preventDefault();
    if (!blob) { msg.textContent = T('Add a product photo first (Camera or Gallery).', 'पहले प्रोडक्ट की फ़ोटो डालें (कैमरा या गैलरी)।'); return; }
    if (prepping) { msg.textContent = 'Photos are still being prepared, wait a second…'; return; }
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
    extras.forEach(function (eb, i) { fd.append('extra', eb, 'p' + (i + 1) + '.jpg'); });
    msg.textContent = 'Posting product…';
    msg.style.color = '#0f1111';
    api('/shop/api/products', { method: 'POST', body: fd }).then(function (d) {
      try { localStorage.setItem('sgm_seller', JSON.stringify({ seller: form.seller.value, phone: form.phone.value, address: form.address.value })); } catch (x) {}
      form.reset(); blob = null; extras = []; shots = []; autos = []; tok++;
      if ($('prev-strip')) { $('prev-strip').hidden = true; $('prev-strip').textContent = ''; }
      $('proc').textContent = ''; msg.textContent = ''; hint();
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

  // Stratic Market in-app guide: deterministic, API-free, and connected to real shop controls/data.
  var assistantDialog = $('ai-assistant'), assistantHindi = false, assistantExplicitLang = '';
  var assistantCategories = [
    {key:'All', label:'All products', terms:['all','all products','सभी','सभी प्रोडक्ट']},
    {key:'Mobiles', label:'Mobiles & Accessories', terms:['mobile','mobiles','phone','phones','मोबाइल','फोन']},
    {key:'Laptops', label:'Laptops & Computers', terms:['laptop','laptops','computer','computers','pc','लैपटॉप','कंप्यूटर']},
    {key:'Electronics', label:'Electronics', terms:['electronics','electronic','technology','tech','इलेक्ट्रॉनिक','टेक्नोलॉजी','इलेक्ट्रॉनिक्स']},
    {key:'TV', label:'TV & Appliances', terms:['tv','television','appliances','टीवी','टेलीविजन']},
    {key:'Fashion', label:"Men's Fashion", terms:['fashion','men clothes','clothes','कपड़े','फैशन']},
    {key:'Women', label:"Women's Fashion", terms:['women','women fashion','ladies','महिलाओं के कपड़े']},
    {key:'Kids', label:'Kids & Baby', terms:['kids','baby','children','बच्चों']},
    {key:'Footwear', label:'Footwear', terms:['footwear','shoes','sandals','जूते','चप्पल']},
    {key:'Watches', label:'Watches', terms:['watch','watches','घड़ी','घड़ियां']},
    {key:'Jewellery', label:'Jewellery', terms:['jewellery','jewelry','gold chain','गहने','ज्वेलरी']},
    {key:'Beauty', label:'Beauty & Personal Care', terms:['beauty','cosmetics','makeup','ब्यूटी','मेकअप']},
    {key:'Health', label:'Health & Household', terms:['health','household','हेल्थ']},
    {key:'Home', label:'Home & Kitchen', terms:['home','kitchen','home items','घर का सामान','किचन']},
    {key:'Furniture', label:'Furniture', terms:['furniture','sofa','chair','table','फर्नीचर']},
    {key:'Garden', label:'Garden & Outdoor', terms:['garden','outdoor','बागवानी']},
    {key:'Grocery', label:'Grocery & Gourmet', terms:['grocery','groceries','food','किराना','खाने का सामान']},
    {key:'Sports', label:'Sports & Fitness', terms:['sports','fitness','खेल','फिटनेस']},
    {key:'Automotive', label:'Cars & Motorbike', terms:['car','cars','bike','motorbike','ऑटो','बाइक']},
    {key:'Tools', label:'Tools & Home Improvement', terms:['tools','tool','home improvement','औजार']},
    {key:'Books', label:'Books', terms:['book','books','बुक','किताब','किताबें']},
    {key:'Movies', label:'Movies & Music', terms:['movie','movies','music','फिल्म','म्यूजिक']},
    {key:'Gaming', label:'Video Games', terms:['gaming','game','games','वीडियो गेम']},
    {key:'Toys', label:'Toys & Games', terms:['toy','toys','खिलौने']},
    {key:'Pet', label:'Pet Supplies', terms:['pet','pets','पालतू']},
    {key:'Office', label:'Office Products', terms:['office','stationery','ऑफिस','स्टेशनरी']},
    {key:'Industrial', label:'Industrial & Scientific', terms:['industrial','scientific','इंडस्ट्रियल']},
    {key:'Luggage', label:'Luggage & Bags', terms:['luggage','bag','bags','बैग']},
    {key:'Handmade', label:'Handmade', terms:['handmade','हैंडमेड']},
    {key:'Deals', label:"Today's Deals", terms:['deal','deals','discount','offers','डील','ऑफर','छूट']},
    {key:'New', label:'New Releases', terms:['new releases','new arrivals','नए प्रोडक्ट']},
    {key:'Prime', label:'Best Sellers', terms:['best sellers','bestseller','बेस्ट सेलर']},
    {key:'Gift', label:'Gift Cards', terms:['gift card','gift cards','giftcard','giftcards','गिफ्ट कार्ड','उपहार कार्ड']},
    {key:'Subscribe', label:'Subscribe & Save', terms:['subscribe','subscription','सब्सक्रिप्शन']},
    {key:'Coupons', label:'Coupons', terms:['coupon','coupons','कूपन']},
    {key:'Customer', label:'Customer Service', terms:['customer service','support','कस्टमर सर्विस','सहायता']},
    {key:'Sell', label:'Sell on Stratic', terms:['sell on stratic','sell','seller','बेचने','बेचना']},
    {key:'Registry', label:'Gift Registry', terms:['gift registry','registry']},
    {key:'Pharmacy', label:'Pharmacy', terms:['pharmacy','medicine','दवा']},
    {key:'Other', label:'Other', terms:['other','अन्य']}
  ];
  function assistantMessage(text, who) {
    var chat = $('assistant-chat'); if (!chat) return;
    var row = el('div', 'assistant-message ' + (who === 'user' ? 'from-user' : 'from-assistant'), text);
    chat.appendChild(row); chat.scrollTop = chat.scrollHeight;
  }
  function assistantAction(label, command) {
    var b = el('button', 'assistant-action', label); b.type = 'button';
    b.onclick = function () { assistantRun(command); };
    $('assistant-chat').appendChild(b); $('assistant-chat').scrollTop = $('assistant-chat').scrollHeight;
  }
  function assistantLang() {
    var lang = assistantExplicitLang || (me && me.lang) || '';
    try { lang = lang || localStorage.getItem('sgm_lang') || ''; } catch (e) {}
    if (!lang) lang = document.documentElement.lang || 'en';
    return String(lang).toLowerCase().split('-')[0];
  }
  function assistantSay(en, hi, who, pa) {
    var lang = assistantLang();
    var reply = lang === 'hi' ? (hi || en) : lang === 'pa' ? (pa || hi || en) : en;
    assistantMessage(reply, who || 'assistant');
  }
  function assistantOpenCategory(key) {
    cat = key; tabs(); render();
    Array.prototype.forEach.call(document.querySelectorAll('#cat-list [data-c]'), function (x) { x.classList.toggle('on', x.getAttribute('data-c') === key); });
    if ($('cats-dlg') && $('cats-dlg').open) $('cats-dlg').close();
    if ($('grid')) $('grid').scrollIntoView({behavior:'smooth', block:'start'});
  }
  function assistantSearch(query) {
    cat = 'All'; tabs();
    if ($('q')) { $('q').value = query; render(); $('q').focus(); }
    if ($('grid')) $('grid').scrollIntoView({behavior:'smooth', block:'start'});
  }
  function assistantCategoryFromQuestion(q) {
    var norm = String(q || '').toLowerCase();
    // Match longer phrases first so "gift card" is not mistaken for generic gifts.
    var sorted = assistantCategories.slice().sort(function(a,b){
      var al = Math.max.apply(null, a.terms.map(function(t){return t.length;}));
      var bl = Math.max.apply(null, b.terms.map(function(t){return t.length;})); return bl-al;
    });
    for (var i=0;i<sorted.length;i++) {
      var item=sorted[i];
      for (var j=0;j<item.terms.length;j++) if (norm.indexOf(item.terms[j]) >= 0) return item;
    }
    return null;
  }
  function assistantStats(kind) {
    if (!me) { assistantSay('Please sign in to securely check your own product statistics. I can show your real numbers only from your account.', 'अपने असली प्रोडक्ट आँकड़े देखने के लिए कृपया अपने अकाउंट में साइन इन करें। मैं केवल आपके अकाउंट से वास्तविक आँकड़े दिखा सकता हूँ।'); assistantAction('Sign in', 'signin'); return; }
    assistantMessage(assistantLang()==='hi' ? 'आपके अकाउंट के वास्तविक आँकड़े सुरक्षित रूप से देख रहा हूँ…' : 'Checking the real statistics from your account…', 'assistant');
    api('/shop/api/product-dashboard').then(function(d) {
      var products = Number(d.totalProducts || 0), sold = Number(d.totalSold || 0), orders = Number(d.totalOrders || 0), likes = Number(d.totalLikes || 0);
      var txt;
      var perProduct = (d.products || []).map(function(p){ return '• ' + p.title + ': ' + (Number(p.unitsSold)||0) + ' sold, ' + (Number(p.likes)||0) + ' likes'; }).join('\n');
      if (assistantLang()==='hi') {
        txt = 'आपके वास्तविक प्रोडक्ट आँकड़े\n\n• अपलोड किए गए प्रोडक्ट: ' + products + '\n• बिके हुए यूनिट: ' + sold + '\n• ऑर्डर: ' + orders + '\n• कुल लाइक्स: ' + likes + (perProduct ? '\n\nप्रोडक्ट के हिसाब से\n' + perProduct : '') + '\n\nये आँकड़े आपके अकाउंट के डैशबोर्ड से लिए गए हैं।';
      } else {
        txt = 'Your verified product statistics\n\n• Products uploaded: ' + products + '\n• Units sold: ' + sold + '\n• Orders: ' + orders + '\n• Total likes: ' + likes + (perProduct ? '\n\nProduct breakdown\n' + perProduct : '') + '\n\nThese numbers came from your account dashboard.';
      }
      assistantMessage(txt, 'assistant');
      if (kind === 'likes') assistantAction('View product-wise likes', 'go-dashboard');
      else if (kind === 'sold') assistantAction('View sales details', 'go-dashboard');
      else assistantAction('Open My Product Dashboard', 'go-dashboard');
    }).catch(function(){ assistantSay('I could not load your live statistics right now. Please try again in a moment.', 'अभी आपके लाइव आँकड़े नहीं खुल पाए। कृपया थोड़ी देर बाद फिर कोशिश करें।'); });
  }
  function assistantRun(command) {
    if (command.indexOf('category:') === 0) {
      var key = command.slice(9); var item = assistantCategories.find(function(c){return c.key===key;});
      var label = item ? item.label : key;
      assistantSay('I found the ' + label + ' category. Tap the button below to open it. If no products appear, sellers may not have listed items in this category yet.', 'मुझे ' + label + ' कैटेगरी मिल गई है। इसे खोलने के लिए नीचे दिए बटन पर टैप करें। अगर प्रोडक्ट नहीं दिखते, तो हो सकता है विक्रेताओं ने अभी इस कैटेगरी में सामान लिस्ट न किया हो।');
      assistantAction('Open ' + label, 'go-category:' + key); return;
    }
    if (command.indexOf('go-category:') === 0) { assistantDialog.close(); assistantOpenCategory(command.slice(12)); return; }
    if (command.indexOf('search:') === 0) {
      var term = command.slice(7);
      assistantSay('Search for “' + term + '”. I have placed the words in the search box. Available matches depend on products currently listed by sellers.', '“' + term + '” खोजें। मैंने ये शब्द सर्च बॉक्स में डाल दिए हैं। परिणाम इस बात पर निर्भर करेंगे कि विक्रेताओं ने कौन-से प्रोडक्ट लिस्ट किए हैं।');
      assistantAction('Show search results', 'go-search:' + term); return;
    }
    if (command.indexOf('go-search:') === 0) { assistantDialog.close(); assistantSearch(command.slice(10)); return; }
    if (command === 'dashboard' || command === 'products' || command === 'orders') {
      if (!me) { assistantSay('Please sign in first so I can open your private account section.', 'अपना निजी अकाउंट खोलने के लिए पहले साइन इन करें।'); assistantAction('Sign in', 'signin'); return; }
      assistantSay(command === 'dashboard' ? 'Your product dashboard includes your uploaded products, sales, orders, likes and available buyer-location details.' : command === 'products' ? 'Your uploaded products are shown here.' : 'Your placed orders are shown here.', command === 'dashboard' ? 'आपके प्रोडक्ट डैशबोर्ड में अपलोड किए गए प्रोडक्ट, बिक्री, ऑर्डर, लाइक्स और उपलब्ध खरीदार-लोकेशन दिखती हैं।' : command === 'products' ? 'आपके अपलोड किए हुए प्रोडक्ट यहाँ दिखेंगे।' : 'आपके किए हुए ऑर्डर यहाँ दिखेंगे।');
      assistantAction(command === 'dashboard' ? 'Open My Product Dashboard' : command === 'products' ? 'Open My Product' : 'Open My Orders', command === 'dashboard' ? 'go-dashboard' : command === 'products' ? 'go-products' : 'go-orders'); return;
    }
    if (command === 'stats' || command === 'likes-stats' || command === 'sold-stats' || command === 'product-count') { assistantStats(command === 'likes-stats' ? 'likes' : command === 'sold-stats' ? 'sold' : 'all'); return; }
    if (command === 'go-dashboard' || command === 'go-products' || command === 'go-orders') {
      assistantDialog.close(); accView();
      var key2 = command === 'go-dashboard' ? 'dashboard' : command === 'go-products' ? 'products' : 'orders';
      var target = document.querySelector('[data-profile-action="' + key2 + '"]'); if (target) target.click(); return;
    }
    if (command === 'signin') { assistantDialog.close(); authScreen('login'); return; }
    if (command === 'electronics') { assistantSay('To find electronics, use Categories → Electronics. You can also search for a specific item such as “wireless headphones”, “charger” or “keyboard”. I can open the category now.', 'इलेक्ट्रॉनिक्स के लिए Categories → Electronics चुनें। किसी खास चीज़ के लिए “wireless headphones”, “charger” या “keyboard” सर्च कर सकते हैं। मैं अभी कैटेगरी खोल सकता हूँ।'); assistantAction('Open Electronics', 'category:Electronics'); return; }
    if (command === 'upload') { assistantSay('How to upload a product\n1. Tap the orange + button at the bottom.\n2. Choose a clear product photo.\n3. Enter the product name, price, description and category.\n4. Add the required seller/contact details.\n5. Review everything, then tap Post product.\n\nNever list illegal or restricted goods, expired items, counterfeit/stolen products, or anything you are not legally allowed to sell.', 'प्रोडक्ट अपलोड करने का तरीका\n1. नीचे नारंगी + बटन दबाएँ।\n2. प्रोडक्ट की साफ़ फोटो चुनें।\n3. नाम, कीमत, विवरण और कैटेगरी भरें।\n4. ज़रूरी विक्रेता/संपर्क जानकारी भरें।\n5. सब जाँचकर Post product दबाएँ।\n\nगैरकानूनी या प्रतिबंधित सामान, एक्सपायरी, नकली या चोरी का सामान अपलोड न करें।'); assistantAction('Open product upload', 'go-upload'); return; }
    if (command === 'go-upload') { assistantDialog.close(); if (!me) { needLogin(function () { prefill(); dlg.showModal(); }); } else { prefill(); dlg.showModal(); } return; }
    if (command === 'likes') { assistantStats('likes'); return; }
    if (command === 'home') { assistantSay('To return to the home page, tap Home at the bottom. I can also show all products now.', 'होम पेज पर लौटने के लिए नीचे Home दबाएँ। मैं अभी सभी प्रोडक्ट भी दिखा सकता हूँ।'); assistantAction('Show all products', 'category:All'); return; }
    if (command === 'search-help') { assistantSay('Where to search\n1. The search box is near the top of the page, below the Stratic Market header.\n2. Tap it and type a product name, brand or model.\n3. Examples: “wireless headphones”, “rice cooker”, “Python programming book”, “phone charger”.\n4. Press Search/Enter on your keyboard.\n\nI can put an example search in the box for you.', 'सर्च कहाँ करें\n1. Stratic Market हेडर के ठीक नीचे ऊपर सर्च बॉक्स है।\n2. उस पर टैप करके प्रोडक्ट, ब्रांड या मॉडल लिखें।\n3. उदाहरण: “wireless headphones”, “rice cooker”, “Python programming book”, “phone charger”.\n4. कीबोर्ड पर Search/Enter दबाएँ।\n\nमैं आपके लिए उदाहरण सर्च बॉक्स में डाल सकता हूँ।'); assistantAction('Focus search box', 'go-search-focus'); assistantAction('Search Python books', 'search:Python book'); assistantAction('Search home products', 'search:home kitchen'); assistantAction('Search electronics', 'search:electronics'); return; }
    if (command === 'safety') { assistantSay('Safety rules\n• Do not upload illegal or restricted goods.\n• Never list expired products.\n• Do not list counterfeit, stolen, dangerous or misleading items.\n• Check local laws and the marketplace rules before listing.', 'सुरक्षा नियम\n• गैरकानूनी या प्रतिबंधित सामान अपलोड न करें।\n• एक्सपायरी सामान कभी लिस्ट न करें।\n• नकली, चोरी का, खतरनाक या भ्रामक सामान न बेचें।\n• लिस्ट करने से पहले स्थानीय कानून और मार्केटप्लेस के नियम जाँचें।'); return; }
    if (command === 'hello') { assistantSay('Hi! 👋 I can help you use Stratic Market. Ask me to find a category, search for a product, upload a listing, check orders, or see your product statistics.', 'नमस्ते! 👋 मैं Stratic Market इस्तेमाल करने में मदद कर सकता हूँ। कैटेगरी ढूँढने, प्रोडक्ट सर्च करने, सामान अपलोड करने, ऑर्डर या बिक्री के आँकड़े देखने के लिए पूछें।', 'assistant', 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! 👋 ਮੈਂ Stratic Market ਵਰਤਣ ਵਿੱਚ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ।'); return; }
    if (command === 'language') { assistantSay('I will follow the language selected in your Stratic Market account. You can also ask me “Hindi mein baat karo” or “Speak English”.', 'मैं आपके Stratic Market अकाउंट में चुनी गई भाषा में जवाब दूँगा। आप “Speak English” या “हिंदी में बात करो” भी कह सकते हैं।'); return; }
    if (command === 'founder') { assistantSay('Stratic Market is a project of StraticSoft. The founder and CEO is Sahil. The app build date provided by the owner is 20 October 2026, and the owner says development took about one month. I cannot share private contact details or a personal address.', 'Stratic Market, StraticSoft का प्रोजेक्ट है। इसके फाउंडर और CEO साहिल हैं। मालिक द्वारा बताई गई ऐप की निर्माण तारीख 20 अक्टूबर 2026 है और इसे बनाने में लगभग एक महीना लगा। मैं निजी फोन नंबर या घर का पता साझा नहीं कर सकता।'); return; }
    if (command === 'go-search-focus') { assistantDialog.close(); if ($('q')) { $('q').scrollIntoView({behavior:'smooth',block:'center'}); $('q').focus(); } return; }
    if (command === 'unknown') { assistantSay('I can help you navigate Stratic Market. Tell me a product name to search, or ask for a category, upload steps, your orders, or your real product statistics.', 'मैं Stratic Market इस्तेमाल करने में मदद कर सकता हूँ। सर्च करने के लिए प्रोडक्ट का नाम लिखें, या कैटेगरी, अपलोड करने के तरीके, ऑर्डर या अपने वास्तविक प्रोडक्ट आँकड़ों के बारे में पूछें।'); assistantAction('Find a category', 'open-categories'); assistantAction('Show search instructions', 'search-help'); return; }
    if (command === 'open-categories') { $('cats-dlg').showModal(); return; }
  }
  function openAssistant() {
    if (!assistantDialog) return;
    if (!assistantDialog.open) assistantDialog.showModal();
    if (!$('assistant-chat').children.length) assistantSay('Hi! How can I help you use Stratic Market today?', 'नमस्ते! आज मैं Stratic Market इस्तेमाल करने में आपकी कैसे मदद करूँ?');
    $('assistant-input').focus();
  }
  function assistantIntent(raw) {
    var q = String(raw || '').toLowerCase().trim();
    if (/\b(speak|talk|reply|answer).{0,12}\b(english|hindi|punjabi|tamil|telugu|bengali|marathi|gujarati|urdu)\b|\b(english|hindi|punjabi|tamil|telugu|bengali|marathi|gujarati|urdu)\s+(mein|in|language)|हिंदी में|अंग्रेजी में|पंजाबी में/.test(q)) {
      if (/hindi|हिंदी/.test(q)) assistantExplicitLang='hi'; else if (/punjabi|ਪੰਜਾਬੀ|ਪੰਜਾਬੀ/.test(q)) assistantExplicitLang='pa'; else if (/english|अंग्रेजी/.test(q)) assistantExplicitLang='en';
      return 'language';
    }
    if (/^(hi|hello|hey|namaste|नमस्ते|हेलो|ਸਤ ਸ੍ਰੀ ਅਕਾਲ)\b/.test(q)) return 'hello';
    if (/who (made|built|created|is the founder|is the ceo)|founder|ceo|owner|when.{0,20}(app|built|created|made)|कब.{0,20}(बना|बनाया)|किसने बनाया|फाउंडर|सीईओ|मालिक|कंपनी का नाम|app name|app कब बना|build date/.test(q)) return 'founder';
    if (/\b(how many|total|count|कितने|कितनी|कुल|number of)\b.*(like|likes|लाइक|पसंद)/.test(q) || /(like|likes|लाइक|पसंद).*(कितने|कितनी|total|count|how many)/.test(q)) return 'likes-stats';
    if (/\b(how many|total|count|कितने|कितनी|कुल|number of)\b.*(sold|sale|sales|बिके|बिका|खरीदे|बिक्री|units)/.test(q) || /(sold|sales|बिके|बिक्री).*(कितने|कितनी|total|count|how many)/.test(q)) return 'sold-stats';
    if (/\b(how many|total|count|कितने|कितनी|कुल|number of)\b.*(product|products|प्रोडक्ट|उत्पाद)/.test(q)) return 'product-count';
    if (/dashboard|डैशबोर्ड|sales|बिक्री|seller dashboard/.test(q)) return 'dashboard';
    if (/my product|my products|uploaded product|मेरे प्रोडक्ट|अपलोड.*प्रोडक्ट|product list/.test(q)) return 'products';
    if (/order|ऑर्डर|खरीदा/.test(q)) return 'orders';
    if (/upload|अपलोड|बेचना|sell a product|product कैसे/.test(q)) return 'upload';
    if (/like|लाइक|heart|पसंद/.test(q)) return 'likes';
    if (/illegal|expired|expiry|expiry date|प्रतिबंधित|एक्सपायरी|कानूनी|सुरक्षा/.test(q)) return 'safety';
    if (/python|पायथन/.test(q) && /book|books|बुक|किताब/.test(q)) return 'search:Python book';
    var directCategory = assistantCategoryFromQuestion(q);
    if (directCategory && !/(search|sarch|सर्च|खोज)/.test(q) && /(where|kahan|kaha|kidhar|dhundh|dhoondh|category|कैटेगरी|option|ऑप्शन|खोल|निकाल)/.test(q)) return 'category:' + directCategory.key;
    if (/search|sarch|सर्च|खोज|ढूँढ|ढूंढ|dhoondh|dhundh|find product|look for/.test(q)) {
      if (/(where|kahan|kaha|kidhar|कहाँ|किधर|option|ऑप्शन|search box|सर्च बॉक्स)/.test(q) && !/(what should|kya likh|क्या लिख|write|लिखूं|लिखूँ|लिखना|search for|सर्च में|सर्च कर)/.test(q)) return 'search-help';
      var term = '';
      if (/python|पायथन/.test(q) && /book|books|बुक|किताब/.test(q)) term='Python book';
      else if (/gift.?card|गिफ्ट कार्ड/.test(q)) term='gift card';
      else if (/electronic|technology|टेक्नोलॉजी|इलेक्ट्रॉनिक/.test(q)) term='electronics';
      else if (/home|house|घर|किचन|kitchen/.test(q)) term='home kitchen';
      else { term = String(raw).replace(/(search|सर्च|खोज|ढूँढ|ढूंढ|where|कहाँ|किधर|option|ऑप्शन|please|करो|करना है|कैसे|how do i|how to|find|product|प्रोडक्ट)/ig,' ').trim(); }
      return 'search:' + (term || '');
    }
    if (/category|categories|कैटेगरी|श्रेणी|option|ऑप्शन/.test(q)) {
      var c = assistantCategoryFromQuestion(q);
      if (c) return 'category:' + c.key;
      return 'open-categories';
    }
    var matched = assistantCategoryFromQuestion(q);
    if (matched && /(where|kahan|kaha|kidhar|dhundh|dhoondh|find|show|category|कैटेगरी|option|ऑप्शन|खोल|निकाल|chahiye|चाहिए)/.test(q)) return 'category:' + matched.key;
    if (/electronic|technology|टेक्नोलॉजी|इलेक्ट्रॉनिक/.test(q)) return 'electronics';
    if (/home page|homepage|होम पेज/.test(q)) return 'home';
    if (/simple|simplify|सरल|आसान भाषा|सिंपल/.test(q)) { assistantExplicitLang = assistantLang(); return 'unknown'; }
    return 'unknown';
  }
  if ($('assistant-close')) $('assistant-close').onclick = function () { assistantDialog.close(); };
  if ($('open-assistant-fab')) $('open-assistant-fab').onclick = openAssistant;
  if ($('assistant-form')) $('assistant-form').onsubmit = function (e) {
    e.preventDefault(); var input = $('assistant-input'), value = input.value.trim(); if (!value) return;
    assistantHindi = /[\u0900-\u097F]/.test(value) || /\b(kahan|kaise|mera|meri|mujhe|dikhao|kya|hai|karo|karu|chahiye)\b/i.test(value);
    assistantMessage(value, 'user'); input.value = ''; var intent = assistantIntent(value); assistantRun(intent);
  };
  if ($('assistant-quick')) $('assistant-quick').onclick = function (e) {
    var b = e.target.closest('[data-assist]'); if (!b) return;
    assistantMessage(b.textContent, 'user'); assistantRun(b.getAttribute('data-assist'));
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
  var gQuery = location.search || '';
  function showGoogleErr() {
    if (gQuery.indexOf('gerr=') < 0) return;
    try {
      authScreen('login');
      var ge = (gQuery.match(/gerr=([^&]+)/) || [])[1] || '';
      $('au-m').textContent = 'Google login failed (' + decodeURIComponent(ge) + '). Check GOOGLE_CLIENT_ID, SECRET, REDIRECT_URI match Google Console exactly.';
    } catch (e) {}
  }
  function finishAuthBoot() {
    load();
    if (me) {
      try { $('auth').hidden = true; } catch (e) {}
      try { document.body.style.overflow = ''; } catch (e) {}
      setAvatar(me);
      return;
    }
    if (gQuery.indexOf('needphone=1') >= 0) return;
    var sk = false; try { sk = sessionStorage.getItem('sgm_skip'); } catch (x) {}
    if (!sk) authScreen('login');
    showGoogleErr();
  }
  // After Google redirect ?ok=1 — force session read + clean URL
  if (location.search.indexOf('ok=1') >= 0 || location.search.indexOf('needphone=1') >= 0 || location.search.indexOf('gerr=') >= 0) {
    try { history.replaceState({}, '', '/shop'); } catch (e) {}
  }
  function readMe(retries) {
    api('/shop/api/me').then(function (d) {
      me = d && d.user ? d.user : null;
      if (!me && retries > 0 && gQuery.indexOf('ok=1') >= 0) { setTimeout(function () { readMe(retries - 1); }, 700); return; }
      setAvatar(me);
      finishAuthBoot();
    }).catch(function () {
      if (retries > 0) { setTimeout(function () { readMe(retries - 1); }, 700); return; }
      me = null; setAvatar(null); finishAuthBoot();
    });
  }
  readMe(2);

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
  function okHide() { var o = $('ok-order'); if (o) o.hidden = true; document.body.style.overflow = ''; }
  if ($('ok-close')) $('ok-close').onclick = okHide;
  if ($('ok-view')) $('ok-view').onclick = function () { okHide(); showOrders('mine'); };
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
      $('gphone-msg').textContent = '';
      jpost('/shop/api/google/complete', { phone: f.phone.value, country: f.country.value, lang: f.lang.value })
        .then(function (d) { me = d.user; try { localStorage.setItem('sgm_phone', f.phone.value); } catch (x) {} try { $('auth').hidden = true; document.body.style.overflow = ''; } catch (x) {} setAvatar(d.user); $('gphone').close(); load(); })
        .catch(function (er) { $('gphone-msg').textContent = er.message; });
    };
  }
  if ($('gphone')) $('gphone').addEventListener('cancel', function (e) { e.preventDefault(); });
  if (gQuery.indexOf('needphone=1') >= 0 && $('gphone')) {
    try { var sp = localStorage.getItem('sgm_phone'); if (sp && $('gphone-form').phone && !$('gphone-form').phone.value) $('gphone-form').phone.value = sp; } catch (x) {}
    $('gphone').showModal();
  }


  setInterval(load, 45000);
})();

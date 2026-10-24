
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
      $('co').showModal();
    });
  }
  function openGallery(p) {
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
      ck.onclick = function () { needLogin(function () {
        single = null; $('co-item').hidden = true; $('co-msg').textContent = '';
        var f = $('co-form');
        if (me) { if (!f.name.value) f.name.value = me.name || ''; if (!f.phone.value && me.phone) f.phone.value = me.phone; }
        $('cart').close(); $('co').showModal();
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
         var stats = el('div', 'am-btns'); stats.append(el('div', 'oc', 'Products · ' + d.totalProducts), el('div', 'oc', 'Units sold · ' + d.totalSold), el('div', 'oc', 'Orders · ' + d.totalOrders), el('div', 'oc', 'Likes · ' + d.totalLikes)); b.appendChild(stats);
         if (!d.products.length) { b.appendChild(el('p', 'am-empty', 'Upload a product to start your dashboard.')); return; }
         d.products.forEach(function (p) { var c = el('div', 'oc'), r = el('div', 'ci'), im = el('img'); im.src = p.img; im.alt = p.title; r.append(im, el('div', '', p.title), el('b', '', money(p.price, p.currency))); c.appendChild(r); c.appendChild(el('div', 'am-s', 'Units sold: ' + p.unitsSold + ' · Likes: ♥ ' + p.likes)); if (!p.orders.length) c.appendChild(el('p', 'am-note', 'No purchases yet.')); p.orders.forEach(function (o) { c.appendChild(el('div', 'am-s', o.qty + ' item(s) · ' + (o.city || 'City not provided') + (o.state ? ', ' + o.state : '') + ', ' + o.country + ' · ' + o.status + ' · ' + new Date(o.createdAt).toLocaleDateString())); }); b.appendChild(c); });
       }).catch(function (e) { $('ord-body').textContent = e.message; });
     }],
     ['Language / Country', '🌐', 'language', function () {
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
      var desc = {orders:'Track purchases and delivery updates',products:'View products you have uploaded',dashboard:'Sales, likes and buyer locations',language:'Choose your language and country',help:'Learn how to use the marketplace',signout:'Securely sign out of this account'}[x[2]];
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
  $('co-close').onclick = function () { single = null; $('co').close(); };
  $('co-form').onsubmit = function (e) {
    e.preventDefault();
    var f = e.target, m = $('co-msg');
    m.textContent = 'Placing order…';
    var items = single || Object.keys(cart).map(function (id) { return { id: id, qty: cart[id] }; });
    if (!items.length) { m.textContent = 'Your cart is empty.'; return; }
    jpost('/shop/api/orders', {
      name: f.name.value, phone: f.phone.value, address: f.address.value,
      city: f.city.value, state: f.state.value, pincode: f.pincode.value, country: f.country.value, items: items
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

  // Photo: white background + studio look
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
  // ---- 4 more photos from the SAME product pixels (angle / close-up / reflection / lifestyle backdrop) ----
  function toBlob(cv) { return new Promise(function (res) { cv.toBlob(res, 'image/jpeg', 0.82); }); }
  function filt(x, extra) { if ('filter' in x) x.filter = 'contrast(1.06) saturate(1.1) brightness(1.03)' + (extra || ''); }
  function variants(r) {
    var S = 640, c = r.cut, bx = r.box[0], by = r.box[1], bw = r.box[2], bh = r.box[3], real = r.removed, outs = [];
    function canvas() { var k = cvs(S, S); return { k: k, x: k.getContext('2d') }; }
    function put(x, sx, sy, sw, sh, cx, cy, maxW, maxH, deg, shadow) {
      var f = Math.min(maxW / sw, maxH / sh), dw = sw * f, dh = sh * f;
      x.save(); x.translate(cx, cy); x.rotate(deg * Math.PI / 180);
      if (shadow && real) { x.shadowColor = 'rgba(0,0,0,.28)'; x.shadowBlur = 26; x.shadowOffsetY = 16; }
      filt(x); x.drawImage(c, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh); x.restore();
    }
    // 1) tilted
    var a = canvas(); a.x.fillStyle = '#fff'; a.x.fillRect(0, 0, S, S);
    put(a.x, bx, by, bw, bh, S / 2, S / 2, 430, 430, 15, true); outs.push(a.k);
    // 2) close-up of the top / front detail
    var b = canvas(); b.x.fillStyle = '#fff'; b.x.fillRect(0, 0, S, S);
    var cw = bw * 0.82, ch = bh * 0.46;
    put(b.x, bx + (bw - cw) / 2, by, cw, ch, S / 2, S / 2, 580, 580, 0, true); outs.push(b.k);
    // 3) soft grey studio backdrop + floor reflection
    var d = canvas(), g = d.x.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#f8f8fa'); g.addColorStop(0.62, '#e4e6ec'); g.addColorStop(1, '#cfd2da');
    d.x.fillStyle = g; d.x.fillRect(0, 0, S, S);
    var f3 = Math.min(400 / bw, 400 / bh), w3 = bw * f3, h3 = bh * f3, top3 = (S - h3) / 2 - 30;
    var rc = cvs(S, S), rx = rc.getContext('2d');
    rx.save(); rx.translate(0, top3 + h3 * 2); rx.scale(1, -1); filt(rx);
    rx.drawImage(c, bx, by, bw, bh, (S - w3) / 2, top3, w3, h3); rx.restore();
    rx.globalCompositeOperation = 'destination-in';
    var mg = rx.createLinearGradient(0, top3 + h3, 0, top3 + h3 + h3 * 0.5);
    mg.addColorStop(0, 'rgba(0,0,0,.35)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
    rx.fillStyle = mg; rx.fillRect(0, top3 + h3, S, h3 * 0.5);
    d.x.drawImage(rc, 0, 0);
    if (real) { d.x.fillStyle = 'rgba(0,0,0,.12)'; d.x.beginPath(); d.x.ellipse(S / 2, top3 + h3 + 4, w3 * 0.5, 9, 0, 0, 7); d.x.fill(); }
    filt(d.x); d.x.drawImage(c, bx, by, bw, bh, (S - w3) / 2, top3, w3, h3);
    outs.push(d.k);
    // 4) warm lifestyle backdrop with spotlight disc, slight angle
    var e = canvas(), rg = e.x.createRadialGradient(S / 2, S * 0.45, 40, S / 2, S / 2, S * 0.75);
    rg.addColorStop(0, '#fff6ee'); rg.addColorStop(1, '#ffd9b8');
    e.x.fillStyle = rg; e.x.fillRect(0, 0, S, S);
    e.x.fillStyle = 'rgba(255,255,255,.65)'; e.x.beginPath(); e.x.arc(S / 2, S * 0.5, 235, 0, 7); e.x.fill();
    put(e.x, bx, by, bw, bh, S / 2, S * 0.5, 360, 360, -9, true); outs.push(e.k);
    return Promise.all(outs.map(toBlob));
  }
  var file = null;
  function run() {
    if (!file) return;
    $('proc').textContent = 'Processing photo…'; extras = []; prepping = true;
    if ($('prev-strip')) { $('prev-strip').hidden = true; $('prev-strip').textContent = ''; }
    loadImg(file).then(function (img) { return studio(img, $('rm').checked); }).then(function (r) {
      blob = r.blob; extras = [];
      var p = $('prev'); p.src = URL.createObjectURL(blob); p.hidden = false;
      $('prev-t').hidden = true;
      $('proc').textContent = !$('rm').checked ? 'Original background kept.' :
        r.removed ? 'White background ✓ · studio look ready' + (r.turned ? ' · straightened' : '') :
        'Could not separate background. Use plain lit background.';
      return variants(r).catch(function () { return []; }).then(function (arr) {
        extras = arr; prepping = false;
        var st = $('prev-strip'); if (st) {
          st.textContent = '';
          [blob].concat(arr).forEach(function (bb) { var t = el('img'); t.src = URL.createObjectURL(bb); t.alt = ''; st.appendChild(t); });
          st.hidden = false;
        }
        $('proc').textContent += ' · 5 photos auto-created ✓';
      });
    }).catch(function () { prepping = false; $('proc').textContent = 'Could not read this photo.'; blob = null; });
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
      form.reset(); blob = null; file = null; extras = [];
      if ($('prev-strip')) { $('prev-strip').hidden = true; $('prev-strip').textContent = ''; }
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

  // API-free, deterministic in-app guide. It navigates to real existing app controls.
  var assistantDialog = $('ai-assistant'), assistantHindi = false;
  function assistantSay(en, hi, who) { assistantMessage(assistantHindi && hi ? hi : en, who || 'assistant'); }
  function assistantMessage(text, who) {
    var chat = $('assistant-chat'); if (!chat) return;
    var row = el('div', 'assistant-message ' + (who === 'user' ? 'from-user' : 'from-assistant'), text);
    chat.appendChild(row); chat.scrollTop = chat.scrollHeight;
  }
  function assistantAction(label, command) {
    var b = el('button', 'assistant-action', label); b.type = 'button';
    b.onclick = function () { assistantRun(command); };
    $('assistant-chat').appendChild(b);
  }
  function assistantRun(command) {
    var chat = $('assistant-chat'); if (!chat) return;
    if (command === 'dashboard' || command === 'products' || command === 'orders') {
      if (!me) { assistantMessage('Please sign in first. Then open Profile and choose the requested section.', 'assistant'); assistantAction('Sign in', 'signin'); return; }
      assistantSay(command === 'dashboard' ? 'Open your sales, orders, product likes and available buyer-location details here.' : command === 'products' ? 'Here you can see the products you have uploaded.' : 'Here you can see orders you have placed.', command === 'dashboard' ? 'यहाँ आपके प्रोडक्ट की बिक्री, ऑर्डर, लाइक्स और उपलब्ध खरीदार-लोकेशन की जानकारी मिलेगी।' : command === 'products' ? 'यहाँ आपके अपलोड किए हुए प्रोडक्ट दिखेंगे।' : 'यहाँ आपके किए हुए ऑर्डर दिखेंगे।');
      if (command === 'dashboard') assistantAction('Open My Product Dashboard', 'go-dashboard');
      if (command === 'products') assistantAction('Open My Product', 'go-products');
      if (command === 'orders') assistantAction('Open My orders', 'go-orders');
      return;
    }
    if (command === 'go-dashboard' || command === 'go-products' || command === 'go-orders') {
      assistantDialog.close(); accView();
      var key = command === 'go-dashboard' ? 'dashboard' : command === 'go-products' ? 'products' : 'orders';
      var target = document.querySelector('[data-profile-action="' + key + '"]'); if (target) target.click(); return;
    }
    if (command === 'signin') { assistantDialog.close(); authScreen('login'); return; }
    if (command === 'electronics') {
      assistantSay('Tap Electronics in Categories to filter the catalogue. I can take you there now.', 'कैटेगरी में Electronics चुनें। मैं अभी आपको उस कैटेगरी पर ले जा सकता हूँ।');
      assistantAction('Show Electronics', 'go-electronics'); return;
    }
    if (command === 'go-electronics') {
      assistantDialog.close(); cat = 'Electronics'; tabs(); render();
      Array.prototype.forEach.call(document.querySelectorAll('#cat-list [data-c]'), function (x) { x.classList.toggle('on', x.getAttribute('data-c') === 'Electronics'); });
      return;
    }
    if (command === 'upload') {
      assistantSay('To upload: tap the orange + button, choose Camera or Gallery, add a clear photo, enter the product name, price, category and seller details, then tap Post product. Never upload illegal or prohibited goods, expired products, counterfeit goods, or anything you are not legally allowed to sell.', 'प्रोडक्ट अपलोड करने के लिए नारंगी + बटन दबाएँ, Camera या Gallery चुनें, साफ़ फोटो जोड़ें, नाम, कीमत, कैटेगरी और विक्रेता की जानकारी भरें, फिर Post product दबाएँ। गैरकानूनी या प्रतिबंधित सामान, एक्सपायरी सामान और नकली सामान कभी अपलोड न करें।');
      assistantAction('Open product upload', 'go-upload'); return;
    }
    if (command === 'go-upload') { assistantDialog.close(); if (!me) { needLogin(function () { prefill(); dlg.showModal(); }); } else { prefill(); dlg.showModal(); } return; }
    if (command === 'likes') {
      assistantSay('On a product card, tap the heart/Like control if it is available. Your own product dashboard shows the likes recorded for your products.', 'प्रोडक्ट कार्ड पर Heart/Like बटन उपलब्ध हो तो उसे दबाएँ। आपके अपने प्रोडक्ट के लाइक्स My Product Dashboard में दिखेंगे।');
      assistantAction('Open My Product Dashboard', 'dashboard'); return;
    }
    if (command === 'home') { assistantMessage('You are on the marketplace. Tap Home in the bottom navigation to return to all products.', 'assistant'); assistantAction('Go to Home', 'go-home'); return; }
    if (command === 'go-home') { assistantDialog.close(); cat = 'All'; tabs(); render(); window.scrollTo({top:0,behavior:'smooth'}); return; }
    if (command === 'safety') { assistantSay('Safety rules: do not list illegal or restricted goods, expired products, counterfeit items, stolen goods, or products that may harm customers. Follow your local laws and the marketplace rules. Expired goods must never be listed.', 'सुरक्षा नियम: गैरकानूनी या प्रतिबंधित सामान, एक्सपायरी प्रोडक्ट, नकली या चोरी का सामान, या ग्राहकों को नुकसान पहुँचा सकने वाली चीज़ें अपलोड न करें। स्थानीय कानून और मार्केटप्लेस के नियम मानें। एक्सपायरी सामान कभी लिस्ट न करें।'); return; }
    if (command === 'hello') { assistantSay('Hi! 👋 I can help you find pages and use Stratic Market. Try asking about your dashboard, product upload, electronics, likes or orders.', 'नमस्ते! 👋 मैं Stratic Market इस्तेमाल करने में मदद कर सकता हूँ। डैशबोर्ड, प्रोडक्ट अपलोड, इलेक्ट्रॉनिक्स, लाइक्स या ऑर्डर के बारे में पूछें।'); return; }
    assistantSay('I’m the Stratic Market guide, so I can help with this app rather than general world knowledge. You can ask me where to find your dashboard, how to upload products, how to find electronics, how likes work, or how to check orders.', 'मैं Stratic Market का गाइड हूँ, इसलिए इस ऐप के इस्तेमाल में मदद कर सकता हूँ, सामान्य दुनिया की जानकारी में नहीं। डैशबोर्ड, प्रोडक्ट अपलोड, इलेक्ट्रॉनिक्स, लाइक्स या ऑर्डर के बारे में पूछें।');
    assistantAction('My Product Dashboard', 'dashboard'); assistantAction('How to upload a product', 'upload'); assistantAction('Find electronics', 'electronics');
  }
  function openAssistant() {
    if (!assistantDialog) return;
    if (!assistantDialog.open) assistantDialog.showModal();
    if (!$('assistant-chat').children.length) assistantMessage('Hi! I can guide you around Stratic Market. What would you like to do?', 'assistant');
    $('assistant-input').focus();
  }
  function assistantIntent(raw) {
    var q = String(raw || '').toLowerCase();
    if (/^(hi|hello|hey|namaste|नमस्ते|हेलो)\b/.test(q)) return 'hello';
    if (/dashboard|डैशबोर्ड|sales|बिक्री|seller dashboard/.test(q)) return 'dashboard';
    if (/my product|my products|uploaded product|मेरे प्रोडक्ट|अपलोड.*प्रोडक्ट|product list/.test(q)) return 'products';
    if (/order|ऑर्डर|खरीदा/.test(q)) return 'orders';
    if (/upload|अपलोड|बेचना|sell a product|product कैसे/.test(q)) return 'upload';
    if (/electronic|technology|टेक्नोलॉजी|इलेक्ट्रॉनिक/.test(q)) return 'electronics';
    if (/like|लाइक|heart|पसंद/.test(q)) return 'likes';
    if (/illegal|expired|expiry|expiry date|प्रतिबंधित|एक्सपायरी|कानूनी|सुरक्षा/.test(q)) return 'safety';
    if (/home page|homepage|होम पेज|घर/.test(q)) return 'home';
    return 'unknown';
  }
  if ($('assistant-close')) $('assistant-close').onclick = function () { assistantDialog.close(); };
  if ($('open-assistant-fab')) $('open-assistant-fab').onclick = openAssistant;
  if ($('assistant-form')) $('assistant-form').onsubmit = function (e) {
    e.preventDefault(); var input = $('assistant-input'), value = input.value.trim(); if (!value) return;
    assistantHindi = /[\u0900-\u097F]/.test(value) || /\b(kahan|kaise|mera|meri|mujhe|dikhao|kya|hai|karo|karu|chahiye)\b/i.test(value);
    assistantMessage(value, 'user'); input.value = ''; assistantRun(assistantIntent(value));
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
      jpost('/shop/api/google/complete', { phone: f.phone.value, country: f.country.value, lang: f.lang.value })
        .then(function (d) { me = d.user; setAvatar(d.user); $('gphone').close(); load(); })
        .catch(function (er) { $('gphone-msg').textContent = er.message; });
    };
  }
  if (gQuery.indexOf('needphone=1') >= 0 && $('gphone')) $('gphone').showModal();


  setInterval(load, 45000);
})();

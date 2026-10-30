const express = require('express');
const path = require('path');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const store = require('../services/shop-store');
const { notifyOrder } = require('../services/brevo');
const { bcrypt, setSession, clearSession, attachUser, requireUser, csrf } = require('../services/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });
const pick = upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'extra', maxCount: 11 }, { name: 'qr', maxCount: 1 }]);
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 150, standardHeaders: true, legacyHeaders: false });
const ADMIN_PASS = String(process.env.ADMIN_PASSWORD || '').trim();

function clean(s, n) {
  return String(s || '').trim().slice(0, n || 200);
}

function userOut(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone || '',
    country: u.country || 'IN',
    lang: u.lang || 'en',
  };
}

router.use(async (req, res, next) => {
  // Anonymous device id: one view per device, never repeated.
  {
    let dev = readCookies(req).sgm_dev;
    if (!/^[a-f0-9]{16,32}$/.test(String(dev || ''))) {
      dev = require('crypto').randomBytes(12).toString('hex');
      res.cookie('sgm_dev', dev, {
        httpOnly: true, sameSite: 'lax', path: '/',
        secure: process.env.NODE_ENV === 'production' || process.env.RENDER === 'true',
        maxAge: 730 * 24 * 3600 * 1000,
      });
    }
    req.devId = dev;
  }
  await new Promise((r) => attachUser(req, res, r));
  if (!req.user && req.cookies && req.cookies.sgm_uid) {
    const u = store.findAccountById(req.cookies.sgm_uid);
    if (u) req.user = { id: u.id, name: u.name, email: u.email, phone: u.phone, country: u.country, lang: u.lang };
  }
  if (req.user) {
    try { store.touchAccount(req.user.id); } catch (e) {}
    const full = store.findAccountById(req.user.id);
    if (full) req.user = { id: full.id, name: full.name, email: full.email, phone: full.phone, country: full.country, lang: full.lang };
  }
  // For successful write APIs, wait until queued database writes are confirmed before
  // sending success to the client. This covers accounts, listings, edits, orders and status changes.
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && String(req.path || '').startsWith('/api/')) {
    const sendJson = res.json.bind(res);
    let persistenceCheckStarted = false;
    res.json = function (body) {
      if (res.statusCode >= 400) return sendJson(body);
      if (persistenceCheckStarted) return res;
      persistenceCheckStarted = true;
      store.flushPendingWrites().then(() => sendJson(body)).catch((e) => {
        console.error('API write response blocked because cloud persistence was not confirmed:', e.message);
        if (!res.headersSent) {
          res.status(503);
          sendJson({ error: 'Cloud saving could not be confirmed. Do not repeat this action blindly; refresh and check your account, product or order first.' });
        }
      });
      return res;
    };
  }
  next();
});

router.get('/', (req, res) => {
  // Each device is counted only once (owner opens included).
  store.recordVisit(req.devId);
  res.render('shop', { title: 'Stratic Market' });
});

router.get('/img/:id', async (req, res) => {
  // Payment QR images are private: never serve them from the public product-image URL.
  if (req.query.i === 'q') return res.status(404).end();
  const i = Number(req.query.i) || 0;
  const remoteName = i > 0 ? String(req.params.id).replace(/[^a-f0-9]/gi, '') + '_' + i : String(req.params.id).replace(/[^a-f0-9]/gi, '');
  let fp = store.imagePath(req.params.id, i);
  try {
    // Prefer our own durable database/local copy. Do not make a third-party CDN
    // the single point of failure for a seller's product image.
    if (!require('fs').existsSync(fp)) {
      const nm = require('path').basename(fp, '.jpg');
      fp = await store.ensureImage(nm);
    }
  } catch (e) { fp = null; }
  if (!fp) {
    try { fp = await store.restoreImageFromRemote(remoteName); } catch (e) { fp = null; }
  }
  if (fp) {
    res.set('Cache-Control', 'public, max-age=86400');
    return res.sendFile(fp, (err) => { if (err && !res.headersSent) res.status(404).end(); });
  }
  // Last-resort redirect only if the legacy remote object cannot be restored.
  const remoteUrl = store.remoteImageUrl(remoteName);
  if (remoteUrl && /^https:\/\//i.test(remoteUrl)) {
    res.set('Cache-Control', 'public, max-age=300');
    return res.redirect(302, remoteUrl);
  }
  return res.status(404).end();
});

// Public order-info page opened by scanning the shipping-label QR (read-only, no payment, no login).
function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
router.get('/l/:ref', (req, res) => {
  const ref = String(req.params.ref || '').toUpperCase().replace(/^#/, '');
  res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
  const o = /^ST-[A-Z0-9]{6,32}$/.test(ref) ? store.listOrders().find((x) => String(x.ref).toUpperCase() === ref) : null;
  const css = 'body{margin:0;background:#f4f4f5;font:16px/1.45 Arial,sans-serif;color:#111}.w{max-width:520px;margin:0 auto;padding:14px}.c{background:#fff;border:3px solid #000;border-radius:6px;padding:18px}h1{margin:0;font-size:26px;letter-spacing:.5px}.s{font-size:12px;margin:2px 0 10px}hr{border:0;border-top:3px solid #000;margin:10px 0}.r{margin:8px 0}.r b{display:inline-block;min-width:92px}.x{background:#b00020;color:#fff;padding:8px 10px;border-radius:4px;font-weight:700;margin:8px 0}.m{font-size:13px;color:#555}a{color:#d35400;font-weight:700}';
  const page = (body) => res.status(o ? 200 : 404).send('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Stratic Market · Order</title><style>' + css + '</style></head><body><div class="w"><div class="c"><h1>STRATIC MARKET</h1><div class="s">ORDER DETAILS · DELIVERY INFO</div><hr>' + body + '</div></div></body></html>');
  if (!o) return page('<div class="r">Order not found. Please check the label.</div>');
  const st = String(o.status || 'CONFIRMED').toUpperCase();
  const addr = [o.address, o.city, o.district, o.state, o.pincode, o.country].filter(Boolean).join(', ');
  const items = (o.items || []).map((i) => {
    const specs = [];
    if (i.packedWeightGrams) specs.push('Packed weight: ' + esc(i.packedWeightGrams) + ' g');
    if (i.packageLengthCm) specs.push('Length: ' + esc(i.packageLengthCm) + ' cm');
    if (i.packageWidthCm) specs.push('Width: ' + esc(i.packageWidthCm) + ' cm');
    if (i.packageHeightCm) specs.push('Height: ' + esc(i.packageHeightCm) + ' cm');
    return '<div class="r">' + esc(i.qty || 1) + ' × ' + esc(i.title) + '<br><span class="m">Product ID: PID-' + esc(String(i.id || '').slice(0, 10).toUpperCase()) + (specs.length ? '<br>' + specs.join(' · ') : '') + '</span></div>';
  }).join('');
  const cod = (o.paymentMethod || 'COD') !== 'ONLINE';
  const phone = String(o.phone || '').replace(/[^\d+]/g, '');
  const sphone = String(o.sellerPhone || '').replace(/[^\d+]/g, '');
  page(
    (st === 'CANCELLED' ? '<div class="x">CANCELLED — DO NOT DELIVER</div>' : '') +
    '<div class="r"><b>Order ID:</b> #' + esc(o.ref) + '</div>' +
    '<div class="r"><b>Status:</b> ' + esc(st) + '</div>' +
    '<div class="r"><b>Customer:</b> ' + esc(o.name) + '</div>' +
    '<div class="r"><b>Phone:</b> <a href="tel:' + esc(phone) + '">' + esc(o.phone) + '</a></div>' +
    '<div class="r"><b>Deliver to:</b> ' + esc(addr) + '</div><hr>' +
    '<div class="r"><b>Seller:</b> ' + esc(o.sellerShop) + (sphone ? ' · <a href="tel:' + esc(sphone) + '">' + esc(o.sellerPhone) + '</a>' : '') + '</div>' +
    '<div class="r"><b>Items:</b></div>' + items + '<hr>' +
    '<div class="r"><b>Payment:</b> ' + (cod ? 'Cash on Delivery' : 'Online payment (paid)') + '</div>' +
    (cod ? '<div class="r"><b>Collect:</b> ' + esc(o.currency || 'INR') + ' ' + esc(o.total) + '</div>' : '<div class="r"><b>Collect:</b> Nothing (already paid)</div>') +
    '<div class="m" style="margin-top:12px">Stratic Market · Order reference only · This is not a payment page.</div>'
  );
});

// Public, read-only order tracking for buyers (no phone/address shown). Opened from "My orders" or by typing the Order ID.
router.get('/track', (req, res) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
  const raw = String(req.query.ref || '').trim().toUpperCase().replace(/^#/, '').replace(/\s/g, '');
  const o = /^ST-[A-Z0-9]{6,32}$/.test(raw) ? store.listOrders().find((x) => String(x.ref).toUpperCase() === raw) : null;
  const css = 'body{margin:0;background:#f4f4f5;font:16px/1.45 Arial,sans-serif;color:#111}.w{max-width:520px;margin:0 auto;padding:14px}.c{background:#fff;border-radius:14px;padding:18px;box-shadow:0 2px 12px rgba(0,0,0,.08)}h1{margin:0 0 4px;font-size:22px}.m{font-size:13px;color:#666}form{display:flex;gap:8px;margin:12px 0}input{flex:1;padding:12px;border:1px solid #ccc;border-radius:10px;font-size:16px}button{padding:12px 16px;border:0;border-radius:10px;background:#ff6a00;color:#fff;font-weight:700;font-size:16px}.t{margin:16px 0 6px}.t div{display:flex;align-items:center;gap:10px;margin:0 0 14px;color:#999}.t i{width:20px;height:20px;border-radius:50%;background:#ddd;display:inline-block;flex:none}.t .on{color:#111;font-weight:700}.t .on i{background:#16a34a}.x{background:#b00020;color:#fff;padding:10px;border-radius:8px;font-weight:700;margin:10px 0}.p{background:#fff7ed;color:#9a3412;padding:10px;border-radius:8px;margin:10px 0}.tr{background:#f0fdf4;color:#166534;padding:10px;border-radius:8px;margin-top:12px;font-size:14px}';
  const form = '<form method="get" action="/shop/track"><input name="ref" placeholder="Order ID  e.g. ST-1234ABCD" value="' + esc(raw) + '" autocomplete="off"><button type="submit">Track</button></form>';
  let body;
  if (!raw) body = '<div class="m">Enter your Order ID to see where your order is.</div>';
  else if (!o) body = '<div class="p">Order not found. Please check the Order ID.</div>';
  else {
    const st = String(o.status || 'CONFIRMED').toUpperCase();
    const steps = ['CONFIRMED', 'SHIPPED', 'DELIVERED'], at = steps.indexOf(st);
    const when = new Date(o.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    const delivered = store.listOrders({ sellerId: o.sellerId }).filter((x) => String(x.status).toUpperCase() === 'DELIVERED').length;
    body = '<div><b>Order #' + esc(o.ref) + '</b><div class="m">Placed ' + esc(when) + ' IST</div></div>' +
      (o.items || []).map((i) => '<div style="margin-top:8px">' + esc(i.qty || 1) + ' × ' + esc(i.title) + '</div>').join('') +
      (st === 'CANCELLED' ? '<div class="x">This order was cancelled' + (o.cancelReason ? ': ' + esc(o.cancelReason) : '') + '</div>'
        : st === 'PAYMENT_PENDING' ? '<div class="p">Waiting for payment confirmation. We confirm your order as soon as the payment is received.</div>'
        : '<div class="t">' + [['Order confirmed', 0, o.confirmedAt || o.createdAt], ['Marked shipped by seller', 1, o.shippedAt], ['Marked delivered by seller', 2, o.deliveredAt]].map((a) => '<div class="' + (at >= a[1] ? 'on' : '') + '"><i></i><span>' + a[0] + (at >= a[1] && a[2] ? '<br><span class="m">' + esc(new Date(a[2]).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })) + ' IST</span>' : '') + '</span></div>').join('') + '</div>') +
      '<div class="tr">Sold by <b>' + esc(o.sellerShop) + '</b>' + (delivered ? ' · ' + delivered + ' order' + (delivered > 1 ? 's' : '') + ' marked delivered by this seller' : '') + '</div>';
  }
  res.send('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Track order · Stratic Market</title><style>' + css + '</style></head><body><div class="w"><div class="c"><h1>📦 Track your order</h1><div class="m">Stratic Market</div>' + form + body + '</div></div></body></html>');
});

router.get('/api/products/:id/payment-qr', requireUser, async (req, res) => {
  const p = store.getProduct(req.params.id);
  if (!p || !p.hasQr || p.sellerId === req.user.id) return res.status(404).end();
  // Always this product's own QR (file name = this product's id). Order: local file -> our database
  // (restored after a Render restart) -> old outside-host copy fetched by the server. Never a redirect.
  const qrName = String(p.id).replace(/[^a-f0-9]/gi, '') + '_q';
  let fp = store.imagePath(p.id, 'q');
  try {
    if (!require('fs').existsSync(fp)) fp = await store.ensureImage(qrName);
    if (!fp) fp = await store.restoreImageFromRemote(qrName);
  } catch (e) { fp = null; }
  if (!fp) return res.status(404).end();
  res.set('Cache-Control', 'private, no-store, max-age=0');
  res.set('X-Content-Type-Options', 'nosniff');
  res.type('image/jpeg');
  res.sendFile(fp, (err) => { if (err && !res.headersSent) res.status(404).end(); });
});

// One product by id (used when someone opens a shared product / shop link).
router.get('/api/product/:id', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const p = store.getProduct(String(req.params.id || '').replace(/[^a-f0-9]/gi, ''));
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  res.json({ product: pview(p, req.user) });
});

// Seller's own shop link (to share on WhatsApp / Instagram).
router.get('/api/my-shop', requireUser, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const mine = store.listAllProducts().filter((p) => p.sellerId === req.user.id);
  const acc = store.findAccountById(req.user.id);
  const nm = String((acc && acc.name) || (mine[0] && mine[0].shopName) || req.user.name || 'Shop').trim();
  const slug = (nm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'shop') + '-' + String(req.user.id).replace(/[^a-f0-9]/gi, '');
  res.json({ url: req.protocol + '://' + req.get('host') + '/shop/s/' + slug, name: nm, count: mine.length });
});

// Public shop page for one seller. Everyone sees the shop; only the logged-in owner also sees the private dashboard.
router.get('/s/:slug', (req, res) => {
  // Forgiving link reading: a copied share text may carry extra words / a second copy of the link.
  const token = String(req.params.slug || '').trim().split(/[\s%]/)[0];
  const m = token.match(/([a-f0-9]{16})$/i);
  const sid = m ? m[1].toLowerCase() : '';
  const acct = sid ? store.findAccountById(sid) : null;
  const list = sid ? store.listProducts(null).filter((p) => String(p.sellerId).toLowerCase() === sid) : [];
  res.set({ 'Cache-Control': 'no-store' });
  const css = '*{box-sizing:border-box}body{margin:0;background:#f6f4f0;font:15px/1.45 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#17140f;overflow-x:hidden}.hd{position:relative;overflow:hidden;background:radial-gradient(circle at 20% 0,#5a2d7a 0,transparent 55%),linear-gradient(135deg,#150d27,#2f1a47 55%,#7a3b16);color:#fff;padding:34px 18px 28px;text-align:center}.hd small{letter-spacing:.22em;color:#f3c76a;font-size:11px;font-weight:700}.crown{font-size:38px;margin-top:6px;animation:pop .9s ease both}.hd h1{margin:6px 0 4px;font-size:clamp(30px,9vw,46px);line-height:1.1;background:linear-gradient(90deg,#fff2c4,#f3c76a,#fff2c4);-webkit-background-clip:text;background-clip:text;color:transparent;animation:pop .9s .1s ease both}.hd p{margin:3px 0;color:#e6dff0;font-size:14px}.bd{display:inline-block;margin-top:12px;padding:6px 14px;border-radius:99px;background:rgba(243,199,106,.16);border:1px solid #f3c76a;color:#f3c76a;font-size:12px;font-weight:700}.party{margin-top:14px;font-size:18px;font-weight:800;color:#fff;animation:pop 1s .3s ease both}.cf{position:absolute;top:-14px;width:9px;height:14px;border-radius:2px;opacity:0;animation:fall 4.2s linear forwards}@keyframes fall{0%{opacity:1;transform:translateY(0) rotate(0)}100%{opacity:0;transform:translateY(420px) rotate(560deg)}}@keyframes pop{0%{opacity:0;transform:scale(.6) translateY(10px)}100%{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){.cf{display:none}*{animation:none!important}}.w{max-width:780px;margin:0 auto;padding:14px}.act{display:flex;gap:10px;margin:0 0 14px}.act a{flex:1;text-align:center;padding:13px;border-radius:999px;font-weight:700;text-decoration:none;font-size:14px}.wa{background:#1fa855;color:#fff}.op{background:#ff6a00;color:#fff}.dash{background:#fff;border-radius:18px;padding:16px;margin:0 0 16px;box-shadow:0 4px 18px rgba(0,0,0,.07);border:1px solid #efe6d6}.dash h2{margin:0 0 4px;font-size:18px}.dash .sub{color:#6b6257;font-size:13px;margin:0 0 12px}.st{display:grid;grid-template-columns:1fr 1fr;gap:10px}.st div{background:linear-gradient(180deg,#fffaf0,#fff);border:1px solid #f0e4c8;border-radius:14px;padding:12px}.st b{display:block;font-size:22px}.st span{font-size:12px;color:#6b6257}.bars{display:flex;align-items:flex-end;gap:8px;height:92px;margin:14px 0 4px}.bars i{flex:1;background:linear-gradient(180deg,#f3c76a,#e08a1e);border-radius:6px 6px 2px 2px;min-height:3px}.bl{display:flex;gap:8px;font-size:11px;color:#6b6257}.bl span{flex:1;text-align:center}.hint{font-size:12px;color:#8a7f70;margin-top:10px}.sec{font-size:18px;font-weight:800;margin:6px 2px 10px}.g{display:grid;grid-template-columns:1fr 1fr;gap:12px}.c{background:#fff;border-radius:14px;overflow:hidden;text-decoration:none;color:inherit;box-shadow:0 2px 10px rgba(0,0,0,.06)}.c img{width:100%;aspect-ratio:1/1;object-fit:contain;background:#fff;display:block}.c .i{padding:10px 12px 12px}.t{font-size:13px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:34px}.p{font-weight:800;font-size:17px;margin-top:4px}.p s{font-weight:400;font-size:12px;color:#777;margin-left:6px}.ms{font-size:11px;color:#6b6257;margin-top:5px}.f{text-align:center;color:#777;font-size:12px;padding:22px 10px}.login{display:block;text-align:center;margin:0 0 14px;font-size:13px;color:#6b6257}.login a{color:#d35400;font-weight:700}';
  const page = (code, inner, title) => res.status(code).send('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escH(title) + '</title><meta property="og:title" content="' + escH(title) + '"><meta property="og:description" content="Shop directly from the seller on Stratic Market. 0% commission."><style>' + css + '</style></head><body>' + inner + '<script src="/static/js/shop-page.js"></script></body></html>');
  if (!acct && !list.length) return page(404, '<div class="hd"><small>STRATIC MARKET</small><h1>Shop not found</h1><p>Please check the shop link.</p></div><div class="w"><div class="act"><a class="op" href="/shop">Open Stratic Market</a></div></div>', 'Shop · Stratic Market');
  const first = list[0] || {};
  const ownerName = String((acct && acct.name) || first.shopName || 'Seller').trim() || 'Seller';
  const isOwner = !!(req.user && String(req.user.id).toLowerCase() === sid);
  const city = first.city || '';
  const phone = String((acct && acct.phone) || first.sellerPhone || '').replace(/\D/g, '');
  const waNum = phone.length >= 10 ? (phone.length === 10 ? '91' + phone : phone) : '';
  const waText = 'Hi, I saw your shop "' + ownerName + '" on Stratic Market.';
  const colors = ['#f3c76a', '#ff6a00', '#8b5cf6', '#22c55e', '#ec4899', '#38bdf8'];
  const confetti = Array.from({ length: 34 }, (_, i) => '<span class="cf" style="left:' + ((i * 29) % 100) + '%;background:' + colors[i % colors.length] + ';animation-delay:' + ((i % 9) * 0.18).toFixed(2) + 's"></span>').join('');
  const hero = '<div class="hd">' + confetti + '<small>STRATIC MARKET</small><div class="crown">\ud83d\udc51</div><h1>' + escH(ownerName) + '</h1><p>' + (isOwner ? 'Your very own shop' : 'Official shop') + (city ? ' \u00b7 \ud83d\udccd ' + escH(city) : '') + '</p><span class="bd">0% commission \u00b7 Pay the seller directly</span>' + (isOwner ? '<div class="party">\ud83c\udf89 Congratulations ' + escH(ownerName) + '! This is YOUR shop \ud83c\udf89</div>' : '') + '</div>';

  let dash = '';
  if (isOwner) {
    const orders = store.listSellerPaymentOrders(sid);
    const dead = (o) => String(o.status || '').toUpperCase() === 'CANCELLED';
    const pend = (o) => String(o.status || '').toUpperCase() === 'PAYMENT_PENDING';
    const good = orders.filter((o) => !dead(o) && !pend(o));
    const sales = good.filter((o) => (o.currency || 'INR') === 'INR').reduce((a, o) => a + (Number(o.itemsTotal != null ? o.itemsTotal : o.total) || 0), 0);
    const views = list.reduce((n, p) => n + (store.productViewCount(p.id) || 0), 0);
    const likes = list.reduce((n, p) => n + (store.productLikeInfo(p.id, null).count || 0), 0);
    const days = [];
    for (let k = 6; k >= 0; k--) { const d = new Date(Date.now() - k * 864e5); days.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' }), n: 0 }); }
    good.forEach((o) => { const d = days.find((x) => x.key === String(o.createdAt || '').slice(0, 10)); if (d) d.n++; });
    const mx = Math.max(1, ...days.map((d) => d.n));
    dash = '<div class="dash"><h2>\ud83d\udcca Your shop at a glance</h2><p class="sub">Only you can see this. Real numbers from your shop.</p><div class="st">' +
      '<div><b>\u20b9' + escH(sales) + '</b><span>Total sales (confirmed orders)</span></div>' +
      '<div><b>' + good.length + '</b><span>Confirmed orders</span></div>' +
      '<div><b>' + views + '</b><span>\ud83d\udc41 Product views</span></div>' +
      '<div><b>' + likes + '</b><span>\u2665 Likes</span></div>' +
      '<div><b>' + orders.filter((o) => pend(o) && o.paymentMethod === 'ONLINE').length + '</b><span>\u23f3 Waiting for payment</span></div>' +
      '<div><b>' + orders.filter(dead).length + '</b><span>Cancelled</span></div></div>' +
      '<div class="bars">' + days.map((d) => '<i style="height:' + Math.max(4, Math.round(d.n / mx * 100)) + '%" title="' + d.n + '"></i>').join('') + '</div><div class="bl">' + days.map((d) => '<span>' + escH(d.label) + '</span>').join('') + '</div><div class="hint">Orders in the last 7 days. Full order details are in the app: Profile \u2192 My Product Dashboard.</div></div>';
    const vw = store.viewersOfSeller(sid);
    dash += '<div class="dash"><h2>\ud83d\udc41 Who viewed your products</h2><p class="sub">' + vw.length + ' signed-in people looked at your products. Real data.</p>' +
      (vw.length ? vw.slice(0, 60).map((v) => '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid #f0e6d0">' +
        (v.hasPhoto ? '<img src="/shop/api/avatar/' + escH(v.id) + '" width="40" height="40" style="border-radius:50%;object-fit:cover;border:2px solid #e3b04b" alt="">' : '<span style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#4b2e6e,#2a1745);color:#f6d27a;display:flex;align-items:center;justify-content:center;font-weight:800">' + escH(String(v.name).charAt(0).toUpperCase()) + '</span>') +
        '<div style="flex:1"><b>' + escH(v.name) + '</b><div style="font-size:12px;color:#8a7a5c">' + v.products + ' product(s) \u00b7 ' + escH(new Date(v.last).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })) + '</div></div></div>').join('') : '<p class="sub">No signed-in visitors yet. Share your shop link!</p>') + '</div>';
  } else if (req.user === undefined || !req.user) {
    dash = '';
  }

  const cards = list.map((p) => {
    const price = Number(p.price), mrp = Number(p.mrp) || 0;
    const cur = (p.currency || 'INR') === 'INR' ? '\u20b9' : (p.currency || '') + ' ';
    const meta = isOwner ? '<div class="ms">\ud83d\udc41 ' + (store.productViewCount(p.id) || 0) + ' \u00b7 \u2665 ' + (store.productLikeInfo(p.id, null).count || 0) + '</div>' : '';
    return '<a class="c" href="/shop/?p=' + escH(p.id) + '"><img loading="lazy" src="/shop/img/' + escH(p.id) + (p.imgV ? '?v=' + escH(p.imgV) : '') + '" alt="' + escH(p.title) + '"><div class="i"><div class="t">' + escH(p.title) + '</div><div class="p">' + cur + escH(price) + (mrp > price ? '<s>' + cur + escH(mrp) + '</s>' : '') + '</div>' + meta + '</div></a>';
  }).join('');
  const acts = '<div class="act">' + (!isOwner && waNum ? '<a class="wa" data-wa="' + escH(waNum) + '" data-msg="' + escH(waText) + '" href="https://wa.me/' + escH(waNum) + '?text=' + encodeURIComponent(waText) + '">\ud83d\udcac Chat on WhatsApp</a>' : '') + '<a class="op" href="/shop">' + (isOwner ? 'Open my app' : 'Open in app') + '</a></div>';
  let advBlock = '';
  if (isOwner) {
    const nowT = Date.now(), rg = {};
    [['24h', 864e5], ['7d', 7 * 864e5], ['30d', 30 * 864e5]].forEach(([k, ms]) => { rg[k] = advancedCards(req.user.id, nowT - ms); });
    advBlock = '<div class="sec">\ud83d\udc8e Advanced dashboard \u00b7 ' + rg['24h'].length + ' insights</div><p class="sub" style="margin:-4px 2px 10px">Real numbers from your shop. Tap \u22ef on any card to switch between 24 hours, 7 days and 30 days.</p><div id="adv-grid"></div><script type="application/json" id="adv-data">' + JSON.stringify(rg).replace(/</g, '\\u003c') + '</script>' +
      '<style>#adv-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px}.ac{position:relative;background:linear-gradient(160deg,#fff,#fffaf0);border:1px solid #efe3c8;border-radius:18px;padding:13px;box-shadow:0 6px 18px rgba(75,46,110,.09)}.ac.wide{grid-column:1/-1}.ach{display:flex;align-items:center;gap:6px;font-size:13px;color:#3a2358;position:relative}.ach b{flex:1;font-size:13px}.acd{border:0;background:#f6efe0;border-radius:8px;width:30px;height:26px;font-weight:800;color:#3a2358;font-size:16px}.acm{position:absolute;right:0;top:30px;z-index:5;background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);overflow:hidden;min-width:150px}.acm[hidden]{display:none}.acm button{display:block;width:100%;border:0;background:#fff;padding:12px 14px;text-align:left;font-size:13px}.acm button.on{background:#fff3cf;font-weight:800}.acb{font-size:28px;font-weight:900;margin:10px 0 4px;background:linear-gradient(135deg,#4b2e6e,#a9741a);-webkit-background-clip:text;background-clip:text;color:transparent}.acr{position:relative;display:flex;justify-content:space-between;padding:7px 0 9px;font-size:13px}.acr i{position:absolute;left:0;bottom:2px;height:4px;border-radius:4px;background:linear-gradient(90deg,#f6d27a,#e3a73b)}.acn{font-size:12px;color:#8a7a5c;padding:8px 0}.acg{display:block;margin-top:6px;font-size:10px;color:#8a7a5c;letter-spacing:.05em;text-transform:uppercase}</style>';
  }
  const ownerHint = !isOwner ? '<div class="login">Is this your shop? <a href="/shop">Log in</a> to see your sales dashboard.</div>' : '';
  page(200, hero + '<div class="w">' + acts + dash + '<div class="sec">' + (isOwner ? 'Your products' : 'Products') + ' (' + list.length + ')</div>' + (cards ? '<div class="g">' + cards + '</div>' : '<div class="dash"><p class="sub">' + (isOwner ? 'No live products yet. Tap "Open my app" and press + to add your first product.' : 'No products yet. Please check again soon.') + '</p></div>') + advBlock + ownerHint + '<div class="f">Stratic Market \u00b7 Pay the seller directly by UPI / QR or Cash on Delivery</div></div>', ownerName + ' \u00b7 Stratic Market');
});

// ---------- Stratic Market Chat (buyer <-> seller about one product) ----------
const chat = require('../services/chat-store');
const gateway = require('../services/gateway');
const chatSendLog = new Map(); // userId -> recent send times (simple flood guard)
setInterval(() => { const now = Date.now(); for (const [k, a] of chatSendLog) { if (!a.some((t) => now - t < 60000)) chatSendLog.delete(k); } }, 120000).unref();
function chatTooFast(uid) {
  const now = Date.now(); const a = (chatSendLog.get(uid) || []).filter((t) => now - t < 60000);
  if (a.length >= 25) { chatSendLog.set(uid, a); return true; }
  a.push(now); chatSendLog.set(uid, a); return false;
}
function chatOn(req, res, next) {
  if (!chat.ENABLED) return res.status(503).json({ error: 'Chat is switched off.' });
  chat.ready.then(() => next(), () => next());
}
function chatMine(req, res) {
  const t = chat.getThread(String(req.params.id || ''));
  if (!t || (t.sellerId !== req.user.id && t.buyerId !== req.user.id)) { res.status(404).json({ error: 'Chat not found.' }); return null; }
  return t;
}
function chatOut(t, uid) {
  const iAmSeller = t.sellerId === uid;
  return { id: t.id, productId: t.productId, productTitle: t.productTitle, otherName: iAmSeller ? t.buyerName : t.sellerName, iAmSeller, lastText: t.lastText, lastAt: t.lastAt, unread: (t.unread && t.unread[uid]) || 0, blocked: !!(t.blockedBy && t.blockedBy.length), blockedByMe: !!(t.blockedBy && t.blockedBy.includes(uid)) };
}
router.get('/api/chat/stream', requireUser, chatOn, (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders && res.flushHeaders();
  const off = chat.subscribe(req.user.id, res);
  if (!off) { res.write('event: busy\ndata: {}\n\n'); return res.end(); }
  res.write('retry: 3000\n\n');
  chat.markDelivered(req.user.id);
  res.write('event: chat\ndata: ' + JSON.stringify({ threadId: null, unread: chat.unreadTotal(req.user.id) }) + '\n\n');
  req.on('close', off);
});
router.get('/api/chat/img/:id', requireUser, chatOn, async (req, res) => {
  // Do not let a transient not-yet-available image response become a cached broken photo.
  res.set('Cache-Control', 'private, no-store, max-age=0');
  const buf = await chat.getImg(req.params.id, req.user.id);
  if (!buf || !Buffer.isBuffer(buf) || buf.length < 200) return res.status(404).end();
  res.set({ 'Content-Type': 'image/jpeg', 'Content-Length': String(buf.length), 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=86400' }).status(200).send(buf);
});
router.delete('/api/chat/threads/:id/messages/:mid', csrf, requireUser, chatOn, async (req, res) => {
  const t = chatMine(req, res); if (!t) return;
  const m = await chat.deleteMsg(t.id, req.user.id, String(req.params.mid || ''));
  if (!m) return res.status(404).json({ error: 'This message cannot be removed from your chat.' });
  await chat.flushPendingWrites();
  res.json({ ok: true, id: m.id, removed: !!m.removed });
});
router.post('/api/chat/threads/:id/messages/delete', csrf, requireUser, chatOn, async (req, res) => {
  const t = chatMine(req, res); if (!t) return;
  const ids = Array.isArray(req.body.ids) ? req.body.ids.slice(0, 200).map((x) => String(x)) : [];
  if (!ids.length) return res.status(400).json({ error: 'Select at least one message.' });
  const done = [];
  for (const id of ids) { const m = await chat.deleteMsg(t.id, req.user.id, id); if (m) done.push(m.id); }
  await chat.flushPendingWrites();
  res.json({ ok: true, deleted: done });
});
router.post('/api/chat/threads/:id/messages/:mid/edit', csrf, requireUser, chatOn, async (req, res) => {
  const t = chatMine(req, res); if (!t) return;
  const text = String(req.body.text || '').replace(/\r/g, '').trim().slice(0, 1000);
  if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });
  const m = await chat.editMsg(t.id, req.user.id, String(req.params.mid || ''), text);
  if (!m) return res.status(404).json({ error: 'You can edit only your own text messages.' });
  if (m.error) return res.status(400).json({ error: m.error });
  res.json({ ok: true, id: m.id, text: m.text });
});
const typingLog = new Map();
router.post('/api/chat/threads/:id/typing', csrf, requireUser, chatOn, (req, res) => {
  const t = chatMine(req, res); if (!t) return;
  const k = req.user.id + t.id, now = Date.now();
  if (now - (typingLog.get(k) || 0) > 1500) { typingLog.set(k, now); chat.typing(t.id, req.user.id); }
  if (typingLog.size > 5000) typingLog.clear();
  res.json({ ok: true });
});
router.get('/api/chat/unread', requireUser, chatOn, (req, res) => { res.set('Cache-Control', 'no-store'); res.json({ unread: chat.unreadTotal(req.user.id) }); });
router.get('/api/chat/threads', requireUser, chatOn, (req, res) => { res.set('Cache-Control', 'no-store'); chat.markDelivered(req.user.id); res.json({ threads: chat.threadsFor(req.user.id).map((t) => chatOut(t, req.user.id)) }); });
router.post('/api/chat/start', csrf, requireUser, chatOn, (req, res) => {
  const p = store.getProduct(clean(req.body.productId, 40));
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  if (p.sellerId === req.user.id) return res.status(400).json({ error: 'This is your own product. Buyers will message you here.' });
  const t = chat.start(p, store.findAccountById(req.user.id) || req.user, store.findAccountById(p.sellerId));
  res.json({ thread: chatOut(t, req.user.id) });
});
router.get('/api/chat/threads/:id', requireUser, chatOn, async (req, res) => {
  const t = chatMine(req, res); if (!t) return;
  res.set('Cache-Control', 'no-store');
  const after = String(req.query.after || '');
  const msgs = (await chat.messages(t.id, after || null, req.user.id)).map((m) => ({ id: m.id, mine: m.from === req.user.id, text: m.text, at: m.at, st: chat.stateOf(m), del: !!m.deleted, ed: !!m.edited }));
  chat.markRead(t.id, req.user.id);
  const states = {}, flags = {}; (await chat.messages(t.id, null, req.user.id)).forEach((m) => { if (m.from === req.user.id) states[m.id] = chat.stateOf(m); if (m.deleted || m.edited) flags[m.id] = { del: !!m.deleted, ed: !!m.edited, text: m.deleted ? '' : m.text }; });
  res.json({ thread: chatOut(chat.getThread(t.id), req.user.id), messages: msgs, states, flags });
});
router.post('/api/chat/threads/:id/read', csrf, requireUser, chatOn, (req, res) => {
  const t = chatMine(req, res); if (!t) return;
  chat.markRead(t.id, req.user.id); res.json({ unread: chat.unreadTotal(req.user.id) });
});
router.post('/api/chat/threads/:id/messages', csrf, requireUser, chatOn, async (req, res) => {
  const t = chatMine(req, res); if (!t) return;
  if (t.blockedBy && t.blockedBy.length) return res.status(403).json({ error: 'This chat is blocked.' });
  if (chatTooFast(req.user.id)) return res.status(429).json({ error: 'You are sending too fast. Please wait a moment.' });
  const photo = String(req.body.photo || '');
  if (photo) { // photos only, never video
    const mm = photo.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
    const buf = mm && photo.length < 480000 ? Buffer.from(mm[1], 'base64') : null;
    if (!buf || buf.length < 200 || buf[0] !== 0xff || buf[1] !== 0xd8) return res.status(400).json({ error: 'Only photos can be sent (no videos), up to about 350 KB.' });
    const cap = String(req.body.caption || '').replace(/\r/g, '').trim().slice(0, 500);
    const pm = await chat.add(t.id, req.user.id, '', buf, cap);
    // Confirm both the image bytes and message row are committed before the client
    // renders the photo URL; otherwise an immediate GET can race the queued INSERT.
    await chat.flushPendingWrites();
    return res.json({ message: { id: pm.id, mine: true, text: pm.text, at: pm.at, st: chat.stateOf(pm) } });
  }
  const text = String(req.body.text || '').replace(/\r/g, '').trim().slice(0, 1000);
  if (!text) return res.status(400).json({ error: 'Type a message first.' });
  const m = await chat.add(t.id, req.user.id, text);
  res.json({ message: { id: m.id, mine: true, text: m.text, at: m.at, st: chat.stateOf(m) } });
});
router.post('/api/chat/threads/:id/block', csrf, requireUser, chatOn, (req, res) => {
  const t = chatMine(req, res); if (!t) return;
  const u = chat.patch(t.id, (x) => { x.blockedBy = x.blockedBy || []; const i = x.blockedBy.indexOf(req.user.id); if (i >= 0) x.blockedBy.splice(i, 1); else x.blockedBy.push(req.user.id); });
  res.json({ thread: chatOut(u, req.user.id) });
});
router.post('/api/chat/threads/:id/report', csrf, requireUser, chatOn, (req, res) => {
  const t = chatMine(req, res); if (!t) return;
  chat.patch(t.id, (x) => { x.reports = x.reports || []; x.reports.push({ by: req.user.id, at: new Date().toISOString(), reason: clean(req.body.reason, 200) }); });
  res.json({ ok: true });
});

router.get('/api/me', (req, res) => res.json({ user: userOut(req.user) }));

router.post('/api/register', csrf, authLimiter, async (req, res) => {
  const name = clean(req.body.name, 60);
  const email = clean(req.body.email, 120).toLowerCase();
  const password = String(req.body.password || '');
  const phone = clean(req.body.phone, 20);
  const country = clean(req.body.country, 4).toUpperCase() || 'IN';
  const lang = clean(req.body.lang, 8) || 'en';
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6 || password.length > 100) {
    return res.status(400).json({ error: 'Name, valid email and password (min 6) required.' });
  }
  if (!/^[\d +()-]{7,20}$/.test(phone)) {
    return res.status(400).json({ error: 'Valid mobile number required. One number = one account.' });
  }
  if (store.findAccountByEmail(email)) {
    return res.status(400).json({ error: 'This email is already registered. Please log in.' });
  }
  if (store.findAccountByPhone(phone)) {
    return res.status(400).json({ error: 'This mobile number is already linked to an account. Use that account.' });
  }
  const hash = await bcrypt.hash(password, 10);
  const u = store.createAccount({
    name,
    email,
    passwordHash: hash,
    phone,
    phoneKey: store.normPhone(phone),
    country,
    lang,
  });
  if (!u) return res.status(400).json({ error: 'Could not create account.' });
  setSession(res, u.id);
  res.cookie('sgm_uid', u.id, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000, path: '/' });
  res.status(201).json({ user: userOut(u) });
});

router.post('/api/login', csrf, authLimiter, async (req, res) => {
  const email = clean(req.body.email, 120).toLowerCase();
  const u = store.findAccountByEmail(email);
  if (!u || !(await bcrypt.compare(String(req.body.password || ''), u.passwordHash))) {
    return res.status(400).json({ error: 'Wrong email or password.' });
  }
  setSession(res, u.id);
  res.cookie('sgm_uid', u.id, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000, path: '/' });
  res.json({ user: userOut(u) });
});

// Google OAuth — requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET env
function googleRedirectUri(req) {
  let uri =
    process.env.GOOGLE_REDIRECT_URI ||
    (process.env.APP_URL
      ? process.env.APP_URL.replace(/\/$/, '') + '/shop/api/google/callback'
      : '');
  if (!uri) {
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
    const host = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
    uri = proto + '://' + host + '/shop/api/google/callback';
  }
  return String(uri).trim().replace(/\/$/, '').replace(/,/g, '');
}

function normEmail(e) {
  return String(e || '').toLowerCase().trim();
}

router.get('/api/google/start', (req, res) => {
  const cid = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  if (!cid) {
    return res.status(400).send(
      '<html><body style="font-family:sans-serif;padding:24px">' +
        '<h2>Google login not configured</h2>' +
        '<p>Render Environment:</p>' +
        '<pre>GOOGLE_CLIENT_ID=...</pre><pre>GOOGLE_CLIENT_SECRET=...</pre>' +
        '<pre>GOOGLE_REDIRECT_URI=https://straticsoft.onrender.com/shop/api/google/callback</pre>' +
        '<pre>APP_URL=https://straticsoft.onrender.com</pre>' +
        '<pre>SESSION_SECRET=long-random-string</pre>' +
        '<p><a href="/shop">Back</a></p></body></html>'
    );
  }
  const redirect = googleRedirectUri(req);
  // prompt=select_account only first time UX; login always works
  const url =
    'https://accounts.google.com/o/oauth2/v2/auth?client_id=' +
    encodeURIComponent(cid) +
    '&redirect_uri=' +
    encodeURIComponent(redirect) +
    '&response_type=code&scope=openid%20email%20profile&access_type=online&include_granted_scopes=true&prompt=select_account';
  res.redirect(url);
});

router.get('/api/google/callback', async (req, res) => {
  try {
    if (req.query.error) {
      console.error('google oauth error', req.query.error);
      return res.redirect('/shop?gerr=' + encodeURIComponent(String(req.query.error)));
    }
    const code = req.query.code;
    const cid = String(process.env.GOOGLE_CLIENT_ID || '').trim();
    const secret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
    const redirect = googleRedirectUri(req);
    if (!code || !cid || !secret) {
      console.error('google callback missing', { hasCode: !!code, hasCid: !!cid, hasSecret: !!secret, redirect });
      return res.redirect('/shop?gerr=missing_config');
    }
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: cid,
        client_secret: secret,
        redirect_uri: redirect,
        grant_type: 'authorization_code',
      }),
    });
    const tok = await tokenRes.json();
    if (!tok.access_token) {
      console.error('google token fail', tok);
      return res.redirect('/shop?gerr=token');
    }
    const ui = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: 'Bearer ' + tok.access_token },
    }).then((r) => r.json());
    const email = normEmail(ui.email);
    if (!email) return res.redirect('/shop?gerr=no_email');

    // Gmail verified by Google. Now ask for the mobile number (Gmail + mobile together identify the account).
    res.cookie('sgm_gpending', JSON.stringify({ email, name: ui.name || '', gid: ui.id }), {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: 15 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production' || process.env.RENDER === 'true',
    });
    return res.redirect('/shop?needphone=1');
  } catch (e) {
    console.error('google callback exception', e);
    return res.redirect('/shop?gerr=exception');
  }
});

router.get('/api/google/pending', (req, res) => {
  let name = '';
  try {
    const raw = (req.headers.cookie || '').split(';').find((c) => c.trim().startsWith('sgm_gpending='));
    if (raw) name = String(JSON.parse(decodeURIComponent(raw.split('=').slice(1).join('=').trim())).name || '');
  } catch {}
  res.set('Cache-Control', 'no-store');
  res.json({ name: name.slice(0, 60) });
});

router.post('/api/google/complete', csrf, authLimiter, async (req, res) => {
  let pending = null;
  try {
    const raw = (req.headers.cookie || '').split(';').find((c) => c.trim().startsWith('sgm_gpending='));
    if (raw) pending = JSON.parse(decodeURIComponent(raw.split('=').slice(1).join('=').trim()));
  } catch {}
  if (!pending || !pending.email) return res.status(400).json({ error: 'Google session expired. Please tap Continue with Google again.' });
  const email = normEmail(pending.email);
  const country = clean(req.body.country, 4).toUpperCase() || 'IN';
  const lang = clean(req.body.lang, 8) || 'en';
  const personName = clean(req.body.name, 60);
  if (personName.length < 2) return res.status(400).json({ error: 'Please enter your name (this becomes your shop name).' });
  const rawPhone = clean(req.body.phone, 20);
  let digits = rawPhone.replace(/\D/g, '');
  let phone;
  if (country === 'IN') {
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    if (!/^[6-9]\d{9}$/.test(digits)) {
      return res.status(400).json({ error: 'Enter a valid 10-digit Indian mobile number.' });
    }
    phone = '+91' + digits;
  } else {
    const CC = { US: '1', GB: '44', AE: '971' };
    if (CC[country]) {
      if (digits.startsWith('0')) digits = digits.slice(1);
      if (!digits.startsWith(CC[country])) digits = CC[country] + digits;
    }
    if (digits.length < 7 || digits.length > 15) return res.status(400).json({ error: 'Enter a valid mobile number with country code.' });
    phone = '+' + digits;
  }
  const realCountry = store.countryFromPhone(phone, country);
  const key = store.normPhone(phone);
  // Same Gmail + same mobile  -> your old account (all products come back).
  // Same Gmail + other mobile, or other Gmail + same mobile -> a brand new empty account.
  let u = store.findAccountByPair(email, key);
  if (u) {
    const patch = { country: realCountry, lang, name: personName };
    if (!u.googleId) patch.googleId = pending.gid;
    u = store.updateAccount(u.id, patch) || u;
  } else {
    const legacy = store.findPhonelessByEmail(email); // old Google account that never had a mobile saved
    if (legacy) {
      u = store.updateAccount(legacy.id, { name: personName, phone, phoneKey: key, country: realCountry, lang, googleId: legacy.googleId || pending.gid });
    } else {
      u = store.createAccount({
        name: personName,
        email,
        passwordHash: await bcrypt.hash(require('crypto').randomBytes(16).toString('hex'), 10),
        phone,
        phoneKey: key,
        country: realCountry,
        lang,
        googleId: pending.gid,
      });
    }
  }
  if (!u) return res.status(400).json({ error: 'Could not save. Please try again.' });
  res.clearCookie('sgm_gpending', { path: '/' });
  setSession(res, u.id);
  res.cookie('sgm_uid', u.id, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000, path: '/' });
  res.json({ user: userOut(u) });
});

router.post('/api/logout', csrf, (req, res) => {
  clearSession(res);
  res.clearCookie('sgm_uid');
  res.json({ ok: true });
});

router.patch('/api/profile', csrf, requireUser, (req, res) => {
  const patch = {};
  if (req.body.lang && /^(en|hi|bn|te|mr|ta|gu|kn|ml|pa)$/.test(String(req.body.lang))) patch.lang = String(req.body.lang);
  if (req.body.name) patch.name = clean(req.body.name, 60);
  const u = store.updateAccount(req.user.id, patch);
  res.json({ user: userOut(u) });
});

function shopSlug(p) {
  const nm = String(p.shopName || 'shop').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'shop';
  return nm + '-' + String(p.sellerId || '').replace(/[^a-f0-9]/gi, '');
}
function escH(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function pview(p, user) {
  const price = Number(p.price);
  const mrp = Number(p.mrp) || 0;
  return {
    id: p.id,
    title: p.title,
    seller: p.shopName,
    shop: shopSlug(p),
    city: p.city,
    country: p.country || 'IN',
    description: p.description,
    packedWeightGrams: p.packedWeightGrams || null,
    packageLengthCm: p.packageLengthCm || null,
    packageWidthCm: p.packageWidthCm || null,
    packageHeightCm: p.packageHeightCm || null,
    price,
    mrp,
    currency: p.currency || 'INR',
    category: p.category,
    days: p.days || 5,
    phone: p.sellerPhone || '',
    mine: !!(user && user.id === p.sellerId),
    hasQr: !!p.hasQr,
    hasGateway: !!(store.findAccountById(p.sellerId) || {}).gw && String(p.currency || 'INR') === 'INR',
    off: mrp > price ? Math.round((1 - price / mrp) * 100) : 0,
    img: '/shop/img/' + p.id + (p.imgV ? '?v=' + p.imgV : ''),
    imgs: Array.from({ length: Math.max(1, Number(p.imgCount) || 1) }, (_, k) => '/shop/img/' + p.id + (k ? '?i=' + k + (p.imgV ? '&v=' + p.imgV : '') : (p.imgV ? '?v=' + p.imgV : ''))),
    ...(user && user.id === p.sellerId ? { district: p.district || '', address: p.sellerAddress || '', expiresAt: p.expiresAt || null,
      gstRegistrationType: p.gstRegistrationType || 'unregistered', sellerGstin: p.sellerGstin || '', hsnCode: p.hsnCode || '', gstTreatment: p.gstTreatment || 'taxable', gstRate: p.gstRate == null ? null : p.gstRate } : {}),
    productCode: 'SM-' + String(p.id || '').slice(0, 8).toUpperCase(),
    createdAt: p.createdAt,
    likes: store.productLikeInfo(p.id, user && user.id).count,
    liked: store.productLikeInfo(p.id, user && user.id).liked,
  };
}

router.get('/api/products', (req, res) => {
  res.set('Cache-Control', 'no-store');
  // Logged-in people always see products of the country of THEIR mobile number; visitors use the detected country.
  const me0 = req.user ? store.findAccountById(req.user.id) : null;
  const country = me0 ? store.countryFromPhone(me0.phone, me0.country) : String(req.query.country || '').toUpperCase();
  const limitRaw = Number.parseInt(req.query.limit, 10);
  const offsetRaw = Number.parseInt(req.query.offset, 10);
  // Legacy callers that omit pagination retain the original response contract.
  const paged = Number.isFinite(limitRaw) || Number.isFinite(offsetRaw);
  const limit = paged ? Math.min(40, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20)) : null;
  const offset = paged ? Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0) : 0;
  const products = store.listProducts(country || null);
  const windowed = paged ? products.slice(offset, offset + limit + 1) : products;
  const hasMore = paged && windowed.length > limit;
  const list = (paged && hasMore ? windowed.slice(0, limit) : windowed).map((p) => pview(p, req.user));
  res.json(paged ? { products: list, hasMore, nextOffset: hasMore ? offset + list.length : null } : { products: list });
});

router.get('/api/my-products', requireUser, (req, res) => {
  const products = store.listAllProducts().filter((p) => p.sellerId === req.user.id).map((p) => pview(p, req.user));
  res.json({ products });
});

router.post('/api/products/:id/like', csrf, requireUser, (req, res) => {
  const p = store.getProduct(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  // One like per logged-in Gmail account. Your own listing can be liked from your other Gmail account.
  if (p.sellerId === req.user.id) {
    return res.status(400).json({ error: 'You cannot like your own product from this Gmail. Log in with another Gmail to like it.' });
  }
  const result = store.toggleProductLike(p.id, req.user.id);
  if (!result) return res.status(404).json({ error: 'Product not found.' });
  res.json(result);
});

// One view per device per product (the same device opening again adds nothing).
router.post('/api/products/:id/view', csrf, (req, res) => {
  const pr = store.getProduct(req.params.id);
  // the seller opening their own product is never counted
  if (pr && req.user && pr.sellerId === req.user.id) return res.json({ ok: true, own: true });
  const n = store.recordProductView(req.params.id, req.devId, req.user && req.user.id);
  res.json({ ok: true, views: n });
});

function normCountry(v) {
  const x = String(v || 'IN').trim().toLowerCase();
  if (!x || x === 'in' || x.includes('india') || x.includes('bharat')) return 'IN';
  if (x === 'us' || x === 'usa' || x.includes('united states') || x.includes('america')) return 'US';
  if (x === 'gb' || x === 'uk' || x.includes('united kingdom') || x.includes('england') || x.includes('britain')) return 'GB';
  if (x === 'ae' || x === 'uae' || x.includes('emirates')) return 'AE';
  return 'OTHER';
}
router.get('/api/product-dashboard', requireUser, (req, res) => {
  const products = store.listAllProducts().filter((p) => p.sellerId === req.user.id);
  const allOrders = store.listOrders({ sellerId: req.user.id });
  const payAll = store.listSellerPaymentOrders(req.user.id);
  const isCancelled = (o) => String(o.status || '').toUpperCase() === 'CANCELLED';
  const has = (o, pid) => (o.items || []).some((it) => (it.id || it.productId) === pid);
  const qtyOf = (o, pid) => (o.items || []).filter((it) => (it.id || it.productId) === pid).reduce((a, it) => a + (Number(it.qty) || 1), 0);
  const bought = {}; // country -> orders (all products)
  const seenRef = new Set();
  const states = {}; // state -> orders
  const daily = {};
  for (let k = 6; k >= 0; k--) daily[new Date(Date.now() - k * 864e5).toISOString().slice(0, 10)] = 0;
  const buyers = new Set();
  const details = products.map((p) => {
    const matching = allOrders.filter((o) => has(o, p.id));
    const live = matching.filter((o) => !isCancelled(o));
    const cancelled = matching.filter(isCancelled);
    const countries = {};
    live.forEach((o) => {
      const c = normCountry(o.country);
      countries[c] = (countries[c] || 0) + 1;
      if (!seenRef.has(o.ref)) {
        seenRef.add(o.ref);
        bought[c] = (bought[c] || 0) + 1;
        const stn = String(o.state || '').trim() || 'Not given';
        states[stn] = (states[stn] || 0) + 1;
        const dk = String(o.createdAt || '').slice(0, 10);
        if (dk in daily) daily[dk]++;
      }
      buyers.add(o.phoneKey ? store.normPhone(o.phoneKey) : String(o.buyerId));
    });
    return {
      id: p.id, title: p.title, price: p.price, currency: p.currency || 'INR',
      likes: store.productLikeInfo(p.id, req.user.id).count,
      views: store.productViewCount(p.id),
      unitsSold: live.reduce((n, o) => n + qtyOf(o, p.id), 0),
      orderCount: live.length,
      cancelledCount: cancelled.length,
      countries,
      onlineCount: live.filter((o) => o.paymentMethod === 'ONLINE').length,
      codCount: live.filter((o) => o.paymentMethod !== 'ONLINE').length,
      payments: payAll.filter((o) => has(o, p.id)).slice(0, 100).map((o) => {
        const st = String(o.status || '').toUpperCase();
        const online = o.paymentMethod === 'ONLINE';
        const pay = !online ? 'COD' : (o.paymentStatus === 'VERIFIED' ? 'PAID' : (o.paymentStatus === 'REJECTED' ? 'REJECTED' : 'WAITING'));
        return { ref: o.ref, buyer: o.name || '', method: online ? 'ONLINE' : 'COD', pay, status: st, amount: o.total, currency: o.currency || 'INR', qty: qtyOf(o, p.id), city: o.city || '', state: o.state || '', createdAt: o.createdAt, confirmedAt: o.confirmedAt || null };
      }),
      waitingCount: payAll.filter((o) => has(o, p.id) && o.paymentMethod === 'ONLINE' && String(o.status || '').toUpperCase() === 'PAYMENT_PENDING').length,
      orders: matching.map((o) => ({ ref: o.ref, status: o.status, qty: qtyOf(o, p.id), city: o.city || '', country: o.country || '', createdAt: o.createdAt })),
    };
  });
  const known = ['IN', 'US', 'GB', 'AE', 'OTHER'];
  res.json({
    products: details,
    totalProducts: products.length,
    totalSold: details.reduce((n, p) => n + p.unitsSold, 0),
    totalLikes: details.reduce((n, p) => n + p.likes, 0),
    totalViews: details.reduce((n, p) => n + p.views, 0),
    totalOrders: new Set(details.flatMap((p) => p.orders.filter((o) => String(o.status || '').toUpperCase() !== 'CANCELLED').map((o) => o.ref))).size,
    totalCancelled: new Set(details.flatMap((p) => p.orders.filter((o) => String(o.status || '').toUpperCase() === 'CANCELLED').map((o) => o.ref))).size,
    totalBuyers: buyers.size,
    totalOnline: details.reduce((n, p) => n + p.onlineCount, 0),
    totalCod: details.reduce((n, p) => n + p.codCount, 0),
    countriesBought: bought,
    states,
    daily,
    countriesNotBought: known.filter((c) => !bought[c]),
  });
});

function parseGstDetails(body, existing) {
  const b = body || {};
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  if (!has('gstRegistrationType') && existing) return {};
  const type = String(has('gstRegistrationType') ? b.gstRegistrationType : (existing && existing.gstRegistrationType) || 'unregistered').toLowerCase();
  if (!['unregistered', 'regular', 'composition'].includes(type)) throw new Error('Choose a valid GST registration status.');
  const out = { gstRegistrationType: type };
  if (type === 'unregistered') {
    out.sellerGstin = ''; out.hsnCode = ''; out.gstTreatment = 'taxable'; out.gstRate = null;
    return out;
  }
  const gstin = String(has('sellerGstin') ? b.sellerGstin : (existing && existing.sellerGstin) || '').trim().toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) throw new Error('Enter a valid 15-character GSTIN, or choose Not GST registered if you do not have one.');
  out.sellerGstin = gstin;
  const hsn = String(has('hsnCode') ? b.hsnCode : (existing && existing.hsnCode) || '').trim();
  if (hsn && !/^[0-9]{4}(?:[0-9]{2}){0,2}$/.test(hsn)) throw new Error('HSN must contain 4, 6 or 8 digits.');
  out.hsnCode = hsn;
  out.gstTreatment = type === 'composition' ? 'composition' : String(has('gstTreatment') ? b.gstTreatment : (existing && existing.gstTreatment) || 'taxable');
  if (type === 'regular' && !['taxable', 'exempt'].includes(out.gstTreatment)) throw new Error('Choose a valid product tax treatment.');
  if (type === 'regular' && out.gstTreatment === 'taxable') {
    const raw = has('gstRate') ? b.gstRate : (existing && existing.gstRate);
    const rate = Number(raw);
    if (raw === '' || raw == null || !Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('Enter the GST rate confirmed for this product, from 0 to 100%.');
    out.gstRate = rate;
  } else out.gstRate = null;
  return out;
}

function optionalMeasure(value, label, max, integer) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > max || (integer && !Number.isInteger(n))) {
    throw new Error('Enter a valid ' + label + '.');
  }
  return n;
}

router.post('/api/products', csrf, requireUser, pick, async (req, res) => {
  const b = req.body || {};
  const title = clean(b.title || b.name, 120);
  const price = Number(b.price);
  const phone = clean(b.phone, 20);
  const address = clean(b.address, 200);
  if (!title || !Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ error: 'Product name and valid price required.' });
  }
  let packageMeasures;
  try {
    packageMeasures = {
      packedWeightGrams: optionalMeasure(b.packedWeightGrams, 'packed weight in grams', 100000, true),
      packageLengthCm: optionalMeasure(b.packageLengthCm, 'package length in cm', 500, false),
      packageWidthCm: optionalMeasure(b.packageWidthCm, 'package width in cm', 500, false),
      packageHeightCm: optionalMeasure(b.packageHeightCm, 'package height in cm', 500, false),
    };
  } catch (e) { return res.status(400).json({ error: e.message }); }
  let gstDetails;
  try { gstDetails = parseGstDetails(b); } catch (e) { return res.status(400).json({ error: e.message }); }
  if (!/^[\d +()-]{7,20}$/.test(phone) || !address) {
    return res.status(400).json({ error: 'Seller phone and address required.' });
  }
  const mainFile = req.files && req.files.photo && req.files.photo[0];
  if (!mainFile || !mainFile.buffer || mainFile.buffer.length < 100) {
    return res.status(400).json({ error: 'Product photo required.' });
  }
  const extraBufs = ((req.files && req.files.extra) || []).map((f) => f.buffer).filter((x) => x && x.length > 100).slice(0, 11);
  const qrFile = req.files && req.files.qr && req.files.qr[0];
  if (qrFile && (!['image/jpeg','image/png','image/webp'].includes(String(qrFile.mimetype || '').toLowerCase()) || qrFile.buffer.length < 100)) return res.status(400).json({ error: 'Choose a valid JPG, PNG or WebP payment QR image.' });
  // One mobile number = one account: bind the seller phone to this account.
  {
    const me0 = store.findAccountById(req.user.id);
    const key = store.normPhone(phone);
    const owner = store.findAccountByPhone(phone);
    const sameMobile = me0 && me0.phoneKey && store.normPhone(me0.phoneKey) === key;
    if (owner && owner.id !== req.user.id && !sameMobile) {
      return res.status(400).json({ error: 'This mobile number belongs to another account. Use your own number.' });
    }
    if (me0 && !me0.phoneKey && key) store.updateAccount(req.user.id, { phone, phoneKey: key });
    else if (me0 && me0.phoneKey && key && store.normPhone(me0.phoneKey) !== key) {
      return res.status(400).json({ error: 'Use the mobile number saved on your account (' + me0.phone + ').' });
    }
  }
  let expiresAt = null;
  if (b.expiresAt) {
    expiresAt = new Date(b.expiresAt);
    if (isNaN(expiresAt.getTime())) return res.status(400).json({ error: 'Invalid expiry date.' });
    const end = new Date(expiresAt);
    end.setHours(23, 59, 59, 999);
    if (end < new Date()) {
      return res.status(400).json({ error: 'EXPIRED PRODUCT REJECTED. Do not list expired items.' });
    }
  }
  const full = store.findAccountById(req.user.id);
  const p = store.addProduct(
    {
      sellerId: req.user.id,
      shopName: clean(b.seller || req.user.name, 60) || 'Seller',
      city: clean(b.city, 60),
      district: clean(b.district, 80),
      country: store.countryFromPhone(full && full.phone, full && full.country),
      title,
      description: clean(b.description, 2000),
      ...packageMeasures,
      ...gstDetails,
      price,
      mrp: Number(b.mrp) || 0,
      currency: clean(b.currency, 6) || 'INR',
      category: clean(b.category, 40) || 'Other',
      sellerPhone: phone,
      sellerAddress: address,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      lang: (full && full.lang) || 'en',
    },
    mainFile.buffer,
    extraBufs,
    qrFile ? qrFile.buffer : null
  );
  try {
    await store.flushPendingWrites();
  } catch (e) {
    console.error('Product listing was written locally but cloud persistence could not be confirmed:', e.message);
    return res.status(503).json({ error: 'Listing was created locally, but cloud saving could not be confirmed. Do not upload it again yet; refresh and check My Products, then contact support if it is missing.' });
  }
  res.status(201).json({ product: pview(p, req.user) });
});

router.post('/api/products/:id/edit', csrf, requireUser, pick, async (req, res) => {
  try {
    const b = req.body || {};
    const mine = store.getProduct(req.params.id);
    if (!mine || mine.sellerId !== req.user.id) return res.status(404).json({ error: 'Product not found.' });
    const data = {};
    if (b.title !== undefined) { data.title = clean(b.title, 120); if (!data.title) return res.status(400).json({ error: 'Product name required.' }); }
    if (b.price !== undefined) { const pr = Number(b.price); if (!Number.isFinite(pr) || pr <= 0) return res.status(400).json({ error: 'Enter a valid price.' }); data.price = pr; }
    if (b.mrp !== undefined) data.mrp = Number(b.mrp) || 0;
    if (b.description !== undefined) data.description = clean(b.description, 2000);
    Object.assign(data, parseGstDetails(b, mine));
    for (const [key, label, max, integer] of [
      ['packedWeightGrams', 'packed weight in grams', 100000, true],
      ['packageLengthCm', 'package length in cm', 500, false],
      ['packageWidthCm', 'package width in cm', 500, false],
      ['packageHeightCm', 'package height in cm', 500, false],
    ]) if (b[key] !== undefined) data[key] = optionalMeasure(b[key], label, max, integer);
    if (b.category !== undefined) data.category = clean(b.category, 40) || 'Other';
    if (b.city !== undefined) { data.city = clean(b.city, 80); if (!data.city) return res.status(400).json({ error: 'City required.' }); }
    if (b.district !== undefined) data.district = clean(b.district, 80);
    if (b.address !== undefined) { data.sellerAddress = clean(b.address, 300); if (!data.sellerAddress) return res.status(400).json({ error: 'Address required.' }); }
    if (b.expiresAt !== undefined) {
      if (!b.expiresAt) data.expiresAt = null;
      else {
        const ex = new Date(b.expiresAt);
        if (isNaN(ex.getTime())) return res.status(400).json({ error: 'Invalid expiry date.' });
        const end = new Date(ex); end.setHours(23, 59, 59, 999);
        if (end < new Date()) return res.status(400).json({ error: 'EXPIRED PRODUCT REJECTED. Do not list expired items.' });
        data.expiresAt = ex.toISOString();
      }
    }
    let keep = null;
    if (b.keep !== undefined) { try { keep = JSON.parse(b.keep); if (!Array.isArray(keep)) keep = null; } catch (e) { keep = null; } }
    const newBufs = [];
    if (req.files && req.files.photo) req.files.photo.forEach((f) => newBufs.push(f.buffer));
    if (req.files && req.files.extra) req.files.extra.forEach((f) => newBufs.push(f.buffer));
    const qrFile = req.files && req.files.qr && req.files.qr[0];
    if (qrFile && (!['image/jpeg', 'image/png', 'image/webp'].includes(String(qrFile.mimetype || '').toLowerCase()) || qrFile.buffer.length < 100)) {
      return res.status(400).json({ error: 'Choose a valid JPG, PNG or WebP payment QR image.' });
    }
    const out = await store.updateProduct(req.params.id, req.user.id, data, keep, newBufs, qrFile ? qrFile.buffer : null);
    if (!out) return res.status(404).json({ error: 'Product not found.' });
    if (out.error) return res.status(400).json({ error: out.error });
    res.json({ product: pview(out, req.user) });
  } catch (e) {
    if (/^Enter a valid /.test(String(e.message || ''))) return res.status(400).json({ error: e.message });
    console.error('edit product failed', e.message);
    res.status(500).json({ error: 'Could not save changes. Try again.' });
  }
});

router.delete('/api/products/:id', csrf, requireUser, (req, res) => {
  const ok = store.deleteProduct(req.params.id, req.user.id);
  if (!ok) return res.status(404).json({ error: 'Product not found.' });
  res.json({ ok: true });
});

function oview(o, sellerView) {
  return {
    ref: o.ref,
    status: String(o.status || 'CONFIRMED').toUpperCase(),
    total: o.total,
    currency: o.currency,
    createdAt: o.createdAt,
    items: (o.items || []).map((it) => { if (!sellerView) { const cleanItem = { ...it }; delete cleanItem.sellerGstin; delete cleanItem.gstRegistrationType; delete cleanItem.hsnCode; delete cleanItem.gstTreatment; delete cleanItem.gstRate; return cleanItem; } return it; }),
    confirmedAt: o.confirmedAt || (String(o.status).toUpperCase() === 'PAYMENT_PENDING' ? null : o.createdAt),
    payment: o.paymentMethod || 'COD',
    paymentStatus: o.paymentStatus || (o.paymentMethod === 'ONLINE' ? 'VERIFIED' : 'PAY_ON_DELIVERY'),
    itemsTotal: o.itemsTotal != null ? o.itemsTotal : o.total,
    deliveryCharge: o.deliveryCharge || 0,
    cancelReason: o.cancelReason || '',
    cancelBy: new Date(new Date(o.createdAt).getTime() + store.CANCEL_WINDOW_MS).toISOString(),
    canCancel: String(o.status || 'CONFIRMED').toUpperCase() === 'CONFIRMED' && (Date.now() - new Date(o.createdAt).getTime()) <= store.CANCEL_WINDOW_MS,
    seller: { shop: o.sellerShop, phone: o.sellerPhone },
    buyer: {
      name: o.name,
      phone: o.phone,
      address: o.address,
      city: o.city,
      country: o.country,
      state: o.state || '',
      district: o.district || '',
      pincode: o.pincode,
    },
  };
}

router.post('/api/orders', csrf, requireUser, async (req, res) => {
  const b = req.body || {};
  const f = {};
  for (const k of ['name', 'phone', 'address', 'city', 'district', 'state', 'country', 'pincode']) {
    f[k] = clean(b[k], k === 'address' ? 200 : 80);
  }
  if (!f.name || !f.address || !f.city || !f.state) return res.status(400).json({ error: 'Name, address and city required.' });
  if (!/^[\d +()-]{7,20}$/.test(f.phone)) return res.status(400).json({ error: 'Enter a valid phone number.' });

  // Your own Gmail account can never buy its own product; another Gmail can, even with the same mobile number.
  const formKey = store.normPhone(f.phone);
  let buyer = store.findAccountById(req.user.id);
  if (buyer && !buyer.phoneKey && formKey) buyer = store.updateAccount(req.user.id, { phone: f.phone, phoneKey: formKey }) || buyer;

  let items = b.items;
  if (!Array.isArray(items) || !items.length) {
    if (b.productId) items = [{ id: b.productId, qty: 1 }];
    else return res.status(400).json({ error: 'No items.' });
  }

  // Group by seller -> one order per seller
  const groups = new Map();
  for (const it of items) {
    const p = store.getProduct(it.id || it.productId);
    if (!p) return res.status(400).json({ error: 'A product in your cart is no longer available.' });
    if (p.sellerId === req.user.id) {
      return res.status(400).json({ error: 'You cannot buy your own product from this Gmail. Log in with another Gmail to order it.' });
    }
    const qty = Math.min(Math.max(Number(it.qty) || 1, 1), 10);
    if (!groups.has(p.sellerId)) groups.set(p.sellerId, { sellerId: p.sellerId, shop: p.shopName, phone: p.sellerPhone, items: [], total: 0, currency: p.currency || 'INR' });
    const g = groups.get(p.sellerId);
    g.items.push({ id: p.id, title: p.title, price: p.price, qty, currency: p.currency, packedWeightGrams: p.packedWeightGrams || null, packageLengthCm: p.packageLengthCm || null, packageWidthCm: p.packageWidthCm || null, packageHeightCm: p.packageHeightCm || null, gstRegistrationType: p.gstRegistrationType || 'unregistered', sellerGstin: p.sellerGstin || '', hsnCode: p.hsnCode || '', gstTreatment: p.gstTreatment || 'taxable', gstRate: p.gstRate == null ? null : p.gstRate });
    g.total += p.price * qty;
  }

  const reqPay = String(b.paymentMethod || 'COD').toUpperCase();
  const useGateway = reqPay === 'GATEWAY';
  const payment = (reqPay === 'ONLINE' || useGateway) ? 'ONLINE' : 'COD';
  // Products stay inside their own country (decided by the seller's mobile number).
  const buyerCountry = store.countryFromPhone(buyer && buyer.phone, buyer && buyer.country);
  for (const it of items) {
    const pp = store.getProduct(it.id || it.productId);
    if (pp && pp.country && pp.country !== buyerCountry) {
      return res.status(400).json({ error: 'This product is not available in your country.' });
    }
  }
  let txnId = clean(b.txnId, 40).replace(/\s/g, '');
  let gwSeller = null;
  if (useGateway) {
    if (items.length !== 1 || groups.size !== 1) return res.status(400).json({ error: 'Card / UPI gateway payment is available for one seller product per order.' });
    const gp = store.getProduct(items[0].id || items[0].productId);
    gwSeller = gp && store.findAccountById(gp.sellerId);
    if (!gwSeller || !gwSeller.gw || String(gp.currency || 'INR') !== 'INR') return res.status(400).json({ error: 'This seller has not enabled gateway payment. Choose another method.' });
    txnId = 'GW' + require('crypto').randomBytes(8).toString('hex').toUpperCase();
  } else if (payment === 'ONLINE') {
    // Static QR + a typed UTR is not proof of receipt. Keep every such order pending
    // until the private admin dashboard verifies the real credit in the seller's account.
    if (items.length !== 1 || groups.size !== 1) return res.status(400).json({ error: 'Online QR payment is available for one seller product per order only.' });
    const payProduct = store.getProduct(items[0].id || items[0].productId);
    if (!payProduct || !payProduct.hasQr) return res.status(400).json({ error: 'This seller has not uploaded a valid payment QR. Choose Cash on Delivery.' });
    if (!/^[A-Za-z0-9]{8,30}$/.test(txnId)) return res.status(400).json({ error: 'Enter the Transaction ID shown in your payment app after paying.' });
    if (store.txnUsed(txnId)) return res.status(400).json({ error: 'This Transaction ID was already used for another order.' });
  }
  const created = [];
  for (const g of groups.values()) {
    // Cash on Delivery: flat Rs 49 per order. Online payment: exact product price, nothing extra.
    const fee = payment === 'COD' && g.currency === 'INR' ? 49 : 0;
    created.push(store.addOrder({
      buyerId: req.user.id,
      buyerEmail: buyer && buyer.email,
      sellerId: g.sellerId,
      items: g.items,
      itemsTotal: g.total,
      deliveryCharge: fee,
      paymentMethod: payment,
      txnId,
      total: g.total + fee,
      currency: g.currency,
      name: f.name,
      phone: f.phone,
      address: f.address,
      city: f.city,
      country: f.country || (buyer && buyer.country) || 'IN',
      state: f.state || '',
      district: f.district || '',
      pincode: f.pincode,
      sellerShop: g.shop,
      sellerPhone: g.phone,
      gw: useGateway ? { provider: 'razorpay' } : undefined,
    }));
  }
  if (useGateway) {
    const o = created[0];
    try {
      const ro = await gateway.createOrder(gwSeller.gw, Math.round(o.total * 100), o.ref);
      o.gw.orderId = ro.id; store.setOrderGw(o.ref, { orderId: ro.id });
      return res.status(201).json({ orders: [oview(o)], order: oview(o), gateway: { keyId: gwSeller.gw.keyId, orderId: ro.id, amount: Math.round(o.total * 100), currency: 'INR', ref: o.ref, name: o.sellerShop || 'Stratic Market', prefill: { name: o.name, contact: o.phone, email: o.buyerEmail } } });
    } catch (e) {
      store.cancelUnpaidGateway(o.ref);
      return res.status(502).json({ error: 'Payment gateway is not reachable right now. Please try again or choose Cash on Delivery.' });
    }
  }
  // tell each seller by email when email is configured (never blocks the order)
  created.filter((o) => String(o.status).toUpperCase() !== 'PAYMENT_PENDING').forEach((o) => {
    try {
      const seller = store.findAccountById(o.sellerId);
      if (seller && seller.email) notifyOrder(seller.email, o).catch(function () {});
    } catch (e) {}
  });
  res.status(201).json({ orders: created.map(oview), order: oview(created[0]) });
});


// ================= Seller payment gateway (Razorpay) =================
router.get('/api/gateway', requireUser, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const a = store.findAccountById(req.user.id);
  res.json(a && a.gw ? { connected: true, provider: 'razorpay', keyId: gateway.mask(a.gw.keyId), mode: a.gw.mode } : { connected: false });
});
router.post('/api/gateway', csrf, authLimiter, requireUser, async (req, res) => {
  try {
    const gw = await gateway.connect(String(req.body.keyId || '').trim(), String(req.body.keySecret || '').trim());
    store.updateAccount(req.user.id, { gw });
    res.json({ connected: true, keyId: gateway.mask(gw.keyId), mode: gw.mode });
  } catch (e) { res.status(400).json({ error: e.status === 401 ? 'Razorpay rejected these keys. Check Key ID and Secret.' : e.message }); }
});
router.delete('/api/gateway', csrf, requireUser, (req, res) => { store.updateAccount(req.user.id, { gw: null }); res.json({ connected: false }); });
// The browser says "paid"; the SERVER checks Razorpay's signature and payment before confirming.
router.post('/api/pay/verify', csrf, requireUser, async (req, res) => {
  const b = req.body || {};
  const o = store.getOrder(String(b.ref || ''));
  if (!o || o.buyerId !== req.user.id || !o.gw || !o.gw.orderId) return res.status(404).json({ error: 'Order not found.' });
  if (String(o.status).toUpperCase() === 'CONFIRMED') return res.json({ order: oview(o) });
  const seller = store.findAccountById(o.sellerId);
  if (!seller || !seller.gw || b.razorpay_order_id !== o.gw.orderId) return res.status(400).json({ error: 'Payment could not be verified.' });
  const pid = String(b.razorpay_payment_id || '');
  if (!gateway.signatureOk(seller.gw, o.gw.orderId, pid, b.razorpay_signature)) return res.status(400).json({ error: 'Payment could not be verified. If money was deducted it will be refunded by your bank.' });
  try { if (!(await gateway.paymentIsPaid(seller.gw, pid, o.gw.orderId, Math.round(o.total * 100)))) return res.status(400).json({ error: 'Payment is not completed yet.' }); } catch (e) { /* signature already proves it; ignore lookup hiccup */ }
  const done = store.markGatewayPaid(o.ref, pid);
  if (done) { try { const sl = store.findAccountById(o.sellerId); if (sl && sl.email) notifyOrder(sl.email, done).catch(function () {}); } catch (e) {} }
  res.json({ order: oview(done || store.getOrder(o.ref)) });
});

// ================= Profile photo / name =================
router.post('/api/profile', csrf, requireUser, (req, res) => {
  const patch = {};
  const nm = clean(req.body.name, 60); if (nm) patch.name = nm;
  const av = String(req.body.avatar || '');
  if (av) { if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(av) || av.length > 90000) return res.status(400).json({ error: 'Photo is too big.' }); patch.avatar = av; }
  if (req.body.removeAvatar) patch.avatar = '';
  const a = store.updateAccount(req.user.id, patch);
  res.json({ ok: !!a, name: a && a.name, hasPhoto: !!(a && a.avatar) });
});
router.get('/api/avatar/:id', (req, res) => {
  const a = store.findAccountById(String(req.params.id || '').replace(/[^a-f0-9]/gi, ''));
  const m = a && a.avatar && String(a.avatar).match(/^data:image\/jpeg;base64,(.+)$/);
  if (!m) return res.status(404).end();
  res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=300' }).send(Buffer.from(m[1], 'base64'));
});

// ================= Advanced dashboard: 40 real cards x 3 time ranges =================
function advancedCards(uid, since) {
  const products = store.listAllProducts().filter((p) => p.sellerId === uid);
  const pids = new Set(products.map((p) => p.id));
  const all = store.listOrders({ sellerId: uid });
  const inR = (t) => new Date(t).getTime() >= since;
  const orders = all.filter((o) => inR(o.createdAt));
  const st = (o) => String(o.status || '').toUpperCase();
  const live = orders.filter((o) => st(o) !== 'CANCELLED' && st(o) !== 'PAYMENT_PENDING');
  const gwO = (o) => !!o.gw, qrO = (o) => o.paymentMethod === 'ONLINE' && !o.gw, codO = (o) => o.paymentMethod !== 'ONLINE';
  const sum = (l) => l.reduce((a, o) => a + (Number(o.total) || 0), 0);
  const cnt = (l, f) => { const m = {}; l.forEach((o) => { const k = f(o) || 'Not given'; m[k] = (m[k] || 0) + 1; }); return m; };
  const rows = (m, n) => Object.keys(m).map((k) => ({ label: k, value: m[k] })).sort((a, b) => b.value - a.value).slice(0, n || 8);
  const vT = products.flatMap((p) => store.viewTimes(p.id)), lT = products.flatMap((p) => store.likeTimes(p.id));
  const views = vT.filter((t) => t >= since).length, likes = lT.filter((t) => t >= since).length;
  const viewsAll = products.reduce((n, p) => n + store.productViewCount(p.id), 0), likesAll = products.reduce((n, p) => n + store.productLikeInfo(p.id, null).count, 0);
  const buyers = {}; live.forEach((o) => { const k = o.phoneKey || o.buyerId; buyers[k] = (buyers[k] || 0) + 1; });
  const units = live.reduce((n, o) => n + (o.items || []).reduce((a, it) => a + (Number(it.qty) || 1), 0), 0);
  const num = (id, icon, title, value, sub) => ({ id, icon, title, type: 'num', value: String(value), sub: sub || '' });
  const list = (id, icon, title, r, sub) => ({ id, icon, title, type: 'list', rows: r, sub: sub || '' });
  const byProd = (f) => rows(products.reduce((m, p) => { m[p.title] = f(p); return m; }, {}), 6).filter((r) => r.value > 0);
  const prodUnits = {}; live.forEach((o) => (o.items || []).forEach((it) => { prodUnits[it.title] = (prodUnits[it.title] || 0) + (Number(it.qty) || 1); }));
  const hours = {}; orders.forEach((o) => { const h = new Date(new Date(o.createdAt).getTime() + 19800000).getUTCHours(); const k = String(h).padStart(2, '0') + ':00'; hours[k] = (hours[k] || 0) + 1; });
  const days = {}; orders.forEach((o) => { const k = String(o.createdAt).slice(0, 10); days[k] = (days[k] || 0) + 1; });
  const revBy = {}; live.forEach((o) => { const c = o.currency || 'INR'; revBy[c] = (revBy[c] || 0) + (Number(o.total) || 0); });
  const price = { 'Under 500': 0, '500 – 2,000': 0, '2,000 – 10,000': 0, 'Above 10,000': 0 };
  products.forEach((p) => { const x = Number(p.price) || 0; price[x < 500 ? 'Under 500' : x < 2000 ? '500 – 2,000' : x < 10000 ? '2,000 – 10,000' : 'Above 10,000']++; });
  const payCountry = {}; orders.forEach((o) => { const k = (o.country || 'IN') + ' · ' + (codO(o) ? 'COD' : 'Online'); payCountry[k] = (payCountry[k] || 0) + 1; });
  return [
    num('orders', '🧾', 'Total orders', orders.length), num('confirmed', '✅', 'Confirmed orders', live.length),
    num('pending', '⏳', 'Waiting for payment', orders.filter((o) => st(o) === 'PAYMENT_PENDING').length),
    num('cancelled', '❌', 'Cancelled orders', orders.filter((o) => st(o) === 'CANCELLED').length),
    num('shipped', '🚚', 'Shipped', orders.filter((o) => st(o) === 'SHIPPED').length), num('delivered', '📦', 'Delivered', orders.filter((o) => st(o) === 'DELIVERED').length),
    num('revenue', '💰', 'Sales (INR)', '₹' + Math.round(sum(live.filter((o) => (o.currency || 'INR') === 'INR'))).toLocaleString('en-IN')),
    num('aov', '🧮', 'Average order (INR)', live.length ? '₹' + Math.round(sum(live) / live.length).toLocaleString('en-IN') : '—'),
    num('units', '🛍', 'Items sold', units), num('buyers', '👥', 'Unique buyers', Object.keys(buyers).length),
    num('repeat', '🔁', 'Repeat buyers', Object.values(buyers).filter((n) => n > 1).length),
    num('conv', '🎯', 'Views → orders', views ? (live.length / views * 100).toFixed(1) + '%' : '—'),
    num('views', '👁', 'Product views', views), num('viewsAll', '🌍', 'All-time views', viewsAll), num('likes', '♥', 'Likes', likes), num('likesAll', '💛', 'All-time likes', likesAll),
    num('cancelrate', '📉', 'Cancel rate', orders.length ? (orders.filter((o) => st(o) === 'CANCELLED').length / orders.length * 100).toFixed(1) + '%' : '—'), num('avgviews', '📈', 'Avg views per product', products.length ? (viewsAll / products.length).toFixed(1) : '—'),
    num('products', '📚', 'Products listed', products.length), num('noviews', '🙈', 'Products with no views', products.filter((p) => !store.productViewCount(p.id)).length),
    num('cod', '💵', 'Cash on Delivery orders', orders.filter(codO).length), num('qr', '📱', 'UPI QR orders', orders.filter(qrO).length),
    num('gw', '🏦', 'Gateway (card/UPI) orders', orders.filter(gwO).length), num('gwAmt', '💳', 'Gateway money received', '₹' + Math.round(sum(live.filter(gwO))).toLocaleString('en-IN')),
    num('codAmt', '🪙', 'COD value to collect', '₹' + Math.round(sum(live.filter(codO))).toLocaleString('en-IN')), num('pendAmt', '🕒', 'Payment pending value', '₹' + Math.round(sum(orders.filter((o) => st(o) === 'PAYMENT_PENDING'))).toLocaleString('en-IN')),
    list('country', '🌐', 'Orders by country', rows(cnt(orders, (o) => o.country || 'IN'))), list('currency', '💱', 'Sales by currency', rows(revBy).map((r) => ({ label: r.label, value: Math.round(r.value) }))),
    list('state', '🗺', 'Orders by state', rows(cnt(orders, (o) => o.state))), list('city', '🏙', 'Top cities', rows(cnt(orders, (o) => o.city), 6)),
    list('topviews', '🔥', 'Most viewed products', byProd((p) => store.productViewCount(p.id))), list('toplikes', '😍', 'Most liked products', byProd((p) => store.productLikeInfo(p.id, null).count)),
    list('topsold', '🏆', 'Best selling products', rows(prodUnits, 6)), list('paycountry', '🧭', 'Payment choice by country', rows(payCountry)),
    list('status', '📋', 'Orders by status', rows(cnt(orders, (o) => st(o)))), list('hour', '🕘', 'Busiest hours (IST)', rows(hours, 6)),
    list('day', '📅', 'Orders by day', rows(days, 7)), list('cat', '🗂', 'Products by category', rows(products.reduce((m, p) => { const k = p.category || 'Other'; m[k] = (m[k] || 0) + 1; return m; }, {}))),
    list('pcur', '🪪', 'Products by currency', rows(products.reduce((m, p) => { const k = p.currency || 'INR'; m[k] = (m[k] || 0) + 1; return m; }, {}))), list('price', '🏷', 'Products by price range', Object.keys(price).map((k) => ({ label: k, value: price[k] }))),
  ];
}
router.get('/api/advanced-dashboard', requireUser, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const now = Date.now(), out = {};
  [['24h', 864e5], ['7d', 7 * 864e5], ['30d', 30 * 864e5]].forEach(([k, ms]) => { out[k] = advancedCards(req.user.id, now - ms); });
  res.json({ ranges: out });
});
router.get('/api/orders', requireUser, (req, res) => {
  res.json({ orders: store.listOrders({ buyerId: req.user.id }).map(oview) });
});

router.get('/api/seller-orders', requireUser, (req, res) => {
  res.json({ orders: store.listOrders({ sellerId: req.user.id }).map((o) => oview(o, true)) });
});

router.delete('/api/orders/:ref', csrf, requireUser, (req, res) => {
  const ok = store.deleteOrder(req.params.ref, req.user.id);
  if (!ok) return res.status(404).json({ error: 'Order not found.' });
  res.json({ ok: true });
});

router.patch('/api/orders/:ref/status', csrf, requireUser, (req, res) => {
  const r = store.updateOrderStatus(req.params.ref, req.user.id, clean(req.body.status, 30) || 'CONFIRMED', clean(req.body.reason, 200));
  if (!r || r.error) return res.status(400).json({ error: (r && r.error) || 'Order not found or change not allowed.' });
  res.json({ order: oview(r.order) });
});

// —— Private admin dashboard ——
function adminToken() {
  return require('crypto').createHmac('sha256', ADMIN_PASS).update('admin-ok').digest('hex');
}
function readCookies(req) {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach((c) => {
    const i = c.indexOf('=');
    if (i > 0) cookies[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return cookies;
}
function isAdmin(req) {
  if (!ADMIN_PASS) return false;
  return readCookies(req).sgm_admin === adminToken();
}

router.get('/admin', (req, res) => {
  res.render('admin', { title: 'Dashboard' });
});

router.post('/api/admin/login', authLimiter, (req, res) => {
  const pass = String(req.body.password || '').trim();
  const a = Buffer.from(pass), bb = Buffer.from(ADMIN_PASS);
  const same = a.length === bb.length && require('crypto').timingSafeEqual(a, bb);
  if (!ADMIN_PASS || !pass || !same) {
    return res.status(401).json({ error: 'Wrong password. Check ADMIN_PASSWORD on Render (no extra spaces).' });
  }
  res.cookie('sgm_admin', adminToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' || process.env.RENDER === 'true',
    maxAge: 30 * 24 * 3600 * 1000,
    path: '/',
  });
  res.json({ ok: true });
});

router.post('/api/admin/logout', (req, res) => {
  res.clearCookie('sgm_admin', { path: '/' });
  res.json({ ok: true });
});

router.post('/api/admin/orders/:ref/verify', csrf, (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  // The owner must type the amount that really arrived. Less than the order total (even Rs 1 less) never confirms.
  const ref = clean(req.params.ref, 40), existing = store.getOrder(ref);
  if (!existing) return res.status(404).json({ error: 'Order not found.' });
  const got = Number(String((req.body || {}).amount == null ? '' : req.body.amount).replace(/,/g, ''));
  if (!Number.isFinite(got) || got <= 0) return res.status(400).json({ error: 'Enter the amount you received.' });
  if (Math.round(got * 100) < Math.round(Number(existing.total) * 100)) return res.status(400).json({ error: 'Received ' + got + ' is less than the order total ' + existing.total + '. Order NOT confirmed.' });
  const o = store.verifyPayment(ref);
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  try { const seller = store.findAccountById(o.sellerId); if (seller && seller.email) notifyOrder(seller.email, o).catch(function () {}); } catch (e) {}
  res.json({ ok: true });
});

router.post('/api/admin/orders/:ref/reject', csrf, (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  const o = store.rejectPayment(clean(req.params.ref, 40));
  if (!o) return res.status(404).json({ error: 'Order not found or already confirmed.' });
  res.json({ ok: true });
});

router.get('/api/admin/stats', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  res.json(store.dashboardStats());
});

module.exports = router;

const express = require('express');
const path = require('path');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const store = require('../services/shop-store');
const { notifyOrder } = require('../services/brevo');
const { bcrypt, setSession, clearSession, attachUser, requireUser, csrf } = require('../services/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });
const pick = upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'extra', maxCount: 4 }]);
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false });
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
  next();
});

router.get('/', (req, res) => {
  // Each device is counted only once (owner opens included).
  store.recordVisit(req.devId);
  res.render('shop', { title: 'Stratic Market' });
});

router.get('/img/:id', async (req, res) => {
  const i = Number(req.query.i) || 0;
  let fp = store.imagePath(req.params.id, i);
  try {
    if (!require('fs').existsSync(fp)) {
      const nm = require('path').basename(fp, '.jpg');
      fp = await store.ensureImage(nm);
    }
  } catch (e) { fp = null; }
  if (!fp) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=86400');
  res.sendFile(fp, (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
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
    if (digits.length < 7 || digits.length > 15) return res.status(400).json({ error: 'Enter a valid mobile number with country code.' });
    phone = '+' + digits;
  }
  const key = store.normPhone(phone);
  // Same Gmail + same mobile  -> your old account (all products come back).
  // Same Gmail + other mobile, or other Gmail + same mobile -> a brand new empty account.
  let u = store.findAccountByPair(email, key);
  if (u) {
    const patch = { country, lang };
    if (!u.googleId) patch.googleId = pending.gid;
    u = store.updateAccount(u.id, patch) || u;
  } else {
    const legacy = store.findPhonelessByEmail(email); // old Google account that never had a mobile saved
    if (legacy) {
      u = store.updateAccount(legacy.id, { phone, phoneKey: key, country, lang, googleId: legacy.googleId || pending.gid });
    } else {
      u = store.createAccount({
        name: pending.name || email.split('@')[0],
        email,
        passwordHash: await bcrypt.hash(require('crypto').randomBytes(16).toString('hex'), 10),
        phone,
        phoneKey: key,
        country,
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
  if (req.body.lang) patch.lang = clean(req.body.lang, 8);
  if (req.body.country) patch.country = clean(req.body.country, 4).toUpperCase();
  if (req.body.name) patch.name = clean(req.body.name, 60);
  const u = store.updateAccount(req.user.id, patch);
  res.json({ user: userOut(u) });
});

function pview(p, user) {
  const price = Number(p.price);
  const mrp = Number(p.mrp) || 0;
  return {
    id: p.id,
    title: p.title,
    seller: p.shopName,
    city: p.city,
    country: p.country || 'IN',
    description: p.description,
    price,
    mrp,
    currency: p.currency || 'INR',
    category: p.category,
    days: p.days || 5,
    phone: p.sellerPhone || '',
    mine: !!(user && user.id === p.sellerId),
    off: mrp > price ? Math.round((1 - price / mrp) * 100) : 0,
    img: '/shop/img/' + p.id,
    imgs: Array.from({ length: Math.max(1, Number(p.imgCount) || 1) }, (_, k) => '/shop/img/' + p.id + (k ? '?i=' + k : '')),
    createdAt: p.createdAt,
    likes: store.productLikeInfo(p.id, user && user.id).count,
    liked: store.productLikeInfo(p.id, user && user.id).liked,
  };
}

router.get('/api/products', (req, res) => {
  const country = (req.query.country || (req.user && req.user.country) || '').toUpperCase();
  const list = store.listProducts(country || null).map((p) => pview(p, req.user));
  res.json({ products: list });
});

router.get('/api/my-products', requireUser, (req, res) => {
  const products = store.listAllProducts().filter((p) => p.sellerId === req.user.id).map((p) => pview(p, req.user));
  res.json({ products });
});

router.post('/api/products/:id/like', csrf, requireUser, (req, res) => {
  const p = store.getProduct(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  const me = store.findAccountById(req.user.id);
  const key = me ? store.normPhone(me.phoneKey || me.phone) : '';
  if (!key) return res.status(400).json({ error: 'Add your mobile number first: log out and log in with Google once, then enter your number.' });
  if (p.sellerId === req.user.id || store.normPhone(p.sellerPhoneKey || p.sellerPhone) === key) {
    return res.status(400).json({ error: 'You cannot like your own product.' });
  }
  const result = store.toggleProductLike(p.id, req.user.id);
  if (!result) return res.status(404).json({ error: 'Product not found.' });
  res.json(result);
});

// One view per device per product (the same device opening again adds nothing).
router.post('/api/products/:id/view', csrf, (req, res) => {
  const n = store.recordProductView(req.params.id, req.devId);
  res.json({ ok: true, views: n });
});

router.get('/api/product-dashboard', requireUser, (req, res) => {
  const products = store.listAllProducts().filter((p) => p.sellerId === req.user.id);
  const allOrders = store.listOrders({ sellerId: req.user.id });
  const isCancelled = (o) => String(o.status || '').toUpperCase() === 'CANCELLED';
  const has = (o, pid) => (o.items || []).some((it) => (it.id || it.productId) === pid);
  const qtyOf = (o, pid) => (o.items || []).filter((it) => (it.id || it.productId) === pid).reduce((a, it) => a + (Number(it.qty) || 1), 0);
  const bought = {}; // country -> orders (all products)
  const buyers = new Set();
  const details = products.map((p) => {
    const matching = allOrders.filter((o) => has(o, p.id));
    const live = matching.filter((o) => !isCancelled(o));
    const cancelled = matching.filter(isCancelled);
    const countries = {};
    live.forEach((o) => {
      const c = String(o.country || 'IN').toUpperCase();
      countries[c] = (countries[c] || 0) + 1;
      bought[c] = (bought[c] || 0) + 1;
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
    countriesBought: bought,
    countriesNotBought: known.filter((c) => !bought[c]),
  });
});

router.post('/api/products', csrf, requireUser, pick, (req, res) => {
  const b = req.body || {};
  const title = clean(b.title || b.name, 120);
  const price = Number(b.price);
  const phone = clean(b.phone, 20);
  const address = clean(b.address, 200);
  if (!title || !Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ error: 'Product name and valid price required.' });
  }
  if (!/^[\d +()-]{7,20}$/.test(phone) || !address) {
    return res.status(400).json({ error: 'Seller phone and address required.' });
  }
  const mainFile = req.files && req.files.photo && req.files.photo[0];
  if (!mainFile || !mainFile.buffer || mainFile.buffer.length < 100) {
    return res.status(400).json({ error: 'Product photo required.' });
  }
  const extraBufs = ((req.files && req.files.extra) || []).map((f) => f.buffer).filter((x) => x && x.length > 100);
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
      country: (full && full.country) || 'IN',
      title,
      description: clean(b.description, 2000),
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
    extraBufs
  );
  res.status(201).json({ product: pview(p, req.user) });
});

router.delete('/api/products/:id', csrf, requireUser, (req, res) => {
  const ok = store.deleteProduct(req.params.id, req.user.id);
  if (!ok) return res.status(404).json({ error: 'Product not found.' });
  res.json({ ok: true });
});

function oview(o) {
  return {
    ref: o.ref,
    status: String(o.status || 'CONFIRMED').toUpperCase(),
    total: o.total,
    currency: o.currency,
    createdAt: o.createdAt,
    items: o.items,
    seller: { shop: o.sellerShop, phone: o.sellerPhone },
    buyer: {
      name: o.name,
      phone: o.phone,
      address: o.address,
      city: o.city,
      country: o.country,
      state: o.state || '',
      pincode: o.pincode,
    },
  };
}

router.post('/api/orders', csrf, requireUser, (req, res) => {
  const b = req.body || {};
  const f = {};
  for (const k of ['name', 'phone', 'address', 'city', 'state', 'country', 'pincode']) {
    f[k] = clean(b[k], k === 'address' ? 200 : 80);
  }
  if (!f.name || !f.address || !f.city) return res.status(400).json({ error: 'Name, address and city required.' });
  if (!/^[\d +()-]{7,20}$/.test(f.phone)) return res.status(400).json({ error: 'Enter a valid phone number.' });

  // The buyer's mobile number is tied to ONE account (same rule as sellers).
  const formKey = store.normPhone(f.phone);
  const owner = store.findAccountByPhone(f.phone);
  let buyer = store.findAccountById(req.user.id);
  const sameBuyerMobile = buyer && buyer.phoneKey && store.normPhone(buyer.phoneKey) === formKey;
  if (owner && owner.id !== req.user.id && !sameBuyerMobile) {
    return res.status(400).json({ error: 'This mobile number belongs to another account. Use your own number.' });
  }
  if (buyer && !buyer.phoneKey && formKey) buyer = store.updateAccount(req.user.id, { phone: f.phone, phoneKey: formKey }) || buyer;
  const buyerKeys = new Set([formKey, buyer && store.normPhone(buyer.phoneKey)].filter(Boolean));

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
      return res.status(400).json({ error: 'You cannot buy your own product.' });
    }
    const seller = store.findAccountById(p.sellerId);
    const sellerKeys = [store.normPhone(p.sellerPhoneKey || p.sellerPhone), seller && store.normPhone(seller.phoneKey)].filter(Boolean);
    if (sellerKeys.some((k) => buyerKeys.has(k))) {
      return res.status(400).json({
        error: 'You cannot buy a product listed with your own mobile number. Use a different person / phone.',
      });
    }
    const qty = Math.min(Math.max(Number(it.qty) || 1, 1), 10);
    if (!groups.has(p.sellerId)) groups.set(p.sellerId, { sellerId: p.sellerId, shop: p.shopName, phone: p.sellerPhone, items: [], total: 0, currency: p.currency || 'INR' });
    const g = groups.get(p.sellerId);
    g.items.push({ id: p.id, title: p.title, price: p.price, qty, currency: p.currency });
    g.total += p.price * qty;
  }

  const created = [];
  for (const g of groups.values()) {
    created.push(store.addOrder({
      buyerId: req.user.id,
      buyerEmail: buyer && buyer.email,
      sellerId: g.sellerId,
      items: g.items,
      total: g.total,
      currency: g.currency,
      name: f.name,
      phone: f.phone,
      address: f.address,
      city: f.city,
      country: f.country || (buyer && buyer.country) || 'IN',
      state: f.state || '',
      pincode: f.pincode,
      sellerShop: g.shop,
      sellerPhone: g.phone,
    }));
  }
  // tell each seller by email when email is configured (never blocks the order)
  created.forEach((o) => {
    try {
      const seller = store.findAccountById(o.sellerId);
      if (seller && seller.email) notifyOrder(seller.email, o).catch(function () {});
    } catch (e) {}
  });
  res.status(201).json({ orders: created.map(oview), order: oview(created[0]) });
});

router.get('/api/orders', requireUser, (req, res) => {
  res.json({ orders: store.listOrders({ buyerId: req.user.id }).map(oview) });
});

router.get('/api/seller-orders', requireUser, (req, res) => {
  res.json({ orders: store.listOrders({ sellerId: req.user.id }).map(oview) });
});

router.delete('/api/orders/:ref', csrf, requireUser, (req, res) => {
  const ok = store.deleteOrder(req.params.ref, req.user.id);
  if (!ok) return res.status(404).json({ error: 'Order not found.' });
  res.json({ ok: true });
});

router.patch('/api/orders/:ref/status', csrf, requireUser, (req, res) => {
  const o = store.updateOrderStatus(req.params.ref, req.user.id, clean(req.body.status, 30) || 'CONFIRMED');
  if (!o) return res.status(404).json({ error: 'Order not found or change not allowed.' });
  res.json({ order: oview(o) });
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

router.get('/api/admin/stats', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  res.json(store.dashboardStats());
});

module.exports = router;

const express = require('express');
const path = require('path');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const store = require('../services/shop-store');
const { notifyOrder } = require('../services/brevo');
const { bcrypt, setSession, clearSession, attachUser, requireUser, csrf } = require('../services/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });
const pick = upload.single('photo');
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false });
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'Eiejejdieh9ddbs8hauggHHTT^%^TGdyr73geuegr7rgrirhrgGVVVGFT^^e7e737374yhfCCVGR#$@#%^agweue7egeyeuegeuevrurveueveurviwwb383y373u7373y3gr7eve8sjw9wge9egwowve8rvr83feiegr8rhe';

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
  await new Promise((r) => attachUser(req, res, r));
  if (!req.user && req.cookies && req.cookies.sgm_uid) {
    const u = store.findAccountById(req.cookies.sgm_uid);
    if (u) req.user = { id: u.id, name: u.name, email: u.email, phone: u.phone, country: u.country, lang: u.lang };
  }
  if (req.user) {
    const full = store.findAccountById(req.user.id);
    if (full) req.user = { id: full.id, name: full.name, email: full.email, phone: full.phone, country: full.country, lang: full.lang };
  }
  next();
});

router.get('/', (req, res) => res.render('shop', { title: 'Stratic Market' }));

router.get('/img/:id', (req, res) => {
  const fp = store.imagePath(req.params.id);
  res.sendFile(fp, (err) => {
    if (err) res.status(404).end();
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

    // ONE Gmail = ONE account forever (googleId OR email match)
    let u = store.findAccountByGoogle(ui.id) || store.findAccountByEmail(email);
    if (u) {
      const patch = {};
      if (!u.googleId) patch.googleId = ui.id;
      if (ui.name && !u.name) patch.name = ui.name;
      if (normEmail(u.email) !== email) patch.email = email;
      if (Object.keys(patch).length) store.updateAccount(u.id, patch);
      setSession(res, u.id);
      res.cookie('sgm_uid', u.id, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000, path: '/' });
      res.clearCookie('sgm_gpending', { path: '/' });
      return res.redirect('/shop?ok=1');
    }

    // New Google user → need phone once
    res.cookie(
      'sgm_gpending',
      JSON.stringify({ gid: ui.id, email: email, name: ui.name || email.split('@')[0] }),
      { httpOnly: true, maxAge: 900000, sameSite: 'lax', path: '/', secure: true }
    );
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
  if (!pending || !pending.email) return res.status(400).json({ error: 'Google session expired. Try again.' });
  pending.email = normEmail(pending.email);
  // If account appeared meanwhile (same Gmail), just login — never second ID
  {
    const existing = store.findAccountByGoogle(pending.gid) || store.findAccountByEmail(pending.email);
    if (existing) {
      if (!existing.googleId) store.updateAccount(existing.id, { googleId: pending.gid });
      setSession(res, existing.id);
      res.cookie('sgm_uid', existing.id, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000, path: '/' });
      res.clearCookie('sgm_gpending', { path: '/' });
      return res.json({ user: userOut(existing) });
    }
  }
  const phone = clean(req.body.phone, 20);
  const country = clean(req.body.country, 4).toUpperCase() || 'IN';
  const lang = clean(req.body.lang, 8) || 'en';
  if (!/^[\d +()-]{7,20}$/.test(phone)) return res.status(400).json({ error: 'Valid mobile required.' });
  if (store.findAccountByPhone(phone)) {
    return res.status(400).json({ error: 'This mobile is already linked to another account.' });
  }
  let u = store.findAccountByEmail(pending.email);
  if (!u) {
    u = store.createAccount({
      name: pending.name || pending.email.split('@')[0],
      email: pending.email,
      passwordHash: await bcrypt.hash(require('crypto').randomBytes(16).toString('hex'), 10),
      phone,
      phoneKey: store.normPhone(phone),
      country,
      lang,
      googleId: pending.gid,
    });
  } else {
    u = store.updateAccount(u.id, {
      phone,
      phoneKey: store.normPhone(phone),
      country,
      lang,
      googleId: pending.gid,
    });
  }
  if (!u) return res.status(400).json({ error: 'Could not save.' });
  res.clearCookie('sgm_gpending');
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
    createdAt: p.createdAt,
  };
}

router.get('/api/products', (req, res) => {
  const country = (req.query.country || (req.user && req.user.country) || '').toUpperCase();
  const list = store.listProducts(country || null).map((p) => pview(p, req.user));
  res.json({ products: list });
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
  if (!req.file || !req.file.buffer || req.file.buffer.length < 100) {
    return res.status(400).json({ error: 'Product photo required.' });
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
    req.file.buffer
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
    status: o.status,
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
      pincode: o.pincode,
    },
  };
}

router.post('/api/orders', csrf, requireUser, (req, res) => {
  const b = req.body || {};
  const f = {};
  for (const k of ['name', 'phone', 'address', 'city', 'country', 'pincode']) {
    f[k] = clean(b[k], k === 'address' ? 200 : 80);
  }
  if (!f.name || !f.address || !f.city) return res.status(400).json({ error: 'Name, address and city required.' });
  if (!/^[\d +()-]{7,20}$/.test(f.phone)) return res.status(400).json({ error: 'Enter a valid phone number.' });

  const buyer = store.findAccountById(req.user.id);
  const buyerKey = store.normPhone(f.phone) || (buyer && buyer.phoneKey) || '';

  let items = b.items;
  if (!Array.isArray(items) || !items.length) {
    // single product buy-now
    if (b.productId) items = [{ id: b.productId, qty: 1 }];
    else return res.status(400).json({ error: 'No items.' });
  }

  const built = [];
  let total = 0;
  let currency = 'INR';
  let sellerId = null;
  let sellerShop = '';
  let sellerPhone = '';

  for (const it of items) {
    const p = store.getProduct(it.id || it.productId);
    if (!p) return res.status(400).json({ error: 'Product not found.' });
    if (p.sellerId === req.user.id) {
      return res.status(400).json({ error: 'You cannot buy your own product.' });
    }
    const pKey = p.sellerPhoneKey || store.normPhone(p.sellerPhone);
    if (buyerKey && pKey && buyerKey === pKey) {
      return res.status(400).json({
        error: 'Same mobile number cannot buy this product. Use a different phone number / account.',
      });
    }
    const qty = Math.min(Math.max(Number(it.qty) || 1, 1), 10);
    built.push({ id: p.id, title: p.title, price: p.price, qty, currency: p.currency });
    total += p.price * qty;
    currency = p.currency || currency;
    sellerId = p.sellerId;
    sellerShop = p.shopName;
    sellerPhone = p.sellerPhone;
  }

  const order = store.addOrder({
    buyerId: req.user.id,
    sellerId,
    items: built,
    total,
    currency,
    name: f.name,
    phone: f.phone,
    address: f.address,
    city: f.city,
    country: f.country || (buyer && buyer.country) || 'IN',
    pincode: f.pincode,
    sellerShop,
    sellerPhone,
  });
  res.status(201).json({ order: oview(order) });
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
  const o = store.updateOrderStatus(req.params.ref, req.user.id, clean(req.body.status, 30) || 'confirmed');
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  // email seller if possible
  try {
    const seller = store.findAccountById(o.sellerId);
    if (seller && seller.email) notifyOrder(seller.email, o).catch(function () {});
  } catch (e) {}
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
  return readCookies(req).sgm_admin === adminToken();
}

router.get('/admin', (req, res) => {
  res.render('admin', { title: 'Dashboard' });
});

router.post('/api/admin/login', authLimiter, (req, res) => {
  const pass = String(req.body.password || '').trim();
  if (!pass || pass !== ADMIN_PASS.trim()) {
    return res.status(401).json({ error: 'Wrong password. Check ADMIN_PASSWORD on Render (no extra spaces).' });
  }
  res.cookie('sgm_admin', adminToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: 12 * 3600 * 1000,
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

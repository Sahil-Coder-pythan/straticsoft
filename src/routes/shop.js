const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const store = require('../services/shop-store');
const { bcrypt, setSession, clearSession, attachUser, requireUser, csrf } = require('../services/auth');

const router = express.Router();
const CATS = ['Mobiles', 'Fashion', 'Electronics', 'Home & Kitchen', 'Other'];
const CUR = ['INR', 'USD', 'EUR', 'GBP', 'AED'];
const clean = (s, n) => String(s || '').replace(/[<>]/g, '').trim().slice(0, n);
const num = (v) => Math.round(Number(v) * 100) / 100;
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again later.' },
});
const photo = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: 1 } });
const pick = (req, res, next) =>
  photo.single('photo')(req, res, (e) => {
    if (e) {
      e.status = 400;
      e.message = 'Photo is too large or invalid.';
    }
    next(e);
  });

// Attach user from file-store accounts
router.use(async (req, res, next) => {
  try {
    await attachUser(req, res, () => {});
  } catch (_) {}
  // If cookie session id exists, resolve from file store
  const sid = req.cookies && (req.cookies.sgm_uid || req.cookies.sid);
  if (!req.user && sid) {
    const u = store.findAccountById(sid);
    if (u) req.user = { id: u.id, name: u.name, email: u.email };
  }
  next();
});

router.get('/', (req, res) => res.render('shop', { title: 'Stratic Market' }));

router.get('/img/:id', (req, res) => {
  const buf = store.readImage(req.params.id);
  if (!buf) return res.status(404).end();
  res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' }).send(buf);
});

const userOut = (u) => (u ? { id: u.id, name: u.name, email: u.email } : null);

router.get('/api/me', (req, res) => res.json({ user: userOut(req.user) }));

router.post('/api/register', csrf, authLimiter, async (req, res) => {
  const name = clean(req.body.name, 60);
  const email = clean(req.body.email, 120).toLowerCase();
  const password = String(req.body.password || '');
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6 || password.length > 100) {
    return res.status(400).json({ error: 'Name, valid email and password (min 6) required.' });
  }
  if (store.findAccountByEmail(email)) {
    return res.status(400).json({ error: 'This email is already registered. Please log in.' });
  }
  const hash = await bcrypt.hash(password, 10);
  const u = store.createAccount({ name, email, passwordHash: hash });
  if (!u) return res.status(400).json({ error: 'Could not create account.' });
  setSession(res, u.id);
  res.cookie('sgm_uid', u.id, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
  res.status(201).json({ user: userOut(u) });
});

router.post('/api/login', csrf, authLimiter, async (req, res) => {
  const email = clean(req.body.email, 120).toLowerCase();
  const u = store.findAccountByEmail(email);
  if (!u || !(await bcrypt.compare(String(req.body.password || ''), u.passwordHash))) {
    return res.status(400).json({ error: 'Wrong email or password.' });
  }
  setSession(res, u.id);
  res.cookie('sgm_uid', u.id, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
  res.json({ user: userOut(u) });
});

router.post('/api/logout', csrf, (req, res) => {
  clearSession(res);
  res.clearCookie('sgm_uid');
  res.json({ ok: true });
});

function pview(p, user) {
  const price = Number(p.price);
  const mrp = Number(p.mrp) || 0;
  return {
    id: p.id,
    title: p.title,
    seller: p.shopName,
    city: p.city,
    description: p.description,
    price,
    mrp,
    currency: p.currency,
    category: p.category,
    days: p.days,
    phone: p.sellerPhone || '',
    expiresAt: p.expiresAt || null,
    off: mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0,
    image: '/shop/img/' + p.id,
    mine: !!(user && user.id === p.sellerId),
    createdAt: p.createdAt,
  };
}

router.get('/api/products', (req, res) => {
  try {
    const list = store.listProducts();
    res.json({ products: list.map((p) => pview(p, req.user)) });
  } catch (e) {
    console.error('products list', e);
    res.json({ products: [] });
  }
});

router.post('/api/products', csrf, requireUser, pick, (req, res) => {
  const f = req.file;
  const b = req.body;
  if (!f || f.buffer.length < 4) return res.status(400).json({ error: 'Add a product photo.' });
  const title = clean(b.title, 140);
  const shopName = clean(b.seller, 60);
  const price = num(b.price);
  const mrp = b.mrp ? num(b.mrp) : 0;
  if (!title || !shopName) return res.status(400).json({ error: 'Title and shop name are required.' });
  if (!(price > 0) || price > 1e9) return res.status(400).json({ error: 'Enter a valid price.' });
  if (mrp && mrp <= price) return res.status(400).json({ error: 'MRP must be higher than price.' });
  const phone = clean(b.phone, 20);
  const address = clean(b.address, 300);
  if (!/^[\d +()-]{7,20}$/.test(phone) || !address) {
    return res.status(400).json({ error: 'Enter mobile number and address.' });
  }
  let expiresAt = null;
  if (b.expiresAt) {
    expiresAt = new Date(b.expiresAt);
    if (isNaN(expiresAt.getTime())) return res.status(400).json({ error: 'Invalid expiry date.' });
    // Allow today — compare end-of-day
    const end = new Date(expiresAt);
    end.setHours(23, 59, 59, 999);
    const now = new Date();
    if (end < now) {
      return res.status(400).json({ error: 'EXPIRED PRODUCT REJECTED. Do not list expired items.' });
    }
  }
  if (store.countBySeller(req.user.id) >= 200) {
    return res.status(400).json({ error: 'Product limit reached (200).' });
  }
  const p = store.addProduct(
    {
      sellerId: req.user.id,
      shopName,
      city: clean(b.city, 60),
      title,
      description: clean(b.description, 500),
      price,
      mrp,
      currency: CUR.includes(b.currency) ? b.currency : 'INR',
      category: CATS.includes(b.category) ? b.category : 'Other',
      days: Math.min(Math.max(Math.round(Number(b.days)) || 5, 1), 60),
      sellerPhone: phone,
      sellerAddress: address,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
    },
    f.buffer
  );
  res.status(201).json({ product: pview(p, req.user) });
});

router.delete('/api/products/:id', csrf, requireUser, (req, res) => {
  const ok = store.deleteProduct(req.params.id, req.user.id);
  res.status(ok ? 200 : 404).json(ok ? { ok: true } : { error: 'Not found.' });
});

function oview(o) {
  return {
    ref: o.ref,
    status: o.status,
    payment: o.paymentMethod || 'COD',
    currency: o.currency,
    total: Number(o.total),
    createdAt: o.createdAt,
    seller: { shop: o.sellerShop, phone: o.sellerPhone },
    buyer: {
      name: o.name,
      phone: o.phone,
      address: o.address,
      city: o.city,
      country: o.country,
      pincode: o.pincode,
    },
    items: (o.items || []).map((i) => ({
      title: i.title,
      qty: i.qty,
      price: Number(i.unitPrice),
    })),
  };
}

router.post('/api/orders', csrf, requireUser, (req, res) => {
  const b = req.body;
  const f = {};
  for (const k of ['name', 'phone', 'address', 'city', 'country', 'pincode']) {
    f[k] = clean(b[k], k === 'address' ? 300 : 80);
    if (!f[k]) return res.status(400).json({ error: 'Please fill all delivery details.' });
  }
  if (!/^[\d +()-]{7,20}$/.test(f.phone)) return res.status(400).json({ error: 'Enter a valid phone number.' });
  const raw = Array.isArray(b.items) ? b.items.slice(0, 15) : [];
  const want = new Map();
  raw.forEach((i) => {
    const q = Math.min(Math.max(parseInt(i.qty, 10) || 1, 1), 10);
    if (typeof i.id === 'string') want.set(i.id, q);
  });
  if (!want.size) return res.status(400).json({ error: 'Your cart is empty.' });

  const prods = [...want.keys()].map((id) => store.getProduct(id)).filter(Boolean);
  if (!prods.length) return res.status(400).json({ error: 'These products are no longer available.' });
  if (prods.some((p) => p.sellerId === req.user.id)) {
    return res.status(400).json({ error: 'You cannot buy your own product.' });
  }

  const groups = new Map();
  prods.forEach((p) => {
    const k = p.sellerId + '|' + p.currency;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  });

  const created = [];
  for (const list of groups.values()) {
    const total =
      Math.round(list.reduce((s, p) => s + Number(p.price) * want.get(p.id), 0) * 100) / 100;
    created.push({
      id: crypto.randomBytes(8).toString('hex'),
      ref: 'SM-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      buyerId: req.user.id,
      sellerId: list[0].sellerId,
      currency: list[0].currency,
      total,
      sellerPhone: list[0].sellerPhone,
      sellerShop: list[0].shopName,
      paymentMethod: 'COD',
      status: 'CONFIRMED',
      ...f,
      items: list.map((p) => ({
        productId: p.id,
        title: p.title,
        unitPrice: p.price,
        qty: want.get(p.id),
      })),
      createdAt: new Date().toISOString(),
    });
  }
  store.createOrders(created);
  res.status(201).json({ orders: created.map(oview) });
});

router.get('/api/orders', requireUser, (req, res) => {
  res.json({ orders: store.ordersByBuyer(req.user.id).map(oview) });
});

router.get('/api/seller-orders', requireUser, (req, res) => {
  res.json({ orders: store.ordersBySeller(req.user.id).map(oview) });
});

router.patch('/api/orders/:ref/status', csrf, requireUser, (req, res) => {
  const s = String(req.body.status || '');
  const o = store.findOrderByRef(req.params.ref);
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  const seller = o.sellerId === req.user.id;
  const buyer = o.buyerId === req.user.id;
  if (!seller && !buyer) return res.status(403).json({ error: 'Not allowed.' });
  const ok = ['CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  if (!ok.includes(s)) return res.status(400).json({ error: 'Invalid status.' });
  const u = store.updateOrderStatus(req.params.ref, s);
  res.json({ order: oview(u) });
});

module.exports = router;

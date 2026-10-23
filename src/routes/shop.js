const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { prisma } = require('../db/prisma');
const { bcrypt, setSession, clearSession, attachUser, requireUser, csrf } = require('../services/auth');
const router = express.Router();
const CATS = ['Mobiles', 'Fashion', 'Electronics', 'Home & Kitchen', 'Other'];
const CUR = ['INR', 'USD', 'EUR', 'GBP', 'AED'];
const clean = (s, n) => String(s || '').replace(/[<>]/g, '').trim().slice(0, n);
const num = v => Math.round(Number(v) * 100) / 100;
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many attempts. Try again later.' } });
const photo = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });
const pick = (req, res, next) => photo.single('photo')(req, res, e => { if (e) { e.status = 400; e.message = 'Photo is too large or invalid.'; } next(e); });
router.use(attachUser);
router.get('/', (req, res) => res.render('shop', { title: 'Stratic Market' }));
router.get('/img/:id', async (req, res) => {
  const p = await prisma.product.findUnique({ where: { id: req.params.id }, select: { image: true } });
  if (!p) return res.status(404).end();
  res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' }).send(Buffer.from(p.image));
});
const userOut = u => u ? { id: u.id, name: u.name, email: u.email } : null;
router.get('/api/me', (req, res) => res.json({ user: userOut(req.user) }));
router.post('/api/register', csrf, authLimiter, async (req, res) => {
  const name = clean(req.body.name, 60), email = clean(req.body.email, 120).toLowerCase(), password = String(req.body.password || '');
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 100) return res.status(400).json({ error: 'Enter name, a valid email and a password of at least 8 characters.' });
  if (await prisma.account.findUnique({ where: { email } })) return res.status(400).json({ error: 'This email is already registered. Please log in.' });
  const u = await prisma.account.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 10) } });
  setSession(res, u.id); res.status(201).json({ user: userOut(u) });
});
router.post('/api/login', csrf, authLimiter, async (req, res) => {
  const email = clean(req.body.email, 120).toLowerCase(), u = await prisma.account.findUnique({ where: { email } });
  if (!u || !(await bcrypt.compare(String(req.body.password || ''), u.passwordHash))) return res.status(400).json({ error: 'Wrong email or password.' });
  setSession(res, u.id); res.json({ user: userOut(u) });
});
router.post('/api/logout', csrf, (req, res) => { clearSession(res); res.json({ ok: true }); });
const SEL = { id: true, sellerId: true, shopName: true, city: true, title: true, description: true, price: true, mrp: true, currency: true, category: true, days: true, createdAt: true };
function pview(p, user) {
  const price = Number(p.price), mrp = Number(p.mrp);
  return { id: p.id, title: p.title, seller: p.shopName, city: p.city, description: p.description, price, mrp, currency: p.currency, category: p.category,
    days: p.days, off: mrp > price ? Math.round((mrp - price) / mrp * 100) : 0, image: '/shop/img/' + p.id, mine: !!user && user.id === p.sellerId, createdAt: p.createdAt };
}
router.get('/api/products', async (req, res) => {
  const l = await prisma.product.findMany({ orderBy: { createdAt: 'desc' }, take: 200, select: SEL });
  res.json({ products: l.map(p => pview(p, req.user)) });
});
router.post('/api/products', csrf, requireUser, pick, async (req, res) => {
  const f = req.file, b = req.body;
  if (!f || f.buffer.length < 4 || f.buffer[0] !== 0xff || f.buffer[1] !== 0xd8) return res.status(400).json({ error: 'Add a product photo.' });
  const title = clean(b.title, 140), shopName = clean(b.seller, 60), price = num(b.price), mrp = b.mrp ? num(b.mrp) : 0;
  if (!title || !shopName) return res.status(400).json({ error: 'Title and shop name are required.' });
  if (!(price > 0) || price > 1e9) return res.status(400).json({ error: 'Enter a valid price.' });
  if (mrp && mrp <= price) return res.status(400).json({ error: 'Original price must be higher than the selling price.' });
  const phone = clean(b.phone, 20), address = clean(b.address, 300);
  if (!/^[\d +()-]{7,20}$/.test(phone) || !address) return res.status(400).json({ error: 'Enter your mobile number and address.' });
  if ((await prisma.product.count({ where: { sellerId: req.user.id } })) >= 200) return res.status(400).json({ error: 'Product limit reached (200).' });
  const p = await prisma.product.create({ data: { sellerId: req.user.id, shopName, city: clean(b.city, 60), title, description: clean(b.description, 500), price, mrp,
    currency: CUR.includes(b.currency) ? b.currency : 'INR', category: CATS.includes(b.category) ? b.category : 'Other',
    days: Math.min(Math.max(Math.round(Number(b.days)) || 5, 1), 60), sellerPhone: phone, sellerAddress: address, image: f.buffer }, select: SEL });
  res.status(201).json({ product: pview(p, req.user) });
});
router.delete('/api/products/:id', csrf, requireUser, async (req, res) => {
  const r = await prisma.product.deleteMany({ where: { id: req.params.id, sellerId: req.user.id } });
  res.status(r.count ? 200 : 404).json(r.count ? { ok: true } : { error: 'Not found.' });
});
function oview(o) {
  return { ref: o.ref, status: o.status, payment: o.paymentMethod, currency: o.currency, total: Number(o.total), createdAt: o.createdAt,
    seller: { shop: o.sellerShop, phone: o.sellerPhone },
    buyer: { name: o.name, phone: o.phone, address: o.address, city: o.city, country: o.country, pincode: o.pincode },
    items: o.items.map(i => ({ title: i.title, qty: i.qty, price: Number(i.unitPrice) })) };
}
router.post('/api/orders', csrf, requireUser, async (req, res) => {
  const b = req.body, f = {};
  for (const k of ['name', 'phone', 'address', 'city', 'country', 'pincode']) { f[k] = clean(b[k], k === 'address' ? 300 : 80); if (!f[k]) return res.status(400).json({ error: 'Please fill all delivery details.' }); }
  if (!/^[\d +()-]{7,20}$/.test(f.phone)) return res.status(400).json({ error: 'Enter a valid phone number.' });
  const raw = Array.isArray(b.items) ? b.items.slice(0, 15) : [];
  const want = new Map(); raw.forEach(i => { const q = Math.min(Math.max(parseInt(i.qty, 10) || 1, 1), 10); if (typeof i.id === 'string') want.set(i.id, q); });
  if (!want.size) return res.status(400).json({ error: 'Your cart is empty.' });
  const prods = await prisma.product.findMany({ where: { id: { in: [...want.keys()] } }, select: { id: true, sellerId: true, shopName: true, sellerPhone: true, title: true, price: true, currency: true } });
  if (!prods.length) return res.status(400).json({ error: 'These products are no longer available.' });
  if (prods.some(p => p.sellerId === req.user.id)) return res.status(400).json({ error: 'You cannot buy your own product.' });
  const groups = new Map();
  prods.forEach(p => { const k = p.sellerId + '|' + p.currency; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); });
  const orders = await prisma.$transaction([...groups.values()].map(list => {
    const total = Math.round(list.reduce((s, p) => s + Number(p.price) * want.get(p.id), 0) * 100) / 100;
    return prisma.shopOrder.create({ data: { ref: 'SM-' + crypto.randomBytes(4).toString('hex').toUpperCase(), buyerId: req.user.id, sellerId: list[0].sellerId, currency: list[0].currency, total, sellerPhone: list[0].sellerPhone, sellerShop: list[0].shopName, ...f,
      items: { create: list.map(p => ({ productId: p.id, title: p.title, unitPrice: p.price, qty: want.get(p.id) })) } }, include: { items: true } });
  }));
  res.status(201).json({ orders: orders.map(oview) });
});
router.get('/api/orders', requireUser, async (req, res) => {
  const l = await prisma.shopOrder.findMany({ where: { buyerId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 50, include: { items: true } });
  res.json({ orders: l.map(oview) });
});
router.get('/api/seller-orders', requireUser, async (req, res) => {
  const l = await prisma.shopOrder.findMany({ where: { sellerId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 100, include: { items: true } });
  res.json({ orders: l.map(oview) });
});
router.patch('/api/orders/:ref/status', csrf, requireUser, async (req, res) => {
  const s = String(req.body.status || ''), o = await prisma.shopOrder.findUnique({ where: { ref: req.params.ref } });
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  const seller = o.sellerId === req.user.id, buyer = o.buyerId === req.user.id;
  const ok = (seller && ['CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(s) && !['DELIVERED', 'CANCELLED'].includes(o.status)) || (buyer && s === 'CANCELLED' && o.status === 'PLACED');
  if (!ok) return res.status(403).json({ error: 'This change is not allowed.' });
  await prisma.shopOrder.update({ where: { id: o.id }, data: { status: s } });
  res.json({ ok: true, status: s });
});
module.exports = router;

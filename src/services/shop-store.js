/**
 * File-based shop store — survives process restarts.
 * Put DATA_DIR on Render Persistent Disk so redeploys keep products/images.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Use DATA_DIR when explicitly configured. Render Free has no Persistent Disk,
// so never assume /var/data is writable; use the writable temporary directory
// to let the service start. IMPORTANT: /tmp is ephemeral and is NOT durable storage.
const ROOT = process.env.DATA_DIR || (process.env.RENDER === 'true' ? path.join('/tmp', 'stratic-market') : path.join(process.cwd(), 'data'));
const IMG = path.join(ROOT, 'images');
const F = {
  products: path.join(ROOT, 'products.json'),
  orders: path.join(ROOT, 'orders.json'),
  accounts: path.join(ROOT, 'accounts.json'),
  stats: path.join(ROOT, 'stats.json'),
};

function ensure() {
  fs.mkdirSync(IMG, { recursive: true });
  for (const f of Object.values(F)) {
    if (!fs.existsSync(f)) fs.writeFileSync(f, f.includes('stats') ? '{}' : '[]', 'utf8');
  }
}
ensure();

function read(key) {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(F[key], 'utf8'));
  } catch {
    return key === 'stats' ? {} : [];
  }
}

// ---- Durable backup in Postgres (Neon): accounts, products, orders, stats + product photos ----
// Render Free wipes local files on every restart/redeploy, so everything important is mirrored to DATABASE_URL.
const DB_URL = String(process.env.DATABASE_URL || '').trim();
const DB_KEYS = ['accounts', 'products', 'orders', 'stats'];
let pool = null;
let dbChain = Promise.resolve();
const timers = {};
function getPool() {
  if (!DB_URL) return null;
  if (pool) return pool;
  try {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 3, connectionTimeoutMillis: 10000 });
    pool.on('error', () => {});
  } catch (e) {
    console.warn('pg package missing - data will not be backed up to the database:', e.message);
    pool = null;
  }
  return pool;
}
function queueDb(fn) {
  const p = getPool();
  if (!p) return;
  dbChain = dbChain.then(() => fn(p)).catch((e) => console.error('db backup failed', e.message));
}
function dbSave(key, json) {
  queueDb((p) => p.query(
    'INSERT INTO sgm_kv (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',
    [key, json]
  ));
}
function dbSaveLater(key, json, ms) {
  clearTimeout(timers[key]);
  timers[key] = setTimeout(() => dbSave(key, json), ms);
}
function dbSaveImage(name, buf) {
  queueDb((p) => p.query(
    'INSERT INTO sgm_img (name, data) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data',
    [name, buf]
  ));
}
function dbDeleteImage(name) {
  queueDb((p) => p.query('DELETE FROM sgm_img WHERE name = $1', [name]));
}
// Call once before the server starts: restores data files from the database.
async function ready() {
  const p = getPool();
  if (!p) {
    console.warn('DATABASE_URL not set: data is kept only in local files and will be lost on Render restart.');
    return;
  }
  try {
    await p.query('CREATE TABLE IF NOT EXISTS sgm_kv (key text PRIMARY KEY, value text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())');
    await p.query('CREATE TABLE IF NOT EXISTS sgm_img (name text PRIMARY KEY, data bytea NOT NULL)');
    ensure();
    for (const key of DB_KEYS) {
      const r = await p.query('SELECT value FROM sgm_kv WHERE key = $1', [key]);
      if (r.rows.length) {
        const val = JSON.parse(r.rows[0].value);
        fs.writeFileSync(F[key], JSON.stringify(val), 'utf8');
        console.log('Restored ' + key + ' from database');
      } else {
        const local = read(key);
        const has = Array.isArray(local) ? local.length : Object.keys(local).length;
        if (has) dbSave(key, JSON.stringify(local));
      }
    }
  } catch (e) {
    console.error('database restore failed', e.message);
  }
}
// Product photo: local file first, else fetch from the database (after a restart).
async function ensureImage(name) {
  const fp = path.join(IMG, name + '.jpg');
  if (fs.existsSync(fp)) return fp;
  const p = getPool();
  if (!p) return null;
  try {
    const r = await p.query('SELECT data FROM sgm_img WHERE name = $1', [name]);
    if (!r.rows.length) return null;
    fs.mkdirSync(IMG, { recursive: true });
    fs.writeFileSync(fp, r.rows[0].data);
    return fp;
  } catch (e) {
    return null;
  }
}

function write(key, data) {
  ensure();
  const json = JSON.stringify(data, null, 0);
  const tmp = F[key] + '.tmp';
  fs.writeFileSync(tmp, json, 'utf8');
  fs.renameSync(tmp, F[key]);
  if (key === 'stats') dbSaveLater(key, json, 5000);
  else if (DB_KEYS.includes(key)) dbSave(key, json);
}

function id() {
  return crypto.randomBytes(8).toString('hex');
}

function normPhone(p) {
  // Canonical key so "+91 98765 43210", "09876543210" and "9876543210" are the SAME mobile.
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d.slice(-12);
}

/** Detect ISO country from an international or local mobile number. Used so sellers cannot fake product market by picking another country. */
function countryFromPhone(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  // Common 10-digit Indian mobiles without country code
  if (d.length === 10 && /^[6-9]/.test(d)) return 'IN';
  const rules = [
    ['852', 'HK'], ['886', 'TW'], ['880', 'BD'], ['977', 'NP'], ['971', 'AE'], ['966', 'SA'],
    ['974', 'QA'], ['965', 'KW'], ['973', 'BH'], ['968', 'OM'], ['964', 'IQ'], ['972', 'IL'],
    ['855', 'KH'], ['856', 'LA'], ['234', 'NG'], ['254', 'KE'], ['233', 'GH'], ['255', 'TZ'],
    ['251', 'ET'], ['358', 'FI'], ['353', 'IE'], ['420', 'CZ'], ['380', 'UA'],
    ['91', 'IN'], ['92', 'PK'], ['94', 'LK'], ['975', 'BT'], ['960', 'MV'], ['93', 'AF'], ['95', 'MM'],
    ['98', 'IR'], ['90', 'TR'], ['20', 'EG'], ['27', 'ZA'],
    ['44', 'GB'], ['61', 'AU'], ['64', 'NZ'], ['65', 'SG'], ['60', 'MY'], ['62', 'ID'], ['66', 'TH'],
    ['84', 'VN'], ['63', 'PH'], ['81', 'JP'], ['82', 'KR'], ['86', 'CN'],
    ['49', 'DE'], ['33', 'FR'], ['39', 'IT'], ['34', 'ES'], ['351', 'PT'], ['31', 'NL'], ['32', 'BE'],
    ['41', 'CH'], ['43', 'AT'], ['46', 'SE'], ['47', 'NO'], ['45', 'DK'], ['48', 'PL'], ['40', 'RO'],
    ['36', 'HU'], ['30', 'GR'], ['55', 'BR'], ['52', 'MX'], ['54', 'AR'], ['56', 'CL'], ['57', 'CO'],
    ['51', 'PE'], ['7', 'RU'], ['1', 'US'],
  ];
  rules.sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, cc] of rules) {
    if (d.startsWith(prefix)) {
      // Avoid classifying bare Indian 10-digit as US (+1)
      if (cc === 'US' && d.length === 10 && /^[6-9]/.test(d)) return 'IN';
      return cc;
    }
  }
  return '';
}

function listProducts(country) {
  const now = Date.now();
  return read('products')
    .filter((p) => {
      if (country && p.country && p.country !== country) return false;
      if (!p.expiresAt) return true;
      const exp = new Date(p.expiresAt);
      if (isNaN(exp.getTime())) return true;
      exp.setHours(23, 59, 59, 999);
      return exp.getTime() >= now;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function listAllProducts() { return read('products').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); }

function getProduct(pid) {
  return read('products').find((p) => p.id === pid) || null;
}

function addProduct(data, imageBuffer, extras, qrBuffer) {
  const products = read('products');
  const pid = id();
  extras = (extras || []).slice(0, 4);
  fs.writeFileSync(path.join(IMG, pid + '.jpg'), imageBuffer);
  dbSaveImage(pid, imageBuffer);
  extras.forEach((buf, k) => {
    fs.writeFileSync(path.join(IMG, pid + '_' + (k + 1) + '.jpg'), buf);
    dbSaveImage(pid + '_' + (k + 1), buf);
  });
  if (qrBuffer && qrBuffer.length > 100) {
    fs.writeFileSync(path.join(IMG, pid + '_q.jpg'), qrBuffer);
    dbSaveImage(pid + '_q', qrBuffer);
  }
  const p = {
    id: pid,
    hasQr: !!(qrBuffer && qrBuffer.length > 100),
    sellerId: data.sellerId,
    shopName: data.shopName,
    city: data.city || '',
    country: data.country || 'IN',
    title: data.title,
    description: data.description || '',
    price: data.price,
    mrp: data.mrp || 0,
    currency: data.currency || 'INR',
    category: data.category || 'Other',
    days: data.days || 5,
    sellerPhone: data.sellerPhone || '',
    sellerPhoneKey: normPhone(data.sellerPhone),
    sellerAddress: data.sellerAddress || '',
    expiresAt: data.expiresAt || null,
    lang: data.lang || 'en',
    imgCount: 1 + extras.length,
    createdAt: new Date().toISOString(),
  };
  products.unshift(p);
  write('products', products);
  return p;
}

function deleteProduct(pid, sellerId) {
  const products = read('products');
  const i = products.findIndex((p) => p.id === pid && p.sellerId === sellerId);
  if (i < 0) return false;
  products.splice(i, 1);
  write('products', products);
  for (let k = 0; k < 5; k++) {
    const nm = k ? pid + '_' + k : pid;
    try { fs.unlinkSync(path.join(IMG, nm + '.jpg')); } catch {}
    dbDeleteImage(nm);
  }
  try { fs.unlinkSync(path.join(IMG, pid + '_q.jpg')); } catch {}
  dbDeleteImage(pid + '_q');
  return true;
}

function imageName(pid, i) {
  const base = String(pid || '').replace(/[^a-f0-9]/gi, '');
  if (i === 'q') return base + '_q';
  const n = Number(i) || 0;
  return n > 0 && n < 5 ? base + '_' + n : base;
}
function imagePath(pid, i) {
  return path.join(IMG, imageName(pid, i) + '.jpg');
}

function createAccount(data) {
  const accounts = read('accounts');
  const emailNorm = String(data.email || '').toLowerCase().trim();
  const pk = normPhone(data.phoneKey || data.phone);
  // Identity = Gmail + mobile PAIR. Same Gmail with another mobile (or same mobile with another Gmail) is a NEW fresh account.
  if (emailNorm && pk && accounts.find((a) => a.email === emailNorm && normPhone(a.phoneKey || a.phone) === pk)) return null;
  if (emailNorm && !pk && accounts.find((a) => a.email === emailNorm)) return null;
  const u = {
    id: id(),
    name: data.name || '',
    email: emailNorm,
    passwordHash: data.passwordHash || '',
    phone: data.phone || '',
    phoneKey: pk,
    country: data.country || 'IN',
    lang: data.lang || 'en',
    googleId: data.googleId || null,
    createdAt: new Date().toISOString(),
  };
  accounts.push(u);
  write('accounts', accounts);
  return u;
}

function updateAccount(uid, patch) {
  const accounts = read('accounts');
  const i = accounts.findIndex((a) => a.id === uid);
  if (i < 0) return null;
  accounts[i] = Object.assign({}, accounts[i], patch);
  write('accounts', accounts);
  return accounts[i];
}

const seenAt = {};
function touchAccount(uid) {
  const now = Date.now();
  if (seenAt[uid] && now - seenAt[uid] < 10 * 60 * 1000) return;
  seenAt[uid] = now;
  const accounts = read('accounts');
  const a = accounts.find((x) => x.id === uid);
  if (!a) return;
  a.lastSeen = new Date(now).toISOString();
  write('accounts', accounts);
}

function findAccountById(uid) {
  return read('accounts').find((a) => a.id === uid) || null;
}

function findAccountByEmail(email) {
  email = String(email || '').toLowerCase();
  return read('accounts').find((a) => a.email === email) || null;
}

function findAccountByPhone(phone) {
  const k = normPhone(phone);
  if (!k) return null;
  return read('accounts').find((a) => a.phoneKey && normPhone(a.phoneKey) === k) || null;
}

// Exact Gmail + mobile pair (used by Google login to restore the right account).
function findAccountByPair(email, phone) {
  email = String(email || '').toLowerCase().trim();
  const k = normPhone(phone);
  if (!email || !k) return null;
  return read('accounts').find((a) => a.email === email && normPhone(a.phoneKey || a.phone) === k) || null;
}

// Old Google accounts created before the phone step (no mobile saved yet).
function findPhonelessByEmail(email) {
  email = String(email || '').toLowerCase().trim();
  return read('accounts').find((a) => a.email === email && !normPhone(a.phoneKey || a.phone)) || null;
}

function findAccountByGoogle(gid) {
  return read('accounts').find((a) => a.googleId === gid) || null;
}

function listOrders(recfilter) {
  let o = read('orders');
  if (recfilter && recfilter.buyerId) o = o.filter((x) => x.buyerId === recfilter.buyerId);
  if (recfilter && recfilter.sellerId) o = o.filter((x) => x.sellerId === recfilter.sellerId);
  return o.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function addOrder(data) {
  const orders = read('orders');
  const ref = 'ST-' + id().slice(0, 10).toUpperCase();
  const o = {
    ref,
    buyerId: data.buyerId,
    sellerId: data.sellerId,
    items: data.items,
    total: data.total,
    currency: data.currency || 'INR',
    status: 'CONFIRMED',
    paymentMethod: data.paymentMethod === 'ONLINE' ? 'ONLINE' : 'COD',
    itemsTotal: data.itemsTotal != null ? data.itemsTotal : data.total,
    deliveryCharge: data.deliveryCharge || 0,
    buyerEmail: data.buyerEmail || '',
    name: data.name,
    phone: data.phone,
    phoneKey: normPhone(data.phone),
    address: data.address,
    city: data.city,
    state: data.state || '',
    country: data.country || 'IN',
    pincode: data.pincode,
    sellerShop: data.sellerShop,
    sellerPhone: data.sellerPhone,
    createdAt: new Date().toISOString(),
  };
  orders.unshift(o);
  write('orders', orders);
  return o;
}

const ORDER_STATUSES = ['CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const CANCEL_WINDOW_MS = 24 * 3600 * 1000;
function updateOrderStatus(ref, userId, status, reason) {
  status = String(status || '').toUpperCase();
  if (!ORDER_STATUSES.includes(status)) return { error: 'Invalid status.' };
  const orders = read('orders');
  const o = orders.find((x) => x.ref === ref && (x.sellerId === userId || x.buyerId === userId));
  if (!o) return { error: 'Order not found.' };
  const isBuyer = o.sellerId !== userId;
  if (isBuyer) {
    // buyer may only cancel a still-confirmed order, within 24 hours, with a reason
    if (!(status === 'CANCELLED' && String(o.status).toUpperCase() === 'CONFIRMED')) return { error: 'Change not allowed.' };
    if (Date.now() - new Date(o.createdAt).getTime() > CANCEL_WINDOW_MS) return { error: 'Cancellation time (24 hours) is over. This order can no longer be cancelled.' };
    if (!String(reason || '').trim()) return { error: 'Please tell us why you are cancelling.' };
  }
  o.status = status;
  if (status === 'CANCELLED') { o.cancelReason = String(reason || '').slice(0, 200); o.cancelledAt = new Date().toISOString(); o.cancelledBy = isBuyer ? 'buyer' : 'seller'; }
  write('orders', orders);
  return { order: o };
}

function deleteOrder(ref, buyerId) {
  const orders = read('orders');
  const i = orders.findIndex((x) => x.ref === ref && x.buyerId === buyerId);
  if (i < 0) return false;
  orders.splice(i, 1);
  write('orders', orders);
  return true;
}


// Likes are counted per MOBILE NUMBER (not per Gmail): one mobile = one like per product.
function likeKeySet(ids) {
  const accounts = read('accounts');
  const set = new Set();
  ids.forEach((x) => {
    const a = accounts.find((y) => y.id === x);
    if (a) set.add(normPhone(a.phoneKey || a.phone) || String(x)); // older likes were saved by account id
    else set.add(String(x));
  });
  return set;
}
function accountLikeKey(userId) {
  const a = findAccountById(userId);
  return a ? normPhone(a.phoneKey || a.phone) : '';
}
function productLikeInfo(pid, userId) {
  const stats = read('stats');
  stats.productLikes = stats.productLikes || {};
  const ids = Array.isArray(stats.productLikes[pid]) ? stats.productLikes[pid] : [];
  const set = likeKeySet(ids);
  const mine = userId ? accountLikeKey(userId) : '';
  return { count: set.size, liked: !!(mine && set.has(mine)) };
}
function toggleProductLike(pid, userId) {
  if (!getProduct(pid) || !userId) return null;
  const key = accountLikeKey(userId);
  if (!key) return null;
  const stats = read('stats');
  stats.productLikes = stats.productLikes || {};
  const ids = Array.isArray(stats.productLikes[pid]) ? stats.productLikes[pid] : [];
  const set = likeKeySet(ids);
  let liked;
  if (set.has(key)) { set.delete(key); liked = false; } else { set.add(key); liked = true; }
  stats.productLikes[pid] = Array.from(set);
  write('stats', stats);
  return { count: set.size, liked };
}

// Views: one count per DEVICE (browser cookie), never repeated for the same device.
function recordProductView(pid, dev) {
  if (!dev || !getProduct(pid)) return 0;
  const stats = read('stats');
  stats.productViews = stats.productViews || {};
  const m = stats.productViews[pid] || {};
  if (!m[dev]) { m[dev] = 1; stats.productViews[pid] = m; write('stats', stats); }
  return Object.keys(m).length;
}
function productViewCount(pid) {
  const stats = read('stats');
  return Object.keys((stats.productViews || {})[pid] || {}).length;
}

function recordVisit(dev) {
  if (!dev) return;
  const stats = read('stats');
  const day = new Date().toISOString().slice(0, 10);
  stats.devices = stats.devices || {};
  let changed = false;
  // total shop views = unique devices; a device is counted only once
  if (!stats.devices[dev]) {
    stats.devices[dev] = 1;
    stats.totalVisits = Number(stats.totalVisits || 0) + 1;
    changed = true;
  }
  stats.dailyVisits = stats.dailyVisits || {};
  if (!stats.seenDay || stats.seenDay.d !== day) stats.seenDay = { d: day, ids: {} };
  if (!stats.seenDay.ids[dev]) {
    stats.seenDay.ids[dev] = 1;
    stats.dailyVisits[day] = Number(stats.dailyVisits[day] || 0) + 1;
    for (const d of Object.keys(stats.dailyVisits).sort().slice(0, -90)) delete stats.dailyVisits[d];
    changed = true;
  }
  if (changed) write('stats', stats);
}

function dashboardStats() {
  const products = read('products');
  const orders = read('orders');
  const accounts = read('accounts');
  const st = read('stats');
  const byCountry = {};
  const bc = (c) => (byCountry[c] = byCountry[c] || { users: 0, products: 0, orders: 0, sales: 0 });
  accounts.forEach((a) => { bc(a.country || 'IN').users++; });
  products.forEach((p) => { bc(p.country || 'IN').products++; });
  const ordersByStatus = {};
  const salesByCurrency = {};
  const dailyOrders = {};
  orders.forEach((o) => {
    const c = bc(o.country || 'IN');
    c.orders++;
    const stt = String(o.status || 'CONFIRMED').toUpperCase();
    ordersByStatus[stt] = (ordersByStatus[stt] || 0) + 1;
    if (stt !== 'CANCELLED') {
      c.sales += Number(o.total) || 0;
      salesByCurrency[o.currency || 'INR'] = (salesByCurrency[o.currency || 'INR'] || 0) + (Number(o.total) || 0);
    }
    const d = String(o.createdAt || '').slice(0, 10);
    if (d) dailyOrders[d] = (dailyOrders[d] || 0) + 1;
  });
  const now = Date.now();
  const active = (ms) => accounts.filter((a) => a.lastSeen && now - new Date(a.lastSeen).getTime() < ms).length;
  const sellers = new Set(products.map((p) => p.sellerId));
  const buyers = new Set(orders.map((o) => o.buyerId));
  const byCategory = {};
  products.forEach((p) => { byCategory[p.category || 'Other'] = (byCategory[p.category || 'Other'] || 0) + 1; });
  const accName = {};
  accounts.forEach((a) => { accName[a.id] = a; });
  return {
    users: accounts.length,
    sellers: sellers.size,
    buyers: buyers.size,
    activeNow: active(15 * 60 * 1000),
    active24h: active(24 * 3600 * 1000),
    newUsers7d: accounts.filter((a) => a.createdAt && now - new Date(a.createdAt).getTime() < 7 * 864e5).length,
    visits: Number(st.totalVisits || 0),
    dailyVisits: st.dailyVisits || {},
    dailyOrders,
    products: products.length,
    orders: orders.length,
    ordersByStatus,
    salesByCurrency,
    byCountry,
    byCategory,
    recentUsers: accounts.slice(-25).reverse().map((a) => ({
      name: a.name, email: a.email, phone: a.phone || '', country: a.country || 'IN',
      createdAt: a.createdAt, lastSeen: a.lastSeen || null, google: !!a.googleId,
    })),
    recentProducts: products.slice(0, 30).map((p) => ({
      id: p.id, title: p.title, country: p.country, price: p.price, category: p.category,
      currency: p.currency, seller: p.shopName, phone: p.sellerPhone || '', createdAt: p.createdAt,
    })),
    recentOrders: orders.slice(0, 40).map((o) => ({
      ref: o.ref, total: o.total, currency: o.currency, country: o.country, city: o.city,
      status: String(o.status || 'CONFIRMED').toUpperCase(), createdAt: o.createdAt,
      buyer: o.name, buyerPhone: o.phone, seller: o.sellerShop,
      items: (o.items || []).map((i) => i.qty + 'x ' + i.title).join(', '),
    })),
  };
}

module.exports = {
  ready, ensureImage, touchAccount, ORDER_STATUSES,
  listProducts, listAllProducts, getProduct, addProduct, deleteProduct, imagePath,
  createAccount, updateAccount, findAccountById, findAccountByEmail,
  findAccountByPhone, findAccountByPair, findPhonelessByEmail, findAccountByGoogle, recordProductView, productViewCount, listOrders, addOrder,
  updateOrderStatus, CANCEL_WINDOW_MS, deleteOrder, dashboardStats, recordVisit, normPhone, countryFromPhone, ROOT, IMG, productLikeInfo, toggleProductLike,
};

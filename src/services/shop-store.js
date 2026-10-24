/**
 * File-based shop store — survives process restarts.
 * Put DATA_DIR on Render Persistent Disk so redeploys keep products/images.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Render's filesystem is ephemeral unless a Persistent Disk is mounted at /var/data.
// Keep marketplace accounts/products in that mount by default on Render.
const ROOT = process.env.DATA_DIR || (process.env.RENDER === 'true' ? '/var/data/stratic-market' : path.join(process.cwd(), 'data'));
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

function write(key, data) {
  ensure();
  const tmp = F[key] + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 0), 'utf8');
  fs.renameSync(tmp, F[key]);
}

function id() {
  return crypto.randomBytes(8).toString('hex');
}

function normPhone(p) {
  return String(p || '').replace(/\D/g, '').slice(-12);
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

function getProduct(pid) {
  return read('products').find((p) => p.id === pid) || null;
}

function addProduct(data, imageBuffer) {
  const products = read('products');
  const pid = id();
  fs.writeFileSync(path.join(IMG, pid + '.jpg'), imageBuffer);
  const p = {
    id: pid,
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
  try { fs.unlinkSync(path.join(IMG, pid + '.jpg')); } catch {}
  return true;
}

function imagePath(pid) {
  return path.join(IMG, pid + '.jpg');
}

function createAccount(data) {
  const accounts = read('accounts');
  const emailNorm = String(data.email || '').toLowerCase().trim();
  if (emailNorm && accounts.find((a) => a.email === emailNorm)) return null;
  if (data.phoneKey && accounts.find((a) => a.phoneKey === data.phoneKey && a.phoneKey)) return null;
  const u = {
    id: id(),
    name: data.name || '',
    email: String(data.email || '').toLowerCase().trim(),
    passwordHash: data.passwordHash || '',
    phone: data.phone || '',
    phoneKey: data.phoneKey || normPhone(data.phone),
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
  return read('accounts').find((a) => a.phoneKey === k) || null;
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
    status: 'confirmed',
    name: data.name,
    phone: data.phone,
    phoneKey: normPhone(data.phone),
    address: data.address,
    city: data.city,
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

function updateOrderStatus(ref, sellerId, status) {
  const orders = read('orders');
  const o = orders.find((x) => x.ref === ref && x.sellerId === sellerId);
  if (!o) return null;
  o.status = status;
  write('orders', orders);
  return o;
}

function deleteOrder(ref, buyerId) {
  const orders = read('orders');
  const i = orders.findIndex((x) => x.ref === ref && x.buyerId === buyerId);
  if (i < 0) return false;
  orders.splice(i, 1);
  write('orders', orders);
  return true;
}

function recordVisit() {
  const stats = read('stats');
  const day = new Date().toISOString().slice(0, 10);
  stats.totalVisits = Number(stats.totalVisits || 0) + 1;
  stats.dailyVisits = stats.dailyVisits || {};
  stats.dailyVisits[day] = Number(stats.dailyVisits[day] || 0) + 1;
  // Keep the dashboard file compact while retaining recent daily totals.
  for (const d of Object.keys(stats.dailyVisits).sort().slice(0, -90)) delete stats.dailyVisits[d];
  write('stats', stats);
}

function dashboardStats() {
  const products = read('products');
  const orders = read('orders');
  const accounts = read('accounts');
  const byCountry = {};
  for (const p of products) {
    const c = p.country || 'IN';
    byCountry[c] = byCountry[c] || { products: 0, orders: 0 };
    byCountry[c].products++;
  }
  for (const o of orders) {
    const c = o.country || 'IN';
    byCountry[c] = byCountry[c] || { products: 0, orders: 0 };
    byCountry[c].orders++;
  }
  return {
    users: accounts.length,
    visits: Number(read('stats').totalVisits || 0),
    dailyVisits: read('stats').dailyVisits || {},
    products: products.length,
    orders: orders.length,
    byCountry,
    recentProducts: products.slice(0, 20).map((p) => ({
      id: p.id, title: p.title, country: p.country, price: p.price,
      currency: p.currency, seller: p.shopName, createdAt: p.createdAt,
    })),
    recentOrders: orders.slice(0, 20).map((o) => ({
      ref: o.ref, total: o.total, currency: o.currency, country: o.country,
      status: o.status, createdAt: o.createdAt,
    })),
  };
}

module.exports = {
  listProducts, getProduct, addProduct, deleteProduct, imagePath,
  createAccount, updateAccount, findAccountById, findAccountByEmail,
  findAccountByPhone, findAccountByGoogle, listOrders, addOrder,
  updateOrderStatus, deleteOrder, dashboardStats, recordVisit, normPhone, ROOT, IMG,
};

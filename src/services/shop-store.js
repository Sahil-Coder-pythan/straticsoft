/**
 * File-based shop store — survives process restarts.
 * Put DATA_DIR on Render Persistent Disk so redeploys keep products/images.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const IMG = path.join(ROOT, 'images');
const F = {
  products: path.join(ROOT, 'products.json'),
  orders: path.join(ROOT, 'orders.json'),
  accounts: path.join(ROOT, 'accounts.json'),
};

function ensure() {
  fs.mkdirSync(IMG, { recursive: true });
  for (const f of Object.values(F)) {
    if (!fs.existsSync(f)) fs.writeFileSync(f, '[]', 'utf8');
  }
}
ensure();

function read(key) {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(F[key], 'utf8'));
  } catch {
    return [];
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

function listProducts() {
  const now = Date.now();
  return read('products')
    .filter((p) => {
      if (!p.expiresAt) return true;
      // Treat date-only as end of that calendar day
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
  const imgPath = path.join(IMG, pid + '.jpg');
  fs.writeFileSync(imgPath, imageBuffer);
  const p = {
    id: pid,
    sellerId: data.sellerId,
    shopName: data.shopName,
    city: data.city || '',
    title: data.title,
    description: data.description || '',
    price: data.price,
    mrp: data.mrp || 0,
    currency: data.currency || 'INR',
    category: data.category || 'Other',
    days: data.days || 5,
    sellerPhone: data.sellerPhone || '',
    sellerAddress: data.sellerAddress || '',
    expiresAt: data.expiresAt || null,
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
  try {
    fs.unlinkSync(path.join(IMG, pid + '.jpg'));
  } catch {}
  return true;
}

function readImage(pid) {
  const fp = path.join(IMG, pid + '.jpg');
  if (!fs.existsSync(fp)) return null;
  return fs.readFileSync(fp);
}

function countBySeller(sellerId) {
  return read('products').filter((p) => p.sellerId === sellerId).length;
}

function findAccountByEmail(email) {
  return read('accounts').find((a) => a.email === email) || null;
}

function findAccountById(aid) {
  return read('accounts').find((a) => a.id === aid) || null;
}

function createAccount({ name, email, passwordHash }) {
  const accounts = read('accounts');
  if (accounts.some((a) => a.email === email)) return null;
  const a = {
    id: id(),
    name,
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  accounts.push(a);
  write('accounts', accounts);
  return a;
}

function createOrders(orderList) {
  const orders = read('orders');
  for (const o of orderList) {
    orders.unshift(o);
  }
  write('orders', orders);
  return orderList;
}

function ordersByBuyer(buyerId) {
  return read('orders')
    .filter((o) => o.buyerId === buyerId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function ordersBySeller(sellerId) {
  return read('orders')
    .filter((o) => o.sellerId === sellerId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function findOrderByRef(ref) {
  return read('orders').find((o) => o.ref === ref) || null;
}

function updateOrderStatus(ref, status) {
  const orders = read('orders');
  const o = orders.find((x) => x.ref === ref);
  if (!o) return null;
  o.status = status;
  o.updatedAt = new Date().toISOString();
  write('orders', orders);
  return o;
}

module.exports = {
  listProducts,
  getProduct,
  addProduct,
  deleteProduct,
  readImage,
  countBySeller,
  findAccountByEmail,
  findAccountById,
  createAccount,
  createOrders,
  ordersByBuyer,
  ordersBySeller,
  findOrderByRef,
  updateOrderStatus,
  ROOT,
};

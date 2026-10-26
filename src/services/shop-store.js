/**
 * File-based shop store — survives process restarts.
 * Put DATA_DIR on Render Persistent Disk so redeploys keep products/images.
 */
const fs = require('fs');
const fsp = fs.promises;
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
  pronto_urls: path.join(ROOT, 'pronto_urls.json'),
};

// ensure() used to run (5 existsSync calls + mkdirSync) on EVERY read and write. It now runs once,
// and again only after a read failure (e.g. the directory was removed).
let ensured = false;
function ensure() {
  if (ensured) return;
  fs.mkdirSync(IMG, { recursive: true });
  for (const f of Object.values(F)) {
    if (!fs.existsSync(f)) fs.writeFileSync(f, (f.includes('stats') || f.includes('pronto_urls')) ? '{}' : '[]', 'utf8');
  }
  ensured = true;
}
ensure();

// In-memory cache of the parsed data files.
//  - CACHE[key]  : parsed data. Any write() drops it, so the next read sees the new state.
//  - LATEST[key] : JSON of the newest snapshot that is not yet confirmed on disk (async writer below).
// read() returns a private copy (callers may mutate it, then call write()).
// peek() returns the SHARED object without copying: callers MUST treat it as read-only and never return it.
const CACHE = {};
const LATEST = {};
function load(key) {
  if (CACHE[key] !== undefined) return CACHE[key];
  ensure();
  let val;
  try {
    val = JSON.parse(typeof LATEST[key] === 'function' ? LATEST[key]() : (LATEST[key] !== undefined ? LATEST[key] : fs.readFileSync(F[key], 'utf8')));
  } catch {
    ensured = false;
    return key === 'stats' ? {} : [];
  }
  CACHE[key] = val;
  return val;
}
function peek(key) { return load(key); }
function read(key) { return structuredClone(load(key)); }
function cloneOrNull(v) { return v ? structuredClone(v) : null; }

// ---- Durable backup in Postgres (Neon): accounts, products, orders, stats + product photos ----
// Render Free wipes local files on every restart/redeploy, so everything important is mirrored to DATABASE_URL.
const DB_URL = String(process.env.DATABASE_URL || '').trim();
const DB_KEYS = ['accounts', 'products', 'orders', 'stats', 'pronto_urls'];
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
  // Try up to 3 times (Neon may be waking up), so a photo/QR backup is not silently lost.
  dbChain = dbChain.then(async () => {
    for (let i = 0; i < 3; i++) {
      try { await fn(p); return; } catch (e) {
        console.error('db backup failed (try ' + (i + 1) + ')', e.message);
        if (i < 2) await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
      }
    }
  }).catch(() => {});
}
// Every snapshot is the COMPLETE state of one key, so only the newest one matters. While an upload of a key is
// waiting in the queue, newer snapshots replace its payload instead of queueing another full-blob upload.
// Order is preserved (a snapshot taken after an upload started is queued behind it), and memory stays bounded
// to one pending string per key instead of one per write.
const dbLatest = {};
function dbSave(key, json) {
  if (!getPool()) return;
  const queued = dbLatest[key] !== undefined;
  dbLatest[key] = json;
  if (queued) return;
  let snap;
  queueDb((p) => {
    if (snap === undefined) { snap = dbLatest[key]; delete dbLatest[key]; } // fixed once, so retries upload the same snapshot
    return p.query(
      'INSERT INTO sgm_kv (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',
      [key, snap]
    );
  });
}
const laterJson = {};
function dbSaveLater(key, produceJson, ms) {
  clearTimeout(timers[key]);
  laterJson[key] = produceJson;
  timers[key] = setTimeout(() => { delete laterJson[key]; dbSave(key, produceJson()); }, ms);
}
// ---- Separate photo/QR database (optional): set IMG_DATABASE_URL (e.g. CockroachDB free 10 GiB). ----
// Text data (accounts/products/orders) stays in DATABASE_URL (Neon); photos + payment QRs go here.
// If IMG_DATABASE_URL is not set, everything works exactly as before (photos in DATABASE_URL).
const IMG_DB_URL = String(process.env.IMG_DATABASE_URL || '').trim();
let imgPool = null, imgChain = Promise.resolve(), imgTableOk = false;
function getImgPool() {
  if (!IMG_DB_URL) return null;
  if (imgPool) return imgPool;
  try {
    const { Pool } = require('pg');
    // our own ssl setting is used, so drop sslmode from the URL (it would override it)
    const url = IMG_DB_URL.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
    imgPool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 3, connectionTimeoutMillis: 15000 });
    imgPool.on('error', () => {});
  } catch (e) {
    console.warn('pg package missing - photos will not use IMG_DATABASE_URL:', e.message);
    imgPool = null;
  }
  return imgPool;
}
async function ensureImgTable(p) {
  if (imgTableOk) return;
  await p.query('CREATE TABLE IF NOT EXISTS sgm_img (name text PRIMARY KEY, data bytea NOT NULL)');
  imgTableOk = true;
}
function queueImg(fn) {
  const p = getImgPool();
  if (!p) return false;
  imgChain = imgChain.then(async () => {
    for (let i = 0; i < 3; i++) {
      try { await ensureImgTable(p); await fn(p); return; } catch (e) {
        console.error('photo database backup failed (try ' + (i + 1) + ')', e.message);
        if (i < 2) await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
      }
    }
  }).catch(() => {});
  return true;
}
// Optional Get Pronto cloud storage. Set GETPRONTO_API_KEY in Render Environment.
// Uploads use the provider's documented presign -> PUT -> confirm flow.
const PRONTO_KEY = String(process.env.GETPRONTO_API_KEY || '').trim();
let prontoChain = Promise.resolve();
function remoteUrls() { return read('pronto_urls') || {}; }
function remoteImageUrl(name) { return remoteUrls()[String(name)] || null; }
async function uploadPronto(name, buf) {
  if (!PRONTO_KEY || !buf || !buf.length) return;
  const filename = `stratic-${String(name).replace(/[^a-zA-Z0-9_-]/g, '')}-${crypto.randomBytes(4).toString('hex')}.jpg`;
  try {
    const base = 'https://api.getpronto.io/v1';
    const presignRes = await fetch(base + '/upload/presign', {
      method: 'POST', headers: { Authorization: 'ApiKey ' + PRONTO_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, customFilename: filename, mimetype: 'image/jpeg', size: buf.length, folderName: 'stratic-market' }),
      signal: AbortSignal.timeout(30000),
    });
    const presign = await presignRes.json().catch(() => ({}));
    if (!presignRes.ok || !presign.uploadUrl || !presign.pendingUploadId) throw new Error('Get Pronto presign failed (' + presignRes.status + '): ' + JSON.stringify(presign).slice(0, 300));
    const putRes = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: buf, signal: AbortSignal.timeout(60000) });
    if (!putRes.ok) throw new Error('Get Pronto binary upload failed (' + putRes.status + ')');
    const confirmRes = await fetch(base + '/upload/confirm', {
      method: 'POST', headers: { Authorization: 'ApiKey ' + PRONTO_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pendingUploadId: presign.pendingUploadId }), signal: AbortSignal.timeout(30000),
    });
    const confirmed = await confirmRes.json().catch(() => ({}));
    if (!confirmRes.ok || !(confirmed.file && (confirmed.file.rawUrl || confirmed.file.secureUrl))) throw new Error('Get Pronto confirmation failed (' + confirmRes.status + '): ' + JSON.stringify(confirmed).slice(0, 300));
    const urls = remoteUrls();
    urls[String(name)] = confirmed.file.rawUrl || confirmed.file.secureUrl;
    write('pronto_urls', urls);
    console.log('Get Pronto photo uploaded:', name);
  } catch (e) {
    console.error('Get Pronto upload failed for ' + name + '; local/database fallback remains active:', e.message);
  }
}
function queueProntoUpload(name, buf) {
  if (!PRONTO_KEY) return;
  // Serialize provider uploads to avoid bursts from multi-photo product listings.
  const copy = Buffer.from(buf);
  prontoChain = prontoChain.then(() => uploadPronto(name, copy)).catch((e) => console.error('Get Pronto upload queue error:', e.message));
}
function dbSaveImage(name, buf) {
  if (PRONTO_KEY) { queueProntoUpload(name, buf); return; }
  if (queueImg((p) => p.query(
    'INSERT INTO sgm_img (name, data) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data',
    [name, buf]
  ))) return;
  queueDb((p) => p.query(
    'INSERT INTO sgm_img (name, data) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data',
    [name, buf]
  ));
}
function dbDeleteImage(name) {
  queueDb((p) => p.query('DELETE FROM sgm_img WHERE name = $1', [name]));
  queueImg((p) => p.query('DELETE FROM sgm_img WHERE name = $1', [name]));
}
// Call once before the server starts: restores data files from the database.
async function ready() {
  try { const ip = getImgPool(); if (ip) await ensureImgTable(ip); } catch (e) { console.error('photo database not ready:', e.message); }
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
        delete CACHE[key];
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
const imgInflight = new Map();
async function fileExists(fp) { try { await fsp.access(fp); return true; } catch { return false; } }
function ensureImage(name) {
  // Many requests for the same missing photo share ONE database lookup.
  if (imgInflight.has(name)) return imgInflight.get(name);
  const pr = ensureImageNow(name).finally(() => imgInflight.delete(name));
  imgInflight.set(name, pr);
  return pr;
}
async function ensureImageNow(name) {
  const fp = path.join(IMG, name + '.jpg');
  if (await fileExists(fp)) return fp;
  // Look in the photo database first (if configured), then in the main database (older photos).
  const pools = [getImgPool(), getPool()].filter(Boolean);
  for (const p of pools) {
    try {
      const r = await p.query('SELECT data FROM sgm_img WHERE name = $1', [name]);
      if (!r.rows.length) continue;
      await fsp.mkdir(IMG, { recursive: true });
      await fsp.writeFile(fp, r.rows[0].data);
      return fp;
    } catch (e) { /* try the next database */ }
  }
  return null;
}

// ---- Local file persistence ----
// write() keeps the newest snapshot in memory (LATEST) and a single async writer per key saves it to disk
// with an atomic tmp-file + rename. Several writes in the same moment become ONE disk write (the newest
// snapshot always contains all earlier changes). A failed save is retried with backoff and the snapshot stays
// in memory, so reads never see stale data; nothing is dropped silently. shutdown() flushes on SIGTERM.
const DISK = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function scheduleDisk(key, delay) {
  const s = DISK[key] || (DISK[key] = { timer: null, running: false, dirty: false, fails: 0, lastError: null });
  s.dirty = true;
  if (s.running || s.timer) return;
  s.timer = setTimeout(() => { s.timer = null; flushKey(key); }, delay);
}
async function flushKey(key) {
  const s = DISK[key];
  if (!s || s.running) return;
  s.running = true;
  try {
    while (s.dirty) {
      s.dirty = false;
      const snap = LATEST[key];
      if (snap === undefined) break;
      const json = typeof snap === 'function' ? snap() : snap; // stats: serialized once per flush, not once per change
      const tmp = F[key] + '.tmp';
      try {
        try { await fsp.writeFile(tmp, json, 'utf8'); } catch (e) {
          if (e && e.code === 'ENOENT') { await fsp.mkdir(ROOT, { recursive: true }); await fsp.writeFile(tmp, json, 'utf8'); } else throw e;
        }
        await fsp.rename(tmp, F[key]);
        s.fails = 0; s.lastError = null;
        if (LATEST[key] === snap && !s.dirty) delete LATEST[key];
      } catch (e) {
        s.fails++; s.lastError = e.message; s.dirty = true;
        console.error('local save failed for ' + key + ' (attempt ' + s.fails + '), will retry:', e.message);
        if (s.fails >= 20) break; // stop looping; the next write() or shutdown() tries again, data stays in memory
        await sleep(Math.min(5000, 250 * 2 ** Math.min(s.fails, 5)));
      }
    }
  } finally { s.running = false; }
}
// Resolves when every pending local save has finished (used by tests and shutdown).
async function flush() {
  for (const key of Object.keys(DISK)) {
    const s = DISK[key];
    clearTimeout(s.timer); s.timer = null;
    if (s.dirty || s.running) {
      while (s.running) await sleep(5);
      if (s.dirty) await flushKey(key);
    }
  }
}
// Last-resort synchronous save. It uses its OWN temp-file name so it can never clash with an async save that is
// still writing '<key>.json.tmp' (that clash could leave a truncated file). shutdown() normally avoids needing it.
function flushSync() {
  for (const key of Object.keys(LATEST)) {
    try {
      const tmp = F[key] + '.sync.tmp';
      fs.writeFileSync(tmp, typeof LATEST[key] === 'function' ? LATEST[key]() : LATEST[key], 'utf8'); fs.renameSync(tmp, F[key]);
      delete LATEST[key];
    } catch (e) { console.error('shutdown save failed for ' + key + ':', e.message); }
  }
}
// Call on SIGTERM/SIGINT: waits for in-flight local saves (max 5 s), saves anything still pending, then pushes the
// latest snapshots to the database (max ~8 s) instead of dropping them.
async function shutdown() {
  await Promise.race([flush(), sleep(5000)]);
  flushSync();
  for (const key of Object.keys(timers)) clearTimeout(timers[key]);
  for (const key of Object.keys(laterJson)) { const f = laterJson[key]; delete laterJson[key]; dbSave(key, f()); }
  await Promise.race([dbChain.then(() => imgChain).catch(() => {}), sleep(8000)]);
}
function persistenceStatus() {
  const o = {};
  for (const k of Object.keys(DISK)) o[k] = { pending: LATEST[k] !== undefined, fails: DISK[k].fails, lastError: DISK[k].lastError };
  return o;
}

function write(key, data) {
  ensure();
  const json = JSON.stringify(data, null, 0); // may throw before any state changes, exactly as before
  delete CACHE[key];
  LATEST[key] = json;
  // stats change on almost every page view, so its local save is batched for 750 ms; everything else saves on the next tick.
  scheduleDisk(key, key === 'stats' ? 750 : 0);
  if (key === 'stats') dbSaveLater(key, () => json, 5000);
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

// Newest-first product index, rebuilt only when the products data changes. write('products') replaces the cached
// array, so comparing the array object is a correct (and automatic) invalidation for every create/edit/delete.
let prodIdx = { src: null, sorted: [], byId: new Map() };
function prodIndex() {
  const arr = peek('products');
  if (prodIdx.src !== arr) {
    const sorted = arr.map((p) => [p, new Date(p.createdAt)]).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    const byId = new Map();
    for (const p of arr) if (!byId.has(p.id)) byId.set(p.id, p);
    prodIdx = { src: arr, sorted, byId };
  }
  return prodIdx;
}

function listProducts(country) {
  const now = Date.now();
  return prodIndex().sorted
    .filter((p) => {
      if (country && p.country && p.country !== country) return false;
      if (!p.expiresAt) return true;
      const exp = new Date(p.expiresAt);
      if (isNaN(exp.getTime())) return true;
      exp.setHours(23, 59, 59, 999);
      return exp.getTime() >= now;
    })
    .map((p) => structuredClone(p));
}

function listAllProducts() { return prodIndex().sorted.map((p) => structuredClone(p)); }
// Same as listAllProducts().filter(p => p.sellerId === id) without copying every product.
function listProductsBySeller(sellerId) { return prodIndex().sorted.filter((p) => p.sellerId === sellerId).map((p) => structuredClone(p)); }

function getProduct(pid) {
  return cloneOrNull(prodIndex().byId.get(pid));
}

function addProduct(data, imageBuffer, extras, qrBuffer) {
  const products = read('products');
  // Every product gets its own unique ID (also unique in the printed short code PID-XXXXXXXXXX).
  const existing = peek('products'); // read-only check
  fs.mkdirSync(IMG, { recursive: true });
  let pid = id();
  while (existing.some((x) => x.id === pid || String(x.id).slice(0, 10) === pid.slice(0, 10))) pid = id();
  extras = (extras || []).slice(0, 11);
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
  for (let k = 0; k < 13; k++) {
    const nm = k ? pid + '_' + k : pid;
    try { fs.unlinkSync(path.join(IMG, nm + '.jpg')); } catch {}
    dbDeleteImage(nm);
  }
  try { fs.unlinkSync(path.join(IMG, pid + '_q.jpg')); } catch {}
  dbDeleteImage(pid + '_q');
  return true;
}

// Edit a listing (seller only). Photos: keepIdx = which existing photos stay (in order), newBufs = new photos added after them.
async function updateProduct(pid, sellerId, data, keepIdx, newBufs, qrBuf) {
  const first = peek('products').find((x) => x.id === pid && x.sellerId === sellerId);
  if (!first) return null;
  newBufs = (newBufs || []).filter((b) => b && b.length > 100);
  let all = null;
  if (keepIdx !== null || newBufs.length) {
    const count = Math.max(1, Number(first.imgCount) || 1);
    const keep = (keepIdx === null ? Array.from({ length: count }, (_, k) => k) : keepIdx).filter((k) => Number.isInteger(k) && k >= 0 && k < count);
    const bufs = [];
    for (const k of keep) {
      let fp = imagePath(pid, k);
      try { if (!(await fileExists(fp))) fp = await ensureImage(path.basename(fp, '.jpg')); } catch (e) { fp = null; }
      if (fp) { try { bufs.push(await fsp.readFile(fp)); } catch (e) {} }
    }
    all = bufs.concat(newBufs).slice(0, 12);
    if (!all.length) return { error: 'Keep or add at least one product photo.' };
    await fsp.mkdir(IMG, { recursive: true });
    for (let k = 0; k < all.length; k++) {
      const nm = k ? pid + '_' + k : pid;
      await fsp.writeFile(path.join(IMG, nm + '.jpg'), all[k]);
      dbSaveImage(nm, all[k]);
    }
    for (let k = all.length; k < 13; k++) {
      const nm = k ? pid + '_' + k : pid;
      try { await fsp.unlink(path.join(IMG, nm + '.jpg')); } catch {}
      if (k < Math.max(count, all.length) + 1) dbDeleteImage(nm);
    }
  }
  if (qrBuf && qrBuf.length > 100) {
    await fsp.mkdir(IMG, { recursive: true });
    await fsp.writeFile(path.join(IMG, pid + '_q.jpg'), qrBuf);
    dbSaveImage(pid + '_q', qrBuf);
  }
  // Everything from here on is synchronous. The products are read AGAIN after the awaits above, so a product that
  // was added/edited/deleted by someone else while photos were being processed is never overwritten (lost update).
  const products = read('products');
  const p = products.find((x) => x.id === pid && x.sellerId === sellerId);
  if (!p) return null;
  ['title', 'description', 'category', 'city', 'district', 'sellerAddress'].forEach((k) => { if (data[k] !== undefined) p[k] = data[k]; });
  if (data.price !== undefined) p.price = data.price;
  if (data.mrp !== undefined) p.mrp = data.mrp;
  if (data.expiresAt !== undefined) p.expiresAt = data.expiresAt;
  if (all) { p.imgCount = all.length; p.imgV = Date.now(); }
  if (qrBuf && qrBuf.length > 100) p.hasQr = true;
  p.editedAt = new Date().toISOString();
  write('products', products);
  return p;
}

function imageName(pid, i) {
  const base = String(pid || '').replace(/[^a-f0-9]/gi, '');
  if (i === 'q') return base + '_q';
  const n = Number(i) || 0;
  return n > 0 && n < 12 ? base + '_' + n : base;
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
  return cloneOrNull(peek('accounts').find((a) => a.id === uid));
}

function findAccountByEmail(email) {
  email = String(email || '').toLowerCase();
  return cloneOrNull(peek('accounts').find((a) => a.email === email));
}

// Country is decided by the mobile number itself (+91 -> India, +1 -> USA, +44 -> UK, +971 -> UAE ...).
function countryFromPhone(phone, fallback) {
  const raw = String(phone || '').trim();
  const d = raw.replace(/\D/g, '');
  const fb = String(fallback || 'IN').toUpperCase();
  if (!d) return fb;
  if (raw.startsWith('+') || d.length > 10) {
    if (d.startsWith('91') && d.length === 12) return 'IN';
    if (d.startsWith('971')) return 'AE';
    if (d.startsWith('44')) return 'GB';
    if (d.startsWith('1') && d.length === 11) return 'US';
    if (raw.startsWith('+')) return 'OTHER';
    return fb;
  }
  return fb; // plain national number (older accounts): keep the saved country
}

function findAccountByPhone(phone) {
  const k = normPhone(phone);
  if (!k) return null;
  return cloneOrNull(peek('accounts').find((a) => a.phoneKey && normPhone(a.phoneKey) === k));
}

// Exact Gmail + mobile pair (used by Google login to restore the right account).
function findAccountByPair(email, phone) {
  email = String(email || '').toLowerCase().trim();
  const k = normPhone(phone);
  if (!email || !k) return null;
  return cloneOrNull(peek('accounts').find((a) => a.email === email && normPhone(a.phoneKey || a.phone) === k));
}

// Old Google accounts created before the phone step (no mobile saved yet).
function findPhonelessByEmail(email) {
  email = String(email || '').toLowerCase().trim();
  return cloneOrNull(peek('accounts').find((a) => a.email === email && !normPhone(a.phoneKey || a.phone)));
}

function findAccountByGoogle(gid) {
  return cloneOrNull(peek('accounts').find((a) => a.googleId === gid));
}

function listOrders(recfilter) {
  let o = peek('orders');
  if (recfilter && recfilter.buyerId) o = o.filter((x) => x.buyerId === recfilter.buyerId);
  if (recfilter && recfilter.sellerId) o = o.filter((x) => x.sellerId === recfilter.sellerId && String(x.status).toUpperCase() !== 'PAYMENT_PENDING' && x.paymentStatus !== 'REJECTED');
  return o.map((x) => structuredClone(x)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
// One order by its reference (same match rule the label/track pages used), without copying all orders.
function findOrderByRef(ref) {
  const r = String(ref || '').toUpperCase();
  return cloneOrNull(peek('orders').find((x) => String(x.ref).toUpperCase() === r));
}

function addOrder(data) {
  const orders = read('orders');
  let ref; do { ref = 'ST-' + crypto.randomBytes(8).toString('hex').toUpperCase(); } while (orders.some((x) => x.ref === ref));
  const o = {
    ref,
    buyerId: data.buyerId,
    sellerId: data.sellerId,
    items: data.items,
    total: data.total,
    currency: data.currency || 'INR',
    status: data.paymentMethod === 'ONLINE' ? 'PAYMENT_PENDING' : 'CONFIRMED',
    confirmedAt: data.paymentMethod === 'ONLINE' ? null : new Date().toISOString(),
    paymentMethod: data.paymentMethod === 'ONLINE' ? 'ONLINE' : 'COD',
    txnId: data.paymentMethod === 'ONLINE' ? String(data.txnId || '') : '',
    paymentStatus: data.paymentMethod === 'ONLINE' ? 'AWAITING' : 'PAY_ON_DELIVERY',
    itemsTotal: data.itemsTotal != null ? data.itemsTotal : data.total,
    deliveryCharge: data.deliveryCharge || 0,
    buyerEmail: data.buyerEmail || '',
    name: data.name,
    phone: data.phone,
    phoneKey: normPhone(data.phone),
    address: data.address,
    city: data.city,
    state: data.state || '',
    district: data.district || '',
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
function txnUsed(txn) {
  const t = String(txn || '').toLowerCase();
  return !!t && peek('orders').some((o) => o.txnId && String(o.txnId).toLowerCase() === t);
}
// Owner confirmed the money (exact amount + transaction ID) arrived -> the order becomes CONFIRMED.
function verifyPayment(ref) {
  const orders = read('orders');
  // Only a still-pending online order may be verified; never convert a cancelled
  // or previously rejected payment into a paid/confirmed order by mistake.
  const list = orders.filter((o) => o.ref === ref && o.paymentMethod === 'ONLINE' && String(o.status).toUpperCase() === 'PAYMENT_PENDING' && String(o.paymentStatus || 'AWAITING').toUpperCase() === 'AWAITING');
  if (!list.length) return null;
  list.forEach((o) => {
    o.status = 'CONFIRMED';
    o.confirmedAt = new Date().toISOString();
    o.paymentStatus = 'VERIFIED';
    o.verifiedAt = new Date().toISOString();
  });
  write('orders', orders);
  return list[0];
}
// Money not received / wrong amount -> the order never gets confirmed.
function rejectPayment(ref) {
  const orders = read('orders');
  const list = orders.filter((o) => o.ref === ref && o.paymentMethod === 'ONLINE' && String(o.status).toUpperCase() === 'PAYMENT_PENDING');
  if (!list.length) return null;
  list.forEach((o) => { o.status = 'CANCELLED'; o.paymentStatus = 'REJECTED'; o.cancelReason = 'Payment not received / amount did not match'; o.cancelledAt = new Date().toISOString(); o.cancelledBy = 'admin'; });
  write('orders', orders);
  return list[0];
}
function updateOrderStatus(ref, userId, status, reason) {
  status = String(status || '').toUpperCase();
  if (!ORDER_STATUSES.includes(status)) return { error: 'Invalid status.' };
  const orders = read('orders');
  const o = orders.find((x) => x.ref === ref && (x.sellerId === userId || x.buyerId === userId));
  if (!o) return { error: 'Order not found.' };
  if (String(o.status).toUpperCase() === 'PAYMENT_PENDING') return { error: 'This order is waiting for payment confirmation.' };
  const isBuyer = o.sellerId !== userId;
  if (isBuyer) {
    // buyer may only cancel a still-confirmed order, within 24 hours, with a reason
    if (!(status === 'CANCELLED' && String(o.status).toUpperCase() === 'CONFIRMED')) return { error: 'Change not allowed.' };
    if (Date.now() - new Date(o.createdAt).getTime() > CANCEL_WINDOW_MS) return { error: 'Cancellation time (24 hours) is over. This order can no longer be cancelled.' };
    if (!String(reason || '').trim()) return { error: 'Please tell us why you are cancelling.' };
  }
  o.status = status;
  if (status === 'SHIPPED' && !o.shippedAt) o.shippedAt = new Date().toISOString();
  if (status === 'DELIVERED') { if (!o.shippedAt) o.shippedAt = new Date().toISOString(); o.deliveredAt = new Date().toISOString(); }
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


// ---- stats: the hottest and largest file (every device and every viewed product lives here) ----
// The three stats writers below change the cached object IN PLACE (all synchronous, nothing can interleave) instead
// of copying the whole file for every change, and the file is serialized once per flush (local save every 750 ms,
// database mirror every 5 s) instead of once per change. Reads still return private copies via read().
const statsLazy = () => (CACHE.stats !== undefined ? JSON.stringify(CACHE.stats) : fs.readFileSync(F.stats, 'utf8'));
function statsForUpdate() {
  const o = load('stats');
  if (CACHE.stats === undefined) CACHE.stats = o; // first use / unreadable file: keep working on one shared object
  return o;
}
function statsChanged() {
  ensure();
  LATEST.stats = statsLazy;
  scheduleDisk('stats', 750);
  dbSaveLater('stats', statsLazy, 5000);
}

// Likes: one like per logged-in account (Gmail) per product, like YouTube. Tap again = like removed.
function productLikeInfo(pid, userId) {
  const stats = peek('stats'); // read-only: this runs for every product on every product-list request
  const likes = stats.productLikes || {};
  const ids = Array.isArray(likes[pid]) ? likes[pid] : [];
  const set = new Set(ids.map(String));
  return { count: set.size, liked: !!(userId && set.has(String(userId))) };
}
function toggleProductLike(pid, userId) {
  if (!prodIndex().byId.has(pid) || !userId) return null;
  const stats = statsForUpdate();
  stats.productLikes = stats.productLikes || {};
  const ids = Array.isArray(stats.productLikes[pid]) ? stats.productLikes[pid] : [];
  const set = new Set(ids.map(String));
  let liked;
  if (set.has(String(userId))) { set.delete(String(userId)); liked = false; } else { set.add(String(userId)); liked = true; }
  stats.productLikes[pid] = Array.from(set);
  statsChanged();
  return { count: set.size, liked };
}

// Views: one count per DEVICE (browser cookie), never repeated for the same device.
function recordProductView(pid, dev) {
  if (!dev || !prodIndex().byId.has(pid)) return 0;
  const seen = (peek('stats').productViews || {})[pid];
  if (seen && seen[dev]) return Object.keys(seen).length; // already counted: nothing to write
  const stats = statsForUpdate();
  stats.productViews = stats.productViews || {};
  const m = stats.productViews[pid] || {};
  if (!m[dev]) { m[dev] = 1; stats.productViews[pid] = m; statsChanged(); }
  return Object.keys(m).length;
}
function productViewCount(pid) {
  const stats = peek('stats');
  return Object.keys((stats.productViews || {})[pid] || {}).length;
}

function recordVisit(dev) {
  if (!dev) return;
  const day = new Date().toISOString().slice(0, 10);
  // Fast path: every page view calls this, but a known device on a known day changes nothing.
  const cur = peek('stats');
  const knownDev = !!(cur.devices && cur.devices[dev]);
  const knownToday = !!(cur.seenDay && cur.seenDay.d === day && cur.seenDay.ids && cur.seenDay.ids[dev]);
  if (knownDev && knownToday) return;
  const stats = statsForUpdate();
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
  if (changed) statsChanged();
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
    if (stt !== 'CANCELLED' && stt !== 'PAYMENT_PENDING') {
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
    paySummary: {
      confirmed: orders.filter((o) => String(o.status).toUpperCase() !== 'PAYMENT_PENDING' && String(o.status).toUpperCase() !== 'CANCELLED').length,
      cod: orders.filter((o) => o.paymentMethod !== 'ONLINE' && String(o.status).toUpperCase() !== 'CANCELLED').length,
      onlinePaid: orders.filter((o) => o.paymentMethod === 'ONLINE' && o.paymentStatus === 'VERIFIED' && String(o.status).toUpperCase() !== 'CANCELLED').length,
      onlinePending: orders.filter((o) => String(o.status).toUpperCase() === 'PAYMENT_PENDING').length,
      onlineRejected: orders.filter((o) => o.paymentStatus === 'REJECTED').length,
    },
    onlinePayments: orders.filter((o) => o.paymentMethod === 'ONLINE').slice(0, 100).map((o) => ({
      ref: o.ref, createdAt: o.createdAt, total: o.total, currency: o.currency || 'INR', txnId: o.txnId || '',
      paymentStatus: o.paymentStatus || 'AWAITING', status: String(o.status || 'CONFIRMED').toUpperCase(),
      buyer: o.name, buyerPhone: o.phone, seller: o.sellerShop, sellerPhone: o.sellerPhone || '',
      items: (o.items || []).map((i) => i.qty + 'x ' + i.title).join(', '),
    })),
    onlineTotal: orders.filter((o) => o.paymentMethod === 'ONLINE' && o.paymentStatus === 'VERIFIED' && String(o.status).toUpperCase() !== 'CANCELLED').reduce((a, o) => a + (Number(o.total) || 0), 0),
    recentOrders: orders.slice(0, 40).map((o) => ({
      ref: o.ref, total: o.total, currency: o.currency, country: o.country, city: o.city,
      status: String(o.status || 'CONFIRMED').toUpperCase(), createdAt: o.createdAt,
      buyer: o.name, buyerPhone: o.phone, seller: o.sellerShop,
      items: (o.items || []).map((i) => i.qty + 'x ' + i.title).join(', '),
    })),
  };
}

module.exports = {
  ready, ensureImage, remoteImageUrl, touchAccount, ORDER_STATUSES,
  listProducts, listAllProducts, listProductsBySeller, findOrderByRef, getProduct, addProduct, updateProduct, deleteProduct, imagePath,
  createAccount, updateAccount, findAccountById, findAccountByEmail,
  findAccountByPhone, findAccountByPair, findPhonelessByEmail, findAccountByGoogle, recordProductView, productViewCount, listOrders, addOrder,
  updateOrderStatus, txnUsed, verifyPayment, rejectPayment, countryFromPhone, CANCEL_WINDOW_MS, deleteOrder, dashboardStats, recordVisit, normPhone, ROOT, IMG, productLikeInfo, toggleProductLike,
  flush, shutdown, persistenceStatus,
};

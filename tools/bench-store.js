// Micro-benchmark of the storage layer on synthetic data. Usage: node tools/bench-store.js <path-to-shop-store.js> [products] [accounts] [devices]
// Not a load test of the HTTP server (that needs Express installed); it measures the store code the routes call.
const fs = require('fs'), os = require('os'), path = require('path'), Module = require('module');
const storePath = path.resolve(process.argv[2]);
const NP = Number(process.argv[3] || 2000), NA = Number(process.argv[4] || 5000), ND = Number(process.argv[5] || 20000);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-bench-'));
process.env.DATA_DIR = dir; process.env.DATABASE_URL = 'postgres://fake/fake';
let uploads = 0, uploadBytes = 0;
class FakePool { on() {} async query(sql, p) { if (/INSERT INTO sgm_kv/.test(sql)) { uploads++; uploadBytes += p[1].length; await new Promise((r) => setTimeout(r, 30)); } return { rows: [] }; } }
const realLoad = Module._load; Module._load = function (r, ...a) { return r === 'pg' ? { Pool: FakePool } : realLoad.call(this, r, ...a); };

// ---- synthetic data (written before the store loads, i.e. as if restored) ----
const now = Date.now();
const products = Array.from({ length: NP }, (_, i) => ({ id: ('p' + i).padEnd(16, 'a').replace(/[^a-f0-9]/g, 'a'), sellerId: 's' + (i % 200), shopName: 'Shop', city: 'C', country: 'IN', title: 'Product ' + i, description: 'd'.repeat(120), price: 100 + i, mrp: 200 + i, currency: 'INR', category: 'Other', imgCount: 5, createdAt: new Date(now - i * 60000).toISOString() }));
products.forEach((p, i) => { p.id = 'abcdef' + String(i).padStart(10, '0'); });
const accounts = Array.from({ length: NA }, (_, i) => ({ id: 'acc' + i, name: 'User ' + i, email: 'u' + i + '@x.com', phone: '9' + String(100000000 + i), phoneKey: '9' + String(100000000 + i), country: 'IN', createdAt: new Date(now - i * 1000).toISOString() }));
const stats = { productLikes: {}, productViews: {}, devices: {}, totalVisits: ND };
products.forEach((p, i) => { stats.productLikes[p.id] = Array.from({ length: i % 25 }, (_, k) => 'acc' + k); });
for (let d = 0; d < ND; d++) stats.devices['dev' + d] = 1;
products.slice(0, 500).forEach((p) => { const m = {}; for (let d = 0; d < 40; d++) m['dev' + d] = 1; stats.productViews[p.id] = m; });
fs.mkdirSync(path.join(dir, 'images'), { recursive: true });
fs.writeFileSync(path.join(dir, 'products.json'), JSON.stringify(products));
fs.writeFileSync(path.join(dir, 'accounts.json'), JSON.stringify(accounts));
fs.writeFileSync(path.join(dir, 'stats.json'), JSON.stringify(stats));
fs.writeFileSync(path.join(dir, 'orders.json'), '[]'); fs.writeFileSync(path.join(dir, 'pronto_urls.json'), '{}');

const store = require(storePath);
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const ms = (t) => Number(t) / 1e6;
const res = { products: NP, accounts: NA, devices: ND, statsFileKB: Math.round(fs.statSync(path.join(dir, 'stats.json')).size / 1024), productsFileKB: Math.round(fs.statSync(path.join(dir, 'products.json')).size / 1024) };

// 1) what GET /api/products does in the store: list + per-product like info (old code asked twice per product)
const callsPerProduct = store.listProductsBySeller ? 1 : 2;
function productsRequest() {
  const list = store.listProducts('IN');
  let n = 0;
  for (const p of list) for (let c = 0; c < callsPerProduct; c++) n += store.productLikeInfo(p.id, 'acc3').count;
  return list.length + n * 0;
}
productsRequest();
const lat = []; for (let i = 0; i < Number(process.env.BENCH_RUNS || 20); i++) { const t = process.hrtime.bigint(); productsRequest(); lat.push(ms(process.hrtime.bigint() - t)); }
res.productListRequest_ms = { p50: +pct(lat, 0.5).toFixed(1), p95: +pct(lat, 0.95).toFixed(1), n: lat.length };

// 2) authenticated-request overhead: findAccountById is called twice per request by the router middleware
const l2 = []; for (let i = 0; i < 200; i++) { const t = process.hrtime.bigint(); store.findAccountById('acc' + (i * 7 % NA)); store.findAccountById('acc' + (i * 7 % NA)); l2.push(ms(process.hrtime.bigint() - t)); }
res.authLookupx2_ms = { p50: +pct(l2, 0.5).toFixed(2), p95: +pct(l2, 0.95).toFixed(2) };

// 3) page view path: recordVisit for an already-known device (every /shop page load)
const l3 = []; for (let i = 0; i < 100; i++) { store.recordVisit('dev1'); const t = process.hrtime.bigint(); store.recordVisit('dev1'); l3.push(ms(process.hrtime.bigint() - t)); }
res.knownDeviceVisit_ms = { p50: +pct(l3, 0.5).toFixed(3), p95: +pct(l3, 0.95).toFixed(3) };

(async () => {
  // 4) burst of 100 writes (e.g. 100 new devices / likes): time the callers are blocked + event-loop stalls + DB uploads
  let maxStall = 0, last = process.hrtime.bigint(); const iv = setInterval(() => { const n = process.hrtime.bigint(); maxStall = Math.max(maxStall, ms(n - last) - 5); last = n; }, 5);
  uploads = 0; uploadBytes = 0;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 100; i++) { store.toggleProductLike(products[i % 50].id, 'burstuser' + i); }
  const blocked = ms(process.hrtime.bigint() - t0);
  await new Promise((r) => setTimeout(r, 300));
  if (store.flush) await store.flush();
  const settle = ms(process.hrtime.bigint() - t0);
  if (store.shutdown) await store.shutdown(); else await new Promise((r) => setTimeout(r, 6500));
  clearInterval(iv);
  res.burst100Writes = { callerBlocked_ms: +blocked.toFixed(0), maxEventLoopStall_ms: +Math.max(0, maxStall).toFixed(0), neonBlobUploads: uploads, neonMBUploaded: +(uploadBytes / 1048576).toFixed(1) };
  res.rssMB = Math.round(process.memoryUsage().rss / 1048576);
  console.log(JSON.stringify(res));
  fs.rmSync(dir, { recursive: true, force: true }); process.exit(0);
})();

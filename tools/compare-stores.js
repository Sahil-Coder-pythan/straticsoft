// Differential check: runs the same scripted operations against two copies of shop-store.js (e.g. the original and
// the optimized one) in separate processes and compares every observable result.
// Usage: node tools/compare-stores.js <store-A.js> <store-B.js>
const { spawnSync } = require('child_process');
const path = require('path');
if (process.argv[2] === '--run') {
  const fs = require('fs'), os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-cmp-')); process.env.DATA_DIR = dir;
  delete process.env.DATABASE_URL; delete process.env.IMG_DATABASE_URL; delete process.env.GETPRONTO_API_KEY;
  const store = require(path.resolve(process.argv[3]));
  const out = []; const log = (k, v) => out.push([k, JSON.parse(JSON.stringify(v === undefined ? null : v))]);
  const strip = (x) => JSON.parse(JSON.stringify(x, (k, v) => (['createdAt', 'id', 'ref', 'editedAt', 'imgV', 'confirmedAt', 'lastSeen', 'productCode', 'sellerId', 'cancelledAt', 'verifiedAt'].includes(k) ? undefined : v)));
  const jpg = Buffer.alloc(300, 1);
  (async () => {
    const ids = {};
    const acc = store.createAccount({ email: 'A@x.com', phone: '+91 98765 43210', name: 'A' }); log('acc', strip(acc));
    log('dupAcc', store.createAccount({ email: 'a@x.com', phone: '9876543210' }));
    log('byEmail', strip(store.findAccountByEmail('a@X.com'))); log('byPhone', strip(store.findAccountByPhone('09876543210')));
    log('byPair', strip(store.findAccountByPair('a@x.com', '9876543210'))); log('byGoogle', store.findAccountByGoogle('nope'));
    for (let i = 0; i < 6; i++) {
      const p = store.addProduct({ sellerId: i % 2 ? acc.id : 'other', shopName: 'S' + i, title: 'P' + i, price: 10 * (i + 1), country: i === 5 ? 'US' : 'IN', expiresAt: i === 4 ? '2001-01-01' : null }, jpg, [jpg], null);
      ids[i] = p.id; await new Promise((r) => setTimeout(r, 3));
    }
    const names = (l) => l.map((p) => p.title);
    log('listIN', names(store.listProducts('IN'))); log('listUS', names(store.listProducts('US'))); log('listAll', names(store.listAllProducts()));
    log('getProduct', strip(store.getProduct(ids[2]))); log('getMissing', store.getProduct('zzz'));
    log('update', strip(await store.updateProduct(ids[1], acc.id, { title: 'P1b', price: 99 }, null, [jpg], null)));
    log('updateWrongSeller', await store.updateProduct(ids[0], acc.id, { title: 'x' }, null, [], null));
    log('listAfterUpdate', store.listProducts('IN').map((p) => [p.title, p.price, p.imgCount]));
    log('delete', [store.deleteProduct(ids[3], acc.id), store.deleteProduct(ids[3], acc.id)]); log('listAfterDelete', names(store.listProducts('IN')));
    log('like', [store.toggleProductLike(ids[1], 'u1'), store.toggleProductLike(ids[1], 'u2'), store.toggleProductLike(ids[1], 'u1'), store.toggleProductLike('zzz', 'u1')]);
    log('likeInfo', [store.productLikeInfo(ids[1], 'u2'), store.productLikeInfo(ids[1], 'u1'), store.productLikeInfo('zzz', 'u1')]);
    log('views', [store.recordProductView(ids[1], 'd1'), store.recordProductView(ids[1], 'd1'), store.recordProductView(ids[1], 'd2'), store.recordProductView('zzz', 'd1'), store.productViewCount(ids[1])]);
    store.recordVisit('dv1'); store.recordVisit('dv1'); store.recordVisit('dv2');
    const o1 = store.addOrder({ buyerId: 'b1', sellerId: acc.id, items: [{ qty: 1, title: 'P1b' }], total: 99, paymentMethod: 'ONLINE', txnId: 'TX1', name: 'N', phone: '1', address: 'a', city: 'c', pincode: '1' });
    const o2 = store.addOrder({ buyerId: 'b1', sellerId: acc.id, items: [], total: 5, paymentMethod: 'COD', name: 'N', phone: '1', address: 'a', city: 'c', pincode: '1' });
    log('txn', [store.txnUsed('tx1'), store.txnUsed('nope')]); log('verify', [!!store.verifyPayment(o1.ref), store.verifyPayment(o1.ref)]);
    log('orders', [store.listOrders({ buyerId: 'b1' }).length, store.listOrders({ sellerId: acc.id }).map((o) => o.status)]);
    log('status', [store.updateOrderStatus(o2.ref, 'b1', 'CANCELLED', ''), strip(store.updateOrderStatus(o2.ref, 'b1', 'CANCELLED', 'changed mind').order)]);
    const d = store.dashboardStats(); log('dashboard', strip({ ...d, recentUsers: undefined, recentProducts: undefined, recentOrders: undefined, onlinePayments: undefined }));
    if (store.flush) await store.flush();
    log('disk', ['products', 'accounts', 'orders', 'stats'].map((k) => { const j = JSON.parse(fs.readFileSync(path.join(dir, k + '.json'), 'utf8')); return Array.isArray(j) ? j.length : Object.keys(j).sort(); }));
    console.log(JSON.stringify(out)); fs.rmSync(dir, { recursive: true, force: true }); process.exit(0);
  })();
} else {
  const run = (f) => { const r = spawnSync(process.execPath, [__filename, '--run', f], { encoding: 'utf8' }); if (r.status !== 0) { console.error(r.stderr); process.exit(2); } return JSON.parse(r.stdout.trim().split('\n').pop()); };
  const A = run(process.argv[2]), B = run(process.argv[3]); let bad = 0;
  A.forEach(([k, v], i) => { const same = JSON.stringify(v) === JSON.stringify(B[i][1]); if (!same) { bad++; console.log('DIFF', k, '\n  A:', JSON.stringify(v), '\n  B:', JSON.stringify(B[i][1])); } });
  console.log(bad ? bad + ' of ' + A.length + ' checks differ' : 'all ' + A.length + ' checks identical');
  process.exit(bad ? 1 : 0);
}

// Tests for the storage layer (src/services/shop-store.js): async serialized writes, persistence failures,
// product index invalidation, lost-update protection, read-only fast paths.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-store-'));
process.env.DATA_DIR = dir;
delete process.env.DATABASE_URL;
delete process.env.IMG_DATABASE_URL;
delete process.env.GETPRONTO_API_KEY;
const store = require('../src/services/shop-store');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jpg = (n) => Buffer.alloc(300, n || 7);
const disk = (name) => JSON.parse(fs.readFileSync(path.join(dir, name + '.json'), 'utf8'));
const seller = (id) => ({ sellerId: id, shopName: 'Shop ' + id, title: 'T-' + id, price: 100, country: 'IN' });

test.after(() => { fs.rmSync(dir, { recursive: true, force: true }); });

test('createAccount persists to disk atomically after flush and leaves no tmp file', async () => {
  const a = store.createAccount({ email: 'a@x.com', phone: '9876543210', name: 'A' });
  assert.ok(a && a.id);
  await store.flush();
  assert.equal(disk('accounts').length, 1);
  assert.equal(disk('accounts')[0].email, 'a@x.com');
  assert.deepEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp')), []);
});

test('reads see a write immediately, before it reaches the disk', () => {
  const b = store.createAccount({ email: 'b@x.com', phone: '9876543211' });
  assert.equal(store.findAccountById(b.id).email, 'b@x.com');
  assert.equal(store.findAccountByEmail('b@x.com').id, b.id);
});

test('returned records are private copies (mutating them does not change the store)', () => {
  const a = store.findAccountByEmail('a@x.com');
  a.name = 'HACKED';
  assert.equal(store.findAccountByEmail('a@x.com').name, 'A');
  const p = store.addProduct(seller('s-copy'), jpg(), [], null);
  const list = store.listProducts('IN');
  list.find((x) => x.id === p.id).title = 'HACKED';
  assert.equal(store.getProduct(p.id).title, 'T-s-copy');
});

test('many rapid writes never lose an update and end with the newest state on disk', async () => {
  for (let i = 0; i < 300; i++) store.createAccount({ email: 'u' + i + '@x.com', phone: '98000' + String(10000 + i) });
  const before = disk('accounts').length; // may still be mid-flight; only the final state matters
  assert.ok(before >= 0);
  await store.flush();
  const onDisk = disk('accounts');
  for (let i = 0; i < 300; i++) assert.ok(onDisk.some((x) => x.email === 'u' + i + '@x.com'), 'missing u' + i);
  assert.deepEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp')), []);
});

test('product list index is invalidated by create, edit, price change and delete', async () => {
  const p1 = store.addProduct({ ...seller('s1'), title: 'First' }, jpg(), [], null);
  await sleep(5);
  const p2 = store.addProduct({ ...seller('s1'), title: 'Second' }, jpg(), [], null);
  let ids = store.listProducts('IN').map((p) => p.id);
  assert.ok(ids.indexOf(p2.id) < ids.indexOf(p1.id), 'newest first');
  assert.equal(store.getProduct(p1.id).title, 'First');

  const upd = await store.updateProduct(p1.id, 's1', { title: 'First v2', price: 555 }, null, [], null);
  assert.equal(upd.price, 555);
  assert.equal(store.getProduct(p1.id).title, 'First v2');
  assert.equal(store.listProducts('IN').find((p) => p.id === p1.id).price, 555);

  assert.equal(store.deleteProduct(p2.id, 'someone-else'), false);
  assert.equal(store.deleteProduct(p2.id, 's1'), true);
  assert.equal(store.getProduct(p2.id), null);
  assert.ok(!store.listProducts('IN').some((p) => p.id === p2.id));
  assert.deepEqual(store.listProductsBySeller('s1').map((p) => p.id), [p1.id]);
  await store.flush();
  assert.ok(disk('products').some((p) => p.id === p1.id && p.price === 555));
});

test('country filter and expiry still behave as before', () => {
  const us = store.addProduct({ ...seller('s-us'), country: 'US', title: 'US item' }, jpg(), [], null);
  const old = store.addProduct({ ...seller('s-exp'), title: 'Expired', expiresAt: '2000-01-01' }, jpg(), [], null);
  assert.ok(store.listProducts('US').some((p) => p.id === us.id));
  assert.ok(!store.listProducts('IN').some((p) => p.id === us.id));
  assert.ok(!store.listProducts('IN').some((p) => p.id === old.id), 'expired hidden from the list');
  assert.ok(store.listAllProducts().some((p) => p.id === old.id), 'but still in listAllProducts');
});

test('updateProduct does not overwrite a product added while its photos were being processed (lost update)', async () => {
  const p = store.addProduct({ ...seller('s-race'), title: 'Race' }, jpg(), [jpg(8)], null);
  // keepIdx=[0,1] forces real async file work inside updateProduct
  const pending = store.updateProduct(p.id, 's-race', { title: 'Race edited' }, [0, 1], [jpg(9)], null);
  const added = store.addProduct({ ...seller('s-race2'), title: 'Added during edit' }, jpg(), [], null);
  const done = await pending;
  assert.equal(done.title, 'Race edited');
  assert.equal(done.imgCount, 3);
  assert.ok(store.getProduct(added.id), 'product added during the edit must survive');
  assert.equal(store.getProduct(p.id).title, 'Race edited');
  await store.flush();
  const onDisk = disk('products');
  assert.ok(onDisk.some((x) => x.id === added.id) && onDisk.some((x) => x.id === p.id && x.title === 'Race edited'));
});

test('updateProduct returns null when the product was deleted meanwhile, and keeps the error path for no photos', async () => {
  const p = store.addProduct({ ...seller('s-del'), title: 'Gone' }, jpg(), [], null);
  const pending = store.updateProduct(p.id, 's-del', { title: 'x' }, [0], [jpg(5)], null);
  store.deleteProduct(p.id, 's-del');
  assert.equal(await pending, null);
  const q = store.addProduct({ ...seller('s-nophoto') }, jpg(), [], null);
  const r = await store.updateProduct(q.id, 's-nophoto', {}, [], [], null);
  assert.match(r.error, /at least one product photo/);
});

test('a failed local save is reported, retried, keeps data readable, and succeeds once the problem is gone', async () => {
  const blocker = path.join(dir, 'orders.json.tmp');
  fs.mkdirSync(blocker); // makes writing the tmp file fail with EISDIR
  const origErr = console.error; const logs = []; console.error = (...a) => logs.push(a.join(' '));
  try {
    const o = store.addOrder({ buyerId: 'b1', sellerId: 's1', items: [], total: 10, paymentMethod: 'COD', name: 'N', phone: '1', address: 'a', city: 'c', pincode: '1' });
    await sleep(150);
    const st = store.persistenceStatus().orders;
    assert.ok(st.fails >= 1 && st.pending, 'failure is visible, not silent');
    assert.ok(store.listOrders({ buyerId: 'b1' }).some((x) => x.ref === o.ref), 'data stays readable from memory');
    fs.rmdirSync(blocker);
    await store.flush();
    assert.ok(disk('orders').some((x) => x.ref === o.ref), 'persisted after recovery');
    assert.equal(store.persistenceStatus().orders.fails, 0);
    assert.ok(logs.some((l) => /local save failed for orders/.test(l)));
  } finally { console.error = origErr; }
});

test('likes and views: counts, toggling, one view per device, repeat views do not rewrite', async () => {
  const p = store.addProduct({ ...seller('s-like') }, jpg(), [], null);
  assert.deepEqual(store.productLikeInfo(p.id, 'u1'), { count: 0, liked: false });
  assert.deepEqual(store.toggleProductLike(p.id, 'u1'), { count: 1, liked: true });
  assert.deepEqual(store.toggleProductLike(p.id, 'u2'), { count: 2, liked: true });
  assert.deepEqual(store.productLikeInfo(p.id, 'u1'), { count: 2, liked: true });
  assert.deepEqual(store.toggleProductLike(p.id, 'u1'), { count: 1, liked: false });
  assert.equal(store.recordProductView(p.id, 'devA'), 1);
  await store.flush();
  const mtime = fs.statSync(path.join(dir, 'stats.json')).mtimeMs;
  await sleep(20);
  assert.equal(store.recordProductView(p.id, 'devA'), 1);
  assert.equal(store.recordProductView(p.id, 'devB'), 2);
  assert.equal(store.productViewCount(p.id), 2);
  store.recordVisit('devV'); store.recordVisit('devV');
  await store.flush();
  assert.equal(disk('stats').totalVisits, 1);
  assert.ok(fs.statSync(path.join(dir, 'stats.json')).mtimeMs >= mtime);
  const m2 = fs.statSync(path.join(dir, 'stats.json')).mtimeMs;
  await sleep(20);
  store.recordVisit('devV'); store.recordProductView(p.id, 'devA');
  assert.equal(store.persistenceStatus().stats.pending, false, 'repeat visits/views cause no write');
  assert.equal(fs.statSync(path.join(dir, 'stats.json')).mtimeMs, m2);
});

test('productLikeInfo does not modify stored stats', async () => {
  await store.flush();
  const before = fs.readFileSync(path.join(dir, 'stats.json'), 'utf8');
  store.productLikeInfo('no-such-product', 'u9');
  await store.flush();
  assert.equal(fs.readFileSync(path.join(dir, 'stats.json'), 'utf8'), before);
});

test('findOrderByRef matches case-insensitively like the old listOrders().find()', () => {
  const o = store.addOrder({ buyerId: 'b2', sellerId: 's2', items: [], total: 5, paymentMethod: 'COD', name: 'N', phone: '1', address: 'a', city: 'c', pincode: '1' });
  assert.equal(store.findOrderByRef(o.ref.toLowerCase()).ref, o.ref);
  assert.equal(store.findOrderByRef('ST-NOPE'), null);
});

test('shutdown() flushes pending data synchronously', async () => {
  store.createAccount({ email: 'last@x.com', phone: '9111111111' });
  await store.shutdown();
  assert.ok(disk('accounts').some((a) => a.email === 'last@x.com'));
});

test('stats changed in place are saved once per flush and match a fresh read from disk', async () => {
  const p = store.addProduct({ ...seller('s-stats') }, jpg(), [], null);
  for (let i = 0; i < 200; i++) { store.recordProductView(p.id, 'dev-b' + i); store.toggleProductLike(p.id, 'user-b' + i); store.recordVisit('visit-b' + i); }
  assert.equal(store.productViewCount(p.id), 200);
  assert.equal(store.productLikeInfo(p.id, 'user-b7').count, 200);
  await store.flush();
  const st = disk('stats');
  assert.equal(Object.keys(st.productViews[p.id]).length, 200);
  assert.equal(st.productLikes[p.id].length, 200);
  assert.ok(Object.keys(st.devices).filter((d) => d.startsWith('visit-b')).length === 200);
  assert.equal(store.persistenceStatus().stats.pending, false);
});

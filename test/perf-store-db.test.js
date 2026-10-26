// Neon mirroring with a fake `pg` module: burst writes are coalesced, order is preserved, the latest state wins,
// a failing upload is retried with the SAME snapshot, and shutdown() waits for the queue.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const uploads = []; // {key, value}
let failNext = 0;
class FakePool {
  on() {}
  async query(sql, params) {
    if (/INSERT INTO sgm_kv/.test(sql)) {
      await new Promise((r) => setTimeout(r, 15));
      if (failNext > 0) { failNext--; throw new Error('simulated outage'); }
      uploads.push({ key: params[0], value: params[1] });
    }
    return { rows: [] };
  }
}
const realLoad = Module._load;
Module._load = function (request, ...rest) { return request === 'pg' ? { Pool: FakePool } : realLoad.call(this, request, ...rest); };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-db-'));
process.env.DATA_DIR = dir;
process.env.DATABASE_URL = 'postgres://fake/fake';
delete process.env.IMG_DATABASE_URL; delete process.env.GETPRONTO_API_KEY;
const store = require('../src/services/shop-store');
test.after(() => { Module._load = realLoad; fs.rmSync(dir, { recursive: true, force: true }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const order = (n) => ({ buyerId: 'b', sellerId: 's', items: [], total: n, paymentMethod: 'COD', name: 'N', phone: '1', address: 'a', city: 'c', pincode: '1' });

test('100 rapid order writes upload far fewer than 100 blobs and the last upload holds all 100 orders', async () => {
  for (let i = 0; i < 100; i++) store.addOrder(order(i));
  await store.shutdown();
  const ups = uploads.filter((u) => u.key === 'orders');
  assert.ok(ups.length >= 1 && ups.length <= 3, 'uploads for orders: ' + ups.length);
  assert.equal(JSON.parse(ups[ups.length - 1].value).length, 100);
});

test('a snapshot taken while an upload is running is uploaded afterwards (order preserved, nothing lost)', async () => {
  uploads.length = 0;
  store.addOrder(order(1000));
  await sleep(5); // first upload is now in flight (15 ms)
  store.addOrder(order(1001));
  await store.shutdown();
  const ups = uploads.filter((u) => u.key === 'orders');
  assert.equal(ups.length, 2);
  assert.equal(JSON.parse(ups[0].value).length + 1, JSON.parse(ups[1].value).length);
  assert.equal(JSON.parse(ups[1].value).length, 102);
});

test('a failed upload is retried with the same snapshot', async () => {
  uploads.length = 0;
  failNext = 1;
  const origErr = console.error; console.error = () => {};
  try {
    store.addOrder(order(2000));
    await store.shutdown();
    await sleep(2300); // retry delay is 2 s
    await store.shutdown();
  } finally { console.error = origErr; }
  const ups = uploads.filter((u) => u.key === 'orders');
  assert.equal(ups.length, 1);
  assert.equal(JSON.parse(ups[0].value).length, 103);
});

test('stats snapshot pending in the 5 s batch timer is pushed by shutdown()', async () => {
  uploads.length = 0;
  store.recordVisit('dev-shutdown');
  await store.shutdown();
  const ups = uploads.filter((u) => u.key === 'stats');
  assert.equal(ups.length, 1);
  assert.equal(JSON.parse(ups[0].value).totalVisits, 1);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Isolated file store so the test never touches a developer's or live store data.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'stratic-payment-dup-'));
process.env.DATA_DIR = temp;
const store = require('../src/services/shop-store');

test('one UTR cannot pay for two same-price products/orders', () => {
  const first = store.addOrder({
    buyerId: 'buyer-a', sellerId: 'seller-a', items: [{ id: 'product-a', title: 'Product A', price: 10, qty: 1 }],
    itemsTotal: 10, total: 10, currency: 'INR', paymentMethod: 'ONLINE', txnId: '123456789012',
    name: 'Buyer', phone: '9999999999', address: 'Test', city: 'Test', country: 'IN', pincode: '123456',
    sellerShop: 'Shop', sellerPhone: '8888888888'
  });
  assert.ok(first && first.ref);
  assert.equal(first.status, 'PAYMENT_PENDING');

  // Exact scenario: another product from the same seller, same price and QR,
  // but the buyer reuses the first product's already-submitted UTR.
  const second = store.addOrder({
    buyerId: 'buyer-a', sellerId: 'seller-a', items: [{ id: 'product-b', title: 'Product B', price: 10, qty: 1 }],
    itemsTotal: 10, total: 10, currency: 'INR', paymentMethod: 'ONLINE', txnId: '123456789012',
    name: 'Buyer', phone: '9999999999', address: 'Test', city: 'Test', country: 'IN', pincode: '123456',
    sellerShop: 'Shop', sellerPhone: '8888888888'
  });
  assert.match(second.error, /already been submitted/i);
  assert.equal(store.listOrders({ buyerId: 'buyer-a' }).length, 1);

  // A formatting variation must not bypass the duplicate guard.
  assert.equal(store.txnUsed('1234-5678-9012'), true);

  // The real bank-statement UTR can verify the first order only once.
  const verified = store.verifyPayment(first.ref, '123456789012');
  assert.equal(verified.status, 'CONFIRMED');
  assert.equal(verified.paymentStatus, 'VERIFIED');
  const secondVerify = store.verifyPayment('ST-NOT-REAL', '123456789012');
  assert.equal(secondVerify, null);
});

test('a different UTR remains eligible for a separate same-price order', () => {
  const order = store.addOrder({
    buyerId: 'buyer-b', sellerId: 'seller-a', items: [{ id: 'product-b', title: 'Product B', price: 10, qty: 1 }],
    itemsTotal: 10, total: 10, currency: 'INR', paymentMethod: 'ONLINE', txnId: '998877665544',
    name: 'Buyer', phone: '9999999999', address: 'Test', city: 'Test', country: 'IN', pincode: '123456',
    sellerShop: 'Shop', sellerPhone: '8888888888'
  });
  assert.ok(order && order.ref);
  assert.equal(order.status, 'PAYMENT_PENDING');
});

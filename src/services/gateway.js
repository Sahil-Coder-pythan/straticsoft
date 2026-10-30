/**
 * Payment gateway (Razorpay) for sellers with large payment volume.
 * Security rules:
 *  - the seller's Key Secret is encrypted (AES-256-GCM) and NEVER sent back to any browser;
 *  - the buyer's browser only ever receives the public Key ID, order id and amount;
 *  - an order becomes CONFIRMED only after the server verifies Razorpay's signature
 *    (and asks Razorpay for the payment status). The browser is never trusted.
 */
const crypto = require('crypto');
const SEED = String(process.env.GATEWAY_ENC_KEY || process.env.SESSION_SECRET || process.env.SECRET_KEY || process.env.DATABASE_URL || process.env.ADMIN_PASSWORD || 'stratic-market-fixed-seed');
const KEY = crypto.createHash('sha256').update('gw:' + SEED).digest();
const API = 'https://api.razorpay.com/v1';

function enc(plain) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return [iv.toString('base64'), c.getAuthTag().toString('base64'), ct.toString('base64')].join('.');
}
function dec(blob) {
  try {
    const [iv, tag, ct] = String(blob).split('.').map((x) => Buffer.from(x, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, iv); d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
  } catch (e) { return ''; }
}
function auth(keyId, secret) { return 'Basic ' + Buffer.from(keyId + ':' + secret).toString('base64'); }
async function rz(method, path, keyId, secret, body) {
  const r = await fetch(API + path, { method, headers: { Authorization: auth(keyId, secret), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error((j.error && j.error.description) || 'Gateway error'); e.status = r.status; throw e; }
  return j;
}
const validKeyId = (k) => /^rzp_(live|test)_[A-Za-z0-9]{8,30}$/.test(k);
const mask = (k) => (k ? k.slice(0, 9) + '••••••' + k.slice(-3) : '');

// Save keys only if Razorpay itself accepts them.
async function connect(keyId, secret) {
  if (!validKeyId(keyId)) throw new Error('Key ID must look like rzp_live_xxxxxxxx (from your Razorpay dashboard).');
  if (!/^[A-Za-z0-9]{10,60}$/.test(secret)) throw new Error('Key Secret looks wrong.');
  await rz('GET', '/orders?count=1', keyId, secret);
  return { provider: 'razorpay', keyId, secretEnc: enc(secret), mode: keyId.startsWith('rzp_live') ? 'live' : 'test', at: new Date().toISOString() };
}
async function createOrder(gw, amountPaise, receipt) {
  return rz('POST', '/orders', gw.keyId, dec(gw.secretEnc), { amount: amountPaise, currency: 'INR', receipt: String(receipt).slice(0, 40), payment_capture: 1 });
}
function signatureOk(gw, orderId, paymentId, sig) {
  const want = crypto.createHmac('sha256', dec(gw.secretEnc)).update(orderId + '|' + paymentId).digest('hex');
  const a = Buffer.from(want), b = Buffer.from(String(sig || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
async function paymentIsPaid(gw, paymentId, orderId, amountPaise) {
  const p = await rz('GET', '/payments/' + encodeURIComponent(paymentId), gw.keyId, dec(gw.secretEnc));
  return p.order_id === orderId && Number(p.amount) >= Number(amountPaise) && (p.status === 'captured' || p.status === 'authorized');
}
module.exports = { connect, createOrder, signatureOk, paymentIsPaid, mask };

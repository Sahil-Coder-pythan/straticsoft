/**
 * Stratic Market – phone notifications for chat messages (Web Push).
 *  - Works when the app/browser is closed (the phone's own push service wakes the notification).
 *  - No third-party account needed: VAPID keys are created automatically and stored in the database
 *    (or set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in Render to pin your own).
 *  - Subscriptions are stored in Postgres (DATABASE_URL) or, without a database, in a local JSON file.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

let webpush = null;
try { webpush = require('web-push'); } catch (e) { console.warn('web-push is not installed: phone notifications are switched off. Run "npm install".'); }

const ROOT = process.env.DATA_DIR || (process.env.RENDER === 'true' ? path.join('/tmp', 'stratic-market') : path.join(process.cwd(), 'data'));
const DB_URL = String(process.env.DATABASE_URL || '').trim();
const MAX_PER_USER = 8;

const subs = new Map();   // userId -> Map(endpoint -> subscription)
let pool = null;
let keys = null;          // { publicKey, privateKey }
let fileTimer = null;
const FS = path.join(ROOT, 'push_subs.json');
const FK = path.join(ROOT, 'push_keys.json');

function saveFileSoon() {
  if (pool || fileTimer) return;
  fileTimer = setTimeout(() => {
    fileTimer = null;
    try {
      fs.mkdirSync(ROOT, { recursive: true });
      const all = [];
      for (const [uid, m] of subs) for (const sub of m.values()) all.push({ uid, sub });
      fs.writeFileSync(FS, JSON.stringify(all), 'utf8');
    } catch (e) { /* ignore */ }
  }, 1000);
}

const ready = (async () => {
  if (!webpush) return;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: process.env.VAPID_PUBLIC_KEY.trim(), privateKey: process.env.VAPID_PRIVATE_KEY.trim() };
  }
  if (DB_URL) {
    try {
      const { Pool } = require('pg');
      pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 2, connectionTimeoutMillis: 10000 });
      pool.on('error', () => {});
      await pool.query('CREATE TABLE IF NOT EXISTS sgm_push_keys (id text PRIMARY KEY, data text NOT NULL)');
      await pool.query('CREATE TABLE IF NOT EXISTS sgm_push_subs (endpoint text PRIMARY KEY, user_id text NOT NULL, data text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())');
      await pool.query('CREATE INDEX IF NOT EXISTS sgm_push_subs_user ON sgm_push_subs (user_id)');
      if (!keys) {
        const r = await pool.query("SELECT data FROM sgm_push_keys WHERE id = 'vapid'");
        if (r.rows[0]) { try { keys = JSON.parse(r.rows[0].data); } catch (e) { keys = null; } }
        if (!keys) {
          keys = webpush.generateVAPIDKeys();
          await pool.query("INSERT INTO sgm_push_keys (id, data) VALUES ('vapid', $1) ON CONFLICT (id) DO NOTHING", [JSON.stringify(keys)]);
          const r2 = await pool.query("SELECT data FROM sgm_push_keys WHERE id = 'vapid'");   // another instance may have won the race
          try { keys = JSON.parse(r2.rows[0].data); } catch (e) { /* keep ours */ }
        }
      }
      const rs = await pool.query('SELECT user_id, data FROM sgm_push_subs');
      rs.rows.forEach((row) => { try { addLocal(row.user_id, JSON.parse(row.data)); } catch (e) { /* skip */ } });
    } catch (e) {
      console.error('Push database unavailable, using local files:', e && e.message);
      if (pool) { try { await pool.end(); } catch (_) { /* ignore */ } }
      pool = null;
    }
  }
  if (!pool) {
    try { if (!keys) keys = JSON.parse(fs.readFileSync(FK, 'utf8')); } catch (e) { /* first run */ }
    if (!keys) {
      keys = webpush.generateVAPIDKeys();
      try { fs.mkdirSync(ROOT, { recursive: true }); fs.writeFileSync(FK, JSON.stringify(keys), 'utf8'); } catch (e) { /* ignore */ }
    }
    try { JSON.parse(fs.readFileSync(FS, 'utf8')).forEach((x) => addLocal(x.uid, x.sub)); } catch (e) { /* first run */ }
  }
  try {
    const subject = process.env.VAPID_SUBJECT || (config.appUrl && /^https?:\/\//.test(config.appUrl) ? config.appUrl : 'mailto:support@straticmarket.com');
    webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
    console.log('Phone notifications ready');
  } catch (e) { console.error('Push setup failed:', e && e.message); keys = null; }
})().catch((e) => { console.error('Push init failed:', e && e.message); keys = null; });

function addLocal(uid, sub) {
  if (!uid || !sub || !sub.endpoint) return;
  let m = subs.get(uid); if (!m) { m = new Map(); subs.set(uid, m); }
  m.set(sub.endpoint, sub);
  while (m.size > MAX_PER_USER) m.delete(m.keys().next().value);
}

function enabled() { return !!(webpush && keys); }
function publicKey() { return keys ? keys.publicKey : ''; }

function validSub(sub) {
  return !!(sub && typeof sub.endpoint === 'string' && /^https:\/\//.test(sub.endpoint) && sub.endpoint.length < 1000
    && sub.keys && typeof sub.keys.p256dh === 'string' && typeof sub.keys.auth === 'string');
}

async function subscribe(uid, sub) {
  if (!validSub(sub)) return false;
  const clean = { endpoint: sub.endpoint, expirationTime: sub.expirationTime || null, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } };
  // the same phone endpoint always belongs to the account that is signed in on it right now
  for (const [u, m] of subs) if (u !== uid && m.delete(clean.endpoint) && !m.size) subs.delete(u);
  addLocal(uid, clean);
  if (pool) { try { await pool.query('INSERT INTO sgm_push_subs (endpoint, user_id, data) VALUES ($1, $2, $3) ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, data = EXCLUDED.data', [clean.endpoint, uid, JSON.stringify(clean)]); } catch (e) { console.error('push subscribe save failed:', e && e.message); } }
  else saveFileSoon();
  return true;
}
async function unsubscribe(uid, endpoint) {
  const m = subs.get(uid); if (m) { m.delete(endpoint); if (!m.size) subs.delete(uid); }
  if (pool) { try { await pool.query('DELETE FROM sgm_push_subs WHERE endpoint = $1 AND user_id = $2', [endpoint, uid]); } catch (e) { /* ignore */ } }
  else saveFileSoon();
}
function hasSubscription(uid) { const m = subs.get(uid); return !!(m && m.size); }

async function dropEndpoint(uid, endpoint) {
  const m = subs.get(uid); if (m) { m.delete(endpoint); if (!m.size) subs.delete(uid); }
  if (pool) { try { await pool.query('DELETE FROM sgm_push_subs WHERE endpoint = $1', [endpoint]); } catch (e) { /* ignore */ } }
  else saveFileSoon();
}

async function send(uid, payload) {
  await ready;
  if (!enabled()) return 0;
  const m = subs.get(uid); if (!m || !m.size) return 0;
  const body = JSON.stringify(payload);
  let ok = 0;
  await Promise.all([...m.values()].map(async (sub) => {
    try { await webpush.sendNotification(sub, body, { TTL: 60 * 60 * 24, urgency: 'high' }); ok++; }
    catch (e) {
      const code = e && e.statusCode;
      if (code === 404 || code === 410) await dropEndpoint(uid, sub.endpoint);   // phone removed the permission / app
      else console.error('push send failed:', code || (e && e.message));
    }
  }));
  return ok;
}

// ---- signed one-time-style token that lets the notification's Reply button answer without opening the app ----
const secret = crypto.createHash('sha256').update('sgm-push-reply:' + String(config.sessionSecret || process.env.SECRET_KEY || '') + ':' + String(process.env.DATABASE_URL || process.env.GOOGLE_CLIENT_SECRET || process.env.ADMIN_PASSWORD || 'stratic-market-fixed-seed')).digest();
const sign = (v) => crypto.createHmac('sha256', secret).update(v).digest('base64url');
function makeReplyToken(threadId, userId) {
  const p = Buffer.from(JSON.stringify({ t: threadId, u: userId, e: Date.now() + 24 * 3600 * 1000 })).toString('base64url');
  return p + '.' + sign(p);
}
function readReplyToken(tok) {
  const [p, s] = String(tok || '').split('.');
  if (!p || !s) return null;
  const a = Buffer.from(s), b = Buffer.from(sign(p));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const o = JSON.parse(Buffer.from(p, 'base64url').toString()); return o.e > Date.now() ? { threadId: o.t, userId: o.u } : null; } catch (e) { return null; }
}

module.exports = { ready, enabled, publicKey, subscribe, unsubscribe, hasSubscription, send, makeReplyToken, readReplyToken };

/**
 * Stratic Market Chat store (buyer <-> seller, one conversation per buyer per product).
 * Built for many people chatting at once:
 *  - all conversations are kept in memory, so reading is instant;
 *  - every new message is ONE tiny INSERT into Postgres (never rewrites a big file);
 *  - messages are kept permanently in the database (memory holds the newest 400 per conversation);
 *  - live delivery to open apps with Server-Sent Events (no extra service, no API key).
 * Without DATABASE_URL it falls back to local JSON files (fine for testing).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.env.DATA_DIR || (process.env.RENDER === 'true' ? path.join('/tmp', 'stratic-market') : path.join(process.cwd(), 'data'));
const DB_URL = String(process.env.DATABASE_URL || '').trim();
const MEM_KEEP = 400;
const ENABLED = String(process.env.CHAT_ENABLED || 'true').toLowerCase() !== 'false';

const threads = new Map();      // threadId -> thread
const msgCache = new Map();     // threadId -> [messages] (newest MEM_KEEP, oldest first)
const loading = new Map();      // threadId -> Promise
const subs = new Map();         // userId -> Set(res)  (live connections)
let pool = null;
let chain = Promise.resolve();

function id() { return crypto.randomBytes(8).toString('hex'); }
function later(fn) { chain = chain.then(fn).catch((e) => { console.error('chat db write failed:', e && e.message); }); }

// ---------- local-file fallback (no database) ----------
const FT = path.join(ROOT, 'chat_threads.json');
const FM = path.join(ROOT, 'chat_msgs.json');
let fileTimer = null;
function fileSaveSoon() {
  if (pool || fileTimer) return;
  fileTimer = setTimeout(() => {
    fileTimer = null;
    try {
      fs.mkdirSync(ROOT, { recursive: true });
      const all = [];
      for (const l of msgCache.values()) all.push(...l);
      fs.writeFileSync(FT, JSON.stringify([...threads.values()]), 'utf8');
      fs.writeFileSync(FM, JSON.stringify(all), 'utf8');
    } catch (e) { /* ignore */ }
  }, 1500);
}

// ---------- startup ----------
const ready = (async () => {
  if (!ENABLED) return;
  if (DB_URL) {
    try {
      const { Pool } = require('pg');
      pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 4, connectionTimeoutMillis: 10000 });
      pool.on('error', () => {});
      await pool.query('CREATE TABLE IF NOT EXISTS sgm_chat_threads (id text PRIMARY KEY, data text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())');
      await pool.query('CREATE TABLE IF NOT EXISTS sgm_chat_msgs (id text PRIMARY KEY, thread_id text NOT NULL, from_id text NOT NULL, body text NOT NULL, at text NOT NULL)');
      await pool.query('ALTER TABLE sgm_chat_msgs ADD COLUMN IF NOT EXISTS seen boolean NOT NULL DEFAULT false');
      await pool.query('ALTER TABLE sgm_chat_msgs ADD COLUMN IF NOT EXISTS delivered boolean NOT NULL DEFAULT false');
      await pool.query('ALTER TABLE sgm_chat_msgs ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false');
      await pool.query('ALTER TABLE sgm_chat_msgs ADD COLUMN IF NOT EXISTS edited boolean NOT NULL DEFAULT false');
      await pool.query('CREATE TABLE IF NOT EXISTS sgm_chat_imgs (id text PRIMARY KEY, thread_id text NOT NULL, data bytea NOT NULL)');
      await pool.query('CREATE INDEX IF NOT EXISTS sgm_chat_msgs_thread ON sgm_chat_msgs (thread_id, at)');
      const r = await pool.query('SELECT data FROM sgm_chat_threads');
      r.rows.forEach((row) => { try { const t = JSON.parse(row.data); threads.set(t.id, t); } catch (e) { /* skip */ } });
      console.log('Chat ready: ' + threads.size + ' conversations');
      return;
    } catch (e) {
      console.error('Chat database unavailable, using local files:', e && e.message);
      pool = null;
    }
  }
  try {
    const t = JSON.parse(fs.readFileSync(FT, 'utf8')); t.forEach((x) => threads.set(x.id, x));
    const m = JSON.parse(fs.readFileSync(FM, 'utf8'));
    m.forEach((x) => { if (!msgCache.has(x.threadId)) msgCache.set(x.threadId, []); msgCache.get(x.threadId).push(x); });
  } catch (e) { /* first run */ }
})();

function saveThread(t) {
  if (pool) later(() => pool.query('INSERT INTO sgm_chat_threads (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()', [t.id, JSON.stringify(t)]));
  else fileSaveSoon();
}

// ---------- conversations ----------
function threadsFor(userId) {
  const out = [];
  for (const t of threads.values()) if (t.sellerId === userId || t.buyerId === userId) out.push(t);
  return out.sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)));
}
function getThread(tid) { return threads.get(tid) || null; }
function start(product, buyer, seller) {
  for (const t of threads.values()) if (t.productId === product.id && t.buyerId === buyer.id) return t;
  const now = new Date().toISOString();
  const t = {
    id: id(), productId: product.id, productTitle: String(product.title || '').slice(0, 120),
    sellerId: product.sellerId, buyerId: buyer.id,
    sellerName: String((seller && seller.name) || product.shopName || 'Seller').slice(0, 60),
    buyerName: String(buyer.name || 'Buyer').slice(0, 60),
    createdAt: now, lastAt: now, lastText: '', unread: {}, blockedBy: [], reports: [],
  };
  threads.set(t.id, t); saveThread(t);
  return t;
}
function unreadTotal(userId) {
  let n = 0;
  for (const t of threads.values()) if ((t.sellerId === userId || t.buyerId === userId) && t.unread) n += t.unread[userId] || 0;
  return n;
}
function patch(tid, fn) { const t = threads.get(tid); if (!t) return null; fn(t); saveThread(t); return t; }
function markRead(tid, userId) {
  const t = threads.get(tid);
  if (!t) return;
  // WhatsApp-style "seen": every message from the other person becomes seen
  let changed = false;
  (msgCache.get(tid) || []).forEach((m) => { if (m.from !== userId && !m.seen) { m.seen = true; m.delivered = true; changed = true; } });
  if (changed || (t.unread && t.unread[userId])) {
    const other = userId === t.sellerId ? t.buyerId : t.sellerId;
    if (pool) later(() => pool.query('UPDATE sgm_chat_msgs SET seen = true, delivered = true WHERE thread_id = $1 AND from_id <> $2 AND seen = false', [tid, userId]));
    else fileSaveSoon();
    publish(other, 'seen', { threadId: tid });
  }
  if (t.unread && t.unread[userId]) { t.unread[userId] = 0; saveThread(t); }
}
const IMG_DIR = path.join(ROOT, 'chat_imgs');
const imgOwner = new Map(); // photo id -> threadId (for access checks)
function saveImg(mid, tid, buf) {
  imgOwner.set(mid, tid);
  if (pool) later(() => pool.query('INSERT INTO sgm_chat_imgs (id, thread_id, data) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING', [mid, tid, buf]));
  else { try { fs.mkdirSync(IMG_DIR, { recursive: true }); fs.writeFileSync(path.join(IMG_DIR, mid + '.jpg'), buf); fs.writeFileSync(path.join(IMG_DIR, mid + '.t'), tid); } catch (e) { /* ignore */ } }
}
// Photo bytes only for a person who is part of that conversation.
async function getImg(mid, userId) {
  mid = String(mid).replace(/[^a-f0-9]/gi, '');
  let tid = imgOwner.get(mid), buf = null;
  if (pool) { const r = await pool.query('SELECT thread_id, data FROM sgm_chat_imgs WHERE id = $1', [mid]); if (!r.rows[0]) return null; tid = r.rows[0].thread_id; buf = r.rows[0].data; }
  else { try { tid = fs.readFileSync(path.join(IMG_DIR, mid + '.t'), 'utf8'); buf = fs.readFileSync(path.join(IMG_DIR, mid + '.jpg')); } catch (e) { return null; } }
  const t = threads.get(tid); if (!t || (t.sellerId !== userId && t.buyerId !== userId)) return null;
  return buf;
}
// WhatsApp-style state of a message: sent -> delivered -> seen
function stateOf(m) { return m.seen ? 'seen' : (m.delivered ? 'delivered' : 'sent'); }
// A person's app connected / opened the list: everything sent to them has now "reached" them.
function markDelivered(userId) {
  const bySender = new Map();
  for (const t of threads.values()) {
    if (t.sellerId !== userId && t.buyerId !== userId) continue;
    (msgCache.get(t.id) || []).forEach((m) => { if (m.from !== userId && !m.delivered) { m.delivered = true; bySender.set(t.id + '|' + m.from, { tid: t.id, from: m.from }); } });
  }
  if (!bySender.size) return;
  if (pool) later(() => pool.query('UPDATE sgm_chat_msgs SET delivered = true WHERE delivered = false AND from_id <> $1 AND thread_id IN (SELECT id FROM sgm_chat_threads WHERE data LIKE $2)', [userId, '%' + userId + '%']));
  else fileSaveSoon();
  for (const x of bySender.values()) publish(x.from, 'delivered', { threadId: x.tid });
}

// Delete for everyone (only your own message). The other person's copy is removed too.
async function deleteMsg(tid, userId, mid) {
  const t = threads.get(tid); if (!t) return null;
  const m = (await loadMsgs(tid)).find((x) => x.id === mid);
  if (!m || m.from !== userId || m.deleted) return null;
  const wasImg = String(m.text).startsWith('IMG:');
  m.deleted = true; m.text = '';
  if (pool) later(async () => { await pool.query("UPDATE sgm_chat_msgs SET deleted = true, body = '' WHERE id = $1", [mid]); if (wasImg) await pool.query('DELETE FROM sgm_chat_imgs WHERE id = $1', [mid]); });
  else { fileSaveSoon(); if (wasImg) { try { fs.unlinkSync(path.join(IMG_DIR, mid + '.jpg')); } catch (e) { /* ignore */ } } }
  imgOwner.delete(mid);
  if (t.lastMsgId === mid || true) { const l = msgCache.get(tid) || []; const last = [...l].reverse().find((x) => !x.deleted); t.lastText = last ? (String(last.text).startsWith('IMG:') ? '📷 Photo' : String(last.text).slice(0, 80)) : ''; saveThread(t); }
  publish(userId === t.sellerId ? t.buyerId : t.sellerId, 'msgdel', { threadId: tid, id: mid });
  return m;
}
const EDIT_WINDOW_MS = 15 * 60 * 1000;
async function editMsg(tid, userId, mid, text) {
  const t = threads.get(tid); if (!t) return null;
  const m = (await loadMsgs(tid)).find((x) => x.id === mid);
  if (!m || m.from !== userId || m.deleted || String(m.text).startsWith('IMG:')) return null;
  if (Date.now() - new Date(m.at).getTime() > EDIT_WINDOW_MS) return { error: 'You can edit a message only within 15 minutes.' };
  m.text = String(text).slice(0, 1000); m.edited = true;
  if (pool) later(() => pool.query('UPDATE sgm_chat_msgs SET body = $2, edited = true WHERE id = $1', [mid, m.text])); else fileSaveSoon();
  publish(userId === t.sellerId ? t.buyerId : t.sellerId, 'msgedit', { threadId: tid, id: mid, text: m.text });
  return m;
}
function typing(tid, fromId) { const t = threads.get(tid); if (!t) return; publish(fromId === t.sellerId ? t.buyerId : t.sellerId, 'typing', { threadId: tid }); }

// ---------- messages ----------
async function loadMsgs(tid) {
  if (msgCache.has(tid)) return msgCache.get(tid);
  if (!pool) { msgCache.set(tid, []); return msgCache.get(tid); }
  if (!loading.has(tid)) {
    loading.set(tid, pool.query('SELECT id, thread_id, from_id, body, at, seen, delivered, deleted, edited FROM sgm_chat_msgs WHERE thread_id = $1 ORDER BY at DESC LIMIT $2', [tid, MEM_KEEP])
      .then((r) => { const l = r.rows.reverse().map((x) => ({ id: x.id, threadId: x.thread_id, from: x.from_id, text: x.body, at: x.at, seen: !!x.seen, delivered: !!x.delivered || !!x.seen, deleted: !!x.deleted, edited: !!x.edited })); if (!msgCache.has(tid)) msgCache.set(tid, l); return msgCache.get(tid); })
      .catch(() => { if (!msgCache.has(tid)) msgCache.set(tid, []); return msgCache.get(tid); })
      .finally(() => loading.delete(tid)));
  }
  return loading.get(tid);
}
async function messages(tid, afterIso) {
  const l = await loadMsgs(tid);
  return afterIso ? l.filter((m) => String(m.at) > String(afterIso)) : l.slice();
}
async function add(tid, fromId, text, imgBuf, caption) {
  const isImg = !!imgBuf;
  const t = threads.get(tid); if (!t) return null;
  const l = await loadMsgs(tid);
  const now = new Date().toISOString();
  const m = { id: id(), threadId: tid, from: fromId, text: isImg ? '' : String(text).slice(0, 1000), at: now, seen: false, delivered: false };
  const other0 = fromId === t.sellerId ? t.buyerId : t.sellerId;
  if (subs.get(other0) && subs.get(other0).size) m.delivered = true;   // their app is open -> reached them
  if (isImg) { m.text = 'IMG:/shop/api/chat/img/' + m.id + (caption ? '\n' + String(caption).slice(0, 500) : ''); saveImg(m.id, tid, imgBuf); }
  l.push(m); if (l.length > MEM_KEEP) l.splice(0, l.length - MEM_KEEP);
  if (pool) later(() => pool.query('INSERT INTO sgm_chat_msgs (id, thread_id, from_id, body, at, seen, delivered) VALUES ($1, $2, $3, $4, $5, false, $6)', [m.id, m.threadId, m.from, m.text, m.at, m.delivered]));
  else fileSaveSoon();
  const other = fromId === t.sellerId ? t.buyerId : t.sellerId;
  t.unread = t.unread || {}; t.unread[other] = (t.unread[other] || 0) + 1;
  t.lastAt = now; t.lastText = isImg ? ('📷 ' + (caption ? String(caption).slice(0, 60) : 'Photo')) : m.text.slice(0, 80);
  saveThread(t);
  // live push to both people (their other open devices too)
  [t.sellerId, t.buyerId].forEach((uid) => publish(uid, 'chat', { threadId: tid, message: { id: m.id, mine: uid === fromId, text: m.text, at: m.at, st: stateOf(m) }, unread: unreadTotal(uid) }));
  return m;
}

// ---------- live connections (Server-Sent Events) ----------
const MAX_PER_USER = 4, MAX_TOTAL = 3000;
let total = 0;
function subscribe(userId, res) {
  let set = subs.get(userId);
  if (!set) { set = new Set(); subs.set(userId, set); }
  if (total >= MAX_TOTAL) return false;
  if (set.size >= MAX_PER_USER) { const old = set.values().next().value; try { old.end(); } catch (e) { /* gone */ } set.delete(old); total--; }
  set.add(res); total++;
  return () => { if (set.delete(res)) total--; if (!set.size) subs.delete(userId); };
}
function publish(userId, event, data) {
  const set = subs.get(userId); if (!set) return;
  const line = 'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n';
  for (const r of set) { try { r.write(line); } catch (e) { /* closed */ } }
}
setInterval(() => { for (const set of subs.values()) for (const r of set) { try { r.write(': ping\n\n'); } catch (e) { /* closed */ } } }, 25000).unref();

module.exports = {
  deleteMsg, editMsg,
  getImg, markDelivered, typing, stateOf, ready, ENABLED, threadsFor, getThread, start, unreadTotal, patch, markRead, messages, add, subscribe, publish };

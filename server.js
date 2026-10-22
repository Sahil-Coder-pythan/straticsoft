// StratisSoft server: accounts (email+password, Google, forgot-password codes), per-user storage in Postgres, Brevo mail.
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const { GOOGLE_CLIENT_ID: CID, GOOGLE_CLIENT_SECRET: SEC, JWT_SECRET, DATABASE_URL, BREVO_API_KEY, MAIL_FROM } = process.env;
if (!JWT_SECRET || !DATABASE_URL) { console.error('Set JWT_SECRET and DATABASE_URL'); process.exit(1); }

const db = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
const gclient = new OAuth2Client(CID, SEC, 'postmessage');
const app = express();
app.use(express.json({ limit: '2mb' }));

const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length < 255;
const norm = e => String(e || '').trim().toLowerCase();
const hashCode = (e, c) => crypto.createHash('sha256').update(e + ':' + c + ':' + JWT_SECRET).digest('hex');
const fail = (res, code, error) => res.status(code).json({ error });
const tokenFor = u => ({ token: jwt.sign({ sub: String(u.id), email: u.email, name: u.name || u.email.split('@')[0] }, JWT_SECRET, { expiresIn: '30d' }) });

async function mail(to, name, subject, html) {
  if (!BREVO_API_KEY || !MAIL_FROM) throw new Error('Email service not configured');
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: { email: MAIL_FROM, name: 'StratisSoft' }, to: [{ email: to, name: name || to }], subject, htmlContent: html })
  });
  if (!r.ok) throw new Error('Email could not be sent');
}
const welcome = u => mail(u.email, u.name, 'Welcome to StratisSoft Suite',
  `<p>Hi ${esc(u.name || u.email)},</p><p>Your StratisSoft account is ready. Your history and dashboards are private to you and are kept safely.</p>`).catch(() => {});

// simple brute-force guard for login
const tries = new Map();
function limited(key) { const t = tries.get(key); return t && t.n >= 8 && Date.now() - t.at < 15 * 60e3; }
function bump(key) { const t = tries.get(key); tries.set(key, { n: (t && Date.now() - t.at < 15 * 60e3 ? t.n : 0) + 1, at: Date.now() }); }

async function checkCode(email, purpose, code) {
  const { rows } = await db.query('SELECT * FROM ss_codes WHERE email=$1 AND purpose=$2', [email, purpose]);
  const r = rows[0];
  if (!r || new Date(r.expires) < new Date() || r.tries >= 5) throw new Error('Code expired. Request a new code.');
  if (r.hash !== hashCode(email, String(code).trim())) {
    await db.query('UPDATE ss_codes SET tries=tries+1 WHERE email=$1 AND purpose=$2', [email, purpose]);
    throw new Error('Wrong code');
  }
  await db.query('DELETE FROM ss_codes WHERE email=$1 AND purpose=$2', [email, purpose]);
}

app.get('/config.js', (req, res) => {
  res.type('application/javascript').send('window.APP_CONFIG=' + JSON.stringify({ clientId: CID || '' }) + ';');
});

app.post('/api/auth/send-code', async (req, res) => {
  try {
    const email = norm(req.body.email), purpose = req.body.purpose;
    if (!emailOk(email) || !['signup', 'reset'].includes(purpose)) return fail(res, 400, 'Enter a valid email');
    const u = (await db.query('SELECT id FROM ss_users WHERE email=$1', [email])).rows[0];
    if (purpose === 'signup' && u) return fail(res, 400, 'Account already exists. Please login.');
    if (purpose === 'reset' && !u) return res.json({ ok: true }); // do not reveal which emails exist
    const prev = (await db.query('SELECT sent_at FROM ss_codes WHERE email=$1 AND purpose=$2', [email, purpose])).rows[0];
    if (prev && Date.now() - new Date(prev.sent_at) < 60e3) return fail(res, 429, 'Wait a minute before requesting another code');
    const code = String(crypto.randomInt(100000, 1000000));
    await db.query(`INSERT INTO ss_codes(email,purpose,hash,expires,tries,sent_at) VALUES($1,$2,$3,now()+interval '10 minutes',0,now())
      ON CONFLICT (email,purpose) DO UPDATE SET hash=$3,expires=now()+interval '10 minutes',tries=0,sent_at=now()`, [email, purpose, hashCode(email, code)]);
    await mail(email, email, 'Your StratisSoft verification code',
      `<p>Your verification code is <b style="font-size:20px">${code}</b></p><p>It is valid for 10 minutes. If you did not request it, ignore this email.</p>`);
    res.json({ ok: true });
  } catch (e) { fail(res, 500, e.message || 'Server error'); }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const email = norm(req.body.email), pw = String(req.body.password || '');
    if (!emailOk(email)) return fail(res, 400, 'Enter a valid email');
    if (pw.length < 8) return fail(res, 400, 'Password must be at least 8 characters');
    await checkCode(email, 'signup', req.body.code);
    const u = (await db.query('INSERT INTO ss_users(email,name,pass_hash) VALUES($1,$2,$3) RETURNING *', [email, email.split('@')[0], await bcrypt.hash(pw, 10)])).rows[0];
    welcome(u);
    res.json(tokenFor(u));
  } catch (e) { fail(res, 400, e.code === '23505' ? 'Account already exists' : e.message); }
});

app.post('/api/auth/login', async (req, res) => {
  const email = norm(req.body.email), key = email + '|' + req.ip;
  try {
    if (limited(key)) return fail(res, 429, 'Too many attempts. Try again in 15 minutes.');
    const u = (await db.query('SELECT * FROM ss_users WHERE email=$1', [email])).rows[0];
    if (u && !u.pass_hash) return fail(res, 400, 'This account uses Google. Use Google login, or Forgot password to set a password.');
    if (!u || !(await bcrypt.compare(String(req.body.password || ''), u.pass_hash))) { bump(key); return fail(res, 401, 'Wrong email or password'); }
    tries.delete(key);
    res.json(tokenFor(u));
  } catch (e) { fail(res, 500, 'Server error'); }
});

app.post('/api/auth/reset', async (req, res) => {
  try {
    const email = norm(req.body.email), pw = String(req.body.password || '');
    if (pw.length < 8) return fail(res, 400, 'Password must be at least 8 characters');
    const u = (await db.query('SELECT * FROM ss_users WHERE email=$1', [email])).rows[0];
    if (!u) return fail(res, 400, 'Wrong code');
    await checkCode(email, 'reset', req.body.code);
    await db.query('UPDATE ss_users SET pass_hash=$1 WHERE id=$2', [await bcrypt.hash(pw, 10), u.id]);
    res.json(tokenFor(u));
  } catch (e) { fail(res, 400, e.message); }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { tokens } = await gclient.getToken(req.body.code);
    const p = (await gclient.verifyIdToken({ idToken: tokens.id_token, audience: CID })).getPayload();
    if (!p.email_verified) return fail(res, 400, 'Google email not verified');
    const email = norm(p.email);
    let u = (await db.query('SELECT * FROM ss_users WHERE email=$1', [email])).rows[0];
    if (!u) { u = (await db.query('INSERT INTO ss_users(email,name) VALUES($1,$2) RETURNING *', [email, p.name || email.split('@')[0]])).rows[0]; welcome(u); }
    res.json(tokenFor(u));
  } catch (e) { fail(res, 401, 'Google login failed'); }
});

function auth(req, res, next) {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), JWT_SECRET); next(); }
  catch (e) { fail(res, 401, 'Please login again'); }
}

// Per-user storage: every user only ever reads/writes their own rows. Nothing is auto-deleted.
app.get('/api/store', auth, async (req, res) => {
  const { rows } = await db.query('SELECT k,v FROM ss_store WHERE user_id=$1', [req.user.sub]);
  const items = {}; rows.forEach(r => items[r.k] = r.v);
  res.json({ items });
});
app.put('/api/store', auth, async (req, res) => {
  const { k, v } = req.body;
  if (typeof k !== 'string' || k.length > 200) return fail(res, 400, 'Bad key');
  await db.query(`INSERT INTO ss_store(user_id,k,v,updated) VALUES($1,$2,$3,now())
    ON CONFLICT (user_id,k) DO UPDATE SET v=$3,updated=now()`, [req.user.sub, k, JSON.stringify(v)]);
  res.json({ ok: true });
});

// For external tools (Forge / Router / Fast-AI): their server calls this to skip their password page.
app.post('/api/verify-sso', (req, res) => {
  try { const p = jwt.verify(String(req.body.token || ''), JWT_SECRET); res.json({ ok: true, email: p.email, sub: p.sub, name: p.name }); }
  catch (e) { res.status(401).json({ ok: false }); }
});

app.use(express.static(path.join(__dirname, 'public')));

(async () => {
  await db.query(`CREATE TABLE IF NOT EXISTS ss_users(id SERIAL PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT,pass_hash TEXT,created TIMESTAMPTZ DEFAULT now());
    CREATE TABLE IF NOT EXISTS ss_codes(email TEXT,purpose TEXT,hash TEXT,expires TIMESTAMPTZ,tries INT DEFAULT 0,sent_at TIMESTAMPTZ,PRIMARY KEY(email,purpose));
    CREATE TABLE IF NOT EXISTS ss_store(user_id INT REFERENCES ss_users(id),k TEXT,v JSONB,updated TIMESTAMPTZ DEFAULT now(),PRIMARY KEY(user_id,k));`);
  app.listen(process.env.PORT || 3000, () => console.log('StratisSoft running'));
})().catch(e => { console.error(e); process.exit(1); });

// StratisSoft server: serves the app, keeps secrets on the server, verifies Google tokens, sends Brevo mail.
const express = require('express');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');

const CID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(CID);
const app = express();
app.use(express.json({ limit: '10kb' }));

const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function verify(token) {
  const t = await client.verifyIdToken({ idToken: token, audience: CID });
  const p = t.getPayload();
  if (!p.email_verified) throw new Error('email not verified');
  return p;
}

// Public config for the browser (Client ID is public by design)
app.get('/config.js', (req, res) => {
  res.type('application/javascript').send('window.APP_CONFIG=' + JSON.stringify({ clientId: CID || '' }) + ';');
});

// External tools (Forge / Router / Fast-AI) call this from THEIR server to skip their password page.
app.post('/api/verify-sso', async (req, res) => {
  try { const p = await verify(req.body.token); res.json({ ok: true, email: p.email, sub: p.sub, name: p.name }); }
  catch (e) { res.status(401).json({ ok: false }); }
});

// Welcome email through Brevo (sent once per user from the browser flag)
app.post('/api/welcome', async (req, res) => {
  try {
    const p = await verify(req.body.token);
    if (!process.env.BREVO_API_KEY || !process.env.MAIL_FROM) return res.json({ ok: false, reason: 'brevo not configured' });
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: process.env.MAIL_FROM, name: 'StratisSoft' },
        to: [{ email: p.email, name: p.name || p.email }],
        subject: 'Welcome to StratisSoft Suite',
        htmlContent: `<p>Hi ${esc(p.name)},</p><p>Your StratisSoft account is ready. Your history and dashboards are private to you.</p>`
      })
    });
    res.json({ ok: r.ok });
  } catch (e) { res.status(401).json({ ok: false }); }
});

app.use(express.static(path.join(__dirname, 'public')));
app.listen(process.env.PORT || 3000, () => console.log('StratisSoft running'));

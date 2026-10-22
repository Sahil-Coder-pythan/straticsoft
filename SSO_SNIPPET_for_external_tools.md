# External tools (Forge / Router / Fast-AI): password skip

Master opens them as `https://tool-url/#sso=<login token>`.

Page JS of the external tool:
```js
const t = new URLSearchParams(location.hash.slice(1)).get('sso');
if (t) fetch('/sso-login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({token:t})})
  .then(r => r.ok && location.replace(location.pathname));
```
Server of the external tool (Node example):
```js
app.post('/sso-login', async (req, res) => {
  const r = await fetch('https://STRATICSOFT-URL/api/verify-sso', {method:'POST',
    headers:{'Content-Type':'application/json'}, body: JSON.stringify({token:req.body.token})});
  if (!r.ok) return res.sendStatus(401);
  // mark session as logged in (skip password) here
  res.sendStatus(200);
});
```
Valid token => no password. Otherwise the normal password page stays.
Keep the tool password only in that tool's server Environment Variable.

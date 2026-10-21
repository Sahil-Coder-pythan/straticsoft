# StraticSoft Suite — ONE link for the world

## What changed (important)

- **No shared ADMIN password.** Every company **Registers** with own email + password.
- Login only on master (`/login`). Sub-tools open without a second login wall.
- **9 apps**: 3 core engines (Resolle, Forge, Router) + 6 power tools.
- Each company has isolated data (`company_id`). Company A never sees Company B.
- Optional `MONGODB_URI` so data survives Render redeploy.

## Paths

| Path | What |
|------|------|
| `/login` | Sign in / Register company |
| `/` | Suite hub (after login) |
| `/resolle/` | Support engine (Fast-Ai) |
| `/forge/` | AI Builder |
| `/router/` | AI Router |
| `/tools/json` | Data → JSON |
| `/tools/vault` | Vault CRM |
| `/tools/pos` | Dukan Hisab POS |
| `/tools/analytics` | Analytics |
| `/tools/connect` | Connect board |
| `/tools/billing` | Plan / pause |

## Render Environment (only these — no shared admin password)

```
SECRET_KEY=<long random>
MONGODB_URI=mongodb+srv://...
OPEN_NO_LOGIN=1
```

Optional (if sub-tools need them):

```
DATABASE_URL=
BREVO_API_KEY=
MAIL_FROM=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MASTER_ENCRYPTION_KEY=
ADMIN_SECRET=
FLASK_SECRET_KEY=
```

**Do NOT set ADMIN_EMAIL / ADMIN_PASSWORD** — companies self-register.

## Deploy

- **Root Directory**: empty
- **Build**: `pip install -r requirements.txt`
- **Start**: `python app.py`
- Plan: Free now → $7 when companies pay (no code change)

## Brand

Always **StraticSoft** (with **C**).

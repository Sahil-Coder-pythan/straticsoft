# StraticSoft Suite — Monorepo (ONE link)

All 3 tools embedded. Separate repos can be deleted. One deploy = one URL.

## Paths
- `/login` — **only place with login**
- `/` — Suite hub (photo design)
- `/resolle/` — Fast-Ai (support) full app
- `/forge/` — AI Builder full app
- `/router/` — AI Router full app (OPEN_NO_LOGIN=1)

## Environment (put ALL secrets here once)

```
SECRET_KEY=
ADMIN_EMAIL=
ADMIN_PASSWORD=
MONGODB_URI=

# Fast-Ai / Resolle (same names as before)
# (uses MONGODB_URI if set)

# Forge / AI Builder
DATABASE_URL=          # optional Neon postgres
BREVO_API_KEY=
MAIL_FROM=
FLASK_SECRET_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MASTER_ENCRYPTION_KEY=

# Router
ADMIN_SECRET=
OPEN_NO_LOGIN=1
DATABASE_URL=          # or separate ROUTER DB if needed
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Mongo / Neon data is shared via these env vars for all tools that use them.

## Brand
Always **StraticSoft** (with C).

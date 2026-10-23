# Stratic Global Market — improved pilot build

This is an improved **pilot/prototype**, not a production-certified global marketplace and not load-tested for 100,000 concurrent users.

## Included
- Responsive Flask-rendered storefront, search, category filter and sort
- Country market selection using the country list from `pycountry`
- Seller/customer registration and login with hashed passwords
- CSRF checks on POST forms; logout uses POST
- Seller product listing and stock controls
- Cart, cash-on-delivery order creation and order status actions
- Server-side country checks for catalogue, product details, cart and checkout
- PostgreSQL support through `DATABASE_URL`; SQLite fallback for local experiments
- Safer production defaults (no debug mode unless explicitly enabled, secure cookie option)

## Important limitations — do not skip
- Product image/video upload is **not implemented** in this pilot. Do not accept large media uploads until object storage, file validation, malware/content moderation, quotas, and CDN delivery are implemented.
- No online payment gateway, automated seller verification, admin moderation console, email/OTP, refund/dispute workflow, FX conversion, or legal country launch checks yet.
- Country selector supports country codes, but this does **not** mean the marketplace is legally ready to sell in every country. Initially enable only a reviewed market.
- Currency is a display label, not real-time exchange conversion. Some countries show `Local currency` until configured.
- No 100,000-user or 100,000-upload capacity is promised. This requires a production architecture, object storage/CDN, managed database sizing, queues, monitoring, security review and load testing. Free hosting will not guarantee this scale.
- `db.create_all()` is suitable only for the early pilot. Production schema changes need database migrations and backups.

## Local run
1. Install Python 3.11+.
2. `pip install -r requirements.txt`
3. Set `SECRET_KEY` to a long random secret.
4. `python app.py`
5. Open the local URL shown by Flask.

## Render deployment
Create a **Web Service** connected to this repository.
- Root Directory: the directory containing `app.py` (if repository root is this folder, leave blank)
- Build Command: `pip install -r requirements.txt`
- Start Command: `gunicorn --workers 2 --threads 4 --timeout 120 app:app`

Use a managed PostgreSQL database and copy its **Internal Database URL** into `DATABASE_URL` when the web service and database are in the same Render region. Do not paste credentials into code or public files.

### Render Environment variables
Required/recommended:
- `SECRET_KEY` = a cryptographically random long value (at least 32 random bytes; generate a fresh one, do not reuse the example)
- `DATABASE_URL` = the PostgreSQL Internal Database URL from your database service
- `COOKIE_SECURE` = `true` for HTTPS production
- `FLASK_DEBUG` = `false`

Do not set `FLASK_DEBUG=true` in production. Never share screenshots containing database URLs or secret values. Free database/hosting availability, expiry, storage, connection limits and pricing can change; verify current plan limits in Render before launch.

## Before public launch
1. Add and test database migrations and backups.
2. Implement private object storage + CDN for photos/videos (not local disk on ephemeral hosting).
3. Add upload limits, file type/content verification, moderation, abuse reporting and quotas.
4. Add rate limiting, email verification, seller checks, admin moderation and audit logs.
5. Add payment provider integration only after eligibility and legal checks.
6. Review privacy, consumer protection, taxes, product restrictions and marketplace obligations for the initial country.
7. Run automated tests, security review and realistic load tests. Scale based on measured results.

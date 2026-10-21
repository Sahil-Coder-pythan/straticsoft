#!/usr/bin/env python3
"""
StraticSoft Suite — ONE deploy URL for the world.
- Master: Register + Login only (every company creates OWN account — no shared admin password)
- After login: Suite hub with 9 tools
- /resolle /forge /router = your 3 full apps (embedded, no login wall)
- 6 more internal power tools (company-benefit)
- Multi-tenant isolation by company_id on all suite data
- MongoDB optional (MONGODB_URI) so history survives redeploy
"""
from __future__ import annotations
import os, sys, json, secrets, csv, io, re, hashlib, uuid, importlib.util
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

from flask import (
    Flask, request, jsonify, send_from_directory, session,
    redirect, Response, abort
)
from werkzeug.middleware.dispatcher import DispatcherMiddleware
from werkzeug.security import generate_password_hash, check_password_hash

ROOT = Path(__file__).resolve().parent
BRAND = "StraticSoft"

suite = Flask("straticsoft_suite", static_folder=str(ROOT / "public"), static_url_path="")
suite.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
suite.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)
suite.config["SESSION_COOKIE_HTTPONLY"] = True
suite.config["SESSION_COOKIE_SAMESITE"] = "Lax"
suite.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

MONGODB_URI = (os.environ.get("MONGODB_URI") or "").strip()
_mongo = None


def _col():
    global _mongo
    if not MONGODB_URI:
        return None
    try:
        if _mongo is None:
            from pymongo import MongoClient
            _mongo = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=8000)
            _mongo.admin.command("ping")
        return _mongo["straticsoft_suite"]["kv"]
    except Exception as e:
        print("mongo:", e)
        return None


def iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def kv_get(key, default=None):
    c = _col()
    if c is not None:
        try:
            d = c.find_one({"_id": key})
            if d and "v" in d:
                return d["v"]
        except Exception:
            pass
    path = DATA_DIR / (key.replace(":", "_") + ".json")
    if path.is_file():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return default


def kv_set(key, value):
    c = _col()
    if c is not None:
        try:
            c.update_one({"_id": key}, {"$set": {"v": value, "t": iso()}}, upsert=True)
        except Exception as e:
            print("kv mongo", e)
    path = DATA_DIR / (key.replace(":", "_") + ".json")
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, default=str), encoding="utf-8")
    tmp.replace(path)


def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return (s or "company")[:40]


def company_id_from(name: str, email: str) -> str:
    base = slugify(name) or slugify(email.split("@")[0])
    h = hashlib.sha256(f"{base}:{email.lower()}".encode()).hexdigest()[:8]
    return f"{base}-{h}"


# ── Users (every company registers own account) ──────────────
def load_users() -> dict:
    return kv_get("users", {}) or {}


def save_users(users: dict):
    kv_set("users", users)


def current_user():
    u = session.get("user")
    return u if isinstance(u, dict) and u.get("email") and u.get("company_id") else None


def login_required(fn):
    @wraps(fn)
    def wrap(*a, **k):
        if current_user():
            return fn(*a, **k)
        if request.path.startswith("/api/"):
            return jsonify({"error": "AUTH_REQUIRED", "login": "/login"}), 401
        return redirect("/login?next=" + (request.path or "/"))
    return wrap


def tenant_key(suffix: str) -> str:
    u = current_user()
    cid = (u or {}).get("company_id") or "anon"
    return f"t:{cid}:{suffix}"


# ── Auth API (Register + Login — NO shared admin password) ───
@suite.route("/api/auth/register", methods=["POST"])
def api_register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    company = (data.get("company") or data.get("company_name") or "").strip()
    name = (data.get("name") or "").strip()

    if not email or "@" not in email:
        return jsonify({"error": "Valid email required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password min 6 characters"}), 400
    if not company:
        return jsonify({"error": "Company name required"}), 400

    users = load_users()
    if email in users:
        return jsonify({"error": "Email already registered. Please Sign in."}), 409

    cid = company_id_from(company, email)
    users[email] = {
        "email": email,
        "name": name or email.split("@")[0],
        "company": company,
        "company_id": cid,
        "password_hash": generate_password_hash(password),
        "created_at": iso(),
        "role": "owner",
    }
    save_users(users)

    # init empty tenant buckets
    for bucket in ("history", "json_jobs", "vault_contacts", "pos_sales", "analytics", "connects", "billing"):
        kv_set(f"t:{cid}:{bucket}", [])

    session.permanent = True
    session["user"] = {
        "email": email,
        "name": users[email]["name"],
        "company": company,
        "company_id": cid,
        "role": "owner",
    }
    return jsonify({"ok": True, "user": session["user"]})


@suite.route("/api/auth/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    users = load_users()
    rec = users.get(email)
    if not rec or not check_password_hash(rec.get("password_hash") or "", password):
        return jsonify({"error": "Invalid email or password"}), 401
    session.permanent = True
    session["user"] = {
        "email": email,
        "name": rec.get("name") or email.split("@")[0],
        "company": rec.get("company") or "",
        "company_id": rec.get("company_id"),
        "role": rec.get("role") or "owner",
    }
    return jsonify({"ok": True, "user": session["user"]})


@suite.route("/api/auth/logout", methods=["POST", "GET"])
def api_logout():
    session.clear()
    if request.method == "GET":
        return redirect("/login")
    return jsonify({"ok": True})


@suite.route("/api/auth/me")
def api_me():
    u = current_user()
    if not u:
        return jsonify({"user": None}), 401
    return jsonify({"user": u})


# ── Google OAuth (company logs in with Google) ───────────────
GOOGLE_CLIENT_ID = (os.environ.get("GOOGLE_CLIENT_ID") or "").strip()
GOOGLE_CLIENT_SECRET = (os.environ.get("GOOGLE_CLIENT_SECRET") or "").strip()


def _public_base() -> str:
    # Prefer explicit APP_URL, else Render's host
    base = (os.environ.get("APP_URL") or "").strip().rstrip("/")
    if base:
        return base
    host = request.host_url.rstrip("/")
    # force https on render
    if "onrender.com" in host and host.startswith("http://"):
        host = "https://" + host[len("http://"):]
    return host


@suite.route("/api/auth/google/start")
def google_start():
    if not GOOGLE_CLIENT_ID:
        return jsonify({"error": "GOOGLE_CLIENT_ID not set in environment"}), 503
    redirect_uri = _public_base() + "/api/auth/google/callback"
    state = secrets.token_urlsafe(16)
    session["oauth_state"] = state
    from urllib.parse import urlencode
    q = urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account",
        "state": state,
    })
    return redirect("https://accounts.google.com/o/oauth2/v2/auth?" + q)


@suite.route("/api/auth/google/callback")
def google_callback():
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return "Google login not configured", 503
    err = request.args.get("error")
    if err:
        return redirect("/login?error=" + err)
    state = request.args.get("state")
    if not state or state != session.get("oauth_state"):
        return redirect("/login?error=state")
    code = request.args.get("code")
    if not code:
        return redirect("/login?error=code")
    redirect_uri = _public_base() + "/api/auth/google/callback"
    try:
        import requests as req
        tok = req.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            timeout=15,
        )
        tok.raise_for_status()
        access = tok.json().get("access_token")
        info = req.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access}"},
            timeout=15,
        )
        info.raise_for_status()
        profile = info.json()
    except Exception as e:
        print("google oauth", e)
        return redirect("/login?error=oauth")

    email = (profile.get("email") or "").strip().lower()
    if not email:
        return redirect("/login?error=email")
    name = (profile.get("name") or email.split("@")[0]).strip()
    # company default from email domain (user can edit later in vault/profile)
    domain = email.split("@")[-1] if "@" in email else "company"
    company = domain.split(".")[0].title() if domain not in ("gmail.com", "yahoo.com", "outlook.com", "hotmail.com") else name + " Co"

    users = load_users()
    if email not in users:
        cid = company_id_from(company, email)
        users[email] = {
            "email": email,
            "name": name,
            "company": company,
            "company_id": cid,
            "password_hash": generate_password_hash(secrets.token_hex(16)),  # random; Google users use Google
            "created_at": iso(),
            "role": "owner",
            "auth": "google",
        }
        save_users(users)
        for bucket in ("history", "json_jobs", "vault_contacts", "pos_sales", "analytics", "connects", "billing"):
            kv_set(f"t:{cid}:{bucket}", [])
    else:
        cid = users[email].get("company_id") or company_id_from(users[email].get("company") or company, email)
        users[email]["name"] = name
        users[email]["auth"] = "google"
        save_users(users)

    session.pop("oauth_state", None)
    session.permanent = True
    session["user"] = {
        "email": email,
        "name": users[email].get("name") or name,
        "company": users[email].get("company") or company,
        "company_id": users[email].get("company_id"),
        "role": users[email].get("role") or "owner",
    }
    return redirect("/")


# ── Pages ────────────────────────────────────────────────────
@suite.route("/login")
def page_login():
    if current_user():
        return redirect("/")
    return send_from_directory(suite.static_folder, "login.html")


@suite.route("/")
@login_required
def page_suite():
    return send_from_directory(suite.static_folder, "suite.html")


# ── 6 internal power tools (tenant-isolated) ─────────────────

# 1) Data → JSON converter
@suite.route("/api/tools/json", methods=["POST"])
@login_required
def tool_json():
    """Convert CSV / TSV / plain text table → clean JSON (enterprise data prep)."""
    text = ""
    if request.files.get("file"):
        f = request.files["file"]
        text = f.read().decode("utf-8", errors="replace")
    else:
        data = request.get_json(silent=True) or {}
        text = data.get("text") or data.get("csv") or ""
    if not text.strip():
        return jsonify({"error": "Paste CSV/TSV or upload file"}), 400

    try:
        dialect = csv.Sniffer().sniff(text[:2048], delimiters=",\t;|")
    except Exception:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    rows = []
    for i, row in enumerate(reader):
        if i >= 5000:
            break
        rows.append({(k or "").strip(): (v or "").strip() for k, v in row.items()})
    job = {"id": secrets.token_hex(6), "at": iso(), "rows": len(rows)}
    hist = kv_get(tenant_key("json_jobs"), []) or []
    hist.insert(0, job)
    kv_set(tenant_key("json_jobs"), hist[:50])
    return jsonify({"ok": True, "count": len(rows), "json": rows, "job": job})


@suite.route("/tools/json")
@login_required
def page_json():
    return send_from_directory(suite.static_folder, "tool_json.html")


# 2) Vault CRM — contacts + notes (per company)
@suite.route("/api/tools/vault", methods=["GET", "POST", "DELETE"])
@login_required
def tool_vault():
    key = tenant_key("vault_contacts")
    items = kv_get(key, []) or []
    if request.method == "GET":
        q = (request.args.get("q") or "").lower()
        if q:
            items = [x for x in items if q in json.dumps(x).lower()]
        return jsonify({"items": items})
    if request.method == "DELETE":
        data = request.get_json(silent=True) or {}
        iid = data.get("id")
        items = [x for x in items if x.get("id") != iid]
        kv_set(key, items)
        return jsonify({"ok": True})
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    rec = {
        "id": secrets.token_hex(6),
        "name": name,
        "email": (data.get("email") or "").strip(),
        "phone": (data.get("phone") or "").strip(),
        "company": (data.get("company") or "").strip(),
        "notes": (data.get("notes") or "").strip(),
        "tags": data.get("tags") or [],
        "created_at": iso(),
    }
    items.insert(0, rec)
    kv_set(key, items[:2000])
    return jsonify({"ok": True, "item": rec})


@suite.route("/tools/vault")
@login_required
def page_vault():
    return send_from_directory(suite.static_folder, "tool_vault.html")


# 3) Dukan Hisab POS — quick sale + daily total
@suite.route("/api/tools/pos", methods=["GET", "POST"])
@login_required
def tool_pos():
    key = tenant_key("pos_sales")
    sales = kv_get(key, []) or []
    if request.method == "GET":
        total = sum(float(s.get("amount") or 0) for s in sales)
        today = iso()[:10]
        today_total = sum(
            float(s.get("amount") or 0) for s in sales if (s.get("at") or "").startswith(today)
        )
        return jsonify({"sales": sales[:100], "total": total, "today": today_total})
    data = request.get_json(silent=True) or {}
    try:
        amount = float(data.get("amount") or 0)
    except Exception:
        return jsonify({"error": "invalid amount"}), 400
    if amount <= 0:
        return jsonify({"error": "amount must be > 0"}), 400
    rec = {
        "id": secrets.token_hex(5),
        "item": (data.get("item") or "Sale").strip(),
        "amount": amount,
        "note": (data.get("note") or "").strip(),
        "at": iso(),
    }
    sales.insert(0, rec)
    kv_set(key, sales[:2000])
    return jsonify({"ok": True, "sale": rec})


@suite.route("/tools/pos")
@login_required
def page_pos():
    return send_from_directory(suite.static_folder, "tool_pos.html")


# 4) Analytics snapshot (tenant activity)
@suite.route("/api/tools/analytics")
@login_required
def tool_analytics():
    cid = current_user()["company_id"]
    vault = kv_get(tenant_key("vault_contacts"), []) or []
    sales = kv_get(tenant_key("pos_sales"), []) or []
    jobs = kv_get(tenant_key("json_jobs"), []) or []
    connects = kv_get(tenant_key("connects"), []) or []
    return jsonify({
        "company_id": cid,
        "contacts": len(vault),
        "sales_count": len(sales),
        "sales_total": sum(float(s.get("amount") or 0) for s in sales),
        "json_jobs": len(jobs),
        "connects": len(connects),
        "generated_at": iso(),
    })


@suite.route("/tools/analytics")
@login_required
def page_analytics():
    return send_from_directory(suite.static_folder, "tool_analytics.html")


# 5) Connect board — store integration status (company fills keys; validated lightly)
@suite.route("/api/tools/connect", methods=["GET", "POST"])
@login_required
def tool_connect():
    key = tenant_key("connects")
    items = kv_get(key, []) or []
    if request.method == "GET":
        safe = []
        for x in items:
            y = dict(x)
            if y.get("secret"):
                y["secret"] = "••••" + str(y["secret"])[-4:]
            safe.append(y)
        return jsonify({"items": safe})
    data = request.get_json(silent=True) or {}
    system = (data.get("system") or "").strip().lower()
    endpoint = (data.get("endpoint") or data.get("url") or "").strip()
    key_val = (data.get("key") or data.get("api_key") or "").strip()
    if not system:
        return jsonify({"error": "system name required"}), 400
    # soft validation: reject empty key + obvious fake
    status = "CONNECTED" if (key_val and len(key_val) >= 8) or (endpoint.startswith("http")) else "PENDING"
    if key_val in ("test", "demo", "12345678"):
        status = "INVALID_KEY"
    rec = {
        "id": secrets.token_hex(5),
        "system": system,
        "endpoint": endpoint,
        "secret": key_val,
        "status": status,
        "at": iso(),
    }
    # upsert by system name
    items = [x for x in items if x.get("system") != system]
    items.insert(0, rec)
    kv_set(key, items)
    out = dict(rec)
    if out.get("secret"):
        out["secret"] = "••••" + out["secret"][-4:]
    return jsonify({"ok": True, "item": out})


@suite.route("/tools/connect")
@login_required
def page_connect():
    return send_from_directory(suite.static_folder, "tool_connect.html")


# 6) Billing / plan view (company sees their own plan — sticky product feel)
@suite.route("/api/tools/billing", methods=["GET", "POST"])
@login_required
def tool_billing():
    key = tenant_key("billing")
    plan = kv_get(key, None) or {
        "plan": "Trial",
        "price_usd": 0,
        "active": True,
        "started": iso(),
        "note": "30-day trial. Upgrade when ready.",
    }
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        action = (data.get("action") or "").lower()
        if action == "upgrade":
            plan = {
                "plan": "Enterprise",
                "price_usd": 1200,
                "active": True,
                "started": iso(),
                "note": "Enterprise active. Automation on.",
            }
        elif action == "downgrade":
            plan = {
                "plan": "Paused",
                "price_usd": 0,
                "active": False,
                "started": iso(),
                "note": "Paused — staff load returns to full manual.",
            }
        kv_set(key, plan)
    return jsonify({"billing": plan, "company": current_user().get("company")})


@suite.route("/tools/billing")
@login_required
def page_billing():
    return send_from_directory(suite.static_folder, "tool_billing.html")


# ── Health ───────────────────────────────────────────────────
@suite.route("/health")
def health():
    return jsonify({
        "ok": True,
        "brand": BRAND,
        "mongo": bool(_col()),
        "time": iso(),
    })


# ── Load sub-apps with path prefixes ─────────────────────────
def load_flask_from(path: Path, name: str, prefix: str):
    """Load tools/*/app.py as Flask app and wrap with SCRIPT_NAME prefix."""
    app_file = path / "app.py"
    if not app_file.is_file():
        print("missing", app_file)
        return None
    # ensure sub-tool sees OPEN_NO_LOGIN
    os.environ.setdefault("OPEN_NO_LOGIN", "1")
    spec = importlib.util.spec_from_file_location(f"tool_{name}", str(app_file))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[f"tool_{name}"] = mod
    # chdir-safe: set env APP_PREFIX so templates/fetch can use it
    os.environ["APP_PREFIX"] = prefix.rstrip("/")
    try:
        old = os.getcwd()
        os.chdir(str(path))
        spec.loader.exec_module(mod)
        os.chdir(old)
    except Exception as e:
        os.chdir(old) if "old" in dir() else None
        print(f"load {name} failed:", e)
        return None
    # find Flask app object
    app_obj = None
    for attr in ("app", "application", "flask_app"):
        if hasattr(mod, attr):
            cand = getattr(mod, attr)
            if hasattr(cand, "wsgi_app") or hasattr(cand, "route"):
                app_obj = cand
                break
    if app_obj is None:
        # FastAPI?
        for attr in ("app", "api"):
            if hasattr(mod, attr):
                cand = getattr(mod, attr)
                try:
                    from a2wsgi import ASGIMiddleware
                    if hasattr(cand, "router") or cand.__class__.__name__ in ("FastAPI", "Starlette"):
                        return ASGIMiddleware(cand)
                except Exception as e:
                    print("a2wsgi", e)
        print("no app in", name)
        return None
    return app_obj


class PrefixMiddleware:
    """Strip mount path and set SCRIPT_NAME so url_for / relative paths work."""
    def __init__(self, app, prefix: str):
        self.app = app
        self.prefix = prefix.rstrip("/") or ""

    def __call__(self, environ, start_response):
        path = environ.get("PATH_INFO") or ""
        if self.prefix and path.startswith(self.prefix):
            environ["SCRIPT_NAME"] = (environ.get("SCRIPT_NAME") or "") + self.prefix
            environ["PATH_INFO"] = path[len(self.prefix):] or "/"
        return self.app(environ, start_response)


def build_application():
    mounts = {}
    for name, prefix in (("resolle", "/resolle"), ("forge", "/forge"), ("router", "/router")):
        tool_path = ROOT / "tools" / name
        loaded = load_flask_from(tool_path, name, prefix)
        if loaded is not None:
            mounts[prefix] = PrefixMiddleware(loaded, prefix)
            print(f"mounted {prefix}")
        else:
            print(f"SKIP mount {prefix}")

    # fallback 404 for unknown mounts
    def not_found(environ, start_response):
        start_response("404 NOT FOUND", [("Content-Type", "text/plain")])
        return [b"Not Found"]

    return DispatcherMiddleware(suite, mounts)


application = build_application()

if __name__ == "__main__":
    port = int(os.environ.get("PORT") or 10000)
    # run suite directly for local; on Render use application via gunicorn or python
    # DispatcherMiddleware needs to be the WSGI app
    from werkzeug.serving import run_simple
    print("=" * 50)
    print(f"  {BRAND} Suite")
    print(f"  /login  /  /resolle/  /forge/  /router/")
    print(f"  /tools/json /tools/vault /tools/pos ...")
    print(f"  port {port}")
    print("=" * 50)
    run_simple("0.0.0.0", port, application, use_reloader=False, use_debugger=False)

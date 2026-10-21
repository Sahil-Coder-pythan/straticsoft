#!/usr/bin/env python3
"""
StraticSoft Suite — ONE link, ALL tools embedded (no external tool URLs).
Login only on this master hub. Sub-tools open at /resolle /forge /router without login wall.
"""
from __future__ import annotations
import os, sys, json, secrets, csv, io, re, importlib.util
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

from flask import Flask, request, jsonify, send_from_directory, session, redirect
from werkzeug.middleware.dispatcher import DispatcherMiddleware
from werkzeug.security import generate_password_hash, check_password_hash

ROOT = Path(__file__).resolve().parent
BRAND = "StraticSoft"

ADMIN_EMAIL = (os.environ.get("ADMIN_EMAIL") or "admin@straticsoft.com").strip().lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD") or "StraticSoft@2026"
ADMIN_HASH = generate_password_hash(ADMIN_PASSWORD)

suite = Flask("straticsoft_suite", static_folder=str(ROOT / "public"), static_url_path="")
suite.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
suite.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)
suite.config["SESSION_COOKIE_HTTPONLY"] = True
suite.config["SESSION_COOKIE_SAMESITE"] = "Lax"

DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

# optional mongo
MONGODB_URI = (os.environ.get("MONGODB_URI") or "").strip()
_mongo = None

def _col():
    global _mongo
    if not MONGODB_URI:
        return None
    try:
        if _mongo is None:
            from pymongo import MongoClient
            _mongo = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=6000)
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
    tmp.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)

def current_user():
    u = session.get("user")
    return u if isinstance(u, dict) and u.get("email") else None

def login_required(fn):
    @wraps(fn)
    def wrap(*a, **k):
        if current_user():
            return fn(*a, **k)
        if request.path.startswith("/api/"):
            return jsonify({"error": "AUTH_REQUIRED", "login": "/login"}), 401
        return redirect("/login?next=" + (request.path or "/"))
    return wrap

# ── Suite pages ──────────────────────────────────────────────
@suite.route("/login")
def page_login():
    if current_user():
        return redirect("/")
    return send_from_directory(suite.static_folder, "login.html")

@suite.route("/")
@login_required
def page_suite():
    return send_from_directory(suite.static_folder, "suite.html")

@suite.route("/app/<app_id>")
@login_required
def page_app(app_id):
    # Internal tools stay in suite UI; external embeds use path mounts
    if app_id in ("resolle", "forge", "router"):
        return redirect("/" + app_id + "/")
    return send_from_directory(suite.static_folder, "suite.html")

@suite.route("/api/auth/login", methods=["POST"])
def auth_login():
    d = request.get_json(silent=True) or {}
    email = (d.get("email") or "").strip().lower()
    password = d.get("password") or ""
    if email == ADMIN_EMAIL and check_password_hash(ADMIN_HASH, password):
        session.permanent = True
        session["user"] = {"email": email, "name": BRAND + " Admin", "role": "owner"}
        return jsonify({"ok": True, "user": session["user"]})
    users = kv_get("users", {}) or {}
    u = users.get(email)
    if u and check_password_hash(u.get("password_hash", ""), password):
        session.permanent = True
        session["user"] = {"email": email, "name": u.get("name") or email.split("@")[0], "role": "staff"}
        return jsonify({"ok": True, "user": session["user"]})
    return jsonify({"error": "Invalid email or password"}), 401

@suite.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    session.clear()
    return jsonify({"ok": True})

@suite.route("/api/auth/me")
def auth_me():
    u = current_user()
    if not u:
        return jsonify({"user": None}), 401
    return jsonify({"user": u, "brand": BRAND})

@suite.route("/api/suite/apps")
@login_required
def suite_apps():
    apps = [
        {"id": "resolle", "name": "Resolle", "tag": "Support", "icon": "fa-comments", "color": "#3b82f6",
         "type": "embedded", "url": "/resolle/", "ready": True, "desc": "Fast-Ai support · refunds · cases"},
        {"id": "forge", "name": "Forge", "tag": "AI Builder", "icon": "fa-wand-magic-sparkles", "color": "#a855f7",
         "type": "embedded", "url": "/forge/", "ready": True, "desc": "Build publish AI links"},
        {"id": "router", "name": "Router", "tag": "Call", "icon": "fa-phone", "color": "#22c55e",
         "type": "embedded", "url": "/router/", "ready": True, "desc": "AI call routing"},
        {"id": "dukan", "name": "Dukan Hisab", "tag": "POS", "icon": "fa-shop", "color": "#f97316",
         "type": "internal", "url": "/app/dukan", "ready": True, "desc": "Sales tally"},
        {"id": "datajson", "name": "Data JSON", "tag": "Converter", "icon": "fa-file-code", "color": "#06b6d4",
         "type": "internal", "url": "/app/datajson", "ready": True, "desc": "CSV → enterprise JSON"},
        {"id": "analytics", "name": "Analytics", "tag": "Analytics", "icon": "fa-chart-column", "color": "#6366f1",
         "type": "internal", "url": "/app/analytics", "ready": True, "desc": "Suite metrics"},
        {"id": "vault", "name": "Vault", "tag": "CRM", "icon": "fa-shield-halved", "color": "#14b8a6",
         "type": "internal", "url": "/app/vault", "ready": True, "desc": "Contacts & leads"},
        {"id": "connect", "name": "Connect", "tag": "Omnichannel", "icon": "fa-network-wired", "color": "#8b5cf6",
         "type": "internal", "url": "/app/connect", "ready": True, "desc": "Webhooks"},
        {"id": "billing", "name": "Billing", "tag": "Billing", "icon": "fa-file-invoice-dollar", "color": "#10b981",
         "type": "internal", "url": "/app/billing", "ready": True, "desc": "Plans & invoices"},
    ]
    return jsonify({"brand": BRAND, "apps": apps, "mode": "embedded-monorepo"})

# ── 6 built-in tools (same as suite v1) ──────────────────────
@suite.route("/api/tools/datajson", methods=["POST"])
@login_required
def tool_datajson():
    d = request.get_json(silent=True) or {}
    raw = d.get("text") or ""
    if not raw.strip():
        return jsonify({"error": "Paste CSV or text"}), 400
    try:
        if "," in (raw.split("\n")[0] or ""):
            rows = [dict(r) for r in csv.DictReader(io.StringIO(raw.strip()))]
        elif "\t" in raw:
            rows = [dict(r) for r in csv.DictReader(io.StringIO(raw.strip()), delimiter="\t")]
        else:
            rows = []
            for line in raw.strip().splitlines():
                line = line.strip()
                if not line:
                    continue
                if ":" in line and not line.startswith("{"):
                    k, _, v = line.partition(":")
                    rows.append({k.strip(): v.strip()})
                else:
                    try:
                        rows.append(json.loads(line))
                    except Exception:
                        rows.append({"value": line})
        def coerce(v):
            s = str(v).strip() if v is not None else ""
            if re.fullmatch(r"-?\d+", s): return int(s)
            if re.fullmatch(r"-?\d+\.\d+", s): return float(s)
            if s.lower() in ("true", "false"): return s.lower() == "true"
            return s
        clean = [{k: coerce(v) for k, v in r.items()} for r in rows]
        payload = {"meta": {"source": BRAND + " Data JSON", "generated_at": iso(), "record_count": len(clean),
                            "schema": sorted({k for r in clean for k in r})}, "data": clean}
        return jsonify({"ok": True, "json": payload, "pretty": json.dumps(payload, ensure_ascii=False, indent=2)})
    except Exception as e:
        return jsonify({"error": str(e)[:200]}), 400

@suite.route("/api/tools/vault", methods=["GET", "POST", "DELETE"])
@login_required
def tool_vault():
    contacts = kv_get("vault_contacts", []) or []
    if request.method == "GET":
        return jsonify({"contacts": contacts, "count": len(contacts)})
    if request.method == "DELETE":
        cid = (request.get_json(silent=True) or {}).get("id")
        contacts = [c for c in contacts if c.get("id") != cid]
        kv_set("vault_contacts", contacts)
        return jsonify({"ok": True})
    d = request.get_json(silent=True) or {}
    name = (d.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    row = {"id": "C-" + secrets.token_hex(3).upper(), "name": name[:80], "email": (d.get("email") or "")[:120],
           "phone": (d.get("phone") or "")[:40], "company": (d.get("company") or "")[:80], "created": iso()}
    contacts.insert(0, row)
    kv_set("vault_contacts", contacts[:2000])
    return jsonify({"ok": True, "contact": row})

@suite.route("/api/tools/dukan", methods=["GET", "POST"])
@login_required
def tool_dukan():
    sales = kv_get("dukan_sales", []) or []
    if request.method == "GET":
        total = sum(float(s.get("amount") or 0) for s in sales)
        return jsonify({"sales": sales[:200], "total": round(total, 2), "count": len(sales)})
    d = request.get_json(silent=True) or {}
    row = {"id": "S-" + secrets.token_hex(3).upper(), "item": (d.get("item") or "Item")[:80],
           "amount": float(d.get("amount") or 0), "at": iso()}
    sales.insert(0, row)
    kv_set("dukan_sales", sales[:5000])
    return jsonify({"ok": True, "sale": row, "total": round(sum(float(s.get("amount") or 0) for s in sales), 2)})

@suite.route("/api/tools/analytics")
@login_required
def tool_analytics():
    return jsonify({"brand": BRAND, "generated_at": iso(), "metrics": {
        "pos_sales_count": len(kv_get("dukan_sales", []) or []),
        "pos_sales_total": round(sum(float(s.get("amount") or 0) for s in (kv_get("dukan_sales", []) or [])), 2),
        "crm_contacts": len(kv_get("vault_contacts", []) or []),
        "webhooks": len(kv_get("connect_hooks", []) or []),
        "invoices": len(kv_get("billing_invoices", []) or []),
        "embedded_tools": 3,
    }})

@suite.route("/api/tools/connect", methods=["GET", "POST", "DELETE"])
@login_required
def tool_connect():
    hooks = kv_get("connect_hooks", []) or []
    if request.method == "GET":
        return jsonify({"hooks": hooks})
    if request.method == "DELETE":
        hid = (request.get_json(silent=True) or {}).get("id")
        kv_set("connect_hooks", [h for h in hooks if h.get("id") != hid])
        return jsonify({"ok": True})
    d = request.get_json(silent=True) or {}
    url = (d.get("url") or "").strip()
    if not url.startswith("https://"):
        return jsonify({"error": "HTTPS URL required"}), 400
    row = {"id": "H-" + secrets.token_hex(3).upper(), "url": url, "channel": (d.get("channel") or "webhook")[:40], "created": iso()}
    hooks.insert(0, row)
    kv_set("connect_hooks", hooks[:100])
    return jsonify({"ok": True, "hook": row})

@suite.route("/api/tools/billing", methods=["GET", "POST"])
@login_required
def tool_billing():
    inv = kv_get("billing_invoices", []) or []
    plan = kv_get("billing_plan", {"name": "Pilot", "price_usd": 0, "status": "active"})
    if request.method == "GET":
        return jsonify({"plan": plan, "invoices": inv[:100]})
    d = request.get_json(silent=True) or {}
    if d.get("action") == "set_plan":
        plan = {"name": (d.get("name") or "Pilot")[:40], "price_usd": float(d.get("price_usd") or 0), "status": "active", "updated": iso()}
        kv_set("billing_plan", plan)
        return jsonify({"ok": True, "plan": plan})
    row = {"id": "INV-" + secrets.token_hex(3).upper(), "label": (d.get("label") or "Invoice")[:80],
           "amount_usd": float(d.get("amount_usd") or 0), "status": "draft", "created": iso()}
    inv.insert(0, row)
    kv_set("billing_invoices", inv[:500])
    return jsonify({"ok": True, "invoice": row})

@suite.route("/api/health")
def health():
    return jsonify({"ok": True, "brand": BRAND, "version": "2.0.0-MONOREPO", "tools": ["resolle", "forge", "router"]})

# ── Load embedded tool apps ──────────────────────────────────
def _load_flask_app(name: str, app_file: Path, chdir: Path):
    """Import Flask app object from tools/*/app.py without colliding module names."""
    prev = os.getcwd()
    try:
        os.chdir(str(chdir))
        if str(chdir) not in sys.path:
            sys.path.insert(0, str(chdir))
        spec = importlib.util.spec_from_file_location(f"tool_{name}", str(app_file))
        mod = importlib.util.module_from_spec(spec)
        sys.modules[f"tool_{name}"] = mod
        spec.loader.exec_module(mod)
        return mod.app
    finally:
        os.chdir(prev)

class PrefixMiddleware:
    """Strip URL prefix so sub-app sees paths at root."""
    def __init__(self, app, prefix: str):
        self.app = app
        self.prefix = prefix.rstrip("/") or "/"
    def __call__(self, environ, start_response):
        script = environ.get("SCRIPT_NAME", "")
        path = environ.get("PATH_INFO", "")
        full = script + path
        # Dispatcher already strips mount path into PATH_INFO starting with /
        environ["HTTP_X_SCRIPT_NAME"] = self.prefix
        environ["SCRIPT_NAME"] = self.prefix
        return self.app(environ, start_response)

def build_application():
    mounts = {}
    # Resolle (Flask / Fast-Ai)
    try:
        resolle = _load_flask_app("resolle", ROOT / "tools/resolle/app.py", ROOT / "tools/resolle")
        mounts["/resolle"] = PrefixMiddleware(resolle, "/resolle")
        print("mounted /resolle")
    except Exception as e:
        print("resolle mount failed:", e)
    # Forge (Flask / ai-builder)
    try:
        forge = _load_flask_app("forge", ROOT / "tools/forge/app.py", ROOT / "tools/forge")
        mounts["/forge"] = PrefixMiddleware(forge, "/forge")
        print("mounted /forge")
    except Exception as e:
        print("forge mount failed:", e)
    # Router (FastAPI) via a2wsgi
    try:
        os.environ.setdefault("OPEN_NO_LOGIN", "1")
        rdir = ROOT / "tools/router"
        prev = os.getcwd()
        os.chdir(str(rdir))
        if str(rdir) not in sys.path:
            sys.path.insert(0, str(rdir))
        spec = importlib.util.spec_from_file_location("tool_router", str(rdir / "app.py"))
        mod = importlib.util.module_from_spec(spec)
        sys.modules["tool_router"] = mod
        spec.loader.exec_module(mod)
        os.chdir(prev)
        try:
            from a2wsgi import ASGIMiddleware
            mounts["/router"] = PrefixMiddleware(ASGIMiddleware(mod.app), "/router")
            print("mounted /router (ASGI)")
        except Exception as e:
            print("a2wsgi missing or fail:", e)
    except Exception as e:
        print("router mount failed:", e)

    return DispatcherMiddleware(suite, mounts)

application = build_application()

if __name__ == "__main__":
    from werkzeug.serving import run_simple
    port = int(os.environ.get("PORT", 3000))
    print(f"\n{BRAND} Suite MONOREPO · port {port}")
    print("  /login  /  /resolle/  /forge/  /router/\n")
    run_simple("0.0.0.0", port, application, use_reloader=False, threaded=True)

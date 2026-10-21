#!/usr/bin/env python3
"""
StraticSoft Suite — ONE URL.
Master: Register + Login + Google (suite hub only).
Sub-tools: EXACT code from your 3 repos under /resolle /forge /router
  - Path-prefix middleware rewrites absolute /asset paths so original design loads.
  - OPEN_NO_LOGIN=1 so tools open without a second login wall.
"""
from __future__ import annotations
import os, sys, json, secrets, re, hashlib, importlib.util
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

from flask import (
    Flask, request, jsonify, send_from_directory, session, redirect
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

DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

MONGODB_URI = (os.environ.get("MONGODB_URI") or "").strip()
_mongo = None
_mongo_failed = False


def _col():
    global _mongo, _mongo_failed
    if _mongo_failed or not MONGODB_URI:
        return None
    try:
        if _mongo is None:
            from pymongo import MongoClient
            _mongo = MongoClient(
                MONGODB_URI,
                serverSelectionTimeoutMS=2500,
                connectTimeoutMS=2500,
                socketTimeoutMS=5000,
            )
            _mongo.admin.command("ping")
        return _mongo["straticsoft_suite"]["kv"]
    except Exception as e:
        print("mongo disabled:", type(e).__name__, e)
        _mongo_failed = True
        _mongo = None
        return None


def iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def kv_get(key, default=None):
    path = DATA_DIR / (key.replace(":", "_") + ".json")
    if path.is_file():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
    c = _col()
    if c is not None:
        try:
            d = c.find_one({"_id": key})
            if d and "v" in d:
                return d["v"]
        except Exception:
            pass
    return default


def kv_set(key, value):
    path = DATA_DIR / (key.replace(":", "_") + ".json")
    DATA_DIR.mkdir(exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, default=str), encoding="utf-8")
    tmp.replace(path)
    c = _col()
    if c is not None:
        try:
            c.update_one({"_id": key}, {"$set": {"v": value, "t": iso()}}, upsert=True)
        except Exception as e:
            print("kv_set mongo", e)


def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return (s or "company")[:40]


def company_id_from(name: str, email: str) -> str:
    base = slugify(name) or slugify(email.split("@")[0])
    h = hashlib.sha256(f"{base}:{email.lower()}".encode()).hexdigest()[:8]
    return f"{base}-{h}"


def load_users() -> dict:
    u = kv_get("users", {}) or {}
    return u if isinstance(u, dict) else {}


def save_users(users: dict):
    kv_set("users", users)


def current_user():
    return session.get("user")


def login_required(fn):
    @wraps(fn)
    def w(*a, **k):
        if not current_user():
            if request.path.startswith("/api/"):
                return jsonify({"error": "login_required"}), 401
            return redirect("/login?next=" + request.path)
        return fn(*a, **k)
    return w


# ── Auth ─────────────────────────────────────────────────────
@suite.route("/api/auth/register", methods=["POST"])
def api_register():
    try:
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        company = (data.get("company") or "").strip()
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
        session.permanent = True
        session["user"] = {
            "email": email,
            "name": users[email]["name"],
            "company": company,
            "company_id": cid,
            "role": "owner",
        }
        return jsonify({"ok": True, "user": session["user"]})
    except Exception as e:
        print("register", e)
        return jsonify({"error": str(e)}), 500


@suite.route("/api/auth/login", methods=["POST"])
def api_login():
    try:
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        users = load_users()
        rec = users.get(email)
        if not rec or not check_password_hash(rec.get("password_hash") or "", password):
            return jsonify({"error": "Invalid email or password. Register company first."}), 401
        session.permanent = True
        session["user"] = {
            "email": email,
            "name": rec.get("name") or email.split("@")[0],
            "company": rec.get("company") or "",
            "company_id": rec.get("company_id"),
            "role": rec.get("role") or "owner",
        }
        return jsonify({"ok": True, "user": session["user"]})
    except Exception as e:
        print("login", e)
        return jsonify({"error": str(e)}), 500


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


GOOGLE_CLIENT_ID = (os.environ.get("GOOGLE_CLIENT_ID") or "").strip()
GOOGLE_CLIENT_SECRET = (os.environ.get("GOOGLE_CLIENT_SECRET") or "").strip()


def _public_base() -> str:
    base = (os.environ.get("APP_URL") or "").strip().rstrip("/")
    if base:
        return base
    host = request.host_url.rstrip("/")
    if "onrender.com" in host and host.startswith("http://"):
        host = "https://" + host[len("http://"):]
    return host


@suite.route("/api/auth/google/start")
def google_start():
    if not GOOGLE_CLIENT_ID:
        return jsonify({"error": "GOOGLE_CLIENT_ID not set"}), 503
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
    if request.args.get("error"):
        return redirect("/login?error=" + request.args.get("error"))
    if request.args.get("state") != session.get("oauth_state"):
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
    domain = email.split("@")[-1] if "@" in email else "company"
    company = (
        domain.split(".")[0].title()
        if domain not in ("gmail.com", "yahoo.com", "outlook.com", "hotmail.com")
        else name + " Co"
    )
    users = load_users()
    if email not in users:
        cid = company_id_from(company, email)
        users[email] = {
            "email": email,
            "name": name,
            "company": company,
            "company_id": cid,
            "password_hash": generate_password_hash(secrets.token_hex(16)),
            "created_at": iso(),
            "role": "owner",
            "auth": "google",
        }
        save_users(users)
    else:
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


@suite.route("/login")
def page_login():
    if current_user():
        return redirect("/")
    return send_from_directory(suite.static_folder, "login.html")


@suite.route("/")
@login_required
def page_suite():
    return send_from_directory(suite.static_folder, "suite.html")


@suite.route("/health")
def health():
    return jsonify({"ok": True, "brand": BRAND, "time": iso()})


# ── Prefix middleware: keep ORIGINAL tool design, fix /asset paths ──
class PrefixMiddleware:
    """Mount sub-app under prefix. Rewrite absolute root paths in HTML/JS so
    original tool CSS/JS/API still work under /resolle /forge /router."""

    def __init__(self, app, prefix: str):
        self.app = app
        self.prefix = prefix.rstrip("/") or ""

    def __call__(self, environ, start_response):
        path = environ.get("PATH_INFO") or ""
        if self.prefix and path.startswith(self.prefix):
            environ["SCRIPT_NAME"] = (environ.get("SCRIPT_NAME") or "") + self.prefix
            environ["PATH_INFO"] = path[len(self.prefix):] or "/"

        status_headers = []

        def custom_start(status, headers, exc_info=None):
            status_headers.append((status, headers))
            return lambda s: None  # capture; we write later

        body_iter = self.app(environ, custom_start)
        body = b"".join(body_iter)
        if hasattr(body_iter, "close"):
            try:
                body_iter.close()
            except Exception:
                pass

        status, headers = status_headers[0] if status_headers else ("200 OK", [])
        headers = list(headers)
        ctype = ""
        for k, v in headers:
            if k.lower() == "content-type":
                ctype = v.lower()
                break

        prefix = self.prefix
        if prefix and body and (
            "text/html" in ctype
            or "javascript" in ctype
            or "application/json" not in ctype and path.endswith((".js", ".html", ".css"))
        ):
            try:
                text = body.decode("utf-8")
            except Exception:
                text = None
            if text is not None:
                # Rewrite absolute same-origin paths: href="/x" src="/x" url(/x) fetch('/x'
                def repl_attr(m):
                    attr, quote, url = m.group(1), m.group(2), m.group(3)
                    if url.startswith("//") or url.startswith("http") or url.startswith("data:"):
                        return m.group(0)
                    if url.startswith(prefix + "/") or url == prefix:
                        return m.group(0)
                    if url.startswith("/"):
                        return f"{attr}={quote}{prefix}{url}{quote}"
                    return m.group(0)

                text = re.sub(
                    r'''\b(href|src|action)=(["'])(/[^"']*)\2''',
                    repl_attr,
                    text,
                    flags=re.I,
                )
                # fetch('/api...') and fetch("/api...")
                text = re.sub(
                    r'''fetch\(\s*(['"])(/(?:[^'"]*))\1''',
                    lambda m: f"fetch({m.group(1)}{prefix}{m.group(2)}{m.group(1)}"
                    if not m.group(2).startswith(prefix)
                    else m.group(0),
                    text,
                )
                # Inject base + fetch patch for HTML
                if "text/html" in ctype and "<head" in text.lower():
                    inject = (
                        f'<base href="{prefix}/">'
                        f"<script>(function(){{var P='{prefix}';"
                        f"var o=window.fetch;window.fetch=function(u,i){{"
                        f"if(typeof u==='string'&&u.charAt(0)==='/'&&u.indexOf(P)!==0)u=P+u;"
                        f"return o(u,i);}};}})();</script>"
                    )
                    text = re.sub(
                        r"(<head[^>]*>)",
                        r"\1" + inject,
                        text,
                        count=1,
                        flags=re.I,
                    )
                body = text.encode("utf-8")
                # fix content-length
                headers = [(k, v) for k, v in headers if k.lower() != "content-length"]
                headers.append(("Content-Length", str(len(body))))

        start_response(status, headers)
        return [body]


def load_tool(path: Path, name: str, prefix: str):
    app_file = path / "app.py"
    if not app_file.is_file():
        print("missing", app_file)
        return None
    os.environ.setdefault("OPEN_NO_LOGIN", "1")
    os.environ["APP_PREFIX"] = prefix.rstrip("/")
    spec = importlib.util.spec_from_file_location(f"tool_{name}", str(app_file))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[f"tool_{name}"] = mod
    old = os.getcwd()
    try:
        os.chdir(str(path))
        # ensure tool can import local modules
        sys.path.insert(0, str(path))
        spec.loader.exec_module(mod)
    except Exception as e:
        print(f"load {name} failed:", e)
        return None
    finally:
        os.chdir(old)

    # Flask?
    if hasattr(mod, "app"):
        candidate = mod.app
        # FastAPI has .routes; Flask has .wsgi_app
        try:
            from fastapi import FastAPI
            if isinstance(candidate, FastAPI):
                try:
                    from a2wsgi import ASGIMiddleware
                    return ASGIMiddleware(candidate)
                except Exception as e:
                    print("a2wsgi", e)
                    return None
        except ImportError:
            pass
        return candidate
    return None


def build_application():
    mounts = {}
    for name, prefix in (("resolle", "/resolle"), ("forge", "/forge"), ("router", "/router")):
        tool_path = ROOT / "tools" / name
        loaded = load_tool(tool_path, name, prefix)
        if loaded is not None:
            mounts[prefix] = PrefixMiddleware(loaded, prefix)
            print(f"mounted {prefix}")
        else:
            print(f"SKIP {prefix}")
    return DispatcherMiddleware(suite, mounts)


application = build_application()

if __name__ == "__main__":
    port = int(os.environ.get("PORT") or 10000)
    from werkzeug.serving import run_simple
    print("=" * 50)
    print(f"  {BRAND} — exact tools under /resolle /forge /router")
    print(f"  port {port}")
    print("=" * 50)
    run_simple("0.0.0.0", port, application, use_reloader=False, use_debugger=False, threaded=True)

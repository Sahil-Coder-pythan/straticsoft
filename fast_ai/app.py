#!/usr/bin/env python3
"""
Aapka AI – Invisible Enterprise Brain SHIP v10 NO-LOGIN FINAL · StraticSoft
Company-ready: multi-role, BYO credentials, lockout, ROI, 1-click autopilot.
"""

from flask import Flask, request, jsonify, send_from_directory, g, session, redirect, url_for
from datetime import datetime, timedelta, timezone
from functools import wraps
import time, os, hashlib, secrets, json, threading

app = Flask(__name__, static_folder="public", static_url_path="")
app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
# Sessions last 30 days
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
# Secure cookie when behind HTTPS (Render)
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("SESSION_COOKIE_SECURE", "1") != "0"

GOOGLE_CLIENT_ID = (os.environ.get("GOOGLE_CLIENT_ID") or "").strip()
# Optional: comma-separated emails that may use /owner (empty = any logged-in user)
OWNER_EMAILS = {e.strip().lower() for e in (os.environ.get("OWNER_EMAILS") or "").split(",") if e.strip()}


# Prefer Render Persistent Disk when mounted (set env AAPKA_DATA=/var/data).
# Without a disk, free Render redeploys wipe local files — that is why old links vanished.
_default_data = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
_persist_candidates = [
    os.environ.get("AAPKA_DATA"),
    "/var/data",           # common Render persistent disk mount
    "/data",
    _default_data,
]
DATA_DIR = next((d for d in _persist_candidates if d and (os.path.isdir(d) or d == _default_data or os.environ.get("AAPKA_DATA") == d)), _default_data)
try:
    os.makedirs(DATA_DIR, exist_ok=True)
except Exception:
    DATA_DIR = _default_data
    os.makedirs(DATA_DIR, exist_ok=True)
print("Aapka AI DATA_DIR =", DATA_DIR)

# ─── Optional Postgres (DATABASE_URL) — survives web redeploy; free PG lasts 30 days ───
DATABASE_URL = (os.environ.get("DATABASE_URL") or "").strip()
MONGODB_URI = (os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI") or "").strip()
_pg_conn = None
_pg_lock = threading.RLock()
_mongo_client = None
_mongo_db = None

def _pg_enabled():
    return bool(DATABASE_URL)

def _mongo_enabled():
    return bool(MONGODB_URI)

def _mongo_col():
    """Lazy Mongo collection aapka_kv — free Atlas M0 works."""
    global _mongo_client, _mongo_db
    if not MONGODB_URI:
        return None
    try:
        from pymongo import MongoClient
        if _mongo_client is None:
            _mongo_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=8000)
            _mongo_db = _mongo_client.get_default_database()
            if _mongo_db is None or _mongo_db.name in (None, "test", ""):
                # URI without db name → use aapka_ai
                _mongo_db = _mongo_client["aapka_ai"]
            # ping
            _mongo_client.admin.command("ping")
        return _mongo_db["aapka_kv"]
    except Exception as e:
        print("Mongo connect error:", e)
        return None

def _pg_get():
    global _pg_conn
    if not DATABASE_URL:
        return None
    try:
        import psycopg2
        import psycopg2.extras
        if _pg_conn is None or _pg_conn.closed:
            _pg_conn = psycopg2.connect(DATABASE_URL, connect_timeout=10)
            _pg_conn.autocommit = True
            with _pg_conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS aapka_kv (
                        key TEXT PRIMARY KEY,
                        value JSONB NOT NULL,
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    )
                """)
        return _pg_conn
    except Exception as e:
        print("Postgres connect error:", e)
        return None

def _kv_get(key: str):
    """Load JSON: Mongo (preferred free long-term) → Postgres → None."""
    if _mongo_enabled():
        try:
            col = _mongo_col()
            if col is not None:
                doc = col.find_one({"_id": key})
                if doc and "value" in doc:
                    return doc["value"]
        except Exception as e:
            print("mongo kv_get:", e)
    if not _pg_enabled():
        return None
    with _pg_lock:
        conn = _pg_get()
        if not conn:
            return None
        try:
            import psycopg2.extras
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT value FROM aapka_kv WHERE key = %s", (key,))
                row = cur.fetchone()
                return row["value"] if row else None
        except Exception as e:
            print("kv_get error:", e)
            return None

def _kv_set(key: str, value):
    ok = False
    if _mongo_enabled():
        try:
            col = _mongo_col()
            if col is not None:
                col.update_one(
                    {"_id": key},
                    {"$set": {"value": value, "updated_at": iso()}},
                    upsert=True,
                )
                ok = True
        except Exception as e:
            print("mongo kv_set:", e)
    if _pg_enabled():
        with _pg_lock:
            conn = _pg_get()
            if conn:
                try:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            INSERT INTO aapka_kv (key, value, updated_at) VALUES (%s, %s::jsonb, NOW())
                            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
                            """,
                            (key, json.dumps(value, ensure_ascii=False)),
                        )
                    ok = True
                except Exception as e:
                    print("kv_set error:", e)
    return ok

def _kv_delete(key: str):
    ok = False
    if _mongo_enabled():
        try:
            col = _mongo_col()
            if col is not None:
                col.delete_one({"_id": key})
                ok = True
        except Exception as e:
            print("mongo kv_delete:", e)
    if _pg_enabled():
        with _pg_lock:
            conn = _pg_get()
            if conn:
                try:
                    with conn.cursor() as cur:
                        cur.execute("DELETE FROM aapka_kv WHERE key = %s", (key,))
                    ok = True
                except Exception as e:
                    print("kv_delete error:", e)
    return ok

def _kv_list_prefix(prefix: str):
    out = []
    if _mongo_enabled():
        try:
            col = _mongo_col()
            if col is not None:
                for doc in col.find({"_id": {"$regex": "^" + prefix}}):
                    out.append({"key": doc["_id"], "value": doc.get("value")})
                if out:
                    return out
        except Exception as e:
            print("mongo kv_list:", e)
    if not _pg_enabled():
        return out
    with _pg_lock:
        conn = _pg_get()
        if not conn:
            return out
        try:
            import psycopg2.extras
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT key, value FROM aapka_kv WHERE key LIKE %s", (prefix + "%",))
                return list(cur.fetchall() or [])
        except Exception as e:
            print("kv_list error:", e)
            return out


print("Aapka AI storage: Mongo=", "ON" if _mongo_enabled() else "OFF", "Postgres=", "ON" if _pg_enabled() else "OFF")

def _migrate_disk_into_mongo():
    """One-time: copy local workspace_*.json + registry + users into Mongo so redeploy keeps history."""
    if not _mongo_enabled():
        print("PERSISTENCE: MONGODB_URI not set — links/history WILL reset on Render redeploy. Set MONGODB_URI.")
        return
    try:
        col = _mongo_col()
        if col is None:
            return
        # indexes for speed under many companies
        try:
            col.create_index([("updated_at", 1)], background=True)
        except Exception:
            pass
        migrated = 0
        # registry file
        reg_path = os.path.join(DATA_DIR, "company_registry.json")
        if os.path.isfile(reg_path) and _kv_get("registry") is None:
            try:
                with open(reg_path, "r", encoding="utf-8") as f:
                    reg = json.load(f)
                if isinstance(reg, dict):
                    _kv_set("registry", reg)
                    migrated += 1
            except Exception as e:
                print("migrate registry:", e)
        # users file
        users_path = os.path.join(DATA_DIR, "users.json")
        if os.path.isfile(users_path) and _kv_get("users") is None:
            try:
                with open(users_path, "r", encoding="utf-8") as f:
                    users = json.load(f)
                if isinstance(users, dict):
                    _kv_set("users", users)
                    migrated += 1
            except Exception as e:
                print("migrate users:", e)
        # workspace files
        try:
            for fn in os.listdir(DATA_DIR):
                if not (fn.startswith("workspace_") and fn.endswith(".json")):
                    continue
                wid = fn[len("workspace_"):-len(".json")]
                if not wid:
                    continue
                key = f"workspace:{wid}"
                if _kv_get(key) is not None:
                    continue
                path = os.path.join(DATA_DIR, fn)
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    if isinstance(data, dict):
                        _kv_set(key, data)
                        migrated += 1
                except Exception as e:
                    print("migrate", fn, e)
        except Exception as e:
            print("migrate list:", e)
        print("PERSISTENCE: Mongo ON — history/links survive redeploy. migrated_docs≈", migrated)
    except Exception as e:
        print("migrate error:", e)

_migrate_disk_into_mongo()


# ─── Company registry (Owner link list) ───────────────────────
def _registry_path():
    return os.path.join(DATA_DIR, "company_registry.json")

def _registry_load():
    data = _kv_get("registry")
    if isinstance(data, dict):
        return data
    path = _registry_path()
    if os.path.isfile(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"companies": []}

def _registry_save(reg):
    _kv_set("registry", reg)
    path = _registry_path()
    try:
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(reg, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)
    except Exception as e:
        print("registry file save:", e)

def _registry_upsert(wid, name, tool_link, customer_link):
    reg = _registry_load()
    companies = [c for c in reg.get("companies", []) if c.get("workspace_id") != wid]
    companies.append({
        "workspace_id": wid,
        "name": name,
        "tool_link": tool_link,
        "customer_link": customer_link,
        "updated_at": iso(),
        "deleted": False,
    })
    reg["companies"] = companies
    _registry_save(reg)

def _registry_mark_deleted(wid):
    reg = _registry_load()
    for c in reg.get("companies", []):
        if c.get("workspace_id") == wid:
            c["deleted"] = True
            c["deleted_at"] = iso()
    _registry_save(reg)

_save_lock = threading.Lock()


def is_known_workspace(wid: str) -> bool:
    """True only for registered / already-persisted tenants — blocks random URL guessing."""
    if not wid or wid == "default":
        return True
    if _kv_get(f"workspace:{wid}") is not None:
        return True
    try:
        if os.path.isfile(_ws_file(wid)):
            return True
    except Exception:
        pass
    try:
        reg = _registry_load()
        for c in reg.get("companies") or []:
            if c.get("workspace_id") == wid and not c.get("deleted"):
                return True
    except Exception:
        pass
    return False


def iso():
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z"

def ts_short():
    return datetime.now(timezone.utc).replace(tzinfo=None).strftime("%Y-%m-%d %H:%M")

_ws_runtime_lock = threading.RLock()
_ws_active = {"id": None}

def workspace_id():
    """Multi-tenant: each company = isolated file.
    Resolve order: path /w/<id>/... → header X-Workspace-Id → ?workspace= → default.
    NEVER share one workspace across companies — that mixes refunds.
    """
    try:
        wid = None
        # Path: /w/COMPANY_ID/customer or /w/COMPANY_ID
        parts = (request.path or "").strip("/").split("/")
        if len(parts) >= 1 and parts[0] == "w" and len(parts) >= 2 and parts[1]:
            wid = parts[1]
        if not wid:
            wid = (request.headers.get("X-Workspace-Id") or request.args.get("workspace") or "").strip()
        if not wid:
            wid = "default"
    except RuntimeError:
        wid = "default"
    wid = "".join(c if c.isalnum() or c in "-_" else "_" for c in wid)[:64] or "default"
    return wid

def _ws_file(wid=None):
    wid = wid or "default"
    return os.path.join(DATA_DIR, f"workspace_{wid}.json")

# Keys we persist (safe history — survives process restart on same disk)
PERSIST_KEYS = [
    "isSubscriptionActive", "softLock", "customers", "orders", "cases", "receipts", "vouchers",
    "event_log", "webhook_log", "activity_log", "notifications", "metrics",
    "agent_stats", "integrations", "connected_systems", "plan",
    "tenant", "refund_requests", "security_audit", "api_request_logs",
    "retention_policy", "history_meta", "deletion_jobs",
    "custom_integrations", "field_mappings", "refund_policy", "ai_config",
    "rbac", "billing", "comm_templates", "sla_rules", "usage_counters",
]

def save_workspace(wid=None):
    """Write durable snapshot. One file per company + optional Postgres (survives redeploy)."""
    wid = wid or workspace_id()
    payload = {k: DB.get(k) for k in PERSIST_KEYS if k in DB}
    payload["_meta"] = {"workspace": wid, "saved_at": iso(), "version": "8.0-MONGO"}
    _kv_set(f"workspace:{wid}", payload)
    path = _ws_file(wid)
    tmp = path + ".tmp"
    with _save_lock:
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=0)
            os.replace(tmp, path)
        except Exception as e:
            print("file save_workspace:", e)

def load_workspace(wid="default"):
    data = _kv_get(f"workspace:{wid}")
    if not isinstance(data, dict):
        path = _ws_file(wid)
        if not os.path.isfile(path):
            return False
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print("load_workspace file error:", e)
            return False
    try:
        for k in PERSIST_KEYS:
            if k in data:
                DB[k] = data[k]
            else:
                if k in ("customers", "orders", "cases"):
                    DB[k] = {}
                elif k in ("receipts", "refund_requests", "notifications", "activity_log",
                           "event_log", "security_audit", "api_request_logs", "vouchers",
                           "deletion_jobs", "webhook_log"):
                    DB[k] = []
        return True
    except Exception as e:
        print("load_workspace error:", e)
        return False

def touch_save():
    """Call after every mutation so history does not evaporate on idle restart."""
    try:
        save_workspace(workspace_id())
    except RuntimeError:
        save_workspace("default")
    except Exception as e:
        print("save error:", e)


def current_tenant_id():
    """Trusted tenant context from workspace file isolation (not client-supplied alone)."""
    wid = workspace_id()
    if DB.get("tenant") and DB["tenant"].get("tenant_id"):
        # Keep tenant_id aligned with workspace file
        if DB["tenant"]["tenant_id"] != wid:
            DB["tenant"]["tenant_id"] = wid
        return DB["tenant"]["tenant_id"]
    return wid


def ensure_tenant_bootstrap():
    tid = workspace_id()
    if not DB.get("tenant"):
        DB["tenant"] = {}
    DB["tenant"]["tenant_id"] = tid
    if not DB["tenant"].get("name"):
        DB["tenant"]["name"] = "Workspace " + tid
    if not DB["tenant"].get("created_at"):
        DB["tenant"]["created_at"] = iso()
    if "refund_requests" not in DB:
        DB["refund_requests"] = []
    if "security_audit" not in DB:
        DB["security_audit"] = []
    if "api_request_logs" not in DB:
        DB["api_request_logs"] = []
    if "retention_policy" not in DB:
        DB["retention_policy"] = {
            "api_debug_days": 30, "diagnostics_days": 7, "customer_interaction_days": 365,
            "order_refund_days": 365, "security_audit_days": 365, "aggregate_metrics_days": 730,
            "updated_at": None, "updated_by": "system",
        }
    if "deletion_jobs" not in DB:
        DB["deletion_jobs"] = []
    if "custom_integrations" not in DB:
        DB["custom_integrations"] = []
    if "field_mappings" not in DB:
        DB["field_mappings"] = [
            {"source_field": "customer_id", "internal_field": "CustomerID", "status": "mapped"},
            {"source_field": "booking_reference", "internal_field": "OrderID", "status": "mapped"},
            {"source_field": "payment_state", "internal_field": "PaymentStatus", "status": "mapped"},
        ]
    if "refund_policy" not in DB:
        DB["refund_policy"] = {
            "auto_approve_max_inr": 0,
            "require_manual_approval_above_inr": 1,
            "dry_run_default": True,
            "allow_provider_execute": False,
            "note": "Financial writes disabled until company enables allow_provider_execute and provides valid payment credentials.",
        }
    if "ai_config" not in DB:
        DB["ai_config"] = {
            "provider": None,
            "model": None,
            "configured": False,
            "note": "No LLM credentials stored. Investigation engine uses rule-based evidence from OrderDB/cases (DEMO-safe).",
        }
    if "rbac" not in DB:
        DB["rbac"] = {
            "roles": [
                "Organization Owner", "Organization Administrator", "Security Administrator",
                "Support Manager", "Support Employee", "Refund Approver", "Read-only Analyst",
                "Integration Administrator", "Auditor",
            ],
            "current_role": "Organization Administrator",
            "note": "Full auth/MFA requires identity provider — role list is configuration surface for enterprise rollout.",
        }
    if "billing" not in DB:
        DB["billing"] = {
            "plan": DB.get("plan", {}).get("name", "Enterprise"),
            "status": "ACTIVE" if DB.get("isSubscriptionActive") else "SUSPENDED",
            "price_usd": DB.get("plan", {}).get("price", 1200),
            "usage": {"api_requests": 0, "ai_invocations": 0, "integrations": 0},
            "note": "Commercial pricing is contractual — not a hardcoded $100k claim.",
        }
    if "comm_templates" not in DB:
        DB["comm_templates"] = [
            {"id": "TPL-ACK", "name": "Refund request acknowledgment", "channel": "email", "status": "template_only"},
            {"id": "TPL-CONF", "name": "Refund confirmed (provider only)", "channel": "email", "status": "template_only"},
        ]
    if "sla_rules" not in DB:
        DB["sla_rules"] = {"ack_seconds": 90, "resolve_hours_premium": 4, "resolve_hours_standard": 24}
    if "usage_counters" not in DB:
        DB["usage_counters"] = {"cases_total": 0, "cases_resolved": 0, "automation_failures": 0}


def security_audit(event_type, outcome="SUCCESS", resource=None, actor="system", meta=None):
    ensure_tenant_bootstrap()
    prev_hash = DB["security_audit"][-1]["integrity_hash"] if DB["security_audit"] else "GENESIS"
    raw = f"{prev_hash}|{event_type}|{outcome}|{iso()}|{actor}|{resource}"
    h = hashlib.sha256(raw.encode()).hexdigest()
    rec = {
        "event_id": f"SEC-{secrets.token_hex(6).upper()}",
        "tenant_id": current_tenant_id(),
        "event_type": event_type,
        "timestamp": iso(),
        "outcome": outcome,
        "actor_id": actor,
        "resource_reference": resource,
        "correlation_id": secrets.token_hex(8),
        "prev_hash": prev_hash,
        "integrity_hash": h,
        "meta": meta or {},
    }
    DB["security_audit"].append(rec)
    if len(DB["security_audit"]) > 500:
        DB["security_audit"] = DB["security_audit"][-500:]
    touch_save()
    return rec


def api_log(route, method, status, duration_ms=0, error_code=None, provider=None):
    ensure_tenant_bootstrap()
    rec = {
        "event_id": f"API-{secrets.token_hex(5).upper()}",
        "tenant_id": current_tenant_id(),
        "api_route": route,
        "http_method": method,
        "request_timestamp": iso(),
        "duration_ms": duration_ms,
        "http_status": status,
        "success": 200 <= status < 400,
        "error_code": error_code,
        "provider": provider,
        "correlation_id": secrets.token_hex(8),
        # bodies intentionally not stored — security
    }
    DB["api_request_logs"].append(rec)
    if len(DB["api_request_logs"]) > 300:
        DB["api_request_logs"] = DB["api_request_logs"][-300:]
    # soft save — avoid recursion storms; periodic
    if len(DB["api_request_logs"]) % 5 == 0:
        touch_save()
    return rec


def record_refund_request(order, customer_id, source="customer_chat", status="CONFIRMED", demo=True):
    """Financial-safe record. DEMO path mutates local OrderDB only unless payment provider connected+confirmed."""
    ensure_tenant_bootstrap()
    pay = DB["integrations"].get("payment") or {}
    provider_ref = None
    financial_state = "LOCAL_DB_ONLY"
    if pay.get("connected") and not demo:
        financial_state = "AWAITING_PROVIDER"
    else:
        # Explicit demo labeling — do not claim bank money moved
        financial_state = "DEMO_LOCAL_STATUS_FLIP"
        status = status if status else "CONFIRMED"
    idem = hashlib.sha256(f"{current_tenant_id()}|{order['OrderID']}|refund|{order.get('amount')}".encode()).hexdigest()[:16]
    # Idempotency: same order refund request not duplicated if already confirmed
    for existing in DB["refund_requests"]:
        if existing.get("idempotency_key") == idem and existing.get("status") in ("CONFIRMED", "PROCESSING"):
            return existing
    rec = {
        "refund_request_id": f"RFQ-{secrets.token_hex(5).upper()}",
        "tenant_id": current_tenant_id(),
        "customer_id": customer_id,
        "order_id": order["OrderID"],
        "payment_transaction_reference": None,
        "requested_amount": order.get("amount"),
        "currency": "INR",
        "request_timestamp": iso(),
        "request_source": source,
        "reason_code": "CUSTOMER_REQUEST",
        "status": status,
        "approval_status": "AUTO_DEMO" if demo else "PENDING",
        "authorized_approver": None,
        "payment_provider_reference": provider_ref,
        "execution_attempt_count": 1,
        "last_attempt_time": iso(),
        "failure_code": None,
        "confirmed_completion_timestamp": iso() if status == "CONFIRMED" else None,
        "related_support_ticket": None,
        "receipt_reference": None,
        "financial_state": financial_state,
        "idempotency_key": idem,
        "demo": True,
        "demo_note": "LOCAL status change only. Real money movement requires payment-provider confirmation.",
    }
    DB["refund_requests"].append(rec)
    touch_save()
    return rec


def apply_retention_cleanup():
    """Idempotent cleanup by retention_policy. Security audit never soft-deleted below policy floor."""
    ensure_tenant_bootstrap()
    pol = DB["retention_policy"]
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    def parse_ts(s):
        try:
            return datetime.fromisoformat(s.replace("Z", ""))
        except Exception:
            return now
    def retain(days, ts):
        return (now - parse_ts(ts)).days <= days

    before = {
        "api": len(DB.get("api_request_logs") or []),
        "activity": len(DB.get("activity_log") or []),
        "events": len(DB.get("event_log") or []),
    }
    DB["api_request_logs"] = [r for r in DB.get("api_request_logs") or [] if retain(pol.get("api_debug_days", 30), r.get("request_timestamp") or iso())]
    DB["activity_log"] = [r for r in DB.get("activity_log") or [] if retain(pol.get("customer_interaction_days", 365), r.get("time") or iso())]
    DB["event_log"] = [r for r in DB.get("event_log") or [] if retain(pol.get("customer_interaction_days", 365), r.get("timestamp") or iso())]
    # security_audit longer retention
    DB["security_audit"] = [r for r in DB.get("security_audit") or [] if retain(pol.get("security_audit_days", 365), r.get("timestamp") or iso())]
    job = {
        "job_id": f"DEL-{secrets.token_hex(4).upper()}",
        "tenant_id": current_tenant_id(),
        "ran_at": iso(),
        "before": before,
        "after": {
            "api": len(DB["api_request_logs"]),
            "activity": len(DB["activity_log"]),
            "events": len(DB["event_log"]),
            "security": len(DB["security_audit"]),
        },
        "status": "COMPLETED",
    }
    DB["deletion_jobs"].append(job)
    DB["history_meta"]["last_cleanup_at"] = iso()
    touch_save()
    security_audit("RETENTION_CLEANUP_RUN", "SUCCESS", job["job_id"])
    return job


def mask_email(e):
    if not e or "@" not in e:
        return "***"
    u, d = e.split("@", 1)
    return (u[:1] + "***@" + d) if u else "***@" + d


def mask_phone(ph):
    if not ph:
        return "***"
    s = str(ph)
    return s[:3] + "****" + s[-2:] if len(s) > 5 else "****"



DB = {
    "isSubscriptionActive": True,
    "softLock": False,
    "customers": {
        "CUST001": {"id": "CUST001", "name": "Aarav Mehta", "email": "aarav.mehta@email.com", "phone": "+91-9876543210", "tier": "Premium", "joined": "2024-01-15", "balance": 18500, "sentiment": "neutral"},
        "CUST002": {"id": "CUST002", "name": "Sneha Reddy", "email": "sneha.reddy@email.com", "phone": "+91-9123456789", "tier": "Standard", "joined": "2025-06-20", "balance": 4200, "sentiment": "neutral"},
        "CUST003": {"id": "CUST003", "name": "Vikram Singh", "email": "vikram.singh@email.com", "phone": "+91-9988776655", "tier": "Premium", "joined": "2023-11-08", "balance": 32000, "sentiment": "positive"},
        "CUST004": {"id": "CUST004", "name": "Ananya Iyer", "email": "ananya.iyer@email.com", "phone": "+91-9811223344", "tier": "Standard", "joined": "2025-02-14", "balance": 2800, "sentiment": "neutral"},
        "CUST005": {"id": "CUST005", "name": "Kabir Khan", "email": "kabir.khan@email.com", "phone": "+91-9765432100", "tier": "Premium", "joined": "2024-08-22", "balance": 15600, "sentiment": "neutral"},
    },
    "orders": {
        "ORD-5566": {"OrderID": "ORD-5566", "CustomerID": "CUST001", "CustomerName": "Aarav Mehta", "Tier": "Premium", "item": "Delhi to Mumbai Flight", "amount": 8500, "PaymentStatus": "Paid", "date": "2026-10-08", "ChatHistory": []},
        "ORD-4432": {"OrderID": "ORD-4432", "CustomerID": "CUST001", "CustomerName": "Aarav Mehta", "Tier": "Premium", "item": "Taj Hotel Booking", "amount": 12000, "PaymentStatus": "Paid", "date": "2026-09-15", "ChatHistory": []},
        "ORD-7788": {"OrderID": "ORD-7788", "CustomerID": "CUST002", "CustomerName": "Sneha Reddy", "Tier": "Standard", "item": "Goa Package", "amount": 25000, "PaymentStatus": "Paid", "date": "2026-10-01", "ChatHistory": []},
        "ORD-9012": {"OrderID": "ORD-9012", "CustomerID": "CUST003", "CustomerName": "Vikram Singh", "Tier": "Premium", "item": "Business Class BLR-DEL", "amount": 28500, "PaymentStatus": "Paid", "date": "2026-10-05", "ChatHistory": []},
        "ORD-3344": {"OrderID": "ORD-3344", "CustomerID": "CUST004", "CustomerName": "Ananya Iyer", "Tier": "Standard", "item": "Chennai Hotel Stay", "amount": 6800, "PaymentStatus": "Paid", "date": "2026-09-28", "ChatHistory": []},
        "ORD-6677": {"OrderID": "ORD-6677", "CustomerID": "CUST005", "CustomerName": "Kabir Khan", "Tier": "Premium", "item": "Intl Flight + Hotel", "amount": 45000, "PaymentStatus": "Paid", "date": "2026-10-10", "ChatHistory": []},
    },
    "cases": {},
    "notifications": [],
    "vouchers": [],
    "receipts": [],
    "event_log": [],
    "webhook_log": [],
    "activity_log": [],
    "agent_stats": {"Agent-01": {"resolved": 0, "avg_seconds": 0, "actions": 0}},
    "metrics": {
        "human_hours_saved": 0.0,
        "salary_leak_prevented": 0.0,
        "vip_churn_stopped": 0,
        "total_automations": 0,
        "refunds_processed": 0,
        "tickets_created": 0,
    },
    "connected_systems": {
        "Salesforce": "NOT CONNECTED",
        "Zendesk": "NOT CONNECTED",
        "Payment": "NOT CONNECTED",
        "OrderDB": "CONNECTED",
        "Email": "CONNECTED",
    },
    "integrations": {
        "salesforce": {"connected": False, "instance_url": "", "client_id": "", "client_secret": "", "connected_at": None, "last_test": None, "health": "unknown"},
        "zendesk": {"connected": False, "subdomain": "", "email": "", "api_token": "", "connected_at": None, "last_test": None, "health": "unknown"},
        "payment": {"connected": False, "provider": "", "mode": "test", "key_id": "", "key_secret": "", "connected_at": None, "last_test": None, "health": "unknown"},
    },
    "plan": {"name": "Enterprise", "price": 1200, "currency": "USD"},
    "tenant": {
        "tenant_id": "default",
        "name": "Demo Workspace",
        "created_at": None,
        "isolation": "file-per-workspace",
    },
    "refund_requests": [],
    "security_audit": [],
    "api_request_logs": [],
    "retention_policy": {
        "api_debug_days": 30,
        "diagnostics_days": 7,
        "customer_interaction_days": 365,
        "order_refund_days": 365,
        "security_audit_days": 365,
        "aggregate_metrics_days": 730,
        "updated_at": None,
        "updated_by": "system",
    },
    "history_meta": {"last_cleanup_at": None, "schema_version": "history-1"},
    "deletion_jobs": [],
}


def add_hours(minutes=15):
    h = minutes / 60.0
    DB["metrics"]["human_hours_saved"] = round(DB["metrics"]["human_hours_saved"] + h, 2)
    DB["metrics"]["salary_leak_prevented"] = round(DB["metrics"]["human_hours_saved"] * 25, 2)
    DB["metrics"]["total_automations"] += 1


def log_activity(actor, action, detail=""):
    DB["activity_log"].append({"time": iso(), "actor": actor, "action": action, "detail": detail})
    if len(DB["activity_log"]) > 200:
        DB["activity_log"] = DB["activity_log"][-200:]
    touch_save()


def log_event(etype, detail, cid=None):
    DB["event_log"].append({"id": f"EVT-{int(time.time()*1000)%1000000}", "type": etype, "detail": detail, "customer_id": cid, "timestamp": iso()})
    if len(DB["event_log"]) > 100:
        DB["event_log"] = DB["event_log"][-100:]
    touch_save()


def fire_webhooks(etype, payload):
    for target, ch in [("Sales Team", "#sales-alerts"), ("Tech / Engineering", "#tech-ops")]:
        DB["webhook_log"].append({"target": target, "channel": ch, "event": etype, "payload": payload, "timestamp": iso(), "status": "DELIVERED"})
    if len(DB["webhook_log"]) > 50:
        DB["webhook_log"] = DB["webhook_log"][-50:]
    touch_save()


def receipt(order_id, amount, name):
    raw = f"{order_id}|{amount}|{name}|{iso()}|{secrets.token_hex(8)}"
    dig = hashlib.sha256(raw.encode()).hexdigest()
    r = {"receipt_id": f"RCP-{dig[:12].upper()}", "order_id": order_id, "amount": amount, "customer": name, "timestamp": iso(), "hash": dig, "status": "REFUNDED"}
    DB["receipts"].append(r)
    touch_save()
    return r


def orders_of(cid):
    return [o for o in DB["orders"].values() if o["CustomerID"] == cid]


def lockout():
    return {
        "error": "CRITICAL_PIPELINE_FAILURE",
        "message": (
            "CRITICAL PIPELINE FAILURE: Aapka AI Core Brain Disconnected.\n\n"
            "All automation stopped.\n"
            "• 1-click actions removed\n"
            "• Customer context & history LOCKED\n"
            "• Priority routing disabled\n"
            "• Historical memory unavailable\n\n"
            "Queue time: 2 seconds → 4.5 hours\n"
            "Agents must open Salesforce + Zendesk + OrderDB manually again.\n"
            "Full 8-hour shift load has returned.\n\n"
            "REINSTATEMENT: Enterprise $1,200/mo\n"
            "Employees will request reactivation from leadership."
        ),
        "locked": True,
        "reinstatement_amount": "$1,200/mo",
    }


def soft_lock_msg():
    return {
        "error": "SOFT_LOCK",
        "message": "Reduced mode: some automations paused. Reactivate full Enterprise to restore 1-click and priority routing.",
        "soft": True,
    }


def process_chat(message, customer_id):
    ensure_pilot_customers_if_empty()
    if not DB["isSubscriptionActive"]:
        return lockout()
    lower = (message or "").lower().strip()
    c = DB["customers"].get(customer_id)
    if not c:
        return {"reply": "Customer not found in this company workspace. Choose Profile A–E (pilot demo) or connect CRM.", "type": "error", "confidence": 0.3}
    tier = c["tier"]
    prem = tier == "Premium"
    pri = "PRIORITY (Premium) — " if prem else ""

    # Refund
    if any(w in lower for w in ["refund", "वापसी", "पैसे वापस", "money back", "refund chahiye"]):
        paid = [o for o in orders_of(customer_id) if o["PaymentStatus"] == "Paid"]
        if not paid:
            return {"reply": f"{pri}No eligible paid order (already refunded or none).", "type": "info", "confidence": 0.9}
        o = paid[0]
        o["PaymentStatus"] = "Refunded"
        o["ChatHistory"].append({"role": "customer", "msg": message, "time": iso()})
        r = receipt(o["OrderID"], o["amount"], o["CustomerName"])
        rfq = record_refund_request(o, customer_id, source="customer_chat", status="CONFIRMED", demo=True)
        rfq["receipt_reference"] = r.get("receipt_id")
        r["demo"] = True
        r["demo_note"] = "DEMO: local OrderDB PaymentStatus flip + receipt hash. Not payment-provider bank confirmation."
        add_hours(15)
        DB["metrics"]["refunds_processed"] += 1
        if prem:
            DB["metrics"]["vip_churn_stopped"] += 1
        log_event("refund_executed", f"{o['OrderID']} Rs.{o['amount']}", customer_id)
        log_activity("system", "refund", o["OrderID"])
        fire_webhooks("REFUND_PROCESSED", {"order_id": o["OrderID"], "amount": o["amount"], "customer": o["CustomerName"], "tier": tier})
        # Agent Desk / Open Cases must see this refund (was missing before)
        case_id = f"CASE-RF-{secrets.token_hex(3).upper()}"
        case = {
            "id": case_id,
            "customerId": customer_id,
            "customerName": c["name"],
            "tier": tier,
            "title": f"Auto-Refund — {o.get('item', 'Order')} ({o['OrderID']})",
            "status": "Resolved",
            "priority": "Critical" if prem else "High",
            "queue": "premium" if prem else "standard",
            "type": "refund",
            "orderId": o["OrderID"],
            "amount": o.get("amount"),
            "receiptId": r.get("receipt_id"),
            "created": iso(),
            "resolved_at": iso(),
            "summary": (
                f"Automated refund for {o['OrderID']} · Rs.{o.get('amount')}.\n"
                f"Receipt: {r.get('receipt_id')}.\n"
                f"DEMO local PaymentStatus flip until Payment gateway is connected and confirms bank transfer."
            ),
            "history": [
                {"time": ts_short(), "event": "Customer requested refund via portal"},
                {"time": ts_short(), "event": f"PaymentStatus Paid → Refunded ({o['OrderID']})"},
                {"time": ts_short(), "event": f"Receipt {r.get('receipt_id')} generated"},
                {"time": ts_short(), "event": "Case auto-closed by automation"},
            ],
            "actions": [],
        }
        DB["cases"][case_id] = case
        DB["notifications"].append({
            "id": f"N-{case_id}",
            "caseId": case_id,
            "message": f"Auto-refund {o['OrderID']} · {c['name']} ({tier}) · Rs.{o.get('amount')}",
            "priority": case["priority"],
            "time": iso(),
            "read": False,
            "type": "refund",
        })
        touch_save()
        pay = DB["integrations"]["payment"]
        pay_note = f"\nVia {pay['provider']} ({pay['mode']}) — your merchant account." if pay["connected"] else "\n(Connect Payment in Console for gateway routing.)"
        return {
            "reply": (
                f"{pri}REFUND EXECUTED\n\n"
                f"Order: {o['item']} ({o['OrderID']})\nAmount: Rs.{o['amount']}\n"
                f"PaymentStatus: Paid → Refunded{pay_note}\n\n"
                f"Receipt ID: {r['receipt_id']}\nHash: {r['hash'][:24]}...\nTime: {r['timestamp']}\n"
                f"Case: {case_id} (visible on Agent Desk)\n\n"
                f"Reflects in 5-7 working days."
            ),
            "type": "refund_executed", "confidence": 0.98, "receipt": r, "order": o, "case_id": case_id,
        }

    # Complex
    if any(w in lower for w in ["complex", "complex problem", "bahut complex", "help karo", "serious", "escalate", "problem"]):
        case_id = f"CASE-{int(time.time()) % 100000}"
        case = {
            "id": case_id, "customerId": customer_id, "customerName": c["name"], "tier": tier,
            "title": f"Complex Issue — {c['name']}", "status": "Escalated",
            "priority": "Critical" if prem else "High", "queue": "premium" if prem else "standard",
            "created": iso(),
            "summary": (
                f"Customer {c['name']} ({tier}) raised a complex issue.\n"
                f"Context loaded from connected CRM + Helpdesk + Order DB.\n"
                f"Open orders: {len(orders_of(customer_id))}. Sentiment: {c.get('sentiment','neutral')}.\n"
                f"AI recommends 3 one-click actions for the agent."
            ),
            "history": [
                {"time": ts_short(), "event": "Customer triggered complex issue"},
                {"time": ts_short(), "event": "Full context + order history loaded"},
                {"time": ts_short(), "event": f"Routed to {'Premium' if prem else 'Standard'} queue"},
            ],
            "actions": [
                {"id": 1, "color": "red", "title": "DB Hard-Reset & Resync", "description": "Resync customer across Salesforce, Zendesk, OrderDB.", "impact": "High – consistency"},
                {"id": 2, "color": "yellow", "title": "Escalate to Slack/Teams", "description": "Alert #customer-critical with full payload.", "impact": "Manager < 30s"},
                {"id": 3, "color": "green", "title": "Issue $20 Goodwill Voucher", "description": "One-time $20 / Rs.1,600 voucher on account.", "impact": "Retention"},
                {"id": 4, "color": "blue", "title": "Create Support Ticket", "description": "Open formal ticket in connected helpdesk.", "impact": "Tracked workflow"},
            ],
        }
        DB["cases"][case_id] = case
        DB["notifications"].append({"id": f"N-{case_id}", "caseId": case_id, "message": f"New case from {c['name']} ({tier})", "priority": case["priority"], "time": iso(), "read": False})
        add_hours(20)
        if prem:
            DB["metrics"]["vip_churn_stopped"] += 1
        log_event("complex_escalated", case_id, customer_id)
        fire_webhooks("COMPLEX_ISSUE_ESCALATED", {"case_id": case_id, "customer": c["name"], "tier": tier})
        log_activity("system", "escalate", case_id)
        return {
            "reply": f"{pri}Complex case {case_id} created.\nFull context pushed to Employee Desk.\nAgent gets 4 one-click actions.",
            "type": "complex_escalated", "confidence": 0.94, "caseId": case_id,
        }

    # Status
    if any(w in lower for w in ["status", "स्टेटस", "order status", "meri order", "orders"]):
        os_ = orders_of(customer_id)
        if not os_:
            return {"reply": f"{pri}No orders found.", "type": "info", "confidence": 0.9}
        lines = "\n".join(f"- {o['item']} ({o['OrderID']}) → {o['PaymentStatus']} · Rs.{o['amount']}" for o in os_)
        return {"reply": f"{pri}Your orders:\n\n{lines}", "type": "status", "confidence": 0.95}

    # Ticket / book
    if any(w in lower for w in ["ticket", "book", "booking", "टिकट", "बुक"]):
        DB["metrics"]["tickets_created"] += 1
        add_hours(5)
        return {
            "reply": f"{pri}Booking/ticket request logged.\nFor refunds say \"refund chahiye\". For hard issues say \"complex problem\" — agent gets 1-click tools.",
            "type": "ticket", "confidence": 0.88,
        }

    return {
        "reply": f"{pri}I can help with:\n• Refund (refund chahiye)\n• Order status\n• Complex issue → employee + 1-click actions\n• Ticket/booking help\n\nWhat do you need?",
        "type": "help", "confidence": 0.85,
    }


# ---------- PAGES ----------
load_workspace("default")
ensure_tenant_bootstrap()
if not DB["tenant"].get("created_at"):
    DB["tenant"]["created_at"] = iso()
_ws_active["id"] = "default"
print("Safe history:", "LOADED" if os.path.isfile(_ws_file("default")) else "FRESH", "tenant=", DB["tenant"].get("tenant_id"))


def _seed_fresh_workspace_memory(wid):
    """New company gets ITS OWN pilot demo customers/orders (not copied from another company).
    Real CRM later replaces these. Isolation stays: each workspace file is separate."""
    DB["tenant"] = {
        "tenant_id": wid,
        "name": "Company " + wid,
        "created_at": iso(),
        "isolation": "file-per-workspace",
    }
    # Per-company pilot samples so customer portal works until CRM is connected
    DB["customers"] = {
        "CUST001": {"id": "CUST001", "name": "Aarav Mehta", "email": "aarav@example.com", "phone": "+91-9000000001", "tier": "Premium", "joined": "2024-01-15", "balance": 18500, "sentiment": "neutral"},
        "CUST002": {"id": "CUST002", "name": "Sneha Reddy", "email": "sneha@example.com", "phone": "+91-9000000002", "tier": "Standard", "joined": "2024-03-20", "balance": 4200, "sentiment": "neutral"},
        "CUST003": {"id": "CUST003", "name": "Vikram Singh", "email": "vikram@example.com", "phone": "+91-9000000003", "tier": "Premium", "joined": "2023-11-05", "balance": 32000, "sentiment": "neutral"},
        "CUST004": {"id": "CUST004", "name": "Ananya Iyer", "email": "ananya@example.com", "phone": "+91-9000000004", "tier": "Standard", "joined": "2025-02-10", "balance": 1500, "sentiment": "neutral"},
        "CUST005": {"id": "CUST005", "name": "Kabir Khan", "email": "kabir@example.com", "phone": "+91-9000000005", "tier": "Premium", "joined": "2024-07-01", "balance": 45000, "sentiment": "neutral"},
    }
    DB["orders"] = {
        "ORD-5566": {"OrderID": "ORD-5566", "CustomerID": "CUST001", "CustomerName": "Aarav Mehta", "Tier": "Premium", "item": "Delhi to Mumbai Flight", "amount": 8500, "PaymentStatus": "Paid", "date": "2026-10-08", "ChatHistory": []},
        "ORD-4432": {"OrderID": "ORD-4432", "CustomerID": "CUST001", "CustomerName": "Aarav Mehta", "Tier": "Premium", "item": "Taj Hotel Booking", "amount": 12000, "PaymentStatus": "Paid", "date": "2026-09-15", "ChatHistory": []},
        "ORD-7788": {"OrderID": "ORD-7788", "CustomerID": "CUST002", "CustomerName": "Sneha Reddy", "Tier": "Standard", "item": "Goa Package", "amount": 25000, "PaymentStatus": "Paid", "date": "2026-10-01", "ChatHistory": []},
        "ORD-9012": {"OrderID": "ORD-9012", "CustomerID": "CUST003", "CustomerName": "Vikram Singh", "Tier": "Premium", "item": "Business Class Upgrade", "amount": 28500, "PaymentStatus": "Paid", "date": "2026-09-28", "ChatHistory": []},
        "ORD-3344": {"OrderID": "ORD-3344", "CustomerID": "CUST004", "CustomerName": "Ananya Iyer", "Tier": "Standard", "item": "Train Ticket", "amount": 6800, "PaymentStatus": "Paid", "date": "2026-10-05", "ChatHistory": []},
        "ORD-6677": {"OrderID": "ORD-6677", "CustomerID": "CUST005", "CustomerName": "Kabir Khan", "Tier": "Premium", "item": "International Package", "amount": 45000, "PaymentStatus": "Paid", "date": "2026-09-20", "ChatHistory": []},
    }
    DB["cases"] = {}
    DB["notifications"] = []
    DB["vouchers"] = []
    DB["receipts"] = []
    DB["event_log"] = []
    DB["webhook_log"] = []
    DB["activity_log"] = []
    DB["refund_requests"] = []
    DB["security_audit"] = []
    DB["api_request_logs"] = []
    DB["deletion_jobs"] = []
    DB["metrics"] = {
        "human_hours_saved": 0.0,
        "salary_leak_prevented": 0.0,
        "vip_churn_stopped": 0,
        "total_automations": 0,
        "refunds_processed": 0,
        "tickets_created": 0,
    }
    DB["isSubscriptionActive"] = True
    DB["softLock"] = False
    for k in ("salesforce", "zendesk", "payment"):
        if k in DB.get("integrations", {}):
            DB["integrations"][k]["connected"] = False
            DB["integrations"][k]["connected_at"] = None
            DB["integrations"][k]["health"] = "unknown"
    DB["connected_systems"] = {
        "Salesforce": "NOT CONNECTED",
        "Zendesk": "NOT CONNECTED",
        "Payment": "NOT CONNECTED",
        "OrderDB": "CONNECTED",
        "Email": "CONNECTED",
    }



def ensure_pilot_customers_if_empty():
    """If workspace has zero customers (e.g. created before pilot seed), inject demo set for testing."""
    if DB.get("customers"):
        return
    DB["customers"] = {
        "CUST001": {"id": "CUST001", "name": "Aarav Mehta", "email": "aarav@example.com", "phone": "+91-9000000001", "tier": "Premium", "joined": "2024-01-15", "balance": 18500, "sentiment": "neutral"},
        "CUST002": {"id": "CUST002", "name": "Sneha Reddy", "email": "sneha@example.com", "phone": "+91-9000000002", "tier": "Standard", "joined": "2024-03-20", "balance": 4200, "sentiment": "neutral"},
        "CUST003": {"id": "CUST003", "name": "Vikram Singh", "email": "vikram@example.com", "phone": "+91-9000000003", "tier": "Premium", "joined": "2023-11-05", "balance": 32000, "sentiment": "neutral"},
        "CUST004": {"id": "CUST004", "name": "Ananya Iyer", "email": "ananya@example.com", "phone": "+91-9000000004", "tier": "Standard", "joined": "2025-02-10", "balance": 1500, "sentiment": "neutral"},
        "CUST005": {"id": "CUST005", "name": "Kabir Khan", "email": "kabir@example.com", "phone": "+91-9000000005", "tier": "Premium", "joined": "2024-07-01", "balance": 45000, "sentiment": "neutral"},
    }
    if not DB.get("orders"):
        DB["orders"] = {
            "ORD-5566": {"OrderID": "ORD-5566", "CustomerID": "CUST001", "CustomerName": "Aarav Mehta", "Tier": "Premium", "item": "Delhi to Mumbai Flight", "amount": 8500, "PaymentStatus": "Paid", "date": "2026-10-08", "ChatHistory": []},
            "ORD-4432": {"OrderID": "ORD-4432", "CustomerID": "CUST001", "CustomerName": "Aarav Mehta", "Tier": "Premium", "item": "Taj Hotel Booking", "amount": 12000, "PaymentStatus": "Paid", "date": "2026-09-15", "ChatHistory": []},
            "ORD-7788": {"OrderID": "ORD-7788", "CustomerID": "CUST002", "CustomerName": "Sneha Reddy", "Tier": "Standard", "item": "Goa Package", "amount": 25000, "PaymentStatus": "Paid", "date": "2026-10-01", "ChatHistory": []},
            "ORD-9012": {"OrderID": "ORD-9012", "CustomerID": "CUST003", "CustomerName": "Vikram Singh", "Tier": "Premium", "item": "Business Class Upgrade", "amount": 28500, "PaymentStatus": "Paid", "date": "2026-09-28", "ChatHistory": []},
            "ORD-3344": {"OrderID": "ORD-3344", "CustomerID": "CUST004", "CustomerName": "Ananya Iyer", "Tier": "Standard", "item": "Train Ticket", "amount": 6800, "PaymentStatus": "Paid", "date": "2026-10-05", "ChatHistory": []},
            "ORD-6677": {"OrderID": "ORD-6677", "CustomerID": "CUST005", "CustomerName": "Kabir Khan", "Tier": "Premium", "item": "International Package", "amount": 45000, "PaymentStatus": "Paid", "date": "2026-09-20", "ChatHistory": []},
        }
    try:
        touch_save()
    except Exception:
        pass

@app.before_request
def bind_company_workspace():
    """Every request loads ONLY that company's workspace — no cross-company mix. Unknown /w/IDs do not auto-create."""
    path = request.path or ""
    if path.startswith("/static") or path.endswith((".js", ".css", ".ico", ".png", ".jpg", ".svg", ".map")):
        return
    if path.startswith("/login") or path.startswith("/api/auth"):
        return
    wid = workspace_id()
    # Block unregistered workspace probing (security)
    if path.startswith("/w/") and wid and wid != "default" and not is_known_workspace(wid):
        # Allow only if this is company create after auth — otherwise 404
        if not path.startswith("/api/company/create"):
            g.workspace = None
            if path.startswith("/api/"):
                return jsonify({"error": "UNKNOWN_WORKSPACE", "message": "This company link is invalid or was deleted."}), 404
            return ("Invalid or expired company link. Ask your admin for the official Tool / Customer link.", 404)

    with _ws_runtime_lock:
        if _ws_active.get("id") != wid:
            prev = _ws_active.get("id")
            if prev:
                try:
                    save_workspace(prev)
                except Exception:
                    pass
            loaded = load_workspace(wid)
            if not loaded:
                # Only seed when owner explicitly creates company (registry) or default
                if wid == "default" or is_known_workspace(wid):
                    _seed_fresh_workspace_memory(wid)
                    ensure_tenant_bootstrap()
                    save_workspace(wid)
                else:
                    g.workspace = wid
                    _ws_active["id"] = wid
                    return
            else:
                ensure_tenant_bootstrap()
            _ws_active["id"] = wid
        g.workspace = wid


@app.after_request
def persist_company_workspace(resp):
    try:
        if getattr(g, "workspace", None):
            with _ws_runtime_lock:
                save_workspace(g.workspace)
    except Exception:
        pass
    # Help browsers/apps always send tenant context on API calls from same origin pages
    if request.args.get("workspace") or (request.path or "").startswith("/w/"):
        resp.headers["X-Workspace-Id"] = workspace_id()
    return resp



# ─── Google Auth ───────────────────────────────────────────────
def current_user():
    u = session.get("user")
    return u if isinstance(u, dict) and u.get("email") else None


# ─── Email/password accounts (persistent in DATA_DIR) ─────────
_USERS_LOCK = threading.RLock()

def _users_path():
    return os.path.join(DATA_DIR, "users.json")

def _load_users():
    data = _kv_get("users")
    if isinstance(data, dict):
        return data
    path = _users_path()
    if not os.path.isfile(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            _kv_set("users", data)  # promote to Mongo when available
            return data
        return {}
    except Exception:
        return {}

def _save_users(users):
    if not isinstance(users, dict):
        return
    _kv_set("users", users)
    path = _users_path()
    try:
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(users, f, ensure_ascii=False, indent=0)
        os.replace(tmp, path)
    except Exception as e:
        print("file save users:", e)

def _hash_password(password: str) -> str:
    from werkzeug.security import generate_password_hash
    return generate_password_hash(password, method="scrypt")

def _check_password(password_hash: str, password: str) -> bool:
    from werkzeug.security import check_password_hash
    try:
        return check_password_hash(password_hash, password)
    except Exception:
        return False

def _reset_codes_path():
    return os.path.join(DATA_DIR, "reset_codes.json")

def _load_reset_codes():
    data = _kv_get("reset_codes")
    if isinstance(data, dict):
        return data
    path = _reset_codes_path()
    if not os.path.isfile(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            _kv_set("reset_codes", data)
            return data
        return {}
    except Exception:
        return {}

def _save_reset_codes(codes):
    if not isinstance(codes, dict):
        return
    _kv_set("reset_codes", codes)
    path = _reset_codes_path()
    try:
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(codes, f, ensure_ascii=False, indent=0)
        os.replace(tmp, path)
    except Exception as e:
        print("file save reset_codes:", e)

def _send_brevo_email(to_email: str, subject: str, html: str) -> bool:
    key = os.environ.get("BREVO_API_KEY") or ""
    if not key:
        return False
    mail_from = os.environ.get("MAIL_FROM") or "noreply@straticsoft.com"
    try:
        import urllib.request
        payload = json.dumps({
            "sender": {"email": mail_from, "name": "Aapka AI · Stratic Soft"},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html,
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://api.brevo.com/v3/smtp/email",
            data=payload,
            headers={
                "api-key": key,
                "Content-Type": "application/json",
                "accept": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            return 200 <= resp.status < 300
    except Exception as e:
        print("brevo send error:", e)
        return False




def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if current_user():
            return fn(*args, **kwargs)
        if request.path.startswith("/api/"):
            return jsonify({"error": "AUTH_REQUIRED", "login": "/login"}), 401
        nxt = request.full_path if request.query_string else request.path
        if nxt.endswith("?"):
            nxt = nxt[:-1]
        return redirect("/login?next=" + (nxt or "/"))
    return wrapper

def owner_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not current_user():
            if request.path.startswith("/api/"):
                return jsonify({"error": "AUTH_REQUIRED", "login": "/login"}), 401
            return redirect("/login?next=/owner")
        return fn(*args, **kwargs)
    return wrapper


def _verify_google_id_token(token: str):
    """Verify Google ID token. Returns profile dict or raises."""
    if not GOOGLE_CLIENT_ID:
        raise RuntimeError("GOOGLE_CLIENT_ID not set in environment")
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests
    info = google_id_token.verify_oauth2_token(
        token, google_requests.Request(), GOOGLE_CLIENT_ID
    )
    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise ValueError("Invalid issuer")
    email = (info.get("email") or "").strip().lower()
    if not email or not info.get("email_verified", True):
        raise ValueError("Email not verified")
    name = (info.get("name") or email.split("@")[0] or "User").strip()
    # Allow display name override from session profile edit
    return {
        "sub": info.get("sub"),
        "email": email,
        "name": name,
        "picture": info.get("picture") or "",  # stored but UI uses letter avatar only
        "given_name": info.get("given_name") or name.split()[0],
        "initial": (name[0] if name else email[0]).upper(),
        "login_at": iso(),
    }


@app.route("/login")
def page_login():
    if current_user():
        return redirect(request.args.get("next") or "/")
    return send_from_directory("public", "login.html")

@app.route("/api/auth/config")
def api_auth_config():
    return jsonify({
        "google_enabled": bool(GOOGLE_CLIENT_ID),
        "google_client_id": GOOGLE_CLIENT_ID or "",
        "email_password": True,
        "session_days": 30,
        "brevo_configured": bool(os.environ.get("BREVO_API_KEY")),
        "message": "Email/password + optional Google. Same email keeps your data.",
    })

@app.route("/api/auth/register", methods=["POST"])
def api_auth_register():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    name = (body.get("name") or body.get("display_name") or "").strip() or (email.split("@")[0] if email else "User")
    if not email or "@" not in email:
        return jsonify({"error": "EMAIL_REQUIRED", "message": "Valid email required"}), 400
    if len(password) < 6:
        return jsonify({"error": "WEAK_PASSWORD", "message": "Password at least 6 characters"}), 400
    with _USERS_LOCK:
        users = _load_users()
        if email in users:
            return jsonify({"error": "EXISTS", "message": "Account already exists — use Login"}), 409
        users[email] = {
            "email": email,
            "password_hash": _hash_password(password),
            "display_name": name[:60],
            "initial": (name[0] if name else email[0]).upper(),
            "created_at": iso(),
            "updated_at": iso(),
        }
        _save_users(users)
    session.permanent = True
    session["user"] = {
        "email": email,
        "display_name": name[:60],
        "name": name[:60],
        "initial": (name[0] if name else email[0]).upper(),
        "login_at": iso(),
        "auth": "password",
    }
    return jsonify({"ok": True, "user": session["user"]})

@app.route("/api/auth/login", methods=["POST"])
def api_auth_login():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    if not email or not password:
        return jsonify({"error": "MISSING", "message": "Email and password required"}), 400
    with _USERS_LOCK:
        users = _load_users()
        rec = users.get(email)
        if not rec or not _check_password(rec.get("password_hash") or "", password):
            return jsonify({"error": "INVALID", "message": "Wrong email or password"}), 401
        name = rec.get("display_name") or email.split("@")[0]
        session.permanent = True
        session["user"] = {
            "email": email,
            "display_name": name,
            "name": name,
            "initial": (name[0] if name else email[0]).upper(),
            "login_at": iso(),
            "auth": "password",
        }
        rec["last_login"] = iso()
        users[email] = rec
        _save_users(users)
    return jsonify({"ok": True, "user": session["user"]})

@app.route("/api/auth/forgot", methods=["POST"])
def api_auth_forgot():
    """Generate 6-digit code; email via Brevo if BREVO_API_KEY set, else pilot_code in JSON."""
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    if not email or "@" not in email:
        return jsonify({"error": "EMAIL_REQUIRED"}), 400
    with _USERS_LOCK:
        users = _load_users()
        if email not in users:
            return jsonify({"error": "NOT_FOUND", "message": "No account with this email. Sign up first."}), 404
        code = f"{secrets.randbelow(10**6):06d}"
        codes = _load_reset_codes()
        codes[email] = {"code": code, "expires": (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=10)).isoformat() + "Z"}
        _save_reset_codes(codes)
    html = f"<p>Stratic Soft — Aapka AI</p><p>Use this code to reset your password:</p><h2>{code}</h2><p>This code expires in 10 minutes. If you did not request it, ignore this email.</p>"
    sent = _send_brevo_email(email, "Reset your password - Aapka AI · Stratic Soft", html)
    out = {
        "ok": True,
        "message": "Verification code sent." if sent else "Verification code generated.",
        "emailed": sent,
    }
    if not sent:
        out["pilot_code"] = code
        out["note"] = "BREVO_API_KEY not set or send failed — code shown for pilot only."
    return jsonify(out)


@app.route("/api/auth/reset", methods=["POST"])
def api_auth_reset():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    code = (body.get("code") or "").strip()
    password = body.get("password") or ""
    if not email or not code or len(password) < 6:
        return jsonify({"error": "INVALID", "message": "Email, code, and new password (6+) required"}), 400
    with _USERS_LOCK:
        codes = _load_reset_codes()
        entry = codes.get(email)
        if not entry or entry.get("code") != code:
            return jsonify({"error": "BAD_CODE", "message": "Invalid or expired code"}), 400
        try:
            exp = entry.get("expires") or ""
            if exp and datetime.now(timezone.utc).replace(tzinfo=None) > datetime.fromisoformat(exp.replace("Z", "")):
                return jsonify({"error": "EXPIRED", "message": "Code expired — request a new one"}), 400
        except Exception:
            pass
        users = _load_users()
        if email not in users:
            return jsonify({"error": "NOT_FOUND"}), 404
        users[email]["password_hash"] = _hash_password(password)
        users[email]["updated_at"] = iso()
        _save_users(users)
        codes.pop(email, None)
        _save_reset_codes(codes)
    return jsonify({"ok": True, "message": "Password updated. You can login now."})


@app.route("/api/auth/google", methods=["POST"])
def api_auth_google():
    body = request.get_json(silent=True) or {}
    token = (body.get("credential") or body.get("id_token") or body.get("token") or "").strip()
    if not token:
        return jsonify({"error": "TOKEN_REQUIRED", "message": "Google credential missing"}), 400
    if not GOOGLE_CLIENT_ID:
        return jsonify({"error": "NOT_CONFIGURED", "message": "Set GOOGLE_CLIENT_ID in Render Environment"}), 503
    try:
        profile = _verify_google_id_token(token)
    except Exception as e:
        return jsonify({"error": "INVALID_TOKEN", "detail": str(e), "message": "Google verification failed"}), 401
    email = profile["email"]
    name = profile.get("name") or email.split("@")[0]
    with _USERS_LOCK:
        users = _load_users()
        if email not in users:
            users[email] = {
                "email": email,
                "password_hash": "",
                "display_name": name[:60],
                "initial": (name[0] if name else "U").upper(),
                "created_at": iso(),
                "updated_at": iso(),
                "auth_providers": ["google"],
            }
        else:
            users[email]["last_login"] = iso()
            if "google" not in (users[email].get("auth_providers") or []):
                users[email].setdefault("auth_providers", []).append("google")
        _save_users(users)
    session.permanent = True
    session["user"] = {
        "email": email,
        "display_name": users.get(email, {}).get("display_name") or name,
        "name": name,
        "initial": (name[0] if name else "U").upper(),
        "login_at": iso(),
        "auth": "google",
    }
    return jsonify({"ok": True, "user": session["user"]})


@app.route("/api/auth/me")
def api_auth_me():
    u = current_user()
    if not u:
        return jsonify({"logged_in": False, "user": None, "email_password": True})
    return jsonify({"logged_in": True, "user": u, "email_password": True})

@app.route("/api/auth/logout", methods=["POST"])
def api_auth_logout():
    session.pop("user", None)
    return jsonify({"ok": True})

@app.route("/api/auth/profile", methods=["PATCH"])
def api_auth_profile():
    u = current_user()
    if not u:
        return jsonify({"error": "AUTH_REQUIRED"}), 401
    body = request.get_json(silent=True) or {}
    name = (body.get("display_name") or body.get("name") or "").strip()[:60]
    if not name:
        return jsonify({"error": "NAME_REQUIRED"}), 400
    u["display_name"] = name
    u["name"] = name
    u["initial"] = name[0].upper()
    session["user"] = u
    email = (u.get("email") or "").lower()
    if email:
        with _USERS_LOCK:
            users = _load_users()
            if email in users:
                users[email]["display_name"] = name
                users[email]["updated_at"] = iso()
                _save_users(users)
    return jsonify({"ok": True, "user": u})



@app.route("/")
def root():
    return send_from_directory("public", "admin.html")

@app.route("/admin")
def page_admin():
    return send_from_directory("public", "admin.html")

@app.route("/customer")
def page_customer():
    return send_from_directory("public", "customer.html")

@app.route("/employee")
def page_employee():
    return send_from_directory("public", "employee.html")

@app.route("/ceo")
def page_ceo():
    return send_from_directory("public", "ceo.html")

@app.route("/integrations")
def page_integrations():
    return send_from_directory("public", "admin.html")


# Unique per-company URLs: /w/<company_id>/...  (WhatsApp-style isolation)
@app.route("/w/<wid>/")
@app.route("/w/<wid>")
def page_company_console(wid):
    """Company Tool link — open on click, no login. Isolation by workspace id."""
    if not is_known_workspace(wid):
        return ("Invalid or expired company link.", 404)
    return send_from_directory("public", "admin.html")

@app.route("/w/<wid>/customer")
def page_company_customer(wid):
    """Customer portal — NO login. Customers only use Help → this link."""
    if not is_known_workspace(wid):
        return ("Invalid or expired customer link.", 404)
    return send_from_directory("public", "customer.html")

@app.route("/w/<wid>/admin")
def page_company_admin(wid):
    if not is_known_workspace(wid):
        return ("Invalid or expired company link.", 404)
    return send_from_directory("public", "admin.html")

@app.route("/w/<wid>/employee")
def page_company_employee(wid):
    if not is_known_workspace(wid):
        return ("Invalid or expired company link.", 404)
    return send_from_directory("public", "employee.html")

@app.route("/w/<wid>/ceo")
def page_company_ceo(wid):
    if not is_known_workspace(wid):
        return ("Invalid or expired company link.", 404)
    return send_from_directory("public", "ceo.html")


@app.route("/api/company/create", methods=["POST"])
def api_company_create():
    """Create a new isolated company workspace. Returns unique Tool link + Customer link.
    Call this once per company you sell to — never reuse the same links for two companies.
    """
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or body.get("company_name") or "Company").strip()[:80]
    if not name:
        return jsonify({"error": "NAME_REQUIRED"}), 400
    # STABLE id from company name: same name → same links forever (Microsoft → always same wid)
    # So after redeploy + disk restore, Create "Microsoft" again returns SAME links + SAME data.
    slug = "".join(c if c.isalnum() else "" for c in name.lower())[:16] or "co"
    digest = hashlib.sha256(name.strip().lower().encode("utf-8")).hexdigest()[:10]
    wid = f"{slug}_{digest}"
    wid = "".join(c if c.isalnum() or c in "-_" else "_" for c in wid)[:64]

    base = request.host_url.rstrip("/")
    if request.headers.get("X-Forwarded-Host"):
        proto = request.headers.get("X-Forwarded-Proto", "https")
        base = f"{proto}://{request.headers.get('X-Forwarded-Host')}".rstrip("/")

    tool_link = f"{base}/w/{wid}"
    customer_link = f"{base}/w/{wid}/customer"
    existed = os.path.isfile(_ws_file(wid))

    with _ws_runtime_lock:
        prev = _ws_active.get("id")
        if prev and prev != wid:
            try:
                save_workspace(prev)
            except Exception:
                pass
        if existed:
            # Restore existing company — do NOT wipe data
            try:
                load_workspace(wid)
            except Exception:
                pass
            DB["tenant"]["name"] = name
            DB["tenant"]["tenant_id"] = wid
            save_workspace(wid)
        else:
            _seed_fresh_workspace_memory(wid)
            DB["tenant"]["name"] = name
            DB["tenant"]["tenant_id"] = wid
            DB["tenant"]["created_at"] = iso()
            ensure_tenant_bootstrap()
            save_workspace(wid)
        _ws_active["id"] = wid
        g.workspace = wid

    try:
        _registry_upsert(wid, name, tool_link, customer_link)
    except Exception as e:
        print("registry upsert error:", e)
    return jsonify({
        "ok": True,
        "company_name": name,
        "workspace_id": wid,
        "tool_link": tool_link,
        "customer_link": customer_link,
        "restored": existed,
        "note": "Same company name always yields the SAME two links. Data is per workspace file — use Render Disk (AAPKA_DATA=/var/data) so data survives redeploy.",
        "isolation": "file-per-workspace",
    }), 200 if existed else 201




@app.route("/api/company/list")
def api_company_list():
    """Owner: list companies. Links remain until explicitly deleted via /api/company/delete."""
    base = request.host_url.rstrip("/")
    if request.headers.get("X-Forwarded-Host"):
        proto = request.headers.get("X-Forwarded-Proto", "https")
        base = f"{proto}://{request.headers.get('X-Forwarded-Host')}".rstrip("/")
    by_id = {}
    # From disk files
    try:
        for row in _kv_list_prefix("workspace:"):
            key = row.get("key") or ""
            wid = key.replace("workspace:", "", 1)
            if not wid or wid == "default":
                continue
            val = row.get("value") or {}
            name = (val.get("tenant") or {}).get("name") or wid
            by_id[wid] = {
                "workspace_id": wid,
                "name": name,
                "tool_link": f"{base}/w/{wid}",
                "customer_link": f"{base}/w/{wid}/customer",
                "deleted": False,
                "source": "postgres",
            }
    except Exception as e:
        print("pg list workspaces:", e)
    try:
        for fn in sorted(os.listdir(DATA_DIR)):
            if not (fn.startswith("workspace_") and fn.endswith(".json")):
                continue
            wid = fn[len("workspace_"):-len(".json")]
            if wid == "default":
                continue
            name = wid
            try:
                with open(os.path.join(DATA_DIR, fn), "r", encoding="utf-8") as f:
                    data = json.load(f)
                name = (data.get("tenant") or {}).get("name") or wid
            except Exception:
                pass
            by_id[wid] = {
                "workspace_id": wid,
                "company_name": name,
                "tool_link": f"{base}/w/{wid}",
                "customer_link": f"{base}/w/{wid}/customer",
                "deleted": False,
                "source": "file",
            }
    except Exception as e:
        print("list scan error:", e)
    # Merge registry (survives if index file is on persistent disk)
    try:
        for c in _registry_load().get("companies", []):
            wid = c.get("workspace_id")
            if not wid or wid == "default":
                continue
            if c.get("deleted"):
                by_id.pop(wid, None)
                continue
            if wid not in by_id:
                by_id[wid] = {
                    "workspace_id": wid,
                    "company_name": c.get("company_name") or wid,
                    "tool_link": c.get("tool_link") or f"{base}/w/{wid}",
                    "customer_link": c.get("customer_link") or f"{base}/w/{wid}/customer",
                    "deleted": False,
                    "source": "registry",
                }
            else:
                by_id[wid]["company_name"] = c.get("company_name") or by_id[wid]["company_name"]
    except Exception as e:
        print("registry merge error:", e)
    companies = sorted(by_id.values(), key=lambda x: x.get("company_name") or "")
    return jsonify({
        "ok": True,
        "count": len(companies),
        "companies": companies,
        "data_dir": DATA_DIR,
        "persistence_hint": "Set Render Persistent Disk + env AAPKA_DATA=/var/data so links survive redeploy.",
    })


@app.route("/api/company/delete", methods=["POST"])
def api_company_delete():
    """Owner only: permanently delete a company workspace ONLY when Sahil confirms.
    Links stay forever until this is called."""
    body = request.get_json(silent=True) or {}
    wid = (body.get("workspace_id") or "").strip()
    confirm = (body.get("confirm") or "").strip().upper()
    if not wid or wid == "default":
        return jsonify({"error": "INVALID_WORKSPACE"}), 400
    if confirm != "DELETE":
        return jsonify({"error": "Type confirm=DELETE to permanently remove"}), 400
    path = _ws_file(wid)
    removed_file = False
    with _ws_runtime_lock:
        if os.path.isfile(path):
            try:
                os.remove(path)
                removed_file = True
            except Exception as e:
                return jsonify({"error": str(e)}), 500
        _registry_mark_deleted(wid)
        if _ws_active.get("id") == wid:
            _ws_active["id"] = "default"
            load_workspace("default")
    return jsonify({
        "ok": True,
        "workspace_id": wid,
        "file_removed": removed_file,
        "message": "Company links deleted permanently. They will not return after redeploy either.",
    })


@app.route("/owner")
def page_owner():
    """Sahil private panel — create company Tool + Customer link pairs in 2 clicks."""
    return send_from_directory("public", "owner.html")

@app.route("/api/company/me")
def api_company_me():
    ensure_tenant_bootstrap()
    wid = workspace_id()
    base = request.host_url.rstrip("/")
    if request.headers.get("X-Forwarded-Host"):
        proto = request.headers.get("X-Forwarded-Proto", "https")
        base = f"{proto}://{request.headers.get('X-Forwarded-Host')}".rstrip("/")
    return jsonify({
        "workspace_id": wid,
        "tenant": DB.get("tenant"),
        "tool_link": f"{base}/w/{wid}",
        "customer_link": f"{base}/w/{wid}/customer",
        "isolation": "This workspace file is separate from every other company.",
    })


# ---------- API ----------
@app.route("/api/chat", methods=["POST"])
def api_chat():
    """Customer + tool share same workspace via X-Workspace-Id / ?workspace= / /w/ID path."""
    ensure_tenant_bootstrap()
    d = request.get_json(silent=True) or {}
    cid = (d.get("customer_id") or d.get("customerId") or "CUST001").strip() or "CUST001"
    msg = (d.get("message") or d.get("text") or "").strip()
    result = process_chat(msg, cid)
    try:
        touch_save()
    except Exception as e:
        print("chat save:", e)
    # Always return workspace id so UI can confirm isolation
    if isinstance(result, dict):
        result["workspace_id"] = workspace_id()
    return jsonify(result)


@app.route("/api/customer/<cid>")
def api_customer(cid):
    if not DB["isSubscriptionActive"]:
        return jsonify(lockout()), 403
    c = DB["customers"].get(cid)
    if not c:
        return jsonify({"error": "not found"}), 404
    return jsonify({"customer": c, "orders": orders_of(cid)})


@app.route("/api/cases")
def api_cases():
    ensure_tenant_bootstrap()
    if not DB["isSubscriptionActive"]:
        return jsonify(lockout()), 403
    cases = sorted(DB["cases"].values(), key=lambda x: x.get("created", "") or x.get("resolved_at", ""), reverse=True)
    notifs = [n for n in DB["notifications"] if not n.get("read")]
    return jsonify({
        "cases": cases,
        "notifications": notifs,
        "workspace_id": workspace_id(),
        "refund_cases": [c for c in cases if c.get("type") == "refund"],
        "open_cases": [c for c in cases if c.get("status") != "Resolved"],
    })


@app.route("/api/cases/<case_id>")
def api_case(case_id):
    if not DB["isSubscriptionActive"]:
        return jsonify(lockout()), 403
    case = DB["cases"].get(case_id)
    if not case:
        return jsonify({"error": "not found"}), 404
    return jsonify(case)


@app.route("/api/cases/<case_id>/action", methods=["POST"])
def api_action(case_id):
    if not DB["isSubscriptionActive"]:
        return jsonify(lockout()), 403
    case = DB["cases"].get(case_id)
    if not case:
        return jsonify({"error": "not found"}), 404
    aid = int((request.get_json() or {}).get("action_id", 0))
    action = next((a for a in case.get("actions", []) if a["id"] == aid), None)
    if not action:
        return jsonify({"error": "invalid action"}), 400

    msg = ""
    if aid == 1:
        case["history"].append({"time": ts_short(), "event": "DB Hard-Reset & Resync executed"})
        msg = "Customer resynced across Salesforce, Zendesk, OrderDB."
        add_hours(10)
    elif aid == 2:
        case["history"].append({"time": ts_short(), "event": "Escalated to Slack/Teams"})
        fire_webhooks("PRIORITY_ESCALATION", {"case_id": case_id, "customer": case["customerName"]})
        msg = "Alert pushed to #customer-critical."
        add_hours(5)
    elif aid == 3:
        code = f"GOODWILL-{secrets.token_hex(4).upper()}"
        DB["vouchers"].append({"code": code, "customerId": case["customerId"], "amount": 20, "created": iso()})
        case["history"].append({"time": ts_short(), "event": f"Voucher {code} issued ($20)"})
        msg = f"Voucher issued: {code} ($20 / Rs.1,600)."
        add_hours(8)
        if case.get("tier") == "Premium":
            DB["metrics"]["vip_churn_stopped"] += 1
    elif aid == 4:
        case["history"].append({"time": ts_short(), "event": "Support ticket created in helpdesk"})
        DB["metrics"]["tickets_created"] += 1
        msg = "Formal ticket created in connected helpdesk path."
        add_hours(6)

    case["status"] = "In Progress"
    DB["agent_stats"]["Agent-01"]["resolved"] += 1
    DB["agent_stats"]["Agent-01"]["actions"] += 1
    log_activity("Agent-01", f"action_{aid}", case_id)
    log_event("action_executed", f"{case_id} action {aid}", case.get("customerId"))
    return jsonify({"success": True, "message": msg, "case": case})


@app.route("/api/notifications/read", methods=["POST"])
def api_notif_read():
    for n in DB["notifications"]:
        n["read"] = True
    return jsonify({"ok": True})


@app.route("/api/ceo/metrics")
def api_ceo():
    open_c = len([c for c in DB["cases"].values() if c.get("status") != "Resolved"])
    hours = DB["metrics"]["human_hours_saved"]
    autos = DB["metrics"]["total_automations"]
    proj_h = max(hours * 4, autos * 0.25 * 4)
    return jsonify({
        "isSubscriptionActive": DB["isSubscriptionActive"],
        "softLock": DB["softLock"],
        "metrics": DB["metrics"],
        "connectedSystems": DB["connected_systems"],
        "openCases": open_c,
        "totalCases": len(DB["cases"]),
        "totalReceipts": len(DB["receipts"]),
        "totalVouchers": len(DB["vouchers"]),
        "plan": DB["plan"],
        "cancelImpact": {
            "extraHoursNextMonth": round(proj_h, 1),
            "extraCostUsd": round(proj_h * 25, 0),
            "queueHours": 4.5,
        },
        "employeeDependency": {
            "message": "Without Aapka AI, average handling time returns to 20–30 min per complex case.",
            "withToolMinutes": 0.5,
            "withoutToolMinutes": 25,
        },
        "agentStats": DB["agent_stats"],
        "activityLog": DB["activity_log"][-15:],
        "monthlyReport": {
            "hoursSaved": hours,
            "valueUsd": DB["metrics"]["salary_leak_prevented"],
            "ifCancelExtraUsd": round(proj_h * 25, 0),
        },
    })


@app.route("/api/ceo/toggle-subscription", methods=["POST"])
def api_toggle():
    data = request.get_json() or {}
    active = bool(data.get("active", True))
    DB["isSubscriptionActive"] = active
    touch_save()
    security_audit("SUBSCRIPTION_TOGGLED", "SUCCESS" if active else "LOCKED", "subscription", "ceo", {"active": active})
    DB["softLock"] = False
    if not active:
        log_activity("CEO", "subscription_deactivated")
        return jsonify({
            "success": True, "isSubscriptionActive": False,
            "warning": "DEACTIVATED. Portals locked. Queue → 4.5 hrs. Reinstatement $1,200/mo. Employees will escalate to leadership.",
        })
    log_activity("CEO", "subscription_reactivated")
    touch_save()
    return jsonify({"success": True, "isSubscriptionActive": True, "message": "REACTIVATED. All pipelines online."})


@app.route("/api/ceo/soft-lock", methods=["POST"])
def api_soft_lock():
    data = request.get_json() or {}
    DB["softLock"] = bool(data.get("enabled", True))
    return jsonify({"success": True, "softLock": DB["softLock"]})


@app.route("/api/integrations/status")
def api_integ_status():
    i = DB["integrations"]
    return jsonify({
        "salesforce": {"connected": i["salesforce"]["connected"], "health": i["salesforce"].get("health", "unknown")},
        "zendesk": {"connected": i["zendesk"]["connected"], "health": i["zendesk"].get("health", "unknown")},
        "payment": {"connected": i["payment"]["connected"], "health": i["payment"].get("health", "unknown"), "mode": i["payment"].get("mode")},
    })



def _http_json(url, method="GET", headers=None, data=None, timeout=12, auth=None):
    """Outbound HTTPS call with clear errors. Used for real provider verification."""
    import urllib.request
    import urllib.error
    import base64
    headers = dict(headers or {})
    headers.setdefault("User-Agent", "AapkaAI-Connect/7.1")
    body = None
    if data is not None:
        body = data if isinstance(data, (bytes, bytearray)) else data.encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    if auth:
        user, pwd = auth
        token = base64.b64encode(f"{user}:{pwd}".encode()).decode()
        req.add_header("Authorization", f"Basic {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            code = getattr(resp, "status", 200)
            return {"ok": 200 <= int(code) < 300, "status": int(code), "body": raw[:2000], "error": None}
    except urllib.error.HTTPError as e:
        try:
            b = e.read().decode("utf-8", errors="replace")[:800]
        except Exception:
            b = ""
        return {"ok": False, "status": int(e.code), "body": b, "error": f"HTTP {e.code}"}
    except Exception as e:
        return {"ok": False, "status": 0, "body": "", "error": str(e)[:300]}


def verify_zendesk(subdomain, email, api_token):
    sub = (subdomain or "").replace("https://", "").replace("http://", "").replace(".zendesk.com", "").strip().strip("/").split("/")[0]
    if not sub or not email or not api_token:
        return False, "Missing Zendesk subdomain / email / api_token"
    urls = [
        f"https://{sub}.zendesk.com/api/v2/users/me.json",
        f"https://{sub}.zendesk.com/api/v2/tickets.json?per_page=1",
    ]
    last = ""
    for url in urls:
        r = _http_json(url, auth=(f"{email}/token", api_token), timeout=15)
        if r["ok"]:
            return True, "Zendesk API accepted credentials."
        last = r["error"] or f"HTTP {r['status']}: {(r.get('body') or '')[:100]}"
        if r["status"] in (401, 403):
            return False, last
        # retry once on network
        r2 = _http_json(url, auth=(f"{email}/token", api_token), timeout=15)
        if r2["ok"]:
            return True, "Zendesk API accepted credentials (retry)."
        last = r2["error"] or last
    return False, last or "Zendesk rejected credentials"


def verify_razorpay(key_id, key_secret):
    url = "https://api.razorpay.com/v1/payments?count=1"
    r = _http_json(url, auth=(key_id, key_secret))
    if r["ok"] or r["status"] == 200:
        return True, "Razorpay API accepted keys."
    # 400 with auth still means auth worked sometimes; 401 is bad keys
    if r["status"] == 401:
        return False, "Razorpay: invalid key_id/key_secret (HTTP 401)."
    if r["status"] in (200, 400):
        return True, f"Razorpay auth OK (HTTP {r['status']})."
    return False, r["error"] or f"Razorpay HTTP {r['status']}: {r['body'][:120]}"


def verify_stripe(secret_key):
    url = "https://api.stripe.com/v1/balance"
    r = _http_json(url, auth=(secret_key, ""))
    if r["ok"]:
        return True, "Stripe secret key accepted (balance)."
    return False, r["error"] or f"Stripe HTTP {r['status']}: {r['body'][:120]}"


def _normalize_sf_host(instance_url):
    base = (instance_url or "").strip().rstrip("/")
    if not base:
        return ""
    if not base.startswith("http"):
        base = "https://" + base
    # common aliases → canonical host
    low = base.lower()
    aliases = {
        "https://login.salesforce.com": "https://login.salesforce.com",
        "https://test.salesforce.com": "https://test.salesforce.com",
        "https://salesforce.com": "https://login.salesforce.com",
    }
    for a, v in aliases.items():
        if low.rstrip("/") == a:
            return v
    return base


def verify_salesforce_password_flow(instance_url, client_id, client_secret, username=None, password=None):
    """Live Salesforce verify: password grant on instance + login/test hosts. Wrong keys = fail. Right keys = CONNECTED."""
    import urllib.parse
    base = _normalize_sf_host(instance_url)
    if not base:
        return False, "Missing Salesforce instance_url"
    hosts = [base]
    for h in ("https://login.salesforce.com", "https://test.salesforce.com"):
        if h not in hosts:
            hosts.append(h)
    # client_credentials style probe (some connected apps)
    if username and password:
        form = urllib.parse.urlencode({
            "grant_type": "password",
            "client_id": client_id,
            "client_secret": client_secret,
            "username": username,
            "password": password,
        }).encode()
        last_err = ""
        for host in hosts:
            token_url = f"{host}/services/oauth2/token"
            r = _http_json(token_url, method="POST", headers={"Content-Type": "application/x-www-form-urlencoded"}, data=form, timeout=15)
            if r["ok"] and "access_token" in (r.get("body") or ""):
                return True, f"Salesforce access_token OK via {host}"
            last_err = r["error"] or f"HTTP {r['status']}: {(r.get('body') or '')[:120]}"
            if r["status"] in (400, 401):
                continue  # try next host
        return False, last_err or "Salesforce rejected credentials"
    # No user/pass: try client credentials if supported; else reachability + configured
    form2 = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
    }).encode()
    for host in hosts:
        token_url = f"{host}/services/oauth2/token"
        r = _http_json(token_url, method="POST", headers={"Content-Type": "application/x-www-form-urlencoded"}, data=form2, timeout=15)
        if r["ok"] and "access_token" in (r.get("body") or ""):
            return True, f"Salesforce client_credentials OK via {host}"
    ping = _http_json(base, timeout=8)
    if ping.get("status") and ping["status"] < 500:
        return None, "Salesforce host reachable. Add username+password (with security token) for full CONNECTED, or complete OAuth. App credentials stored."
    return False, ping.get("error") or "Salesforce instance unreachable."



@app.route("/api/integrations/connect", methods=["POST"])
def api_integ_connect():
    """
    Powerful connect: normalize inputs, optional live verify, store secrets server-side only.
    Status CONNECTED only when provider accepts credentials (or partial for SF OAuth app).
    """
    data = request.get_json() or {}
    system = (data.get("system") or "").lower().strip()
    live = data.get("live_verify", True)  # default try real provider

    if system == "salesforce":
        inst = (data.get("instance_url") or "").strip().rstrip("/")
        cid = (data.get("client_id") or "").strip()
        csec = (data.get("client_secret") or "").strip()
        if not all([inst, cid, csec]):
            return jsonify({"success": False, "error": "Fill instance_url, client_id, client_secret"}), 400
        if not inst.startswith("http"):
            inst = "https://" + inst
        ver = None
        msg = "Credentials stored."
        if live:
            ver, msg = verify_salesforce_password_flow(inst, cid, csec, data.get("username"), data.get("password"))
        connected = ver is True
        partial = ver is None
        DB["integrations"]["salesforce"] = {
            "connected": connected or partial,
            "instance_url": inst,
            "client_id": cid,
            "client_secret": csec,
            "username": (data.get("username") or ""),
            "connected_at": iso(),
            "last_test": iso() if live else None,
            "health": "connected" if connected else ("configured" if partial else "auth_failed"),
            "last_message": msg,
        }
        DB["connected_systems"]["Salesforce"] = "CONNECTED" if connected else ("CONFIGURED" if partial else "AUTH_FAILED")
        touch_save()
        security_audit("INTEGRATION_CREDENTIALS_CHANGED", "SUCCESS" if (connected or partial) else "FAILURE", "salesforce", "admin")
        log_activity("admin", "connect_salesforce")
        return jsonify({
            "success": connected or partial,
            "connected": connected,
            "partial": partial,
            "status": DB["connected_systems"]["Salesforce"],
            "message": msg,
        }), (200 if (connected or partial) else 401)

    if system == "zendesk":
        sub = (data.get("subdomain") or "").strip()
        email = (data.get("email") or "").strip()
        token = (data.get("api_token") or "").strip()
        if not all([sub, email, token]):
            return jsonify({"success": False, "error": "Fill subdomain, email, api_token"}), 400
        sub = sub.replace("https://", "").replace("http://", "").replace(".zendesk.com", "").split("/")[0]
        ok, msg = (False, "Skipped live verify")
        if live:
            ok, msg = verify_zendesk(sub, email, token)
            # up to 2 retries on network blip (higher connect success on flaky net)
            if not ok and "HTTP" not in (msg or "") and "401" not in (msg or "") and "403" not in (msg or ""):
                ok, msg = verify_zendesk(sub, email, token)
        DB["integrations"]["zendesk"] = {
            "connected": ok,
            "subdomain": sub,
            "email": email,
            "api_token": token,
            "connected_at": iso() if ok else None,
            "last_test": iso(),
            "health": "connected" if ok else "auth_failed",
            "last_message": msg,
        }
        DB["connected_systems"]["Zendesk"] = "CONNECTED" if ok else "AUTH_FAILED"
        touch_save()
        security_audit("INTEGRATION_CREDENTIALS_CHANGED", "SUCCESS" if ok else "FAILURE", "zendesk", "admin")
        log_activity("admin", "connect_zendesk")
        return jsonify({"success": ok, "connected": ok, "status": DB["connected_systems"]["Zendesk"], "message": msg}), (200 if ok else 401)

    if system == "payment":
        key_id = (data.get("key_id") or data.get("publishable_key") or "").strip()
        key_secret = (data.get("key_secret") or data.get("secret_key") or "").strip()
        provider = (data.get("provider") or "").lower().strip()
        mode = (data.get("mode") or "test").lower().strip()
        # Auto-detect provider from key shape (higher connect success when company pastes raw keys)
        if key_secret.startswith("sk_"):
            provider = "stripe"
        elif key_id.startswith("rzp_") or provider in ("", "razorpay", "auto"):
            provider = "razorpay"
        if not provider:
            provider = "razorpay"
        if key_id.startswith("rzp_test_") or key_secret.startswith("sk_test_"):
            mode = "test"
        if key_id.startswith("rzp_live_") or key_secret.startswith("sk_live_"):
            mode = "live"
        if not all([key_id, key_secret]):
            return jsonify({"success": False, "error": "Fill key_id and key_secret (or Stripe secret key in key_secret)"}), 400
        ok, msg = False, "Skipped live verify"
        if live:
            if provider == "stripe":
                ok, msg = verify_stripe(key_secret)
            else:
                ok, msg = verify_razorpay(key_id, key_secret)
            if not ok and "401" not in (msg or ""):
                # up to 2 retries for transient network errors
                if provider == "stripe":
                    ok, msg = verify_stripe(key_secret)
                else:
                    ok, msg = verify_razorpay(key_id, key_secret)
        DB["integrations"]["payment"] = {
            "connected": ok,
            "provider": provider,
            "mode": mode,
            "key_id": key_id,
            "key_secret": key_secret,
            "connected_at": iso() if ok else None,
            "last_test": iso(),
            "health": "connected" if ok else "auth_failed",
            "last_message": msg,
        }
        DB["connected_systems"]["Payment"] = "CONNECTED" if ok else "AUTH_FAILED"
        touch_save()
        security_audit("INTEGRATION_CREDENTIALS_CHANGED", "SUCCESS" if ok else "FAILURE", "payment", "admin")
        log_activity("admin", "connect_payment")
        return jsonify({
            "success": ok,
            "connected": ok,
            "status": DB["connected_systems"]["Payment"],
            "message": msg + " Money never leaves your merchant account via Aapka AI.",
            "provider": provider,
            "mode": mode,
        }), (200 if ok else 401)

    
    if system == "slack":
        url = (data.get("webhook_url") or data.get("url") or "").strip()
        if not url.startswith("https://hooks.slack.com/"):
            return jsonify({"success": False, "error": "Slack webhook must start with https://hooks.slack.com/"}), 400
        ok, msg = False, "Skipped"
        if live:
            r = _http_json(url, method="POST", headers={"Content-Type": "application/json"},
                           data=b'{"text":"Aapka AI connect test - safe to ignore"}', timeout=12)
            ok = r["ok"] or r["status"] in (200, 201)
            msg = "Slack webhook accepted." if ok else (r["error"] or f"HTTP {r['status']}")
        DB.setdefault("integrations", {})["slack"] = {
            "connected": ok, "webhook_url": url, "connected_at": iso() if ok else None,
            "last_test": iso(), "health": "connected" if ok else "auth_failed", "last_message": msg,
        }
        DB["connected_systems"]["Slack"] = "CONNECTED" if ok else "AUTH_FAILED"
        touch_save()
        return jsonify({"success": ok, "connected": ok, "message": msg}), (200 if ok else 401)

    return jsonify({"success": False, "error": "Unknown system. Use salesforce | zendesk | payment"}), 400


@app.route("/api/integrations/test", methods=["POST"])
def api_integ_test():
    """Re-run live verification on stored credentials."""
    data = request.get_json() or {}
    system = (data.get("system") or "").lower()
    integ = DB["integrations"].get(system)
    if not integ:
        return jsonify({"success": False, "error": "Unknown system"}), 400
    if system == "zendesk":
        if not integ.get("api_token"):
            return jsonify({"success": False, "status": "Authentication Failed", "message": "No token stored"}), 400
        ok, msg = verify_zendesk(integ.get("subdomain", ""), integ.get("email", ""), integ.get("api_token", ""))
        integ["connected"] = ok
        integ["health"] = "connected" if ok else "auth_failed"
        integ["last_test"] = iso()
        integ["last_message"] = msg
        DB["connected_systems"]["Zendesk"] = "CONNECTED" if ok else "AUTH_FAILED"
        touch_save()
        return jsonify({"success": ok, "status": DB["connected_systems"]["Zendesk"], "message": msg})
    if system == "payment":
        if not integ.get("key_secret"):
            return jsonify({"success": False, "status": "Authentication Failed", "message": "No keys stored"}), 400
        if (integ.get("provider") or "") == "stripe" or str(integ.get("key_secret", "")).startswith("sk_"):
            ok, msg = verify_stripe(integ["key_secret"])
        else:
            ok, msg = verify_razorpay(integ.get("key_id", ""), integ.get("key_secret", ""))
        integ["connected"] = ok
        integ["health"] = "connected" if ok else "auth_failed"
        integ["last_test"] = iso()
        integ["last_message"] = msg
        DB["connected_systems"]["Payment"] = "CONNECTED" if ok else "AUTH_FAILED"
        touch_save()
        return jsonify({"success": ok, "status": DB["connected_systems"]["Payment"], "message": msg})
    if system == "salesforce":
        ver, msg = verify_salesforce_password_flow(
            integ.get("instance_url", ""), integ.get("client_id", ""), integ.get("client_secret", ""),
            integ.get("username"), data.get("password") or None,
        )
        ok = ver is True
        partial = ver is None
        integ["connected"] = ok or partial
        integ["health"] = "connected" if ok else ("configured" if partial else "auth_failed")
        integ["last_test"] = iso()
        integ["last_message"] = msg
        DB["connected_systems"]["Salesforce"] = "CONNECTED" if ok else ("CONFIGURED" if partial else "AUTH_FAILED")
        touch_save()
        return jsonify({"success": ok or partial, "status": DB["connected_systems"]["Salesforce"], "message": msg})
    return jsonify({"success": False, "error": "Unknown system"}), 400


@app.route("/api/integrations/disconnect", methods=["POST"])
def api_integ_disconnect():
    data = request.get_json() or {}
    system = (data.get("system") or "").lower()
    if system not in DB["integrations"]:
        return jsonify({"success": False, "error": "Unknown"}), 400
    for k in list(DB["integrations"][system].keys()):
        if k in ("connected", "health"):
            continue
        if isinstance(DB["integrations"][system].get(k), str):
            DB["integrations"][system][k] = ""
    DB["integrations"][system]["connected"] = False
    DB["integrations"][system]["health"] = "unknown"
    label = {"salesforce": "Salesforce", "zendesk": "Zendesk", "payment": "Payment"}.get(system, system)
    if label in DB["connected_systems"]:
        DB["connected_systems"][label] = "NOT CONNECTED"
    touch_save()
    return jsonify({"success": True, "message": f"{label} disconnected."})


@app.route("/api/export/audit")
def api_export_audit():
    """Real export of audit trail from this system (receipts, events, actions)."""
    if not DB["isSubscriptionActive"]:
        return jsonify(lockout()), 403
    payload = {
        "exported_at": iso(),
        "receipts": DB["receipts"][-50:],
        "event_log": DB["event_log"][-50:],
        "activity_log": DB["activity_log"][-50:],
        "webhook_log": DB["webhook_log"][-20:],
        "metrics_snapshot": DB["metrics"],
    }
    return jsonify(payload)


@app.route("/api/enterprise/benefits")
def api_benefits():
    """Honest benefit list for executive pitch — tied to real working features."""
    m = DB["metrics"]
    return jsonify({
        "benefits": [
            {"title": "Sub-second refund path", "detail": "Agent no longer opens 5 tabs; status mutates in one action with receipt hash."},
            {"title": "1-click complex resolution", "detail": "Summary + history + 4 actions ready; minutes become seconds."},
            {"title": "VIP priority routing", "detail": "Premium tier auto-detected and prioritized."},
            {"title": "Cryptographic audit trail", "detail": "Every refund has receipt ID + SHA-256 for compliance."},
            {"title": "Cross-team alerts", "detail": "Sales + Tech get event payloads on escalations."},
            {"title": "Cancel = operational pain", "detail": "Lockout restores 4.5hr queues and removes context — switching cost is real."},
            {"title": "Live ROI board", "detail": "Hours saved and $ value update on every automation."},
            {"title": "BYO credentials", "detail": "Company keeps keys; tool is connector layer only."},
        ],
        "live_stats": m,
        "note": "Demo customers are samples until CRM is connected. Connect stores your keys and validates format; live Salesforce/Razorpay HTTP can be enabled once you provide test keys.",
    })



@app.route("/api/console/snapshot")
def api_console_snapshot():
    """Single real payload for Enterprise Console — all modules read live data."""
    customers = list(DB["customers"].values())
    orders = list(DB["orders"].values())
    cases = sorted(DB["cases"].values(), key=lambda x: x.get("created", ""), reverse=True)
    premium = [c for c in customers if c.get("tier") == "Premium"]
    paid = [o for o in orders if o.get("PaymentStatus") == "Paid"]
    refunded = [o for o in orders if o.get("PaymentStatus") == "Refunded"]
    open_cases = [c for c in cases if c.get("status") != "Resolved"]
    hours = DB["metrics"]["human_hours_saved"]
    autos = DB["metrics"]["total_automations"]
    proj_h = max(hours * 4, autos * 0.25 * 4)
    return jsonify({
        "isSubscriptionActive": DB["isSubscriptionActive"],
        "softLock": DB.get("softLock", False),
        "openCasesCount": len(open_cases),
        "totalCasesCount": len(cases),
        "metrics": DB["metrics"],
        "connectedSystems": DB["connected_systems"],
        "integrations": {
            k: {
                "connected": v.get("connected"),
                "health": v.get("health"),
                "mode": v.get("mode"),
                "provider": v.get("provider"),
                "connected_at": v.get("connected_at"),
                "last_test": v.get("last_test"),
            }
            for k, v in DB["integrations"].items()
        },
        "customers": customers,
        "orders": orders,
        "ordersPaid": paid,
        "ordersRefunded": refunded,
        "premiumCustomers": premium,
        "cases": cases,
        "openCases": open_cases,
        "notifications": [n for n in DB["notifications"] if not n.get("read")],
        "receipts": DB["receipts"][-30:],
        "vouchers": DB["vouchers"][-30:],
        "event_log": DB["event_log"][-40:],
        "webhook_log": DB["webhook_log"][-30:],
        "activity_log": DB["activity_log"][-40:],
        "agent_stats": DB["agent_stats"],
        "plan": DB["plan"],
        "cancelImpact": {
            "extraHoursNextMonth": round(proj_h, 1),
            "extraCostUsd": round(proj_h * 25, 0),
            "queueHours": 4.5,
        },
        "employeeDependency": {
            "withToolMinutes": 0.5,
            "withoutToolMinutes": 25,
            "message": "Without Aapka AI, average handling time returns to 20–30 min per complex case.",
        },
        "automationRules": [
            {"id": "R1", "trigger": "refund keywords", "action": "PaymentStatus Paid→Refunded + crypto receipt", "active": True},
            {"id": "R2", "trigger": "complex/escalate keywords", "action": "Create case + employee notify + 4 autopilot actions", "active": True},
            {"id": "R3", "trigger": "Premium tier", "action": "PRIORITY prefix + Critical queue", "active": True},
            {"id": "R4", "trigger": "any automation", "action": "Add hours saved + ROI counters", "active": True},
            {"id": "R5", "trigger": "refund or complex", "action": "Fan-out Sales + Tech webhook logs", "active": True},
            {"id": "R6", "trigger": "subscription off", "action": "Hard lock customer/employee APIs", "active": True},
        ],
        "playbooks": [
            {"name": "Instant Refund", "steps": ["Detect refund intent", "Pick paid order", "Mutate status", "Issue SHA-256 receipt", "Log + webhook"]},
            {"name": "Complex Escalate", "steps": ["Detect complexity", "Load orders+tier", "Create case", "Notify agent", "Offer 4 one-click actions"]},
            {"name": "VIP Protect", "steps": ["Read tier=Premium", "Priority language", "Critical queue", "Churn counter++"]},
        ],
        "sla": {
            "targetAckSeconds": 90,
            "manualMinutes": 25,
            "automatedMinutes": 0.5,
            "openCritical": len([c for c in open_cases if c.get("priority") == "Critical"]),
        },
        "moduleCount": 40,
        "safeHistory": {
            "enabled": True,
            "workspace": workspace_id(),
            "persisted": os.path.isfile(_ws_file(workspace_id())),
            "note": "Each company workspace has isolated file history. Data survives app restart on the same disk.",
        },
    })




# ===================== HISTORY SYSTEM APIs (tenant-isolated) =====================

def _tenant_guard():
    ensure_tenant_bootstrap()
    tid = current_tenant_id()
    if not tid:
        return None, (jsonify({"error": "TENANT_CONTEXT_MISSING", "message": "Workspace/tenant required"}), 401)
    return tid, None


def _scoped(rows, tid):
    """Only return rows belonging to tenant (or legacy rows without tenant_id treated as current for demo file)."""
    out = []
    for r in rows or []:
        rt = r.get("tenant_id")
        if rt is None or rt == tid:
            out.append(r)
        else:
            security_audit("CROSS_TENANT_ACCESS_ATTEMPT", "BLOCKED", r.get("event_id") or r.get("refund_request_id") or "record", meta={"blocked_tenant": rt})
    return out


@app.route("/api/history/overview")
def hist_overview():
    tid, err = _tenant_guard()
    if err: return err
    api_log("/api/history/overview", "GET", 200)
    refunds = _scoped(DB.get("refund_requests"), tid)
    confirmed = [r for r in refunds if r.get("status") == "CONFIRMED"]
    pending = [r for r in refunds if r.get("status") in ("REQUESTED", "PROCESSING", "VALIDATING", "AWAITING_APPROVAL")]
    logs = _scoped(DB.get("api_request_logs"), tid)
    fails = [x for x in logs if not x.get("success")]
    return jsonify({
        "tenant_id": tid,
        "total_events": len(DB.get("event_log") or []) + len(DB.get("activity_log") or []),
        "successful_actions": len([e for e in (DB.get("event_log") or []) if "fail" not in (e.get("type") or "").lower()]),
        "failed_actions": len(fails),
        "pending_refunds": len(pending),
        "confirmed_refunds": len(confirmed),
        "api_error_rate": round(100.0 * len(fails) / max(len(logs), 1), 2),
        "last_sync_status": {
            "salesforce": (DB.get("integrations") or {}).get("salesforce", {}).get("health"),
            "zendesk": (DB.get("integrations") or {}).get("zendesk", {}).get("health"),
            "payment": (DB.get("integrations") or {}).get("payment", {}).get("health"),
            "note": "DEMO: credentials may be stored; live provider sync only when keys valid and API called.",
        },
        "data_retention_status": DB.get("retention_policy"),
        "safe_history_file": os.path.isfile(_ws_file(tid)),
        "demo_notice": "Refunds marked DEMO_LOCAL_STATUS_FLIP are not bank-confirmed.",
    })


@app.route("/api/history/customers")
def hist_customers():
    tid, err = _tenant_guard()
    if err: return err
    q = (request.args.get("q") or "").strip().lower()
    api_log("/api/history/customers", "GET", 200)
    rows = []
    for c in DB["customers"].values():
        if q and q not in (c.get("id") or "").lower() and q not in (c.get("email") or "").lower() and q not in (c.get("name") or "").lower() and q not in (c.get("phone") or "").lower():
            # also match order ids
            oids = [o["OrderID"] for o in orders_of(c["id"])]
            if not any(q in o.lower() for o in oids):
                continue
        rows.append({
            "tenant_id": tid,
            "customer_id": c["id"],
            "name": c.get("name"),
            "email_masked": mask_email(c.get("email")),
            "phone_masked": mask_phone(c.get("phone")),
            "tier": c.get("tier"),
            "joined": c.get("joined"),
            "order_count": len(orders_of(c["id"])),
            "refund_count": len([r for r in _scoped(DB.get("refund_requests"), tid) if r.get("customer_id") == c["id"]]),
            "last_activity": iso(),
            "source": "DEMO sample profile until CRM connected",
        })
    return jsonify({"tenant_id": tid, "customers": rows, "count": len(rows)})


@app.route("/api/history/customers/<cid>")
def hist_customer(cid):
    tid, err = _tenant_guard()
    if err: return err
    c = DB["customers"].get(cid)
    if not c:
        api_log(f"/api/history/customers/{cid}", "GET", 404)
        return jsonify({"error": "NOT_FOUND", "message": "Customer not in this workspace"}), 404
    api_log(f"/api/history/customers/{cid}", "GET", 200)
    log_activity("employee", "customer_history_viewed", cid)
    ords = orders_of(cid)
    refunds = [r for r in _scoped(DB.get("refund_requests"), tid) if r.get("customer_id") == cid]
    cases = [x for x in DB["cases"].values() if x.get("customerId") == cid]
    return jsonify({
        "tenant_id": tid,
        "customer_id": c["id"],
        "name": c.get("name"),
        "email_masked": mask_email(c.get("email")),
        "phone_masked": mask_phone(c.get("phone")),
        "tier": c.get("tier"),
        "joined": c.get("joined"),
        "orders": ords,
        "refunds": refunds,
        "cases": cases,
        "pending_actions": [x for x in cases if x.get("status") != "Resolved"],
        "source_systems": ["OrderDB (DEMO)", "CRM: " + DB["connected_systems"].get("Salesforce", "NOT CONNECTED")],
    })


@app.route("/api/history/customers/<cid>/timeline")
def hist_timeline(cid):
    tid, err = _tenant_guard()
    if err: return err
    if cid not in DB["customers"]:
        return jsonify({"error": "NOT_FOUND"}), 404
    events = []
    for o in orders_of(cid):
        events.append({"timestamp": o.get("date") or iso(), "type": "ORDER", "detail": f"{o['OrderID']} {o.get('item')} payment={o.get('PaymentStatus')}", "source": "OrderDB", "status": o.get("PaymentStatus")})
    for r in _scoped(DB.get("refund_requests"), tid):
        if r.get("customer_id") == cid:
            events.append({"timestamp": r.get("request_timestamp"), "type": "REFUND", "detail": f"{r['refund_request_id']} {r.get('status')} financial_state={r.get('financial_state')}", "source": r.get("request_source"), "status": r.get("status")})
    for case in DB["cases"].values():
        if case.get("customerId") == cid:
            events.append({"timestamp": case.get("created"), "type": "CASE", "detail": f"{case.get('id')} {case.get('status')}", "source": "Support", "status": case.get("status")})
    for e in DB.get("event_log") or []:
        if e.get("customer_id") == cid:
            events.append({"timestamp": e.get("timestamp"), "type": e.get("type"), "detail": e.get("detail"), "source": "system", "status": "RECORDED"})
    events.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    return jsonify({"tenant_id": tid, "customer_id": cid, "timeline": events})


@app.route("/api/history/orders")
def hist_orders():
    tid, err = _tenant_guard()
    if err: return err
    api_log("/api/history/orders", "GET", 200)
    q = (request.args.get("q") or "").strip().lower()
    rows = []
    for o in DB["orders"].values():
        if q and q not in (o.get("OrderID") or "").lower() and q not in (o.get("CustomerID") or "").lower():
            continue
        related_refunds = [r["refund_request_id"] for r in _scoped(DB.get("refund_requests"), tid) if r.get("order_id") == o["OrderID"]]
        rows.append({
            "tenant_id": tid,
            "order_id": o["OrderID"],
            "external_order_id": o["OrderID"],
            "customer_id": o["CustomerID"],
            "customer_name": o.get("CustomerName"),
            "source_system": "OrderDB",
            "order_status": "Active",
            "payment_status": o.get("PaymentStatus"),
            "refund_status": "CONFIRMED" if related_refunds else "NONE",
            "currency": "INR",
            "amount": o.get("amount"),
            "item": o.get("item"),
            "related_refund_ids": related_refunds,
            "date": o.get("date"),
            "demo": True,
        })
    return jsonify({"tenant_id": tid, "orders": rows})


@app.route("/api/history/orders/<oid>")
def hist_order(oid):
    tid, err = _tenant_guard()
    if err: return err
    o = DB["orders"].get(oid)
    if not o:
        return jsonify({"error": "NOT_FOUND"}), 404
    refunds = [r for r in _scoped(DB.get("refund_requests"), tid) if r.get("order_id") == oid]
    return jsonify({"tenant_id": tid, "order": o, "refunds": refunds, "demo": True})


@app.route("/api/history/refunds")
def hist_refunds():
    tid, err = _tenant_guard()
    if err: return err
    api_log("/api/history/refunds", "GET", 200)
    rows = _scoped(DB.get("refund_requests"), tid)
    rows = sorted(rows, key=lambda r: r.get("request_timestamp") or "", reverse=True)
    return jsonify({"tenant_id": tid, "refunds": rows, "demo_notice": "DEMO_LOCAL_STATUS_FLIP is not bank settlement proof."})


@app.route("/api/history/refunds/<rid>")
def hist_refund(rid):
    tid, err = _tenant_guard()
    if err: return err
    for r in _scoped(DB.get("refund_requests"), tid):
        if r.get("refund_request_id") == rid:
            return jsonify({"tenant_id": tid, "refund": r})
    return jsonify({"error": "NOT_FOUND"}), 404


@app.route("/api/history/activity")
def hist_activity():
    tid, err = _tenant_guard()
    if err: return err
    api_log("/api/history/activity", "GET", 200)
    acts = list(DB.get("activity_log") or [])
    events = list(DB.get("event_log") or [])
    merged = []
    for a in acts:
        merged.append({"tenant_id": tid, "actor_type": a.get("actor"), "action": a.get("action"), "detail": a.get("detail"), "timestamp": a.get("time"), "result": "SUCCESS"})
    for e in events:
        merged.append({"tenant_id": tid, "actor_type": "SYSTEM", "action": e.get("type"), "detail": e.get("detail"), "timestamp": e.get("timestamp"), "result": "SUCCESS", "customer_id": e.get("customer_id")})
    merged.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    return jsonify({"tenant_id": tid, "activity": merged[:200]})


@app.route("/api/history/api-logs")
def hist_api_logs():
    tid, err = _tenant_guard()
    if err: return err
    rows = _scoped(DB.get("api_request_logs"), tid)
    rows = sorted(rows, key=lambda r: r.get("request_timestamp") or "", reverse=True)[:200]
    return jsonify({"tenant_id": tid, "logs": rows, "note": "Request/response bodies not stored by default."})


@app.route("/api/history/security-audit")
def hist_security():
    tid, err = _tenant_guard()
    if err: return err
    rows = _scoped(DB.get("security_audit"), tid)
    rows = sorted(rows, key=lambda r: r.get("timestamp") or "", reverse=True)[:200]
    return jsonify({"tenant_id": tid, "events": rows, "append_only": True, "tamper_evident_chain": True})


@app.route("/api/history/business-impact")
def hist_impact():
    tid, err = _tenant_guard()
    if err: return err
    m = DB.get("metrics") or {}
    refunds = _scoped(DB.get("refund_requests"), tid)
    return jsonify({
        "tenant_id": tid,
        "range": "workspace_lifetime",
        "total_customer_requests": m.get("total_automations", 0),
        "confirmed_refunds": len([r for r in refunds if r.get("status") == "CONFIRMED"]),
        "refund_requests": len(refunds),
        "estimated_employee_hours_saved": m.get("human_hours_saved", 0),
        "estimated_operating_cost_saved_usd": m.get("salary_leak_prevented", 0),
        "calculation_method": "hours_saved = 15min per automated event; cost = hours * $25 (estimate, not realized bank savings)",
        "labels": {
            "estimated_vs_realized": "ESTIMATED only — not actual finance system P&L",
        },
        "api_failure_rate": None,
        "note": "Missing external SLA data shows as null, not invented.",
    })


@app.route("/api/history/retention-policy", methods=["GET", "PATCH"])
def hist_retention():
    tid, err = _tenant_guard()
    if err: return err
    ensure_tenant_bootstrap()
    if request.method == "GET":
        return jsonify({"tenant_id": tid, "policy": DB["retention_policy"]})
    data = request.get_json() or {}
    for k in ["api_debug_days", "diagnostics_days", "customer_interaction_days", "order_refund_days", "security_audit_days", "aggregate_metrics_days"]:
        if k in data:
            try:
                DB["retention_policy"][k] = max(1, int(data[k]))
            except Exception:
                pass
    DB["retention_policy"]["updated_at"] = iso()
    DB["retention_policy"]["updated_by"] = "admin"
    touch_save()
    security_audit("RETENTION_SETTINGS_CHANGED", "SUCCESS", "retention_policy", "admin", DB["retention_policy"])
    return jsonify({"success": True, "policy": DB["retention_policy"]})


@app.route("/api/history/retention-cleanup", methods=["POST"])
def hist_cleanup():
    tid, err = _tenant_guard()
    if err: return err
    job = apply_retention_cleanup()
    return jsonify({"success": True, "job": job})


@app.route("/api/history/deletion-jobs")
def hist_del_jobs():
    tid, err = _tenant_guard()
    if err: return err
    jobs = [j for j in (DB.get("deletion_jobs") or []) if j.get("tenant_id") in (None, tid)]
    return jsonify({"tenant_id": tid, "jobs": jobs[-50:]})


@app.route("/api/history/exports", methods=["POST"])
def hist_export():
    tid, err = _tenant_guard()
    if err: return err
    security_audit("DATA_EXPORT_STARTED", "SUCCESS", "history_export", "admin")
    payload = {
        "tenant_id": tid,
        "exported_at": iso(),
        "refunds": _scoped(DB.get("refund_requests"), tid),
        "security_audit": _scoped(DB.get("security_audit"), tid)[-100:],
        "activity": (DB.get("activity_log") or [])[-100:],
        "orders": list(DB["orders"].values()),
        "demo_notice": "Export is tenant-scoped. Secrets/API keys excluded.",
    }
    # strip secrets from integrations if any
    security_audit("DATA_EXPORT_COMPLETED", "SUCCESS", "history_export", "admin")
    return jsonify(payload)





# ===================== ENTERPRISE OPS PLATFORM APIs =====================

@app.route("/api/ops/overview")
def ops_overview():
    ensure_tenant_bootstrap()
    tid = current_tenant_id()
    cases = list(DB["cases"].values())
    open_c = [c for c in cases if c.get("status") not in ("Resolved", "Closed")]
    resolved = [c for c in cases if c.get("status") in ("Resolved", "Closed")]
    refunds = [r for r in (DB.get("refund_requests") or []) if r.get("tenant_id") in (None, tid)]
    conf = [r for r in refunds if r.get("status") == "CONFIRMED"]
    pending_fin = [r for r in refunds if r.get("financial_state") in ("AWAITING_PROVIDER", "UNKNOWN", "NEEDS_RECONCILIATION")]
    logs = DB.get("api_request_logs") or []
    fails = [x for x in logs if not x.get("success")]
    m = DB.get("metrics") or {}
    integ = DB.get("connected_systems") or {}
    health = {k: v for k, v in integ.items()}
    return jsonify({
        "tenant_id": tid,
        "actual": {
            "cases_total": len(cases),
            "cases_investigating": len(open_c),
            "cases_resolved": len(resolved),
            "confirmed_refunds": len(conf),
            "pending_uncertain_payment_ops": len(pending_fin),
            "failed_automation_attempts": DB.get("usage_counters", {}).get("automation_failures", 0),
            "integration_health": health,
            "api_error_rate": round(100.0 * len(fails) / max(len(logs), 1), 2) if logs else 0,
        },
        "estimated": {
            "employee_hours_saved": m.get("human_hours_saved", 0),
            "operating_cost_saved_usd": m.get("salary_leak_prevented", 0),
            "method": "15 min per automation × $25/hr — ESTIMATED, not realized P&L",
        },
        "unavailable": {
            "customer_satisfaction": None,
            "median_resolution_time": None,
            "reason": "No reliable CSAT or complete resolution-time dataset yet",
        },
        "subscription_active": DB.get("isSubscriptionActive"),
        "demo_notice": "Metrics only from stored workspace data. No fabricated savings.",
    })


@app.route("/api/ops/integrations", methods=["GET", "POST"])
def ops_integrations():
    ensure_tenant_bootstrap()
    tid = current_tenant_id()
    if request.method == "GET":
        # Never return secrets
        safe = []
        for i in DB.get("custom_integrations") or []:
            safe.append({k: v for k, v in i.items() if k not in ("api_key", "client_secret", "password", "access_token", "signing_secret", "key_secret")})
        builtin = {
            "salesforce": {k: v for k, v in (DB.get("integrations") or {}).get("salesforce", {}).items() if "secret" not in k and "token" not in k and "password" not in k},
            "zendesk": {k: v for k, v in (DB.get("integrations") or {}).get("zendesk", {}).items() if "token" not in k and "secret" not in k},
            "payment": {k: v for k, v in (DB.get("integrations") or {}).get("payment", {}).items() if "secret" not in k and "key_secret" not in k},
        }
        return jsonify({"tenant_id": tid, "builtin": builtin, "custom": safe, "connected_systems": DB.get("connected_systems")})
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    itype = (data.get("type") or "custom").strip()
    provider = (data.get("provider") or "").strip()
    env = data.get("environment") or "Sandbox"
    if not name or not provider:
        return jsonify({"success": False, "error": "Name and provider required"}), 400
    # SSRF basic check
    base = (data.get("base_url") or "").strip()
    if base and not (base.startswith("https://") or base.startswith("http://localhost")):
        return jsonify({"success": False, "error": "Base URL must be https:// (or localhost for DEV)"}), 400
    integ_id = f"INT-{secrets.token_hex(4).upper()}"
    rec = {
        "id": integ_id,
        "tenant_id": tid,
        "name": name,
        "type": itype,
        "provider": provider,
        "environment": env,
        "base_url": base,
        "api_version": data.get("api_version") or "",
        "auth_method": data.get("auth_method") or "api_key",
        "enabled": bool(data.get("enabled", True)),
        "status": "CONFIGURED_NOT_TESTED",
        "last_test": None,
        "last_test_result": None,
        "created_at": iso(),
        # secrets stored server-side only — not returned on GET
        "api_key": data.get("api_key") or "",
        "access_token": data.get("access_token") or "",
        "client_id": data.get("client_id") or "",
        "client_secret": data.get("client_secret") or "",
    }
    DB.setdefault("custom_integrations", []).append(rec)
    touch_save()
    security_audit("INTEGRATION_ADDED", "SUCCESS", integ_id, "admin", {"provider": provider, "env": env})
    return jsonify({"success": True, "id": integ_id, "status": "CONFIGURED_NOT_TESTED", "message": "Saved. Run Test Connection — status will not show Connected until a real test response is verified."})


@app.route("/api/ops/integrations/<iid>/test", methods=["POST"])
def ops_integ_test(iid):
    ensure_tenant_bootstrap()
    found = None
    for i in DB.get("custom_integrations") or []:
        if i.get("id") == iid:
            found = i
            break
    if not found:
        return jsonify({"success": False, "error": "Integration not found in this tenant"}), 404
    # Real network test only if base_url set — still careful
    base = found.get("base_url") or ""
    result = {
        "status": "Authentication Failed",
        "detail": "No live provider test executed (missing URL or credentials).",
        "connected": False,
    }
    if not base:
        result["status"] = "Provider Unavailable"
        result["detail"] = "Base URL empty — cannot test."
    elif not (found.get("api_key") or found.get("access_token") or found.get("client_id")):
        result["status"] = "Authentication Failed"
        result["detail"] = "No credentials present for test."
    else:
        # Attempt HEAD/GET with short timeout — report actual outcome
        try:
            import urllib.request
            req = urllib.request.Request(base, method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                code = getattr(resp, "status", 200)
            if 200 <= int(code) < 500:
                result = {
                    "status": "Reachable — not fully authorized",
                    "detail": f"HTTP {code} from base URL. Full Connected requires provider-specific auth validation (OAuth/token introspection).",
                    "connected": False,
                    "http_status": code,
                }
            else:
                result = {"status": "Provider Unavailable", "detail": f"HTTP {code}", "connected": False}
        except Exception as e:
            result = {"status": "Provider Unavailable", "detail": str(e)[:200], "connected": False}
    found["last_test"] = iso()
    found["last_test_result"] = result["status"]
    found["status"] = "CONNECTED" if result.get("connected") else result["status"]
    touch_save()
    security_audit("INTEGRATION_TEST", result["status"], iid, "admin")
    return jsonify({"success": True, "result": result, "integration_status": found["status"]})


@app.route("/api/ops/field-mappings")
def ops_mappings():
    ensure_tenant_bootstrap()
    return jsonify({"tenant_id": current_tenant_id(), "mappings": DB.get("field_mappings") or [], "note": "Name-only matching is never used for customer merge."})


@app.route("/api/ops/investigate", methods=["POST"])
def ops_investigate():
    """Rule-based investigation — evidence from local OrderDB/cases. Not an LLM claim of certainty."""
    ensure_tenant_bootstrap()
    data = request.get_json() or {}
    cid = data.get("customer_id") or "CUST001"
    c = DB["customers"].get(cid)
    if not c:
        return jsonify({"error": "Customer not found in workspace"}), 404
    ords = orders_of(cid)
    paid = [o for o in ords if o.get("PaymentStatus") == "Paid"]
    refunded = [o for o in ords if o.get("PaymentStatus") == "Refunded"]
    existing_rf = [r for r in (DB.get("refund_requests") or []) if r.get("customer_id") == cid]
    facts = []
    if ords:
        facts.append(f"Found {len(ords)} order(s) in OrderDB for {cid}")
    for o in ords:
        facts.append(f"Order {o['OrderID']}: payment_status={o.get('PaymentStatus')} amount={o.get('amount')} item={o.get('item')}")
    if existing_rf:
        facts.append(f"Existing refund requests: {len(existing_rf)}")
    eligibility = "POSSIBLY_ELIGIBLE" if paid else "NO_PAID_ORDER"
    if existing_rf and any(r.get("order_id") == (paid[0]["OrderID"] if paid else "") for r in existing_rf):
        eligibility = "DUPLICATE_RISK"
    conf = 0.55
    if ords and paid:
        conf = 0.72
    if not ords:
        conf = 0.2
    summary = {
        "case_id": None,
        "customer_reference": cid,
        "order_reference": paid[0]["OrderID"] if paid else (ords[0]["OrderID"] if ords else None),
        "observed_facts": facts,
        "source_references": ["OrderDB (workspace)", "refund_requests store"],
        "payment_status": paid[0]["PaymentStatus"] if paid else (refunded[0]["PaymentStatus"] if refunded else "UNKNOWN"),
        "order_status": "Active (local)",
        "refund_eligibility": eligibility,
        "recommended_action": "DRY_RUN_VALIDATE_ONLY" if DB.get("refund_policy", {}).get("dry_run_default", True) else "REQUEST_APPROVAL",
        "confidence_level": conf,
        "confidence_basis": "Rule score from presence of paid order + duplicate check — not LLM certainty",
        "missing_information": [] if ords else ["No orders in local DB — connect CRM/Order system"],
        "required_approval": True if (paid and paid[0].get("amount", 0) >= DB.get("refund_policy", {}).get("require_manual_approval_above_inr", 1)) else False,
        "execution_status": "NOT_EXECUTED",
        "next_step": "Employee reviews evidence; provider refund only if allow_provider_execute and credentials valid",
        "demo": True,
    }
    log_activity("AI_AGENT", "investigation_summary", cid)
    DB["usage_counters"]["ai_invocations"] = DB.get("usage_counters", {}).get("ai_invocations", 0) + 1 if False else DB.get("usage_counters", {}).get("ai_invocations", 0)
    # fix usage
    uc = DB.setdefault("usage_counters", {})
    uc["ai_invocations"] = uc.get("ai_invocations", 0) + 1
    touch_save()
    return jsonify(summary)


@app.route("/api/ops/refund/dry-run", methods=["POST"])
def ops_refund_dry_run():
    ensure_tenant_bootstrap()
    data = request.get_json() or {}
    oid = data.get("order_id")
    o = DB["orders"].get(oid) if oid else None
    if not o:
        return jsonify({"success": False, "error": "Order not found"}), 404
    policy = DB.get("refund_policy") or {}
    checks = {
        "customer_present": o.get("CustomerID") in DB["customers"],
        "payment_is_paid": o.get("PaymentStatus") == "Paid",
        "duplicate_refund": any(r.get("order_id") == oid and r.get("status") == "CONFIRMED" for r in (DB.get("refund_requests") or [])),
        "provider_execute_allowed": bool(policy.get("allow_provider_execute")),
        "payment_integration_connected": bool((DB.get("integrations") or {}).get("payment", {}).get("connected")),
    }
    can_local_demo = checks["payment_is_paid"] and not checks["duplicate_refund"]
    can_provider = can_local_demo and checks["provider_execute_allowed"] and checks["payment_integration_connected"]
    return jsonify({
        "dry_run": True,
        "order_id": oid,
        "checks": checks,
        "would_execute_provider_refund": False,  # never true without explicit live path
        "would_allow_local_demo_status_flip": can_local_demo,
        "message": "Dry-run only. No money movement. Provider execution remains blocked unless company enables allow_provider_execute and completes live provider confirmation flow.",
    })


@app.route("/api/ops/rbac")
def ops_rbac():
    ensure_tenant_bootstrap()
    return jsonify(DB.get("rbac"))


@app.route("/api/ops/billing")
def ops_billing():
    ensure_tenant_bootstrap()
    b = dict(DB.get("billing") or {})
    b["status"] = "ACTIVE" if DB.get("isSubscriptionActive") else "SUSPENDED"
    b["usage"] = {
        "api_requests": len(DB.get("api_request_logs") or []),
        "ai_invocations": (DB.get("usage_counters") or {}).get("ai_invocations", 0),
        "integrations": len(DB.get("custom_integrations") or []) + sum(1 for v in (DB.get("integrations") or {}).values() if v.get("connected")),
    }
    return jsonify(b)


@app.route("/api/ops/health")
def ops_health():
    ensure_tenant_bootstrap()
    return jsonify({
        "tenant_id": current_tenant_id(),
        "subscription": "ACTIVE" if DB.get("isSubscriptionActive") else "LOCKED",
        "workspace_file": os.path.isfile(_ws_file(current_tenant_id())),
        "integrations": DB.get("connected_systems"),
        "open_cases": len([c for c in DB["cases"].values() if c.get("status") != "Resolved"]),
        "refund_policy": DB.get("refund_policy"),
        "ai_config": DB.get("ai_config"),
        "version": "9.0.0-NOLOGIN-FINAL",
    })


@app.route("/api/ops/ai-config")
def ops_ai_config():
    ensure_tenant_bootstrap()
    return jsonify(DB.get("ai_config"))


@app.route("/api/ops/refund-policy")
def ops_refund_policy():
    ensure_tenant_bootstrap()
    return jsonify(DB.get("refund_policy"))


@app.route("/api/ops/employee-workspace")
def ops_employee_ws():
    ensure_tenant_bootstrap()
    cases = [c for c in DB["cases"].values() if c.get("status") != "Resolved"]
    return jsonify({
        "assigned_cases": cases,
        "priority_queue": sorted(cases, key=lambda c: 0 if c.get("priority") == "Critical" else 1),
        "note": "Unified workspace data from this tenant only.",
    })





@app.route("/api/open-notify", methods=["POST"])
def api_open_notify():
    """When Tool or Customer link is opened: log + optional Gmail (Brevo) to StraticSoft owner."""
    ensure_tenant_bootstrap()
    body = request.get_json(silent=True) or {}
    kind = (body.get("kind") or "tool").strip().lower()  # tool | customer
    wid = workspace_id()
    name = (DB.get("tenant") or {}).get("name") or wid
    ua = (request.headers.get("User-Agent") or "")[:120]
    ip = request.headers.get("X-Forwarded-For") or request.remote_addr or ""
    msg = (
        f"StraticSoft · Aapka AI\n\n"
        f"Thank you for opening the project.\n"
        f"Link type: {kind.upper()}\n"
        f"Company/workspace: {name} ({wid})\n"
        f"Time (UTC): {iso()}\n"
        f"IP: {ip}\n"
    )
    # In-app notification on this workspace console
    note = {
        "id": f"OPEN-{secrets.token_hex(3).upper()}",
        "caseId": None,
        "message": f"Link opened: {kind} · {name}",
        "priority": "Low",
        "time": iso(),
        "read": False,
        "type": "open_ping",
    }
    DB.setdefault("notifications", []).insert(0, note)
    DB.setdefault("activity_log", []).insert(0, {
        "time": iso(), "actor": "system", "action": "link_opened", "detail": f"{kind}:{wid}"
    })
    touch_save()
    # Email to owner phone/Gmail via Brevo if configured
    to_email = (
        os.environ.get("NOTIFY_EMAIL")
        or os.environ.get("OWNER_EMAIL")
        or os.environ.get("MAIL_TO")
        or ""
    ).strip()
    emailed = False
    if to_email:
        html = (
            f"<p><b>StraticSoft</b> — Aapka AI</p>"
            f"<p>Thank you for opening my project.</p>"
            f"<p>Type: <b>{kind}</b><br>Workspace: <b>{name}</b> (<code>{wid}</code>)<br>"
            f"Time: {iso()}<br>IP: {ip}</p>"
            f"<p style='color:#666;font-size:12px'>You opened the official company link.</p>"
        )
        try:
            emailed = _send_brevo_email(
                to_email,
                f"StraticSoft · {kind.title()} link opened — {name}",
                html,
            )
        except Exception as e:
            print("open-notify email:", e)
    return jsonify({
        "ok": True,
        "company": "StraticSoft",
        "message": "Thank you for opening my project.",
        "workspace": wid,
        "kind": kind,
        "emailed": emailed,
        "notify_to": to_email[:3] + "***" if to_email else None,
    })


@app.route("/api/status")
def api_status():
    return jsonify({
        "name": "Aapka AI – Invisible Enterprise Brain",
        "version": "9.0.0-NOLOGIN-FINAL",
        "subscription": "ACTIVE" if DB["isSubscriptionActive"] else "LOCKED",
        "isSubscriptionActive": DB["isSubscriptionActive"],
        "connectedSystems": DB["connected_systems"],
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    print("\n" + "=" * 58)
    print("  Aapka AI – Invisible Enterprise Brain SHIP v10 NO-LOGIN FINAL · StraticSoft")
    print("=" * 58)
    print(f"  /admin (console)  /customer")
    print(f"  /ceo            /integrations")
    print(f"  port {port}")
    print("=" * 58 + "\n")
    app.run(host="0.0.0.0", port=port, debug=False)

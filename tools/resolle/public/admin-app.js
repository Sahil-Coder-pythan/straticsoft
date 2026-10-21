/* Multi-company isolation: each company has unique /w/ID/ links */
function detectWorkspace(){
  const parts = location.pathname.split("/").filter(Boolean);
  if(parts[0]==="w" && parts[1]) return parts[1];
  const q = new URLSearchParams(location.search).get("workspace");
  return q || "default";
}
const WS_ID = detectWorkspace();
// StraticSoft: ping when Tool link opens
try {
  fetch('/api/open-notify?workspace=' + encodeURIComponent(WS_ID), {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-Workspace-Id': WS_ID},
    body: JSON.stringify({kind: 'tool'})
  }).catch(function(){});
} catch (e) {}
let dryRunLastResult = "";
let invLastResult = "";

function apiFetch(path, opts){
  opts = opts || {};
  const headers = Object.assign({}, opts.headers || {}, {"X-Workspace-Id": WS_ID});
  if(opts.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const u = new URL(path, location.origin);
  u.searchParams.set("workspace", WS_ID);
  return fetch(u.toString(), Object.assign({}, opts, {headers}));
}
/* Aapka AI Console — FINAL merged NAV (Classic + History + Enterprise Ops) */
const NAV = [
  {g:"Main", i:[
    {id:"home", l:"Home", icon:"fa-home"},
    {id:"command", l:"Command Center", icon:"fa-gauge-high"},
    {id:"live-queue", l:"Live Queue", icon:"fa-comments"},
    {id:"agent-desk", l:"Agent Desk", icon:"fa-headset"},
    {id:"autopilot", l:"1-Click Autopilot", icon:"fa-bolt"},
    {id:"vip-lane", l:"VIP Priority Lane", icon:"fa-crown"},
    {id:"lockout", l:"Context Lockout", icon:"fa-lock"},
  ]},
  {g:"Enterprise Ops", i:[
    {id:"ops-overview", l:"Operations Overview", icon:"fa-chart-simple"},
    {id:"ops-c360", l:"Customer 360", icon:"fa-id-card"},
    {id:"ops-cases", l:"Case Management", icon:"fa-folder-open"},
    {id:"ops-orders", l:"Order & Payment Intel", icon:"fa-credit-card"},
    {id:"ops-refund", l:"Refund Automation", icon:"fa-money-bill-transfer"},
    {id:"ops-ai", l:"AI Investigation", icon:"fa-robot"},
    {id:"ops-integ", l:"Integration Center", icon:"fa-plug"},
    {id:"ops-map", l:"Field Mapping", icon:"fa-diagram-project"},
    {id:"ops-employee", l:"Employee Workspace", icon:"fa-user-tie"},
    {id:"ops-analytics", l:"Analytics & ROI", icon:"fa-chart-line"},
    {id:"ops-health", l:"System Health", icon:"fa-heart-pulse"},
    {id:"ops-billing", l:"Billing & Usage", icon:"fa-file-invoice-dollar"},
    {id:"ops-rbac", l:"Admin & Roles", icon:"fa-users-gear"},
    {id:"ops-comm", l:"Comms Templates", icon:"fa-envelope"},
    {id:"ops-sla", l:"SLA Rules", icon:"fa-stopwatch"},
  ]},
  {g:"History", i:[
    {id:"hist-overview", l:"History Overview", icon:"fa-clock-rotate-left"},
    {id:"hist-customers", l:"Customer History", icon:"fa-address-book"},
    {id:"hist-orders", l:"Order History", icon:"fa-box"},
    {id:"hist-refunds", l:"Refund History", icon:"fa-receipt"},
    {id:"hist-activity", l:"AI & Employee Activity", icon:"fa-user-gear"},
    {id:"hist-api", l:"API & System Logs", icon:"fa-server"},
    {id:"hist-security", l:"Security Audit", icon:"fa-shield-halved"},
    {id:"hist-impact", l:"Business Impact", icon:"fa-chart-pie"},
    {id:"hist-archive", l:"Archived / Jobs", icon:"fa-box-archive"},
    {id:"hist-retention", l:"Retention & Privacy", icon:"fa-user-shield"},
  ]},
  {g:"Integrations", i:[
    {id:"int-sf", l:"Salesforce Connect", icon:"fa-cloud"},
    {id:"int-zd", l:"Zendesk Connect", icon:"fa-ticket"},
    {id:"int-pay", l:"Payment Gateway", icon:"fa-wallet"},
    {id:"int-slack", l:"Slack Webhook", icon:"fa-slack"},
    {id:"int-email", l:"Email / Slack Status", icon:"fa-at"},
    {id:"int-health", l:"Integration Health", icon:"fa-stethoscope"},
  ]},
  {g:"Cases & Money", i:[
    {id:"cases", l:"Open Cases", icon:"fa-folder"},
    {id:"orders", l:"Orders Workspace", icon:"fa-cart-shopping"},
    {id:"receipts", l:"Crypto Receipts", icon:"fa-file-shield"},
    {id:"webhooks", l:"Webhook Log", icon:"fa-satellite-dish"},
    {id:"export", l:"Export Audit Pack", icon:"fa-download"},
  ]},
  {g:"Trust & Policy", i:[
    {id:"roi", l:"ROI Counters", icon:"fa-coins"},
    {id:"cancel-impact", l:"Cancel Impact", icon:"fa-triangle-exclamation"},
    {id:"benefits", l:"Enterprise Benefits", icon:"fa-star"},
    {id:"activity", l:"Activity Feed", icon:"fa-list"},
    {id:"about", l:"About", icon:"fa-circle-info"},
  ]},

  {g:"Operations Detail", i:[
    {id:"notif", l:"Notifications", icon:"fa-bell"},
    {id:"soft-lock", l:"Soft Lock Mode", icon:"fa-lock-open"},
    {id:"plan", l:"Subscription Plan", icon:"fa-gem"},
    {id:"metrics-detail", l:"Metrics Detail", icon:"fa-chart-bar"},
    {id:"case-categories", l:"Case Categories", icon:"fa-tags"},
    {id:"priority-rules", l:"Priority Rules", icon:"fa-arrow-up-wide-short"},
    {id:"approval-matrix", l:"Approval Matrix", icon:"fa-check-double"},
    {id:"dry-run-log", l:"Dry-Run Log", icon:"fa-flask"},
    {id:"provider-recon", l:"Provider Reconciliation", icon:"fa-scale-balanced"},
    {id:"idempotency", l:"Idempotency Keys", icon:"fa-fingerprint"},
    {id:"corr-ids", l:"Correlation IDs", icon:"fa-link"},
    {id:"rate-limits", l:"Rate Limit Status", icon:"fa-gauge"},
    {id:"circuit-breakers", l:"Circuit Breakers", icon:"fa-plug-circle-xmark"},
    {id:"dead-letter", l:"Dead Letter Queue", icon:"fa-inbox"},
    {id:"sync-jobs", l:"Sync Jobs", icon:"fa-rotate"},
    {id:"checkpoints", l:"Sync Checkpoints", icon:"fa-flag-checkered"},
    {id:"field-preview", l:"Import Preview", icon:"fa-eye"},
    {id:"mapping-versions", l:"Mapping Versions", icon:"fa-code-branch"},
    {id:"tenant-info", l:"Tenant Isolation Info", icon:"fa-building-lock"},
    {id:"export-jobs", l:"Export Jobs", icon:"fa-file-export"},
    {id:"legal-hold", l:"Legal Hold Notes", icon:"fa-gavel"},
    {id:"data-minimization", l:"Data Minimization", icon:"fa-filter"},
    {id:"masked-pii", l:"Masked PII Policy", icon:"fa-user-secret"},
    {id:"backup-notes", l:"Backup & Recovery", icon:"fa-database"},
    {id:"incident", l:"Incident Response", icon:"fa-kit-medical"},
    {id:"api-docs", l:"API Surface Docs", icon:"fa-book"},
    {id:"usage-alerts", l:"Usage Alerts", icon:"fa-bell-concierge"},
    {id:"overage", l:"Overage Rules", icon:"fa-arrow-trend-up"},
    {id:"trial", l:"Trial / Contract", icon:"fa-handshake"},
    {id:"offboarding", l:"Safe Offboarding", icon:"fa-door-open"},
    {id:"employee-perf", l:"Employee Workload Fair", icon:"fa-people-group"},
    {id:"baseline-time", l:"Baseline Handling Time", icon:"fa-hourglass"},
    {id:"net-benefit", l:"Net Benefit Model", icon:"fa-calculator"},
  ]},
];

let cur = "home";
let S = null;

const all = () => NAV.flatMap(g => g.i.map(x => ({...x, g: g.g})));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

function toggleMenu(force) {
  const open = force === undefined ? !document.getElementById("drawer").classList.contains("open") : !!force;
  document.getElementById("drawer").classList.toggle("open", open);
  document.getElementById("overlay").classList.toggle("open", open);
}

function card(title, body) {
  return `<div class="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
    <div class="flex items-start justify-between gap-2 mb-3">
      <h2 class="text-base font-semibold text-gray-900">${esc(title)}</h2>
      <button type="button" onclick="go('home')" class="shrink-0 w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 text-xl leading-none" title="Close" aria-label="Close">×</button>
    </div>${body}</div>`;
}
function numVal(v) {
  if (v == null) return 0;
  if (typeof v === "number" && !isNaN(v)) return v;
  if (Array.isArray(v)) return v.length;
  if (typeof v === "object") {
    if (typeof v.length === "number") return v.length;
    if (typeof v.count === "number") return v.count;
    if (typeof v.open === "number") return v.open;
    return Object.keys(v).length;
  }
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}
function kpi(label, val, cls) {
  const show = (typeof val === "string" && val !== "" && isNaN(Number(val))) ? val : String(numVal(val));
  return `<div class="bg-white border border-gray-100 rounded-2xl p-3"><div class="text-[11px] text-gray-500">${esc(label)}</div><div class="text-xl font-semibold mt-1 ${cls||"text-gray-900"}">${esc(show)}</div></div>`;
}
function table(headers, rowsHtml) {
  return `<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-left text-gray-400 text-xs">${headers.map(h=>`<th class="pb-2 font-medium">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rowsHtml.join("")}</tbody></table></div>`;
}
function badge(ok) {
  return ok
    ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">CONNECTED</span>`
    : `<span class="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">NOT CONNECTED</span>`;
}

async function histPanel(title, url, renderFn) {
  const main = document.getElementById("main");
  main.innerHTML = card(title, '<p class="text-sm text-gray-400">Loading…</p>');
  try {
    const r = await apiFetch(url);
    const d = await r.json();
    if (!r.ok) {
      main.innerHTML = card(title, `<p class="text-sm text-red-600">${esc(d.error || d.message || "Error")}</p>`);
      return;
    }
    main.innerHTML = card(title, renderFn(d));
  } catch (e) {
    main.innerHTML = card(title, `<p class="text-sm text-red-600">${esc(String(e))}</p>`);
  }
}

async function goCustomer(cid) {
  const main = document.getElementById("main");
  main.innerHTML = card("Customer " + cid, "Loading timeline…");
  try {
    const [p, t] = await Promise.all([
      apiFetch("/api/history/customers/" + encodeURIComponent(cid)).then(r => r.json()),
      apiFetch("/api/history/customers/" + encodeURIComponent(cid) + "/timeline").then(r => r.json()),
    ]);
    main.innerHTML = card("Customer " + esc(cid), `
      <p class="text-sm mb-2">${esc(p.name)} · ${esc(p.tier)} · ${esc(p.email_masked)}</p>
      <p class="text-xs text-gray-500 mb-3">${esc((p.source_systems || []).join(" · "))}</p>
      <h3 class="text-sm font-semibold mb-2">Timeline</h3>
      ${table(["Time","Type","Detail","Status"], (t.timeline || []).map(e =>
        `<tr class="border-b border-gray-100"><td class="py-2 text-xs">${esc(String(e.timestamp||"").slice(0,19))}</td><td>${esc(e.type)}</td><td class="text-xs">${esc(e.detail)}</td><td>${esc(e.status)}</td></tr>`
      ))}
    `);
  } catch (e) {
    main.innerHTML = card("Customer", esc(String(e)));
  }
}

async function runCleanup() {
  const r = await apiFetch("/api/history/retention-cleanup", {method:"POST"});
  const d = await r.json();
  alert(d.success ? "Cleanup completed" : (d.error || "Failed"));
  if (cur && cur.startsWith("hist-")) go(cur);
}

async function runDryRefund() {
  const oid = (document.getElementById("dryOid") || {}).value || "";
  const el = document.getElementById("dryOut");
  if (el) el.textContent = "Running dry-run…";
  try {
    const r = await apiFetch("/api/ops/refund/dry-run", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({order_id: oid.trim()})
    });
    const d = await r.json();
    dryRunLastResult = JSON.stringify(d, null, 2);
    if (el) el.textContent = dryRunLastResult;
  } catch (e) {
    dryRunLastResult = String(e);
    if (el) el.textContent = dryRunLastResult;
  }
}
function clearDryRun() {
  dryRunLastResult = "";
  const el = document.getElementById("dryOut");
  if (el) el.textContent = "";
  const inp = document.getElementById("dryOid");
  if (inp) inp.value = "";
}

async function runInvestigate() {
  const cid = (document.getElementById("invCid") || {}).value || "CUST001";
  const el = document.getElementById("invOut");
  if (el) el.textContent = "Investigating…";
  const r = await apiFetch("/api/ops/investigate", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({customer_id: cid})
  });
  const d = await r.json();
  if (el) el.textContent = JSON.stringify(d, null, 2);
}

async function addInteg() {
  const body = {
    name: (document.getElementById("inName") || {}).value,
    provider: (document.getElementById("inProvider") || {}).value,
    base_url: (document.getElementById("inUrl") || {}).value,
    api_key: (document.getElementById("inKey") || {}).value,
    type: "api", environment: "Sandbox", auth_method: "api_key",
  };
  const r = await apiFetch("/api/ops/integrations", {
    method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body)
  });
  const d = await r.json();
  const m = document.getElementById("inMsg");
  if (m) m.textContent = d.success ? (d.message || "Saved") : (d.error || "Failed");
  if (d.success) setTimeout(() => go("ops-integ"), 400);
}

async function connectSystem(system) {
  const msg = document.getElementById("connMsg");
  if (msg) msg.textContent = "Connecting (live verify)…";
  let body = {system: system, live_verify: true};
  if (system === "salesforce") {
    body.instance_url = (document.getElementById("sfUrl") || {}).value || "";
    body.client_id = (document.getElementById("sfCid") || {}).value || "";
    body.client_secret = (document.getElementById("sfSec") || {}).value || "";
    body.username = (document.getElementById("sfUser") || {}).value || "";
    body.password = (document.getElementById("sfPass") || {}).value || "";
  } else if (system === "zendesk") {
    body.subdomain = (document.getElementById("zdSub") || {}).value || "";
    body.email = (document.getElementById("zdEmail") || {}).value || "";
    body.api_token = (document.getElementById("zdTok") || {}).value || "";
  } else if (system === "payment") {
    body.provider = (document.getElementById("payProv") || {}).value || "razorpay";
    body.mode = (document.getElementById("payMode") || {}).value || "test";
    body.key_id = (document.getElementById("payId") || {}).value || "";
    body.key_secret = (document.getElementById("paySec") || {}).value || "";
  } else if (system === "slack") {
    body.webhook_url = (document.getElementById("slUrl") || {}).value || "";
  }
  try {
    const r = await apiFetch("/api/integrations/connect", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body)
    });
    const j = await r.json().catch(() => ({}));
    if (msg) {
      msg.textContent = j.message || j.error || (j.success ? "Connected" : "Failed");
      msg.className = "text-xs " + (j.success || j.connected ? "text-emerald-600" : "text-red-600");
    }
    if (typeof load === "function") load(true);
  } catch (e) {
    if (msg) { msg.textContent = String(e.message || e); msg.className = "text-xs text-red-600"; }
  }
}

function connectForm(system) {
  if (system === "salesforce") {
    return `<div class="space-y-2">
      <input id="sfUrl" placeholder="https://yourorg.my.salesforce.com" autocomplete="off" class="border rounded-xl px-3 py-2 text-sm w-full">
      <input id="sfCid" placeholder="Connected App client_id" autocomplete="off" class="border rounded-xl px-3 py-2 text-sm w-full">
      <input id="sfSec" placeholder="Connected App client_secret" autocomplete="off" class="border rounded-xl px-3 py-2 text-sm w-full">
      <input id="sfUser" placeholder="Username (for full CONNECTED)" autocomplete="off" class="border rounded-xl px-3 py-2 text-sm w-full">
      <input id="sfPass" type="password" placeholder="Password + security token" autocomplete="off" class="border rounded-xl px-3 py-2 text-sm w-full">
      <button type="button" onclick="connectSystem('salesforce')" class="bg-blue-600 text-white text-sm px-4 py-2.5 rounded-xl">Connect (live verify)</button>
      <p id="connMsg" class="text-xs text-gray-500"></p>
      <p class="text-[11px] text-gray-500">Wrong keys = not connected. Right keys = live API check.</p>
    </div>`;
  }
  if (system === "zendesk") {
    return `<div class="grid gap-2">
      <input id="zdSub" placeholder="subdomain (without .zendesk.com)" class="border rounded-xl px-3 py-2 text-sm">
      <input id="zdEmail" placeholder="admin email" class="border rounded-xl px-3 py-2 text-sm">
      <input id="zdTok" autocomplete="new-password" type="password" placeholder="API token" class="border rounded-xl px-3 py-2 text-sm">
      <button type="button" onclick="connectSystem('zendesk')" class="bg-blue-600 text-white text-sm px-4 py-2.5 rounded-xl">Connect (live verify)</button>
      <p id="connMsg" class="text-xs text-gray-500"></p>
    </div>`;
  }
  if (system === "payment") {
    return `<div class="grid gap-2">
      <select id="payProv" class="border rounded-xl px-3 py-2 text-sm"><option value="razorpay">Razorpay</option><option value="stripe">Stripe</option></select>
      <select id="payMode" class="border rounded-xl px-3 py-2 text-sm"><option value="test">Test Mode</option><option value="live">Live</option></select>
      <input id="payId" placeholder="Key ID / rzp_test_..." class="border rounded-xl px-3 py-2 text-sm">
      <input id="paySec" autocomplete="new-password" type="password" placeholder="Key Secret / sk_test_..." class="border rounded-xl px-3 py-2 text-sm">
      <button type="button" onclick="connectSystem('payment')" class="bg-blue-600 text-white text-sm px-4 py-2.5 rounded-xl">Connect (live verify)</button>
      <p id="connMsg" class="text-xs text-gray-500"></p>
      <p class="text-[11px] text-gray-400">Real provider API check. Invalid keys → AUTH_FAILED.</p>
    </div>`;
  }
  if (system === "slack") {
    return `<div class="grid gap-2">
      <input id="slUrl" placeholder="https://hooks.slack.com/services/..." class="border rounded-xl px-3 py-2 text-sm">
      <button type="button" onclick="connectSystem('slack')" class="bg-blue-600 text-white text-sm px-4 py-2.5 rounded-xl">Connect (live verify)</button>
      <p id="connMsg" class="text-xs text-gray-500"></p>
    </div>`;
  }
  return "";
}

function buildDrawer(filter) {
  const q = (filter || "").toLowerCase();
  const el = document.getElementById("drawerNav");
  if (!el) return;
  el.innerHTML = NAV.map(g => {
    const items = g.i.filter(i => !q || i.l.toLowerCase().includes(q) || i.id.includes(q));
    if (!items.length) return "";
    return `<div class="px-3 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">${esc(g.g)}</div>` +
      items.map(i => `<button type="button" class="w-full text-left px-4 py-2.5 flex items-center gap-2 ${cur===i.id?"bg-gray-900 text-white":"hover:bg-gray-100 text-gray-800"}" onclick="go('${i.id}')"><i class="fas ${i.icon} text-xs w-4 text-center opacity-70"></i><span>${esc(i.l)}</span></button>`).join("");
  }).join("");
}

function go(id) {
  cur = id;
  toggleMenu(false);
  const sh = document.getElementById("searchHits");
  if (sh) sh.classList.add("hidden");
  const bs = document.getElementById("bottomSearch");
  if (bs) bs.value = "";
  const it = all().find(x => x.id === id);
  const top = document.getElementById("topSub");
  if (top) top.textContent = it ? it.l : "Console";
  buildDrawer();
  render();
}

function onSearchInput(val) {
  const q = (val || "").toLowerCase().trim();
  const box = document.getElementById("searchHits");
  if (!box) return;
  if (!q) { box.classList.add("hidden"); box.innerHTML = ""; return; }
  const hits = all().filter(x => x.l.toLowerCase().includes(q) || x.id.includes(q) || (x.g||"").toLowerCase().includes(q));
  if (!hits.length) {
    box.innerHTML = `<div class="p-3 text-sm text-gray-400">No modules match</div>`;
    box.classList.remove("hidden");
    return;
  }
  box.innerHTML = hits.slice(0, 20).map(h =>
    `<button type="button" class="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 text-sm" onclick="go('${h.id}')"><span class="font-medium">${esc(h.l)}</span><span class="text-xs text-gray-400 ml-2">${esc(h.g)}</span></button>`
  ).join("");
  box.classList.remove("hidden");
}

function render() {
  const main = document.getElementById("main");
  if (!main) return;
  const cs = (S && S.connectedSystems) || {};
  const m = (S && S.metrics) || {};
  const views = {
    home: () => `<div class="space-y-4">
      <div class="text-center py-2">
        <h1 class="text-xl font-semibold tracking-tight">Aapka AI Console</h1>
        <p class="text-xs text-gray-500 mt-1">6 workspaces · this company only · Menu ☰ or search</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button type="button" onclick="go('ops-overview')" class="text-left p-4 rounded-2xl border border-gray-200 bg-white hover:border-indigo-300 shadow-sm">
          <div class="text-indigo-600 text-sm font-semibold"><i class="fas fa-gauge-high mr-1"></i> 1. Overview</div>
          <p class="text-[11px] text-gray-500 mt-1">Cases, automation summary, live status</p>
        </button>
        <button type="button" onclick="go('agent-desk')" class="text-left p-4 rounded-2xl border border-gray-200 bg-white hover:border-indigo-300 shadow-sm">
          <div class="text-indigo-600 text-sm font-semibold"><i class="fas fa-headset mr-1"></i> 2. Employee Desk</div>
          <p class="text-[11px] text-gray-500 mt-1">Inbox, reply, suggested next steps</p>
        </button>
        <button type="button" onclick="go('ops-analytics')" class="text-left p-4 rounded-2xl border border-gray-200 bg-white hover:border-indigo-300 shadow-sm">
          <div class="text-indigo-600 text-sm font-semibold"><i class="fas fa-chart-line mr-1"></i> 3. CEO / ROI</div>
          <p class="text-[11px] text-gray-500 mt-1">Hours saved style metrics for leadership</p>
        </button>
        <button type="button" onclick="go('ops-integ')" class="text-left p-4 rounded-2xl border border-gray-200 bg-white hover:border-indigo-300 shadow-sm">
          <div class="text-indigo-600 text-sm font-semibold"><i class="fas fa-plug mr-1"></i> 4. Integrations</div>
          <p class="text-[11px] text-gray-500 mt-1">Salesforce, Zendesk, Payment — company keys</p>
        </button>
        <button type="button" onclick="go('hist-overview')" class="text-left p-4 rounded-2xl border border-gray-200 bg-white hover:border-indigo-300 shadow-sm">
          <div class="text-indigo-600 text-sm font-semibold"><i class="fas fa-clock-rotate-left mr-1"></i> 5. History & Audit</div>
          <p class="text-[11px] text-gray-500 mt-1">Only this company — other tenants never shown</p>
        </button>
        <a id="homeCust" href="/customer" class="text-left p-4 rounded-2xl border border-gray-200 bg-white hover:border-indigo-300 shadow-sm block">
          <div class="text-indigo-600 text-sm font-semibold"><i class="fas fa-comments mr-1"></i> 6. Customer Portal</div>
          <p class="text-[11px] text-gray-500 mt-1">Help / refund UI (or use company Customer link)</p>
        </a>
      </div>
      <p class="text-[11px] text-amber-800 bg-amber-50 rounded-xl px-3 py-2">Connect boxes: company enters own credentials. Live bank refund only after Payment gateway is connected and approved — otherwise local demo receipt only.</p>
    </div>`,


    command: () => card("Command Center", `
      <div class="grid grid-cols-2 gap-2 mb-3">
        ${kpi("Hours", m.human_hours_saved||0)}${kpi("USD", m.salary_leak_prevented||0)}
        ${kpi("Refunds", m.refunds_processed||0)}${kpi("Open cases", (S && (S.openCasesCount != null ? S.openCasesCount : numVal(S.openCases))) || 0)}
      </div>
      <p class="text-xs text-gray-500">Live snapshot every few seconds. All actions write to tenant-safe history.</p>
    `),

    "live-queue": () => card("Live Queue", `<p class="text-sm text-gray-600 mb-2">Open customer portal to inject refund / complex cases.</p>
      <a href="/customer" class="inline-block text-sm bg-gray-900 text-white px-4 py-2.5 rounded-xl">Open /customer</a>
      <a href="/employee" class="inline-block text-sm border ml-2 px-4 py-2.5 rounded-xl">Open /employee</a>`),

    "agent-desk": () => {
      const cases = (S && S.cases) || [];
      const open = cases.filter(c => c.status !== "Resolved");
      const refunds = cases.filter(c => c.type === "refund").length;
      return card("Agent Desk", `
        <p class="text-sm mb-2">Inbox for escalations + auto-refund trail.</p>
        <div class="grid grid-cols-2 gap-2 mb-3">
          ${kpi("Open", open.length, open.length ? "text-amber-600" : "")}
          ${kpi("Auto-refunds", refunds)}
        </div>
        <button type="button" onclick="go('cases')" class="text-sm bg-indigo-600 text-white px-4 py-2.5 rounded-xl">View Cases</button>
        <button type="button" onclick="go('hist-refunds')" class="text-sm border ml-2 px-4 py-2.5 rounded-xl">Refund History</button>
      `);
    },

    autopilot: () => {
      const cases = (S && S.cases) || [];
      if (!cases.length) return card("1-Click Autopilot", `<p class="text-sm text-gray-500">No open cases. From /customer send “complex problem”.</p>`);
      return card("1-Click Autopilot", cases.map(c => `
        <div class="border border-gray-100 rounded-xl p-3 mb-2">
          <div class="font-medium text-sm">${esc(c.id)} · ${esc(c.customerName)} · ${esc(c.priority)}</div>
          <p class="text-xs text-gray-500 mt-1">${esc((c.summary||"").slice(0,160))}</p>
          <div class="flex flex-wrap gap-2 mt-2">${(c.actions||[]).map(a =>
            `<button type="button" onclick="runAction('${esc(c.id)}',${a.id})" class="text-xs px-3 py-1.5 rounded-lg bg-gray-900 text-white">${esc(a.title)}</button>`
          ).join("")}</div>
        </div>`).join(""));
    },

    "vip-lane": () => card("VIP Priority Lane", `<p class="text-sm text-gray-600">Premium tier customers get PRIORITY routing on refund and complex paths. Tier comes from customer record (CRM when connected).</p>
      <p class="text-xs text-gray-400 mt-2">VIP protected count: ${esc(m.vip_churn_stopped||0)}</p>`),

    lockout: () => card("Context Lockout", `
      <p class="text-sm mb-3">Deactivating subscription locks customer/agent automation and returns 8-hour load.</p>
      <p class="text-sm mb-3">Status: <strong>${esc(S && S.subscription)}</strong></p>
      <button type="button" onclick="toggleSub()" class="text-sm px-4 py-2.5 rounded-xl ${S && S.isSubscriptionActive ? "bg-red-600 text-white":"bg-emerald-600 text-white"}">
        ${S && S.isSubscriptionActive ? "Deactivate engine" : "Reactivate engine"}
      </button>
    `),

    "ops-overview": () => histPanel("Operations Overview", "/api/ops/overview", d => `
      <div class="grid grid-cols-2 gap-3 mb-3">
        ${kpi("Cases", (d.actual||{}).cases_total||0)}
        ${kpi("Investigating", (d.actual||{}).cases_investigating||0, "text-amber-600")}
        ${kpi("Resolved", (d.actual||{}).cases_resolved||0, "text-emerald-600")}
        ${kpi("Refunds", (d.actual||{}).confirmed_refunds||0)}
      </div>
      <p class="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl mb-2">${esc(d.demo_notice||"")}</p>
      <p class="text-xs text-gray-500">Est. hours: ${esc((d.estimated||{}).employee_hours_saved)} — ${esc((d.estimated||{}).method||"")}</p>
    `),

    "ops-c360": () => histPanel("Customer 360", "/api/history/customers", d =>
      table(["ID","Name","Tier","Orders"], (d.customers||[]).map(c =>
        `<tr class="border-b border-gray-100"><td class="py-2"><button type="button" class="text-indigo-600" onclick="goCustomer('${esc(c.customer_id)}')">${esc(c.customer_id)}</button></td><td>${esc(c.name)}</td><td>${esc(c.tier)}</td><td>${c.order_count}</td></tr>`
      ))
    ),

    "ops-cases": () => histPanel("Case Management", "/api/ops/employee-workspace", d =>
      table(["Case","Customer","Priority","Status"], (d.assigned_cases||[]).map(c =>
        `<tr class="border-b border-gray-100"><td class="py-2 text-xs">${esc(c.id)}</td><td>${esc(c.customerName)}</td><td>${esc(c.priority)}</td><td>${esc(c.status)}</td></tr>`
      ))
    ),

    "ops-orders": () => histPanel("Order & Payment Intel", "/api/history/orders", d =>
      table(["Order","Payment","Refund","Amt"], (d.orders||[]).map(o =>
        `<tr class="border-b border-gray-100"><td class="py-2 text-xs">${esc(o.order_id)}</td><td>${esc(o.payment_status)}</td><td>${esc(o.refund_status)}</td><td>${esc(o.amount)}</td></tr>`
      ))
    ),

    "ops-refund": () => card("Refund Automation", `
      <p class="text-sm text-gray-600 mb-3">Dry-run validates eligibility without moving money. Result stays until you Clear.</p>
      <input id="dryOid" placeholder="Order ID e.g. ORD-5566" class="w-full border rounded-xl px-3 py-2 text-sm mb-2">
      <div class="flex gap-2 flex-wrap">
        <button type="button" onclick="runDryRefund()" class="bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl">Run dry-run</button>
        <button type="button" onclick="clearDryRun()" class="border border-gray-300 text-gray-700 text-sm px-4 py-2.5 rounded-xl">Clear</button>
      </div>
      <pre id="dryOut" class="text-xs bg-gray-50 p-3 rounded-xl mt-3 whitespace-pre-wrap min-h-[3rem]">${esc(dryRunLastResult || "")}</pre>
    `),

    "ops-ai": () => card("AI Investigation", `
      <p class="text-sm text-gray-600 mb-3">Rule-based evidence from OrderDB (not fake LLM certainty).</p>
      <select id="invCid" class="w-full border rounded-xl px-3 py-2 text-sm mb-2">
        <option>CUST001</option><option>CUST002</option><option>CUST003</option><option>CUST004</option><option>CUST005</option>
      </select>
      <button type="button" onclick="runInvestigate()" class="bg-indigo-600 text-white text-sm px-4 py-2.5 rounded-xl">Investigate</button>
      <pre id="invOut" class="text-xs bg-gray-50 p-3 rounded-xl mt-3 whitespace-pre-wrap"></pre>
    `),

    "ops-integ": () => histPanel("Integration Center", "/api/ops/integrations", d => `
      <p class="text-xs text-gray-500 mb-2">Secrets never returned on GET. Status CONNECTED only after live verify.</p>
      <pre class="text-xs bg-gray-50 p-2 rounded-xl overflow-auto mb-3">${esc(JSON.stringify({builtin:d.builtin, custom:(d.custom||[]).map(x=>({id:x.id,name:x.name,provider:x.provider,status:x.status}))}, null, 2))}</pre>
      <div class="grid gap-2">
        <input id="inName" placeholder="Integration name" class="border rounded-xl px-3 py-2 text-sm">
        <input id="inProvider" placeholder="Provider" class="border rounded-xl px-3 py-2 text-sm">
        <input id="inUrl" placeholder="https://api.example.com" class="border rounded-xl px-3 py-2 text-sm">
        <input id="inKey" type="password" placeholder="API key" class="border rounded-xl px-3 py-2 text-sm">
        <button type="button" onclick="addInteg()" class="bg-blue-600 text-white text-sm px-4 py-2.5 rounded-xl">Save integration</button>
        <p id="inMsg" class="text-xs text-gray-500"></p>
      </div>
    `),

    "ops-map": () => histPanel("Field Mapping", "/api/ops/field-mappings", d =>
      table(["Source","Internal","Status"], (d.mappings||[]).map(m =>
        `<tr class="border-b border-gray-100"><td class="py-2 text-xs">${esc(m.source_field)}</td><td>${esc(m.internal_field)}</td><td>${esc(m.status)}</td></tr>`
      )) + `<p class="text-[11px] text-gray-400 mt-2">${esc(d.note||"")}</p>`
    ),

    "ops-employee": () => histPanel("Employee Workspace", "/api/ops/employee-workspace", d =>
      table(["Case","Customer","Priority"], (d.priority_queue||[]).map(c =>
        `<tr class="border-b border-gray-100"><td class="py-2 text-xs">${esc(c.id)}</td><td>${esc(c.customerName)}</td><td>${esc(c.priority)}</td></tr>`
      ))
    ),

    "ops-analytics": () => histPanel("Analytics & ROI", "/api/ops/overview", d => `
      <div class="grid grid-cols-2 gap-3">
        ${kpi("Hours est", (d.estimated||{}).employee_hours_saved||0)}
        ${kpi("USD est", (d.estimated||{}).operating_cost_saved_usd||0, "text-emerald-600")}
        ${kpi("API error %", (d.actual||{}).api_error_rate||0)}
        ${kpi("Refunds", (d.actual||{}).confirmed_refunds||0)}
      </div>
      <p class="text-xs text-gray-500 mt-3">${esc((d.estimated||{}).method||"")}</p>
    `),

    "ops-health": () => histPanel("System Health", "/api/ops/health", d =>
      `<pre class="text-xs bg-gray-50 p-3 rounded-xl overflow-auto">${esc(JSON.stringify(d, null, 2))}</pre>`
    ),

    "ops-billing": () => histPanel("Billing & Usage", "/api/ops/billing", d => `
      <p class="text-sm">Plan <strong>${esc(d.plan)}</strong> · ${esc(d.status)} · $${esc(d.price_usd)}/mo</p>
      <pre class="text-xs bg-gray-50 p-3 rounded-xl mt-2">${esc(JSON.stringify(d.usage, null, 2))}</pre>
      <p class="text-xs text-gray-500 mt-2">${esc(d.note||"")}</p>
    `),

    "ops-rbac": () => histPanel("Admin & Roles", "/api/ops/rbac", d =>
      `<ul class="text-sm">${(d.roles||[]).map(r => `<li class="border-b border-gray-100 py-2">${esc(r)}</li>`).join("")}</ul>
       <p class="text-xs text-gray-500 mt-2">${esc(d.note||"")}</p>`
    ),

    "ops-comm": () => card("Communication Templates", `<p class="text-sm text-gray-600">Templates only until email/SMS provider connected. Never tell customer refund is complete without provider confirmation.</p>
      <ul class="text-sm mt-2 space-y-1"><li class="border-b py-2">Refund request acknowledgment</li><li class="border-b py-2">Refund confirmed (provider only)</li></ul>`),

    "ops-sla": () => card("SLA Rules", `<p class="text-sm">Ack target: 90s · Premium resolve: 4h · Standard: 24h (configurable per tenant).</p>`),

    "hist-overview": () => histPanel("History Overview", "/api/history/overview", d => `
      <div class="grid grid-cols-2 gap-3 mb-3">
        ${kpi("Events", d.total_events||0)}
        ${kpi("Confirmed refunds", d.confirmed_refunds||0, "text-emerald-600")}
        ${kpi("Pending refunds", d.pending_refunds||0, "text-amber-600")}
        ${kpi("API error %", d.api_error_rate||0, "text-red-600")}
      </div>
      <p class="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl">${esc(d.demo_notice||"")}</p>
    `),

    "hist-customers": () => histPanel("Customer History", "/api/history/customers", d =>
      table(["Customer","Tier","Orders","Refunds"], (d.customers||[]).map(c =>
        `<tr class="border-b border-gray-100"><td class="py-2"><button type="button" class="text-indigo-600" onclick="goCustomer('${esc(c.customer_id)}')">${esc(c.customer_id)}</button><div class="text-xs text-gray-500">${esc(c.name)}</div></td><td>${esc(c.tier)}</td><td>${c.order_count}</td><td>${c.refund_count}</td></tr>`
      ))
    ),

    "hist-orders": () => histPanel("Order History", "/api/history/orders", d =>
      table(["Order","Customer","Payment","Refund","Amt"], (d.orders||[]).map(o =>
        `<tr class="border-b border-gray-100"><td class="py-2 text-xs font-mono">${esc(o.order_id)}</td><td class="text-xs">${esc(o.customer_id)}</td><td>${esc(o.payment_status)}</td><td>${esc(o.refund_status)}</td><td>${esc(o.amount)}</td></tr>`
      ))
    ),

    "hist-refunds": () => histPanel("Refund History", "/api/history/refunds", d =>
      `<p class="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl mb-3">${esc(d.demo_notice||"")}</p>` +
      table(["Refund","Order","Status","Financial","Amt"], (d.refunds||[]).map(r =>
        `<tr class="border-b border-gray-100"><td class="py-2 text-xs font-mono">${esc(r.refund_request_id)}</td><td class="text-xs">${esc(r.order_id)}</td><td>${esc(r.status)}</td><td class="text-xs">${esc(r.financial_state)}</td><td>${esc(r.requested_amount)}</td></tr>`
      ))
    ),

    "hist-activity": () => histPanel("Activity", "/api/history/activity", d =>
      table(["Time","Actor","Action","Detail"], (d.activity||[]).slice(0,80).map(a =>
        `<tr class="border-b border-gray-100"><td class="py-2 text-xs">${esc((a.timestamp||"").slice(0,19))}</td><td>${esc(a.actor_type)}</td><td>${esc(a.action)}</td><td class="text-xs">${esc(a.detail)}</td></tr>`
      ))
    ),

    "hist-api": () => histPanel("API Logs", "/api/history/api-logs", d =>
      table(["Time","Route","Status","ms"], (d.logs||[]).map(l =>
        `<tr class="border-b border-gray-100"><td class="py-2 text-xs">${esc((l.request_timestamp||"").slice(0,19))}</td><td class="text-xs">${esc(l.api_route)}</td><td>${esc(l.http_status)}</td><td>${esc(l.duration_ms)}</td></tr>`
      ))
    ),

    "hist-security": () => histPanel("Security Audit", "/api/history/security-audit", d =>
      table(["Time","Event","Outcome","Hash"], (d.events||[]).map(e =>
        `<tr class="border-b border-gray-100"><td class="py-2 text-xs">${esc((e.timestamp||"").slice(0,19))}</td><td class="text-xs">${esc(e.event_type)}</td><td>${esc(e.outcome)}</td><td class="font-mono text-[10px]">${esc((e.integrity_hash||"").slice(0,12))}…</td></tr>`
      )) + `<p class="text-[11px] text-gray-400 mt-2">Append-only · hash-chained · tenant-scoped</p>`
    ),

    "hist-impact": () => histPanel("Business Impact", "/api/history/business-impact", d => `
      <div class="grid grid-cols-2 gap-3 mb-3">
        ${kpi("Hours (est.)", d.estimated_employee_hours_saved||0)}
        ${kpi("USD (est.)", d.estimated_operating_cost_saved_usd||0, "text-emerald-600")}
        ${kpi("Refund req", d.refund_requests||0)}
        ${kpi("Confirmed", d.confirmed_refunds||0)}
      </div>
      <p class="text-xs text-gray-600">${esc(d.calculation_method||"")}</p>
    `),

    "hist-archive": () => histPanel("Deletion Jobs", "/api/history/deletion-jobs", d =>
      table(["Job","Ran","Status"], (d.jobs||[]).map(j =>
        `<tr class="border-b border-gray-100"><td class="py-2 text-xs font-mono">${esc(j.job_id)}</td><td class="text-xs">${esc((j.ran_at||"").slice(0,19))}</td><td>${esc(j.status)}</td></tr>`
      )) + `<button type="button" onclick="runCleanup()" class="mt-3 text-sm bg-gray-900 text-white px-4 py-2.5 rounded-xl">Run retention cleanup</button>`
    ),

    "hist-retention": () => histPanel("Retention & Privacy", "/api/history/retention-policy", d => {
      const p = d.policy || {};
      return `<div class="text-sm space-y-2">${Object.keys(p).filter(k => String(k).endsWith("_days")).map(k =>
        `<div class="flex justify-between border-b border-gray-100 py-2"><span>${esc(k)}</span><strong>${esc(p[k])} days</strong></div>`
      ).join("")}</div>
      <p class="text-[11px] text-gray-400 mt-3">Per-tenant. History is not wiped on soft restart (workspace file). Redeploy may reset free disk.</p>
      <button type="button" onclick="runCleanup()" class="mt-3 text-sm border px-4 py-2.5 rounded-xl">Apply cleanup</button>`;
    }),

    "int-sf": () => card("Salesforce Connect", connectForm("salesforce") + `<p class="text-xs mt-2">${badge(cs.Salesforce === "CONNECTED")} ${esc(cs.Salesforce || "NOT CONNECTED")}</p>`),
    "int-zd": () => card("Zendesk Connect", connectForm("zendesk") + `<p class="text-xs mt-2">${badge(cs.Zendesk === "CONNECTED")} ${esc(cs.Zendesk || "NOT CONNECTED")}</p>`),
    "int-pay": () => card("Payment Gateway", connectForm("payment") + `<p class="text-xs mt-2">${badge(cs.Payment === "CONNECTED")} ${esc(cs.Payment || "NOT CONNECTED")}</p>`),
    "int-slack": () => card("Slack Webhook", connectForm("slack") + `<p class="text-xs mt-2">${badge(cs.Slack === "CONNECTED")} ${esc(cs.Slack || "NOT CONNECTED")}</p>`),
    "int-email": () => card("Email / Slack", `<p class="text-sm">Email: ${badge(cs.Email === "CONNECTED")} · OrderDB: ${badge(cs.OrderDB === "CONNECTED")}</p>`),
    "int-health": () => card("Integration Health", `<pre class="text-xs bg-gray-50 p-3 rounded-xl">${esc(JSON.stringify(cs, null, 2))}</pre>`),

    cases: () => {
      const cases = (S && S.cases) || [];
      const open = cases.filter(c => c.status !== "Resolved");
      const recent = cases.slice(0, 40);
      if (!recent.length) {
        return card("Cases", `<p class="text-sm text-gray-500">No cases yet. Customer portal → Refund or Complex problem.</p>`);
      }
      return card("Cases", `
        <p class="text-xs text-gray-500 mb-2">Open: <b>${open.length}</b> · Total shown: ${recent.length} (incl. auto-refunds)</p>
        ${table(["ID","Customer","Type","Status","Priority"], recent.map(c =>
          `<tr class="border-b border-gray-100"><td class="py-2 text-xs font-mono">${esc(c.id)}</td><td>${esc(c.customerName||"")}</td><td class="text-xs">${esc(c.type||(c.title||"").split("—")[0]||"—")}</td><td>${esc(c.status)}</td><td>${esc(c.priority||"")}</td></tr>`
        ))}
      `);
    },

    orders: () => card("Orders Workspace", `<button type="button" onclick="go('ops-orders')" class="text-sm text-indigo-600">Open Order & Payment Intel →</button>`),
    receipts: () => card("Crypto Receipts", `<p class="text-sm">Receipts generated on refund path with SHA-256 hash. See Refund History for DEMO_LOCAL labels.</p>
      <button type="button" onclick="go('hist-refunds')" class="text-sm text-indigo-600 mt-2">Refund History →</button>`),
    webhooks: () => card("Webhook Log", `<p class="text-sm text-gray-600">Sales/Tech alert events fire on refund and complex escalation (in-app log).</p>`),
    export: () => card("Export Audit", `<button type="button" onclick="exportAudit()" class="text-sm bg-gray-900 text-white px-4 py-2.5 rounded-xl">Download audit JSON</button>`),
    roi: () => card("ROI Counters", `<div class="grid grid-cols-2 gap-3">${kpi("Hours", m.human_hours_saved||0)}${kpi("USD", m.salary_leak_prevented||0, "text-emerald-600")}${kpi("VIP", m.vip_churn_stopped||0)}${kpi("Autos", m.total_automations||0)}</div>`),
    "cancel-impact": () => card("Cancel Impact", `<p class="text-sm">Turning off restores ~4.5h queues and full manual Salesforce+Zendesk+OrderDB path.</p>
      <button type="button" onclick="go('lockout')" class="text-sm border mt-2 px-4 py-2.5 rounded-xl">Open Lockout</button>`),
    benefits: () => card("Enterprise Benefits", `<ul class="text-sm space-y-2 list-disc pl-4"><li>1-click refund + receipt</li><li>Complex case autopilot</li><li>Tenant-isolated history</li><li>Live integration verify</li><li>Lockout switching cost</li></ul>`),
    activity: () => histPanel("Activity Feed", "/api/history/activity", d =>
      table(["Time","Actor","Action"], (d.activity||[]).slice(0,40).map(a =>
        `<tr class="border-b border-gray-100"><td class="py-2 text-xs">${esc((a.timestamp||"").slice(0,19))}</td><td>${esc(a.actor_type)}</td><td>${esc(a.action)}</td></tr>`
      ))
    ),

    notif: () => card("Notifications", `<p class="text-sm">Unread alerts from escalations appear here after complex cases.</p>`),
    "soft-lock": () => card("Soft Lock", `<p class="text-sm">Reduced automation mode without full pipeline lock. Configure via CEO soft-lock API.</p>`),
    plan: () => card("Subscription Plan", `<p class="text-sm">Enterprise plan surface. Commercial price is contractual — not a fixed $100k claim.</p><button type="button" onclick="go('ops-billing')" class="text-sm text-indigo-600 mt-2">Billing →</button>`),
    "metrics-detail": () => card("Metrics Detail", `<button type="button" onclick="go('roi')" class="text-sm text-indigo-600">ROI Counters →</button>`),
    "case-categories": () => card("Case Categories", `<ul class="text-sm space-y-1 list-disc pl-4"><li>Payment Successful, Order Failed</li><li>Booking Confirmation Missing</li><li>Duplicate Payment</li><li>Refund Request</li><li>Provider Integration Failure</li></ul>`),
    "priority-rules": () => card("Priority Rules", `<p class="text-sm">Premium → Critical queue. Standard → High. Financial controls never bypassed by tier alone.</p>`),
    "approval-matrix": () => card("Approval Matrix", `<p class="text-sm">Refund policy: dry-run default on; provider execute off until company enables. Amount thresholds configurable.</p><button type="button" onclick="go('ops-refund')" class="text-sm text-indigo-600">Refund Automation →</button>`),
    "dry-run-log": () => card("Dry-Run Log", `<p class="text-sm">Use Refund Automation dry-run. Results are validation only.</p>`),
    "provider-recon": () => card("Provider Reconciliation", `<p class="text-sm">On timeout, reconcile before retry. Blind financial retries blocked.</p>`),
    idempotency: () => card("Idempotency", `<p class="text-sm">Refund requests carry idempotency keys to prevent duplicates.</p>`),
    "corr-ids": () => card("Correlation IDs", `<p class="text-sm">API and security events include correlation_id for tracing.</p>`),
    "rate-limits": () => card("Rate Limits", `<p class="text-sm">Provider rate-limit handling and backoff on outbound adapters.</p>`),
    "circuit-breakers": () => card("Circuit Breakers", `<p class="text-sm">When provider unavailable, cases stay open — no invented success.</p>`),
    "dead-letter": () => card("Dead Letter", `<p class="text-sm">Failed jobs retained for manual recovery (deletion_jobs / sync failures).</p>`),
    "sync-jobs": () => card("Sync Jobs", `<p class="text-sm">Historical sync is import-only — never auto financial action.</p>`),
    checkpoints: () => card("Checkpoints", `<p class="text-sm">Failed sync keeps checkpoint for safe resume.</p>`),
    "field-preview": () => card("Import Preview", `<p class="text-sm">Field mapping preview before import. No silent name-based merges.</p>`),
    "mapping-versions": () => card("Mapping Versions", `<button type="button" onclick="go('ops-map')" class="text-sm text-indigo-600">Field Mapping →</button>`),
    "tenant-info": () => card("Tenant Isolation", `<p class="text-sm">Each company = workspace_*.json. Cross-tenant access attempts audited and blocked.</p>`),
    "export-jobs": () => card("Export Jobs", `<button type="button" onclick="exportAudit()" class="text-sm bg-gray-900 text-white px-4 py-2.5 rounded-xl">Export audit now</button>`),
    "legal-hold": () => card("Legal Hold", `<p class="text-sm">Retention cleanup skips records under legal hold (policy surface).</p>`),
    "data-minimization": () => card("Data Minimization", `<p class="text-sm">API bodies not logged by default. Secrets excluded from exports.</p>`),
    "masked-pii": () => card("Masked PII", `<p class="text-sm">Customer list views show masked email/phone.</p>`),
    "backup-notes": () => card("Backup & Recovery", `<p class="text-sm">Workspace JSON is the durable store on disk. Production should use persistent volume or Postgres.</p>`),
    incident: () => card("Incident Response", `<p class="text-sm">Security audit trail is append-only with hash chain for investigation.</p>`),
    "api-docs": () => card("API Surface", `<p class="text-xs font-mono">/api/ops/* · /api/history/* · /api/integrations/* · /api/chat · /api/cases</p>`),
    "usage-alerts": () => card("Usage Alerts", `<button type="button" onclick="go('ops-billing')" class="text-sm text-indigo-600">Billing & Usage →</button>`),
    overage: () => card("Overage Rules", `<p class="text-sm">Commercial overage is contract-configured, not hardcoded.</p>`),
    trial: () => card("Trial / Contract", `<p class="text-sm">Trial and enterprise contract flags live under billing surface.</p>`),
    offboarding: () => card("Safe Offboarding", `<p class="text-sm">Documented export + tenant data isolation. No artificial lock-in via inaccessible data.</p>`),
    "employee-perf": () => card("Employee Workload", `<p class="text-sm">Workload views are operational aids — not sole performance scoring from AI estimates.</p>`),
    "baseline-time": () => card("Baseline Handling Time", `<p class="text-sm">ROI uses documented 15 min/event baseline assumption — labeled ESTIMATED.</p>`),
    "net-benefit": () => card("Net Benefit Model", `<p class="text-sm">Gross labor value − incremental platform cost. Assumptions shown on Analytics.</p>`),

    about: () => card("About Aapka AI", `<p class="text-sm text-gray-600 leading-relaxed">Invisible Enterprise Brain — BYO Salesforce, Zendesk, Payment. Live credential verify. Refunds: DEMO local status until provider confirms. History tenant-isolated. Modules: ${all().length}+.</p>`),
  };

  const fn = views[cur];
  if (!fn) {
    main.innerHTML = card(cur, `<p class="text-sm text-gray-500">Module loading…</p>`);
    return;
  }
  snapshotDrafts();
  const out = fn();
  if (out && typeof out.then === "function") {
    /* async histPanel already writes main */
    setTimeout(restoreDrafts, 0);
  } else if (typeof out === "string") {
    main.innerHTML = out;
    restoreDrafts();
  }
}

async function load(doRender) {
  if (doRender === undefined) doRender = true;
  try {
    if (doRender) snapshotDrafts();
    const r = await apiFetch("/api/console/snapshot");
    if (!r.ok) {
      if (doRender) document.getElementById("main").innerHTML = card("API error", esc(await r.text()));
      return;
    }
    S = await r.json();
    const b = document.getElementById("liveBadge");
    if (b) {
      b.textContent = S.isSubscriptionActive ? "Live OK" : "LOCKED";
      b.className = "text-[10px] px-2 py-1 rounded-full font-medium " + (S.isSubscriptionActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700");
    }
    if (doRender) {
      render();
      restoreDrafts();
    }
  } catch (e) {
    if (doRender) document.getElementById("main").innerHTML = `<p class="text-center text-red-500 text-sm py-20">${esc(String(e))}</p>`;
  }
}

async function runAction(caseId, actionId) {
  const r = await apiFetch("/api/cases/" + caseId + "/action", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({action_id: actionId})
  });
  const d = await r.json();
  alert(d.success ? d.message : (d.error || d.message || "Failed"));
  await load();
}

async function toggleSub() {
  if (!S) return;
  const next = !S.isSubscriptionActive;
  if (!next && !confirm("Deactivate? Customer & agent APIs lock. Queue impact ~4.5 hours.")) return;
  await apiFetch("/api/ceo/toggle-subscription", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({active: next})
  });
  await load();
}

async function exportAudit() {
  const r = await apiFetch("/api/export/audit");
  if (!r.ok) { alert("Export failed or locked"); return; }
  const d = await r.json();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], {type:"application/json"}));
  a.download = "aapka-audit-" + Date.now() + ".json";
  a.click();
}

/* Wire bottom search if present */
document.addEventListener("DOMContentLoaded", function() {
  const bs = document.getElementById("bottomSearch");
  if (bs) {
    bs.addEventListener("input", function() { onSearchInput(this.value); });
    bs.addEventListener("focus", function() { if (this.value) onSearchInput(this.value); });
  }
  const menuBtn = document.getElementById("menuBtn");
  if (menuBtn) menuBtn.addEventListener("click", function() { toggleMenu(); });
  const overlay = document.getElementById("overlay");
  if (overlay) overlay.addEventListener("click", function() { toggleMenu(false); });
});

buildDrawer();
(function() {
  try {
    const g = new URLSearchParams(location.search).get("go");
    if (g && all().some(x => x.id === g)) go(g);
    else go("home");
  } catch (e) { go("home"); }
})();
load();
function isTyping() {
  const a = document.activeElement;
  if (!a) return false;
  const tag = (a.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || a.isContentEditable;
}
function snapshotDrafts() {
  window.__drafts = window.__drafts || {};
  ["sfUrl","sfId","sfSec","zdSub","zdEmail","zdTok","payId","paySec","payProv","payMode","inName","inProvider","inUrl","inKey"].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) window.__drafts[id] = el.value;
  });
}
function restoreDrafts() {
  const d = window.__drafts || {};
  Object.keys(d).forEach(function(id) {
    const el = document.getElementById(id);
    if (el && d[id] != null) el.value = d[id];
  });
}
/* Never wipe inputs while user is typing — poll data only */
setInterval(function() { load(!isTyping()); }, 12000);


async function loadCompanyBadge(){
  try {
    const r = await apiFetch("/api/company/me");
    const d = await r.json();
    const b = document.getElementById("companyBadge");
    if (b) b.textContent = (d.tenant && d.tenant.name) ? d.tenant.name : (d.workspace_id || WS_ID);
    const a = document.getElementById("custLink");
    if (a && d.customer_link) a.href = d.customer_link;
    const ban = document.getElementById("wsBanner");
    if (ban) {
      if ((d.workspace_id || WS_ID) === "default") {
        ban.classList.remove("hidden");
        ban.innerHTML = '⚠️ Demo workspace (default). Company links बनाओ: <a class="underline font-semibold" href="/owner">/owner</a> — हर company का अलग pair.';
      } else {
        ban.classList.add("hidden");
      }
    }
  } catch(e) {}
}
loadCompanyBadge();

/* ── Google profile badge ── */
async function loadProfileBadge(){
  try{
    const r = await fetch("/api/auth/me", {credentials:"same-origin"});
    if(r.status === 401){ location.href = "/login?next=" + encodeURIComponent(location.pathname); return; }
    const d = await r.json();
    if(!d.logged_in || !d.user){
      location.href = "/login?next=" + encodeURIComponent(location.pathname);
      return;
    }
    const u = d.user;
    const btn = document.getElementById("profileBtn");
    const name = u.display_name || u.name || u.email || "?";
    const initial = (u.initial || name[0] || "?").toUpperCase();
    if(btn) btn.textContent = initial;
    const pn = document.getElementById("profileName");
    const pe = document.getElementById("profileEmail");
    if(pn) pn.textContent = name;
    if(pe) pe.textContent = u.email || "";
  }catch(e){
    console.warn("profile load", e);
  }
}
function toggleProfileMenu(ev){
  if(ev) ev.stopPropagation();
  const m = document.getElementById("profileMenu");
  if(!m) return;
  m.classList.toggle("hidden");
}
document.addEventListener("click", function(){
  const m = document.getElementById("profileMenu");
  if(m) m.classList.add("hidden");
});
function openEditProfile(){
  const m = document.getElementById("profileMenu");
  if(m) m.classList.add("hidden");
  const modal = document.getElementById("editProfileModal");
  const input = document.getElementById("editNameInput");
  const pn = document.getElementById("profileName");
  if(input) input.value = (pn && pn.textContent) || "";
  if(modal) modal.classList.remove("hidden");
}
function closeEditProfile(){
  const modal = document.getElementById("editProfileModal");
  if(modal) modal.classList.add("hidden");
}
async function saveProfile(){
  const input = document.getElementById("editNameInput");
  const name = (input && input.value || "").trim();
  if(!name){ alert("Name required"); return; }
  try{
    const r = await fetch("/api/auth/profile", {
      method:"PATCH",
      credentials:"same-origin",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({display_name: name})
    });
    const d = await r.json();
    if(!r.ok) throw new Error(d.error || "Save failed");
    closeEditProfile();
    loadProfileBadge();
  }catch(e){ alert(String(e.message || e)); }
}
async function doLogout(){
  try{
    await fetch("/api/auth/logout", {method:"POST", credentials:"same-origin"});
  }catch(e){}
  location.href = "/login";
}
loadProfileBadge();

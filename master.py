import os, sys, time, subprocess, threading, signal
from pathlib import Path
from contextlib import asynccontextmanager
import httpx
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, Response, RedirectResponse

ROOT = Path(__file__).resolve().parent
PROCS = []

def env_for(prefix, mapping):
    e = os.environ.copy()
    for original, namespaced in mapping.items():
        val = os.getenv(namespaced)
        if val is not None and val != "": e[original] = val
    return e

def start_apps():
    jobs = [
      ([sys.executable, '-m', 'gunicorn', 'app:app', '--bind', '127.0.0.1:8101', '--workers', '1', '--timeout', '120'], ROOT/'ai_builder', env_for('builder', {
        'FLASK_SECRET_KEY':'BUILDER_FLASK_SECRET_KEY','MASTER_ENCRYPTION_KEY':'BUILDER_MASTER_ENCRYPTION_KEY','DATABASE_URL':'BUILDER_DATABASE_URL','BREVO_API_KEY':'BUILDER_BREVO_API_KEY','MAIL_FROM':'BUILDER_MAIL_FROM','GOOGLE_CLIENT_ID':'BUILDER_GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET':'BUILDER_GOOGLE_CLIENT_SECRET','NOTIFY_EMAIL':'BUILDER_NOTIFY_EMAIL'})),
      ([sys.executable, '-m', 'uvicorn', 'app:app', '--host', '127.0.0.1', '--port', '8102'], ROOT/'ai_router', env_for('router', {
        'SECRET_KEY':'ROUTER_SECRET_KEY','ADMIN_SECRET':'ROUTER_ADMIN_SECRET','DATABASE_URL':'ROUTER_DATABASE_URL','BREVO_API_KEY':'ROUTER_BREVO_API_KEY','CONTACT_PHONE':'ROUTER_CONTACT_PHONE','GOOGLE_CLIENT_ID':'ROUTER_GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET':'ROUTER_GOOGLE_CLIENT_SECRET','MAIL_FROM':'ROUTER_MAIL_FROM','PLAN_PRICE':'ROUTER_PLAN_PRICE','PLAN_60_PRICE':'ROUTER_PLAN_60_PRICE'})),
      ([sys.executable, '-m', 'gunicorn', 'app:app', '--bind', '127.0.0.1:8103', '--workers', '1', '--timeout', '120'], ROOT/'fast_ai', env_for('fastai', {
        'SECRET_KEY':'FASTAI_SECRET_KEY','MONGODB_URI':'FASTAI_MONGODB_URI','DATABASE_URL':'FASTAI_DATABASE_URL','BREVO_API_KEY':'FASTAI_BREVO_API_KEY','GOOGLE_CLIENT_ID':'FASTAI_GOOGLE_CLIENT_ID','MAIL_FROM':'FASTAI_MAIL_FROM','OWNER_EMAILS':'FASTAI_OWNER_EMAILS','AAPKA_DATA':'FASTAI_DATA_DIR'})),
    ]
    for cmd, cwd, env in jobs:
        p=subprocess.Popen(cmd, cwd=str(cwd), env=env, stdout=sys.stdout, stderr=sys.stderr)
        PROCS.append(p)

def stop_apps():
    for p in PROCS:
        try: p.terminate()
        except Exception: pass
    for p in PROCS:
        try: p.wait(timeout=5)
        except Exception:
            try: p.kill()
            except Exception: pass

@asynccontextmanager
async def lifespan(app):
    start_apps()
    yield
    stop_apps()

app=FastAPI(title='StraticSoft Hub - Test Build', lifespan=lifespan)

HOME="""<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>StraticSoft Hub</title><style>*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,Arial;background:#0b1020;color:#eef2ff;min-height:100vh}.wrap{max-width:1050px;margin:auto;padding:42px 20px}.eyebrow{color:#a5b4fc;letter-spacing:.14em;text-transform:uppercase;font-size:12px}.hero{font-size:clamp(32px,6vw,54px);margin:12px 0}.sub{color:#aab4cf;max-width:650px;line-height:1.65}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;margin-top:32px}.card{display:block;text-decoration:none;color:inherit;border:1px solid #283451;background:#111a30;border-radius:20px;padding:24px;transition:.2s}.card:hover{transform:translateY(-3px);border-color:#818cf8}.icon{font-size:28px}.card h2{margin:16px 0 8px}.card p{color:#aab4cf;line-height:1.5;min-height:48px}.open{display:inline-block;margin-top:12px;background:#4f46e5;padding:10px 15px;border-radius:10px;font-weight:700}.note{font-size:13px;color:#8c98b5;margin-top:30px;line-height:1.6}</style></head><body><main class="wrap"><div class="eyebrow">STRATICSOFT · WORKSPACE</div><h1 class="hero">StraticSoft Hub</h1><p class="sub">Your tools, one workspace. Choose a tool below to open its current build.</p><section class="grid"><a class="card" href="/builder/"><div class="icon">✦</div><h2>AI Builder</h2><p>Create and manage your AI assistants.</p><span class="open">Open AI Builder →</span></a><a class="card" href="/router/"><div class="icon">⌘</div><h2>AI Router</h2><p>Manage providers, routing and API usage.</p><span class="open">Open AI Router →</span></a><a class="card" href="/fast-ai/"><div class="icon">▦</div><h2>Fast-Ai</h2><p>Open the enterprise workspace.</p><span class="open">Open Fast-Ai →</span></a></section><p class="note">TEST BUILD: Google login is intentionally not enabled yet, as requested. Existing app authentication screens/routes have not been removed in this build, to avoid breaking app behavior. Do not use this public test build with sensitive customer data until access control is added.</p></main></body></html>"""
@app.get('/', response_class=HTMLResponse)
async def home(): return HOME
@app.get('/health')
async def health():
    return {'ok':True,'service':'StraticSoft Hub','apps':[{'name':'AI Builder','prefix':'/builder/'},{'name':'AI Router','prefix':'/router/'},{'name':'Fast-Ai','prefix':'/fast-ai/'}]}

PREFIXES={'builder':'http://127.0.0.1:8101','router':'http://127.0.0.1:8102','fast-ai':'http://127.0.0.1:8103'}
HOP={'host','content-length','connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailers','transfer-encoding','upgrade'}
@app.api_route('/{tool}/{path:path}', methods=['GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD'])
async def proxy(tool: str, path: str, request: Request):
    if tool not in PREFIXES: raise HTTPException(404,'Not found')
    upstream=PREFIXES[tool]
    # Preserve root paths for each app while keeping them under the matching hub prefix.
    target=upstream+'/'+path
    if request.url.query: target+='?'+request.url.query
    headers={k:v for k,v in request.headers.items() if k.lower() not in HOP and k.lower()!='host'}
    headers['x-forwarded-prefix']='/'+tool
    body=await request.body()
    try:
      async with httpx.AsyncClient(follow_redirects=False, timeout=120.0) as client:
        r=await client.request(request.method,target,headers=headers,content=body)
    except Exception as e:
      raise HTTPException(502, f'{tool} is starting or unavailable. Retry in a few seconds.') from e
    out_headers={k:v for k,v in r.headers.items() if k.lower() not in HOP and k.lower() not in ('content-encoding','content-length')}
    # Keep redirects inside the relevant tool prefix.
    loc=out_headers.get('location')
    if loc and loc.startswith('/') and not loc.startswith('/'+tool+'/'):
      out_headers['location']='/'+tool+loc
    content=r.content
    ctype=r.headers.get('content-type','')
    if 'text/html' in ctype or 'javascript' in ctype or 'css' in ctype:
      try:
        txt=content.decode(r.encoding or 'utf-8')
        prefix='/'+tool
        # Rewrite common root-relative URLs so assets and API calls remain in the tool proxy.
        for token in ['href="/','src="/','action="/','fetch("/','fetch(\'/','url(/','location.href="/','location.href=\'/','window.location="/','window.location=\'/']:
          replacement=token.replace('/','/'+tool+'/',1) if token.startswith('url(') else token.replace('"/','"'+prefix+'/').replace("'/","'"+prefix+'/')
          txt=txt.replace(token,replacement)
        content=txt.encode(r.encoding or 'utf-8')
      except Exception: pass
    return Response(content=content,status_code=r.status_code,headers=out_headers,media_type=None)

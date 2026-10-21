# StraticSoft Hub — test build

यह पैकेज तीनों ZIP के मूल ऐप को अलग folders में रखता है और एक Hub dashboard से उन्हें एक ही Render service के पीछे चलाने का शुरुआती integration देता है। मूल app source files को login हटाने के लिए modify नहीं किया गया है। इसीलिए AI Builder / AI Router / Fast-Ai के मौजूदा login routes/screens अभी मौजूद रह सकते हैं। Google master login इस build में जानबूझकर शामिल नहीं है।

## Deploy
1. ZIP extract करके पूरा folder एक नई GitHub repository में upload करें।
2. Render में New Web Service चुनें, repository connect करें।
3. Build command: `pip install -r requirements.txt`
4. Start command: `python master.py`
5. `render.yaml` में listed variables के साथ नीचे दी गई app-specific variables भी जरूरत के अनुसार add करें।
6. Open `/` for StraticSoft Hub. Tool paths: `/builder/`, `/router/`, `/fast-ai/`.

## Namespaced environment variables
**AI Builder:** `BUILDER_FLASK_SECRET_KEY`, `BUILDER_MASTER_ENCRYPTION_KEY`, `BUILDER_DATABASE_URL`, `BUILDER_BREVO_API_KEY`, `BUILDER_MAIL_FROM`, `BUILDER_GOOGLE_CLIENT_ID`, `BUILDER_GOOGLE_CLIENT_SECRET`, `BUILDER_NOTIFY_EMAIL`

**AI Router:** `ROUTER_SECRET_KEY`, `ROUTER_ADMIN_SECRET`, `ROUTER_DATABASE_URL`, `ROUTER_BREVO_API_KEY`, `ROUTER_CONTACT_PHONE`, `ROUTER_GOOGLE_CLIENT_ID`, `ROUTER_GOOGLE_CLIENT_SECRET`, `ROUTER_MAIL_FROM`, `ROUTER_PLAN_PRICE`, `ROUTER_PLAN_60_PRICE`

**Fast-Ai:** `FASTAI_SECRET_KEY`, `FASTAI_MONGODB_URI`, `FASTAI_DATABASE_URL`, `FASTAI_BREVO_API_KEY`, `FASTAI_GOOGLE_CLIENT_ID`, `FASTAI_MAIL_FROM`, `FASTAI_OWNER_EMAILS`, `FASTAI_DATA_DIR`

Variables are mapped to each child process's original names. Use separate secret values for each app. If you use SQLite/local files, data may be lost on redeploy unless a persistent disk is configured.

## Important limitations
- This is an integration prototype, not a verified production migration. Test all workflows, redirects, OAuth callback URLs, uploads, APIs and static assets after deployment. Root-relative paths in the apps may need app-specific proxy adjustments.
- The apps' existing auth has deliberately not been removed because removing it safely requires changing and retesting app code. Do not expose this publicly with sensitive data before a proper shared-auth/access-control layer is implemented.
- The source ZIPs are included unchanged in `ai_builder/`, `ai_router/`, `fast_ai/`.

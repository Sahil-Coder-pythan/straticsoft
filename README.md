# StratisSoft Suite — Master Tool (20-tool prototype)

This package preserves the original nine tool cards and adds eleven business-workspace prototypes, each with 40 named actions, dashboards, local history, and JSON export. The new tools perform local input parsing, simple calculations, checks, and record/history storage.

## Important deployment and security limits
- The three existing external apps (Forge, Router, Fast-AI) retain their original URLs. A static master page cannot securely bypass those apps' passwords. Password-free access from the master requires the external apps to implement server-side single sign-on or a short-lived signed handoff token. Do not put a shared password in a URL or front-end JavaScript.
- Existing and added local histories are browser-local, not durable server storage. Clearing browser data, changing device/browser, or private browsing may lose them. This build does not provide true company-to-company isolation or secure access control.
- For 30,000 companies or confidential data, use authenticated server APIs, tenant-scoped database queries, role-based authorization, audit logging, backups, and persistent storage (for example a managed database). Do not use this static prototype as a production multi-tenant security boundary.
- The new tools are practical prototypes, not integrations with live CRM/ERP/finance systems. Connect those systems and validate formulas/workflows before relying on outputs for material decisions.

## Deploy as a Render Static Site
1. Upload the extracted files to a GitHub repository.
2. In Render, create a Static Site and select that repository.
3. Set Publish Directory to `.` and deploy.

## Local test
Open `index.html` in a modern browser. Some CDN assets require an internet connection.

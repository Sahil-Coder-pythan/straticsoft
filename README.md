# StraticSoft Master Suite (Render Web Service, Node + Postgres)
Build: `npm install`   Start: `npm start`

Environment variables:
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET  (Google login)
- BREVO_API_KEY, MAIL_FROM                (verification codes + welcome mail; MAIL_FROM must be a verified Brevo sender)
- DATABASE_URL                            (Postgres connection string)
- JWT_SECRET                              (long random string, keep secret)

Google Cloud: add your Render URL under Authorized JavaScript origins.
Tools: public/tools.js. External tool password-skip: SSO_SNIPPET_for_external_tools.md

Google Cloud > Credentials > your OAuth client > **Authorized redirect URIs** must contain:
`https://YOUR-RENDER-URL/auth/google/callback`

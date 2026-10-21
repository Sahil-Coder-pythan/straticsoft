# Aapka AI · StraticSoft — NO-LOGIN FINAL

Click Tool or Customer link → opens immediately. **No login.**

## Company pair (from /owner)
- Tool: `/w/WORKSPACE_ID` — staff console (no login)
- Customer: `/w/WORKSPACE_ID/customer` — help portal (no login)

Unknown / guessed links → 404. Each workspace isolated.

## Open notification (Gmail)
When a link is opened, console gets an in-app ping.
Optional email to your phone Gmail — set on Render:

```
NOTIFY_EMAIL=your@gmail.com
BREVO_API_KEY=...
MAIL_FROM=noreply@yourdomain.com
```

Subject style: `StraticSoft · Tool link opened — CompanyName`

## Persistence
```
MONGODB_URI=mongodb+srv://...
SECRET_KEY=long-random
```

## Refund flow
Customer link Refund → case + receipt in **same** workspace Tool link (Agent Desk / Cases).

Version: 9.0.0-NOLOGIN-FINAL

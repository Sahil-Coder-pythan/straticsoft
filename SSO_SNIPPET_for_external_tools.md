# External tool me kya jodna hai (Forge / Router / Fast-AI)

Master tool Google ID token `#sso=<token>` me bhejta hai. Har external tool ke server me:

1. Page load par `location.hash` se `sso` token nikalo, server ko bhejo.
2. Server token verify kare (Google library / `https://oauth2.googleapis.com/tokeninfo?id_token=...`):
   - `aud` == aapka CLIENT_ID
   - `exp` abhi ke baad
   - `email_verified` == true
3. Valid ho to password page skip karo (session cookie do). Nahi to normal password maango.

Password kabhi HTML/JS me mat rakho (repo public hai). Sirf server-side env variable me rakho.

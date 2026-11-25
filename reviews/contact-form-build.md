# Contact form: a Vercel Function that sends mail through Gmail (user request, 2026-11-25)

**What the user wants:** the form emails Hui Jie, sent from `grokbotdgt+hjaas@gmail.com`.

**How:** a same-origin Vercel Function at `/api/contact` (Node runtime) with nodemailer, using Gmail SMTP (smtp.gmail.com:465, SSL).
- It signs in as `grokbotdgt@gmail.com` with a Google App Password.
- The user adds `grokbotdgt+hjaas@gmail.com` as a Gmail "Send mail as" alias, so Gmail keeps that From address instead of rewriting it.

**Settings: environment variables only.** No address or secret goes in the repo.

| Variable | Value | Who sets it |
|---|---|---|
| `GMAIL_USER` | `grokbotdgt@gmail.com` | Wren |
| `GMAIL_APP_PASSWORD` | secret | the user, in Vercel |
| `MAIL_FROM` | `HJaaS <grokbotdgt+hjaas@gmail.com>` | Wren |
| `CONTACT_TO` | the inbox that receives messages: the user's own while the site is private, Hui Jie's at launch | Wren |

## Build (`site/`)
1. `api/contact.js`, the function:
   - **Method and body:** POST only, JSON only, body 16 KB at most.
   - **Origin:** the request must come from hjaas.com, www.hjaas.com or a `*.vercel.app` deployment of this project.
   - **Fields:** the same fields and limits as `src/engine/submit.ts` (`name`, `email`, `needs[]`, `message`), checked again on the server.
     - `needs` must be values from the form's own list.
     - The email address must look like one and contain no line breaks (no header injection).
   - **Spam:** a hidden honeypot field (`website`) that people never fill in; if it's filled, answer 200 and send nothing. Also a small in-memory per-IP limit (5 a minute, best effort).
   - **The mail:**
     - From `MAIL_FROM`, To `CONTACT_TO`, Reply-To the visitor's address.
     - Subject `HJaaS: <name>`.
     - A plain-text body with the name, email, the needs chosen and the message.
     - Nothing the visitor typed goes into a header other than Reply-To, which is validated.
   - **Answers:** `200 {ok:true}`, `400 {ok:false}` for bad input, `500 {ok:false}` when sending fails. Never return or log the password or the message text; log only a short error code.
   - **Missing settings:** if any variable is missing, answer `503 {ok:false}`.
2. Add the dependency: `npm install nodemailer` (commit the lockfile).
3. `.env.production` with `VITE_FORM_ENDPOINT=/api/contact`. Check that the built `_headers` CSP keeps `connect-src 'self'`.
4. In the form, add the hidden `website` honeypot: off-screen, `tabindex=-1`, `autocomplete=off`, `aria-hidden`. Send it in the payload.
5. The form's existing states stay: sending, sent, and failed with a retry.
6. **Tests:** unit tests for the function with nodemailer mocked. Cover good input, every invalid case, the honeypot, a missing variable, the rate limit and a send failure.

## Must not change
The site's look, the hunt and unlock logic, the preview gate (`middleware.js`), memory and paint behaviour.

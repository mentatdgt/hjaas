# Contact form: a Vercel Function that sends mail through Resend (user decision, 2026-11-25)

**What the user wants:** the form emails Hui Jie, sent from **hello@hjaas.com**.

**How:** Resend sends the mail, using hjaas.com as a verified sending domain, through its REST API. This replaces the earlier Gmail plan, which would have needed 2-Step Verification on the account the user's Grok bots use.
- The Resend integration from the Vercel Marketplace sets the API key in the project.
- Resend's Auto Configure adds the DNS records to Vercel DNS.
- Free plan: 3,000 emails a month, 100 a day.

**Settings: environment variables only.** No address or secret goes in the repo.

| Variable | Value | Who sets it |
|---|---|---|
| `RESEND_API_KEY` | secret | the Resend integration, or the user |
| `MAIL_FROM` | `HJaaS <hello@hjaas.com>` | Wren |
| `CONTACT_TO` | the inbox that receives messages: the user's own while the site is private, Hui Jie's at launch | Wren |

## Build (`site/`)
1. `api/contact.js`, the function (Node runtime, plain JavaScript like `middleware.js`; no new dependency):
   - **Method and body:** POST only, JSON only, body 16 KB at most.
   - **Origin:** the request must come from hjaas.com, www.hjaas.com or a `*.vercel.app` deployment of this project.
   - **Fields:** the same fields and limits as `src/engine/submit.ts` (`name`, `email`, `needs[]`, `message`), checked again on the server.
     - `needs` must be values from the form's own list.
     - The email address must look like one and contain no line breaks.
   - **Spam:** a hidden honeypot field (`website`); if it's filled, answer 200 and send nothing. Also a small in-memory per-IP limit (5 a minute, best effort).
   - **Sending:** `fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' }, body: { from: MAIL_FROM, to: [CONTACT_TO], reply_to: <visitor email>, subject: 'HJaaS: <name>', text: <plain body: name, email, needs, message> } })`.
     - Time out after 10 s.
     - Treat any non-2xx response as a failure.
   - **Answers:** `200 {ok:true}`, `400 {ok:false}` for bad input, `502 {ok:false}` when Resend fails. Never return or log the key or the message text; log only the status code.
   - **Missing settings:** if any variable is missing, answer `503 {ok:false}`.
2. `.env.production` with `VITE_FORM_ENDPOINT=/api/contact`. Check that the built `_headers` CSP keeps `connect-src 'self'`.
3. In the form, add the hidden `website` honeypot: off-screen, `tabindex=-1`, `autocomplete=off`, `aria-hidden`. Send it in the payload.
4. The form's existing states stay: sending, sent, and failed with a retry.
5. **Tests:** unit tests for the function with `fetch` mocked. Cover good input (check the exact JSON sent to Resend), every invalid case, the honeypot, a missing variable, the rate limit, a Resend error and a timeout.

## Must not change
The site's look, the hunt and unlock logic, the preview gate (`middleware.js`), memory and paint behaviour.

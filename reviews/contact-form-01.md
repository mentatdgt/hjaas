# The contact form sends email: build report 01

From: Fable. For: Wren and the user. 2026-11-25. Job 012b. Branch: `site/review-fixes`; `main` and `deploy` were not touched.
Brief: `reviews/contact-form-build.md` (on `main`). Evidence: `site/qa/contact-form/`. No email was sent, and no address or secret is in the repo.

**Result: built.** 374 tests (85 new), type check and build pass. It has not run on Vercel or against Resend.

```
cd ~/hjaas && git checkout site/review-fixes && git pull && cd site && npm install && npm test && npm run build
node qa/tools/contact-form.mjs handler      (what Resend would get)
node qa/tools/contact-form.mjs browser      (HJ_SHOTS=0: no screenshots)
```

## 1. What changed

- **`site/api/contact.js`**: the function, as in the brief. Plain JavaScript, no new dependency. It exports `{ fetch }`, which Vercel's Node runtime calls with a Web `Request`.
- **`site/.env.production`**: `VITE_FORM_ENDPOINT=/api/contact`.
- **`form.ts`, `submit.ts`, `site.css`**: the `website` honeypot, sent in the payload. The states are untouched.
- **`scripts/contact.test.mjs`**: the function's tests, outside `api/` because Vercel makes a function of every file there.
- **`README.md`**: "The contact form", with every answer and when it comes.

## 2. Readings taken

- **"A `*.vercel.app` deployment of this project"**: the Origin must be the same `vercel.app` address the request came in on. Another project's `vercel.app` page is refused, and nothing needs configuring. Origins must be `https`; a request with no Origin is refused.
- **Answers the brief does not name:** wrong origin 403, not a POST 405, over five a minute 429. All have the body `{ok:false}`. Not JSON and over 16 KB are 400.
- **Missing settings are checked before the body**, so a deployment can be checked without sending: `curl -X POST -H 'Origin: https://www.hjaas.com' …/api/contact` answers 503 if a variable is missing and 400 if all are there. Behind the gate it needs the preview cookie too (401 without it).
- **The server's email rule is a little stricter than the form's:** it also refuses commas, semicolons, quotes, brackets and control characters, so `reply_to` can only be one plain address. A name may not contain a line break (it goes into the subject). Such an input gets the form's ordinary failed state.
- **The log line** is `contact: Resend answered <status>`; 0 means no answer, or none within 10 s.
- **Password managers:** some fill in a "website" field, and a visitor's real message would then be dropped in silence. The field carries the three marks 1Password, LastPass and Bitwarden are meant to skip. Not tested with any of them.

## 3. Checks

| Check | Result |
|---|---|
| Unit tests | Good input (exact JSON), every invalid case, honeypot, each missing variable, rate limit, Resend errors, unreachable, 10 s timeout. 84 in `contact.test.mjs`, 1 in `form.test.ts`. One test compares the function's limits and choices with the form's |
| The handler called directly | `handler.json`: from, to, reply_to (the visitor's), subject `HJaaS: Wren` and text as in the brief. Honeypot 200, bad email 400, other site 403, no `CONTACT_TO` 503: nothing sent |
| Vercel's own Node handler | The file run locally through `bundling-handler.js` from `@vercel/node` 32.0.0, Resend mocked: 200, 200 (own `vercel.app`), 403 (another's), 400, 405 and 400 (50 KB), as expected |
| The form in the browser | The production build behind its built `_headers`, `/api/contact` a local stub answering 500, then 200. Chrome and WebKit, desktop and phone: sending, failed (the message kept, Send works again), sent. Then through the real function with Resend mocked: right mail. Filled honeypot: "sent", nothing sent |
| The honeypot | Off-screen, not in the accessibility tree, never reached in 24 Tabs and 24 Shift+Tabs (4 browsers). The sheet's layout and pixels are identical with it taken out |
| CSP | Built `_headers` is identical to before: `connect-src 'self'` |
| Console | No errors but the browser's own line for the stub's 500. With screenshots on, WebKit also logs Playwright's injected style being refused; with them off (`browser-no-shots.json`) it does not |

## 4. For Wren

1. **Not checked:** a real send, the Vercel deployment, and Resend's documentation (reading it was not permitted in this run). The request is the brief's, word for word.
2. **On Vercel the CSP is not served at all yet**: `_headers` is for Netlify and Cloudflare, and there is no `vercel.json` (L4, part 2). The form works either way.
3. **The preview gate covers `/api/contact` too.** Same-origin requests carry the cookie, so the form works behind it; if the cookie runs out mid-visit, the visitor sees the failed state.
4. `npm run preview` has no function, so Send fails there. `npm run dev` is still test mode.
5. The failed state's words ("Check your connection and try again") also show for 429 and 503. Copy left as it is.

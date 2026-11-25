// Preview gate (Vercel Routing Middleware). Keeps hjaas.com private until launch: every request,
// pages and art alike, needs the preview cookie, which the password form below sets.
//
// The password is not in the code: it is the PREVIEW_PASSWORD environment variable in the Vercel project.
// Without that variable the site stays closed (it fails shut, never open).
//
// AT LAUNCH: delete this file and the PREVIEW_PASSWORD variable, then redeploy.

declare const process: { env: Record<string, string | undefined> };

const COOKIE = 'hjaas_preview';
const LOGIN = '/__preview';
const THIRTY_DAYS = 60 * 60 * 24 * 30;

async function token(password: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`hjaas-preview:${password}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function cookieValue(request: Request): string | undefined {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return rest.join('=');
  }
  return undefined;
}

/** Same length and every character compared, so the time taken says nothing about the token. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function page(status: number, wrong: boolean): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>hjaas</title>
<style>
  html, body { margin: 0; height: 100%; background: #111; }
  body { display: flex; align-items: center; justify-content: center; color: #a1a1a1;
    font: 15px/1.7 ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace; }
  form { padding: 24px; }
  p { margin: 0; }
  .row { margin-top: 12px; display: flex; gap: 10px; align-items: center; }
  input, button { font: inherit; color: #ededed; background: #111; border: 1px solid #333; border-radius: 4px; padding: 6px 10px; }
  input { width: 12em; }
  input:focus, button:focus-visible { outline: none; border-color: #777; }
  button { cursor: pointer; color: #a1a1a1; }
  button:hover { color: #ededed; border-color: #555; }
  .wrong { margin-top: 10px; color: #a1a1a1; }
</style>
</head>
<body>
<form method="post" action="${LOGIN}">
  <p>PREVIEW ONLY</p>
  <p>hjaas.com</p>
  <div class="row">
    <input type="password" name="password" aria-label="Password" placeholder="password" autocomplete="current-password" autofocus required>
    <button type="submit">enter</button>
  </div>
  ${wrong ? '<p class="wrong" role="alert">wrong password</p>' : ''}
</form>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Frame-Options': 'DENY',
    },
  });
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const password = process.env.PREVIEW_PASSWORD;
  if (!password) return page(503, false);
  const expected = await token(password);
  const url = new URL(request.url);

  if (url.pathname === LOGIN) {
    if (request.method !== 'POST') return Response.redirect(new URL('/', url), 303);
    const form = await request.formData().catch(() => null);
    const given = String(form?.get('password') ?? '');
    if (!same(await token(given), expected)) return page(401, true);
    return new Response(null, {
      status: 303,
      headers: {
        Location: '/',
        'Cache-Control': 'no-store',
        'Set-Cookie': `${COOKIE}=${expected}; Path=/; Max-Age=${THIRTY_DAYS}; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }

  const have = cookieValue(request);
  if (have && same(have, expected)) return undefined; // let the request through to the site
  return page(401, false);
}

// The contact form's mail (Vercel Function, Node runtime). Plain JavaScript, like middleware.js.
// It checks what src/engine/submit.ts sends and passes it to Resend's REST API.
//
// Settings are environment variables in the Vercel project, never in the code:
// RESEND_API_KEY, MAIL_FROM and CONTACT_TO. If one is missing, every request is answered 503.
//
// Nothing a visitor writes is ever logged or returned: only a status code is logged.
// The form's choices come from src/engine/needs.js, the one list of them, and its email rule from src/engine/email.js,
// the same one the page uses (Vercel bundles the imports).
// Keep tests out of this folder (they are in scripts/contact.test.mjs): Vercel makes a function of every file in api/.

import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { EMAIL } from '../src/engine/email.js';
import { NEEDS } from '../src/engine/needs.js';

const RESEND = 'https://api.resend.com/emails';
const RESEND_TIMEOUT_MS = 10_000;
const MAX_BODY = 16 * 1024;

/** The same as CONTACT_LIMITS in src/engine/submit.ts; a test compares them. */
export const LIMITS = { name: 100, email: 254, phone: 20, needs: 500, message: 4000 };

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

// A phone number as the form sends it: E.164 (+, then up to 15 digits), and a real one (libphonenumber-js, max metadata).
const E164 = /^\+[1-9]\d{1,14}$/;
const isPhone = (value) => E164.test(value) && isValidPhoneNumber(value);
const NOT_ONE_LINE = /[\p{Cc}\p{Zl}\p{Zp}]/u;

/** Every answer is JSON, and {"ok":true} only for a message taken: the form thanks the visitor for nothing else. */
function answer(status, headers = {}) {
  return Response.json({ ok: status === 200 }, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

/** hjaas.com, www.hjaas.com, or the vercel.app address this very request came in on (so, only this project's own). */
function allowedOrigin(request) {
  let origin;
  try {
    origin = new URL(request.headers.get('origin') ?? '');
  } catch {
    return false;
  }
  if (origin.protocol !== 'https:') return false;
  if (origin.host === 'hjaas.com' || origin.host === 'www.hjaas.com') return true;
  return origin.host.endsWith('.vercel.app') && origin.host === new URL(request.url).host;
}

// Best effort: each running copy of the function has its own list, and it starts empty.
const visits = new Map();

function tooMany(ip, now) {
  const recent = (visits.get(ip) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
  const full = recent.length >= RATE_LIMIT;
  if (!full) recent.push(now);
  visits.set(ip, recent);
  if (visits.size > 1000) {
    for (const [key, times] of visits) if (now - times[times.length - 1] >= RATE_WINDOW_MS) visits.delete(key);
  }
  return full;
}

/** The body as text, or null once it is over the limit (whatever its Content-Length says). */
async function readBody(request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY || !request.body) return null;
  const chunks = [];
  let size = 0;
  for await (const chunk of request.body) {
    size += chunk.byteLength;
    if (size > MAX_BODY) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readJson(request) {
  try {
    const value = JSON.parse((await readBody(request)) ?? '');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function text(value, max) {
  return typeof value === 'string' && value.length <= max && value.trim() ? value.trim() : null;
}

/** The message if every field is what the form could have sent, or null. */
function check(data) {
  const name = text(data.name, LIMITS.name);
  const message = text(data.message, LIMITS.message);
  const { needs } = data;
  if (!name || !message || !Array.isArray(needs) || NOT_ONE_LINE.test(data.name)) return null;
  // Email and phone: either may be left out (the form never sends one empty), but at least one is there,
  // and one that is there must be right.
  const hasEmail = data.email !== undefined;
  const hasPhone = data.phone !== undefined;
  if (!hasEmail && !hasPhone) return null;
  const email = hasEmail ? text(data.email, LIMITS.email) : null;
  const phone = hasPhone ? text(data.phone, LIMITS.phone) : null;
  if (hasEmail && (!email || NOT_ONE_LINE.test(data.email) || !EMAIL.test(email))) return null;
  if (hasPhone && (!phone || NOT_ONE_LINE.test(data.phone) || !isPhone(phone))) return null;
  if (!needs.every((need) => NEEDS.includes(need)) || needs.join(' ').length > LIMITS.needs) return null;
  return { name, email, phone, needs, message: message.replace(/\r\n?/g, '\n') };
}

/** The mail's text: an Email line and/or a Phone line ("+65 9888 1135"), only for what was given. */
function mailText({ name, email, phone, needs, message }) {
  const lines = [`Name: ${name}`];
  if (email) lines.push(`Email: ${email}`);
  if (phone) lines.push(`Phone: ${parsePhoneNumberFromString(phone)?.formatInternational() ?? phone}`);
  lines.push(`Needs: ${needs.join(', ') || '(none picked)'}`);
  return `${lines.join('\n')}\n\n${message}\n`;
}

/** Resend's status code, or 0 if it could not be reached or did not answer in time. */
async function send(mail, { key, from, to }) {
  const request = new AbortController();
  const timeout = setTimeout(() => request.abort(), RESEND_TIMEOUT_MS);
  try {
    const response = await fetch(RESEND, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        ...(mail.email ? { reply_to: mail.email } : {}),
        subject: `HJaaS: ${mail.name}`,
        text: mailText(mail),
      }),
      signal: request.signal,
    });
    void response.body?.cancel().catch(() => {});
    return response.status;
  } catch {
    return 0;
  } finally {
    clearTimeout(timeout);
  }
}

async function contact(request) {
  if (request.method !== 'POST') return answer(405, { Allow: 'POST' });
  if (!allowedOrigin(request)) return answer(403);

  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  const to = process.env.CONTACT_TO?.trim();
  if (!key || !from || !to) return answer(503);

  const ip = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '';
  if (tooMany(ip, Date.now())) return answer(429, { 'Retry-After': String(RATE_WINDOW_MS / 1000) });

  const type = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const data = type === 'application/json' ? await readJson(request) : null;
  if (!data) return answer(400);

  // The honeypot ("extra", labelled "Leave this empty"): no visitor can see it. Whoever filled it in is told all
  // went well, {"ok":true} like a real send, and nothing is sent.
  if (typeof data.extra === 'string' ? data.extra.trim() : data.extra) return answer(200);

  const mail = check(data);
  if (!mail) return answer(400);

  const status = await send(mail, { key, from, to });
  if (status >= 200 && status < 300) return answer(200);
  console.error('contact: Resend answered', status);
  return answer(502);
}

export default { fetch: contact };

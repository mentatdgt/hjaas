import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ContactPayload } from './submit';

const endpoint = 'https://forms.example.org/contact';
const valid = { name: 'Wren', email: 'wren@example.org', needs: ['Building or renovating'], message: 'Hello', extra: '' };
const ok = () => Response.json({ ok: true });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_FORM_ENDPOINT', endpoint);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it.each<Partial<ContactPayload>>([
  { name: 'a'.repeat(101) },
  { email: 'a'.repeat(255) },
  { phone: `+${'1'.repeat(20)}` },
  { needs: ['a'.repeat(250), 'b'.repeat(250)] },
  { message: 'a'.repeat(4001) },
])('rejects an oversized payload field before starting a request', async (overrides) => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const { submitContact } = await import('./submit');
  await expect(submitContact({ ...valid, ...overrides })).rejects.toMatchObject({ reason: 'invalid' });
  expect(fetch).not.toHaveBeenCalled();
});

it('sends a payload at the field limits, and is sent on the function\'s JSON {"ok":true}', async () => {
  const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>().mockResolvedValue(ok());
  vi.stubGlobal('fetch', fetch);
  const { submitContact } = await import('./submit');
  const payload = { name: 'a'.repeat(100), email: 'b'.repeat(254), needs: ['c'.repeat(500)], message: 'd'.repeat(4000), extra: '' };
  await expect(submitContact(payload)).resolves.toBe('sent');
  expect(fetch).toHaveBeenCalledWith(endpoint, expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) }));
});

it.each<[string, () => Response]>([
  ['an empty 204', () => new Response(null, { status: 204 })],
  ['an empty 200', () => new Response('', { status: 200 })],
  ['an HTML page (a misrouted endpoint)', () => new Response('<!doctype html><title>HJaaS</title>', { status: 200, headers: { 'Content-Type': 'text/html' } })],
  ['broken JSON', () => new Response('{"ok":tr', { status: 200, headers: { 'Content-Type': 'application/json' } })],
  ['JSON with ok false', () => Response.json({ ok: false })],
  ['JSON with ok "true" (a string)', () => Response.json({ ok: 'true' })],
  ['JSON with no ok', () => Response.json({ id: 'x' })],
  ['JSON true', () => Response.json(true)],
  ['JSON null', () => Response.json(null)],
  ['a 500, even with ok true', () => Response.json({ ok: true }, { status: 500 })],
  ['a 502', () => Response.json({ ok: false }, { status: 502 })],
  ['a 503', () => Response.json({ ok: false }, { status: 503 })],
  ['a 400', () => Response.json({ ok: false }, { status: 400 })],
])('fails on %s: no thank-you without an explicit OK', async (_, response) => {
  vi.stubGlobal('fetch', vi.fn(async () => response()));
  const { submitContact } = await import('./submit');
  await expect(submitContact(valid)).rejects.toMatchObject({ reason: 'failed' });
});

it('fails when the network does', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
  const { submitContact } = await import('./submit');
  await expect(submitContact(valid)).rejects.toMatchObject({ reason: 'failed' });
});

it.each<[string, Record<string, string>, number | undefined]>([
  ['Retry-After in seconds', { 'Retry-After': '30' }, 30],
  ['the function\'s own 60', { 'Retry-After': '60' }, 60],
  ['no Retry-After', {}, undefined],
  ['an unreadable Retry-After', { 'Retry-After': 'soon' }, undefined],
])('says busy on a 429, with %s', async (_, headers, retryAfter) => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: false }, { status: 429, headers })));
  const { submitContact, SendError } = await import('./submit');
  const error = await submitContact(valid).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(SendError);
  expect(error).toMatchObject({ reason: 'busy', retryAfter });
});

it('reads Retry-After as seconds or as an HTTP date', async () => {
  const { retryAfterSeconds } = await import('./submit');
  const now = Date.parse('2026-11-28T10:00:00Z');
  expect(retryAfterSeconds('45', now)).toBe(45);
  expect(retryAfterSeconds(' 0 ', now)).toBe(0);
  expect(retryAfterSeconds('Sat, 28 Nov 2026 10:01:30 GMT', now)).toBe(90);
  expect(retryAfterSeconds('Sat, 28 Nov 2026 09:00:00 GMT', now)).toBe(0);
  expect(retryAfterSeconds(null, now)).toBeUndefined();
  expect(retryAfterSeconds('', now)).toBeUndefined();
  expect(retryAfterSeconds('-5', now)).toBeUndefined();
});

it('aborts a stalled request at 15 seconds even if fetch resolves late', async () => {
  vi.useFakeTimers();
  let request!: AbortSignal;
  let respond!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn((_: string, init: RequestInit) => {
    request = init.signal!;
    return new Promise<Response>((resolve) => { respond = resolve; });
  }));
  const { submitContact } = await import('./submit');
  const result = expect(submitContact(valid)).rejects.toMatchObject({ reason: 'failed' });
  await vi.advanceTimersByTimeAsync(14_999);
  expect(request.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(request.aborted).toBe(true);
  await result;
  respond(ok());
});

it('gives up at 15 seconds when the answer comes but its body stalls', async () => {
  vi.useFakeTimers();
  const body = new ReadableStream({ start() {} }); // never sends a byte
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })));
  const { submitContact } = await import('./submit');
  const result = expect(submitContact(valid)).rejects.toMatchObject({ reason: 'failed' });
  await vi.advanceTimersByTimeAsync(15_000);
  await result;
});

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ContactPayload } from './submit';

const endpoint = 'https://forms.example.org/contact';
const valid = { name: 'Wren', email: 'wren@example.org', needs: ['Build'], message: 'Hello' };

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
  { needs: ['a'.repeat(250), 'b'.repeat(250)] },
  { message: 'a'.repeat(4001) },
])('rejects an oversized payload field before starting a request', async (overrides) => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const { submitContact } = await import('./submit');
  await expect(submitContact({ ...valid, ...overrides })).rejects.toMatchObject({ reason: 'invalid' });
  expect(fetch).not.toHaveBeenCalled();
});

it('sends a payload at the field limits and accepts only a successful response', async () => {
  const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
  fetch.mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response(null, { status: 503 }));
  vi.stubGlobal('fetch', fetch);
  const { submitContact } = await import('./submit');
  const payload = { name: 'a'.repeat(100), email: 'b'.repeat(254), needs: ['c'.repeat(500)], message: 'd'.repeat(4000) };
  await expect(submitContact(payload)).resolves.toBe('sent');
  expect(fetch).toHaveBeenCalledWith(endpoint, expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) }));
  await expect(submitContact(valid)).rejects.toMatchObject({ reason: 'failed' });
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
  respond(new Response(null, { status: 204 }));
});

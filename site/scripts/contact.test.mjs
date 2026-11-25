import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { loadEnv } from 'vite';
import { NEEDS as FORM_NEEDS } from '../src/engine/form.ts';
import { CONTACT_LIMITS } from '../src/engine/submit.ts';

const KEY = 're_test_not_a_real_key';
const valid = {
  name: 'Wren',
  email: 'wren@example.org',
  needs: ['Build', 'Set Design'],
  message: 'A shelf, please.\nNo hurry.',
  website: '',
};

let contact;
let resend;
let logged;

beforeEach(async () => {
  vi.resetModules(); // a fresh rate limit for every test
  vi.stubEnv('RESEND_API_KEY', KEY);
  vi.stubEnv('MAIL_FROM', 'HJaaS <from@example.org>');
  vi.stubEnv('CONTACT_TO', 'inbox@example.org');
  resend = vi.fn(async () => Response.json({ id: 'fake' }));
  vi.stubGlobal('fetch', resend);
  logged = ['log', 'info', 'warn', 'error'].map((level) => vi.spyOn(console, level).mockImplementation(() => {}));
  contact = (await import('../api/contact.js')).default.fetch;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const request = (body, { origin = 'https://www.hjaas.com', url = 'https://www.hjaas.com/api/contact', type = 'application/json', ip = '203.0.113.7', ...init } = {}) =>
  new Request(url, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
    headers: { ...(origin && { Origin: origin }), ...(type && { 'Content-Type': type }), 'x-real-ip': ip, ...init.headers },
  });

async function expectAnswer(response, status) {
  expect(response.status).toBe(status);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual({ ok: status === 200 });
}

async function expectRefused(body, status = 400, options) {
  await expectAnswer(await contact(request(body, options)), status);
  expect(resend).not.toHaveBeenCalled();
}

const everythingLogged = () => JSON.stringify(logged.flatMap((spy) => spy.mock.calls));

it('sends Resend exactly this', async () => {
  await expectAnswer(await contact(request(valid)), 200);
  expect(resend).toHaveBeenCalledOnce();
  const [url, init] = resend.mock.calls[0];
  expect(url).toBe('https://api.resend.com/emails');
  expect(init.method).toBe('POST');
  expect(init.headers).toEqual({ Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' });
  expect(JSON.parse(init.body)).toEqual({
    from: 'HJaaS <from@example.org>',
    to: ['inbox@example.org'],
    reply_to: 'wren@example.org',
    subject: 'HJaaS: Wren',
    text: 'Name: Wren\nEmail: wren@example.org\nNeeds: Build, Set Design\n\nA shelf, please.\nNo hurry.\n',
  });
  expect(everythingLogged()).toBe('[]');
});

it('takes no needs, trims, evens out line breaks, and an older page without the honeypot', async () => {
  const { website, ...older } = valid;
  await expectAnswer(await contact(request({ ...older, name: ' Wren ', email: ' wren@example.org ', needs: [], message: ' a\r\nb ' })), 200);
  expect(JSON.parse(resend.mock.calls[0][1].body)).toMatchObject({
    subject: 'HJaaS: Wren',
    reply_to: 'wren@example.org',
    text: 'Name: Wren\nEmail: wren@example.org\nNeeds: (none picked)\n\na\nb\n',
  });
});

it('has the form\'s own choices and limits, and takes a message at all of them', async () => {
  const { LIMITS, NEEDS } = await import('../api/contact.js');
  expect(LIMITS).toEqual(CONTACT_LIMITS);
  expect(NEEDS).toEqual([...FORM_NEEDS]);
  const email = `${'e'.repeat(254 - '@example.org'.length)}@example.org`;
  await expectAnswer(await contact(request({ name: '名'.repeat(100), email, needs: NEEDS, message: '文'.repeat(4000), website: '' })), 200);
});

it.each([
  ['no name', { name: undefined }],
  ['a blank name', { name: '   ' }],
  ['a name that is not text', { name: ['Wren'] }],
  ['a long name', { name: 'a'.repeat(101) }],
  ['a name with a line break', { name: 'Wren\nBcc: someone@example.org' }],
  ['a name ending in a line break', { name: 'Wren\r\n' }],
  ['a name with a Unicode line break', { name: 'Wren\u2028x' }],
  ['no email', { email: undefined }],
  ['a blank email', { email: '' }],
  ['an email that is not text', { email: { a: 1 } }],
  ['a long email', { email: `${'e'.repeat(250)}@example.org` }],
  ['an email with no @', { email: 'wren.example.org' }],
  ['an email with no domain', { email: 'wren@' }],
  ['an email with no dot', { email: 'wren@example' }],
  ['two emails', { email: 'wren@example.org,other@example.org' }],
  ['an email with a name', { email: 'Wren <wren@example.org>' }],
  ['an email with angle brackets', { email: '<wren@example.org>' }],
  ['an email with a comma', { email: 'a,wren@example.org' }],
  ['an email with a line break', { email: 'wren@example.org\r\nBcc: other@example.org' }],
  ['an email ending in a line break', { email: 'wren@example.org\n' }],
  ['an email with a NUL', { email: 'wren\u0000@example.org' }],
  ['no needs', { needs: undefined }],
  ['needs that are not a list', { needs: 'Build' }],
  ['a need the form does not have', { needs: ['Build', 'Plumbing'] }],
  ['a need that is not text', { needs: [['Build']] }],
  ['too many needs', { needs: Array(100).fill('Build') }],
  ['no message', { message: undefined }],
  ['a blank message', { message: ' \n ' }],
  ['a message that is not text', { message: 7 }],
  ['a long message', { message: 'a'.repeat(4001) }],
])('refuses %s', (_, overrides) => expectRefused({ ...valid, ...overrides }));

it.each([
  ['an empty body', ''],
  ['broken JSON', '{"name":'],
  ['null', 'null'],
  ['a list', '[]'],
  ['a string', '"hello"'],
])('refuses %s', (_, body) => expectRefused(body));

it.each(['text/plain', 'application/x-www-form-urlencoded', 'application/jsonp', ''])('refuses the content type "%s"', (type) =>
  expectRefused(JSON.stringify(valid), 400, { type }));

it('takes JSON with a charset', async () => {
  await expectAnswer(await contact(request(valid, { type: 'application/json; charset=utf-8' })), 200);
});

it('takes a body of 16 KB and refuses one byte more, with or without a length', async () => {
  const size = (bytes) => {
    const body = JSON.stringify({ ...valid, padding: '' });
    return body.replace('"padding":""', `"padding":"${'x'.repeat(bytes - body.length)}"`);
  };
  expect(size(16384)).toHaveLength(16384);
  await expectAnswer(await contact(request(size(16384))), 200);
  resend.mockClear();
  await expectRefused(size(16385));
  await expectRefused(size(16385), 400, { headers: { 'Content-Length': '16385' } });
  const pulled = vi.fn((stream) => stream.enqueue(new Uint8Array(4096).fill(32)));
  await expectAnswer(await contact(request('', { body: new ReadableStream({ pull: pulled }), duplex: 'half' })), 400); // endless
  expect(pulled.mock.calls.length).toBeLessThan(10);
});

it.each(['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])('refuses %s', async (method) => {
  const response = await contact(request(null, { method, body: undefined }));
  expect(response.status).toBe(405);
  expect(response.headers.get('allow')).toBe('POST');
  expect(resend).not.toHaveBeenCalled();
});

const preview = 'https://hjaas-git-deploy-someone.vercel.app';
it.each([
  ['https://hjaas.com', 'https://hjaas.com/api/contact'],
  ['https://www.hjaas.com', 'https://www.hjaas.com/api/contact'],
  ['https://www.hjaas.com', 'https://hjaas.com/api/contact'],
  [preview, `${preview}/api/contact`],
])('takes a request from %s at %s', async (origin, url) => {
  await expectAnswer(await contact(request(valid, { origin, url })), 200);
});

it.each([
  ['', undefined],
  ['null', undefined],
  ['http://www.hjaas.com', undefined],
  ['https://example.org', undefined],
  ['https://hjaas.com.example.org', undefined],
  ['https://nothjaas.com', undefined],
  ['https://hjaas.com:8443', undefined],
  ['https://someone-else.vercel.app', undefined],
  ['https://someone-else.vercel.app', `${preview}/api/contact`],
  ['https://example.org', 'https://example.org/api/contact'],
])('refuses a request from "%s"', (origin, url) => expectRefused(valid, 403, { origin, ...(url && { url }) }));

it.each(['https://spam.example', 1, true, ['x']])('answers a filled honeypot (%j) 200 and sends nothing', (website) =>
  expectRefused({ ...valid, website }, 200));

it('answers a filled honeypot 200 even when the rest is wrong', () => expectRefused({ website: 'x' }, 200));

it.each(['RESEND_API_KEY', 'MAIL_FROM', 'CONTACT_TO'])('answers 503 without %s', async (name) => {
  vi.stubEnv(name, undefined);
  await expectRefused(valid, 503);
  vi.stubEnv(name, '  ');
  await expectRefused(valid, 503);
});

it('takes five a minute from one address, and others meanwhile', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  for (let i = 0; i < 5; i++) await expectAnswer(await contact(request(valid)), 200);
  const sixth = await contact(request(valid));
  expect(sixth.headers.get('retry-after')).toBe('60');
  await expectAnswer(sixth, 429);
  expect(resend).toHaveBeenCalledTimes(5);
  await expectAnswer(await contact(request(valid, { ip: '203.0.113.8' })), 200);
  vi.advanceTimersByTime(59_999);
  await expectAnswer(await contact(request(valid)), 429);
  vi.advanceTimersByTime(1);
  await expectAnswer(await contact(request(valid)), 200);
});

it('tells visitors apart by x-forwarded-for when there is no x-real-ip', async () => {
  const from = (ip) => {
    const made = request(valid, { headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` } });
    made.headers.delete('x-real-ip');
    return contact(made);
  };
  for (let i = 0; i < 5; i++) await expectAnswer(await from('198.51.100.1'), 200);
  await expectAnswer(await from('198.51.100.1'), 429);
  await expectAnswer(await from('198.51.100.2'), 200);
});

it.each([301, 401, 403, 422, 429, 500])('answers 502 when Resend answers %i, and logs only that', async (status) => {
  resend.mockResolvedValue(new Response(JSON.stringify({ message: `${KEY} ${valid.message}` }), { status }));
  await expectAnswer(await contact(request(valid)), 502);
  expect(everythingLogged()).toBe(JSON.stringify([['contact: Resend answered', status]]));
});

it('answers 502 when Resend cannot be reached, and does not log why', async () => {
  resend.mockRejectedValue(new Error(`${KEY} ${valid.message}`));
  await expectAnswer(await contact(request(valid)), 502);
  expect(everythingLogged()).toBe(JSON.stringify([['contact: Resend answered', 0]]));
});

it('gives up on Resend after 10 seconds', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  let signal;
  resend.mockImplementation((_, init) => new Promise((__, reject) => {
    signal = init.signal;
    signal.addEventListener('abort', () => reject(signal.reason));
  }));
  const answered = contact(request(valid));
  while (!signal) await new Promise((resolve) => setImmediate(resolve)); // not vi.waitFor: it moves the fake clock
  await vi.advanceTimersByTimeAsync(9_999);
  expect(signal.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(signal.aborted).toBe(true);
  await expectAnswer(await answered, 502);
});

it('leaves no timer behind after an answer', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  await expectAnswer(await contact(request(valid)), 200);
  expect(vi.getTimerCount()).toBe(0);
});

it('production posts to it, and no address or key is in the code', () => {
  expect(loadEnv('production', new URL('..', import.meta.url).pathname, 'VITE_FORM_').VITE_FORM_ENDPOINT).toBe('/api/contact');
  for (const file of ['../api/contact.js', '../.env.production']) {
    expect(readFileSync(new URL(file, import.meta.url), 'utf8')).not.toMatch(/\bre_\w{8,}|[\w.]+@[\w-]+\.\w{2,}/);
  }
});

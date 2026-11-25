// The contact form's checks. Nothing is ever sent: fetch to Resend is mocked, and the settings are made up.
//   node qa/tools/contact-form.mjs handler    calls api/contact.js with fake Requests and prints what Resend would get
//   node qa/tools/contact-form.mjs browser    the form in the production build (run `npm run build` first), served
//                                             with the built _headers (HJ_SHOTS=0: no screenshots); /api/contact is a stub (200, 500), then the function
// Writes to qa/contact-form/.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = fileURLToPath(new URL('../../', import.meta.url));
const out = join(site, 'qa/contact-form');
const dist = join(site, 'dist');

Object.assign(process.env, { RESEND_API_KEY: 're_made_up', MAIL_FROM: 'HJaaS <from@example.org>', CONTACT_TO: 'inbox@example.org' });
const toResend = [];
globalThis.fetch = async (url, init) => {
  toResend.push({ url, method: init.method, headers: { ...init.headers, Authorization: init.headers.Authorization.replace(/\S+$/, '<RESEND_API_KEY>') }, body: JSON.parse(init.body) });
  return Response.json({ id: 'mocked' });
};
const { default: contact } = await import('../../api/contact.js');
const ask = (body, headers = {}, ip = '203.0.113.1') => contact.fetch(new Request('https://www.hjaas.com/api/contact', {
  method: 'POST', body, headers: { 'Content-Type': 'application/json', Origin: 'https://www.hjaas.com', 'x-real-ip': ip, ...headers },
}));

async function handler() {
  const good = { name: 'Wren', email: 'wren@example.org', needs: ['Building or renovating', 'Designing a set'], message: 'A shelf, please.\nNo hurry.', website: '' };
  const cases = [['good', good], ['no needs', { ...good, needs: [] }], ['honeypot', { ...good, website: 'https://spam.example' }],
    ['bad email', { ...good, email: 'wren@example.org\r\nBcc: other@example.org' }], ['other site', good, { Origin: 'https://example.org' }]];
  const results = [];
  for (const [name, body, headers] of cases) {
    toResend.length = 0;
    const response = await ask(JSON.stringify(body), headers, name);
    results.push({ case: name, answer: response.status, body: await response.json(), toResend: toResend[0] ?? null });
  }
  for (const [label, key] of [['no CONTACT_TO', 'CONTACT_TO']]) {
    const kept = process.env[key];
    delete process.env[key];
    toResend.length = 0;
    const response = await ask(JSON.stringify(good), {}, label);
    results.push({ case: label, answer: response.status, body: await response.json(), toResend: toResend[0] ?? null });
    process.env[key] = kept;
  }
  writeFileSync(join(out, 'handler.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify(results, null, 2));
}

async function browser() {
  const { chromium, webkit, devices } = await import('playwright');
  const quiet = process.env.HJ_SHOTS === '0'; // Playwright's own screenshot styles are refused by the CSP in WebKit, and logged
  const csp = readFileSync(join(dist, '_headers'), 'utf8').match(/Content-Security-Policy: (.*)/)[1];
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };
  let answers = []; // what /api/contact says next: a status, or 'function' for the real one
  let posted = [];
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    if (path === '/api/contact') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString();
      posted.push({ method: req.method, type: req.headers['content-type'], body: JSON.parse(body) });
      await new Promise((resolve) => setTimeout(resolve, 900));
      const next = answers.shift();
      // The function sees the address it will have on the site; everything else is the browser's own request.
      const reply = next === 'function' ? await ask(body, { 'Content-Type': req.headers['content-type'] }, req.headers['user-agent']) : Response.json({ ok: next === 200 }, { status: next });
      res.writeHead(reply.status, Object.fromEntries(reply.headers));
      res.end(await reply.text());
      return;
    }
    try {
      const file = join(dist, normalize(path === '/' ? '/index.html' : path));
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Content-Security-Policy': csp });
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;

  // Production ignores ?all=50, so start from saved progress: every spot of every scene, read from the sources.
  const scenes = Object.fromEntries(['build', 'grow', 'design', 'film', 'set'].map((id) => {
    const found = [...readFileSync(join(site, `src/scenes/${id}.ts`), 'utf8').matchAll(/\{ id: '([\w-]+)', art:/g)].map((m) => m[1]);
    if (found.length !== 10) throw new Error(`${id}: ${found.length} spots read`);
    return [id, { found, seen: true, panX: null }];
  }));
  const report = { csp: csp.match(/connect-src[^;]*/)[0] };

  async function run(name, launch, options, tabKey) {
    const instance = await launch();
    const context = await instance.newContext(options);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`${m.type()}: ${m.text()}`); });
    page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
    await page.addInitScript((saved) => localStorage.setItem('hjaas:site:v2', JSON.stringify({ scenes: saved, unlocked: false, panned: false })), scenes);
    const shot = (state) => quiet || page.screenshot({ path: join(out, `${name}-${state}.jpg`), type: 'jpeg', quality: 84 });
    const press = () => (options.hasTouch ? page.tap('.hj-form .hj-send') : page.click('.hj-form .hj-send'));
    const state = () => page.evaluate(() => {
      const shown = (s) => !document.querySelector(s).hidden;
      const send = document.querySelector('.hj-form .hj-send');
      return { button: send.textContent, disabled: send.getAttribute('aria-disabled'), failed: shown('.hj-failure') ? document.querySelector('.hj-failure').textContent : null, sent: shown('.hj-sent') ? document.querySelector('.hj-sent').innerText : null, kept: document.querySelector('#hj-message').value, focus: document.activeElement?.className || document.activeElement?.tagName };
    });
    const fill = async () => {
      await page.fill('#hj-name', 'Wren');
      await page.fill('#hj-email', 'wren@example.org');
      await page.evaluate(() => { for (const n of [0, 4]) { const box = document.querySelectorAll('.hj-chip input')[n]; if (!box.checked) box.click(); } });
      await page.fill('#hj-message', 'A shelf for the mushroom lab, please.');
    };
    const openForm = async () => {
      await page.evaluate(() => document.querySelector('.hj-contact').click());
      await page.waitForTimeout(700);
    };
    const result = (report[name] = {});

    await page.goto(base);
    await page.waitForSelector('.hj-contact', { state: 'visible' });
    await page.waitForTimeout(2500);
    await openForm();
    await shot('1-open');

    // The honeypot: what it covers, whether it changes anything, whether anything can land on it.
    result.trap = await page.evaluate(() => {
      const trap = document.querySelector('.hj-trap');
      const input = trap.querySelector('input');
      const rects = () => JSON.stringify([...document.querySelectorAll('.hj-sheet, .hj-sheet-body, .hj-sheet *:not(.hj-trap, .hj-trap *)')].map((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height, e.scrollWidth, e.scrollHeight]; }));
      const withTrap = rects();
      const doc = [document.documentElement.scrollWidth, document.documentElement.scrollHeight].join();
      const box = input.getBoundingClientRect();
      const { parentElement: parent, nextSibling: next } = trap;
      trap.remove();
      const same = withTrap === rects() && doc === [document.documentElement.scrollWidth, document.documentElement.scrollHeight].join();
      parent.insertBefore(trap, next);
      return { inputRight: Math.round(box.right), offScreen: box.right < 0, layoutSameWithoutIt: same, ariaHidden: trap.getAttribute('aria-hidden'), tabIndex: input.tabIndex, autocomplete: input.autocomplete };
    });
    const sheet = page.locator('.hj-sheet');
    const picture = () => (quiet ? Buffer.alloc(0) : sheet.screenshot({ animations: 'disabled' }));
    const withTrap = await picture();
    await page.evaluate(() => { window.__trap = document.querySelector('.hj-trap'); window.__after = window.__trap.nextSibling; window.__trap.remove(); });
    const without = await picture();
    await page.evaluate(() => window.__after.parentElement.insertBefore(window.__trap, window.__after));
    if (!quiet) result.trap.pixelsSameWithoutIt = withTrap.equals(without);
    result.trap.inAccessibilityTree = /website/i.test(await sheet.ariaSnapshot());
    const stops = [];
    for (const [key, count] of [[tabKey, 24], [`Shift+${tabKey}`, 24]]) {
      for (let i = 0; i < count; i++) {
        await page.keyboard.press(key);
        stops.push(await page.evaluate(() => { const e = document.activeElement; return e.id || e.value || e.className || e.tagName; }));
      }
    }
    result.trap.tabStops = [...new Set(stops)];
    result.trap.reachedByTab = stops.includes('hj-website');

    // 500: sending, failed, what was written kept. Then Send again: 200, sent.
    answers = [500, 200];
    posted = [];
    await fill();
    await press();
    await page.waitForTimeout(350);
    result.sending = await state();
    await shot('2-sending');
    await page.waitForSelector('.hj-failure:not([hidden])');
    await page.waitForTimeout(300);
    result.failed = await state();
    await page.evaluate(() => { const b = document.querySelector('.hj-sheet-body'); b.scrollTop = b.scrollHeight; });
    await shot('3-failed');
    result.consoleAfter500 = errors.splice(0); // the browser's own line about the 500
    await press();
    await page.waitForTimeout(350);
    result.sendingAgain = await state();
    await page.waitForSelector('.hj-sent:not([hidden])');
    await page.waitForTimeout(700);
    result.sent = await state();
    await shot('4-sent');
    result.posted = [...posted];

    // Back to the room, open again, and this time through the function itself (Resend mocked).
    await page.evaluate(() => document.querySelector('.hj-done').click());
    await page.waitForTimeout(500);
    await openForm();
    result.emptyAgain = (await state()).kept === '';
    answers = ['function'];
    toResend.length = 0;
    await fill();
    await press();
    await page.waitForSelector('.hj-sent:not([hidden])');
    result.throughTheFunction = toResend.map((r) => r.body);
    // Reopen: a filled honeypot says sent and sends nothing.
    await page.evaluate(() => document.querySelector('.hj-done').click());
    await page.waitForTimeout(500);
    await openForm();
    answers = ['function'];
    toResend.length = 0;
    await fill();
    await page.evaluate(() => { document.querySelector('#hj-website').value = 'https://spam.example'; });
    await press();
    await page.waitForSelector('.hj-sent:not([hidden])');
    result.honeypotFilled = { says: 'sent', toResend: toResend.length };
    // The form is cleared after a send, the honeypot too.
    await page.evaluate(() => document.querySelector('.hj-done').click());
    await page.waitForTimeout(500);
    result.honeypotClearedAfter = (await page.evaluate(() => document.querySelector('#hj-website').value)) === '';
    result.consoleErrors = errors;
    await instance.close();
  }

  const chrome = () => chromium.launch({ channel: 'chrome' });
  await run('desktop-chrome', chrome, { viewport: { width: 1440, height: 900 } }, 'Tab');
  await run('desktop-webkit', () => webkit.launch(), { viewport: { width: 1440, height: 900 } }, 'Alt+Tab');
  await run('phone-webkit', () => webkit.launch(), devices['iPhone 13'], 'Alt+Tab');
  await run('phone-chrome', chrome, devices['Pixel 7'], 'Tab');
  server.close();
  writeFileSync(join(out, quiet ? 'browser-no-shots.json' : 'browser.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 1));
}

await { handler, browser }[process.argv[2] ?? 'handler']();

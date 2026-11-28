// Job 005: the contact form's improvements, at iPhone size (390 x 664). Production build (`npm run build` first)
// from dist/, behind its built _headers. All 50 found, form opened. /api/contact answers what each step asks for.
//
// States: empty, "neither filled", bad phone, sending (grey, and what the status line says), sent (title hidden),
// 429, outage; also a 200 that is an HTML page (a misrouted endpoint), which must not say thank you.
// The iPhone keyboard: WebKit if this Playwright has it, else Chrome; either way the keyboard itself is simulated by
// a stand-in window.visualViewport (no desktop browser raises one), shrunk as the keyboard would, with the
// keyboard's area shaded in the screenshots. Real-iPhone checks are in the job report.
//
//   node qa/tools/form-improvements.mjs [out-folder]
// Writes screenshots and report.json to qa/form-improvements/ (or the folder given).
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices, webkit } from 'playwright';

const site = fileURLToPath(new URL('../../', import.meta.url));
const out = process.argv[2] ? resolve(process.argv[2]) : join(site, 'qa/form-improvements');
const dist = join(site, 'dist');
mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// What /api/contact says next: { status, body, headers }, or { hold: true } to keep the post waiting until released.
let next = [];
let release = null;
const csp = readFileSync(join(dist, '_headers'), 'utf8').match(/Content-Security-Policy: (.*)/)[1];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/api/contact') {
    for await (const _ of req);
    let answer = next.shift() ?? { status: 200, body: '{"ok":true}' };
    if (answer.hold) {
      await new Promise((r) => (release = r));
      answer = next.shift() ?? { status: 200, body: '{"ok":true}' };
    }
    res.writeHead(answer.status, { 'Content-Type': 'application/json', ...answer.headers }).end(answer.body);
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
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const scenes = Object.fromEntries(['build', 'grow', 'design', 'film', 'set'].map((id) => {
  const found = [...readFileSync(join(site, `src/scenes/${id}.ts`), 'utf8').matchAll(/\{ id: '([\w-]+)', art:/g)].map((m) => m[1]);
  if (found.length !== 10) throw new Error(`${id}: ${found.length} spots read`);
  return [id, { found, seen: true, panX: null }];
}));

let engine = 'webkit';
let browser;
let webkitSkipped;
try {
  browser = await webkit.launch();
} catch (error) {
  engine = 'chrome';
  browser = await chromium.launch({ channel: 'chrome' });
  webkitSkipped = String(error.message).split('\n')[0].replace(/\/Users\/[^/]+/g, '~');
}
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
const options = { ...iphone, viewport: { width: 390, height: 664 }, reducedMotion: 'reduce' };
const report = { engine, ...(webkitSkipped ? { webkitSkipped } : {}), viewport: options.viewport };

async function newPage({ fakeViewport = false } = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((saved) => localStorage.setItem('hjaas:site:v2', JSON.stringify({ scenes: saved, unlocked: false, panned: false })), scenes);
  if (fakeViewport) {
    // A stand-in visual viewport: the page's own size until __keyboard(height, scrolledBy) shrinks it.
    await page.addInitScript(() => {
      const fake = new EventTarget();
      let height = null;
      let top = 0;
      Object.defineProperties(fake, {
        height: { get: () => height ?? innerHeight },
        width: { get: () => innerWidth },
        offsetTop: { get: () => top },
        offsetLeft: { get: () => 0 },
        pageTop: { get: () => scrollY + top },
        pageLeft: { get: () => scrollX },
        scale: { get: () => 1 },
      });
      Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => fake });
      window.__keyboard = (keyboard, scrolledBy = 0) => {
        height = keyboard ? innerHeight - keyboard - scrolledBy : null;
        top = scrolledBy;
        fake.dispatchEvent(new Event('resize'));
        fake.dispatchEvent(new Event('scroll'));
        // Shade where the keyboard is, for the screenshots (pointer-events: none; outside the dialog's top layer
        // it would sit under it, so it goes in the dialog).
        document.querySelector('#qa-keyboard')?.remove();
        if (!keyboard) return;
        const shade = document.createElement('div');
        shade.id = 'qa-keyboard';
        shade.textContent = 'keyboard (simulated)';
        shade.style.cssText = `position:fixed;left:0;right:0;top:${innerHeight - keyboard}px;bottom:0;background:rgba(40,40,46,.86);color:#fff;font:14px system-ui;display:grid;place-items:center;pointer-events:none;z-index:2147483647`;
        document.querySelector('.hj-dialog').append(shade);
      };
    });
  }
  await page.goto(base);
  await page.waitForSelector('.hj-contact', { state: 'visible' });
  await wait(2500);
  await page.evaluate(() => document.querySelector('.hj-contact').click());
  await wait(800);
  await page.waitForFunction(() => document.querySelector('#hj-country').options.length > 1);
  await page.evaluate(() => document.activeElement?.blur());
  return { context, page, errors };
}

const shot = (page, name) => page.screenshot({ path: join(out, `iphone-390x664-${name}.jpg`), type: 'jpeg', quality: 86 });
// The status line is visually hidden; for the screenshot, a QA caption above the sheet shows what it says.
const caption = (page, text) => page.evaluate((words) => {
  document.querySelector('#qa-caption')?.remove();
  if (!words) return;
  const tag = document.createElement('div');
  tag.id = 'qa-caption';
  tag.textContent = words;
  tag.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;padding:6px 10px;border-radius:6px;background:#1f3a5f;color:#fff;font:13px/1.3 system-ui;z-index:2147483647;pointer-events:none';
  document.querySelector('.hj-dialog').append(tag);
}, text);
const state = (page) => page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const shown = (s) => !q(s).hidden;
  const send = q('.hj-form .hj-send');
  const body = q('.hj-sheet-body');
  return {
    title: { hidden: q('#hj-form-title').hidden, text: q('#hj-form-title').textContent },
    dialogLabelledBy: q('.hj-dialog').getAttribute('aria-labelledby'),
    status: q('#hj-status').textContent,
    statusRole: q('#hj-status').getAttribute('role'),
    statusVisuallyHidden: q('#hj-status').getBoundingClientRect().width <= 1,
    button: { label: send.textContent, disabled: send.getAttribute('aria-disabled'), background: getComputedStyle(send).backgroundColor },
    alert: shown('.hj-failure') ? q('.hj-failure').textContent : null,
    sent: shown('.hj-sent') ? q('.hj-sent').innerText : null,
    focus: document.activeElement?.id || document.activeElement?.className || document.activeElement?.tagName,
    errors: Object.fromEntries([...document.querySelectorAll('.hj-form .hj-err')].filter((e) => !e.hidden).map((e) => [e.id, e.textContent])),
    describedBy: { email: q('#hj-email').getAttribute('aria-describedby'), phone: q('#hj-phone').getAttribute('aria-describedby') },
    invalid: { email: q('#hj-email').getAttribute('aria-invalid'), phone: q('#hj-phone').getAttribute('aria-invalid') },
    kept: { name: q('#hj-name').value, email: q('#hj-email').value, phone: q('#hj-phone').value, message: q('#hj-message').value },
    fits: { scrollHeight: body.scrollHeight, visibleHeight: body.clientHeight },
  };
});
const press = (page) => page.tap('.hj-form .hj-send');
const fill = async (page, values) => { for (const [id, value] of Object.entries(values)) await page.fill(`#hj-${id}`, value); };

// 1-3: empty, neither filled, bad phone.
{
  const { context, page, errors } = await newPage();
  report.empty = await state(page);
  await shot(page, '1-empty');
  await fill(page, { name: 'Wren', message: 'A shelf for the mushroom lab, please.' });
  await press(page);
  await wait(300);
  report.neitherFilled = await state(page);
  await page.evaluate(() => document.activeElement?.blur());
  await shot(page, '2-neither-filled');
  await fill(page, { phone: '1234 5678' });
  await press(page);
  await wait(300);
  report.badPhone = await state(page);
  await page.evaluate(() => document.activeElement?.blur());
  await shot(page, '3-bad-phone');
  report.pageErrors1 = errors;
  await context.close();
}

// 4-7: sending, sent; 429; outage; and a misrouted 200 HTML page.
{
  const { context, page, errors } = await newPage();
  await fill(page, { name: 'Wren', email: 'wren@example.org', message: 'A shelf for the mushroom lab, please.' });
  await page.evaluate(() => document.querySelector('.hj-chip input').click());

  // 429, with the function's own Retry-After.
  next = [{ status: 429, body: '{"ok":false}', headers: { 'Retry-After': '60' } }];
  await press(page);
  await page.waitForSelector('.hj-failure:not([hidden])');
  await wait(300);
  report.busy = await state(page);
  await shot(page, '6-429-failure');
  // 429 that says 30 seconds.
  next = [{ status: 429, body: '{"ok":false}', headers: { 'Retry-After': '30' } }];
  await press(page);
  await wait(500);
  report.busy30 = (await state(page)).alert;

  // Outage: the function's 502 (Resend down), then no answer at all (connection dropped).
  next = [{ status: 502, body: '{"ok":false}' }];
  await press(page);
  await wait(500);
  report.outage = await state(page);
  await shot(page, '7-outage-failure');
  await page.route('**/api/contact', (route) => route.abort('connectionreset'));
  await press(page);
  await wait(500);
  report.networkDown = (await state(page)).alert;
  await page.unroute('**/api/contact');

  // A 200 that is not the function (an HTML page): no thank-you.
  next = [{ status: 200, body: '<!doctype html><title>HJaaS</title>', headers: { 'Content-Type': 'text/html' } }];
  await press(page);
  await wait(500);
  report.htmlPage = await state(page);
  next = [{ status: 200, body: '' }];
  await press(page);
  await wait(500);
  report.emptyBody = (await state(page)).alert;

  // Sending: held, grey, the status line says so. Then {"ok":true}: sent.
  next = [{ hold: true }, { status: 200, body: '{"ok":true}' }];
  await press(page);
  await wait(400);
  report.sending = await state(page);
  await caption(page, `QA note, not on the page: the status line (role="status", visually hidden) says "${report.sending.status}"`);
  await shot(page, '4-sending');
  await caption(page, '');
  release?.();
  await page.waitForSelector('.hj-sent:not([hidden])');
  await wait(500);
  report.sent = await state(page);
  await caption(page, `QA note, not on the page: the status line says "${report.sent.status}"`);
  await shot(page, '5-sent');
  report.pageErrors2 = errors;
  await context.close();
}

// 8-10: the iPhone keyboard (simulated), with the sheet following the visual viewport.
{
  const { context, page, errors } = await newPage({ fakeViewport: true });
  const KEYBOARD = 304; // leaves 360 px in sight, about what Safari leaves above an iPhone 13's keyboard
  const geometry = () => page.evaluate(() => {
    const vv = window.visualViewport;
    const box = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
    const body = document.querySelector('.hj-sheet-body');
    const focusedEl = document.activeElement;
    const f = focusedEl?.getBoundingClientRect();
    const view = body.getBoundingClientRect();
    return {
      visible: { top: vv.offsetTop, bottom: vv.offsetTop + vv.height },
      followsViewport: document.querySelector('.hj-dialog').classList.contains('is-vv'),
      sheet: box('.hj-sheet'),
      send: box('.hj-form .hj-send'),
      body: { scrollTop: Math.round(body.scrollTop), scrollHeight: body.scrollHeight, clientHeight: body.clientHeight },
      focused: focusedEl?.id || focusedEl?.className,
      focusedInView: f ? f.top >= view.top - 0.5 && f.bottom <= view.bottom + 0.5 : null,
    };
  });
  const k = (report.keyboard = {});
  k.closed = await geometry();
  // Tap the message box; the keyboard rises.
  await page.tap('#hj-message');
  await page.evaluate((h) => window.__keyboard(h), KEYBOARD);
  await wait(450);
  k.messageFocused = await geometry();
  k.sheetInSight = k.messageFocused.sheet.top >= k.messageFocused.visible.top && k.messageFocused.sheet.bottom <= k.messageFocused.visible.bottom + 0.5;
  await shot(page, '8-keyboard-message-focused');
  // Send, with the keyboard still up: scroll the sheet to its end.
  await page.evaluate(() => { const b = document.querySelector('.hj-sheet-body'); b.scrollTop = b.scrollHeight; });
  await wait(200);
  k.scrolledToSend = await geometry();
  k.sendReachable = k.scrolledToSend.send.top >= k.scrolledToSend.visible.top && k.scrolledToSend.send.bottom <= k.scrolledToSend.visible.bottom;
  await shot(page, '9-keyboard-send-reachable');
  // Send with nothing filled: focus goes back to the name box, which is brought into view once settled.
  await page.evaluate(() => document.querySelector('.hj-form').requestSubmit());
  await wait(450);
  k.errorRefocus = await geometry();
  await shot(page, '10-keyboard-error-refocus');
  // Safari also scrolls the page under the keyboard: the sheet follows the visual viewport down.
  await page.evaluate((h) => window.__keyboard(h, 100), KEYBOARD);
  await wait(200);
  k.pageScrolled = await geometry();
  k.pageScrolledFollows = k.pageScrolled.sheet.bottom === k.pageScrolled.visible.bottom;
  // Keyboard down: back to the bottom edge.
  await page.evaluate(() => window.__keyboard(0));
  await wait(200);
  k.keyboardDown = await geometry();
  // Closed: no longer following.
  await page.evaluate(() => document.querySelector('.hj-close').click());
  await wait(500);
  k.closedClass = await page.evaluate(() => document.querySelector('.hj-dialog').classList.contains('is-vv'));
  k.pageErrors = errors;
  await context.close();
}

await browser.close();
server.close();
writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
const k = report.keyboard;
console.log(`engine: ${engine}${webkitSkipped ? ` (WebKit: ${webkitSkipped})` : ''}`);
console.log('empty fits', report.empty.fits, '| neither', report.neitherFilled.fits, report.neitherFilled.errors, report.neitherFilled.describedBy, 'focus', report.neitherFilled.focus);
console.log('bad phone', report.badPhone.fits, report.badPhone.errors);
console.log('429:', report.busy.alert, '| 30 s:', report.busy30);
console.log('502:', report.outage.alert, '| network:', report.networkDown, '| kept:', JSON.stringify(report.outage.kept));
console.log('HTML 200:', report.htmlPage.alert, 'sent?', report.htmlPage.sent, '| empty 200:', report.emptyBody);
console.log('sending:', report.sending.button, report.sending.status, '| sent:', report.sent.status, 'title hidden', report.sent.title.hidden, 'focus', report.sent.focus, 'labelledby', report.sent.dialogLabelledBy);
console.log('keyboard: follows', k.messageFocused.followsViewport, 'sheet', JSON.stringify(k.messageFocused.sheet), 'visible', JSON.stringify(k.messageFocused.visible), 'in sight', k.sheetInSight, 'message in view', k.messageFocused.focusedInView);
console.log('  send reachable', k.sendReachable, JSON.stringify(k.scrolledToSend.send), '| error refocus', k.errorRefocus.focused, k.errorRefocus.focusedInView, '| page scrolled follows', k.pageScrolledFollows, JSON.stringify(k.pageScrolled.sheet), '| down', JSON.stringify(k.keyboardDown.sheet), '| after close is-vv', k.closedClass);
console.log('page errors', [...report.pageErrors1, ...report.pageErrors2, ...k.pageErrors]);

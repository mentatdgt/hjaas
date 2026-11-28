// Job 001: the reply group (email, phone with country code, at least one). Production build (`npm run build`
// first) from dist/, behind its built _headers; /api/contact is the function itself with Resend mocked, so nothing
// is sent. All 50 found, form opened, on an iPhone (390 px, WebKit), an iPad (WebKit) and desktop Chrome.
//
//   node qa/tools/form-reply.mjs
// Writes screenshots and report.json to qa/form-reply/.
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices, webkit } from 'playwright';

const site = fileURLToPath(new URL('../../', import.meta.url));
const out = join(site, 'qa/form-reply');
const dist = join(site, 'dist');
mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

Object.assign(process.env, { RESEND_API_KEY: 're_made_up', MAIL_FROM: 'HJaaS <from@example.org>', CONTACT_TO: 'inbox@example.org' });
const toResend = [];
globalThis.fetch = async (url, init) => { toResend.push(JSON.parse(init.body)); return Response.json({ id: 'mocked' }); };
const { default: contact } = await import('../../api/contact.js');

const csp = readFileSync(join(dist, '_headers'), 'utf8').match(/Content-Security-Policy: (.*)/)[1];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const posted = [];
let visitor = 0;
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/api/contact') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    posted.push(JSON.parse(body));
    const reply = await contact.fetch(new Request('https://www.hjaas.com/api/contact', { method: 'POST', body, headers: { 'Content-Type': req.headers['content-type'], Origin: 'https://www.hjaas.com', 'x-real-ip': `v${visitor++}` } }));
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

const scenes = Object.fromEntries(['build', 'grow', 'design', 'film', 'set'].map((id) => {
  const found = [...readFileSync(join(site, `src/scenes/${id}.ts`), 'utf8').matchAll(/\{ id: '([\w-]+)', art:/g)].map((m) => m[1]);
  if (found.length !== 10) throw new Error(`${id}: ${found.length} spots read`);
  return [id, { found, seen: true, panX: null }];
}));

// Chrome is the system Chrome. If a WebKit run cannot start (its browser not downloaded for this Playwright),
// the report says so and the same device is run in Chrome instead, named "-chrome-emulated": the layout and
// behaviour checks still hold there, WebKit's own rendering is then unchecked.
const chrome = () => chromium.launch({ channel: 'chrome' });
const RUNS = [
  ['iphone-webkit', () => webkit.launch(), { ...devices['iPhone 13'] }, 'Alt+Tab', 'iphone-chrome-emulated'], // 390 x 664
  ['ipad-webkit', () => webkit.launch(), { ...devices['iPad (gen 7)'] }, 'Alt+Tab', 'ipad-chrome-emulated'],
  ['desktop-chrome', chrome, { viewport: { width: 1440, height: 900 } }, 'Tab'],
];
const report = { csp: csp.match(/script-src[^;]*/)?.[0] };

for (const [wanted, launchWanted, wantedOptions, wantedTab, fallback] of RUNS) {
  let browser;
  let name = wanted;
  let options = wantedOptions;
  let tabKey = wantedTab;
  try {
    browser = await launchWanted();
  } catch (error) {
    report[wanted] = { skipped: String(error.message).split('\n')[0].replace(/\/Users\/[^/]+/g, '~') };
    if (!fallback) continue;
    const { defaultBrowserType, ...rest } = wantedOptions;
    [name, options, tabKey, browser] = [fallback, rest, 'Tab', await chrome()];
  }
  const context = await browser.newContext({ ...options, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const r = (report[name] = { viewport: options.viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`${m.type()}: ${m.text()}`); });
  const phoneChunk = [];
  page.on('request', (q) => { if (/\/assets\/phone-[\w-]+\.js$/.test(q.url())) phoneChunk.push(q.url().split('/').pop()); });
  await page.addInitScript((saved) => localStorage.setItem('hjaas:site:v2', JSON.stringify({ scenes: saved, unlocked: false, panned: false })), scenes);
  const shot = (state) => page.screenshot({ path: join(out, `${name}-${state}.jpg`), type: 'jpeg', quality: 84 });
  const press = () => (options.hasTouch ? page.tap('.hj-form .hj-send') : page.click('.hj-form .hj-send'));
  const openForm = async () => { await page.evaluate(() => document.querySelector('.hj-contact').click()); await wait(800); };
  const errorsShown = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.hj-form .hj-err')].map((e) => [e.id, e.hidden ? null : e.textContent])));

  await page.goto(base);
  await page.waitForSelector('.hj-contact', { state: 'visible' });
  await wait(2500);
  r.phoneChunkBeforeOpening = [...phoneChunk];
  await openForm();
  await page.waitForFunction(() => document.querySelector('#hj-country').options.length > 1);
  r.phoneChunkAfterOpening = [...phoneChunk];

  r.layout = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const box = (s) => { const b = q(s).getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), right: Math.round(b.right) }; };
    const canvas = document.createElement('canvas').getContext('2d');
    // A placeholder fits if its text, in the field's own font, is no wider than the field's content box.
    const placeholders = Object.fromEntries([...document.querySelectorAll('.hj-form [placeholder]')].map((el) => {
      const st = getComputedStyle(el);
      canvas.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
      const room = el.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
      const longestLine = el.tagName === 'TEXTAREA' ? 0 : canvas.measureText(el.placeholder).width;
      return [el.id, { text: el.placeholder, textWidth: Math.round(longestLine), room: Math.round(room), fits: el.tagName === 'TEXTAREA' ? el.scrollHeight <= el.clientHeight + 1 : longestLine <= room }];
    }));
    const sizes = Object.fromEntries([...document.querySelectorAll('.hj-form input:not([tabindex="-1"]):not([type=checkbox]), .hj-form select, .hj-form textarea')].map((el) => [el.id, getComputedStyle(el).fontSize]));
    const country = box('.hj-country');
    const phone = box('#hj-phone');
    const sheet = box('.hj-sheet-body');
    const select = q('#hj-country');
    return {
      sheet,
      country, phone,
      oneRow: country.y === phone.y && country.h === phone.h,
      rowInsideSheet: phone.right <= sheet.right - 17 && country.x >= sheet.x + 17,
      face: q('.hj-country-code').textContent,
      faceFits: q('.hj-country-face').scrollWidth <= q('.hj-country-face').clientWidth,
      selectValue: select.value,
      selectText: select.selectedOptions[0].textContent,
      firstOptions: [...select.options].slice(0, 4).map((o) => `${o.value}: ${o.textContent}`),
      options: select.options.length,
      emptyOption: [...select.options].some((o) => !o.value),
      placeholders,
      fontSizes: sizes,
      allAtLeast16: Object.values(sizes).every((s) => parseFloat(s) >= 16),
      placeholderColour: getComputedStyle(q('#hj-email'), '::placeholder').color,
      emailBorder: getComputedStyle(q('#hj-email')).borderTopColor,
      faceBorder: getComputedStyle(q('.hj-country-face')).borderTopColor,
    };
  });
  await page.evaluate(() => (document.querySelector('.hj-sheet-body').scrollTop = 0));
  await wait(100);
  await shot('1-empty');

  // Tab order, from the name field on.
  await page.focus('#hj-name');
  const stops = ['hj-name'];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press(tabKey);
    stops.push(await page.evaluate(() => { const e = document.activeElement; return e.id || (e.name === 'need' ? `need:${e.value}` : e.className) || e.tagName; }));
  }
  r.tabOrder = stops;
  const compact = stops.map((s) => (s.startsWith('need:') ? 'need' : s)).filter((s, i, all) => s !== 'need' || all[i - 1] !== 'need');
  r.tabOrderOk = JSON.stringify(compact.slice(0, 7)) === JSON.stringify(['hj-name', 'hj-email', 'hj-country', 'hj-phone', 'need', 'hj-message', 'hj-send']);

  // Focus zoom (iOS zooms into a focused field under 16 px): the page scale before and after focusing each.
  r.scaleOnFocus = {};
  for (const id of ['hj-email', 'hj-country', 'hj-phone']) {
    await page.focus(`#${id}`);
    await wait(150);
    r.scaleOnFocus[id] = await page.evaluate(() => window.visualViewport?.scale ?? 1);
  }
  await page.evaluate(() => document.activeElement?.blur());

  // Neither email nor phone: the group's message, focus on the email box.
  await page.fill('#hj-name', 'Wren');
  await page.fill('#hj-message', 'A shelf for the mushroom lab, please.');
  await press();
  await wait(300);
  r.groupError = { errors: await errorsShown(), focus: await page.evaluate(() => document.activeElement.id), invalid: await page.evaluate(() => ['hj-email', 'hj-phone'].map((id) => document.getElementById(id).getAttribute('aria-invalid'))), describedBy: await page.evaluate(() => ['hj-email', 'hj-phone'].map((id) => document.getElementById(id).getAttribute('aria-describedby'))), groupLive: await page.evaluate(() => document.getElementById('hj-reply-err').getAttribute('aria-live')) };
  await page.evaluate(() => { const b = document.querySelector('.hj-sheet-body'); b.scrollTop += document.querySelector('.hj-reply').getBoundingClientRect().top - b.getBoundingClientRect().top - 12; });
  await wait(150);
  await shot('2-group-error');

  // A wrong Singapore number.
  await page.fill('#hj-phone', '1234 5678');
  await press();
  await wait(300);
  r.badNumber = await errorsShown();
  await shot('3-bad-number');

  // Pasted from elsewhere: the select follows the + code, the rest stays as typed.
  await page.evaluate(() => {
    const el = document.querySelector('#hj-phone');
    el.value = '+44 7911 123456';
    el.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste', bubbles: true }));
  });
  await wait(100);
  r.pasted = await page.evaluate(() => ({ country: document.querySelector('#hj-country').value, phone: document.querySelector('#hj-phone').value, face: document.querySelector('.hj-country-code').textContent, phoneError: document.querySelector('#hj-phone-err').hidden ? null : document.querySelector('#hj-phone-err').textContent }));
  await shot('4-pasted-gb');

  // Back to Singapore, a real number, phone only: sent, through the function.
  await page.selectOption('#hj-country', 'SG');
  await page.fill('#hj-phone', '9888 1135');
  posted.length = 0;
  toResend.length = 0;
  await press();
  await page.waitForSelector('.hj-sent:not([hidden])', { timeout: 8000 });
  await wait(700);
  r.phoneOnlySend = { posted: posted.map(({ extra, ...rest }) => rest), toResend: toResend.map(({ from, to, ...rest }) => rest), says: await page.textContent('.hj-sent-line') };
  await shot('5-phone-only-sent');

  // Opened again after a send: empty, Singapore again.
  await page.evaluate(() => document.querySelector('.hj-done').click());
  await wait(600);
  await openForm();
  r.afterReset = await page.evaluate(() => ({ country: document.querySelector('#hj-country').value, face: document.querySelector('.hj-country-code').textContent, phone: document.querySelector('#hj-phone').value, errorsHidden: [...document.querySelectorAll('.hj-form .hj-err')].every((e) => e.hidden) }));

  // Both: the email gets the reply.
  await page.fill('#hj-name', 'Wren');
  await page.fill('#hj-email', 'wren@example.org');
  await page.fill('#hj-phone', '9888 1135');
  await page.fill('#hj-message', 'A shelf for the mushroom lab, please.');
  posted.length = 0;
  toResend.length = 0;
  await press();
  await page.waitForSelector('.hj-sent:not([hidden])', { timeout: 8000 });
  r.bothSend = { posted: posted.map(({ extra, ...rest }) => rest), replyTo: toResend[0]?.reply_to, says: await page.textContent('.hj-sent-line') };

  // Playwright's own screenshot styles are refused by the CSP in WebKit and logged: not the page's doing.
  r.consoleErrors = errors.filter((e) => !/stylesheet|inline style/i.test(e));
  await browser.close();
}

server.close();
writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 1));
process.exit(0);

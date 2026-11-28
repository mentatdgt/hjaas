// Job 002: the whole contact form fits on one screen; the Send button is the mushroom red.
// Production build (`npm run build` first) from dist/, behind its built _headers. All 50 found, form opened.
// For each size: does the form fit (the sheet body's scroll height against its visible height), with nothing cut off
// or overlapping, tap targets of 44 px and fields still at 16 px? Empty, then the "neither filled" error states.
// Then the button: normal, hovered, focused, sending (grey) and failed (red again).
//
//   node qa/tools/form-compact.mjs [out-folder]
// Writes screenshots and report.json to qa/form-compact/ (or the folder given).
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices, webkit } from 'playwright';

const site = fileURLToPath(new URL('../../', import.meta.url));
const out = process.argv[2] ? resolve(process.argv[2]) : join(site, 'qa/form-compact');
const dist = join(site, 'dist');
mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// The endpoint holds each post until released, then fails it: "sending" can be photographed, then "try again".
let release = null;
const csp = readFileSync(join(dist, '_headers'), 'utf8').match(/Content-Security-Policy: (.*)/)[1];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/api/contact') {
    for await (const _ of req);
    await new Promise((r) => (release = r));
    res.writeHead(502, { 'Content-Type': 'application/json' }).end('{"ok":false}');
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

// iPhones: the area Safari leaves for the page with its toolbars showing (844 -> 664, 932 -> 750).
const iphone = devices['iPhone 13'];
const ipad = devices['iPad (gen 7)'];
const ipadLandscape = devices['iPad (gen 7) landscape'];
const SIZES = [
  ['iphone-390x664', { ...iphone, viewport: { width: 390, height: 664 } }],
  ['iphone-430x750', { ...iphone, viewport: { width: 430, height: 750 }, screen: { width: 430, height: 932 } }],
  ['ipad-portrait', { ...ipad }],
  ['ipad-landscape', { ...ipadLandscape }],
  ['desktop-1280x720', { viewport: { width: 1280, height: 720 } }],
  // Tall enough that the sheet hangs from the button rather than sitting in the middle.
  ['desktop-1440x900', { viewport: { width: 1440, height: 900 } }],
];

// Real WebKit if this Playwright has it; otherwise system Chrome, and the report says so.
let engine = 'webkit';
let browser;
try {
  browser = await webkit.launch();
} catch (error) {
  engine = 'chrome';
  browser = await chromium.launch({ channel: 'chrome' });
  var webkitSkipped = String(error.message).split('\n')[0].replace(/\/Users\/[^/]+/g, '~');
}
const report = { engine, ...(webkitSkipped ? { webkitSkipped } : {}), sizes: {} };

const measure = (page) => page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const rect = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
  const body = q('.hj-sheet-body');
  const sheet = rect(q('.hj-sheet'));
  const send = rect(q('.hj-form .hj-send'));
  const visible = (el) => !el.closest('[hidden]') && el.getClientRects().length > 0;
  // Everything the eye reads, in order down the sheet. Each must sit inside the sheet and clear of its neighbours.
  const parts = [...document.querySelectorAll('#hj-form-title, .hj-close, .hj-form .hj-alert, .hj-field > label, .hj-field > legend, .hj-sub > label, .hj-form input:not([type=checkbox]):not([tabindex="-1"]), .hj-country-face, .hj-chip span, .hj-form textarea, .hj-err, .hj-form .hj-send')].filter(visible);
  const overlaps = [];
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
    const a = rect(parts[i]);
    const b = rect(parts[j]);
    if (parts[i].contains(parts[j]) || parts[j].contains(parts[i])) continue;
    // A legend holds its hint span; a chip's label holds its span. Same box: skip.
    if (a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5) overlaps.push(`${parts[i].id || parts[i].className || parts[i].tagName} x ${parts[j].id || parts[j].className || parts[j].tagName}`);
  }
  const outside = parts.filter((el) => { const b = rect(el); return b.x < sheet.x - 0.5 || b.r > sheet.r + 0.5 || b.y < sheet.y - 0.5 || b.b > Math.min(sheet.b, innerHeight) + 0.5; }).map((el) => el.id || el.className || el.tagName);
  const clipped = parts.filter((el) => el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.scrollWidth > el.clientWidth + 1).map((el) => el.id || el.className);
  const chips = [...document.querySelectorAll('.hj-chip span')].map(rect);
  const gaps = [];
  for (let i = 0; i < chips.length; i++) for (let j = i + 1; j < chips.length; j++) {
    const a = chips[i]; const b = chips[j];
    const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.r, b.r));
    const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.b, b.b));
    if (dx === 0 || dy === 0) gaps.push(Math.round(Math.max(dx, dy) * 10) / 10);
  }
  const textarea = q('#hj-message');
  const st = (el) => getComputedStyle(el);
  const px = (sel) => st(q(sel)).fontSize;
  return {
    viewport: { w: innerWidth, h: innerHeight },
    scrollHeight: body.scrollHeight,
    visibleHeight: body.clientHeight,
    fits: body.scrollHeight <= body.clientHeight,
    sheet: { top: Math.round(sheet.y), bottom: Math.round(sheet.b), height: Math.round(sheet.h), centred: q('.hj-dialog').classList.contains('is-centred'), roomAboveButton: Math.round(q('.hj-contact').getBoundingClientRect().top - 26) },
    sheetInView: sheet.y >= 0 && sheet.b <= innerHeight + 0.5,
    sendInView: send.y >= sheet.y && send.b <= Math.min(sheet.b, innerHeight),
    sendHeight: send.h,
    chipHeights: [...new Set(chips.map((c) => Math.round(c.h * 10) / 10))],
    chipRows: new Set(chips.map((c) => Math.round(c.y))).size,
    smallestChipGap: gaps.length ? Math.min(...gaps) : null,
    overlaps,
    outside,
    clipped,
    textareaLines: Math.round((textarea.clientHeight - parseFloat(st(textarea).paddingTop) - parseFloat(st(textarea).paddingBottom)) / parseFloat(st(textarea).lineHeight) * 10) / 10,
    placeholderFits: textarea.scrollHeight <= textarea.clientHeight + 1,
    fieldSizes: [...document.querySelectorAll('.hj-form input:not([tabindex="-1"]):not([type=checkbox]), .hj-form select, .hj-form textarea')].map((el) => st(el).fontSize),
    type: { title: px('#hj-form-title'), label: px('.hj-field > label'), legend: px('.hj-field > legend'), hint: px('#hj-reply-hint'), sub: px('.hj-sub > label'), chip: px('.hj-chip span'), error: px('.hj-err'), send: px('.hj-form .hj-send') },
    errors: [...document.querySelectorAll('.hj-form .hj-err')].filter(visible).map((e) => e.textContent),
  };
});

for (const [name, options] of SIZES) {
  const { defaultBrowserType, ...rest } = options;
  const context = await browser.newContext({ ...rest, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((saved) => localStorage.setItem('hjaas:site:v2', JSON.stringify({ scenes: saved, unlocked: false, panned: false })), scenes);
  const shot = (state) => page.screenshot({ path: join(out, `${name}-${state}.jpg`), type: 'jpeg', quality: 84 });
  const open = async () => {
    await page.goto(base);
    await page.waitForSelector('.hj-contact', { state: 'visible' });
    await wait(2500);
    await page.evaluate(() => document.querySelector('.hj-contact').click());
    await wait(800);
    await page.waitForFunction(() => document.querySelector('#hj-country').options.length > 1);
    await page.evaluate(() => document.activeElement?.blur());
  };
  const press = () => page.evaluate(() => document.querySelector('.hj-form').requestSubmit());
  const r = (report.sizes[name] = {});

  await open();
  r.found = await page.evaluate(() => document.querySelector('.hj-contact').textContent.trim());
  r.empty = await measure(page);
  await shot('1-empty');

  // Neither email nor phone, and no message: the brief's example (the group's line plus a field's).
  await page.fill('#hj-name', 'Wren');
  await press();
  await wait(250);
  await page.evaluate(() => document.activeElement?.blur());
  r.neitherFilled = await measure(page);
  await shot('2-neither-filled');

  // Nothing at all: the most lines the form can show at once.
  await page.fill('#hj-name', '');
  await press();
  await wait(250);
  await page.evaluate(() => document.activeElement?.blur());
  r.allEmpty = await measure(page);
  await shot('3-all-empty');

  // Job 005: a wrong number, with the longer line ("... Check the digits or pick a different country code.").
  // Singapore, then the longest country name there is, which takes the most lines.
  await page.fill('#hj-name', 'Wren');
  await page.fill('#hj-message', 'A shelf for the mushroom lab, please.');
  await page.fill('#hj-phone', '1234 5678');
  await press();
  await wait(250);
  await page.evaluate(() => document.activeElement?.blur());
  await page.evaluate(() => (document.querySelector('.hj-sheet-body').scrollTop = 0));
  r.badPhone = await measure(page);
  r.badPhone.phoneErrorLines = await page.evaluate(() => { const e = document.querySelector('#hj-phone-err'); return Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)); });
  await shot('4-bad-phone');
  r.longestCountry = await page.evaluate(() => [...document.querySelector('#hj-country').options].reduce((a, b) => (b.textContent.length > a.textContent.length ? b : a)).value);
  await page.selectOption('#hj-country', r.longestCountry);
  await press();
  await wait(250);
  await page.evaluate(() => document.activeElement?.blur());
  await page.evaluate(() => (document.querySelector('.hj-sheet-body').scrollTop = 0));
  r.badPhoneLongCountry = await measure(page);
  r.badPhoneLongCountry.phoneErrorLines = await page.evaluate(() => { const e = document.querySelector('#hj-phone-err'); return Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)); });
  await shot('5-bad-phone-long-country');
  r.pageErrors = errors;
  await context.close();
}

// The button on its own: normal, hovered, focused, sending, failed. A desktop (hover and keyboard) and a phone.
const colour = (page) => page.evaluate(() => {
  const el = document.querySelector('.hj-form .hj-send');
  const s = getComputedStyle(el);
  return { background: s.backgroundColor, color: s.color, border: s.borderTopColor, outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, disabled: el.getAttribute('aria-disabled'), label: el.textContent, transition: s.transition };
});
const luminance = (rgb) => {
  const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };

report.button = {};
for (const [name, options] of [['desktop', { viewport: { width: 1280, height: 720 } }], ['iphone', { ...iphone, viewport: { width: 390, height: 664 } }]]) {
  const { defaultBrowserType, ...rest } = options;
  const context = await browser.newContext({ ...rest, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.addInitScript((saved) => localStorage.setItem('hjaas:site:v2', JSON.stringify({ scenes: saved, unlocked: false, panned: false })), scenes);
  await page.goto(base);
  await page.waitForSelector('.hj-contact', { state: 'visible' });
  await wait(2500);
  await page.evaluate(() => document.querySelector('.hj-contact').click());
  await wait(800);
  await page.fill('#hj-name', 'Wren');
  await page.fill('#hj-email', 'wren@example.org');
  await page.fill('#hj-message', 'A shelf for the mushroom lab, please.');
  await page.evaluate(() => document.activeElement?.blur());
  if (!options.hasTouch) await page.mouse.move(2, 2);
  // (Only needed if the form scrolls, as it did before this job.)
  await page.locator('.hj-form .hj-send').scrollIntoViewIfNeeded();
  await wait(300);
  const box = await page.locator('.hj-form .hj-send').boundingBox();
  const clip = { x: Math.max(0, box.x - 12), y: Math.max(0, box.y - 12), width: box.width + 24, height: box.height + 24 };
  const b = (report.button[name] = {});
  const snap = async (state) => { await wait(350); b[state] = await colour(page); b[state].contrast = contrast(b[state].color, b[state].background); await page.screenshot({ path: join(out, `button-${name}-${state}.png`), clip }); };
  await snap('1-normal');
  if (!options.hasTouch) {
    await page.hover('.hj-form .hj-send');
    await snap('2-hover');
    await page.mouse.move(2, 2);
    // Keyboard focus: Tab from the message box lands on Send.
    await page.focus('#hj-message');
    await page.keyboard.press('Tab');
    await snap('3-focused');
  }
  if (options.hasTouch) await page.tap('.hj-form .hj-send');
  else await page.keyboard.press('Enter');
  await wait(50);
  b.fadeStarted = await colour(page);
  await snap('4-sending');
  // A second press while sending does nothing.
  b.secondPressIgnored = await page.evaluate(() => { const before = document.querySelector('.hj-form .hj-send').textContent; document.querySelector('.hj-form').requestSubmit(); return document.querySelector('.hj-form .hj-send').textContent === before; });
  release?.();
  await wait(400);
  b.failureShown = await page.evaluate(() => !document.querySelector('.hj-failure').hidden);
  await snap('5-failed');
  await context.close();
}

await browser.close();
server.close();
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
const line = (n, s) => `${n.padEnd(18)} ${String(s.scrollHeight).padStart(4)} / ${String(s.visibleHeight).padEnd(4)} ${s.fits ? 'fits' : 'SCROLLS'}${s.overlaps.length ? ` overlaps:${s.overlaps.length}` : ''}${s.outside.length ? ` outside:${s.outside}` : ''}${s.clipped.length ? ` clipped:${s.clipped}` : ''}`;
console.log(`engine: ${engine}${webkitSkipped ? ` (WebKit: ${webkitSkipped})` : ''}`);
for (const [n, r] of Object.entries(report.sizes)) {
  console.log(line(`${n}`, r.empty), '| neither:', r.neitherFilled.scrollHeight, '/', r.neitherFilled.visibleHeight, '| all-empty:', r.allEmpty.scrollHeight, '/', r.allEmpty.visibleHeight, '| bad phone:', r.badPhone.scrollHeight, '/', r.badPhone.visibleHeight, `(${r.badPhone.phoneErrorLines} lines; long country ${r.badPhoneLongCountry.scrollHeight} / ${r.badPhoneLongCountry.visibleHeight}, ${r.badPhoneLongCountry.phoneErrorLines} lines)`, '| chips', r.empty.chipHeights, 'rows', r.empty.chipRows, 'gap', r.empty.smallestChipGap, r.pageErrors.length ? r.pageErrors : '');
}
for (const [n, b] of Object.entries(report.button)) for (const [state, c] of Object.entries(b)) if (c && c.background) console.log(n, state, c.background, c.color, c.contrast, c.disabled, c.label);

// Assessment A: the contact form on desktop, every state, plus keyboard checks (read-only review).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('qa/impeccable/assessment-a/shots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5173/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const m = {};

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const clip = { x: 960, y: 40, width: 480, height: 760 };
const shot = (name, c = clip) => page.screenshot({ path: path.join(OUT, `${name}.png`), ...(c ? { clip: c } : {}) });
const box = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
  }, sel);
const active = () =>
  page.evaluate(() => {
    const a = document.activeElement;
    if (!a) return null;
    return `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''}${a.name ? `[${a.name}${a.value && a.type === 'checkbox' ? '=' + a.value : ''}]` : ''}${a.className ? '.' + a.className.split(' ').join('.') : ''}`;
  });

await page.goto(`${BASE}?intro=off&found=10`);
await page.waitForSelector('.hj-scene:not(.is-pre) .hj-logo');
await page.evaluate(() => document.fonts.ready);
await wait(1000);

// Keyboard: Tab, Tab, Enter
await page.keyboard.press('Tab');
await page.keyboard.press('Tab');
m.beforeEnter = await active();
await page.keyboard.press('Enter');
await wait(60);
await shot('f-00-opening-60ms', null);
await wait(700);
m.afterEnter = { active: await active(), open: await page.evaluate(() => document.querySelector('.hj-dialog').open) };
await shot('f-01-empty-full', null);
await shot('f-01-empty');
m.boxes = {};
for (const s of ['.hj-dialog', '.hj-sheet', '.hj-sheet h2', '.hj-close', '#hj-name', '#hj-email', '#hj-message', '.hj-form .hj-send', '.hj-pin', '.hj-needs legend', '.hj-chips'])
  m.boxes[s] = await box(s);
m.chips = await page.evaluate(() =>
  [...document.querySelectorAll('.hj-chip')].map((c) => {
    const r = c.getBoundingClientRect();
    return { t: c.textContent.trim(), w: +r.width.toFixed(1), h: +r.height.toFixed(1), x: +r.x.toFixed(1), y: +r.y.toFixed(1) };
  }),
);
m.placeholder = await page.evaluate(() => [...document.querySelectorAll('.hj-form input, .hj-form textarea')].map((i) => i.placeholder));
m.typography = await page.evaluate(() => {
  const g = (s) => {
    const cs = getComputedStyle(document.querySelector(s));
    return { size: cs.fontSize, weight: cs.fontWeight, color: cs.color, lh: cs.lineHeight };
  };
  return { h2: g('.hj-sheet h2'), label: g('.hj-field > label'), legend: g('.hj-field > legend'), input: g('#hj-name'), chip: g('.hj-chip span'), send: g('.hj-form .hj-send') };
});

// Tab order in the dialog
m.tabOrder = [m.afterEnter.active];
for (let i = 0; i < 12; i++) {
  await page.keyboard.press('Tab');
  m.tabOrder.push(await active());
  const a = m.tabOrder[m.tabOrder.length - 1];
  if (a.includes('need=Build')) {
    await wait(250);
    await shot('f-02-focus-chip');
  }
  if (a.includes('hj-send') && !m.sendShot) {
    m.sendShot = true;
    await wait(250);
    await shot('f-02-focus-send');
  }
  if (a.includes('hj-close') && !m.closeShot) {
    m.closeShot = true;
    await wait(250);
    await shot('f-02-focus-close');
  }
}
// Space toggles a chip by keyboard?
await page.focus('.hj-chip input[value="Design"]');
await page.keyboard.press('Space');
m.chipSpace = await page.evaluate(() => document.querySelector('.hj-chip input[value="Design"]').checked);
await page.keyboard.press('Space');

// Submit empty by pressing Enter in the name field
await page.focus('#hj-name');
await page.keyboard.press('Enter');
await wait(400);
await shot('f-03-errors');
m.errors = {
  active: await active(),
  texts: await page.evaluate(() => [...document.querySelectorAll('.hj-err')].map((e) => (e.hidden ? null : e.textContent))),
  sheet: await box('.hj-sheet'),
  err: await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('#hj-name-err'));
    return { size: cs.fontSize, color: cs.color };
  }),
  invalidBorder: await page.evaluate(() => getComputedStyle(document.querySelector('#hj-email')).borderColor),
  focusedInvalidBorder: await page.evaluate(() => getComputedStyle(document.querySelector('#hj-name')).borderColor),
  scroll: await page.evaluate(() => {
    const s = document.querySelector('.hj-sheet');
    return { scrollH: s.scrollHeight, clientH: s.clientHeight };
  }),
};

// Name, bad email, blur
await page.fill('#hj-name', 'Mei Lin Tan');
await page.fill('#hj-email', 'meilin@gmail');
await page.focus('#hj-message');
await wait(300);
await shot('f-04-bad-email');
m.badEmail = await page.evaluate(() => [...document.querySelectorAll('.hj-err')].map((e) => (e.hidden ? null : e.textContent)));
await page.fill('#hj-email', 'meilin@gmail.com');
await page.click('.hj-chip:nth-child(2)');
await page.click('.hj-chip:nth-child(6)');
await page.fill('#hj-message', 'We are redoing a 4-room flat in Tiong Bahru and would love help with the kitchen and built-in shelving. Could we talk next week?');
await page.mouse.move(1100, 850);
await wait(300);
await shot('f-05-filled');

// Sending
await page.click('.hj-form .hj-send');
await wait(300);
await shot('f-06-sending');
m.sending = await page.evaluate(() => {
  const b = document.querySelector('.hj-form .hj-send');
  return { disabled: b.disabled, text: b.textContent, active: document.activeElement?.className, fieldsDisabled: [...document.querySelectorAll('.hj-form input, .hj-form textarea')].some((i) => i.disabled) };
});
await wait(1000);
await shot('f-07-sent');
await shot('f-07-sent-full', null);
m.sent = { active: await active(), sheet: await box('.hj-sheet'), done: await box('.hj-done') };
// Tab order in the success state
m.sentTab = [];
for (let i = 0; i < 3; i++) {
  await page.keyboard.press('Tab');
  m.sentTab.push(await active());
}
await page.keyboard.press('Escape');
await wait(120);
await shot('f-08-closing-120ms', null);
await wait(500);
m.afterEscape = { active: await active(), open: await page.evaluate(() => document.querySelector('.hj-dialog').open) };

// Error alert states, rendered exactly as form.ts would (DOM only, no source change)
await page.click('.hj-pin-action');
await wait(600);
await page.fill('#hj-name', 'Mei Lin Tan');
await page.fill('#hj-email', 'meilin@gmail.com');
await page.fill('#hj-message', 'Hello Hui Jie, a short note.');
await page.evaluate(() => {
  const a = document.querySelector('.hj-alert');
  a.textContent = 'This form is not switched on yet, so your message has not been sent.';
  a.hidden = false;
});
await page.mouse.move(1100, 850);
await wait(200);
await shot('f-09-alert-not-connected');
m.alert = { box: await box('.hj-alert'), sheet: await box('.hj-sheet'), viewportH: 900 };
await page.evaluate(() => {
  document.querySelector('.hj-alert').textContent = 'Your message could not be sent. Check your connection and try again.';
});
await shot('f-09-alert-failed');

// All three errors plus the alert: tallest the sheet can get
await page.fill('#hj-name', '');
await page.fill('#hj-email', '');
await page.fill('#hj-message', '');
await page.click('.hj-form .hj-send');
await wait(300);
m.tallest = { sheet: await box('.hj-sheet'), scroll: await page.evaluate(() => { const s = document.querySelector('.hj-sheet'); return { scrollH: s.scrollHeight, clientH: s.clientHeight }; }) };

// A laptop-height window
await page.setViewportSize({ width: 1280, height: 640 });
await wait(500);
await shot('f-10-short-1280x640', null);
m.short = { dialog: await box('.hj-dialog'), sheet: await box('.hj-sheet'), pin: await box('.hj-pin'), scroll: await page.evaluate(() => { const s = document.querySelector('.hj-sheet'); return { scrollH: s.scrollHeight, clientH: s.clientHeight }; }) };

// Reduced motion: unlock + open
await ctx.close();
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
const p2 = await ctx2.newPage();
await p2.goto(`${BASE}?intro=off&found=10`);
await p2.waitForSelector('.hj-scene:not(.is-pre) .hj-logo');
await wait(800);
await p2.click('.hj-pin-action');
await wait(500);
await p2.screenshot({ path: path.join(OUT, 'f-11-reduced-motion-open.png') });

fs.writeFileSync(path.join(OUT, 'f-measures.json'), JSON.stringify(m, null, 2));
await browser.close();
console.log(JSON.stringify(m, null, 1));

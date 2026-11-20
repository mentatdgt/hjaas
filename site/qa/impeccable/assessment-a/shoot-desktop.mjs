// Assessment A: desktop screenshots and measurements (read-only review).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('qa/impeccable/assessment-a/shots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5173/';
const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(OUT, `${name}.png`), ...opts });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const corner = { x: 1440 - 520, y: 0, width: 520, height: 200 };
const measures = {};

const rect = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
      fontSize: cs.fontSize, fontWeight: cs.fontWeight, color: cs.color, bg: cs.backgroundColor, font: cs.fontFamily.slice(0, 40),
    };
  }, sel);

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));

const ready = async () => {
  await page.waitForSelector('.hj-scene:not(.is-pre) .hj-logo');
  await page.evaluate(() => document.fonts.ready);
  await wait(1200);
};

// 1. Fresh visitor
await page.goto(`${BASE}?reset&intro=off`);
await ready();
await shot(page, 'd-01-fresh-full');
await shot(page, 'd-01-fresh-corner', { clip: corner });
await shot(page, 'd-01-fresh-logo', { clip: { x: 0, y: 0, width: 420, height: 200 } });
measures.fresh = {
  logo: await rect(page, '.hj-logo'),
  counter: await rect(page, '.hj-counter'),
  pin: await rect(page, '.hj-pin'),
  pinFace: await rect(page, '.hj-pin-face'),
  icon: await rect(page, '.hj-pin-icon'),
  count: await rect(page, '.hj-pin-count'),
  of: await rect(page, '.hj-pin-of'),
  note: await rect(page, '.hj-note'),
  hud: await rect(page, '.hj-hud'),
  noteText: await page.evaluate(() => document.querySelector('.hj-note')?.textContent),
  pinVars: await page.evaluate(() => {
    const s = document.querySelector('.hj-pin').style;
    return { wc: s.getPropertyValue('--wc'), wb: s.getPropertyValue('--wb'), d0: s.getPropertyValue('--d0') };
  }),
};

// 2. Mid-hunt
await page.goto(`${BASE}?intro=off&found=4`);
await ready();
await shot(page, 'd-02-mid-corner', { clip: corner });
measures.midNote = await page.evaluate(() => ({
  text: document.querySelector('.hj-note')?.textContent,
  on: document.querySelector('.hj-note')?.classList.contains('is-on'),
}));
await wait(6500);
await shot(page, 'd-02-mid-corner-after-note', { clip: corner });

// 3. Unlocked
await page.goto(`${BASE}?intro=off&found=10`);
await ready();
await shot(page, 'd-03-unlocked-full');
await shot(page, 'd-03-unlocked-corner', { clip: corner });
measures.unlocked = {
  pin: await rect(page, '.hj-pin'),
  action: await rect(page, '.hj-pin-action'),
  label: await rect(page, '.hj-pin-label'),
  icon: await rect(page, '.hj-pin-icon'),
  counter: await rect(page, '.hj-counter'),
};
// hover
await page.hover('.hj-pin-action');
await wait(250);
await shot(page, 'd-03-unlocked-hover-250ms', { clip: corner });
await wait(900);
await shot(page, 'd-03-unlocked-hover-rest', { clip: corner });
await page.mouse.move(700, 600);

// Keyboard: tab order from the top of the document
const order = [];
for (let i = 0; i < 4; i++) {
  await page.keyboard.press('Tab');
  order.push(
    await page.evaluate(() => {
      const a = document.activeElement;
      return a ? `${a.tagName.toLowerCase()}.${a.className} [${a.getAttribute('aria-label') ?? a.textContent?.trim().slice(0, 30)}]` : null;
    }),
  );
  if (i === 0) {
    await wait(900);
    await shot(page, 'd-04-focus-tab1', { clip: { x: 0, y: 0, width: 1440, height: 220 } });
  }
  if (i === 1) {
    await wait(900);
    await shot(page, 'd-04-focus-tab2', { clip: { x: 0, y: 0, width: 1440, height: 220 } });
  }
}
measures.tabOrderUnlocked = order;

// Focus the action precisely and open with Enter
await page.focus('.hj-pin-action');
await page.keyboard.press('Tab');
await page.keyboard.press('Shift+Tab');
await wait(900);
await shot(page, 'd-04-focus-action', { clip: corner });
await page.keyboard.press('Enter');
await wait(700);
await shot(page, 'd-05-form-empty-full');
measures.form = {
  dialog: await rect(page, '.hj-dialog'),
  sheet: await rect(page, '.hj-sheet'),
  h2: await rect(page, '.hj-sheet h2'),
  close: await rect(page, '.hj-close'),
  label: await rect(page, '.hj-field > label'),
  legend: await rect(page, '.hj-field > legend'),
  input: await rect(page, '#hj-name'),
  textarea: await rect(page, '#hj-message'),
  chip: await rect(page, '.hj-chip span'),
  send: await rect(page, '.hj-form .hj-send'),
  active: await page.evaluate(() => document.activeElement?.id),
  sheetScroll: await page.evaluate(() => {
    const s = document.querySelector('.hj-sheet');
    return { scrollH: s.scrollHeight, clientH: s.clientHeight };
  }),
  chips: await page.evaluate(() =>
    [...document.querySelectorAll('.hj-chip')].map((c) => {
      const r = c.getBoundingClientRect();
      return { t: c.textContent.trim(), w: +r.width.toFixed(1), h: +r.height.toFixed(1), x: +r.x.toFixed(1), y: +r.y.toFixed(1) };
    }),
  ),
};
const d = measures.form.dialog;
const dclip = { x: Math.max(0, d.x - 30), y: 0, width: Math.min(1440 - Math.max(0, d.x - 30), d.w + 60), height: 900 };
await shot(page, 'd-05-form-empty', { clip: dclip });

// Tab order inside the dialog
const inner = [];
for (let i = 0; i < 13; i++) {
  await page.keyboard.press('Tab');
  inner.push(
    await page.evaluate(() => {
      const a = document.activeElement;
      return a ? `${a.tagName.toLowerCase()}${a.id ? '#' + a.id : ''}${a.name ? '[' + a.name + '=' + (a.value || '') + ']' : ''}.${a.className}` : null;
    }),
  );
  if (i === 1) {
    await wait(250);
    await shot(page, 'd-06-form-focus-chip', { clip: dclip });
  }
}
measures.tabOrderDialog = inner;
// focus close & send for focus ring
await page.focus('.hj-close');
await page.keyboard.press('Shift+Tab');
await page.keyboard.press('Tab');
await wait(250);
await shot(page, 'd-06-form-focus-close-or-next', { clip: dclip });

// Submit empty
await page.focus('#hj-message');
await page.keyboard.press('Tab');
await wait(200);
await shot(page, 'd-06-form-focus-send', { clip: dclip });
await page.keyboard.press('Enter');
await wait(400);
await shot(page, 'd-07-form-errors', { clip: dclip });
measures.errors = {
  active: await page.evaluate(() => document.activeElement?.id),
  err: await rect(page, '#hj-name-err'),
  texts: await page.evaluate(() => [...document.querySelectorAll('.hj-err')].map((e) => (e.hidden ? null : e.textContent))),
  sheet: await rect(page, '.hj-sheet'),
  sheetScroll: await page.evaluate(() => {
    const s = document.querySelector('.hj-sheet');
    return { scrollH: s.scrollHeight, clientH: s.clientHeight };
  }),
  invalidBorder: await page.evaluate(() => getComputedStyle(document.querySelector('#hj-name')).borderColor),
};

// Fill name, bad email
await page.fill('#hj-name', 'Mei Lin Tan');
await page.fill('#hj-email', 'meilin@gmail');
await page.focus('#hj-message');
await wait(300);
await shot(page, 'd-08-form-bad-email', { clip: dclip });
measures.badEmail = await page.evaluate(() => [...document.querySelectorAll('.hj-err')].map((e) => (e.hidden ? null : e.textContent)));
// Fix it
await page.fill('#hj-email', 'meilin@gmail.com');
await page.click('.hj-chip:nth-child(2)');
await page.click('.hj-chip:nth-child(6)');
await page.fill('#hj-message', 'We are redoing a 4-room flat in Tiong Bahru and would love help with the kitchen and built-in shelving. Could we talk next week?');
await wait(300);
await shot(page, 'd-09-form-filled', { clip: dclip });
measures.filledChip = await page.evaluate(() => {
  const s = document.querySelector('.hj-chip input:checked + span');
  const cs = getComputedStyle(s);
  return { bg: cs.backgroundColor, border: cs.borderColor, color: cs.color };
});

// Send: capture the sending state
await page.click('.hj-form .hj-send');
await wait(250);
await shot(page, 'd-10-form-sending', { clip: dclip });
measures.sending = await page.evaluate(() => {
  const b = document.querySelector('.hj-form .hj-send');
  return { disabled: b.disabled, text: b.textContent, filter: getComputedStyle(b).filter, ariaBusy: b.getAttribute('aria-busy') };
});
await wait(1100);
await shot(page, 'd-11-form-sent', { clip: dclip });
await shot(page, 'd-11-form-sent-full');
measures.sent = {
  active: await page.evaluate(() => document.activeElement?.className),
  sheet: await rect(page, '.hj-sheet'),
  h3: await rect(page, '.hj-sent h3'),
  p: await rect(page, '.hj-sent p'),
  done: await rect(page, '.hj-done'),
  closeVisible: await page.evaluate(() => !!document.querySelector('.hj-close')?.offsetParent),
};
// Escape closes, focus returns?
await page.keyboard.press('Escape');
await wait(500);
measures.afterEscape = await page.evaluate(() => ({
  open: document.querySelector('.hj-dialog').open,
  active: document.activeElement?.className,
  focusVisible: document.activeElement?.matches(':focus-visible'),
}));
await shot(page, 'd-12-after-escape', { clip: corner });

// Reopen: is the form reset?
await page.click('.hj-pin-action');
await wait(600);
measures.reopen = await page.evaluate(() => ({
  formHidden: document.querySelector('.hj-form').hidden,
  name: document.querySelector('#hj-name').value,
  active: document.activeElement?.id,
}));
// Type partially, close with backdrop click, reopen: is the draft kept?
await page.fill('#hj-name', 'Draft Person');
await page.mouse.click(300, 500);
await wait(500);
measures.backdropClose = await page.evaluate(() => ({ open: document.querySelector('.hj-dialog').open, active: document.activeElement?.className }));
await page.click('.hj-pin-action');
await wait(600);
measures.draftKept = await page.evaluate(() => document.querySelector('#hj-name').value);

// Error state (simulated in the DOM exactly as form.ts would render it; no source changes)
await page.evaluate(() => {
  const a = document.querySelector('.hj-alert');
  a.textContent = 'This form is not switched on yet, so your message has not been sent.';
  a.hidden = false;
});
await wait(200);
await shot(page, 'd-13-form-alert-not-connected', { clip: dclip });
measures.alert = await rect(page, '.hj-alert');
await page.evaluate(() => {
  document.querySelector('.hj-alert').textContent = 'Your message could not be sent. Check your connection and try again.';
});
await shot(page, 'd-13-form-alert-failed', { clip: dclip });

// Short desktop window: does the sheet fit / scroll?
await page.setViewportSize({ width: 1280, height: 620 });
await wait(500);
await shot(page, 'd-14-form-short-window-1280x620');
measures.shortWindow = {
  dialog: await rect(page, '.hj-dialog'),
  sheet: await rect(page, '.hj-sheet'),
  scroll: await page.evaluate(() => {
    const s = document.querySelector('.hj-sheet');
    return { scrollH: s.scrollHeight, clientH: s.clientHeight };
  }),
  pin: await rect(page, '.hj-pin'),
};

fs.writeFileSync(path.join(OUT, 'd-measures.json'), JSON.stringify({ measures, logs }, null, 2));
await browser.close();
console.log(JSON.stringify({ measures, logs }, null, 1));

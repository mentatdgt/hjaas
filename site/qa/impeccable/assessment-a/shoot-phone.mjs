// Assessment A: iPhone portrait (WebKit, 390x844) and landscape (844x390) screenshots and measurements.
import { webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('qa/impeccable/assessment-a/shots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5173/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const m = {};

const browser = await webkit.launch();

async function run(tag, viewport) {
  const ctx = await browser.newContext({ ...devices['iPhone 14'], viewport });
  const page = await ctx.newPage();
  const shot = (name, clip) => page.screenshot({ path: path.join(OUT, `${tag}-${name}.png`), ...(clip ? { clip } : {}) });
  const box = (sel) =>
    page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
    }, sel);
  const ready = async () => {
    await page.waitForSelector('.hj-scene:not(.is-pre) .hj-logo');
    await page.evaluate(() => document.fonts.ready);
    await wait(1200);
  };
  const r = (m[tag] = {});

  await page.goto(`${BASE}?reset&intro=off`);
  await ready();
  await shot('01-fresh');
  r.fresh = { logo: await box('.hj-logo'), pin: await box('.hj-pin'), pinVars: await page.evaluate(() => document.querySelector('.hj-pin').style.cssText), note: await box('.hj-note'), counter: await box('.hj-counter'), hud: await box('.hj-hud'), viewport: await box('.hj-viewport'), swipe: await box('.hj-swipe'),
    noteFont: await page.evaluate(() => getComputedStyle(document.querySelector('.hj-note')).fontSize),
    docScroll: await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight })) };

  await page.goto(`${BASE}?intro=off&found=4`);
  await ready();
  await shot('02-mid');

  await page.goto(`${BASE}?intro=off&found=10`);
  await ready();
  await shot('03-unlocked');
  r.unlocked = { pin: await box('.hj-pin'), action: await box('.hj-pin-action'), logo: await box('.hj-logo'), label: await box('.hj-pin-label') };
  r.gapLogoPin = r.unlocked.pin.x - (r.unlocked.logo.x + r.unlocked.logo.w);

  await page.tap('.hj-pin-action');
  await wait(900);
  await shot('04-form-empty');
  r.form = { dialog: await box('.hj-dialog'), sheet: await box('.hj-sheet'), close: await box('.hj-close'), name: await box('#hj-name'), send: await box('.hj-form .hj-send'), message: await box('#hj-message'),
    scroll: await page.evaluate(() => { const s = document.querySelector('.hj-sheet'); return { scrollH: s.scrollHeight, clientH: s.clientHeight }; }),
    chips: await page.evaluate(() => [...document.querySelectorAll('.hj-chip')].map((c) => { const b = c.getBoundingClientRect(); return { t: c.textContent.trim(), w: +b.width.toFixed(1), h: +b.height.toFixed(1), x: +b.x.toFixed(1), y: +b.y.toFixed(1) }; })),
    active: await page.evaluate(() => document.activeElement?.id) };

  // Simulate the on-screen keyboard: iOS shrinks the visual viewport to roughly the top 55% in portrait.
  // (Playwright WebKit has no real keyboard, so this is only a geometry check.)
  r.keyboardCheck = { nameBottom: r.form.name.y + r.form.name.h, sendTop: r.form.send.y, messageBottom: r.form.message.y + r.form.message.h, viewportH: viewport.height };

  // Submit empty
  await page.tap('.hj-form .hj-send');
  await wait(450);
  await shot('05-form-errors');
  r.errors = { sheet: await box('.hj-sheet'), scroll: await page.evaluate(() => { const s = document.querySelector('.hj-sheet'); return { scrollH: s.scrollHeight, clientH: s.clientHeight, scrollTop: s.scrollTop }; }), send: await box('.hj-form .hj-send'), active: await page.evaluate(() => document.activeElement?.id) };
  // scroll to the bottom of the sheet
  await page.evaluate(() => { const s = document.querySelector('.hj-sheet'); s.scrollTop = s.scrollHeight; });
  await wait(250);
  await shot('05b-form-errors-scrolled');

  await page.fill('#hj-name', 'Mei Lin Tan');
  await page.fill('#hj-email', 'meilin@gmail');
  await page.focus('#hj-message');
  await wait(300);
  await page.evaluate(() => { document.querySelector('.hj-sheet').scrollTop = 0; });
  await wait(200);
  await shot('06-form-bad-email');
  await page.fill('#hj-email', 'meilin@gmail.com');
  await page.tap('.hj-chip:nth-child(2)');
  await page.tap('.hj-chip:nth-child(6)');
  await page.fill('#hj-message', 'We are redoing a 4-room flat in Tiong Bahru and would love help with the kitchen and built-in shelving. Could we talk next week?');
  await wait(300);
  await shot('07-form-filled');
  // Alert as form.ts renders it (DOM only)
  await page.evaluate(() => { const a = document.querySelector('.hj-alert'); a.textContent = 'This form is not switched on yet, so your message has not been sent.'; a.hidden = false; });
  await wait(250);
  await shot('08-form-alert');
  r.alert = { sheet: await box('.hj-sheet'), alert: await box('.hj-alert'), send: await box('.hj-form .hj-send'), scroll: await page.evaluate(() => { const s = document.querySelector('.hj-sheet'); return { scrollH: s.scrollHeight, clientH: s.clientHeight, scrollTop: s.scrollTop }; }) };
  await page.evaluate(() => { document.querySelector('.hj-alert').hidden = true; });
  await page.evaluate(() => { const s = document.querySelector('.hj-sheet'); s.scrollTop = s.scrollHeight; });
  await page.tap('.hj-form .hj-send');
  await wait(300);
  await shot('09-form-sending');
  await wait(1000);
  await shot('10-form-sent');
  r.sent = { sheet: await box('.hj-sheet'), done: await box('.hj-done') };
  await page.tap('.hj-done');
  await wait(600);
  await shot('11-after-close');
  await ctx.close();
}

await run('p', { width: 390, height: 844 });
await run('l', { width: 844, height: 390 });
await run('s', { width: 320, height: 568 }); // smallest phone, for the logo/pin row

fs.writeFileSync(path.join(OUT, 'p-measures.json'), JSON.stringify(m, null, 2));
await browser.close();
console.log(JSON.stringify(m));

// Assessment A: (1) does a real touch unlock leave a focus ring on the button in WebKit, (2) a large desktop, (3) border candidates.
import { chromium, webkit, devices } from 'playwright';
import path from 'node:path';
const OUT = path.resolve('qa/impeccable/assessment-a/shots');
const BASE = 'http://localhost:5173/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};

const wk = await webkit.launch();
{
  const ctx = await wk.newContext({ ...devices['iPhone 14'], viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?reset&intro=off&found=9`);
  await page.waitForSelector('.hj-scene:not(.is-pre) .hj-logo');
  await wait(2500);
  // Pan the room so the last mushroom is on screen, then tap it with a real touch.
  await page.evaluate(() => { document.querySelector('.hj-viewport').scrollLeft += 200; });
  await wait(400);
  const b = await page.evaluate(() => { const r = document.querySelector('.hj-shroom[data-spot="toolbox"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  out.tapAt = b;
  await page.touchscreen.tap(b.x, b.y);
  await wait(3200);
  out.afterTouchUnlock = await page.evaluate(() => ({ active: document.activeElement?.className, focusVisible: document.activeElement?.matches(':focus-visible'), state: document.querySelector('.hj-counter').dataset.state }));
  await page.screenshot({ path: path.join(OUT, 'x-01-phone-touch-unlock-end.png'), clip: { x: 0, y: 110, width: 390, height: 130 } });
  // then open the form by touch, close it by the X, and look at the button again
  await page.tap('.hj-pin-action');
  await wait(800);
  await page.tap('.hj-close');
  await wait(600);
  out.afterCloseTouch = await page.evaluate(() => ({ active: document.activeElement?.className, focusVisible: document.activeElement?.matches(':focus-visible') }));
  await page.screenshot({ path: path.join(OUT, 'x-02-phone-after-close.png'), clip: { x: 0, y: 110, width: 390, height: 130 } });
  await ctx.close();
}
await wk.close();

const chrome = await chromium.launch({ channel: 'chrome' });
{
  const ctx = await chrome.newContext({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?reset&intro=off`);
  await page.waitForSelector('.hj-scene:not(.is-pre) .hj-logo');
  await wait(1500);
  await page.screenshot({ path: path.join(OUT, 'x-03-desktop-2560.png') });
  out.big = await page.evaluate(() => { const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; }; return { logo: r('.hj-logo'), pin: r('.hj-pin'), note: r('.hj-note'), noteFont: getComputedStyle(document.querySelector('.hj-note')).fontSize }; });
  await page.goto(`${BASE}?intro=off&found=10`);
  await page.waitForSelector('.hj-scene:not(.is-pre) .hj-logo');
  await wait(1200);
  await page.click('.hj-pin-action');
  await wait(600);
  await page.screenshot({ path: path.join(OUT, 'x-04-desktop-2560-form.png') });
  await ctx.close();
}
// Mouse click on the pin before unlock: anything?
{
  const ctx = await chrome.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?reset&intro=off&found=4`);
  await page.waitForSelector('.hj-scene:not(.is-pre) .hj-logo');
  await wait(1500);
  out.pinBefore = await page.evaluate(() => { const p = document.querySelector('.hj-pin'); const a = document.querySelector('.hj-pin-action'); return { cursor: getComputedStyle(p).cursor, actionHidden: a.hidden, pe: getComputedStyle(p).pointerEvents, title: p.title, counterRole: document.querySelector('.hj-counter').getAttribute('role') }; });
  await ctx.close();
}
await chrome.close();
console.log(JSON.stringify(out));

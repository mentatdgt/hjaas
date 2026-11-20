// Assessment A: the counter landing, the first-find note, the real 10/10 unlock, small widths and hover states.
import { chromium, webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('qa/impeccable/assessment-a/shots');
const SEQ = path.join(OUT, 'seq');
fs.mkdirSync(SEQ, { recursive: true });
const BASE = 'http://localhost:5173/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const m = {};

const ready = async (page) => {
  await page.waitForSelector('.hj-scene:not(.is-pre) .hj-logo');
  await page.evaluate(() => document.fonts.ready);
  await wait(2500); // reaction frames load after the intro
};

async function sequence(page, tag, clip, totalMs, everyMs) {
  const frames = [];
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < totalMs) {
    const target = i * everyMs;
    const now = Date.now() - t0;
    if (now < target) await wait(target - now);
    const t = Date.now() - t0;
    const file = path.join(SEQ, `${tag}-${String(i).padStart(3, '0')}.png`);
    await page.screenshot({ path: file, clip });
    frames.push({ file, t });
    i++;
  }
  return frames;
}

async function sheet(browser, frames, name, cols, cellW) {
  const ctx = await browser.newContext({ viewport: { width: cols * (cellW + 8) + 16, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const html = `<body style="margin:8px;background:#222;font:11px monospace;color:#fff"><div style="display:grid;grid-template-columns:repeat(${cols},${cellW}px);gap:8px">${frames
    .map((f) => `<div><img src="data:image/png;base64,${fs.readFileSync(f.file).toString('base64')}" style="width:${cellW}px;display:block"><div>${f.t} ms</div></div>`)
    .join('')}</div></body>`;
  await page.setContent(html);
  await wait(300);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  await ctx.close();
}

const chrome = await chromium.launch({ channel: 'chrome' });
const corner = { x: 1440 - 420, y: 50, width: 420, height: 120 };

// A. First find on desktop: landing, then the one-time "prize" line
{
  const ctx = await chrome.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?reset&intro=off`);
  await ready(page);
  m.spots = await page.evaluate(() => [...document.querySelectorAll('.hj-shroom')].map((s) => s.dataset.spot));
  await page.click('.hj-shroom[data-spot="toolbox"]');
  const frames = await sequence(page, 'a-first', corner, 1700, 90);
  await sheet(chrome, frames, 'm-01-first-find-sheet', 5, 300);
  await wait(800);
  await page.screenshot({ path: path.join(OUT, 'm-02-prize-note.png'), clip: corner });
  m.prizeNote = await page.evaluate(() => ({ text: document.querySelector('.hj-note').textContent, box: document.querySelector('.hj-note').getBoundingClientRect().toJSON(), pin: document.querySelector('.hj-pin').getBoundingClientRect().toJSON() }));
  await wait(5500);
  await page.screenshot({ path: path.join(OUT, 'm-03-after-prize-note.png'), clip: corner });
  m.afterPrize = await page.evaluate(() => document.querySelector('.hj-note').classList.contains('is-on'));
  await ctx.close();
}

// B. The real unlock on desktop (corner at 2x)
{
  const ctx = await chrome.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?reset&intro=off&found=9`);
  await ready(page);
  await page.click('.hj-shroom[data-spot="toolbox"]');
  const frames = await sequence(page, 'b-unlock', corner, 3400, 100);
  await sheet(chrome, frames, 'm-04-unlock-sheet', 6, 280);
  m.unlockEnd = await page.evaluate(() => ({ active: document.activeElement?.className, focusVisible: document.activeElement?.matches(':focus-visible'), status: document.querySelector('.hj-sr').textContent, note: document.querySelector('.hj-note').classList.contains('is-on') }));
  await page.screenshot({ path: path.join(OUT, 'm-05-unlock-end.png'), clip: corner });
  await ctx.close();
}

// B2. The real unlock on desktop, whole frame at 1x (the shower and where the eye goes)
{
  const ctx = await chrome.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?reset&intro=off&found=9`);
  await ready(page);
  await page.click('.hj-shroom[data-spot="toolbox"]');
  const frames = await sequence(page, 'b2-unlock-full', { x: 0, y: 0, width: 1440, height: 900 }, 3200, 260);
  await sheet(chrome, frames, 'm-06-unlock-full-sheet', 4, 460);
  await ctx.close();
}

// C. The counter landing, six times slower
{
  const ctx = await chrome.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?reset&intro=off&found=3&slow=6`);
  await ready(page);
  await wait(4500); // let the returning-visitor prompt leave
  await page.click('.hj-shroom[data-spot="toolbox"]');
  await wait(2600); // the flight, slowed
  const frames = await sequence(page, 'c-slow', { x: 1440 - 260, y: 56, width: 250, height: 80 }, 4200, 170);
  await sheet(chrome, frames, 'm-07-landing-slow6-sheet', 6, 250);
  await ctx.close();
}

// F. Hover states in the form
{
  const ctx = await chrome.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?intro=off&found=10`);
  await ready(page);
  await page.click('.hj-pin-action');
  await wait(600);
  const clip = { x: 960, y: 40, width: 480, height: 760 };
  await page.hover('.hj-chip:nth-child(3)');
  await wait(250);
  await page.screenshot({ path: path.join(OUT, 'm-08-hover-chip.png'), clip: { x: 1010, y: 350, width: 400, height: 130 } });
  await page.hover('.hj-close');
  await wait(250);
  await page.screenshot({ path: path.join(OUT, 'm-08-hover-close.png'), clip: { x: 1010, y: 127, width: 400, height: 70 } });
  await page.hover('.hj-form .hj-send');
  await wait(250);
  await page.screenshot({ path: path.join(OUT, 'm-08-hover-send.png'), clip: { x: 1010, y: 620, width: 400, height: 80 } });
  m.cursors = await page.evaluate(() => ({ chip: getComputedStyle(document.querySelector('.hj-chip')).cursor, send: getComputedStyle(document.querySelector('.hj-form .hj-send')).cursor, pin: getComputedStyle(document.querySelector('.hj-pin-action')).cursor }));
  await ctx.close();
}

// G. Reduced motion unlock
{
  const ctx = await chrome.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?reset&intro=off&found=9`);
  await ready(page);
  await page.click('.hj-shroom[data-spot="toolbox"]');
  const frames = await sequence(page, 'g-reduced', corner, 2000, 130);
  await sheet(chrome, frames, 'm-09-unlock-reduced-sheet', 6, 280);
  await ctx.close();
}
await chrome.close();

// D. The real unlock on an iPhone (WebKit)
const wk = await webkit.launch();
{
  const ctx = await wk.newContext({ ...devices['iPhone 14'], viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?reset&intro=off&found=9`);
  await ready(page);
  m.phoneToolbox = await page.evaluate(() => {
    const b = document.querySelector('.hj-shroom[data-spot="toolbox"]').getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  });
  // The last mushroom may be off-screen in the 4:5 crop: click through the DOM as a keyboard user would.
  await page.evaluate(() => document.querySelector('.hj-shroom[data-spot="toolbox"]').click());
  const frames = await sequence(page, 'd-phone', { x: 0, y: 110, width: 390, height: 130 }, 3400, 110);
  const c2 = await chromium.launch({ channel: 'chrome' });
  await sheet(c2, frames, 'm-10-unlock-phone-sheet', 5, 390);
  await c2.close();
  await page.screenshot({ path: path.join(OUT, 'm-11-unlock-phone-end.png') });
  await ctx.close();
}

// E. Other phone widths: the logo / pin / note row
for (const [w, h] of [[360, 800], [375, 667], [412, 915]]) {
  const ctx = await wk.newContext({ ...devices['iPhone 14'], viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?reset&intro=off`);
  await page.waitForSelector('.hj-scene:not(.is-pre) .hj-logo');
  await wait(1200);
  const g = () =>
    page.evaluate(() => {
      const r = (s) => {
        const b = document.querySelector(s).getBoundingClientRect();
        return { l: +b.left.toFixed(1), r: +b.right.toFixed(1), t: +b.top.toFixed(1), b: +b.bottom.toFixed(1) };
      };
      return { logo: r('.hj-logo'), pin: r('.hj-pin'), note: r('.hj-note'), viewport: r('.hj-viewport') };
    });
  const a = await g();
  await page.screenshot({ path: path.join(OUT, `w${w}-fresh.png`), clip: { x: 0, y: Math.max(0, a.logo.t - 30), width: w, height: 150 } });
  await page.goto(`${BASE}?intro=off&found=10`);
  await page.waitForSelector('.hj-scene:not(.is-pre) .hj-logo');
  await wait(1200);
  const b = await g();
  await page.screenshot({ path: path.join(OUT, `w${w}-unlocked.png`), clip: { x: 0, y: Math.max(0, b.logo.t - 30), width: w, height: 150 } });
  m[`w${w}`] = { fresh: a, noteToLogoGap: +(a.note.l - a.logo.r).toFixed(1), buttonToLogoGap: +(b.pin.l - b.logo.r).toFixed(1) };
  await ctx.close();
}
await wk.close();

fs.writeFileSync(path.join(OUT, 'm-measures.json'), JSON.stringify(m, null, 2));
console.log(JSON.stringify(m));

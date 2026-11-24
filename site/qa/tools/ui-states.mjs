// Screenshots of every state, on desktop (Chrome 1440x900) and iPhone portrait (WebKit 390x844).
//   node qa/tools/ui-states.mjs [outDir]
import { chromium, webkit, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const outDir = process.argv[2] ?? 'qa/screens';
await mkdir(outDir, { recursive: true });
const base = process.env.HJ_URL ?? 'http://localhost:5173/';

async function run(name, launch, contextOptions, extra = () => {}) {
  const browser = await launch();
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = (state) => page.screenshot({ path: join(outDir, `${name}-${state}.jpg`), type: 'jpeg', quality: 86 });
  const ready = () => page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 30000 });
  const open = async (query) => { await page.goto(`${base}?debug&intro=off&${query}`); await ready(); await page.evaluate(() => document.querySelector('.hj-mushrooms').classList.remove('is-debug')); };
  const press = (selector) => page.evaluate((s) => document.querySelector(s).click(), selector);

  await open('reset&seed=3');
  await page.waitForTimeout(900); await shot('01-fresh');
  await press('[data-spot="conduit"]');
  await page.waitForTimeout(1750); await shot('02-first-find-reaction');
  await page.waitForTimeout(5200);
  await open('found=4');
  await page.waitForTimeout(900); await shot('03-mid-hunt');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  await page.waitForTimeout(300); await shot('04-keyboard-focus-on-mushroom');
  await open('all=50');
  await page.waitForTimeout(600); await shot('05-unlocked');
  await press('.hj-contact');
  await page.waitForTimeout(700); await shot('06-form-open');
  await page.evaluate(() => document.querySelector('.hj-form').requestSubmit());
  await page.waitForTimeout(300); await shot('07-form-validation');
  await page.fill('#hj-name', 'Wren');
  await page.fill('#hj-email', 'wren@example.com');
  await press('.hj-chip:nth-child(1) input'); await press('.hj-chip:nth-child(4) input');
  await page.fill('#hj-message', 'A shelf for the mushroom lab, please.');
  await page.focus('.hj-chip:nth-child(5) input');
  await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  await page.waitForTimeout(200); await shot('08-form-filled');
  await page.evaluate(() => document.querySelector('.hj-form').requestSubmit());
  await page.waitForTimeout(250); await shot('09-form-sending');
  await page.waitForTimeout(1100); await shot('10-form-sent-test-mode');
  await extra(page, shot, open, press);
  await browser.close();
  console.log(name, errors.length ? errors : 'ok');
}

await run('desktop', () => chromium.launch({ channel: 'chrome' }), { viewport: { width: 1440, height: 900 } }, async (page, shot, open) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await open('reset'); await page.waitForTimeout(800); await shot('11-large-monitor-2560');
  await page.setViewportSize({ width: 844, height: 390 });
  await open('reset'); await page.waitForTimeout(800); await shot('12-landscape-phone-844x390');
  await page.setViewportSize({ width: 1024, height: 768 });
  await open('found=3'); await page.waitForTimeout(800); await shot('13-tablet-1024x768');
});

await run('iphone', () => webkit.launch(), { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } }, async (page, shot, open) => {
  await open('reset');
  await page.locator('.hj-viewport').evaluate((el) => { el.scrollLeft = 0; });
  await page.waitForTimeout(500); await shot('11-panned-left');
  await page.locator('.hj-viewport').evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await page.waitForTimeout(500); await shot('12-panned-right');
});

await run('android-412', () => chromium.launch({ channel: 'chrome' }), { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
await run('narrow-360', () => chromium.launch({ channel: 'chrome' }), { viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

// Reduced motion: the settled scene and the unlocked state.
{
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })).newPage();
  await page.goto(`${base}?debug&reset`);
  await page.waitForFunction(() => window.__hj?.ready === true);
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(outDir, 'reduced-motion-01-settled.jpg'), type: 'jpeg', quality: 86 });
  await browser.close();
}

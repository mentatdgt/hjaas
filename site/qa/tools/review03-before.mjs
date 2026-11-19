// Review 03: the "before" first screens. Run it with site/scene-1 checked out and `npm run dev` running
// (they were taken on that code, before the elegant rebuild). Writes qa/review-03/before-*.jpg for compare.jpg.
import { chromium } from 'playwright';

const out = new URL('../review-03/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chrome' });
for (const [name, viewport, mobile] of [
  ['desktop', { width: 1440, height: 900 }, false],
  ['phone', { width: 390, height: 844 }, true],
]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  await page.goto('http://localhost:5173/?reset&intro=off&seed=7');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}before-${name}.jpg`, type: 'jpeg', quality: 90 });
  await context.close();
}
await browser.close();

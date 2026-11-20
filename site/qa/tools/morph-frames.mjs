// The counter-to-button morph, frozen at five points, at 3x. node qa/tools/morph-frames.mjs out.png [desktop|iphone]
import { chromium, webkit, devices } from 'playwright';
import sharp from 'sharp';
const out = process.argv[2] ?? 'qa/morph-frames.png';
const phone = process.argv[3] === 'iphone';
const browser = phone ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext(phone ? { ...devices['iPhone 14'] } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
const page = await context.newPage();
const tiles = [];
for (const at of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
  await page.goto('http://localhost:5173/?debug&reset&intro=off&found=9');
  await page.waitForFunction(() => window.__hj?.ready === true);
  // Freeze the morph at one point: start it, then pause every CSS transition at the same moment.
  await page.evaluate(async (at) => {
    const counter = window.__hj.counter;
    counter.land(10);
    await new Promise((r) => setTimeout(r, 900));
    counter.unlock(true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (const a of document.querySelector('.hj-counter').getAnimations({ subtree: true })) { a.pause(); a.currentTime = at * 500; }
  }, at);
  await page.waitForTimeout(150);
  const box = await page.locator('.hj-pin').boundingBox();
  tiles.push(await page.screenshot({ clip: { x: box.x - 14, y: box.y - 12, width: box.width + 28, height: box.height + 26 } }));
}
await browser.close();
const meta = await sharp(tiles[0]).metadata();
await sharp({ create: { width: meta.width, height: meta.height * tiles.length, channels: 3, background: '#000' } })
  .composite(tiles.map((input, i) => ({ input, left: 0, top: i * meta.height })))
  .png().toFile(out);
console.log(out);

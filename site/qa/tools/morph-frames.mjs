// The counter-to-button morph, frozen at six points, at 3x. node qa/tools/morph-frames.mjs out.png [desktop|iphone]
import { chromium, webkit, devices } from 'playwright';
import sharp from 'sharp';
const out = process.argv[2] ?? 'qa/morph-frames.png';
const phone = process.argv[3] === 'iphone';
const browser = phone ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext(phone ? { ...devices['iPhone 14'] } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
const page = await context.newPage();
const tiles = [];
for (const at of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
  await page.goto('about:blank');
  await page.goto('http://localhost:5173/?debug&reset&intro=off&all=49#set');
  await page.waitForFunction(() => window.__hj?.ready === true);
  // Freeze the cross-fade at one point: the fiftieth find, then both blocks' animations paused as it starts.
  await page.waitForTimeout(500);
  await page.evaluate(async (at) => {
    document.querySelector('.hj-shroom').click();
    const counter = document.querySelector('.hj-counter');
    while (!counter.classList.contains('is-leaving')) await new Promise(requestAnimationFrame);
    for (const el of [counter, document.querySelector('.hj-prize')]) for (const a of el.getAnimations()) { a.pause(); a.currentTime = at * 449; }
  }, at);
  await page.waitForTimeout(150);
  const box = await page.locator('.hj-caption-main').boundingBox();
  tiles.push(await page.screenshot({ clip: { x: box.x - 14, y: box.y - 12, width: box.width + 28, height: box.height + 26 } }));
}
await browser.close();
const meta = await sharp(tiles[0]).metadata();
await sharp({ create: { width: meta.width, height: meta.height * tiles.length, channels: 3, background: '#000' } })
  .composite(tiles.map((input, i) => ({ input, left: 0, top: i * meta.height })))
  .png().toFile(out);
console.log(out);

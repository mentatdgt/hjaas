// The counter as a mushroom lands in it: the cream counter photographed as fast as the browser allows, at 3x.
//   node qa/tools/counter-landing.mjs out.jpg
import { chromium } from 'playwright';
import sharp from 'sharp';
const out = process.argv[2] ?? 'qa/m3/counter-landing.jpg';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
await page.goto('http://localhost:5173/?debug&reset&intro=off&found=2');
await page.waitForFunction(() => window.__hj?.ready === true);
await page.waitForTimeout(800);
const box = await page.locator('.hj-row.is-cream').boundingBox();
const clip = { x: box.x - 8, y: box.y - 10, width: 260, height: 64 };
await page.evaluate(() => { window.__t0 = performance.now(); document.querySelector('[data-spot="conduit"]').click(); });
const tiles = [];
while (tiles.length < 40) {
  const at = await page.evaluate(() => Math.round(performance.now() - window.__t0));
  if (at > 1500) break;
  if (at >= 360) tiles.push({ at, png: await page.screenshot({ clip }) });
}
await browser.close();
const cols = 6, rows = Math.ceil(tiles.length / cols);
const meta = await sharp(tiles[0].png).metadata();
await sharp({ create: { width: meta.width * cols, height: meta.height * rows, channels: 3, background: '#000' } })
  .composite(tiles.map((t, i) => ({ input: t.png, left: (i % cols) * meta.width, top: Math.floor(i / cols) * meta.height })))
  .jpeg({ quality: 88 }).toFile(out);
console.log(out, tiles.map((t) => t.at).join(' '));

// Close-ups of every mushroom spot at 2x, for placement review. Usage: node qa/tools/spots-sheet.mjs out.png
import { chromium } from 'playwright';
import sharp from 'sharp';

const out = process.argv[2] ?? 'qa/m3/spots.jpg';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:5173/?debug&reset&intro=off');
await page.waitForFunction(() => window.__hj);
await page.evaluate(() => { window.__hj.player.stop(); window.__hj.rachel.show('frame_01'); document.querySelector('.hj-mushrooms').classList.remove('is-debug'); });
await page.waitForTimeout(300);
const spots = await page.evaluate(() => [...document.querySelectorAll('.hj-shroom')].map((b) => { const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
const tiles = [];
const W = 240, H = 180;
for (const s of spots) {
  const clip = { x: Math.max(0, Math.min(1672 - W, s.x - W / 2)), y: Math.max(0, Math.min(941 - H, s.y - H / 2)), width: W, height: H };
  tiles.push(await page.screenshot({ clip }));
}
await browser.close();
const cols = 4, rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: cols * W * 2, height: rows * H * 2, channels: 3, background: '#000' } })
  .composite(tiles.map((input, i) => ({ input, left: (i % cols) * W * 2, top: Math.floor(i / cols) * H * 2 })))
  .resize({ width: 1900 })
  .jpeg({ quality: 88 }).toFile(out);
console.log(out, spots.length);

// Logo swap check (reviews/logo-swap.md): the final logo on the page, its glint mid-sweep, the favicon and
// the link-preview image, in one picture. Needs `npm run dev`.
//   node qa/tools/logo-swap.mjs
import { chromium } from 'playwright';
import sharp from 'sharp';

const out = new URL('../logo-swap/', import.meta.url).pathname;
const site = new URL('../../', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chrome' });
const shots = {};
for (const [name, width, height] of [['desktop', 1440, 900], ['phone', 390, 844]]) {
  const phone = width <= 600;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: phone, hasTouch: phone });
  const page = await context.newPage();
  await page.goto('http://localhost:5173/?debug&reset&intro=off&seed=7');
  await page.waitForFunction(() => window.__hj?.ready === true);
  await page.evaluate(() => document.querySelector('.hj-mushrooms')?.classList.remove('is-debug'));
  const head = await page.locator('.hj-masthead').boundingBox();
  const clip = { x: 0, y: 0, width, height: Math.round(head.y + head.height + 40) };
  shots[name] = await page.screenshot({ clip });
  if (!phone) {
    // The glint, caught mid-sweep (650 ms in all).
    await page.evaluate(() => window.__hj.logo.glint());
    await page.waitForTimeout(330);
    shots.glint = await page.screenshot({ clip });
    shots.info = await page.evaluate(() => {
      const b = document.querySelector('.hj-logo').getBoundingClientRect();
      return { logoCssPx: [Math.round(b.width), Math.round(b.height)], natural: [document.querySelector('.hj-logo img').naturalWidth, document.querySelector('.hj-logo img').naturalHeight] };
    });
  }
  await context.close();
}
await browser.close();
console.log(JSON.stringify(shots.info));

const W = 1440;
const row = async (buffer, width) => sharp(buffer).resize({ width }).toBuffer({ resolveWithObject: true });
const desktop = await row(shots.desktop, W);
const glint = await row(shots.glint, W);
const phone = await row(shots.phone, 520);
const og = await row(`${site}public/og-image.png`, 400);
// The favicon at its real size, and enlarged 6x without smoothing so every pixel can be judged.
const fav = await sharp(`${site}public/favicon-32.png`).toBuffer();
const favBig = await sharp(fav).resize(192, 192, { kernel: 'nearest' }).toBuffer();
const touch = await sharp(`${site}public/apple-touch-icon.png`).toBuffer();
const label = (text, x, y) => `<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#302e29">${text}</text>`;
const y1 = 40;
const y2 = y1 + desktop.info.height + 50;
const y3 = y2 + glint.info.height + 50;
const height = y3 + Math.max(phone.info.height, og.info.height) + 30;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}">
  ${label('Desktop, 1440 px wide', 16, y1 - 12)}${label('The glint, mid-sweep', 16, y2 - 12)}
  ${label('Phone, 390 px wide', 16, y3 - 12)}${label('Link preview (og:image)', 560, y3 - 12)}${label('Favicon 32 px (and 6x), touch icon 180 px', 1000, y3 - 12)}
</svg>`;
await sharp({ create: { width: W, height, channels: 3, background: '#d9d6cf' } })
  .composite([
    { input: Buffer.from(svg), left: 0, top: 0 },
    { input: desktop.data, left: 0, top: y1 },
    { input: glint.data, left: 0, top: y2 },
    { input: phone.data, left: 16, top: y3 },
    { input: og.data, left: 560, top: y3 },
    { input: fav, left: 1190, top: y3 + 10 },
    { input: favBig, left: 1000, top: y3 + 10 },
    { input: touch, left: 1240, top: y3 + 10 },
  ])
  .jpeg({ quality: 88 })
  .toFile(`${out}logo-swap.jpg`);

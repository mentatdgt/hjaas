// Evidence for Wren's review 01. Needs `npm run dev` (5173) and, for item 3, `npm run build && npm run preview` (4173).
//   node qa/tools/review01.mjs flags     item 3: ?found=10 on dev vs production
import { chromium } from 'playwright';
import sharp from 'sharp';

const item = process.argv[2];
const browser = await chromium.launch();

async function shot(url, viewport, wait, settle = 1500) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await wait(page);
  await page.waitForTimeout(settle);
  const png = await page.screenshot();
  const info = await page.evaluate(() => ({
    counter: document.querySelector('.hj-pin')?.textContent?.replace(/\s+/g, ' ').trim(),
    action: !document.querySelector('.hj-pin-action')?.hidden,
  }));
  await page.close();
  return { png, info, errors };
}

async function sideBySide(out, a, b, labels) {
  const meta = await sharp(a).metadata();
  const label = (text) =>
    Buffer.from(`<svg width="${meta.width}" height="44"><rect width="100%" height="100%" fill="#111"/><text x="16" y="30" font-family="sans-serif" font-size="22" fill="#fff">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
  const col = (img, text) =>
    sharp({ create: { width: meta.width, height: meta.height + 44, channels: 3, background: '#111' } })
      .composite([{ input: label(text), top: 0, left: 0 }, { input: img, top: 44, left: 0 }])
      .png()
      .toBuffer();
  const [ca, cb] = await Promise.all([col(a, labels[0]), col(b, labels[1])]);
  await sharp({ create: { width: meta.width * 2 + 8, height: meta.height + 44, channels: 3, background: '#444' } })
    .composite([{ input: ca, top: 0, left: 0 }, { input: cb, top: 0, left: meta.width + 8 }])
    .jpeg({ quality: 80 })
    .toFile(out);
}

if (item === 'flags') {
  const viewport = { width: 1280, height: 760 };
  const wait = (page) => page.waitForSelector('.hj-pin');
  const dev = await shot('http://localhost:5173/?intro=off&found=10', viewport, wait, 2500);
  const prod = await shot('http://localhost:4173/?intro=off&found=10&debug', viewport, wait, 11000);
  const prodDebug = await (async () => {
    const page = await browser.newPage({ viewport });
    await page.goto('http://localhost:4173/?debug');
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => ({ hj: typeof window.__hj, debugOutline: !!document.querySelector('.is-debug') }));
    await page.close();
    return r;
  })();
  await sideBySide('qa/review-01/03-flags-dev-vs-prod.jpg', dev.png, prod.png, ['npm run dev  ?intro=off&found=10', 'production build  ?intro=off&found=10&debug']);
  console.log(JSON.stringify({ dev: dev.info, prod: prod.info, prodDebug, errors: [...dev.errors, ...prod.errors] }, null, 1));
}

if (item === 'hint') {
  // ?hint=2: the wiggle is due 2 s after the intro. Watch 16 s; once per visit means exactly one wiggle.
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.goto('http://localhost:5173/?intro=off&hint=2&seed=1');
  await page.waitForFunction(() => document.querySelectorAll('.hj-shroom-art').length > 0);
  const t0 = Date.now();
  await page.evaluate(() => {
    window.__wiggles = [];
    const start = performance.now();
    new MutationObserver((list) => {
      for (const m of list) {
        const el = m.target;
        if (!/rotate/.test(el.style.transform) || el.dataset.seen) continue;
        el.dataset.seen = '1';
        window.__wiggles.push({ spot: el.closest('.hj-shroom').dataset.spot, atS: +((performance.now() - start) / 1000).toFixed(1) });
        setTimeout(() => delete el.dataset.seen, 1000);
      }
    }).observe(document.querySelector('.hj-mushrooms'), { subtree: true, attributes: true, attributeFilter: ['style'] });
  });
  let caught = null;
  while (Date.now() - t0 < 16000) {
    const w = await page.evaluate(() => window.__wiggles.length);
    if (w && !caught) {
      const spot = await page.evaluate(() => window.__wiggles[0].spot);
      caught = await page.locator(`.hj-shroom[data-spot="${spot}"]`).boundingBox();
      await page.screenshot({ path: '/tmp/hint-full.png' });
    }
    await page.waitForTimeout(100);
  }
  const wiggles = await page.evaluate(() => window.__wiggles);
  await page.close();
  const pad = 60;
  const left = Math.max(0, Math.round(caught.x - pad));
  const top = Math.max(0, Math.round(caught.y - pad));
  const crop = { left, top, width: Math.min(1280 - left, Math.round(caught.width + pad * 2)), height: Math.min(760 - top, Math.round(caught.height + pad * 2)) };
  const zoom = await sharp('/tmp/hint-full.png').extract(crop).resize({ width: crop.width * 3, kernel: 'nearest' }).toBuffer();
  const zm = await sharp(zoom).metadata();
  const banner = Buffer.from(`<svg width="1280" height="60"><rect width="100%" height="100%" fill="#111"/><text x="16" y="38" font-family="sans-serif" font-size="22" fill="#fff">?hint=2, watched 16 s with no find: ${wiggles.length} wiggle(s) ${wiggles.map((w) => `[${w.spot} @ ${w.atS}s]`).join(' ')}</text></svg>`);
  await sharp('/tmp/hint-full.png')
    .extend({ top: 60, background: '#111' })
    .composite([{ input: banner, top: 0, left: 0 }, { input: zoom, top: 760 + 60 - zm.height - 10, left: 10 }])
    .jpeg({ quality: 80 })
    .toFile('qa/review-01/05-hint-once.jpg');
  console.log(JSON.stringify({ wiggles }, null, 1));
}

await browser.close();

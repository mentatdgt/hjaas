// Evidence for Wren's review 02. Frame timing for item 1 is qa/tools/intro-frames.mjs; this makes the screenshots.
//   node qa/tools/review02.mjs intro <before-url> <after-url>   item 1: the same seeded intro, old and new code
import { webkit, devices } from 'playwright';
import sharp from 'sharp';

const item = process.argv[2];

const label = (text, width) =>
  Buffer.from(
    `<svg width="${width}" height="44"><rect width="100%" height="100%" fill="#111"/><text x="16" y="30" font-family="sans-serif" font-size="22" fill="#fff">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`,
  );

/** Images in a grid, each with a caption above it. `rows` is an array of rows of { png, text }. */
async function grid(out, rows) {
  const meta = await sharp(rows[0][0].png).metadata();
  const cellW = meta.width;
  const cellH = meta.height + 44;
  const cols = Math.max(...rows.map((r) => r.length));
  const composites = [];
  rows.forEach((row, y) =>
    row.forEach(({ png, text }, x) => {
      composites.push({ input: label(text, cellW), top: y * (cellH + 8), left: x * (cellW + 8) });
      composites.push({ input: png, top: y * (cellH + 8) + 44, left: x * (cellW + 8) });
    }),
  );
  await sharp({ create: { width: cols * (cellW + 8) - 8, height: rows.length * (cellH + 8) - 8, channels: 3, background: '#444' } })
    .composite(composites)
    .jpeg({ quality: 82 })
    .toFile(out);
}

if (item === 'intro') {
  const [before, after] = process.argv.slice(3);
  const browser = await webkit.launch();
  const capture = async (base) => {
    const context = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await context.newPage();
    await page.goto(`${base}?reset&intro=full&seed=7&debug`);
    await page.waitForFunction(() => window.__hj?.marks?.introStart > 0, null, { timeout: 30000 });
    const start = await page.evaluate(() => window.__hj.marks.introStart);
    const at = async (ms) => {
      await page.waitForFunction((t) => performance.now() >= t, start + ms, { polling: 'raf' });
      return page.screenshot();
    };
    const wash = await at(2100);
    await page.waitForFunction(() => window.__hj.marks.introEnd > 0);
    await page.waitForTimeout(1500);
    const settled = await page.screenshot();
    // A resize hands the room over to the <img>; the scene must look the same afterwards.
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(400);
    await page.setViewportSize(devices['iPhone 13'].viewport);
    await page.waitForTimeout(800);
    const state = await page.evaluate(() => ({
      canvas: !!document.querySelector('.hj-paint'),
      roomOpacity: getComputedStyle(document.querySelector('.hj-room')).opacity,
    }));
    const resized = await page.screenshot();
    await context.close();
    return { wash, settled, resized, state };
  };
  const a = await capture(before);
  const b = await capture(after);
  // Rachel hammers and the logo glints, so compare only the room's own region, left of Rachel.
  const diff = async (x, y) => {
    const crop = { left: 0, top: 160, width: 150, height: 400 };
    const [pa, pb] = await Promise.all([x, y].map((png) => sharp(png).extract(crop).raw().toBuffer()));
    let sum = 0;
    for (let i = 0; i < pa.length; i++) sum += Math.abs(pa[i] - pb[i]);
    return (sum / pa.length).toFixed(2);
  };
  const settledDiff = await diff(a.settled, b.settled);
  const resizedDiff = await diff(a.resized, b.resized);
  await grid('qa/review-02/01-intro-before-after.jpg', [
    [
      { png: a.wash, text: 'before: wash, 2.1 s' },
      { png: b.wash, text: 'after: wash, 2.1 s' },
    ],
    [
      { png: a.settled, text: 'before: settled' },
      { png: b.settled, text: `after: settled (diff ${settledDiff}/255)` },
    ],
  ]);
  console.log(JSON.stringify({ settledDiff, afterResizeDiff: resizedDiff, before: a.state, after: b.state }, null, 1));
  await browser.close();
}

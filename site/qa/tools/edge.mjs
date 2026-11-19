// The painting's watercolour edge (reviews/scene-edge-feather.md): screenshots of every style, the check
// that no mushroom or tap box sits in the fade, and frame times while panning. Needs `npm run dev`.
//
//   node qa/tools/edge.mjs shots   a-round (the default), a, b and c, both scenes, three sizes; and compare.jpg
//   node qa/tools/edge.mjs spots   reads the edge as drawn on the page under every mushroom and tap box
//   node qa/tools/edge.mjs pan     WebKit, phone: frame times while the room is panned end to end
import { chromium, webkit, devices } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const base = process.env.HJ_URL ?? 'http://localhost:5173/';
const out = new URL('../edge/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const STYLES = ['a-round', 'a', 'b', 'c'];
const NAMES = { 'a-round': 'A with rounded corners (chosen, the default)', a: 'A, light', b: 'B, medium', c: 'C, corners' };
const SIZES = [[1440, 900], [390, 844], [360, 740]];
const ready = (page) => page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 30000 });
const clean = (page) => page.evaluate(() => document.querySelectorAll('.hj-mushrooms').forEach((el) => el.classList.remove('is-debug')));
const say = (label, value) => console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);

const run = {
  async shots() {
    const browser = await chromium.launch({ channel: 'chrome' });
    const shots = {};
    for (const style of STYLES) {
      for (const scene of ['build', 'grow']) {
        for (const [width, height] of SIZES) {
          const phone = width <= 600;
          const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
          const page = await context.newPage();
          await page.goto(`${base}?debug&reset&intro=off&seed=7&edge=${style}#${scene}`);
          await ready(page);
          await clean(page);
          await page.getByRole('button', { name: 'Pause animation' }).click();
          await page.waitForTimeout(700);
          const name = `${style}-${scene}-${width}x${height}`;
          shots[name] = await page.screenshot();
          await sharp(shots[name]).jpeg({ quality: 88 }).toFile(`${out}${name}.jpg`);
          if (phone && width === 390) {
            // The far ends of the room on a phone: the plate's own edge, not the window's.
            for (const [end, left] of [['left', 0], ['right', 99999]]) {
              await page.evaluate((x) => { document.querySelector('.hj-viewport').scrollLeft = x; }, left);
              await page.waitForTimeout(300);
              shots[`${name}-${end}`] = await page.screenshot();
              await sharp(shots[`${name}-${end}`]).jpeg({ quality: 88 }).toFile(`${out}${name}-${end}.jpg`);
            }
          }
          await context.close();
        }
      }
    }
    await browser.close();

    // One picture to choose from: the four styles on desktop, for both scenes, then the phone.
    const W = 896;
    const H = 560;
    const PW = 260;
    const PH = Math.round((PW * 844) / 390);
    const gap = 16;
    const head = 44;
    const width = gap + 4 * (W / 2 + gap);
    const tiles = [];
    const labels = [];
    const label = (text, x, y, size = 20) => labels.push(`<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" fill="#302e29">${text}</text>`);
    let y = 0;
    for (const scene of ['build', 'grow']) {
      for (let i = 0; i < STYLES.length; i++) {
        const x = gap + i * (W / 2 + gap);
        if (scene === 'build') label(NAMES[STYLES[i]], x, y + 30, 18);
        tiles.push({ input: await sharp(shots[`${STYLES[i]}-${scene}-1440x900`]).resize(W / 2, H / 2).toBuffer(), left: x, top: y + (scene === 'build' ? head : gap) });
      }
      y += H / 2 + (scene === 'build' ? head : gap);
    }
    y += gap;
    label('The chosen edge, large', gap, y + 30);
    const bigW = width - 2 * gap;
    const bigH = Math.round((bigW * 900) / 1440);
    tiles.push({ input: await sharp(shots['a-round-build-1440x900']).resize(bigW, bigH).toBuffer(), left: gap, top: y + head });
    y += head + bigH + gap;
    label('On a phone (390 × 844): opening view, panned fully left, panned fully right. The chosen edge, then A', gap, y + 30);
    y += head;
    let x = gap;
    for (const style of STYLES) {
      for (const suffix of ['', '-left', '-right']) {
        if (x + PW > width) break;
        tiles.push({ input: await sharp(shots[`${style}-build-390x844${suffix}`]).resize(PW, PH).toBuffer(), left: x, top: y });
        x += PW + 6;
      }
      x += gap;
    }
    y += PH + gap;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}">${labels.join('')}</svg>`;
    await sharp({ create: { width, height: y, channels: 3, background: '#d9d6cf' } }).composite([{ input: Buffer.from(svg), left: 0, top: 0 }, ...tiles]).jpeg({ quality: 86 }).toFile(`${out}compare.jpg`);
    say('compare', `${out}compare.jpg`);
  },

  // The edge as it is actually drawn on the page, read back under every mushroom and every tap box.
  async spots() {
    const report = [];
    for (const [engine, width, height] of [['chrome', 1440, 900], ['chrome', 2560, 1440], ['webkit', 390, 844], ['webkit', 360, 740], ['webkit', 320, 640]]) {
      const phone = width <= 600;
      const browser = engine === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
      const context = await browser.newContext(phone ? { ...devices['iPhone 14'], viewport: { width, height } } : { viewport: { width, height } });
      const page = await context.newPage();
      for (const scene of ['build', 'grow']) {
        await page.goto(`${base}?debug&reset&intro=off&seed=7#${scene}`);
        await page.reload();
        await ready(page);
        const rows = await page.evaluate(() => {
          const plate = document.querySelector('.hj-plate');
          const edge = plate.querySelector('.hj-edge');
          const data = edge.getContext('2d').getImageData(0, 0, edge.width, edge.height).data;
          const p = plate.getBoundingClientRect();
          // How much of the painting shows at a point of the page: 1 minus the paper overlay's opacity there.
          const shows = (x, y) => {
            const ex = Math.min(edge.width - 1, Math.max(0, Math.floor(((x - p.left) / p.width) * edge.width)));
            const ey = Math.min(edge.height - 1, Math.max(0, Math.floor(((y - p.top) / p.height) * edge.height)));
            return 1 - data[(ey * edge.width + ex) * 4 + 3] / 255;
          };
          const lowest = (r) => { let min = 1; for (let j = 0; j <= 10; j++) for (let i = 0; i <= 10; i++) min = Math.min(min, shows(r.left + (r.width * i) / 10, r.top + (r.height * j) / 10)); return min; };
          return [...plate.querySelectorAll('.hj-shroom')].map((button) => {
            const box = button.getBoundingClientRect();
            const art = button.querySelector('.hj-shroom-art').getBoundingClientRect();
            return { id: button.dataset.spot, drawing: Math.round(lowest(art) * 1000) / 1000, tapBox: Math.round(lowest(box) * 1000) / 1000, box: [Math.round(box.width), Math.round(box.height)], moved: [Math.round(box.left + box.width / 2 - (art.left + art.width / 2)), Math.round(box.top + box.height / 2 - (art.top + art.height / 2))],
              covers: art.left >= box.left - 0.6 && art.right <= box.right + 0.6 && art.top >= box.top - 0.6 && art.bottom <= box.bottom + 0.6, rect: [box.left - p.left, box.top - p.top, box.width, box.height] };
          });
        });
        const overlaps = [];
        for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
          const [ax, ay, aw, ah] = rows[i].rect; const [bx, by, bw, bh] = rows[j].rect;
          if (ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah) overlaps.push(`${rows[i].id}/${rows[j].id}`);
        }
        const row = { engine, size: `${width}x${height}`, scene, spots: rows.length, lowestUnderADrawing: Math.min(...rows.map((r) => r.drawing)), lowestUnderATapBox: Math.min(...rows.map((r) => r.tapBox)), smallestBox: Math.min(...rows.map((r) => Math.min(...r.box))), everyBoxCoversItsDrawing: rows.every((r) => r.covers), boxesMovedInward: rows.filter((r) => r.moved[0] || r.moved[1]).map((r) => `${r.id} ${r.moved.join(',')}px`), overlaps };
        row.ok = row.spots === 10 && row.lowestUnderADrawing >= 0.95 && row.lowestUnderATapBox >= 0.95 && row.smallestBox >= 44 && row.everyBoxCoversItsDrawing && overlaps.length === 0;
        report.push(row);
        say(`${engine} ${width}x${height} ${scene}`, row);
      }
      await browser.close();
    }
    await writeFile(`${out}spots.json`, `${JSON.stringify(report, null, 1)}\n`);
    console.log(report.every((r) => r.ok) ? 'ALL SOLID: every mushroom and tap box is over at least 0.95 of the painting' : 'SOME SPOTS ARE IN THE FADE');
  },

  async pan() {
    const results = [];
    for (let i = 0; i < 3; i++) {
      const browser = await webkit.launch();
      const context = await browser.newContext({ ...devices['iPhone 14'], viewport: { width: 390, height: 844 } });
      await context.addInitScript(() => {
        window.__gaps = [];
        let last = performance.now();
        const tick = (now) => { window.__gaps.push([last, now - last]); last = now; requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      });
      const page = await context.newPage();
      const row = {};
      for (const scene of ['build', 'grow']) {
        await page.goto(`${base}?debug&reset&intro=off&seed=7#${scene}`);
        await page.reload();
        await ready(page);
        await page.waitForTimeout(1500);
        row[scene] = await page.evaluate(async () => {
          const wait = (ms) => new Promise((r) => setTimeout(r, ms));
          const view = document.querySelector('.hj-viewport');
          const t0 = performance.now();
          view.scrollTo({ left: view.scrollWidth, behavior: 'smooth' }); await wait(1300);
          view.scrollTo({ left: 0, behavior: 'smooth' }); await wait(1500);
          view.scrollTo({ left: 300, behavior: 'smooth' }); await wait(1000);
          const gaps = window.__gaps.filter(([at]) => at >= t0);
          return { frames: gaps.length, longestMs: Math.round(Math.max(...gaps.map(([, len]) => len))), over50: gaps.filter(([, len]) => len > 50).length };
        });
      }
      results.push(row);
      say(`pan run ${i + 1}`, row);
      await browser.close();
    }
    await writeFile(`${out}pan-webkit.json`, `${JSON.stringify(results, null, 1)}\n`);
  },
};

const command = process.argv[2];
if (!run[command]) {
  console.error(`Unknown command "${command}". One of: ${Object.keys(run).join(', ')}`);
  process.exit(1);
}
await run[command]();

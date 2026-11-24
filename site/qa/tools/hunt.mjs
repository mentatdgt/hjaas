// The harder hunt in Grow (reviews/scene-2-hunt-difficulty.md): screenshots with and without the ten spots
// marked, and the fairness rules checked on the page. Needs `npm run dev` (5173).
//
//   node qa/tools/hunt.mjs shots    desktop, and a phone panned left, centre and right: plain, then circled
//   node qa/tools/hunt.mjs checks   size, how much of each drawing shows, contrast, Tab order, saved progress
import { chromium, webkit, devices } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { CAPTION } from './caption-state.mjs';

const base = process.env.HJ_URL ?? 'http://localhost:5173/';
const out = new URL('../hunt/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const TIER = {
  door: 'easy', bench: 'easy', 'switch-box': 'easy',
  'under-shelf': 'medium', floor: 'medium', pipe: 'medium', drain: 'medium',
  'crop-hood': 'hard', 'crop-shelf': 'hard', 'crop-rack': 'hard',
};
const COLOUR = { easy: '#1a8f4a', medium: '#d97706', hard: '#c026d3' };
const ready = (page) => page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 30000 });
const clean = (page) => page.evaluate(() => document.querySelectorAll('.hj-mushrooms').forEach((el) => el.classList.remove('is-debug')));
const say = (label, value) => console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
const url = (extra = '') => `${base}?debug&reset&intro=off&seed=4${extra}#grow`;
/** Every drawing's place on the screen, with whether it is inside the window just now. */
const drawings = (page) => page.evaluate(() => {
  const win = document.querySelector('.hj-window').getBoundingClientRect();
  return [...document.querySelectorAll('.hj-shroom')].map((button) => {
    const r = button.querySelector('.hj-shroom-art').getBoundingClientRect();
    return { id: button.dataset.spot, x: r.left, y: r.top, w: r.width, h: r.height, inWindow: r.right > win.left + 4 && r.left < win.right - 4 };
  });
});
/** The screenshot with each spot in view circled and named. */
const circled = async (image, spots, scale) => {
  const meta = await sharp(image).metadata();
  const marks = spots.filter((s) => s.inWindow).map((s) => {
    const tier = TIER[s.id];
    const cx = (s.x + s.w / 2) * scale;
    const cy = (s.y + s.h / 2) * scale;
    const r = Math.max(s.w, s.h) * scale * 0.5 + 14 * scale;
    const text = `${tier}: ${s.id}`;
    const size = 13 * scale;
    const tw = text.length * size * 0.56 + 10 * scale;
    // The label goes above the circle, or below it near the top of the picture; kept inside the image.
    const ty = cy - r - 8 * scale < size * 3 ? cy + r + size + 6 * scale : cy - r - 8 * scale;
    const tx = Math.min(Math.max(cx - tw / 2, 4), meta.width - tw - 4);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="${5 * scale}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${COLOUR[tier]}" stroke-width="${2.5 * scale}"/>`
      + `<rect x="${tx}" y="${ty - size}" width="${tw}" height="${size + 7 * scale}" rx="${4 * scale}" fill="${COLOUR[tier]}"/><text x="${tx + 5 * scale}" y="${ty + 2 * scale}" font-family="Helvetica, Arial, sans-serif" font-weight="bold" font-size="${size}" fill="#fff">${text}</text>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}">${marks.join('')}</svg>`;
  return sharp(image).composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).jpeg({ quality: 90 }).toBuffer();
};

const run = {
  async shots() {
    const shoot = async (page, name, scale) => {
      // Two frames, so what was just scrolled or paused is on screen.
      await page.waitForTimeout(350);
      const image = await page.screenshot();
      await sharp(image).jpeg({ quality: 90 }).toFile(`${out}grow-${name}.jpg`);
      await writeFile(`${out}grow-${name}-circled.jpg`, await circled(image, await drawings(page), scale));
      say(name, (await drawings(page)).filter((s) => s.inWindow).map((s) => s.id).join(', '));
    };
    {
      const browser = await chromium.launch({ channel: 'chrome' });
      const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
      await page.goto(url());
      await ready(page);
      await clean(page);
      await page.getByRole('button', { name: 'Pause animation' }).click();
      await shoot(page, 'desktop', 2);
      await browser.close();
    }
    {
      const browser = await webkit.launch();
      const page = await (await browser.newContext({ ...devices['iPhone 14'], viewport: { width: 390, height: 844 } })).newPage();
      await page.goto(url());
      await ready(page);
      await clean(page);
      await page.getByRole('button', { name: 'Pause animation' }).click();
      await shoot(page, 'phone-centre', 3);
      for (const [name, left] of [['left', 0], ['right', 99999]]) {
        await page.evaluate((x) => { document.querySelector('.hj-viewport').scrollLeft = x; }, left);
        await shoot(page, `phone-${name}`, 3);
      }
      // Each hard one as a phone visitor meets it: the room panned to it, at the phone's own size (no zoom).
      for (const id of Object.keys(TIER).filter((spot) => TIER[spot] === 'hard')) {
        await page.locator(`[data-spot="${id}"]`).evaluate((el) => {
          const view = document.querySelector('.hj-viewport');
          const r = el.getBoundingClientRect();
          const v = view.getBoundingClientRect();
          view.scrollLeft += r.left + r.width / 2 - (v.left + v.width / 2);
        });
        await page.waitForTimeout(350);
        const box = await page.locator('.hj-window').boundingBox();
        // At one image pixel per CSS pixel: what the phone shows, as large as the phone shows it.
        await sharp(await page.screenshot({ clip: box })).resize({ width: Math.round(box.width) }).jpeg({ quality: 92 }).toFile(`${out}grow-phone-hard-${id}-at-phone-size.jpg`);
      }
      await browser.close();
    }
  },

  async checks() {
    const report = { spots: [], rules: {} };
    const browser = await chromium.launch({ channel: 'chrome' });
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
    await page.goto(url());
    await ready(page);
    await clean(page);
    await page.getByRole('button', { name: 'Pause animation' }).click();
    await page.waitForFunction(() => window.__hj.rachel.has('thumbs_up#9'), null, { timeout: 60000 });
    await page.waitForTimeout(500);

    // The page with the mushrooms, and the same page without them: the difference is exactly what a
    // visitor has to go on. Taken with Rachel on each of her stills, so her trolley and limbs count as cover.
    const plate = await page.locator('.hj-plate').boundingBox();
    const stills = await page.evaluate(async () => Object.keys((await (await fetch('./assets/scene2/rachel/frames.json')).json()).stills));
    const info = await page.evaluate(() => {
      const p = document.querySelector('.hj-plate').getBoundingClientRect();
      const u = p.width / 1672;
      return [...document.querySelectorAll('.hj-shroom')].map((button) => {
        const art = button.querySelector('.hj-shroom-art');
        const r = art.getBoundingClientRect();
        const b = button.getBoundingClientRect();
        return { id: button.dataset.spot, heightPlatePx: Math.round((r.height / u) * 10) / 10, rect: [r.left - p.left, r.top - p.top, r.width, r.height], tapBox: [Math.round(b.width), Math.round(b.height)], clip: art.style.clipPath || null, opacity: art.querySelector('img').style.opacity || null };
      });
    });
    const grab = async () => sharp(await page.screenshot({ clip: plate })).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    const worst = new Map(info.map((s) => [s.id, { shows: 1, difference: 255 }]));
    for (const still of stills) {
      await page.evaluate((pose) => { window.__hj.player.stop(); window.__hj.rachel.show(pose); }, still);
      await page.waitForTimeout(120);
      const withThem = await grab();
      // Her canvas alone tells where she covers: taken with the mushrooms hidden.
      await page.evaluate(() => { document.querySelector('.hj-mushrooms').style.visibility = 'hidden'; });
      await page.waitForTimeout(120);
      const without = await grab();
      await page.evaluate(() => { document.querySelector('.hj-mushrooms').style.visibility = ''; });
      const W = withThem.info.width;
      const k = W / plate.width;
      for (const s of info) {
        // The drawing's own pixels, from its image: how many of them can be seen to change the page?
        const [x, y, w, h] = s.rect.map((v) => v * k);
        const art = await page.evaluate((id) => { const img = document.querySelector(`[data-spot="${id}"] img`); return { src: img.src, flipped: img.classList.contains('is-flipped') }; }, s.id);
        const shape = await sharp(Buffer.from(await (await page.request.get(art.src)).body())).resize(Math.round(w), Math.round(h), { fit: 'fill' }).flop(art.flipped).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        let solid = 0; let seen = 0; let sum = 0;
        for (let j = 0; j < shape.info.height; j++) {
          for (let i = 0; i < shape.info.width; i++) {
            if (shape.data[(j * shape.info.width + i) * 4 + 3] < 128) continue;
            solid++;
            const p = ((Math.round(y) + j) * W + Math.round(x) + i) * 4;
            const d = Math.max(Math.abs(withThem.data[p] - without.data[p]), Math.abs(withThem.data[p + 1] - without.data[p + 1]), Math.abs(withThem.data[p + 2] - without.data[p + 2]));
            if (d > 6) { seen++; sum += d; }
          }
        }
        const entry = worst.get(s.id);
        entry.shows = Math.min(entry.shows, seen / solid);
        entry.difference = Math.min(entry.difference, seen ? sum / seen : 0);
      }
    }
    for (const s of info) {
      const { shows, difference } = worst.get(s.id);
      report.spots.push({ id: s.id, tier: TIER[s.id], heightPlatePx: s.heightPlatePx, showsAtLeast: `${Math.round(shows * 100)}%`, differsFromWhatIsBehindIt: Math.round(difference), tucked: s.clip, opacity: s.opacity, tapBoxAt1440: s.tapBox });
    }
    for (const row of report.spots) say(row.id, row);

    // Tab order: from the last menu tab, Tab ten times.
    await page.locator('.hj-tab[data-scene="grow"]').focus();
    const order = [];
    for (let i = 0; i < 10; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => document.activeElement?.dataset?.spot ?? document.activeElement?.className)); }
    const xs = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.hj-shroom')].map((b) => [b.dataset.spot, Math.round(b.getBoundingClientRect().left)])));
    report.rules.tabOrder = { order, leftToRight: order.every((id, i) => i === 0 || xs[id] >= xs[order[i - 1]]) };
    say('tab order', report.rules.tabOrder);
    await browser.close();

    // Saved progress from the first hunt: the three replaced spots still count, under their new names.
    {
      const b = await chromium.launch({ channel: 'chrome' });
      const context = await b.newContext({ viewport: { width: 1440, height: 900 } });
      await context.addInitScript(() => {
        localStorage.setItem('hjaas:site:v2', JSON.stringify({ scenes: { build: { found: [], seen: true, panX: null }, grow: { found: ['door', 'bench-corner', 'humidifier', 'rack'], seen: true, panX: null } }, unlocked: false, panned: false }));
      });
      const p = await context.newPage();
      await p.goto(`${base}?debug&intro=off&seed=4#grow`);
      await ready(p);
      report.rules.savedProgress = await p.evaluate(() => ({ stillHidden: [...document.querySelectorAll('.hj-shroom')].map((el) => el.dataset.spot) }));
      report.rules.savedProgress.caption = (await p.evaluate(CAPTION)).text;
      say('saved progress (had found door, bench-corner, humidifier, rack)', report.rules.savedProgress);
      await b.close();
    }

    report.rules.summary = {
      ten: report.spots.length === 10,
      tiers: Object.fromEntries(['easy', 'medium', 'hard'].map((tier) => [tier, report.spots.filter((s) => s.tier === tier).map((s) => s.id)])),
      everyoneAtLeast14px: report.spots.every((s) => s.heightPlatePx >= 14),
      everyoneAtLeast60PercentInView: report.spots.every((s) => parseInt(s.showsAtLeast, 10) >= 60),
      lowestContrast: report.spots.reduce((a, b) => (b.differsFromWhatIsBehindIt < a.differsFromWhatIsBehindIt ? b : a)).id,
    };
    say('summary', report.rules.summary);
    // The tap boxes (44 px, no overlaps, on solid painting, five screen sizes) are checked by edge.mjs.
    try { report.rules.tapBoxes = JSON.parse(await readFile(new URL('../edge/spots.json', import.meta.url), 'utf8')).filter((r) => r.scene === 'grow').map((r) => ({ size: `${r.engine} ${r.size}`, smallestBox: r.smallestBox, lowestUnderADrawing: r.lowestUnderADrawing, lowestUnderATapBox: r.lowestUnderATapBox, overlaps: r.overlaps, ok: r.ok })); } catch { /* run edge.mjs spots first */ }
    await writeFile(`${out}checks.json`, `${JSON.stringify(report, null, 1)}\n`);
  },
};

const command = process.argv[2];
if (!run[command]) {
  console.error(`Unknown command "${command}". One of: ${Object.keys(run).join(', ')}`);
  process.exit(1);
}
await run[command]();

// Review 05 (reviews/scene-2-review-05.md): whole-page memory, and the checks that go with it.
// Needs `npm run dev` (5173); `switches` needs the production build on 4173.
//
//   node qa/tools/review05.mjs memory     decoded image memory, phone profile: Build only; Build then Grow; Grow then Build
//   node qa/tools/review05.mjs switches   WebKit, production build, cold load: frame times over four switches (runs = argv[3], default 12)
//                                         HJ_URL and HJ_NAME point it at another build and another result file
//   node qa/tools/review05.mjs sharp      Build's 1.5× set beside the 2× set on a 390×844 @3× screen
import { webkit, devices } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const base = process.env.HJ_URL ?? 'http://localhost:5173/';
const out = new URL('../review-05/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const phone = { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } };
const ready = (page) => page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 40000 });
const arrived = (page, id) => page.waitForFunction((scene) => window.__hj?.scene?.config.id === scene && window.__hj.busy === false, id, { timeout: 40000 });
const clean = (page) => page.evaluate(() => document.querySelectorAll('.hj-mushrooms').forEach((el) => el.classList.remove('is-debug')));
const say = (label, value) => console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
// (HJ_SAVE: write the result to this file instead, for a later round that must not overwrite review 05's record.)
const save = (name, data) => writeFile(process.env.HJ_SAVE ?? `${out}${name}.json`, `${JSON.stringify(data, null, 1)}\n`);
const MB = (bytes) => Math.round(bytes / 1e5) / 10;
const label = (text, width, size = 15) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${size + 12}"><text x="4" y="${size + 2}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" fill="#302e29">${text}</text></svg>`);

/** Watch the page's own account of its decoded images every frame, and keep the highest. */
const watchMemory = (context) => context.addInitScript(() => {
  window.__peak = { total: 0, parts: {}, at: '' };
  const tick = () => {
    const h = window.__hj;
    if (h?.scene) {
      const m = h.memory;
      if (m.total > window.__peak.total) window.__peak = { total: m.total, parts: m.parts, at: `${h.scene.config.id}${h.busy ? ', during a painting or a switch' : ''}, pose ${h.rachel?.current ?? '-'}` };
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const peak = (page) => page.evaluate(() => window.__peak);
const resetPeak = (page) => page.evaluate(() => { window.__peak = { total: 0, parts: {}, at: '' }; });
const tidy = (p) => ({ peakMB: MB(p.total), at: p.at, partsMB: Object.fromEntries(Object.entries(p.parts).filter(([, v]) => v > 0).map(([k, v]) => [k, MB(v)])) });
/** A find, and her whole answer to it. Returns whether she played the full reaction. */
const find = async (page, spot, full) => {
  await page.evaluate(() => { window.__mark = window.__hj.poses.length; });
  await page.locator(`[data-spot="${spot}"]`).tap({ force: true });
  await page.waitForFunction((pose) => window.__hj.poses.slice(window.__mark).some(([p]) => p === pose), full, { timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => !window.__hj.player.reacting, null, { timeout: 20000 });
  return page.evaluate((pose) => window.__hj.poses.slice(window.__mark).some(([p]) => p === pose), full);
};
const BUILD_FULL = 'reaction/rx_K2.png';
const GROW_FULL = 'look_up#3';
const labReady = (page) => page.waitForFunction(() => window.__hj.rachel?.has('thumbs_up#9') && window.__hj.rachel.has('look_up#0'), null, { timeout: 60000 });
const buildReady = (page) => page.waitForFunction(() => window.__hj.rachel?.has('reaction/rx_wink.png') && window.__hj.rachel.has('frame_04'), null, { timeout: 60000 });
const cycle = (page) => page.waitForFunction(() => window.__hj.poses.some(([p], i, a) => p === 'mist_to_write#0' && a[i - 1]?.[0] === 'mist_to_write#1'), null, { timeout: 120000 });

const run = {
  // From the bitmap and canvas sizes, sampled every frame. Two kinds of visitor: one who has seen both
  // scenes (a switch is the short brush) and a new one (the opening painting, then a full painting of the
  // scene never seen).
  async memory() {
    const report = {};
    for (const [visitor, query] of [['return visitor (the short brush)', '?debug&reset&intro=quick&seed=4'], ['new visitor (full paintings)', '?debug&reset&seed=4']]) {
      const rows = {};
      // Build first.
      {
        const browser = await webkit.launch();
        const context = await browser.newContext(phone);
        await watchMemory(context);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${base}${query}`);
        await ready(page);
        await arrived(page, 'build');
        await buildReady(page);
        const fullA = await find(page, 'tiles', BUILD_FULL);
        await page.waitForTimeout(4000);
        const fullB = await find(page, 'conduit', BUILD_FULL);
        await page.waitForTimeout(3000);
        rows['Build only'] = { ...tidy(await peak(page)), set: await page.evaluate(() => window.__hj.scene.memory.canvasWidth), fullReactions: [fullA, fullB] };
        say(`${visitor} / Build only`, rows['Build only']);

        await resetPeak(page);
        await page.evaluate(() => { window.__missed0 = 0; window.__hj.poses.length = 0; });
        await page.locator('.hj-tab[data-scene="grow"]').tap();
        await arrived(page, 'grow');
        await labReady(page);
        await cycle(page);
        await page.waitForFunction(() => window.__hj.rachel.current === 'write_loop#6', null, { timeout: 60000 });
        const fullC = await find(page, 'door', GROW_FULL);
        await page.waitForTimeout(2000);
        rows['Build, then Grow'] = { ...tidy(await peak(page)), set: await page.evaluate(() => window.__hj.scene.memory.canvasWidth), fullReaction: fullC, framesSheHadToSkip: await page.evaluate(() => window.__hj.rachel.missed), errors };
        say(`${visitor} / Build, then Grow`, rows['Build, then Grow']);
        await browser.close();
      }
      // Grow first.
      {
        const browser = await webkit.launch();
        const context = await browser.newContext(phone);
        await watchMemory(context);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${base}${query}#grow`);
        await ready(page);
        await arrived(page, 'grow');
        await labReady(page);
        await page.evaluate(() => { window.__hj.poses.length = 0; });
        await cycle(page);
        rows['Grow only'] = tidy(await peak(page));
        say(`${visitor} / Grow only`, rows['Grow only']);

        await resetPeak(page);
        await page.locator('.hj-tab[data-scene="build"]').tap();
        await arrived(page, 'build');
        await buildReady(page);
        await page.waitForTimeout(3000);
        const fullD = await find(page, 'tiles', BUILD_FULL);
        await page.waitForTimeout(3000);
        rows['Grow, then Build'] = { ...tidy(await peak(page)), set: await page.evaluate(() => window.__hj.scene.memory.canvasWidth), fullReaction: fullD, errors };
        say(`${visitor} / Grow, then Build`, rows['Grow, then Build']);

        // And back once more: the lab's frames decoded for the second time.
        await resetPeak(page);
        await page.evaluate(() => { window.__lab0 = 0; });
        await page.locator('.hj-tab[data-scene="grow"]').tap();
        await arrived(page, 'grow');
        const missedBefore = await page.evaluate(() => window.__hj.rachel.missed);
        await labReady(page);
        await page.evaluate(() => { window.__hj.poses.length = 0; });
        await cycle(page);
        rows['Grow, then Build, then Grow again'] = { ...tidy(await peak(page)), framesSheHadToSkipAfterComingBack: await page.evaluate((before) => window.__hj.rachel.missed - before, missedBefore), errors };
        say(`${visitor} / back to Grow`, rows['Grow, then Build, then Grow again']);
        await browser.close();
      }
      report[visitor] = rows;
    }
    await save('memory', report);
  },

  // Every frame's length over four switches, on a cold load of the production build: to the lab (first
  // open), back to Build (its frames decoded again), to the lab again (the same), and back.
  async switches() {
    const url = process.env.HJ_URL ?? 'http://localhost:4173/';
    const runs = Number(process.argv[3] ?? 12);
    const results = [];
    for (const profile of ['iphone', 'desktop']) {
      // (A fourth argument, `iphone` or `desktop`, measures only that profile.)
      if (process.argv[4] && process.argv[4] !== profile) continue;
      for (let i = 0; i < runs; i++) {
        const browser = await webkit.launch();
        const context = await browser.newContext(profile === 'desktop' ? { viewport: { width: 1280, height: 760 } } : { ...devices['iPhone 13'] });
        await context.addInitScript(() => {
          // A visitor who has seen both scenes, so a switch is the short brush. (Nothing else is saved.)
          try {
            if (!localStorage.getItem('hjaas:site:v2')) localStorage.setItem('hjaas:site:v2', JSON.stringify({ scenes: { build: { found: [], seen: true, panX: null }, grow: { found: [], seen: true, panX: null } }, unlocked: false, panned: false }));
          } catch {}
          const log = { gaps: [] };
          window.__frames = log;
          let last = performance.now();
          const tick = (now) => { log.gaps.push([Math.round(last), Math.round(now - last)]); last = now; requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
        });
        const page = await context.newPage();
        await page.goto(url);
        await page.waitForSelector('.hj-tab');
        // Long enough for the opening and for the other scene to load in the background.
        await page.waitForTimeout(4500);
        const measure = async (id) => {
          const t0 = await page.evaluate(() => performance.now());
          const tab = page.locator(`.hj-tab[data-scene="${id}"]`);
          if (profile === 'iphone') await tab.tap(); else await tab.click();
          // The switch (about 1.6 s) and the 2.4 s after it, while the frames given back are decoded again.
          await page.waitForTimeout(4000);
          return page.evaluate((start) => {
            const gaps = window.__frames.gaps.filter(([at, len]) => at + len >= start && at <= start + 4000);
            return { longest: Math.max(...gaps.map(([, len]) => len)), over50: gaps.filter(([, len]) => len > 50).map(([at, len]) => `${len}ms@${Math.round(at - start)}`) };
          }, t0);
        };
        const row = { profile, run: i + 1, toGrow: await measure('grow'), toBuild: await measure('build'), toGrowAgain: await measure('grow'), toBuildAgain: await measure('build') };
        results.push(row);
        console.log(JSON.stringify(row));
        await browser.close();
      }
    }
    const summary = {};
    for (const profile of ['iphone', 'desktop']) {
      summary[profile] = {};
      for (const key of ['toGrow', 'toBuild', 'toGrowAgain', 'toBuildAgain']) summary[profile][key] = results.filter((r) => r.profile === profile).map((r) => r[key].longest);
    }
    console.log(JSON.stringify(summary));
    await save(process.env.HJ_NAME ?? 'switch-frames-webkit-cold', { url, summary, results });
  },

  // Build's lighter set beside the delivered one, on the phone that needs the most of it: 390 × 844 at 3×.
  async sharp() {
    const browser = await webkit.launch();
    const shots = {};
    for (const set of ['1.5x', '2x']) {
      const context = await browser.newContext({ ...phone, deviceScaleFactor: 3 });
      const page = await context.newPage();
      // Without its files the lighter set is not used, and the site falls back to the delivered frames.
      if (set === '2x') await page.route('**/scene1/rachel-1.5x/**', (route) => route.fulfill({ status: 404, body: '' }));
      await page.goto(`${base}?debug&reset&intro=off&seed=4`);
      await ready(page);
      await clean(page);
      await page.getByRole('button', { name: 'Pause animation' }).click();
      await page.waitForTimeout(900);
      const info = await page.evaluate(() => { const c = document.querySelector('.hj-rachel canvas'); return { canvas: [c.width, c.height], cssWidth: Math.round(c.getBoundingClientRect().width * 10) / 10, artWidth: window.__hj.scene.memory.canvasWidth, pose: window.__hj.rachel.current }; });
      const box = await page.locator('.hj-rachel').boundingBox();
      shots[set] = { whole: await page.screenshot({ clip: box }), info };
      say(set, info);
      await context.close();
    }
    await browser.close();
    const meta = await sharp(shots['1.5x'].whole).metadata();
    const size = 420;
    const crop = (image, fx, fy) => sharp(image).extract({ left: Math.round(meta.width * fx), top: Math.round(meta.height * fy), width: size, height: size }).toBuffer();
    const gap = 14;
    const head = 30;
    const tiles = [];
    let x = gap;
    for (const set of ['1.5x', '2x']) {
      const figureH = 2 * size + gap;
      const figureW = Math.round((figureH * meta.width) / meta.height);
      tiles.push({ input: label(set === '1.5x' ? `1.5× set (her canvas ${shots[set].info.canvas[0]} px), as phones now get` : `2× set (her canvas ${shots[set].info.canvas[0]} px), as before`, figureW + size + gap, 16), left: x, top: gap });
      tiles.push({ input: await sharp(shots[set].whole).resize(figureW, figureH).toBuffer(), left: x, top: gap + head });
      tiles.push({ input: await crop(shots[set].whole, 0.3, 0.1), left: x + figureW + gap, top: gap + head });
      tiles.push({ input: await crop(shots[set].whole, 0.12, 0.46), left: x + figureW + gap, top: gap + head + size + gap });
      x += figureW + size + 3 * gap;
    }
    await sharp({ create: { width: x, height: 2 * gap + head + 2 * size + gap, channels: 3, background: '#d9d6cf' } }).composite(tiles).jpeg({ quality: 92 }).toFile(`${out}build-sharpness-390x844@3x.jpg`);
    await save('build-sharpness', { '1.5x': shots['1.5x'].info, '2x': shots['2x'].info });
  },
};

const command = process.argv[2];
if (!run[command]) {
  console.error(`Unknown command "${command}". One of: ${Object.keys(run).join(', ')}`);
  process.exit(1);
}
await run[command]();

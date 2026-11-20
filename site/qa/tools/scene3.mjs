// Scene 3, "Design" (the café): the checks of reviews/scene-3-build.md, section 7.
// Needs `npm run dev` (HJ_URL for another address). Results go to qa/scene3/.
//
//   node qa/tools/scene3.mjs shots     Design at 1440×900, 390×844 (as it opens, panned left, panned right) and 360×740
//   node qa/tools/scene3.mjs hunt      the ten hiding places, unmarked and marked easy / medium / hard, desktop and phone
//   node qa/tools/scene3.mjs memory    peak decoded-image memory on the phone profile, for every order of visiting the three scenes
//   node qa/tools/scene3.mjs back      coming back to the café: the cast is on the plate again before the brush shows it
//   node qa/tools/scene3.mjs react     a find while she sketches, and one with the cup at her lips: what she does, desktop and phone
//   node qa/tools/scene3.mjs film      30 s of the café with one find, desktop and iPhone profile, and its first-visit painting
//   node qa/tools/scene3.mjs frames    frame times in WebKit (phone) and throttled Chrome: the café's painting, and Build → Grow → Design → Build
import { chromium, webkit, devices } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const base = process.env.HJ_URL ?? 'http://localhost:5173/';
const out = new URL('../scene3/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const phone = { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } };
const ready = (page) => page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 40000 });
const arrived = (page, id) => page.waitForFunction((scene) => window.__hj?.scene?.config.id === scene && window.__hj.busy === false, id, { timeout: 60000 });
const clean = (page) => page.evaluate(() => document.querySelectorAll('.hj-mushrooms').forEach((el) => el.classList.remove('is-debug')));
const say = (label, value) => console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
const save = (name, data) => writeFile(`${out}${name}`, `${JSON.stringify(data, null, 1)}\n`);
const MB = (bytes) => Math.round(bytes / 1e5) / 10;
const errorsOf = (page) => {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
};
const text = (t, width, size = 17) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${size + 14}"><text x="4" y="${size + 3}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" fill="#302e29">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
/** Pictures side by side on grey, with a title over the row. */
const row = async (title, pictures, file, gap = 12) => {
  const sizes = await Promise.all(pictures.map((p) => sharp(p).metadata()));
  const width = sizes.reduce((sum, s) => sum + s.width + gap, gap);
  const height = Math.max(...sizes.map((s) => s.height));
  let x = gap;
  const parts = [{ input: text(title, width), left: 0, top: 4 }];
  pictures.forEach((input, i) => { parts.push({ input, left: x, top: 40 }); x += sizes[i].width + gap; });
  await sharp({ create: { width, height: height + 40 + gap, channels: 3, background: '#d9d6cf' } }).composite(parts).jpeg({ quality: 88 }).toFile(file);
};

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
const tidy = (p) => ({ peakMB: MB(p.total), at: p.at, partsMB: Object.fromEntries(Object.entries(p.parts).filter(([, v]) => v > 0).map(([k, v]) => [k, MB(v)])) });

// What "this scene has everything it will ever hold" means, a spot to find in it, and the pose that shows
// her full reaction was played.
const SCENE = {
  build: {
    loaded: (page) => page.waitForFunction(() => window.__hj.rachel?.has('reaction/rx_wink.png') && window.__hj.rachel.has('frame_04'), null, { timeout: 90000 }),
    busy: (page) => page.waitForTimeout(3000),
    spot: 'tiles', full: 'reaction/rx_K2.png',
  },
  grow: {
    loaded: (page) => page.waitForFunction(() => window.__hj.rachel?.has('thumbs_up#9') && window.__hj.rachel.has('look_up#0'), null, { timeout: 90000 }),
    // Once round her routine, into the writing loop: the most clip frames she ever has decoded.
    busy: async (page) => {
      await page.evaluate(() => { window.__hj.poses.length = 0; });
      await page.waitForFunction(() => window.__hj.poses.some(([p], i, a) => p === 'mist_to_write#0' && a[i - 1]?.[0] === 'mist_to_write#1'), null, { timeout: 150000 });
      await page.waitForFunction(() => window.__hj.rachel.current === 'write_loop#6', null, { timeout: 90000 });
    },
    spot: 'door', full: 'look_up#3',
  },
  design: {
    loaded: (page) => page.waitForFunction(() => window.__hj.rachel?.has('look_up#24') && window.__hj.rachel.has('look_up#0'), null, { timeout: 90000 }),
    // A whole sip: up, the hold, and down again.
    busy: async (page) => {
      await page.evaluate(() => { window.__hj.poses.length = 0; });
      await page.waitForFunction(() => { const p = window.__hj.poses.map(([pose]) => pose); const up = p.indexOf('sip#30'); return up >= 0 && p.lastIndexOf('sip#2') > up + 10; }, null, { timeout: 150000 });
    },
    spot: 'window-seat', full: 'look_up#3',
  },
};
/** A find, and her whole answer to it. Returns whether she played the full reaction. */
const find = async (page, spot, full, touch = true) => {
  await page.evaluate(() => { window.__mark = window.__hj.poses.length; });
  // (Brought into the window first, as a visitor would by panning.)
  await page.evaluate((id) => { const view = document.querySelector('.hj-viewport'); const r = document.querySelector(`.hj-plate [data-spot="${id}"]`).getBoundingClientRect(); const v = view.getBoundingClientRect(); view.scrollLeft += r.left + r.width / 2 - (v.left + v.width / 2); }, spot);
  await page.waitForTimeout(250);
  if (touch) await page.locator(`.hj-plate [data-spot="${spot}"]`).tap({ force: true }); else await page.locator(`.hj-plate [data-spot="${spot}"]`).click({ force: true });
  await page.waitForFunction((pose) => window.__hj.poses.slice(window.__mark).some(([p]) => p === pose), full, { timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => !window.__hj.player.reacting, null, { timeout: 20000 });
  return page.evaluate((pose) => window.__hj.poses.slice(window.__mark).some(([p]) => p === pose), full);
};

const run = {};

// From the bitmap and canvas sizes, sampled every frame, on the phone profile (WebKit, 390 × 844). Every
// order of visiting the three scenes, for two kinds of visitor: a new one (the opening painting, then a full
// painting of each scene never seen) and one for whom every switch is the short brush. In each scene: wait
// for everything it loads, let her go once round her routine, find one mushroom and let her react.
run.memory = async () => {
  const report = {};
  const orders = [['build', 'grow', 'design'], ['build', 'design', 'grow'], ['grow', 'build', 'design'], ['grow', 'design', 'build'], ['design', 'build', 'grow'], ['design', 'grow', 'build']];
  const only = process.argv[3];
  for (const [visitor, query] of [['new visitor (full paintings)', '?debug&reset&seed=4'], ['return visitor (the short brush)', '?debug&reset&intro=quick&seed=4']]) {
    if (only && !visitor.startsWith(only)) continue;
    report[visitor] = {};
    for (const order of orders) {
      const browser = await webkit.launch();
      const context = await browser.newContext(phone);
      await watchMemory(context);
      const page = await context.newPage();
      const errors = errorsOf(page);
      const stages = [];
      for (const [i, id] of order.entries()) {
        if (i === 0) await page.goto(`${base}${query}#${id}`);
        else {
          await page.evaluate(() => { window.__peak = { total: 0, parts: {}, at: '' }; });
          await page.locator(`.hj-tab[data-scene="${id}"]`).tap();
        }
        if (i === 0) await ready(page);
        await arrived(page, id);
        await SCENE[id].loaded(page);
        await SCENE[id].busy(page);
        const full = await find(page, SCENE[id].spot, SCENE[id].full);
        await page.waitForTimeout(1500);
        stages.push({ scene: id, ...tidy(await page.evaluate(() => window.__peak)), fullReaction: full, framesSheSkipped: await page.evaluate(() => window.__hj.rachel.missed) });
      }
      // And back to the first one: its frames decoded for the second time, with both others visited.
      await page.evaluate(() => { window.__peak = { total: 0, parts: {}, at: '' }; });
      await page.locator(`.hj-tab[data-scene="${order[0]}"]`).tap();
      await arrived(page, order[0]);
      await SCENE[order[0]].loaded(page);
      await SCENE[order[0]].busy(page);
      stages.push({ scene: `${order[0]} again`, ...tidy(await page.evaluate(() => window.__peak)), framesSheSkipped: await page.evaluate(() => window.__hj.rachel.missed) });
      const name = order.map((id) => id[0].toUpperCase() + id.slice(1)).join(' → ');
      report[visitor][name] = { highestMB: Math.max(...stages.map((s) => s.peakMB)), stages, errors };
      say(`${visitor} / ${name}`, { highestMB: report[visitor][name].highestMB, byStage: stages.map((s) => `${s.scene} ${s.peakMB}`), fullReactions: stages.map((s) => s.fullReaction), skipped: stages.at(-1).framesSheSkipped, errors });
      await browser.close();
      await save(`memory${only ? `-${only.split(' ')[0]}` : ''}.json`, report);
    }
  }
  const all = Object.values(report).flatMap((rows) => Object.values(rows).map((r) => r.highestMB));
  console.log(`HIGHEST of every order: ${Math.max(...all)} MB (the budget is 80)`);
};

const command = process.argv[2];
if (!run[command]) {
  console.error(`Unknown command "${command}". One of: ${Object.keys(run).join(', ')}`);
  process.exit(1);
}
await run[command]();

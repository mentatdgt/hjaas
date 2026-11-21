// Scene 5, "Set Design" (the theatre backdrop): the checks of reviews/scene-5-build.md, section 8.
// Needs `npm run dev` (HJ_URL for another address). Results go to qa/scene5/.
//
//   node qa/tools/scene5.mjs shots      Set Design at 1440×900, 390×844 (as it opens, panned left, panned right) and 360×740; the menu at 320 px
//   node qa/tools/scene5.mjs stages     the backdrop at 0…10 found against plate.png + P_01…P_k from the package; and the ten stages by finding, one page
//   node qa/tools/scene5.mjs fade       one find's swath fading in: when it starts, how long, how it eases, and no pop when it is baked; reduced motion
//   node qa/tools/scene5.mjs react      her salute from whatever pose, a second find, a minute of her routine and her blinks, the lamp's swing; reduced motion
//   node qa/tools/scene5.mjs walk       the stagehand's boots: the schedule, pause, leaving and coming back, even timing, the boots at 1:1, never outside the gap
//   node qa/tools/scene5.mjs film       recordings: 45 s at work, the 10th find, the unlock (and a 10/10 scene without it), reduced motion
//   node qa/tools/scene5.mjs preview    the page against the package's own picture (as tools/theatre_preview.py draws it): Rachel, the lamp, the boots
//   node qa/tools/scene5.mjs memory [new|return] [scene | a,b,c,d,e]   peak decoded-image memory on the phone profile, five scenes in many orders
//   node qa/tools/scene5.mjs frames [n] frame times in WebKit (phone) and throttled Chrome: painting, at work, a find's fade, a walk, round the scenes twice
import { chromium, webkit, devices } from 'playwright';
import { mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import sharp from 'sharp';

const base = process.env.HJ_URL ?? 'http://localhost:5173/';
const out = new URL('../scene5/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const pkg = new URL('../../../frames/022-theatre-scene/', import.meta.url).pathname;
const ID = 'set';
const PLATE = { w: 1672, h: 941 };

// ---- The one place that names hiding places. Keep in step with src/scenes/set.ts. ---------------------------
const LEVEL = { coil: 'hard', flats: 'medium', boards: 'easy', pots: 'hard', 'drop-cloth': 'easy', ladder: 'medium', 'paint-pail': 'hard', 'cart-shelf': 'medium', 'cart-front': 'easy', splatter: 'medium' };
// The finds the commands make, in order (the easy ones first: clear of everything, and in every window).
const FINDS = ['boards', 'drop-cloth', 'cart-front', 'flats', 'ladder', 'cart-shelf', 'splatter', 'coil', 'pots', 'paint-pail'];
// What "all of Rachel is in" is measured on: her layer, in plate px.
const RACHEL = [702, 75, 1096, 575];
// The backdrop's swaths all lie in this rectangle (plate px), and the part of it compared: clear of the
// edge's reach at the top (the top strip is 152 px deep) and on the right (the edge can reach 210 px in from
// the rim: x 1462 on), and above the gap under the hem (y 554 on).
const BACKDROP = [929, 0, 1529, 562];
const COMPARED = [929, 160, 1460, 552];
// --------------------------------------------------------------------------------------------------------------

const phone = { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } };
const ready = (page) => page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 40000 });
const arrived = (page, id) => page.waitForFunction((scene) => window.__hj?.scene?.config.id === scene && window.__hj.busy === false, id, { timeout: 60000 });
const clean = (page) => page.evaluate(() => document.querySelectorAll('.hj-mushrooms').forEach((el) => el.classList.remove('is-debug')));
const say = (label, value) => console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
const save = (name, data) => writeFile(`${out}${name}`, `${JSON.stringify(data, null, 1)}\n`);
const MB = (bytes) => Math.round(bytes / 1e5) / 10;
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const errorsOf = (page) => {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
};
const launch = (engine) => engine.launch(engine === chromium ? { channel: 'chrome' } : {});
const text = (t, width, size = 17) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${size + 14}"><text x="4" y="${size + 3}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" fill="#302e29">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
/** Pictures side by side on grey, with a title over the row. */
const row = async (title, pictures, file, gap = 12) => {
  const sizes = await Promise.all(pictures.map((p) => sharp(p).metadata()));
  const width = Math.max(sizes.reduce((sum, s) => sum + s.width + gap, gap), 420);
  const height = Math.max(...sizes.map((s) => s.height));
  let x = gap;
  const parts = [{ input: text(title, width), left: 0, top: 4 }];
  pictures.forEach((input, i) => { parts.push({ input, left: x, top: 40 }); x += sizes[i].width + gap; });
  await sharp({ create: { width, height: height + 40 + gap, channels: 3, background: '#d9d6cf' } }).composite(parts).jpeg({ quality: 88 }).toFile(file);
};
/** Pictures stacked, each with its own label. */
const column = async (title, pictures, labels, file, gap = 10) => {
  const sizes = await Promise.all(pictures.map((p) => sharp(p).metadata()));
  const width = Math.max(...sizes.map((s) => s.width)) + 2 * gap;
  let y = 40;
  const parts = [{ input: text(title, width), left: 0, top: 4 }];
  pictures.forEach((input, i) => { parts.push({ input: text(labels[i], width, 14), left: gap, top: y }); y += 26; parts.push({ input, left: gap, top: y }); y += sizes[i].height + gap; });
  await sharp({ create: { width, height: y, channels: 3, background: '#d9d6cf' } }).composite(parts).jpeg({ quality: 86 }).toFile(file);
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

const actorHas = (actor, pose) => `window.__hj.scene.casts.some((cast) => cast.character.el.dataset.actor === '${actor}' && cast.character.has('${pose}'))`;
const SCENE = {
  build: {
    loaded: (page) => page.waitForFunction(() => window.__hj.rachel?.has('reaction/rx_wink.png') && window.__hj.rachel.has('frame_04'), null, { timeout: 90000 }),
    busy: (page) => page.waitForTimeout(3000),
    spot: 'tiles', full: 'reaction/rx_K2.png',
  },
  grow: {
    loaded: (page) => page.waitForFunction(() => window.__hj.rachel?.has('thumbs_up#9') && window.__hj.rachel.has('look_up#0'), null, { timeout: 90000 }),
    busy: async (page) => {
      await page.evaluate(() => { window.__hj.poses.length = 0; });
      await page.waitForFunction(() => window.__hj.poses.some(([p], i, a) => p === 'mist_to_write#0' && a[i - 1]?.[0] === 'mist_to_write#1'), null, { timeout: 150000 });
      await page.waitForFunction(() => window.__hj.rachel.current === 'write_loop#6', null, { timeout: 90000 });
    },
    spot: 'door', full: 'look_up#3',
  },
  design: {
    loaded: (page) => page.waitForFunction(() => window.__hj.rachel?.has('R_K2_smile') && window.__hj.rachel.has('R_K1_blink'), null, { timeout: 90000 }),
    busy: (page) => page.waitForTimeout(5000),
    spot: 'window-seat', full: 'R_K2_smile',
  },
  film: {
    loaded: (page) => page.waitForFunction(`window.__hj.rachel?.has('R_K1_look') && ${actorHas('presenter', 'M_3_closed')}`, null, { timeout: 90000 }),
    busy: (page) => page.waitForTimeout(5000),
    spot: null, full: 'R_K1_look',
  },
  set: {
    // Her salute, and the last of the lamp's stills.
    loaded: (page) => page.waitForFunction(`window.__hj.rachel?.has('R_K1_salute') && ${actorHas('lamp', 'L_35')}`, null, { timeout: 90000 }),
    busy: (page) => page.waitForTimeout(5000),
    spot: null, full: 'R_K1_salute',
  },
};
/** The scene's hiding places not found yet, in FINDS' order (for this scene) or its own. */
const unfound = (page) => page.evaluate((finds) => {
  const scene = window.__hj.scene;
  const left = new Set([...document.querySelectorAll(`.hj-plate[data-scene="${scene.config.id}"] .hj-shroom`)].filter((b) => !b.disabled && !b.classList.contains('is-found')).map((b) => b.dataset.spot));
  const order = scene.config.id === 'set' ? finds : scene.config.spots.map((spot) => spot.id);
  return order.filter((id) => left.has(id));
}, FINDS);
/** Click a hiding place from inside the page (wherever the window is panned to), and say when, on the page's clock. */
const clickSpot = (page, id) => page.evaluate((spot) => { const at = performance.now(); document.querySelector(`.hj-plate [data-spot="${spot}"]`).click(); return Math.round(at * 10) / 10; }, id);
/** Bring a hiding place into the window, as a visitor would by panning. */
const panTo = (page, id) => page.evaluate((spot) => { const view = document.querySelector('.hj-viewport'); const r = document.querySelector(`.hj-plate [data-spot="${spot}"]`).getBoundingClientRect(); const v = view.getBoundingClientRect(); if (r.left < v.left + 4 || r.right > v.right - 4) view.scrollLeft += r.left + r.width / 2 - (v.left + v.width / 2); }, id);
/** A find, and her whole answer to it. Returns whether she played the full reaction. */
const find = async (page, spot, full, touch = true) => {
  spot ??= (await unfound(page))[0];
  await page.evaluate(() => { window.__mark = window.__hj.poses.length; });
  await page.evaluate((id) => { const view = document.querySelector('.hj-viewport'); const r = document.querySelector(`.hj-plate [data-spot="${id}"]`).getBoundingClientRect(); const v = view.getBoundingClientRect(); view.scrollLeft += r.left + r.width / 2 - (v.left + v.width / 2); }, spot);
  await page.waitForTimeout(250);
  if (touch) await page.locator(`.hj-plate [data-spot="${spot}"]`).tap({ force: true }); else await page.locator(`.hj-plate [data-spot="${spot}"]`).click({ force: true });
  await page.waitForFunction((pose) => window.__hj.poses.slice(window.__mark).some(([p]) => p === pose), full, { timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => !window.__hj.player.reacting, null, { timeout: 20000 });
  return page.evaluate((pose) => window.__hj.poses.slice(window.__mark).some(([p]) => p === pose), full);
};

/** Log every step of every actor of the scene on show: window.__steps[actor] = [pose, ms, fade, at]. */
const hookSteps = (page) => page.evaluate(() => {
  const w = (window.__steps = {});
  const scene = window.__hj.scene;
  for (const cast of scene.casts) {
    const name = cast.character.el.dataset.actor;
    w[name] = [];
    const player = scene.players.get(cast);
    const old = player.onStep;
    player.onStep = (step) => { w[name].push([step.pose, Math.round(step.ms), step.fade ?? 0, Math.round(performance.now() * 10) / 10]); old?.(step); };
  }
});
const stepsOf = (page, actor) => page.evaluate((name) => window.__steps[name], actor);
/** Steps with how long each was really shown (to the next step), from `from` on the page's clock. */
const shown = (steps, from = -Infinity, to = Infinity) => steps.map(([pose, ms, fade, at], i) => ({ pose, ms, fade, at, shown: steps[i + 1] ? r1(steps[i + 1][3] - at) : null })).filter((s) => s.at >= from && s.at <= to);
const routineOf = async () => JSON.parse(await readFile(`${pkg}site/routine.json`, 'utf8'));
const framesOf = async () => JSON.parse(await readFile(`${pkg}site/frames.json`, 'utf8'));
const walkOf = async () => JSON.parse(await readFile(`${pkg}site/stagehand/walk.json`, 'utf8'));
/** The page with a scene on show, ready, its cast loaded. */
const open = async (engine, options, query, id = ID) => {
  const browser = await launch(engine);
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = errorsOf(page);
  await page.goto(`${base}${query}#${id}`);
  await ready(page);
  await SCENE[id].loaded(page);
  return { browser, context, page, errors };
};

// ---- What the package draws (tools/theatre_preview.py, in sharp). ---------------------------------------------
/** The plate with the first k swaths over it (straight alpha-over, in order). */
const packageScene = async (k, extra = []) => {
  const frames = await framesOf();
  const swaths = frames.layers.filter((l) => l.hunt_progress !== undefined).sort((a, b) => a.hunt_progress - b.hunt_progress).slice(0, k);
  const layers = swaths.map((l) => ({ input: `${pkg}site/${frames.stills[l.stills[0]]}`, left: l.x, top: l.y }));
  return sharp(`${pkg}site/${frames.plate}`).ensureAlpha().composite([...layers, ...extra]).png().toBuffer();
};
/** The far boot, 15% darker (RGB × 0.85, alpha as it is), as the preview makes it. */
const darker = async (file) => {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) data[i + c] = Math.floor(data[i + c] * 0.85);
  return sharp(data, { raw: info }).png().toBuffer();
};
/**
 * The boots of one frame of a track, as a layer the size of the plate (RGBA, raw), kept inside the gap mask:
 * each sprite turned `rot` degrees clockwise about its bottom-centre, which is put at x, y; far boot first.
 */
const packageBoots = async (track, index) => {
  const walk = await walkOf();
  const t = walk[track];
  const sprite = `${pkg}site/stagehand/${t.sprite}.png`;
  const meta = await sharp(sprite).metadata();
  const parts = [];
  for (const boot of [...t.frames[index]].sort((a, b) => Number(b.far) - Number(a.far))) {
    const img = boot.far ? await darker(sprite) : await sharp(sprite).ensureAlpha().png().toBuffer();
    // Padded so the bottom-centre is the middle, then turned about the middle (the canvas grows, the middle stays).
    const padded = await sharp({ create: { width: meta.width, height: meta.height * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: img, left: 0, top: 0 }]).png().toBuffer();
    const turned = await sharp(padded).rotate(boot.rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const tm = await sharp(turned).metadata();
    parts.push({ input: turned, left: Math.round(boot.x - tm.width / 2), top: Math.round(boot.y - tm.height / 2) });
  }
  // Composite onto a margin-padded canvas (boots start off the plate), then cut the plate out.
  const M = 200;
  const layer = await sharp({ create: { width: PLATE.w + 2 * M, height: PLATE.h + 2 * M, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(parts.map((p) => ({ ...p, left: p.left + M, top: p.top + M })))
    .extract({ left: M, top: M, width: PLATE.w, height: PLATE.h }).raw().toBuffer();
  const [gx, gy] = walk.gap_mask_xy;
  const mask = await sharp(`${pkg}site/stagehand/gap_mask.png`).greyscale().raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < PLATE.h; y++) for (let x = 0; x < PLATE.w; x++) {
    const my = y - gy; const mx = x - gx;
    const m = my >= 0 && my < mask.info.height && mx >= 0 && mx < mask.info.width ? mask.data[my * mask.info.width + mx] / 255 : 0;
    layer[(y * PLATE.w + x) * 4 + 3] = Math.round(layer[(y * PLATE.w + x) * 4 + 3] * m);
  }
  return layer;
};
/** Alpha-weighted centre of an RGBA layer, inside a rectangle. */
const centroid = (data, width, [l, t, r, b]) => {
  let sx = 0; let sy = 0; let s = 0;
  for (let y = t; y < b; y++) for (let x = l; x < r; x++) { const a = data[(y * width + x) * 4 + 3]; sx += x * a; sy += y * a; s += a; }
  return s ? [sx / s, sy / s, s / 255] : null;
};
/** cubic-bezier(x1, y1, x2, y2) as y(x). */
const bezier = (x1, y1, x2, y2) => (x) => {
  const at = (t, a, b) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let lo = 0; let hi = 1;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (at(mid, x1, x2) < x) lo = mid; else hi = mid; }
  return at((lo + hi) / 2, y1, y2);
};
const EASE_OUT = bezier(0.23, 1, 0.32, 1);

const run = {};

// Screenshots, with no markers: Set Design on desktop, and on two phones as it opens and panned to each end;
// and the menu at 320 px, where its five tabs take two centred rows.
run.shots = async () => {
  const errors = [];
  const report = {};
  {
    const { browser, page, errors: e } = await open(chromium, { viewport: { width: 1440, height: 900 } }, '?debug&reset&intro=off&seed=7');
    await clean(page);
    await page.waitForTimeout(800);
    await sharp(await page.screenshot()).jpeg({ quality: 90 }).toFile(`${out}set-1440x900.jpg`);
    report['1440x900'] = { tabs: await page.evaluate(() => [...document.querySelectorAll('.hj-tab')].map((t) => t.textContent.trim())) };
    errors.push(...e);
    await browser.close();
  }
  const browser = await launch(webkit);
  for (const [w, h] of [[390, 844], [360, 740]]) {
    const page = await (await browser.newContext({ ...devices['iPhone 14'], viewport: { width: w, height: h } })).newPage();
    errors.push(...errorsOf(page));
    await page.goto(`${base}?debug&reset&intro=off&seed=7#${ID}`);
    await ready(page);
    await SCENE.set.loaded(page);
    await clean(page);
    await page.waitForTimeout(800);
    const seen = () => page.evaluate((W) => { const v = document.querySelector('.hj-viewport').getBoundingClientRect(); const p = document.querySelector('.hj-plate[data-scene="set"]').getBoundingClientRect(); return [Math.round(((v.left - p.left) / p.width) * W), Math.round(((v.right - p.left) / p.width) * W)]; }, PLATE.w);
    const rows = {};
    for (const pan of ['', '-left', '-right']) {
      if (pan) await page.evaluate((side) => { const v = document.querySelector('.hj-viewport'); v.scrollLeft = side === '-left' ? 0 : v.scrollWidth; }, pan);
      await page.waitForTimeout(400);
      await sharp(await page.screenshot()).jpeg({ quality: 90 }).toFile(`${out}set-${w}x${h}${pan}.jpg`);
      rows[pan || 'as it opens'] = await seen();
    }
    const [from, to] = rows['as it opens'];
    report[`${w}x${h}`] = { plateXShownAsItOpens: [from, to], theBriefAsks: 'centred on x 930: wide [554, 1306], tall [617, 1243]', allOfRachelsLayerIn: RACHEL[0] >= from && RACHEL[2] <= to, pannedLeft: rows['-left'], pannedRight: rows['-right'] };
    say(`set-${w}x${h}`, report[`${w}x${h}`]);
    await page.close();
  }
  // The menu at 320 px.
  {
    const page = await (await browser.newContext({ ...devices['iPhone 14'], viewport: { width: 320, height: 640 } })).newPage();
    errors.push(...errorsOf(page));
    await page.goto(`${base}?debug&reset&intro=off&seed=7#${ID}`);
    await ready(page);
    await SCENE.set.loaded(page);
    await clean(page);
    await page.waitForTimeout(800);
    await sharp(await page.screenshot({ fullPage: true })).jpeg({ quality: 90 }).toFile(`${out}set-320x640-menu.jpg`);
    const menu = await page.evaluate(() => {
      const m = document.querySelector('.hj-menu');
      const mr = m.getBoundingClientRect();
      const tabs = [...m.querySelectorAll('.hj-tab')].map((t) => {
        const b = t.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(t);
        const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
        return { tab: t.textContent.trim(), left: Math.round(b.left), right: Math.round(b.right), top: Math.round(b.top), heightPx: Math.round(b.height * 10) / 10, linesOfText: lines.size, cut: b.left < mr.left - 0.5 || b.right > mr.right + 0.5 || t.scrollWidth > t.clientWidth + 1 };
      });
      const rowsAt = [...new Set(tabs.map((t) => t.top))].sort((a, b) => a - b);
      const centred = rowsAt.map((top) => { const inRow = tabs.filter((t) => t.top === top); const l = Math.min(...inRow.map((t) => t.left)); const r = Math.max(...inRow.map((t) => t.right)); return Math.round(((l - mr.left) - (mr.right - r)) * 10) / 10; });
      return { rows: rowsAt.length, tabs, leftMinusRightSpaceEachRowPx: centred, menuScrollsSideways: m.scrollWidth > m.clientWidth + 1, pageScrollsSideways: document.documentElement.scrollWidth > window.innerWidth, menuHeightPx: Math.round(mr.height) };
    });
    menu.ok = !menu.menuScrollsSideways && !menu.pageScrollsSideways && menu.tabs.every((t) => !t.cut && t.heightPx >= 44 && t.linesOfText === 1) && menu.tabs.find((t) => t.tab === 'Set Design')?.linesOfText === 1;
    report['320x640 menu'] = menu;
    say('menu at 320x640', { rows: menu.rows, tabs: menu.tabs.map((t) => `${t.tab} ${t.heightPx}px ${t.linesOfText} line`), centring: menu.leftMinusRightSpaceEachRowPx, scrolls: menu.menuScrollsSideways || menu.pageScrollsSideways, ok: menu.ok });
    await page.close();
  }
  await browser.close();
  report.errors = errors;
  await save('shots.json', report);
  say('console errors', errors.length ? errors : 'none');
};

// The backdrop, stage by stage.
//   1. The page at 0…10 found (`?found=k`), held still, mushrooms, Rachel and the lamp hidden: the screen,
//      at exactly one device pixel per plate pixel, against a straight alpha-over of plate.png and P_01…P_k.
//      Compared inside COMPARED (the backdrop clear of the edge's reach and of the gap under the hem). Also
//      against the page's own plate (room.webp) under the package's swaths, which separates what the plate's
//      own encoding adds from what the swaths add.
//   2. What the page holds: the swaths' canvas (plate px) put over the plate here, against the package's
//      swaths put over the plate: the canvas's own drawing, to the level.
//   3. One page, ten finds: the stage moves on one at a time, each fading in and then baked.
run.stages = async () => {
  const frames = await framesOf();
  const report = { compared: { platePx: COMPARED, why: 'the backdrop (x 929-1529, y 0-562), less the top 160 px (the edge\'s top strip is 152 px deep), less x 1460 on (the edge can reach 210 px in from the right rim), less y 552 on (the gap under the hem starts at 554)' }, stages: [] };
  const browser = await launch(chromium);
  // The plate's width in CSS px at 1440 × 900, so that a device scale makes it exactly 1672 device px.
  let cssW;
  {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await page.goto(`${base}?debug&reset&intro=off&seed=7#${ID}`);
    await ready(page);
    cssW = await page.evaluate(() => document.querySelector('.hj-plate[data-scene="set"]').getBoundingClientRect().width);
    await page.close();
  }
  const scale = PLATE.w / cssW;
  const room = await sharp(new URL('../../public/assets/scene5/room.webp', import.meta.url).pathname).ensureAlpha().png().toBuffer();
  const swathLayers = (k) => frames.layers.filter((l) => l.hunt_progress !== undefined).sort((a, b) => a.hunt_progress - b.hunt_progress).slice(0, k).map((l) => ({ input: `${pkg}site/${frames.stills[l.stills[0]]}`, left: l.x, top: l.y }));
  const [cl, ct, cr, cb] = COMPARED;
  const cw = cr - cl; const ch = cb - ct;
  const crop = (buffer) => sharp(buffer).extract({ left: cl, top: ct, width: cw, height: ch }).removeAlpha().raw().toBuffer();
  const stats = (a, b) => {
    const diffs = new Float32Array(cw * ch);
    let worst = { d: 0, x: 0, y: 0 };
    for (let i = 0; i < cw * ch; i++) {
      const d = (Math.abs(a[i * 3] - b[i * 3]) + Math.abs(a[i * 3 + 1] - b[i * 3 + 1]) + Math.abs(a[i * 3 + 2] - b[i * 3 + 2])) / 3;
      diffs[i] = d;
      if (d > worst.d) worst = { d, x: cl + (i % cw), y: ct + Math.floor(i / cw) };
    }
    const sorted = Float32Array.from(diffs).sort();
    return { mean: r2(diffs.reduce((s, d) => s + d, 0) / diffs.length), p99: r1(sorted[Math.floor(sorted.length * 0.99)]), largest: r1(worst.d), largestAt: [worst.x, worst.y], diffs };
  };
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: scale })).newPage();
  const errors = errorsOf(page);
  const sheet = [];
  const pairs = [];
  for (let k = 0; k <= 10; k++) {
    await page.goto(`${base}?debug&reset&intro=off&seed=7&found=${k}#${ID}`);
    await ready(page);
    await SCENE.set.loaded(page);
    await page.waitForFunction((n) => window.__hj.scene.progress?.state.baked === n, k, { timeout: 20000 });
    await page.evaluate(() => {
      window.__hj.scene.hold();
      document.querySelectorAll('.hj-mushrooms').forEach((el) => { el.style.visibility = 'hidden'; });
      document.querySelectorAll('.hj-plate[data-scene="set"] [data-actor]').forEach((el) => { el.style.visibility = 'hidden'; });
    });
    await page.waitForTimeout(250);
    const box = await page.locator('.hj-plate[data-scene="set"]').boundingBox();
    const shot = await page.screenshot({ clip: box });
    const meta = await sharp(shot).metadata();
    const mine = meta.width === PLATE.w && meta.height === PLATE.h ? shot : await sharp(shot).resize(PLATE.w, PLATE.h, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
    const theirs = await sharp(`${pkg}site/${frames.plate}`).ensureAlpha().composite(swathLayers(k)).png().toBuffer();
    const theirsOnWebp = await sharp(room).composite(swathLayers(k)).png().toBuffer();
    const a = await crop(mine);
    const vsPackage = stats(a, await crop(theirs));
    const vsRoomWebp = stats(a, await crop(theirsOnWebp));
    // 2. The swaths' canvas, read back, over the plate here.
    const canvas = await page.evaluate(() => { const c = window.__hj.scene.progress.el; return { w: c.width, h: c.height, data: c.width ? [...c.getContext('2d').getImageData(0, 0, c.width, c.height).data] : [] }; });
    let held = null;
    if (canvas.w) {
      const layer = await sharp(Buffer.from(canvas.data), { raw: { width: canvas.w, height: canvas.h, channels: 4 } }).png().toBuffer();
      const left = Math.min(...frames.layers.filter((l) => l.hunt_progress !== undefined).map((l) => l.x));
      const top = Math.min(...frames.layers.filter((l) => l.hunt_progress !== undefined).map((l) => l.y));
      const pageHeld = await sharp(`${pkg}site/${frames.plate}`).ensureAlpha().composite([{ input: layer, left, top }]).png().toBuffer();
      const s = stats(await crop(pageHeld), await crop(theirs));
      held = { mean: s.mean, p99: s.p99, largest: s.largest };
    }
    // Differences ×8, for looking for seams and pale islands.
    const amp = Buffer.alloc(cw * ch * 3);
    for (let i = 0; i < cw * ch; i++) { const v = Math.min(255, Math.round(vsPackage.diffs[i] * 8)); amp[i * 3] = v; amp[i * 3 + 1] = v; amp[i * 3 + 2] = v; }
    const ampPng = await sharp(amp, { raw: { width: cw, height: ch, channels: 3 } }).png().toBuffer();
    const stage = { found: k, screenPx: [meta.width, meta.height], onTheScreenVsPlatePngAndSwaths: { mean: vsPackage.mean, p99: vsPackage.p99, largest: vsPackage.largest, largestAt: vsPackage.largestAt }, onTheScreenVsRoomWebpAndSwaths: { mean: vsRoomWebp.mean, p99: vsRoomWebp.p99, largest: vsRoomWebp.largest }, theSwathsCanvasOverThePlate: held, progressState: await page.evaluate(() => window.__hj.scene.progress.state), underOneLevel: vsPackage.mean < 1 };
    report.stages.push(stage);
    say(`stage ${k}`, { mean: vsPackage.mean, p99: vsPackage.p99, largest: vsPackage.largest, at: vsPackage.largestAt, vsRoomWebp: vsRoomWebp.mean, canvas: held?.mean ?? '-', screen: stage.screenPx });
    sheet.push(await sharp(mine).extract({ left: 860, top: 0, width: 760, height: 600 }).resize({ width: 380 }).png().toBuffer());
    if ([1, 5, 10].includes(k)) {
      const cutOf = (buf) => sharp(buf).extract({ left: cl, top: ct, width: cw, height: ch }).resize({ width: 420 }).png().toBuffer();
      pairs.push(await cutOf(mine), await cutOf(theirs), await sharp(ampPng).resize({ width: 420 }).png().toBuffer());
    }
  }
  for (let i = 0; i < sheet.length; i += 6) await row(`The backdrop on the page at ${i} to ${Math.min(10, i + 5)} found (the right part of the plate; Rachel and the lamp hidden)`, sheet.slice(i, i + 6), `${out}stages-${i === 0 ? '0-5' : '6-10'}.jpg`, 8);
  for (let i = 0; i < pairs.length; i += 3) await row(`At ${[1, 5, 10][i / 3]} found, inside the compared area: the page | plate.png + the swaths | the difference ×8`, pairs.slice(i, i + 3), `${out}stages-compare-${[1, 5, 10][i / 3]}.jpg`, 8);
  await page.close();

  // 3. One page, ten finds.
  {
    const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    errors.push(...errorsOf(p));
    await p.goto(`${base}?debug&reset&intro=off&seed=7&found=0#${ID}`);
    await ready(p);
    await SCENE.set.loaded(p);
    await p.waitForTimeout(600);
    const steps = [];
    for (const spot of FINDS) {
      await p.evaluate(() => { window.__sawFade = 0; const tick = () => { if (document.querySelector('.hj-progress.is-fading')) window.__sawFade++; if (!window.__stopFade) requestAnimationFrame(tick); }; window.__stopFade = false; requestAnimationFrame(tick); });
      await clickSpot(p, spot);
      await p.waitForTimeout(1200);
      const s = await p.evaluate(() => { window.__stopFade = true; return { state: window.__hj.scene.progress.state, overlaysLeft: document.querySelectorAll('.hj-progress.is-fading').length, framesWithAFade: window.__sawFade }; });
      steps.push({ spot, ...s });
      await p.waitForFunction(() => !window.__hj.player.reacting, null, { timeout: 20000 });
    }
    report.oneByOne = { steps, ok: steps.every((s, i) => s.state.shown === i + 1 && s.state.baked === i + 1 && s.overlaysLeft === 0 && s.framesWithAFade > 10) };
    say('one page, ten finds', steps.map((s) => `${s.state.shown}/${s.state.baked}, fade seen ${s.framesWithAFade} frames, overlays left ${s.overlaysLeft}`).join('; '));
    await p.close();
  }
  await browser.close();
  report.errors = errors;
  report.allUnderOneLevel = report.stages.every((s) => s.underOneLevel);
  await save('stages.json', report);
  say('stages', { allUnderOneLevel: report.allUnderOneLevel, oneByOne: report.oneByOne.ok, errors });
};

// One find's swath fading in, read every frame: when the overlay appears (against her salute's first step),
// its opacity frame by frame, how long it lasts, how it eases (against cubic-bezier(0.23, 1, 0.32, 1)), that
// it never goes back; and at its end, the screen just before the bake and just after (the animation is held
// at its last moment, screenshot, then let finish: baked, screenshot). With reduced motion: no fade.
run.fade = async () => {
  const report = [];
  for (const [name, engine, options] of [['chrome, 1440 × 900', chromium, { viewport: { width: 1440, height: 900 } }], ['webkit, iPhone 14 profile', webkit, phone], ['chrome, reduced motion', chromium, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }]]) {
    const { browser, page, errors } = await open(engine, options, '?debug&reset&intro=off&seed=7&found=2');
    await clean(page);
    await hookSteps(page);
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const s = (window.__fade = { rows: [], stop: false });
      const tick = (now) => {
        const o = document.querySelector('.hj-progress.is-fading');
        s.rows.push([Math.round(now * 10) / 10, o ? Number(getComputedStyle(o).opacity) : -1, window.__hj.scene.progress.state.baked]);
        if (!s.stop) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const spot = (await unfound(page))[0];
    await panTo(page, spot);
    const t0 = await clickSpot(page, spot);
    await page.waitForTimeout(1300);
    const rows = await page.evaluate(() => { window.__fade.stop = true; return window.__fade.rows; });
    const salute = (await stepsOf(page, 'rachel')).find(([p, , , at]) => p === 'R_K1_salute' && at >= t0);
    const fading = rows.filter((r) => r[1] >= 0 && r[0] >= t0);
    const rowOut = { browser: name, findAt: t0, saluteAt: salute?.[3] ?? null };
    if (options.reducedMotion) {
      const bakedAt = rows.find((r) => r[0] >= t0 && r[2] === 3);
      rowOut.noFade = fading.length === 0;
      rowOut.swathBakedMsAfterTheFind = bakedAt ? r1(bakedAt[0] - t0) : null;
    } else {
      const first = fading[0];
      const end = rows.find((r) => r[0] > first[0] && r[1] < 0);
      const span = (end?.[0] ?? fading.at(-1)[0]) - first[0];
      const at = (frac) => { const t = first[0] + frac * 700; const near = fading.reduce((a, b) => (Math.abs(b[0] - t) < Math.abs(a[0] - t) ? b : a)); return { atMs: r1(near[0] - first[0]), opacity: r2(near[1]), curve: r2(EASE_OUT((near[0] - first[0]) / 700)) }; };
      const drops = fading.filter((r, i) => i > 0 && r[1] < fading[i - 1][1] - 0.001).length;
      rowOut.overlayFirstSeenMsAfterTheFind = r1(first[0] - t0);
      rowOut.overlayFirstSeenMsAfterHerSalute = salute ? r1(first[0] - salute[3]) : null;
      rowOut.startsWithinAFrameOfHerSalute = salute ? Math.abs(first[0] - salute[3]) <= 20 : null;
      rowOut.fadeShownMs = r1(span);
      rowOut.lasts700msGiveOrTakeAFrame = Math.abs(span - 700) <= 25;
      rowOut.easing = { at25: at(0.25), at50: at(0.5), at75: at(0.75) };
      rowOut.easesOut = [0.25, 0.5, 0.75].every((f) => Math.abs(at(f).opacity - at(f).curve) <= 0.08);
      rowOut.neverDropsBack = drops === 0;
      rowOut.firstOpacities = fading.slice(0, 8).map((r) => r2(r[1]));
      rowOut.bakedAfter = rows.at(-1)[2];
      // The bake, held still: a fourth find, its animation paused at its last moment.
      await page.waitForFunction(() => !window.__hj.player.reacting, null, { timeout: 20000 });
      const next = (await unfound(page))[0];
      await panTo(page, next);
      await page.evaluate((id) => { window.__hj.scene.hold(); document.querySelector(`.hj-plate [data-spot="${id}"]`).click(); }, next);
      await page.waitForFunction(() => document.querySelector('.hj-progress.is-fading')?.getAnimations().length > 0, null, { timeout: 5000 });
      await page.evaluate(() => { const a = document.querySelector('.hj-progress.is-fading').getAnimations()[0]; a.pause(); a.currentTime = 699.5; document.querySelectorAll('[data-actor]').forEach((el) => { el.style.visibility = 'hidden'; }); document.querySelectorAll('.hj-mushrooms').forEach((el) => { el.style.visibility = 'hidden'; }); });
      await page.waitForTimeout(150);
      const box = await page.evaluate(() => { const r = document.querySelector('.hj-progress.is-fading').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
      const before = await page.screenshot({ clip: box });
      await page.evaluate(() => document.querySelector('.hj-progress.is-fading').getAnimations()[0].finish());
      await page.waitForFunction(() => !document.querySelector('.hj-progress.is-fading'), null, { timeout: 5000 });
      await page.waitForTimeout(150);
      const after = await page.screenshot({ clip: box });
      const a = await sharp(before).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const b = await sharp(after).removeAlpha().raw().toBuffer();
      let sum = 0; let worst = 0;
      for (let i = 0; i < a.data.length; i += 3) { const d = (Math.abs(a.data[i] - b[i]) + Math.abs(a.data[i + 1] - b[i + 1]) + Math.abs(a.data[i + 2] - b[i + 2])) / 3; sum += d; worst = Math.max(worst, d); }
      rowOut.theBake = { meanDifferenceOutOf255: r2(sum / (a.data.length / 3)), largest: r1(worst), noPop: sum / (a.data.length / 3) < 1, stateAfter: await page.evaluate(() => window.__hj.scene.progress.state) };
      await row(`${name}: the swath just before it is baked (its fade held at 699.5 ms) | just after`, [await sharp(before).resize({ height: 300 }).png().toBuffer(), await sharp(after).resize({ height: 300 }).png().toBuffer()], `${out}fade-bake-${name.startsWith('webkit') ? 'webkit' : 'chrome'}.jpg`);
    }
    rowOut.errors = errors;
    report.push(rowOut);
    say(name, rowOut);
    await browser.close();
  }
  await save('fade.json', report);
};

// Her routine and her answer, and the lamp. Chrome, the iPhone profile in WebKit, and Chrome with reduced
// motion.
//   - A find during the lean (R_B1_lean) and one during a stroke (R_A3_stroke_out): she cuts straight to
//     R_K1_salute, within a frame; K1 1.7 to 2.1 s; R_A1 400 ms; back to her loop.
//   - A second find 800 ms into the salute: the salute is held longer, and she does not cut in again.
//   - A minute of her routine: the paint loop A1 > A2 > A3 > A2, three to six times, then A1, the lean (2 to
//     3 s), A1, the dip, A1. Blinks: R_A1_blink, 100 ms, only on R_A1 holds, every 3 to 6 s.
//   - The lamp: L_00 to L_35, 100 ms each, round and round, L_35 > L_00 like any other step.
//   - Reduced motion: one held salute; the lamp holds L_00; no walk in 30 s; a swath appears without a fade.
run.react = async () => {
  const routine = (await routineOf()).actors;
  const report = [];
  for (const [name, engine, options] of [['chrome, 1440 × 900', chromium, { viewport: { width: 1440, height: 900 } }], ['webkit, iPhone 14 profile', webkit, phone], ['chrome, reduced motion', chromium, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }]]) {
    const { browser, page, errors } = await open(engine, options, '?debug&reset&intro=off&seed=7');
    await hookSteps(page);
    const t00 = await page.evaluate(() => performance.now());
    const rowOut = { browser: name };
    const settled = () => page.waitForFunction(() => !window.__hj.player.reacting, null, { timeout: 20000 });
    const hers = async (from) => shown(await stepsOf(page, 'rachel'), from);
    const line = (steps, t0) => steps.map((s) => `${r1(s.at - t0)} ms: ${s.pose}${s.shown === null ? '' : `, shown ${s.shown} ms`}`);
    // A find on the frame a pose is first seen, a little into it.
    const findDuring = async (pose, into) => page.evaluate(({ pose, into }) => new Promise((resolve) => {
      const t0 = performance.now();
      let since = null;
      const tick = () => {
        const s = window.__steps.rachel;
        if (s.at(-1)?.[0] === pose) since ??= s.at(-1)[3]; else since = null;
        if (since !== null && performance.now() - since >= into && !window.__hj.player.reacting) {
          const spot = [...document.querySelectorAll('.hj-plate[data-scene="set"] .hj-shroom')].find((b) => !b.disabled && !b.classList.contains('is-found'));
          const at = performance.now(); spot.click(); resolve({ at: Math.round(at * 10) / 10, spot: spot.dataset.spot }); return;
        }
        if (performance.now() - t0 > 60000) { resolve(null); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }), { pose, into });
    if (!options.reducedMotion) {
      for (const [label, pose, into] of [['aFindDuringTheLean', 'R_B1_lean', 600], ['aFindDuringAStroke', 'R_A3_stroke_out', 120]]) {
        const f = await findDuring(pose, into);
        if (!f) { rowOut[label] = { failed: `${pose} not seen in 60 s` }; continue; }
        await settled();
        await page.waitForTimeout(700);
        const steps = await hers(f.at - 2000);
        const before = steps.findLast((s) => s.at <= f.at);
        const after = steps.filter((s) => s.at >= f.at);
        const k1 = after.find((s) => s.pose === 'R_K1_salute');
        const k1i = after.indexOf(k1);
        rowOut[label] = {
          wasOn: before ? `${before.pose}, ${r1(f.at - before.at)} ms into it` : null, thenShe: line(after.slice(0, 5), f.at),
          msFromTheFindToTheSalute: k1 ? r1(k1.at - f.at) : null, withinAFrame: k1 ? k1.at - f.at <= 20 && k1i === 0 : false,
          saluteShownMs: k1?.shown ?? null, saluteInRange: k1 ? k1.shown >= 1700 - 30 && k1.shown <= 2100 + 45 : false,
          thenR_A1Ms: after[k1i + 1]?.pose === 'R_A1' ? after[k1i + 1].shown : null,
        };
      }
      // A second find, 800 ms into the salute.
      await page.waitForTimeout(1500);
      const left = await unfound(page);
      const tA = await clickSpot(page, left[0]);
      await page.waitForFunction(() => window.__hj.rachel.current === 'R_K1_salute', null, { timeout: 5000 });
      await page.waitForTimeout(800);
      const tB = await clickSpot(page, left[1]);
      await settled();
      await page.waitForTimeout(800);
      const two = await hers(tA);
      const salutes = two.filter((s) => s.pose === 'R_K1_salute');
      const from = salutes[0]?.at; const to = salutes.length ? salutes.at(-1).at + salutes.at(-1).shown : null;
      rowOut.aSecondFindDuringTheSalute = { secondFindMsIntoIt: from ? r1(tB - from) : null, thenShe: line(two.slice(0, 5), tA), saluteShownMsInAll: from ? r1(to - from) : null, msAfterTheSecondFind: to ? r1(to - tB) : null, cutInOnce: salutes.length >= 1 && two.slice(0, two.findIndex((s) => s.pose !== 'R_K1_salute' && s.at > from)).every((s) => s.pose === 'R_K1_salute'), extended: to !== null && to - tB >= 1700 - 30 };
      // A minute of her routine (from where the log began, skipping the finds' answers), and 30 s of the lamp.
      await page.waitForTimeout(Math.max(0, 62000 - ((await page.evaluate(() => performance.now())) - t00)));
      const all = shown(await stepsOf(page, 'rachel')).filter((s) => s.shown !== null);
      const reactions = [];
      all.forEach((s, i) => { if (s.pose === 'R_K1_salute') reactions.push([s.at - 50, (all[i + 2]?.at ?? s.at + 3000) + 10]); });
      const loopOnly = all.filter((s) => !reactions.some(([a, b]) => s.at >= a && s.at <= b));
      const range = {};
      for (const item of routine.rachel.routine) for (const step of item.steps ?? [item]) { const [lo, hi] = Array.isArray(step.ms) ? step.ms : [step.ms, step.ms]; range[step.still] = [Math.min(range[step.still]?.[0] ?? Infinity, lo), Math.max(range[step.still]?.[1] ?? 0, hi)]; }
      // Blinks folded back into the hold they are in.
      const folded = [];
      for (const s of loopOnly) {
        const last = folded.at(-1);
        if (s.pose === 'R_A1_blink' || (last?.pose === 'R_A1' && last.blinked && s.pose === 'R_A1')) { if (last) { last.total += s.shown; if (s.pose === 'R_A1_blink') last.blinked = (last.blinked ?? 0) + 1; } continue; }
        folded.push({ pose: s.pose, total: s.shown, at: s.at, blinked: 0 });
      }
      const seq = folded.map((s) => s.pose).join(' ');
      const loops = [...seq.matchAll(/((R_A1 R_A2_stroke_low R_A3_stroke_out R_A2_stroke_low ?)+)R_A1 R_B1_lean R_A1 R_B2_dip R_A1/g)].map((m) => m[1].trim().split(' ').length / 4);
      const outOfRange = folded.slice(1, -1).filter((s) => range[s.pose] && !(s.blinked) && (s.total < range[s.pose][0] - 30 || s.total > range[s.pose][1] + 45)).map((s) => `${s.pose} ${s.total} ms`);
      const blinkSteps = loopOnly.map((s, i) => ({ ...s, before: loopOnly[i - 1]?.pose, after: loopOnly[i + 1]?.pose })).filter((s) => s.pose === 'R_A1_blink');
      const gaps = blinkSteps.slice(1).map((b, i) => r1(b.at - blinkSteps[i].at));
      const leans = folded.filter((s) => s.pose === 'R_B1_lean').map((s) => s.total);
      rowOut.aMinuteOfHerRoutine = {
        seconds: r1((all.at(-1).at - all[0].at) / 1000), passesSeen: loops.length, paintLoopsPerPass: loops, leanMs: leans, dipMs: folded.filter((s) => s.pose === 'R_B2_dip').map((s) => s.total),
        holdsOutsideTheirRange: outOfRange,
        blinks: { count: blinkSteps.length, shownMs: blinkSteps.map((b) => b.shown), onlyOnR_A1: blinkSteps.every((b) => b.before === 'R_A1' && b.after === 'R_A1'), gapsMs: gaps },
        anyDissolve: all.some((s) => s.fade > 0),
        ok: loops.length >= 1 && loops.every((n) => n >= 3 && n <= 6) && leans.every((ms) => ms >= 2000 - 30 && ms <= 3000 + 45) && outOfRange.length === 0 && blinkSteps.every((b) => b.before === 'R_A1' && b.after === 'R_A1' && Math.abs(b.shown - 100) <= 25),
      };
    } else {
      const f = await clickSpot(page, (await unfound(page))[0]);
      await settled();
      await page.waitForTimeout(600);
      const one = await hers(f);
      rowOut.aFind = { thenShe: line(one.slice(0, 4), f), oneHeldSalute: one.filter((s) => s.pose === 'R_K1_salute').length === 1, saluteShownMs: one.find((s) => s.pose === 'R_K1_salute')?.shown ?? null, swathFadedIn: false };
      // No walk in 30 s, the lamp still, and a swath that appears without a fade.
      await page.evaluate(() => { window.__rm = { walking: 0, fading: 0, frames: 0, lamp: new Set() }; const tick = () => { const w = window.__hj.scene.walks?.[0]; if (w?.now.walking) window.__rm.walking++; if (document.querySelector('.hj-progress.is-fading')) window.__rm.fading++; window.__rm.lamp.add(window.__hj.scene.casts.find((c) => c.character.el.dataset.actor === 'lamp').character.current); window.__rm.frames++; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
      await clickSpot(page, (await unfound(page))[0]);
      await page.waitForTimeout(30000);
      const rm = await page.evaluate(() => ({ framesRead: window.__rm.frames, framesWithAWalk: window.__rm.walking, framesWithAFade: window.__rm.fading, lampPoses: [...window.__rm.lamp] }));
      rowOut.thirtySeconds = { ...rm, noWalk: rm.framesWithAWalk === 0, noFade: rm.framesWithAFade === 0, lampHoldsL_00: rm.lampPoses.length === 1 && rm.lampPoses[0] === 'L_00', swathsBaked: await page.evaluate(() => window.__hj.scene.progress.state) };
    }
    // The lamp, over the whole log (30 s at least).
    const lamp = shown(await stepsOf(page, 'lamp')).filter((s) => s.shown !== null);
    if (!options.reducedMotion) {
      const order = lamp.map((s) => s.pose);
      const next = (p) => `L_${String((Number(p.slice(2)) + 1) % 36).padStart(2, '0')}`;
      const wraps = lamp.filter((s, i) => i > 0 && lamp[i - 1].pose === 'L_35');
      const sorted = lamp.map((s) => s.shown).sort((a, b) => a - b);
      rowOut.theLamp = { steps: lamp.length, seconds: r1((lamp.at(-1).at - lamp[0].at) / 1000), inOrder: order.every((p, i) => i === 0 || p === next(order[i - 1])), shortestMs: sorted[0], longestMs: sorted.at(-1), meanMs: r1(sorted.reduce((a, b) => a + b, 0) / sorted.length), wrapsL35toL00: wraps.length, wrapStepMs: wraps.map((s) => lamp[lamp.indexOf(s) - 1].shown), ok: order.every((p, i) => i === 0 || p === next(order[i - 1])) && sorted.at(-1) <= 100 + 40 && Math.abs(sorted.reduce((a, b) => a + b, 0) / sorted.length - 100) <= 3 };
    }
    rowOut.posesSheMissed = await page.evaluate(() => window.__hj.rachel.missed);
    rowOut.errors = errors;
    report.push(rowOut);
    say(name, rowOut);
    await browser.close();
  }
  await save('react.json', report);
};

// The stagehand's boots.
//   1. The schedule, with the routine's own timing: the first walk 8 to 15 s after the scene starts working,
//      rtl (137 frames at 30 fps), a wait of 10 to 15 s, ltr, then a wait of 40 to 70 s. Paused mid-walk the
//      frame holds and carries on from it; switching away and back starts again from the first wait; with
//      reduced motion there is no walk.
//   2. Timing: the track frame against the time since the walk began, every page frame.
//   3. At 1:1: frames 10, 40, 70, 100, 130 of each walk, the walk's canvas read back against the same frame
//      put together from the package as theatre_preview.py does; and on screen at device scale 1 and 2.
//   4. Never outside the gap: every frame of a whole rtl and ltr walk, every boot pixel of the canvas is where
//      the gap mask is set; and on screen, the pixels the mask leaves out of the gap band (the ladder's feet,
//      the pots, the cart) are the same during a walk as without it.
run.walk = async () => {
  const walk = await walkOf();
  const routine = (await routineOf()).actors.stagehand;
  const report = {};
  const errors = [];
  const sampler = (page) => page.evaluate(() => { const s = (window.__w = { rows: [], stop: false }); const tick = (now) => { const w = window.__hj.scene?.walks?.[0]; if (w) s.rows.push([Math.round(now * 10) / 10, w.now.walking ?? null, w.now.frame ?? null, w.now.waiting ?? null, window.__hj.scene.config.id]); if (!s.stop) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  const rowsOf = (page) => page.evaluate(() => window.__w.rows);
  {
    const { browser, page, errors: e } = await open(chromium, { viewport: { width: 1440, height: 900 } }, '?debug&reset&intro=off&seed=7&found=3');
    errors.push(...e);
    await sampler(page);
    // (The scene is at work from ready on: the walk's first wait is rolled on its first frame.)
    const workingAt = await page.evaluate(() => performance.now());
    await page.waitForFunction(() => { const r = window.__w.rows; const i = r.findIndex((x) => x[1] === 'ltr'); return i >= 0 && r.slice(i).some((x) => x[3] !== null); }, null, { timeout: 70000 });
    const rows = await rowsOf(page);
    const firstWalk = rows.find((r) => r[1] === 'rtl');
    const rtlEnd = rows.find((r) => r[0] > firstWalk[0] && r[1] === null);
    const ltr = rows.find((r) => r[1] === 'ltr');
    const ltrEnd = rows.find((r) => r[0] > ltr[0] && r[1] === null);
    const waitBack = rows.find((r) => r[0] > firstWalk[0] && r[1] === null && r[3] !== null);
    const firstWaitRolled = rows.find((r) => r[3] !== null);
    report.schedule = {
      firstWalkSAfterTheSceneStartedWorking: r1((firstWalk[0] - workingAt) / 1000), firstWaitRolledMs: firstWaitRolled?.[3],
      rtlLastsMs: r1(rtlEnd[0] - firstWalk[0]), waitBeforeLtrRolledMs: waitBack?.[3], ltrStartsSAfterRtlEnds: r1((ltr[0] - rtlEnd[0]) / 1000), ltrLastsMs: r1(ltrEnd[0] - ltr[0]), waitAfterLtrRolledMs: ltrEnd[3],
      trackMs: r1((walk.rtl.frames.length / walk.rtl.fps) * 1000), routine: { first_ms: routine.first_ms, return_after_ms: routine.return_after_ms, every_ms: routine.every_ms },
    };
    const s = report.schedule;
    s.ok = s.firstWalkSAfterTheSceneStartedWorking >= 8 - 0.5 && s.firstWalkSAfterTheSceneStartedWorking <= 15 + 1 && Math.abs(s.rtlLastsMs - s.trackMs) <= 40 && s.ltrStartsSAfterRtlEnds >= 10 - 0.1 && s.ltrStartsSAfterRtlEnds <= 15 + 0.2 && Math.abs(s.ltrLastsMs - s.trackMs) <= 40 && s.waitAfterLtrRolledMs >= 40000 - 100 && s.waitAfterLtrRolledMs <= 70000;
    // 2. Timing, over both walks.
    const timing = (dir, start) => {
      const r = rows.filter((x) => x[1] === dir && x[0] >= start[0] && x[0] < start[0] + 5000);
      let skips = 0; let maxRepeat = 1; let rep = 1; let off = 0;
      r.forEach((x, i) => { const expected = Math.floor(((x[0] - r[0][0]) * walk[dir].fps) / 1000) + r[0][2]; off = Math.max(off, Math.abs(x[2] - expected)); if (i) { if (x[2] - r[i - 1][2] > 1) skips++; if (x[2] === r[i - 1][2]) { rep++; maxRepeat = Math.max(maxRepeat, rep); } else rep = 1; } });
      return { pageFrames: r.length, trackFramesSeen: new Set(r.map((x) => x[2])).size, skippedTrackFrames: skips, mostPageFramesOnOneTrackFrame: maxRepeat, mostFramesOffTheClock: off };
    };
    report.timing = { rtl: timing('rtl', firstWalk), ltr: timing('ltr', ltr) };
    say('schedule', report.schedule);
    say('timing', report.timing);
    // Pause mid-walk, then play.
    await page.evaluate(() => window.__hj.scene.walks[0].walkNow('rtl'));
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Pause animation' }).click();
    const p0 = await page.evaluate(() => window.__hj.scene.walks[0].now);
    await page.waitForTimeout(1500);
    const p1 = await page.evaluate(() => window.__hj.scene.walks[0].now);
    await page.getByRole('button', { name: 'Play animation' }).click();
    await page.waitForTimeout(300);
    const p2 = await page.evaluate(() => window.__hj.scene.walks[0].now);
    report.pause = { atPause: p0, after1500msPaused: p1, after300msPlaying: p2, holds: p0.frame === p1.frame, carriesOn: p2.walking === 'rtl' && p2.frame > p1.frame && p2.frame - p1.frame <= 12 };
    // Away and back.
    await page.locator('.hj-tab[data-scene="build"]').click();
    await arrived(page, 'build');
    await page.waitForTimeout(1500);
    await page.locator('.hj-tab[data-scene="set"]').click();
    await arrived(page, 'set');
    await page.waitForTimeout(400);
    const back = await page.evaluate(() => ({ now: window.__hj.scene.walks[0].now, canvasEmpty: (() => { const c = window.__hj.scene.walks[0].el; if (!c.width) return true; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return false; return true; })() }));
    report.awayAndBack = { ...back, startsAgainFromTheFirstWait: back.now.waiting !== undefined && back.now.waiting > 7000 && back.now.waiting <= 15000 };
    say('pause, away and back', { pause: report.pause, awayAndBack: report.awayAndBack });
    await browser.close();
  }
  // Reduced motion: 20 s, and a walk asked for by hand.
  {
    const { browser, page, errors: e } = await open(chromium, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }, '?debug&reset&intro=off&seed=7');
    errors.push(...e);
    await sampler(page);
    await page.waitForTimeout(20000);
    await page.evaluate(() => window.__hj.scene.walks[0].walkNow('rtl'));
    await page.waitForTimeout(800);
    const rows = await rowsOf(page);
    const empty = await page.evaluate(() => { const c = window.__hj.scene.walks[0].el; if (!c.width) return true; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return false; return true; });
    report.reducedMotion = { framesRead: rows.length, framesWalking: rows.filter((r) => r[1]).length, canvasEmptyEvenWhenAWalkIsAskedFor: empty, ok: rows.filter((r) => r[1]).length === 0 && empty };
    say('reduced motion', report.reducedMotion);
    await browser.close();
  }
  // 3 and 4.
  const mask = await sharp(`${pkg}site/stagehand/gap_mask.png`).greyscale().raw().toBuffer({ resolveWithObject: true });
  const [gx, gy] = walk.gap_mask_xy;
  report.atOneToOne = {};
  for (const dpr of [1, 2]) {
    const { browser, page, errors: e } = await open(chromium, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr }, '?debug&reset&intro=off&seed=7&found=3');
    errors.push(...e);
    await clean(page);
    await page.waitForTimeout(500);
    const pics = []; const labels = [];
    for (const dir of ['rtl', 'ltr']) {
      for (const f of [10, 40, 70, 100, 130]) {
        // Into the walk at that frame, one page frame to draw it, then held.
        const drawn = await page.evaluate(async ({ dir, f }) => {
          const scene = window.__hj.scene; scene.work();
          const w = scene.walks[0]; w.walkNow(dir); w.state.ms = (f * 1000) / 30 + 1;
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          scene.hold();
          const c = w.el;
          return { frame: w.drawn, w: c.width, h: c.height, data: dir && c.width ? [...c.getContext('2d').getImageData(0, 0, c.width, c.height).data] : [] };
        }, { dir, f });
        const theirs = await packageBoots(dir, drawn.frame);
        // The page's canvas: 1672 × 83 at the gap's place, in plate px.
        const mineC = centroid(Uint8Array.from(drawn.data), drawn.w, [0, 0, drawn.w, drawn.h]);
        const band = Buffer.alloc(PLATE.w * mask.info.height * 4);
        theirs.copy(band, 0, gy * PLATE.w * 4, (gy + mask.info.height) * PLATE.w * 4);
        const theirsC = centroid(band, PLATE.w, [0, 0, PLATE.w, mask.info.height]);
        let diff = 0; let n = 0;
        for (let i = 0; i < band.length; i += 4) { if (!band[i + 3] && !drawn.data[i + 3]) continue; for (let c = 0; c < 4; c++) diff += Math.abs(band[i + c] - drawn.data[i + c]); n += 4; }
        const key = `${dir} frame ${drawn.frame}`;
        if (dpr === 1) {
          report.atOneToOne[key] = { pageCentre: mineC && mineC.map(r1), packageCentre: theirsC && theirsC.map(r1), offPlatePx: mineC && theirsC ? [r1(mineC[0] - theirsC[0]), r1(mineC[1] - theirsC[1])] : null, meanDifferenceOverTheBoots: n ? r1(diff / n) : 0 };
          report.atOneToOne[key].withinAPixel = report.atOneToOne[key].offPlatePx ? report.atOneToOne[key].offPlatePx.every((d) => Math.abs(d) <= 1) : mineC === theirsC;
        }
        // On screen, around the boots (or the gap's middle when none are in view), beside the package's picture.
        const cx = mineC ? mineC[0] : 836;
        const plateBox = await page.locator('.hj-plate[data-scene="set"]').boundingBox();
        const u = plateBox.width / PLATE.w;
        const x0 = Math.max(0, Math.min(PLATE.w - 260, Math.round(cx - 130)));
        const clip = { x: plateBox.x + x0 * u, y: plateBox.y + (gy - 20) * u, width: 260 * u, height: 120 * u };
        const screen = await sharp(await page.screenshot({ clip })).resize({ height: 240, kernel: 'nearest' }).png().toBuffer();
        const pk = await sharp(await packageScene(3, [{ input: await sharp(theirs, { raw: { width: PLATE.w, height: PLATE.h, channels: 4 } }).png().toBuffer(), left: 0, top: 0 }])).extract({ left: x0, top: gy - 20, width: 260, height: 120 }).resize({ height: 240, kernel: 'nearest' }).png().toBuffer();
        pics.push(screen, pk);
        labels.push(`${key}: the page`, `${key}: the package`);
      }
    }
    for (let i = 0; i < pics.length; i += 10) await row(`Device scale ${dpr}: ${i ? 'ltr' : 'rtl'}, frames 10, 40, 70, 100, 130, in pairs: the page | the package as theatre_preview.py draws it`, pics.slice(i, i + 10), `${out}walk-boots-${i ? 'ltr' : 'rtl'}-x${dpr}.jpg`, 6);
    if (dpr === 1) {
      // 4. Never outside the gap: every frame of a whole rtl and ltr walk.
      const inside = await page.evaluate(async () => {
        const scene = window.__hj.scene; scene.work();
        const w = scene.walks[0];
        const m = w.mask.getContext('2d').getImageData(0, 0, w.mask.width, w.mask.height).data;
        const out = { frames: 0, bootPixels: 0, outsideTheMask: 0, worstOutside: 0 };
        for (const dir of ['rtl', 'ltr']) {
          w.walkNow(dir);
          await new Promise((resolve) => {
            const tick = () => {
              const now = w.now;
              if (now.walking !== dir) { resolve(); return; }
              const d = w.el.getContext('2d').getImageData(0, 0, w.el.width, w.el.height).data;
              out.frames++;
              for (let i = 3; i < d.length; i += 4) if (d[i]) { out.bootPixels++; if (m[i] === 0) { out.outsideTheMask++; out.worstOutside = Math.max(out.worstOutside, d[i]); } }
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          });
        }
        return out;
      });
      // And the page's mask against the package's.
      const pageMask = await page.evaluate(() => { const w = window.__hj.scene.walks[0]; const d = w.mask.getContext('2d').getImageData(0, 0, w.mask.width, w.mask.height).data; const a = []; for (let i = 3; i < d.length; i += 4) a.push(d[i]); return a; });
      let maskDiff = 0; for (let i = 0; i < pageMask.length; i++) maskDiff = Math.max(maskDiff, Math.abs(pageMask[i] - mask.data[i]));
      // On screen: the band's pixels the mask leaves out, during the walk's frames, against no walk.
      const plateBox = await page.locator('.hj-plate[data-scene="set"]').boundingBox();
      const u = plateBox.width / PLATE.w;
      const clip = { x: plateBox.x, y: plateBox.y + gy * u, width: plateBox.width, height: mask.info.height * u };
      const shotAt = async (dir, f) => { await page.evaluate(async ({ dir, f }) => { const scene = window.__hj.scene; scene.work(); const w = scene.walks[0]; if (dir) { w.walkNow(dir); w.state.ms = (f * 1000) / 30 + 1; } else { w.sleep(); w.wake(); } await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); scene.hold(); }, { dir, f }); return sharp(await page.screenshot({ clip })).removeAlpha().raw().toBuffer({ resolveWithObject: true }); };
      const none = await shotAt(null, 0);
      const W = none.info.width; const H = none.info.height;
      let checked = 0; let changed = 0; let worst = 0;
      for (const dir of ['rtl', 'ltr']) for (const f of [20, 45, 60, 75, 90, 110]) {
        const s = await shotAt(dir, f);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          // The mask under this screen pixel, a plate pixel around: left out everywhere there.
          const mx = Math.floor(x / u); const my = Math.floor(y / u);
          let anyIn = false;
          for (let dy = -1; dy <= 1 && !anyIn; dy++) for (let dx = -1; dx <= 1 && !anyIn; dx++) { const yy = my + dy; const xx = mx + dx; if (yy >= 0 && yy < mask.info.height && xx >= 0 && xx < mask.info.width && mask.data[yy * mask.info.width + xx] > 0) anyIn = true; }
          if (anyIn) continue;
          const i = (y * W + x) * 3; checked++;
          const d = Math.max(Math.abs(s.data[i] - none.data[i]), Math.abs(s.data[i + 1] - none.data[i + 1]), Math.abs(s.data[i + 2] - none.data[i + 2]));
          if (d > 0) { changed++; worst = Math.max(worst, d); }
        }
      }
      report.neverOutsideTheGap = { canvas: inside, pageMaskAgainstThePackagesLargestDifference: maskDiff, onScreen: { screenPixelsCheckedWhereTheMaskIsNotSet: checked, changedDuringAWalk: changed, largestChange: worst }, ok: inside.outsideTheMask === 0 && changed === 0 && maskDiff <= 1 };
      say('never outside the gap', report.neverOutsideTheGap);
    }
    await browser.close();
  }
  say('at 1:1', Object.fromEntries(Object.entries(report.atOneToOne).map(([k, v]) => [k, `${JSON.stringify(v.offPlatePx)} px, ${v.meanDifferenceOverTheBoots} mean`])));
  report.errors = errors;
  await save('walk.json', report);
};

// Recordings for the review, desktop Chrome (1280 × 800) and the iPhone profile in WebKit. Needs ffmpeg.
//   set-<name>-45s.mp4       45 s at work from settled, with the routine's own schedule: a whole crossing
//                            (out and back), two finds, the lean and the dip. Seeds are tried until a take holds
//                            all of them.
//   set-<name>-10th.mp4      the 10th find from ?found=9: the last swath fades in with her salute, the scene
//                            shows done, with no Contact button.
//   set-<name>-unlock.mp4    the 50th find from ?all=49: the Contact button appears. And set-<name>-10of10.jpg,
//                            a 10/10 scene without the unlock.
//   set-<name>-reduced.mp4   reduced motion, 10 s, two finds: no walk, the lamp still, swaths without a fade.
run.film = async () => {
  const { execFileSync } = await import('node:child_process');
  const report = {};
  const only = process.argv[3];
  const grab = async (mp4, at, file) => { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, at)), '-i', mp4, '-frames:v', '1', file]); return sharp(file).resize({ height: 420 }).toBuffer(); };
  const cut = (webm, from, length, mp4) => { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, from)), '-i', webm, '-t', String(length), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', mp4]); return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString().trim()); };
  for (const [name, engine, options] of [['desktop', chromium, { viewport: { width: 1280, height: 800 } }], ['iphone', webkit, { ...devices['iPhone 14'] }]]) {
    if (only && only !== name && !['45s', '10th', 'unlock', 'reduced'].includes(only)) continue;
    const part = process.argv[4] ?? (['45s', '10th', 'unlock', 'reduced'].includes(only) ? only : null);
    const dir = `${out}film-take-${name}/`;
    await rm(dir, { recursive: true, force: true });
    const take = async (query, extra = {}) => {
      const browser = await launch(engine);
      const context = await browser.newContext({ ...options, ...extra, recordVideo: { dir, size: options.viewport } });
      const page = await context.newPage();
      const started = Date.now();
      await page.goto(`${base}${query}#${ID}`);
      return { browser, context, page, started, clock: () => (Date.now() - started) / 1000 };
    };
    const finish = async ({ browser, context, page }) => { const video = page.video(); await context.close(); await browser.close(); return video.path(); };
    const tap = async (page, spot) => { await panTo(page, spot); await page.waitForTimeout(150); const at = page.locator(`.hj-plate [data-spot="${spot}"]`); if (name === 'iphone') await at.tap({ force: true }); else await at.click({ force: true }); };
    report[name] = {};

    // 1. 45 s.
    if (!part || part === '45s') {
      let kept = null;
      for (let seed = 7; seed < 15 && !kept; seed++) {
        const t = await take(`?debug&reset&intro=off&seed=${seed}`);
        const { page } = t;
        await ready(page);
        await SCENE.set.loaded(page);
        await clean(page);
        await hookSteps(page);
        await page.evaluate(() => { const s = (window.__w = { rows: [] }); const tick = (now) => { const w = window.__hj.scene?.walks?.[0]; if (w) s.rows.push([Math.round(now), w.now.walking ?? null, w.now.frame ?? null]); requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
        const lag = (await page.evaluate(() => performance.now())) / 1000 - t.clock();
        const from = t.clock();
        const finds = [];
        await page.waitForTimeout(6000);
        finds.push(t.clock() - from); await tap(page, 'boards');
        await page.waitForTimeout(16000);
        finds.push(t.clock() - from); await tap(page, 'drop-cloth');
        await page.waitForTimeout(Math.max(500, (from + 45.6 - t.clock()) * 1000));
        const walks = await page.evaluate(() => window.__w.rows);
        const hers = await stepsOf(page, 'rachel');
        const webm = await finish(t);
        const sec = (ms) => ms / 1000 - lag - from;
        const starts = (d) => walks.filter((r, i) => r[1] === d && walks[i - 1]?.[1] !== d).map((r) => r[0]);
        const ends = (d) => walks.filter((r, i) => r[1] === d && walks[i + 1]?.[1] !== d).map((r) => r[0]);
        const rtl = starts('rtl')[0]; const rtlEnd = ends('rtl')[0]; const ltr = starts('ltr')[0]; const ltrEnd = ends('ltr')[0];
        const lean = hers.find(([p, , , at]) => p === 'R_B1_lean' && sec(at) >= 0 && sec(at) < 42);
        const dip = hers.find(([p, , , at]) => p === 'R_B2_dip' && sec(at) >= 0 && sec(at) < 44);
        const holds = rtl && ltrEnd && sec(rtl) >= 0 && sec(ltrEnd) <= 45 && lean && dip;
        if (!holds) { say(`${name}, seed ${seed}`, { note: 'the take did not hold a whole crossing, the lean and the dip in 45 s: another seed', rtlS: rtl && r1(sec(rtl)), ltrEndS: ltrEnd && r1(sec(ltrEnd)), lean: !!lean, dip: !!dip }); continue; }
        const mp4 = `${out}set-${name}-45s.mp4`;
        const length = cut(webm, from, 45, mp4);
        const moments = { rtl: [r1(sec(rtl)), r1(sec(rtlEnd))], ltr: [r1(sec(ltr)), r1(sec(ltrEnd))], findsS: finds.map(r1), leanS: r1(sec(lean[3])), dipS: r1(sec(dip[3])) };
        const stills = [];
        for (const [i, at] of [sec(rtl) + 1.2, sec(rtl) + 2.6, sec(ltr) + 1.2, sec(ltr) + 2.6, finds[0] + 0.6, finds[1] + 0.6, sec(lean[3]) + 0.5, sec(dip[3]) + 0.4].entries()) stills.push(await grab(mp4, at, `${dir}s45-${i}.png`));
        await row(`${name}, 45 s (seed ${seed}): the boots going (1.2, 2.6 s in), coming back (1.2, 2.6 s in)`, stills.slice(0, 4), `${out}set-${name}-45s-stills-walk.jpg`);
        await row(`${name}, 45 s: the two finds (0.6 s after each), the lean, the dip`, stills.slice(4), `${out}set-${name}-45s-stills-finds.jpg`);
        kept = { file: `set-${name}-45s.mp4`, seed, seconds: r1(length), ...moments };
      }
      report[name]['45s'] = kept ?? { failed: 'no seed from 7 to 14 gave a 45 s take with a whole crossing, the lean and the dip' };
      say(`${name} 45 s`, report[name]['45s']);
    }

    // 2. The 10th find.
    if (!part || part === '10th') {
      const t = await take('?debug&intro=off&seed=7&found=9');
      const { page } = t;
      await ready(page); await SCENE.set.loaded(page); await clean(page); await hookSteps(page);
      const lag = (await page.evaluate(() => performance.now())) / 1000 - t.clock();
      await page.waitForTimeout(1500);
      const from = t.clock() - 1.0;
      const spot = (await unfound(page))[0];
      const findAt = t.clock() - from;
      await tap(page, spot);
      await page.waitForTimeout(4500);
      const state = await page.evaluate(() => ({ progress: window.__hj.scene.progress.state, note: document.querySelector('.hj-note')?.textContent.trim(), contactShown: !document.querySelector('.hj-contact').classList.contains('is-waiting'), tally: document.querySelector('.hj-tally')?.hidden }));
      const hers = await stepsOf(page, 'rachel');
      const webm = await finish(t);
      const mp4 = `${out}set-${name}-10th.mp4`;
      const length = cut(webm, from, 6.5, mp4);
      const salute = hers.find(([p]) => p === 'R_K1_salute');
      const stills = [];
      for (const [i, at] of [findAt - 0.3, findAt + 0.25, findAt + 0.6, findAt + 2.0, findAt + 4.8].entries()) stills.push(await grab(mp4, at, `${dir}t10-${i}.png`));
      await row(`${name}: the 10th find (${spot}): before, 0.25 and 0.6 s into the fade, the salute at 2 s, done at 4.8 s`, stills, `${out}set-${name}-10th-stills.jpg`);
      report[name]['10th'] = { file: `set-${name}-10th.mp4`, seconds: r1(length), spot, findAtS: r1(findAt), saluteAtS: salute ? r1(salute[3] / 1000 - lag - from) : null, after: state, showsDoneWithoutTheContactButton: state.progress.baked === 10 && !state.contactShown };
      say(`${name} 10th`, report[name]['10th']);
    }

    // 3. The unlock, and a 10/10 scene without it.
    if (!part || part === 'unlock') {
      const t = await take('?debug&intro=off&seed=7&all=49');
      const { page } = t;
      await ready(page); await SCENE.set.loaded(page); await clean(page);
      await page.waitForTimeout(1500);
      const from = t.clock() - 1.0;
      const before = await page.evaluate(() => ({ contactShown: !document.querySelector('.hj-contact').classList.contains('is-waiting'), left: window.__hj.hunt.remaining }));
      const spot = (await unfound(page))[0];
      const findAt = t.clock() - from;
      await tap(page, spot);
      await page.waitForFunction(() => !document.querySelector('.hj-contact').classList.contains('is-waiting'), null, { timeout: 10000 }).catch(() => {});
      const shownAt = t.clock() - from;
      await page.waitForTimeout(2500);
      const after = await page.evaluate(() => ({ contactShown: !document.querySelector('.hj-contact').classList.contains('is-waiting'), note: document.querySelector('.hj-note')?.textContent.trim(), focused: document.activeElement?.classList.contains('hj-contact'), live: [...document.querySelectorAll('[aria-live]')].map((e) => e.textContent.trim()).filter(Boolean) }));
      const webm = await finish(t);
      const mp4 = `${out}set-${name}-unlock.mp4`;
      const length = cut(webm, from, shownAt + 3, mp4);
      const stills = [];
      for (const [i, at] of [findAt - 0.3, findAt + 0.6, shownAt + 0.1, shownAt + 1.5].entries()) stills.push(await grab(mp4, at, `${dir}unlock-${i}.png`));
      await row(`${name}: the 50th find (${spot}) from ?all=49: before, 0.6 s after, the Contact button as it comes, 1.5 s later`, stills, `${out}set-${name}-unlock-stills.jpg`);
      // A 10/10 scene with the others not done: no unlock.
      {
        const b2 = await launch(engine);
        const p2 = await (await b2.newContext(options)).newPage();
        await p2.goto(`${base}?debug&intro=off&seed=7&found=10#${ID}`);
        await ready(p2); await SCENE.set.loaded(p2); await clean(p2); await p2.waitForTimeout(800);
        await sharp(await p2.screenshot()).jpeg({ quality: 88 }).toFile(`${out}set-${name}-10of10-no-unlock.jpg`);
        report[name].tenOfTenWithoutTheUnlock = await p2.evaluate(() => ({ contactShown: !document.querySelector('.hj-contact').classList.contains('is-waiting'), note: document.querySelector('.hj-note')?.textContent.trim() }));
        await b2.close();
      }
      report[name].unlock = { file: `set-${name}-unlock.mp4`, seconds: r1(length), spot, before, findAtS: r1(findAt), contactButtonAtS: r1(shownAt), after, unlocked: !before.contactShown && after.contactShown };
      say(`${name} unlock`, { unlock: report[name].unlock, tenOfTenWithoutTheUnlock: report[name].tenOfTenWithoutTheUnlock });
    }

    // 4. Reduced motion.
    if (!part || part === 'reduced') {
      const t = await take('?debug&reset&intro=off&seed=7', { reducedMotion: 'reduce' });
      const { page } = t;
      await ready(page); await SCENE.set.loaded(page); await clean(page); await hookSteps(page);
      await page.evaluate(() => { window.__rm = { walking: 0, fading: 0, lamp: new Set() }; const tick = () => { const w = window.__hj.scene.walks?.[0]; if (w?.now.walking) window.__rm.walking++; if (document.querySelector('.hj-progress.is-fading')) window.__rm.fading++; window.__rm.lamp.add(window.__hj.scene.casts.find((c) => c.character.el.dataset.actor === 'lamp').character.current); requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
      const from = t.clock();
      await page.waitForTimeout(2500);
      const f1 = t.clock() - from; await tap(page, 'boards');
      await page.waitForTimeout(4000);
      const f2 = t.clock() - from; await tap(page, 'drop-cloth');
      await page.waitForTimeout(Math.max(500, (from + 10.4 - t.clock()) * 1000));
      const rm = await page.evaluate(() => ({ framesWithAWalk: window.__rm.walking, framesWithAFade: window.__rm.fading, lampPoses: [...window.__rm.lamp], progress: window.__hj.scene.progress.state }));
      const webm = await finish(t);
      const mp4 = `${out}set-${name}-reduced.mp4`;
      const length = cut(webm, from, 10, mp4);
      const stills = [];
      for (const [i, at] of [f1 - 0.3, f1 + 0.15, f1 + 1.0, f2 + 0.15, 9.5].entries()) stills.push(await grab(mp4, at, `${dir}rm-${i}.png`));
      await row(`${name}, reduced motion: before the first find, 0.15 s after it (the swath already there), 1 s after, 0.15 s after the second, at 9.5 s`, stills, `${out}set-${name}-reduced-stills.jpg`);
      report[name].reduced = { file: `set-${name}-reduced.mp4`, seconds: r1(length), findsS: [r1(f1), r1(f2)], ...rm, ok: rm.framesWithAWalk === 0 && rm.framesWithAFade === 0 && rm.lampPoses.length === 1 && rm.progress.baked === 2 };
      say(`${name} reduced`, report[name].reduced);
    }
    await rm(dir, { recursive: true, force: true });
  }
  const file = only ? `film-${only}${process.argv[4] ? `-${process.argv[4]}` : ''}.json` : 'film.json';
  await save(file, report);
};

// The page against the package. theatre-preview.mp4 is the plate, the swaths found so far, the boots and the
// lamp and Rachel on their stills (tools/theatre_preview.py). Here the same picture is made from the package
// for a few sets of poses, the page is put on the same poses, and each of Rachel and the lamp is placed to a
// tenth of a screen pixel against the room (as scene4.mjs preview does); the boots by the centre of their
// pixels on the walk's own canvas against the package's. And a frame of the preview itself beside the page.
run.preview = async () => {
  const { execFileSync } = await import('node:child_process');
  const frames = await framesOf();
  const SETS = {
    'at rest': { rachel: 'R_A1', lamp: 'L_00' },
    'a stroke, the lamp swung': { rachel: 'R_A3_stroke_out', lamp: 'L_18' },
    'her salute': { rachel: 'R_K1_salute', lamp: 'L_09' },
    // The preview's first walk starts at 3.0 s; its frame 70 is at about 5.33 s.
    'a boot frame (rtl 70), as in the preview at 5.33 s': { rachel: null, lamp: null, walk: ['rtl', 70] },
  };
  const browser = await launch(chromium);
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.6 })).newPage();
  const errors = errorsOf(page);
  await page.goto(`${base}?debug&reset&intro=off&seed=7#${ID}`);
  await ready(page);
  await SCENE.set.loaded(page);
  await page.evaluate(() => { window.__hj.scene.hold(); document.querySelectorAll('.hj-mushrooms').forEach((el) => { el.style.visibility = 'hidden'; }); });
  const report = {};
  let pair = null;
  for (const [label, poses] of Object.entries(SETS)) {
    // The preview at 5.33 s: what its seeded timelines show then.
    const want = poses.walk ? await (async () => { const p = `${out}preview-frame.png`; execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '5.333', '-i', `${pkg}theatre-preview.mp4`, '-frames:v', '1', p]); return p; })() : null;
    const used = { rachel: poses.rachel ?? 'R_A1', lamp: poses.lamp ?? 'L_00' };
    const drawn = await page.evaluate(async ({ used, walk }) => {
      const scene = window.__hj.scene;
      for (const cast of scene.casts) cast.character.show(used[cast.character.el.dataset.actor]);
      const w = scene.walks[0];
      if (walk) { scene.work(); w.walkNow(walk[0]); w.state.ms = (walk[1] * 1000) / 30 + 1; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); scene.hold(); for (const cast of scene.casts) cast.character.show(used[cast.character.el.dataset.actor]); }
      else { w.sleep(); w.wake(); }
      const c = w.el;
      return { frame: w.drawn, data: walk && c.width ? [...c.getContext('2d').getImageData(0, 0, c.width, c.height).data] : [], w: c.width, h: c.height };
    }, { used, walk: poses.walk ?? null });
    await page.waitForTimeout(150);
    const box = await page.locator('.hj-plate[data-scene="set"]').boundingBox();
    const shot = sharp(await page.screenshot({ clip: box }));
    const { width, height } = await shot.metadata();
    const mine = await shot.removeAlpha().raw().toBuffer();
    const layer = (actor) => frames.layers.find((l) => l.actor === actor);
    const extra = [];
    let bootsLayer = null;
    if (poses.walk) { bootsLayer = await packageBoots(poses.walk[0], drawn.frame); extra.push({ input: await sharp(bootsLayer, { raw: { width: PLATE.w, height: PLATE.h, channels: 4 } }).png().toBuffer(), left: 0, top: 0 }); }
    for (const actor of ['lamp', 'rachel']) extra.push({ input: `${pkg}site/${frames.stills[used[actor]]}`, left: layer(actor).x, top: layer(actor).y });
    const whole = await packageScene(0, extra);
    const theirs = await sharp(whole).resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
    const k = width / PLATE.w;
    const apart = ([l, t, r, b], dx, dy, only) => {
      let sum = 0; let n = 0;
      for (let y = Math.max(t, 3); y < Math.min(b, height - 3); y++) for (let x = Math.max(l, 3); x < Math.min(r, width - 3); x++) {
        if (only && !only(x, y)) continue;
        const a = (y * width + x) * 3; const o = ((y + dy) * width + x + dx) * 3;
        sum += (Math.abs(mine[a] - theirs[o]) + Math.abs(mine[a + 1] - theirs[o + 1]) + Math.abs(mine[a + 2] - theirs[o + 2])) / 3; n++;
      }
      return n ? sum / n : 0;
    };
    const closest = (area, only) => {
      let best = null;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const mean = apart(area, dx, dy, only); if (!best || mean < best.mean) best = { shift: [dx, dy], mean }; }
      const fine = (axis) => {
        const at = (d) => apart(area, best.shift[0] + (axis === 0 ? d : 0), best.shift[1] + (axis === 1 ? d : 0), only);
        if (Math.abs(best.shift[axis]) === 2) return best.shift[axis];
        const a = at(-1); const c = at(1); const bend = a - 2 * best.mean + c;
        return best.shift[axis] + (bend > 0 ? (0.5 * (a - c)) / bend : 0);
      };
      return { shift: [r1(fine(0)), r1(fine(1))], mean: r2(best.mean) };
    };
    // (The room is lined up where no actor is: the painted sky left of Rachel.)
    const room = closest([Math.round(330 * k), Math.round(170 * k), Math.round(690 * k), Math.round(540 * k)]);
    const actors = {};
    for (const actor of ['rachel', 'lamp']) {
      const l = layer(actor);
      const solid = await sharp(`${pkg}site/${frames.stills[used[actor]]}`).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
      // (The lamp only below the rim's own fade, plate y 30 on.)
      const top = actor === 'lamp' ? 30 : l.y;
      const area = [Math.floor(l.x * k), Math.floor(top * k), Math.ceil((l.x + l.w) * k), Math.ceil((l.y + l.h) * k)];
      const at = closest(area, (x, y) => {
        const sx = Math.round(x / k - l.x); const sy = Math.round(y / k - l.y);
        const reach = actor === 'lamp' ? 2 : 3;
        for (const [ox, oy] of [[0, 0], [-reach, 0], [reach, 0], [0, -reach], [0, reach]]) { const px = sx + ox; const py = sy + oy; if (px < 0 || py < 0 || px >= solid.info.width || py >= solid.info.height || solid.data[py * solid.info.width + px] < 255) return false; }
        return true;
      });
      const off = [r1(at.shift[0] - room.shift[0]), r1(at.shift[1] - room.shift[1])];
      actors[actor] = { pose: used[actor], screenPxFromWhereThePackagePutsIt: off, meanDifferenceOutOf255: at.mean, inPlace: Math.abs(off[0]) < 1.5 && Math.abs(off[1]) < 1.5 };
    }
    if (poses.walk) {
      const [, gy] = (await walkOf()).gap_mask_xy;
      const band = Buffer.alloc(PLATE.w * drawn.h * 4);
      bootsLayer.copy(band, 0, gy * PLATE.w * 4, (gy + drawn.h) * PLATE.w * 4);
      const a = centroid(Uint8Array.from(drawn.data), drawn.w, [0, 0, drawn.w, drawn.h]);
      const b = centroid(band, PLATE.w, [0, 0, PLATE.w, drawn.h]);
      const off = a && b ? [r1((a[0] - b[0]) * k), r1((a[1] - b[1]) * k)] : null;
      actors.boots = { frame: drawn.frame, screenPxFromWhereThePackagePutsThem: off, inPlace: off ? off.every((d) => Math.abs(d) < 1.5) : false };
    }
    report[label] = { platePxOnTheScreen: [width, height], theRoom: { screenshotOffsetPx: room.shift, meanDifferenceOutOf255: room.mean }, actors, everyActorIsInPlace: Object.values(actors).every((a) => a.inPlace) };
    say(label, report[label]);
    if (want) {
      pair = [await sharp(want).resize({ width: 900 }).png().toBuffer(), await sharp(whole).resize({ width: 900 }).png().toBuffer(), await sharp(mine, { raw: { width, height, channels: 3 } }).resize({ width: 900 }).png().toBuffer()];
      await rm(want, { force: true });
    }
  }
  await browser.close();
  if (pair) await row("theatre-preview.mp4 at 5.33 s (the first walk, frame 70)  |  the package drawn as the preview draws it  |  the page on the same frame (its edge is the site's own; the preview's Rachel and lamp are on their own seeded timelines)", pair, `${out}preview-compare.jpg`);
  report.errors = errors;
  await save('preview.json', report);
};

// From the bitmap and canvas sizes, sampled every frame, on the phone profile (WebKit, 390 × 844). Five
// scenes. A returning visitor (every switch the short brush): 20 orders, each scene opening four, every
// ordered pair of scenes next to each other at least once (orders that step round the five by 1, 2, 3 or 4).
// A new visitor (the opening painting, then a full painting of each scene never seen): 10 orders, each scene
// opening twice, every ordered pair covered. In each scene: wait for everything it loads, let it work, find
// one mushroom and let her react. Then back to the first.
//   node qa/tools/scene5.mjs memory                    everything (about an hour)
//   node qa/tools/scene5.mjs memory return             one kind of visitor (new | return)
//   node qa/tools/scene5.mjs memory set                only orders that start with that scene
//   node qa/tools/scene5.mjs memory new set,build,grow,design,film    one order
run.memory = async () => {
  const ids = ['build', 'grow', 'design', 'film', 'set'];
  const stepOrder = (s, d) => [0, 1, 2, 3, 4].map((i) => ids[(s + i * d) % 5]);
  const twenty = [];
  for (const d of [1, 2, 3, 4]) for (let s = 0; s < 5; s++) twenty.push(stepOrder(s, d));
  const ten = [];
  for (let s = 0; s < 5; s++) ten.push(stepOrder(s, (s % 4) + 1), stepOrder(s, ((s + 2) % 4) + 1));
  const coverage = (orders) => { const pairs = new Set(); const opens = {}; for (const o of orders) { opens[o[0]] = (opens[o[0]] ?? 0) + 1; for (let i = 1; i < o.length; i++) pairs.add(`${o[i - 1]}>${o[i]}`); } return { orders: orders.length, opens, pairsCovered: pairs.size, of: 20 }; };
  const args = process.argv.slice(3);
  const kind = args.find((a) => /^(new|return)/.test(a));
  const start = args.find((a) => a in SCENE);
  const single = args.find((a) => a.includes(','))?.split(',');
  const report = { coverage: { 'new visitor': coverage(ten), 'return visitor': coverage(twenty) } };
  const setAlone = [];
  for (const [visitor, query, orders] of [['new visitor (full paintings)', '?debug&reset&seed=4', ten], ['return visitor (the short brush)', '?debug&reset&intro=quick&seed=4', twenty]]) {
    if (kind && !visitor.startsWith(kind)) continue;
    report[visitor] = {};
    for (const order of single ? [single] : orders) {
      if (start && order[0] !== start) continue;
      const browser = await launch(webkit);
      const context = await browser.newContext(phone);
      await watchMemory(context);
      const page = await context.newPage();
      const errors = errorsOf(page);
      const stages = [];
      const setHeld = () => page.evaluate(() => Object.fromEntries(Object.entries(window.__hj.memory.parts).filter(([k, v]) => k.startsWith('set.') && v > 0).map(([k, v]) => [k, Math.round(v / 1e5) / 10])));
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
        const stage = { scene: id, ...tidy(await page.evaluate(() => window.__peak)), fullReaction: full, framesSheSkipped: await page.evaluate(() => window.__hj.rachel.missed) };
        if (id !== 'set') stage.setHoldsMB = await setHeld();
        else setAlone.push(stage);
        stages.push(stage);
      }
      await page.evaluate(() => { window.__peak = { total: 0, parts: {}, at: '' }; });
      await page.locator(`.hj-tab[data-scene="${order[0]}"]`).tap();
      await arrived(page, order[0]);
      await SCENE[order[0]].loaded(page);
      await SCENE[order[0]].busy(page);
      stages.push({ scene: `${order[0]} again`, ...tidy(await page.evaluate(() => window.__peak)), framesSheSkipped: await page.evaluate(() => window.__hj.rachel.missed), ...(order[0] === 'set' ? {} : { setHoldsMB: await setHeld() }) });
      const name = order.map((id) => id[0].toUpperCase() + id.slice(1)).join(' → ');
      report[visitor][name] = { highestMB: Math.max(...stages.map((s) => s.peakMB)), stages, errors };
      const sum = (o) => Math.round(Object.values(o ?? {}).reduce((a, b) => a + b, 0) * 10) / 10;
      say(`${visitor} / ${name}`, { highestMB: report[visitor][name].highestMB, byStage: stages.map((s) => `${s.scene} ${s.peakMB}`), fullReactions: stages.map((s) => s.fullReaction), setHoldsWhenAwayMB: stages.filter((s) => 'setHoldsMB' in s).map((s) => sum(s.setHoldsMB)), errors });
      await browser.close();
      const rows = Object.entries(report).filter(([k]) => k !== 'summary' && k !== 'coverage').flatMap(([, r]) => Object.values(r));
      const set = setAlone.reduce((a, b) => (b.peakMB > (a?.peakMB ?? 0) ? b : a), null);
      const away = rows.flatMap((r) => r.stages.filter((s) => 'setHoldsMB' in s && r.stages.slice(0, r.stages.indexOf(s)).some((b) => b.scene === 'set')).map((s) => s.setHoldsMB));
      report.summary = {
        ordersRun: rows.length, highestMB: Math.max(...rows.map((r) => r.highestMB)), budgetMB: 80, underTheBudget: rows.every((r) => r.highestMB < 80),
        highestWasIn: rows.flatMap((r) => r.stages).reduce((a, b) => (b.peakMB > a.peakMB ? b : a)).at,
        setItself: set && { peakMB: set.peakMB, at: set.at, partsMB: set.partsMB },
        setHoldsWhenAway: away.length ? { mostMB: Math.max(...away.map(sum)), parts: away.reduce((a, b) => (sum(b) > sum(a) ? b : a)) } : null,
        everyReactionInFull: rows.every((r) => r.stages.every((s) => s.fullReaction !== false)),
      };
      const file = args.length ? `memory-${args.join('-').replace(/[^a-z,-]/g, '')}.json` : 'memory.json';
      await save(file, report);
    }
  }
  if (report.summary) console.log(`HIGHEST of every order: ${report.summary.highestMB} MB (the budget is 80). Set Design itself: ${report.summary.setItself?.peakMB ?? '-'} MB ${JSON.stringify(report.summary.setItself?.partsMB ?? {})}; away from it: ${JSON.stringify(report.summary.setHoldsWhenAway)}. Coverage: ${JSON.stringify(report.coverage)}`);
};

// Frame times. WebKit on the iPhone profile and Chrome with the processor slowed four times, against the
// production build (HJ_PROD, by default http://localhost:4173/: npm run build && npm run preview). A new
// visitor opens Set Design (its painting), watches it work, finds a mushroom (its swath fades in), sees a
// walk, then goes Build → Grow → Design → Film → Set Design → Build and round once more. Production builds
// have no ?debug, so the walk is the one the routine starts (the first comes 8 to 15 s after the scene starts
// working: the tool waits for the canvas to show boots) and the find is a tap on the spot.
run.frames = async () => {
  const prod = process.env.HJ_PROD ?? 'http://localhost:4173/';
  const { execSync } = await import('node:child_process');
  const report = { machine: execSync('uptime').toString().trim(), url: prod, runs: [] };
  const logger = `(() => { const w = window.__f = { gaps: [] }; let last = performance.now(); const tick = (now) => { w.gaps.push([Math.round(now - last), Math.round(now)]); last = now; requestAnimationFrame(tick); }; requestAnimationFrame(tick); })();`;
  const runs = Number(process.argv[3] ?? 3);
  for (const [name, engine, options, slow] of [['webkit, iPhone 14 profile', webkit, phone, 0], ['chrome, phone size, processor slowed 4×', chromium, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, 4]]) {
    for (let n = 0; n < runs; n++) {
      const browser = await launch(engine);
      const context = await browser.newContext(options);
      await context.addInitScript(logger);
      const page = await context.newPage();
      if (slow) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: slow });
      const stretch = async (label, from, to) => {
        const gaps = (await page.evaluate(() => window.__f.gaps)).filter(([, at]) => at >= from && at <= to).map(([g]) => g);
        const sorted = [...gaps].sort((a, b) => a - b);
        return { stretch: label, frames: gaps.length, longestMs: gaps.length ? Math.max(...gaps) : null, over50: gaps.filter((g) => g > 50).length, over33: gaps.filter((g) => g > 33).length, medianMs: sorted[Math.floor(sorted.length / 2)] };
      };
      const now = () => page.evaluate(() => performance.now());
      const rows = [];
      const workFrom = await (async () => { await page.goto(`${prod}#${ID}`); await page.waitForSelector('.hj-paint', { state: 'attached', timeout: 30000 }); return now(); })();
      let from = workFrom;
      await page.waitForTimeout(6500);
      rows.push(await stretch('Set Design painted for a new visitor', from, await now()));
      from = await now();
      await page.waitForTimeout(3000);
      rows.push(await stretch('Set Design at work, 3 s', from, await now()));
      // A find: the first easy spot, tapped (brought into the window first).
      await page.evaluate(() => { const v = document.querySelector('.hj-viewport'); const r = document.querySelector('.hj-plate [data-spot="boards"]').getBoundingClientRect(); const vr = v.getBoundingClientRect(); v.scrollLeft += r.left + r.width / 2 - (vr.left + vr.width / 2); });
      await page.waitForTimeout(300);
      from = await now();
      await page.locator('.hj-plate [data-spot="boards"]').tap({ force: true });
      await page.waitForTimeout(1200);
      rows.push(await stretch('a find, its swath fading in (1.2 s)', from, await now()));
      // A walk: wait for the boots to show, then the next 4.6 s.
      const walkAt = await page.waitForFunction(() => { const c = document.querySelector('.hj-walk'); if (!c?.width) return false; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 64) if (d[i]) return performance.now(); return false; }, null, { timeout: 30000, polling: 100 }).then((h) => h.jsonValue()).catch(() => null);
      if (walkAt) { await page.waitForTimeout(4600); rows.push(await stretch('a walk (4.6 s from the boots first showing)', walkAt - 100, await now())); }
      else rows.push({ stretch: 'a walk', note: 'no walk within 30 s' });
      const seen = new Set([ID]);
      for (const id of ['build', 'grow', 'design', 'film', 'set', 'build', 'grow', 'design', 'film', 'set', 'build']) {
        const first = !seen.has(id);
        seen.add(id);
        from = await now();
        await page.locator(`.hj-tab[data-scene="${id}"]`).tap();
        await page.waitForTimeout(first ? 8500 : 3200);
        rows.push(await stretch(`to ${id} (${first ? 'first visit: its full painting' : 'the short brush'})`, from, await now()));
      }
      report.runs.push({ browser: name, run: n + 1, stretches: rows });
      say(`${name}, run ${n + 1}`, rows.map((r) => `${r.stretch}: longest ${r.longestMs} ms, ${r.over50} over 50`));
      await browser.close();
      await save('frames.json', report);
    }
  }
};

const command = process.argv[2];
if (!run[command]) {
  console.error(`Unknown command "${command}". One of: ${Object.keys(run).join(', ')}`);
  process.exit(1);
}
await run[command]();

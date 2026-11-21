// Scene 3, "Design" (the café): the checks of reviews/scene-3-build.md, section 7.
// Needs `npm run dev` (HJ_URL for another address). Results go to qa/scene3/.
//
//   node qa/tools/scene3.mjs shots     Design at 1440×900, 390×844 (as it opens, panned left, panned right) and 360×740
//   node qa/tools/scene3.mjs hunt      the ten hiding places, unmarked and marked easy / medium / hard, desktop and phone
//   node qa/tools/scene3.mjs memory    peak decoded-image memory on the phone profile, for every order of visiting the three scenes
//   node qa/tools/scene3.mjs back      coming back to the café: the cast is on the plate again before the brush shows it
//   node qa/tools/scene3.mjs react     a find: what she does, desktop and phone, and with reduced motion; and the cross-dissolve itself, measured
//   node qa/tools/scene3.mjs film      30 s of the café with one find, desktop and iPhone profile, and its first-visit painting
//   node qa/tools/scene3.mjs preview   the page against the package's own picture (plate + stills, as tools/cafe_preview.py draws frames/018-cafe-scene/cafe-preview.mp4)
//   node qa/tools/scene3.mjs shadow    Rachel's shadow (it comes with her since v7.4) against the rim's own fade, in numbers and close up
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
    loaded: (page) => page.waitForFunction(() => window.__hj.rachel?.has('R_K2_smile') && window.__hj.rachel.has('R_K1_blink'), null, { timeout: 90000 }),
    // The café has no clips: a few seconds of everyone's routine is all there is to it.
    busy: (page) => page.waitForTimeout(5000),
    spot: 'window-seat', full: 'R_K2_smile',
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

// Screenshots, with no markers: Design on desktop, and on two phones as it opens and panned to each end.
run.shots = async () => {
  const errors = [];
  {
    const browser = await chromium.launch({ channel: 'chrome' });
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    errors.push(...errorsOf(page));
    await page.goto(`${base}?debug&reset&intro=off&seed=7#design`);
    await ready(page);
    await clean(page);
    await page.waitForTimeout(800);
    await sharp(await page.screenshot()).jpeg({ quality: 90 }).toFile(`${out}design-1440x900.jpg`);
    await browser.close();
  }
  const browser = await webkit.launch();
  for (const [w, h] of [[390, 844], [360, 740]]) {
    const page = await (await browser.newContext({ ...devices['iPhone 14'], viewport: { width: w, height: h } })).newPage();
    errors.push(...errorsOf(page));
    await page.goto(`${base}?debug&reset&intro=off&seed=7#design`);
    await ready(page);
    await clean(page);
    await page.waitForTimeout(800);
    for (const pan of ['', '-left', '-right']) {
      if (pan) await page.evaluate((side) => { const v = document.querySelector('.hj-viewport'); v.scrollLeft = side === '-left' ? 0 : v.scrollWidth; }, pan);
      await page.waitForTimeout(400);
      await sharp(await page.screenshot()).jpeg({ quality: 90 }).toFile(`${out}design-${w}x${h}${pan}.jpg`);
      say(`design-${w}x${h}${pan}`, 'saved');
    }
    await page.close();
  }
  await browser.close();
  say('console errors', errors.length ? errors : 'none');
};

// The hunt, for looking at: the ten hiding places with no markers, and the same pictures with each one
// circled and named easy, medium or hard. Desktop, and a 390 × 844 phone panned left, centre and right.
// And each hard one cut out at the size a phone shows it.
const LEVEL = { floor: 'easy', 'window-seat': 'easy', corner: 'easy', bench: 'medium', chair: 'medium', niche: 'medium', cat: 'medium', sunlight: 'hard', cups: 'hard', counter: 'hard' };
const COLOUR = { easy: '#1f7a3a', medium: '#b06a00', hard: '#b3261e' };
run.hunt = async () => {
  const marked = async (page, png, scale) => {
    const spots = await page.evaluate(() => [...document.querySelectorAll('.hj-plate .hj-shroom')].map((b) => { const r = b.querySelector('.hj-shroom-art').getBoundingClientRect(); return { id: b.dataset.spot, x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.max(r.width, r.height) / 2 }; }));
    const size = await sharp(png).metadata();
    const view = page.viewportSize();
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}">`;
    for (const spot of spots) {
      if (spot.x < 0 || spot.x > view.width) continue;
      const level = LEVEL[spot.id];
      const x = spot.x * scale; const y = spot.y * scale; const r = (spot.r + 9) * scale;
      svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${COLOUR[level]}" stroke-width="${2.5 * scale}"/>`;
      svg += `<rect x="${x - 46 * scale}" y="${y - r - 19 * scale}" width="${92 * scale}" height="${16 * scale}" rx="${3 * scale}" fill="rgba(255,255,255,0.88)"/><text x="${x}" y="${y - r - 7 * scale}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${11 * scale}" fill="${COLOUR[level]}">${spot.id}: ${level}</text>`;
    }
    return sharp(png).composite([{ input: Buffer.from(`${svg}</svg>`) }]).jpeg({ quality: 90 }).toBuffer();
  };
  const checks = {};
  {
    const browser = await chromium.launch({ channel: 'chrome' });
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
    await page.goto(`${base}?debug&reset&intro=off&seed=7#design`);
    await ready(page);
    await page.getByRole('button', { name: 'Pause animation' }).click();
    await clean(page);
    await page.waitForTimeout(500);
    const png = await page.screenshot();
    await sharp(png).jpeg({ quality: 90 }).toFile(`${out}hunt-desktop.jpg`);
    await writeFile(`${out}hunt-desktop-circled.jpg`, await marked(page, png, 2));
    checks.desktop = await page.evaluate(() => [...document.querySelectorAll('.hj-plate .hj-shroom')].map((b) => { const r = b.getBoundingClientRect(); const a = b.querySelector('.hj-shroom-art').getBoundingClientRect(); return { id: b.dataset.spot, tapBox: [Math.round(r.width), Math.round(r.height)], drawingPx: [Math.round(a.width), Math.round(a.height)] }; }));
    await browser.close();
  }
  const browser = await webkit.launch();
  const page = await (await browser.newContext(phone)).newPage();
  await page.goto(`${base}?debug&reset&intro=off&seed=7#design`);
  await ready(page);
  await page.getByRole('button', { name: 'Pause animation' }).tap();
  await clean(page);
  const view = await page.evaluate(() => { const v = document.querySelector('.hj-viewport'); return { max: v.scrollWidth - v.clientWidth }; });
  for (const [name, at] of [['left', 0], ['centre', view.max / 2], ['right', view.max]]) {
    await page.evaluate((x) => { document.querySelector('.hj-viewport').scrollLeft = x; }, at);
    await page.waitForTimeout(400);
    const png = await page.screenshot();
    await sharp(png).jpeg({ quality: 90 }).toFile(`${out}hunt-phone-${name}.jpg`);
    await writeFile(`${out}hunt-phone-${name}-circled.jpg`, await marked(page, png, 3));
  }
  // Each hard one, as a phone shows it: the screen around it at the phone's own size (no enlargement).
  for (const id of Object.keys(LEVEL).filter((spot) => LEVEL[spot] === 'hard')) {
    await page.evaluate((spot) => { const view = document.querySelector('.hj-viewport'); const r = document.querySelector(`.hj-plate [data-spot="${spot}"]`).getBoundingClientRect(); const v = view.getBoundingClientRect(); view.scrollLeft += r.left + r.width / 2 - (v.left + v.width / 2); }, id);
    await page.waitForTimeout(400);
    const box = await page.locator(`.hj-plate [data-spot="${id}"] .hj-shroom-art`).boundingBox();
    const clip = { x: Math.max(0, box.x + box.width / 2 - 130), y: Math.max(0, box.y + box.height / 2 - 100), width: 260, height: 200 };
    await sharp(await page.screenshot({ clip })).jpeg({ quality: 92 }).toFile(`${out}hunt-phone-hard-${id}-at-phone-size.jpg`);
  }
  checks.phone = await page.evaluate(() => [...document.querySelectorAll('.hj-plate .hj-shroom')].map((b) => { const r = b.getBoundingClientRect(); const a = b.querySelector('.hj-shroom-art').getBoundingClientRect(); return { id: b.dataset.spot, tapBox: [Math.round(r.width), Math.round(r.height)], drawingPx: [Math.round(a.width * 10) / 10, Math.round(a.height * 10) / 10] }; }));
  // Tab order, and whether any two tap boxes overlap on the phone.
  checks.tabOrder = await page.evaluate(() => [...document.querySelectorAll('.hj-plate .hj-shroom')].map((b) => b.dataset.spot));
  checks.overlapsOnThePhone = await page.evaluate(() => { const boxes = [...document.querySelectorAll('.hj-plate .hj-shroom')].map((b) => [b.dataset.spot, b.getBoundingClientRect()]); const hits = []; for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const [a, ra] = boxes[i]; const [b, rb] = boxes[j]; if (ra.left < rb.right && rb.left < ra.right && ra.top < rb.bottom && rb.top < ra.bottom) hits.push(`${a}/${b}`); } return hits; });
  checks.levels = LEVEL;
  await browser.close();
  await save('hunt-checks.json', checks);
  say('hunt', { smallestTapBoxDesktop: Math.min(...checks.desktop.flatMap((s) => s.tapBox)), smallestTapBoxPhone: Math.min(...checks.phone.flatMap((s) => s.tapBox)), overlapsOnThePhone: checks.overlapsOnThePhone, tabOrder: checks.tabOrder.join(', ') });
};

// Coming back to the café. Out of sight its cast keeps nothing decoded (three scenes' kept frames would
// not fit the phone's budget), so on the way back every actor's rest frame has to be decoded again before
// the brush shows the room. Read every frame of the switch: when each actor's canvas has its picture again,
// against when the brush starts (the sheet over the window starts to clear).
run.back = async () => {
  const report = [];
  for (const [name, engine, options, touch] of [['chrome, 1440 × 900', chromium, { viewport: { width: 1440, height: 900 } }, false], ['webkit, iPhone 14 profile', webkit, phone, true]]) {
    const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {});
    const page = await (await browser.newContext(options)).newPage();
    const errors = errorsOf(page);
    await page.goto(`${base}?debug&reset&intro=quick&seed=7#design`);
    await ready(page);
    await SCENE.design.loaded(page);
    const rows = [];
    for (let lap = 0; lap < 3; lap++) {
      const away = lap % 2 ? 'grow' : 'build';
      const tab = (id) => (touch ? page.locator(`.hj-tab[data-scene="${id}"]`).tap() : page.locator(`.hj-tab[data-scene="${id}"]`).click());
      await tab(away);
      await arrived(page, away);
      await page.waitForTimeout(1200);
      const held = await page.evaluate(() => window.__hj.memory.parts['design.frames'] + window.__hj.memory.parts['design.canvases'] + window.__hj.memory.parts['design.room'] + window.__hj.memory.parts['design.edge']);
      // Watch the way back, frame by frame, from the tap.
      await page.evaluate(() => {
        const w = (window.__back = { t0: performance.now(), drawn: {}, brush: 0, frames: 0 });
        const scratch = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
        const inked = (canvas) => { if (!canvas.width) return false; scratch.canvas.width = 8; scratch.canvas.height = 8; scratch.clearRect(0, 0, 8, 8); scratch.drawImage(canvas, 0, 0, 8, 8); return scratch.getImageData(0, 0, 8, 8).data.some((v, i) => i % 4 === 3 && v > 0); };
        const tick = () => {
          const now = performance.now() - w.t0;
          w.frames++;
          for (const el of document.querySelectorAll('.hj-plate[data-scene="design"] [data-actor]')) if (!(el.dataset.actor in w.drawn) && inked(el.querySelector('canvas'))) w.drawn[el.dataset.actor] = Math.round(now);
          // The brush has started when the sheet over the window (a copy of the scene being left) has begun to clear.
          const sheet = document.querySelector('.hj-paint.is-over-window');
          if (sheet && !w.brush) {
            scratch.canvas.width = 64; scratch.canvas.height = 36; scratch.clearRect(0, 0, 64, 36); scratch.drawImage(sheet, 0, 0, 64, 36);
            const data = scratch.getImageData(0, 0, 64, 36).data; let sum = 0; for (let i = 3; i < data.length; i += 4) sum += data[i];
            // (The sheet of the switch before may still be there, clear, for a moment: the fullest it gets is the new one, whole.)
            w.whole = Math.max(w.whole ?? 0, sum);
            if (w.whole > 0 && sum < w.whole * 0.995) w.brush = Math.round(now);
          }
          if (now < 4000) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const missedBefore = await page.evaluate(() => window.__hj.rachel?.missed ?? 0);
      await tab('design');
      await arrived(page, 'design');
      await page.waitForTimeout(2500);
      const back = await page.evaluate(() => window.__back);
      const rest = await page.evaluate(() => window.__hj.rachel.rest);
      rows.push({ awayIn: away, cafeHeldWhileAwayMB: MB(held), msFromTheTapUntilEachActorIsDrawnAgain: back.drawn, msFromTheTapUntilTheBrushStarts: back.brush, everyoneDrawnBeforeTheBrush: Object.entries(back.drawn).filter(([actor]) => actor !== 'mum').every(([, ms]) => ms <= back.brush) && Object.keys(back.drawn).length >= 5, sheStartsFromHerRestPose: rest, posesSheMissed: await page.evaluate((before) => window.__hj.rachel.missed - before, missedBefore) });
    }
    report.push({ browser: name, laps: rows, errors, ok: rows.every((r) => r.cafeHeldWhileAwayMB === 0 && r.everyoneDrawnBeforeTheBrush && r.posesSheMissed === 0) && errors.length === 0 });
    say(name, report.at(-1));
    await browser.close();
  }
  await save('back.json', report);
};

// A find: what she does, step by step, against routine.json. Desktop Chrome and the iPhone profile; and with
// reduced motion, where the answer is one held pose. Then the cross-dissolve itself: for every actor, the
// canvas part-way through a dissolve against the weighted sum of the two poses.
run.react = async () => {
  const report = [];
  for (const [name, engine, options] of [['chrome, 1440 × 900', chromium, { viewport: { width: 1440, height: 900 } }], ['webkit, iPhone 14 profile', webkit, phone], ['chrome, reduced motion', chromium, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }]]) {
    const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {});
    const page = await (await browser.newContext(options)).newPage();
    const errors = errorsOf(page);
    await page.goto(`${base}?debug&reset&intro=off&seed=7#design`);
    await ready(page);
    await SCENE.design.loaded(page);
    await page.evaluate(() => { window.__steps = []; const p = window.__hj.player; const old = p.onStep; p.onStep = (step) => { window.__steps.push([step.pose, Math.round(step.ms), step.fade ?? 0, Math.round(performance.now())]); old?.(step); }; });
    if (!options.reducedMotion) await page.waitForFunction(() => window.__steps.some(([p]) => p === 'R_A2_stroke'), null, { timeout: 60000 });
    else await page.waitForTimeout(1500);
    const t0 = await page.evaluate(() => Math.round(performance.now()));
    await page.evaluate(() => document.querySelector('.hj-plate [data-spot="window-seat"]').click());
    await page.waitForFunction(() => !window.__hj.player.reacting && window.__steps.some(([p]) => p === 'R_K2_smile'), null, { timeout: 20000 });
    await page.waitForTimeout(1200);
    const steps = (await page.evaluate(() => window.__steps)).filter(([, , , at]) => at >= t0 - 900);
    const answer = steps.filter(([, , , at]) => at >= t0);
    const row = { browser: name, fromTheFind: steps.map(([p, ms, fade, at]) => `${at - t0} ms: ${p}, ${ms} ms${fade ? `, dissolved in over ${fade}` : ''}`), msFromTheFindToHerFirstMove: answer.length ? answer[0][3] - t0 : null, msFromTheFindToTheSmile: (answer.find(([p]) => p === 'R_K2_smile')?.[3] ?? NaN) - t0, posesSheMissed: await page.evaluate(() => window.__hj.rachel.missed), countAfter: await page.evaluate(() => window.__hj.hunt.remaining), errors };
    if (!options.reducedMotion) {
      // A find during the coffee sip: she finishes the sip (the cup at her lips for 300 ms at least, then the
      // lift and the reach back down) and only then answers. Once as she reaches for the cup, once mid-sip.
      row.duringTheSip = {};
      for (const [label, pose, spot, into] of [['as she reaches for the cup', 'R_S1_reach', 'floor', 60], ['with the cup at her lips', 'R_B1_sip', 'corner', 100]]) {
        await page.evaluate(() => { window.__steps.length = 0; });
        // (The reach on the way up: the pose before it is the sketch, not the lift.)
        await page.waitForFunction((p) => window.__steps.at(-1)?.[0] === p && window.__steps.at(-2)?.[0] !== (p === 'R_S1_reach' ? 'R_S2_lift' : ''), pose, { timeout: 120000 });
        await page.waitForTimeout(into);
        const at = await page.evaluate((id) => { const now = Math.round(performance.now()); document.querySelector(`.hj-plate [data-spot="${id}"]`).click(); return now; }, spot);
        await page.waitForFunction(() => !window.__hj.player.reacting && window.__steps.some(([p]) => p === 'R_K2_smile'), null, { timeout: 20000 });
        await page.waitForTimeout(600);
        const all = await page.evaluate(() => window.__steps);
        const from = all.findLastIndex(([, , , t]) => t <= at);
        const seen = all.slice(from);
        const first = seen.findIndex(([p]) => p === 'R_A1_blink');
        const sip = seen.slice(0, first);
        const lips = sip.findIndex(([p]) => p === 'R_B1_sip');
        row.duringTheSip[label] = {
          found: `${at - seen[0][3]} ms into ${seen[0][0]}`,
          thenShe: seen.slice(0, first + 4).map(([p, , , t], i) => `${t - at} ms: ${p}${seen[i + 1] ? `, shown ${seen[i + 1][3] - t} ms` : ''}`),
          finishedTheSipFirst: sip.map(([p]) => p).join(' > ') === (pose === 'R_S1_reach' ? 'R_S1_reach > R_S2_lift > R_B1_sip > R_S2_lift > R_S1_reach' : 'R_B1_sip > R_S2_lift > R_S1_reach'),
          cupAtHerLipsMs: seen[lips + 1][3] - seen[lips][3],
          msFromTheFindToHerAnswer: seen[first][3] - at,
          anyDissolveOrBlinkOnTheWay: sip.some(([p, , fade]) => fade > 0 || p === 'R_A1_blink'),
          smiled: seen.some(([p]) => p === 'R_K2_smile'),
        };
      }
      // Everyone, for a while: who dissolves, and from what into what (only ever two stills of one loop).
      row.dissolvesSeenIn40s = await page.evaluate(async () => {
        const seen = {};
        for (const cast of window.__hj.scene.casts) {
          const name = cast.character.el.dataset.actor; let before = cast.character.current; seen[name] = {};
          const player = window.__hj.scene.players.get(cast);
          const old = player.onStep;
          player.onStep = (step) => { if (step.fade) { const key = `${before} > ${step.pose} (${step.fade} ms)`; seen[name][key] = (seen[name][key] ?? 0) + 1; } before = step.pose; old?.(step); };
        }
        await new Promise((r) => setTimeout(r, 40000));
        return Object.fromEntries(Object.entries(seen).filter(([, v]) => Object.keys(v).length));
      });
    }
    // (Last: it stops everyone where they are.)
    if (!options.reducedMotion) {
      row.theDissolve = await page.evaluate(() => {
        const scene = window.__hj.scene; scene.hold();
        const out = {};
        for (const cast of scene.casts) {
          const c = cast.character; const canvas = c.el.querySelector('canvas');
          const names = [...c.frames.keys()];
          if (names.length < 2 || !canvas.width) continue;
          const read = () => { const s = document.createElement('canvas'); s.width = canvas.width; s.height = canvas.height; const x = s.getContext('2d'); x.drawImage(canvas, 0, 0); return x.getImageData(0, 0, s.width, s.height).data; };
          c.show(names[1]); c.show(names[0]); const a = read();
          c.show(names[1]); const b = read();
          let worst = 0;
          for (const t of [0.25, 0.5, 0.75]) {
            c.dissolve(names[0], names[1], t); const m = read();
            // As the screen composites them: colour times coverage, and coverage.
            for (let i = 0; i < m.length; i += 4) for (let ch = 0; ch < 4; ch++) {
              const pa = ch === 3 ? a[i + 3] : (a[i + ch] * a[i + 3]) / 255; const pb = ch === 3 ? b[i + 3] : (b[i + ch] * b[i + 3]) / 255; const pm = ch === 3 ? m[i + 3] : (m[i + ch] * m[i + 3]) / 255;
              worst = Math.max(worst, Math.abs(pm - (pa * (1 - t) + pb * t)));
            }
          }
          c.dissolve(names[0], names[1], 1);
          const end = read(); let endDiff = 0; for (let i = 0; i < end.length; i++) endDiff = Math.max(endDiff, Math.abs(end[i] - b[i]));
          out[c.el.dataset.actor] = { canvasPx: [canvas.width, canvas.height], furthestFromTheWeightedSumOutOf255: Math.round(worst * 10) / 10, atTheEndItIsTheNewPoseExactly: endDiff === 0 };
        }
        return out;
      });
    }
    report.push(row);
    say(name, row);
    await browser.close();
  }
  await save('react.json', report);
};

// Recordings. A new visitor opens the café: its first-visit painting, then about 30 s of the café with one
// find in it. Desktop Chrome and the iPhone profile in WebKit. Needs ffmpeg for the .mp4 and the stills.
run.film = async () => {
  const { execFileSync } = await import('node:child_process');
  const { rm, readdir } = await import('node:fs/promises');
  for (const [name, engine, options] of [['desktop', chromium, { viewport: { width: 1280, height: 800 } }], ['iphone', webkit, { ...devices['iPhone 14'] }]]) {
    const dir = `${out}film-${name}/`;
    const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {});
    const context = await browser.newContext({ ...options, recordVideo: { dir, size: options.viewport } });
    const page = await context.newPage();
    const started = Date.now();
    await page.goto(`${base}?debug&reset&seed=7#design`);
    await page.waitForFunction(() => window.__hj?.marks.introStart > 0, null, { timeout: 30000 });
    const introAt = (Date.now() - started) / 1000;
    await clean(page);
    await ready(page);
    const readyAt = (Date.now() - started) / 1000;
    // Her coffee sip, whenever it comes round (9 to 17 s into her routine), then a find a few seconds after it.
    await page.waitForFunction(() => window.__hj.poses.some(([p]) => p === 'R_B1_sip'), null, { timeout: 60000 });
    const sipAt = (Date.now() - started) / 1000;
    await page.waitForTimeout(5500);
    const findAt = (Date.now() - started) / 1000;
    const spot = page.locator('.hj-plate [data-spot="window-seat"]');
    if (name === 'iphone') await spot.tap({ force: true }); else await spot.click({ force: true });
    // (At least 30 s of the café at work, and her whole answer.)
    await page.waitForTimeout(Math.max(6000, (readyAt + 31 - findAt) * 1000));
    await context.close();
    await browser.close();
    const [webm] = (await readdir(dir)).filter((f) => f.endsWith('.webm'));
    const mp4 = `${out}design-film-${name}.mp4`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${dir}${webm}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', mp4]);
    const moments = [introAt + 0.9, introAt + 2.3, introAt + 3.7, introAt + 5.6, findAt - 3, findAt + 0.6, findAt + 1.6, findAt + 2.2, findAt + 4.5, sipAt - 0.6, sipAt - 0.1, sipAt + 0.8, sipAt + 3.2];
    const stills = [];
    for (const [i, at] of moments.entries()) {
      const file = `${dir}still-${i}.png`;
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(at), '-i', mp4, '-frames:v', '1', file]);
      stills.push(await sharp(file).resize({ height: 420 }).toBuffer());
    }
    await row(`${name}: the café painted for a new visitor, at about 0.9, 2.3, 3.7 and 5.6 s`, stills.slice(0, 4), `${out}design-film-${name}-stills-painting.jpg`);
    await row(`${name}: at work, and a find: 0.6, 1.6, 2.2 and 4.5 s after it`, stills.slice(4, 9), `${out}design-film-${name}-stills-find.jpg`);
    await row(`${name}: the coffee sip, from 0.6 s before the cup reaches her lips to 3.2 s after`, stills.slice(9), `${out}design-film-${name}-stills-sip.jpg`);
    say(`${name} times in the film, s`, { paintingStarts: Math.round(introAt * 10) / 10, atWorkFrom: Math.round(readyAt * 10) / 10, sip: Math.round(sipAt * 10) / 10, find: Math.round(findAt * 10) / 10 });
    await rm(dir, { recursive: true, force: true });
    say(name, mp4);
  }
};

// The page against the package. cafe-preview.mp4 is the plate with each actor's still drawn over it at its
// layer's place (tools/cafe_preview.py). Here the same picture is made from the package for a few sets of
// poses, the page is put on the same poses, and the two are compared inside the painting's edge: how far
// apart they are, and whether shifting one against the other by a pixel would bring them closer (it must
// not: every actor is where the package puts it). Also a frame of the preview itself beside the page.
run.preview = async () => {
  const { execFileSync } = await import('node:child_process');
  const pkg = new URL('../../../frames/018-cafe-scene/', import.meta.url).pathname;
  const frames = JSON.parse(await readFile(`${pkg}site/frames.json`, 'utf8'));
  const SETS = {
    'at rest': {},
    'the sip': { rachel: 'R_B1_sip', barista: 'B_2_polish', child: 'C_3', oldman: 'O_3', cat: 'cat_2', mum: 'M_blink_closed', fan: 'fan_07' },
    'the smile': { rachel: 'R_K2_smile', barista: 'B_4_glance', child: 'C_2', oldman: 'O_2', cat: 'cat_3', fan: 'fan_13' },
    'reaching': { rachel: 'R_S2_lift', barista: 'B_3_polish', fan: 'fan_19' },
  };
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.6 })).newPage();
  const errors = errorsOf(page);
  await page.goto(`${base}?debug&reset&intro=off&seed=7#design`);
  await ready(page);
  await SCENE.design.loaded(page);
  await page.waitForFunction(() => window.__hj.scene.casts.every((cast) => [...cast.character.frames.keys()].length > 0), null, { timeout: 30000 });
  await page.evaluate(() => { window.__hj.scene.hold(); document.querySelectorAll('.hj-mushrooms').forEach((el) => { el.style.visibility = 'hidden'; }); });
  const report = {};
  let shown = null;
  for (const [label, poses] of Object.entries(SETS)) {
    const used = Object.fromEntries(frames.layers.map((layer) => [layer.actor, poses[layer.actor] ?? layer.stills[0]]));
    // (The mum is part of the plate: her layer is only her blink.)
    if (!poses.mum) delete used.mum;
    await page.evaluate((to) => { for (const cast of window.__hj.scene.casts) { const name = cast.character.el.dataset.actor; cast.character.show(to[name] ?? ''); } }, used);
    await page.waitForTimeout(150);
    const box = await page.locator('.hj-plate').boundingBox();
    const shot = sharp(await page.screenshot({ clip: box }));
    const { width, height } = await shot.metadata();
    const mine = await shot.removeAlpha().raw().toBuffer();
    const layers = frames.layers.filter((layer) => used[layer.actor]).map((layer) => ({ input: `${pkg}site/${frames.stills[used[layer.actor]]}`, left: layer.x, top: layer.y }));
    const whole = await sharp(`${pkg}site/${frames.plate}`).composite(layers).png().toBuffer();
    const theirs = await sharp(whole).resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
    // Inside the edge: a sixth in from each side is clear of it everywhere. The screenshot's own corner may
    // fall a fraction of a pixel from the plate's, so the whole picture is first lined up on the room (the
    // shift, of at most 2 px, that brings the two closest), and then each actor's own box is asked the same
    // question: an actor out of place against the room would be closest at a different shift.
    const k = width / frames.canvas.w;
    const inside = [Math.round(width / 6), Math.round(height / 5), width - Math.round(width / 6), height - Math.round(height / 5)];
    const apart = ([l, t, r, b], dx, dy, only) => {
      let sum = 0; let n = 0;
      for (let y = Math.max(t, 3); y < Math.min(b, height - 3); y++) {
        for (let x = Math.max(l, 3); x < Math.min(r, width - 3); x++) {
          if (only && !only(x, y)) continue;
          const a = (y * width + x) * 3; const o = ((y + dy) * width + x + dx) * 3;
          sum += (Math.abs(mine[a] - theirs[o]) + Math.abs(mine[a + 1] - theirs[o + 1]) + Math.abs(mine[a + 2] - theirs[o + 2])) / 3; n++;
        }
      }
      return n ? sum / n : 0;
    };
    // Where the two are closest, to a tenth of a screen pixel: the lowest of the whole-pixel shifts, refined
    // by the curve through it and its two neighbours on each axis.
    const closest = (area, only) => {
      let best = null;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const mean = apart(area, dx, dy, only); if (!best || mean < best.mean) best = { shift: [dx, dy], mean }; }
      const fine = (axis) => {
        const at = (d) => apart(area, best.shift[0] + (axis === 0 ? d : 0), best.shift[1] + (axis === 1 ? d : 0), only);
        if (Math.abs(best.shift[axis]) === 2) return best.shift[axis];
        const a = at(-1); const c = at(1); const bend = a - 2 * best.mean + c;
        return best.shift[axis] + (bend > 0 ? (0.5 * (a - c)) / bend : 0);
      };
      return { shift: [Math.round(fine(0) * 10) / 10, Math.round(fine(1) * 10) / 10], mean: Math.round(best.mean * 100) / 100 };
    };
    const room = closest(inside);
    const actors = {};
    for (const layer of frames.layers) {
      if (!used[layer.actor]) continue;
      // An actor is compared where its drawing is solid: the edge leaves the painting whole under every such
      // pixel, wherever on the plate the actor is. (Not the fan: it is faded with the room.)
      const solid = await sharp(`${pkg}site/${frames.stills[used[layer.actor]]}`).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
      if (solid.data.every((a) => a === 255)) { actors[layer.actor] = 'a piece of the room, faded with it at the edge: not compared'; continue; }
      const area = [Math.floor(layer.x * k), Math.floor(layer.y * k), Math.ceil((layer.x + layer.w) * k), Math.ceil((layer.y + layer.h) * k)];
      const at = closest(area, (x, y) => {
        const sx = Math.round(x / k - layer.x); const sy = Math.round(y / k - layer.y);
        // (Well inside the drawing: 3 px of its own from any clear pixel.)
        for (const [ox, oy] of [[0, 0], [-3, 0], [3, 0], [0, -3], [0, 3]]) {
          const px = sx + ox; const py = sy + oy;
          if (px < 0 || py < 0 || px >= solid.info.width || py >= solid.info.height || solid.data[py * solid.info.width + px] < 255) return false;
        }
        return true;
      });
      // (A patch the size of the mum's eyes is too little to place this way: it reads the same a pixel either side.)
      if (layer.w * k * layer.h * k < 5000) { actors[layer.actor] = { meanDifferenceOutOf255: at.mean, note: 'too small to place by this measure' }; continue; }
      const off = [Math.round((at.shift[0] - room.shift[0]) * 10) / 10, Math.round((at.shift[1] - room.shift[1]) * 10) / 10];
      // Each actor's canvas is set on whole screen pixels, so half a pixel either way is expected, and the
      // estimate itself moves by about half a pixel from pose to pose on the smaller actors.
      actors[layer.actor] = { screenPxFromWhereThePackagePutsIt: off, meanDifferenceOutOf255: at.mean, inPlace: Math.abs(off[0]) < 1.5 && Math.abs(off[1]) < 1.5 };
    }
    report[label] = { poses: used, platePxOnTheScreen: [width, height], theRoom: { screenshotOffsetPx: room.shift, meanDifferenceOutOf255: room.mean }, actors, everyActorIsInPlace: Object.values(actors).every((a) => typeof a === 'string' || a.inPlace !== false) };
    say(label, report[label]);
    if (label === 'the sip') shown = { mine: await sharp(mine, { raw: { width, height, channels: 3 } }).resize({ width: 900 }).png().toBuffer(), theirs: await sharp(theirs, { raw: { width, height, channels: 3 } }).resize({ width: 900 }).png().toBuffer() };
  }
  await browser.close();
  // A frame of the preview itself with the cup at her lips (found by looking: the sip is at about 13 to 15 s).
  const frame = `${out}preview-frame.png`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '14.2', '-i', `${pkg}cafe-preview.mp4`, '-frames:v', '1', frame]);
  const theirFrame = await sharp(frame).resize({ width: 900 }).png().toBuffer();
  const { rm } = await import('node:fs/promises');
  await rm(frame, { force: true });
  await row('the sip: cafe-preview.mp4 at 14.2 s  |  the package drawn as the preview draws it  |  the page on the same poses (its edge is the site\'s own)', [theirFrame, shown.theirs, shown.mine], `${out}preview-compare.jpg`);
  report.errors = errors;
  await save('preview.json', report);
};

// Rachel's shadow is part of her stills (package v7.4), and its outer fringe comes nearer the plate's bottom
// than the rim's own 28 px fade, where nothing is ever whole. How much of her is in that fade, and how
// visible it is: every pixel her stills cover there, against the plate under it. Then her boots, the shadow
// and the edge below them at twice the plate's size, as the page draws them.
run.shadow = async () => {
  const pkg = new URL('../../../frames/018-cafe-scene/site/', import.meta.url).pathname;
  const frames = JSON.parse(await readFile(`${pkg}frames.json`, 'utf8'));
  const routines = JSON.parse(await readFile(`${pkg}routine.json`, 'utf8'));
  const lead = frames.layers.find((layer) => routines.actors[layer.actor]?.reaction);
  const k = 1672 / frames.canvas.w;
  const RIM = 28;
  const plate = await sharp(`${pkg}${frames.plate}`).extract({ left: lead.x, top: lead.y, width: lead.w, height: lead.h }).removeAlpha().raw().toBuffer();
  const lum = (b, i) => 0.299 * b[i] + 0.587 * b[i + 1] + 0.114 * b[i + 2];
  // Per pixel of her layer, over all her stills: is it ever covered, and the most it ever darkens the floor.
  const covered = new Uint8Array(lead.w * lead.h);
  const darkens = new Float32Array(lead.w * lead.h);
  const differs = new Float32Array(lead.w * lead.h);
  for (const still of lead.stills) {
    const data = await sharp(`${pkg}${frames.stills[still]}`).ensureAlpha().raw().toBuffer();
    for (let i = 0; i < covered.length; i++) {
      const a = data[i * 4 + 3] / 255;
      if (data[i * 4 + 3] <= 8) continue;
      covered[i] = Math.max(covered[i], data[i * 4 + 3]);
      darkens[i] = Math.max(darkens[i], (lum(plate, i * 3) - lum(data, i * 4)) * a);
      for (let c = 0; c < 3; c++) differs[i] = Math.max(differs[i], Math.abs(data[i * 4 + c] - plate[i * 3 + c]) * a);
    }
  }
  const all = { px: 0 };
  const fade = { px: 0, solidPx: 0, mostItDiffersFromTheFloorOutOf255: 0, meanOutOf255: 0, mostItDarkensTheFloorOutOf255: 0, nearestTheRimPlatePx: Infinity };
  for (let y = 0; y < lead.h; y++) for (let x = 0; x < lead.w; x++) {
    const i = y * lead.w + x;
    if (!covered[i]) continue;
    all.px++;
    const px = (lead.x + x + 0.5) * k; const py = (lead.y + y + 0.5) * k;
    const din = Math.min(px, 1672 - px, py, 941 - py);
    if (din >= RIM) continue;
    fade.px++;
    if (covered[i] > 128) fade.solidPx++;
    fade.mostItDiffersFromTheFloorOutOf255 = Math.max(fade.mostItDiffersFromTheFloorOutOf255, differs[i]);
    fade.meanOutOf255 += differs[i];
    fade.mostItDarkensTheFloorOutOf255 = Math.max(fade.mostItDarkensTheFloorOutOf255, darkens[i]);
    fade.nearestTheRimPlatePx = Math.min(fade.nearestTheRimPlatePx, din);
  }
  const round = (v, to = 10) => Math.round(v * to) / to;
  const report = {
    lead: lead.actor,
    herLayerOnThePlate: [lead.x, lead.y, lead.x + lead.w, lead.y + lead.h].map((v) => round(v * k)),
    canvasPxSheEverCovers: all.px,
    insideTheRimsOwn28PxFade: {
      canvasPx: fade.px,
      shareOfAllSheCovers: round(fade.px / all.px, 10000),
      ofThoseMoreThanHalfSolid: fade.solidPx,
      mostItDiffersFromTheFloorUnderItOutOf255: round(fade.mostItDiffersFromTheFloorOutOf255),
      meanDifferenceOutOf255: round(fade.px ? fade.meanOutOf255 / fade.px : 0),
      mostItDarkensTheFloorOutOf255: round(fade.mostItDarkensTheFloorOutOf255),
      nearestTheRimPlatePx: round(fade.nearestTheRimPlatePx),
    },
  };
  // On the page: the painting's edge under those same pixels, and the close-up.
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3.2 })).newPage();
  await page.goto(`${base}?debug&reset&intro=off&seed=7#design`);
  await ready(page);
  await SCENE.design.loaded(page);
  await clean(page);
  await page.waitForTimeout(600);
  report.onThePage = await page.evaluate(async ({ box, RIM }) => {
    const { edgeAlpha, edgeSeed, edgeName } = await import('/src/engine/edge.ts');
    const { SCENES } = await import('/src/scenes/index.ts');
    const scene = SCENES.find((s) => s.id === 'design');
    const alpha = edgeAlpha('pencil', edgeSeed(edgeName(scene)), scene.keep);
    const rim = (d) => { const t = Math.min(1, Math.max(0, d / RIM)); return t * t * (3 - 2 * t); };
    // Along her layer's stretch of the bottom: the painting at each distance from the rim, at its lowest.
    const rows = {};
    for (const d of [16, 18, 20, 22, 24, 26, 28, 30, 34]) {
      let low = 1;
      for (let x = box[0] + 20; x <= box[2] - 20; x += 2) low = Math.min(low, alpha(x, 941 - d));
      rows[`${d} px from the rim`] = { thePaintingAtItsLowest: Math.round(low * 1000) / 1000, theMostTheRimAllows: Math.round(rim(d) * 1000) / 1000 };
    }
    return { edge: scene.edge ?? 0, keep: scene.keep, underHerAlongTheBottom: rows };
  }, { box: report.herLayerOnThePlate, RIM });
  await page.evaluate(() => window.__hj.scene.hold());
  await page.evaluate(() => { for (const cast of window.__hj.scene.casts) if (cast.character.el.dataset.actor !== 'fan') cast.character.show(cast.character.rest); });
  await page.waitForTimeout(200);
  const plateBox = await page.locator('.hj-plate').boundingBox();
  const u = plateBox.width / 1672;
  const clip = { x: plateBox.x + 840 * u, y: plateBox.y + 760 * u, width: 400 * u, height: 205 * u };
  await sharp(await page.screenshot({ clip })).jpeg({ quality: 92 }).toFile(`${out}shadow-close-up.jpg`);
  // The same with the mushrooms and the cast hidden: the floor she will arrive on, clean of any shadow.
  await page.evaluate(() => { document.querySelector('.hj-rachel').style.visibility = 'hidden'; });
  await page.waitForTimeout(150);
  await sharp(await page.screenshot({ clip })).jpeg({ quality: 92 }).toFile(`${out}shadow-close-up-before-she-arrives.jpg`);
  await browser.close();
  say('shadow', report);
  await save('shadow.json', report);
};

// Frame times. WebKit on the iPhone profile and Chrome with the processor slowed four times, against the
// production build (HJ_PROD, by default http://localhost:4173/: npm run build && npm run preview). A new
// visitor opens the café (its painting), then goes Build → Grow → Design → Build twice: the first lap is
// full paintings, the second the short brush. Every frame's length is logged by a loop that starts before
// the page's own script; each stretch is reported as its longest frame and how many were over 50 ms.
run.frames = async () => {
  const prod = process.env.HJ_PROD ?? 'http://localhost:4173/';
  const { execSync } = await import('node:child_process');
  const report = { machine: execSync('uptime').toString().trim(), runs: [] };
  const logger = `(() => { const w = window.__f = { gaps: [] }; let last = performance.now(); const tick = (now) => { w.gaps.push([Math.round(now - last), Math.round(now)]); last = now; requestAnimationFrame(tick); }; requestAnimationFrame(tick); })();`;
  const runs = Number(process.argv[3] ?? 3);
  for (const [name, engine, options, slow] of [['webkit, iPhone 14 profile', webkit, phone, 0], ['chrome, phone size, processor slowed 4×', chromium, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, 4]]) {
    for (let n = 0; n < runs; n++) {
      const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {});
      const context = await browser.newContext(options);
      await context.addInitScript(logger);
      const page = await context.newPage();
      if (slow) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: slow });
      const stretch = async (label, from, to) => {
        const gaps = (await page.evaluate(() => window.__f.gaps)).filter(([, at]) => at >= from && at <= to).map(([g]) => g);
        const sorted = [...gaps].sort((a, b) => a - b);
        return { stretch: label, frames: gaps.length, longestMs: Math.max(...gaps), over50: gaps.filter((g) => g > 50).length, over33: gaps.filter((g) => g > 33).length, medianMs: sorted[Math.floor(sorted.length / 2)] };
      };
      const now = () => page.evaluate(() => performance.now());
      const rows = [];
      await page.goto(`${prod}#design`);
      await page.waitForSelector('.hj-paint', { state: 'attached', timeout: 30000 });
      let from = await now();
      await page.waitForTimeout(6500);
      rows.push(await stretch('the café painted for a new visitor', from, await now()));
      from = await now();
      await page.waitForTimeout(8000);
      rows.push(await stretch('the café at work, 8 s', from, await now()));
      // Build and Grow for the first time (their full paintings), back to the café and to Build (the short
      // brush); then round once more, every switch the short brush.
      const seen = new Set(['design']);
      for (const id of ['build', 'grow', 'design', 'build', 'grow', 'design', 'build']) {
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

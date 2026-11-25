// Scene 4, "Film" (the Merlion at night): the checks of reviews/scene-4-build.md, section 8.
// Needs `npm run dev` (HJ_URL for another address). Results go to qa/scene4/.
//
//   node qa/tools/scene4.mjs shots      Film at 1440×900, 390×844 and 360×740 (as it opens, panned left, panned right), and what a phone shows first
//   node qa/tools/scene4.mjs hunt       the ten hiding places, unmarked and marked easy / medium / hard, desktop and phone; none on an actor or the camera screen
//   node qa/tools/scene4.mjs react      a find: Rachel's turn and look against routine.json; a second find during the look; one on her way back; reduced motion
//   node qa/tools/scene4.mjs presenter  60 s of the presenter: the order of his gestures, his holds, his blinks
//   node qa/tools/scene4.mjs screen     the camera's live screen: where it is, what it shows, how soon it follows; the REC dot; the water; no flicker on cuts
//   node qa/tools/scene4.mjs film       a 20 s recording with one find and one gesture each way, desktop and iPhone profile, and the first-visit painting
//   node qa/tools/scene4.mjs memory [new|return] [scene | a,b,c,d]   peak decoded-image memory on the phone profile, four scenes in every order
//   node qa/tools/scene4.mjs frames [n] frame times in WebKit (phone) and throttled Chrome: Film's painting, Film at work, and round the four scenes twice
//   node qa/tools/scene4.mjs preview    the page against the package's own picture (plate + stills, and the screen as tools/film_preview.py draws it)
import { chromium, webkit, devices } from 'playwright';
import { mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import sharp from 'sharp';

const base = process.env.HJ_URL ?? 'http://localhost:5173/';
const out = new URL(process.env.HJ_OUT ?? '../scene4/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const pkg = new URL('../../../frames/020-film-scene/', import.meta.url).pathname;
const ID = 'film';
const PLATE = { w: 1672, h: 941 };

// ---- The one place that names hiding places. Keep in step with src/scenes/film.ts. --------------------------
// Which find is which difficulty (for the circled pictures). A spot the scene has and this table does not is
// drawn grey and reported.
const LEVEL = { paving: 'easy', forecourt: 'easy', steps: 'easy', shore: 'medium', lamp: 'medium', sill: 'medium', kiosk: 'medium', wheel: 'hard', merlion: 'hard', flowers: 'hard' };
// The finds the commands make, in order (the easy ones first: clear of everything, and in every window).
// null takes the scene's own spots as the page lists them.
const FINDS = ['paving', 'steps', 'forecourt', 'shore', 'lamp', 'kiosk', 'sill', 'wheel', 'merlion', 'flowers'];
// What "both people are in frame" is measured on, in plate px (left, top, right, bottom), read off the
// package's stills: the presenter's head, Rachel's head and hair, and her camera.
const IN_FRAME = { "the presenter's head": [668, 256, 818, 428], "Rachel's head": [1130, 262, 1352, 520], "Rachel's camera": [1016, 468, 1140, 562] };
// --------------------------------------------------------------------------------------------------------------

const COLOUR = { easy: '#1f7a3a', medium: '#b06a00', hard: '#b3261e', '?': '#666666' };
const phone = { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } };
const ready = (page) => page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 40000 });
const arrived = (page, id) => page.waitForFunction((scene) => window.__hj?.scene?.config.id === scene && window.__hj.busy === false, id, { timeout: 60000 });
const clean = (page) => page.evaluate(() => document.querySelectorAll('.hj-mushrooms').forEach((el) => el.classList.remove('is-debug')));
const say = (label, value) => console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
const save = (name, data) => writeFile(`${out}${name}`, `${JSON.stringify(data, null, 1)}\n`);
const MB = (bytes) => Math.round(bytes / 1e5) / 10;
const r1 = (n) => Math.round(n * 10) / 10;
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

// What "this scene has everything it will ever hold" means, a spot to find in it (null: the first the scene
// lists that is not found yet), and the pose that shows her full reaction was played.
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
    busy: (page) => page.waitForTimeout(5000),
    spot: 'window-seat', full: 'R_K2_smile',
  },
  film: {
    // Rachel's look, and the last of the presenter's stills.
    loaded: (page) => page.waitForFunction(() => window.__hj.rachel?.has('R_K1_look') && window.__hj.scene.casts.some((cast) => cast.character.el.dataset.actor === 'presenter' && cast.character.has('M_3_closed')), null, { timeout: 90000 }),
    busy: (page) => page.waitForTimeout(5000),
    spot: null, full: 'R_K1_look',
  },
};
/** The scene's hiding places not found yet, in its own order (or FINDS, if the table at the top names them). */
const unfound = (page) => page.evaluate((finds) => {
  const scene = window.__hj.scene;
  const left = new Set([...document.querySelectorAll(`.hj-plate[data-scene="${scene.config.id}"] .hj-shroom`)].filter((b) => !b.disabled && !b.classList.contains('is-found')).map((b) => b.dataset.spot));
  return (finds ?? scene.config.spots.map((spot) => spot.id)).filter((id) => left.has(id));
}, FINDS);
/** Click a hiding place from inside the page (wherever the window is panned to), and say when, on the page's clock. */
const clickSpot = (page, id) => page.evaluate((spot) => { const at = performance.now(); document.querySelector(`.hj-plate [data-spot="${spot}"]`).click(); return Math.round(at * 10) / 10; }, id);
/** A find, and her whole answer to it. Returns whether she played the full reaction. */
const find = async (page, spot, full, touch = true) => {
  spot ??= (await unfound(page))[0];
  await page.evaluate(() => { window.__mark = window.__hj.poses.length; });
  // (Brought into the window first, as a visitor would by panning.)
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

// The presenter's routine, as the brief describes it: talk on the M_1 mouths, the in-between M_12, talk
// pointing (M_2), M_12, the M_1 mouths, the in-between M_13, hands together (M_3), M_13, and round again.
// (Since job 007 each gesture has two in-betweens: M_1_12 then M_12, M_1_13 then M_13, and back.)
const BETWEEN = ['M_1_12', 'M_12', 'M_1_13', 'M_13'];
const GROUP = (pose) => (BETWEEN.includes(pose) ? pose : pose.startsWith('M_2') ? 'M_2' : pose.startsWith('M_3') ? 'M_3' : 'M_1');
const CYCLE = ['M_1', 'M_1_12', 'M_12', 'M_2', 'M_12', 'M_1_12', 'M_1', 'M_1_13', 'M_13', 'M_3', 'M_13', 'M_1_13'];
/** Everything the brief says about him, checked on a log of his steps. `first`: the log starts as he starts (his first hold may be put off by up to 0.9 s). */
const checkPresenter = (steps, routine, first = true) => {
  const list = shown(steps).filter((s) => s.shown !== null && s.ms > 0);
  const problems = [];
  // The order of his gestures: runs of one group, round the cycle.
  const runs = [];
  for (const s of list) {
    const group = GROUP(s.pose);
    if (runs.at(-1)?.group === group) runs.at(-1).steps.push(s); else runs.push({ group, steps: [s] });
  }
  const fits = CYCLE.map((_, k) => runs.every((run, i) => run.group === CYCLE[(k + i) % CYCLE.length]));
  if (!fits.some(Boolean)) problems.push(`his gestures are out of order: ${runs.map((run) => run.group).join(' > ')}`);
  for (const run of runs) {
    if (!BETWEEN.includes(run.group)) continue;
    if (run.steps.length !== 1 || Math.abs(run.steps[0].shown - 60) > 40) problems.push(`${run.group} at ${run.steps[0].at}: shown ${run.steps.map((s) => s.shown).join(' + ')} ms, not one hold of 60`);
  }
  // Every hold inside what routine.json allows for that still (a frame either way; holds beside a blink
  // may be cut by it).
  const range = {};
  for (const item of routine.routine) for (const step of item.steps ?? [item]) { const [lo, hi] = Array.isArray(step.ms) ? step.ms : [step.ms, step.ms]; range[step.still] = [Math.min(range[step.still]?.[0] ?? Infinity, lo), Math.max(range[step.still]?.[1] ?? 0, hi)]; }
  // (One blink for all his mouths, or since the package of 15:15 a blink still for each: `still_for`.)
  const blink = [routine.blink ?? []].flat().flatMap((rule) => (rule.frames ? rule.frames.map((f) => f.still) : Object.values(rule.still_for ?? {})));
  const blinkFor = Object.assign({}, ...[routine.blink ?? []].flat().map((rule) => rule.still_for ?? {}));
  const out = [];
  // A frame that came late (the machine, not the routine): one hold overruns by it and the player makes the
  // time up on the next, as it is meant to. Listed by itself.
  const late = [];
  list.forEach((s, i) => {
    if (blink.includes(s.pose)) return;
    const beside = blink.includes(list[i - 1]?.pose) || blink.includes(list[i + 1]?.pose);
    const [lo, hi] = range[s.pose] ?? [0, 0];
    if (i === 0 && first) return;
    const over = s.shown - hi; const next = list[i + 1]; const before = list[i - 1];
    const owed = (other) => other && other.shown - (range[other.pose]?.[1] ?? 0);
    if (over > 45 && next && next.shown < (range[next.pose]?.[0] ?? 0) - 30) { late.push(`${s.pose} shown ${s.shown} ms, then ${next.pose} ${next.shown} ms`); return; }
    if (!beside && s.shown < lo - 30 && owed(before) > 45) return;
    if (over > 45 || (!beside && s.shown < lo - 30)) out.push(`${s.pose} shown ${s.shown} ms (routine: ${lo} to ${hi})`);
  });
  if (out.length) problems.push(`${out.length} hold(s) outside their range: ${out.slice(0, 6).join('; ')}`);
  const faded = list.filter((s) => s.fade > 0);
  if (faded.length) problems.push(`${faded.length} step(s) carry a dissolve: ${faded.slice(0, 3).map((s) => s.pose).join(', ')}`);
  // His blinks.
  const blinks = [];
  list.forEach((s, i) => { if (blink.includes(s.pose)) blinks.push({ at: s.at, pose: s.pose, shownMs: s.shown, before: list[i - 1]?.pose ?? null, after: list[i + 1]?.pose ?? null, msSinceTheLast: blinks.length ? r1(s.at - blinks.at(-1).at) : null }); });
  const gaps = blinks.map((b) => b.msSinceTheLast).filter((g) => g !== null);
  // About 110 ms; straight after one of his mouths, never straight out of an in-between; and the blink of a
  // mouth of the same gesture as the one before it (so his hands never jump), or of that very mouth.
  const mouths = Object.keys(blinkFor);
  const badBlink = blinks.filter((b) => {
    if (Math.abs(b.shownMs - 110) > 40) return true;
    if (!mouths.length) return (b.before && GROUP(b.before) !== 'M_1') || (b.after && !['M_1', ...BETWEEN].includes(GROUP(b.after)));
    const ofMouth = mouths.find((m) => blinkFor[m] === b.pose);
    return (b.before && !mouths.includes(b.before)) || (b.before && GROUP(b.before) !== GROUP(ofMouth));
  });
  if (badBlink.length) problems.push(`${badBlink.length} blink(s) not 110 ms on the mouth he holds: ${JSON.stringify(badBlink.slice(0, 3))}`);
  const longest = list.reduce((a, b) => (b.shown > (a?.shown ?? 0) ? b : a), null);
  const seen = {};
  for (const s of list) seen[s.pose] = (seen[s.pose] ?? 0) + 1;
  return {
    steps: list.length, seconds: list.length ? r1((list.at(-1).at - list[0].at) / 1000) : 0,
    gestures: runs.map((run) => run.group).join(' > '),
    timesEachPoseWasShown: seen,
    inBetweens: runs.filter((run) => BETWEEN.includes(run.group)).map((run) => `${run.group} ${run.steps[0].shown} ms`),
    blinks: { count: blinks.length, gapsMs: gaps, shortestGapMs: gaps.length ? Math.min(...gaps) : null, longestGapMs: gaps.length ? Math.max(...gaps) : null, meanGapMs: gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null, each: blinks },
    longestHold: longest && { pose: longest.pose, ms: longest.shown },
    lateFramesMadeUp: late,
    anyDissolve: faded.length > 0,
    problems,
  };
};
const routineOf = async () => JSON.parse(await readFile(`${pkg}site/routine.json`, 'utf8'));
const framesOf = async () => JSON.parse(await readFile(`${pkg}site/frames.json`, 'utf8'));

const run = {};

// Screenshots, with no markers: Film on desktop, and on two phones as it opens and panned to each end. And
// what a phone shows as the scene opens: which stretch of the plate, and whether both people are in it.
run.shots = async () => {
  const errors = [];
  const report = {};
  {
    const browser = await launch(chromium);
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    errors.push(...errorsOf(page));
    await page.goto(`${base}?debug&reset&intro=off&seed=7#${ID}`);
    await ready(page);
    await SCENE.film.loaded(page);
    await clean(page);
    await page.waitForTimeout(800);
    await sharp(await page.screenshot()).jpeg({ quality: 90 }).toFile(`${out}film-1440x900.jpg`);
    report['1440x900'] = { tabs: await page.evaluate(() => [...document.querySelectorAll('.hj-tab')].map((t) => t.textContent.trim())) };
    await browser.close();
  }
  const browser = await launch(webkit);
  for (const [w, h] of [[390, 844], [360, 740]]) {
    const page = await (await browser.newContext({ ...devices['iPhone 14'], viewport: { width: w, height: h } })).newPage();
    errors.push(...errorsOf(page));
    await page.goto(`${base}?debug&reset&intro=off&seed=7#${ID}`);
    await ready(page);
    await SCENE.film.loaded(page);
    await clean(page);
    await page.waitForTimeout(800);
    const seen = () => page.evaluate((W) => { const v = document.querySelector('.hj-viewport').getBoundingClientRect(); const p = document.querySelector('.hj-plate[data-scene="film"]').getBoundingClientRect(); return [Math.round(((v.left - p.left) / p.width) * W), Math.round(((v.right - p.left) / p.width) * W)]; }, PLATE.w);
    const rows = {};
    for (const pan of ['', '-left', '-right']) {
      if (pan) await page.evaluate((side) => { const v = document.querySelector('.hj-viewport'); v.scrollLeft = side === '-left' ? 0 : v.scrollWidth; }, pan);
      await page.waitForTimeout(400);
      await sharp(await page.screenshot()).jpeg({ quality: 90 }).toFile(`${out}film-${w}x${h}${pan}.jpg`);
      rows[pan || 'as it opens'] = await seen();
    }
    const [from, to] = rows['as it opens'];
    report[`${w}x${h}`] = {
      plateXShownAsItOpens: [from, to], shareOfThePlate: `${Math.round((from / PLATE.w) * 100)}% to ${Math.round((to / PLATE.w) * 100)}%`, theBriefAsksForAbout: [620, 1420],
      inFrameAsItOpens: Object.fromEntries(Object.entries(IN_FRAME).map(([what, [l, , r]]) => [what, l >= from && r <= to ? 'all of it' : r <= from || l >= to ? 'none of it' : `cut: plate x ${l} to ${r} against the window's ${from} to ${to}`])),
      pannedLeft: rows['-left'], pannedRight: rows['-right'],
      menuFitsOnOneLine: await page.evaluate(() => { const tabs = [...document.querySelectorAll('.hj-tab')].map((t) => t.getBoundingClientRect()); return tabs.every((t) => Math.abs(t.top - tabs[0].top) < 2) && tabs.at(-1).right <= window.innerWidth; }),
    };
    say(`film-${w}x${h}`, report[`${w}x${h}`]);
    await page.close();
  }
  await browser.close();
  report.errors = errors;
  await save('shots.json', report);
  say('console errors', errors.length ? errors : 'none');
};

// The hunt, for looking at: the ten hiding places with no markers, and the same pictures with each one
// circled and named easy, medium or hard. Desktop, and a 390 × 844 phone panned left, centre and right. Each
// hard one cut out at the size a phone shows it. And, worked out in the page from the package's own layers:
// no mushroom's drawing touches an actor's layer or the camera's screen.
run.hunt = async () => {
  const levelOf = (id) => LEVEL[id] ?? '?';
  const marked = async (page, png, scale) => {
    const spots = await page.evaluate(() => [...document.querySelectorAll('.hj-plate[data-scene="film"] .hj-shroom')].map((b) => { const r = b.querySelector('.hj-shroom-art').getBoundingClientRect(); return { id: b.dataset.spot, x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.max(r.width, r.height) / 2 }; }));
    const size = await sharp(png).metadata();
    const view = page.viewportSize();
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}">`;
    for (const spot of spots) {
      if (spot.x < 0 || spot.x > view.width) continue;
      const level = levelOf(spot.id);
      const x = spot.x * scale; const y = spot.y * scale; const r = (spot.r + 9) * scale;
      svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${COLOUR[level]}" stroke-width="${2.5 * scale}"/>`;
      svg += `<rect x="${x - 46 * scale}" y="${y - r - 19 * scale}" width="${92 * scale}" height="${16 * scale}" rx="${3 * scale}" fill="rgba(255,255,255,0.88)"/><text x="${x}" y="${y - r - 7 * scale}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="${11 * scale}" fill="${COLOUR[level]}">${spot.id}: ${level}</text>`;
    }
    return sharp(png).composite([{ input: Buffer.from(`${svg}</svg>`) }]).jpeg({ quality: 90 }).toBuffer();
  };
  const boxes = (page) => page.evaluate(() => [...document.querySelectorAll('.hj-plate[data-scene="film"] .hj-shroom')].map((b) => { const r = b.getBoundingClientRect(); const a = b.querySelector('.hj-shroom-art').getBoundingClientRect(); return { id: b.dataset.spot, tapBox: [Math.round(r.width), Math.round(r.height)], drawingPx: [Math.round(a.width * 10) / 10, Math.round(a.height * 10) / 10] }; }));
  const checks = {};
  {
    const browser = await launch(chromium);
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
    await page.goto(`${base}?debug&reset&intro=off&seed=7#${ID}`);
    await ready(page);
    await SCENE.film.loaded(page);
    await page.getByRole('button', { name: 'Pause animation' }).click();
    await clean(page);
    await page.waitForTimeout(500);
    const png = await page.screenshot();
    await sharp(png).jpeg({ quality: 90 }).toFile(`${out}hunt-desktop.jpg`);
    await writeFile(`${out}hunt-desktop-circled.jpg`, await marked(page, png, 2));
    checks.desktop = await boxes(page);
    // Each drawing's box in plate px, against every layer's box and every place the camera's screen can be.
    checks.offTheCast = await page.evaluate(async (W) => {
      const scene = window.__hj.scene;
      const frames = await (await fetch(`./assets/${scene.config.assets}${scene.config.character.dir}${scene.config.character.frames}`)).json();
      const k = W / frames.canvas.w;
      const plate = document.querySelector('.hj-plate[data-scene="film"]').getBoundingClientRect();
      const u = W / plate.width;
      const areas = [...frames.layers.map((l) => [`${l.actor}'s layer`, l.x * k, l.y * k, (l.x + l.w) * k, (l.y + l.h) * k]), ...Object.entries(frames.camera_screen?.rect_by_still ?? {}).map(([still, r]) => [`the camera screen on ${still}`, r.x * k, r.y * k, (r.x + r.w) * k, (r.y + r.h) * k])];
      const rows = [...document.querySelectorAll('.hj-plate[data-scene="film"] .hj-shroom')].map((b) => {
        const a = b.querySelector('.hj-shroom-art').getBoundingClientRect();
        const box = [(a.left - plate.left) * u, (a.top - plate.top) * u, (a.right - plate.left) * u, (a.bottom - plate.top) * u];
        const on = areas.filter(([, l, t, r, bt]) => box[0] < r && box[2] > l && box[1] < bt && box[3] > t).map(([what]) => what);
        // How far it is from the nearest layer (0 or less: touching).
        const gap = Math.min(...areas.map(([, l, t, r, bt]) => Math.max(l - box[2], box[0] - r, t - box[3], box[1] - bt)));
        return { id: b.dataset.spot, drawingPlatePx: box.map((v) => Math.round(v)), on, platePxFromTheNearestLayer: Math.round(gap) };
      });
      return { layers: areas.map(([what, ...r]) => [what, ...r.map((v) => Math.round(v))]), spots: rows, noneOnAnActorOrTheScreen: rows.every((r) => r.on.length === 0) };
    }, PLATE.w);
    await browser.close();
  }
  const browser = await launch(webkit);
  const page = await (await browser.newContext(phone)).newPage();
  await page.goto(`${base}?debug&reset&intro=off&seed=7#${ID}`);
  await ready(page);
  await SCENE.film.loaded(page);
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
  const ids = await page.evaluate(() => window.__hj.scene.config.spots.map((spot) => spot.id));
  // Each hard one, as a phone shows it: the screen around it at the phone's own size (no enlargement).
  for (const f of await readdir(out)) if (/^hunt-phone-hard-.*-at-phone-size\.jpg$/.test(f)) await rm(`${out}${f}`);
  for (const id of ids.filter((spot) => levelOf(spot) === 'hard')) {
    await page.evaluate((spot) => { const v = document.querySelector('.hj-viewport'); const r = document.querySelector(`.hj-plate [data-spot="${spot}"]`).getBoundingClientRect(); const vr = v.getBoundingClientRect(); v.scrollLeft += r.left + r.width / 2 - (vr.left + vr.width / 2); }, id);
    await page.waitForTimeout(400);
    const box = await page.locator(`.hj-plate [data-spot="${id}"] .hj-shroom-art`).boundingBox();
    const clip = { x: Math.max(0, Math.min(390 - 260, box.x + box.width / 2 - 130)), y: Math.max(0, box.y + box.height / 2 - 100), width: 260, height: 200 };
    await sharp(await page.screenshot({ clip })).jpeg({ quality: 92 }).toFile(`${out}hunt-phone-hard-${id}-at-phone-size.jpg`);
  }
  checks.phone = await boxes(page);
  // Tab order, and whether any two tap boxes overlap on the phone.
  checks.tabOrder = ids;
  checks.overlapsOnThePhone = await page.evaluate(() => { const all = [...document.querySelectorAll('.hj-plate[data-scene="film"] .hj-shroom')].map((b) => [b.dataset.spot, b.getBoundingClientRect()]); const hits = []; for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { const [a, ra] = all[i]; const [b, rb] = all[j]; if (ra.left < rb.right && rb.left < ra.right && ra.top < rb.bottom && rb.top < ra.bottom) hits.push(`${a}/${b}`); } return hits; });
  checks.levels = Object.fromEntries(ids.map((id) => [id, levelOf(id)]));
  checks.notInTheToolsTable = ids.filter((id) => !(id in LEVEL));
  const count = (level) => ids.filter((id) => levelOf(id) === level).length;
  await browser.close();
  await save('hunt-checks.json', checks);
  say('hunt', { spots: ids.length, easyMediumHard: [count('easy'), count('medium'), count('hard')], smallestTapBoxDesktop: Math.min(...checks.desktop.flatMap((s) => s.tapBox)), smallestTapBoxPhone: Math.min(...checks.phone.flatMap((s) => s.tapBox)), overlapsOnThePhone: checks.overlapsOnThePhone, noneOnAnActorOrTheScreen: checks.offTheCast.noneOnAnActorOrTheScreen, nearestToALayerPx: Math.min(...checks.offTheCast.spots.map((s) => s.platePxFromTheNearestLayer)), notInTheToolsTable: checks.notInTheToolsTable, tabOrder: ids.join(', ') });
};

// A find: what Rachel does, step by step, against routine.json (R_K0_turn 90 ms, R_K1_look 1.6 to 2.0 s,
// R_K0_turn 90 ms, R_A1_film). Then a second find while she is looking: the look is held longer and she never
// turns twice. Then one as she turns back, and one in the hold after it: nothing new. The presenter carries
// on through all of it. Desktop Chrome and the iPhone profile; and with reduced motion, where the answer is
// one held look, the camera's screen is a still copy and the dot stays lit.
run.react = async () => {
  const routine = (await routineOf()).actors;
  const report = [];
  for (const [name, engine, options] of [['chrome, 1440 × 900', chromium, { viewport: { width: 1440, height: 900 } }], ['webkit, iPhone 14 profile', webkit, phone], ['chrome, reduced motion', chromium, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }]]) {
    const browser = await launch(engine);
    const page = await (await browser.newContext(options)).newPage();
    const errors = errorsOf(page);
    await page.goto(`${base}?debug&reset&intro=off&seed=7#${ID}`);
    await ready(page);
    await SCENE.film.loaded(page);
    await hookSteps(page);
    await page.waitForTimeout(2200);
    const spots = await unfound(page);
    const settled = () => page.waitForFunction(() => !window.__hj.player.reacting, null, { timeout: 20000 });
    const hers = async (from) => shown(await stepsOf(page, 'rachel'), from);
    const line = (steps, t0) => steps.map((s) => `${r1(s.at - t0)} ms: ${s.pose}${s.shown === null ? '' : `, shown ${s.shown} ms`}`);
    const rowOut = { browser: name, hasProlong: await page.evaluate(() => typeof window.__hj.player.prolong === 'function'), sceneAsksToHoldTheLook: await page.evaluate(() => window.__hj.scene.config.again ?? null) };

    // 1. One find.
    const t0 = await clickSpot(page, spots[0]);
    await settled();
    await page.waitForTimeout(900);
    const one = await hers(t0);
    rowOut.aFind = { thenShe: line(one, t0), msFromTheFindToHerFirstMove: one.length ? r1(one[0].at - t0) : null, posesSheMissed: await page.evaluate(() => window.__hj.rachel.missed) };
    if (!options.reducedMotion) {
      const [k0, k1, back, home] = one;
      const want = routine.rachel.reaction.steps;
      rowOut.aFind.asRoutineJsonSays = one.slice(0, 4).map((s) => s.pose).join(' > ') === want.map((s) => s.still).join(' > ')
        && Math.abs(k0.shown - 90) <= 40 && k1.shown >= 1600 - 30 && k1.shown <= 2000 + 45 && Math.abs(back.shown - 90) <= 40 && home.shown >= 500 - 30;
      rowOut.aFind.shownMs = { R_K0_turn: k0?.shown, R_K1_look: k1?.shown, R_K0_turnBack: back?.shown, R_A1_film: home?.shown };

      // 2. A second find, 800 ms into her look.
      await page.waitForTimeout(1200);
      const tA = await clickSpot(page, spots[1]);
      await page.waitForFunction(() => window.__hj.rachel.current === 'R_K1_look', null, { timeout: 5000 });
      await page.waitForTimeout(800);
      const tB = await clickSpot(page, spots[2]);
      await settled();
      await page.waitForTimeout(900);
      const two = await hers(tA);
      const looks = two.filter((s) => s.pose === 'R_K1_look');
      const turns = two.filter((s) => s.pose === 'R_K0_turn');
      const lookFrom = looks[0]?.at;
      const lookTo = looks.length ? looks.at(-1).at + looks.at(-1).shown : null;
      rowOut.aSecondFindDuringTheLook = {
        secondFindMsIntoTheLook: lookFrom ? r1(tB - lookFrom) : null, thenShe: line(two, tA),
        theLookWasShownMs: lookFrom ? r1(lookTo - lookFrom) : null, msOfLookAfterTheSecondFind: lookTo ? r1(lookTo - tB) : null,
        turns: turns.length, noSecondTurn: turns.length === 2 && two.slice(0, 3).map((s) => s.pose).join(' > ') === 'R_K0_turn > R_K1_look > R_K0_turn',
        theLookWasExtended: lookTo !== null && lookTo - tB >= 1600 - 30 && lookTo - lookFrom > 2000 + 45,
      };

      // 3. A find as she turns back (the closing R_K0_turn), and one in the hold after it. Clicked from inside
      // the page, on the frame the pose is first seen.
      const during = async (label, when, first, second) => {
        await page.waitForTimeout(1200);
        const before = await page.evaluate(() => window.__hj.hunt.remaining);
        const tC = await clickSpot(page, first);
        const tD = await page.evaluate(({ spot, test }) => new Promise((resolve) => {
          const cond = new Function('steps', `return ${test}`);
          const t0 = performance.now();
          const tick = () => {
            if (cond(window.__steps.rachel)) { const at = performance.now(); document.querySelector(`.hj-plate [data-spot="${spot}"]`).click(); resolve(Math.round(at * 10) / 10); return; }
            if (performance.now() - t0 > 8000) { resolve(null); return; }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }), { spot: second, test: when });
        await settled();
        await page.waitForTimeout(1500);
        const all = await hers(tC);
        const at = all.findLast((s) => s.at <= tD);
        rowOut[label] = { landedOn: at ? `${at.pose}, ${r1(tD - at.at)} ms into it` : null, thenShe: line(all, tC), turns: all.filter((s) => s.pose === 'R_K0_turn').length, looks: all.filter((s) => s.pose === 'R_K1_look').length, nothingNew: all.filter((s) => s.pose === 'R_K0_turn').length === 2 && all.filter((s) => s.pose === 'R_K1_look').length === 1, bothFindsCounted: (await page.evaluate(() => window.__hj.hunt.remaining)) === before - 2 };
      };
      await during('aFindAsSheTurnsBack', `steps.at(-1)?.[0] === 'R_K0_turn' && steps.at(-2)?.[0] === 'R_K1_look'`, spots[3], spots[4]);
      await during('aFindInTheHoldAfter', `steps.at(-1)?.[0] === 'R_A1_film' && steps.at(-2)?.[0] === 'R_K0_turn' && steps.at(-3)?.[0] === 'R_K1_look' && performance.now() - steps.at(-1)[3] > 120`, spots[5], spots[6]);

      // The presenter, all the while: still on his routine, never answering.
      const his = checkPresenter(await stepsOf(page, 'presenter'), routine.presenter);
      rowOut.thePresenterMeanwhile = { steps: his.steps, seconds: his.seconds, gestures: his.gestures, blinks: his.blinks.count, problems: his.problems, heNeverReacts: his.problems.length === 0 };
    } else {
      rowOut.aFind.oneHeldLook = one.filter((s) => s.pose === 'R_K1_look').length === 1 && !one.some((s) => s.pose === 'R_K0_turn');
      rowOut.aFind.theLookWasShownMs = one.find((s) => s.pose === 'R_K1_look')?.shown ?? null;
      // The camera's screen: a still copy, the dot lit all the time. Every frame for 2.4 s (more than two beats).
      rowOut.theScreen = await page.evaluate(() => new Promise((resolve) => {
        const finder = document.querySelector('canvas.hj-finder');
        const ctx = finder.getContext('2d', { willReadFrequently: true });
        const scene = window.__hj.scene;
        const rects = scene.casts.find((cast) => cast.screen).screen.rects;
        const seen = new Set(); let lit = 0; let frames = 0; const poses = new Set();
        const t0 = performance.now();
        const tick = () => {
          const d = ctx.getImageData(0, 0, finder.width, finder.height).data;
          let sum = 0;
          for (let i = 0; i < d.length; i += 4) sum = (sum * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0;
          seen.add(sum);
          const u = finder.width / (rects[window.__hj.rachel.current].w - 4);
          const c = Math.floor(5 * u); const i = (c * finder.width + c) * 4;
          if (d[i] > 170 && d[i + 1] < 100 && d[i + 2] < 100) lit++;
          frames++;
          for (const cast of scene.casts) poses.add(`${cast.character.el.dataset.actor}:${cast.character.current}`);
          if (performance.now() - t0 < 2400) requestAnimationFrame(tick); else resolve({ framesRead: frames, differentPicturesSeen: seen.size, framesWithTheDotLit: lit, posesSeen: [...poses], aStillCopy: seen.size === 1, theDotStaysLit: lit === frames });
        };
        requestAnimationFrame(tick);
      }));
    }
    rowOut.mushroomsLeft = await page.evaluate(() => window.__hj.hunt.remaining);
    rowOut.errors = errors;
    report.push(rowOut);
    say(name, rowOut);
    await browser.close();
  }
  await save('react.json', report);
};

// The presenter, for a minute: every pose and how long it was held, the order of his gestures, his blinks.
run.presenter = async () => {
  const routine = (await routineOf()).actors.presenter;
  const seconds = Number(process.argv[3] ?? 60);
  const report = [];
  for (const [name, engine, options] of [['chrome, 1440 × 900', chromium, { viewport: { width: 1440, height: 900 } }], ['webkit, iPhone 14 profile', webkit, phone]]) {
    const browser = await launch(engine);
    const page = await (await browser.newContext(options)).newPage();
    const errors = errorsOf(page);
    await page.goto(`${base}?debug&reset&intro=off&seed=7#${ID}`);
    await ready(page);
    await SCENE.film.loaded(page);
    await hookSteps(page);
    await page.waitForTimeout(seconds * 1000);
    const steps = await stepsOf(page, 'presenter');
    // (The log starts mid-hold: its first step is whatever came next, not his delayed first move.)
    const his = checkPresenter(steps, routine, false);
    const rowOut = { browser: name, ...his, steps: undefined, stepsLogged: his.steps, everyStep: shown(steps).map((s) => `${s.pose} ${s.shown ?? '…'}`).join(', '), errors, ok: his.problems.length === 0 && errors.length === 0 };
    report.push(rowOut);
    say(name, { seconds: his.seconds, steps: his.steps, gestures: his.gestures, inBetweens: his.inBetweens, blinks: his.blinks.count, blinkGapsMs: his.blinks.gapsMs, blinksBeside: his.blinks.each.map((b) => `${b.before} > blink ${b.shownMs} > ${b.after}`), longestHold: his.longestHold, lateFramesMadeUp: his.lateFramesMadeUp, anyDissolve: his.anyDissolve, problems: his.problems });
    await browser.close();
  }
  await save('presenter.json', report);
};

// The camera's live screen.
//   1. Where it is, on each of Rachel's stills: the rectangle frames.json gives, 2 px in on every side.
//   2. What it shows: the part of the scene the package names (the room, the water, the presenter), put
//      together independently here and scaled down, against the screen's own pixels.
//   3. How soon: read every frame for 20 s with a find in it. Whenever the water or the presenter changes
//      pose, the screen's picture must change in that frame or the next; and it must not change otherwise.
//   4. The REC dot: lit 500 ms, dark 500 ms, evenly, straight through her reaction.
//   5. The water: a new frame every 110 ms, round and round, with no hitch.
//   6. No flicker on cuts: a point that is solid in every still of the presenter, and one of Rachel's, read
//      from their canvases every frame, is never clear.
run.screen = async () => {
  const frames = await framesOf();
  const report = [];
  for (const [name, engine, options] of [['chrome, 1440 × 900, 2×', chromium, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }], ['webkit, iPhone 14 profile', webkit, phone]]) {
    const browser = await launch(engine);
    const page = await (await browser.newContext(options)).newPage();
    const errors = errorsOf(page);
    await page.goto(`${base}?debug&reset&intro=off&seed=7#${ID}`);
    await ready(page);
    await SCENE.film.loaded(page);
    await clean(page);
    const rowOut = { browser: name };

    // 3 to 6 first, on the scene at work: a sampler on the page's own frames. (It asks for its frame after
    // the players have asked for theirs, so each frame it sees what they have just drawn.)
    await page.evaluate(() => {
      const scene = window.__hj.scene;
      const by = Object.fromEntries(scene.casts.map((cast) => [cast.character.el.dataset.actor, cast.character]));
      const rects = scene.casts.find((cast) => cast.screen).screen.rects;
      const finder = document.querySelector('canvas.hj-finder');
      const fctx = finder.getContext('2d', { willReadFrequently: true });
      const canvasOf = (actor) => by[actor].el.querySelector('canvas:not(.hj-finder)');
      // A point that is solid in every still of an actor, as a fraction of her canvas: nearest the middle.
      const solidPoint = (character) => {
        const all = [...character.frames.values()];
        const w = all[0].width; const h = all[0].height;
        const scratch = document.createElement('canvas'); scratch.width = w; scratch.height = h;
        const ctx = scratch.getContext('2d', { willReadFrequently: true });
        const least = new Uint8Array(w * h).fill(255);
        for (const frame of all) { ctx.clearRect(0, 0, w, h); ctx.drawImage(frame, 0, 0); const d = ctx.getImageData(0, 0, w, h).data; for (let i = 0; i < w * h; i++) least[i] = Math.min(least[i], d[i * 4 + 3]); }
        let best = null;
        for (let y = 8; y < h - 8; y += 4) for (let x = 8; x < w - 8; x += 4) {
          let solid = true;
          for (let dy = -6; dy <= 6 && solid; dy += 3) for (let dx = -6; dx <= 6 && solid; dx += 3) solid = least[(y + dy) * w + x + dx] === 255;
          if (!solid) continue;
          const far = (x / w - 0.5) ** 2 + (y / h - 0.42) ** 2;
          if (!best || far < best.far) best = { far, x: x / w, y: y / h };
        }
        return best && [best.x, best.y];
      };
      const solid = { presenter: solidPoint(by.presenter), rachel: solidPoint(by.rachel) };
      const alphaAt = (actor) => { const c = canvasOf(actor); if (!c.width || !solid[actor]) return -1; return c.getContext('2d').getImageData(Math.floor(solid[actor][0] * c.width), Math.floor(solid[actor][1] * c.height), 1, 1).data[3]; };
      const w = (window.__s = { frames: [], stop: false, solid });
      const tick = (now) => {
        if (w.stop) return;
        const pose = [by.water.current, by.presenter.current, by.rachel.current];
        let sum = 0; let dot = -1;
        const rect = rects[pose[2]];
        if (finder.width && rect && finder.style.display !== 'none') {
          const d = fctx.getImageData(0, 0, finder.width, finder.height).data;
          const u = finder.width / (rect.w - 4);
          // (Only the dot's own square is left out of the picture's sum: the water shows in that same corner
          // of the screen, around the dot.)
          const d0 = Math.floor(2 * u) - 1; const d1 = Math.ceil(8 * u) + 1;
          for (let y = 0; y < finder.height; y++) for (let x = 0; x < finder.width; x++) { if (x >= d0 && x <= d1 && y >= d0 && y <= d1) continue; const i = (y * finder.width + x) * 4; sum = (sum * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0; }
          const c = Math.floor(5 * u); const i = (c * finder.width + c) * 4;
          dot = d[i] > 170 && d[i + 1] < 100 && d[i + 2] < 100 ? 1 : 0;
        }
        w.frames.push([Math.round(now * 10) / 10, ...pose, sum, dot, alphaAt('presenter'), alphaAt('rachel')]);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.waitForTimeout(8000);
    const spot = (await unfound(page))[0];
    const foundAt = await clickSpot(page, spot);
    await page.waitForTimeout(12200);
    const { rows, solid } = await page.evaluate(() => { window.__s.stop = true; return { rows: window.__s.frames, solid: window.__s.solid }; });
    {
      // 3. Under her: the water (index 1) and the presenter (2). Her own pose (3) moves the screen.
      let under = 0; let sameFrame = 0; let nextFrame = 0; let later = 0; let never = 0; let unasked = 0;
      const changed = rows.map((f, i) => i > 0 && f[4] !== rows[i - 1][4]);
      const moved = rows.map((f, i) => i > 0 && (f[1] !== rows[i - 1][1] || f[2] !== rows[i - 1][2]));
      // Her own pose moves the screen only when its rectangle is elsewhere on the new still (her look).
      const rects = frames.camera_screen.rect_by_still;
      const hers = rows.map((f, i) => i > 0 && f[3] !== rows[i - 1][3]);
      const herMoves = rows.flatMap((f, i) => (hers[i] ? [{ change: `${rows[i - 1][3]} > ${f[3]}`, theScreenMoves: JSON.stringify(rects[rows[i - 1][3]]) !== JSON.stringify(rects[f[3]]), pictureChangedInThatFrame: changed[i], somethingUnderItChangedInThatFrameToo: moved[i] }] : []));
      const lateBy = [];
      rows.forEach((f, i) => {
        if (!moved[i]) return;
        under++;
        if (changed[i]) sameFrame++;
        else if (changed[i + 1] && !moved[i + 1]) nextFrame++;
        else {
          let n = 2; while (n <= 6 && !(changed[i + n])) n++;
          if (n <= 6) { later++; lateBy.push(`${rows[i - 1][2]} > ${f[2]} / ${rows[i - 1][1]} > ${f[1]}: ${n} frames`); } else never++;
        }
      });
      rows.forEach((f, i) => { if (changed[i] && !moved[i] && !moved[i - 1] && !hers[i]) unasked++; });
      rowOut.live = { framesRead: rows.length, seconds: r1((rows.at(-1)[0] - rows[0][0]) / 1000), poseChangesUnderIt: under, screenChangedInTheSameFrame: sameFrame, inTheNextFrame: nextFrame, later, laterExamples: lateBy.slice(0, 5), poseChangesThatDidNotChangeThePicture: never, changesWithNothingUnderItChanging: unasked, herOwnPoseChanges: herMoves, ok: later === 0 && never === 0 && unasked === 0 && herMoves.every((m) => m.theScreenMoves || !m.pictureChangedInThatFrame || m.somethingUnderItChangedInThatFrameToo) };
      // 4. The dot: stretches lit and dark.
      const runs = [];
      for (const f of rows) { if (f[5] < 0) continue; if (runs.at(-1)?.lit === f[5]) runs.at(-1).to = f[0]; else runs.push({ lit: f[5], from: f[0], to: f[0] }); }
      const whole = runs.slice(1, -1).map((r, i) => ({ lit: r.lit, ms: r1(runs[i + 2].from - r.from) }));
      const reacting = rows.filter((f) => f[3] !== 'R_A1_film');
      rowOut.theDot = {
        stretches: whole.length, litMs: whole.filter((r) => r.lit).map((r) => r.ms), darkMs: whole.filter((r) => !r.lit).map((r) => r.ms),
        shortestMs: Math.min(...whole.map((r) => r.ms)), longestMs: Math.max(...whole.map((r) => r.ms)),
        beatsDuringHerReaction: runs.filter((r) => r.from >= (reacting[0]?.[0] ?? Infinity) && r.from <= (reacting.at(-1)?.[0] ?? -Infinity)).length,
        even: whole.length >= 30 && whole.every((r) => Math.abs(r.ms - 500) <= 40),
      };
      // 5. The water.
      const water = rows.filter((f, i) => i > 0 && f[1] !== rows[i - 1][1]);
      const gaps = water.slice(1).map((f, i) => r1(f[0] - water[i][0]));
      const order = water.map((f) => f[1]);
      const sorted = [...gaps].sort((a, b) => a - b);
      rowOut.theWater = { changes: water.length, shortestGapMs: sorted[0], medianGapMs: sorted[Math.floor(sorted.length / 2)], longestGapMs: sorted.at(-1), meanGapMs: r1(gaps.reduce((a, b) => a + b, 0) / gaps.length), gapsOver150: gaps.filter((g) => g > 150).length, roundAndRound: order.every((p, i) => i === 0 || p === { W_1: 'W_2', W_2: 'W_3', W_3: 'W_1' }[order[i - 1]]), ok: sorted.at(-1) <= 150 && Math.abs(gaps.reduce((a, b) => a + b, 0) / gaps.length - 110) <= 2 };
      // 6. No flicker.
      rowOut.noFlicker = { solidPointOfEach: solid, framesRead: rows.length, lowestAlphaUnderThePresentersPoint: Math.min(...rows.map((f) => f[6])), lowestAlphaUnderRachelsPoint: Math.min(...rows.map((f) => f[7])), herPosesSeen: [...new Set(rows.map((f) => f[3]))], hisPosesSeen: [...new Set(rows.map((f) => f[2]))].length, neverClear: rows.every((f) => f[6] === 255 && f[7] === 255) };
      rowOut.aFindAt = `${r1((foundAt - rows[0][0]) / 1000)} s into the reading`;
    }

    // 1 and 2 on the scene held still.
    await page.waitForFunction(() => !window.__hj.player.reacting, null, { timeout: 20000 });
    await page.evaluate(() => { window.__hj.scene.hold(); const f = window.__hj.scene.finder; f.lit = true; f.draw(); });
    rowOut.where = {};
    for (const [still, rect] of Object.entries(frames.camera_screen.rect_by_still)) {
      const got = await page.evaluate(({ pose, W }) => {
        window.__hj.rachel.show(pose);
        const f = document.querySelector('canvas.hj-finder').getBoundingClientRect();
        const p = document.querySelector('.hj-plate[data-scene="film"]').getBoundingClientRect();
        const u = W / p.width;
        return { box: [(f.left - p.left) * u, (f.top - p.top) * u, f.width * u, f.height * u], canvasPx: [document.querySelector('canvas.hj-finder').width, document.querySelector('canvas.hj-finder').height], cssPx: [Math.round(f.width * 10) / 10, Math.round(f.height * 10) / 10] };
      }, { pose: still, W: PLATE.w });
      const k = PLATE.w / frames.canvas.w;
      const want = [(rect.x + 2) * k, (rect.y + 2) * k, (rect.w - 4) * k, (rect.h - 4) * k];
      const off = got.box.map((v, i) => r1(v - want[i]));
      rowOut.where[still] = { wantedPlatePx: want, onThePagePlatePx: got.box.map(r1), offBy: off, canvasPx: got.canvasPx, cssPx: got.cssPx, withinHalfAPlatePx: off.every((d) => Math.abs(d) <= 0.5) };
    }
    // Her three stills, held, for looking at (the turn is on screen for 90 ms: a recording may miss it).
    {
      const stills = [];
      for (const still of Object.keys(frames.camera_screen.rect_by_still)) {
        const clip = await page.evaluate((pose) => { window.__hj.rachel.show(pose); const r = document.querySelector('.hj-plate[data-scene="film"] [data-actor="rachel"]').getBoundingClientRect(); const v = document.querySelector('.hj-viewport').getBoundingClientRect(); const left = Math.max(v.left, r.left - 30); return { x: left, y: r.top - 10, width: Math.min(v.right, r.right + 10) - left, height: r.height * 0.62 }; }, still);
        await page.waitForTimeout(120);
        stills.push(await sharp(await page.screenshot({ clip })).resize({ height: 460 }).png().toBuffer());
      }
      await row(`${name}: Rachel on ${Object.keys(frames.camera_screen.rect_by_still).join(', ')}, with the camera's screen where each still has it`, stills, `${out}screen-her-stills-${name.startsWith('chrome') ? 'chrome' : 'webkit'}.jpg`);
    }
    await page.evaluate(() => window.__hj.rachel.show('R_A1_film'));
    rowOut.what = {};
    const pictures = [];
    for (const [label, poses] of [['talking, hands open', { presenter: 'M_1', water: 'W_1' }], ['mouth closed', { presenter: 'M_1_closed', water: 'W_2' }], ['pointing', { presenter: 'M_2', water: 'W_3' }], ['hands together', { presenter: 'M_3', water: 'W_1' }], ['the in-between', { presenter: 'M_12', water: 'W_2' }]]) {
      const got = await page.evaluate(async ({ poses, W }) => {
        const scene = window.__hj.scene;
        for (const cast of scene.casts) { const actor = cast.character.el.dataset.actor; if (poses[actor]) cast.character.show(poses[actor]); }
        const fr = await (await fetch(`./assets/${scene.config.assets}${scene.config.character.dir}${scene.config.character.frames}`)).json();
        const k = W / fr.canvas.w;
        const src = fr.camera_screen.source; const S = { x: src.x * k, y: src.y * k, w: src.w * k, h: src.h * k };
        const holder = scene.casts.findIndex((cast) => cast.screen);
        const finder = document.querySelector('canvas.hj-finder');
        const ref = document.createElement('canvas'); ref.width = Math.round(S.w); ref.height = Math.round(S.h);
        const rc = ref.getContext('2d');
        const room = document.querySelector('.hj-plate[data-scene="film"] .hj-room'); const rk = room.naturalWidth / W;
        rc.drawImage(room, S.x * rk, S.y * rk, S.w * rk, S.h * rk, 0, 0, ref.width, ref.height);
        for (const cast of scene.casts.slice(0, holder)) {
          const layer = fr.layers.find((l) => l.actor === cast.character.el.dataset.actor);
          const L = { x: layer.x * k, y: layer.y * k, w: layer.w * k, h: layer.h * k };
          const c = cast.character.el.querySelector('canvas');
          const l = Math.max(S.x, L.x); const t = Math.max(S.y, L.y); const r = Math.min(S.x + S.w, L.x + L.w); const b = Math.min(S.y + S.h, L.y + L.h);
          if (r <= l || b <= t || !c.width) continue;
          rc.drawImage(c, ((l - L.x) * c.width) / L.w, ((t - L.y) * c.height) / L.h, ((r - l) * c.width) / L.w, ((b - t) * c.height) / L.h, l - S.x, t - S.y, r - l, b - t);
        }
        const small = document.createElement('canvas'); small.width = finder.width; small.height = finder.height;
        const sc = small.getContext('2d', { willReadFrequently: true }); sc.imageSmoothingQuality = 'high';
        sc.drawImage(ref, 0, 0, small.width, small.height);
        // And scaled down exactly: every pixel of the screen the average of the part of the source it covers.
        const big = rc.getImageData(0, 0, ref.width, ref.height).data;
        const exact = new Array(finder.width * finder.height * 4);
        const fx = ref.width / finder.width; const fy = ref.height / finder.height;
        for (let y = 0; y < finder.height; y++) for (let x = 0; x < finder.width; x++) {
          const acc = [0, 0, 0, 0]; let weight = 0;
          for (let v = Math.floor(y * fy); v < Math.min(ref.height, Math.ceil((y + 1) * fy)); v++) for (let h = Math.floor(x * fx); h < Math.min(ref.width, Math.ceil((x + 1) * fx)); h++) {
            const wgt = (Math.min(h + 1, (x + 1) * fx) - Math.max(h, x * fx)) * (Math.min(v + 1, (y + 1) * fy) - Math.max(v, y * fy));
            for (let c = 0; c < 4; c++) acc[c] += big[(v * ref.width + h) * 4 + c] * wgt;
            weight += wgt;
          }
          for (let c = 0; c < 4; c++) exact[(y * finder.width + x) * 4 + c] = Math.round(acc[c] / weight);
        }
        return { w: finder.width, h: finder.height, finder: [...finder.getContext('2d').getImageData(0, 0, finder.width, finder.height).data], reference: [...sc.getImageData(0, 0, small.width, small.height).data], exact };
      }, { poses, W: PLATE.w });
      const { w, h } = got;
      const cut = Math.ceil(10 * (w / ((frames.camera_screen.rect_by_still.R_A1_film.w - 4) * (PLATE.w / frames.canvas.w)))) + 1;
      const against = (other) => {
        const diffs = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (x < cut && y < cut) continue; const i = (y * w + x) * 4; diffs.push((Math.abs(got.finder[i] - other[i]) + Math.abs(got.finder[i + 1] - other[i + 1]) + Math.abs(got.finder[i + 2] - other[i + 2])) / 3); }
        diffs.sort((a, b) => a - b);
        return { meanDifferenceOutOf255: r1(diffs.reduce((a, b) => a + b, 0) / diffs.length), ninetyFifth: r1(diffs[Math.floor(diffs.length * 0.95)]), largest: r1(diffs.at(-1)) };
      };
      // (Against the exact average is the fair measure: one plain drawImage from 320 px down to this size is
      // itself rough, and differently so in each browser.)
      rowOut.what[label] = { poses, screenPx: [w, h], againstTheSourceAveragedDownExactly: against(got.exact), againstOnePlainDrawImage: against(got.reference), opaque: got.finder.every((v, i) => i % 4 !== 3 || v === 255) };
      const big = (data) => sharp(Buffer.from(data), { raw: { width: w, height: h, channels: 4 } }).resize(w * 6, h * 6, { kernel: 'nearest' }).png().toBuffer();
      pictures.push(await big(got.exact), await big(got.finder));
    }
    const tag = name.startsWith('chrome') ? 'chrome' : 'webkit';
    await row(`${name}: the camera screen at 6×. In pairs: put together here from the room, the water and the presenter and averaged down | the screen itself. ${Object.keys(rowOut.what).join(', ')}`, pictures, `${out}screen-what-${tag}.jpg`, 8);
    rowOut.errors = errors;
    report.push(rowOut);
    say(name, { where: Object.fromEntries(Object.entries(rowOut.where).map(([k, v]) => [k, v.offBy])), what: Object.fromEntries(Object.entries(rowOut.what).map(([k, v]) => [k, `${v.againstTheSourceAveragedDownExactly.meanDifferenceOutOf255} mean, ${v.againstTheSourceAveragedDownExactly.largest} largest (plain drawImage: ${v.againstOnePlainDrawImage.meanDifferenceOutOf255}, ${v.againstOnePlainDrawImage.largest})`])), live: rowOut.live, theDot: { shortestMs: rowOut.theDot.shortestMs, longestMs: rowOut.theDot.longestMs, stretches: rowOut.theDot.stretches, even: rowOut.theDot.even, duringHerReaction: rowOut.theDot.beatsDuringHerReaction }, theWater: rowOut.theWater, noFlicker: rowOut.noFlicker.neverClear, errors });
    await browser.close();
  }
  await save('screen.json', report);
};

// Recordings for the review. For each of desktop Chrome and the iPhone profile in WebKit:
//   film-<name>-painting.mp4  a new visitor opens Film: its first-visit painting (about 7 s);
//   film-<name>.mp4           exactly 20 s of Film at work with one mushroom find (Rachel's whole reaction)
//                             and one of the presenter's gestures each way (the point, and hands together).
// The 20 s are cut from a longer take: his steps are logged against the recording's clock, the window starts
// about 1.5 s before his first gesture, the find is made while he talks between the two, and the log is
// checked for both gestures (in and out) and the whole reaction inside the window. If a take does not hold
// them, another seed is tried. Needs ffmpeg.
run.film = async () => {
  const { execFileSync } = await import('node:child_process');
  const report = {};
  const grab = async (mp4, at, file) => { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, at)), '-i', mp4, '-frames:v', '1', file]); return sharp(file).resize({ height: 420 }).toBuffer(); };
  for (const [name, engine, options] of [['desktop', chromium, { viewport: { width: 1280, height: 800 } }], ['iphone', webkit, { ...devices['iPhone 14'] }]]) {
    const dir = `${out}film-take-${name}/`;
    await rm(dir, { recursive: true, force: true });
    const take = async (query) => {
      const browser = await launch(engine);
      const context = await browser.newContext({ ...options, recordVideo: { dir, size: options.viewport } });
      const page = await context.newPage();
      const started = Date.now();
      await page.goto(`${base}${query}#${ID}`);
      return { browser, context, page, started, clock: () => (Date.now() - started) / 1000 };
    };
    const finish = async ({ browser, context, page }) => {
      const video = page.video();
      await context.close();
      await browser.close();
      return video.path();
    };

    // The painting.
    {
      const t = await take('?debug&reset&seed=7');
      await t.page.waitForFunction(() => window.__hj?.marks.introStart > 0, null, { timeout: 30000 });
      const introAt = t.clock();
      await clean(t.page);
      await ready(t.page);
      const readyAt = t.clock();
      await t.page.waitForTimeout(1600);
      const webm = await finish(t);
      const mp4 = `${out}film-${name}-painting.mp4`;
      const from = Math.max(0, introAt - 0.4);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(from), '-i', webm, '-t', String(readyAt + 1.4 - from), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', mp4]);
      const stills = [];
      for (const [i, at] of [0.9, 2.3, 3.7, 5.6].entries()) stills.push(await grab(mp4, introAt - from + at, `${dir}paint-${i}.png`));
      await row(`${name}: Film painted for a new visitor, at about 0.9, 2.3, 3.7 and 5.6 s`, stills, `${out}film-${name}-stills-painting.jpg`);
      report[`${name}, the painting`] = { file: `film-${name}-painting.mp4`, paintingTakesS: r1(readyAt - introAt) };
    }

    // The 20 s.
    let kept = null;
    for (let seed = 7; seed < 15 && !kept; seed++) {
      const t = await take(`?debug&reset&intro=off&seed=${seed}`);
      const { page } = t;
      await ready(page);
      await SCENE.film.loaded(page);
      await clean(page);
      await hookSteps(page);
      // The page's clock against the recording's.
      const lag = (await page.evaluate(() => performance.now())) / 1000 - t.clock();
      const his = () => stepsOf(page, 'presenter');
      const waitFor = async (test, timeout) => page.waitForFunction(test, null, { timeout }).then(() => true, () => false);
      // His first gesture: the in-between M_12 after the M_1 mouths.
      let ok = await waitFor(() => window.__steps.presenter.some(([p]) => p === 'M_12'), 15000);
      // Back on the M_1 mouths after pointing: the find, 0.9 s into that talk.
      ok = ok && await waitFor(() => { const s = window.__steps.presenter; const out2 = s.findIndex(([p], i) => p === 'M_12' && s.slice(0, i).some(([q]) => q === 'M_2')); return out2 >= 0 && s.length > out2 + 1 && performance.now() - s[out2 + 1][3] > 900; }, 12000);
      let findAt = null;
      let foundSpot = null;
      let herBox = null;
      if (ok) {
        // A hiding place that is in the window as it stands (on a phone, one between the two of them), so the
        // picture is not panned away from them for the find.
        const left = await unfound(page);
        const spot = (await page.evaluate((ids) => { const v = document.querySelector('.hj-viewport').getBoundingClientRect(); return ids.find((id) => { const r = document.querySelector(`.hj-plate [data-spot="${id}"]`).getBoundingClientRect(); return r.left >= v.left + 4 && r.right <= v.right - 4; }) ?? null; }, left)) ?? left[0];
        await page.evaluate((id) => { const view = document.querySelector('.hj-viewport'); const r = document.querySelector(`.hj-plate [data-spot="${id}"]`).getBoundingClientRect(); const v = view.getBoundingClientRect(); if (r.left < v.left + 4 || r.right > v.right - 4) view.scrollLeft += r.left + r.width / 2 - (v.left + v.width / 2); }, spot);
        // Her head on the screen, for finding the 90 ms turn among the recording's frames afterwards.
        herBox = await page.evaluate(() => { const r = document.querySelector('.hj-plate[data-scene="film"] [data-actor="rachel"]').getBoundingClientRect(); const v = document.querySelector('.hj-viewport').getBoundingClientRect(); const l = Math.max(r.left + r.width * 0.3, v.left); const rt = Math.min(r.right, v.right); return { left: Math.round(l), top: Math.round(r.top), width: Math.round(rt - l), height: Math.round(r.height * 0.42) }; });
        foundSpot = spot;
        findAt = (await page.evaluate(() => performance.now())) / 1000 - lag;
        const at = page.locator(`.hj-plate [data-spot="${spot}"]`);
        if (name === 'iphone') await at.tap({ force: true }); else await at.click({ force: true });
        // Hands together, in and out again.
        ok = await waitFor(() => { const s = window.__steps.presenter; const a = s.findIndex(([p]) => p === 'M_13'); return a >= 0 && s.slice(a + 1).some(([p]) => p === 'M_13') && s.at(-1)[0] !== 'M_13'; }, 22000);
      }
      const steps = await his();
      const hers = await stepsOf(page, 'rachel');
      const firstGesture = steps.find(([p]) => p === 'M_12');
      const from = firstGesture ? firstGesture[3] / 1000 - lag - 1.5 : 0;
      // To the end of the window, and a little over.
      await page.waitForTimeout(Math.max(300, (from + 20.6 - t.clock()) * 1000));
      const webm = await finish(t);
      if (!ok || from < 0.2) { say(`${name}, seed ${seed}`, 'the take did not hold a gesture each way and a find: another seed'); continue; }
      const inWindow = (ms) => ms / 1000 - lag >= from && ms / 1000 - lag <= from + 20;
      const times = (pose, list) => list.filter(([p]) => p === pose).map(([, , , at]) => r1(at / 1000 - lag - from));
      const rk = hers.filter(([p]) => p !== 'R_A1_film' || true);
      const look = hers.find(([p]) => p === 'R_K1_look');
      const backHome = hers.find(([p, , , at]) => p === 'R_A1_film' && look && at > look[3]);
      const m12 = steps.filter(([p]) => p === 'M_12'); const m13 = steps.filter(([p]) => p === 'M_13');
      const holds = m12.length >= 2 && m13.length >= 2 && [m12[0], m12[1], m13[0], m13[1]].every(([, , , at]) => inWindow(at) && inWindow(at + 150)) && look && backHome && inWindow(hers.find(([p]) => p === 'R_K0_turn')[3]) && inWindow(backHome[3] + 500);
      if (!holds) { say(`${name}, seed ${seed}`, { note: 'both gestures and the find were not all inside 20 s: another seed', pointS: times('M_12', steps), handsS: times('M_13', steps), findS: r1(findAt - from) }); continue; }
      const mp4 = `${out}film-${name}.mp4`;
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(from), '-i', webm, '-t', '20', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', mp4]);
      const length = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString().trim());
      const sec = (ms) => ms / 1000 - lag - from;
      const turn = hers.find(([p]) => p === 'R_K0_turn');
      // The turn is on screen for 90 ms, two or three of the recording's frames, and the recording's clock is
      // only known to a tenth of a second or so: so it is looked for. Of the frames around the find, the turn
      // is the one whose picture of her head is furthest from both filming (before) and the look (after).
      const around = [];
      for (let i = 0; i < 16; i++) { const at = sec(turn[3]) - 0.3 + i * 0.04; const file = `${dir}turn-${i}.png`; execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, at)), '-i', mp4, '-frames:v', '1', file]); around.push({ at, file, head: await sharp(file).extract(herBox).removeAlpha().raw().toBuffer() }); }
      const far = (a, b) => { let sum = 0; for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]); return sum / a.length; };
      const scored = around.map((f) => ({ ...f, score: Math.min(far(f.head, around[0].head), far(f.head, around.at(-1).head)) }));
      const turnFrame = scored.reduce((a, b) => (b.score > a.score ? b : a));
      const turnSeen = turnFrame.score > 3;
      const find4 = [sec(turn[3]) - 0.6, turnFrame.at, sec(look[3]) + 0.9, sec(backHome[3]) + 0.7];
      const stills = [];
      for (const [i, at] of find4.entries()) stills.push(await grab(mp4, at, `${dir}find-${i}.png`));
      await row(`${name}: a find. Before it, the turn${turnSeen ? '' : ' (not caught by the recording: it lasts 90 ms)'}, the look, and back to filming`, stills, `${out}film-${name}-stills-find.jpg`);
      const firstM2 = steps.find(([p]) => p === 'M_2'); const firstM3 = steps.find(([p]) => p === 'M_3');
      const gest = [];
      for (const [i, at] of [sec(m12[0][3]) - 0.3, sec(m12[0][3]) + 0.05, sec(firstM2[3]) + 0.5, sec(m12[1][3]) + 0.05, sec(m13[0][3]) + 0.05, sec(firstM3[3]) + 0.5, sec(m13[1][3]) + 0.05].entries()) gest.push(await grab(mp4, at, `${dir}gesture-${i}.png`));
      await row(`${name}: his gestures. Before; the in-between, pointing, the in-between back; the other in-between, hands together, and back`, gest, `${out}film-${name}-stills-gestures.jpg`);
      kept = { file: `film-${name}.mp4`, seed, seconds: r1(length), cutFromTheTakeAtS: r1(from), thePointInAndOutAtS: times('M_12', steps).filter((s) => s >= 0 && s <= 20), handsTogetherInAndOutAtS: times('M_13', steps).filter((s) => s >= 0 && s <= 20), theFindAtS: r1(findAt - from), theFindWas: foundSpot, theTurnIsInTheRecording: turnSeen, herTurnLookAndBackAtS: [r1(sec(turn[3])), r1(sec(look[3])), r1(sec(backHome[3]))], herReactionEndsAtS: r1(sec(backHome[3]) + 0.5), holdsOneFindAndAGestureEachWay: true, stepsOfHersLogged: rk.length };
    }
    report[name] = kept ?? { failed: 'no seed from 7 to 14 gave a 20 s take with a gesture each way and a find' };
    say(name, report[name]);
    await rm(dir, { recursive: true, force: true });
  }
  await save('film.json', report);
};

// From the bitmap and canvas sizes, sampled every frame, on the phone profile (WebKit, 390 × 844). Four
// scenes: every one of the 24 orders of visiting them for a visitor to whom every switch is the short brush,
// and eight orders for a new visitor (the opening painting, then a full painting of each scene never seen),
// chosen so that each scene opens the visit twice and every scene is followed by every other at least once.
// In each scene: wait for everything it loads, let it work, find one mushroom and let her react. Then back to
// the first, with all four visited.
//   node qa/tools/scene4.mjs memory                 everything (about two hours)
//   node qa/tools/scene4.mjs memory return          one kind of visitor (new | return)
//   node qa/tools/scene4.mjs memory film            only orders that start with that scene
//   node qa/tools/scene4.mjs memory new film,build,grow,design    one order
run.memory = async () => {
  const ids = ['build', 'grow', 'design', 'film'];
  const all = [];
  const permute = (rest, done) => { if (!rest.length) all.push(done); rest.forEach((id, i) => permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...done, id])); };
  permute(ids, []);
  // Each of the six ways round the four scenes, started twice at each scene between them.
  const eight = ['build,grow,design,film', 'build,film,design,grow', 'grow,film,design,build', 'grow,build,design,film', 'design,grow,film,build', 'design,build,film,grow', 'film,build,grow,design', 'film,design,grow,build'].map((o) => o.split(','));
  const args = process.argv.slice(3);
  const kind = args.find((a) => /^(new|return)/.test(a));
  const start = args.find((a) => a in SCENE);
  const single = args.find((a) => a.includes(','))?.split(',');
  const report = {};
  const filmAlone = [];
  for (const [visitor, query, orders] of [['new visitor (full paintings)', '?debug&reset&seed=4', eight], ['return visitor (the short brush)', '?debug&reset&intro=quick&seed=4', all]]) {
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
      const filmHeld = () => page.evaluate(() => Object.entries(window.__hj.memory.parts).filter(([k]) => k.startsWith('film.')).reduce((sum, [, v]) => sum + v, 0));
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
        if (id !== 'film') stage.filmHoldsMB = MB(await filmHeld());
        else filmAlone.push(stage);
        stages.push(stage);
      }
      // And back to the first one: its frames decoded for the second time, with all the others visited.
      await page.evaluate(() => { window.__peak = { total: 0, parts: {}, at: '' }; });
      await page.locator(`.hj-tab[data-scene="${order[0]}"]`).tap();
      await arrived(page, order[0]);
      await SCENE[order[0]].loaded(page);
      await SCENE[order[0]].busy(page);
      stages.push({ scene: `${order[0]} again`, ...tidy(await page.evaluate(() => window.__peak)), framesSheSkipped: await page.evaluate(() => window.__hj.rachel.missed), ...(order[0] === 'film' ? {} : { filmHoldsMB: MB(await filmHeld()) }) });
      const name = order.map((id) => id[0].toUpperCase() + id.slice(1)).join(' → ');
      report[visitor][name] = { highestMB: Math.max(...stages.map((s) => s.peakMB)), stages, errors };
      say(`${visitor} / ${name}`, { highestMB: report[visitor][name].highestMB, byStage: stages.map((s) => `${s.scene} ${s.peakMB}`), fullReactions: stages.map((s) => s.fullReaction), filmHoldsWhenAwayMB: stages.filter((s) => 'filmHoldsMB' in s).map((s) => s.filmHoldsMB), skipped: stages.at(-1).framesSheSkipped, errors });
      await browser.close();
      const rows = Object.entries(report).filter(([kind]) => kind !== 'summary').flatMap(([, r]) => Object.values(r));
      const film = filmAlone.reduce((a, b) => (b.peakMB > (a?.peakMB ?? 0) ? b : a), null);
      report.summary = {
        ordersRun: rows.length, highestMB: Math.max(...rows.map((r) => r.highestMB)), budgetMB: 80, underTheBudget: rows.every((r) => r.highestMB < 80),
        highestWasIn: rows.flatMap((r) => r.stages).reduce((a, b) => (b.peakMB > a.peakMB ? b : a)).at,
        filmItself: film && { peakMB: film.peakMB, at: film.at, partsMB: film.partsMB },
        filmHoldsWhenAwayMB: Math.max(0, ...rows.flatMap((r) => r.stages.filter((s) => 'filmHoldsMB' in s && r.stages.slice(0, r.stages.indexOf(s)).some((b) => b.scene === 'film')).map((s) => s.filmHoldsMB))),
        everyReactionInFull: rows.every((r) => r.stages.every((s) => s.fullReaction !== false)),
      };
      const file = args.length ? `memory-${args.join('-').replace(/[^a-z,-]/g, '')}.json` : 'memory.json';
      await save(file, report);
    }
  }
  if (report.summary) console.log(`HIGHEST of every order: ${report.summary.highestMB} MB (the budget is 80). Film itself: ${report.summary.filmItself?.peakMB ?? '-'} MB; away from Film it holds ${report.summary.filmHoldsWhenAwayMB} MB. ${JSON.stringify(report.summary.filmItself?.partsMB ?? {})}`);
};

// Frame times. WebKit on the iPhone profile and Chrome with the processor slowed four times, against the
// production build (HJ_PROD, by default http://localhost:4173/: npm run build && npm run preview). A new
// visitor opens Film (its painting), watches it work, then goes Build → Grow → Design → Film → Build and
// round once more: the first visits are full paintings, the rest the short brush. Every frame's length is
// logged by a loop that starts before the page's own script; each stretch is reported as its longest frame
// and how many were over 50 ms and over 33 ms. Only worth reading when the Mac is quiet (`machine` says).
run.frames = async () => {
  const prod = process.env.HJ_PROD ?? 'http://localhost:4173/';
  const { execSync } = await import('node:child_process');
  const report = { machine: execSync('uptime').toString().trim(), runs: [] };
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
        return { stretch: label, frames: gaps.length, longestMs: Math.max(...gaps), over50: gaps.filter((g) => g > 50).length, over33: gaps.filter((g) => g > 33).length, medianMs: sorted[Math.floor(sorted.length / 2)] };
      };
      const now = () => page.evaluate(() => performance.now());
      const rows = [];
      await page.goto(`${prod}#${ID}`);
      await page.waitForSelector('.hj-paint', { state: 'attached', timeout: 30000 });
      let from = await now();
      await page.waitForTimeout(6500);
      rows.push(await stretch('Film painted for a new visitor', from, await now()));
      from = await now();
      await page.waitForTimeout(8000);
      rows.push(await stretch('Film at work, 8 s', from, await now()));
      const seen = new Set([ID]);
      for (const id of ['build', 'grow', 'design', 'film', 'build', 'grow', 'design', 'film', 'build']) {
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

// The page against the package. film-preview.mp4 is the plate with each actor's still drawn over it at its
// layer's place, and the camera's screen pasted in (tools/film_preview.py). Here the same picture is made
// from the package for a few sets of poses, the page is put on the same poses, and the two are compared
// inside the painting's edge: how far apart they are, and whether each actor is where the package puts it
// (to about a screen pixel: each actor's canvas sits on whole screen pixels). The water is scenery, soft and
// see-through, so it is not placed by this measure. Then the camera's screen against the preview's own.
// Also a frame of the preview itself beside the page.
run.preview = async () => {
  const { execFileSync } = await import('node:child_process');
  const frames = await framesOf();
  const SETS = {
    'at rest': {},
    pointing: { presenter: 'M_2', water: 'W_2' },
    'hands together': { presenter: 'M_3_closed', water: 'W_3' },
    'her look': { rachel: 'R_K1_look', presenter: 'M_1_closed' },
    // (What film-preview.mp4 shows at 9.5 s, for the picture: she looks back while he has his hands together.)
    'her look, as in the preview at 9.5 s': { rachel: 'R_K1_look', presenter: 'M_3', water: 'W_1' },
  };
  const browser = await launch(chromium);
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.6 })).newPage();
  const errors = errorsOf(page);
  await page.goto(`${base}?debug&reset&intro=off&seed=7#${ID}`);
  await ready(page);
  await SCENE.film.loaded(page);
  await page.evaluate(() => { window.__hj.scene.hold(); const f = window.__hj.scene.finder; f.lit = true; f.draw(); document.querySelectorAll('.hj-mushrooms').forEach((el) => { el.style.visibility = 'hidden'; }); });
  const report = {};
  let shownPair = null;
  const screens = [];
  for (const [label, poses] of Object.entries(SETS)) {
    const used = Object.fromEntries(frames.layers.map((layer) => [layer.actor, poses[layer.actor] ?? layer.stills[0]]));
    await page.evaluate((to) => { for (const cast of window.__hj.scene.casts) cast.character.show(to[cast.character.el.dataset.actor]); const f = window.__hj.scene.finder; f.lit = true; f.draw(); }, used);
    await page.waitForTimeout(150);
    const box = await page.locator(`.hj-plate[data-scene="${ID}"]`).boundingBox();
    const shot = sharp(await page.screenshot({ clip: box }));
    const { width, height } = await shot.metadata();
    const mine = await shot.removeAlpha().raw().toBuffer();
    // The package's picture, as film_preview.py draws a frame: plate, layers, the screen's copy and the dot.
    // (A layer with a scale is drawn into its box.)
    const layers = await Promise.all(frames.layers.map(async (layer) => ({ input: await sharp(`${pkg}site/${frames.stills[used[layer.actor]]}`).resize(layer.w, layer.h, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer(), left: layer.x, top: layer.y })));
    const scene = await sharp(`${pkg}site/${frames.plate}`).composite(layers).png().toBuffer();
    const src = frames.camera_screen.source;
    const rect = frames.camera_screen.rect_by_still[used.rachel];
    const mini = await sharp(scene).extract({ left: src.x, top: src.y, width: src.w, height: src.h }).resize(rect.w - 4, rect.h - 4, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
    const dot = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="7" height="7"><ellipse cx="3.5" cy="3.5" rx="3.5" ry="3.5" fill="#EB1E1E"/></svg>`);
    const whole = await sharp(scene).composite([{ input: mini, left: rect.x + 2, top: rect.y + 2 }, { input: dot, left: rect.x + 4, top: rect.y + 4 }]).png().toBuffer();
    const theirs = await sharp(whole).resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
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
      return { shift: [r1(fine(0)), r1(fine(1))], mean: Math.round(best.mean * 100) / 100 };
    };
    // (The room is lined up where no actor is: the sky and the towers on the left.)
    const room = closest([inside[0], inside[1], Math.round(590 * k), Math.round(440 * k)]);
    const actors = {};
    for (const layer of frames.layers) {
      if (layer.actor === 'water') { actors.water = 'scenery, soft and see-through: not placed by this measure'; continue; }
      const solid = await sharp(`${pkg}site/${frames.stills[used[layer.actor]]}`).resize(layer.w, layer.h, { fit: 'fill' }).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
      // An actor is compared where its drawing is solid and the painting is whole under it: Rachel only above
      // her waist (plate y 760), since the edge fades her legs into the paper.
      const bottom = layer.actor === 'rachel' ? 740 : layer.y + layer.h;
      const area = [Math.floor(layer.x * k), Math.floor(layer.y * k), Math.ceil((layer.x + layer.w) * k), Math.ceil(Math.min(layer.y + layer.h, bottom) * k)];
      // (Not the camera's screen: that is compared by itself below.)
      const at = closest(area, (x, y) => {
        const cx = x / k; const cy = y / k;
        if (cx >= rect.x - 3 && cx <= rect.x + rect.w + 3 && cy >= rect.y - 3 && cy <= rect.y + rect.h + 3) return false;
        const sx = Math.round(cx - layer.x); const sy = Math.round(cy - layer.y);
        for (const [ox, oy] of [[0, 0], [-3, 0], [3, 0], [0, -3], [0, 3]]) {
          const px = sx + ox; const py = sy + oy;
          if (px < 0 || py < 0 || px >= solid.info.width || py >= solid.info.height || solid.data[py * solid.info.width + px] < 255) return false;
        }
        return true;
      });
      const off = [r1(at.shift[0] - room.shift[0]), r1(at.shift[1] - room.shift[1])];
      actors[layer.actor] = { screenPxFromWhereThePackagePutsIt: off, meanDifferenceOutOf255: at.mean, inPlace: Math.abs(off[0]) < 1.5 && Math.abs(off[1]) < 1.5 };
    }
    // The camera's screen: the page's against the preview's, inside the screen's picture.
    const sx0 = Math.round((rect.x + 2) * k + room.shift[0]); const sy0 = Math.round((rect.y + 2) * k + room.shift[1]);
    const sw = Math.floor((rect.w - 4) * k); const sh = Math.floor((rect.h - 4) * k);
    let sum = 0; let n = 0; let worst = 0;
    for (let y = 1; y < sh - 1; y++) for (let x = 1; x < sw - 1; x++) { const a = ((sy0 + y) * width + sx0 + x) * 3; const o = ((sy0 + y - Math.round(room.shift[1])) * width + sx0 + x - Math.round(room.shift[0])) * 3; const d = (Math.abs(mine[a] - theirs[o]) + Math.abs(mine[a + 1] - theirs[o + 1]) + Math.abs(mine[a + 2] - theirs[o + 2])) / 3; sum += d; n++; worst = Math.max(worst, d); }
    const cut = (buffer, dx, dy) => sharp(buffer, { raw: { width, height, channels: 3 } }).extract({ left: Math.max(0, sx0 - 14 - dx), top: Math.max(0, sy0 - 14 - dy), width: sw + 28, height: sh + 28 }).resize((sw + 28) * 6, (sh + 28) * 6, { kernel: 'nearest' }).png().toBuffer();
    screens.push(await cut(theirs, Math.round(room.shift[0]), Math.round(room.shift[1])), await cut(mine, 0, 0));
    report[label] = { poses: used, platePxOnTheScreen: [width, height], theRoom: { screenshotOffsetPx: room.shift, meanDifferenceOutOf255: room.mean }, actors, everyActorIsInPlace: Object.values(actors).every((a) => typeof a === 'string' || a.inPlace !== false), theCameraScreen: { screenPx: [sw, sh], meanDifferenceFromThePreviewsOutOf255: r1(sum / n), largest: r1(worst), note: "the preview resizes the crop with Lanczos to 40 × 36 px; the page averages it down to the pixels the screen covers and the browser then places that canvas on the page, so at about one screen pixel per plate pixel (this window) the page's is the softer of the two; on a phone or a 2× display it has two to three times the pixels" } };
    say(label, report[label]);
    if (label.startsWith('her look, as in the preview')) shownPair = { mine: await sharp(mine, { raw: { width, height, channels: 3 } }).resize({ width: 900 }).png().toBuffer(), theirs: await sharp(theirs, { raw: { width, height, channels: 3 } }).resize({ width: 900 }).png().toBuffer() };
  }
  await browser.close();
  await row(`The camera screen at 6×, in pairs: as tools/film_preview.py draws it | on the page. ${Object.keys(SETS).join('; ')}`, screens, `${out}preview-screen.jpg`, 8);
  // A frame of the preview itself while she looks back (9.09 to 10.9 s in tools/film_preview.py).
  const frame = `${out}preview-frame.png`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '9.5', '-i', `${pkg}film-preview.mp4`, '-frames:v', '1', frame]);
  const theirFrame = await sharp(frame).resize({ width: 900 }).png().toBuffer();
  await rm(frame, { force: true });
  await row("her look: film-preview.mp4 at 9.5 s  |  the package drawn as the preview draws it  |  the page on the same poses (its edge is the site's own)", [theirFrame, shownPair.theirs, shownPair.mine], `${out}preview-compare.jpg`);
  report.errors = errors;
  await save('preview.json', report);
};

const command = process.argv[2];
if (!run[command]) {
  console.error(`Unknown command "${command}". One of: ${Object.keys(run).join(', ')}`);
  process.exit(1);
}
await run[command]();

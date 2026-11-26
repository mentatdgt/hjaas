// Job 022: the Grow scene's mister mists (reviews/lab-mister-engine-notes.md). Results go to qa/lab-mister/.
// Needs `npm run dev` (HJ_URL, default 5173). Every command takes the engine and the device:
//
//   node qa/tools/lab-mister.mjs cycle  [chrome|webkit] [desktop|phone]   the loop read every frame for 6 s (pose, the canvas's
//                                         own pixels), each of M1..M4 held and shot over the room, and the seam at its box's rim
//   node qa/tools/lab-mister.mjs record [chrome|webkit] [desktop|phone]   a first visit's painting, then 6 s of Grow at work (video)
//   node qa/tools/lab-mister.mjs still  [chrome|webkit] [desktop|phone]   "Pause animation" and reduced motion: M1, held
//   node qa/tools/lab-mister.mjs fail   [chrome|webkit] [desktop|phone]   the mist's files blocked (and, separately, stalled):
//                                         Rachel's routine, a find, the room as painted
//
// (The phone view pans: the window is scrolled so the mist's box is in view before anything is read.)
import { chromium, webkit, devices } from 'playwright';
import { mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const base = process.env.HJ_URL ?? 'http://localhost:5173/';
const out = process.env.HJ_OUT ?? new URL('../lab-mister/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const [cmd = 'cycle', engineName = 'chrome', deviceName = 'desktop'] = process.argv.slice(2);
const engine = engineName === 'webkit' ? webkit : chromium;
const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  phone: { ...devices['iPhone 13'] },
};
// Chrome has no touch-only phone of its own in Playwright's list for WebKit's: the same sizes, as a mobile page.
if (engine === chromium) delete DEVICES.phone.defaultBrowserType;
const BOX = { x: 1245, y: 336, w: 123, h: 159 };
const POSES = ['M1', 'M2', 'M3', 'M4'];
const tag = `${engineName}-${deviceName}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (label, value) => console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
const save = async (name, data) => writeFile(`${out}${name}`, `${JSON.stringify(data, null, 1)}\n`);

async function open({ url = `${base}?debug&reset&intro=off&seed=4#grow`, route, media, video } = {}) {
  const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {});
  const context = await browser.newContext({ ...DEVICES[deviceName], ...(media ? { reducedMotion: media } : {}), ...(video ? { recordVideo: { dir: video, size: DEVICES[deviceName].viewport } } : {}) });
  if (route) await route(context);
  const page = await context.newPage();
  const errors = [];
  const warnings = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => errors.push(`request failed: ${r.url().replace(base, '')} (${r.failure()?.errorText})`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning' && m.text().includes('[hjaas]')) warnings.push(m.text());
  });
  const opened = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 60000 });
  return { browser, context, page, errors, warnings, opened };
}

/** Scroll a phone's window so the mist's box is in the middle; nothing on desktop (it is all in view). */
const bringIntoView = (page) => page.evaluate((box) => {
  const viewport = document.querySelector('.hj-viewport');
  const plate = document.querySelector('.hj-plate[data-scene="grow"]');
  const u = plate.clientWidth / 1672;
  if (viewport.scrollWidth > viewport.clientWidth + 1) viewport.scrollLeft = (box.x + box.w / 2) * u - viewport.clientWidth / 2;
  const r = viewport.getBoundingClientRect();
  const p = plate.getBoundingClientRect();
  return { panned: viewport.scrollWidth > viewport.clientWidth + 1, inView: p.left + box.x * u >= r.left && p.left + (box.x + box.w) * u <= r.right };
}, BOX);

/** The mist (the scene's first cast), and whether everything it has is decoded. */
const mistState = (page) => page.evaluate(() => {
  const scene = window.__hj.scene;
  const casts = scene?.casts ?? [];
  const mist = casts.find((cast) => cast.character.el.dataset.actor === 'mister');
  const rachel = document.querySelector('.hj-rachel');
  return {
    scene: scene?.config.id,
    order: casts.map((cast) => cast.character.el.dataset.actor ?? 'rachel'),
    classes: casts.map((cast) => cast.character.el.className),
    leadIsRachel: scene?.character === casts.at(-1)?.character && !rachel?.dataset.actor,
    mist: mist ? { current: mist.character.current, stocked: mist.stocked(), has: ['M1', 'M2', 'M3', 'M4'].filter((n) => mist.character.has(n)) } : null,
    rachelPose: scene?.character?.current,
  };
});

const waitStocked = (page) => page.waitForFunction(() => {
  const mist = window.__hj.scene?.casts.find((cast) => cast.character.el.dataset.actor === 'mister');
  return mist?.stocked() && window.__hj.scene.players.get(mist)?.running !== false;
}, null, { timeout: 30000 });

/** The mist's box on the screen, in device px of a screenshot of the whole page, with a margin (plate px). */
const boxOnScreen = (page, margin = 16) => page.evaluate(({ box, margin }) => {
  const plate = document.querySelector('.hj-plate[data-scene="grow"]').getBoundingClientRect();
  const u = plate.width / 1672;
  return { u, left: plate.left + (box.x - margin) * u, top: plate.top + (box.y - margin) * u, width: (box.w + 2 * margin) * u, height: (box.h + 2 * margin) * u, margin };
}, { box: BOX, margin });

// ---- The loop, read every frame. -------------------------------------------------------------------------------
async function readLoop(page, ms) {
  await page.evaluate(() => {
    const mist = window.__hj.scene.casts.find((cast) => cast.character.el.dataset.actor === 'mister');
    const canvas = mist.character.el.querySelector('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const w = (window.__m = { rows: [], stop: false });
    const tick = (now) => {
      if (w.stop) return;
      let hash = 0;
      if (canvas.width) {
        const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 0; i < d.length; i += 4) hash = (hash * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7 + d[i + 3] * 11) >>> 0;
      }
      w.rows.push([Math.round(now * 10) / 10, mist.character.current, hash, window.__hj.scene.character.current]);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await wait(ms);
  const rows = await page.evaluate(() => { window.__m.stop = true; return window.__m.rows; });
  const changes = rows.filter((r, i) => i > 0 && r[1] !== rows[i - 1][1]);
  const gaps = changes.slice(1).map((r, i) => Math.round((r[0] - changes[i][0]) * 10) / 10);
  const sorted = [...gaps].sort((a, b) => a - b);
  const next = { M1: 'M2', M2: 'M3', M3: 'M4', M4: 'M1' };
  const hashes = {};
  for (const r of rows) (hashes[r[1]] ??= new Set()).add(r[2]);
  const frameGaps = rows.slice(1).map((r, i) => r[0] - rows[i][0]);
  return {
    seconds: Math.round((rows.at(-1)[0] - rows[0][0]) / 100) / 10,
    framesRead: rows.length,
    changes: changes.length,
    posesSeen: [...new Set(rows.map((r) => r[1]))].sort(),
    roundAndRound: changes.every((r, i) => i === 0 || r[1] === next[changes[i - 1][1]]),
    gapMs: { shortest: sorted[0], median: sorted[Math.floor(sorted.length / 2)], longest: sorted.at(-1), mean: Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10 },
    gapsOver160: gaps.filter((g) => g > 160).length,
    // The canvas shows one picture per pose, and four different ones.
    picturesPerPose: Object.fromEntries(Object.entries(hashes).map(([k, v]) => [k, v.size])),
    distinctPictures: new Set(rows.map((r) => r[2])).size,
    rachelPoseChanges: rows.filter((r, i) => i > 0 && r[3] !== rows[i - 1][3]).length,
    pageFramesOver25ms: frameGaps.filter((g) => g > 25).length,
  };
}

// ---- Each pose held, shot over the room, and the seam at the box's rim. ----------------------------------------
async function samples(page) {
  const { u, ...clip } = await boxOnScreen(page);
  const shot = async () => page.screenshot({ clip: { x: clip.left, y: clip.top, width: clip.width, height: clip.height }, scale: 'device', animations: 'allow' });
  await page.evaluate(() => {
    // (?debug outlines the tap boxes, on the mushrooms' layer: under the mist, so it would cover them. Off for the shots.)
    document.querySelectorAll('.hj-mushrooms').forEach((el) => el.classList.remove('is-debug'));
    const scene = window.__hj.scene;
    const mist = scene.casts.find((cast) => cast.character.el.dataset.actor === 'mister');
    scene.players.get(mist).stop();
    window.__mist = mist;
  });
  const pictures = {};
  for (const pose of POSES) {
    await page.evaluate((p) => window.__mist.character.show(p), pose);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    pictures[pose] = await shot();
  }
  await page.evaluate(() => { window.__mist.character.el.style.visibility = 'hidden'; });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  pictures.room = await shot();
  await page.evaluate(() => { window.__mist.character.el.style.visibility = ''; window.__hj.scene.players.get(window.__mist).start(); });
  const raw = async (png) => sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const room = await raw(pictures.room);
  const { width, height } = room.info;
  const s = width / (BOX.w + 2 * clip.margin); // screenshot px per plate px
  const bx0 = clip.margin * s; const by0 = clip.margin * s; const bx1 = (clip.margin + BOX.w) * s; const by1 = (clip.margin + BOX.h) * s;
  // Distance (screenshot px) from the box's outline; negative inside.
  const dist = (x, y) => {
    const inside = x >= bx0 && x < bx1 && y >= by0 && y < by1;
    const dx = Math.max(bx0 - x, 0, x - bx1); const dy = Math.max(by0 - y, 0, y - by1);
    return inside ? -Math.min(x - bx0, bx1 - x, y - by0, by1 - y) : Math.hypot(dx, dy);
  };
  const seams = {};
  for (const pose of POSES) {
    const { data } = await raw(pictures[pose]);
    const bands = { outside: [], rim: [], feather: [] };
    let changedInside = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 3;
        const diff = Math.max(Math.abs(data[i] - room.data[i]), Math.abs(data[i + 1] - room.data[i + 1]), Math.abs(data[i + 2] - room.data[i + 2]));
        const d = dist(x + 0.5, y + 0.5);
        if (d > 1.5) bands.outside.push(diff);
        else if (d > -3) bands.rim.push(diff); // 3 screen px either side of the box's outline
        else if (d > -10 * s) bands.feather.push(diff); // the patch's feathered 10 plate px
        if (d < 0 && diff > 12) changedInside++;
      }
    }
    const stat = (list) => { const sorted = [...list].sort((a, b) => a - b); return { max: sorted.at(-1), p99: sorted[Math.floor(sorted.length * 0.99)], mean: Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 100) / 100 }; };
    seams[pose] = { outside: stat(bands.outside), rim: stat(bands.rim), feather: stat(bands.feather), pxChangedInside: changedInside };
  }
  // The sheet: the room, then M1..M4 over it, then each one's difference from the room (x4 brighter), all at 2x.
  const zoom = 2;
  const tile = async (png) => sharp(png).resize(width * zoom, height * zoom, { kernel: 'nearest' }).png().toBuffer();
  const diffTile = async (pose) => {
    const { data } = await raw(pictures[pose]);
    const d = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) d[i] = Math.min(255, Math.abs(data[i] - room.data[i]) * 4);
    // The box's outline in red, a pixel wide, for reference.
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const onLine = (Math.abs(x - bx0) < 0.5 || Math.abs(x - bx1) < 0.5) && y >= by0 && y <= by1 || (Math.abs(y - by0) < 0.5 || Math.abs(y - by1) < 0.5) && x >= bx0 && x <= bx1;
      if (onLine) { const i = (y * width + x) * 3; d[i] = 200; d[i + 1] = 0; d[i + 2] = 0; }
    }
    return sharp(d, { raw: { width, height, channels: 3 } }).resize(width * zoom, height * zoom, { kernel: 'nearest' }).png().toBuffer();
  };
  const W = width * zoom; const H = height * zoom; const label = 22;
  const text = (t) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${label}"><text x="4" y="16" font-family="Helvetica" font-size="14" fill="#302e29">${t}</text></svg>`);
  const tiles = [{ input: text('room (mist hidden)'), left: 4, top: 4 }, { input: await tile(pictures.room), left: 4, top: 4 + label }];
  for (const [i, pose] of POSES.entries()) {
    tiles.push({ input: text(pose), left: 4 + (i + 1) * (W + 4), top: 4 });
    tiles.push({ input: await tile(pictures[pose]), left: 4 + (i + 1) * (W + 4), top: 4 + label });
    tiles.push({ input: text(`${pose} - room, x4 (red: box)`), left: 4 + (i + 1) * (W + 4), top: 8 + label + H });
    tiles.push({ input: await diffTile(pose), left: 4 + (i + 1) * (W + 4), top: 8 + 2 * label + H });
  }
  const file = `frames-${tag}.png`;
  await sharp({ create: { width: 5 * (W + 4) + 4, height: 2 * (H + label) + 16, channels: 3, background: '#d9d6cf' } }).composite(tiles).png().toFile(`${out}${file}`);
  // The four held frames on their own too, at 1:1 device px, for looking at.
  for (const pose of POSES) await writeFile(`${out}frame-${tag}-${pose}.png`, pictures[pose]);
  return { sheet: file, screenPxPerPlatePx: Math.round(s * 100) / 100, seams };
}

/**
 * No seam: nothing changes outside the box (a few levels where WebKit's phone layers meet), and what changes at its
 * rim is the same whichever pose is on (the canvas's own resampling of the room it repeats, static). A seam that
 * moved with the mist would differ from pose to pose.
 */
const seamOk = (seams) => {
  const all = Object.values(seams);
  const spread = (key) => Math.max(...all.map((s) => s.rim[key])) - Math.min(...all.map((s) => s.rim[key]));
  return all.every((s) => s.outside.max <= 8) && spread('p99') <= 2 && spread('mean') <= 0.2;
};
/** A request every load of the site has failed, before this job too (WebKit and Chrome: the room's picture asked for twice). */
const known = (e) => /room\.webp/.test(e) || /Failed to load resource: resource unavailable/.test(e);

const run = {};
run.cycle = async () => {
  const { browser, page, errors, warnings } = await open();
  const view = await bringIntoView(page);
  await waitStocked(page);
  const state = await mistState(page);
  // The switch-box mushroom's tap box reaches into the mist's: a tap there still finds the mushroom (the cast lets taps through).
  const tapThrough = await page.evaluate((box) => {
    const plate = document.querySelector('.hj-plate[data-scene="grow"]').getBoundingClientRect();
    const u = plate.width / 1672;
    const button = document.querySelector('.hj-shroom[data-spot="switch-box"]');
    const r = button.getBoundingClientRect();
    const top = Math.max(r.top, plate.top + box.y * u) + 1;
    if (top >= r.bottom) return { overlaps: false };
    const x = r.left + r.width / 2;
    const hit = document.elementFromPoint(x, top);
    return { overlaps: true, overlapPx: Math.round(r.bottom - top + 1), hit: hit?.closest('.hj-shroom')?.dataset.spot ?? hit?.className ?? null };
  }, BOX);
  const loop = await readLoop(page, 6000);
  const shots = await samples(page);
  const row = { view, state, tapThrough, loop, shots, errors, warnings, ok: (!tapThrough.overlaps || tapThrough.hit === 'switch-box') && loop.posesSeen.join() === POSES.join() && loop.roundAndRound && loop.gapsOver160 === 0 && seamOk(shots.seams) };
  say(tag, row);
  await save(`cycle-${tag}.json`, row);
  await browser.close();
};

run.record = async () => {
  const dir = `${out}video-${tag}/`;
  await rm(dir, { recursive: true, force: true });
  // A first visit: the painting, then the scene at work.
  const { browser, context, page, errors, warnings, opened } = await open({ url: `${base}?debug&reset&seed=4#grow`, video: dir });
  // (Without ?debug's tap outlines: the film is of the scene as a visitor sees it.)
  await page.evaluate(() => document.querySelectorAll('.hj-mushrooms').forEach((el) => el.classList.remove('is-debug')));
  // (The painting is over when the page marks its intro's end.)
  const painted = await page.waitForFunction(() => window.__hj.marks.introEnd > 0, null, { timeout: 30000, polling: 50 }).then(() => Date.now()).catch(() => null);
  const paintingMs = await page.evaluate(() => window.__hj.marks.introEnd - window.__hj.marks.introStart);
  const view = await bringIntoView(page);
  await waitStocked(page).catch(() => {});
  const from = Date.now();
  const loop = await readLoop(page, 6500);
  const state = await mistState(page);
  await page.close();
  await context.close();
  await browser.close();
  const [file] = (await readdir(dir)).filter((f) => f.endsWith('.webm'));
  const mp4 = `grow-${tag}-6s.mp4`;
  // The 6 s after the painting (and, on a phone, the pan to the mist).
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String((from - opened) / 1000 + 0.3), '-t', '6', '-i', `${dir}${file}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-movflags', '+faststart', `${out}${mp4}`]);
  await rm(dir, { recursive: true, force: true });
  const row = { file: mp4, painted: painted !== null, paintingMs, paintingDoneAfterMs: painted && painted - opened, recordingStartsAfterMs: from - opened, view, state, loop, errors, warnings };
  say(tag, row);
  await save(`record-${tag}.json`, row);
};

run.still = async () => {
  const report = {};
  // "Pause animation": pressed once the mist is at work.
  {
    const { browser, page, errors } = await open();
    await bringIntoView(page);
    await waitStocked(page);
    await page.getByRole('button', { name: 'Pause animation' }).click();
    await wait(400);
    const loop = await readLoop(page, 3000);
    await page.getByRole('button', { name: 'Play animation' }).click().catch(() => page.getByRole('button', { name: /play/i }).click());
    await wait(400);
    const after = await readLoop(page, 2000);
    report.paused = { poses: loop.posesSeen, changes: loop.changes, rachelPoseChanges: loop.rachelPoseChanges, afterPlay: { poses: after.posesSeen, changes: after.changes }, errors };
    await browser.close();
  }
  // Reduced motion: from the first.
  {
    const { browser, page, errors } = await open({ media: 'reduce' });
    await bringIntoView(page);
    await wait(4000);
    const state = await mistState(page);
    const loop = await readLoop(page, 3000);
    report.reduced = { state, poses: loop.posesSeen, changes: loop.changes, errors };
    await browser.close();
  }
  report.ok = report.paused.poses.join() === 'M1' && report.paused.changes === 0 && report.paused.afterPlay.changes > 0 && report.reduced.poses.join() === 'M1' && report.reduced.changes === 0;
  say(tag, report);
  await save(`still-${tag}.json`, report);
};

run.fail = async () => {
  const report = {};
  const measure = async (label, route) => {
    const started = Date.now();
    const { browser, page, errors, warnings } = await open({ route });
    const readyMs = Date.now() - started;
    await bringIntoView(page);
    await wait(1500);
    const state = await mistState(page);
    // Rachel at work: her pose changes over 8 s.
    const poses = await page.evaluate(() => new Promise((resolve) => {
      const seen = []; const end = performance.now() + 8000;
      const tick = () => { const p = window.__hj.scene.character?.current; if (seen.at(-1) !== p) seen.push(p); if (performance.now() < end) requestAnimationFrame(tick); else resolve(seen); };
      requestAnimationFrame(tick);
    }));
    // A find, by tapping the first unfound mushroom's drawing.
    const before = await page.evaluate(() => window.__hj.hunt.remaining);
    await page.evaluate(() => { const b = [...document.querySelectorAll('.hj-shroom')].find((x) => !x.classList.contains('is-found')); b.scrollIntoView?.({ inline: 'center' }); b.click(); });
    await wait(2500);
    const after = await page.evaluate(() => window.__hj.hunt.remaining);
    // The room as painted where the mist is: the screen there against the room's own picture's px (nothing drawn over it).
    const mistElements = await page.evaluate(() => document.querySelectorAll('.hj-plate[data-scene="grow"] [data-actor="mister"]').length);
    const row = { readyMs, state, rachelPosesIn8s: poses.length, rachelPoses: [...new Set(poses)].slice(0, 12), found: before - after, mistElements, warnings, errors: errors.filter((e) => !/scene2\/cast/.test(e) && !/Failed to load resource/.test(e) && !known(e)), blockedErrors: errors.filter((e) => /scene2\/cast|Failed to load resource/.test(e)).length, knownErrors: errors.filter(known).length };
    if (label !== 'normal') {
      // (The find's scrollIntoView pans a phone's view, and the window, away from the mist: back to it.)
      await page.evaluate(() => window.scrollTo(0, 0));
      await bringIntoView(page);
      const { u, ...clip } = await boxOnScreen(page, 4);
      await page.screenshot({ path: `${out}fail-${tag}-${label}.png`, clip: { x: clip.left, y: clip.top, width: clip.width, height: clip.height } });
      row.shot = `fail-${tag}-${label}.png`;
    }
    report[label] = row;
    await browser.close();
  };
  await measure('normal');
  await measure('blocked', (context) => context.route('**/assets/scene2/cast/**', (r) => r.abort('failed')));
  await measure('blocked-stills', (context) => context.route(/\/assets\/scene2\/cast\/mister\//, (r) => r.abort('failed')));
  await measure('stalled', (context) => context.route('**/assets/scene2/cast/**', () => {}));
  const n = report.normal;
  report.ok = ['blocked', 'blocked-stills', 'stalled'].every((k) => report[k].state.order.join() === 'rachel' && report[k].state.leadIsRachel && report[k].rachelPosesIn8s >= Math.min(3, n.rachelPosesIn8s) && report[k].found === 1 && report[k].errors.length === 0)
    && n.state.order.join() === 'mister,rachel';
  say(tag, report);
  await save(`fail-${tag}.json`, report);
};

// Chrome on the phone profile, the processor 4x slower, the production builds (HJ_PROD: this one, HJ_OLD_PROD: the one
// before the mist moved) in turn. Build opens (its painting), then Grow by its tab: its painting, then the window is
// panned to the mist and 12 s of the scene at work are traced. `trace [rounds]`.
run.trace = async () => {
  const builds = { now: process.env.HJ_PROD ?? 'http://127.0.0.1:4173/', before: process.env.HJ_OLD_PROD ?? 'http://127.0.0.1:4174/' };
  const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
  const r1 = (n) => Math.round(n * 10) / 10;
  const report = { machine: execFileSync('uptime').toString().trim(), now: [], before: [] };
  const rounds = Number(process.argv[3] ?? 4);
  for (let i = 0; i < rounds; i++) for (const which of i % 2 ? ['now', 'before'] : ['before', 'now']) {
    const browser = await chromium.launch({ channel: 'chrome' });
    const page = await (await browser.newContext(PHONE)).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${builds[which]}#build`);
    await wait(9000);
    const tab = await page.locator('.hj-tab[data-scene="grow"]').boundingBox();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await wait(1500);
    await browser.startTracing(page, { categories: ['-*', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink.user_timing', 'toplevel', 'loading', 'devtools.timeline.frame'] });
    const point = [{ x: tab.x + tab.width / 2, y: tab.y + tab.height / 2 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(9000);
    // The mist into view (an instant scroll, as a swipe ends), then the scene at work.
    const view = await page.evaluate((box) => {
      const viewport = document.querySelector('.hj-viewport');
      const plate = document.querySelector('.hj-plate[data-scene="grow"]');
      const u = plate.clientWidth / 1672;
      viewport.scrollLeft = (box.x + box.w / 2) * u - viewport.clientWidth / 2;
      performance.mark('hj-mist-in-view');
      const r = viewport.getBoundingClientRect(); const p = plate.getBoundingClientRect();
      return { inView: p.left + box.x * u >= r.left && p.left + (box.x + box.w) * u <= r.right, mist: document.querySelectorAll('.hj-plate[data-scene="grow"] [data-actor="mister"]').length };
    }, BOX);
    await wait(14000);
    const raw = await browser.stopTracing();
    await browser.close();
    const { traceEvents: ev } = JSON.parse(raw.toString());
    const tap = ev.find((e) => e.name === 'EventDispatch' && e.args?.data?.type === 'touchstart') ?? ev.find((e) => e.name === 'EventDispatch' && e.args?.data?.type === 'click');
    const t = (e) => (e.ts - tap.ts) / 1000;
    const drops = ev.filter((e) => e.name === 'DroppedFrame' && e.pid === tap.pid).map(t);
    const tasks = ev.filter((e) => e.name === 'RunTask' && e.ph === 'X' && e.pid === tap.pid && e.tid === tap.tid);
    const part = (from, to) => { const inside = tasks.filter((e) => t(e) >= from && t(e) < to); return { longestTaskMs: r1(Math.max(0, ...inside.map((e) => e.dur)) / 1000), tasksOver50: inside.filter((e) => e.dur > 50000).length, busyMsPerSecond: r1(inside.reduce((a, e) => a + e.dur, 0) / 1000 / ((to - from) / 1000)), dropped: drops.filter((d) => d >= from && d < to).length, framesBegun: ev.filter((e) => e.name === 'BeginFrame' && e.pid === tap.pid && t(e) >= from && t(e) < to).length }; };
    const paint = ev.find((e) => e.name === 'hj-paint' && String(e.cat).includes('user_timing') && e.ts > tap.ts);
    const inView = ev.find((e) => e.name === 'hj-mist-in-view' && String(e.cat).includes('user_timing'));
    const clock = paint ? t(paint) : 0;
    const seen = inView ? t(inView) : 9000;
    report[which].push({ view, firstStrokeAtMs: Math.round(clock), painting: part(clock, clock + 4750), mistInView12s: part(seen + 1000, seen + 13000), droppedInViewAtMs: drops.filter((d) => d >= seen + 1000 && d < seen + 13000).map((d) => Math.round(d - seen)), errors });
    say(`${which} ${i + 1}`, report[which].at(-1));
    const keep = process.env.HJ_TRACES ? `${process.env.HJ_TRACES}${which}-${i + 1}.json` : i === 0 ? `${out}trace-grow-phone-4x-${which}.json` : null;
    if (keep) { await writeFile(keep, raw); execFileSync('gzip', ['-f', keep]); }
    await save('trace.json', report);
  }
};

if (!run[cmd]) {
  console.error(`No command "${cmd}". One of: ${Object.keys(run).join(', ')}`);
  process.exit(1);
}
await run[cmd]();

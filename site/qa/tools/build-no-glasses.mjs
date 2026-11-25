// Job 008: Build without glasses, the hammer's and the thumb's in-betweens (reviews/build-no-glasses-01.md).
// And job 010, the fixed art and frame_02_03ab (reviews/build-no-glasses-02.md): HJ_OUT=../build-no-glasses-02/, the one before is 3e13a58.
// Results: qa/build-no-glasses/ (HJ_OUT). `npm run dev` for this build (HJ_URL, 5173) and the one before (HJ_OLD_URL, 5174; 60f19b8).
//   node qa/tools/build-no-glasses.mjs faces     every Build drawing's face at 1:1, as built, both sizes; specks; what the eyes are like from drawing to drawing
//   node qa/tools/build-no-glasses.mjs record    60 fps: three swings, a tap, a find (thumbs-up and wink); strips of the rise and of the thumb; what flickers
//   node qa/tools/build-no-glasses.mjs memory    what Build holds on its own, before and now (the 30 orders: scene5.mjs memory)
//   node qa/tools/build-no-glasses.mjs seam      the drawings kept as patches, on her real canvas, 7 windows, Chrome and WebKit
//   node qa/tools/build-no-glasses.mjs held [s]  how long each in-between is really on screen: desktop, the phone slowed four times, WebKit
import { chromium, webkit, devices } from 'playwright';
import { execFileSync } from 'node:child_process';
import { link, mkdir, writeFile, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const base = process.env.HJ_URL ?? 'http://127.0.0.1:5173/';
const old = process.env.HJ_OLD_URL ?? 'http://127.0.0.1:5174/';
const out = new URL(process.env.HJ_OUT ?? '../build-no-glasses/', import.meta.url).pathname;
const repo = new URL('../../../', import.meta.url).pathname;
const assets = `${repo}site/public/assets/scene1/`;
await mkdir(out, { recursive: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const say = (label, value) => console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
const save = (name, data) => writeFile(`${out}${name}`, `${JSON.stringify(data, null, 1)}\n`);
const errorsOf = (page) => { const errors = []; page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200))); page.on('pageerror', (e) => errors.push(e.message)); return errors; };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const DESK = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
const label = (t, width, size = 14) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${size + 10}"><text x="3" y="${size + 2}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" fill="#302e29">${t}</text></svg>`);
const sheet = async (tiles, w, h, per, file) => {
  const parts = tiles.flatMap(([t, input], i) => { const left = (i % per) * (w + 6); const top = Math.floor(i / per) * (h + 28); return [{ input: label(t, w), left, top }, { input, left, top: top + 24 }]; });
  await sharp({ create: { width: per * (w + 6), height: Math.ceil(tiles.length / per) * (h + 28), channels: 3, background: '#e9e5dc' } }).composite(parts).png().toFile(`${out}${file}`);
};
const LOOP = ['frame_01', 'frame_01_02', 'frame_02', 'frame_02_03a', 'frame_02_03ab', 'frame_02_03b', 'frame_03', 'frame_04', 'blink_half', 'blink_closed'];
const RX = ['frame_01', 'A24', 'A25', 'A49', 'A52', 'A53', 'A55', 'A58', 'K1', 'K1_B36', 'B36', 'B36_B39', 'B39', 'B41', 'K2', 'wink_half', 'wink'];
const SHARED = { frame_01: 'frame_01', K1: 'K1', K2: 'K2' };
/** The 29: what it is called, the built file inside a set, the delivered one. */
const DRAWINGS = [...[...LOOP, 'K1', 'K2'].map((n) => [n, `${n}.webp`, `016-upscale/approved/${n}.png`]), ...RX.map((n) => [`rx_${n}`, SHARED[n] ? `${SHARED[n]}.webp` : `reaction/rx_${n}.webp`, `005-reaction-motion/approved/rx_${n}.png`])];
const W = 1146; const H = 916;
const PATCHES = JSON.parse(readFileSync(`${repo}site/src/scenes/build-patches.json`, 'utf8'));
/** A built drawing, whole: a patch is put on its base as the page does (its outermost 4 px left out). */
const builtOf = async (dir, file) => {
  const pose = file.startsWith('reaction/') ? file.replace('.webp', '.png') : file.replace('.webp', '');
  const patch = PATCHES[dir][pose]; if (!patch) return `${assets}${dir}${file}`;
  const baseName = patch.base.replace('reaction/rx_K1.png', 'K1').replace('.png', '');
  const { data, info } = await sharp(`${assets}${dir}${baseName}.webp`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const p = await sharp(`${assets}${dir}${file}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = 4; y < p.info.height - 4; y++) p.data.copy(data, ((patch.y + y) * info.width + patch.x + 4) * 4, (y * p.info.width + 4) * 4, ((y + 1) * p.info.width - 4) * 4);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
};
const load = async (file) => { const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) data[i + c] = Math.round((data[i + c] * data[i + 3]) / 255); return { data, w: info.width, h: info.height }; };
/** Connected pieces of a mask: their sizes and boxes. */
const pieces = (mask, w, h) => {
  const seen = new Uint8Array(mask.length); const list = [];
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || seen[s]) continue;
    const stack = [s]; seen[s] = 1; let n = 0; let b = [1e9, 1e9, -1, -1];
    while (stack.length) { const i = stack.pop(); n++; const x = i % w; const y = (i / w) | 0; b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)]; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx; const Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X; if (mask[j] && !seen[j]) { seen[j] = 1; stack.push(j); } } }
    list.push({ n, b });
  }
  return list.sort((a, b) => b.n - a.n);
};
// Where her face is in a drawing (its own px): the loop looks down, the reaction up.
const FACE = [250, 190, 290, 240];
const EYES = { loop: [345, 265, 155, 95], rx: [285, 232, 215, 125] };
const run = {};

run.faces = async () => {
  const report = {};
  for (const [set, dir, k] of [['full', 'rachel/', 1], ['1.5x', 'rachel-1.5x/', 0.75]]) {
    const tiles = []; report[set] = {};
    const [l, t, w, h] = FACE.map((n) => Math.round(n * k));
    for (const [name, file, png] of DRAWINGS) {
      const built = await builtOf(dir, file);
      tiles.push([name, await sharp(built).extract({ left: l, top: t, width: w, height: h }).flatten({ background: '#cfc4b0' }).png().toBuffer()]);
      const a = await load(built); const d = await load(`${repo}frames/${png}`);
      const islands = pieces(Uint8Array.from({ length: a.w * a.h }, (_, i) => (a.data[i * 4 + 3] > 24 ? 1 : 0)), a.w, a.h).slice(1).filter((p) => p.n < 400);
      // Specks about the eyes: single points far from what is all around them (the middle of the 5x5 px about each),
      // counted on the delivered drawing and on the built one.
      const e = (name.startsWith('rx_') && name !== 'rx_frame_01') || /^K/.test(name) ? EYES.rx : EYES.loop;
      const specks = (p, s) => { let n = 0; const [x0, y0, ww, hh] = e.map((v) => Math.round(v * s)); const lum = (x, y) => { const i = (y * p.w + x) * 4; return 0.3 * p.data[i] + 0.59 * p.data[i + 1] + 0.11 * p.data[i + 2]; }; for (let y = y0; y < y0 + hh; y++) for (let x = x0; x < x0 + ww; x++) { const ring = []; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === 2) ring.push(lum(x + dx, y + dy)); const lo = Math.min(...ring); const hi = Math.max(...ring); const v = lum(x, y); if (hi - lo < 60 && (v < lo - 45 || v > hi + 45)) n++; } return n; };
      report[set][name] = { loosePieces: islands, specksDelivered: specks(d, 1), specksBuilt: specks(a, k) };
      if (k === 1) { let sum = 0; let max = 0; const [x0, y0, ww, hh] = e; for (let y = y0; y < y0 + hh; y++) for (let x = x0; x < x0 + ww; x++) { const i = (y * W + x) * 4; const q = Math.max(...[0, 1, 2].map((c) => Math.abs(a.data[i + c] - d.data[i + c]))); sum += q; max = Math.max(max, q); } report[set][name].eyesBuiltFromDelivered = { mean: r2(sum / (ww * hh)), max }; }
    }
    await sheet(tiles, w, h, 7, `faces-${set}.png`);
    const eyes = await Promise.all(DRAWINGS.map(async ([name, file]) => { const e = (name.startsWith('rx_') && name !== 'rx_frame_01') || /^K/.test(name) ? EYES.rx : EYES.loop; const [x, y, ww, hh] = e.map((n) => Math.round(n * k)); const ew = Math.round(215 * k); const eh = Math.round(125 * k); return [name, await sharp(await builtOf(dir, file)).extract({ left: x, top: y, width: ww, height: hh }).flatten({ background: '#cfc4b0' }).resize(ew * 2, eh * 2, { kernel: 'nearest', fit: 'contain', background: '#cfc4b0' }).png().toBuffer()]; }));
    await sheet(eyes, Math.round(215 * k) * 2, Math.round(125 * k) * 2, 5, `eyes-${set}-2x.png`);
    const rows = Object.entries(report[set]);
    say(set, { drawings: rows.length, loose: rows.filter(([, r]) => r.loosePieces.length).map(([n, r]) => [n, r.loosePieces]), specks: rows.filter(([, r]) => r.specksBuilt || r.specksDelivered).map(([n, r]) => [n, r.specksDelivered, r.specksBuilt]), worstBuilt: rows.reduce((m, [, r]) => Math.max(m, r.eyesBuiltFromDelivered?.mean ?? 0), 0) });
  }
  await save('faces.json', report);
};

const open = async (browser, url, options, query = '?debug&reset&intro=off&seed=7') => {
  const page = await (await browser.newContext(options)).newPage(); const errors = errorsOf(page);
  await page.goto(`${url}${query}#build`);
  await page.waitForFunction(() => window.__hj?.ready === true && window.__hj.rachel?.has('reaction/rx_wink.png') && window.__hj.rachel.has('frame_04'), null, { timeout: 60000 });
  await page.evaluate(() => document.querySelectorAll('.hj-mushrooms').forEach((el) => el.classList.remove('is-debug')));
  await wait(2500);
  return { page, errors };
};
const filmOf = async (page, dir) => {
  await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page); const frames = []; const writes = [];
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => { const file = `${dir}${String(frames.length).padStart(5, '0')}.jpg`; frames.push({ at: metadata.timestamp * 1000, file }); writes.push(writeFile(file, Buffer.from(data, 'base64'))); void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {}); });
  return { frames, start: () => cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 1 }), stop: async () => { await cdp.send('Page.stopScreencast'); await Promise.all(writes); } };
};
// Each frame of the film is the last one recorded by then. (ffmpeg's own concat list of pictures, used until job 010, rounds
// their times to 25 a second: the drawings of a move came out 33 or 83 ms long.)
const toMp4 = async (frames, mp4) => {
  frames = frames.filter((f, i) => !frames[i + 1] || frames[i + 1].at > f.at);
  const list = []; for (let t = frames[0].at + 8, i = 0; t < frames.at(-1).at + 25; t += 1000 / 60) { while (frames[i + 1]?.at <= t) i++; list.push(frames[i].file); }
  const dir = `${mp4}.frames/`; await rm(dir, { recursive: true, force: true }); await mkdir(dir); await Promise.all(list.map((file, i) => link(file, `${dir}${String(i).padStart(6, '0')}.jpg`)));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '60', '-i', `${dir}%06d.jpg`, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', mp4]);
  await rm(dir, { recursive: true, force: true });
};
/** What is solid and the same in all these delivered drawings, less a rim, as a mask of her frame: nothing there may change on screen. */
const steady = async (names, from, r = 8) => {
  const all = await Promise.all(names.map((n) => sharp(`${repo}frames/${from}/${n}.png`).ensureAlpha().raw().toBuffer()));
  const ok = new Uint8Array(W * H).fill(1);
  for (const d of all) for (let i = 0; i < W * H; i++) { if (d[i * 4 + 3] < 255) { ok[i] = 0; continue; } for (let c = 0; c < 3; c++) if (Math.abs(d[i * 4 + c] - all[0][i * 4 + c]) > 2) ok[i] = 0; }
  const mask = new Uint8Array(W * H);
  for (let y = r; y < H - r; y++) for (let x = r; x < W - r; x++) { let good = 1; for (let dy = -r; dy <= r && good; dy += 2) for (let dx = -r; dx <= r && good; dx += 2) good = ok[(y + dy) * W + x + dx]; mask[y * W + x] = good; }
  return mask;
};
const watchPoses = (page) => page.evaluate(() => { const c = window.__hj.rachel; const w = (window.__steps = [[c.current, performance.timeOrigin + performance.now()]]); const show = c.show.bind(c); c.show = (p) => { if (p !== c.current) w.push([p, performance.timeOrigin + performance.now()]); show(p); }; });
const RISE = 'frame_01_02 frame_02 frame_02_03a frame_02_03ab frame_02_03b frame_03 frame_04';
const TAP = 'frame_01_02 frame_02 frame_01_02';
const movesOf = (steps) => { const list = []; let m = null; for (const [i, [pose, at]] of steps.entries()) { if (pose === 'frame_01' || pose.startsWith('blink')) { m = null; continue; } if (!m) list.push((m = { at, poses: [] })); m.poses.push(pose); m.end = steps[i + 1]?.[1]; } return list.map((x) => ({ ...x, name: x.poses.join(' ') })); };
const DEVICE = { desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, phone: PHONE, 'phone-3x': { viewport: null } };

run.record = async () => {
  const report = {};
  // Her eyes: open and the same in every drawing of a swing (since job 010 no arm is before them in any).
  const CLEAR = LOOP.filter((n) => !n.startsWith('blink'));
  const THUMB = ['rx_K1', 'rx_K1_B36', 'rx_B36', 'rx_B36_B39', 'rx_B39', 'rx_B41'];
  const masks = { loop: await steady(CLEAR, '016-upscale/approved'), loopEyes: await steady(CLEAR, '016-upscale/approved', 4), thumb: await steady(THUMB, '005-reaction-motion/approved', 4) };
  const eyeOnly = (mask, [x0, y0, w, h]) => mask.map((v, i) => { const x = i % W; const y = (i / W) | 0; return v && x >= x0 && x < x0 + w && y >= y0 && y < y0 + h ? 1 : 0; });
  masks.loopEyes = eyeOnly(masks.loopEyes, EYES.loop); masks.thumbEyes = eyeOnly(masks.thumb, EYES.rx);
  for (const [name, options] of Object.entries(DEVICE).filter(([n]) => !process.argv[3] || n === process.argv[3])) {
    const browser = await chromium.launch({ channel: 'chrome', args: options.viewport === null ? ['--window-size=500,1169', '--force-device-scale-factor=3', '--hide-scrollbars'] : [] });
    const { page, errors } = await open(browser, base, options);
    await watchPoses(page);
    const dir = new URL(`../../node_modules/.hj/j8/${name}/`, import.meta.url).pathname;
    const film = await filmOf(page, dir);
    const box = await page.locator('.hj-plate[data-scene="build"] .hj-rachel').boundingBox(); const win = await page.locator('.hj-viewport').boundingBox();
    await film.start();
    for (let s = 0; s < 90; s++) { await wait(500); const m = movesOf(await page.evaluate(() => window.__steps)); const done = m.filter((x) => x.end); if (done.filter((x) => x.name === RISE).length >= 3 && done.some((x) => x.name === TAP)) break; }
    const foundAt = await page.evaluate(() => { document.querySelector('.hj-plate[data-scene="build"] [data-spot="toolbox"]').click(); return performance.timeOrigin + performance.now(); });
    await wait(9000);
    await film.stop();
    const steps = await page.evaluate(() => window.__steps); const missed = await page.evaluate(() => window.__hj.rachel.missed);
    // Cut the recording to the last three swings and tap before the find, and all after.
    const all = movesOf(steps); const before = all.filter((m) => m.at < foundAt); let from = 0; { const need = { [RISE]: 3, [TAP]: 1 }; for (let i = before.length - 1; i >= 0; i--) { if (need[before[i].name]) need[before[i].name]--; if (!need[RISE] && !need[TAP]) { from = before[i].at - 600; break; } } }
    const kept = film.frames.filter((f) => f.at >= from); const size = await sharp(kept[0].file).metadata(); const k = size.width / (await page.evaluate(() => innerWidth));
    const L = Math.max(win.x, box.x); const T = Math.max(win.y, box.y); const cut = { left: Math.ceil(L * k), top: Math.ceil(T * k) }; cut.width = Math.floor(Math.min(win.x + win.width, box.x + box.width) * k) - cut.left; cut.height = Math.floor(Math.min(win.y + win.height, box.y + box.height) * k) - cut.top;
    const onScreen = (mask) => { const list = []; for (let y = 0; y < cut.height; y++) for (let x = 0; x < cut.width; x++) { const sx = Math.floor((((cut.left + x + 0.5) / k - box.x) / box.width) * W); const sy = Math.floor((((cut.top + y + 0.5) / k - box.y) / box.height) * H); if (sx >= 0 && sy >= 0 && sx < W && sy < H && mask[sy * W + sx]) list.push(y * cut.width + x); } return list; };
    const poseAt = (t) => steps.findLast((s) => s[1] <= t)?.[0] ?? 'frame_01';
    // Between two recorded frames, neither within 40 ms of a pose this part is not the same in: the largest change.
    const measure = async (list, allowed) => { let prev = null; let worst = { mean: 0 }; let worstPx = 0; let n = 0; for (const f of kept) { const okay = [-40, 0, 40].every((d) => allowed(poseAt(f.at + d), f.at)); if (!okay) { prev = null; continue; } const d = await sharp(f.file).extract(cut).removeAlpha().raw().toBuffer(); if (prev) { n++; let sum = 0; for (const i of list) { const e = Math.max(...[0, 1, 2].map((c) => Math.abs(d[i * 3 + c] - prev[i * 3 + c]))); sum += e; worstPx = Math.max(worstPx, e); } if (sum / list.length > worst.mean) worst = { mean: r2(sum / list.length), pose: poseAt(f.at), atMs: Math.round(f.at - kept[0].at) }; } prev = d; } return { px: list.length, framesCompared: n, worstMean: worst, worstSinglePx: worstPx }; };
    const loopPose = (p) => LOOP.includes(p); const rx = THUMB.map((n) => `reaction/${n}.png`);
    const row = { recordedFrames: kept.length, seconds: r1((kept.at(-1).at - kept[0].at) / 1000), framePx: [size.width, size.height], longestGapMs: r1(Math.max(...kept.slice(1).map((f, i) => f.at - kept[i].at))), skippedPoses: missed, errors,
      whereNothingMovesInTheLoop: await measure(onScreen(masks.loop), (p, at) => loopPose(p) && !p.startsWith('blink') && at < foundAt),
      eyesInTheLoop: await measure(onScreen(masks.loopEyes), (p, at) => CLEAR.includes(p) && at < foundAt),
      eyesAsTheThumbComesUp: await measure(onScreen(masks.thumbEyes), (p) => rx.includes(p)),
      bodyAsTheThumbComesUp: await measure(onScreen(masks.thumb), (p) => rx.includes(p)) };
    const shown = steps.map(([pose, at], i) => ({ pose, at, ms: steps[i + 1] ? Math.round(steps[i + 1][1] - at) : null })).filter((s) => s.at >= from);
    row.poses = shown.map((s) => `${s.pose.replace('reaction/', '').replace('.png', '')} ${s.ms}`).join(', ');
    const tileH = Math.round(cut.height * 0.97);
    const strip = async (a, b, file) => { const list = kept.filter((f) => f.at >= a && f.at <= b).slice(0, 48); const w = name === 'phone' ? cut.width : 300; const c = { ...cut, height: tileH }; const h = Math.round((w / c.width) * c.height); await sheet(await Promise.all(list.map(async (f) => [`${Math.round(f.at - a)} ms ${poseAt(f.at).replace('reaction/', '').replace('.png', '')}`, await sharp(f.file).extract(c).resize(w, h).png().toBuffer()])), w, h, 8, `${file}.png`); await sharp(`${out}${file}.png`).jpeg({ quality: 86 }).toFile(`${out}${file}.jpg`); await rm(`${out}${file}.png`); };
    const swing = before.findLast((m) => m.name === RISE); const tap = before.findLast((m) => m.name === TAP);
    await strip(swing.at - 40, swing.end + 60, `${name}-rise`); await strip(tap.at - 40, tap.end + 60, `${name}-tap`);
    // And every drawing of that rise, from the contact to the wind-up, at the recording's own px: her head, arm and hammer.
    { const d = steps.filter((s) => s[1] >= swing.at - 1 && s[1] < swing.end).map(([pose, at], i, l) => ({ pose, at: (at + (l[i + 1]?.[1] ?? swing.end)) / 2 })).slice(0, 7); const px = (x) => Math.round(((x / W) * box.width + box.x) * k); const py = (y) => Math.round(((y / H) * box.height + box.y) * k); const c = { left: Math.max(cut.left, px(20)), top: Math.max(cut.top, py(0)) }; c.width = px(720) - c.left; c.height = py(640) - c.top; const tiles = await Promise.all(d.map(async ({ pose, at }) => [pose, await sharp(film.frames.findLast((f) => f.at <= at + 12 && poseAt(f.at - 6) === pose)?.file ?? film.frames.findLast((f) => f.at <= at).file).extract(c).png().toBuffer()])); await sheet(tiles, c.width, c.height, 4, `${name}-rise-1to1.png`); await sharp(`${out}${name}-rise-1to1.png`).jpeg({ quality: 93, chromaSubsampling: '4:4:4' }).toFile(`${out}${name}-rise-1to1.jpg`); await rm(`${out}${name}-rise-1to1.png`); }
    const up = shown.find((s) => s.pose.includes('rx_K1_B36')); const down = shown.findLast((s) => s.pose.includes('rx_B36_B39') && s.at > up.at + 500);
    await strip(up.at - 40, up.at + 260, `${name}-thumb-up`); await strip(down.at - 80, down.at + 200, `${name}-thumb-down`);
    const wink = shown.find((s) => s.pose.includes('rx_wink')); if (wink) await strip(wink.at - 40, wink.at + 330, `${name}-wink`);
    await toMp4(kept, `${out}hammer-and-thumbs-up-${name}-60fps.mp4`);
    report[name] = row; say(name, row); await browser.close(); await rm(dir, { recursive: true, force: true });
    await save(`record${process.argv[3] ? `-${process.argv[3]}` : ''}.json`, report);
  }
};

// The drawings kept as patches, on her real canvas: where the delivered drawing is its base's, the canvas must be
// the base's (a seam or a flicker otherwise); and inside, against the whole delivered drawing. Along the patch's rim: a step.
run.seam = async () => {
  const report = {}; const uri = async (f) => `data:image/png;base64,${readFileSync(`${repo}frames/${f}`).toString('base64')}`;
  const pics = {}; for (const pose of Object.keys(PATCHES['rachel/'])) { const { base: b } = PATCHES['rachel/'][pose]; const at = (n) => uri(n.startsWith('reaction/') ? `005-reaction-motion/approved/${n.slice(9)}` : `016-upscale/approved/${n}.png`); pics[pose] = { pose, base: b, png: await at(pose), basePng: await at(b) }; }
  for (const [en, engine] of [['chrome', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {});
    for (const [size, options] of [['phone 390×844, 3x', PHONE], ['phone 360×740, 3x', { ...PHONE, viewport: { width: 360, height: 740 } }], ['phone 412×915, 2.625x', { ...PHONE, viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625 }], ['phone on its side 844×390, 3x', { ...PHONE, viewport: { width: 844, height: 390 } }], ['desktop 1440×900, 1x', { ...DESK, deviceScaleFactor: 1 }], ['desktop 1440×900, 2x', DESK], ['desktop 2560×1440, 2x', { viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 2 }]]) {
      const { page, errors } = await open(browser, base, options);
      const rows = await page.evaluate(async (list) => {
        window.__hj.player.stop(); const c = window.__hj.rachel; const canvas = c.el.querySelector('canvas'); const cw = canvas.width; const ch = canvas.height;
        const grab = (src, w = cw, h = ch) => { const k = document.createElement('canvas'); k.width = w; k.height = h; const g = k.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h); const d = g.getImageData(0, 0, w, h).data; for (let i = 0; i < d.length; i += 4) for (let q = 0; q < 3; q++) d[i + q] = (d[i + q] * d[i + 3]) / 255; return d; };
        const pic = async (u) => { const i = new Image(); i.src = u; await i.decode(); return i; };
        const diff = (a, b, i) => Math.max(...[0, 1, 2, 3].map((q) => Math.abs(a[i * 4 + q] - b[i * 4 + q])));
        const out = [];
        for (const { pose, base, png, basePng } of list) {
          const [p, b] = await Promise.all([pic(png), pic(basePng)]); const W = p.naturalWidth; const H = p.naturalHeight; const pf = grab(p, W, H); const bf = grab(b, W, H);
          const moved = new Uint8Array(cw * ch); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (diff(pf, bf, y * W + x) < 1) continue; const x0 = Math.max(0, Math.floor(((x - 3) / W) * cw)); const x1 = Math.min(cw - 1, Math.floor(((x + 4) / W) * cw)); for (let yy = Math.max(0, Math.floor(((y - 3) / H) * ch)); yy <= Math.min(ch - 1, Math.floor(((y + 4) / H) * ch)); yy++) moved.fill(1, yy * cw + x0, yy * cw + x1 + 1); }
          c.show(base); const bc = grab(canvas); c.show(pose); const mine = grab(canvas); const whole = grab(p); const other = grab(b);
          // Come to from a drawing that is neither: the base must be put there first.
          c.show('blink_closed'); c.show(pose); const again = grab(canvas);
          let max = 0; let sum = 0; let n = 0; let inSum = 0; let inN = 0; let over48 = 0; let same = 0;
          for (let i = 0; i < cw * ch; i++) { same = Math.max(same, diff(mine, again, i)); if (!moved[i]) { const d = diff(mine, bc, i); if (mine[i * 4 + 3]) { sum += d; n++; } max = Math.max(max, d); } else { const e = diff(mine, whole, i); inSum += e; inN++; if (e > 48) over48++; } }
          void other; out.push({ pose, current: c.current, canvas: [cw, ch], unmovedMax: max, unmovedMean: Math.round((sum / n) * 1000) / 1000, movedPx: inN, movedMeanFromDelivered: Math.round((inSum / inN) * 100) / 100, movedOver48: over48, comingFromAnotherDrawingDiffers: same });
        }
        return out;
      }, Object.values(pics));
      report[`${en}, ${size}`] = { rows, errors };
      say(`${en}, ${size}`, { canvas: rows[0].canvas, shown: rows.every((r) => r.current === r.pose), unmovedMax: rows.map((r) => r.unmovedMax), unmovedMean: rows.map((r) => r.unmovedMean), movedMean: rows.map((r) => r.movedMeanFromDelivered), over48: rows.map((r) => r.movedOver48), again: rows.map((r) => r.comingFromAnotherDrawingDiffers), errors });
      await page.context().close();
    }
    await browser.close(); await save('seam.json', report);
  }
};

// Frames each drawing is on screen, counted by requestAnimationFrame (so a late or dropped frame shows).
run.held = async () => {
  const seconds = Number(process.argv[3] ?? 60); const report = {};
  for (const [name, engine, options, rate] of [['Chrome, desktop', chromium, DESK, 1], ['Chrome, phone, 4x slower', chromium, PHONE, 4], ['WebKit, iPhone profile', webkit, { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } }, 1]]) {
    const browser = await engine.launch(engine === chromium ? { channel: 'chrome', headless: !!process.env.HJ_HEADLESS } : {});
    const { page, errors } = await open(browser, base, options);
    if (rate > 1) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate });
    await page.evaluate(() => { const log = (window.__held = []); let last = null; const tick = () => { const p = window.__hj.rachel.current; if (last?.p === p) last.n++; else log.push((last = { p, n: 1 })); requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    await watchPoses(page);
    const spots = ['toolbox', 'tiles', 'screed', 'drape']; const each = seconds / (spots.length + 1);
    for (const s of spots) { await wait(each * 1000); await page.evaluate((id) => document.querySelector(`.hj-plate[data-scene="build"] [data-spot="${id}"]`).click(), s); }
    await wait(each * 1000);
    const { held, steps, missed } = await page.evaluate(() => ({ held: window.__held, steps: window.__steps, missed: window.__hj.rachel.missed }));
    const count = {}; for (const h of held.slice(1, -1)) { const key = h.p.replace('reaction/', '').replace('.png', ''); (count[key] ??= {})[h.n] = (count[key][h.n] ?? 0) + 1; }
    const moves = movesOf(steps.slice(0, -1)); const names = {}; for (const m of moves) if (m.end && !m.name.includes('reaction')) names[m.name] = (names[m.name] ?? 0) + 1;
    const swings = moves.filter((m) => m.name === RISE && m.end); const times = {}; for (let i = 0; i < steps.length - 1; i++) (times[steps[i][0]] ??= []).push(steps[i + 1][1] - steps[i][1]);
    report[name] = { errors, skipped: missed, moves: names, framesOnScreen: count, meanMs: Object.fromEntries(Object.entries(times).map(([p, v]) => [p.replace('reaction/', '').replace('.png', ''), [v.length, r1(v.reduce((a, b) => a + b, 0) / v.length)]])), posesDrawnButNeverOnScreen: steps.length - held.length, riseToWindUpMs: r1(swings.reduce((a, m) => a + (steps.find((s) => s[1] > m.at && s[0] === 'frame_03')[1] - m.at), 0) / swings.length) };
    say(name, report[name]); await browser.close(); await save('held.json', report);
  }
};

run.memory = async () => {
  const report = {};
  for (const [name, engine, options] of [['webkit, iPhone 14 profile', webkit, { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } }], ['chrome, phone 3x', chromium, PHONE], ['chrome, desktop 2x', chromium, DESK]]) {
    const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {}); report[name] = {};
    for (const [which, url] of [['before', old], ['now', base]]) {
      const page = await (await browser.newContext(options)).newPage(); const errors = errorsOf(page);
      await page.goto(`${url}?debug&reset&seed=7#build`); await page.waitForFunction(() => window.__hj?.scene, null, { timeout: 60000 });
      await page.evaluate(() => { const w = (window.__most = {}); const tick = () => { const p = window.__hj.memory.parts; let mine = 0; for (const [k, v] of Object.entries(p)) if (k.startsWith('build.')) { mine += v; w[k] = Math.max(w[k] ?? 0, v); } w.buildTotal = Math.max(w.buildTotal ?? 0, mine); w.page = Math.max(w.page ?? 0, window.__hj.memory.total ?? 0); requestAnimationFrame(tick); }; tick(); });
      await page.waitForFunction(() => window.__hj.ready === true, null, { timeout: 60000 });
      for (const spot of ['toolbox', 'tiles']) { await wait(6000); await page.evaluate((id) => document.querySelector(`.hj-plate [data-spot="${id}"]`).click(), spot); }
      await wait(12000);
      const mb = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v).map(([k, v]) => [k, Math.round(v / 1e4) / 100]));
      const rest = await page.evaluate(() => Object.fromEntries(Object.entries(window.__hj.memory.parts).filter(([k]) => k.startsWith('build.'))));
      report[name][which] = { atRestMB: mb(rest), atRestBuildMB: Math.round(Object.values(rest).reduce((x, y) => x + y, 0) / 1e4) / 100, mostMB: mb(await page.evaluate(() => window.__most)), errors };
      await page.context().close();
    }
    report[name].buildAddsAtRestMB = r2(report[name].now.atRestBuildMB - report[name].before.atRestBuildMB);
    say(name, report[name]); await browser.close();
  }
  await save('memory.json', report);
};
// Left while one of the patches is on her canvas, and come back to: she is drawn as she was, then carries on, with every frame back.
run.leave = async () => {
  const report = {};
  for (const [en, engine] of [['chrome', chromium], ['webkit', webkit]]) for (const pose of ['frame_01_02', 'frame_02_03ab', 'frame_02_03b']) {
    const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {}); const { page, errors } = await open(browser, base, PHONE, '?debug&reset&intro=quick&seed=7');
    const go = async (id) => { await page.locator(`.hj-tab[data-scene="${id}"]`).tap(); await page.waitForFunction((x) => window.__hj.scene?.config.id === x && !window.__hj.busy, id, { timeout: 60000 }); };
    await page.evaluate(async (p) => { const { rachel, player } = window.__hj; window.__was = rachel; player.stop(); rachel.show(p); window.__pic = (() => { const c = rachel.el.querySelector('canvas'); return c.toDataURL(); })(); }, pose);
    await go('grow'); await wait(1500);
    const away = await page.evaluate(() => ({ held: window.__hj.memory.parts['build.frames'], current: window.__was.current }));
    await go('build'); await wait(400);
    await page.waitForFunction(() => window.__hj.rachel.has('reaction/rx_B36_B39.png') && window.__hj.rachel.has('frame_02_03b'), null, { timeout: 30000 });
    const back = await page.evaluate(async () => { const { rachel } = window.__hj; const n = {}; const c = rachel.el.querySelector('canvas'); rachel.show('frame_01'); const a = c.toDataURL(); rachel.show(window.__back ?? 'frame_02'); n.draws = a !== c.toDataURL(); n.missed = rachel.missed; return n; });
    const same = await page.evaluate((p) => { const { rachel } = window.__hj; rachel.show('blink_half'); rachel.show(p); return rachel.el.querySelector('canvas').toDataURL() === window.__pic; }, pose);
    await page.evaluate(() => document.querySelector('.hj-plate[data-scene="build"] [data-spot="toolbox"]').click());
    const rx = await page.waitForFunction(() => window.__hj.rachel.current === 'reaction/rx_B36_B39.png', null, { timeout: 15000, polling: 'raf' }).then(() => true, () => false);
    report[`${en} ${pose}`] = { heldAwayMB: r2(away.held / 1e6), ...back, samePictureAsBefore: same, reactionReachesTheNewDrawing: rx, errors }; say(`${en} ${pose}`, report[`${en} ${pose}`]); await browser.close();
  }
  await save('leave.json', report);
};
await run[process.argv[2]]?.();

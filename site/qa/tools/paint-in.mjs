// Round 4: Rachel is painted in with the room (reviews/scene-5-build-round4.md), all five scenes.
// Needs `npm run dev` (HJ_URL for another address); `trace` and `webkit` need the production build served
// (`npm run build && npm run preview`, HJ_PROD, default 4173). Results go to qa/paint/.
//
//   node qa/tools/paint-in.mjs plan            the stroke plans alone: when the brush covers her and the room around her, frame by frame
//   node qa/tools/paint-in.mjs record [scene]  the first-visit painting at 60 fps, 1440×900 and 390×844; the strip of 1:1 crops around her;
//                                              and, on every recorded frame, that the room around her is never painted while she is not
//   node qa/tools/paint-in.mjs switch          a first-visit switch, the short brush and a return visit, recorded; what shows of her, frame by frame
//   node qa/tools/paint-in.mjs states          what is drawn while the brush is at work (nothing of the cast); Skip, Replay, a slow network, intro=off, reduced motion
//   node qa/tools/paint-in.mjs trace [scene]   a Chrome trace of the painting, phone, processor slowed four times, production build
//   node qa/tools/paint-in.mjs webkit [scene]  frame times of the painting in WebKit (iPhone profile), production build
import { chromium, webkit, devices } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';

const base = process.env.HJ_URL ?? 'http://localhost:5173/';
const prod = process.env.HJ_PROD ?? 'http://localhost:4173/';
// (HJ_OUT: another folder for the results, e.g. ../review-fixes/counter/)
const out = new URL(process.env.HJ_OUT ?? '../paint/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const IDS = ['build', 'grow', 'design', 'film', 'set'];
const N = (id) => IDS.indexOf(id) + 1;
const PLATE = { w: 1672, h: 941 };
const phone = { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } };
const say = (label, value) => console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
const save = (name, data) => writeFile(`${out}${name}`, `${JSON.stringify(data, null, 1)}\n`);
const r1 = (n) => Math.round(n * 10) / 10;
const r3 = (n) => Math.round(n * 1000) / 1000;
const errorsOf = (page) => {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
};
const launch = (engine) => engine.launch(engine === chromium ? { channel: 'chrome' } : {});
const ready = (page) => page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 60000 });
const text = (t, width, size = 14) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${size + 8}"><text x="2" y="${size + 1}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" fill="#302e29">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
const ONLY = process.argv[3];
const run = {};

// A ring of the room this wide around her silhouette is "the room around her", in plate px.
const RING = 70;

/**
 * In the page: her silhouette at her first frame, in plate px at half size, as a string of 0/1 rows. It is
 * everyone on her layer's own canvas (and shadow excluded), alpha over 40%.
 */
const silhouette = (page) => page.evaluate((P) => {
  const { scene } = window.__hj;
  const c = scene.character; const p = c.placement;
  const canvas = document.createElement('canvas'); canvas.width = P.w / 2; canvas.height = Math.round(P.h / 2);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(c.canvas, p.left / 2, p.top / 2, p.width / 2, p.height / 2);
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let bits = ''; for (let i = 3; i < d.length; i += 4) bits += d[i] > 102 ? '1' : '0';
  return { w: canvas.width, h: canvas.height, bits };
}, PLATE);
/** The ring around a silhouette (both 0/1 arrays, half size), `px` plate px wide. */
const ringOf = async ({ w, h, bits }, px = RING) => {
  const mask = Buffer.from([...bits].map((b) => (b === '1' ? 255 : 0)));
  const R = Math.round(px / 2);
  // Chamfer distance to the silhouette.
  const dist = new Float32Array(w * h).fill(1e6);
  for (let i = 0; i < mask.length; i++) if (mask[i]) dist[i] = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (x) dist[i] = Math.min(dist[i], dist[i - 1] + 1); if (y) dist[i] = Math.min(dist[i], dist[i - w] + 1); if (x && y) dist[i] = Math.min(dist[i], dist[i - w - 1] + 1.414); if (x < w - 1 && y) dist[i] = Math.min(dist[i], dist[i - w + 1] + 1.414); }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (x < w - 1) dist[i] = Math.min(dist[i], dist[i + 1] + 1); if (y < h - 1) dist[i] = Math.min(dist[i], dist[i + w] + 1); if (x < w - 1 && y < h - 1) dist[i] = Math.min(dist[i], dist[i + w + 1] + 1.414); if (x && y < h - 1) dist[i] = Math.min(dist[i], dist[i + w - 1] + 1.414); }
  // (A hole inside her, such as the crook of an arm, is neither.)
  let ring = ''; for (let i = 0; i < dist.length; i++) ring += dist[i] > 1.5 && dist[i] <= R ? '1' : '0';
  return { w, h, bits: ring };
};
/** The band of her own picture this close to her outline, inside it (plate px). */
const insideOf = async (her, px) => { const out = { ...her, bits: [...her.bits].map((b) => (b === '1' ? '0' : '1')).join('') }; return ringOf(out, px); };
/** The two sides of her outline: 14 plate px of her, 14 of the room. */
const BAND = 14;
const bboxOf = ({ w, h, bits }) => { let l = w; let t = h; let r = 0; let b = 0; for (let i = 0; i < bits.length; i++) if (bits[i] === '1') { const x = i % w; const y = (i / w) | 0; l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); } return [l * 2, t * 2, r * 2 + 2, b * 2 + 2]; };
const openDone = async (engine, options, id) => {
  const browser = await launch(engine); const context = await browser.newContext(options); const page = await context.newPage();
  const errors = errorsOf(page);
  await page.goto(`${base}?debug&reset&intro=off&seed=7#${id}`); await ready(page);
  return { browser, context, page, errors };
};

// The stroke plans alone, as the page's own brush lays them (its usual seed): at every 1/60 s, how much of her
// and of the ring around her is painted, and how much of the plate.
run.plan = async () => {
  const report = {};
  const { browser, page } = await openDone(chromium, { viewport: { width: 1440, height: 900 } }, 'build');
  for (const id of IDS) {
    await page.goto('about:blank');
    await page.goto(`${base}?debug&reset&intro=off&seed=7#${id}`); await ready(page);
    const her = await silhouette(page); const ring = await ringOf(her);
    const rows = await page.evaluate(async ({ her, ring, id }) => {
      const { Painter } = await import('/src/engine/paint.ts');
      const plans = window.__hj.scene.config.strokes;
      const p = new Painter({ width: 836, height: 470, fill: (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); }, strokes: plans });
      const c = document.createElement('canvas'); c.width = her.w; c.height = her.h;
      const x = c.getContext('2d', { willReadFrequently: true });
      const rows = [];
      for (let f = 0; f / 60 <= p.seconds + 0.2; f++) {
        const t = f / 60; p.paintTo(t);
        // The wash, as transition.ts times it (power1.inOut over 0.42 s from the last 0.26 s of brush).
        const k = Math.max(0, Math.min(1, (t - (p.seconds - 0.26)) / 0.42));
        if (k > 0) p.wash(k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) ** 2);
        x.globalCompositeOperation = 'copy'; x.drawImage(p.canvas, 0, 0, her.w, her.h);
        const d = x.getImageData(0, 0, her.w, her.h).data;
        let hs = 0; let hn = 0; let rs = 0; let rn = 0; let all = 0;
        for (let i = 0; i < her.bits.length; i++) { const v = 1 - d[i * 4 + 3] / 255; all += v; if (her.bits[i] === '1') { hs += v; hn++; } else if (ring.bits[i] === '1') { rs += v; rn++; } }
        rows.push([t, hs / hn, rs / rn, all / her.bits.length]);
      }
      return rows;
    }, { her, ring, id });
    const when = (col, v) => r3(rows.find((r) => r[col] >= v)?.[0] ?? NaN);
    report[id] = {
      herBox: bboxOf(her), seconds: r3(Math.max(...rows.map((r) => r[0])) - 0.2),
      her: { p10: when(1, 0.1), p50: when(1, 0.5), p90: when(1, 0.9), p97: when(1, 0.97) },
      ring: { p10: when(2, 0.1), p50: when(2, 0.5), p90: when(2, 0.9), p97: when(2, 0.97) },
      plate: { p10: when(3, 0.1), p50: when(3, 0.5), p90: when(3, 0.9), p97: when(3, 0.97) },
      herPaintedWhenRingIs90pc: r3(rows.find((r) => r[2] >= 0.9)[1]), plateWhenSheIs50pc: r3(rows.find((r) => r[1] >= 0.5)[3]),
      plateWhenSheIs97pc: r3(rows.find((r) => r[1] >= 0.97)[3]), mostTheRingLeadsHer: r3(Math.max(...rows.map((r) => r[2] - r[1]))), beforeTheWashHer: r3(rows.findLast((r) => r[0] <= rows.at(-1)[0] - 0.46)[1]),
    };
    say(id, report[id]);
  }
  await browser.close();
  await save('plan.json', report);
};

// A Chrome trace of a new visitor's painting: phone, processor slowed four times, production build. Headed
// Chrome unless HJ_HEADLESS is set. The raw trace goes to qa/traces/ (not in git).
const CATEGORIES = ['-*', 'toplevel', 'benchmark', 'cc', 'loading', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink.user_timing', 'v8.execute', 'latencyInfo', 'disabled-by-default-v8.cpu_profiler', 'gpu', 'viz'];
run.trace = async () => {
  const OLD = !!process.env.HJ_OLD; const traces = JSON.parse(await readFile(`${out}${OLD ? 'trace-before.json' : 'trace.json'}`, 'utf8').catch(() => '{}'));
  for (const id of ONLY ? [ONLY] : ['build', 'set']) {
    const browser = await chromium.launch({ channel: 'chrome', headless: !!process.env.HJ_HEADLESS });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = errorsOf(page);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const file = new URL(`../traces/${process.env.HJ_TRACE ?? 'r4'}-${id}-paint-mobile-4x.json`, import.meta.url).pathname;
    await browser.startTracing(page, { categories: CATEGORIES });
    await cdp.send('Page.navigate', { url: `${prod}#${id}` });
    // (Nothing is asked of the page meanwhile: a script of the tool's own would cost it frames.)
    await new Promise((resolve) => setTimeout(resolve, 11000));
    await writeFile(file, await browser.stopTracing());
    execFileSync('gzip', ['-f', file]);
    await browser.close();
    const { traceEvents: ev } = JSON.parse(gunzipSync(await readFile(`${file}.gz`)).toString());
    const mark = ev.findLast((e) => e.name === 'hj-paint' && String(e.cat).includes('user_timing'));
    const nav = ev.findLast((e) => e.name === 'navigationStart' && e.pid === mark.pid && e.ts < mark.ts);
    const at = (e) => Math.round((e.ts - mark.ts) / 1000);
    const drops = ev.filter((e) => e.name === 'DroppedFrame' && e.pid === mark.pid).map(at);
    const tasks = ev.filter((e) => e.name === 'RunTask' && e.ph === 'X' && e.pid === mark.pid && e.tid === mark.tid);
    const longest = (from, to) => Math.round(Math.max(0, ...tasks.filter((e) => at(e) >= from && at(e) < to).map((e) => e.dur)) / 1000);
    const between = (from, to) => drops.filter((t) => t >= from && t < to);
    (traces[id] ??= []).push({ clockMs: -at(nav), framesBegun: ev.filter((e) => e.name === 'BeginFrame' && e.pid === mark.pid && at(e) >= 0 && at(e) < 6000).length, droppedFirst100ms: between(0, 100).length, droppedInThePainting: between(0, 4750), droppedAfterTo6s: between(4750, 6000), droppedBeforeOnBlankPaper: between(-1000, 0).length, longestTaskMs: { settingUp: longest(-700, 0), painting: longest(0, 4750), after: longest(4750, 6000) }, errors });
    say(id, traces[id].at(-1));
    await save(OLD ? 'trace-before.json' : 'trace.json', traces);
  }
};

// ---- Recordings. --------------------------------------------------------------------------------------------
const DEVICES = {
  desktop: { options: { viewport: { width: 1440, height: 900 } }, suffix: '' },
  phone: { options: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, suffix: '-phone' },
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** Chrome's own screencast of a page, each frame with its time; frames are kept in `dir`. */
const filmOf = async (context, page, dir) => {
  await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  const cdp = await context.newCDPSession(page);
  const frames = []; const writes = [];
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = `${dir}${String(frames.length).padStart(5, '0')}.jpg`;
    frames.push({ at: metadata.timestamp * 1000, file }); writes.push(writeFile(file, Buffer.from(data, 'base64')));
    void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  return { frames, start: () => cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 1 }), stop: async () => { await cdp.send('Page.stopScreencast'); await Promise.all(writes); } };
};
/** WebKit has no screencast: one screenshot after another, each with the middle of its own time (HJ_ENGINE=webkit). */
const snapsOf = async (page, dir) => {
  await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  const frames = []; let on = false; let loop;
  return { frames, start: async () => { on = true; loop = (async () => { while (on) { const a = Date.now(); const file = `${dir}${String(frames.length).padStart(5, '0')}.png`; await page.screenshot({ path: file }).catch(() => {}); frames.push({ at: (a + Date.now()) / 2, file }); } })(); }, stop: async () => { on = false; await loop; } };
};
const toMp4 = async (frames, list, mp4) => {
  await writeFile(list, `ffconcat version 1.0\n${frames.map((f, i) => `file '${f.file}'\nduration ${(((frames[i + 1]?.at ?? f.at + 16.7) - f.at) / 1000).toFixed(6)}`).join('\n')}\n`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=60,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-movflags', '+faststart', mp4]);
};
/** Where the plate and the window onto it are on the page, and the page's clock. */
const layoutOf = (page, id) => page.evaluate((scene) => {
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  return { plate: box(document.querySelector(`.hj-plate[data-scene="${scene}"]`)), view: box(document.querySelector('.hj-viewport')), page: innerWidth, origin: performance.timeOrigin, clock: performance.getEntriesByName('hj-paint').at(-1)?.startTime ?? null };
}, id);
const silhouettes = {};
/** Her silhouette and the ring around her, kept for the run. */
const shapes = async (id) => {
  if (silhouettes[id]) return silhouettes[id];
  const { browser, page } = await openDone(chromium, { viewport: { width: 1440, height: 900 } }, id);
  const her = await silhouette(page); await browser.close();
  return (silhouettes[id] = { her, ring: await ringOf(her), inside: await insideOf(her, BAND), outside: await ringOf(her, BAND) });
};
/** The frame on screen at a time (the last one drawn by then). */
const frameAt = (frames, t) => frames.findLast((f) => f.at <= t) ?? frames[0];
const pixels = async (file, box) => sharp(file).extract(box).removeAlpha().raw().toBuffer();
/** The part of a frame around her: plate box (her silhouette and ring) cut to the window, in the recording's px. */
const cropFor = ({ her, ring }, lay, scale) => {
  const [l, t, r, b] = bboxOf(ring); const [hl, ht, hr, hb] = bboxOf(her); const k = lay.plate.w / PLATE.w;
  const x0 = Math.max(lay.view.x, lay.plate.x + Math.min(l, hl) * k); const y0 = Math.max(lay.view.y + 1, lay.plate.y + Math.min(t, ht) * k);
  const x1 = Math.min(lay.view.x + lay.view.w, lay.plate.x + Math.max(r, hr) * k); const y1 = Math.min(lay.view.y + lay.view.h - 1, lay.plate.y + Math.max(b, hb) * k);
  return { left: Math.ceil(x0 * scale), top: Math.ceil(y0 * scale), width: Math.floor(x1 * scale) - Math.ceil(x0 * scale), height: Math.floor(y1 * scale) - Math.ceil(y0 * scale) };
};
/** For each px of a crop: 1 hers (`in`), 2 the room's (`by`), 0 neither; and which of 24 sectors around her middle it is in. */
const classesOf = ({ her }, { in: mine, by }, lay, scale, crop) => {
  const k = lay.plate.w / PLATE.w; const [l, t, r, b] = bboxOf(her); const cx = (l + r) / 2; const cy = (t + b) / 2;
  const kind = new Uint8Array(crop.width * crop.height); const sector = new Uint8Array(kind.length);
  for (let y = 0; y < crop.height; y++) for (let x = 0; x < crop.width; x++) {
    const px = ((x + crop.left + 0.5) / scale - lay.plate.x) / k; const py = ((y + crop.top + 0.5) / scale - lay.plate.y) / k;
    const i = Math.floor(py / 2) * her.w + Math.floor(px / 2); const n = y * crop.width + x;
    kind[n] = mine.bits[i] === '1' ? 1 : by.bits[i] === '1' ? 2 : 0;
    sector[n] = Math.min(23, Math.floor(((Math.atan2((py - cy) / (b - t), (px - cx) / (r - l)) + Math.PI) / (2 * Math.PI)) * 24));
  }
  return { kind, sector };
};
/** How far each px has come from `before` to `after` (0 to 1), averaged over her and over the ring: whole, and by sector. */
const painted = (now, before, after, { kind, sector }) => {
  const sum = new Float64Array(4 * 25); // [her sum, her n, ring sum, ring n] × (24 sectors + all)
  for (let n = 0; n < kind.length; n++) {
    if (!kind[n]) continue;
    const i = n * 3;
    const o = kind[n] === 1 ? 0 : 2;
    const d = [after[i] - before[i], after[i + 1] - before[i + 1], after[i + 2] - before[i + 2]];
    let v;
    if (o === 0) {
      // Her: how near the pixel is to her finished drawing. (The bare room behind her, however dark, is not near it.)
      const span = Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]);
      if (span < 120) continue; // (too like the paper to tell)
      v = Math.max(0, 1 - (Math.abs(after[i] - now[i]) + Math.abs(after[i + 1] - now[i + 1]) + Math.abs(after[i + 2] - now[i + 2])) / span);
    } else {
      // The room: how far along the way from paper to picture its colour is, not cut off at 0 and 1, so that the
      // recording's noise averages out and a floor nearly the paper's colour still counts (Grow's is 20 levels off).
      const span = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
      if (span < 81) continue;
      v = ((now[i] - before[i]) * d[0] + (now[i + 1] - before[i + 1]) * d[1] + (now[i + 2] - before[i + 2]) * d[2]) / span;
    }
    for (const at of [sector[n], 24]) { sum[at * 4 + o] += v; sum[at * 4 + o + 1]++; }
  }
  const of = (s) => ({ her: sum[s * 4 + 1] ? sum[s * 4] / sum[s * 4 + 1] : null, ring: sum[s * 4 + 3] ? sum[s * 4 + 2] / sum[s * 4 + 3] : null, n: Math.min(sum[s * 4 + 1], sum[s * 4 + 3]) });
  return { all: of(24), sectors: [...Array(24).keys()].map(of) };
};
// In no frame is the room around her painted and she not. Two tests, on every recorded frame: all of her against the
// ring of the room 70 plate px wide around her; and, along her outline, the 14 px of her inside it against the 14
// px of the room outside it, whole and in each of 24 sectors around her middle (those with enough of both to
// tell). Painted: how far the px have come from blank paper to the finished picture.
const ROOM_DONE = 0.985; const SHE_IS = 0.95; const SECTOR_IS = 0.6;

run.record = async () => {
  // HJ_OLD: the same test on an earlier build (its numbers only).
  const WK = process.env.HJ_ENGINE === 'webkit';
  const OLD = !!process.env.HJ_OLD || WK; const results = WK ? 'paint-webkit.json' : OLD ? 'before.json' : 'paint.json';
  const report = JSON.parse(await readFile(`${out}${results}`, 'utf8').catch(() => '{}'));
  for (const id of ONLY ? [ONLY] : IDS) for (const [device, { options, suffix }] of Object.entries(DEVICES)) {
    const shape = await shapes(id);
    // Chrome's recorder now and then stalls for a moment: of up to four takes, the one with the fewest gaps is kept.
    // (On the phone a gap can also be a stroke outside the window: nothing on screen changes.)
    let best = null;
    for (let take = 0; take < (WK ? 1 : 4) && best?.stalls !== 0; take++) {
      const dir = `${out}take-${take}/`;
      const browser = await launch(WK ? webkit : chromium); const context = await browser.newContext(options); const page = await context.newPage();
      const errors = errorsOf(page);
      const film = WK ? await snapsOf(page, dir) : await filmOf(context, page, dir);
      await page.goto(`${prod}#${id}`, { waitUntil: 'commit' });
      await film.start().catch(async () => { await wait(60); await film.start(); });
      while ((await page.evaluate(() => performance.getEntriesByName('hj-paint').length)) === 0) await wait(200);
      await wait(7200);
      await film.stop();
      const lay = await layoutOf(page, id);
      await browser.close();
      const t0 = lay.origin + lay.clock;
      const stalls = film.frames.slice(1).filter((f, i) => f.at - film.frames[i].at > 34 && f.at > t0 + 40 && film.frames[i].at < t0 + 4440).length + (film.frames.length < 150 ? 1000 : 0);
      if (!best || stalls < best.stalls) { if (best) await rm(best.dir, { recursive: true, force: true }); best = { dir, film, lay, errors, stalls }; } else await rm(dir, { recursive: true, force: true });
    }
    const { dir, film, lay, errors } = best;
    const { frames } = film;
    const clock = lay.origin + lay.clock;
    const cut = frames.filter((f) => f.at >= clock - 250 && f.at <= clock + 6500);
    const name = `scene${N(id)}-paint${suffix}-60fps.mp4`;
    if (!OLD) await toMp4(cut, `${dir}list.txt`, `${out}${name}`);
    const scale = (await sharp(cut[0].file).metadata()).width / lay.page;
    const crop = cropFor(shape, lay, scale);
    // The strip.
    const times = []; for (let t = 0; t <= (OLD ? 0 : 4950); t += 50) times.push(t);
    const PER = suffix ? 14 : 12; const gap = 4;
    const tiles = [];
    for (const [i, t] of times.entries()) {
      const x = (i % PER) * (crop.width + gap) + gap; const y = Math.floor(i / PER) * (crop.height + 20) + 28;
      tiles.push({ input: await sharp(frameAt(frames, clock + t + 4).file).extract(crop).png().toBuffer(), left: x, top: y + 16 }, { input: text(`${(t / 1000).toFixed(2)} s`, crop.width, 11), left: x, top: y });
    }
    const width = PER * (crop.width + gap) + gap; const height = Math.ceil(times.length / PER) * (crop.height + 20) + 34;
    await sharp({ create: { width, height, channels: 3, background: '#d9d6cf' } }).composite([{ input: text(`Scene ${N(id)} (${id}), ${device}: the recording at 1:1 around her, every 50 ms from the first stroke (the wash 4.06 to 4.48 s; she starts work at 4.74 s)`, width, 15), left: 4, top: 2 }, ...tiles]).jpeg({ quality: 74 }).toFile(OLD ? `${dir}strip.jpg` : `${out}scene${N(id)}-rachel-strip${suffix}.jpg`);
    // The test, on every recorded frame.
    const classes = classesOf(shape, { in: shape.her, by: shape.ring }, lay, scale, crop);
    const bands = classesOf(shape, { in: shape.inside, by: shape.outside }, lay, scale, crop);
    const blank = await pixels(frameAt(frames, clock - 30).file, crop); const done = await pixels(frameAt(frames, clock + 4640).file, crop);
    const rows = [];
    for (const f of frames.filter((x) => x.at >= clock - 60 && x.at <= clock + 4700)) { const now = await pixels(f.file, crop); rows.push({ t: Math.round(f.at - clock), ...painted(now, blank, done, classes), outline: painted(now, blank, done, bands) }); }
    const enough = (s) => s.n > 60 * scale * scale;
    const bad = rows.filter((r) => r.all.ring >= ROOM_DONE && r.all.her < SHE_IS).map((r) => r.t);
    const badOutline = rows.filter((r) => r.outline.all.ring >= ROOM_DONE && r.outline.all.her < SHE_IS).map((r) => r.t);
    const badSectors = rows.flatMap((r) => r.outline.sectors.map((s, i) => [s, i]).filter(([s]) => enough(s) && s.ring >= ROOM_DONE && s.her < SECTOR_IS).map(([s, i]) => ({ t: r.t, sector: i, room: r3(s.ring), her: r3(s.her) })));
    const lead = Math.max(...rows.map((r) => r.outline.all.ring - r.outline.all.her));
    const when = (key, v) => rows.find((r) => r.all[key] >= v)?.t ?? null;
    // Once painted she never goes back: the most any frame is below one before it.
    let most = 0; let back = 0; for (const r of rows) { most = Math.max(most, r.all.her); back = Math.max(back, most - r.all.her); }
    const gaps = cut.slice(1).map((f, i) => f.at - cut[i].at);
    report[`${id} ${device}`] = {
      ...(OLD ? {} : { file: name, strip: `scene${N(id)}-rachel-strip${suffix}.jpg` }), recordedFrames: cut.length, framesInThePainting: rows.length, longestRecordedGapMs: r1(Math.max(...gaps)), recordedGapsOver34ms: cut.slice(1).map((f, i) => [Math.round(cut[i].at - clock), Math.round(f.at - cut[i].at)]).filter(([, g]) => g > 34).map(([t, g]) => `${g}@${t}`).join(' '),
      herPaintedMs: { p10: when('her', 0.1), p50: when('her', 0.5), p90: when('her', 0.9), p98: when('her', 0.98) }, roomAroundHerMs: { p10: when('ring', 0.1), p50: when('ring', 0.5), p90: when('ring', 0.9), p98: when('ring', 0.98) },
      blankFrameHer: r3(rows[0].all.her), sheGoesBackBy: r3(back),
      wholeOfHer_framesWithTheRoomPaintedAndSheNot: bad.length ? bad : 0,
      outline: { framesWithTheRoomPaintedAndSheNot: badOutline.length ? badOutline : 0, mostTheRoomIsAheadOfHer: r3(lead), sectorsTested: rows[0].outline.sectors.filter(enough).length, sectorFramesWithTheRoomPaintedAndSheNot: badSectors.length, examples: badSectors.slice(0, 4) }, errors,
    };
    say(`${id} ${device}`, report[`${id} ${device}`]);
    await rm(dir, { recursive: true, force: true });
    await save(results, report);
  }
};

// ---- Moving between scenes, and coming back. ----------------------------------------------------------------
const noOutlines = (context) => context.addInitScript(() => addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.hj-mushrooms.is-debug .hj-shroom, .hj-mushrooms.is-debug .hj-shroom * { outline: none !important; box-shadow: none !important; } .hj-mushrooms.is-debug .hj-shroom { background: none !important; border-color: transparent !important; }'; document.head.append(st); }));
run.switch = async () => {
  const report = {};
  const W = 1440;
  const browser = await launch(chromium); const context = await browser.newContext({ viewport: { width: W, height: 900 } });
  await noOutlines(context);
  const page = await context.newPage(); const errors = errorsOf(page);
  const marks = () => page.evaluate(() => ({ ...window.__hj.marks, origin: performance.timeOrigin, clock: performance.getEntriesByName('hj-paint').at(-1)?.startTime ?? null }));
  const arrived = (id) => page.waitForFunction((scene) => window.__hj?.scene?.config.id === scene && !window.__hj.busy, id, { timeout: 60000 });
  const measure = async (id, film, from, to, beforeAt, afterAt, name) => {
    const shape = await shapes(id); const lay = await layoutOf(page, id);
    const crop = cropFor(shape, lay, 1); const classes = classesOf(shape, { in: shape.her, by: shape.ring }, lay, 1, crop);
    const before = await pixels(frameAt(film.frames, beforeAt).file, crop); const after = await pixels(frameAt(film.frames, afterAt).file, crop);
    const rows = [];
    for (const f of film.frames.filter((x) => x.at >= from && x.at <= to)) rows.push({ t: Math.round(f.at - from), ...painted(await pixels(f.file, crop), before, after, classes).all });
    let most = 0; let back = 0; for (const r of rows) { most = Math.max(most, r.her); back = Math.max(back, most - r.her); }
    await toMp4(film.frames.filter((f) => f.at >= from - 300 && f.at <= to + 1200), `${out}list.txt`, `${out}${name}`); await rm(`${out}list.txt`);
    // A picture every 50 ms around the middle of it.
    const sheet = []; const ts = []; for (let t = from; t <= Math.min(to, from + 1900) && ts.length < 40; t += 50) ts.push(t);
    for (const [n, t] of ts.entries()) { const x = (n % 10) * (crop.width + 4) + 4; const y = Math.floor(n / 10) * (crop.height + 20) + 4; sheet.push({ input: await sharp(frameAt(film.frames, t + 4).file).extract(crop).png().toBuffer(), left: x, top: y + 16 }, { input: text(`${Math.round(t - from)} ms`, crop.width, 11), left: x, top: y }); }
    await sharp({ create: { width: 10 * (crop.width + 4) + 4, height: Math.ceil(ts.length / 10) * (crop.height + 20) + 8, channels: 3, background: '#d9d6cf' } }).composite(sheet).jpeg({ quality: 78 }).toFile(`${out}${name.replace('-60fps.mp4', '.jpg')}`);
    return { file: name, frames: rows.length, herFirst: r3(rows[0].her), herLast: r3(rows.at(-1).her), sheGoesBackBy: r3(back), mostSheIsAheadOfTheRoom: r3(Math.max(...rows.map((r) => r.her - r.ring))), mostTheRoomIsAheadOfHer: r3(Math.max(...rows.map((r) => r.ring - r.her))) };
  };
  const take = async (name, act) => { const film = await filmOf(context, page, `${out}take-${name}/`); await film.start(); await wait(400); await act(); await film.stop(); return film; };
  await page.goto(`${base}?debug&reset#build`); await ready(page);

  // 1. A scene never seen: the old picture fades, the blank sheet, the painting.
  let film = await take('first', async () => { await page.click('.hj-tab[data-scene="set"]'); await arrived('set'); await wait(600); });
  let m = await marks();
  {
    const clock = m.origin + m.clock; const start = m.origin + m.switchStart;
    const r = await measure('set', film, start, m.origin + m.switchEnd - 60, clock - 30, clock + 4640, 'switch-first-visit-60fps.mp4');
    // Between the old picture's fade and the first stroke: blank, nothing of her.
    const shape = await shapes('set'); const lay = await layoutOf(page, 'set'); const crop = cropFor(shape, lay, 1); const classes = classesOf(shape, { in: shape.her, by: shape.ring }, lay, 1, crop);
    const blank = await pixels(frameAt(film.frames, clock - 30).file, crop); const done = await pixels(frameAt(film.frames, clock + 4640).file, crop);
    const gone = film.frames.filter((f) => f.at >= start + 175 && f.at <= clock + 300); let worst = 0;
    for (const f of gone) worst = Math.max(worst, Math.abs(painted(await pixels(f.file, crop), blank, done, classes).all.her));
    report['first visit, Build to Set Design'] = { ...r, sheGoesBackBy: 'see blankUntilTheFirstStroke (the old picture is measured too)', blankUntilTheFirstStroke: { frames: gone.length, mostOfHer: r3(worst) }, blankMs: Math.round(clock - start - 160) };
  }
  say('first visit', report['first visit, Build to Set Design']);

  // 2. Between two scenes seen before: the short brush.
  await wait(2500);
  await page.click('.hj-tab[data-scene="build"]'); await arrived('build'); await wait(3500);
  film = await take('brush', async () => { await page.click('.hj-tab[data-scene="set"]'); await arrived('set'); await wait(600); });
  m = await marks();
  report['short brush, Build to Set Design'] = await measure('set', film, m.origin + m.switchStart, m.origin + m.switchEnd - 20, m.origin + m.switchStart + 5, m.origin + m.switchEnd - 5, 'switch-short-brush-60fps.mp4');
  say('short brush', report['short brush, Build to Set Design']);

  // 3. The 200 ms reveal (since job 009 only reduced motion gets it, and ?intro=quick, used here).
  await wait(1500);
  film = await take('return', async () => { await page.goto(`${base}?debug&intro=quick#set`); await ready(page); await wait(300); });
  m = await marks();
  report['return visit, Set Design'] = await measure('set', film, m.origin + m.introStart, m.origin + m.introStart + 260, m.origin + m.introStart - 10, m.origin + m.introStart + 255, 'return-visit-60fps.mp4');
  say('return visit', report['return visit, Set Design']);
  await browser.close();
  for (const name of ['first', 'brush', 'return']) await rm(`${out}take-${name}/`, { recursive: true, force: true });
  report.errors = errors;
  await save('switch.json', report);
};

// What must not change, and what must hold: nothing of the cast is drawn while it is being painted; Skip and
// Replay; she arrives late on a slow network and fades in; ?intro=off; reduced motion.
run.states = async () => {
  const report = {};
  const errors = [];
  const look = (page) => page.evaluate(() => ({ opacity: getComputedStyle(document.querySelector('.hj-rachel')).opacity, transform: getComputedStyle(document.querySelector('.hj-rachel')).transform, sheetOverHer: (() => { const sheet = document.querySelector('.hj-plate > .hj-paint:not(.is-veil)'); return sheet ? !!(document.querySelector('.hj-rachel').compareDocumentPosition(sheet) & Node.DOCUMENT_POSITION_FOLLOWING) : 'no sheet'; })() }));
  const browser = await launch(chromium);
  for (const id of IDS) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const page = await context.newPage(); errors.push(...errorsOf(page));
    await page.addInitScript(() => {
      // Every draw into a canvas of the cast (hers, an actor's, a screen's), with its time; and every rehearsal off the page.
      window.__draws = [];
      const { drawImage } = CanvasRenderingContext2D.prototype;
      CanvasRenderingContext2D.prototype.drawImage = function draw(...a) { const c = this.canvas; window.__draws.push([performance.now(), c.isConnected ? (c.closest('.hj-rachel, .hj-actor') ? 'cast' : c.closest('.hj-edge') ? 'edge' : c.className || 'page') : c.width > 100 ? 'rehearsal' : 'small']); return drawImage.apply(this, a); };
    });
    await page.goto(`${base}?debug&reset#${id}`);
    await page.waitForFunction(() => performance.getEntriesByName('hj-paint').length, null, { timeout: 60000 });
    await wait(1500);
    const during = await page.evaluate(() => ({ unrehearsed: window.__hj.scene.casts.reduce((n, c) => n + c.character.unrehearsed.length, 0), poses: window.__hj.scene.casts.map((c) => c.character.current === c.character.rest) }));
    const sheet = await look(page);
    await ready(page);
    const draws = await page.evaluate(() => { const t = performance.getEntriesByName('hj-paint').at(-1).startTime; const count = {}; for (const [at, what] of window.__draws) if (at >= t && at <= t + 4700) count[what] = (count[what] ?? 0) + 1; const before = window.__draws.filter(([at, w]) => at < t && (w === 'cast' || w === 'rehearsal')); return { whilePainting: count, castAndRehearsalDrawsBefore: before.length, lastOfThemBeforeTheClockMs: before.length ? Math.round(t - before.at(-1)[0]) : null, clockMs: Math.round(t), castFirstMoves: Math.round((window.__draws.find(([at, w]) => at >= t && w === 'cast')?.[0] ?? NaN) - t) }; });
    report[id] = { stillsNotYetDrawnWhenTheBrushIsAtWork: during.unrehearsed, everyoneAtTheirFirstFrame: during.poses.every(Boolean), sheet, draws };
    say(id, report[id]);
    await context.close();
  }
  // Skip in the middle, then Replay, then Skip again.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const page = await context.newPage(); errors.push(...errorsOf(page));
    await page.goto(`${base}?debug&reset#set`);
    await page.waitForFunction(() => performance.getEntriesByName('hj-paint').length, null, { timeout: 60000 }); await wait(600);
    await page.getByText('Skip', { exact: true }).click(); await wait(300); const skipped = await look(page);
    const opaque = await page.evaluate(() => { const c = document.querySelector('.hj-plate > .hj-paint:not(.is-veil)'); if (!c) return 0; const x = document.createElement('canvas'); x.width = 80; x.height = 45; const g = x.getContext('2d'); g.drawImage(c, 0, 0, 80, 45); return Math.max(...g.getImageData(0, 0, 80, 45).data.filter((_, i) => i % 4 === 3)); });
    await ready(page); await wait(2500);
    await page.getByText('Replay painting').click(); await wait(900); const replay = await look(page); const resting = await page.evaluate(() => window.__hj.rachel.current === window.__hj.rachel.rest);
    await page.waitForFunction(() => !window.__hj.busy, null, { timeout: 20000 });
    report.skipAndReplay = { afterSkip: skipped, sheetLeftAfterSkip: opaque, duringReplay: replay, atRestDuringReplay: resting, afterReplay: await look(page) };
    say('skip and replay', report.skipAndReplay); await context.close();
  }
  // A slow network: she arrives after the picture is on show.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const page = await context.newPage(); errors.push(...errorsOf(page));
    await page.goto(`${base}?debug&reset#build`); await ready(page);
    await page.click('.hj-tab[data-scene="set"]'); await page.waitForFunction(() => window.__hj.scene.config.id === 'set' && !window.__hj.busy, null, { timeout: 60000 });
    await page.route('**/scene5/cast/**', async (route) => { await wait(3500); await route.continue(); });
    await page.goto(`${base}?debug#build`); await ready(page);
    await page.evaluate(() => { window.__late = []; const tick = () => { const el = document.querySelector('.hj-plate[data-scene="set"] .hj-rachel'); if (el?.isConnected) window.__late.push([Math.round(performance.now()), Number(getComputedStyle(el).opacity), el.getAnimations().length]); requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    await page.click('.hj-tab[data-scene="set"]', { noWaitAfter: true });
    await page.waitForFunction(() => window.__late.length > 60, null, { timeout: 60000 });
    const late = await page.evaluate(() => ({ rows: window.__late, switchEnd: window.__hj.marks.switchEnd }));
    report.slowNetwork = { pictureOnShowAtMs: late.switchEnd, sheArrivesAtMs: late.rows[0][0], opacityFirst: late.rows[0][1], fadeMs: late.rows.find((r) => r[1] === 1)[0] - late.rows[0][0], fadesIn: late.rows[0][1] < 0.2 && late.rows[0][2] === 1 };
    say('slow network', report.slowNetwork); await context.close();
  }
  for (const [name, options, query] of [['intro=off', {}, '?debug&reset&intro=off'], ['reduced motion', { reducedMotion: 'reduce' }, '?debug&reset']]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options }); const page = await context.newPage(); errors.push(...errorsOf(page));
    await page.goto(`${base}${query}#set`); await ready(page);
    report[name] = { ...(await look(page)), painted: await page.evaluate(() => performance.getEntriesByName('hj-paint').length), atRest: await page.evaluate(() => window.__hj.rachel.current === window.__hj.rachel.rest) };
    say(name, report[name]); await context.close();
  }
  await browser.close();
  report.errors = errors; say('errors', errors);
  await save('states.json', report);
};

// Frame times of the painting in WebKit (iPhone profile), production build: each run a new browser.
run.webkit = async () => {
  const report = {};
  for (const id of ONLY ? [ONLY] : ['set', 'grow']) {
    const runs = [];
    for (let i = 0; i < 4; i++) {
      const browser = await webkit.launch(); const context = await browser.newContext({ ...devices['iPhone 14'], viewport: { width: 390, height: 844 } });
      await context.addInitScript(() => { window.__gaps = []; let last = performance.now(); const tick = (now) => { window.__gaps.push([last, now - last]); last = now; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
      const page = await context.newPage(); const errors = errorsOf(page);
      await page.goto(`${prod}#${id}`); await wait(11000);
      runs.push(await page.evaluate(() => { const t = performance.getEntriesByName('hj-paint').at(-1).startTime; const g = window.__gaps.filter(([a]) => a >= t && a <= t + 6000); return { clockMs: Math.round(t), frames: g.length, longestMs: Math.round(Math.max(...g.map(([, d]) => d))), longestAtMs: Math.round(g.reduce((m, x) => (x[1] > m[1] ? x : m))[0] - t), over25: g.filter(([, d]) => d > 25).length, over50: g.filter(([, d]) => d > 50).length, longestFirst100ms: Math.round(Math.max(...g.filter(([a]) => a < t + 100).map(([, d]) => d))) }; }).then((r) => ({ ...r, errors })));
      await browser.close(); say(`${id} ${i + 1}`, runs.at(-1));
    }
    report[id] = runs;
  }
  await save(process.env.HJ_OLD ? 'webkit-before.json' : 'webkit.json', report);
};

await run[process.argv[2]]?.();

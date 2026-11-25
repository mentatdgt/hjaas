// Job 009: the paint effect on every change of scene (reviews/paint-every-switch-01.md). Results: qa/paint-switch/.
// Production builds: this one at HJ_PROD (4173), the one before (f37159e) at HJ_OLD_PROD (4196).
//
//   node qa/tools/paint-switch.mjs record [visit|taps|reload] [chrome|webkit]   60 fps recordings and strips, one visit each, production build
//   node qa/tools/paint-switch.mjs she           the room is never painted while she is not: all 20 ways from scene to scene, both kinds of painting (dev)
//   node qa/tools/paint-switch.mjs memory        tabs tapped quickly, phone profile: the most held, and what a scene that is not on show holds (dev; HJ_OLD_URL 5174)
//   node qa/tools/paint-switch.mjs trace         Chrome, phone, 4x slower: frames dropped in the opening, a switch's painting and a brush-over, both builds in turn
//   node qa/tools/paint-switch.mjs states        Skip, own tab, back to the scene being painted, pan and turn in a brush-over, reduced motion, finds and pan kept (production and dev)
//   node qa/tools/paint-switch.mjs repro [new]   what the user saw: every way to change scene, timed frame by frame (WebKit iPhone; `new`: this build)
import { chromium, webkit, devices } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';

const prod = process.env.HJ_PROD ?? 'http://localhost:4173/';
const old = process.env.HJ_OLD_PROD ?? 'http://localhost:4196/';
const out = new URL('../paint-switch/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const phone = { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const say = (label, value) => console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
const save = (name, data) => writeFile(`${out}${name}`, `${JSON.stringify(data, null, 1)}\n`);
const errorsOf = (page) => { const errors = []; page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200))); page.on('pageerror', (e) => errors.push(e.message)); return errors; };

/** In the page, every frame: which scene is in the window, which sheet lies over it and how much of the window it still hides. */
const LOG = () => {
  const c = document.createElement('canvas'); c.width = 48; c.height = 32; let g;
  window.__log = [];
  const tick = (now) => {
    const view = document.querySelector('.hj-viewport'); const plate = view?.querySelector('.hj-plate');
    if (plate) {
      const over = document.querySelector('.hj-paint.is-over-window'); const sheet = over ?? plate.querySelector('.hj-paint:not(.is-veil)');
      let hides = 0;
      if (sheet) {
        g ??= c.getContext('2d', { willReadFrequently: true });
        const s = sheet.getBoundingClientRect(); const v = view.getBoundingClientRect(); const k = sheet.width / s.width;
        g.globalCompositeOperation = 'copy';
        g.drawImage(sheet, (v.left - s.left) * k, (v.top - s.top) * k, v.width * k, Math.min(v.height, s.height) * k, 0, 0, 48, 32);
        const d = g.getImageData(0, 0, 48, 32).data; let a = 0; for (let i = 3; i < d.length; i += 4) a += d[i]; hides = a / (255 * 48 * 32) * Number(getComputedStyle(sheet).opacity);
      }
      window.__log.push([Math.round(now), plate.dataset.scene, over ? 'over' : sheet ? 'paper' : document.querySelector('.hj-blank') ? 'fade' : '-', Math.round(hides * 1000) / 1000, Math.round(Number(getComputedStyle(plate).opacity) * 100) / 100]);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
/** Each arrival of a scene in the log: what lay over it, and how long the sheet took to go from 98% to 2%. 0: it popped in. */
const arrivals = (log, from = 0) => {
  const rows = []; let cur = null;
  for (const [t, id, kind, hides] of log) {
    if (t < from) continue;
    // (A new scene, or a fresh sheet over the same one.)
    if (!cur || cur.id !== id || (cur.last < 0.02 && hides > 0.9)) { cur = { id, at: t, kind, start: null, end: null, steps: 0, last: 1 }; rows.push(cur); }
    if (kind !== '-' && cur.kind === '-') cur.kind = kind;
    if (hides < 0.98 && hides > 0.02) { cur.start ??= t; cur.steps++; }
    if (hides <= 0.02 && cur.start !== null && cur.end === null) cur.end = t;
    cur.last = hides; cur.until = t;
  }
  return rows.map((r) => ({ scene: r.id, at: r.at, sheet: r.kind, paintedOverMs: r.start === null ? 0 : (r.end ?? r.until) - r.start, partlyPaintedFrames: r.steps, unfinished: r.start !== null && r.end === null, shownForMs: r.until - r.at }));
};
const tap = (page, id) => page.locator(`.hj-tab[data-scene="${id}"]`).tap({ noWaitAfter: true });
const painting = (page, n = 1) => page.waitForFunction((k) => performance.getEntriesByName('hj-paint').length >= k, n, { timeout: 60000, polling: 50 });
const run = {};

run.repro = async () => {
  const url = process.argv[3] === 'new' ? prod : old; const name = process.argv[3] === 'new' ? 'repro-after.json' : 'repro-before.json';
  const report = JSON.parse(await readFile(`${out}${name}`, 'utf8').catch(() => '{}')); report.build = url;
  // (HJ_ONLY: only the visits whose name has this in it.)
  const visit = async (label, act, options = {}) => {
    if (process.env.HJ_ONLY && !label.includes(process.env.HJ_ONLY)) return;
    const browser = await webkit.launch(); const context = await browser.newContext({ ...phone, ...options.context });
    await context.addInitScript(LOG); if (options.init) await context.addInitScript(options.init);
    const page = await context.newPage(); const errors = errorsOf(page);
    await (options.open ?? ((p) => p.goto(`${url}#build`, { waitUntil: 'commit' })))(page);
    const frame = options.frame ? await options.frame(page) : page;
    const taps = []; const mark = async (what) => taps.push([what, Math.round(await frame.evaluate(() => performance.now()))]);
    await act({ page, frame, mark, context });
    const log = await frame.evaluate(() => window.__log);
    report[label] = { taps, arrivals: arrivals(log), hidden: await frame.evaluate(() => document.hidden), reducedMotion: await frame.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), errors };
    console.log(`\n${label}  taps ${JSON.stringify(taps)}${errors.length ? `  ERRORS ${JSON.stringify(errors)}` : ''}`);
    for (const a of report[label].arrivals) console.log(`   ${a.scene.padEnd(7)} at ${a.at}  ${a.sheet.padEnd(6)} painted over ${a.paintedOverMs} ms (${a.partlyPaintedFrames} frames), shown ${a.shownForMs} ms${a.unfinished ? ', unfinished' : ''}`);
    await browser.close(); await save(name, report);
  };
  // 0. As the user told it, taking their time.
  await visit('fresh visit, each tab tapped when the painting is over', async ({ frame, mark }) => {
    await painting(frame); await wait(7500);
    for (const id of ['film', 'design', 'set', 'film', 'build']) { await mark(id); await tap(frame, id); await wait(9000); }
  });
  // (a) a tap while the opening is still painting, or getting ready to.
  for (const ms of [-400, 100, 1000, 2000, 3500]) await visit(`(a) fresh visit, Film tapped ${ms < 0 ? `${-ms} ms before the first stroke (nothing painted yet)` : `${ms} ms into the opening`}`, async ({ frame, mark }) => {
    if (ms < 0) { await frame.waitForFunction(() => document.querySelector('.hj-plate .hj-paint'), null, { polling: 20 }); } else { await painting(frame); await wait(ms); }
    await mark('film'); await tap(frame, 'film'); await wait(9000);
  });
  // The same during a switch: Film's painting left for the Café 2 s in, the Café's for Set Design 1 s in, then back.
  await visit('(a) fresh visit, a tab tapped 2 s into each painting', async ({ frame, mark }) => {
    let n = 1; for (const id of ['film', 'design', 'set', 'build']) { await painting(frame, n); await wait(2000); await mark(id); await tap(frame, id); n++; }
    await wait(9000);
  });
  await visit('(a) fresh visit, tabs tapped one after another, 400 ms apart', async ({ frame, mark }) => {
    await painting(frame); await wait(7500);
    for (const id of ['film', 'design', 'set']) { await mark(id); await tap(frame, id); await wait(400); }
    await wait(12000);
    for (const id of ['film', 'design']) { await mark(id); await tap(frame, id); await wait(8000); }
  });
  await visit('(a) fresh visit, the same tab tapped twice, 300 ms apart (a double tap)', async ({ frame, mark }) => {
    await painting(frame); await wait(7500);
    await mark('film'); await tap(frame, 'film'); await wait(300); await mark('film again'); await tap(frame, 'film'); await wait(9000);
  });
  // (b) a later visit.
  await visit('(b) a second visit: every scene marked seen by the first', async ({ page, frame, mark }) => {
    await painting(frame); await wait(7500);
    for (const id of ['film', 'design', 'set']) { await tap(frame, id); await wait(9000); }
    await page.reload({ waitUntil: 'commit' }); await page.waitForFunction(() => window.__log?.length > 10); await wait(4000);
    for (const id of ['film', 'design', 'set', 'build']) { await mark(id); await tap(frame, id); await wait(5000); }
  });
  await visit('(b) a scene seen before, the opening one not (Build new, the others seen)', async ({ frame, mark }) => {
    await painting(frame); await wait(7500);
    for (const id of ['film', 'design']) { await mark(id); await tap(frame, id); await wait(5000); }
  }, { init: () => { try { if (!sessionStorage.getItem('qa')) { sessionStorage.setItem('qa', '1'); for (const id of ['grow', 'design', 'film', 'set']) localStorage.setItem(`hjaas:site:v3:seen:${id}`, '1'); } } catch { /* no storage */ } } });
  // The phone: an artifact viewer's frame. Cross-origin and sandboxed without allow-same-origin (no storage at all).
  const framed = (sandbox) => ({
    open: async (page) => {
      // (A sandboxed frame's origin is "null": its script and its files must be allowed to it, as a viewer's own server would.)
      if (sandbox) await page.route(`${url}**`, async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, headers: { ...r.headers(), 'access-control-allow-origin': '*' } }); });
      await page.route('http://viewer.test/', (route) => route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><body style="margin:0"><iframe ${sandbox} src="${url}#build" style="border:0;width:100vw;height:100vh"></iframe>` })); await page.goto('http://viewer.test/', { waitUntil: 'commit' }); },
    frame: async (page) => { for (;;) { const f = page.frames().find((x) => x.url().startsWith(url)); if (f) return f; await wait(20); } },
  });
  for (const [label, sandbox] of [['a cross-origin frame', ''], ['a sandboxed frame, storage blocked', 'sandbox="allow-scripts"']]) await visit(`phone: ${label}`, async ({ frame, mark }) => {
    await painting(frame); await wait(7500);
    for (const id of ['film', 'design', 'film']) { await mark(id); await tap(frame, id); await wait(9000); }
  }, framed(sandbox));
  // A phone's network: each of a scene's files takes a while, and nothing on the page says the tap was heard.
  const slow = async (context) => context.route(/assets\/scene[2-5]\//, async (route) => { await wait(700); await route.continue(); });
  await visit('phone: slow network, each tab tapped once', async ({ frame, mark, context }) => {
    await painting(frame); await wait(7500); await slow(context);
    for (const id of ['film', 'design']) { await mark(id); await tap(frame, id); await wait(12000); }
  });
  await visit('phone: slow network, each tab tapped again after 1 s, as nothing has happened yet', async ({ frame, mark, context }) => {
    await painting(frame); await wait(7500); await slow(context);
    for (const id of ['film', 'design', 'set']) { await mark(id); await tap(frame, id); await wait(1000); await mark(`${id} again`); await tap(frame, id); await wait(11000); }
  });
  // What a viewer that calls the page hidden while it is looked at would do.
  await visit('phone: document.hidden true from after the opening', async ({ frame, mark }) => {
    await painting(frame); await wait(7500); await frame.evaluate(() => Object.defineProperty(document, 'hidden', { get: () => true }));
    for (const id of ['film', 'design']) { await mark(id); await tap(frame, id); await wait(6000); }
  });
  // A click without touch, and frames at 30 a second (Low Power Mode, and Safari's limit on a cross-origin frame not yet touched).
  await visit('phone: clicked, not tapped', async ({ frame, mark }) => {
    await painting(frame); await wait(7500);
    for (const id of ['film', 'design']) { await mark(id); await frame.evaluate((x) => document.querySelector(`.hj-tab[data-scene="${x}"]`).click(), id); await wait(9000); }
  });
  await visit('phone: 30 frames a second', async ({ frame, mark }) => {
    await painting(frame); await wait(7500);
    for (const id of ['film', 'design', 'film']) { await mark(id); await tap(frame, id); await wait(9000); }
  }, { init: () => { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (f) => raf(() => raf(f)); } });
};


// ---- Recordings. --------------------------------------------------------------------------------------------
const dev = process.env.HJ_URL ?? 'http://localhost:5173/';
const oldDev = process.env.HJ_OLD_URL ?? 'http://localhost:5174/';
const text = (t, width, size = 14) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${size + 8}"><text x="2" y="${size + 1}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" fill="#302e29">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
const toMp4 = async (frames, list, mp4, filter = 'fps=60,') => {
  await writeFile(list, `ffconcat version 1.0\n${frames.map((f, i) => `file '${f.file}'\nduration ${(((frames[i + 1]?.at ?? f.at + 16.7) - f.at) / 1000).toFixed(6)}`).join('\n')}\n`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `${filter}scale=trunc(iw/2)*2:trunc(ih/2)*2`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-movflags', '+faststart', mp4]);
};
/** When each painting's first stroke was (the page's own marks), in the page's time. */
const MARKS = () => { window.__strokes = []; const mark = performance.mark.bind(performance); performance.mark = (name, o) => { if (/paint|brush/.test(name)) window.__strokes.push([name, performance.now()]); return mark(name, o); }; };
/**
 * WebKit cannot be recorded at 60 frames a second, so it is drawn at 60: the page's clock (performance.now, Date,
 * requestAnimationFrame, the timers, every CSS and Web animation) moves on by 1/60 s at a time, with a picture of the
 * page after each. What comes over the network takes no time on that clock.
 */
const STEPPED = () => {
  let t = performance.now(); const t0 = Date.now() - t; let rafs = new Map(); let timers = new Map(); let n = 1;
  performance.now = () => t; Date.now = () => Math.round(t0 + t);
  window.requestAnimationFrame = (f) => { rafs.set(++n, f); return n; }; window.cancelAnimationFrame = (id) => void rafs.delete(id);
  window.setTimeout = (f, ms = 0, ...a) => { timers.set(++n, { at: t + Math.max(0, ms || 0), f: () => f(...a) }); return n; };
  window.setInterval = (f, ms, ...a) => { timers.set(++n, { at: t + ms, every: ms, f: () => f(...a) }); return n; };
  window.clearTimeout = window.clearInterval = (id) => void timers.delete(id);
  window.requestIdleCallback = undefined;
  window.__step = (ms = 1000 / 60) => {
    t += ms;
    for (const a of document.getAnimations()) { if (a.playState !== 'running' && !a.pending) continue; if (a.playbackRate !== 1e-6) a.playbackRate = 1e-6; a.currentTime = (a.currentTime ?? 0) + ms; }
    for (const [id, timer] of [...timers]) if (timer.at <= t && timers.has(id)) { if (timer.every) timer.at += timer.every; else timers.delete(id); timer.f(); }
    const due = rafs; rafs = new Map(); for (const f of due.values()) f(t);
    return t;
  };
};
const settings = { chrome: { engine: chromium, options: { viewport: { width: 1440, height: 900 } }, suffix: 'desktop' }, webkit: { engine: webkit, options: phone, suffix: 'iphone' } };

/** One visit, recorded. Every `act` ends by saying how long to go on; times are the recording's own, in ms. */
const film = async (which, name, acts, { init } = {}) => {
  const { engine, options, suffix } = settings[which];
  const dir = `${out}take-${name}-${which}/`; await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {}); const context = await browser.newContext(options);
  if (which === 'webkit') await context.addInitScript(STEPPED);
  await context.addInitScript(MARKS); if (init) await context.addInitScript(init);
  const page = await context.newPage(); const errors = errorsOf(page);
  const frames = []; const writes = []; const taps = []; const strokes = []; let seen = 0; let base = 0;
  let pump; let clock;
  if (which === 'chrome') {
    const cdp = await context.newCDPSession(page);
    cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => { const file = `${dir}${String(frames.length).padStart(5, '0')}.jpg`; frames.push({ at: metadata.timestamp * 1000, file }); writes.push(writeFile(file, Buffer.from(data, 'base64'))); void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {}); });
    const open = async () => { await page.goto(`${prod}#build`, { waitUntil: 'commit' }); };
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
    await open();
    clock = async () => Date.now();
    pump = async (until) => { for (;;) { await wait(40); const got = await page.evaluate(() => ({ s: window.__strokes ?? [], o: performance.timeOrigin })).catch(() => null); if (got) { for (const [w, at] of got.s.slice(seen)) strokes.push({ what: w, at: got.o + at }); seen = Math.max(seen, got.s.length); } if (await until()) return; } };
    const api = { page, taps, strokes, pump, clock, reload: async () => { seen = 0; await page.reload({ waitUntil: 'commit' }); }, press: (id) => page.locator(`.hj-tab[data-scene="${id}"]`).click({ noWaitAfter: true }) };
    for (const act of acts) await act(api);
    await cdp.send('Page.stopScreencast'); await Promise.all(writes);
  } else {
    await page.goto(`${prod}#build`, { waitUntil: 'commit' });
    let off = 0; let t = 0;
    clock = async () => t;
    pump = async (until) => {
      for (;;) {
        const got = await page.evaluate(() => (window.__step ? { t: window.__step(), s: window.__strokes } : null)).catch(() => null);
        if (!got) { await wait(5); continue; }
        if (frames.length === 0 || off === null) { off = t + 1000 / 60 - got.t; }
        t = got.t + off;
        for (const [w, at] of got.s.slice(seen)) strokes.push({ what: w, at: at + off }); seen = got.s.length;
        const file = `${dir}${String(frames.length).padStart(5, '0')}.png`; await page.screenshot({ path: file, scale: 'css' }).catch(() => {}); frames.push({ at: t, file });
        // (Decoding goes on in real time.)
        await wait(4);
        if (await until()) return;
      }
    };
    const api = { page, taps, strokes, pump, clock, reload: async () => { seen = 0; off = null; await page.reload({ waitUntil: 'commit' }); }, press: (id) => page.evaluate((x) => document.querySelector(`.hj-tab[data-scene="${x}"]`).click(), id) };
    for (const act of acts) await act(api);
  }
  const ordered = frames.sort((a, b) => a.at - b.at);
  base = ordered[0].at;
  const from = Math.max(0, strokes[0].at - base - 400); const cut = ordered.filter((f) => f.at - base >= from);
  await toMp4(cut, `${dir}list.txt`, `${out}${name}-${suffix}-60fps.mp4`);
  // The strip: each change at 0, 0.5, 1, 2 and 3 s from its first stroke, and the last frame before the tap.
  const TIMES = [0, 500, 1000, 2000, 3000]; const scale = which === 'chrome' ? 0.3 : 0.55;
  const at = (ms) => ordered.findLast((f) => f.at <= ms) ?? ordered[0];
  const size = await sharp(cut[0].file).metadata(); const w = Math.round(size.width * scale); const h = Math.round(size.height * scale); const tiles = [];
  for (const [row, s] of strokes.entries()) {
    const y = row * (h + 30) + 4; const end = strokes[row + 1]?.at ?? Infinity; const tapped = taps.filter((x) => x.at > s.at && x.at < end)[0];
    tiles.push({ input: text(`${taps.filter((x) => x.at <= s.at).at(-1)?.what ?? 'open'}: ${s.what === 'hj-brush' ? 'brush-over' : 'full painting'}${tapped ? `; next tap at ${((tapped.at - s.at) / 1000).toFixed(2)} s` : ''}`, w * 5, 13), left: 4, top: y });
    for (const [i, ms] of TIMES.entries()) { if (s.at + ms > end + 1) continue; tiles.push({ input: await sharp(at(s.at + ms + 5).file).resize(w, h).png().toBuffer(), left: 4 + i * (w + 4), top: y + 24 }); tiles.push({ input: text(`${ms / 1000} s`, 60, 11), left: 8 + i * (w + 4), top: y + 25 }); }
  }
  await sharp({ create: { width: 5 * (w + 4) + 8, height: strokes.length * (h + 30) + 8, channels: 3, background: '#d9d6cf' } }).composite(tiles).jpeg({ quality: 80 }).toFile(`${out}${name}-${suffix}-strip.jpg`);
  const gaps = cut.slice(1).map((f, i) => f.at - cut[i].at);
  const row = { file: `${name}-${suffix}-60fps.mp4`, strip: `${name}-${suffix}-strip.jpg`, frames: cut.length, seconds: Math.round((cut.at(-1).at - cut[0].at) / 100) / 10, strokes: strokes.map((s) => [s.what, Math.round(s.at - base - from)]), taps: taps.map((s) => [s.what, Math.round(s.at - base - from)]), errors };
  await browser.close(); await rm(dir, { recursive: true, force: true });
  void gaps;
  return row;
};
run.record = async () => {
  const report = JSON.parse(await readFile(`${out}record.json`, 'utf8').catch(() => '{}'));
  const stroke = (n) => async (a) => a.pump(async () => a.strokes.length >= n);
  const on = (ms) => async (a) => { const t = await a.clock(); await a.pump(async () => (await a.clock()) - t >= ms); };
  const tapOn = (id, what) => async (a) => { a.taps.push({ what, at: await a.clock() }); await a.press(id); };
  const VISITS = {
    visit: [stroke(1), on(6200), tapOn('film', 'Film'), stroke(2), on(6200), tapOn('design', 'Café'), stroke(3), on(6200), tapOn('film', 'back to Film'), stroke(4), on(4200)],
    taps: [stroke(1), on(2000), tapOn('film', 'Film'), stroke(2), on(2000), tapOn('design', 'Café'), stroke(3), on(2000), tapOn('set', 'Set Design'), stroke(4), on(2000), tapOn('film', 'back to Film'), stroke(5), on(2000), tapOn('build', 'back to Build'), stroke(6), on(4200)],
    reload: [stroke(1), on(5600), async (a) => { const ids = await a.page.evaluate(() => { const v = document.querySelector('.hj-viewport').getBoundingClientRect(); return [...document.querySelectorAll('.hj-shroom')].filter((b) => { const r = b.getBoundingClientRect(); return r.left + r.width / 2 > v.left && r.left + r.width / 2 < v.right; }).slice(0, 2).map((b) => b.dataset.spot); }); a.found = ids; for (const id of ids) { await a.page.evaluate((x) => document.querySelector(`.hj-shroom[data-spot="${x}"]`).click(), id); await on(1600)(a); } },
      async (a) => { a.taps.push({ what: 'reload', at: await a.clock() }); await a.reload(); }, stroke(2), on(6000), async (a) => { a.after = await a.page.evaluate(() => ({ left: [...document.querySelectorAll('.hj-shroom')].map((b) => b.dataset.spot), counters: [...document.querySelectorAll('.hj-num-now')].map((e) => e.textContent) })); RELOAD.found = a.found; RELOAD.after = a.after; }],
  };
  const RELOAD = {};
  for (const name of VISITS[process.argv[3]] ? [process.argv[3]] : Object.keys(VISITS)) for (const which of settings[process.argv[4]] ? [process.argv[4]] : ['chrome', 'webkit']) {
    const row = await film(which, name, VISITS[name]);
    if (name === 'reload') { row.found = RELOAD.found; row.stillHiddenAfterTheReload = RELOAD.after.left.filter((id) => RELOAD.found.includes(id)); row.counters = RELOAD.after.counters; }
    report[`${name} ${which}`] = row; say(`${name} ${which}`, row); await save('record.json', report);
  }
};

// ---- "Room painted but she isn't". ---------------------------------------------------------------------------
// The sheet lies over the room and over her alike, so there is one way she could be missing where the room shows: not
// being drawn under it. Every frame in which any of the sheet is off: every actor is on the plate, opaque, with a drawing.
run.she = async () => {
  const report = JSON.parse(await readFile(`${out}she.json`, 'utf8').catch(() => '{}'));
  const IDS = ['build', 'grow', 'design', 'film', 'set'];
  // An order in which every ordered pair comes once (an Euler circuit of the five scenes), after a first round of full paintings.
  const pairs = (() => { const edges = Object.fromEntries(IDS.map((a) => [a, IDS.filter((b) => b !== a)])); const stack = ['build']; const path = []; while (stack.length) { const v = stack.at(-1); if (edges[v].length) stack.push(edges[v].pop()); else path.push(stack.pop()); } return path.reverse(); })();
  for (const [name, engine, options, slow] of [['desktop Chrome', chromium, { viewport: { width: 1440, height: 900 } }, 1], ['phone Chrome, 4x slower', chromium, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, 4], ['iPhone WebKit', webkit, phone, 1]]) {
    const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {}); const context = await browser.newContext(options); await context.addInitScript(LOG);
    await context.addInitScript(() => {
      window.__bad = []; window.__checked = {};
      const probe = document.createElement('canvas'); probe.width = probe.height = 24; let g;
      const tick = (now) => {
        const last = window.__log?.at(-1); const plate = document.querySelector('.hj-viewport .hj-plate');
        const sheet = document.querySelector('.hj-paint.is-over-window') ?? plate?.querySelector('.hj-paint:not(.is-veil)');
        // (The whole sheet, not only what is in the window: for one frame, as a plate goes in, the window is scrolled past it.)
        let off = 0; if (sheet && window.__hj?.busy) { g ??= probe.getContext('2d', { willReadFrequently: true }); g.globalCompositeOperation = 'copy'; g.drawImage(sheet, 0, 0, 24, 24); const d = g.getImageData(0, 0, 24, 24).data; for (let i = 3; i < d.length; i += 4) if (d[i] < 250) off++; }
        if (last && plate && window.__hj?.scene && last[2] !== '-' && off && window.__hj.busy) {
          const id = plate.dataset.scene; const kind = last[2]; const key = `${id} ${kind}`; window.__checked[key] = (window.__checked[key] ?? 0) + 1;
          g ??= probe.getContext('2d', { willReadFrequently: true });
          const casts = window.__hj.scene.casts; const why = [];
          if (!casts.length) why.push('nobody on the plate');
          for (const { character: c } of casts) {
            // (The mother's layer: at rest it is nothing.)
            if (!c.current && !c.rest) continue;
            if (!c.el.isConnected) why.push('not on the plate'); if (Number(getComputedStyle(c.el).opacity) < 1) why.push(`opacity ${getComputedStyle(c.el).opacity}`);
            g.globalCompositeOperation = 'copy'; g.drawImage(c.canvas, 0, 0, 24, 24); const d = g.getImageData(0, 0, 24, 24).data; let a = 0; for (let i = 3; i < d.length; i += 4) a = Math.max(a, d[i]);
            if (a < 200) why.push(`nothing drawn: ${c.el.dataset.actor ?? 'her'}, ${c.canvas.width}x${c.canvas.height}, ${c.current}, alpha ${a}`);
          }
          if (Number(getComputedStyle(plate).opacity) === 1 && why.length) window.__bad.push([Math.round(now), key, last[3], why.join(', ')]);
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const page = await context.newPage(); const errors = errorsOf(page);
    if (slow > 1) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: slow });
    await page.goto(`${dev}?debug&reset#build`); await page.waitForFunction(() => window.__hj?.ready, null, { timeout: 60000 });
    const press = (id) => (options.hasTouch ? page.locator(`.hj-tab[data-scene="${id}"]`).tap() : page.locator(`.hj-tab[data-scene="${id}"]`).click());
    const there = (id) => page.waitForFunction((x) => window.__hj.scene.config.id === x && !window.__hj.busy, id, { timeout: 60000 });
    let done = 0;
    for (const id of [...IDS.slice(1), ...['build'], ...pairs.slice(1)]) { await press(id); await there(id); await wait(500); done++; }
    // And cut short: each scene's first painting left 1.6 s in, on a fresh visit, then each brush-over 0.8 s in.
    const carried = []; const keep = () => page.evaluate(() => ({ bad: window.__bad, checked: window.__checked })).then((r) => carried.push(r));
    await keep();
    await page.goto('about:blank'); const first = await page.goto(`${dev}?debug&reset#build`).then(() => page.waitForFunction(() => performance.getEntriesByName('hj-paint').length, null, { timeout: 60000 })); void first;
    let strokes = 1; const next = () => page.waitForFunction((n) => performance.getEntriesByName('hj-paint').length + performance.getEntriesByName('hj-brush').length >= n, ++strokes, { timeout: 60000 });
    await wait(1600); for (const id of ['film', 'design', 'set', 'grow']) { await press(id); await next(); await wait(1600); }
    for (const id of ['film', 'design', 'set', 'build', 'grow']) { await press(id); await next(); await wait(800); }
    await wait(4000); await keep();
    const bad = carried.flatMap((c) => c.bad); const checked = {}; for (const c of carried) for (const [k, v] of Object.entries(c.checked)) checked[k] = (checked[k] ?? 0) + v;
    report[name] = { switches: done, cutShort: 9, framesChecked: checked, framesWithTheRoomPaintedAndSheNot: bad.length, examples: bad.filter((b, i) => bad.findIndex((x) => x[1] === b[1] && x[3] === b[3]) === i).slice(0, 12), errors };
    say(name, report[name]); await browser.close(); await save('she.json', report);
  }
};

// ---- Memory: tabs tapped quickly, at every stage of a switch. --------------------------------------------------
run.memory = async () => {
  const report = JSON.parse(await readFile(`${out}memory.json`, 'utf8').catch(() => '{}'));
  const MB = (n) => Math.round(n / 1e5) / 10;
  for (const [build, base] of process.env.HJ_OLD_URL ? [['now', dev], ['before', oldDev]] : [['now', dev]]) {
    const rows = [];
    for (const gap of [2000, 1000, 600, 300, 120]) {
      const browser = await webkit.launch(); const context = await browser.newContext(phone);
      await context.addInitScript(() => {
        window.__top = { total: 0 }; window.__other = { total: 0 };
        const tick = () => {
          const h = window.__hj;
          if (h?.scene) {
            const m = h.memory; if (m.total > window.__top.total) window.__top = { total: m.total, parts: m.parts, scene: h.scene.config.id, busy: h.busy };
            // What every scene but the one in the window holds: frames, canvases, edge; its room apart.
            const id = h.scene.config.id; let other = 0; let rooms = 0; const parts = {};
            for (const [k, v] of Object.entries(m.parts)) { const [s, what] = k.split('.'); if (!what || s === id || !v) continue; parts[k] = v; if (what === 'room') rooms += v; else other += v; }
            if (other + rooms > window.__other.total) window.__other = { total: other + rooms, parts, rooms: Math.round(rooms / (1672 * 941 * 4)), onShow: id };
            window.__edges = Math.max(window.__edges ?? 0, Object.entries(m.parts).filter(([k, v]) => k.endsWith('.edge') && v > 0).length);
            window.__rooms = Math.max(window.__rooms ?? 0, Object.entries(m.parts).filter(([k, v]) => k.endsWith('.room') && v > 0).length);
            // The most scenes whose cast is decoded (more than the one frame a scene out of sight may keep).
            window.__casts = Math.max(window.__casts ?? 0, Object.entries(m.parts).filter(([k, v]) => k.endsWith('.frames') && v > 8e6).length);
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const page = await context.newPage(); const errors = errorsOf(page);
      await page.goto(`${base}?debug&reset&seed=4#build`); await page.waitForFunction(() => performance.getEntriesByName('hj-paint').length, null, { timeout: 60000 }); await wait(gap);
      const order = ['film', 'design', 'set', 'grow', 'build', 'set', 'design', 'grow', 'film', 'build', 'design', 'film', 'set', 'build', 'grow', 'design'];
      for (let round = 0; round < 3; round++) for (const id of order) { await page.locator(`.hj-tab[data-scene="${id}"]`).tap({ noWaitAfter: true }); await wait(gap); }
      await page.waitForFunction(() => !window.__hj.busy, null, { timeout: 60000 }); await wait(4000);
      const r = await page.evaluate(() => ({ top: window.__top, other: window.__other, edges: window.__edges, rooms: window.__rooms, casts: window.__casts, after: window.__hj.memory.parts, id: window.__hj.scene.config.id }));
      const left = Object.fromEntries(Object.entries(r.after).filter(([k, v]) => v > 0 && k.includes('.') && !k.startsWith(`${r.id}.`)).map(([k, v]) => [k, MB(v)]));
      rows.push({ tapEveryMs: gap, taps: 48, peakMB: MB(r.top.total), at: `${r.top.scene}${r.top.busy ? ', during a switch' : ''}`, peakParts: Object.fromEntries(Object.entries(r.top.parts).filter(([, v]) => v > 1e5).map(([k, v]) => [k, MB(v)])), mostCastsDecodedAtOnce: r.casts, mostEdgesAtOnce: r.edges, mostRoomsAtOnce: r.rooms, othersHoldAtMostMB: MB(r.other.total), othersHold: Object.fromEntries(Object.entries(r.other.parts ?? {}).map(([k, v]) => [k, MB(v)])), afterwardsOthersHold: left, endedIn: r.id, errors });
      say(`${build}, a tap every ${gap} ms`, rows.at(-1)); await browser.close();
      report[build] = rows; await save('memory.json', report);
    }
  }
};

// ---- A Chrome trace: phone, 4x slower. ------------------------------------------------------------------------
const CATEGORIES = ['-*', 'toplevel', 'benchmark', 'cc', 'loading', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink.user_timing', 'v8.execute', 'latencyInfo', 'gpu', 'viz'];
run.trace = async () => {
  const report = JSON.parse(await readFile(`${out}trace.json`, 'utf8').catch(() => '{}'));
  const rounds = Number(process.argv[3] ?? 5);
  for (let i = 0; i < rounds; i++) for (const [build, url] of [['now', prod], ['before', old]]) {
    const browser = await chromium.launch({ channel: 'chrome', headless: !!process.env.HJ_HEADLESS });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); const page = await context.newPage(); const errors = errorsOf(page);
    const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await browser.startTracing(page, { categories: CATEGORIES });
    await cdp.send('Page.navigate', { url: `${url}#build` });
    // (Only touches: nothing is asked of the page meanwhile. Where the tabs are is known from a page of the same size.)
    const at = TABS_AT; const touch = async (id) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at[id]] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
    await wait(9000); await touch('film'); await wait(9000); await touch('design'); await wait(9000); await touch('film'); await wait(5500);
    // A tap 2 s into a first painting (Set Design's, for Grow).
    await touch('set'); await wait(3500); await touch('grow'); await wait(8500);
    const buffer = await browser.stopTracing(); await browser.close();
    const file = new URL(`../traces/job009-${build}-phone-4x.json`, import.meta.url).pathname; await writeFile(file, buffer); execFileSync('gzip', ['-f', file]);
    const { traceEvents: ev } = JSON.parse(buffer.toString());
    const marks = ev.filter((e) => /^hj-(paint|brush)$/.test(e.name) && String(e.cat).includes('user_timing')).sort((a, b) => a.ts - b.ts);
    const pid = marks[0].pid; const tid = marks[0].tid;
    const drops = ev.filter((e) => e.name === 'DroppedFrame' && e.pid === pid); const tasks = ev.filter((e) => e.name === 'RunTask' && e.ph === 'X' && e.pid === pid && e.tid === tid); const begun = ev.filter((e) => e.name === 'BeginFrame' && e.pid === pid);
    const rows = {}; const names = build === 'now' ? ['opening (Build)', 'switch, full (Film)', 'switch, full (Café)', 'brush-over (Film)', 'switch, full, cut short (Set Design)', 'switch after a cut (Grow)'] : ['opening (Build)', 'switch, full (Film)', 'switch, full (Café)', 'switch, full, cut short (Set Design)', 'switch after a cut (Grow)'];
    for (const [n, m] of marks.entries()) { const next = marks[n + 1]?.ts ?? Infinity; const end = Math.min(m.ts + (m.name === 'hj-brush' ? 2700 : 4750) * 1000, next); const inside = (e) => e.ts >= m.ts && e.ts < end; const d = drops.filter(inside); rows[names[n] ?? `${n}`] = { ms: Math.round((end - m.ts) / 1000), frames: begun.filter(inside).length, dropped: d.length, droppedAt: d.map((e) => Math.round((e.ts - m.ts) / 1000)).slice(0, 30), longestTaskMs: Math.round(Math.max(0, ...tasks.filter(inside).map((e) => e.dur)) / 1000) }; }
    (report[build] ??= []).push({ rows, errors }); say(`${build} ${i + 1}`, Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, `${v.dropped} of ${v.frames}, longest task ${v.longestTaskMs}`]))); await save('trace.json', report);
  }
};
const TABS_AT = {};
if (process.argv[2] === 'trace') { const b = await chromium.launch({ channel: 'chrome' }); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage(); await p.goto(`${prod}#build`); await wait(1500); Object.assign(TABS_AT, await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.hj-tab')].map((t) => { const r = t.getBoundingClientRect(); return [t.dataset.scene, { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }]; })))); await b.close(); }

// ---- The rest of the rules. -----------------------------------------------------------------------------------
run.states = async () => {
  const report = {};
  for (const [which, engine, options] of [['chrome', chromium, { viewport: { width: 1440, height: 900 } }], ['webkit', webkit, phone]]) {
    const rows = {}; const errors = [];
    const visit = async (label, act, extra = {}) => {
      const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {}); const context = await browser.newContext({ ...options, ...extra }); await context.addInitScript(LOG); const page = await context.newPage(); const errs = errorsOf(page);
      await page.goto(`${extra.url ?? `${prod}#build`}`, { waitUntil: 'commit' });
      const strokes = (n) => page.waitForFunction((k) => performance.getEntriesByName('hj-paint').length + performance.getEntriesByName('hj-brush').length >= k, n, { timeout: 60000, polling: 30 });
      const press = (id) => (options.hasTouch ? page.locator(`.hj-tab[data-scene="${id}"]`).tap({ noWaitAfter: true }) : page.locator(`.hj-tab[data-scene="${id}"]`).click({ noWaitAfter: true }));
      const now = () => page.evaluate(() => { const l = window.__log.at(-1); return { scene: l[1], hides: l[3], skip: !document.querySelector('.hj-controls .hj-link').classList.contains('is-off'), inert: document.querySelector('.hj-plate .hj-mushrooms').inert, tab: document.querySelector('.hj-tab[aria-current]')?.dataset.scene, caption: document.querySelector('.hj-caption-main').textContent.trim().slice(0, 60), captionOpacity: getComputedStyle(document.querySelector('.hj-caption-main')).opacity, brushes: performance.getEntriesByName('hj-brush').length, paints: performance.getEntriesByName('hj-paint').length }; });
      rows[label] = await act({ page, context, strokes, press, now }); errors.push(...errs.map((e) => `${label}: ${e}`)); say(`${which}: ${label}`, rows[label]); await browser.close();
    };
    await visit('Skip, 1.5 s into Film: finished at once', async ({ page, strokes, press, now }) => { await strokes(1); await wait(6000); await press('film'); await strokes(2); await wait(1500); await page.getByText('Skip', { exact: true }).click(); await wait(80); return now(); });
    await visit("Film's own tab, 1.5 s into Film: finished at once", async ({ strokes, press, now }) => { await strokes(1); await wait(6000); await press('film'); await strokes(2); await wait(1500); await press('film'); await wait(80); return now(); });
    await visit('the opening scene\'s own tab (an address without a hash)', async ({ strokes, press, now }) => { await strokes(1); await wait(1500); await press('build'); await wait(120); const a = await now(); await wait(1500); return { after120ms: a, later: await now() }; }, { url: prod });
    await visit('Skip under the first stroke (Film just tapped, blank paper)', async ({ page, strokes, press, now }) => { await strokes(1); await wait(6000); await press('film'); await page.waitForFunction(() => window.__log.at(-1)[1] === 'film', null, { polling: 10 }); await page.getByText('Skip', { exact: true }).click(); await wait(500); return now(); });
    await visit('Film asked for while it loads, then back to Build being painted: the painting goes on', async ({ page, context, strokes, press, now }) => { await context.route(/assets\/scene4\//, async (r) => { await wait(900); await r.continue(); }); await strokes(1); await wait(900); await press('film'); await wait(500); await press('build'); await wait(700); const mid = await now(); await wait(5000); const end = await now(); return { mid, end, strokes: await page.evaluate(() => performance.getEntriesByName('hj-paint').length) }; });
    await visit('Film loads slowly, tapped at 1 s: Build is painted meanwhile, then Film', async ({ context, strokes, press, now }) => { await context.route(/assets\/scene4\//, async (r) => { await wait(1200); await r.continue(); }); await strokes(1); await wait(1000); await press('film'); await wait(1000); const mid = await now(); await strokes(2); await wait(2000); return { mid, then: await now() }; });
    await visit('a scene that fails to load, asked for mid-painting: the painting goes on, Retry is offered', async ({ page, context, strokes, press, now }) => { await context.route(/assets\/scene4\/room/, (r) => r.abort()); await strokes(1); await wait(1000); await press('film'); await wait(900); const mid = await now(); await wait(5000); const retry = await page.locator('button:has-text("Retry room")').isVisible(); await context.unroute(/assets\/scene4\/room/); await page.locator('button:has-text("Retry room")').click(); await strokes(2); await wait(5500); return { mid, retry, after: await now() }; });
    await visit('a find, and the pan, kept over a reload; the painting is not skipped', async ({ page, strokes, now }) => { await strokes(1); await wait(6000); const id = await page.evaluate(() => { const b = document.querySelector('.hj-shroom'); b.click(); return b.dataset.spot; }); await page.evaluate(() => { const v = document.querySelector('.hj-viewport'); v.scrollLeft += 60; }); await wait(1500); const at = await page.evaluate(() => document.querySelector('.hj-viewport').scrollLeft); await page.reload({ waitUntil: 'commit' }); await strokes(1); await wait(600); const during = await now(); await wait(6000); return { found: id, still: await page.locator(`.hj-shroom[data-spot="${id}"]`).count(), panBefore: at, panAfter: await page.evaluate(() => document.querySelector('.hj-viewport').scrollLeft), during }; });
    await visit('reduced motion: no brush, a fade, as before', async ({ page, press, now }) => { await page.waitForFunction(() => window.__log?.length > 30); await wait(2500); await press('film'); await wait(2500); await press('design'); await wait(2500); await press('film'); await wait(2500); return { ...(await now()), arrivals: arrivals(await page.evaluate(() => window.__log)).map((a) => `${a.scene} ${a.sheet} ${a.paintedOverMs} ms`) }; }, { reducedMotion: 'reduce' });
    if (options.hasTouch) {
      await visit('panned in the middle of a brush-over: it goes on', async ({ page, strokes, press, now }) => { await strokes(1); await wait(6000); await press('film'); await strokes(2); await wait(6000); await press('build'); await strokes(3); await wait(700); await page.evaluate(() => { const v = document.querySelector('.hj-viewport'); let n = 0; const go = () => { v.scrollLeft += 4; if (++n < 30) requestAnimationFrame(go); }; go(); }); await wait(250); const a = await now(); await wait(2600); return { after250ms: a, end: await now() }; });
      await visit('turned in the middle of a brush-over: finished at once', async ({ page, strokes, press, now }) => { await strokes(1); await wait(6000); await press('film'); await strokes(2); await wait(6000); await press('build'); await strokes(3); await wait(700); await page.setViewportSize({ width: 844, height: 390 }); await wait(300); return now(); });
    }
    report[which] = { rows, errors }; say(`${which} errors`, errors); await save('states.json', report);
  }
};

if (!run[process.argv[2]]) { console.error('node qa/tools/paint-switch.mjs record|she|memory|trace|states|repro'); process.exit(1); }
await run[process.argv[2]]();

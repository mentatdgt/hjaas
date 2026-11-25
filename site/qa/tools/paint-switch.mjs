// Job 009: the paint effect on every change of scene (reviews/paint-every-switch-01.md). Results: qa/paint-switch/.
// Production builds: this one at HJ_PROD (4173), the one before (f37159e) at HJ_OLD_PROD (4196).
//
//   node qa/tools/paint-switch.mjs repro [new]   what the user saw: every way to change scene, timed frame by frame (WebKit iPhone; `new`: this build)
import { chromium, webkit, devices } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

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

if (!run[process.argv[2]]) { console.error('node qa/tools/paint-switch.mjs repro'); process.exit(1); }
await run[process.argv[2]]();

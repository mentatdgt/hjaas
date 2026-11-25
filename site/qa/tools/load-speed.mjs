// Jobs 011 and 011b: a faster opening (reviews/load-speed-01.md). Results: qa/load-speed/.
// Production builds, as folders: this one at HJ_DIST (dist), the one before (c605053) at HJ_OLD_DIST.
//
//   node qa/tools/load-speed.mjs timings [webkit|chrome] [n]   first strokes on a slowed line, both builds in turn: the opening, a cold switch
//   node qa/tools/load-speed.mjs rest            her drawing in the painting is the one before's, pixel for pixel; the routine starts only when its drawings are here (also after Skip)
//   node qa/tools/load-speed.mjs trace [n]       Chrome, phone, 4x slower: frames dropped in the opening and in a switch, both builds in turn
import { chromium, webkit, devices } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LINES, serve } from './slow-server.mjs';

const site = new URL('../../', import.meta.url).pathname;
const builds = { before: process.env.HJ_OLD_DIST ?? `${site}node_modules/.hj/dist-old`, now: process.env.HJ_DIST ?? `${site}dist` };
// (HJ_OUT: another folder for the results, e.g. ../load-speed-2a/)
const out = new URL(process.env.HJ_OUT ?? '../load-speed/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const phone = { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const save = (name, data) => writeFile(`${out}${name}`, `${JSON.stringify(data, null, 1)}\n`);
const load = (name) => readFile(`${out}${name}`, 'utf8').then(JSON.parse, () => ({}));
const median = (list) => [...list].sort((a, b) => a - b)[Math.floor((list.length - 1) / 2)];
/** A browser with a cache on disk, as a visitor's has (Playwright's own contexts are private ones, and WebKit's keep nothing). */
const open = (name, options = {}) => (name === 'chrome' ? chromium : webkit).launchPersistentContext(mkdtempSync(join(tmpdir(), 'hj-')), { ...phone, ...(name === 'chrome' ? { channel: 'chrome' } : {}), headless: true, ...options });
const errorsOf = (page) => { const errors = []; page.on('console', (m) => m.type() === 'error' && !/favicon/.test(m.location().url) && errors.push(m.text().slice(0, 200))); page.on('pageerror', (e) => errors.push(e.message)); return errors; };
const strokes = (page, kind = 'hj-paint') => page.evaluate((k) => performance.getEntriesByName(k).map((e) => Math.round(e.startTime)), kind);
const stroke = (page, n) => page.waitForFunction((k) => performance.getEntriesByName('hj-paint').length >= k, n, { timeout: 120000, polling: 50 });
/** When a tap on a tab reached the page. */
const TAPS = () => { window.__taps = []; addEventListener('click', (e) => e.target.closest?.('.hj-tab') && window.__taps.push(Math.round(performance.now())), true); };
const tap = (page, id) => page.locator(`.hj-tab[data-scene="${id}"]`).tap({ noWaitAfter: true, force: true });
const sum = (log, from = 0, to = Infinity) => { const part = log.filter((e) => e.at >= from && e.at <= to); return { requests: part.length, kB: Math.round(part.reduce((s, e) => s + e.bytes, 0) / 1000) }; };
const run = {};

/** One visit on a line: the opening (a scene's address) and, if asked, a switch. */
const visit = async (browser, dir, line, { first = 'build', to = null }) => {
  const server = await serve(dir, { line: LINES[line] });
  const context = await open(browser); await context.addInitScript(TAPS);
  const page = context.pages()[0] ?? await context.newPage(); const errors = errorsOf(page);
  const row = {};
  try {
    await page.goto(`${server.url}#${first}`, { waitUntil: 'commit' });
    const origin = server.log[0].at;
    await stroke(page, 1);
    const [at] = await strokes(page); row.opening = at;
    row.before = sum(server.log, 0, origin + at);
    if (to) {
      // Cold: the moment the opening's painting is nearly over, before any room can have been fetched ahead.
      await page.waitForFunction((t) => performance.now() > t + 2500, at, { polling: 50 });
      const from = server.now();
      await tap(page, to); await stroke(page, 2);
      const [, second] = await strokes(page); const taps = await page.evaluate(() => window.__taps);
      row.switch = second - taps[0]; row.during = sum(server.log, from);
    }
    row.errors = errors;
  } finally { await context.close(); await server.close(); }
  return row;
};

run.timings = async () => {
  const only = process.argv[3]; const n = Number(process.argv[4] ?? 3);
  const name = only ? `timings-${only}.json` : 'timings.json'; const report = await load(name);
  const cases = [
    ['opening Build', {}],
    ...['grow', 'design', 'film', 'set'].map((id) => [`opening ${id}`, { first: id }]),
    ...['grow', 'design', 'film', 'set'].map((id) => [`cold switch to ${id}`, { to: id }]),
  ];
  for (const browser of only ? [only] : ['webkit', 'chrome']) for (const line of ['fast', 'slow']) for (const [label, options] of cases) {
    if (process.env.HJ_ONLY && !label.includes(process.env.HJ_ONLY)) continue;
    const rows = { before: [], now: [] };
    for (let i = 0; i < n; i++) for (const build of ['before', 'now']) rows[build].push(await visit(browser, builds[build], line, options));
    const of = (build) => { const list = rows[build]; const key = options.to ? 'switch' : 'opening'; return { ms: list.map((r) => r[key]), median: median(list.map((r) => r[key])), bytes: options.to ? list[0].during : list[0].before, errors: list.flatMap((r) => r.errors) }; };
    report[`${browser}, ${line}: ${label}`] = { before: of('before'), now: of('now') };
    const r = report[`${browser}, ${line}: ${label}`];
    console.log(`${browser}, ${line}: ${label}: ${r.before.median} -> ${r.now.median} ms   ${JSON.stringify(r.before.ms)} ${JSON.stringify(r.now.ms)}  ${JSON.stringify(r.before.bytes)} ${JSON.stringify(r.now.bytes)} ${r.now.errors.join('; ')}`);
    await save(name, report);
  }
};

// ---- She is painted on the drawing she was painted on before, and holds it until the others are here. ----
/** In the page: a short name for what each figure's canvas holds. */
const FIGURES = () => [...document.querySelectorAll('.hj-plate .hj-rachel canvas, .hj-plate .hj-actor canvas, .hj-plate .hj-progress')].map((c) => { if (!c.width) return 'none'; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 2166136261; for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619); return `${c.width}x${c.height}:${(h >>> 0).toString(16)}`; });
run.rest = async () => {
  const report = await load('rest.json'); const note = async (label, value) => { report[label] = value; console.log(`${label}: ${JSON.stringify(value)}`); await save('rest.json', report); };
  const kinds = [['chrome', 'desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false }], ['chrome', 'phone', {}], ['webkit', 'phone', {}]];
  const want = (part) => !process.env.HJ_ONLY || process.env.HJ_ONLY === part;
  if (want('pixels')) for (const [browser, size, options] of kinds) for (const id of ['build', 'grow', 'design', 'film', 'set']) {
    const got = {};
    for (const build of ['before', 'now']) {
      const server = await serve(builds[build]); const context = await open(browser, options); const page = context.pages()[0] ?? await context.newPage();
      await page.goto(`${server.url}#${id}`, { waitUntil: 'commit' }); await stroke(page, 1); await wait(1500); got[build] = await page.evaluate(FIGURES); await context.close(); await server.close();
    }
    await note(`${browser} ${size}, ${id}: painted on the same pixels`, { same: JSON.stringify(got.before) === JSON.stringify(got.now), figures: got.now.length, ...(JSON.stringify(got.before) === JSON.stringify(got.now) ? {} : got) });
  }
  if (want('held')) for (const browser of ['webkit', 'chrome']) for (const [id, keep] of [['build', /frame_01\.webp$/], ['grow', /A1_mist_aim\.webp$/], ['set', /((R_A1|L_00)\.webp$|\/backdrop_\d+|\/stagehand\/)/]]) for (const skip of [false, true]) {
    if (process.env.HJ_HELD && process.env.HJ_HELD !== id) continue;
    const server = await serve(builds.now); const context = await open(browser); const page = context.pages()[0] ?? await context.newPage(); const errors = errorsOf(page);
    // Everything of the cast but the drawings it rests on is held back by the server.
    let allowed = null; const art = /\/(rachel|rachel-1\.5x|cast)\/.*\.webp$/;
    server.holds = (path) => allowed !== 'all' && art.test(path) && !keep.test(path);
    await page.goto(`${server.url}#${id}`, { waitUntil: 'commit' }); await stroke(page, 1); await wait(800); await page.evaluate(FIGURES); await wait(100); /* (Chrome gives a canvas read once another backing: read it twice.) */ await page.evaluate(FIGURES); const first = JSON.stringify(await page.evaluate(FIGURES));
    if (skip) await page.getByText('Skip', { exact: true }).click();
    let changed = null; const t0 = performance.now(); while (performance.now() - t0 < 8000) { const now = JSON.stringify(await page.evaluate(FIGURES)); if (now !== first) { changed ??= Math.round(performance.now() - t0); } await wait(250); }
    const found = await page.evaluate(() => { document.querySelector('.hj-shroom').click(); return new Promise((ok) => setTimeout(() => ok(10 - document.querySelectorAll('.hj-shroom').length), 1500)); });
    const held = JSON.stringify(await page.evaluate(FIGURES));
    allowed = 'all'; const t1 = performance.now(); let moved = null; while (performance.now() - t1 < 8000 && moved === null) { if (JSON.stringify(await page.evaluate(FIGURES)) !== held) moved = Math.round(performance.now() - t1); await wait(100); }
    await note(`${browser}, ${id}${skip ? ', Skip' : ''}: her other drawings held back`, { changedWhileHeld: changed, findWhileHeld: found, movesAfterTheyArriveMs: moved, errors });
    await context.close(); await server.close();
  }
  // When her routine starts, from the first stroke.
  if (want('start')) for (const browser of ['webkit', 'chrome']) for (const line of ['fast', 'slow']) for (const id of ['build', 'grow', 'design', 'film', 'set']) {
    const row = {};
    for (const build of ['before', 'now']) {
      const server = await serve(builds[build], { line: LINES[line] }); const context = await open(browser); const page = context.pages()[0] ?? await context.newPage();
      await page.goto(`${server.url}#${id}`, { waitUntil: 'commit' }); await stroke(page, 1); const [at] = await strokes(page);
      row[build] = await page.evaluate(([from, who]) => new Promise((ok) => { const hash = (c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 8) h = Math.imul(h ^ d[i], 16777619); return h; }; let was = null; let n = 0; const look = () => { const c = document.querySelector(`.hj-plate ${who} canvas`); const h = hash(c); if (++n > 6 && h !== was) return ok(Math.round(performance.now() - from)); was = h; if (performance.now() - from > 30000) return ok(null); setTimeout(look, 100); }; setTimeout(look, 3000); }), [at, id === 'film' ? '[data-actor=presenter]' : '.hj-rachel']);
      await context.close(); await server.close();
    }
    await note(`${browser}, ${line}, ${id}: her first move after the first stroke, ms`, row);
  }
};

// ---- A Chrome trace: phone, 4x slower, on the fast line (her other drawings arrive while the brush is at work). ----
const CATEGORIES = ['-*', 'toplevel', 'benchmark', 'cc', 'loading', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink.user_timing', 'v8.execute', 'latencyInfo', 'gpu', 'viz'];
const PIXELS = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
run.trace = async () => {
  const rounds = Number(process.argv[3] ?? 5); const line = process.argv[4] ?? 'fast'; const name = `trace-${line}.json`; const report = await load(name);
  const at = {};
  { const server = await serve(builds.now); const b = await chromium.launch({ channel: 'chrome' }); const p = await (await b.newContext(PIXELS)).newPage(); await p.goto(`${server.url}#build`); await wait(1500); Object.assign(at, await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.hj-tab')].map((t) => { const r = t.getBoundingClientRect(); return [t.dataset.scene, { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }]; })))); await b.close(); await server.close(); }
  for (let i = 0; i < rounds; i++) for (const build of i % 2 ? ['before', 'now'] : ['now', 'before']) {
    const server = await serve(builds[build], { line: LINES[line] });
    const browser = await chromium.launch({ channel: 'chrome' }); const page = await (await browser.newContext(PIXELS)).newPage(); const errors = errorsOf(page);
    const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await browser.startTracing(page, { categories: CATEGORIES });
    await cdp.send('Page.navigate', { url: `${server.url}#build` });
    // (Only touches: nothing is asked of the page meanwhile.)
    const touch = async (id) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at[id]] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
    await wait(13000); if (!process.env.HJ_OPENING) for (const id of ['grow', 'design', 'film', 'set']) { await touch(id); await wait(14000); }
    const buffer = await browser.stopTracing(); await browser.close(); await server.close();
    const { traceEvents: ev } = JSON.parse(buffer.toString());
    const marks = ev.filter((e) => e.name === 'hj-paint' && String(e.cat).includes('user_timing')).sort((a, b) => a.ts - b.ts);
    const { pid, tid } = marks[0]; const drops = ev.filter((e) => e.name === 'DroppedFrame' && e.pid === pid); const tasks = ev.filter((e) => e.name === 'RunTask' && e.ph === 'X' && e.pid === pid && e.tid === tid); const begun = ev.filter((e) => e.name === 'BeginFrame' && e.pid === pid);
    // (The page's own process around its paintings, short events left out: the whole of it is 30 MB.)
    if (i === rounds - 1) { const file = `${out}trace-${build}.json`; const near = (ts) => marks.some((m) => ts > m.ts - 300_000 && ts < m.ts + 5_000_000); await writeFile(file, JSON.stringify({ traceEvents: ev.filter((e) => e.ph === 'M' || (e.pid === pid && near(e.ts) && (e.ph !== 'X' || e.dur > 1500) && (e.ph === 'X' || /Frame|hj-paint/.test(e.name)))) })); execFileSync('gzip', ['-f', file]); }
    const rows = {};
    for (const [n, m] of marks.entries()) { const end = m.ts + 4750_000; const inside = (e) => e.ts >= m.ts && e.ts < end; const d = drops.filter(inside); const early = d.filter((e) => e.ts - m.ts < 4_000_000).length; rows[['opening (Build)', 'Grow', 'Design', 'Film', 'Set'][n] ?? `${n}`] = { frames: begun.filter(inside).length, dropped: d.length, beforeTheWash: early, droppedAt: d.map((e) => Math.round((e.ts - m.ts) / 1000)).slice(0, 30), longestTaskMs: Math.round(Math.max(0, ...tasks.filter(inside).map((e) => e.dur)) / 1000), tasksOver16: tasks.filter((e) => inside(e) && e.dur > 16000).length }; }
    (report[build] ??= []).push({ rows, errors }); console.log(`${build} ${i + 1}`, JSON.stringify(Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, `${v.dropped} of ${v.frames} ${v.droppedAt}, longest ${v.longestTaskMs}`])))); await save(name, report);
  }
};

export { builds, errorsOf, LINES, load, median, open, out, phone, run, save, serve, stroke, strokes, sum, tap, TAPS, wait };
if (process.argv[1] === new URL(import.meta.url).pathname) { if (!run[process.argv[2]]) { console.log('which?', Object.keys(run)); process.exit(1); } await run[process.argv[2]](); process.exit(0); }

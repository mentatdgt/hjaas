// Job 020: load speed part 2, B (reviews/load-speed-part2-B.md). Results: qa/load-speed-2b/. Both builds as folders, as in load-speed.mjs:
// this one at HJ_DIST, the one before (a252d17, Part A) at HJ_OLD_DIST. The trace is load-speed.mjs's own, with HJ_OUT=../load-speed-2b/.
//
//   HJ_OUT=../load-speed-2b/ node qa/tools/load-speed-2b.mjs timings [webkit|chrome] [n]   first strokes on a slowed line, both builds in turn: openings, cold switches, switches after the next room was fetched ahead
//   HJ_OUT=../load-speed-2b/ node qa/tools/load-speed-2b.mjs network [webkit|chrome]       how often each file crossed the line: Set Design's opening, a tour, a tap while the next room is fetched ahead (for it, for another), save-data; normal and private windows
//   HJ_OUT=../load-speed-2b/ node qa/tools/load-speed-2b.mjs set                            Set Design: what is downloaded before the first stroke, the picture the same as before's (0 and 4 found), when the stagehand joins and first walks
import { chromium, webkit } from 'playwright';
import { builds, errorsOf, LINES, load, median, open, phone, save, serve, stroke, strokes, sum, tap, TAPS, wait } from './load-speed.mjs';

const run = {};
/** Saved progress: `found` of Set Design's mushrooms. */
const FOUND = (n) => { if (!sessionStorage.getItem('hj-preset')) { sessionStorage.setItem('hj-preset', '1'); localStorage.setItem('hjaas:site:v2', JSON.stringify({ scenes: { set: { found: ['coil', 'flats', 'boards', 'pots', 'drop-cloth', 'ladder', 'paint-pail', 'cart-shelf', 'cart-front', 'splatter'].slice(0, n), seen: false } }, panned: false })); } };
const SAVE_DATA = () => Object.defineProperty(Navigator.prototype, 'connection', { get: () => ({ saveData: true }), configurable: true });
const openPrivate = async (name) => { const b = await (name === 'chrome' ? chromium.launch({ channel: 'chrome' }) : webkit.launch()); const c = await b.newContext(phone); const close = c.close.bind(c); c.close = async () => { await close(); await b.close(); }; return c; };
/** A file sent whole (not called off part way). */
const whole = (e) => e.status === 200 && !e.dropped && e.bytes === e.size;
const until = async (test, ms) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (test()) return Math.round(performance.now() - t0); await wait(40); } return null; };
const roomDone = (log, path) => log.some((e) => e.path.endsWith(path) && whole(e) && e.done);

/** One visit on a line: the opening and, if asked, a switch (cold, or once the room was fetched ahead). */
const visit = async (browser, dir, line, { first = 'build', to = null, ahead = null }) => {
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
      if (ahead) {
        // Once the next room is here (fetched ahead), and a moment more.
        row.aheadAfterMs = await until(() => roomDone(server.log, ahead), 120000);
        await wait(1000);
      } else {
        // Cold: the moment the opening's painting is nearly over, before any room can have been fetched ahead.
        await page.waitForFunction((t) => performance.now() > t + 2500, at, { polling: 50 });
      }
      const from = server.now();
      await tap(page, to); await stroke(page, 2);
      const [, second] = await strokes(page); const taps = await page.evaluate(() => window.__taps);
      row.switch = second - taps[0]; row.during = sum(server.log, from, from + row.switch);
    }
    row.errors = errors;
  } finally { await context.close(); await server.close(); }
  return row;
};

run.timings = async () => {
  const only = process.argv[3]; const n = Number(process.argv[4] ?? 3);
  const name = only ? `timings-${only}.json` : 'timings.json'; const report = await load(name);
  const cases = [
    ['opening build', {}],
    ['opening set', { first: 'set' }],
    ['opening film', { first: 'film' }],
    ...['grow', 'design', 'film', 'set'].map((id) => [`cold switch to ${id}`, { to: id }]),
    ['switch to grow, its room fetched ahead', { first: 'build', to: 'grow', ahead: 'scene2/room.webp' }],
    ['switch to set from film, its room fetched ahead', { first: 'film', to: 'set', ahead: 'scene5/room.webp' }],
  ];
  const lines = process.env.HJ_LINES ? process.env.HJ_LINES.split(',') : ['fast', 'slow'];
  for (const browser of only ? [only] : ['webkit', 'chrome']) for (const line of lines) for (const [label, options] of cases) {
    if (process.env.HJ_ONLY && !label.includes(process.env.HJ_ONLY)) continue;
    const rows = { before: [], now: [] };
    for (let i = 0; i < n; i++) for (const build of i % 2 ? ['now', 'before'] : ['before', 'now']) rows[build].push(await visit(browser, builds[build], line, options));
    const of = (build) => { const list = rows[build]; const key = options.to ? 'switch' : 'opening'; return { ms: list.map((r) => r[key]), median: median(list.map((r) => r[key])), bytes: options.to ? list.map((r) => r.during) : list.map((r) => r.before), ...(options.ahead ? { aheadAfterMs: list.map((r) => r.aheadAfterMs) } : {}), errors: list.flatMap((r) => r.errors) }; };
    report[`${browser}, ${line}: ${label}`] = { before: of('before'), now: of('now') };
    const r = report[`${browser}, ${line}: ${label}`];
    console.log(`${browser}, ${line}: ${label}: ${r.before.median} -> ${r.now.median} ms   ${JSON.stringify(r.before.ms)} ${JSON.stringify(r.now.ms)}  ${JSON.stringify(r.before.bytes[0])} ${JSON.stringify(r.now.bytes[0])} ${r.now.aheadAfterMs ? `ahead ${JSON.stringify(r.before.aheadAfterMs)} ${JSON.stringify(r.now.aheadAfterMs)}` : ''} ${r.now.errors.join('; ')}`);
    await save(name, report);
  }
};

const counts = (log) => Object.entries(Object.groupBy(log.filter((e) => whole(e) && /assets\/(scene|shared)/.test(e.path)), (e) => e.path)).map(([path, l]) => [path.replace('/assets/', ''), l.length]);
const summary = (log) => {
  const c = counts(log);
  return {
    rooms: Object.fromEntries(c.filter(([p]) => /room\.webp$/.test(p))),
    roomsCalledOff: log.filter((e) => e.dropped && /room\.webp$/.test(e.path)).map((e) => `${e.path.replace('/assets/', '')} at ${Math.round((e.bytes / Math.max(1, e.size)) * 100)}%`),
    roomsRevalidated: log.filter((e) => e.status === 304 && /room\.webp$/.test(e.path)).map((e) => e.path.replace('/assets/', '')),
    othersWholeTwice: c.filter(([p, k]) => k > 1 && !/room\.webp$/.test(p)).map(([p, k]) => `${p} x${k}`),
    files: c.length, kB: Math.round(log.filter(whole).reduce((s, e) => s + e.bytes, 0) / 1000),
  };
};

run.network = async () => {
  const only = process.argv[3]; const name = only ? `network-${only}.json` : 'network.json'; const report = await load(name);
  const cases = {
    'opening set': { first: 'set', line: 'slow', then: 25000 },
    'tour: build, grow, design, film, set, film, build, each once its next room is fetched ahead': { first: 'build', line: 'fast', tour: ['grow', 'design', 'film', 'set', 'film', 'build'] },
    'grow tapped while its room is being fetched ahead': { first: 'build', line: 'slow', warming: 'grow' },
    'design tapped while grow\'s room is being fetched ahead, then grow': { first: 'build', line: 'slow', warming: 'design', later: 'grow' },
    'the browser asks to save data': { first: 'build', line: 'fast', then: 25000, saveData: true },
  };
  for (const browser of only ? [only] : ['webkit', 'chrome']) for (const kind of ['a normal window', 'a private window']) for (const [label, c] of Object.entries(cases)) for (const build of ['before', 'now']) {
    if (process.env.HJ_ONLY && !label.includes(process.env.HJ_ONLY)) continue;
    if (kind === 'a private window' && (c.saveData || c.first === 'set')) continue;
    const server = await serve(builds[build], { line: LINES[c.line] });
    const context = await (kind === 'a normal window' ? open(browser) : openPrivate(browser)); if (c.saveData) await context.addInitScript(SAVE_DATA);
    const page = context.pages()[0] ?? await context.newPage(); const errors = errorsOf(page);
    await page.goto(`${server.url}#${c.first}`, { waitUntil: 'commit' }); await stroke(page, 1); const at = (await strokes(page))[0];
    const stroked = server.log[0].at + at;
    const row = {};
    let n = 1;
    if (c.first === 'set') {
      row.beforeTheStroke = server.log.filter((e) => e.at <= stroked && /scene5\/cast\/(backdrop|stagehand)/.test(e.path)).map((e) => e.path.replace('/assets/scene5/cast/', ''));
      row.requestsBeforeTheStroke = server.log.filter((e) => e.at <= stroked).length;
    }
    if (c.warming) {
      // The next room is on its way (a fifth of it here), not yet whole.
      row.warmingSeenAfterMs = await until(() => server.log.some((e) => e.path.endsWith('scene2/room.webp') && e.bytes > 250000), 90000);
      row.warmingWasWhole = roomDone(server.log, 'scene2/room.webp');
      await tap(page, c.warming); await stroke(page, ++n);
      if (c.later) { await wait(8000); await tap(page, c.later); await stroke(page, ++n); }
      await wait(4000);
    } else if (c.tour) {
      const next = { build: 'scene2', grow: 'scene3', design: 'scene4', film: 'scene5' };
      let here = c.first;
      for (const id of c.tour) {
        // (Once the room after this one is here, if this build fetches it ahead; never longer than 20 s.)
        if (next[here]) await until(() => roomDone(server.log, `${next[here]}/room.webp`), 20000);
        await wait(1500); await tap(page, id); await stroke(page, ++n); here = id;
      }
      await wait(8000);
    } else await wait(c.then);
    if (c.first === 'set') row.backdropAndStagehandInAll = server.log.filter((e) => /scene5\/cast\/(backdrop|stagehand)/.test(e.path)).length;
    Object.assign(row, summary(server.log), { errors });
    ((report[`${browser}, ${kind}: ${label}`] ??= {}))[build] = row; console.log(`${browser}, ${kind}: ${label}, ${build}: ${JSON.stringify(row)}`); await save(name, report);
    await context.close(); await server.close();
  }
};

/** In the page: a short name for what each figure's canvas holds (the backdrop's pieces among them). */
const FIGURES = () => [...document.querySelectorAll('.hj-plate .hj-rachel canvas, .hj-plate .hj-actor canvas, .hj-plate .hj-progress')].map((c) => { if (!c.width) return 'none'; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 2166136261; for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619); return `${c.className}:${c.width}x${c.height}:${(h >>> 0).toString(16)}`; });
/** In the page: whether the stagehand's canvas is there, and a sum of what is drawn on it. */
const WALK = () => { const c = document.querySelector('.hj-viewport .hj-plate .hj-walk'); if (!c) return null; if (!c.width) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 3; i < d.length; i += 16) s += d[i]; return s + 1; };
run.set = async () => {
  const report = await load('set.json');
  for (const browser of ['webkit', 'chrome']) for (const found of [0, 4]) for (const line of ['fast', 'slow']) {
    const got = {};
    for (const build of ['before', 'now']) {
      const server = await serve(builds[build], { line: LINES[line] }); const context = await open(browser); await context.addInitScript(FOUND, found);
      const page = context.pages()[0] ?? await context.newPage(); const errors = errorsOf(page);
      await page.goto(`${server.url}#set`, { waitUntil: 'commit' }); await stroke(page, 1); const [at] = await strokes(page);
      const stroked = server.log[0].at + at;
      const row = { firstStrokeMs: at, before: sum(server.log, 0, stroked) };
      row.piecesBeforeTheStroke = server.log.filter((e) => e.at <= stroked && /backdrop_/.test(e.path)).map((e) => e.path.match(/P_\d+/)[0]);
      row.stagehandBeforeTheStroke = server.log.filter((e) => e.at <= stroked && /stagehand\//.test(e.path)).length;
      await wait(1500); await page.evaluate(FIGURES); await wait(100); row.figures = await page.evaluate(FIGURES);
      // He joins (his canvas sized), and walks (something drawn on it): seconds from the first stroke.
      const t0 = performance.now() - 1600;
      let join = null; let walk = null;
      while (performance.now() - t0 < 70000 && walk === null) { const w = await page.evaluate(WALK); if (w && join === null) join = Math.round(performance.now() - t0); if (w > 1) walk = Math.round(performance.now() - t0); await wait(200); }
      row.stagehandJoinedAfterMs = join; row.firstWalkAfterMs = walk;
      row.piecesInAll = server.log.filter((e) => /backdrop_/.test(e.path)).length; row.errors = errors;
      got[build] = row; await context.close(); await server.close();
    }
    const same = JSON.stringify(got.before.figures) === JSON.stringify(got.now.figures);
    const label = `${browser}, ${line}, ${found} found`;
    report[label] = { samePicture: same, before: { ...got.before, figures: same ? got.before.figures.length : got.before.figures }, now: { ...got.now, figures: same ? got.now.figures.length : got.now.figures } };
    console.log(`${label}: same ${same}; stroke ${got.before.firstStrokeMs} -> ${got.now.firstStrokeMs}; pieces before stroke ${got.before.piecesBeforeTheStroke.length} -> ${JSON.stringify(got.now.piecesBeforeTheStroke)}; stagehand before stroke ${got.before.stagehandBeforeTheStroke} -> ${got.now.stagehandBeforeTheStroke}; joined ${got.before.stagehandJoinedAfterMs} -> ${got.now.stagehandJoinedAfterMs}; walks ${got.before.firstWalkAfterMs} -> ${got.now.firstWalkAfterMs}; ${got.now.errors.join('; ')}`);
    await save('set.json', report);
  }
};

if (!run[process.argv[2]]) { console.log('which?', Object.keys(run)); process.exit(1); } await run[process.argv[2]](); process.exit(0);

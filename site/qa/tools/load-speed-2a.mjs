// Job 019: load speed part 2, A (reviews/load-speed-part2-A.md). Results: qa/load-speed-2a/. Both builds as folders, as in load-speed.mjs
// (HJ_DIST, HJ_OLD_DIST). The timings and the trace are load-speed.mjs's own, with HJ_OUT=../load-speed-2a/.
//
//   HJ_OUT=../load-speed-2a/ node qa/tools/load-speed-2a.mjs network [webkit|chrome]   how often each file crossed the line: openings, a tour of the five rooms and back, a tap while the next room is being warmed; also in a private window
//   HJ_OUT=../load-speed-2a/ node qa/tools/load-speed-2a.mjs screen      Film's camera screen is the same, pixel for pixel, as the build before's, however the room was come to
//   HJ_OUT=../load-speed-2a/ node qa/tools/load-speed-2a.mjs tapaway     slow line: a scene tapped, another tapped at once: the first one's cast is called off, nothing is downloaded whole twice, both open in the end; a failed room, a failed cast
import { chromium, webkit } from 'playwright';
import { builds, errorsOf, LINES, load, open, phone, save, serve, stroke, strokes, tap, wait } from './load-speed.mjs';
const run = {};
const openPrivate = async (name) => { const b = await (name === 'chrome' ? chromium.launch({ channel: 'chrome' }) : webkit.launch()); const c = await b.newContext(phone); const close = c.close.bind(c); c.close = async () => { await close(); await b.close(); }; return c; };
const full = (log) => Object.entries(Object.groupBy(log.filter((e) => e.status === 200 && !e.dropped && e.bytes === e.size && /assets\/(scene|shared)/.test(e.path)), (e) => e.path)).map(([path, l]) => [path.replace('/assets/', ''), l.length]);
const summary = (log) => {
  const counts = full(log);
  return { rooms: Object.fromEntries(counts.filter(([p]) => /room\.webp$/.test(p))), othersWholeTwice: counts.filter(([p, n]) => n > 1 && !/room\.webp$/.test(p)).map(([p, n]) => `${p} x${n}`), roomsCalledOff: log.filter((e) => e.dropped && /room\.webp$/.test(e.path)).length, roomsRevalidated: log.filter((e) => e.status === 304 && /room\.webp$/.test(e.path)).length, files: counts.length, kB: Math.round(log.reduce((s, e) => s + e.bytes, 0) / 1000) };
};

run.network = async () => {
  const only = process.argv[3]; const name = only ? `network-${only}.json` : 'network.json'; const report = await load(name);
  const cases = {
    'opening film': { first: 'film' }, 'opening set': { first: 'set' }, 'opening build': { first: 'build' },
    'tour of all five, and back to film and build': { first: 'build', tour: ['grow', 'design', 'film', 'set', 'film', 'build'] },
    'grow tapped while it is being warmed': { first: 'build', warming: 'grow' },
  };
  for (const browser of only ? [only] : ['webkit', 'chrome']) for (const kind of ['a normal window', 'a private window']) for (const [label, c] of Object.entries(cases)) for (const build of ['before', 'now']) {
    if (process.env.HJ_ONLY && !label.includes(process.env.HJ_ONLY)) continue;
    const server = await serve(builds[build], { line: c.tour ? LINES.fast : LINES.slow });
    const context = await (kind === 'a normal window' ? open(browser) : openPrivate(browser)); const page = context.pages()[0] ?? await context.newPage(); const errors = errorsOf(page);
    await page.goto(`${server.url}#${c.first}`, { waitUntil: 'commit' }); await stroke(page, 1); const at = (await strokes(page))[0];
    const before = { requests: server.log.filter((e) => e.at <= server.log[0].at + at).length };
    let n = 1;
    if (c.warming) {
      const t0 = performance.now(); while (performance.now() - t0 < 60000 && !server.log.some((e) => e.path.endsWith('scene2/room.webp') && e.bytes > 20000)) await wait(40);
      await tap(page, c.warming); await stroke(page, ++n);
    } else if (c.tour) for (const id of c.tour) { await wait(6500); await tap(page, id); await wait(5500); }
    await wait(c.tour ? 1500 : 4000);
    const row = { ...summary(server.log), requestsBeforeTheStroke: before.requests, errors };
    ((report[`${browser}, ${kind}: ${label}`] ??= {}))[build] = row; console.log(`${browser}, ${kind}: ${label}, ${build}: ${JSON.stringify(row)}`); await save(name, report);
    await context.close(); await server.close();
  }
};

/** Film's live screen, read back once it is painted and she is at rest; and the rest of the figures. */
const SCREEN = () => [...document.querySelectorAll('.hj-plate .hj-finder, .hj-plate .hj-rachel canvas, .hj-plate .hj-actor canvas')].map((c) => { if (!c.width) return 'none'; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 2166136261; for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619); return `${c.className || 'figure'} ${c.width}x${c.height}:${(h >>> 0).toString(16)}`; });
run.screen = async () => {
  const report = {};
  for (const browser of ['webkit', 'chrome']) for (const kind of ['a normal window', 'a private window']) for (const way of ['opening', 'switch']) {
    const got = {};
    for (const build of ['before', 'now']) {
      const server = await serve(builds[build]); const context = await (kind === 'a normal window' ? open(browser) : openPrivate(browser)); const page = context.pages()[0] ?? await context.newPage(); const errors = errorsOf(page);
      await page.goto(`${server.url}#${way === 'opening' ? 'film' : 'build'}`, { waitUntil: 'commit' }); await stroke(page, 1);
      if (way === 'switch') { await wait(5500); await tap(page, 'film'); await stroke(page, 2); }
      await wait(1500); got[build] = { screen: await page.evaluate(SCREEN), errors }; await context.close(); await server.close();
    }
    const same = JSON.stringify(got.before.screen) === JSON.stringify(got.now.screen);
    report[`${browser}, ${kind}, ${way}`] = { same, canvases: got.now.screen.length, ...(same ? { screen: got.now.screen.find((s) => /finder/.test(s)) } : got), errors: got.now.errors }; console.log(`${browser}, ${kind}, ${way}: ${JSON.stringify(report[`${browser}, ${kind}, ${way}`])}`); await save('screen.json', report);
  }
};

run.tapaway = async () => {
  const report = {};
  for (const browser of ['webkit', 'chrome']) for (const [a, b] of [['film', 'design'], ['set', 'grow'], ['design', 'build']]) {
    const server = await serve(builds.now, { line: LINES.slow }); const context = await open(browser); const page = context.pages()[0] ?? await context.newPage(); const errors = errorsOf(page);
    const warnings = []; page.on('console', (m) => m.type() === 'warning' && warnings.push(m.text().slice(0, 160)));
    await page.goto(`${server.url}#build`, { waitUntil: 'commit' }); await stroke(page, 1); await wait(5500);
    const from = server.now(); await tap(page, a); await wait(1500);
    const folder = { film: 'scene4', set: 'scene5', design: 'scene3' }[a]; const cast = (e) => e.path.includes(`${folder}/cast`);
    const at = server.now(); await tap(page, b); await wait(400);
    const row = { castRequestsBeforeTheSecondTap: server.log.filter((e) => e.at >= from && e.at <= at && cast(e)).length };
    if (b !== 'build') await stroke(page, 2); else await wait(3000);
    row.calledOff = server.log.filter((e) => cast(e) && e.dropped).length; row.castRequestsAfterIt = server.log.filter((e) => e.at > at + 60 && cast(e)).length;
    row.shown = await page.evaluate(() => document.querySelector('.hj-viewport .hj-plate').dataset.scene);
    await wait(5000); await tap(page, a); await stroke(page, b === 'build' ? 2 : 3); await wait(5500);
    row.thenShown = await page.evaluate(() => [document.querySelector('.hj-viewport .hj-plate').dataset.scene, [...document.querySelectorAll('.hj-viewport .hj-plate canvas')].filter((c) => c.width && c.closest('.hj-rachel, .hj-actor')).length]);
    const s = summary(server.log); row.rooms = s.rooms; row.wholeTwice = s.othersWholeTwice; row.errors = errors; row.warnings = warnings;
    report[`${browser}: ${a}, then ${b} after 1.5 s, then ${a}`] = row; console.log(`${browser}: ${a}, ${b}, ${a}: ${JSON.stringify(row)}`); await save('tapaway.json', report);
    await context.close(); await server.close();
  }
  // Rapid: five tabs, 250 ms apart, and back to the first asked for.
  for (const browser of ['webkit', 'chrome']) {
    const server = await serve(builds.now, { line: LINES.slow }); const context = await open(browser); const page = context.pages()[0] ?? await context.newPage(); const errors = errorsOf(page);
    await page.goto(`${server.url}#build`, { waitUntil: 'commit' }); await stroke(page, 1); await wait(5500);
    for (const id of ['grow', 'design', 'film', 'set', 'grow', 'film', 'grow']) { await tap(page, id); await wait(250); }
    const t0 = performance.now(); await stroke(page, 2); await wait(6000);
    const heavy = server.log.filter((e) => /scene2\/rachel\/.*webp$/.test(e.path)).length;
    const row = { strokeAfterMs: Math.round(performance.now() - t0 - 6000), shown: await page.evaluate(() => document.querySelector('.hj-viewport .hj-plate').dataset.scene), fullSizeGrowDrawings: heavy, ...summary(server.log), errors };
    report[`${browser}: rapid`] = row; console.log(`${browser}: rapid: ${JSON.stringify(row)}`); await save('tapaway.json', report); await context.close(); await server.close();
  }
  // Failures: the room (Retry brings it), and the cast (the room is shown without her; asked for again, she is there).
  for (const browser of ['webkit', 'chrome']) for (const kind of ['room', 'cast']) {
    const server = await serve(builds.now, { line: LINES.fast }); const context = await open(browser); const page = context.pages()[0] ?? await context.newPage(); const errors = errorsOf(page);
    await page.goto(`${server.url}#build`, { waitUntil: 'commit' }); await stroke(page, 1); await wait(6000);
    server.fails = (path) => (kind === 'room' ? /scene4\/room/.test(path) : /scene4\/cast\/rachel/.test(path));
    await tap(page, 'film'); const row = {};
    if (kind === 'room') { await page.waitForSelector('text=Retry room', { timeout: 30000 }); row.stillShown = await page.evaluate(() => document.querySelector('.hj-viewport .hj-plate').dataset.scene); server.fails = () => false; await page.getByText('Retry room').click(); await stroke(page, 2); await wait(1500); }
    else { await stroke(page, 2); await wait(6000); row.without = await page.evaluate(() => [document.querySelector('.hj-viewport .hj-plate').dataset.scene, document.querySelectorAll('.hj-viewport .hj-plate .hj-actor, .hj-viewport .hj-plate .hj-rachel').length]); server.fails = () => false; await tap(page, 'build'); await wait(6000); await tap(page, 'film'); await wait(6000); }
    row.then = await page.evaluate(() => [document.querySelector('.hj-viewport .hj-plate').dataset.scene, document.querySelectorAll('.hj-viewport .hj-plate .hj-actor, .hj-viewport .hj-plate .hj-rachel').length]); row.errors = errors; row.rooms = summary(server.log).rooms;
    report[`${browser}: failed ${kind}`] = row; console.log(`${browser}: failed ${kind}: ${JSON.stringify(row)}`); await save('tapaway.json', report); await context.close(); await server.close();
  }
};
if (!run[process.argv[2]]) { console.log('which?', Object.keys(run)); process.exit(1); } await run[process.argv[2]](); process.exit(0);

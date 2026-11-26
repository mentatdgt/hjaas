// Review 20b: the room being downloaded ahead (Grow's) is called off by a tap on another scene (Design); Grow is visited later.
// Its room must cross the network in full once. node node_modules/.hj/review20b/warm-calledoff.mjs <dist> [webkit|chrome]
process.env.HJ_OUT ??= '../load-speed-2v/review/';
const { open, serve, LINES, stroke, tap, wait, errorsOf } = await import('../../tools/load-speed.mjs');
const dist = process.argv[2]; const browser = process.argv[3] ?? 'chrome';
const server = await serve(dist, { line: LINES.slow });
const context = await open(browser); const page = context.pages()[0] ?? await context.newPage(); const errors = errorsOf(page);
await page.goto(`${server.url}#build`, { waitUntil: 'commit' }); await stroke(page, 1);
const t0 = performance.now(); while (performance.now() - t0 < 60000 && !server.log.some((e) => e.path.endsWith('scene2/room.webp') && e.bytes > 200000)) await wait(40);
const warmedBeforeTap = server.log.some((e) => e.path.endsWith('scene2/room.webp'));
await tap(page, 'design'); await stroke(page, 2); await wait(9000);
const afterDesign = server.log.filter((e) => /room\.webp$/.test(e.path)).map((e) => `${e.path.replace('/assets/', '')} ${e.status} ${Math.round(e.bytes / 1000)}/${Math.round(e.size / 1000)} kB${e.dropped ? ' dropped' : ''}`);
await tap(page, 'grow'); await stroke(page, 3); await wait(4000);
const rooms = server.log.filter((e) => /room\.webp$/.test(e.path)).map((e) => `${e.at} ${e.path.replace('/assets/', '')} ${e.status} ${Math.round(e.bytes / 1000)}/${Math.round(e.size / 1000)} kB${e.dropped ? ' dropped' : ''}`);
const shown = await page.evaluate(() => [document.querySelector('.hj-viewport .hj-plate').dataset.scene, document.querySelectorAll('.hj-viewport .hj-plate .hj-rachel').length]);
console.log(JSON.stringify({ browser, warmedBeforeTap, afterDesign, rooms, shown, errors }, null, 1));
await context.close(); await server.close(); process.exit(0);

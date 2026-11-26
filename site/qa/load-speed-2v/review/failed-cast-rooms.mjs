// Review 20b: load-speed-2a's "failed cast" case, with every room request listed (why was scene5's room whole twice in WebKit?).
// node node_modules/.hj/review20b/failed-cast-rooms.mjs <dist> [webkit|chrome]
process.env.HJ_OUT ??= '../load-speed-2v/review/';
const { open, serve, LINES, stroke, tap, wait } = await import('../../tools/load-speed.mjs');
const dist = process.argv[2]; const browser = process.argv[3] ?? 'webkit';
const server = await serve(dist, { line: LINES.fast });
const context = await open(browser); const page = context.pages()[0] ?? await context.newPage();
const events = []; const t = () => server.now();
await page.goto(`${server.url}#build`, { waitUntil: 'commit' }); await stroke(page, 1); await wait(6000);
server.fails = (path) => /scene4\/cast\/rachel/.test(path);
events.push(`${t()} tap film`); await tap(page, 'film'); await stroke(page, 2); events.push(`${t()} stroke 2`); await wait(6000);
server.fails = () => false;
events.push(`${t()} tap build`); await tap(page, 'build'); await wait(6000); events.push(`${t()} tap film`); await tap(page, 'film'); await wait(6000);
const rooms = server.log.filter((e) => /room\.webp/.test(e.path)).map((e) => `${e.at}-${e.done} ${e.path.replace('/assets/', '')} ${e.status} ${Math.round(e.bytes / 1000)}/${Math.round(e.size / 1000)} kB ${e.dest}${e.dropped ? ' DROPPED' : ''}`);
console.log(JSON.stringify({ browser, events, rooms }, null, 1));
await context.close(); await server.close(); process.exit(0);

// Review 20b: does Build's reaction loading recover after a tap away that is overtaken back to Build (no rest in between)?
// node node_modules/.hj/review20b/reaction-after-tap.mjs <dist> [chrome|webkit] [tapBack=1]
process.env.HJ_OUT ??= '../load-speed-2v/review/';
const { open, serve, stroke, tap, wait, errorsOf } = await import('../../tools/load-speed.mjs');
const dist = process.argv[2]; const browser = process.argv[3] ?? 'chrome'; const tapBack = process.argv[4] !== '0';
const server = await serve(dist);
const context = await open(browser); const page = context.pages()[0] ?? await context.newPage(); const errors = errorsOf(page);
let holding = true;
server.holds = (path) => holding && (/scene1\/rachel(-1\.5x)?\/reaction\/.*\.webp$/.test(path) || /scene2\/room/.test(path));
await page.goto(`${server.url}#build`, { waitUntil: 'commit' }); await stroke(page, 1);
const t0 = Date.now(); while (Date.now() - t0 < 40000 && !server.log.some((e) => /reaction\/.*webp$/.test(e.path))) await wait(100);
const firstHeld = server.log.find((e) => /reaction\/.*webp$/.test(e.path));
console.log('first reaction file asked for:', firstHeld?.path, 'at', firstHeld?.at);
if (tapBack) { await tap(page, 'grow'); await wait(150); await tap(page, 'build'); }
await wait(1500);
holding = false;
await wait(12000);
const reactionFiles = [...new Set(server.log.filter((e) => /reaction\//.test(e.path)).map((e) => e.path))];
console.log(JSON.stringify({ browser, tapBack, shown: await page.evaluate(() => document.querySelector('.hj-viewport .hj-plate').dataset.scene), reactionRequests: reactionFiles.length, reactionFiles, errors }, null, 1));
await context.close(); await server.close(); process.exit(0);

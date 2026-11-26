// Review 20b: load-speed-2a's tapaway case, but in a private window (nothing kept by the browser), both builds.
// node node_modules/.hj/review20b/tapaway-private.mjs <a> <b> <delayMs> [webkit|chrome]
process.env.HJ_OUT ??= '../load-speed-2v/review/';
const { builds, errorsOf, LINES, phone, serve, stroke, tap, wait } = await import('../../tools/load-speed.mjs');
const { webkit, chromium } = await import('playwright');
const [a, b] = [process.argv[2] ?? 'film', process.argv[3] ?? 'design']; const delay = Number(process.argv[4] ?? 1500); const name = process.argv[5] ?? 'webkit';
const full = (log) => Object.entries(Object.groupBy(log.filter((e) => e.status === 200 && !e.dropped && e.bytes === e.size && /assets\/(scene|shared)/.test(e.path)), (e) => e.path)).map(([path, l]) => [path.replace('/assets/', ''), l.length, l[0].size]);
for (const build of ['before', 'now']) {
  const server = await serve(builds[build], { line: LINES.slow });
  const br = await (name === 'chrome' ? chromium.launch({ channel: 'chrome' }) : webkit.launch()); const context = await br.newContext(phone); const page = await context.newPage(); const errors = errorsOf(page);
  await page.goto(`${server.url}#build`, { waitUntil: 'commit' }); await stroke(page, 1); await wait(5500);
  await tap(page, a); await wait(delay); await tap(page, b);
  if (b !== 'build') await stroke(page, 2); else await wait(3000);
  await wait(5000); await tap(page, a); await stroke(page, b === 'build' ? 2 : 3); await wait(5500);
  const counts = full(server.log);
  const twice = counts.filter(([, n]) => n > 1).map(([p, n, s]) => `${p} x${n} (${Math.round(s / 1000)} kB)`);
  const shown = await page.evaluate(() => [document.querySelector('.hj-viewport .hj-plate').dataset.scene, [...document.querySelectorAll('.hj-viewport .hj-plate canvas')].filter((c) => c.width && c.closest('.hj-rachel, .hj-actor')).length]);
  console.log(JSON.stringify({ build, browser: name, a, b, delay, shown, wholeTwice: twice, wastedKB: Math.round(counts.reduce((s, [, n, size]) => s + (n - 1) * size, 0) / 1000), kB: Math.round(server.log.reduce((s, e) => s + e.bytes, 0) / 1000), errors: errors.slice(0, 3) }));
  await context.close(); await br.close(); await server.close();
}
process.exit(0);

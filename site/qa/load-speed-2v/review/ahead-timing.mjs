// Review 20b: when does the next room's download ahead start, against the scene's own files? Opening with Skip pressed early,
// and (control) without. node node_modules/.hj/review20b/ahead-timing.mjs <dist> [skip|noskip|hide] [chrome|webkit]
process.env.HJ_OUT ??= '../load-speed-2v/review/';
const { open, serve, LINES, stroke, wait, errorsOf } = await import('../../tools/load-speed.mjs');
const dist = process.argv[2]; const how = process.argv[3] ?? 'skip'; const browser = process.argv[4] ?? 'chrome';
const server = await serve(dist, { line: LINES.slow });
const context = await open(browser); const page = context.pages()[0] ?? await context.newPage(); const errors = errorsOf(page);
await page.goto(`${server.url}#build`, { waitUntil: 'commit' });
if (how === 'skip') { const skip = page.getByText('Skip', { exact: true }); await skip.waitFor({ state: 'visible', timeout: 60000 }); await wait(300); await skip.click({ force: true }); }
await stroke(page, 1).catch(() => {});
if (how === 'hide') {
  // Painting done, then the tab is hidden and shown again a moment later (as when the visitor glances at another app).
  await wait(9000);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await wait(300);
  await page.evaluate(() => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
}
await wait(40000);
const own = server.log.filter((e) => /scene1\/rachel/.test(e.path));
const lastOwn = Math.max(...own.map((e) => e.done || 0));
const warm = server.log.filter((e) => /scene2\/room\.webp/.test(e.path));
const marks = await page.evaluate(() => { try { return window.__hj?.marks ?? null; } catch { return null; } });
console.log(JSON.stringify({ how, browser, ownFiles: own.length, ownStillsDoneAt: lastOwn, ownStillsPending: own.filter((e) => !e.done).length, ownRequestsAfterWarmStarted: warm[0] ? own.filter((e) => e.at > warm[0].at).length : null, ownBytesAfterWarmStarted: warm[0] ? Math.round(own.filter((e) => (e.done || 1e9) > warm[0].at).reduce((s, e) => s + e.size, 0) / 1000) : null, warm: warm.map((e) => ({ at: e.at, done: e.done, priority: e.priority, dest: e.dest, kB: Math.round(e.bytes / 1000), dropped: e.dropped })), errors }, null, 1));
await context.close(); await server.close(); process.exit(0);

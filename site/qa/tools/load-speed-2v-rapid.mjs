// Job 020b (reviews/load-speed-part2-verify.md): tapaway's rapid case on both builds (HJ_OLD_DIST, HJ_DIST): seven tabs 250 ms apart, slow line.
import { builds, errorsOf, LINES, open, serve, stroke, tap, wait } from './load-speed.mjs';
const n = Number(process.env.N ?? 2);
for (const browser of (process.env.B ?? 'chrome,webkit').split(',')) for (let i = 0; i < n; i++) for (const build of ['before', 'now']) {
  const server = await serve(builds[build], { line: LINES.slow }); const context = await open(browser); const page = context.pages()[0] ?? await context.newPage(); const errors = errorsOf(page);
  await page.goto(`${server.url}#build`, { waitUntil: 'commit' }); await stroke(page, 1); await wait(5500);
  const from = server.log.length;
  for (const id of ['grow', 'design', 'film', 'set', 'grow', 'film', 'grow']) { await tap(page, id); await wait(250); }
  const t0 = performance.now(); await stroke(page, 2); const ms = Math.round(performance.now() - t0); await wait(3000);
  const whole = server.log.filter((e) => e.status === 200 && !e.dropped && e.bytes === e.size);
  const by = Object.groupBy(whole, (e) => e.path); const twice = Object.entries(by).filter(([, l]) => l.length > 1).map(([p, l]) => `${p.replace('/assets/', '')} x${l.length} (${l[0].size} B)`);
  const after = server.log.slice(from); const kB = Math.round(after.reduce((s, e) => s + e.bytes, 0) / 1000);
  const dropped = after.filter((e) => e.dropped).map((e) => `${e.path.replace('/assets/', '')} ${Math.round(100 * e.bytes / Math.max(1, e.size))}%`);
  console.log(JSON.stringify({ browser, build, strokeAfterLastTapMs: ms, kBAfterTaps: kB, requestsAfterTaps: after.length, twice, dropped: dropped.slice(0, 12), errors }));
  await context.close(); await server.close();
}
process.exit(0);

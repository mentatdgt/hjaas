// Job 011b: the opening on a slow line; Grow is tapped while Build is being painted and her other drawings are still on their way, then
// Build again (`back`), or Grow is waited for and then Build gone back to (`there`). Her routine must run in the end; nothing is downloaded twice.
//   HJ_DIST=dist node qa/tools/away-and-back.mjs
import { errorsOf, open, builds, LINES, serve, stroke, tap, wait, save } from './load-speed.mjs';
const report = {};
for (const browser of ['webkit', 'chrome']) for (const kind of ['back', 'there', 'skip']) {
  const server = await serve(builds.now, { line: LINES.slow }); const context = await open(browser); const page = context.pages()[0] ?? await context.newPage(); const errors = errorsOf(page);
  const art = (e) => /scene1\/rachel/.test(e.path) && /webp$/.test(e.path);
  await page.goto(`${server.url}#build`, { waitUntil: 'commit' }); await stroke(page, 1); await wait(300);
  const row = { drawingsAtTheTap: server.log.filter((e) => art(e) && e.done && !e.dropped).length };
  if (kind === 'skip') await page.getByText('Skip', { exact: true }).click();
  else {
    const at = server.now(); await tap(page, 'grow');
    if (kind === 'back') { await wait(700); row.askedWhileAway = server.log.filter((e) => art(e) && e.at > at + 100).length; row.calledOff = server.log.filter((e) => art(e) && e.dropped).length; await tap(page, 'build'); }
    else { await stroke(page, 2); row.askedWhileAway = server.log.filter((e) => art(e) && e.at > at + 100).length; row.calledOff = server.log.filter((e) => art(e) && e.dropped).length; await wait(6000); await tap(page, 'build'); }
  }
  const from = performance.now(); const seen = new Set(); let quietAfter = null;
  while (performance.now() - from < 25000) {
    const h = await page.evaluate(() => { const plate = document.querySelector('.hj-viewport .hj-plate'); const c = plate?.querySelector('.hj-rachel canvas'); if (!c?.width || plate.dataset.scene !== 'build') return 'none'; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let k = 0; for (let i = 0; i < d.length; i += 8) k = Math.imul(k ^ d[i], 16777619); return k; });
    if (h !== 'none' && !seen.has(h)) { seen.add(h); if (seen.size === 4) quietAfter = Math.round(performance.now() - from); }
    await wait(60);
  }
  row.picturesOfHerIn25s = seen.size; row.atWorkAfterMs = quietAfter;
  row.drawingsDownloadedInFullTwice = Object.values(Object.groupBy(server.log.filter((e) => art(e) && e.status === 200 && !e.dropped), (e) => e.path)).filter((l) => l.length > 1).length;
  row.errors = errors; report[`${browser}, ${kind}`] = row; console.log(`${browser}, ${kind}: ${JSON.stringify(row)}`); await save('away-and-back.json', report);
  await context.close(); await server.close();
}
process.exit(0);

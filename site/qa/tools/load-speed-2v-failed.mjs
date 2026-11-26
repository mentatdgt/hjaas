// Job 020b (reviews/load-speed-part2-verify.md): which room.webp requests fail and what the console says, per browser and opening scene. HJ_DIST, B=chrome,webkit, W=ms.
import { open, serve, stroke, wait, LINES } from './load-speed.mjs';
const dir = process.env.HJ_DIST ?? new URL('../../dist', import.meta.url).pathname;
for (const browser of (process.env.B ?? 'chrome,webkit').split(',')) for (const id of ['build', 'grow', 'design', 'film', 'set']) {
  const server = await serve(dir, { line: LINES.fast }); const context = await open(browser); const page = context.pages()[0] ?? await context.newPage();
  const msgs = []; const failed = []; const reqs = [];
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && msgs.push(`${m.type()}: ${m.text().slice(0, 140)}`));
  page.on('requestfailed', (r) => failed.push(`${r.url().replace(server.url, '')} ${r.failure()?.errorText}`));
  page.on('request', (r) => /room\.webp/.test(r.url()) && reqs.push(`${r.resourceType()} ${r.url().replace(server.url, '')}`));
  await page.goto(`${server.url}#${id}`, { waitUntil: 'commit' }); await stroke(page, 1); await wait(Number(process.env.W ?? 20000));
  const marks = await page.evaluate(() => performance.getEntriesByName('hj-paint').length);
  console.log(JSON.stringify({ browser, id, failed, msgs, reqs, serverRooms: server.log.filter((e) => /room\.webp/.test(e.path)).map((e) => `${e.path} ${e.status} ${e.bytes}/${e.size}${e.dropped ? ' dropped' : ''}`) }));
  await context.close(); await server.close();
}
process.exit(0);

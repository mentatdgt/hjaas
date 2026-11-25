// A static server for the production build that behaves like a slow line: every request waits one round trip, and all the
// answers under way share the line's bandwidth evenly. Headers as on Vercel (must-revalidate with an ETag; hashed files
// immutable). Everything it sends is logged: so the same throttling, and the same byte count, for Chrome and WebKit.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { brotliCompressSync } from 'node:zlib';
import { extname, join, normalize } from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' };
export const LINES = { fast: { mbps: 9, rtt: 60 }, slow: { mbps: 1.6, rtt: 150 }, none: { mbps: 1000, rtt: 0 } };

export async function serve(dir, { port = 0, line = LINES.none } = {}) {
  const cache = new Map(); const log = []; const active = new Set(); const started = performance.now();
  let speed = line; let fails = () => false; let holds = () => false;
  const file = async (path) => {
    if (!cache.has(path)) {
      let body = await readFile(join(dir, path)); const type = extname(path); let encoding = null;
      if (['.html', '.js', '.css', '.json', '.txt'].includes(type)) { body = brotliCompressSync(body); encoding = 'br'; }
      cache.set(path, { body, type: TYPES[type] ?? 'application/octet-stream', encoding, etag: `"${createHash('sha1').update(body).digest('hex').slice(0, 16)}"` });
    }
    return cache.get(path);
  };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://x'); let path = normalize(decodeURIComponent(url.pathname)); if (path.endsWith('/')) path += 'index.html';
    const entry = { at: Math.round(performance.now() - started), path, method: request.method, status: 0, bytes: 0, size: 0, done: 0, dropped: false, priority: request.headers.priority ?? null, dest: request.headers['sec-fetch-dest'] ?? null };
    log.push(entry);
    response.on('close', () => { if (!entry.done) { entry.dropped = true; entry.done = Math.round(performance.now() - started); } });
    await new Promise((resolve) => setTimeout(resolve, speed.rtt));
    while (holds(path) && !response.destroyed) await new Promise((resolve) => setTimeout(resolve, 20));
    if (fails(path)) { entry.status = 503; response.writeHead(503).end(); return; }
    let f; try { f = await file(path); } catch { entry.status = 404; entry.done = entry.at; response.writeHead(404).end(); return; }
    const headers = { 'Content-Type': f.type, ETag: f.etag, 'Cache-Control': /^\/assets\/[^/]+-[\w-]{8}\.\w+$/.test(path) ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate', ...(f.encoding ? { 'Content-Encoding': f.encoding } : {}) };
    if (request.headers['if-none-match'] === f.etag) { entry.status = 304; entry.done = Math.round(performance.now() - started); response.writeHead(304, headers).end(); return; }
    entry.status = 200; entry.size = f.body.length;
    response.writeHead(200, { ...headers, 'Content-Length': f.body.length });
    active.add({ response, body: f.body, at: 0, entry });
  });
  // The line: every few ms its bytes are dealt out, a packet at a time, to every answer in turn.
  let last = performance.now(); let credit = 0;
  const clock = setInterval(() => {
    const now = performance.now(); credit = Math.min(credit + ((now - last) * speed.mbps * 1000) / 8, Math.max(60000, speed.mbps * 4000)); last = now;
    while (credit > 0 && active.size) {
      for (const job of [...active]) {
        if (credit <= 0) break;
        if (job.response.destroyed) { active.delete(job); continue; }
        const n = Math.min(speed.mbps > 100 ? 65536 : 1400, job.body.length - job.at); credit -= n;
        job.response.write(job.body.subarray(job.at, job.at + n)); job.at += n; job.entry.bytes = job.at;
        if (job.at >= job.body.length) { job.entry.done = Math.round(performance.now() - started); job.response.end(); active.delete(job); }
        else { active.delete(job); active.add(job); } // (Last in the queue for the next packet.)
      }
    }
    if (!active.size) credit = Math.min(credit, 1400);
  }, 4);
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/`, log,
    now: () => Math.round(performance.now() - started),
    set line(next) { speed = next; }, set fails(next) { fails = next; }, set holds(next) { holds = next; },
    close: () => { clearInterval(clock); server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); },
  };
}

// node qa/tools/slow-server.mjs <dir> <port> [fast|slow|none]
if (process.argv[1] === new URL(import.meta.url).pathname) console.log((await serve(process.argv[2], { port: Number(process.argv[3]), line: LINES[process.argv[4] ?? 'none'] })).url);

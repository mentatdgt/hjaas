// Job 006, U6: Rachel's face and head are painted in one go. Needs `npm run dev` (HJ_URL) for `plan`; `record` reads the
// production build (HJ_PROD). Results: qa/review-fixes-02/ (HJ_OUT).
//   node qa/tools/face.mjs plan [scene]     the stroke plans alone, at 240 steps a second: how long her face, and her head with its hair, are partly painted
//   node qa/tools/face.mjs record [scene]   the first-visit painting in Chrome's screencast, desktop and phone: the same, on every recorded frame; strips of her face
// "Partly painted": between 5% and 95% of it. The boxes are plate px; the plan counts her own silhouette inside them.
import { chromium, webkit } from 'playwright';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const base = process.env.HJ_URL ?? 'http://localhost:5173/';
const prod = process.env.HJ_PROD ?? 'http://localhost:4173/';
const out = new URL(process.env.HJ_OUT ?? '../review-fixes-02/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const IDS = ['build', 'design'];
export const BOXES = { build: { face: [780, 500, 882, 612], head: [712, 412, 882, 640] }, design: { face: [850, 432, 940, 528], head: [813, 391, 1010, 578] } };
const ONLY = process.argv[3];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const r3 = (n) => Math.round(n * 1000) / 1000;
const label = (t, w) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="18"><text x="2" y="13" font-family="Helvetica" font-size="12" fill="#302e29">${t.replace(/</g, '&lt;')}</text></svg>`);
/** How long it is partly painted, from rows of [seconds, part], and the same for the frames themselves. */
const partly = (rows, key) => {
  const first = rows.find((r) => r[key] > 0.05); const done = rows.find((r) => r[key] >= 0.95);
  return { over5pcAt: r3(first.t), over95pcAt: r3(done.t), partlyMs: Math.round((done.t - first.t) * 1000) };
};
const run = {};
run.plan = async () => {
  const report = {}; const browser = await chromium.launch({ channel: 'chrome' });
  for (const id of ONLY ? [ONLY] : IDS) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${base}?debug&reset&intro=off&seed=7#${id}`); await page.waitForFunction(() => window.__hj?.ready === true);
    const r = await page.evaluate(async ({ boxes }) => {
      const { Painter } = await import('/src/engine/paint.ts'); const { scene } = window.__hj;
      const c = scene.character; const p = c.placement; const W = 1672; const H = 941;
      const her = document.createElement('canvas'); her.width = W; her.height = H; const hx = her.getContext('2d', { willReadFrequently: true }); hx.drawImage(c.canvas, p.left, p.top, p.width, p.height);
      const alpha = hx.getImageData(0, 0, W, H).data;
      const [L, T] = [boxes.head[0] - 10, boxes.head[1] - 10]; const w = boxes.head[2] - L + 10; const h = boxes.head[3] - T + 10;
      const kinds = {}; for (const [k, b] of Object.entries(boxes)) { const list = []; for (let y = b[1]; y < b[3]; y += 1) for (let x = b[0]; x < b[2]; x += 1) if (alpha[(y * W + x) * 4 + 3] > 102) list.push((y - T) * w + (x - L)); kinds[k] = list; }
      const painter = new Painter({ width: W / 2, height: H / 2, maxPixels: 1e9, fill: (g, a, b) => { g.fillStyle = '#fff'; g.fillRect(0, 0, a, b); }, strokes: scene.config.strokes });
      const dpr = painter.canvas.width / W; const t2 = document.createElement('canvas'); t2.width = w; t2.height = h; const g = t2.getContext('2d', { willReadFrequently: true });
      const rows = []; const who = {}; for (let f = 0; f / 240 <= painter.seconds; f++) { const t = f / 240; painter.paintTo(t); g.globalCompositeOperation = 'copy'; g.drawImage(painter.canvas, L * dpr, T * dpr, w * dpr, h * dpr, 0, 0, w, h); const d = g.getImageData(0, 0, w, h).data; const row = { t }; for (const [k, list] of Object.entries(kinds)) { let s = 0; for (const i of list) s += 1 - d[i * 4 + 3] / 255; row[k] = s / list.length; } rows.push(row); }
      void who; return { rows, seconds: painter.seconds };
    }, { boxes: BOXES[id] });
    report[id] = { seconds: r.seconds, face: partly(r.rows, 'face'), head: partly(r.rows, 'head'), headAtEnd: r3(r.rows.at(-1).head), steps: r.rows.filter((x, i) => i % 6 === 0 && x.head > 0.005 && x.head < 0.995).map((x) => `${x.t.toFixed(2)}: face ${Math.round(x.face * 100)} head ${Math.round(x.head * 100)}`).slice(0, 60) };
    console.log(id, JSON.stringify(report[id], null, 1));
    // The whole plate's coverage as the brush works, for looking at: the finished picture behind the sheet, every 0.2 s.
    const shots = await page.evaluate(async () => { const { Painter } = await import('/src/engine/paint.ts'); const s = window.__hj.scene; const room = s.plate.querySelector('img, canvas'); const c = s.character; const p = c.placement; const bg = document.createElement('canvas'); bg.width = 418; bg.height = 235; const b = bg.getContext('2d'); b.drawImage(room, 0, 0, 418, 235); b.drawImage(c.canvas, p.left / 4, p.top / 4, p.width / 4, p.height / 4); const painter = new Painter({ width: 418, height: 235, fill: (g, w, h) => { g.fillStyle = '#f6f3ec'; g.fillRect(0, 0, w, h); }, strokes: s.config.strokes }); const urls = []; for (let t = 0.1; t < painter.seconds; t += 0.1) { painter.paintTo(t); const o = document.createElement('canvas'); o.width = 418; o.height = 235; const g = o.getContext('2d'); g.drawImage(bg, 0, 0); g.drawImage(painter.canvas, 0, 0, 418, 235); urls.push(o.toDataURL('image/jpeg', 0.8)); } return urls; });
    const tiles = []; for (const [i, u] of shots.entries()) tiles.push({ input: Buffer.from(u.split(',')[1], 'base64'), left: (i % 6) * 422, top: Math.floor(i / 6) * 255 + 18 }, { input: label(`${((i + 1) / 10).toFixed(1)} s`, 100), left: (i % 6) * 422, top: Math.floor(i / 6) * 255 });
    await mkdir(new URL('../../node_modules/.hj/face/', import.meta.url).pathname, { recursive: true });
    await sharp({ create: { width: 6 * 422, height: Math.ceil(shots.length / 6) * 255, channels: 3, background: '#d9d6cf' } }).composite(tiles).jpeg({ quality: 80 }).toFile(new URL(`../../node_modules/.hj/face/plan-${id}.jpg`, import.meta.url).pathname);
    await page.close();
  }
  await browser.close();
  await writeFile(`${out}face-plan${process.env.HJ_TAG ?? ''}.json`, `${JSON.stringify(report, null, 1)}\n`);
};
const DEVICES = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
run.record = async () => {
  const WK = process.env.HJ_ENGINE === 'webkit';
  const name = `face-frames${WK ? '-webkit' : ''}${process.env.HJ_TAG ?? ''}.json`;
  const report = JSON.parse(await readFile(`${out}${name}`, 'utf8').catch(() => '{}'));
  for (const id of ONLY ? [ONLY] : IDS) for (const [device, options] of Object.entries(DEVICES)) {
    let best = null;
    for (let take = 0; take < (WK ? 1 : 4) && (best?.longest ?? 99) > 20; take++) {
      const dir = `${new URL('../../node_modules/.hj/face/', import.meta.url).pathname}${id}-${device}-${take}/`; await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
      const browser = await (WK ? webkit.launch() : chromium.launch({ channel: 'chrome' })); const context = await browser.newContext(options); const page = await context.newPage();
      const errors = []; page.on('console', (m) => m.type() === 'error' && errors.push(m.text())); page.on('pageerror', (e) => errors.push(e.message));
      const frames = []; const writes = []; let cdp; let on = true; let loop;
      await page.goto(`${prod}#${id}`, { waitUntil: 'commit' });
      if (WK) loop = (async () => { while (on) { const a = Date.now(); const file = `${dir}${frames.length}.png`; await page.screenshot({ path: file }).catch(() => {}); frames.push({ at: (a + Date.now()) / 2, file }); } })();
      else { cdp = await context.newCDPSession(page); cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => { const file = `${dir}${String(frames.length).padStart(5, '0')}.jpg`; frames.push({ at: metadata.timestamp * 1000, file }); writes.push(writeFile(file, Buffer.from(data, 'base64'))); void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {}); }); await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 1 }); }
      while ((await page.evaluate(() => performance.getEntriesByName('hj-paint').length)) === 0) await wait(100);
      // (Now: a little later the phone's window drifts sideways to show that it can be panned.)
      const lay = await page.evaluate((s) => { const r = document.querySelector(`.hj-plate[data-scene="${s}"]`).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, page: innerWidth, clock: performance.timeOrigin + performance.getEntriesByName('hj-paint').at(-1).startTime }; }, id);
      await wait(6500); on = false; if (WK) await loop; else { await cdp.send('Page.stopScreencast'); await Promise.all(writes); }
      await browser.close();
      const inPaint = frames.filter((f) => f.at > lay.clock && f.at < lay.clock + 3000);
      const longest = Math.max(...inPaint.slice(1).map((f, i) => f.at - inPaint[i].at));
      if (!best || longest < best.longest) best = { frames, lay, errors, longest, dir };
    }
    const { frames, lay, errors } = best; const scale = (await sharp(frames[0].file).metadata()).width / lay.page; const k = (lay.w / 1672) * scale;
    const boxOf = ([l, t, r, b]) => ({ left: Math.round(lay.x * scale + l * k), top: Math.round(lay.y * scale + t * k), width: Math.round((r - l) * k), height: Math.round((b - t) * k) });
    const at = (t) => frames.findLast((f) => f.at <= lay.clock + t) ?? frames[0];
    const row = { errors };
    const all = {};
    for (const kind of ['face', 'head']) {
      const crop = boxOf(BOXES[id][kind]); const px = (f) => sharp(f.file).extract(crop).removeAlpha().raw().toBuffer();
      const blank = await px(at(-30)); const done = await px(at(4640)); const rows = [];
      // A pixel is painted when it is nearer its finished colour than the blank paper's. (Those too like the paper to tell are left out.)
      for (const f of frames.filter((x) => x.at >= lay.clock - 60 && x.at <= lay.clock + 4600)) { const now = await px(f); let s = 0; let n = 0; for (let i = 0; i < now.length; i += 3) { const d = [0, 1, 2].map((c) => done[i + c] - blank[i + c]); const span = d[0] ** 2 + d[1] ** 2 + d[2] ** 2; if (span < 3600) continue; n++; s += Math.max(0, Math.min(1, [0, 1, 2].reduce((q, c) => q + (now[i + c] - blank[i + c]) * d[c], 0) / span)); } rows.push({ t: (f.at - lay.clock) / 1000, [kind]: s / n }); }
      const part = rows.filter((r) => r[kind] > 0.05 && r[kind] < 0.95);
      row[kind] = { ...partly(rows, kind), framesPartly: part.map((r) => `${Math.round(r.t * 1000)} ms: ${Math.round(r[kind] * 100)}%`).join(', ') }; all[kind] = rows;
    }
    row.longestGapBetweenRecordedFramesMs = Math.round(best.longest);
    // The strip: every recorded frame from just before to just after, of the head and a little around it.
    const b = BOXES[id].head; const crop = boxOf([b[0] - 60, b[1] - 50, b[2] + 60, b[3] + 50]);
    const from = Math.min(row.head.over5pcAt, row.face.over5pcAt) * 1000 - 120; const to = Math.max(row.head.over95pcAt, row.face.over95pcAt) * 1000 + 150;
    const shown = frames.filter((f) => f.at >= lay.clock + from && f.at <= lay.clock + to).slice(0, 60); const PER = 10; const z = device === 'phone' ? 1 : 1.2; const w = Math.round(crop.width * z); const h = Math.round(crop.height * z);
    const tiles = []; for (const [i, f] of shown.entries()) tiles.push({ input: await sharp(f.file).extract(crop).resize(w, h).png().toBuffer(), left: (i % PER) * (w + 4), top: Math.floor(i / PER) * (h + 20) + 18 }, { input: label(`${Math.round(f.at - lay.clock)} ms`, w), left: (i % PER) * (w + 4), top: Math.floor(i / PER) * (h + 20) });
    await sharp({ create: { width: PER * (w + 4), height: Math.ceil(shown.length / PER) * (h + 20), channels: 3, background: '#d9d6cf' } }).composite(tiles).jpeg({ quality: 84 }).toFile(`${out}face-${id}-${device}${WK ? '-webkit' : ''}${process.env.HJ_TAG ?? ''}.jpg`);
    report[`${id} ${device}`] = row; console.log(id, device, JSON.stringify(row));
    await writeFile(`${out}${name}`, `${JSON.stringify(report, null, 1)}\n`);
    for (let t = 0; t < 4; t++) await rm(`${new URL('../../node_modules/.hj/face/', import.meta.url).pathname}${id}-${device}-${t}/`, { recursive: true, force: true });
  }
};
await run[process.argv[2]]?.();

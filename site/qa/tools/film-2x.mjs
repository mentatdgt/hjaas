// Job 007: the Film presenter at double size (reviews/film-presenter-2x-build.md). Results: qa/film-2x/.
// `npm run dev` for this build (HJ_URL, default 5173) and the build before it (HJ_OLD_URL, default 5174; fc7884c).
//
//   node qa/tools/film-2x.mjs stills    him at 390×844 (3x) and 1440×900 (2x), before and after, 1:1, with the difference
//   node qa/tools/film-2x.mjs seam      every still on his real canvas: what changes where nothing should (Chrome, WebKit)
//   node qa/tools/film-2x.mjs record    his talking and both gestures at 60 fps on the phone profile; the camera screen
//   node qa/tools/film-2x.mjs steps     how far the arms move at each step of a gesture, on the delivered drawings
//   node qa/tools/film-2x.mjs trace     (HJ_PROD 4173, HJ_OLD_PROD 4174) Chrome, 4x slower: entering Film, and two gestures
import { chromium, webkit, devices } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import sharp from 'sharp';

const base = process.env.HJ_URL ?? 'http://127.0.0.1:5173/';
const old = process.env.HJ_OLD_URL ?? 'http://127.0.0.1:5174/';
const out = new URL('../film-2x/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const pkg = new URL('../../../frames/020-film-scene/site/', import.meta.url).pathname;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const say = (label, value) => console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
const save = (name, data) => writeFile(`${out}${name}`, `${JSON.stringify(data, null, 1)}\n`);
const errorsOf = (page) => { const errors = []; page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200))); page.on('pageerror', (e) => errors.push(e.message)); return errors; };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const DESK = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
const open = async (browser, url, options, query = '?debug&reset&intro=off&seed=7') => {
  const page = await (await browser.newContext(options)).newPage();
  const errors = errorsOf(page);
  await page.goto(`${url}${query}#film`);
  await page.waitForFunction(() => window.__hj?.ready === true && window.__hj.rachel?.has('R_K1_look') && window.__hj.scene.casts.some((c) => c.character.el.dataset.actor === 'presenter' && c.character.has('M_3_closed_blink')), null, { timeout: 60000 });
  await wait(2500);
  return { page, errors };
};
const still = (page, pose) => page.evaluate((p) => {
  const { scene } = window.__hj;
  scene.hold();
  document.querySelectorAll('.hj-mushrooms').forEach((el) => { el.style.visibility = 'hidden'; });
  for (const cast of scene.casts) { const who = cast.character.el.dataset.actor; cast.character.show(who === 'presenter' ? p : cast.character.rest); }
}, pose);
const presenterBox = (page) => page.locator('.hj-plate[data-scene="film"] [data-actor="presenter"]').boundingBox();
const label = (t, width) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="34"><text x="6" y="23" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="#302e29">${t}</text></svg>`);
const row = async (pictures, file, gap = 12) => {
  const sizes = await Promise.all(pictures.map(([, p]) => sharp(p).metadata()));
  const height = Math.max(...sizes.map((s) => s.height)) + 40;
  let x = gap; const parts = [];
  pictures.forEach(([name, input], i) => { parts.push({ input: label(name, sizes[i].width), left: x, top: 2 }, { input, left: x, top: 38 }); x += sizes[i].width + gap; });
  await sharp({ create: { width: x, height, channels: 3, background: '#e9e5dc' } }).composite(parts).png().toFile(`${out}${file}`);
};
const run = {};

run.stills = async () => {
  const report = {};
  for (const [name, engine, options] of [['390x844', chromium, PHONE], ['1440x900', chromium, DESK], ['webkit-390x844', webkit, { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } }], ['webkit-1440x900-1x', webkit, { ...DESK, deviceScaleFactor: 1 }], ['1440x900-1x', chromium, { ...DESK, deviceScaleFactor: 1 }], ['webkit-1440x900', webkit, DESK]].filter(([n]) => !process.argv[3] || process.argv[3].split(',').includes(n))) {
    const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {});
    const a = await open(browser, old, options); const b = await open(browser, base, options);
    for (const pose of ['M_1', 'M_2', 'M_3']) {
      await still(a.page, pose); await still(b.page, pose); await wait(300);
      const shots = [];
      const window = await b.page.locator('.hj-viewport').boundingBox();
      const box = await presenterBox(b.page);
      // Only what is inside the window; he may reach past it on a phone.
      const x = Math.max(window.x, box.x); const y = Math.max(window.y, box.y);
      const clip = { x, y, width: Math.min(box.x + box.width, window.x + window.width) - x, height: Math.min(box.y + box.height, window.y + window.height) - y };
      for (const { page } of [a, b]) shots.push(await page.screenshot({ clip }));
      const [p, q] = await Promise.all(shots.map((s) => sharp(s).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
      const { width, height } = q.info;
      // Dark outline, before and after: where it was and is, one over the other (red: only before; cyan: only now).
      const diff = Buffer.alloc(width * height * 3, 255);
      let before = 0; let now = 0; let grad = [0, 0];
      for (let i = 0; i < width * height; i++) {
        const l = (buf) => 0.3 * buf[i * 3] + 0.59 * buf[i * 3 + 1] + 0.11 * buf[i * 3 + 2];
        const la = l(p.data); const lb = l(q.data);
        before += la < 45; now += lb < 45;
        diff[i * 3] = lb; diff[i * 3 + 1] = la; diff[i * 3 + 2] = la;
        if (i % width < width - 1) for (const [k, buf] of [p.data, q.data].entries()) { const d = Math.abs((0.3 * buf[i * 3 + 3] + 0.59 * buf[i * 3 + 4] + 0.11 * buf[i * 3 + 5]) - l(buf)); if (d > 40) grad[k] += d * d; }
      }
      // The best shift of now against before, in device px: 0, 0 if he stands where he stood.
      let best = null;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { let s = 0; let n = 0; for (let yy = 6; yy < height - 6; yy += 2) for (let xx = 6; xx < width - 6; xx += 2) { const i = (yy * width + xx) * 3; const o = ((yy + dy) * width + xx + dx) * 3; s += Math.abs(q.data[i] - p.data[o]) + Math.abs(q.data[i + 1] - p.data[o + 1]) + Math.abs(q.data[i + 2] - p.data[o + 2]); n += 3; } if (!best || s / n < best.mean) best = { dx, dy, mean: r2(s / n) }; }
      const canvas = await Promise.all([a, b].map(({ page }) => page.evaluate(() => { const c = document.querySelector('.hj-plate[data-scene="film"] [data-actor="presenter"] canvas'); return [c.width, c.height]; })));
      report[`${name} ${pose}`] = { shownDevicePx: [width, height], canvasBefore: canvas[0], canvasNow: canvas[1], bestShiftPx: [best.dx, best.dy], meanDifference: best.mean, darkPxBefore: before, darkPxNow: now, edgeEnergyNowOverBefore: r2(grad[1] / grad[0]) };
      say(`${name} ${pose}`, report[`${name} ${pose}`]);
      await row([['before', shots[0]], ['after', shots[1]], ['both outlines: red only now, cyan only before', await sharp(diff, { raw: { width, height, channels: 3 } }).png().toBuffer()]], `${name}-${pose}.png`);
      if (pose === 'M_1') {
        const k = width / box.width; const cut = { left: Math.round(box.width * k * 0.2), top: 0, width: Math.round(box.width * k * 0.55), height: Math.round(box.height * k * 0.36) };
        await row([['before, 2x of 1:1', await sharp(shots[0]).extract(cut).resize(cut.width * 2, cut.height * 2, { kernel: 'nearest' }).png().toBuffer()], ['after', await sharp(shots[1]).extract(cut).resize(cut.width * 2, cut.height * 2, { kernel: 'nearest' }).png().toBuffer()]], `${name}-face.png`);
      }
    }
    report[`${name} errors`] = [...a.errors, ...b.errors];
    await browser.close();
  }
  const kept = JSON.parse(await readFile(`${out}stills.json`, 'utf8').catch(() => '{}'));
  await save('stills.json', { ...kept, ...report });
};

// Every still on his real canvas. Where the delivered drawing is the first still's (more than 3 of its px from any
// that differ), the canvas must be the first still's: what is not is a seam or a flicker. And inside, the canvas
// against the whole delivered still drawn onto one of that size, so that nothing is cut off.
run.seam = async () => {
  const frames = JSON.parse(await readFile(`${pkg}frames.json`, 'utf8'));
  const layer = frames.layers.find((l) => l.actor === 'presenter');
  const names = Object.keys(frames.stills).filter((n) => n.startsWith('M_'));
  const png = Object.fromEntries(await Promise.all(names.map(async (n) => [n, `data:image/png;base64,${(await readFile(`${pkg}${frames.stills[n]}`)).toString('base64')}`])));
  const report = {};
  const sizes = [['phone 390×844, 3x', PHONE], ['phone 360×740, 3x', { ...PHONE, viewport: { width: 360, height: 740 } }], ['phone 412×915, 2.625x', { ...PHONE, viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625 }], ['tablet 820×1180, 2x', { ...PHONE, viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2 }], ['desktop 1440×900, 1x', { ...DESK, deviceScaleFactor: 1 }], ['desktop 1440×900, 2x', DESK], ['desktop 2560×1440, 2x', { viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 2 }]];
  for (const [engineName, engine] of [['chrome', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {});
    for (const [size, options] of sizes) {
      const { page, errors } = await open(browser, base, options);
      await still(page, 'M_1');
      const rows = await page.evaluate(async ({ pics, first, w, h }) => {
        const cast = window.__hj.scene.casts.find((c) => c.character.el.dataset.actor === 'presenter').character;
        const canvas = cast.el.querySelector('canvas');
        const grab = (src, sw = canvas.width, sh = canvas.height) => { const c = document.createElement('canvas'); c.width = sw; c.height = sh; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, sw, sh); const d = g.getImageData(0, 0, sw, sh).data; for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] = (d[i + k] * d[i + 3]) / 255; return d; };
        const load = async (url) => { const img = new Image(); img.src = url; await img.decode(); return img; };
        const W = w; const H = h; const baseImg = await load(pics[first]);
        const baseFull = grab(baseImg, W, H);
        cast.show(first); const baseCanvas = grab(canvas);
        const result = [];
        for (const [name, url] of Object.entries(pics)) {
          const img = await load(url); const full = grab(img, W, H);
          // Differing px of the delivered drawings, in canvas px, grown.
          const cw = canvas.width; const ch = canvas.height; const moved = new Uint8Array(cw * ch); const reach = 3;
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (Math.max(Math.abs(full[i] - baseFull[i]), Math.abs(full[i + 1] - baseFull[i + 1]), Math.abs(full[i + 2] - baseFull[i + 2]), Math.abs(full[i + 3] - baseFull[i + 3])) < 1) continue; const x0 = Math.max(0, Math.floor(((x - reach) / W) * cw)); const x1 = Math.min(cw - 1, Math.floor(((x + reach + 1) / W) * cw)); const y0 = Math.max(0, Math.floor(((y - reach) / H) * ch)); const y1 = Math.min(ch - 1, Math.floor(((y + reach + 1) / H) * ch)); for (let yy = y0; yy <= y1; yy++) moved.fill(1, yy * cw + x0, yy * cw + x1 + 1); }
          cast.show(first); cast.show(name);
          const mine = grab(canvas); const whole = grab(img);
          let mean = 0; let n = 0; let max = 0; let over = 0; let wMean = 0; let wOver = 0; let at = null;
          for (let i = 0; i < cw * ch; i++) {
            const d = Math.max(...[0, 1, 2, 3].map((k) => Math.abs(mine[i * 4 + k] - baseCanvas[i * 4 + k])));
            if (!moved[i]) { if (mine[i * 4 + 3] || baseCanvas[i * 4 + 3]) { mean += d; n++; } if (d > max) { max = d; at = [i % cw, Math.floor(i / cw)]; } if (d > 16) over++; }
            else { const e = Math.max(...[0, 1, 2, 3].map((k) => Math.abs(mine[i * 4 + k] - whole[i * 4 + k]))); wMean += e; if (e > 48) wOver++; }
          }
          result.push({ still: name, unmovedMean: Math.round((mean / n) * 1000) / 1000, unmovedMax: max, unmovedOver16: over, at, movedPx: moved.reduce((a, b) => a + b, 0), movedMeanFromDelivered: Math.round((wMean / Math.max(1, moved.reduce((a, b) => a + b, 0))) * 100) / 100, movedOver48: wOver });
        }
        return { canvas: [canvas.width, canvas.height], result };
      }, { pics: png, first: 'M_1', w: layer.w * layer.scale, h: layer.h * layer.scale });
      report[`${engineName}, ${size}`] = { ...rows, errors };
      const worst = rows.result.reduce((a, b) => (b.unmovedMax > a.unmovedMax ? b : a));
      say(`${engineName}, ${size}`, { canvas: rows.canvas, worstUnmoved: `${worst.unmovedMax} (${worst.still} at ${worst.at})`, mean: Math.max(...rows.result.map((x) => x.unmovedMean)), over16: Math.max(...rows.result.map((x) => x.unmovedOver16)), movedMean: Math.max(...rows.result.map((x) => x.movedMeanFromDelivered)), movedOver48: Math.max(...rows.result.map((x) => x.movedOver48)), errors });
      await page.context().close();
    }
    await browser.close();
    await save('seam.json', report);
  }
};
//MORE
const command = process.argv[2];
if (!run[command]) { console.error(`Unknown command "${command}". One of: ${Object.keys(run).join(', ')}`); process.exit(1); }
await run[command]();

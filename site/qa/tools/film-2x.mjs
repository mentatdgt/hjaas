// Job 007: the Film presenter at double size (reviews/film-presenter-2x-build.md). Results: qa/film-2x/.
// `npm run dev` for this build (HJ_URL, default 5173) and the build before it (HJ_OLD_URL, default 5174; fc7884c).
//
//   node qa/tools/film-2x.mjs stills    him at 390×844 (3x) and 1440×900 (2x), before and after, 1:1, with the difference
//   node qa/tools/film-2x.mjs seam      every still on his real canvas: what changes where nothing should (Chrome, WebKit)
//   node qa/tools/film-2x.mjs record    his talking and both gestures at 60 fps on the phone profile; the camera screen
//   node qa/tools/film-2x.mjs memory    what Film holds on its own, before and now (the 30 orders: scene5.mjs memory)
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

// ---- Recordings: Chrome's own screencast, each frame with its time (as in counter.mjs). ---------------------------
const filmOf = async (page, dir) => {
  await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = []; const writes = [];
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = `${dir}${String(frames.length).padStart(5, '0')}.jpg`;
    frames.push({ at: metadata.timestamp * 1000, file }); writes.push(writeFile(file, Buffer.from(data, 'base64')));
    void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  return { frames, start: () => cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 1 }), stop: async () => { await cdp.send('Page.stopScreencast'); await Promise.all(writes); } };
};
const toMp4 = async (frames, mp4, filter = '') => {
  const list = `${mp4}.txt`;
  // (The screencast's first frame may be dated after its second.)
  frames = frames.filter((f, i) => !frames[i + 1] || frames[i + 1].at > f.at);
  await writeFile(list, `ffconcat version 1.0\n${frames.map((f, i) => `file '${f.file}'\nduration ${(((frames[i + 1]?.at ?? f.at + 16.7) - f.at) / 1000).toFixed(6)}`).join('\n')}\n`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `fps=60,${filter}scale=trunc(iw/2)*2:trunc(ih/2)*2`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-movflags', '+faststart', mp4]);
  await rm(list);
};
/** The part of his drawing that is solid and the same in every still, less a rim: 1 where nothing may ever change. */
const steadyMask = async () => {
  const frames = JSON.parse(await readFile(`${pkg}frames.json`, 'utf8'));
  const layer = frames.layers.find((l) => l.actor === 'presenter');
  const all = await Promise.all(Object.entries(frames.stills).filter(([n]) => n.startsWith('M_')).map(([, f]) => sharp(`${pkg}${f}`).ensureAlpha().raw().toBuffer()));
  const W = layer.w * layer.scale; const H = layer.h * layer.scale; const ok = new Uint8Array(W * H).fill(1);
  for (const d of all) for (let i = 0; i < W * H; i++) if (d[i * 4 + 3] < 255 || d.readUInt32LE(i * 4) !== all[0].readUInt32LE(i * 4)) ok[i] = 0;
  const mask = new Uint8Array(W * H); const r = 8;
  for (let y = r; y < H - r; y++) for (let x = r; x < W - r; x++) { let good = 1; for (let dy = -r; dy <= r && good; dy += 2) for (let dx = -r; dx <= r && good; dx += 2) good = ok[(y + dy) * W + x + dx]; mask[y * W + x] = good; }
  return { mask, W, H };
};
run.record = async () => {
  // (A screencast of an emulated phone is in CSS px. So the phone is also taken in a real window at 3x, upright and of
  // the phone's shape, as narrow as Chrome opens one (500 CSS px): there a recorded px is a screen px.)
  const report = {};
  const steady = await steadyMask();
  for (const [name, options] of [['phone', PHONE], ['phone-3x', { viewport: null }], ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }]]) {
    const real = options.viewport === null;
    const isPhone = name !== 'desktop';
    const browser = await chromium.launch({ channel: 'chrome', args: real ? ['--window-size=500,1169', '--force-device-scale-factor=3', '--hide-scrollbars'] : [] });
    const { page, errors } = await open(browser, base, options);
    await page.evaluate(() => {
      const scene = window.__hj.scene; const w = (window.__steps = []);
      for (const cast of scene.casts) { if (cast.character.el.dataset.actor !== 'presenter') continue; const c = cast.character; const show = c.show.bind(c); c.show = (p) => { if (p !== c.current) w.push([p, performance.timeOrigin + performance.now()]); show(p); }; }
      document.querySelectorAll('.hj-mushrooms').forEach((el) => el.classList.remove('is-debug'));
    });
    const dir = `${out}tmp/${name}/`;
    const film = await filmOf(page, dir);
    const box = await presenterBox(page);
    const rect = await page.evaluate(() => { const r = document.querySelector('canvas.hj-finder').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
    const win = await page.locator('.hj-viewport').boundingBox();
    await film.start();
    await wait(13000);
    // One find, so that the screen's other place (her look) is in the recording too. (Brought about from inside the page.)
    if (isPhone) await page.evaluate(() => { document.querySelector('.hj-plate [data-spot="sill"]').click(); });
    await wait(15000);
    await film.stop();
    const steps = await page.evaluate(() => window.__steps);
    const size = await sharp(film.frames[0].file).metadata();
    const k = size.width / (await page.evaluate(() => innerWidth));
    report[name] = { frames: film.frames.length, seconds: r1((film.frames.at(-1).at - film.frames[0].at) / 1000), framePx: [size.width, size.height], errors };
    // Frame by frame: nothing in the steady part of him may change.
    const L = Math.max(win.x, box.x); const R = Math.min(win.x + win.width, box.x + box.width); const T = Math.max(win.y, box.y); const B = Math.min(win.y + win.height, box.y + box.height);
    const cut = { left: Math.ceil(L * k), top: Math.ceil(T * k) }; cut.width = Math.floor(R * k) - cut.left; cut.height = Math.floor(B * k) - cut.top;
    const on = new Uint8Array(cut.width * cut.height); let n = 0;
    for (let y = 0; y < cut.height; y++) for (let x = 0; x < cut.width; x++) { const sx = Math.floor((((cut.left + x + 0.5) / k - box.x) / box.width) * steady.W); const sy = Math.floor((((cut.top + y + 0.5) / k - box.y) / box.height) * steady.H); if (sx >= 0 && sy >= 0 && sx < steady.W && sy < steady.H && steady.mask[sy * steady.W + sx] && (cut.left + x) / k > win.x + 40) { on[y * cut.width + x] = 1; n++; } }
    // (Not the two seconds of the find: its mushroom flies over him.)
    let prev = null; let worst = { mean: 0 }; let worstPx = 0; const changes = [];
    for (const f of film.frames) {
      const ms = f.at - film.frames[0].at;
      if (isPhone && ms > 12500 && ms < 15500) { prev = null; continue; }
      const d = await sharp(f.file).extract(cut).removeAlpha().raw().toBuffer();
      if (prev) { let sum = 0; let max = 0; for (let i = 0; i < on.length; i++) { if (!on[i]) continue; const e = Math.max(Math.abs(d[i * 3] - prev[i * 3]), Math.abs(d[i * 3 + 1] - prev[i * 3 + 1]), Math.abs(d[i * 3 + 2] - prev[i * 3 + 2])); sum += e; max = Math.max(max, e); } if (sum / n > worst.mean) worst = { mean: r2(sum / n), atMs: Math.round(f.at - film.frames[0].at) }; worstPx = Math.max(worstPx, max); changes.push(sum / n); }
      prev = d;
    }
    report[name].steadyPart = { px: n, worstFrameToFrameMean: worst, worstSinglePx: worstPx, meanOfAllFrames: r2(changes.reduce((a, b) => a + b, 0) / changes.length) };
    // His gestures, on the page's clock.
    const shown = steps.map(([pose, at], i) => ({ pose, at, ms: steps[i + 1] ? r1(steps[i + 1][1] - at) : null }));
    const BETWEEN = ['M_1_12', 'M_12', 'M_1_13', 'M_13'];
    report[name].inBetweens = shown.filter((s) => BETWEEN.includes(s.pose)).map((s) => `${s.pose} ${s.ms} ms`);
    report[name].poses = shown.length;
    say(name, report[name]);
    // Strips: every recorded frame through each gesture.
    const first = {};
    shown.forEach((s, i) => { if (BETWEEN.includes(s.pose) && BETWEEN.includes(shown[i + 1]?.pose)) first[`${s.pose}>${shown[i + 1].pose}`] ??= s.at; });
    for (const [move, at] of Object.entries(first)) {
      const list = film.frames.filter((f) => f.at >= at - 40 && f.at <= at + 190);
      const tiles = await Promise.all(list.map((f) => sharp(f.file).extract({ ...cut, height: Math.round(cut.height * 0.62) }).resize({ width: 220 }).png().toBuffer()));
      await row(tiles.map((t, i) => [`${Math.round(list[i].at - at)} ms`, t]), `${name}-gesture-${move.replace('>', '-to-')}.png`, 6);
    }
    await toMp4(film.frames, `${out}talking-${name}-60fps.mp4`);
    const grow = (r, by) => { const l = Math.max(0, Math.floor((r.x - by) * k)); const t = Math.max(0, Math.floor((r.y - by) * k)); return `crop=${Math.round((r.width + 2 * by) * k)}:${Math.round((r.height + 3.2 * by) * k)}:${l}:${t},scale=iw*5:ih*5:flags=neighbor,`; };
    await toMp4(film.frames, `${out}camera-screen-${name}-5x-60fps.mp4`, grow(rect, 14));
    await rm(dir, { recursive: true, force: true });
    await browser.close();
  }
  await save('record.json', report);
};

// How far the arms move at each step, on the delivered drawings: landmarks read off the stills by eye (px of the 2x
// drawings; a few px either way), in plate px.
run.steps = async () => {
  const at = JSON.parse(await readFile(`${out}landmarks.json`, 'utf8'));
  const report = {};
  for (const [gesture, { poses, marks }] of Object.entries(at.gestures)) {
    report[gesture] = {};
    for (const [mark, points] of Object.entries(marks)) report[gesture][mark] = Object.fromEntries(poses.slice(1).map((p, i) => [`${poses[i]} > ${p}`, Math.round(Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]) / 2)]));
  }
  say('steps, plate px', report);
  await save('steps.json', report);
};

// What Film holds, opened first and at rest, and the most it ever held in 60 s (three finds in it), before and now.
run.memory = async () => {
  const report = {};
  for (const [name, engine, options] of [['webkit, iPhone 14 profile', webkit, { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } }], ['chrome, phone 3x', chromium, PHONE], ['chrome, desktop 1x', chromium, { ...DESK, deviceScaleFactor: 1 }], ['chrome, desktop 2x', chromium, DESK]]) {
    const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {});
    report[name] = {};
    for (const [which, url] of [['before', old], ['now', base]]) {
      const context = await browser.newContext(options); const page = await context.newPage(); const errors = errorsOf(page);
      await page.goto(`${url}?debug&reset&seed=7#film`);
      await page.waitForFunction(() => window.__hj?.scene, null, { timeout: 60000 });
      await page.evaluate(() => { const w = (window.__most = {}); const tick = () => { const p = window.__hj.memory.parts; let film = 0; for (const [k, v] of Object.entries(p)) if (k.startsWith('film.')) { film += v; w[k] = Math.max(w[k] ?? 0, v); } w.filmTotal = Math.max(w.filmTotal ?? 0, film); w.page = Math.max(w.page ?? 0, window.__hj.memory.total ?? 0); requestAnimationFrame(tick); }; tick(); });
      await page.waitForFunction(() => window.__hj.ready === true, null, { timeout: 60000 });
      for (const spot of ['sill', 'forecourt', 'paving']) { await wait(5000); await page.evaluate((id) => document.querySelector(`.hj-plate [data-spot="${id}"]`).click(), spot); }
      await wait(15000);
      const mb = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v).map(([k, v]) => [k, Math.round(v / 1e4) / 100]));
      const rest = await page.evaluate(() => Object.fromEntries(Object.entries(window.__hj.memory.parts).filter(([k]) => k.startsWith('film.'))));
      report[name][which] = { atRestMB: mb(rest), atRestFilmMB: Math.round(Object.values(rest).reduce((x, y) => x + y, 0) / 1e4) / 100, mostMB: mb(await page.evaluate(() => window.__most)), errors };
      await context.close();
    }
    report[name].filmAddsAtRestMB = r2(report[name].now.atRestFilmMB - report[name].before.atRestFilmMB);
    report[name].filmAddsAtMostMB = r2(report[name].now.mostMB.filmTotal - report[name].before.mostMB.filmTotal);
    say(name, report[name]);
    await browser.close();
  }
  await save('memory.json', report);
};

// Chrome on the phone profile, 4x slower, production builds in turn. Entering Film from Build by its tab (its first
// painting), then 30 s of him at work (a whole round of his routine: both gestures, there and back).
run.trace = async () => {
  const builds = { now: process.env.HJ_PROD ?? 'http://127.0.0.1:4173/', before: process.env.HJ_OLD_PROD ?? 'http://127.0.0.1:4174/' };
  const report = { machine: execFileSync('uptime').toString().trim(), now: [], before: [] };
  for (let i = 0; i < Number(process.argv[3] ?? 4); i++) for (const which of i % 2 ? ['now', 'before'] : ['before', 'now']) {
    const browser = await chromium.launch({ channel: 'chrome', headless: !!process.env.HJ_HEADLESS });
    const page = await (await browser.newContext(PHONE)).newPage();
    const errors = errorsOf(page);
    await page.goto(`${builds[which]}#build`); await wait(9000);
    const tab = await page.locator('.hj-tab[data-scene="film"]').boundingBox();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await wait(1500);
    await browser.startTracing(page, { categories: ['-*', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink.user_timing', 'toplevel', 'loading', 'devtools.timeline.frame'] });
    const point = [{ x: tab.x + tab.width / 2, y: tab.y + tab.height / 2 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(38000);
    const raw = await browser.stopTracing();
    await browser.close();
    const { traceEvents: ev } = JSON.parse(raw.toString());
    const tap = ev.find((e) => e.name === 'EventDispatch' && e.args?.data?.type === 'touchstart') ?? ev.find((e) => e.name === 'EventDispatch' && e.args?.data?.type === 'click');
    const t = (e) => (e.ts - tap.ts) / 1000;
    const drops = ev.filter((e) => e.name === 'DroppedFrame' && e.pid === tap.pid).map(t);
    const tasks = ev.filter((e) => e.name === 'RunTask' && e.ph === 'X' && e.pid === tap.pid && e.tid === tap.tid);
    const part = (from, to) => { const inside = tasks.filter((e) => t(e) >= from && t(e) < to); return { longestTaskMs: r1(Math.max(0, ...inside.map((e) => e.dur)) / 1000), tasksOver50: inside.filter((e) => e.dur > 50000).length, busyMsPerSecond: r1(inside.reduce((a, e) => a + e.dur, 0) / 1000 / ((to - from) / 1000)), dropped: drops.filter((d) => d >= from && d < to).length, framesBegun: ev.filter((e) => e.name === 'BeginFrame' && e.pid === tap.pid && t(e) >= from && t(e) < to).length }; };
    // (Entering: from the tap to the first stroke, on blank paper; and the painting and what follows it.)
    const paint = ev.find((e) => e.name === 'hj-paint' && String(e.cat).includes('user_timing') && e.ts > tap.ts);
    const clock = t(paint);
    report[which].push({ firstStrokeAtMs: Math.round(clock), onBlankPaper: part(0, clock), painting: part(clock, clock + 4750), justAfter: part(clock + 4750, 8000), droppedAtMsFromFirstStroke: drops.filter((d) => d >= 0 && d < 8000).map((d) => Math.round(d - clock)), atWork8to38s: part(8000, 38000), errors });
    say(`${which} ${i + 1}`, report[which].at(-1));
    if (i === 0) { await writeFile(`${out}trace-film-phone-4x-${which}.json`, raw); execFileSync('gzip', ['-f', `${out}trace-film-phone-4x-${which}.json`]); }
    await save('trace.json', report);
  }
};
const command = process.argv[2];
if (!run[command]) { console.error(`Unknown command "${command}". One of: ${Object.keys(run).join(', ')}`); process.exit(1); }
await run[command]();

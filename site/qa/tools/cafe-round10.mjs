// Job 023b: café round 10 (reviews/cafe-round10-build.md). Results go to qa/cafe-round10/.
// Needs `npm run dev` (HJ_URL, default 5173), ffmpeg, and /usr/bin/python3 with numpy and Pillow (for the preview).
//
//   node qa/tools/cafe-round10.mjs film [chrome|webkit] [desktop|phone]
//       A new visitor opens the café: its painting, then 30 s of the café at work, recorded. Every frame, each actor's
//       pose is logged; on each pose the brief names (the old man's turn, the barista's circle, the mum's sip, both cat
//       flicks) the layer's own canvas is read. Each reading is matched to the package's stills (it must be nearest
//       its own), and the poses' order checked; Rachel's blinks against the mum's sips too.
//   node qa/tools/cafe-round10.mjs preview
//       The package's preview (tools/cafe_preview10.py, 30 s, seed 4) and its timeline; then, for each engine and device
//       filmed, a sheet: the page's layer on the plate beside the preview's frame of the same pose.
import { chromium, webkit, devices } from 'playwright';
import { mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const base = process.env.HJ_URL ?? 'http://localhost:5173/';
const out = new URL(process.env.HJ_OUT ?? '../cafe-round10/', import.meta.url).pathname;
const repo = new URL('../../../', import.meta.url).pathname;
const pkg = `${repo}frames/018-cafe-scene/site/`;
await mkdir(out, { recursive: true });
const [cmd = 'film', engineName = 'chrome', deviceName = 'desktop'] = process.argv.slice(2);
const engine = engineName === 'webkit' ? webkit : chromium;
const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  phone: { ...devices['iPhone 13'] },
};
if (engine === chromium) delete DEVICES.phone.defaultBrowserType;
const tag = `${engineName}-${deviceName}`;
const say = (label, value) => console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
const save = (name, data) => writeFile(`${out}${name}`, `${JSON.stringify(data, null, 1)}\n`);
const manifest = JSON.parse(await readFile(`${pkg}frames.json`, 'utf8'));
const LAYER = Object.fromEntries(manifest.layers.map((l) => [l.actor, l]));
/** The poses the brief asks to see, by actor. */
const WANTED = {
  oldman: ['O_1', 'T1', 'T2', 'R0', 'R1', 'R2', 'O_blink'],
  barista: ['B_1', 'B_P1', 'B_2_polish', 'B_P2', 'B_3_polish', 'B_P3', 'B_4_glance'],
  mum: ['M_S1', 'M_S2', 'M_blink_closed'],
  // (Not cat_1 and cat_2: each begins a 1 s dissolve, so read on its first frame it is still mostly the pose before.)
  cat: ['cat_F1', 'cat_F2'],
};

const run = {};

run.film = async () => {
  const dir = `${out}video-${tag}/`;
  await rm(dir, { recursive: true, force: true });
  const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {});
  const device = DEVICES[deviceName];
  const context = await browser.newContext({ ...device, recordVideo: { dir, size: device.viewport } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  const started = Date.now();
  // (Each engine and device its own seed, so that the four films are four different schedules: HJ_SEED to choose.)
  const seed = process.env.HJ_SEED ?? { 'chrome-desktop': 7, 'webkit-desktop': 3, 'chrome-phone': 5, 'webkit-phone': 9 }[tag] ?? 7;
  await page.goto(`${base}?debug&reset&seed=${seed}#design`);
  await page.waitForFunction(() => window.__hj?.ready === true && window.__hj.scene?.config.id === 'design' && window.__hj.busy === false, null, { timeout: 90000 });
  const paintedAt = (Date.now() - started) / 1000;
  // Every frame: each actor's pose; the first few times each wanted pose is on, its canvas, read as it is shown.
  await page.evaluate((wanted) => {
    const scene = window.__hj.scene;
    const log = [];
    const shots = [];
    const seen = new Map();
    const last = new Map();
    const t0 = performance.now();
    window.__cafe = { log, shots, t0 };
    const frame = (now) => {
      for (const cast of scene.casts) {
        const name = cast.character.el.dataset.actor ?? 'rachel';
        const pose = cast.character.current;
        if (last.get(name) === pose) continue;
        last.set(name, pose);
        log.push([Math.round(now - t0), name, pose]);
        const n = seen.get(`${name}/${pose}`) ?? 0;
        if (!wanted[name]?.includes(pose) || n >= 2) continue;
        seen.set(`${name}/${pose}`, n + 1);
        const canvas = cast.character.el.querySelector('canvas');
        const copy = document.createElement('canvas');
        copy.width = canvas.width;
        copy.height = canvas.height;
        copy.getContext('2d').drawImage(canvas, 0, 0);
        shots.push({ name, pose, at: Math.round(now - t0), n, w: canvas.width, h: canvas.height, data: copy.toDataURL('image/png') });
      }
      if (performance.now() - t0 < 31000) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, WANTED);
  const loggedAt = (Date.now() - started) / 1000;
  await page.waitForTimeout(31500);
  const { log, shots } = await page.evaluate(() => window.__cafe);
  await context.close();
  await browser.close();
  // The recording: from the end of the painting, 30 s.
  const [webm] = (await readdir(dir)).filter((f) => f.endsWith('.webm'));
  const mp4 = `${out}cafe-${tag}-30s.mp4`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, loggedAt - 0.2)), '-i', `${dir}${webm}`, '-t', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-movflags', '+faststart', mp4]);
  const painting = `${out}cafe-${tag}-painting.mp4`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${dir}${webm}`, '-t', String(loggedAt + 0.5), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', painting]);
  await rm(dir, { recursive: true, force: true });

  // Each canvas reading against the package's stills of its actor: it must be nearest its own.
  const still = new Map();
  const load = async (actor, name, w, h) => {
    const key = `${actor}/${name}/${w}x${h}`;
    if (!still.has(key)) still.set(key, await sharp(`${pkg}${manifest.stills[name]}`).resize(w, h, { fit: 'fill' }).ensureAlpha().raw().toBuffer());
    return still.get(key);
  };
  const W = 160;
  const readings = [];
  for (const shot of shots) {
    const layer = LAYER[shot.name];
    const h = Math.round((W * layer.h) / layer.w);
    const png = Buffer.from(shot.data.split(',')[1], 'base64');
    await writeFile(`${out}canvas-${tag}-${shot.name}-${shot.pose}-${shot.n}.png`, png);
    const mine = await sharp(png).resize(W, h, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
    const scores = {};
    for (const name of layer.stills) {
      const theirs = await load(shot.name, name, W, h);
      let sum = 0;
      for (let i = 0; i < mine.length; i++) sum += Math.abs(mine[i] - theirs[i]);
      scores[name] = Math.round((sum / mine.length) * 100) / 100;
    }
    const nearest = Object.entries(scores).sort((a, b) => a[1] - b[1])[0][0];
    readings.push({ actor: shot.name, pose: shot.pose, at: shot.at, nearest, ok: nearest === shot.pose, diff: scores[shot.pose], next: Object.entries(scores).filter(([n]) => n !== shot.pose).sort((a, b) => a[1] - b[1])[0] });
  }

  // The order of the poses, actor by actor.
  const posesOf = (actor) => log.filter(([, name]) => name === actor).map(([at, , pose]) => ({ at, pose }));
  const order = {};
  const turn = posesOf('oldman');
  order.oldman = { turns: 0, wrong: [] };
  turn.forEach((p, i) => {
    if (p.pose !== 'T1' || i + 5 >= turn.length) return;
    order.oldman.turns++;
    const seq = turn.slice(i, i + 6).map((q) => q.pose).join(' ');
    if (seq !== 'T1 T2 R0 R1 R2 O_1') order.oldman.wrong.push(seq);
  });
  order.oldman.turnMs = turn.flatMap((p, i) => (p.pose === 'T1' && i + 5 < turn.length ? [turn.slice(i, i + 6).map((q, j, a) => (j ? q.at - a[j - 1].at : 0)).slice(1)] : []));
  const circle = ['B_1', 'B_P1', 'B_2_polish', 'B_P2', 'B_3_polish', 'B_P3'];
  const bar = posesOf('barista');
  order.barista = { steps: 0, wrong: [] };
  bar.forEach((p, i) => {
    const at = circle.indexOf(p.pose);
    if (at <= 0 || i === 0) return;
    order.barista.steps++;
    if (bar[i - 1].pose !== circle[at - 1]) order.barista.wrong.push(`${bar[i - 1].pose} > ${p.pose}`);
  });
  order.barista.glances = bar.filter((p) => p.pose === 'B_4_glance').length;
  const mum = posesOf('mum');
  order.mum = { sips: 0, wrong: [], sipMs: [] };
  mum.forEach((p, i) => {
    if (p.pose !== 'M_S1' || mum[i - 1]?.pose === 'M_S2') return;
    if (i + 3 >= mum.length) return;
    order.mum.sips++;
    const seq = mum.slice(i, i + 4).map((q) => q.pose).join(' ');
    if (seq !== 'M_S1 M_S2 M_S1 ') order.mum.wrong.push(seq);
    order.mum.sipMs.push(mum.slice(i, i + 4).map((q, j, a) => (j ? q.at - a[j - 1].at : 0)).slice(1));
  });
  const cat = posesOf('cat');
  order.cat = { flicks: 0, wrong: [], flickAt: [] };
  cat.forEach((p, i) => {
    if (p.pose !== 'cat_F2') return;
    order.cat.flicks++;
    order.cat.flickAt.push(cat[i - 1]?.at);
    const seq = cat.slice(i - 1, i + 3).map((q) => q.pose).join(' ');
    if (seq !== 'cat_F1 cat_F2 cat_F1 cat_1') order.cat.wrong.push(seq);
  });
  // Rachel's blinks against the mum's sips (the engine's rule, on the page).
  const rachel = posesOf('rachel');
  const runs = (list, poses) => {
    const r = [];
    list.forEach((p, i) => {
      const end = list[i + 1]?.at ?? Infinity;
      if (!poses.includes(p.pose)) return;
      if (r.length && r[r.length - 1][1] === p.at) r[r.length - 1][1] = end;
      else r.push([p.at, end]);
    });
    return r;
  };
  const sips = runs(mum, ['M_S1', 'M_S2']);
  const blinks = runs(rachel, ['R_A1_blink']);
  const rule = { blinks: blinks.length, sips: sips.length, clashes: blinks.filter(([a, b]) => sips.some(([s, e]) => a < e + 1000 && b > s - 1000)).map(([a]) => a) };

  const result = { tag, seed, paintedAt, readings, matched: `${readings.filter((r) => r.ok).length} of ${readings.length}`, order, rule, errors, log };
  await save(`film-${tag}.json`, result);
  say(`${tag} canvases nearest their own still`, result.matched);
  for (const r of readings.filter((x) => !x.ok)) say('  not nearest', r);
  say(`${tag} order`, { oldman: [order.oldman.turns, order.oldman.wrong], barista: [order.barista.steps, order.barista.wrong, order.barista.glances], mum: [order.mum.sips, order.mum.wrong, order.mum.sipMs], cat: [order.cat.flicks, order.cat.wrong] });
  say(`${tag} Rachel's blinks against the mum's sips`, rule);
  say(`${tag} errors`, errors);
  say(`${tag} files`, [mp4, painting]);
};

run.preview = async () => {
  // The preview and its timeline (the preview's own code, stopped before it encodes).
  const mp4 = `${out}preview-seed4-30s.mp4`;
  execFileSync('/usr/bin/python3', [`${repo}tools/cafe_preview10.py`, pkg, mp4, '30', '1280', '30', '4'], { stdio: 'inherit' });
  const script = `
import sys, json
sys.argv = ['x', ${JSON.stringify(pkg)}, '/tmp/cafe-preview-stub.mp4', '30', '1280', '30', '4']
src = open(${JSON.stringify(`${repo}tools/cafe_preview10.py`)}).read()
exec(src[:src.index('ff = subprocess.Popen')])
print(json.dumps({a: [[t, p, ms] for (t, p, ms, f) in TL[a]] for a in TL}))`;
  const timeline = JSON.parse(execFileSync('/usr/bin/python3', ['-c', script]).toString());
  await save('preview-timeline.json', timeline);
  const plate = `${pkg}plate.png`;
  const meta = await sharp(plate).metadata();
  const k = 1280 / meta.width;
  const sheets = [];
  for (const file of (await readdir(out)).filter((f) => /^film-.*\.json$/.test(f))) {
    const film = JSON.parse(await readFile(`${out}${file}`, 'utf8'));
    const tiles = [];
    for (const [actor, poses] of Object.entries(WANTED)) {
      const layer = LAYER[actor];
      for (const pose of poses) {
        const shot = `${out}canvas-${film.tag}-${actor}-${pose}-0.png`;
        const entry = timeline[actor].find(([, p]) => p === pose);
        let page = null;
        try {
          const crop = await sharp(plate).extract({ left: layer.x, top: layer.y, width: layer.w, height: layer.h }).toBuffer();
          const layerPng = await sharp(shot).resize(layer.w, layer.h, { fit: 'fill' }).toBuffer();
          page = await sharp(await sharp(crop).composite([{ input: layerPng }]).png().toBuffer()).resize({ height: 200 }).png().toBuffer();
        } catch {}
        let prev = null;
        if (entry) {
          const at = (entry[0] + entry[2] / 2) / 1000;
          const frame = `${out}tmp-preview.png`;
          execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(at), '-i', mp4, '-frames:v', '1', frame]);
          const fm = await sharp(frame).metadata();
          const s = fm.width / meta.width;
          prev = await sharp(frame).extract({ left: Math.round(layer.x * s), top: Math.round(layer.y * s), width: Math.min(fm.width - Math.round(layer.x * s), Math.round(layer.w * s)), height: Math.min(fm.height - Math.round(layer.y * s), Math.round(layer.h * s)) }).resize({ height: 200 }).png().toBuffer();
          await rm(frame, { force: true });
        }
        tiles.push({ label: `${actor} ${pose}`, page, prev });
      }
    }
    // A sheet: one row per pose, the page's layer (left) and the preview's frame (right).
    const rows = [];
    for (const t of tiles) {
      const parts = [t.page, t.prev].map((b) => b ?? sharp({ create: { width: 200, height: 200, channels: 3, background: '#ddd' } }).png().toBuffer());
      const [a, b] = await Promise.all(parts);
      const [ma, mb] = await Promise.all([sharp(a).metadata(), sharp(b).metadata()]);
      const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="190" height="200"><text x="6" y="100" font-family="Helvetica" font-size="17" fill="#222">${t.label}</text></svg>`);
      rows.push({ width: 190 + ma.width + mb.width + 30, height: 200, parts: [{ input: label, left: 0, top: 0 }, { input: a, left: 200, top: 0 }, { input: b, left: 210 + ma.width + 10, top: 0 }] });
    }
    const width = Math.max(...rows.map((r) => r.width));
    const composite = rows.flatMap((r, i) => r.parts.map((p) => ({ ...p, top: p.top + i * 210 + 40 })));
    const title = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="36"><text x="6" y="26" font-family="Helvetica" font-size="20" fill="#222">${film.tag}: the page's layer on the plate (left) and the package's preview, same pose (right)</text></svg>`);
    const name = `sheet-${film.tag}.jpg`;
    await sharp({ create: { width, height: rows.length * 210 + 40, channels: 3, background: '#f4f1ea' } }).composite([{ input: title, left: 0, top: 0 }, ...composite]).jpeg({ quality: 85 }).toFile(`${out}${name}`);
    sheets.push(name);
  }
  // The preview's order, as the page's is checked.
  const seq = (actor) => timeline[actor].map(([, p]) => p ?? '');
  const om = seq('oldman');
  const turns = om.flatMap((p, i) => (p === 'T1' ? [om.slice(i, i + 6).join(' ')] : []));
  say('preview: old man turns', turns);
  const ca = seq('cat');
  say('preview: cat flicks', ca.flatMap((p, i) => (p === 'cat_F2' ? [ca.slice(i - 1, i + 3).join(' ')] : [])));
  const mu = seq('mum');
  say('preview: mum sips', mu.flatMap((p, i) => (p === 'M_S2' ? [mu.slice(i - 1, i + 2).join(' ')] : [])));
  say('sheets', sheets);
};

// The phone profile in Chrome with its processor slowed 4x: 20 s of the café at work, traced (Chrome's own
// trace, summarised by analyze-trace.mjs), and every frame's time read on the page with the poses changed in it.
// A late frame is put down to the new loops only if one of their poses changed in it.
run.trace = async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext({ ...DEVICES.phone });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await page.goto(`${base}?debug&reset&seed=7#design`);
  await page.waitForFunction(() => window.__hj?.ready === true && window.__hj.scene?.config.id === 'design' && window.__hj.busy === false, null, { timeout: 120000 });
  await page.waitForTimeout(3000);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const file = `${out}trace-chrome-phone-4x.json`;
  await browser.startTracing(page, { path: file, screenshots: false });
  const frames = await page.evaluate(() => new Promise((resolve) => {
    performance.mark('hj-cafe-work');
    const scene = window.__hj.scene;
    const last = new Map();
    const list = [];
    let prev = 0;
    const t0 = performance.now();
    const frame = (now) => {
      const changed = [];
      for (const cast of scene.casts) {
        const name = cast.character.el.dataset.actor ?? 'rachel';
        const pose = cast.character.current;
        if (last.has(name) && last.get(name) !== pose) changed.push(`${name}:${pose}`);
        last.set(name, pose);
      }
      if (prev) list.push([Math.round((now - t0) * 10) / 10, Math.round((now - prev) * 10) / 10, changed]);
      prev = now;
      if (now - t0 < 20000) requestAnimationFrame(frame);
      else resolve(list);
    };
    requestAnimationFrame(frame);
  }));
  await browser.stopTracing();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await context.close();
  await browser.close();
  execFileSync('gzip', ['-f', file]);
  const summary = execFileSync('node', [new URL('./analyze-trace.mjs', import.meta.url).pathname, `${file}.gz`, '--mark', 'hj-cafe-work', '--span', '20000', '--tasks']).toString();
  const NEW = ['oldman', 'barista', 'mum', 'cat'];
  const intervals = frames.map(([, ms]) => ms).sort((a, b) => a - b);
  const typical = intervals[Math.floor(intervals.length / 2)];
  const late = frames.filter(([, ms]) => ms > typical * 1.5);
  const lateNew = late.filter(([, , changed]) => changed.some((c) => NEW.includes(c.split(':')[0])));
  const newChanges = frames.filter(([, , changed]) => changed.some((c) => NEW.includes(c.split(':')[0]))).length;
  const result = { frames: frames.length, typicalMs: typical, late: late.length, lateWithANewLoopsPose: lateNew, framesWithANewLoopsPose: newChanges, slowest: [...frames].sort((a, b) => b[1] - a[1]).slice(0, 5), trace: summary.trim().split('\n') };
  await save('trace-chrome-phone-4x-frames.json', result);
  say('frames', { frames: frames.length, typical, late: late.length, lateWithANewLoopsPose: lateNew.length, framesWithANewLoopsPose: newChanges });
  console.log(summary);
};

await run[cmd]();

// Job 024 (reviews/cafe-cat-fix-01.md): the café cat rests on cat_1, and its fades finish. Results go to qa/cafe-cat-fix/.
// Needs `npm run dev` (HJ_URL, default 5173) and ffmpeg.
//
//   node qa/tools/cafe-cat.mjs rest [webkit|chrome]
//       The cat's resting pose in the three places it shows: during the café's painting, paused, and with reduced
//       motion. Each: the pose the page says, the cat's canvas matched to the package's stills, and a screenshot.
//   node qa/tools/cafe-cat.mjs film [webkit|chrome]
//       A new visitor opens the café; 30 s of it at work, recorded (desktop). Every frame: the cat's pose, and where
//       its canvas sits between cat_1 (0) and cat_2 (1). Every dissolve must be finished by the frame before the next
//       step; the poses must come in the routine's order. Frame sheets from the recording around both flicks and two breaths.
import { chromium, webkit } from 'playwright';
import { mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const base = process.env.HJ_URL ?? 'http://localhost:5173/';
const out = new URL('../cafe-cat-fix/', import.meta.url).pathname;
const repo = new URL('../../../', import.meta.url).pathname;
const pkg = `${repo}frames/018-cafe-scene/site/`;
await mkdir(out, { recursive: true });
const [cmd = 'rest', engineName = 'webkit'] = process.argv.slice(2);
const engine = engineName === 'webkit' ? webkit : chromium;
const launch = () => engine.launch(engine === chromium ? { channel: 'chrome' } : {});
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
const say = (label, value) => console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
const save = (name, data) => writeFile(`${out}${name}`, `${JSON.stringify(data, null, 1)}\n`);
const manifest = JSON.parse(await readFile(`${pkg}frames.json`, 'utf8'));
const CAT = manifest.layers.find((l) => l.actor === 'cat');
const W = 123;
const H = Math.round((W * CAT.h) / CAT.w);

/** The cat's canvas, as PNG, and which of the package's stills it is nearest (mean absolute difference, RGBA). */
const stills = new Map();
async function match(png) {
  const mine = await sharp(png).resize(W, H, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  const scores = {};
  for (const name of CAT.stills) {
    if (!stills.has(name)) stills.set(name, await sharp(`${pkg}${manifest.stills[name]}`).resize(W, H, { fit: 'fill' }).ensureAlpha().raw().toBuffer());
    const theirs = stills.get(name);
    let sum = 0;
    for (let i = 0; i < mine.length; i++) sum += Math.abs(mine[i] - theirs[i]);
    scores[name] = Math.round((sum / mine.length) * 100) / 100;
  }
  return { nearest: Object.entries(scores).sort((a, b) => a[1] - b[1])[0][0], scores };
}

const catState = (page) =>
  page.evaluate(() => {
    const cast = window.__hj.scene.casts.find((c) => c.character.el.dataset.actor === 'cat');
    const canvas = cast.character.el.querySelector('canvas');
    const r = cast.character.el.getBoundingClientRect();
    return { pose: cast.character.current, data: canvas.toDataURL('image/png'), rect: { x: r.x, y: r.y, w: r.width, h: r.height }, busy: window.__hj.busy };
  });

async function shoot(page, name) {
  const s = await catState(page);
  const png = Buffer.from(s.data.split(',')[1], 'base64');
  await writeFile(`${out}rest-${name}-canvas.png`, png);
  const m = await match(png);
  // The page around the cat, and the whole window.
  const pad = 120;
  await page.screenshot({ path: `${out}rest-${name}-cat.png`, clip: { x: Math.max(0, s.rect.x - pad), y: Math.max(0, s.rect.y - pad), width: s.rect.w + 2 * pad, height: s.rect.h + 2 * pad } });
  await page.screenshot({ path: `${out}rest-${name}-page.png` });
  return { state: name, pose: s.pose, busy: s.busy, nearest: m.nearest, scores: m.scores, ok: s.pose === 'cat_1' && m.nearest === 'cat_1' };
}

const run = {};

run.rest = async () => {
  const browser = await launch();
  const results = [];
  // 1. The painting (a new visitor): the cat as soon as its layer is on, part way through, and when the painting ends.
  {
    const context = await browser.newContext(DESKTOP);
    const page = await context.newPage();
    await page.goto(`${base}?debug&reset&seed=3#design`);
    await page.waitForFunction(() => window.__hj?.scene?.config.id === 'design' && window.__hj.scene.casts?.some((c) => c.character.el.dataset.actor === 'cat') && window.__hj.busy === true, null, { timeout: 90000 });
    const poses = new Set();
    // The pose all through the painting, every frame.
    await page.evaluate(() => {
      window.__catPoses = [];
      const loop = () => {
        const cast = window.__hj.scene.casts.find((c) => c.character.el.dataset.actor === 'cat');
        if (window.__catPoses.at(-1) !== cast.character.current) window.__catPoses.push(cast.character.current);
        if (window.__hj.busy) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    // Shots of the cat every 400 ms while the painting is on: the brush reaches it late, so keep the last few.
    const s0 = await catState(page);
    const pad = 120;
    const clip = { x: Math.max(0, s0.rect.x - pad), y: Math.max(0, s0.rect.y - pad), width: s0.rect.w + 2 * pad, height: s0.rect.h + 2 * pad };
    const shots = [];
    while (await page.evaluate(() => window.__hj.busy)) {
      const [img, s] = [await page.screenshot({ clip }), await catState(page)];
      if (s.busy) shots.push({ img, s, t: shots.length * 0.4 });
      await page.waitForTimeout(400);
    }
    const keep = [shots[Math.floor(shots.length * 0.75)], shots.at(-1)].filter(Boolean);
    for (const [i, k] of keep.entries()) await writeFile(`${out}rest-painting-cat-${i ? 'late' : 'mid'}.png`, k.img);
    {
      const last = keep.at(-1).s;
      const png = Buffer.from(last.data.split(',')[1], 'base64');
      await writeFile(`${out}rest-painting-canvas.png`, png);
      const m = await match(png);
      results.push({ state: 'painting', pose: last.pose, busy: last.busy, nearest: m.nearest, scores: m.scores, ok: last.pose === 'cat_1' && m.nearest === 'cat_1', shotsWhilePainting: shots.length, poseInEveryShot: [...new Set(shots.map((x) => x.s.pose))] });
    }
    for (const p of await page.evaluate(() => window.__catPoses)) poses.add(p);
    results.at(-1).posesDuringPainting = [...poses];
    results.at(-1).ok &&= poses.size === 1 && poses.has('cat_1');
    await context.close();
  }
  // 2. Paused: let it run until the cat is mid-routine (on cat_2 or a flick), then Pause.
  {
    const context = await browser.newContext(DESKTOP);
    const page = await context.newPage();
    await page.goto(`${base}?debug&reset&seed=3#design`);
    await page.waitForFunction(() => window.__hj?.ready === true && window.__hj.scene?.config.id === 'design' && window.__hj.busy === false, null, { timeout: 90000 });
    await page.waitForFunction(() => ['cat_2', 'cat_F2'].includes(window.__hj.scene.casts.find((c) => c.character.el.dataset.actor === 'cat').character.current), null, { timeout: 30000 });
    const before = (await catState(page)).pose;
    await page.getByRole('button', { name: 'Pause animation' }).click();
    await page.waitForTimeout(2500);
    const r = await shoot(page, 'paused');
    r.poseWhenPauseClicked = before;
    results.push(r);
    await context.close();
  }
  // 3. Reduced motion: the painting is skipped or quick; the cat never moves.
  {
    const context = await browser.newContext({ ...DESKTOP, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(`${base}?debug&reset&seed=3#design`);
    await page.waitForFunction(() => window.__hj?.ready === true && window.__hj.scene?.config.id === 'design' && window.__hj.busy === false, null, { timeout: 90000 });
    await page.evaluate(() => {
      window.__catPoses = [];
      const t0 = performance.now();
      const loop = (now) => {
        const cast = window.__hj.scene.casts.find((c) => c.character.el.dataset.actor === 'cat');
        if (window.__catPoses.at(-1) !== cast.character.current) window.__catPoses.push(cast.character.current);
        if (now - t0 < 6000) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    await page.waitForTimeout(6300);
    const r = await shoot(page, 'reduced-motion');
    r.posesOver6s = await page.evaluate(() => window.__catPoses);
    r.ok &&= r.posesOver6s.length === 1 && r.posesOver6s[0] === 'cat_1';
    results.push(r);
    await context.close();
  }
  await browser.close();
  await save(`rest-${engineName}.json`, results);
  for (const r of results) say(`${engineName} ${r.state}`, { ok: r.ok, pose: r.pose, nearest: r.nearest, cat_1: r.scores.cat_1, cat_F1: r.scores.cat_F1, extra: r.posesDuringPainting ?? r.poseWhenPauseClicked ?? r.posesOver6s });
};

run.film = async () => {
  const tag = `${engineName}-desktop`;
  const dir = `${out}video-${tag}/`;
  await rm(dir, { recursive: true, force: true });
  const browser = await launch();
  const context = await browser.newContext({ ...DESKTOP, recordVideo: { dir, size: DESKTOP.viewport } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  const started = Date.now();
  const seed = Number(process.env.HJ_SEED ?? 3);
  await page.goto(`${base}?debug&reset&seed=${seed}#design`);
  await page.waitForFunction(() => window.__hj?.ready === true && window.__hj.scene?.config.id === 'design' && window.__hj.busy === false, null, { timeout: 90000 });
  const cat1 = await readFile(`${pkg}${manifest.stills.cat_1}`);
  const cat2 = await readFile(`${pkg}${manifest.stills.cat_2}`);
  // Every frame: the cat's pose, and its canvas projected onto the line from cat_1 to cat_2 (a small copy of each).
  await page.evaluate(
    async ({ c1, c2, W, H }) => {
      const small = async (src) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0, W, H);
        return g.getImageData(0, 0, W, H).data;
      };
      const a = await small(c1);
      const b = await small(c2);
      let dd = 0;
      for (let i = 0; i < a.length; i++) dd += (b[i] - a[i]) ** 2;
      const cast = window.__hj.scene.casts.find((c) => c.character.el.dataset.actor === 'cat');
      const canvas = cast.character.el.querySelector('canvas');
      const tmp = document.createElement('canvas');
      tmp.width = W;
      tmp.height = H;
      const g = tmp.getContext('2d', { willReadFrequently: true });
      const log = [];
      const t0 = performance.now();
      window.__cat = { log, t0 };
      const frame = (now) => {
        g.clearRect(0, 0, W, H);
        g.drawImage(canvas, 0, 0, W, H);
        const x = g.getImageData(0, 0, W, H).data;
        let dot = 0;
        let res = 0;
        for (let i = 0; i < x.length; i++) dot += (x[i] - a[i]) * (b[i] - a[i]);
        const t = dot / dd;
        for (let i = 0; i < x.length; i++) res += Math.abs(x[i] - (a[i] + t * (b[i] - a[i])));
        log.push([Math.round((now - t0) * 10) / 10, cast.character.current, Math.round(t * 1000) / 1000, Math.round((res / x.length) * 100) / 100]);
        if (now - t0 < 31000) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    },
    { c1: `data:image/png;base64,${cat1.toString('base64')}`, c2: `data:image/png;base64,${cat2.toString('base64')}`, W, H },
  );
  const loggedAt = (Date.now() - started) / 1000;
  await page.waitForTimeout(31500);
  const { log } = await page.evaluate(() => window.__cat);
  const rect = await page.evaluate(() => {
    const r = window.__hj.scene.casts.find((c) => c.character.el.dataset.actor === 'cat').character.el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await context.close();
  await browser.close();
  const [webm] = (await readdir(dir)).filter((f) => f.endsWith('.webm'));
  const mp4 = `${out}cafe-cat-${tag}-30s.mp4`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, loggedAt - 0.2)), '-i', `${dir}${webm}`, '-t', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4]);
  await rm(dir, { recursive: true, force: true });

  // Steps: runs of one pose.
  const steps = [];
  for (const [at, pose, t, res] of log) {
    if (steps.at(-1)?.pose !== pose) steps.push({ pose, at, frames: [] });
    steps.at(-1).frames.push([at, t, res]);
  }
  for (let i = 0; i < steps.length; i++) steps[i].ms = Math.round((steps[i + 1]?.at ?? log.at(-1)[0]) - steps[i].at);
  // The order: the routine's (after the first step, which the film may join part way): the flick is
  // cat_F1 > cat_F2 > cat_F1 > cat_1, breathing is cat_1 <> cat_2.
  const NEXT = { cat_1: ['cat_2', 'cat_F1'], cat_2: ['cat_1'], cat_F1: ['cat_F2', 'cat_1'], cat_F2: ['cat_F1'] };
  const wrong = [];
  steps.forEach((s, i) => {
    if (i && !NEXT[steps[i - 1].pose].includes(s.pose)) wrong.push(`${steps[i - 1].pose} > ${s.pose} at ${s.at}`);
    if (s.pose === 'cat_F1' && steps[i + 1]?.pose === 'cat_1' && steps[i - 1]?.pose !== 'cat_F2') wrong.push(`cat_F1 > cat_1 not after cat_F2 at ${s.at}`);
  });
  const flicks = steps.filter((s, i) => s.pose === 'cat_F2' && steps[i - 1]?.pose === 'cat_F1' && steps[i + 1]?.pose === 'cat_F1');
  // Where each still reads on this measure (resampling moves the ends a little off 0 and 1): cat_1 from the frames of
  // the cut-in holds (the opening hold and each return from a flick, no dissolve), cat_2 from the last frame of each cat_2 hold.
  const median = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const cut1 = steps.filter((s, i) => s.pose === 'cat_1' && (i === 0 || steps[i - 1].pose === 'cat_F1')).flatMap((s) => s.frames.slice(1, 6).map(([, t]) => t));
  const ends = { cat_1: median(cut1), cat_2: median(steps.filter((s) => s.pose === 'cat_2').map((s) => s.frames.at(-1)[1])) };
  // The breaths: each cat_1 or cat_2 step that opened with a dissolve (it follows the other) and was followed by
  // another step (so its last frame is known). Its last frame must be its own still: within 0.01 of where it reads,
  // i.e. the dissolve is finished. (Before job 024, cat_1's 1 s dissolve in a 700-900 ms hold was cut at 70-90%.)
  const breaths = [];
  const TOL = 0.01;
  steps.forEach((s, i) => {
    const from = steps[i - 1]?.pose;
    if (!steps[i + 1] || !((s.pose === 'cat_1' && from === 'cat_2') || (s.pose === 'cat_2' && from === 'cat_1'))) return;
    const target = ends[s.pose];
    const last = s.frames.at(-1);
    const first = s.frames[0];
    // When it got there: the first frame within TOL of its still; the share of the way still to go on its last frame.
    const done = s.frames.find(([, t]) => Math.abs(t - target) <= TOL);
    breaths.push({
      pose: s.pose,
      at: s.at,
      ms: s.ms,
      next: steps[i + 1].pose,
      t_first: first[1],
      t_last: last[1],
      leftOnLastFrame: Math.round((Math.abs(last[1] - target) / Math.abs(ends.cat_2 - ends.cat_1)) * 1000) / 10 + '%',
      reachedAfterMs: done ? Math.round(done[0] - s.at) : null,
      // Finished within the shortest hold the routine can give it (cat_1 700 ms, cat_2 1400 ms), and still there on
      // its last frame. (A run of one pose may be two holds: the breathing loop repeating, or the routine wrapping to its
      // opening cat_1, are the same still again and invisible here; so its last frame alone proves nothing.)
      ok: done !== undefined && done[0] - s.at < (s.pose === 'cat_1' ? 700 : 1400) && Math.abs(last[1] - target) <= TOL,
    });
  });
  const result = {
    tag,
    seed,
    frames: log.length,
    steps: steps.map(({ pose, at, ms }) => ({ pose, at, ms })),
    flicks: flicks.map((s) => s.at),
    wrongOrder: wrong,
    ends,
    breaths,
    breathsFinished: `${breaths.filter((b) => b.ok).length} of ${breaths.length}`,
    errors,
    log,
  };

  result.rect = rect;
  result.mp4 = mp4.slice(out.length);
  await save(`film-${tag}.json`, result);
  say(`${tag} frames logged`, log.length);
  say(`${tag} steps`, steps.map((s) => `${s.pose}@${Math.round(s.at)}(${s.ms})`).join(' '));
  say(`${tag} flicks`, result.flicks);
  say(`${tag} wrong order`, wrong);
  say(`${tag} dissolves finished by their last frame`, result.breathsFinished);
  for (const b of breaths) say('  ', b);
  say(`${tag} errors`, errors);
  say(`${tag} files`, [mp4]);
  await run.sheets();
};

run.sheets = async () => {
  // Frame sheets from the recording: the cat, every 1/25 s (each frame the recording has), around the first two
  // flicks and the first two breaths back to cat_1.
  // WebKit's recording draws the page at 0.9 of its size in the top left of the frame (a grey margin round it); Chrome's at 1.
  const tag = `${engineName}-desktop`;
  const film = JSON.parse(await readFile(`${out}film-${tag}.json`, 'utf8'));
  const mp4 = `${out}${film.mp4}`;
  const k = Number(process.env.HJ_VIDEO_SCALE ?? (engineName === 'webkit' ? 0.9 : 1));
  const { rect } = film;
  const pad = 14;
  const crop = `crop=${Math.round((rect.w + 2 * pad) * k)}:${Math.round((rect.h + 2 * pad) * k)}:${Math.round((rect.x - pad) * k)}:${Math.round((rect.y - pad) * k)}`;
  // Where page time falls in the recording: the recording lags by an amount of its own, so line the flicks up. Each
  // frame of the recording's cat, small, against the median frame (the cat at rest): the flicks stand out; the offset
  // is the one that best matches them to the frames the log has on cat_F1/cat_F2.
  const SW = 48;
  const SH = Math.round((SW * (rect.h + 2 * pad)) / (rect.w + 2 * pad));
  const raw = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', mp4, '-vf', `fps=25,${crop},scale=${SW}:${SH}`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 28 });
  const N = Math.floor(raw.length / (SW * SH));
  const median = new Float64Array(SW * SH).map((_, j) => {
    const xs = Array.from({ length: N }, (_, f) => raw[f * SW * SH + j]).sort((a, b) => a - b);
    return xs[N >> 1];
  });
  const spike = Array.from({ length: N }, (_, f) => {
    let d = 0;
    for (let j = 0; j < SW * SH; j++) d += Math.abs(raw[f * SW * SH + j] - median[j]);
    return d / (SW * SH);
  });
  const poseAt = (ms) => {
    let pose = film.steps[0].pose;
    for (const st of film.steps) if (st.at <= ms) pose = st.pose;
    return pose;
  };
  let best = { score: -Infinity, offset: 0 };
  for (let offset = -1500; offset <= 1500; offset += 10) {
    // Recording time v (s) shows page time v*1000 - offset ms (see the trim in film).
    let score = 0;
    for (let f = 0; f < N; f++) score += (poseAt(f * 40 - offset).startsWith('cat_F') ? 1 : -0.2) * spike[f];
    if (score > best.score) best = { score, offset };
  }
  film.videoOffsetMs = best.offset;
  const sheet = (name, fromMs, toMs) => {
    const n = Math.round(((toMs - fromMs) / 1000) * 25);
    const cols = 10;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, (fromMs + best.offset) / 1000)), '-t', String((toMs - fromMs) / 1000), '-i', mp4, '-vf', `fps=25,${crop},scale=192:-1:flags=lanczos,pad=iw+4:ih+4:2:2:white,tile=${cols}x${Math.ceil(n / cols)}`, '-frames:v', '1', `${out}${name}.png`]);
    return `${name}.png: ${n} frames from ${Math.round(fromMs)} ms page time, 40 ms apart, left to right, top to bottom`;
  };
  const sheets = [];
  film.flicks.slice(0, 2).forEach((at, i) => sheets.push(sheet(`sheet-flick-${i + 1}`, at - 400, at + 1000)));
  film.breaths.filter((b) => b.pose === 'cat_1').slice(0, 2).forEach((b, i) => sheets.push(sheet(`sheet-breath-${i + 1}`, b.at - 400, b.at + 1200)));
  film.sheets = sheets;
  await save(`film-${tag}.json`, film);
  say(`${tag} recording offset (ms of recording ahead of page time)`, best.offset);
  say(`${tag} sheets`, sheets);
};

await run[cmd]();

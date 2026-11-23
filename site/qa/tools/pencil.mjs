// The pencil edge (reviews/scene-edge-pencil.md): the colour gives way to pencil, and nothing ends on a cut.
// Needs `npm run dev` (HJ_URL for another address).
//
//   node qa/tools/pencil.mjs shots     both scenes at 1440×900, 390×844 and 360×740; phones panned fully left and right
//   node qa/tools/pencil.mjs compare   mock-up B beside the build at 1440×900, and 2× close-ups: pencil-compare.jpg
//   node qa/tools/pencil.mjs rim       no straight cut: the drawn edge read back along the plate's rim, and the four corners close up
//   node qa/tools/pencil.mjs spots     the drawn edge under every mushroom and tap box, at five sizes
//   node qa/tools/pencil.mjs find      all 30 mushrooms clicked or tapped on the drawing itself, desktop and two phones
//   node qa/tools/pencil.mjs rachel    the drawn edge under every pixel Rachel (and in the café, every actor) ever covers
//   node qa/tools/pencil.mjs reveal    a first-visit painting and the short reveal: the pencil with the colour, never before it
//   node qa/tools/pencil.mjs quick [n] WebKit, phone, production build: frame times through the short reveal of a return visit
//   node qa/tools/pencil.mjs switch    moving between scenes: the edge is drawn again before anything of the new scene shows
//   node qa/tools/pencil.mjs film      recordings of a first visit and of two switches, desktop and iPhone profile, with stills
//   node qa/tools/pencil.mjs pan       WebKit, phone: frame times while the room is panned end to end (HJ_EDGE=organic for the edge before)
//   (memory: HJ_SAVE=qa/edge/pencil-memory.json node qa/tools/review05.mjs memory)
//   node qa/tools/pencil.mjs cost      what making the edge costs the page's thread
//   node qa/tools/pencil.mjs pick [n] [scene]  which of each scene's possible edges keeps its cast solid and moves the fewest mushrooms
import { chromium, webkit, devices } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const base = process.env.HJ_URL ?? 'http://localhost:5173/';
const out = new URL('../edge/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const SIZES = [[1440, 900], [390, 844], [360, 740]];
const ready = (page) => page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 30000 });
const clean = (page) => page.evaluate(() => document.querySelectorAll('.hj-mushrooms').forEach((el) => el.classList.remove('is-debug')));
const say = (label, value) => console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
const save = (name, value) => writeFile(`${out}${name}`, `${JSON.stringify(value, null, 1)}\n`);
const errorsOf = (page) => {
  const errors = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
};

// In the page: the edge as it is actually drawn, read back from its canvases. `shows(x, y)` is how much of
// the painting shows at a point of the plate (plate px): what every strip over that point lets through.
// `pencil(x, y)` is how far the overlay's colour there is from paper, toward graphite (0 to 1).
const READ_EDGE = `window.__readEdge = () => {
  const strips = [...document.querySelectorAll('.hj-plate .hj-edge canvas')].filter((c) => c.width).map((c) => {
    const x = (parseFloat(c.style.left) / 100) * 1672, y = (parseFloat(c.style.top) / 100) * 941;
    const w = (parseFloat(c.style.width) / 100) * 1672, h = (parseFloat(c.style.height) / 100) * 941;
    return { x, y, w, h, cw: c.width, ch: c.height, data: c.getContext('2d').getImageData(0, 0, c.width, c.height).data };
  });
  const at = (s, x, y) => (Math.min(s.ch - 1, Math.max(0, Math.floor(((y - s.y) / s.h) * s.ch))) * s.cw + Math.min(s.cw - 1, Math.max(0, Math.floor(((x - s.x) / s.w) * s.cw)))) * 4;
  const over = (s, x, y) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h;
  return {
    strips: strips.map((s) => [Math.round(s.x), Math.round(s.y), s.cw, s.ch]),
    shows: (x, y) => { let through = 1; for (const s of strips) if (over(s, x, y)) through *= 1 - s.data[at(s, x, y) + 3] / 255; return through; },
    pencil: (x, y) => { let most = 0; for (const s of strips) if (over(s, x, y)) { const i = at(s, x, y); if (s.data[i + 3] > 200) most = Math.max(most, (246 - s.data[i]) / (246 - 78)); } return most; },
  };
};`;

// Everything Rachel ever covers, on the plate: all her frames drawn where the page draws them.
const unionOf = async (scene) => {
  const W = 1672; const H = 941;
  const bitmap = async (url) => createImageBitmap(await (await fetch(url)).blob());
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (scene.character.kind === 'cast') {
    // A whole cast: every still of every actor where its layer puts it, and every patch of every clip.
    const dir = `./assets/${scene.assets}${scene.character.dir}`;
    const frames = await (await fetch(dir + scene.character.frames)).json();
    const k = W / frames.canvas.w;
    const layers = Object.fromEntries(frames.layers.map((layer) => [layer.actor, layer]));
    for (const layer of frames.layers) {
      const stills = [];
      for (const still of layer.stills ?? []) stills.push(await bitmap(dir + frames.stills[still].replace('.png', '.webp')));
      // A layer with no stills, the theatre's stagehand: everywhere he is ever seen is inside his body mask (below
      // the top of his head, plate y 135).
      if (!stills.length && layer.body_mask) {
        const mask = await bitmap(dir + layer.body_mask.replace('.png', '.webp'));
        const track = await (await fetch(dir + layer.sprite_track)).json();
        ctx.save(); ctx.beginPath(); ctx.rect(0, 135 * k, W, H); ctx.clip();
        ctx.drawImage(mask, track.body_mask_xy[0] * k, track.body_mask_xy[1] * k, mask.width * k, mask.height * k);
        ctx.restore();
      }
      if (!stills.length) continue;
      // A layer of solid rectangles, with nothing cut out, is a piece of the room that moves (the café's
      // fan), not an actor: the edge fades it as it fades the plate.
      const probe = new OffscreenCanvas(stills[0].width, stills[0].height).getContext('2d', { willReadFrequently: true });
      probe.drawImage(stills[0], 0, 0);
      const alpha = probe.getImageData(0, 0, stills[0].width, stills[0].height).data;
      let solid = true;
      for (let i = 3; i < alpha.length && solid; i += 4) solid = alpha[i] === 255;
      // A layer the package marks as scenery (the film scene's water) is faded with the plate too. And what
      // the package cannot say, from the scene's brief (reviews/scene-4-build.md, section 6): Rachel in the
      // film scene is cropped by the bottom of the painting, so only what is above her waist (plate y 760)
      // has to be whole.
      const rules = { film: { above: { rachel: 760 } } }[scene.id] ?? {};
      if (solid || layer.scenery === true) continue;
      ctx.save();
      if (rules.above?.[layer.actor]) { ctx.beginPath(); ctx.rect(0, 0, W, rules.above[layer.actor]); ctx.clip(); }
      for (const b of stills) ctx.drawImage(b, layer.x * k, layer.y * k, b.width * k, b.height * k);
      ctx.restore();
    }
    for (const clip of Object.values(frames.clips ?? {})) for (const file of new Set(clip.frames)) { const b = await bitmap(dir + file.replace('.png', '.webp')); ctx.drawImage(b, (layers[clip.layer].x + clip.x) * k, (layers[clip.layer].y + clip.y) * k, b.width * k, b.height * k); }
  } else if (scene.character.kind === 'clips') {
    const dir = `./assets/${scene.assets}${scene.character.dir}`;
    const frames = await (await fetch(dir + scene.character.frames)).json();
    const c = frames.canvas; const k = c.plate_w / c.w;
    for (const file of Object.values(frames.stills)) ctx.drawImage(await bitmap(dir + file.replace('.png', '.webp')), c.plate_x, c.plate_y, c.plate_w, c.plate_h);
    for (const clip of Object.values(frames.clips)) for (const file of clip.frames) { const b = await bitmap(dir + file.replace('.png', '.webp')); ctx.drawImage(b, c.plate_x + clip.x * k, c.plate_y + clip.y * k, b.width * k, b.height * k); }
  } else {
    // Scene 1: her place on the plate comes from the page itself.
    const dir = `./assets/${scene.assets}${scene.character.dir}`;
    const box = window.__buildBox ?? window.__hj.rachel.placement;
    const reaction = await (await fetch(`${dir}${scene.character.reaction}reaction.json`)).json();
    const shared = await (await fetch(`${dir}${scene.character.reaction}shared.json`)).json();
    const files = [...scene.character.frames.map((name) => `${dir}${name}.webp`), ...reaction.frames.map((f) => (f.file in shared ? `./assets/${scene.assets}${shared[f.file]}` : `${dir}${scene.character.reaction}${f.file.replace('.png', '.webp')}`))];
    for (const url of new Set(files)) ctx.drawImage(await bitmap(url), box.left, box.top, box.width, box.height);
  }
  const data = ctx.getImageData(0, 0, W, H).data;
  const points = [];
  let top = H; let bottom = 0; let left = W; let right = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (data[(y * W + x) * 4 + 3] > 128) { points.push([x, y]); top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x); }
  return { points, box: [left, top, right, bottom] };
};

const run = {};

// What making the edge costs: the whole of it, and the longest the page's thread is held at one go.
run.cost = async () => {
  const report = {};
  const measure = async (page) => {
    await page.goto(`${base}?debug&reset&intro=off&seed=7`);
    await ready(page);
    await page.waitForTimeout(1500);
    return page.evaluate(async () => {
      const { makeEdge, edgeSeed } = await import('/src/engine/edge.ts');
      const rows = [];
      for (let i = 0; i < 5; i++) {
        const edge = makeEdge('pencil', edgeSeed('grow:129'), [246, 243, 236], 'scene2/pencil');
        await new Promise((r) => setTimeout(r, 300));
        // A second loop of turns alongside: the longest it is kept waiting is the longest the thread was held.
        let done = false; let longest = 0; let busy = 0;
        const turns = (async () => { while (!done) { const t = performance.now(); await new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = r; c.port2.postMessage(0); }); const gap = performance.now() - t; longest = Math.max(longest, gap); if (gap > 1) busy += gap; } })();
        const t0 = performance.now();
        await edge.make();
        const whole = performance.now() - t0;
        done = true; await turns;
        rows.push({ wholeMs: Math.round(whole), busyMs: Math.round(busy), longestHoldMs: Math.round(longest * 10) / 10, bytes: edge.bytes });
        edge.release();
      }
      return rows;
    });
  };
  const summary = (rows) => ({ wholeMs: rows.map((r) => r.wholeMs), busyMs: rows.map((r) => r.busyMs), longestHoldMs: rows.map((r) => r.longestHoldMs), megabytes: Math.round(rows[0].bytes / 1e4) / 100 });
  {
    const browser = await chromium.launch({ channel: 'chrome' });
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    report.chrome = summary(await measure(page));
    say('chrome', report.chrome);
    for (const rate of [4, 6]) {
      const client = await page.context().newCDPSession(page);
      await client.send('Emulation.setCPUThrottlingRate', { rate });
      report[`chrome, processor slowed ${rate}x`] = summary(await measure(page));
      say(`chrome ${rate}x`, report[`chrome, processor slowed ${rate}x`]);
      await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    }
    await browser.close();
  }
  {
    const browser = await webkit.launch();
    const page = await (await browser.newContext({ ...devices['iPhone 14'] })).newPage();
    report['webkit, iPhone 14 profile'] = summary(await measure(page));
    say('webkit', report['webkit, iPhone 14 profile']);
    await browser.close();
  }
  await save('pencil-cost.json', report);
};

run.shots = async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const errors = [];
  for (const scene of ['build', 'grow']) {
    for (const [width, height] of SIZES) {
      const phone = width <= 600;
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: phone ? 3 : 2, isMobile: phone, hasTouch: phone });
      const page = await context.newPage();
      const seen = errorsOf(page);
      await page.goto(`${base}?debug&reset&intro=off&seed=7#${scene}`);
      await ready(page);
      await clean(page);
      await page.getByRole('button', { name: 'Pause animation' }).click();
      await page.waitForTimeout(700);
      const name = `pencil-${scene}-${width}x${height}`;
      await sharp(await page.screenshot()).jpeg({ quality: 90 }).toFile(`${out}${name}.jpg`);
      if (phone) {
        // The far ends of the room on a phone: the plate's own edge, not the window's.
        for (const [end, left] of [['left', 0], ['right', 99999]]) {
          await page.evaluate((x) => { document.querySelector('.hj-viewport').scrollLeft = x; }, left);
          await page.waitForTimeout(300);
          await sharp(await page.screenshot()).jpeg({ quality: 90 }).toFile(`${out}${name}-${end}.jpg`);
        }
      }
      errors.push(...seen);
      await context.close();
      say(name, 'saved');
    }
  }
  await browser.close();
  say('console errors and warnings', errors.length ? errors : 'none');
};

const text = (t, width, size = 17) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${size + 14}"><text x="4" y="${size + 3}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" fill="#302e29">${t}</text></svg>`);
// Rows of pictures with a title over each row, on grey, saved as one JPEG.
const sheetOf = async (rows, file) => {
  const gap = 16;
  const tiles = [];
  let y = gap;
  let widest = 0;
  for (const [title, items] of rows) {
    let rowWidth = gap;
    let tallest = 0;
    const metas = [];
    for (const item of items) { const m = await sharp(item).metadata(); metas.push(m); rowWidth += m.width + gap; tallest = Math.max(tallest, m.height); }
    if (title) { tiles.push({ input: text(title, Math.max(rowWidth, 1200)), left: gap, top: y }); y += 36; }
    let x = gap;
    items.forEach((item, i) => { tiles.push({ input: item, left: x, top: y }); x += metas[i].width + gap; });
    widest = Math.max(widest, rowWidth, title ? 1200 + 2 * gap : 0);
    y += tallest + gap;
  }
  await sharp({ create: { width: widest, height: y, channels: 3, background: '#d9d6cf' } }).composite(tiles).jpeg({ quality: 90 }).toFile(file);
  say('saved', file);
};

// The window onto the room, alone on the page, at 2 device px per CSS px: the plate with a margin of paper.
const plateShot = async (browser, scene, margin = 0) => {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await page.goto(`${base}?debug&reset&intro=off&seed=7#${scene}`);
  await ready(page);
  await clean(page);
  await page.getByRole('button', { name: 'Pause animation' }).click();
  await page.evaluate(() => { document.querySelector('.hj-masthead').style.visibility = 'hidden'; document.querySelector('.hj-caption').style.visibility = 'hidden'; });
  await page.waitForTimeout(700);
  const box = await page.locator('.hj-window').boundingBox();
  const shot = await page.screenshot({ clip: { x: box.x - margin, y: box.y - margin, width: box.width + 2 * margin, height: box.height + 2 * margin } });
  await page.close();
  return { shot, cssWidth: box.width, margin };
};

// Mock-up B (reference/mockups/edge-pencil-options.jpg, third column) beside the build at 1440×900, and
// close-ups at twice the size of a top corner and a side.
run.compare = async () => {
  const options = new URL('../../../reference/mockups/edge-pencil-options.jpg', import.meta.url).pathname;
  const detail = new URL('../../../reference/mockups/edge-pencil-detail.jpg', import.meta.url).pathname;
  // Where the sheet's maker (tools/edge_pencil_mock.py) pasted column B: 820 × 461 at x 1760; Build at y 70, the lab at y 611.
  const mock = { build: { left: 1760, top: 70, width: 820, height: 461 }, grow: { left: 1760, top: 611, width: 820, height: 461 } };
  const browser = await chromium.launch({ channel: 'chrome' });
  const shots = { build: await plateShot(browser, 'build'), grow: await plateShot(browser, 'grow') };
  await browser.close();
  const W = Math.round(shots.build.cssWidth);
  const H = Math.round((W * 941) / 1672);
  const mockAt = (scene) => sharp(options).extract(mock[scene]).resize(W, H, { fit: 'fill' }).toBuffer();
  const buildAt = (scene) => sharp(shots[scene].shot).resize(W, H, { fit: 'fill' }).toBuffer();
  // A part of the plate (plate px), at 2 screen px per CSS px: the screenshot's own pixels.
  const close = async (scene, x, y, w, h) => {
    const m = await sharp(shots[scene].shot).metadata();
    const k = m.width / 1672;
    return sharp(shots[scene].shot).extract({ left: Math.round(x * k), top: Math.round(y * k), width: Math.round(w * k), height: Math.round(h * k) }).toBuffer();
  };
  // The same part of the mock-up, enlarged to the same size (it is a small picture: soft when enlarged).
  const mockClose = async (scene, x, y, w, h) => {
    const k = 820 / 1672;
    const m = await sharp(shots[scene].shot).metadata();
    const to = m.width / 1672;
    return sharp(await sharp(options).extract(mock[scene]).toBuffer()).extract({ left: Math.round(x * k), top: Math.round(y * k), width: Math.round(w * k), height: Math.round(h * k) }).resize(Math.round(w * to), Math.round(h * to), { fit: 'fill' }).toBuffer();
  };
  const corner = [0, 0, 480, 330];
  const side = [1672 - 400, 300, 400, 330];
  const mockDetail = await sharp(detail).extract({ left: 0, top: 0, width: 836, height: 470 }).resize({ height: Math.round(330 * (shots.build.cssWidth * 2) / 1672) }).toBuffer();
  await sheetOf([
    ['Build: mock-up B (left), the build at 1440 × 900 (right). The wander is seeded per scene, so the shapes differ; the character of the edge is what should match.', [await mockAt('build'), await buildAt('build')]],
    ['Grow: mock-up B (left), the build at 1440 × 900 (right).', [await mockAt('grow'), await buildAt('grow')]],
    ['Build, a top corner at twice the size: the mock-up sheet enlarged (soft: it is a small picture), the build, and the mock-up\'s own close-up of B (reference/mockups/edge-pencil-detail.jpg)', [await mockClose('build', ...corner), await close('build', ...corner), mockDetail]],
    ['Build, the right side at twice the size: mock-up enlarged, build. Then Grow, the right side: mock-up enlarged, build', [await mockClose('build', ...side), await close('build', ...side), await mockClose('grow', ...side), await close('grow', ...side)]],
    ['Grow, a top corner at twice the size: mock-up enlarged, build', [await mockClose('grow', ...corner), await close('grow', ...corner)]],
  ], `${out}pencil-compare.jpg`);
};

// No straight cut anywhere. Three readings, each all the way round the plate:
//   1. the edge as drawn on the page, read back from its canvases along the rim and just inside it;
//   2. the formula, sampled every half px along the rim;
//   3. the screen itself: a screenshot's pixels along the plate's outline must be bare paper.
// And the four corners of each scene, close up.
run.rim = async () => {
  const report = [];
  const browser = await chromium.launch({ channel: 'chrome' });
  const corners = [];
  for (const scene of ['build', 'grow', 'design', 'film', 'set']) {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
    await page.goto(`${base}?debug&reset&intro=off&seed=7#${scene}`);
    await ready(page);
    await clean(page);
    await page.getByRole('button', { name: 'Pause animation' }).click();
    await page.evaluate(READ_EDGE);
    const row = await page.evaluate(async (id) => {
      const { edgeAlpha, edgeSeed, edgeName, pencilReach } = await import('/src/engine/edge.ts');
      const { SCENES } = await import('/src/scenes/index.ts');
      const W = 1672; const H = 941;
      const config = SCENES.find((s) => s.id === id);
      const seed = edgeSeed(edgeName(config));
      // (The organic edge as it shipped last round: Build used its 22nd edge, Grow its first.)
      const paint = edgeAlpha('pencil', seed, config.keep); const pencil = pencilReach(seed, config.keep); const organic = edgeAlpha('organic', edgeSeed(id === 'build' ? 'build:22' : id));
      const edge = window.__readEdge();
      // Rings of the plate: the pixels `d` px in from the rim, all the way round.
      const ring = (d, fn) => { let most = 0; for (let x = d; x < W - d; x++) { most = Math.max(most, fn(x + 0.5, d + 0.5), fn(x + 0.5, H - d - 0.5)); } for (let y = d; y < H - d; y++) { most = Math.max(most, fn(d + 0.5, y + 0.5), fn(W - d - 0.5, y + 0.5)); } return Math.round(most * 1000) / 1000; };
      const drawn = {}; const drawnPencil = {}; const allowed = {};
      for (const d of [0, 1, 2, 4, 8, 14, 20, 27]) { drawn[`${d}px`] = ring(d, edge.shows); drawnPencil[`${d}px`] = ring(d, edge.pencil); const t = (d + 0.5) / 28; allowed[`${d}px`] = Math.round(t * t * (3 - 2 * t) * 1000) / 1000; }
      // The formula on the rim itself, every half px; and how the organic edge did on the same line.
      let rimPaint = 0; let rimPencil = 0; let organicCut = 0; let n = 0;
      for (let i = 0; i <= 2 * W; i++) { const x = i / 2; for (const y of [0, H]) { rimPaint = Math.max(rimPaint, paint(x, y)); rimPencil = Math.max(rimPencil, pencil(x, y)); n++; if (organic(x, y === 0 ? 1 : H - 1) > 0.5) organicCut++; } }
      for (let i = 0; i <= 2 * H; i++) { const y = i / 2; for (const x of [0, W]) { rimPaint = Math.max(rimPaint, paint(x, y)); rimPencil = Math.max(rimPencil, pencil(x, y)); n++; if (organic(x === 0 ? 1 : W - 1, y) > 0.5) organicCut++; } }
      return { scene: id, edge: config.edge ?? 0, strips: edge.strips, mostOfThePaintingShowingOnTheDrawnEdge: drawn, strongestPencilOnTheDrawnEdge: drawnPencil, theMostTheRimFadeAllowsThere: allowed, formulaOnTheRim: { points: n, mostPaint: rimPaint, mostPencil: rimPencil }, theOrganicEdgeAsItShipped: { shareOfTheRimWhereThePaintingWasOverHalf1pxIn: `${Math.round((organicCut / n) * 1000) / 10}%` } };
    }, scene);
    // The screen: every pixel along the plate's outline, and 2 CSS px inside it.
    await page.evaluate(() => { document.querySelector('.hj-masthead').style.visibility = 'hidden'; document.querySelector('.hj-caption').style.visibility = 'hidden'; });
    await page.waitForTimeout(500);
    const box = await page.locator('.hj-plate').boundingBox();
    const margin = 20;
    const shot = await page.screenshot({ clip: { x: box.x - margin, y: box.y - margin, width: box.width + 2 * margin, height: box.height + 2 * margin } });
    const raw = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
    const c = raw.info.channels; const k = 2;
    const px = (x, y) => { const i = (Math.round(y) * raw.info.width + Math.round(x)) * c; return [raw.data[i], raw.data[i + 1], raw.data[i + 2]]; };
    const far = (p) => Math.max(Math.abs(p[0] - 246), Math.abs(p[1] - 243), Math.abs(p[2] - 236));
    const outline = (inset) => {
      let worst = 0; let count = 0;
      const x0 = (margin + inset) * k; const y0 = (margin + inset) * k; const x1 = (margin + box.width - inset) * k - 1; const y1 = (margin + box.height - inset) * k - 1;
      for (let x = x0; x <= x1; x++) { worst = Math.max(worst, far(px(x, y0)), far(px(x, y1))); count += 2; }
      for (let y = y0; y <= y1; y++) { worst = Math.max(worst, far(px(x0, y)), far(px(x1, y))); count += 2; }
      return { screenPixels: count, furthestFromPaperOutOf255: worst };
    };
    row.onTheScreenAt1440x900 = { alongThePlatesOutline: outline(0), '1 CSS px inside it': outline(1), '2 CSS px inside it': outline(2) };
    row.ok = row.mostOfThePaintingShowingOnTheDrawnEdge['0px'] <= 0.004 && row.strongestPencilOnTheDrawnEdge['0px'] <= 0.004 && Object.keys(row.theMostTheRimFadeAllowsThere).every((d) => row.mostOfThePaintingShowingOnTheDrawnEdge[d] <= row.theMostTheRimFadeAllowsThere[d] + 0.01)
      && row.formulaOnTheRim.mostPaint === 0 && row.formulaOnTheRim.mostPencil === 0 && row.onTheScreenAt1440x900.alongThePlatesOutline.furthestFromPaperOutOf255 <= 2;
    report.push(row);
    say(scene, row);
    // The corners: 330 × 250 plate px each, with the paper around them.
    const m = await sharp(shot).metadata();
    const u = (box.width * k) / 1672;
    const cw = Math.round(330 * u); const ch = Math.round(250 * u); const pad = margin * k;
    for (const [name, left, top] of [['top left', 0, 0], ['top right', m.width - cw - pad, 0], ['bottom left', 0, m.height - ch - pad], ['bottom right', m.width - cw - pad, m.height - ch - pad]]) {
      corners.push({ scene, name, image: await sharp(shot).extract({ left, top, width: cw + pad, height: ch + pad }).toBuffer() });
    }
    await page.close();
  }
  await browser.close();
  await sheetOf(['build', 'grow', 'design', 'film', 'set'].map((scene) => [`${scene[0].toUpperCase() + scene.slice(1)}: the four corners at 1440 × 900, at twice the size (top left, top right, bottom left, bottom right), each with the paper beyond the plate's rim`, corners.filter((corner) => corner.scene === scene).map((corner) => corner.image)]), `${out}pencil-corners.jpg`);
  await save('pencil-rim.json', report);
  console.log(report.every((r) => r.ok) ? 'NO STRAIGHT CUT: the rim is paper all the way round, in every scene' : 'THE RIM IS NOT ALL PAPER');
};

// The edge as it is actually drawn on the page, read back under every mushroom and every tap box.
run.spots = async () => {
  const report = [];
  for (const [engine, width, height] of [['chrome', 1440, 900], ['chrome', 2560, 1440], ['webkit', 390, 844], ['webkit', 360, 740], ['webkit', 320, 640]]) {
    const phone = width <= 600;
    const browser = engine === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
    const context = await browser.newContext(phone ? { ...devices['iPhone 14'], viewport: { width, height } } : { viewport: { width, height } });
    const page = await context.newPage();
    for (const scene of ['build', 'grow', 'design', 'film', 'set']) {
      await page.goto(`${base}?debug&reset&intro=off&seed=7#${scene}`);
      await page.reload();
      await ready(page);
      await page.evaluate(READ_EDGE);
      const rows = await page.evaluate(() => {
        const plate = document.querySelector('.hj-plate');
        const edge = window.__readEdge();
        const p = plate.getBoundingClientRect();
        const k = 1672 / p.width;
        // The lowest the painting shows, and the strongest pencil, over a rectangle of the page.
        const over = (r, fn, pick) => { let v = pick === Math.min ? 1 : 0; for (let j = 0; j <= 12; j++) for (let i = 0; i <= 12; i++) v = pick(v, fn((r.left + (r.width * i) / 12 - p.left) * k, (r.top + (r.height * j) / 12 - p.top) * k)); return v; };
        return [...plate.querySelectorAll('.hj-shroom')].map((button) => {
          const box = button.getBoundingClientRect();
          const art = button.querySelector('.hj-shroom-art').getBoundingClientRect();
          return { id: button.dataset.spot, drawing: Math.round(over(art, edge.shows, Math.min) * 1000) / 1000, tapBox: Math.round(over(box, edge.shows, Math.min) * 1000) / 1000, pencilOverDrawing: Math.round(over(art, (x, y) => edge.pencil(x, y) * (1 - edge.shows(x, y)), Math.max) * 1000) / 1000, box: [Math.round(box.width), Math.round(box.height)], moved: [Math.round(box.left + box.width / 2 - (art.left + art.width / 2)), Math.round(box.top + box.height / 2 - (art.top + art.height / 2))],
            covers: art.left >= box.left - 0.6 && art.right <= box.right + 0.6 && art.top >= box.top - 0.6 && art.bottom <= box.bottom + 0.6, rect: [box.left - p.left, box.top - p.top, box.width, box.height] };
        });
      });
      const overlaps = [];
      for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
        const [ax, ay, aw, ah] = rows[i].rect; const [bx, by, bw, bh] = rows[j].rect;
        if (ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah) overlaps.push(`${rows[i].id}/${rows[j].id}`);
      }
      const row = { engine, size: `${width}x${height}`, scene, spots: rows.length, lowestUnderADrawing: Math.min(...rows.map((r) => r.drawing)), lowestUnderATapBox: Math.min(...rows.map((r) => r.tapBox)), strongestPencilOverADrawing: Math.max(...rows.map((r) => r.pencilOverDrawing)), smallestBox: Math.min(...rows.map((r) => Math.min(...r.box))), everyBoxCoversItsDrawing: rows.every((r) => r.covers), boxesMovedInward: rows.filter((r) => r.moved[0] || r.moved[1]).map((r) => `${r.id} ${r.moved.join(',')}px`), overlaps };
      row.ok = row.spots === 10 && row.lowestUnderADrawing >= 0.95 && row.lowestUnderATapBox >= 0.95 && row.smallestBox >= 44 && row.everyBoxCoversItsDrawing && overlaps.length === 0;
      report.push(row);
      say(`${engine} ${width}x${height} ${scene}`, row);
    }
    await browser.close();
  }
  await save('pencil-spots.json', report);
  console.log(report.every((r) => r.ok) ? 'ALL SOLID: every mushroom and tap box is over at least 0.95 of the painting' : 'SOME SPOTS ARE IN THE FADE');
};

// Rachel must be fully opaque in every pose: the colour's edge, by the formula and as drawn on the page,
// under every pixel any of her frames ever covers, in every scene. (Down to the rim's own fade: see below.)
run.rachel = async () => {
  const report = [];
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  let buildBox = null;
  for (const id of ['build', 'grow', 'design', 'film', 'set']) {
    await page.goto(`${base}?debug&reset&intro=off&seed=7#${id}`);
    await page.reload();
    await ready(page);
    await page.evaluate(`window.__unionOf = ${unionOf.toString()}`);
    await page.evaluate(READ_EDGE);
    if (id === 'build') buildBox = await page.evaluate(() => { const p = window.__hj.rachel.placement; return { left: p.left, top: p.top, width: p.width, height: p.height }; });
    const row = await page.evaluate(async ({ id, buildBox }) => {
      const { edgeAlpha, edgeSeed, edgeName } = await import('/src/engine/edge.ts');
      const { SCENES } = await import('/src/scenes/index.ts');
      window.__buildBox = buildBox;
      const scene = SCENES.find((s) => s.id === id);
      const hers = await window.__unionOf(scene);
      const alpha = edgeAlpha('pencil', edgeSeed(edgeName(scene)), scene.keep);
      const edge = window.__readEdge();
      let formula = 1; let drawn = 1; let pencil = 0; let worst = null;
      // The plate's rim is bare paper, and the painting comes up over its first 28 px: nothing can be whole
      // there. A point of hers inside that fade (the café: the faint outer fringe of Rachel's shadow) is
      // held to the most the rim allows, and counted apart.
      const RIM = 28;
      const rim = (x, y) => { const t = Math.min(1, Math.max(0, Math.min(x, 1672 - x, y, 941 - y) / RIM)); return t * t * (3 - 2 * t); };
      const fringe = { points: 0, lowestByTheFormula: 1, lowestOnTheDrawnEdge: 1, furthestBelowWhatTheRimAllows: 0, nearestTheRimPx: Infinity };
      for (const [x, y] of hers.points) {
        const a = alpha(x, y);
        const din = Math.min(x, 1672 - x, y, 941 - y);
        pencil = Math.max(pencil, edge.pencil(x, y) * (1 - edge.shows(x, y)));
        if (din < RIM) {
          fringe.points++;
          fringe.lowestByTheFormula = Math.min(fringe.lowestByTheFormula, Math.round(a * 1000) / 1000);
          fringe.lowestOnTheDrawnEdge = Math.min(fringe.lowestOnTheDrawnEdge, Math.round(edge.shows(x, y) * 1000) / 1000);
          fringe.furthestBelowWhatTheRimAllows = Math.max(fringe.furthestBelowWhatTheRimAllows, Math.round((rim(x, y) - a) * 1e6) / 1e6);
          fringe.nearestTheRimPx = Math.min(fringe.nearestTheRimPx, din);
          continue;
        }
        if (a < formula) { formula = a; worst = [x, y]; }
        drawn = Math.min(drawn, edge.shows(x, y));
      }
      // How close the fade comes: the nearest point of the plate, to her, where the painting is under 0.999.
      let nearest = Infinity;
      for (const [x, y] of hers.points) {
        if (y < hers.box[3] - 40 && x > hers.box[0] + 40 && x < hers.box[2] - 40) continue;
        for (let d = 2; d < nearest; d += 2) { if (alpha(x, y + d) < 0.999 || alpha(x - d, y) < 0.999 || alpha(x + d, y) < 0.999) { nearest = d; break; } if (d > 120) break; }
      }
      return { scene: id, edge: scene.edge ?? 0, herFramesCoverPlate: { x: [hers.box[0], hers.box[2]], y: [hers.box[1], hers.box[3]] }, pixelsChecked: hers.points.length, lowestByTheFormula: formula, lowestOnTheDrawnEdge: Math.round(drawn * 1000) / 1000, strongestPencilOverHer: Math.round(pencil * 1000) / 1000, worstPoint: worst, fadeComesNoNearerThanPx: nearest, ...(fringe.points ? { insideTheRimsOwnFade: { ...fringe, shareOfHerPoints: Math.round((fringe.points / hers.points.length) * 10000) / 10000 } } : {}) };
    }, { id, buildBox });
    // Whole everywhere the rim lets the painting be whole; inside the rim's fade, exactly what the rim allows.
    row.ok = row.lowestByTheFormula === 1 && row.lowestOnTheDrawnEdge === 1 && row.strongestPencilOverHer === 0 && (row.insideTheRimsOwnFade?.furthestBelowWhatTheRimAllows ?? 0) < 1e-6;
    report.push(row);
    say(id, row);
  }
  await browser.close();
  await save('pencil-rachel.json', report);
};

// A first-visit painting (round 3b: the pencil arrives with the colour, not before). Three readings:
//   1. The sheet over the room and the veil over the edge's pencil, read back every frame of a painting
//      played at a quarter speed: the veil lies only where the edge holds the colour back; the pencil never
//      shows further than a stroke's margin (about 70 px) from paint that is already there; how long a
//      pencil point takes to come up, and how that sits against the colour arriving at the painting's edge
//      beside it.
//   2. Screenshots at full speed: bare paper stays paper, and past the colour's edge there is only paper or
//      pencil, never paint. Three stills of each scene (early, middle, late), and of Build on the phone.
//   3. The short reveal of a return visit (also what reduced motion gets): in every screenshot of it the
//      pencil is as far along as the colour, and nothing shows past the edge.
const WATCH = `(() => {
  const W = 418, H = 235;
  const scratch = document.createElement('canvas'); scratch.width = W; scratch.height = H;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  const never = () => new Float32Array(W * H).fill(-1);
  const w = window.__watch = { W, H, frames: 0, V0: null, far: 0, farOver110: 0, lifted: 0, tC: never(), t10: never(), t50: never(), t90: never(), done: false };
  const slow = Number(new URLSearchParams(location.search).get('slow') ?? 1);
  const alpha = (canvas) => { ctx.globalCompositeOperation = 'copy'; ctx.drawImage(canvas, 0, 0, W, H); return ctx.getImageData(0, 0, W, H).data; };
  const dist = new Float32Array(W * H);
  const tick = () => {
    const hj = window.__hj;
    if (hj?.marks.introEnd > 0) { w.done = true; return; }
    requestAnimationFrame(tick);
    const sheet = document.querySelector('.hj-plate .hj-paint:not(.is-veil)');
    const veil = document.querySelector('.hj-plate .hj-paint.is-veil');
    if (!sheet || !veil || !(hj?.marks.introStart > 0)) return;
    const t = (performance.now() - hj.marks.introStart) / slow;
    const S = alpha(sheet), V = alpha(veil).slice();
    w.frames++;
    if (!w.V0) { w.V0 = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) w.V0[i] = V[i * 4 + 3]; }
    for (let i = 0; i < W * H; i++) {
      const s = S[i * 4 + 3], v = V[i * 4 + 3];
      if (w.tC[i] < 0 && s < 128) w.tC[i] = t;
      if (w.t10[i] < 0 && v < 230) w.t10[i] = t;
      if (w.t50[i] < 0 && v < 128) w.t50[i] = t;
      if (w.t90[i] < 0 && v < 26) w.t90[i] = t;
    }
    // How far the lifted veil reaches from paint that is there (every sixth frame, while the brush is at work).
    if (w.frames % 6 === 0 && t < 4000) {
      for (let i = 0; i < W * H; i++) dist[i] = S[i * 4 + 3] < 128 ? 0 : 1e6;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; let d = dist[i]; if (x) d = Math.min(d, dist[i - 1] + 1); if (y) { d = Math.min(d, dist[i - W] + 1); if (x) d = Math.min(d, dist[i - W - 1] + 1.414); if (x < W - 1) d = Math.min(d, dist[i - W + 1] + 1.414); } dist[i] = d; }
      for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; let d = dist[i]; if (x < W - 1) d = Math.min(d, dist[i + 1] + 1); if (y < H - 1) { d = Math.min(d, dist[i + W] + 1); if (x < W - 1) d = Math.min(d, dist[i + W + 1] + 1.414); if (x) d = Math.min(d, dist[i + W - 1] + 1.414); } dist[i] = d; }
      for (let i = 0; i < W * H; i++) if (w.V0[i] > 200 && V[i * 4 + 3] < 128 && dist[i] < 1e5) { w.lifted++; if (dist[i] > w.far) w.far = dist[i]; if (dist[i] * 4 > 110) w.farOver110++; }
    }
  };
  requestAnimationFrame(tick);
})();`;
const PAPER = [246, 243, 236];
const isPaper = (p) => Math.abs(p[0] - 246) <= 4 && Math.abs(p[1] - 243) <= 4 && Math.abs(p[2] - 236) <= 4;
// Pencil on paper: somewhere on the line from paper (246, 243, 236) to graphite (78, 74, 70). Paint is not.
const isPencil = (p) => { const t = (246 - p[0]) / 168; return t >= -0.03 && t <= 1.03 && Math.abs(p[1] - (243 - 169 * t)) <= 7 && Math.abs(p[2] - (236 - 166 * t)) <= 7; };
// Points of the plate by what the finished edge leaves there: bare paper, pencil only, or the whole painting.
const pointsOf = (page, id) => page.evaluate(async (id) => {
  const { edgeAlpha, edgeSeed, edgeName, pencilReach } = await import('/src/engine/edge.ts');
  const { SCENES } = await import('/src/scenes/index.ts');
  const scene = SCENES.find((s) => s.id === id);
  const seed = edgeSeed(edgeName(scene));
  const paint = edgeAlpha('pencil', seed, scene.keep); const pencil = pencilReach(seed, scene.keep);
  const paper = []; const sketch = []; const inside = [];
  // "Paper" and "no colour" mean so there and for 4 px around: the screenshot is smaller than the plate.
  const around = [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4], [3, 3], [-3, 3], [3, -3], [-3, -3]];
  for (let y = 3; y < 941; y += 5) for (let x = 3; x < 1672; x += 5) {
    if (around.every(([dx, dy]) => pencil(x + dx, y + dy) <= 0.001)) paper.push([x, y]);
    else if (around.every(([dx, dy]) => paint(x + dx, y + dy) <= 0.001)) sketch.push([x, y]);
    else if (paint(x, y) >= 0.999) inside.push([x, y]);
  }
  return { paper, sketch, inside };
}, id);
const reader = async (png) => {
  const shot = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const k = shot.info.width / 1672;
  return ([x, y]) => { const i = (Math.min(shot.info.height - 1, Math.round(y * k)) * shot.info.width + Math.min(shot.info.width - 1, Math.round(x * k))) * 3; return [shot.data[i], shot.data[i + 1], shot.data[i + 2]]; };
};
const STILLS = { early: 900, middle: 2300, late: 3700 };

run.reveal = async () => {
  const report = [];
  const chrome = await chromium.launch({ channel: 'chrome' });
  const safari = await webkit.launch();
  for (const id of (process.env.HJ_SCENES ?? 'build,grow').split(',')) {
    const errors = [];
    // 1. The sheet and the veil, frame by frame, at a quarter speed. Desktop Chrome and the iPhone profile.
    const watched = [];
    for (const [engine, browser, options] of [['chrome 1440x900', chrome, { viewport: { width: 1440, height: 900 } }], ['webkit iPhone 14', safari, { ...devices['iPhone 14'] }]]) {
      const context = await browser.newContext(options);
      await context.addInitScript(WATCH);
      const page = await context.newPage();
      errors.push(...errorsOf(page));
      await page.goto(`${base}?debug&reset&seed=7&slow=4#${id}`);
      await page.waitForFunction(() => window.__watch?.done === true, null, { timeout: 90000 });
      watched.push({ engine, ...(await page.evaluate(async (id) => {
        const { edgeAlpha, edgeSeed, edgeName, pencilReach } = await import('/src/engine/edge.ts');
        const { SCENES } = await import('/src/scenes/index.ts');
        const scene = SCENES.find((s) => s.id === id);
        const seed = edgeSeed(edgeName(scene));
        const paint = edgeAlpha('pencil', seed, scene.keep); const pencil = pencilReach(seed, scene.keep);
        const w = window.__watch; const { W, H } = w;
        const kx = 1672 / W; const ky = 941 / H;
        const P = new Float32Array(W * H); const Q = new Float32Array(W * H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { P[y * W + x] = paint((x + 0.5) * kx, (y + 0.5) * ky); Q[y * W + x] = pencil((x + 0.5) * kx, (y + 0.5) * ky); }
        const WASH = 4060;
        const rise = []; const lead = []; let pencilPoints = 0; let leftToTheWash = 0;
        let onThePicture = 0; let whole = 0;
        // "The whole painting" means so there and for 12 px around: the veil's pixels are 4 px of the plate.
        const allThere = (x, y) => [[0, 0], [12, 0], [-12, 0], [0, 12], [0, -12], [9, 9], [-9, 9], [9, -9], [-9, -9]].every(([dx, dy]) => paint(x + dx, y + dy) >= 0.999);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (w.V0[i] > onThePicture && allThere((x + 0.5) * kx, (y + 0.5) * ky)) onThePicture = w.V0[i]; if (Q[i] > 0.3 && P[i] < 0.3 && w.V0[i] >= 250) whole++; }
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = y * W + x;
          // A pencil point: the pencil reaches it, the colour all but does not.
          if (!(Q[i] > 0.3 && P[i] < 0.3)) continue;
          pencilPoints++;
          if (w.t50[i] < 0 || w.t50[i] >= WASH) { leftToTheWash++; continue; }
          if (w.t90[i] >= 0 && w.t10[i] >= 0) rise.push(w.t90[i] - w.t10[i]);
          // When the brush first laid paint within 70 px of it.
          let first = 1e9;
          for (let dy = -18; dy <= 18; dy++) for (let dx = -18; dx <= 18; dx++) {
            const xx = x + dx; const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= W || yy >= H || dx * dx + dy * dy > 17.5 * 17.5) continue;
            const t = w.tC[yy * W + xx];
            if (t >= 0 && t < first) first = t;
          }
          if (first < 1e9) lead.push(w.t50[i] - first);
        }
        const spread = (list) => { const s = [...list].sort((a, b) => a - b); const q = (f) => Math.round(s[Math.min(s.length - 1, Math.floor(f * s.length))]); return { points: s.length, tenth: q(0.1), median: q(0.5), ninetieth: q(0.9), least: Math.round(s[0]), most: Math.round(s.at(-1)), shareOver400: Math.round((s.filter((v) => v > 400).length / s.length) * 1000) / 1000 }; };
        return {
          framesRead: w.frames,
          theVeilBeforeTheBrush: { mostOverTheWholePaintingOutOf255: onThePicture, pencilPointsItCoversWhole: whole },
          thePencilAheadOfThePaint: { furthestPlatePx: Math.round(w.far * kx), readings: w.lifted, readingsOver110Px: w.farOver110 },
          pencilPoints, pencilPointsLeftToTheWash: leftToTheWash,
          msForAPencilPointToComeUp: spread(rise),
          msFromPaintWithin70PxToThePencilHalfUp: spread(lead),
        };
      }, id)) });
      await context.close();
    }
    // 2. Screenshots at full speed.
    const rows = [];
    {
      const context = await chrome.newContext({ viewport: { width: 1440, height: 900 } });
      // (Worked out on a page of its own, so that the painting is not kept waiting.)
      const aside = await context.newPage();
      await aside.goto(`${base}?debug&intro=off#${id}`);
      await ready(aside);
      const points = await pointsOf(aside, id);
      await aside.close();
      const page = await context.newPage();
      errors.push(...errorsOf(page));
      await page.goto(`${base}?debug&reset&seed=7#${id}`);
      await page.waitForFunction(() => window.__hj?.marks.introStart > 0, null, { timeout: 30000 });
      await clean(page);
      const plate = await page.locator('.hj-plate').boundingBox();
      for (const at of [300, 900, 1500, 2300, 3000, 3700]) {
        await page.waitForFunction((t) => performance.now() - window.__hj.marks.introStart >= t, at, { polling: 'raf' });
        const taken = await page.evaluate(() => Math.round(performance.now() - window.__hj.marks.introStart));
        const full = await page.screenshot();
        const px = await reader(await sharp(full).extract({ left: Math.round(plate.x), top: Math.round(plate.y), width: Math.round(plate.width), height: Math.round(plate.height) }).png().toBuffer());
        rows.push({
          atMs: taken,
          pointsThatMustBeBarePaper: points.paper.length, notPaper: points.paper.filter((p) => !isPaper(px(p))).length,
          pointsPastTheColoursEdge: points.sketch.length, paintThere: points.sketch.filter((p) => !isPencil(px(p))).length, pencilThere: points.sketch.filter((p) => !isPaper(px(p)) && isPencil(px(p))).length,
          pointsInsideThePainting: points.inside.length, painted: points.inside.filter((p) => !isPaper(px(p))).length,
        });
        const still = Object.entries(STILLS).find(([, ms]) => ms === at);
        if (still) await sharp(full).jpeg({ quality: 90 }).toFile(`${out}pencil-reveal-${id}-${still[0]}.jpg`);
      }
      await page.close();
    }
    // The same three moments on the phone (Build only: the stills are for looking at).
    if (id === 'build' || id === 'design' || id === 'film' || id === 'set') {
      const context = await safari.newContext({ ...devices['iPhone 14'] });
      const page = await context.newPage();
      errors.push(...errorsOf(page));
      await page.goto(`${base}?debug&reset&seed=7#${id}`);
      await page.waitForFunction(() => window.__hj?.marks.introStart > 0, null, { timeout: 30000 });
      await clean(page);
      for (const [name, at] of Object.entries(STILLS)) {
        await page.waitForFunction((t) => performance.now() - window.__hj.marks.introStart >= t, at, { polling: 'raf' });
        await sharp(await page.screenshot()).jpeg({ quality: 90 }).toFile(`${out}pencil-reveal-${id === 'build' ? '' : `${id}-`}iphone-${name}.jpg`);
      }
      await context.close();
    }
    // 3. The short reveal. Screenshots from before it starts until well after it ends, as fast as they come.
    const quick = { screenshots: 0, screenshotsPartWay: 0, pointChecks: 0, barePaperPointsNotPaper: 0, pointsPastTheColourWithPaint: 0, pencilAheadOfTheColourAtMost: 0, pencilBehindTheColourAtMost: 0 };
    {
      const page = await (await chrome.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })).newPage();
      errors.push(...errorsOf(page));
      await page.goto(`${base}?debug&reset&seed=7#${id}`, { waitUntil: 'commit' });
      await page.waitForSelector('.hj-plate');
      const plate = await page.locator('.hj-plate').boundingBox();
      const shots = [];
      const t0 = Date.now();
      while (Date.now() - t0 < 2500) shots.push(await page.screenshot({ clip: plate }));
      await clean(page);
      const points = await pointsOf(page, id);
      // How far along a set of points is, from paper (0) to how they end up (1): only points that end up
      // well away from paper are asked.
      const last = await reader(shots.at(-1));
      const strong = (list) => list.filter((p) => { const f = last(p); return Math.abs(f[0] - PAPER[0]) + Math.abs(f[1] - PAPER[1]) + Math.abs(f[2] - PAPER[2]) > 150; });
      const colour = strong(points.inside.filter((_, i) => i % 7 === 0)); const pencil = strong(points.sketch);
      const along = (px, list) => { let got = 0; let whole = 0; for (const p of list) { const now = px(p); const f = last(p); for (let c = 0; c < 3; c++) { got += Math.abs(now[c] - PAPER[c]); whole += Math.abs(f[c] - PAPER[c]); } } return got / whole; };
      for (const png of shots) {
        const px = await reader(png);
        quick.screenshots++;
        quick.pointChecks += points.paper.length + points.sketch.length;
        quick.barePaperPointsNotPaper += points.paper.filter((p) => !isPaper(px(p))).length;
        quick.pointsPastTheColourWithPaint += points.sketch.filter((p) => !isPencil(px(p))).length;
        const c = along(px, colour); const p = along(px, pencil);
        if (c > 0.03 && c < 0.97) quick.screenshotsPartWay++;
        quick.pencilAheadOfTheColourAtMost = Math.max(quick.pencilAheadOfTheColourAtMost, Math.round((p - c) * 1000) / 1000);
        quick.pencilBehindTheColourAtMost = Math.max(quick.pencilBehindTheColourAtMost, Math.round((c - p) * 1000) / 1000);
      }
      quick.pointsAsked = { colour: colour.length, pencil: pencil.length };
      await page.close();
    }
    const ok = rows.every((r) => r.notPaper === 0 && r.paintThere === 0)
      && watched.every((w) => w.theVeilBeforeTheBrush.mostOverTheWholePaintingOutOf255 <= 64 && w.thePencilAheadOfThePaint.readingsOver110Px <= w.thePencilAheadOfThePaint.readings * 0.01)
      && quick.barePaperPointsNotPaper === 0 && quick.pointsPastTheColourWithPaint === 0 && quick.pencilAheadOfTheColourAtMost <= 0.05;
    report.push({ scene: id, theSheetAndTheVeilFrameByFrame: watched, moments: rows, theShortRevealWithReducedMotion: quick, ok, errors });
    say(id, report.at(-1));
  }
  await chrome.close();
  await safari.close();
  // (HJ_SCENES=design: the café's painting, kept beside the record of round 3b.)
  await save(process.env.HJ_SCENES ? `pencil-reveal-${process.env.HJ_SCENES.replace(/,/g, '-')}.json` : 'pencil-reveal.json', report);
};

// The short reveal of a return visit, in WebKit on the iPhone profile, against the production build
// (HJ_URL, e.g. http://localhost:4173/): frame times from the picture starting to show until 3.2 s later,
// which takes in the blank sheet being taken off the page again.
run.quick = async () => {
  const rows = [];
  const browser = await webkit.launch();
  const context = await browser.newContext({ ...devices['iPhone 14'] });
  await context.addInitScript(`(() => {
    const w = window.__gaps = { start: 0, gaps: [] };
    let last = performance.now();
    const tick = (now) => {
      if (!w.start && document.querySelector('.hj-scene:not(.is-pre) .hj-plate')) w.start = now;
      if (w.start) w.gaps.push([Math.round(now - last), Math.round(now - w.start)]);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })();`);
  const page = await context.newPage();
  // A first visit, so that every later load is a return.
  await page.goto(base);
  await page.waitForSelector('.hj-scene:not(.is-pre) .hj-plate', { state: 'attached', timeout: 30000 });
  await page.waitForTimeout(7000);
  for (let i = 0; i < Number(process.argv[3] ?? 8); i++) {
    await page.reload();
    await page.waitForFunction(() => window.__gaps?.start > 0 && performance.now() - window.__gaps.start > 3300, null, { timeout: 30000 });
    const gaps = (await page.evaluate(() => window.__gaps.gaps)).filter(([, at]) => at > 0 && at <= 3200);
    const row = { longestMs: Math.max(...gaps.map(([g]) => g)), over50: gaps.filter(([g]) => g > 50).map(([g, at]) => `${g}@${at}`), inTheReveal: Math.max(...gaps.filter(([, at]) => at <= 260).map(([g]) => g)), blankSheets: await page.locator('.hj-blank').count() };
    rows.push(row);
    say(`reload ${i + 1}`, row);
  }
  await browser.close();
  say('longest', rows.map((r) => r.longestMs));
  say('in the reveal', rows.map((r) => r.inTheReveal));
};

// Which of a scene's possible edges to use. Each must keep the colour whole under every pixel Rachel ever
// covers and stay inside the strips the edge is drawn in; of those, the one that moves the fewest mushrooms
// the least (each mushroom straight toward the middle of the plate, up, down or sideways) wins.
run.pick = async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.on('console', (m) => m.type() === 'error' && console.log('[page]', m.text()));
  await page.goto(`${base}?debug&reset&intro=off&seed=7`);
  await ready(page);
  await page.getByRole('button', { name: 'Pause animation' }).click();
  await page.evaluate(`window.__unionOf = ${unionOf.toString()}`);
  const result = await page.evaluate(async ([tries, only]) => {
    const { edgeAlpha, edgeSeed, tapBox, lowestAlpha, SOLID, STRIPS } = await import('/src/engine/edge.ts');
    const { SCENES } = await import('/src/scenes/index.ts');
    const W = 1672; const H = 941;
    const ASPECT = [152, 117, 149, 164, 45, 166, 158, 163, 166].map((w) => w / 154);
    const SCALES = [1799 / 1672, 1040 / 1672, 820 / 1672, 531 / 941, 486 / 941, 355 / 941];
    const inner = { left: STRIPS.left.w, right: W - STRIPS.right.w, top: STRIPS.left.y, bottom: STRIPS.left.y + STRIPS.left.h };
    const out = {};
    for (const scene of SCENES) {
      if (only && scene.id !== only) continue;
      // (The page was opened on the first scene, where scene 1's placement is known.)
      const hers = await window.__unionOf(scene);
      // Her pixels near the plate's sides are the only ones the edge can reach; the lowest first.
      const near = hers.points.filter(([x, y]) => Math.min(x, W - x, y, H - y) < 212).sort((a, b) => b[1] - a[1]);
      const rows = [];
      let solidUnderHer = 0;
      for (let n = 0; n < tries; n++) {
        const alpha = edgeAlpha('pencil', edgeSeed(n ? `${scene.id}:${n}` : scene.id), scene.keep);
        // (Whole, or inside the rim's own 28 px fade as whole as the rim allows.)
        const rim = (x, y) => { const t = Math.min(1, Math.max(0, Math.min(x, W - x, y, H - y) / 28)); return t * t * (3 - 2 * t); };
        if (near.some(([x, y]) => alpha(x, y) < rim(x, y) - 1e-9)) continue;
        solidUnderHer++;
        // Inside the strips the painting must be whole: along their inner sides is where it would first fail.
        let fits = true;
        for (let x = inner.left; x <= inner.right && fits; x += 2) fits = alpha(x, inner.top - 1) === 1 && alpha(x, inner.bottom + 1) === 1;
        for (let y = inner.top; y <= inner.bottom && fits; y += 2) fits = alpha(inner.left - 1, y) === 1 && alpha(inner.right + 1, y) === 1;
        if (!fits) continue;
        const clear = (spot) => {
          const w = spot.h * ASPECT[spot.art - 1];
          if (lowestAlpha(alpha, spot.x, spot.y - spot.h / 2, w, spot.h) < SOLID) return false;
          for (const u of SCALES) {
            const box = tapBox(alpha, { cx: spot.x, cy: spot.y - spot.h / 2, w, h: spot.h }, u);
            if (lowestAlpha(alpha, box.cx, box.cy, box.w, box.h) < SOLID) return false;
            if (spot.x - w / 2 < box.cx - box.w / 2 - 0.5 || spot.x + w / 2 > box.cx + box.w / 2 + 0.5 || spot.y - spot.h < box.cy - box.h / 2 - 0.5 || spot.y > box.cy + box.h / 2 + 0.5) return false;
          }
          return true;
        };
        const moves = [];
        let total = 0;
        const placed = scene.spots.map((spot) => {
          if (clear(spot)) return spot;
          let best = null;
          for (const [axis, dir] of [['y', spot.y > H / 2 ? -1 : 1], ['x', spot.x > W / 2 ? -1 : 1]]) {
            for (let move = 1; move <= (best ? best.by - 1 : 60); move++) {
              const moved = { ...spot, [axis]: spot[axis] + dir * move };
              if (clear(moved)) { best = { by: move, spot: moved, label: `${spot.id} ${axis}${dir * move > 0 ? '+' : ''}${dir * move}` }; break; }
            }
          }
          if (!best) { moves.push(`${spot.id} (more than 60)`); total += 999; return spot; }
          moves.push(best.label); total += best.by;
          return best.spot;
        });
        // Tap boxes must not come to overlap once the edge has pushed them inward.
        let overlap = false;
        for (const u of SCALES) {
          const boxes = placed.map((spot) => tapBox(alpha, { cx: spot.x, cy: spot.y - spot.h / 2, w: spot.h * ASPECT[spot.art - 1], h: spot.h }, u));
          for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (Math.abs(boxes[i].cx - boxes[j].cx) < (boxes[i].w + boxes[j].w) / 2 && Math.abs(boxes[i].cy - boxes[j].cy) < (boxes[i].h + boxes[j].h) / 2) overlap = `${placed[i].id}/${placed[j].id}`;
        }
        if (!overlap) rows.push({ n, plateRxMoved: total, moves });
      }
      rows.sort((a, b) => a.plateRxMoved - b.plateRxMoved || a.n - b.n);
      out[scene.id] = { rachelCovers: hers.box, tried: tries, solidUnderRachel: solidUnderHer, usable: rows.length, inUse: scene.edge ?? 0, inUseRow: rows.find((r) => r.n === (scene.edge ?? 0)) ?? null, best: rows.slice(0, 12) };
    }
    return out;
  }, [Number(process.argv[3] ?? 1500), process.argv[4] ?? null]);
  for (const [id, r] of Object.entries(result)) {
    say(`${id}: Rachel covers plate x ${r.rachelCovers[0]}-${r.rachelCovers[2]}, y ${r.rachelCovers[1]}-${r.rachelCovers[3]}`, `${r.solidUnderRachel} of ${r.tried} edges keep the colour whole under her; ${r.usable} of those fit the strips with no tap boxes overlapping. In use: ${r.inUse} ${JSON.stringify(r.inUseRow)}`);
    for (const row of r.best) console.log(`   ${String(row.n).padStart(4)}  ${row.moves.length ? `to move (plate px): ${row.moves.join(', ')}` : 'all mushrooms clear'}`);
  }
  await browser.close();
  // (A run for one scene is a look, not the record.)
  if (!process.argv[4]) await save('pencil-pick.json', result);
};

// Frame times while a phone pans the room end to end, in WebKit (the edge is four canvases now, not one).
run.pan = async () => {
  const results = [];
  for (let i = 0; i < 3; i++) {
    const browser = await webkit.launch();
    const context = await browser.newContext({ ...devices['iPhone 14'], viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      window.__gaps = [];
      let last = performance.now();
      const tick = (now) => { window.__gaps.push([last, now - last]); last = now; requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    const page = await context.newPage();
    const row = {};
    for (const scene of ['build', 'grow']) {
      await page.goto(`${base}?debug&reset&intro=off&seed=7${process.env.HJ_EDGE ? `&edge=${process.env.HJ_EDGE}` : ''}#${scene}`);
      await page.reload();
      await ready(page);
      await page.waitForTimeout(1500);
      row[scene] = await page.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const view = document.querySelector('.hj-viewport');
        const t0 = performance.now();
        view.scrollTo({ left: view.scrollWidth, behavior: 'smooth' }); await wait(1300);
        view.scrollTo({ left: 0, behavior: 'smooth' }); await wait(1500);
        view.scrollTo({ left: 300, behavior: 'smooth' }); await wait(1000);
        const gaps = window.__gaps.filter(([at]) => at >= t0);
        return { frames: gaps.length, longestMs: Math.round(Math.max(...gaps.map(([, len]) => len))), over50: gaps.filter(([, len]) => len > 50).length };
      });
    }
    results.push(row);
    say(`pan run ${i + 1}${process.env.HJ_EDGE ? ` (${process.env.HJ_EDGE})` : ''}`, row);
    await browser.close();
  }
  // (HJ_EDGE=organic measures the edge before this one, for comparison, and is saved beside the record.)
  await save(`pencil-pan-webkit${process.env.HJ_EDGE ? `-${process.env.HJ_EDGE}` : ''}.json`, results);
};

// Moving between scenes. A scene's edge is given back when it leaves and drawn again when it returns, so:
// is it always there before anything of the scene can be seen? Through each switch, in screenshots taken as
// fast as they come: every point that is bare paper in both scenes stays paper, and every point past the
// colour's edge in both stays paper or pencil. Also how long drawing the edge took, and the page's memory.
run.switch = async () => {
  const report = [];
  for (const [engine, name] of [['chrome', 'chrome, 1440 × 900'], ['webkit', 'webkit, iPhone 14 profile']]) {
    const browser = engine === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
    const context = await browser.newContext(engine === 'webkit' ? { ...devices['iPhone 14'] } : { viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = errorsOf(page);
    // A new visitor: the opening painting plays out first, and the first time in the lab is a full painting.
    await page.goto(`${base}?debug&reset&seed=7`);
    await ready(page);
    await clean(page);
    const rects = () => page.evaluate(() => { const r = document.querySelector('.hj-plate').getBoundingClientRect(); const v = document.querySelector('.hj-viewport').getBoundingClientRect(); return { scene: window.__hj.scene.config.id, plate: [r.left, r.top, r.width], view: [v.left, v.top, v.width, v.height] }; });
    const rows = [];
    for (const [to, kind] of [['grow', 'first visit: the full painting'], ['build', 'the short brush'], ['grow', 'the short brush']]) {
      const before = await rects();
      const mark = await page.evaluate(() => window.__hj.marks.switchEnd);
      const tab = page.locator(`.hj-tab[data-scene="${to}"]`);
      if (engine === 'webkit') await tab.tap(); else await tab.click();
      const shots = [];
      const t0 = Date.now();
      for (;;) {
        const done = await page.evaluate(() => window.__hj.busy === false);
        shots.push(await page.screenshot({ clip: { x: before.view[0], y: before.view[1], width: before.view[2], height: before.view[3] } }));
        if ((done && Date.now() - t0 > 600) || Date.now() - t0 > 20000) break;
      }
      const after = await rects();
      // Through a switch a point of the window shows the scene being left (where it was: a phone shows a
      // different part of each room) or the scene arriving. Points that are bare paper in both, and points
      // past the colour's edge in both, each as that scene lies in the window:
      const points = await page.evaluate(async ({ before, after }) => {
        const { edgeAlpha, edgeSeed, edgeName, pencilReach } = await import('/src/engine/edge.ts');
        const { SCENES } = await import('/src/scenes/index.ts');
        const sides = [before, after].map((side) => { const scene = SCENES.find((s) => s.id === side.scene); const seed = edgeSeed(edgeName(scene)); return { ...side, paint: edgeAlpha('pencil', seed, scene.keep), pencil: pencilReach(seed, scene.keep), u: side.plate[2] / 1672 }; });
        const around = [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4], [3, 3], [-3, 3], [3, -3], [-3, -3]];
        const paper = []; const sketch = [];
        const [vx, vy, vw, vh] = before.view;
        for (let y = 2; y < vh - 2; y += 3) for (let x = 2; x < vw - 2; x += 3) {
          // This window point, on each scene's plate (plate px).
          const on = sides.map((side) => [(vx + x - side.plate[0]) / side.u, (vy + y - side.plate[1]) / side.u]);
          if (on.some(([px, py]) => px < 6 || py < 6 || px > 1666 || py > 935)) continue;
          if (sides.every((side, i) => around.every(([dx, dy]) => side.pencil(on[i][0] + dx, on[i][1] + dy) <= 0.001))) paper.push([x, y]);
          else if (sides.every((side, i) => around.every(([dx, dy]) => side.paint(on[i][0] + dx, on[i][1] + dy) <= 0.001))) sketch.push([x, y]);
        }
        return { paper, sketch };
      }, { before, after });
      let notPaper = 0; let paint = 0;
      for (const [n, png] of shots.entries()) {
        const shot = await sharp(png).raw().toBuffer({ resolveWithObject: true });
        const k = shot.info.width / before.view[2];
        const px = ([x, y]) => { const i = (Math.min(shot.info.height - 1, Math.round(y * k)) * shot.info.width + Math.min(shot.info.width - 1, Math.round(x * k))) * shot.info.channels; return [shot.data[i], shot.data[i + 1], shot.data[i + 2]]; };
        const isPaper = (p) => Math.abs(p[0] - 246) <= 4 && Math.abs(p[1] - 243) <= 4 && Math.abs(p[2] - 236) <= 4;
        const isPencil = (p) => { const t = (246 - p[0]) / 168; return t >= -0.03 && t <= 1.03 && Math.abs(p[1] - (243 - 169 * t)) <= 7 && Math.abs(p[2] - (236 - 166 * t)) <= 7; };
        const stray = points.paper.filter((p) => !isPaper(px(p))).length + points.sketch.filter((p) => !isPencil(px(p))).length;
        notPaper += points.paper.filter((p) => !isPaper(px(p))).length;
        paint += points.sketch.filter((p) => !isPencil(px(p))).length;
        if (stray && process.env.HJ_DEBUG) await sharp(png).toFile(`${process.env.HJ_DEBUG}/switch-${engine}-${to}-${n}.png`);
      }
      const end = await page.evaluate((m) => ({ arrived: window.__hj.scene.config.id, marks: window.__hj.marks, changed: window.__hj.marks.switchEnd !== m, memory: window.__hj.memory.parts }), mark);
      const edges = Object.fromEntries(Object.entries(end.memory).filter(([key]) => key.endsWith('.edge')).map(([key, v]) => [key, Math.round(v / 1e4) / 100]));
      rows.push({ to, kind, arrived: end.arrived === to && end.changed, screenshotsThrough: shots.length, barePaperPoints: points.paper.length, notPaperInAnyScreenshot: notPaper, pointsPastTheColour: points.sketch.length, withPaintInAnyScreenshot: paint, drawingTheEdgeTookMs: end.marks.dressMs, wholeSwitchMs: end.marks.switchEnd - end.marks.switchStart, edgeMegabytesAfter: edges });
      say(`${name} / to ${to} (${kind})`, rows.at(-1));
      await page.waitForTimeout(800);
    }
    // The timings above are stretched by the screenshots. Six more switches with nothing watching, for the
    // pencil edge and for the edge before it (which is kept, not drawn again): how long the edge took to
    // draw, and from the tap to the end of the brush.
    const timings = {};
    for (const style of ['pencil', 'organic']) {
      const quiet = await context.newPage();
      await quiet.goto(`${base}?debug&reset&seed=7&intro=quick&edge=${style}`);
      await ready(quiet);
      await quiet.waitForTimeout(1500);
      const list = [];
      for (const to of ['grow', 'build', 'grow', 'build', 'grow', 'build', 'grow']) {
        const tab = quiet.locator(`.hj-tab[data-scene="${to}"]`);
        const tapped = await quiet.evaluate(() => performance.now());
        if (engine === 'webkit') await tab.tap(); else await tab.click();
        await quiet.waitForFunction((id) => window.__hj.scene.config.id === id && window.__hj.busy === false, to, { timeout: 40000 });
        list.push(await quiet.evaluate((t) => ({ edge: window.__hj.marks.dressMs, tapToEnd: Math.round(window.__hj.marks.switchEnd - t) }), tapped));
        await quiet.waitForTimeout(1200);
      }
      // (The first is the lab's first opening, which waits for her frames to download.)
      timings[style] = { drawingTheEdgeMs: list.slice(1).map((r) => r.edge), tapToEndOfBrushMs: list.slice(1).map((r) => r.tapToEnd) };
      await quiet.close();
    }
    say(`${name} / timings with nothing watching`, timings);
    report.push({ browser: name, switches: rows, timingsWithNothingWatching: timings, errors, ok: rows.every((r) => r.arrived && r.notPaperInAnyScreenshot === 0 && r.withPaintInAnyScreenshot === 0) && errors.length === 0 });
    await browser.close();
  }
  await save('pencil-switch.json', report);
  console.log(report.every((r) => r.ok) ? 'EVERY SWITCH: the edge was there before anything of the new scene showed' : 'A SWITCH SHOWED PAST THE EDGE (or an error was logged)');
};

// Recordings: a first visit (the painting, the pencil arriving with it), then to Grow (its full painting) and back to Build
// (the short brush), on desktop Chrome and on the iPhone profile in WebKit. Needs ffmpeg for the .mp4 and
// the strip of stills.
run.film = async () => {
  const { execFileSync } = await import('node:child_process');
  const { rm, readdir } = await import('node:fs/promises');
  for (const [name, engine, options] of [['desktop', chromium, { viewport: { width: 1280, height: 800 } }], ['iphone', webkit, { ...devices['iPhone 14'] }]]) {
    const dir = `${out}film-${name}/`;
    const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {});
    const context = await browser.newContext({ ...options, recordVideo: { dir, size: options.viewport } });
    const page = await context.newPage();
    const started = Date.now();
    await page.goto(`${base}?debug&reset&seed=7`);
    await page.waitForFunction(() => window.__hj?.marks.introStart > 0, null, { timeout: 30000 });
    const introAt = (Date.now() - started) / 1000;
    await clean(page);
    await page.waitForFunction(() => window.__hj.ready === true, null, { timeout: 40000 });
    await page.waitForTimeout(1200);
    const toGrow = (Date.now() - started) / 1000;
    const grow = page.locator('.hj-tab[data-scene="grow"]');
    if (name === 'iphone') await grow.tap(); else await grow.click();
    await page.waitForFunction(() => window.__hj.scene.config.id === 'grow' && window.__hj.busy === false, null, { timeout: 40000 });
    await clean(page);
    await page.waitForTimeout(1500);
    const toBuild = (Date.now() - started) / 1000;
    const build = page.locator('.hj-tab[data-scene="build"]');
    if (name === 'iphone') await build.tap(); else await build.click();
    await page.waitForFunction(() => window.__hj.scene.config.id === 'build' && window.__hj.busy === false, null, { timeout: 40000 });
    await page.waitForTimeout(1500);
    await context.close();
    await browser.close();
    const [webm] = (await readdir(dir)).filter((f) => f.endsWith('.webm'));
    const mp4 = `${out}pencil-film-${name}.mp4`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${dir}${webm}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', mp4]);
    // Stills: the brush at work, the pencil coming up beside it, the finished picture; the same for the lab;
    // the short brush back.
    const moments = [introAt + 0.5, introAt + 1.4, introAt + 2.4, introAt + 3.4, introAt + 5.4, toGrow + 1.2, toGrow + 2.6, toGrow + 6.2, toBuild + 0.7, toBuild + 2.4];
    const stills = [];
    for (const [i, at] of moments.entries()) {
      const file = `${dir}still-${i}.png`;
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(at), '-i', mp4, '-frames:v', '1', file]);
      stills.push(await sharp(file).resize({ height: 420 }).toBuffer());
    }
    await sheetOf([[`${name}: a first visit at about ${[0.5, 1.4, 2.4, 3.4, 5.4].join(', ')} s (the pencil comes up beside each stroke, never before it; then the finished picture)`, stills.slice(0, 5)], ['To Grow for the first time (its painting, the pencil with it), and back to Build (the short brush)', stills.slice(5)]], `${out}pencil-film-${name}-stills.jpg`);
    await rm(dir, { recursive: true, force: true });
    say(name, mp4);
  }
};

// All 20 can still be found: every mushroom of both scenes clicked (desktop) or tapped (phone, the room
// panned to it) at the middle of its drawing, with nothing forced, and the count read from the page.
run.find = async () => {
  const report = [];
  for (const [name, engine, options] of [['chrome, 1440 × 900', chromium, { viewport: { width: 1440, height: 900 } }], ['webkit, iPhone 14 profile', webkit, { ...devices['iPhone 14'] }], ['webkit, 320 × 640 phone', webkit, { ...devices['iPhone 14'], viewport: { width: 320, height: 640 } }]]) {
    const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {});
    const errors = [];
    const row = { browser: name };
    for (const scene of ['build', 'grow', 'design', 'film', 'set']) {
      // A page of its own for each scene: leaving a page mid-download logs errors that are not the site's.
      const page = await (await browser.newContext(options)).newPage();
      const seen = errorsOf(page);
      await page.goto(`${base}?debug&reset&intro=off&seed=7#${scene}`);
      await ready(page);
      const ids = await page.evaluate(() => [...document.querySelectorAll('.hj-plate .hj-shroom')].map((b) => b.dataset.spot));
      const missed = [];
      for (const id of ids) {
        const art = page.locator(`.hj-plate [data-spot="${id}"] .hj-shroom-art`);
        // Bring it into the window, as a visitor would by panning, then touch the drawing itself.
        await page.evaluate((spot) => { const view = document.querySelector('.hj-viewport'); const r = document.querySelector(`.hj-plate [data-spot="${spot}"]`).getBoundingClientRect(); const v = view.getBoundingClientRect(); view.scrollLeft += r.left + r.width / 2 - (v.left + v.width / 2); }, id);
        await page.waitForTimeout(250);
        const box = await art.boundingBox();
        const before = await page.evaluate(() => window.__hj.hunt.remaining);
        if (options.hasTouch) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForFunction((n) => window.__hj.hunt.remaining < n, before, { timeout: 4000 }).catch(() => missed.push(id));
        // Her reaction, and the mushroom's flight to the counter, before the next one.
        await page.waitForTimeout(700);
      }
      await page.waitForTimeout(1500);
      row[scene] = { mushrooms: ids.length, found: ids.length - missed.length, missed, leftOnThePage: await page.evaluate(() => window.__hj.hunt.remaining) };
      errors.push(...seen);
    }
    row.errors = errors;
    row.ok = ['build', 'grow', 'design', 'film', 'set'].every((scene) => row[scene].mushrooms === 10 && row[scene].found === 10 && row[scene].leftOnThePage === 0) && errors.length === 0;
    report.push(row);
    say(name, row);
    await browser.close();
  }
  await save('pencil-find.json', report);
  console.log(report.every((r) => r.ok) ? 'EVERY MUSHROOM FOUND at every size' : 'SOME MUSHROOMS COULD NOT BE FOUND');
};

const command = process.argv[2];
if (!run[command]) {
  console.error(`Unknown command "${command}". One of: ${Object.keys(run).join(', ')}`);
  process.exit(1);
}
await run[command]();

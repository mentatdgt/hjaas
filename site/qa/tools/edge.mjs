// The painting's watercolour edge (reviews/scene-edge-feather.md): screenshots of every style, the check
// that no mushroom or tap box sits in the fade, and frame times while panning. Needs `npm run dev`.
//
//   node qa/tools/edge.mjs shots   a-round (the default), a, b and c, both scenes, three sizes; and compare.jpg
//   node qa/tools/edge.mjs spots   reads the edge as drawn on the page under every mushroom and tap box
//   node qa/tools/edge.mjs pan     WebKit, phone: frame times while the room is panned end to end
//   node qa/tools/edge.mjs pick    which of each scene's possible organic edges keeps clear of the mushrooms and of Rachel
//   node qa/tools/edge.mjs rachel  the drawn edge under every pixel Rachel ever covers, both scenes
//   node qa/tools/edge.mjs organic the chosen mock-up beside the build at 1440×900: organic-compare.jpg
//   node qa/tools/edge.mjs reveal  mid-painting: nothing shows where the edge leaves paper
import { chromium, webkit, devices } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const base = process.env.HJ_URL ?? 'http://localhost:5173/';
const out = new URL('../edge/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const STYLES = ['organic', 'a-round', 'a', 'b', 'c'];
const NAMES = { organic: 'Organic (chosen, the default)', 'a-round': 'A with rounded corners (the one before)', a: 'A, light', b: 'B, medium', c: 'C, corners' };
const SIZES = [[1440, 900], [390, 844], [360, 740]];
const ready = (page) => page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 30000 });
const clean = (page) => page.evaluate(() => document.querySelectorAll('.hj-mushrooms').forEach((el) => el.classList.remove('is-debug')));
const say = (label, value) => console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);

// Everything Rachel ever covers, on the plate: all her frames drawn where the page draws them.
const unionOf = async (scene) => {
  const W = 1672; const H = 941;
  const bitmap = async (url) => createImageBitmap(await (await fetch(url)).blob());
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (scene.character.kind === 'clips') {
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

const run = {
  async shots() {
    const browser = await chromium.launch({ channel: 'chrome' });
    const shots = {};
    for (const style of STYLES) {
      for (const scene of ['build', 'grow']) {
        for (const [width, height] of SIZES) {
          const phone = width <= 600;
          const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
          const page = await context.newPage();
          await page.goto(`${base}?debug&reset&intro=off&seed=7&edge=${style}#${scene}`);
          await ready(page);
          await clean(page);
          await page.getByRole('button', { name: 'Pause animation' }).click();
          await page.waitForTimeout(700);
          const name = `${style}-${scene}-${width}x${height}`;
          shots[name] = await page.screenshot();
          await sharp(shots[name]).jpeg({ quality: 88 }).toFile(`${out}${name}.jpg`);
          if (phone && width === 390) {
            // The far ends of the room on a phone: the plate's own edge, not the window's.
            for (const [end, left] of [['left', 0], ['right', 99999]]) {
              await page.evaluate((x) => { document.querySelector('.hj-viewport').scrollLeft = x; }, left);
              await page.waitForTimeout(300);
              shots[`${name}-${end}`] = await page.screenshot();
              await sharp(shots[`${name}-${end}`]).jpeg({ quality: 88 }).toFile(`${out}${name}-${end}.jpg`);
            }
          }
          await context.close();
        }
      }
    }
    await browser.close();

    // One picture to choose from: the four styles on desktop, for both scenes, then the phone.
    const W = 896;
    const H = 560;
    const PW = 260;
    const PH = Math.round((PW * 844) / 390);
    const gap = 16;
    const head = 44;
    const width = gap + STYLES.length * (W / 2 + gap);
    const tiles = [];
    const labels = [];
    const label = (text, x, y, size = 20) => labels.push(`<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" fill="#302e29">${text}</text>`);
    let y = 0;
    for (const scene of ['build', 'grow']) {
      for (let i = 0; i < STYLES.length; i++) {
        const x = gap + i * (W / 2 + gap);
        if (scene === 'build') label(NAMES[STYLES[i]], x, y + 30, 18);
        tiles.push({ input: await sharp(shots[`${STYLES[i]}-${scene}-1440x900`]).resize(W / 2, H / 2).toBuffer(), left: x, top: y + (scene === 'build' ? head : gap) });
      }
      y += H / 2 + (scene === 'build' ? head : gap);
    }
    y += gap;
    label('The chosen edge, large', gap, y + 30);
    const bigW = width - 2 * gap;
    const bigH = Math.round((bigW * 900) / 1440);
    tiles.push({ input: await sharp(shots['organic-build-1440x900']).resize(bigW, bigH).toBuffer(), left: gap, top: y + head });
    y += head + bigH + gap;
    label('On a phone (390 × 844): opening view, panned fully left, panned fully right. The chosen edge, then the one before, then A', gap, y + 30);
    y += head;
    let x = gap;
    for (const style of STYLES) {
      for (const suffix of ['', '-left', '-right']) {
        if (x + PW > width) break;
        tiles.push({ input: await sharp(shots[`${style}-build-390x844${suffix}`]).resize(PW, PH).toBuffer(), left: x, top: y });
        x += PW + 6;
      }
      x += gap;
    }
    y += PH + gap;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}">${labels.join('')}</svg>`;
    await sharp({ create: { width, height: y, channels: 3, background: '#d9d6cf' } }).composite([{ input: Buffer.from(svg), left: 0, top: 0 }, ...tiles]).jpeg({ quality: 86 }).toFile(`${out}compare.jpg`);
    say('compare', `${out}compare.jpg`);
  },

  // The edge as it is actually drawn on the page, read back under every mushroom and every tap box.
  async spots() {
    const report = [];
    for (const [engine, width, height] of [['chrome', 1440, 900], ['chrome', 2560, 1440], ['webkit', 390, 844], ['webkit', 360, 740], ['webkit', 320, 640]]) {
      const phone = width <= 600;
      const browser = engine === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
      const context = await browser.newContext(phone ? { ...devices['iPhone 14'], viewport: { width, height } } : { viewport: { width, height } });
      const page = await context.newPage();
      for (const scene of ['build', 'grow']) {
        await page.goto(`${base}?debug&reset&intro=off&seed=7#${scene}`);
        await page.reload();
        await ready(page);
        const rows = await page.evaluate(() => {
          const plate = document.querySelector('.hj-plate');
          const edge = plate.querySelector('.hj-edge');
          const data = edge.getContext('2d').getImageData(0, 0, edge.width, edge.height).data;
          const p = plate.getBoundingClientRect();
          // How much of the painting shows at a point of the page: 1 minus the paper overlay's opacity there.
          const shows = (x, y) => {
            const ex = Math.min(edge.width - 1, Math.max(0, Math.floor(((x - p.left) / p.width) * edge.width)));
            const ey = Math.min(edge.height - 1, Math.max(0, Math.floor(((y - p.top) / p.height) * edge.height)));
            return 1 - data[(ey * edge.width + ex) * 4 + 3] / 255;
          };
          const lowest = (r) => { let min = 1; for (let j = 0; j <= 10; j++) for (let i = 0; i <= 10; i++) min = Math.min(min, shows(r.left + (r.width * i) / 10, r.top + (r.height * j) / 10)); return min; };
          return [...plate.querySelectorAll('.hj-shroom')].map((button) => {
            const box = button.getBoundingClientRect();
            const art = button.querySelector('.hj-shroom-art').getBoundingClientRect();
            return { id: button.dataset.spot, drawing: Math.round(lowest(art) * 1000) / 1000, tapBox: Math.round(lowest(box) * 1000) / 1000, box: [Math.round(box.width), Math.round(box.height)], moved: [Math.round(box.left + box.width / 2 - (art.left + art.width / 2)), Math.round(box.top + box.height / 2 - (art.top + art.height / 2))],
              covers: art.left >= box.left - 0.6 && art.right <= box.right + 0.6 && art.top >= box.top - 0.6 && art.bottom <= box.bottom + 0.6, rect: [box.left - p.left, box.top - p.top, box.width, box.height] };
          });
        });
        const overlaps = [];
        for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
          const [ax, ay, aw, ah] = rows[i].rect; const [bx, by, bw, bh] = rows[j].rect;
          if (ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah) overlaps.push(`${rows[i].id}/${rows[j].id}`);
        }
        const row = { engine, size: `${width}x${height}`, scene, spots: rows.length, lowestUnderADrawing: Math.min(...rows.map((r) => r.drawing)), lowestUnderATapBox: Math.min(...rows.map((r) => r.tapBox)), smallestBox: Math.min(...rows.map((r) => Math.min(...r.box))), everyBoxCoversItsDrawing: rows.every((r) => r.covers), boxesMovedInward: rows.filter((r) => r.moved[0] || r.moved[1]).map((r) => `${r.id} ${r.moved.join(',')}px`), overlaps };
        row.ok = row.spots === 10 && row.lowestUnderADrawing >= 0.95 && row.lowestUnderATapBox >= 0.95 && row.smallestBox >= 44 && row.everyBoxCoversItsDrawing && overlaps.length === 0;
        report.push(row);
        say(`${engine} ${width}x${height} ${scene}`, row);
      }
      await browser.close();
    }
    await writeFile(`${out}spots.json`, `${JSON.stringify(report, null, 1)}\n`);
    console.log(report.every((r) => r.ok) ? 'ALL SOLID: every mushroom and tap box is over at least 0.95 of the painting' : 'SOME SPOTS ARE IN THE FADE');
  },

  async pan() {
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
      say(`pan run ${i + 1}`, row);
      await browser.close();
    }
    // (HJ_EDGE=a-round measures an older edge, for comparison, and does not overwrite the record.)
    if (!process.env.HJ_EDGE) await writeFile(`${out}pan-webkit.json`, `${JSON.stringify(results, null, 1)}\n`);
  },
};

// Which of a scene's possible edges to use: the first whose wander stays clear of every mushroom, every tap
// box (at six screen sizes) and every pixel Rachel ever covers. Prints the number for the scene's config.
run.pick = async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.on('console', (m) => m.type() === 'error' && console.log('[page]', m.text()));
  await page.goto(`${base}?debug&reset&intro=off&seed=7`);
  await ready(page);
  await page.evaluate(`window.__unionOf = ${unionOf.toString()}`);
  const result = await page.evaluate(async (tries) => {
    const { edgeAlpha, edgeSeed, tapBox, lowestAlpha, SOLID } = await import('/src/engine/edge.ts');
    const { SCENES } = await import('/src/scenes/index.ts');
    const H = 941;
    const ASPECT = [152, 117, 149, 164, 45, 166, 158, 163, 166].map((w) => w / 154);
    const SCALES = [1799 / 1672, 1040 / 1672, 820 / 1672, 531 / 941, 486 / 941, 355 / 941];
    const unionOf = window.__unionOf;
    const out = {};
    for (const scene of SCENES) {
      // (The page was opened on the first scene, where scene 1's placement is known.)
      const hers = await unionOf(scene);
      const rows = [];
      for (let n = 0; n < tries; n++) {
        const alpha = edgeAlpha('organic', edgeSeed(n ? `${scene.id}:${n}` : scene.id));
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
        // A mushroom the wander reaches: the smallest move, towards the middle of the plate, that clears it.
        // (Straight up or down first; if that is not enough within 60 px, sideways as well.)
        const failed = [];
        const placed = scene.spots.map((spot) => {
          if (clear(spot)) return spot;
          const dy = spot.y > H / 2 ? -1 : 1;
          for (let move = 1; move <= 60; move++) {
            const moved = { ...spot, y: spot.y + dy * move };
            if (clear(moved)) { failed.push(`${spot.id} ${dy * move}`); return moved; }
          }
          failed.push(`${spot.id} (more than 60)`);
          return spot;
        });
        // Tap boxes must not come to overlap once the edge has pushed them inward.
        let overlap = false;
        for (const u of SCALES) {
          const boxes = placed.map((spot) => tapBox(alpha, { cx: spot.x, cy: spot.y - spot.h / 2, w: spot.h * ASPECT[spot.art - 1], h: spot.h }, u));
          for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (Math.abs(boxes[i].cx - boxes[j].cx) < (boxes[i].w + boxes[j].w) / 2 && Math.abs(boxes[i].cy - boxes[j].cy) < (boxes[i].h + boxes[j].h) / 2) overlap = `${placed[i].id}/${placed[j].id}`;
        }
        let lowest = 1;
        for (const [x, y] of hers.points) { const a = alpha(x, y); if (a < lowest) lowest = a; }
        rows.push({ n, failed, overlap, rachelLowest: Math.round(lowest * 1000) / 1000 });
      }
      out[scene.id] = { rachelCovers: hers.box, firstClean: rows.find((r) => r.failed.length === 0 && !r.overlap && r.rachelLowest >= 0.999)?.n ?? null, rows };
    }
    return out;
  }, Number(process.argv[3] ?? 48));
  for (const [id, r] of Object.entries(result)) {
    say(`${id}: Rachel covers plate x ${r.rachelCovers[0]}-${r.rachelCovers[2]}, y ${r.rachelCovers[1]}-${r.rachelCovers[3]}; first clean edge`, String(r.firstClean));
    for (const row of r.rows) console.log(`   ${String(row.n).padStart(2)}  rachel ${row.rachelLowest}  ${row.overlap ? `OVERLAP ${row.overlap}  ` : ''}${row.failed.length ? `to move (plate px): ${row.failed.join(', ')}` : 'all mushrooms clear'}`);
  }
  await browser.close();
  await writeFile(`${out}organic-pick.json`, `${JSON.stringify(result, null, 1)}\n`);
};

// Rachel must be fully opaque in every pose: the edge as drawn on the page, read under every pixel any of her
// frames ever covers, in both scenes.
run.rachel = async () => {
  const report = [];
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  let buildBox = null;
  for (const id of ['build', 'grow']) {
    await page.goto(`${base}?debug&reset&intro=off&seed=7#${id}`);
    await page.reload();
    await ready(page);
    await page.evaluate(`window.__unionOf = ${unionOf.toString()}`);
    if (id === 'build') buildBox = await page.evaluate(() => { const p = window.__hj.rachel.placement; return { left: p.left, top: p.top, width: p.width, height: p.height }; });
    const row = await page.evaluate(async ({ id, buildBox }) => {
      const { edgeAlpha, edgeSeed, edgeName } = await import('/src/engine/edge.ts');
      const { SCENES } = await import('/src/scenes/index.ts');
      window.__buildBox = buildBox;
      const scene = SCENES.find((s) => s.id === id);
      const hers = await window.__unionOf(scene);
      const alpha = edgeAlpha('organic', edgeSeed(edgeName(scene)));
      const edge = document.querySelector('.hj-plate .hj-edge');
      const data = edge.getContext('2d').getImageData(0, 0, edge.width, edge.height).data;
      let formula = 1; let drawn = 1; let worst = null;
      for (const [x, y] of hers.points) {
        const a = alpha(x, y);
        if (a < formula) { formula = a; worst = [x, y]; }
        const ex = Math.min(edge.width - 1, Math.floor((x / 1672) * edge.width));
        const ey = Math.min(edge.height - 1, Math.floor((y / 941) * edge.height));
        drawn = Math.min(drawn, 1 - data[(ey * edge.width + ex) * 4 + 3] / 255);
      }
      // How close the fade comes: the nearest point of the plate, to her, where the painting is under 0.999.
      let nearest = Infinity;
      for (const [x, y] of hers.points) {
        if (y < hers.box[3] - 40 && x > hers.box[0] + 40 && x < hers.box[2] - 40) continue;
        for (let d = 2; d < nearest; d += 2) { if (alpha(x, y + d) < 0.999 || alpha(x - d, y) < 0.999 || alpha(x + d, y) < 0.999) { nearest = d; break; } if (d > 120) break; }
      }
      return { scene: id, edge: scene.edge ?? 0, herFramesCoverPlate: { x: [hers.box[0], hers.box[2]], y: [hers.box[1], hers.box[3]] }, pixelsChecked: hers.points.length, lowestByTheFormula: formula, lowestOnTheDrawnEdge: Math.round(drawn * 1000) / 1000, worstPoint: worst, fadeComesNoNearerThanPx: nearest };
    }, { id, buildBox });
    row.ok = row.lowestByTheFormula >= 0.999 && row.lowestOnTheDrawnEdge >= 0.995;
    report.push(row);
    say(id, row);
  }
  await browser.close();
  await writeFile(`${out}organic-rachel.json`, `${JSON.stringify(report, null, 1)}\n`);
};

// The chosen mock-up (option 2 of edge-organic-123.jpg) beside the build at 1440×900, and stretches of the
// edge of each, enlarged.
run.organic = async () => {
  const mock = new URL('../../../reference/mockups/edge-organic-123.jpg', import.meta.url).pathname;
  // Option 2 in the sheet, and where its painting sits in that crop: measured from the image.
  const sheet = { left: 0, top: 740, width: 1100, height: 640 };
  const M = { left: 42, top: 36, width: 1015, height: 571 };
  const browser = await chromium.launch({ channel: 'chrome' });
  const shots = {};
  for (const scene of ['build', 'grow']) {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await page.goto(`${base}?debug&reset&intro=off&seed=7#${scene}`);
    await page.reload();
    await ready(page);
    await clean(page);
    await page.getByRole('button', { name: 'Pause animation' }).click();
    await page.evaluate(() => { document.querySelector('.hj-masthead').style.visibility = 'hidden'; document.querySelector('.hj-caption').style.visibility = 'hidden'; });
    await page.waitForTimeout(700);
    const box = await page.locator('.hj-window').boundingBox();
    // The same share of paper around the painting as the mock-up has.
    const k = box.width / M.width;
    shots[scene] = await page.screenshot({ clip: { x: Math.round(box.x - M.left * k), y: Math.round(box.y - M.top * k), width: Math.round(sheet.width * k), height: Math.round(sheet.height * k) } });
    await page.close();
  }
  await browser.close();
  const meta = await sharp(shots.build).metadata();
  const W = meta.width;
  const H = meta.height;
  const mockup = await sharp(mock).extract(sheet).resize(W, H, { fit: 'fill' }).toBuffer();
  const gap = 16;
  const head = 34;
  const text = (t, width) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="30"><text x="4" y="20" font-family="Helvetica, Arial, sans-serif" font-size="17" fill="#302e29">${t}</text></svg>`);
  // A stretch of the edge, twice the size: fx, fy are where it starts, as shares of the picture.
  const c = Math.round(W * 0.235);
  const detail = (image, fx, fy) => sharp(image).extract({ left: Math.min(W - c, Math.round(W * fx)), top: Math.min(H - c, Math.round(H * fy)), width: c, height: c }).resize(c * 2, c * 2).toBuffer();
  const tiles = [];
  let y = gap;
  const row = async (title, items) => {
    if (title) { tiles.push({ input: text(title, 2 * W + gap), left: gap, top: y }); y += head; }
    let x = gap;
    let tallest = 0;
    for (const item of items) {
      const m = await sharp(item).metadata();
      tiles.push({ input: item, left: x, top: y });
      x += m.width + gap;
      tallest = Math.max(tallest, m.height);
    }
    y += tallest + gap;
  };
  await row('The chosen mock-up, option 2 (left) and the build at 1440 × 900 (right), at the same size. The wander is seeded per scene, so the shapes differ; the character of the edge is what should match.', [mockup, shots.build]);
  await row('Stretches of the edge, twice the size: top left, mock-up then build; right side, mock-up then build', [await detail(mockup, 0, 0), await detail(shots.build, 0, 0), await detail(mockup, 0.77, 0.3), await detail(shots.build, 0.77, 0.3)]);
  await row('Bottom left, mock-up then build; bottom right, mock-up then build', [await detail(mockup, 0, 0.6), await detail(shots.build, 0, 0.6), await detail(mockup, 0.77, 0.6), await detail(shots.build, 0.77, 0.6)]);
  await row('The lab (Grow) at 1440 × 900', [shots.grow]);
  const file = `${out}organic-compare.jpg`;
  await sharp({ create: { width: 2 * W + 3 * gap, height: y, channels: 3, background: '#d9d6cf' } }).composite(tiles).jpeg({ quality: 90 }).toFile(file);
  say('organic-compare', file);
};

// The paint-in must reveal into the edge's shape: at several moments of a first-visit painting, every point
// the edge leaves as paper is still paper on the screen, while the brush is at work inside.
run.reveal = async () => {
  const report = [];
  const browser = await chromium.launch({ channel: 'chrome' });
  for (const id of ['build', 'grow']) {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await page.goto(`${base}?debug&reset&seed=7#${id}`);
    await page.waitForFunction(() => window.__hj?.marks.introStart > 0, null, { timeout: 30000 });
    await clean(page);
    const plate = await page.locator('.hj-plate').boundingBox();
    const points = await page.evaluate(async (id) => {
      const { edgeAlpha, edgeSeed, edgeName } = await import('/src/engine/edge.ts');
      const { SCENES } = await import('/src/scenes/index.ts');
      const alpha = edgeAlpha('organic', edgeSeed(edgeName(SCENES.find((s) => s.id === id))));
      const paper = []; const inside = [];
      // "Paper" means paper there and for 6 px around: the edge is drawn at half size and stretched, so right
      // beside a crisp stretch of it a point can carry a trace of its neighbour.
      const around = [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6], [4, 4], [-4, 4], [4, -4], [-4, -4]];
      for (let y = 3; y < 941; y += 6) for (let x = 3; x < 1672; x += 6) { const a = alpha(x, y); if (around.every(([dx, dy]) => alpha(x + dx, y + dy) <= 0.001)) paper.push([x, y]); else if (a >= 0.999) inside.push([x, y]); }
      return { paper, inside };
    }, id);
    const rows = [];
    for (const at of [1200, 2400, 3600]) {
      await page.waitForFunction((t) => performance.now() - window.__hj.marks.introStart >= t, at, { polling: 'raf' });
      const shot = await sharp(await page.screenshot({ clip: plate })).raw().toBuffer({ resolveWithObject: true });
      const k = shot.info.width / 1672;
      const c = shot.info.channels;
      const px = ([x, y]) => { const i = (Math.min(shot.info.height - 1, Math.round(y * k)) * shot.info.width + Math.min(shot.info.width - 1, Math.round(x * k))) * c; return [shot.data[i], shot.data[i + 1], shot.data[i + 2]]; };
      const isPaper = (p) => Math.abs(p[0] - 246) <= 4 && Math.abs(p[1] - 243) <= 4 && Math.abs(p[2] - 236) <= 4;
      const stray = points.paper.filter((p) => !isPaper(px(p))).length;
      const painted = points.inside.filter((p) => !isPaper(px(p))).length;
      rows.push({ atMs: at, pointsThatMustBePaper: points.paper.length, notPaper: stray, shareOfTheInsidePainted: `${Math.round((painted / points.inside.length) * 100)}%` });
      if (at === 2400) await sharp(await page.screenshot()).jpeg({ quality: 88 }).toFile(`${out}organic-${id}-mid-painting.jpg`);
    }
    report.push({ scene: id, moments: rows, ok: rows.every((r) => r.notPaper === 0) });
    say(id, report.at(-1));
    await page.close();
  }
  await browser.close();
  await writeFile(`${out}organic-reveal.json`, `${JSON.stringify(report, null, 1)}\n`);
};

const command = process.argv[2];
if (!run[command]) {
  console.error(`Unknown command "${command}". One of: ${Object.keys(run).join(', ')}`);
  process.exit(1);
}
await run[command]();

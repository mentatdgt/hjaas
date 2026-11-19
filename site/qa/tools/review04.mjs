// Review 04 (reviews/scene-2-review-04.md): checks and evidence, one command per item. Needs `npm run dev`
// (5173); the frame-time commands need the production build on 4173 (`npm run build && npm run preview`).
//
//   node qa/tools/review04.mjs handoff   item 1: the cut from the aim still into mist_to_write and back, frame by frame
//   node qa/tools/review04.mjs corners   item 2: the mock-up beside the build at 1440×900
import { chromium, webkit, devices } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const base = process.env.HJ_URL ?? 'http://localhost:5173/';
const out = new URL('../review-04/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const chrome = (headless = true) => chromium.launch({ channel: 'chrome', headless });
const ready = (page) => page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 30000 });
const clean = (page) => page.evaluate(() => document.querySelectorAll('.hj-mushrooms').forEach((el) => el.classList.remove('is-debug')));
const say = (label, value) => console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
const save = (name, data) => writeFile(`${out}${name}.json`, `${JSON.stringify(data, null, 1)}\n`);
const label = (text, width, size = 15) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${size + 12}"><text x="4" y="${size + 2}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" fill="#302e29">${text}</text></svg>`);

const run = {
  // Every pose around the hand-off, shown one at a time on the real page: how much of the figure changes
  // from each to the next, a strip of the frames, and the same frames as a slow film.
  async handoff() {
    const report = {};
    for (const [tag, launch, options] of [
      ['desktop-chrome', () => chrome(), { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
      ['iphone-webkit', () => webkit.launch(), { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } }],
    ]) {
      const browser = await launch();
      const page = await (await browser.newContext(options)).newPage();
      await page.goto(`${base}?debug&reset&intro=off&seed=7#grow`);
      await ready(page);
      await clean(page);
      await page.waitForFunction(() => window.__hj.rachel.has('thumbs_up#9'), null, { timeout: 60000 });
      const frames = await (await page.request.get(`${base}assets/scene2/rachel/frames.json`)).json();
      const last = frames.clips.mist_to_write.frames.length - 1;
      const loopLast = frames.clips.write_loop.frames.length - 1;
      const m = (i) => `mist_to_write#${i}`;
      // Into the clip, the clip into the writing loop, the loop's own join, and all the way back out.
      const sequence = ['A3_mist_lift', 'A1_mist_aim', m(0), m(1), m(2), m(3), m(4), m(5), m(6), m(last - 1), m(last), 'write_loop#0', 'write_loop#1', `write_loop#${loopLast}`, 'write_loop#0', `write_loop#${loopLast}`, m(last), m(last - 1), m(3), m(2), m(1), m(0), 'A1_mist_aim'];
      await page.evaluate(() => {
        const h = window.__hj;
        h.player.stop();
        const canvas = document.querySelector('.hj-rachel canvas');
        const ctx = canvas.getContext('2d');
        // Chrome draws slightly differently once a canvas's pixels have been read: a few throwaway reads first.
        for (let n = 0; n < 6; n++) { h.rachel.show(n % 2 ? 'A1_mist_aim' : 'A2_mist_squeeze'); ctx.getImageData(0, 0, 2, 2); }
        window.__grab = (pose) => { h.rachel.show(pose); return ctx.getImageData(0, 0, canvas.width, canvas.height).data; };
      });
      const box = await page.locator('.hj-rachel').boundingBox();
      const rows = [];
      const shots = [];
      for (let i = 0; i < sequence.length; i++) {
        const changed = await page.evaluate(({ pose, first }) => {
          const now = window.__grab(pose);
          const before = window.__before;
          window.__before = now.slice();
          if (first) return null;
          let figure = 0; let moved = 0;
          for (let k = 0; k < now.length; k += 4) {
            if (now[k + 3] === 0 && before[k + 3] === 0) continue;
            figure++;
            if (Math.max(Math.abs(now[k] - before[k]), Math.abs(now[k + 1] - before[k + 1]), Math.abs(now[k + 2] - before[k + 2]), Math.abs(now[k + 3] - before[k + 3])) > 24) moved++;
          }
          return Math.round((moved / figure) * 1000) / 10;
        }, { pose: sequence[i], first: i === 0 });
        // Two frames, so the screenshot shows the pose just drawn.
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        shots.push(await page.screenshot({ clip: box }));
        if (i > 0) rows.push({ from: sequence[i - 1], to: sequence[i], figureChanged: `${changed}%` });
      }
      // And the whole transition, every frame to the next, to tell a cut from ordinary movement.
      const whole = [];
      for (let i = 0; i <= last; i++) {
        whole.push(await page.evaluate(({ pose, first }) => {
          const now = window.__grab(pose);
          const before = window.__before;
          window.__before = now.slice();
          if (first) return null;
          let figure = 0; let moved = 0;
          for (let k = 0; k < now.length; k += 4) {
            if (now[k + 3] === 0 && before[k + 3] === 0) continue;
            figure++;
            if (Math.max(Math.abs(now[k] - before[k]), Math.abs(now[k + 1] - before[k + 1]), Math.abs(now[k + 2] - before[k + 2]), Math.abs(now[k + 3] - before[k + 3])) > 24) moved++;
          }
          return Math.round((moved / figure) * 1000) / 10;
        }, { pose: m(i), first: i === 0 }));
      }
      report[tag] = rows;
      report[`${tag}-every-step-of-mist_to_write`] = whole.slice(1);
      say(`${tag} every step of mist_to_write, % of the figure changed`, whole.slice(1).join(' '));
      say(tag, rows.map((r) => `${r.from} > ${r.to}: ${r.figureChanged}`).join('\n  '));
      await browser.close();

      // The strip: each frame with its name and how much of the figure changed to get there.
      const W = 190;
      const meta = await sharp(shots[0]).metadata();
      const H = Math.round((W * meta.height) / meta.width);
      const perRow = 12;
      const rowH = H + 46;
      const tiles = [];
      for (let i = 0; i < shots.length; i++) {
        const x = 8 + (i % perRow) * (W + 8);
        const y = 8 + Math.floor(i / perRow) * rowH;
        tiles.push({ input: await sharp(shots[i]).resize(W, H).toBuffer(), left: x, top: y + 42 });
        tiles.push({ input: label(sequence[i].replace('mist_to_write', 'm_to_w'), W, 13), left: x, top: y });
        if (i > 0) tiles.push({ input: label(`changed: ${rows[i - 1].figureChanged}`, W, 13), left: x, top: y + 19 });
      }
      await sharp({ create: { width: 8 + perRow * (W + 8), height: 8 + Math.ceil(shots.length / perRow) * rowH, channels: 3, background: '#f6f3ec' } }).composite(tiles).jpeg({ quality: 88 }).toFile(`${out}handoff-${tag}-strip.jpg`);

      // The same frames as a film, half a second each, to step through.
      const tmp = join(out, `.tmp-handoff-${tag}`);
      await mkdir(tmp, { recursive: true });
      for (let i = 0; i < shots.length; i++) await sharp(shots[i]).resize({ width: 2 * Math.round(meta.width / 4) * 2 > 720 ? 720 : undefined }).png().toFile(join(tmp, `f${String(i).padStart(3, '0')}.png`));
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '2', '-i', join(tmp, 'f%03d.png'), '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2:color=0xf6f3ec', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-r', '30', `${out}handoff-${tag}-frame-by-frame.mp4`]);
      await rm(tmp, { recursive: true, force: true });
    }
    await save('handoff', report);
  },

  // The chosen mock-up beside the build at 1440×900, and the corners of each, enlarged.
  async corners() {
    const mock = new URL('../../../reference/mockups/edge-CHOSEN-A-rounded.jpg', import.meta.url).pathname;
    // Where the painting sits in the mock-up (1100 × 656): measured from the image.
    const M = { left: 55, top: 44, width: 992, height: 566 };
    const browser = await chrome();
    const shots = {};
    for (const scene of ['build', 'grow']) {
      const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
      await page.goto(`${base}?debug&reset&intro=off&seed=7#${scene}`);
      await ready(page);
      await clean(page);
      await page.getByRole('button', { name: 'Pause animation' }).click();
      await page.waitForTimeout(700);
      const box = await page.locator('.hj-window').boundingBox();
      // The same share of paper around the painting as the mock-up has.
      const k = box.width / M.width;
      const clip = { x: Math.round(box.x - M.left * k), y: Math.round(box.y - M.top * k), width: Math.round(1100 * k), height: Math.round(656 * k) };
      shots[scene] = { image: await page.screenshot({ clip }), k, clip, box };
      await page.close();
    }
    await browser.close();
    const { k, clip } = shots.build;
    const W = clip.width;
    const H = clip.height;
    const mockup = await sharp(mock).resize(W, H, { fit: 'fill' }).toBuffer();
    const gap = 16;
    const head = 34;
    // Corner close-ups: the outer 16% of the width, twice the size.
    const c = Math.round(W * 0.17);
    const corner = (image, right, bottom) => sharp(image).extract({ left: right ? W - c - Math.round(M.left * k * 0.3) : Math.round(M.left * k * 0.3), top: bottom ? H - c - Math.round(M.top * k * 0.3) : Math.round(M.top * k * 0.3), width: c, height: c }).resize(c * 2, c * 2).toBuffer();
    const tiles = [];
    let y = gap;
    const row = async (title, items) => {
      tiles.push({ input: label(title, 2 * W + gap, 17), left: gap, top: y });
      y += head;
      let x = gap;
      let tallest = 0;
      for (const item of items) {
        const meta = await sharp(item).metadata();
        tiles.push({ input: item, left: x, top: y });
        x += meta.width + gap;
        tallest = Math.max(tallest, meta.height);
      }
      y += tallest + gap;
    };
    await row('The chosen mock-up (left) and the build at 1440 × 900 (right), at the same size', [mockup, shots.build.image]);
    await row('Corners, twice the size: top left, mock-up then build; bottom right, mock-up then build', [await corner(mockup, false, false), await corner(shots.build.image, false, false), await corner(mockup, true, true), await corner(shots.build.image, true, true)]);
    await row('Top right and bottom left, mock-up then build; and the lab (Grow) at 1440 × 900', [await corner(mockup, true, false), await corner(shots.build.image, true, false), await corner(mockup, false, true), await corner(shots.build.image, false, true)]);
    await row('', [shots.grow.image]);
    const file = new URL('../edge/corners.jpg', import.meta.url).pathname;
    await sharp({ create: { width: 2 * W + 3 * gap, height: y, channels: 3, background: '#d9d6cf' } }).composite(tiles).jpeg({ quality: 90 }).toFile(file);
    say('corners', file);
  },
};

const command = process.argv[2];
if (!run[command]) {
  console.error(`Unknown command "${command}". One of: ${Object.keys(run).join(', ')}`);
  process.exit(1);
}
await run[command]();

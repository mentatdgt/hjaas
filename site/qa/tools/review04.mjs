// Review 04 (reviews/scene-2-review-04.md): checks and evidence, one command per item. Needs `npm run dev`
// (5173); the frame-time commands need the production build on 4173 (`npm run build && npm run preview`).
//
//   node qa/tools/review04.mjs handoff   item 1: the cut from the aim still into mist_to_write and back, frame by frame
//   node qa/tools/review04.mjs corners   item 2: the mock-up beside the build at 1440×900
//   node qa/tools/review04.mjs memory    item 3: decoded image memory through two cycles and a reaction, phone and desktop
//   node qa/tools/review04.mjs sharp     item 3: the 1.5× set beside the 2× set on a 390×844 @3× screen
//   node qa/tools/review04.mjs cycle     item 4: WebKit, frame times through two full cycles of the routine and five finds
//   node qa/tools/review04.mjs slow      item 3: does decoding keep ahead of her on a slow phone? (Chrome, CPU slowed 4× and 6×)
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

  // Decoded image memory with Grow open, from the bitmap sizes: sampled every frame through two full cycles
  // of the routine, a reaction from misting and one from writing; then after leaving for Build.
  async memory() {
    const report = {};
    const MB = (bytes) => Math.round(bytes / 1e5) / 10;
    for (const [tag, launch, options] of [
      ['iphone-webkit', () => webkit.launch(), { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } }],
      ['desktop-chrome', () => chrome(), { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
    ]) {
      const browser = await launch();
      const page = await (await browser.newContext(options)).newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await page.goto(`${base}?debug&reset&intro=off&seed=4#grow`);
      await ready(page);
      await page.waitForFunction(() => window.__hj.rachel.has('thumbs_up#9'), null, { timeout: 60000 });
      // "Before": everything of hers decoded at once, at the delivered size, as the site did until now.
      const before = await page.evaluate(async () => {
        const frames = await (await fetch('./assets/scene2/rachel/frames.json')).json();
        const size = async (file) => { const img = new Image(); img.src = `./assets/scene2/rachel/${file.replace('.png', '.webp')}`; await img.decode(); return img.naturalWidth * img.naturalHeight * 4; };
        const stills = Object.keys(frames.stills).length * frames.canvas.w * frames.canvas.h * 4;
        const clips = {};
        for (const [name, clip] of Object.entries(frames.clips)) clips[name] = (await size(clip.frames[0])) * clip.frames.length;
        return { stills, clips };
      });
      await page.evaluate(() => {
        const log = { peak: 0, peakClips: 0, at: '', samples: 0 };
        window.__mem = log;
        const tick = () => {
          const m = window.__hj.scene.memory;
          if (!m) return;
          const total = m.stills + m.canvases + m.clipFrames;
          log.samples++;
          if (total > log.peak) { log.peak = total; log.at = window.__hj.rachel.current; log.parts = { ...m }; }
          log.peakClips = Math.max(log.peakClips, m.clipFrames);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        window.__hj.poses.length = 0;
      });
      await page.waitForFunction(() => window.__hj.poses.filter(([p], i, a) => p === 'mist_to_write#0' && a[i - 1]?.[0] === 'mist_to_write#1').length >= 2, null, { timeout: 120000 });
      const find = async (spot, when) => {
        await page.waitForFunction(when, null, { timeout: 60000 });
        await page.evaluate(() => { window.__mark = window.__hj.poses.length; });
        await page.locator(`[data-spot="${spot}"]`).click({ force: true });
        await page.waitForFunction(() => window.__hj.poses.slice(window.__mark).some(([p]) => p === 'K2_thumbs'), null, { timeout: 20000 });
        await page.waitForFunction(() => !window.__hj.player.reacting, null, { timeout: 20000 });
        return page.evaluate(() => window.__hj.poses.slice(window.__mark).some(([p]) => p === 'look_up#3'));
      };
      const fullFromMisting = await find('pipe', () => window.__hj.rachel.current === 'A3_mist_lift');
      const fullFromWriting = await find('door', () => window.__hj.rachel.current === 'write_loop#6');
      const open = await page.evaluate(() => ({ ...window.__mem, missed: window.__hj.rachel.missed, set: window.__hj.scene.memory.canvasWidth, shownPoses: window.__hj.poses.length }));
      // Leave for Build: what stays decoded of the lab.
      await page.evaluate(() => { window.__lab = window.__hj.scene; });
      await page.locator('.hj-tab[data-scene="build"]').click();
      await page.waitForFunction(() => window.__hj.scene?.config.id === 'build' && window.__hj.busy === false, null, { timeout: 30000 });
      await page.waitForTimeout(500);
      const away = await page.evaluate(() => window.__lab.memory);
      // And back again: her frames are decoded afresh while the brush is at work.
      await page.locator('.hj-tab[data-scene="grow"]').click();
      await page.waitForFunction(() => window.__hj.scene?.config.id === 'grow' && window.__hj.busy === false, null, { timeout: 30000 });
      await page.evaluate(() => { window.__hj.poses.length = 0; });
      await page.waitForFunction(() => window.__hj.poses.some(([p]) => p === 'write_loop#5'), null, { timeout: 60000 });
      const back = await page.evaluate(() => ({ missed: window.__hj.rachel.missed, reactionReady: window.__hj.rachel.has('thumbs_up#9') && window.__hj.rachel.has('look_up#0') }));
      const allAtOnce = before.stills + Object.values(before.clips).reduce((a, b) => a + b, 0);
      report[tag] = {
        set: open.set === 980 ? '2x (as delivered)' : `1.5x (canvas ${open.set} px wide)`,
        beforeMB: { everythingDecodedAtOnce: MB(allAtOnce), stills: MB(before.stills), ...Object.fromEntries(Object.entries(before.clips).map(([k, v]) => [k, MB(v)])) },
        afterMB: { peakWithGrowOpen: MB(open.peak), atPose: open.at, stills: MB(open.parts.stills), canvases: MB(open.parts.canvases), clipFramesAtThatMoment: MB(open.parts.clipFrames), clipFramesPeak: MB(open.peakClips), afterLeavingForBuild: MB(away.stills + away.clipFrames) },
        samples: open.samples, posesShown: open.shownPoses, framesSheHadToSkip: open.missed, afterComingBackFromBuild: { framesSheHadToSkip: back.missed - open.missed, reactionFramesDecodedAgain: back.reactionReady }, fullReactionFromMisting: fullFromMisting, fullReactionFromWriting: fullFromWriting, errors,
      };
      say(tag, report[tag]);
      await browser.close();
    }
    await save('memory', report);
  },

  // The lighter set beside the delivered one, on the phone that needs the most of it: 390 × 844 at 3×.
  async sharp() {
    const browser = await webkit.launch();
    const shots = {};
    for (const set of ['1.5x', '2x']) {
      const context = await browser.newContext({ ...devices['iPhone 14'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
      const page = await context.newPage();
      // Without its manifest the lighter set is not used, and the site falls back to the delivered frames.
      if (set === '2x') await page.route('**/rachel-1.5x/frames.json', (route) => route.fulfill({ status: 404, body: '' }));
      await page.goto(`${base}?debug&reset&intro=off&seed=4#grow`);
      await ready(page);
      await clean(page);
      await page.getByRole('button', { name: 'Pause animation' }).click();
      await page.waitForTimeout(600);
      const info = await page.evaluate(() => { const c = document.querySelector('.hj-rachel canvas'); return { canvas: [c.width, c.height], css: Math.round(c.getBoundingClientRect().width * 10) / 10, source: window.__hj.scene.memory.canvasWidth }; });
      const box = await page.locator('.hj-rachel').boundingBox();
      shots[set] = { whole: await page.screenshot({ clip: box }), full: await page.screenshot(), info, box };
      say(set, info);
      await context.close();
    }
    await browser.close();
    // Whole figure, then her face and her hand with the bottle, at the screen's own pixels.
    const meta = await sharp(shots['1.5x'].whole).metadata();
    const crop = (image, fx, fy, size) => sharp(image).extract({ left: Math.round(meta.width * fx), top: Math.round(meta.height * fy), width: size, height: size }).toBuffer();
    const size = 420;
    const gap = 14;
    const head = 30;
    const tiles = [];
    let x = gap;
    for (const set of ['1.5x', '2x']) {
      const figureH = 2 * size + gap;
      const figureW = Math.round((figureH * meta.width) / meta.height);
      tiles.push({ input: label(set === '1.5x' ? `1.5× set (her canvas ${shots[set].info.canvas[0]} px), as phones now get` : `2× set (her canvas ${shots[set].info.canvas[0]} px), as before`, figureW + size + gap, 16), left: x, top: gap });
      tiles.push({ input: await sharp(shots[set].whole).resize(figureW, figureH).toBuffer(), left: x, top: gap + head });
      tiles.push({ input: await crop(shots[set].whole, 0.3, 0.02, size), left: x + figureW + gap, top: gap + head });
      tiles.push({ input: await crop(shots[set].whole, 0.02, 0.24, size), left: x + figureW + gap, top: gap + head + size + gap });
      x += figureW + size + 3 * gap;
    }
    await sharp({ create: { width: x, height: 2 * gap + head + 2 * size + gap, channels: 3, background: '#d9d6cf' } }).composite(tiles).jpeg({ quality: 92 }).toFile(`${out}sharpness-390x844@3x.jpg`);
    await sharp(shots['1.5x'].full).jpeg({ quality: 90 }).toFile(`${out}grow-390x844@3x-1.5x-set.jpg`);
    await save('sharpness', { '1.5x': shots['1.5x'].info, '2x': shots['2x'].info });
  },

  // A slow phone: the processor held to a quarter and a sixth of its speed. Does every clip frame arrive
  // in time to be shown, and how long are the frames?
  async slow() {
    const report = {};
    for (const rate of [4, 6]) {
      const browser = await chrome();
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      await context.addInitScript(() => {
        const log = [];
        window.__gaps = log;
        let last = performance.now();
        const tick = (now) => { log.push([Math.round(last), Math.round(now - last)]); last = now; requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      });
      const page = await context.newPage();
      await page.goto(`${base}?debug&reset&intro=off&seed=4#grow`);
      await ready(page);
      await page.waitForFunction(() => window.__hj.rachel.has('thumbs_up#9'), null, { timeout: 60000 });
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await page.waitForTimeout(1000);
      const t0 = await page.evaluate(() => { window.__hj.poses.length = 0; window.__missed0 = window.__hj.rachel.missed; return performance.now(); });
      await page.waitForFunction(() => window.__hj.poses.filter(([p], i, a) => p === 'mist_to_write#0' && a[i - 1]?.[0] === 'mist_to_write#1').length >= 2, null, { timeout: 180000 });
      await page.waitForFunction(() => window.__hj.rachel.current === 'write_loop#6', null, { timeout: 60000 });
      await page.locator('[data-spot="door"]').tap({ force: true });
      await page.waitForFunction(() => window.__hj.poses.some(([p]) => p === 'K2_thumbs'), null, { timeout: 30000 });
      await page.waitForFunction(() => !window.__hj.player.reacting, null, { timeout: 30000 });
      report[`cpu-${rate}x`] = await page.evaluate((start) => {
        const gaps = window.__gaps.filter(([at]) => at >= start);
        const sorted = gaps.map(([, len]) => len).sort((a, b) => a - b);
        return { set: window.__hj.scene.memory.canvasWidth === 980 ? '2x' : '1.5x', posesShown: window.__hj.poses.length, framesSheHadToSkip: window.__hj.rachel.missed - window.__missed0, fullReaction: window.__hj.poses.some(([p]) => p === 'look_up#3'), frames: gaps.length, medianFrameMs: sorted[sorted.length >> 1], longestFrameMs: sorted.at(-1), over50: gaps.filter(([, len]) => len > 50).length, peakMB: Math.round((window.__hj.scene.memory.stills + window.__hj.scene.memory.canvases + window.__hj.scene.memory.clipFramesPeak) / 1e5) / 10 };
      }, t0);
      say(`cpu ${rate}x`, report[`cpu-${rate}x`]);
      await browser.close();
    }
    await save('slow-phone', report);
  },

  // Item 4: every frame's length through two full cycles of her routine, then five finds at different
  // moments of it (each one: the tap, the mushroom's flight, the way home, the reaction).
  async cycle() {
    const report = {};
    const only = process.argv[3];
    for (const [tag, launch, options] of [
      ['iphone-webkit-with-window', () => webkit.launch({ headless: false }), { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } }],
      ['iphone-webkit', () => webkit.launch(), { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } }],
      ['desktop-webkit-with-window', () => webkit.launch({ headless: false }), { viewport: { width: 1280, height: 760 } }],
    ]) {
      if (only && !tag.includes(only)) continue;
      const browser = await launch();
      const context = await browser.newContext(options);
      await context.addInitScript(() => {
        const log = [];
        window.__gaps = log;
        let last = performance.now();
        const tick = (now) => { log.push([Math.round(last), Math.round(now - last)]); last = now; requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await page.goto(`${base}?debug&reset&intro=off&seed=4#grow`);
      await ready(page);
      await page.waitForFunction(() => window.__hj.rachel.has('thumbs_up#9'), null, { timeout: 60000 });
      await page.waitForTimeout(800);
      const t0 = await page.evaluate(() => { window.__hj.poses.length = 0; return performance.now(); });
      await page.waitForFunction(() => window.__hj.poses.filter(([p], i, a) => p === 'mist_to_write#0' && a[i - 1]?.[0] === 'mist_to_write#1').length >= 2, null, { timeout: 120000 });
      const routine = await page.evaluate((start) => {
        const gaps = window.__gaps.filter(([at]) => at >= start);
        const poseAt = (t) => { let name = ''; for (const [p, at] of window.__hj.poses) { if (at > t) break; name = p; } return name; };
        return { watchedS: Math.round((performance.now() - start) / 100) / 10, frames: gaps.length, longestFrameMs: Math.max(...gaps.map(([, len]) => len)), over50: gaps.filter(([, len]) => len > 50).map(([at, len]) => `${len} ms during ${poseAt(at)}`), over33: gaps.filter(([, len]) => len > 33).length, framesSheHadToSkip: window.__hj.rachel.missed };
      }, t0);
      // Five finds: while she aims, squeezes, is on her way to writing, writes, and is on her way back.
      const moments = [
        ['pipe', () => window.__hj.rachel.current === 'A1_mist_aim'],
        ['switch-box', () => window.__hj.rachel.current === 'A2_mist_squeeze'],
        ['door', () => window.__hj.rachel.current === 'mist_to_write#12' && window.__hj.poses.at(-2)?.[0] === 'mist_to_write#11'],
        ['rack', () => window.__hj.rachel.current === 'write_loop#6'],
        ['drain', () => window.__hj.rachel.current === 'mist_to_write#20' && window.__hj.poses.at(-2)?.[0] === 'mist_to_write#21'],
      ];
      const finds = [];
      for (const [spot, when] of moments) {
        await page.waitForFunction(() => !window.__hj.player.reacting, null, { timeout: 30000 });
        await page.waitForTimeout(700);
        await page.waitForFunction(when, null, { timeout: 90000, polling: 'raf' });
        const mark = await page.evaluate(() => { window.__mark = window.__hj.poses.length; return performance.now(); });
        const target = page.locator(`[data-spot="${spot}"]`);
        if (tag.startsWith('iphone')) await target.tap({ force: true }); else await target.click({ force: true });
        await page.waitForFunction(() => window.__hj.poses.slice(window.__mark).some(([p]) => p === 'K2_thumbs'), null, { timeout: 20000 });
        await page.waitForFunction(() => !window.__hj.player.reacting, null, { timeout: 20000 });
        finds.push(await page.evaluate(({ start, spot }) => {
          const poses = window.__hj.poses.slice(window.__mark);
          const gaps = window.__gaps.filter(([t, len]) => t + len >= start);
          const first = gaps.filter(([t]) => t <= start + 600);
          return { spot, from: window.__hj.poses[window.__mark - 1][0], fullReaction: poses.some(([p]) => p === 'look_up#3'), longestFrameAtTheTapMs: Math.max(...first.map(([, len]) => len)), longestFrameInAllMs: Math.max(...gaps.map(([, len]) => len)), over50: gaps.filter(([, len]) => len > 50).map(([t, len]) => `${len} ms at ${Math.round(t - start)} ms`) };
        }, { start: mark, spot }));
      }
      report[tag] = { routine, finds, framesSheHadToSkip: await page.evaluate(() => window.__hj.rachel.missed), errors };
      say(tag, report[tag]);
      await browser.close();
    }
    if (!only) await save('cycle-and-finds-webkit', report);
  },
};

const command = process.argv[2];
if (!run[command]) {
  console.error(`Unknown command "${command}". One of: ${Object.keys(run).join(', ')}`);
  process.exit(1);
}
await run[command]();

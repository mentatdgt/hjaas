// Review 03 (the elegant version): screenshots, recordings and checks.
// Needs `npm run dev` (5173).
//
//   node qa/tools/review03.mjs shots     the first screen at six sizes, and the main states
//   node qa/tools/review03.mjs compare   before and after, side by side (needs before-*.jpg from review03-before.mjs)
//   node qa/tools/review03.mjs record    the first-visit painting, desktop (Chrome) and iPhone (WebKit), as MP4
//   node qa/tools/review03.mjs timeline  when each part of the painting happens, measured in the page
//   node qa/tools/review03.mjs phone     all ten mushrooms on a phone, tap boxes, page scroll and sideways pan
//   node qa/tools/review03.mjs desktop   skip, replay, return visit, pause, reduced motion, cursor, keyboard order
import { chromium, webkit, devices } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const base = process.env.HJ_URL ?? 'http://localhost:5173/';
// HJ_OUT=qa/scene-2/ writes somewhere else (a later round re-running these checks keeps review 03's evidence as it was).
const out = process.env.HJ_OUT ? new URL(`../../${process.env.HJ_OUT.replace(/\/?$/, '/')}`, import.meta.url).pathname : new URL('../review-03/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const SPOTS = ['sill', 'drape', 'skirting', 'screed', 'tiles', 'conduit', 'socket', 'ladder-foot', 'ladder-step', 'toolbox'];
const chrome = (headless = true) => chromium.launch({ channel: 'chrome', headless });
const jpg = (page, name, options = {}) => page.screenshot({ path: `${out}${name}.jpg`, type: 'jpeg', quality: 88, ...options });
const settled = (page) => page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 30000 });
// ?debug outlines the tap boxes; screenshots of the page itself are taken without the outlines.
const clean = (page) => page.evaluate(() => document.querySelector('.hj-mushrooms')?.classList.remove('is-debug'));
const say = (label, value) => console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
const save = (name, data) => writeFile(`${out}${name}.json`, `${JSON.stringify(data, null, 1)}\n`);

const SIZES = [
  [1440, 900],
  [1024, 768],
  [2560, 1440],
  [390, 844],
  [412, 915],
  [360, 740],
];

const run = {
  async shots() {
    const browser = await chrome();
    for (const [width, height] of SIZES) {
      const phone = width <= 600;
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
      const page = await context.newPage();
      await page.goto(`${base}?debug&reset&intro=off&seed=7`);
      await settled(page);
      await page.waitForTimeout(600);
      if (phone) {
        // The tap boxes, outlined: the three at the bottom edge sit inside the picture.
        await page.evaluate(() => { const v = document.querySelector('.hj-viewport'); v.scrollLeft = v.scrollWidth; });
        await page.waitForTimeout(300);
        await jpg(page, `tapboxes-${width}x${height}-right`);
        await page.evaluate(() => { const v = document.querySelector('.hj-viewport'); v.scrollLeft = 0; });
        await page.waitForTimeout(300);
        await jpg(page, `tapboxes-${width}x${height}-left`);
        await page.goto(`${base}?debug&reset&intro=off&seed=7`);
        await settled(page);
        await page.waitForTimeout(600);
      }
      await clean(page);
      await jpg(page, `screen-${width}x${height}`);
      const box = await page.evaluate(() => {
        const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(Math.round); };
        return { page: [document.documentElement.scrollWidth, document.documentElement.scrollHeight], picture: r('.hj-viewport'), frame: r('.hj-frame'), logo: r('.hj-logo'), caption: r('.hj-caption') };
      });
      say(`${width}x${height}`, box);
      await context.close();
    }

    // States, on a desktop and on a phone.
    for (const [tag, width, height] of [['desktop', 1440, 900], ['phone', 390, 844]]) {
      const phone = width <= 600;
      const options = { viewport: { width, height }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone };
      let context = await browser.newContext(options);
      let page = await context.newPage();
      // The painting, part-way, with Skip.
      await page.goto(`${base}?debug&reset&intro=full&seed=7`);
      await page.waitForSelector('.hj-paint');
      await clean(page);
      await page.waitForTimeout(1900);
      await jpg(page, `state-${tag}-1-painting`);
      await settled(page);
      // A find, then the keyboard ring on a mushroom at the bottom edge.
      await page.locator('[data-spot="conduit"]').click({ force: true });
      await page.waitForTimeout(1500);
      await jpg(page, `state-${tag}-2-one-found`);
      await page.locator('[data-spot="tiles"]').focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await page.waitForTimeout(300);
      await jpg(page, `state-${tag}-3-focus-ring-bottom-edge`);
      await context.close();

      context = await browser.newContext(options);
      page = await context.newPage();
      await page.goto(`${base}?debug&reset&intro=off&seed=7&found=9`);
      await settled(page);
      await clean(page);
      await page.locator('[data-spot="toolbox"]').click({ force: true });
      await page.waitForTimeout(600);
      await jpg(page, `state-${tag}-4-tenth-found-reaction`);
      await page.waitForTimeout(2600);
      await jpg(page, `state-${tag}-5-contact-button`);
      await page.locator('.hj-contact').click();
      await page.waitForTimeout(800);
      await jpg(page, `state-${tag}-6-form`);
      await page.locator('.hj-chip').nth(1).click();
      await page.locator('.hj-form .hj-send').click();
      await page.waitForTimeout(300);
      await jpg(page, `state-${tag}-7-form-errors`);
      await page.fill('#hj-name', 'Wren');
      await page.fill('#hj-email', 'wren@example.com');
      await page.fill('#hj-message', 'A shelf for the hallway, please.');
      await page.locator('.hj-form .hj-send').click();
      await page.waitForTimeout(1600);
      await jpg(page, `state-${tag}-8-form-sent-test-mode`);
      await context.close();
    }
    await browser.close();
  },

  async compare() {
    const browser = await chrome();
    const after = {};
    for (const [name, width, height] of [['desktop', 1440, 900], ['phone', 390, 844]]) {
      const phone = width <= 600;
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: phone, hasTouch: phone });
      const page = await context.newPage();
      await page.goto(`${base}?reset&intro=off&seed=7`);
      await page.waitForTimeout(3000);
      after[name] = await page.screenshot();
      await context.close();
    }
    await browser.close();
    const W = 1200;
    const H = 750;
    const PW = 400;
    const PH = Math.round((PW * 844) / 390);
    const gap = 24;
    const head = 56;
    const width = W * 2 + gap * 3;
    const height = head + H + gap + head + PH + gap;
    const label = (text, x, y) => `<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="#302e29">${text}</text>`;
    const phoneX = (column) => gap + column * (W + gap) + (W - PW) / 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      ${label('Before: site/scene-1, 1440 × 900', gap, 38)}
      ${label('After: site/scene-1-elegant, 1440 × 900', gap * 2 + W, 38)}
      ${label('Before: 390 × 844', phoneX(0), head + H + gap + 38)}
      ${label('After: 390 × 844', phoneX(1), head + H + gap + 38)}
    </svg>`;
    await sharp({ create: { width, height, channels: 3, background: '#d9d6cf' } })
      .composite([
        { input: Buffer.from(svg), left: 0, top: 0 },
        { input: await sharp(`${out}before-desktop.jpg`).resize(W, H).toBuffer(), left: gap, top: head },
        { input: await sharp(after.desktop).resize(W, H).toBuffer(), left: gap * 2 + W, top: head },
        { input: await sharp(`${out}before-phone.jpg`).resize(PW, PH).toBuffer(), left: Math.round(phoneX(0)), top: head + H + gap + head },
        { input: await sharp(after.phone).resize(PW, PH).toBuffer(), left: Math.round(phoneX(1)), top: head + H + gap + head },
      ])
      .jpeg({ quality: 86 })
      .toFile(`${out}compare.jpg`);
    say('compare', `${out}compare.jpg`);
  },

  async record() {
    for (const device of ['desktop', 'iphone']) {
      const isPhone = device === 'iphone';
      const tmp = join(out, `.tmp-${device}`);
      await mkdir(tmp, { recursive: true });
      // Headed, so the recording shows real GPU-composited motion.
      const browser = isPhone ? await webkit.launch({ headless: false }) : await chrome(false);
      const size = isPhone ? { width: 390, height: 844 } : { width: 1440, height: 900 };
      const context = await browser.newContext({ ...(isPhone ? devices['iPhone 14'] : {}), viewport: size, recordVideo: { dir: tmp, size } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await page.goto(`${base}?debug&reset&intro=full&seed=7`);
      await page.waitForSelector('.hj-mushrooms', { state: 'attached' });
      await clean(page);
      await settled(page);
      await page.waitForTimeout(3500);
      await context.close();
      await browser.close();
      const [file] = (await readdir(tmp)).filter((name) => name.endsWith('.webm'));
      const mp4 = `${out}intro-first-visit-${device}.mp4`;
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(tmp, file), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4]);
      await rm(tmp, { recursive: true, force: true });
      // A still every 0.8 s, for reading the recording without playing it.
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-vf', `fps=1.25,scale=${isPhone ? 200 : 400}:-1,tile=${isPhone ? 12 : 6}x${isPhone ? 1 : 2}`, '-frames:v', '1', '-q:v', '3', `${out}intro-first-visit-${device}-stills.jpg`]);
      say(`recorded ${device}`, { mp4, errors });
    }
  },

  async timeline() {
    // Headed Chrome, real frame pacing. A rAF probe notes when each part changes.
    const results = [];
    const only = process.env.HJ_ONLY;
    for (const [tag, launch, options] of [
      ['desktop-chrome', () => chrome(process.env.HJ_HEADLESS === '1'), { viewport: { width: 1440, height: 900 } }],
      ['iphone-webkit', () => webkit.launch({ headless: process.env.HJ_HEADLESS === '1' }), { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } }],
    ]) {
      if (only && !tag.includes(only)) continue;
      const browser = await launch();
      const context = await browser.newContext(options);
      await context.addInitScript(() => {
        const log = { gaps: [] };
        window.__t = log;
        let last = performance.now();
        const opacity = (selector) => { const el = document.querySelector(selector); return el ? Number(getComputedStyle(el).opacity) : null; };
        const tick = (now) => {
          if (log.brush) log.gaps.push([Math.round(last - log.brush), Math.round(now - last)]);
          last = now;
          const mark = (key) => { if (!(key in log)) log[key] = Math.round(now - (log.brush ?? now)); };
          // The scene's own mark for the moment the painting's clock starts.
          if (!log.brush && window.__hj?.marks?.introStart) log.brush = window.__hj.marks.introStart;
          if (log.brush) {
            const shrooms = document.querySelector('.hj-mushrooms');
            if (shrooms && !shrooms.inert) mark('mushroomsUsable');
            if (opacity('.hj-rachel') > 0) mark('rachelStarts');
            if (opacity('.hj-rachel') === 1) mark('rachelSettled');
            if (opacity('.hj-caption-main') > 0) mark('captionStarts');
            if (opacity('.hj-caption-main') === 1) mark('captionIn');
            const poses = window.__hj?.poses ?? [];
            if (poses.some(([pose]) => pose !== 'frame_01' && !pose.startsWith('blink'))) mark('firstSwing');
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const page = await context.newPage();
      await page.goto(`${base}?debug&reset&intro=full&seed=7${process.env.HJ_EXTRA ?? ''}`);
      await settled(page);
      await page.waitForTimeout(4000);
      const t = await page.evaluate(() => {
        const { gaps, brush, ...marks } = window.__t;
        const painting = gaps.filter(([at]) => at >= 0 && at <= 5200);
        const after = gaps.filter(([at]) => at > 5200 && at <= 9000);
        return {
          ...marks,
          skipPresentFromStart: true,
          frames: painting.length,
          longestFrameMs: Math.max(...painting.map(([, len]) => len)),
          over50: painting.filter(([, len]) => len > 50).map(([at, len]) => `${len}ms@${at}`),
          over25: painting.filter(([, len]) => len > 25).length,
          hammeringFrames: after.length,
          hammeringOver50: after.filter(([, len]) => len > 50).map(([at, len]) => `${len}ms@${at}`),
        };
      });
      results.push({ tag, ...t });
      say(tag, t);
      await browser.close();
    }
    await save('timeline', results);
  },

  async phone() {
    const report = { sizes: [], scroll: [] };
    for (const [width, height] of [[390, 844], [412, 915], [360, 740]]) {
      const browser = await webkit.launch();
      const context = await browser.newContext({ ...devices['iPhone 14'], viewport: { width, height } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`${base}?debug&reset&intro=off&seed=7`);
      await settled(page);
      await clean(page);
      const rows = [];
      // Geometry first, with every mushroom still in place.
      const boxes = await page.evaluate(() => {
        const win = document.querySelector('.hj-window').getBoundingClientRect();
        const view = document.querySelector('.hj-viewport');
        return [...document.querySelectorAll('.hj-shroom')].map((button) => {
          const b = button.getBoundingClientRect();
          const a = button.querySelector('.hj-shroom-art').getBoundingClientRect();
          return {
            id: button.dataset.spot,
            // In the room's own coordinates (unaffected by panning).
            x: b.left + view.scrollLeft - win.left, y: b.top - win.top, w: b.width, h: b.height,
            artInsideBox: a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5,
            clearAbove: b.top - win.top, clearBelow: win.bottom - b.bottom,
            roomW: view.scrollWidth, roomH: win.height,
          };
        });
      });
      const overlaps = [];
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]; const b = boxes[j];
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps.push(`${a.id}/${b.id}`);
      }
      for (const id of SPOTS) {
        const button = page.locator(`[data-spot="${id}"]`);
        await button.scrollIntoViewIfNeeded();
        await page.waitForTimeout(350);
        // Is every edge of the tap box really tappable (not cut off by the picture's edge)?
        const corners = await button.evaluate((el) => {
          const b = el.getBoundingClientRect();
          const win = document.querySelector('.hj-window').getBoundingClientRect();
          // The middle of each edge, 1.5 px in (the box has rounded corners), and the centre.
          const mx = b.left + b.width / 2; const my = b.top + b.height / 2;
          const points = [[mx, b.top + 1.5], [mx, b.bottom - 1.5], [b.left + 1.5, my], [b.right - 1.5, my], [mx, my]];
          const visible = points.filter(([x]) => x > win.left && x < win.right);
          return { tested: visible.length, hit: visible.filter(([x, y]) => document.elementFromPoint(x, y)?.closest('.hj-shroom') === el).length };
        });
        const before = await page.locator('.hj-tally-n').textContent();
        await button.tap();
        await page.waitForTimeout(1000);
        const after = await page.locator('.hj-tally-n').textContent();
        const box = boxes.find((entry) => entry.id === id);
        rows.push({
          id, box: `${Math.round(box.w)}x${Math.round(box.h)}`, clearBelow: Math.round(box.clearBelow * 10) / 10, clearAbove: Math.round(box.clearAbove * 10) / 10,
          ringInside: box.clearBelow >= 4 && box.clearAbove >= 4 && box.x >= 4 && box.x + box.w <= box.roomW - 4,
          artInsideBox: box.artInsideBox, edgesTappable: `${corners.hit}/${corners.tested}`, counted: Number(after) === Number(before) + 1,
        });
      }
      await page.waitForTimeout(2500);
      const unlocked = await page.locator('.hj-contact').isVisible();
      await jpg(page, `phone-${width}x${height}-all-ten-found`);
      const ok = rows.every((r) => r.counted && r.ringInside && r.artInsideBox && r.edgesTappable.split('/')[0] === r.edgesTappable.split('/')[1]) && overlaps.length === 0 && unlocked;
      report.sizes.push({ size: `${width}x${height}`, engine: 'webkit', ok, unlocked, overlaps, errors, rows });
      say(`${width}x${height} all ten`, { ok, unlocked, overlaps, errors });
      for (const r of rows) say(`  ${r.id}`, r);
      await browser.close();
    }

    // Page scroll (up and down) and room pan (sideways), on a screen short enough that the page must scroll.
    // WebKit: wheel input over the picture. Chrome: real touch gestures through DevTools.
    for (const [width, height] of [[390, 664], [390, 560]]) {
      const browser = await webkit.launch();
      // (Playwright's mobile WebKit has no wheel input, so this context is WebKit at phone size, not in mobile mode.)
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3 });
      const page = await context.newPage();
      await page.goto(`${base}?debug&reset&intro=off&seed=7`);
      await settled(page);
      const read = () => page.evaluate(() => ({ y: Math.round(scrollY), x: Math.round(document.querySelector('.hj-viewport').scrollLeft) }));
      const facts = await page.evaluate(() => {
        const view = document.querySelector('.hj-viewport');
        return { pageHeight: document.documentElement.scrollHeight, screen: innerHeight, touchAction: getComputedStyle(view).touchAction, overscrollX: getComputedStyle(view).overscrollBehaviorX, sideways: document.documentElement.scrollWidth - innerWidth };
      });
      const start = await read();
      await page.mouse.move(width / 2, 300);
      await page.mouse.wheel(0, 90);
      await page.waitForTimeout(500);
      const afterDown = await read();
      await page.mouse.wheel(160, 0);
      await page.waitForTimeout(500);
      const afterSide = await read();
      const row = { size: `${width}x${height}`, engine: 'webkit, wheel', ...facts, start, afterDown, afterSide,
        pageScrolls: afterDown.y > start.y && afterDown.x === start.x, roomPans: afterSide.x > afterDown.x && afterSide.y === afterDown.y };
      report.scroll.push(row);
      say(`scroll ${width}x${height} webkit`, row);
      await browser.close();

      const cr = await chrome();
      const ctx = await cr.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      const pg = await ctx.newPage();
      await pg.goto(`${base}?debug&reset&intro=off&seed=7`);
      await settled(pg);
      const cdp = await ctx.newCDPSession(pg);
      const read2 = () => pg.evaluate(() => ({ y: Math.round(scrollY), x: Math.round(document.querySelector('.hj-viewport').scrollLeft) }));
      const s0 = await read2();
      // A finger on the picture, dragged up: the page should scroll.
      await cdp.send('Input.synthesizeScrollGesture', { x: width / 2, y: 320, yDistance: -90, gestureSourceType: 'touch', speed: 600 });
      await pg.waitForTimeout(400);
      const s1 = await read2();
      // The same finger dragged left: the room should pan and the page stay put.
      await cdp.send('Input.synthesizeScrollGesture', { x: width / 2, y: 260, xDistance: -160, gestureSourceType: 'touch', speed: 600 });
      await pg.waitForTimeout(400);
      const s2 = await read2();
      // A finger starting on a mushroom's tap box, dragged up: still a page scroll, and nothing is collected.
      await pg.evaluate(() => scrollTo(0, 0));
      const spot = await pg.locator('[data-spot="tiles"]').boundingBox();
      const s3a = await read2();
      await cdp.send('Input.synthesizeScrollGesture', { x: spot.x + spot.width / 2, y: spot.y + spot.height / 2, yDistance: -60, gestureSourceType: 'touch', speed: 600 });
      await pg.waitForTimeout(400);
      const s3 = await read2();
      const count = await pg.locator('.hj-tally-n').textContent();
      const row2 = { size: `${width}x${height}`, engine: 'chrome, touch gestures', start: s0, afterDragUp: s1, afterDragLeft: s2,
        pageScrolls: s1.y > s0.y && s1.x === s0.x, roomPans: s2.x > s1.x && s2.y === s1.y, dragFromMushroomScrolls: s3.y > s3a.y, nothingCollectedByDrag: count === '0' };
      report.scroll.push(row2);
      say(`scroll ${width}x${height} chrome touch`, row2);
      await cr.close();
    }
    await save('phone-checks', report);
  },

  async desktop() {
    const report = {};
    const browser = await chrome();
    const fresh = async (query, options = {}) => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await page.goto(`${base}?${query}`);
      return { context, page, errors };
    };
    const links = (page) => page.evaluate(() => [...document.querySelectorAll('.hj-link')].filter((b) => getComputedStyle(b).visibility === 'visible').map((b) => b.textContent));
    const state = (page) => page.evaluate(() => ({
      caption: getComputedStyle(document.querySelector('.hj-caption-main')).opacity,
      rachel: getComputedStyle(document.querySelector('.hj-rachel')).opacity,
      mushroomsFindable: !document.querySelector('.hj-mushrooms').inert,
      paperSheets: document.querySelectorAll('.hj-paint').length,
      count: document.querySelector('.hj-tally')?.textContent.trim().replace(/\s+/g, ' '),
    }));

    // Skip: there before the art has loaded, and it finishes the picture at once.
    {
      const { context, page, errors } = await fresh('debug&reset&intro=full&seed=7');
      const atStart = await links(page);
      await page.waitForSelector('.hj-paint');
      await page.waitForTimeout(1300);
      const during = await state(page);
      // An unpainted mushroom cannot be found: a click where it will be does nothing.
      const spot = await page.locator('[data-spot="toolbox"]').boundingBox();
      await page.mouse.click(spot.x + spot.width / 2, spot.y + spot.height / 2);
      await page.waitForTimeout(300);
      const clickable = (await state(page)).count !== '0 of 10 found';
      await page.getByRole('button', { name: 'Skip' }).click();
      await page.waitForTimeout(80);
      const after = await state(page);
      const afterLinks = await links(page);
      await page.locator('[data-spot="conduit"]').click({ force: true });
      await page.waitForTimeout(900);
      report.skip = { linksAtStart: atStart, during, mushroomsHiddenWhileUnpainted: !clickable, after80ms: after, linksAfter: afterLinks, findRightAfterSkip: (await state(page)).count, errors };
      say('skip', report.skip);

      // Replay painting.
      await page.getByRole('button', { name: 'Replay painting' }).click();
      await page.waitForTimeout(1500);
      const replaying = { ...(await state(page)), links: await links(page) };
      await page.waitForTimeout(4200);
      const replayed = { ...(await state(page)), links: await links(page) };
      report.replay = { replaying, replayed, errors };
      say('replay', report.replay);
      await context.close();
    }

    // A return visit: no brushwork, a 200 ms reveal, progress kept.
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      await page.goto(`${base}?debug&seed=7`);
      await page.evaluate(() => localStorage.clear());
      await page.goto(`${base}?debug&seed=7`);
      const firstVisit = await page.waitForSelector('.hj-paint', { timeout: 5000 }).then(() => true, () => false);
      await settled(page);
      await page.locator('[data-spot="conduit"]').tap();
      await page.waitForTimeout(700);
      await page.locator('[data-spot="tiles"]').tap();
      await page.waitForTimeout(700);
      await page.evaluate(() => { document.querySelector('.hj-viewport').scrollLeft = 40; });
      await page.waitForTimeout(700);
      const left = await page.evaluate(() => document.querySelector('.hj-viewport').scrollLeft);
      await page.addInitScript(() => {
        window.__reveal = [];
        const t0 = performance.now();
        const tick = () => {
          const el = document.querySelector('.hj-rachel');
          if (el) window.__reveal.push([Math.round(performance.now() - t0), Number(getComputedStyle(el).opacity)]);
          if (performance.now() - t0 < 4000) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await page.goto(`${base}?debug&seed=7`);
      await settled(page);
      const second = await state(page);
      const reveal = await page.evaluate(() => {
        const rising = window.__reveal.filter(([, o]) => o > 0 && o < 1);
        const start = window.__reveal.find(([, o]) => o > 0);
        const end = window.__reveal.find(([, o]) => o === 1);
        return { revealMs: start && end ? end[0] - start[0] : null, framesInBetween: rising.length };
      });
      const leftAfter = await page.evaluate(() => document.querySelector('.hj-viewport').scrollLeft);
      report.returnVisit = { firstVisitPainted: firstVisit, secondVisit: second, ...reveal, panBefore: Math.round(left), panAfter: Math.round(leftAfter), links: await links(page), swipeHintShownAgain: await page.locator('.hj-swipe').count() };
      say('return visit', report.returnVisit);
      await context.close();
    }

    // Pause animation.
    {
      const { context, page, errors } = await fresh('debug&reset&intro=off&seed=7');
      await settled(page);
      const moving = (ms) => page.evaluate(async (wait) => {
        const seen = new Set();
        const end = performance.now() + wait;
        while (performance.now() < end) { seen.add(window.__hj.rachel.current); await new Promise((r) => requestAnimationFrame(r)); }
        return [...seen];
      }, ms);
      const before = await moving(2500);
      await page.getByRole('button', { name: 'Pause animation' }).click();
      await page.waitForTimeout(700);
      const paused = await moving(4000);
      const label = await links(page);
      await page.locator('[data-spot="conduit"]').click({ force: true });
      const findWhilePaused = await moving(1600);
      await page.getByRole('button', { name: 'Play animation' }).click();
      const resumed = await moving(2500);
      report.pause = { posesBefore: before, posesWhilePaused: paused, linksWhilePaused: label, posesOnFindWhilePaused: findWhilePaused, posesAfterPlay: resumed, errors };
      say('pause', report.pause);
      await context.close();
    }

    // Reduced motion.
    {
      const { context, page, errors } = await fresh('debug&reset&seed=7', { reducedMotion: 'reduce' });
      await page.addInitScript(() => {});
      await settled(page);
      const first = { ...(await state(page)), links: await links(page) };
      const poses = await page.evaluate(() => [...new Set(window.__hj.poses.map(([pose]) => pose))]);
      await page.locator('[data-spot="conduit"]').click({ force: true });
      const countAtOnce = (await state(page)).count;
      const flyerMoved = await page.evaluate(() => [...document.querySelectorAll('.hj-flyer')].map((f) => getComputedStyle(f).transform));
      await page.waitForTimeout(500);
      const heldPose = await page.evaluate(() => window.__hj.rachel.current);
      await page.waitForTimeout(3000);
      const glints = await page.evaluate(() => { let n = 0; const c = document.querySelector('.hj-logo canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) n += d[i]; return n; });
      report.reducedMotion = { first, posesBeforeAnyFind: poses, countRightAfterClick: countAtOnce, flyerTransforms: flyerMoved, poseDuringFind: heldPose, poseAfter: await page.evaluate(() => window.__hj.rachel.current), logoGlintPixels: glints, errors };
      say('reduced motion', report.reducedMotion);
      await jpg(page, 'state-desktop-9-reduced-motion');
      await context.close();
    }

    // The cursor never changes over a mushroom, hovering changes no pixels, and Tab order runs left to right.
    {
      const { context, page, errors } = await fresh('debug&reset&intro=off&seed=7');
      await settled(page);
      await page.getByRole('button', { name: 'Pause animation' }).click();
      await page.waitForTimeout(900);
      const spot = await page.locator('[data-spot="ladder-step"]').boundingBox();
      const clip = { x: spot.x - 20, y: spot.y - 20, width: spot.width + 40, height: spot.height + 40 };
      await page.mouse.move(5, 5);
      await page.evaluate(() => document.querySelector('.hj-mushrooms').classList.remove('is-debug'));
      const away = await page.screenshot({ clip });
      await page.mouse.move(spot.x + spot.width / 2, spot.y + spot.height / 2);
      await page.waitForTimeout(400);
      const over = await page.screenshot({ clip });
      const cursors = await page.evaluate(() => ({
        mushroom: getComputedStyle(document.querySelector('[data-spot="ladder-step"]')).cursor,
        room: getComputedStyle(document.querySelector('.hj-viewport')).cursor,
        titles: [...document.querySelectorAll('.hj-shroom')].filter((b) => b.title).length,
      }));
      const order = [];
      await page.mouse.move(5, 5);
      for (let i = 0; i < 14; i++) {
        await page.keyboard.press('Tab');
        order.push(await page.evaluate(() => { const el = document.activeElement; if (el === document.body) return 'page'; if (el?.classList.contains('hj-logo')) return 'logo'; return el?.dataset?.spot ?? el?.textContent?.trim() ?? el?.getAttribute('aria-label') ?? el?.tagName; }));
      }
      report.cursorAndKeyboard = { ...cursors, hoverChangesPixels: Buffer.compare(away, over) !== 0, tabOrder: order, errors };
      say('cursor and keyboard', report.cursorAndKeyboard);
      await context.close();
    }
    await browser.close();
    await save('desktop-checks', report);
  },
};

const command = process.argv[2];
if (!run[command]) {
  console.error(`Unknown command "${command}". One of: ${Object.keys(run).join(', ')}`);
  process.exit(1);
}
await run[command]();

// Scene 2 (structure): screenshots, recordings and checks for the scene menu, the switch between scenes
// and the lab. Needs `npm run dev` (5173); `switch-frames` needs the production build on 4173.
//
//   node qa/tools/scene2.mjs shots          both scenes at 1440×900, 390×844 and 360×740, and the lab's tap boxes
//   node qa/tools/scene2.mjs record         Build → Grow → Build, desktop (Chrome) and iPhone (WebKit), as MP4
//   node qa/tools/scene2.mjs hunt           all 20 mushrooms, the shared unlock, and state after a reload
//   node qa/tools/scene2.mjs nav            the menu: address, back button, skip, keyboard, reduced motion, timing
//   node qa/tools/scene2.mjs switch-frames  WebKit, production build, cold load: frame times during a switch
//   node qa/tools/scene2.mjs lab            Rachel's lab frames: lazy loading, the patch seams, a full routine cycle, frame times
//   node qa/tools/scene2.mjs record-lab     the lab routine and one reaction, desktop (Chrome) and iPhone (WebKit), as MP4
import { chromium, webkit, devices } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CAPTION } from './caption-state.mjs';

const base = process.env.HJ_URL ?? 'http://localhost:5173/';
const out = process.env.HJ_OUT ? new URL(`../../${process.env.HJ_OUT.replace(/\/?$/, '/')}`, import.meta.url).pathname : new URL('../scene-2/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const SPOTS = {
  build: ['sill', 'drape', 'skirting', 'screed', 'tiles', 'conduit', 'socket', 'ladder-foot', 'ladder-step', 'toolbox'],
  grow: ['door', 'bench', 'crop-hood', 'under-shelf', 'crop-shelf', 'floor', 'pipe', 'switch-box', 'drain', 'crop-rack'],
};
const chrome = (headless = true) => chromium.launch({ channel: 'chrome', headless });
const jpg = (page, name, options = {}) => page.screenshot({ path: `${out}${name}.jpg`, type: 'jpeg', quality: 88, ...options });
const ready = (page) => page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 30000 });
const idle = (page) => page.waitForFunction(() => window.__hj?.busy === false, null, { timeout: 30000 });
/** Wait until the page has arrived at a scene and gone quiet. (A click only changes the address; the switch starts a moment later.) */
const arrived = (page, id) => page.waitForFunction((scene) => window.__hj?.scene?.config.id === scene && window.__hj.busy === false, id, { timeout: 30000 });
const clean = (page) => page.evaluate(() => document.querySelectorAll('.hj-mushrooms').forEach((el) => el.classList.remove('is-debug')));
const say = (label, value) => console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
const save = (name, data) => writeFile(`${out}${name}.json`, `${JSON.stringify(data, null, 1)}\n`);
const tab = (page, id) => page.locator(`.hj-tab[data-scene="${id}"]`);
const state = async (page) => {
  const c = await page.evaluate(CAPTION);
  return { ...(await scene(page)), caption: c.text, here: c.here, site: c.site, next: c.next, dots: c.dots, button: c.contactShown };
};
const scene = (page) => page.evaluate(() => ({
  address: location.hash,
  scene: window.__hj.scene.config.id,
  current: document.querySelector('.hj-tab[aria-current="page"]')?.firstChild.textContent,
  pan: Math.round(document.querySelector('.hj-viewport').scrollLeft),
}));

const run = {
  async shots() {
    const browser = await chrome();
    for (const [width, height] of [[1440, 900], [390, 844], [360, 740]]) {
      const phone = width <= 600;
      for (const id of ['build', 'grow']) {
        const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
        const page = await context.newPage();
        await page.goto(`${base}?debug&reset&intro=off&seed=7#${id}`);
        await ready(page);
        await page.waitForTimeout(500);
        if (id === 'grow' && phone) {
          // The lab's tap boxes, outlined, at each end of the room.
          for (const [end, x] of [['left', 0], ['right', 99999]]) {
            await page.evaluate((left) => { document.querySelector('.hj-viewport').scrollLeft = left; }, x);
            await page.waitForTimeout(300);
            await jpg(page, `tapboxes-grow-${width}x${height}-${end}`);
          }
          // Back to the opening view. (The address is unchanged, so it has to be a reload.)
          await page.reload();
          await ready(page);
          await page.waitForTimeout(500);
        }
        await clean(page);
        await jpg(page, `screen-${id}-${width}x${height}`);
        const menu = await page.evaluate(() => {
          const tabs = [...document.querySelectorAll('.hj-tab')].map((t) => t.getBoundingClientRect());
          return { tabs: tabs.length, oneRow: new Set(tabs.map((r) => Math.round(r.top))).size === 1, tabHeight: Math.round(tabs[0].height), pageWidth: document.documentElement.scrollWidth };
        });
        say(`${id} ${width}x${height}`, menu);
        await context.close();
      }
    }
    await browser.close();
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
      // A visitor who has seen both scenes: each switch is the short brush.
      await page.goto(`${base}?debug&reset&intro=quick&seed=7`);
      await ready(page);
      await clean(page);
      await page.waitForTimeout(1500);
      const go = async (id) => {
        if (isPhone) await tab(page, id).tap();
        else await tab(page, id).click();
        await page.waitForTimeout(300);
        await clean(page);
        await arrived(page, id);
        await page.waitForTimeout(2200);
      };
      await go('grow');
      await go('build');
      await go('grow');
      await context.close();
      await browser.close();
      const [file] = (await readdir(tmp)).filter((name) => name.endsWith('.webm'));
      const mp4 = `${out}switch-build-grow-build-${device}.mp4`;
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(tmp, file), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4]);
      await rm(tmp, { recursive: true, force: true });
      // A still every 0.4 s, for reading the recording without playing it.
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-vf', `fps=2.5,scale=${isPhone ? 170 : 320}:-1,tile=${isPhone ? 14 : 7}x${isPhone ? 2 : 4}`, '-frames:v', '1', '-q:v', '3', `${out}switch-build-grow-build-${device}-stills.jpg`]);
      say(`recorded ${device}`, { mp4, errors });
    }
  },

  async hunt() {
    const report = [];
    for (const [engine, width, height] of [['webkit', 390, 844], ['webkit', 360, 740], ['chrome', 1440, 900]]) {
      const phone = width <= 600;
      const browser = engine === 'webkit' ? await webkit.launch() : await chrome();
      const context = await browser.newContext(phone ? { ...devices['iPhone 14'], viewport: { width, height } } : { viewport: { width, height } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      // A new visitor. (?reset is then taken out of the address, so the reload further down keeps the progress.)
      await page.goto(`${base}?debug&intro=off&seed=7&reset`);
      await ready(page);
      await page.evaluate(() => history.replaceState(null, '', `${location.pathname}?debug&intro=off&seed=7`));
      const row = { engine, size: `${width}x${height}`, scenes: {} };

      // Tap boxes of both scenes, in the room's own coordinates.
      const boxes = async () => page.evaluate(() => {
        const win = document.querySelector('.hj-window').getBoundingClientRect();
        const view = document.querySelector('.hj-viewport');
        return [...document.querySelectorAll('.hj-shroom')].map((button) => {
          const b = button.getBoundingClientRect();
          const a = button.querySelector('.hj-shroom-art').getBoundingClientRect();
          return { id: button.dataset.spot, x: b.left + view.scrollLeft - win.left, y: b.top - win.top, w: b.width, h: b.height, art: Math.round(a.height * 10) / 10,
            inside: b.top - win.top >= 4 && win.bottom - b.bottom >= 4 && b.left + view.scrollLeft - win.left >= 4 && b.left + view.scrollLeft - win.left + b.width <= view.scrollWidth - 4,
            artInBox: a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5 };
        });
      });
      const findAll = async (id) => {
        const list = await boxes();
        const overlaps = [];
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
          const a = list[i]; const b = list[j];
          if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps.push(`${a.id}/${b.id}`);
        }
        const counted = [];
        for (const spot of SPOTS[id]) {
          const button = page.locator(`.hj-plate[data-scene="${id}"] [data-spot="${spot}"]`);
          await button.scrollIntoViewIfNeeded();
          await page.waitForTimeout(phone ? 350 : 60);
          const before = (await state(page)).caption;
          if (phone) await button.tap(); else await button.click();
          await page.waitForTimeout(900);
          counted.push((await state(page)).caption !== before);
        }
        await page.waitForTimeout(2600);
        return { found: counted.filter(Boolean).length, tapBoxes: list.length, smallestBox: Math.min(...list.map((b) => Math.min(b.w, b.h))), allInsidePicture: list.every((b) => b.inside), drawingsInsideBoxes: list.every((b) => b.artInBox), smallestDrawingPx: Math.min(...list.map((b) => b.art)), overlaps, after: await state(page) };
      };

      // Scene 1 first: its tenth mushroom brings the dot on its tab and Next; the button takes all 50.
      const before = await state(page);
      row.scenes.build = await findAll('build');
      await jpg(page, `hunt-${engine}-${width}-1-build-done`);
      // Scene 2: its own count, starting from nought; the red one goes on from 10.
      if (phone) await tab(page, 'grow').tap(); else await tab(page, 'grow').click();
      await arrived(page, 'grow');
      await page.waitForTimeout(600);
      const arriving = await state(page);
      row.scenes.grow = await findAll('grow');
      await jpg(page, `hunt-${engine}-${width}-2-grow-done`);
      row.before = before;
      row.arrivingInGrow = arriving;

      // A reload: the address still names the lab, both counts and the button are kept.
      await page.reload();
      await ready(page);
      row.afterReload = await state(page);
      if (phone) await tab(page, 'build').tap(); else await tab(page, 'build').click();
      await arrived(page, 'build');
      await page.waitForTimeout(500);
      row.afterReloadBuild = await state(page);
      row.saved = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('hjaas:site:v2')); return { unlocked: s.unlocked, build: s.scenes.build.found.length, grow: s.scenes.grow.found.length }; });
      row.errors = errors;
      row.ok = row.scenes.build.found === 10 && row.scenes.grow.found === 10 && row.scenes.build.after.dots.join() === 'build' && row.scenes.build.after.next === '#grow' && !row.scenes.build.after.button && arriving.here === '0/10' && arriving.site === '10/50' && !arriving.next
        && row.afterReload.scene === 'grow' && row.afterReload.here === '10/10' && row.afterReload.site === '20/50' && row.afterReload.dots.join() === 'build,grow' && !row.afterReload.button && row.afterReloadBuild.here === '10/10' && row.saved.build === 10 && row.saved.grow === 10 && row.scenes.grow.overlaps.length === 0 && row.scenes.grow.allInsidePicture && errors.length === 0;
      report.push(row);
      say(`${engine} ${width}x${height}`, row);
      await browser.close();
    }

    // Whichever scene is finished first has its dot and Next, and only that: here the lab, with scene 1 untouched.
    {
      const browser = await chrome();
      const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
      await page.goto(`${base}?debug&intro=off&seed=7#grow`);
      await page.evaluate(() => localStorage.clear());
      await page.goto(`${base}?debug&intro=off&seed=7#grow`);
      await ready(page);
      const start = await state(page);
      for (const spot of SPOTS.grow) { await page.locator(`[data-spot="${spot}"]`).click({ force: true }); await page.waitForTimeout(650); }
      await page.waitForTimeout(2000);
      const lab = await state(page);
      await tab(page, 'build').click();
      await arrived(page, 'build');
      await page.waitForTimeout(500);
      const buildAfter = await state(page);
      // A phone's pan position is kept per scene.
      report.push({ check: 'lab first', start, lab, buildAfter, ok: !start.button && lab.here === '10/10' && lab.dots.join() === 'grow' && lab.next === '#design' && !lab.button && buildAfter.here === '0/10' && buildAfter.site === '10/50' && !buildAfter.button });
      say('lab first', report.at(-1));
      await browser.close();
    }
    {
      const browser = await chrome();
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      await page.goto(`${base}?debug&intro=off&seed=7`);
      await page.evaluate(() => localStorage.clear());
      await page.goto(`${base}?debug&intro=off&seed=7`);
      await ready(page);
      const setPan = (x) => page.evaluate((left) => { document.querySelector('.hj-viewport').scrollLeft = left; }, x);
      const opening = { build: (await state(page)).pan };
      await setPan(60);
      await page.waitForTimeout(500);
      await tab(page, 'grow').tap();
      await arrived(page, 'grow');
      opening.grow = (await state(page)).pan;
      await setPan(400);
      await page.waitForTimeout(500);
      await tab(page, 'build').tap();
      await arrived(page, 'build');
      const backInBuild = (await state(page)).pan;
      await page.reload();
      await ready(page);
      const reloadedBuild = (await state(page)).pan;
      await tab(page, 'grow').tap();
      await arrived(page, 'grow');
      const reloadedGrow = (await state(page)).pan;
      // Where the lab opens: the plate x range the window shows.
      const view = await page.evaluate(() => { const v = document.querySelector('.hj-viewport'); const u = document.querySelector('.hj-plate').clientWidth / 1672; return [Math.round(0 / u), Math.round(v.clientWidth / u)]; });
      const u = await page.evaluate(() => document.querySelector('.hj-plate').clientWidth / 1672);
      report.push({ check: 'pan per scene', openingPan: opening, labOpensOnPlateX: [Math.round(opening.grow / u), Math.round(opening.grow / u + view[1])], backInBuild, reloadedBuild, reloadedGrow, ok: backInBuild === 60 && reloadedBuild === 60 && reloadedGrow === 400 });
      say('pan per scene', report.at(-1));
      await browser.close();
    }
    await save('hunt-checks', report);
  },

  async nav() {
    const report = {};
    const browser = await chrome();
    const open = async (query, hash = '', options = {}) => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text()));
      await page.goto(`${base}?debug&${query}${hash}`);
      await ready(page);
      return { context, page, errors };
    };

    // The address names the scene; links, the back button and the forward button work.
    {
      const { context, page, errors } = await open('reset&intro=quick&seed=7');
      const plain = await state(page);
      await tab(page, 'grow').click();
      await arrived(page, 'grow');
      const afterClick = await state(page);
      await page.goBack();
      await arrived(page, 'build');
      await page.waitForTimeout(200);
      const afterBack = await state(page);
      await page.goForward();
      await arrived(page, 'grow');
      await page.waitForTimeout(200);
      const afterForward = await state(page);
      const direct = await open('reset&intro=off&seed=7', '#grow');
      const directState = await state(direct.page);
      const unknown = await open('reset&intro=off&seed=7', '#nowhere');
      const unknownState = await state(unknown.page);
      report.address = { plain, afterClick, afterBack, afterForward, directToGrow: directState, unknownName: unknownState, errors: [...errors, ...direct.errors, ...unknown.errors] };
      say('address', report.address);
      await direct.context.close();
      await unknown.context.close();
      await context.close();
    }

    // How long a switch takes, and that clicking again finishes it at once.
    {
      const { context, page, errors } = await open('reset&intro=quick&seed=7');
      const timed = async (id) => {
        const t0 = await page.evaluate(() => performance.now());
        await tab(page, id).click();
        await arrived(page, id);
        return page.evaluate((start) => ({ fromClickMs: Math.round(performance.now() - start), brushMs: window.__hj.marks.switchEnd - window.__hj.marks.switchStart }), t0);
      };
      const toGrow = await timed('grow');
      await page.waitForTimeout(400);
      const toBuild = await timed('build');
      await page.waitForTimeout(400);
      // Click, then click again 300 ms into the brush.
      await tab(page, 'grow').click();
      await page.waitForTimeout(300);
      const midway = await page.evaluate(() => ({ busy: window.__hj.busy, sheets: document.querySelectorAll('.hj-paint').length, skip: getComputedStyle([...document.querySelectorAll('.hj-link')].find((b) => b.textContent === 'Skip')).visibility }));
      const t1 = await page.evaluate(() => performance.now());
      await tab(page, 'grow').click();
      await arrived(page, 'grow');
      const skippedIn = await page.evaluate((start) => Math.round(performance.now() - start), t1);
      // And the Skip control does the same.
      await tab(page, 'build').click();
      await page.waitForTimeout(300);
      const t2 = await page.evaluate(() => performance.now());
      await page.getByRole('button', { name: 'Skip' }).click();
      await arrived(page, 'build');
      const skipControlIn = await page.evaluate((start) => Math.round(performance.now() - start), t2);
      // Clicking the other tab mid-brush finishes this picture and goes on to that one.
      await tab(page, 'grow').click();
      await page.waitForTimeout(250);
      await tab(page, 'build').click();
      await arrived(page, 'build');
      const changedMind = await state(page);
      report.switch = { toGrow, toBuild, midway, clickAgainFinishesInMs: skippedIn, skipControlFinishesInMs: skipControlIn, changedMindEndsOn: changedMind.scene, errors };
      say('switch', report.switch);
      await context.close();
    }

    // The first visit to a scene is its full painting; a revisit is the short brush.
    {
      const { context, page, errors } = await open('reset&seed=7');
      await idle(page);
      const t0 = await page.evaluate(() => performance.now());
      await tab(page, 'grow').click();
      await page.waitForTimeout(1500);
      const during = await page.evaluate(() => ({ sheetInsidePlate: !!document.querySelector('.hj-plate .hj-paint'), mushroomsFindable: !document.querySelector('.hj-mushrooms').inert }));
      await jpg(page, 'first-visit-to-grow-painting');
      await arrived(page, 'grow');
      const firstMs = await page.evaluate((start) => Math.round(performance.now() - start), t0);
      await tab(page, 'build').click();
      await arrived(page, 'build');
      const t1 = await page.evaluate(() => performance.now());
      await tab(page, 'grow').click();
      await arrived(page, 'grow');
      const secondMs = await page.evaluate((start) => Math.round(performance.now() - start), t1);
      report.firstVisit = { firstVisitMs: firstMs, during, revisitMs: secondMs, errors };
      say('first visit', report.firstVisit);
      await context.close();
    }

    // Reduced motion: a 200 ms crossfade, no brush.
    {
      const { context, page, errors } = await open('reset&seed=7', '', { reducedMotion: 'reduce' });
      await page.evaluate(() => {
        window.__fade = [];
        const t0 = performance.now();
        const tick = () => {
          const sheet = document.querySelector('.hj-paint');
          window.__fade.push([Math.round(performance.now() - t0), sheet ? Number(getComputedStyle(sheet).opacity) : null]);
          if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
        };
        document.querySelector('.hj-tab[data-scene="grow"]').addEventListener('click', () => requestAnimationFrame(tick), { once: true });
      });
      await tab(page, 'grow').click();
      await page.waitForTimeout(1700);
      const fade = await page.evaluate(() => {
        const seen = window.__fade.filter(([, o]) => o !== null);
        return { fadeMs: seen.length ? seen.at(-1)[0] - seen[0][0] : null, opacities: seen.length, startedAt: seen[0]?.[1], strokes: 'none (the sheet only fades)' };
      });
      report.reducedMotion = { ...fade, after: await state(page), controls: await page.evaluate(() => [...document.querySelectorAll('.hj-link')].filter((b) => getComputedStyle(b).visibility === 'visible').map((b) => b.textContent)), errors };
      say('reduced motion', report.reducedMotion);
      await context.close();
    }

    // Keyboard: the tabs are links in the Tab order, Enter follows one, the current one is marked.
    {
      const { context, page, errors } = await open('reset&intro=off&seed=7');
      const order = [];
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press('Tab');
        order.push(await page.evaluate(() => { const el = document.activeElement; return el.classList.contains('hj-logo') ? 'logo' : el.classList.contains('hj-tab') ? `tab:${el.firstChild.textContent}` : el.dataset.spot ? `mushroom:${el.dataset.spot}` : el.textContent.trim(); }));
      }
      await page.keyboard.press('Shift+Tab');
      const focused = await page.evaluate(() => document.activeElement.textContent);
      await page.keyboard.press('Enter');
      await arrived(page, 'grow');
      const afterEnter = await state(page);
      const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { outline: s.outlineStyle, width: s.outlineWidth }; });
      const semantics = await page.evaluate(() => ({ nav: document.querySelector('.hj-menu').tagName, label: document.querySelector('.hj-menu').getAttribute('aria-label'), current: [...document.querySelectorAll('.hj-tab')].map((t) => `${t.firstChild.textContent}:${t.getAttribute('aria-current') ?? '-'}`), picture: document.querySelector('.hj-frame').getAttribute('aria-label') }));
      report.keyboard = { tabOrder: order, focusedBeforeEnter: focused, afterEnter, focusRing: ring, semantics, errors };
      say('keyboard', report.keyboard);
      await context.close();
    }
    await browser.close();
    await save('nav-checks', report);
  },

  // Rachel's real lab frames (reviews/scene-2-frames-dropin.md).
  async lab() {
    const report = {};

    // 1. Lazy loading: nothing of hers is fetched until the Grow tab is first opened; then stills, then clips.
    {
      const browser = await chrome();
      const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
      const requests = [];
      page.on('request', (request) => { const m = request.url().match(/assets\/(scene2\/.*)$/); if (m) requests.push(m[1]); });
      await page.goto(`${base}?debug&reset&intro=off&seed=7`);
      await ready(page);
      await page.waitForTimeout(2500);
      const beforeOpening = [...requests];
      await tab(page, 'grow').click();
      await arrived(page, 'grow');
      const atArrival = requests.slice(beforeOpening.length);
      await page.waitForFunction(() => window.__hj.rachel.has('thumbs_up#9'), null, { timeout: 60000 });
      const after = requests.slice(beforeOpening.length);
      const kind = (r) => (r.includes('/stills/') ? 'still' : r.endsWith('.json') ? 'manifest' : r.includes('room') ? 'plate' : r.split('/')[2]);
      const order = [];
      for (const r of after) if (order.at(-1) !== kind(r)) order.push(kind(r));
      const bytes = await page.evaluate(() => {
        const sum = (test) => performance.getEntriesByType('resource').filter((e) => test(e.name)).reduce((n, e) => n + (e.encodedBodySize || 0), 0);
        return { scene1: sum((n) => n.includes('/scene1/')), labPlate: sum((n) => n.includes('/scene2/room')), labStills: sum((n) => n.includes('/scene2/rachel/stills/')), labClips: sum((n) => n.includes('/scene2/rachel/') && !n.includes('/stills/') && !n.endsWith('.json')) };
      });
      report.lazy = { fetchedBeforeGrowIsOpened: beforeOpening, fetchedByArrival: atArrival.map(kind).filter((k, i, a) => a.indexOf(k) === i), orderAfterOpening: order, files: after.length, bytes };
      say('lazy', report.lazy);
      await browser.close();
    }

    // 2. The patch seam: does anything jump between a still and a clip frame on it?
    for (const [tag, launch, options] of [
      ['desktop-chrome', () => chrome(), { viewport: { width: 1440, height: 900 } }],
      ['iphone-webkit', () => webkit.launch(), { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } }],
    ]) {
      const browser = await launch();
      const page = await (await browser.newContext(options)).newPage();
      await page.goto(`${base}?debug&reset&intro=off&seed=7#grow`);
      await ready(page);
      await page.waitForFunction(() => window.__hj.rachel.has('thumbs_up#9'), null, { timeout: 60000 });
      const seams = await page.evaluate(async () => {
        const h = window.__hj;
        h.player.stop();
        // Narrow screens are given the lighter set of her frames (review 04): compare within the set in use.
        const dir = h.scene.memory.canvasWidth === 980 ? 'rachel' : 'rachel-1.5x';
        const frames = await (await fetch(`./assets/scene2/${dir}/frames.json`)).json();
        const canvas = document.querySelector('.hj-rachel canvas');
        const ctx = canvas.getContext('2d');
        // A clip frame is decoded only when asked for: ask, as a step of her routine would, and wait for it.
        const grab = async (pose) => {
          if (!h.rachel.has(pose)) { h.scene.ahead([pose]); while (!h.rachel.has(pose)) await new Promise((r) => setTimeout(r, 4)); }
          h.rachel.show(pose);
          return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        };
        // Chrome moves a canvas from the graphics card to main memory the first time its pixels are read, and
        // draws slightly differently there. One throwaway read first, so everything compared was drawn the same way.
        for (let n = 0; n < 6; n++) await grab(Object.keys(frames.stills)[n % 2]);
        const s = canvas.width / frames.canvas.w;
        const rows = [];
        for (const [name, clip] of Object.entries(frames.clips)) {
          const still = (await grab(clip.base)).slice();
          h.rachel.show(Object.keys(frames.stills).find((n) => n !== clip.base));
          const stillAgain = await grab(clip.base);
          let redraw = 0;
          for (let k = 0; k < still.length; k++) if (still[k] !== stillAgain[k]) redraw++;
          let outside = 0; let ring = 0; let ringCount = 0; let ringSum = 0; let ringOver = 0; let firstCut = 0; let figure = 0;
          // Every frame of the clip, against its still.
          for (let i = 0; i < clip.frames.length; i++) {
            const img = new Image(); img.src = `./assets/scene2/${dir}/${clip.frames[i].replace('.png', '.webp')}`; await img.decode();
            const x0 = clip.x * s; const y0 = clip.y * s; const x1 = (clip.x + img.naturalWidth) * s; const y1 = (clip.y + img.naturalHeight) * s;
            const data = await grab(`${name}#${i}`);
            for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
              const k = (y * canvas.width + x) * 4;
              const d = Math.max(Math.abs(data[k] - still[k]), Math.abs(data[k + 1] - still[k + 1]), Math.abs(data[k + 2] - still[k + 2]), Math.abs(data[k + 3] - still[k + 3]));
              const inside = x >= x0 && x + 1 <= x1 && y >= y0 && y + 1 <= y1;
              if (!inside) { if (d > outside) outside = d; continue; }
              // The band just inside the patch's edge: there the patch shows the same picture as the still.
              const edge = Math.min(x - x0, x1 - x - 1, y - y0, y1 - y - 1);
              if (edge < 6 * Math.max(1, s)) { if (d > ring) ring = d; ringSum += d; ringCount++; if (d > 24) ringOver++; }
              // The cut from the still to the clip's first frame: how much of the figure changes at once.
              if (i === 0 && (still[k + 3] > 0 || data[k + 3] > 0)) { figure++; if (d > 24) firstCut++; }
            }
            h.rachel.show(clip.base);
          }
          rows.push({ clip: name, frames: clip.frames.length, stillRedrawnDiffers: redraw, largestDifferenceOutsidePatch: outside, meanDifferenceAtPatchEdge: Math.round((ringSum / ringCount) * 100) / 100, shareOfEdgePixelsOver24: `${Math.round((ringOver / ringCount) * 10000) / 100}%`, shareOfFigureChangingAtFirstFrame: `${Math.round((firstCut / figure) * 1000) / 10}%` });
        }
        h.player.start();
        return { set: dir, canvas: [canvas.width, canvas.height], scale: Math.round(s * 1000) / 1000, rows };
      });
      report[`seams-${tag}`] = seams;
      say(`seams ${tag}`, seams);
      await browser.close();
    }

    // 3. A full cycle of the routine, a reaction from misting and one from writing, and every frame's length.
    for (const [tag, launch, options] of [
      ['desktop-chrome', () => chrome(false), { viewport: { width: 1440, height: 900 } }],
      ['iphone-webkit', () => webkit.launch({ headless: false }), { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } }],
    ]) {
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
      const t0 = await page.evaluate(() => { window.__hj.poses.length = 0; return performance.now(); });
      // Two full cycles: wait until she has come back from writing twice.
      await page.waitForFunction(() => window.__hj.poses.filter(([p], i, a) => p === 'mist_to_write#0' && a[i - 1]?.[0] === 'mist_to_write#1').length >= 2, null, { timeout: 90000 });
      const routine = await page.evaluate((start) => {
        const poses = window.__hj.poses;
        const held = poses.map(([pose, at], i) => ({ pose, ms: (poses[i + 1]?.[1] ?? at) - at })).slice(0, -1);
        const of = (test) => held.filter((h) => test(h.pose)).map((h) => h.ms);
        const range = (list) => (list.length ? [Math.min(...list), Math.max(...list)] : null);
        // Cycles: from one return from writing to the next.
        const backs = poses.filter(([p], i, a) => p === 'mist_to_write#0' && a[i - 1]?.[0] === 'mist_to_write#1').map(([, at]) => at);
        const sprays = []; let run = 0;
        for (const h of held) { if (h.pose === 'A2_mist_squeeze') run++; if (h.pose.startsWith('mist_to_write') && run) { sprays.push(run); run = 0; } }
        const writes = []; let w = 0;
        for (const h of held) { if (h.pose === 'write_loop#0') w++; if (h.pose.startsWith('mist_to_write') && w) { writes.push(w); w = 0; } }
        const gaps = window.__gaps.filter(([at]) => at >= start);
        return {
          watchedS: Math.round((poses.at(-1)[1] - start) / 100) / 10,
          cycleS: backs.slice(1).map((at, i) => Math.round((at - backs[i]) / 100) / 10),
          spraysPerRound: sprays, writeLoopsPerRound: writes,
          holdMs: { aim: range(of((p) => p === 'A1_mist_aim')), squeeze: range(of((p) => p === 'A2_mist_squeeze')), lift: range(of((p) => p === 'A3_mist_lift')), transitionFrame: range(of((p) => p.startsWith('mist_to_write#'))), writeFrame: range(of((p) => p.startsWith('write_loop#'))), blink: range(of((p) => p === 'A1_blink_half')) },
          blinks: of((p) => p === 'A1_blink_half').length,
          frames: gaps.length, longestFrameMs: Math.max(...gaps.map(([, len]) => len)), over50: gaps.filter(([, len]) => len > 50).map(([at, len]) => `${len}ms@${Math.round(at - start)}`),
        };
      }, t0);

      // A reaction asked for while she mists, and one while she writes.
      const reactFrom = async (spot, when) => {
        await page.waitForFunction(when, null, { timeout: 60000 });
        const mark = await page.evaluate(() => { window.__mark = window.__hj.poses.length; return performance.now(); });
        await page.locator(`[data-spot="${spot}"]`).click({ force: true });
        await page.waitForFunction(() => window.__hj.poses.slice(window.__mark).some(([p]) => p === 'K2_thumbs'), null, { timeout: 20000 });
        await page.waitForFunction(() => !window.__hj.player.reacting, null, { timeout: 20000 });
        return page.evaluate((start) => {
          const poses = window.__hj.poses.slice(window.__mark);
          const at = (test) => { const hit = poses.find(([p]) => test(p)); return hit ? Math.round(hit[1] - start) : null; };
          const gaps = window.__gaps.filter(([t]) => t >= start);
          const before = poses.slice(0, poses.findIndex(([p]) => p === 'look_up#0')).map(([p]) => p.split('#')[0]);
          return { wayHome: [...new Set(before)], lookUpStartsMs: at((p) => p === 'look_up#0'), thumbsUpMs: at((p) => p === 'K2_thumbs'), backAtWorkMs: Math.round(poses.at(-1)[1] - start), reactionMs: Math.round(poses.at(-1)[1] - poses.find(([p]) => p === 'look_up#0')[1]), longestFrameMs: Math.max(...gaps.map(([, len]) => len)), over50: gaps.filter(([, len]) => len > 50).length };
        }, mark);
      };
      const fromMisting = await reactFrom('pipe', () => window.__hj.rachel.current === 'A3_mist_lift');
      const fromWriting = await reactFrom('door', () => window.__hj.rachel.current === 'write_loop#6');
      report[`routine-${tag}`] = { routine, fromMisting, fromWriting, errors };
      say(`routine ${tag}`, report[`routine-${tag}`]);
      await browser.close();
    }
    await save('lab-checks', report);
  },

  async 'record-lab'() {
    for (const device of ['desktop', 'iphone']) {
      const isPhone = device === 'iphone';
      const tmp = join(out, `.tmp-lab-${device}`);
      await mkdir(tmp, { recursive: true });
      const browser = isPhone ? await webkit.launch({ headless: false }) : await chrome(false);
      const size = isPhone ? { width: 390, height: 844 } : { width: 1440, height: 900 };
      const context = await browser.newContext({ ...(isPhone ? devices['iPhone 14'] : {}), viewport: size, recordVideo: { dir: tmp, size } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await page.goto(`${base}?debug&reset&intro=off&seed=4#grow`);
      await ready(page);
      await clean(page);
      await page.waitForFunction(() => window.__hj.rachel.has('thumbs_up#9'), null, { timeout: 60000 });
      // One full cycle: misting, into writing, and back.
      await page.waitForFunction(() => window.__hj.poses.some(([p], i, a) => p === 'mist_to_write#0' && a[i - 1]?.[0] === 'mist_to_write#1'), null, { timeout: 90000 });
      await page.waitForTimeout(1500);
      // A find while she mists: look up, beam, thumbs-up, and back to work.
      const spot = page.locator('[data-spot="pipe"]');
      if (isPhone) await spot.tap(); else await spot.click();
      await page.waitForFunction(() => window.__hj.poses.some(([p]) => p === 'K2_thumbs'), null, { timeout: 20000 });
      await page.waitForFunction(() => !window.__hj.player.reacting, null, { timeout: 20000 });
      await page.waitForTimeout(2500);
      await context.close();
      await browser.close();
      const [file] = (await readdir(tmp)).filter((name) => name.endsWith('.webm'));
      const mp4 = `${out}lab-routine-and-reaction-${device}.mp4`;
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(tmp, file), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4]);
      await rm(tmp, { recursive: true, force: true });
      say(`recorded ${device}`, { mp4, errors });
    }
  },

  // WebKit, cold load, production build: every frame's length while one scene is brushed in over the other.
  async 'switch-frames'() {
    const url = process.env.HJ_URL ?? 'http://localhost:4173/';
    const runs = Number(process.argv[3] ?? 6);
    const results = [];
    for (const profile of ['iphone', 'desktop']) {
      for (let i = 0; i < runs; i++) {
        const browser = await webkit.launch();
        const context = await browser.newContext(profile === 'desktop' ? { viewport: { width: 1280, height: 760 } } : { ...devices['iPhone 13'] });
        await context.addInitScript(() => {
          // A visitor who has seen both scenes, so a switch is the short brush. (Nothing else is saved.)
          try {
            if (!localStorage.getItem('hjaas:site:v2')) localStorage.setItem('hjaas:site:v2', JSON.stringify({ scenes: { build: { found: [], seen: true, panX: null }, grow: { found: [], seen: true, panX: null } }, unlocked: false, panned: false }));
          } catch {}
          const log = { gaps: [] };
          window.__frames = log;
          let last = performance.now();
          const tick = (now) => { log.gaps.push([Math.round(last), Math.round(now - last)]); last = now; requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
        });
        const page = await context.newPage();
        await page.goto(url);
        // Long enough for the opening and for the other scene to load in the background.
        await page.waitForSelector('.hj-tab');
        await page.waitForTimeout(4500);
        const measure = async (id) => {
          const t0 = await page.evaluate(() => performance.now());
          if (profile === 'iphone') await tab(page, id).tap(); else await tab(page, id).click();
          await page.waitForTimeout(2600);
          return page.evaluate((start) => {
            const gaps = window.__frames.gaps.filter(([at, len]) => at + len >= start && at <= start + 2000);
            return { frames: gaps.length, longest: Math.max(...gaps.map(([, len]) => len)), over50: gaps.filter(([, len]) => len > 50).map(([at, len]) => `${len}ms@${Math.round(at - start)}`) };
          }, t0);
        };
        const toGrow = await measure('grow');
        const toBuild = await measure('build');
        results.push({ profile, run: i + 1, toGrow, toBuild });
        console.log(JSON.stringify(results.at(-1)));
        await browser.close();
      }
    }
    const pick = (profile, key) => results.filter((r) => r.profile === profile).map((r) => r[key].longest);
    const summary = { url, iphone: { toGrow: pick('iphone', 'toGrow'), toBuild: pick('iphone', 'toBuild') }, desktop: { toGrow: pick('desktop', 'toGrow'), toBuild: pick('desktop', 'toBuild') } };
    console.log(JSON.stringify(summary));
    await save('switch-frames-webkit-cold', { summary, results });
  },
};

const command = process.argv[2];
if (!run[command]) {
  console.error(`Unknown command "${command}". One of: ${Object.keys(run).join(', ')}`);
  process.exit(1);
}
await run[command]();

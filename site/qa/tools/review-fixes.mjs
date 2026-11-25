// Quinn's code and security fixes (reviews/quinn-site-review-030.md), checked in browsers. Results: qa/review-fixes/.
// Everything runs against a production build: the fixes at HJ_PROD (default 4173: `npm run build && npm run preview`)
// and, where a check needs a control, the build before them at HJ_OLD_PROD (default 4174).
//
//   node qa/tools/review-fixes.mjs <check> [chrome|webkit]
//     hunt     the whole hunt by tapping each drawing, Next from scene to scene, reload, button, form; three devices
//     same     each scene's finished picture, this build against the one before, pixel by pixel; three devices
//     c1       a sprite, a cast frame, a room (and its whole folder) blocked; Retry room
//     slow     the opening on a slow network, this build and the one before (Chrome)
//     c2       two tabs: a find in each; a stale tab's pan; the unlock
//     c3       taps on hidden mushrooms during a switch and a return reveal (and the same on the build before)
//     c4       portrait, panned to the right edge, landscape and back (and the same on the build before)
//     c5       reduced motion switched on in the painting, in a find's flight and in the 50th's; the tab hidden
//     c6       what each scene left behind still holds, also when it is left while its reaction is loading (dev servers:
//              HJ_URL, default 5173, and the build before at HJ_OLD_URL, default 5174; the 30 orders are scene5.mjs memory)
//     c7       what is fetched after the opening, when, and at what priority
//     c8       damaged and odd fragments
//     s3       dist/ served with its _headers: violations through the whole visit; the headers as served
//     s1       the form's limits and time-out, against a stub endpoint (its own build, in node_modules/.hj/)
import { chromium, webkit, devices } from 'playwright';
import { createServer } from 'node:http';
import { createReadStream, readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import sharp from 'sharp';

const prod = process.env.HJ_PROD ?? 'http://127.0.0.1:4173/';
const oldProd = process.env.HJ_OLD_PROD ?? 'http://127.0.0.1:4174/';
const site = new URL('../../', import.meta.url).pathname;
const out = new URL(process.env.HJ_OUT ?? '../review-fixes/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const IDS = ['build', 'grow', 'design', 'film', 'set'];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const r1 = (n) => Math.round(n * 10) / 10;
const say = (label, value) => console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
const ENGINES = Object.fromEntries(Object.entries({ chrome: [chromium, { channel: 'chrome' }], webkit: [webkit, {}] }).filter(([k]) => !process.argv[3] || process.argv[3] === k));
const launch = (name) => ENGINES[name][0].launch(ENGINES[name][1]);
const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  portrait: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  landscape: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
/** One file per check; a run with one engine keeps the other's results. */
const save = async (check, engine, data) => {
  const file = `${out}${check}.json`;
  const all = JSON.parse(await readFile(file, 'utf8').catch(() => '{}'));
  all[engine] = data;
  await writeFile(file, `${JSON.stringify(all, null, 1)}\n`);
};
const errorsOf = (page, ignore = () => false) => {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && !m.location().url.endsWith('/favicon.ico') && !ignore(m.text()) && errors.push(m.text().slice(0, 200)));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
};
const SPOTS = Object.fromEntries(IDS.map((id) => {
  const found = [...readFileSync(`${site}src/scenes/${id}.ts`, 'utf8').matchAll(/\{ id: '([\w-]+)', art:/g)].map((m) => m[1]);
  if (found.length !== 10) throw new Error(`${id}: ${found.length} spots read`);
  return [id, found];
}));
/** Progress as the build before saved it (v2), which this build reads and carries on from: the first `n` finds. */
const saved = (n, extra = {}) => {
  let left = n;
  const scenes = {};
  for (const id of IDS) {
    scenes[id] = { found: SPOTS[id].slice(0, Math.max(0, left)), seen: true, panX: null };
    left -= 10;
  }
  return JSON.stringify({ scenes, unlocked: false, panned: true, ...extra });
};
const withSaved = (context, json) => context.addInitScript((value) => {
  if (location.protocol !== 'http:') return;
  if (!sessionStorage.getItem('qa')) { sessionStorage.setItem('qa', '1'); localStorage.setItem('hjaas:site:v2', value); }
}, json);
/** In the page: the finds kept in storage, of either kind. */
const STORED = () => {
  const finds = new Set();
  for (const [id, s] of Object.entries(JSON.parse(localStorage.getItem('hjaas:site:v2') ?? '{}').scenes ?? {})) for (const f of s.found) finds.add(`${id}:${f}`);
  for (const key of Object.keys(localStorage)) { const m = key.match(/^hjaas:site:v3:found:([^:]+):(.+)$/); if (m) finds.add(`${m[1]}:${m[2]}`); }
  return [...finds].sort();
};
const STATE = () => {
  const text = (s) => document.querySelector(s)?.textContent.replace(/\s+/g, ' ').trim() ?? null;
  const seen = (el) => !!el && getComputedStyle(el).visibility === 'visible' && el.getClientRects().length > 0;
  const root = document.querySelector('.hj-scene');
  const retry = [...document.querySelectorAll('.hj-link')].find((b) => b.textContent === 'Retry room');
  return {
    pre: root?.classList.contains('is-pre') ?? true, scene: document.querySelector('.hj-tab[aria-current]')?.dataset.scene ?? null, plate: document.querySelector('.hj-plate')?.dataset.scene ?? null,
    cream: text('.hj-row.is-cream .hj-num-now'), red: text('.hj-row.is-red .hj-num-now'), dots: [...document.querySelectorAll('.hj-tab.is-done')].map((t) => t.dataset.scene),
    button: seen(document.querySelector('.hj-contact')), mushrooms: document.querySelectorAll('.hj-shroom').length, inert: document.querySelector('.hj-mushrooms')?.inert ?? null, rachel: !!document.querySelector('.hj-rachel'),
    controls: [...document.querySelectorAll('.hj-link')].filter(seen).map((b) => b.textContent), retry: !!retry && !retry.hidden && seen(retry),
  };
};
/** The scene is on show, its overlay gone and its mushrooms live. */
const settled = (page, id, timeout = 30000) => page.waitForFunction((scene) => {
  const root = document.querySelector('.hj-scene');
  const skip = [...document.querySelectorAll('.hj-link')].find((b) => b.textContent === 'Skip');
  return root && !root.classList.contains('is-pre') && document.querySelector('.hj-tab[aria-current]')?.dataset.scene === scene && document.querySelector('.hj-mushrooms')?.inert === false && skip.classList.contains('is-off');
}, id, { timeout, polling: 100 });
const press = (page, at, touch) => (touch ? page.touchscreen.tap(at.x, at.y) : page.mouse.click(at.x, at.y));
const centreOf = (page, id) => page.evaluate((x) => { const r = document.querySelector(`.hj-shroom[data-spot="${x}"] .hj-shroom-art`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
const bringIn = async (page, id) => {
  await page.evaluate((x) => { const v = document.querySelector('.hj-viewport'); const r = document.querySelector(`.hj-shroom[data-spot="${x}"] .hj-shroom-art`).getBoundingClientRect(); const b = v.getBoundingClientRect(); v.scrollLeft += r.left + r.width / 2 - (b.left + b.width / 2); }, id);
  await wait(350);
  return centreOf(page, id);
};
const run = {};

// ---- Nothing broke: the whole hunt. ---------------------------------------------------------------------------
run.hunt = async (engine) => {
  const report = {};
  for (const [device, options] of Object.entries(DEVICES)) {
    const touch = device !== 'desktop';
    const browser = await launch(engine); const context = await browser.newContext(options); const page = await context.newPage(); const errors = errorsOf(page);
    const missed = []; const counts = [];
    await page.goto(prod); await settled(page, 'build');
    for (const [n, id] of IDS.entries()) {
      await wait(1200);
      for (const spot of SPOTS[id]) {
        const at = await bringIn(page, spot);
        await press(page, at, touch); await wait(60);
        if (await page.locator(`.hj-shroom[data-spot="${spot}"]`).count()) missed.push(`${id}:${spot}`);
        await wait(430);
      }
      await wait(1200);
      counts.push(await page.evaluate(() => [...document.querySelectorAll('.hj-num-now')].map((e) => e.textContent).join(' · ')));
      if (n < 4) { const next = page.locator('a.hj-next'); if (touch) await next.tap(); else await next.click(); await settled(page, IDS[n + 1]); }
    }
    await wait(3200);
    const end = await page.evaluate(STATE);
    const stored = (await page.evaluate(STORED)).length;
    await page.reload(); await settled(page, 'set'); await wait(600);
    const again = await page.evaluate(STATE);
    const button = page.locator('.hj-contact'); if (touch) await button.tap(); else await button.click();
    await wait(600);
    report[device] = { afterEachScene: counts, found: 50 - missed.length, missed, dots: end.dots, button: end.button, findsStored: stored, afterReload: { button: again.button, dots: again.dots.length, mushroomsLeft: again.mushrooms }, formOpens: await page.evaluate(() => document.querySelector('.hj-dialog').open), errors };
    report[device].ok = !missed.length && end.button && stored === 50 && again.button && report[device].formOpens && !errors.length;
    say(`${engine} ${device}`, report[device]); await browser.close(); await save('hunt', engine, report);
  }
};

// ---- Nothing broke: the pictures. Reduced motion, so both builds hold the same pose. --------------------------
run.same = async (engine) => {
  const report = {};
  for (const [device, options] of Object.entries(DEVICES)) {
    const browser = await launch(engine);
    for (const n of [17, 50]) for (const id of IDS) {
      const shots = [];
      for (const url of [oldProd, prod]) {
        const context = await browser.newContext({ ...options, reducedMotion: 'reduce' }); await withSaved(context, saved(n)); const page = await context.newPage();
        await page.goto(`${url}#${id}`); await settled(page, id).catch(() => {}); await wait(1500);
        shots.push(await page.screenshot()); await context.close();
      }
      const [a, b] = await Promise.all(shots.map((s) => sharp(s).removeAlpha().raw().toBuffer()));
      let differ = 0; let most = 0;
      for (let i = 0; i < a.length; i += 3) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); if (d > 2) differ++; most = Math.max(most, d); }
      report[`${device} ${id} ${n}`] = { pixelsThatDiffer: differ, of: a.length / 3, mostLevels: most };
      if (differ) { await sharp(shots[0]).png().toFile(`${out}same-${engine}-${device}-${id}-${n}-before.png`); await sharp(shots[1]).png().toFile(`${out}same-${engine}-${device}-${id}-${n}-now.png`); }
    }
    say(`${engine} ${device}`, Object.entries(report).filter(([k]) => k.startsWith(device)).map(([k, v]) => `${k}: ${v.pixelsThatDiffer}`).join(', '));
    await browser.close();
  }
  await save('same', engine, report);
};

// ---- C1. ---------------------------------------------------------------------------------------------------------
run.c1 = async (engine) => {
  const report = {};
  const browser = await launch(engine);
  const fresh = async (block, hash = 'build', json = null) => {
    const context = await browser.newContext(DEVICES.desktop); if (json) await withSaved(context, json);
    const page = await context.newPage(); const errors = errorsOf(page, (t) => /Failed to load resource|ERR_FAILED|cannot load|Blocked by/i.test(t)); const warnings = [];
    page.on('console', (m) => m.type() === 'warning' && m.text().startsWith('[hjaas]') && warnings.push(m.text().slice(0, 130)));
    let hits = 0; const abort = (route) => { hits++; return route.abort(); };
    if (block) await page.route(block, abort);
    const t = Date.now(); await page.goto(`${prod}#${hash}`);
    return { context, page, errors, warnings, unblock: () => page.unroute(block, abort), hits: () => hits, since: () => Date.now() - t };
  };
  const findAll = async (page, id) => { for (const spot of SPOTS[id]) { const at = await centreOf(page, spot); await page.mouse.click(at.x, at.y); await wait(480); } await wait(900); return page.evaluate(STATE); };
  // One sprite. (mushroom_02 is in Build's hunt.)
  {
    const art = readFileSync(`${site}src/scenes/build.ts`, 'utf8').match(/art: (\d+)/)[1].padStart(2, '0');
    const v = await fresh(`**/mushroom_${art}.webp`); await settled(v.page, 'build'); const before = await v.page.evaluate(STATE);
    await v.page.screenshot({ path: `${out}c1-${engine}-sprite.jpg`, type: 'jpeg', quality: 85 });
    const after = await findAll(v.page, 'build');
    report.sprite = { blocked: `mushroom_${art}.webp`, requestsRefused: v.hits(), roomShows: before.plate === 'build' && !before.pre, mushrooms: before.mushrooms, rachel: before.rachel, foundOfTen: after.cream, retry: before.retry, warnings: v.warnings, errors: v.errors };
    report.sprite.ok = report.sprite.roomShows && before.mushrooms === 10 && after.cream === '10' && v.hits() > 0 && !v.errors.length;
    say(`${engine} sprite`, report.sprite); await v.context.close();
  }
  // Every sprite: no hunt without them, so Retry; and it recovers.
  {
    const v = await fresh('**/mushrooms/*.webp'); await v.page.waitForFunction(() => [...document.querySelectorAll('.hj-link')].some((b) => b.textContent === 'Retry room' && !b.hidden), null, { timeout: 20000 });
    const before = await v.page.evaluate(STATE); await v.unblock(); await v.page.getByText('Retry room').click(); await settled(v.page, 'build'); const after = await v.page.evaluate(STATE);
    report.allSprites = { retryOffered: before.retry, afterRetry: { mushrooms: after.mushrooms, rachel: after.rachel, retry: after.retry }, errors: v.errors };
    report.allSprites.ok = before.retry && after.mushrooms === 10 && after.rachel && !after.retry && !v.errors.length;
    say(`${engine} all sprites`, report.allSprites); await v.context.close();
  }
  // One cast frame, in each scene: the room without her, the hunt whole.
  report.castFrame = {};
  for (const [id, block] of Object.entries({ build: '**/scene1/rachel*/frame_01.webp', grow: '**/scene2/rachel*/stills/*.webp', design: '**/scene3/cast/**/*.webp', film: '**/scene4/cast/**/*.webp', set: '**/scene5/cast/**/*.webp' })) {
    // The first cast image each scene asks for, and only that one.
    let name = null; const context = await browser.newContext(DEVICES.desktop); const page = await context.newPage(); const errors = errorsOf(page, (t) => /Failed to load resource|ERR_FAILED|cannot load|Blocked by/i.test(t));
    const folder = `scene${IDS.indexOf(id) + 1}`;
    await page.route((url) => url.pathname.includes(`/${folder}/`) && url.pathname.endsWith('.webp') && !/room|lines|edge/.test(url.pathname), (route) => { const p = new URL(route.request().url()).pathname.replace(/.*\/scene\d\//, ''); name ??= p; return p === name ? route.abort() : route.continue(); });
    await page.goto(`${prod}#${id}`); await settled(page, id); const before = await page.evaluate(STATE); const after = await findAll(page, id);
    if (id === 'build') await page.screenshot({ path: `${out}c1-${engine}-cast-frame.jpg`, type: 'jpeg', quality: 85 });
    // And she is back once it can be had: away and back again.
    await page.unrouteAll(); const elsewhere = id === 'build' ? 'film' : 'build';
    await page.click(`.hj-tab[data-scene="${elsewhere}"]`); await settled(page, elsewhere); await page.click(`.hj-tab[data-scene="${id}"]`); await settled(page, id); await wait(800);
    const back = await page.evaluate(STATE);
    report.castFrame[id] = { blocked: name, roomShows: before.plate === id && !before.pre, rachelWithout: before.rachel, mushrooms: before.mushrooms, foundOfTen: after.cream, rachelOnComingBack: back.rachel, errors };
    report.castFrame[id].ok = report.castFrame[id].roomShows && before.mushrooms === 10 && after.cream === '10' && back.rachel && !errors.length;
    say(`${engine} cast frame ${id}`, report.castFrame[id]); await context.close();
  }
  // The room, at the opening.
  for (const [what, block] of Object.entries({ room: '**/scene1/room.webp', folder: '**/scene1/**' })) {
    const v = await fresh(block); await v.page.waitForFunction(() => [...document.querySelectorAll('.hj-link')].some((b) => b.textContent === 'Retry room' && !b.hidden), null, { timeout: 20000 });
    const offeredAfterMs = v.since(); const before = await v.page.evaluate(STATE); await v.page.screenshot({ path: `${out}c1-${engine}-opening-${what}-blocked.jpg`, type: 'jpeg', quality: 85 });
    // Pressed while still blocked: offered again. Another scene can be had meanwhile.
    await v.page.getByText('Retry room').click(); await wait(1500); const still = await v.page.evaluate(STATE);
    await v.unblock(); await v.page.getByText('Retry room').click(); await settled(v.page, 'build'); const after = await findAll(v.page, 'build');
    report[`opening, ${what} blocked`] = { retryOfferedAfterMs: offeredAfterMs, requestsRefused: v.hits(), retry: before.retry, retryAgainWhileBlocked: still.retry, controlsThen: before.controls, afterRetry: { plate: after.plate, rachel: after.rachel, foundOfTen: after.cream, retry: after.retry }, errors: v.errors };
    report[`opening, ${what} blocked`].ok = before.retry && still.retry && after.plate === 'build' && after.rachel && after.cream === '10' && !after.retry && !v.errors.length;
    say(`${engine} opening, ${what}`, report[`opening, ${what} blocked`]); await v.context.close();
  }
  // The opening's room blocked: another scene's tab still opens that scene.
  {
    const v = await fresh('**/scene1/**'); await v.page.waitForFunction(() => [...document.querySelectorAll('.hj-link')].some((b) => b.textContent === 'Retry room' && !b.hidden), null, { timeout: 20000 });
    await v.page.click('.hj-tab[data-scene="film"]'); await settled(v.page, 'film'); const s = await v.page.evaluate(STATE);
    report.otherTabAfterFailedOpening = { scene: s.scene, retry: s.retry, errors: v.errors }; report.otherTabAfterFailedOpening.ok = s.plate === 'film' && !s.retry && !v.errors.length;
    say(`${engine} other tab`, report.otherTabAfterFailedOpening); await v.context.close();
  }
  // The room, on a switch: the old picture stays and its hunt works; Retry recovers.
  {
    const v = await fresh('**/scene3/room.webp', 'build', saved(0)); await settled(v.page, 'build');
    await v.page.click('.hj-tab[data-scene="design"]'); await v.page.waitForFunction(() => [...document.querySelectorAll('.hj-link')].some((b) => b.textContent === 'Retry room' && !b.hidden), null, { timeout: 20000 });
    const before = await v.page.evaluate(STATE); await v.page.screenshot({ path: `${out}c1-${engine}-switch-room-blocked.jpg`, type: 'jpeg', quality: 85 });
    const at = await centreOf(v.page, SPOTS.build[0]); await v.page.mouse.click(at.x, at.y); await wait(900); const found = await v.page.evaluate(STATE);
    await v.page.click('.hj-tab[data-scene="film"]'); await settled(v.page, 'film'); const film = await v.page.evaluate(STATE);
    await v.page.click('.hj-tab[data-scene="design"]'); await v.page.waitForFunction(() => [...document.querySelectorAll('.hj-link')].some((b) => b.textContent === 'Retry room' && !b.hidden), null, { timeout: 20000 });
    await v.unblock(); await v.page.getByText('Retry room').click(); await settled(v.page, 'design'); const after = await findAll(v.page, 'design');
    report.switchRoomBlocked = { oldRoomKept: before.plate, retry: before.retry, huntGoesOn: found.cream, anotherTabWorks: film.plate, retryGoneThere: !film.retry, afterRetry: { plate: after.plate, rachel: after.rachel, foundOfTen: after.cream, retry: after.retry }, errors: v.errors };
    report.switchRoomBlocked.ok = before.plate === 'build' && before.retry && found.cream === '1' && film.plate === 'film' && !film.retry && after.plate === 'design' && after.rachel && after.cream === '10' && !v.errors.length;
    say(`${engine} switch`, report.switchRoomBlocked); await v.context.close();
  }
  await browser.close(); await save('c1', engine, report);
};
run.slow = async (engine) => {
  if (engine !== 'chrome') return;
  const report = {};
  for (const kbps of [1600, 1000, 700, 400]) for (const [build, url] of [['now', prod], ['before', oldProd]]) {
    const browser = await launch(engine); const context = await browser.newContext({ ...DEVICES.portrait, deviceScaleFactor: 3 }); const page = await context.newPage(); const cdp = await context.newCDPSession(page);
    const failed = []; page.on('requestfailed', (r) => failed.push(r.url().replace(/.*\/assets\//, '')));
    await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: kbps * 125, uploadThroughput: 93750 });
    await cdp.send('Page.navigate', { url });
    await page.waitForFunction(() => performance.getEntriesByName('hj-paint').length > 0 || [...document.querySelectorAll('.hj-link')].some((b) => b.textContent === 'Retry room' && !b.hidden), null, { timeout: 130000, polling: 250 });
    report[`${kbps} kbit/s, ${build}`] = { ...(await page.evaluate(() => ({ paintingStartsMs: Math.round(performance.getEntriesByName('hj-paint').at(-1)?.startTime ?? NaN), rachel: !!document.querySelector('.hj-rachel') }))), retry: (await page.evaluate(STATE)).retry, requestsGivenUp: failed };
    say(`${kbps} ${build}`, report[`${kbps} kbit/s, ${build}`]); await browser.close();
  }
  await save('slow', engine, report);
};

// ---- C2. ---------------------------------------------------------------------------------------------------------
run.c2 = async (engine) => {
  const report = {};
  for (const [build, url] of [['now', prod], ['before', oldProd]]) {
    const browser = await launch(engine); const row = {};
    const json = { scenes: Object.fromEntries(IDS.map((id) => [id, { found: [], seen: true, panX: null }])), unlocked: false, panned: true };
    const open = async (context, hash, device) => { const page = await context.newPage(); if (device) await page.setViewportSize(DEVICES[device].viewport); await page.goto(`${url}#${hash}`); await settled(page, hash); await wait(400); return page; };
    const seed = (context, value) => context.addInitScript((v) => { if (!localStorage.getItem('qa')) { localStorage.setItem('qa', '1'); localStorage.setItem('hjaas:site:v2', v); } }, value);
    const tap = async (page, spot) => { await page.bringToFront(); const at = await centreOf(page, spot); await page.mouse.click(at.x, at.y); await wait(900); };
    // Two tabs, a find in each, reload.
    {
      const context = await browser.newContext(DEVICES.desktop); await seed(context, JSON.stringify(json));
      const a = await open(context, 'build'); const b = await open(context, 'build'); const errors = [...errorsOf(a), ...errorsOf(b)];
      await tap(a, SPOTS.build[0]); await wait(300); const bSees = await b.evaluate(STATE);
      await tap(b, SPOTS.build[1]); await wait(300); const aSees = await a.evaluate(STATE);
      // A third find in another scene, by the first tab.
      await a.bringToFront(); await a.click('.hj-tab[data-scene="grow"]'); await settled(a, 'grow'); await tap(a, SPOTS.grow[0]);
      const stored = await a.evaluate(STORED);
      await a.reload(); await settled(a, 'grow'); await b.reload(); await settled(b, 'build');
      row.findInEach = { otherTabSeesItAtOnce: [bSees.red, aSees.red], stored, afterReload: { a: (await a.evaluate(STATE)).red, b: (await b.evaluate(STATE)).red }, errors };
      await context.close();
    }
    // A stale tab pans (portrait) after the other has found the fiftieth: the unlock stays. The storage event is held
    // back from it, as it is when a tab is asleep, so its own copy really is old.
    {
      const context = await browser.newContext(DEVICES.portrait); await seed(context, saved(49));
      const stale = await context.newPage(); await stale.addInitScript(() => addEventListener('storage', (e) => e.stopImmediatePropagation(), true));
      await stale.goto(`${url}#set`); await settled(stale, 'set'); const other = await open(context, 'set');
      await other.bringToFront(); const at = await bringIn(other, SPOTS.set[9]); await other.touchscreen.tap(at.x, at.y); await wait(3500);
      const unlocked = await other.evaluate(STATE); const staleSees = await stale.evaluate(STATE);
      await stale.bringToFront(); await stale.evaluate(() => { const v = document.querySelector('.hj-viewport'); v.scrollLeft += 60; }); await wait(800);
      const stored = (await stale.evaluate(STORED)).length;
      await stale.evaluate(() => { const v = document.querySelector('.hj-viewport'); v.scrollLeft += 40; }); await stale.reload(); await settled(stale, 'set').catch(() => {}); await wait(800);
      const pan = await stale.evaluate(() => localStorage.getItem('hjaas:site:v3:pan:set'));
      await other.reload(); await settled(other, 'set').catch(() => {}); await wait(800);
      row.stalePan = { otherTabUnlocked: unlocked.button, staleTabStillOld: staleSees.red, storedAfterThePan: stored, afterReload: { staleTab: (await stale.evaluate(STATE)).button, otherTab: (await other.evaluate(STATE)).button }, panSavedAcrossAnImmediateReload: pan };
      await context.close();
    }
    row.ok = row.findInEach.stored.length === 3 && row.findInEach.afterReload.a === '3' && row.findInEach.afterReload.b === '3' && row.stalePan.storedAfterThePan === 50 && row.stalePan.afterReload.staleTab && row.stalePan.afterReload.otherTab;
    report[build] = row; say(`${engine} ${build}`, row); await browser.close();
  }
  await save('c2', engine, report);
};

// ---- C3. ---------------------------------------------------------------------------------------------------------
run.c3 = async (engine) => {
  const report = {};
  for (const [build, url] of [['now', prod], ['before', oldProd]]) {
    const row = {}; const browser = await launch(engine);
    // Where each scene's mushrooms are, on a desktop, and their boxes.
    const boxes = {};
    {
      const context = await browser.newContext({ ...DEVICES.desktop, reducedMotion: 'reduce' }); await withSaved(context, saved(0)); const page = await context.newPage(); await page.goto(`${url}#build`);
      for (const id of IDS) { await page.click(`.hj-tab[data-scene="${id}"]`); await settled(page, id).catch(() => {}); await wait(800); boxes[id] = await page.evaluate(() => [...document.querySelectorAll('.hj-shroom')].map((b) => { const r = b.getBoundingClientRect(); const a = b.querySelector('.hj-shroom-art').getBoundingClientRect(); return { id: b.dataset.spot, x: a.left + a.width / 2, y: a.top + a.height / 2, l: r.left, t: r.top, r: r.right, b: r.bottom }; })); }
      await context.close();
    }
    const clear = (p, others) => others.every((o) => p.x < o.l - 6 || p.x > o.r + 6 || p.y < o.t - 6 || p.y > o.b + 6);
    // Switches between scenes seen before, and to one never seen: taps on the new scene's mushrooms until the overlay is gone.
    for (const [kind, json] of [['short brush', saved(0)], ['first-visit painting', JSON.stringify({ scenes: { build: { found: [], seen: true, panX: null }, grow: { found: [], seen: true, panX: null } }, unlocked: false, panned: true })]]) {
      const pairs = kind === 'short brush' ? [['build', 'grow'], ['grow', 'design'], ['design', 'film'], ['film', 'set'], ['set', 'build']] : [['build', 'design'], ['build', 'film'], ['build', 'set']];
      const rows = {};
      for (const [from, to] of pairs) {
        const context = await browser.newContext(DEVICES.desktop); await withSaved(context, json); const page = await context.newPage(); const errors = errorsOf(page);
        await page.goto(`${url}#${from}`); await settled(page, from); await wait(900);
        // (Until the new picture is put in the window a tap is the old scene's: only points clear of its boxes are used.)
        const points = boxes[to].filter((p) => clear(p, boxes[from]));
        await page.evaluate(() => {
          window.__log = [];
          const covered = () => !!document.querySelector('.hj-paint.is-over-window, .hj-plate > .hj-paint:not(.is-veil)');
          const skip = [...document.querySelectorAll('.hj-link')].find((b) => b.textContent === 'Skip');
          addEventListener('pointerdown', (e) => window.__log.push({ at: performance.now(), busy: !skip.classList.contains('is-off'), covered: covered(), inert: document.querySelector('.hj-mushrooms')?.inert, scene: document.querySelector('.hj-plate')?.dataset.scene, on: document.elementFromPoint(e.clientX, e.clientY)?.closest('.hj-shroom')?.dataset.spot ?? null }), true);
        });
        await page.click(`.hj-tab[data-scene="${to}"]`);
        let taps = 0; const t = Date.now(); let collectedWhileCovered = 0; let focusable = 0;
        // Tap for the brush's 1.45 s; a first visit's painting allows nothing until its wash (4.06 s).
        const until = kind === 'short brush' ? 1350 : 4200;
        while (Date.now() - t < until) {
          const p = points[taps % points.length]; await page.mouse.click(p.x, p.y); taps++;
          // Synthetic clicks and focus too (what a keyboard or a screen reader would do).
          focusable += await page.evaluate(() => { const b = document.querySelector('.hj-shroom'); const busy = [...document.querySelectorAll('.hj-link')].some((x) => x.textContent === 'Skip' && !x.classList.contains('is-off')); if (!b || !busy) return 0; b.focus(); const got = document.activeElement === b ? 1 : 0; if (got) b.blur(); b.click(); return got; });
          await wait(60);
        }
        collectedWhileCovered = (await page.evaluate(STORED)).length;
        await settled(page, to); await wait(1500);
        const log = await page.evaluate(() => window.__log);
        // And once it has cleared, a tap works.
        const left = await page.evaluate(() => document.querySelector('.hj-shroom')?.dataset.spot); if (left) { const at = await centreOf(page, left); await page.mouse.click(at.x, at.y); await wait(700); }
        rows[`${from} → ${to}`] = { taps, whileTheBrushWorked: log.filter((l) => l.busy && l.scene === to).length, collected: collectedWhileCovered, hiddenMushroomsThatTookFocus: focusable, afterwardsATapCollects: (await page.evaluate(STORED)).length - collectedWhileCovered, errors };
        await context.close();
      }
      row[kind] = rows; say(`${engine} ${build} ${kind}`, rows);
    }
    // A return visit's reveal (200 ms), made ten times slower so that it can be tapped.
    {
      const context = await browser.newContext(DEVICES.desktop); await withSaved(context, saved(0));
      await context.addInitScript(() => { const { animate } = Element.prototype; Element.prototype.animate = function slow(k, o) { return animate.call(this, k, typeof o === 'object' && o.duration === 200 ? { ...o, duration: 2000 } : o); }; });
      const page = await context.newPage(); await page.goto(`${url}#grow`, { waitUntil: 'commit' });
      await page.waitForSelector('.hj-blank', { state: 'attached', timeout: 15000 });
      let taps = 0; let tookFocus = 0; let during = 0; const t = Date.now();
      while (Date.now() - t < 1500) { const p = boxes.grow[taps % 10]; await page.mouse.click(p.x, p.y); taps++; during += await page.evaluate(() => Number(getComputedStyle(document.querySelector('.hj-blank')).opacity) > 0.02); tookFocus += await page.evaluate(() => { const b = document.querySelector('.hj-shroom'); if (!b) return 0; b.focus(); const got = document.activeElement === b ? 1 : 0; b.click(); if (got) document.activeElement?.blur(); return got; }); await wait(50); }
      const collected = (await page.evaluate(STORED)).length; await wait(2500);
      const left = await page.evaluate(() => document.querySelector('.hj-shroom')?.dataset.spot); if (left) { const at = await centreOf(page, left); await page.mouse.click(at.x, at.y); await wait(700); }
      row['return reveal'] = { taps, tapsUnderTheBlankSheet: during, collected, hiddenMushroomsThatTookFocus: tookFocus, afterwardsATapCollects: (await page.evaluate(STORED)).length - collected };
      say(`${engine} ${build} return reveal`, row['return reveal']); await context.close();
    }
    // Portrait: a swipe in the middle of the short brush ends it at once on the new crop (its strokes would be misplaced).
    if (build === 'now') {
      const context = await browser.newContext(DEVICES.portrait); await withSaved(context, saved(0)); const page = await context.newPage();
      await page.goto(`${url}#build`); await settled(page, 'build'); await wait(700); await page.locator('.hj-tab[data-scene="grow"]').tap();
      await page.waitForFunction(() => document.querySelector('.hj-plate')?.dataset.scene === 'grow' && document.querySelector('.hj-paint.is-over-window'), null, { polling: 'raf' }); await wait(500);
      const before = await page.evaluate(STATE); await page.evaluate(() => { document.querySelector('.hj-viewport').scrollLeft += 40; }); await wait(60); const after = await page.evaluate(STATE);
      row['a pan during the brush'] = { inertBefore: before.inert, inert60msAfterThePan: after.inert, controls: after.controls }; say(`${engine} pan in brush`, row['a pan during the brush']); await context.close();
    }
    const all = [...Object.values(row['short brush']), ...Object.values(row['first-visit painting']), row['return reveal']];
    row.collectedThroughTheOverlay = all.reduce((n, r) => n + r.collected, 0);
    row.ok = all.every((r) => r.collected === 0 && r.hiddenMushroomsThatTookFocus === 0 && r.afterwardsATapCollects === 1);
    say(`${engine} ${build}`, { collected: row.collectedThroughTheOverlay, ok: row.ok });
    report[build] = row; await browser.close();
  }
  await save('c3', engine, report);
};

// ---- C4. ---------------------------------------------------------------------------------------------------------
run.c4 = async (engine) => {
  const report = {};
  for (const [build, url] of [['now', prod], ['before', oldProd]]) {
    const rows = {};
    for (const [name, size] of Object.entries({ '390x844': [390, 844], '375x667': [375, 667] })) for (const edge of ['right', 'left']) {
      const browser = await launch(engine); const context = await browser.newContext({ ...DEVICES.portrait, viewport: { width: size[0], height: size[1] } }); await withSaved(context, saved(3)); const page = await context.newPage(); const errors = errorsOf(page);
      await page.goto(`${url}#grow`); await settled(page, 'grow'); await wait(600);
      const crop = () => page.evaluate(() => { const v = document.querySelector('.hj-viewport'); const p = document.querySelector('.hj-plate'); const u = p.clientWidth / 1672; return { left: Math.round(v.scrollLeft), most: v.scrollWidth - v.clientWidth, plateX: Math.round((v.scrollLeft + v.clientWidth / 2) / u) }; });
      const opened = await crop();
      if (engine === 'chrome') {
        // A real swipe, through the compositor, momentum and all.
        const box = await page.locator('.hj-viewport').boundingBox(); const cdp = await context.newCDPSession(page);
        for (let i = 0; i < 5; i++) await cdp.send('Input.synthesizeScrollGesture', { x: box.x + box.width / 2, y: box.y + box.height / 2, xDistance: edge === 'right' ? -300 : 300, speed: 1600, gestureSourceType: 'touch' });
      } else await page.evaluate((e) => { const v = document.querySelector('.hj-viewport'); v.scrollLeft = e === 'right' ? v.scrollWidth : 0; }, edge);
      await wait(1200); const panned = await crop();
      await page.setViewportSize({ width: size[1], height: size[0] }); await wait(1200); const landscape = await crop(); const savedThen = await page.evaluate(() => localStorage.getItem('hjaas:site:v3:pan:grow') ?? JSON.parse(localStorage.getItem('hjaas:site:v2')).scenes.grow.panX);
      await page.setViewportSize({ width: size[0], height: size[1] }); await wait(1200); const back = await crop();
      await page.reload(); await settled(page, 'grow'); await wait(600); const reloaded = await crop();
      rows[`${name} ${edge}`] = { opened, panned, landscape, savedInLandscape: Number(savedThen), back, afterReload: reloaded, errors, ok: Math.abs(back.plateX - panned.plateX) <= 2 && Math.abs(reloaded.plateX - panned.plateX) <= 3 && panned.plateX !== opened.plateX };
      await browser.close();
    }
    report[build] = rows; say(`${engine} ${build}`, rows);
  }
  await save('c4', engine, report);
};

// ---- C5. ---------------------------------------------------------------------------------------------------------
const LOOK = () => {
  // Every frame: what still moves and what the sheet over the picture still hides.
  window.__frames = []; const small = document.createElement('canvas'); small.width = 40; small.height = 24; const g = small.getContext('2d', { willReadFrequently: true });
  const tick = () => {
    const sheet = document.querySelector('.hj-plate > .hj-paint:not(.is-veil), .hj-paint.is-over-window'); let alpha = 0;
    if (sheet) { g.clearRect(0, 0, 40, 24); g.drawImage(sheet, 0, 0, 40, 24); const d = g.getImageData(0, 0, 40, 24).data; for (let i = 3; i < d.length; i += 4) alpha += d[i] > 8; }
    const fly = [...document.querySelectorAll('.hj-flyer')].filter((f) => Number(getComputedStyle(f).opacity) > 0.02).map((f) => Math.round(f.getBoundingClientRect().left));
    const moving = document.querySelector('.hj-caption')?.getAnimations({ subtree: true }).length ?? 0;
    window.__frames.push({ t: performance.now(), sheetPc: Math.round(alpha / 9.6), fly, caption: moving, cream: document.querySelector('.hj-num-now')?.textContent, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, inert: document.querySelector('.hj-mushrooms')?.inert, skip: [...document.querySelectorAll('.hj-link')].some((b) => b.textContent === 'Skip' && !b.classList.contains('is-off')) });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
run.c5 = async (engine) => {
  const report = {};
  const after = (frames) => { const i = frames.findIndex((f) => f.reduced); return { at: frames[i].t, rows: frames.slice(i), was: frames[i - 1] }; };
  const settledIn = (rows, at, ok) => { const i = rows.findIndex((f, n) => ok(f) && rows.slice(n).every(ok)); return i < 0 ? null : { ms: Math.round(rows[i].t - at), frames: i }; };
  for (const device of ['desktop', 'portrait']) {
    const touch = device !== 'desktop'; const browser = await launch(engine); const row = {};
    const open = async (json, hash) => { const context = await browser.newContext(DEVICES[device]); if (json) await withSaved(context, json); const page = await context.newPage(); const errors = errorsOf(page); await page.goto(`${prod}#${hash}`); return { context, page, errors }; };
    // In the painting.
    {
      const { context, page, errors } = await open(null, 'build'); await page.waitForFunction(() => performance.getEntriesByName('hj-paint').length, null, { polling: 'raf' }); await page.evaluate(LOOK); await wait(1800);
      await page.emulateMedia({ reducedMotion: 'reduce' }); await wait(1500);
      const { at, rows, was } = after(await page.evaluate(() => window.__frames)); const s = await page.evaluate(STATE);
      row.painting = { sheetBeforePc: was.sheetPc, settled: settledIn(rows, at, (f) => f.sheetPc === 0 && !f.skip && f.inert === false), controls: s.controls, rachel: s.rachel, errors };
      // She holds her pose: no drawing changes for 2 s.
      const pose = () => page.evaluate(() => { const c = document.querySelector('.hj-rachel canvas') ?? document.querySelector('canvas.hj-rachel'); const x = document.createElement('canvas'); x.width = c.width; x.height = c.height; x.getContext('2d').drawImage(c, 0, 0); const d = x.getContext('2d').getImageData(0, 0, x.width, x.height).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0; return h; });
      const held = new Set(); for (let i = 0; i < 8; i++) { held.add(await pose()); await wait(250); } row.painting.posesInTwoSeconds = held.size;
      // And a find still works; motion back on, she works again.
      const at1 = await bringIn(page, SPOTS.build[4]); await press(page, at1, touch); await wait(900); row.painting.aFindAfterwards = (await page.evaluate(STATE)).cream;
      await page.emulateMedia({ reducedMotion: 'no-preference' }); await wait(400); const again = new Set(); for (let i = 0; i < 24; i++) { again.add(await pose()); await wait(250); } row.painting.posesInSixSecondsWithMotionBack = again.size;
      row.painting.ok = row.painting.sheetBeforePc > 5 && row.painting.settled?.ms <= 100 && held.size === 1 && row.painting.aFindAfterwards === '1' && again.size > 1 && !errors.length;
      await context.close();
    }
    // In the short brush of a switch.
    {
      const { context, page, errors } = await open(saved(0), 'build'); await settled(page, 'build'); await wait(800); await page.evaluate(LOOK);
      if (touch) await page.locator('.hj-tab[data-scene="set"]').tap(); else await page.click('.hj-tab[data-scene="set"]');
      await page.waitForFunction(() => document.querySelector('.hj-plate')?.dataset.scene === 'set' && window.__frames.at(-1).sheetPc > 0 && window.__frames.at(-1).sheetPc < 95, null, { polling: 'raf' }); await wait(250);
      await page.emulateMedia({ reducedMotion: 'reduce' }); await wait(1200);
      const { at, rows, was } = after(await page.evaluate(() => window.__frames));
      row.switch = { sheetBeforePc: was.sheetPc, settled: settledIn(rows, at, (f) => f.sheetPc === 0 && !f.skip && f.inert === false), scene: (await page.evaluate(STATE)).scene, errors }; row.switch.ok = row.switch.sheetBeforePc > 5 && row.switch.settled?.ms <= 100 && row.switch.scene === 'set' && !errors.length;
      await context.close();
    }
    // In a find's flight; the tenth; the fiftieth (and half way through its ceremony).
    for (const [name, n, hash, delay] of [['flight', 16, 'grow', 150], ['tenth', 19, 'grow', 150], ['fiftieth', 49, 'set', 150], ['fiftieth, in its ceremony', 49, 'set', 1000]]) {
      const { context, page, errors } = await open(saved(n), hash); await settled(page, hash); await wait(900);
      const spot = await page.evaluate(() => document.querySelector('.hj-shroom').dataset.spot); const p = await bringIn(page, spot); await wait(300);
      await page.evaluate(LOOK); const marksBefore = await page.evaluate(() => performance.getEntriesByName('hj-land').length); const before = await page.evaluate(STATE);
      await press(page, p, touch); await wait(delay);
      const flying = await page.evaluate(() => window.__frames.at(-1).fly.length); await page.emulateMedia({ reducedMotion: 'reduce' }); await wait(1600);
      const { at, rows, was } = after(await page.evaluate(() => window.__frames)); const s = await page.evaluate(STATE); const stored = (await page.evaluate(STORED)).length;
      const said = await page.evaluate(() => document.querySelector('.hj-caption-main [role=status]').textContent);
      row[name] = { flyingWhenSwitched: flying, inTheFrameOfTheSwitch: { cream: rows[0].cream, fly: rows[0].fly }, settled: settledIn(rows, at, (f) => f.fly.length === 0 && f.cream === s.cream && f.caption === 0), from: before.cream, to: s.cream, red: s.red, findsStored: stored, landings: (await page.evaluate(() => performance.getEntriesByName('hj-land').length)) - marksBefore, dots: s.dots, button: s.button, said, errors };
      // Motion back on and a while later: still counted once.
      await page.emulateMedia({ reducedMotion: 'no-preference' }); await wait(1500); row[name].later = { cream: (await page.evaluate(STATE)).cream, findsStored: (await page.evaluate(STORED)).length };
      row[name].ok = Number(s.red) === n + 1 && stored === n + 1 && row[name].landings === 1 && row[name].later.findsStored === n + 1 && row[name].later.cream === s.cream && row[name].settled?.ms <= 100 && (n !== 49 || s.button) && !errors.length;
      await context.close();
    }
    // The tab hidden: in the painting; and from the start, or while it loads (the painting waits to be seen).
    const HIDE = () => { window.__h = false; Object.defineProperty(document, 'hidden', { get: () => window.__h }); Object.defineProperty(document, 'visibilityState', { get: () => (window.__h ? 'hidden' : 'visible') }); window.__hide = (v) => { window.__h = v; document.dispatchEvent(new Event('visibilitychange')); }; };
    for (const when of ['in the painting', 'from the start', 'while it loads', 'in a flight']) {
      const context = await browser.newContext(DEVICES[device]); await context.addInitScript(HIDE); if (when === 'from the start') await context.addInitScript(() => { window.__h = true; }); if (when === 'in a flight') await withSaved(context, saved(16));
      const page = await context.newPage(); const errors = errorsOf(page); if (when === 'while it loads') await page.route('**/scene1/rachel*/**', async (r) => { await wait(2500); await r.continue().catch(() => {}); });
      await page.goto(`${prod}#${when === 'in a flight' ? 'grow' : 'build'}`, { waitUntil: 'commit' });
      const hide = (v) => page.evaluate((x) => window.__hide(x), v); const painted = () => page.evaluate(() => performance.getEntriesByName('hj-paint').length);
      if (when === 'in a flight') {
        await settled(page, 'grow'); await wait(900); const spot = await page.evaluate(() => document.querySelector('.hj-shroom').dataset.spot); const p = await bringIn(page, spot); await press(page, p, touch); await wait(150); await hide(true); await wait(100); const s = await page.evaluate(STATE); await hide(false); await wait(1200);
        row[`hidden ${when}`] = { cream: s.cream, stored: (await page.evaluate(STORED)).length, landings: await page.evaluate(() => performance.getEntriesByName('hj-land').length), later: (await page.evaluate(STATE)).cream, errors }; row[`hidden ${when}`].ok = s.cream === '7' && row[`hidden ${when}`].stored === 17 && row[`hidden ${when}`].landings === 1 && row[`hidden ${when}`].later === '7' && !errors.length;
      } else if (when === 'in the painting') {
        await page.waitForFunction(() => performance.getEntriesByName('hj-paint').length, null, { polling: 'raf' }); await wait(1500); await hide(true); await wait(150); const s = await page.evaluate(STATE); await hide(false); await wait(800);
        row[`hidden ${when}`] = { finishedWhileHidden: s.inert === false, controlsAfter: (await page.evaluate(STATE)).controls, errors }; row[`hidden ${when}`].ok = s.inert === false && !errors.length;
      } else {
        await wait(900); if (when === 'while it loads') await hide(true); await wait(5000); const hidden = await painted(); const seenHidden = await page.evaluate(() => localStorage.getItem('hjaas:site:v3:seen:build')); await hide(false); await wait(1800); const now = await painted(); await settled(page, 'build', 12000);
        row[`hidden ${when}`] = { paintingsWhileHidden: hidden, countedAsSeenWhileHidden: seenHidden, paintingOnceLookedAt: now, seenAfterwards: await page.evaluate(() => localStorage.getItem('hjaas:site:v3:seen:build')), errors }; row[`hidden ${when}`].ok = hidden === 0 && !seenHidden && now === 1 && row[`hidden ${when}`].seenAfterwards === '1' && !errors.length;
      }
      await context.close();
    }
    report[device] = row; for (const [k, v] of Object.entries(row)) say(`${engine} ${device} ${k}`, v); await browser.close();
  }
  await save('c5', engine, report);
};

// ---- C6. ---------------------------------------------------------------------------------------------------------
run.c6 = async (engine) => {
  const report = {};
  for (const [build, url] of [['now', process.env.HJ_URL ?? 'http://127.0.0.1:5173/'], ['before', process.env.HJ_OLD_URL ?? 'http://127.0.0.1:5174/']]) {
    const browser = await launch(engine); const context = await browser.newContext(DEVICES.portrait); const page = await context.newPage(); const errors = errorsOf(page, (t) => /403/.test(t));
    // Every image bitmap made and closed, counted.
    const held = () => page.evaluate(() => { const here = window.__hj.scene.config.id; const away = {}; for (const [k, v] of Object.entries(window.__hj.memory.parts)) if (/^(build|grow|design|film|set)\./.test(k) && !k.startsWith(`${here}.`) && v) away[k] = Math.round(v / 1e4) / 100; return { total: Math.round(window.__hj.memory.total / 1e5) / 10, awayMB: away }; });
    const go = async (id) => { await page.locator(`.hj-tab[data-scene="${id}"]`).tap(); await page.waitForFunction((x) => window.__hj.scene.config.id === x && !window.__hj.busy, id, { timeout: 60000 }); };
    const rows = {};
    await page.goto(`${url}?debug&reset&intro=quick&seed=4#build`); await page.waitForFunction(() => window.__hj?.ready, null, { timeout: 60000 });
    for (const id of ['grow', 'design', 'film', 'set', 'build']) { await go(id); await wait(4500); rows[`in ${id}, after the ones before`] = await held(); }
    // Left while the reaction is still loading: held frames that come after it has been left.
    await page.close(); const p2 = await context.newPage(); const errors2 = errorsOf(p2, (t) => /403/.test(t));
    await p2.addInitScript(() => {
      // Every bitmap the page is given (by the decoder or its own thread), and whether it has been closed.
      const open = new Map(); window.__open = open; const { close } = ImageBitmap.prototype;
      ImageBitmap.prototype.close = function closed() { open.delete(this); return close.call(this); };
      const { get } = Object.getOwnPropertyDescriptor(MessageEvent.prototype, 'data'); const met = new WeakSet();
      Object.defineProperty(MessageEvent.prototype, 'data', { get() { const d = get.call(this); if (d?.bitmap instanceof ImageBitmap && !met.has(d.bitmap)) { met.add(d.bitmap); open.set(d.bitmap, d.bitmap.width * d.bitmap.height * 4); } return d; } });
      const make = window.createImageBitmap; window.createImageBitmap = async (...a) => { const b = await make.apply(window, a); if (!met.has(b)) { met.add(b); open.set(b, b.width * b.height * 4); } return b; };
    });
    await p2.route((u) => /scene1\/.*reaction.*webp/.test(u.pathname), async (r) => { await wait(400); await r.continue().catch(() => {}); });
    await p2.goto(`${url}?debug&reset&intro=off&seed=4#build`); await p2.waitForFunction(() => window.__hj?.scene && !window.__hj.busy, null, { timeout: 60000 }); await wait(900);
    await p2.locator('.hj-tab[data-scene="film"]').tap(); await p2.waitForFunction(() => window.__hj.scene.config.id === 'film' && !window.__hj.busy, null, { timeout: 60000 }); await wait(12000);
    rows['Build left while its reaction was loading'] = await p2.evaluate(() => Object.fromEntries(Object.entries(window.__hj.memory.parts).filter(([k, v]) => k.startsWith('build.') && v).map(([k, v]) => [k, Math.round(v / 1e4) / 100])));
    const bitmaps = () => p2.evaluate(() => ({ open: window.__open.size, MB: Math.round([...window.__open.values()].reduce((a, b) => a + b, 0) / 1e4) / 100 }));
    rows['bitmaps open then (Film, and what Build has left)'] = await bitmaps();
    // The same room come to without Build having been left half way: what Film alone needs.
    await p2.goto('about:blank'); await p2.goto(`${url}?debug&reset&intro=off&seed=4#film`); await p2.waitForFunction(() => window.__hj?.ready, null, { timeout: 60000 }); await wait(9000); rows['bitmaps open with Film alone'] = await bitmaps();
    report[build] = { ...rows, errors: [...errors, ...errors2] }; say(`${engine} ${build}`, report[build]); await browser.close();
  }
  await save('c6', engine, report);
};

// ---- C7. ---------------------------------------------------------------------------------------------------------
run.c7 = async (engine) => {
  const report = {};
  for (const [build, url] of [['now', prod], ['before', oldProd]]) for (const [name, json, hash] of [['new visitor, Build', null, 'build'], ['return visitor, Grow (Build finished)', saved(10), 'grow'], ['return visitor, Set Design', saved(0), 'set'], ['all fifty found', saved(50), 'build']]) {
    const browser = await launch(engine); const context = await browser.newContext(DEVICES.portrait); if (json) await withSaved(context, json); const page = await context.newPage(); const log = []; const t0 = Date.now();
    if (engine === 'chrome') { const cdp = await context.newCDPSession(page); await cdp.send('Network.enable'); cdp.on('Network.requestWillBeSent', (e) => log.push({ url: e.request.url, priority: e.request.initialPriority, wall: e.wallTime * 1000 })); } else page.on('request', (r) => log.push({ url: r.url(), wall: Date.now() }));
    await page.goto(`${url}#${hash}`); await settled(page, hash); await wait(json ? 300 : 1000);
    const openEnd = await page.evaluate(() => { const p = performance.getEntriesByName('hj-paint').at(-1); return performance.timeOrigin + (p ? p.startTime + 4760 : 0); });
    await wait(6000);
    // Hover and focus of the tabs start nothing.
    const mark = log.length; for (const id of IDS) { await page.hover(`.hj-tab[data-scene="${id}"]`); await page.focus(`.hj-tab[data-scene="${id}"]`); await wait(250); } await wait(800);
    const here = `scene${IDS.indexOf(hash) + 1}/`; const of = (l) => l.url.replace(/.*\/assets\//, '');
    const other = log.filter((l) => /scene\d\//.test(l.url) && !l.url.includes(here)).map((l) => ({ file: of(l), priority: l.priority ?? null, msAfterThePainting: json ? null : Math.round(l.wall - openEnd) }));
    report[`${name}, ${build}`] = { otherRooms: other, requestsOnHoverAndFocus: log.slice(mark).filter((l) => !l.url.includes(here)).map(of), clipsOfThisRoom: [...new Set(log.filter((l) => l.url.includes(here) && /clips?\/|reaction/.test(l.url)).map((l) => l.priority ?? 'n/a'))] };
    say(`${engine} ${name}, ${build}`, report[`${name}, ${build}`]); await browser.close();
  }
  await save('c7', engine, report);
};

// ---- C8. ---------------------------------------------------------------------------------------------------------
run.c8 = async (engine) => {
  const report = {}; const browser = await launch(engine);
  for (const [fragment, want] of [['#%E0%A4%A', 'build'], ['#%', 'build'], ['#%zz', 'build'], ['#%00', 'build'], ['#', 'build'], ['', 'build'], ['#nope', 'build'], ['#BUILD', 'build'], ['#__proto__', 'build'], ['#constructor', 'build'], ['#toString', 'build'], ['#hasOwnProperty', 'build'], ['#grow%20', 'build'], ['##grow', 'build'], ['#%3Cscript%3E', 'build'], ['#%67row', 'grow'], ['#set', 'set'], [`#${'a'.repeat(5000)}`, 'build']]) {
    const context = await browser.newContext({ ...DEVICES.desktop, reducedMotion: 'reduce' }); const page = await context.newPage(); const errors = errorsOf(page);
    await page.goto(`${prod}${fragment}`); await settled(page, want, 10000).catch(() => {}); const s = await page.evaluate(STATE);
    const preload = await page.evaluate(() => document.querySelector('link[rel=preload][as=image]')?.href.replace(/.*\/assets\//, ''));
    // And by the address changing on an open page.
    await page.evaluate(() => { location.hash = '#film'; }); await settled(page, 'film', 10000); await page.evaluate((f) => { location.hash = f || '#'; }, fragment); await settled(page, want, 10000).catch(() => {}); const live = (await page.evaluate(STATE)).scene;
    report[fragment.slice(0, 24) || '(none)'] = { opens: s.scene, preload, whenTheAddressChanges: live, errors, ok: s.scene === want && live === want && preload === `scene${IDS.indexOf(want) + 1}/room.webp` && !errors.length }; await context.close();
  }
  await browser.close(); say(engine, Object.entries(report).map(([k, v]) => `${k} ${v.ok ? 'ok' : JSON.stringify(v)}`).join(' | ')); await save('c8', engine, report);
};

// ---- S3: dist/ as a static host would serve it, its _headers file read and applied to every response. ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain' };
const serveDist = (dist, port) => new Promise((resolve) => {
  // The Netlify and Cloudflare Pages format: a path on its own line, then its headers, indented.
  const rules = []; for (const line of readFileSync(`${dist}/_headers`, 'utf8').split('\n')) { if (!line.trim()) continue; if (/^\S/.test(line)) rules.push({ path: line.trim(), headers: [] }); else { const i = line.indexOf(':'); rules.at(-1).headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]); } }
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname); const file = join(dist, normalize(path === '/' ? '/index.html' : path));
    for (const rule of rules) if (new RegExp(`^${rule.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(path)) for (const [k, v] of rule.headers) res.setHeader(k, v);
    if (path === '/_headers' || !file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) { res.statusCode = 404; res.end('not found'); return; }
    res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream'); createReadStream(file).pipe(res);
  }).listen(port, '127.0.0.1', () => resolve(server));
});
const CSP_WATCH = () => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.effectiveDirective} ${e.blockedURI} ${e.sourceFile ?? ''}:${e.lineNumber} ${e.sample ?? ''}`)); };
run.s3 = async (engine) => {
  const port = engine === 'chrome' ? 4181 : 4182; const server = await serveDist(`${site}dist`, port); const url = `http://127.0.0.1:${port}/`;
  const report = { servedBy: 'run.s3 in qa/tools/review-fixes.mjs: a static server on 127.0.0.1 that reads dist/_headers (Netlify / Cloudflare Pages format) and puts its headers on every response', headers: {}, visits: {} };
  for (const path of ['', 'room-route.js', 'shell.css', 'assets/scene1/room.webp', 'missing.txt']) { const r = await fetch(url + path); report.headers[`/${path}`] = { status: r.status, ...Object.fromEntries(['content-type', 'content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy'].map((h) => [h, r.headers.get(h)])) }; await r.arrayBuffer(); }
  const browser = await launch(engine);
  const visit = async (name, options, json, act) => {
    const context = await browser.newContext(options); if (json) await withSaved(context, json); await context.addInitScript(CSP_WATCH); const page = await context.newPage(); const consoleLines = []; const refused = [];
    page.on('console', (m) => (m.type() === 'error' || /content security policy|refused to/i.test(m.text())) && !m.location().url.endsWith('/favicon.ico') && consoleLines.push(m.text().slice(0, 220))); page.on('pageerror', (e) => consoleLines.push(`pageerror: ${e.message}`)); page.on('requestfailed', (r) => refused.push(`${r.url().replace(url, '/')} ${r.failure()?.errorText}`));
    const workers = []; page.on('worker', (w) => workers.push(w.url().replace(url, '/')));
    const seen = {}; await act(page, seen);
    report.visits[name] = { violations: await page.evaluate(() => window.__csp), console: consoleLines, requestsFailed: refused, decoderWorker: workers, ...seen }; say(`${engine} ${name}`, report.visits[name]); await context.close();
  };
  await visit('opening, find, switches (desktop)', DEVICES.desktop, null, async (page, seen) => {
    await page.goto(url); await settled(page, 'build'); await wait(1500); const p = await centreOf(page, SPOTS.build[0]); await page.mouse.click(p.x, p.y); await wait(2500); seen.afterAFind = (await page.evaluate(STATE)).cream;
    for (const id of ['grow', 'design', 'film', 'set']) { await page.click(`.hj-tab[data-scene="${id}"]`); await settled(page, id); await wait(1200); const at = await centreOf(page, SPOTS[id][0]); await page.mouse.click(at.x, at.y); await wait(1500); }
    await page.click('.hj-tab[data-scene="build"]'); await settled(page, 'build'); await wait(800); seen.red = (await page.evaluate(STATE)).red; seen.fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`)); await page.getByText('Replay painting').click(); await wait(6500); seen.rachel = (await page.evaluate(STATE)).rachel;
    await page.reload(); await settled(page, 'build'); await wait(2000); seen.returnVisit = (await page.evaluate(STATE)).red;
  });
  await visit('opening, find, switch (phone)', DEVICES.portrait, null, async (page, seen) => { await page.goto(`${url}#set`); await settled(page, 'set'); await wait(3200); const p = await bringIn(page, SPOTS.set[0]); await page.touchscreen.tap(p.x, p.y); await wait(2500); await page.locator('.hj-tab[data-scene="film"]').tap(); await settled(page, 'film'); await wait(1500); seen.red = (await page.evaluate(STATE)).red; });
  await visit('a scene complete, the unlock and the form', DEVICES.desktop, saved(49), async (page, seen) => {
    await page.goto(`${url}#set`); await settled(page, 'set'); await wait(1200); const p = await centreOf(page, SPOTS.set[9]); await page.mouse.click(p.x, p.y); await wait(4500); seen.button = (await page.evaluate(STATE)).button; await page.click('.hj-contact'); await wait(700); seen.form = await page.evaluate(() => document.querySelector('.hj-dialog').open); await page.fill('#hj-name', 'A'); await page.click('.hj-chip:nth-child(2)'); await page.keyboard.press('Escape'); await wait(400);
  });
  await visit('reduced motion', { ...DEVICES.desktop, reducedMotion: 'reduce' }, saved(9), async (page, seen) => { await page.goto(`${url}#build`); await settled(page, 'build'); await wait(800); const p = await centreOf(page, SPOTS.build[9]); await page.mouse.click(p.x, p.y); await wait(1500); await page.click('a.hj-next'); await settled(page, 'grow'); await wait(800); seen.scene = (await page.evaluate(STATE)).scene; });
  // The policy is really in force: things it forbids are stopped, and the watcher sees them.
  await visit('CONTROL: what must be stopped', DEVICES.desktop, saved(0), async (page, seen) => {
    await page.goto(url); await settled(page, 'build');
    seen.before = await page.evaluate(() => window.__csp.length);
    seen.tried = await page.evaluate(async () => { const s = document.createElement('script'); s.textContent = 'window.__inline = 1'; document.head.append(s); const i = new Image(); i.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='; document.body.append(i); const d = document.createElement('div'); d.innerHTML = '<p style="color:red">x</p>'; document.body.append(d); let fetched = true; await fetch('http://127.0.0.1:4173/robots.txt', { mode: 'no-cors' }).catch(() => { fetched = false; }); let worker = 'started'; try { const w = new Worker(URL.createObjectURL(new Blob(['postMessage(1)']))); worker = await new Promise((r) => { w.onmessage = () => r('ran'); w.onerror = () => r('refused'); setTimeout(() => r('silent'), 1500); }); } catch { worker = 'refused'; } const f = document.createElement('iframe'); f.src = location.href; document.body.append(f); await new Promise((r) => setTimeout(r, 800)); return { inlineScriptRan: !!window.__inline, styleAttribute: getComputedStyle(d.firstChild).color, crossOriginFetch: fetched, blobWorker: worker }; });
  });
  await browser.close(); server.close();
  report.violationsInTheSite = Object.entries(report.visits).filter(([k]) => !k.startsWith('CONTROL')).reduce((n, [, v]) => n + v.violations.length, 0); report.ok = report.violationsInTheSite === 0 && Object.entries(report.visits).filter(([k]) => !k.startsWith('CONTROL')).every(([, v]) => !v.console.length && !v.requestsFailed.length);
  say(engine, { violations: report.violationsInTheSite, ok: report.ok }); await save('s3', engine, report);
};

// ---- S1: the form, with a stub endpoint on another port (and the build's own CSP, which must let it through). ----
run.s1 = async (engine) => {
  const dist = `${site}node_modules/.hj/dist-s1`; const stub = 'http://127.0.0.1:4196';
  execFileSync('npx', ['vite', 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'error'], { cwd: site, env: { ...process.env, VITE_FORM_ENDPOINT: `${stub}/contact` } });
  const received = []; let mode = 'ok'; let gone = 0; const hanging = [];
  const endpoint = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'content-type, accept'); if (req.method === 'OPTIONS') return res.end();
    let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => { received.push(body); if (mode === 'ok') res.end('{}'); else if (mode === 'fail') { res.statusCode = 500; res.end(); } else { hanging.push(res); res.on('close', () => { if (!res.writableEnded) gone++; }); } });
  });
  await new Promise((r) => endpoint.listen(4196, '127.0.0.1', r));
  const port = 4191; const server = await serveDist(dist, port);
  const report = { connectSrc: readFileSync(`${dist}/_headers`, 'utf8').match(/connect-src [^;]*/)[0] };
  const browser = await launch(engine); const context = await browser.newContext(DEVICES.desktop); await withSaved(context, saved(50)); await context.addInitScript(CSP_WATCH); const page = await context.newPage(); const errors = errorsOf(page, (t) => /status of 500|Failed to load resource/.test(t));
  await page.goto(`http://127.0.0.1:${port}/`); await settled(page, 'build'); await wait(1200);
  const open = async () => { if (!(await page.evaluate(() => document.querySelector('.hj-dialog').open))) { await page.click('.hj-contact'); await wait(500); } };
  const fill = async (v = {}) => { await page.fill('#hj-name', v.name ?? 'Test Visitor'); await page.fill('#hj-email', v.email ?? 'visitor@example.com'); await page.fill('#hj-message', v.message ?? 'A message.'); };
  const send = () => page.click('.hj-form .hj-send');
  const look = () => page.evaluate(() => ({ open: document.querySelector('.hj-dialog').open, sent: !document.querySelector('.hj-sent').hidden, alert: document.querySelector('.hj-failure').hidden ? null : document.querySelector('.hj-failure').textContent, errors: [...document.querySelectorAll('.hj-err')].filter((e) => !e.hidden).map((e) => e.textContent), sending: document.querySelector('.hj-form .hj-send').getAttribute('aria-disabled') === 'true' || /Sending/i.test(document.querySelector('.hj-form .hj-send').textContent), message: document.querySelector('#hj-message').value.length }));
  await open();
  // 1. Typed past the limit: the field stops taking characters.
  report.maxlength = await page.evaluate(() => Object.fromEntries(['name', 'email', 'message'].map((n) => [n, document.querySelector(`#hj-${n}`).maxLength])));
  await page.focus('#hj-name'); await page.keyboard.type('n'.repeat(120), { delay: 0 }); report.nameAfterTyping120 = await page.evaluate(() => document.querySelector('#hj-name').value.length);
  await page.focus('#hj-message'); await page.evaluate(() => document.execCommand('insertText', false, 'm'.repeat(4500))); report.messageAfterInserting4500 = await page.evaluate(() => document.querySelector('#hj-message').value.length);
  // 2. Put in past the limit by script (which maxlength does not stop): refused, nothing sent.
  for (const [field, value] of Object.entries({ name: 'n'.repeat(101), email: `${'e'.repeat(250)}@x.io`, message: 'm'.repeat(4001) })) {
    await fill(); await page.evaluate(([f, v]) => { document.querySelector(`#hj-${f}`).value = v; }, [field, value]); const n = received.length; await send(); await wait(400); const s = await look(); (report.tooLong ??= {})[field] = { length: value.length, errors: s.errors, requests: received.length - n, sent: s.sent };
  }
  // A choice made absurdly long by script: the same.
  await fill(); await page.evaluate(() => { const c = document.querySelector('.hj-needs input'); c.dataset.was = c.value; c.value = 'x'.repeat(600); c.checked = true; }); { const n = received.length; await send(); await wait(400); const s = await look(); report.tooLong.needs = { length: 600, alert: s.alert, requests: received.length - n, sent: s.sent }; } await page.evaluate(() => { const c = document.querySelector('.hj-needs input'); c.value = c.dataset.was; c.checked = false; });
  // 3. Exactly at the limits: sent.
  {
    const email = `${'e'.repeat(64)}@${`${'d'.repeat(61)}.`.repeat(3)}com`.padEnd(0); const longest = email.slice(0, 254);
    await fill({ name: 'n'.repeat(100), email: longest, message: 'm'.repeat(4000) }); for (let i = 1; i <= 6; i++) await page.click(`.hj-chip:nth-child(${i})`).catch(() => {}); const n = received.length; await send(); await wait(700); const s = await look(); const body = received[n] ? JSON.parse(received[n]) : null;
    report.atTheLimits = { sent: s.sent, requests: received.length - n, lengths: body && { name: body.name.length, email: body.email.length, message: body.message.length, needs: body.needs }, errors: s.errors };
    await page.keyboard.press('Escape'); await wait(500);
  }
  // 4. The service says no: the draft stays and it can be sent again.
  mode = 'fail'; await open(); await fill({ message: 'Kept draft.' }); await send(); await wait(700); { const s = await look(); report.rejected = { alert: s.alert, sent: s.sent, draftKept: s.message === 11 }; } mode = 'ok'; await send(); await wait(700); report.rejected.sentOnTryingAgain = (await look()).sent; await page.keyboard.press('Escape'); await wait(500);
  // 5. The service never answers: 15 s, then it says so.
  mode = 'hang'; await open(); await fill({ message: 'Timed.' }); { const n = received.length; const t = Date.now(); await send(); await wait(14000); const at14 = await look(); await page.waitForFunction(() => !document.querySelector('.hj-failure').hidden, null, { timeout: 5000, polling: 50 }); const ms = Date.now() - t; const s = await look(); await wait(500); report.timeout = { requests: received.length - n, at14s: { sending: at14.sending, alert: at14.alert }, gaveUpAfterMs: ms, alert: s.alert, sent: s.sent, draftKept: s.message === 6, connectionClosed: gone === 1 };
    // A late answer to the one given up on changes nothing.
    for (const res of hanging.splice(0)) res.end('{}'); await wait(500); report.timeout.lateAnswerIgnored = !(await look()).sent; }
  // 6. Closed while sending: cancelled; and a new send is not answered by the old one.
  { const n = received.length; await send(); await wait(500); const was = gone; await page.keyboard.press('Escape'); await wait(700); report.closedWhileSending = { requestCancelled: gone - was === 1 }; for (const res of hanging.splice(0)) res.end('{}'); await open(); await wait(400); const s = await look(); report.closedWhileSending.reopened = { sent: s.sent, sending: s.sending, draftKept: s.message === 6 }; mode = 'ok'; await send(); await wait(700); report.closedWhileSending.sendsAgain = (await look()).sent; report.closedWhileSending.requests = received.length - n; }
  report.cspViolations = await page.evaluate(() => window.__csp); report.errors = errors;
  const L = report.atTheLimits.lengths;
  report.ok = report.nameAfterTyping120 === 100 && report.messageAfterInserting4500 === 4000 && Object.values(report.tooLong).every((t) => t.requests === 0 && !t.sent) && report.atTheLimits.sent && L.name === 100 && L.message === 4000 && report.rejected.draftKept && report.rejected.sentOnTryingAgain && Math.abs(report.timeout.gaveUpAfterMs - 15000) < 700 && report.timeout.lateAnswerIgnored && report.closedWhileSending.requestCancelled && report.closedWhileSending.sendsAgain && !report.cspViolations.length && !errors.length;
  say(engine, report); await browser.close(); server.close(); server.closeAllConnections(); endpoint.close(); endpoint.closeAllConnections(); await save('s1', engine, report);
};

const what = process.argv[2];
if (!run[what]) { console.error(`node qa/tools/review-fixes.mjs ${Object.keys(run).join('|')} [chrome|webkit]`); process.exit(1); }
for (const engine of Object.keys(ENGINES)) await run[what](engine);
process.exit(0);

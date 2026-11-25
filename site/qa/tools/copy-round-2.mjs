// Copy round 2 (reviews/copy-round-2-build.md, on main): the one-row tagline, Reset mushrooms, the 404's text. Reads the
// production build (`npm run build` first) from dist/; `reset` with ?all needs `npm run dev` too (HJ_URL, 5173).
//
//   node qa/tools/copy-round-2.mjs [tagline] [fit] [steady] [reset] [all] [tabs] [film] [missing] [arms] [keys]     all of them without a name
// Writes to qa/copy-round-2/.
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { linkSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit, devices } from 'playwright';
import sharp from 'sharp';

const site = fileURLToPath(new URL('../../', import.meta.url));
const out = join(site, 'qa/copy-round-2');
mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const save = (name, data) => { writeFileSync(join(out, name), `${JSON.stringify(data, null, 1)}\n`); console.log(name, JSON.stringify(data)); };
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const dist = process.env.HJ_DIST ?? join(site, 'dist');
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  try {
    const file = join(dist, normalize(path === '/' ? '/index.html' : path)); const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }); res.end(data);
  } catch { res.writeHead(404, { 'Content-Type': 'text/html' }).end(await readFile(join(dist, '404.html'))); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;

const IDS = ['build', 'grow', 'design', 'film', 'set'];
const SPOTS = Object.fromEntries(IDS.map((id) => [id, [...readFileSync(join(site, `src/scenes/${id}.ts`), 'utf8').matchAll(/\{ id: '([\w-]+)', art:/g)].map((m) => m[1])]));
const progress = (found) => JSON.stringify({ scenes: Object.fromEntries(IDS.map((id) => [id, { found: SPOTS[id].slice(0, found[id] ?? 0), seen: true, panX: null }])), unlocked: false, panned: true });
const all = (n) => Object.fromEntries(IDS.map((id) => [id, n]));
const launch = { chrome: () => chromium.launch({ channel: 'chrome' }), webkit: () => webkit.launch() };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const sized = (width, height) => { const touch = width < 960; return { viewport: { width, height }, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch }; };
const own = (errors) => errors.filter((e) => !/stylesheet|inline style/i.test(e));

/** A page on a scene, with that much found (put in storage once, before the first load). */
async function open(context, found, hash = 'build', extra = {}) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`${m.type()}: ${m.text()}`); });
  if (found) await page.addInitScript((value) => { if (!sessionStorage.getItem('qa')) { sessionStorage.setItem('qa', '1'); localStorage.setItem('hjaas:site:v2', value); } }, progress(found));
  await page.goto(`${extra.base ?? base}#${hash}`);
  await settled(page);
  return { page, errors };
}
/** The painting (or the reveal) is over: Skip has gone, the mushrooms can be found. */
const settled = (page) => page.waitForFunction(() => {
  const plate = document.querySelector('.hj-plate'); const skip = document.querySelector('.hj-controls .hj-link');
  return plate && skip.classList.contains('is-off') && !plate.querySelector('.hj-mushrooms').inert && document.querySelector('.hj-scene:not(.is-pre)');
}, null, { timeout: 40000 }).then(() => wait(400));
const state = (page) => page.evaluate(() => {
  const text = (s) => document.querySelector(s)?.textContent.replace(/\s+/g, ' ').trim();
  const seen = (s) => { const el = document.querySelector(s); const st = getComputedStyle(el); return st.visibility === 'visible' && st.display !== 'none' && el.getClientRects().length > 0; };
  const row = (k) => `${text(`.hj-row.is-${k} .hj-num-now`)}${text(`.hj-row.is-${k} .hj-num-of`)} ${text(`.hj-row.is-${k} .hj-label`)}`;
  return {
    scene: document.querySelector('.hj-plate').dataset.scene,
    cream: row('cream'), red: row('red'), hiddenHere: document.querySelectorAll('.hj-shroom').length,
    marks: [...document.querySelectorAll('.hj-tab.is-done')].map((t) => t.dataset.scene),
    contact: seen('.hj-contact'), reset: seen('.hj-reset') ? text('.hj-reset') : null, pause: seen('.hj-controls > :nth-child(2)'), skip: seen('.hj-controls > :nth-child(1)'),
    said: text('.hj-controls [aria-live]'), saved: Object.keys(localStorage).filter((k) => /hjaas/.test(k) && /found|v2$|v1$/.test(k) && !/seen|pan/.test(k)).length,
  };
});
/** Find the first n, one after another, as a tap does. */
const find = async (page, n) => { for (let i = 0; i < n; i++) { await page.evaluate(() => document.querySelector('.hj-shroom').click()); await wait(900); } };
const goTo = async (page, id) => { await page.evaluate((x) => document.querySelector(`.hj-tab[data-scene="${x}"]`).click(), id); await page.waitForFunction((x) => document.querySelector('.hj-plate').dataset.scene === x, id, { timeout: 20000 }); await settled(page); };
const press = async (page) => { const r = page.locator('.hj-reset'); await ((await page.evaluate(() => matchMedia('(pointer: coarse)').matches)) ? r.tap() : r.click()); };
const lines = () => { const t = document.querySelector('.hj-tagline'); const range = document.createRange(); range.selectNodeContents(t); return new Set([...range.getClientRects()].map((r) => r.y)).size; };

const run = {
  async tagline() {
    const report = {};
    for (const [engine, start] of Object.entries(launch)) {
      const browser = await start();
      for (const [w, h] of [[375, 812], [390, 844], [568, 320], [890, 800], [1280, 720], [1440, 900]]) {
        const context = await browser.newContext({ reducedMotion: 'reduce', ...sized(w, h) }); const { page, errors } = await open(context, { build: 3 });
        const r = await page.evaluate(() => { const b = (s) => document.querySelector(s).getBoundingClientRect(); const n = (x) => Math.round(x * 10) / 10; const t = document.querySelector('.hj-tagline'); return { font: n(parseFloat(getComputedStyle(t).fontSize)), masthead: n(b('.hj-masthead').height), pictureTop: n(b('.hj-window').top), window: `${n(b('.hj-window').width)}x${n(b('.hj-window').height)}` }; });
        r.rows = await page.evaluate(lines);
        (report[`${w}x${h}`] ??= {})[engine] = { ...r, errors: own(errors) };
        await page.screenshot({ path: join(out, `masthead-${w}x${h}-${engine}.png`), clip: { x: 0, y: 0, width: w, height: Math.min(h, Math.ceil(r.pictureTop) + 40) } });
        if (w === 375 || w === 1440 || w === 568) await page.screenshot({ path: join(out, `page-${w}x${h}-${engine}.jpg`), type: 'jpeg', quality: 85 });
        await context.close();
      }
      await browser.close();
    }
    save('tagline.json', report);
  },

  /** Job 013b's 25 sizes: whole tagline, unbroken tabs, the longest finished row, the controls (armed), no sideways scroll. */
  async fit() {
    const report = {};
    for (const [engine, start] of Object.entries(launch)) {
      const browser = await start(); const rows = (report[engine] = []);
      for (const [w, h] of [[320, 568], [340, 700], [360, 740], [375, 667], [375, 812], [390, 844], [412, 915], [430, 932], [600, 500], [601, 900], [700, 900], [768, 1024], [820, 1180], [900, 900], [1024, 768], [1280, 720], [1366, 768], [1440, 900], [1920, 1080], [2200, 1300], [2560, 1440], [568, 320], [667, 375], [844, 390], [932, 430], [890, 520], [890, 600], [1280, 560], [1366, 650], [1440, 700]]) { // the last five: short windows
        const context = await browser.newContext({ reducedMotion: 'no-preference', ...sized(w, h) }); const { page } = await open(context, { build: 10, grow: 10, set: 10 }, 'set');
        const at = () => page.evaluate(() => { const b = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left, r.top + scrollY, r.width, r.height].map((x) => Math.round(x * 10) / 10).join(' '); }; return { window: b('.hj-window'), pause: b('.hj-controls > :nth-child(2)'), caption: b('.hj-caption'), counter: b('.hj-counter') }; });
        const before = await at(); await press(page); await wait(100); const armed = await at();
        const r = await page.evaluate(() => {
          const q = (s) => document.querySelector(s); const b = (s) => q(s).getBoundingClientRect(); const t = q('.hj-tagline'); const n = (x) => Math.round(x * 10) / 10;
          const tabs = [...document.querySelectorAll('.hj-tab')]; const id = b('.hj-ident'); const tb = t.getBoundingClientRect(); const menu = b('.hj-menu');
          const controls = [...document.querySelectorAll('.hj-controls > button:not(.is-off)')].map((c) => c.getBoundingClientRect());
          const row = b('.hj-caption-main');
          return { size: `${innerWidth}x${innerHeight}`, font: n(parseFloat(getComputedStyle(t).fontSize)), taglineWhole: t.scrollHeight <= t.clientHeight + 1 && t.scrollWidth <= t.clientWidth && tb.bottom <= id.bottom + 0.6, tabRows: new Set(tabs.map((x) => x.getBoundingClientRect().y)).size, tabNamesUnbroken: tabs.every((x) => { const r = document.createRange(); r.selectNodeContents(x.firstChild); return r.getClientRects().length === 1; }), tabsOwnRow: menu.top >= tb.bottom - 1, masthead: n(b('.hj-masthead').height), pictureTop: n(b('.hj-window').top + scrollY), window: `${n(b('.hj-window').width)}x${n(b('.hj-window').height)}`, mastInside: b('.hj-masthead').left >= 0 && menu.right <= innerWidth, controlsOnRow: Math.abs(controls[0].top + controls[0].height / 2 - row.top - row.height / 2) < 12, rowRoomLeft: n(b('.hj-caption').right - b('.hj-next').right), controlsInside: controls.every((c) => c.left >= -0.5 && c.right <= innerWidth + 0.5), controlsOverRow: controls.some((c) => c.left < row.right && c.right > row.left && c.top < row.bottom - 4 && c.bottom > row.top + 4), captionBottom: n(b('.hj-caption').bottom + scrollY), pageWiderThanScreen: document.documentElement.scrollWidth > innerWidth };
        });
        r.rows = await page.evaluate(lines); r.armingMovesNothing = JSON.stringify(before) === JSON.stringify(armed);
        if (!r.armingMovesNothing) r.moved = { before, armed };
        rows.push(r); await context.close();
      }
      await browser.close();
      console.log(engine, 'problems:', rows.filter((r) => !r.taglineWhole || !r.mastInside || !r.tabNamesUnbroken || r.pageWiderThanScreen || !r.controlsInside || r.controlsOverRow || !r.armingMovesNothing || r.rows > 2).map((r) => JSON.stringify(r)));
    }
    save('fit.json', report);
  },

  /** The masthead's height and the picture's top, at every width from 320 to 1700 px: nothing jumps. */
  async steady() {
    const browser = await launch.chrome(); const report = {};
    for (const h of [900, 620]) {
      const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1700, height: h } }); const { page } = await open(context, { build: 3 }); const rows = [];
      for (let w = 1700; w >= 320; w -= 2) { await page.setViewportSize({ width: w, height: h }); rows.push({ w, ...(await page.evaluate(() => ({ masthead: document.querySelector('.hj-masthead').getBoundingClientRect().height, top: document.querySelector('.hj-window').getBoundingClientRect().top }))), rows: await page.evaluate(lines) }); }
      const n = (x) => Math.round(x * 10) / 10;
      report[`height ${h}`] = { jumpsOver2px: rows.slice(1).map((r, i) => ({ from: rows[i].w, to: r.w, masthead: [n(rows[i].masthead), n(r.masthead)], pictureTop: [n(rows[i].top), n(r.top)] })).filter((j) => Math.abs(j.masthead[0] - j.masthead[1]) > 2 || Math.abs(j.pictureTop[0] - j.pictureTop[1]) > 2), twoRows: rows.filter((r) => r.rows === 2).map((r) => r.w).reduce((a, w) => { const last = a.at(-1); if (last && last[1] - w === 2) last[1] = w; else a.push([w, w]); return a; }, []), more: rows.filter((r) => r.rows > 2).map((r) => r.w) };
      await context.close();
    }
    await browser.close(); save('steady.json', report);
  },

  /** 3 found in Build, 2 in Grow, one tap, 4 s, two taps; reload. Then all 50, form and Set Design's backdrop. */
  async reset() {
    const report = {};
    for (const [engine, start] of Object.entries(launch)) for (const [size, options] of [['desktop', DESKTOP], ['phone', PHONE]]) for (const motion of ['no-preference', 'reduce']) {
      const browser = await start(); const context = await browser.newContext({ ...options, reducedMotion: motion }); const { page, errors } = await open(context, null); const r = (report[`${engine} ${size}${motion === 'reduce' ? ', reduced motion' : ''}`] = {});
      const gap = () => page.evaluate(() => Math.round(document.querySelector('.hj-controls').getBoundingClientRect().width));
      r.nothingFound = { reset: (await state(page)).reset, controlsWidth: await gap() };
      await find(page, 3); await goTo(page, 'grow'); await find(page, 2);
      r.before = await state(page); r.controlsWidth = await gap();
      await press(page); const t0 = Date.now(); await wait(100); r.oneTap = await state(page);
      await page.waitForFunction(() => document.querySelector('.hj-reset').textContent === 'Reset mushrooms', null, { polling: 20 }); r.labelBackAfterMs = Date.now() - t0;
      r.after4s = await state(page);
      // During a painting it does nothing (and is not there): asked for through the page all the same.
      await page.evaluate(() => document.querySelector('.hj-tab[data-scene="film"]').click()); await wait(40);
      await page.evaluate(() => { const b = document.querySelector('.hj-reset'); b.click(); b.click(); }); await page.waitForFunction(() => document.querySelector('.hj-plate').dataset.scene === 'film', null, { timeout: 20000 }); await settled(page);
      r.whileChangingScene = { red: (await state(page)).red, reset: (await state(page)).reset };
      await goTo(page, 'grow');
      await press(page); await wait(500); await press(page); await wait(60); r.secondTapAt60ms = await state(page);
      await wait(motion === 'reduce' ? 600 : 1500); r.duringThePainting = await state(page);
      await settled(page); await wait(600); r.twoTaps = await state(page);
      await goTo(page, 'build'); r.build = await state(page);
      await find(page, 1); await wait(900); r.findAgain = await state(page);
      await press(page); await wait(300); await press(page); await settled(page);
      await page.reload(); await settled(page); r.reloaded = await state(page);
      r.errors = own(errors); await browser.close();
    }
    // All 50, saved.
    for (const [engine, start] of Object.entries(launch)) {
      const browser = await start(); const context = await browser.newContext({ ...PHONE }); const { page, errors } = await open(context, all(10), 'set'); const r = (report[`${engine} phone, all 50`] = {});
      const shot = (name) => page.locator('.hj-window').screenshot({ path: join(out, `set-${engine}-${name}.jpg`), type: 'jpeg', quality: 85 });
      r.before = await state(page); await shot('1-all-found');
      await press(page); await wait(300); await press(page); await wait(2000); await settled(page); r.after = await state(page); await shot('2-reset');
      r.formOpens = await page.evaluate(() => { const b = document.querySelector('.hj-contact'); return getComputedStyle(b).visibility; });
      // Its backdrop restarts: one find brings the first swath.
      await find(page, 1); await wait(1500); await shot('3-one-found-again'); r.oneFound = await state(page);
      await press(page); await wait(300); await press(page); await settled(page);
      await page.reload(); await settled(page); r.reloaded = await state(page); r.errors = own(errors); await browser.close();
    }
    save('reset.json', report);
  },

  /** The same with ?all=50 (the dev server), where the backdrop's pieces can be counted. */
  async all() {
    const dev = process.env.HJ_URL ?? 'http://localhost:5173/'; const report = {};
    for (const [engine, start] of Object.entries(launch)) {
      const browser = await start(); const context = await browser.newContext(DESKTOP); const { page, errors } = await open(context, null, 'set', { base: `${dev}?debug&all=50` }); const r = (report[engine] = {});
      const pieces = () => page.evaluate(() => window.__hj.scene.progress.state);
      r.before = { ...(await state(page)), pieces: await pieces() };
      await press(page); await wait(300); r.oneTap = { ...(await state(page)), pieces: await pieces() };
      await press(page); await wait(1200); r.painting = { pieces: await pieces() }; await settled(page); r.after = { ...(await state(page)), pieces: await pieces() };
      await find(page, 3); await wait(1500); r.threeFound = { ...(await state(page)), pieces: await pieces() };
      await goTo(page, 'design'); r.design = await state(page); r.errors = own(errors); await browser.close();
    }
    save('all.json', report);
  },

  /** Two tabs of the site: the second follows, wherever it is. */
  async tabs() {
    const report = {};
    for (const [engine, start] of Object.entries(launch)) {
      const browser = await start(); const context = await browser.newContext(DESKTOP);
      const a = await open(context, { build: 3, grow: 2 }, 'grow'); const b = await open(context, null, 'build'); const c = await open(context, null, 'set'); const r = (report[engine] = {});
      r.before = { b: await state(b.page), c: await state(c.page) };
      await a.page.bringToFront(); await press(a.page); await wait(300); r.oneTap = { b: (await state(b.page)).red }; await press(a.page); await wait(1500);
      r.after = { b: await state(b.page), c: await state(c.page) };
      await b.page.bringToFront(); await settled(b.page); await find(b.page, 1); await wait(500); await a.page.bringToFront(); await settled(a.page); r.findInTheSecond = { a: (await state(a.page)).red, b: (await state(b.page)).red };
      // All 50, and the second tab with its Contact button.
      await b.page.evaluate((v) => localStorage.setItem('hjaas:site:v2', v), progress(all(10))); await wait(500); await a.page.reload(); await settled(a.page); await c.page.bringToFront(); await wait(300);
      r.all50 = { a: await state(a.page), c: await state(c.page) };
      await a.page.bringToFront(); await wait(800); await press(a.page); await wait(300); await press(a.page); await wait(1500); r.all50after = { c: await state(c.page) };
      await c.page.bringToFront(); await wait(1500); await c.page.screenshot({ path: join(out, `second-tab-${engine}.jpg`), type: 'jpeg', quality: 80 });
      r.errors = [a, b, c].flatMap((x) => own(x.errors)); await browser.close();
    }
    save('tabs.json', report);
  },

  /** The two-tap reset on a phone, filmed (Chrome's screencast, made 60 fps). */
  async film() {
    const browser = await launch.chrome(); const context = await browser.newContext({ ...PHONE, deviceScaleFactor: 2 }); const { page } = await open(context, { build: 3, grow: 10 }, 'grow');
    await page.evaluate(() => addEventListener('pointerdown', (e) => { const d = document.createElement('i'); Object.assign(d.style, { position: 'fixed', left: `${e.clientX - 18}px`, top: `${e.clientY - 18}px`, width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(200,55,45,.35)', zIndex: 99, pointerEvents: 'none' }); document.body.append(d); setTimeout(() => d.remove(), 350); }, true));
    await wait(1500);
    const cdp = await context.newCDPSession(page); const frames = [];
    cdp.on('Page.screencastFrame', (f) => { frames.push({ t: f.metadata.timestamp, data: f.data }); void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88 });
    await wait(1000); await press(page); await wait(5200); await press(page); await wait(1200); await press(page); await wait(300); await settled(page); await wait(2000);
    await cdp.send('Page.stopScreencast'); await browser.close();
    frames.sort((a, b) => a.t - b.t);
    const dir = join(site, 'node_modules/.hj/copy2'); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    frames.forEach((f, i) => writeFileSync(join(dir, `f${i}.jpg`), Buffer.from(f.data, 'base64')));
    const from = frames[0].t; const ticks = Math.floor((frames.at(-1).t - from) * 60); let k = 0;
    for (let i = 0; i < ticks; i++) { while (k + 1 < frames.length && frames[k + 1].t <= from + i / 60) k++; linkSync(join(dir, `f${k}.jpg`), join(dir, `${String(i).padStart(6, '0')}.jpg`)); }
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '60', '-i', join(dir, '%06d.jpg'), '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', join(out, 'reset-phone.mp4')]);
    console.log('film', frames.length, 'frames', ticks, 'ticks');
  },

  /** The 404 page: the gap, the crop, centring; and job 014's checks 2, 3 and 5. */
  async missing() {
    const report = {}; const url = `${base}this/does/not/exist`;
    for (const [engine, start] of Object.entries(launch)) {
      const browser = await start();
      for (const [size, options] of [['1280x800', { viewport: { width: 1280, height: 800 } }], ['iPhone 13', devices['iPhone 13']]]) {
        const { defaultBrowserType, ...device } = options; const context = await browser.newContext(device); const page = await context.newPage(); const errors = []; const failed = [];
        page.on('console', (m) => m.type() === 'error' && errors.push(m.text())); page.on('pageerror', (e) => errors.push(String(e))); page.on('requestfailed', (q) => failed.push(q.url())); page.on('response', (s) => s.status() >= 400 && s.url() !== url && failed.push(`${s.status()} ${s.url()}`));
        const response = await page.goto(url); await page.waitForFunction(() => !document.getElementById('rachel').classList.contains('gone')); await wait(800);
        const r = (report[`${engine} ${size}`] = await page.evaluate(() => {
          const svg = document.getElementById('art'); const box = svg.getBoundingClientRect(); const v = svg.viewBox.baseVal; const k = box.width / v.width; const n = (x) => Math.round(x * 100) / 100; const p = document.querySelector('p').getBoundingClientRect(); const ground = box.top + 830.2 * k; const numeralTop = box.top + 110.8 * k;
          const c = document.createElement('canvas').getContext('2d'); c.font = getComputedStyle(document.querySelector('p')).font;
          const m = c.measureText('This page is still on the drawing board.'); const line = parseFloat(getComputedStyle(document.querySelector('p')).fontSize);
          return { viewport: `${innerWidth}x${innerHeight}`, viewBox: svg.getAttribute('viewBox'), artHeight: n(box.height), heightFromViewBox: n(v.height * k), text: document.querySelector('p').textContent, link: document.querySelector('a').getAttribute('href'), textRows: Math.round(p.height / 21), gapBootsToTextBox: n(p.top - ground), gapBootsToCapitals: n(p.top + m.fontBoundingBoxAscent - m.actualBoundingBoxAscent - ground), boxAbove: n(box.top), boxBelow: n(innerHeight - p.bottom), inkAbove: n(numeralTop), inkBelow: n(innerHeight - p.bottom), font: [...document.fonts].map((f) => `${f.family} ${f.status}`), fontSize: line, sideways: document.documentElement.scrollWidth > innerWidth, scrolls: document.documentElement.scrollHeight > innerHeight };
        }));
        Object.assign(r, { status: response.status(), errors, failed });
        await page.screenshot({ path: join(out, `404-${size.replace(' ', '-')}-${engine}.png`) });
        // (Job 014's check 5.)
        const still = await browser.newContext({ ...device, reducedMotion: 'reduce' }); const q = await still.newPage(); await q.goto(url); await q.waitForFunction(() => !document.getElementById('rachel').classList.contains('gone')); await wait(800);
        const one = await q.screenshot(); await wait(2000); const two = await q.screenshot(); const px = (png) => sharp(png).removeAlpha().raw().toBuffer(); const [A, B] = await Promise.all([px(one), px(two)]); let most = 0; let count = 0; A.forEach((v, i) => { const d = Math.abs(v - B[i]); if (d) { count++; most = Math.max(most, d); } }); r.reducedMotion = { identical: one.equals(two), mostAChannelDiffers: most, channelsDiffering: count };
        await still.close(); await context.close();
      }
      await browser.close();
    }
    save('404.json', report);
  },

  /** Job 014's check 3: 8 s of the 404 page at 1280x800 in Chrome. Every film frame is one single pose; the page has one arm in every frame. */
  async arms() {
    const url = `${base}this/does/not/exist`; const browser = await launch.chrome();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await context.newPage();
    await page.addInitScript(() => {
      window.__arms = [];
      const look = () => { const g = document.getElementById('rachel'); if (g && !g.classList.contains('gone')) { const a = [...document.querySelectorAll('#arms image')].filter((x) => getComputedStyle(x).visibility === 'visible').map((x) => x.getAttribute('href').match(/S\d/)[0]); window.__arms.push([performance.now(), a.join('+'), getComputedStyle(document.getElementById('blink')).visibility === 'visible']); } requestAnimationFrame(look); };
      requestAnimationFrame(look);
    });
    const cdp = await context.newCDPSession(page); const frames = [];
    cdp.on('Page.screencastFrame', (f) => { frames.push({ t: f.metadata.timestamp, data: Buffer.from(f.data, 'base64') }); void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); });
    await page.goto(url); await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 98 }); await wait(8000); await cdp.send('Page.stopScreencast');
    const samples = await page.evaluate(() => window.__arms);
    // The poses, set by hand on a still page.
    const still = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })).newPage(); await still.goto(url); await still.waitForFunction(() => !document.getElementById('rachel').classList.contains('gone')); await wait(800);
    const box = await still.evaluate(() => { const r = document.getElementById('art').getBoundingClientRect(); const k = r.width / 1672; return { left: Math.floor(r.left + 590 * k), top: Math.floor(r.top + 250 * k), width: Math.ceil(225 * k), height: Math.ceil(270 * k) }; });
    const raw = (png) => sharp(png).removeAlpha().extract(box).raw().toBuffer();
    const names = ['S1', 'S2', 'S3', 'S4', 'S5']; const sets = [[], ...names.map((n) => [n]), ...names.flatMap((a, i) => names.slice(i + 1).map((b) => [a, b]))]; const poses = [];
    for (const set of sets) for (const blink of [false, true]) {
      await still.evaluate(([on, b]) => { for (const im of document.querySelectorAll('#arms image')) im.classList.toggle('gone', !on.includes(im.getAttribute('href').match(/S\d/)[0])); document.getElementById('blink').classList.toggle('gone', !b); }, [set, blink]);
      await wait(80); poses.push({ set, blink, px: await raw(await still.screenshot()) });
    }
    // (The text and the numeral come first: no figure yet.)
    await still.evaluate(() => document.getElementById('rachel').classList.add('gone')); await wait(80); poses.push({ set: ['not here yet'], blink: false, px: await raw(await still.screenshot()) });
    const off = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 40) n++; return n; };
    const seen = {}; const bad = []; let worst = 0;
    for (const [i, f] of frames.entries()) {
      const px = await raw(f.data); const ranked = poses.map((q) => ({ q, d: off(px, q.px) })).sort((a, b) => a.d - b.d); const { q, d } = ranked[0];
      worst = Math.max(worst, d); const single = ranked.filter((x) => x.d === d).some((x) => x.q.set.length === 1); // (S1 and S4, S2 and S5 are the same drawing)
      const name = `${q.set.join('+') || 'no arm'}${q.blink ? ', blink' : ''}`; seen[name] = (seen[name] ?? 0) + 1; if (!single || d > 400) bad.push([i, name, d]);
    }
    save('404-arms.json', { filmFrames: frames.length, seconds: Math.round((frames.at(-1).t - frames[0].t) * 10) / 10, matchedTo: seen, worstPixelChannelsOff: worst, notOneSinglePose: bad, pageSamples: samples.length, samplesWithoutExactlyOneArm: samples.filter(([, a]) => !/^S\d$/.test(a)).length, blinks: samples.filter(([, , b], i) => b && !samples[i - 1]?.[2]).length });
    await browser.close();
  },

  /** From the keyboard: where the focus goes, and the order of the Tab key; and Skip during the reset's painting. */
  async keys() {
    const report = {};
    for (const [engine, start] of Object.entries(launch)) for (const motion of ['no-preference', 'reduce']) {
      const browser = await start(); const context = await browser.newContext({ ...DESKTOP, reducedMotion: motion }); const { page, errors } = await open(context, { build: 3 }); const r = (report[`${engine}${motion === 'reduce' ? ', reduced motion' : ''}`] = {});
      const on = () => page.evaluate(() => document.activeElement.textContent.trim());
      await page.focus('.hj-reset'); await page.keyboard.press('Enter'); await wait(100); r.armed = await on(); await page.keyboard.press('Enter'); await wait(700); r.afterTheSecond = await on();
      if (motion !== 'reduce') { await page.keyboard.press('Enter'); await wait(400); r.skipEndsIt = await state(page); }
      await settled(page); r.settled = await on(); r.spotsInOrder = await page.evaluate(() => [...document.querySelectorAll('.hj-shroom')].map((b) => b.dataset.spot)); r.sameOrderAsTheSite = r.spotsInOrder.join() === SPOTS.build.join(); delete r.spotsInOrder; r.end = await state(page); r.errors = own(errors);
      await browser.close();
    }
    save('keys.json', report);
  },
};
for (const name of process.argv.length > 2 ? process.argv.slice(2) : Object.keys(run)) await run[name]();
server.close();
process.exit(0);

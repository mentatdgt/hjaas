// Job 016 (reviews/ipad-edge-lines-build.md): the lines at the scene's sides on an iPad, and the phone view on iPad mini.
// Two production builds, as folders: HJ_OLD (75121e8) and HJ_NEW (this one, dist/). Results: qa/ipad-edge-lines/.
//
//   node qa/tools/ipad-edge-lines.mjs sweep [webkit|chrome] [build,grow,…]   heights 650 to 860 at four widths: the sizes with a line, old and new
//   node qa/tools/ipad-edge-lines.mjs devices     the iPads' own sizes, five scenes: the line count, old and new
//   node qa/tools/ipad-edge-lines.mjs crops       4x crops of both sides, old and new
//   node qa/tools/ipad-edge-lines.mjs logo        five logo taps, back and forward (Safari's and CriOS's user agents)
//   node qa/tools/ipad-edge-lines.mjs switch      the sheet that lies over the window in a change of scene
//   node qa/tools/ipad-edge-lines.mjs same        phones, full-size iPads and desktop Chrome: what differs between the two builds
//   node qa/tools/ipad-edge-lines.mjs shots       744x1133, 768x1024, 810x1080, 820x1180: five scenes
//   node qa/tools/ipad-edge-lines.mjs pan         iPad mini: crop, drift, focus, pan memory, tap boxes, turning
//   node qa/tools/ipad-edge-lines.mjs hunt        50 of 50 by taps, on the screen
//   node qa/tools/ipad-edge-lines.mjs record      744x1133
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit, devices } from 'playwright';
import sharp from 'sharp';

const site = fileURLToPath(new URL('../../', import.meta.url));
const out = process.env.HJ_OUT ?? join(site, 'qa/ipad-edge-lines');
mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const save = (name, data) => { writeFileSync(join(out, name), `${JSON.stringify(data, null, 1)}\n`); console.log(name, JSON.stringify(data, null, 1)); };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const serve = async (dist) => {
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    try { const f = join(dist, normalize(path === '/' ? '/index.html' : path)); const d = await readFile(f); res.writeHead(200, { 'Content-Type': TYPES[extname(f)] ?? 'application/octet-stream' }); res.end(d); } catch { res.writeHead(404).end(); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${server.address().port}/`;
};
const BUILDS = { old: await serve(process.env.HJ_OLD ?? join(site, 'node_modules/.hj/dist-016-before')), new: await serve(process.env.HJ_NEW ?? join(site, 'dist')) };
const IDS = ['build', 'grow', 'design', 'film', 'set'];
const start = { webkit: () => webkit.launch(), chrome: () => chromium.launch({ channel: 'chrome' }) };
const SAFARI = devices['iPad Pro 11'].userAgent;
const CRIOS = 'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.95 Mobile/15E148 Safari/604.1';
const ipad = (width, height, extra = {}) => ({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: SAFARI, ...extra });
const phone = (width, height, extra = {}) => ({ ...devices['iPhone 14'], viewport: { width, height }, screen: { width, height }, ...extra });
/** The painting (or the reveal) is over. */
const settled = (page, id) => page.waitForFunction((x) => {
  const plate = document.querySelector('.hj-plate'); const skip = document.querySelector('.hj-controls .hj-link');
  return plate && (!x || plate.dataset.scene === x) && skip?.classList.contains('is-off') && !plate.querySelector('.hj-mushrooms').inert && document.querySelector('.hj-scene:not(.is-pre)');
}, id ?? null, { timeout: 60000 }).then(() => wait(700));
const open = async (context, base, id) => {
  const page = await context.newPage(); const log = []; page.log = log;
  page.on('pageerror', (e) => log.push(String(e))); page.on('console', (m) => ['error', 'warning'].includes(m.type()) && !/stylesheet|inline style|preload/i.test(m.text()) && log.push(m.text()));
  await page.goto(`${base}#${id}`); await settled(page, id); return page;
};
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const windowBox = (page) => page.evaluate(() => { const r = document.querySelector('.hj-viewport').getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
const raw = async (png) => { const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; };
const offPaper = (d, i) => Math.max(Math.abs(d[i] - 246), Math.abs(d[i + 1] - 243), Math.abs(d[i + 2] - 236));
/** The most rows off the paper's colour in any column of the outermost 4 device px at each side (a line is a long run of them; 2: the part the fix leaves out, 4: what would be uncovered behind it). */
const sides = async (page, deep = 2) => {
  const v = await windowBox(page); const size = page.viewportSize(); const top = Math.max(0, Math.floor(v.top)); const height = Math.min(size.height, Math.ceil(v.bottom)) - top; const res = {};
  for (const [side, x] of [['left', Math.floor(v.left)], ['right', Math.floor(v.right)]]) {
    const x0 = Math.max(0, x - 6); const { data, w, h } = await raw(await page.screenshot({ clip: { x: x0, y: top, width: 12, height } })); let most = 0;
    for (let k = 0; k < w; k++) {
      const dev = x0 * 2 + k; const inset = side === 'left' ? dev - v.left * 2 : v.right * 2 - dev - 1; if (inset >= deep) continue;
      let n = 0; for (let y = 0; y < h; y++) if (offPaper(data, (y * w + k) * 3) > 2) n++;
      most = Math.max(most, n);
    }
    res[side] = most;
  }
  return res;
};
const LINE = 40; // rows
const isLine = (s) => s.left > LINE || s.right > LINE;

const run = {
  async sweep(engine = 'webkit', list = IDS.join(','), ua = 'safari') {
    const browser = await start[engine](); const report = {};
    await Promise.all(Object.entries(BUILDS).map(async ([name, base]) => {
      const total = { sizes: 0, withALine: 0, worst: {} }; report[name] = total;
      for (const id of list.split(',')) {
        const context = await browser.newContext(ipad(1180, 820, ua === 'crios' ? { userAgent: CRIOS } : {})); const page = await open(context, base, id);
        await page.locator('.hj-controls .hj-link:not(.is-off)').first().tap();
        for (const w of [1133, 1180, 1194, 1366]) for (let h = 650; h <= 860; h++) {
          await page.setViewportSize({ width: w, height: h }); await frames(page);
          const s = await sides(page); total.sizes++; const key = `${id} ${w}`; total.worst[key] ??= { withALine: 0, rows: 0, at: null };
          if (isLine(s)) { total.withALine++; total.worst[key].withALine++; }
          const rows = Math.max(s.left, s.right); if (rows > total.worst[key].rows) Object.assign(total.worst[key], { rows, at: `${w}x${h}` });
        }
        await context.close();
      }
    }));
    await browser.close(); save(`sweep-${engine}${ua === 'crios' ? '-crios' : ''}.json`, report);
  },
  async devices() {
    const browser = await start.webkit(); const report = {};
    for (const [w, h] of [[820, 1180], [1180, 820], [810, 1080], [1080, 810], [768, 1024], [1024, 768], [744, 1133], [1133, 744], [834, 1194], [1194, 834], [1024, 1366], [1366, 1024]]) for (const name of ['old', 'new']) {
      const context = await browser.newContext(ipad(w, h)); const page = await open(context, BUILDS[name], 'build'); const row = {};
      for (const id of IDS) { if (id !== 'build') { await page.locator(`.hj-tab[data-scene="${id}"]`).tap(); await settled(page, id); } const panned = await page.evaluate(() => { const v = document.querySelector('.hj-viewport'); return v.scrollWidth - v.clientWidth > 1; }); row[id] = panned ? 'panned' : await sides(page); }
      (report[`${w}x${h}`] ??= {})[name] = row; await context.close();
    }
    await browser.close(); save('devices.json', report);
  },
  async crops() {
    const browser = await start.webkit();
    for (const [w, h] of [[1180, 820], [1180, 690], [1133, 677], [1194, 700], [1366, 784]]) {
      const tiles = []; const tw = 176; const th = 480; const gap = 12; const label = 26;
      for (const [row, id] of IDS.entries()) for (const [b, name] of ['old', 'new'].entries()) {
        const context = await browser.newContext(ipad(w, h)); const page = await open(context, BUILDS[name], id); const v = await windowBox(page);
        for (const [s, x] of [v.left, v.right].entries()) {
          const png = await page.screenshot({ clip: { x: Math.round(x) - 11, y: Math.round(v.top + (v.bottom - v.top) * 0.52), width: 22, height: 60 } });
          tiles.push({ input: await sharp(png).resize(tw, th, { kernel: 'nearest' }).png().toBuffer(), left: gap + (b * 2 + s) * (tw + gap), top: label + row * (th + gap + label) + label });
        }
        await context.close();
      }
      const width = gap + 4 * (tw + gap); const height = label * 2 + IDS.length * (th + gap + label);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="Helvetica" font-size="15">${['before, left', 'before, right', 'after, left', 'after, right'].map((t, i) => `<text x="${gap + i * (tw + gap)}" y="20">${t}</text>`).join('')}${IDS.map((id, i) => `<text x="${gap}" y="${label * 2 + i * (th + gap + label) - 6}">${id}, ${w}x${h}, WebKit, 4x</text>`).join('')}</svg>`;
      await sharp({ create: { width, height, channels: 3, background: '#b9b4a8' } }).composite([...tiles, { input: Buffer.from(svg), left: 0, top: 0 }]).png().toFile(join(out, `crops-${w}x${h}.png`)); console.log(`crops-${w}x${h}.png`);
    }
    await browser.close();
  },
  async logo() {
    const browser = await start.webkit(); const report = {};
    for (const [w, h] of [[1180, 820], [1180, 690], [1133, 677], [1366, 1024]]) for (const [agent, userAgent] of [['safari', SAFARI], ['crios', CRIOS]]) for (const name of ['old', 'new']) {
      const context = await browser.newContext(ipad(w, h, { userAgent })); const page = await open(context, BUILDS[name], 'grow'); const rows = {};
      const look = async (label) => {
        rows[label] = { ...(await sides(page)), ...(await page.evaluate(() => { const r = document.querySelector('.hj-viewport').getBoundingClientRect(); return { window: [r.left, r.right, r.top, r.bottom].join(' '), edge: [...document.querySelectorAll('.hj-edge canvas')].map((c) => `${c.width}x${c.height}`).join(' '), canvasMB: +([...document.querySelectorAll('canvas')].reduce((s, c) => s + c.width * c.height * 4, 0) / 1e6).toFixed(1) }; })) };
        const v = await windowBox(page); const { data } = await raw(await page.screenshot({ clip: { x: v.left + 3, y: v.top + 3, width: 8, height: 8 } })); rows[label].cornerOffPaper = Math.max(...Array.from({ length: data.length / 3 }, (_, i) => offPaper(data, i * 3)));
        if ((w === 1180 || w === 1133) && ['grow, opened', 'after 1 tap', 'after 5 taps'].includes(label)) await page.screenshot({ path: join(out, `logo-${w}x${h}-${agent}-${name}-${label.replace(/\W+/g, '-')}.jpg`), type: 'jpeg', quality: 80 });
      };
      await look('grow, opened');
      await page.locator('.hj-tab[data-scene="build"]').tap(); await settled(page, 'build'); await look('build, by its tab');
      for (let i = 1; i <= 5; i++) { await page.evaluate(() => { window.__here = true; }); await page.locator('a.hj-logo').tap(); await wait(800); await settled(page); rows.reloaded = await page.evaluate(() => !window.__here); if (i === 1 || i === 5) await look(`after ${i} tap${i > 1 ? 's' : ''}`); }
      await page.goBack(); await wait(800); await settled(page); await look('back');
      await page.goForward(); await wait(800); await settled(page); await look('forward');
      rows.console = page.log; report[`${w}x${h} ${agent} ${name}`] = rows; await context.close();
    }
    await browser.close(); save('logo.json', report);
  },
  async switch() {
    // A copy of the picture being left lies over the window itself while a scene changes.
    const browser = await start.webkit(); const report = {};
    for (const [w, h] of [[1133, 677], [1180, 690], [1366, 784], [1180, 820]]) for (const name of ['old', 'new']) {
      const context = await browser.newContext(ipad(w, h)); const page = await open(context, BUILDS[name], 'build');
      // (Film and back once, so that the change under test is the short brush-over.)
      await page.locator('.hj-tab[data-scene="film"]').tap(); await settled(page, 'film');
      await page.evaluate(() => { const tick = () => { const s = document.querySelector('.hj-paint.is-over-window'); if (s) { const at = s.getBoundingClientRect(); window.__sheet = { w: s.width, h: s.height, left: at.left, right: at.right }; } requestAnimationFrame(tick); }; tick(); });
      await page.locator('.hj-tab[data-scene="build"]').tap(); let most = { left: 0, right: 0 }; let seen = 0;
      for (let i = 0; i < 30; i++) { const on = await page.evaluate(() => !!document.querySelector('.hj-paint.is-over-window')); const s = await sides(page, 2); if (on) { seen++; most = { left: Math.max(most.left, s.left), right: Math.max(most.right, s.right) }; } }
      (report[`${w}x${h}`] ??= {})[name] = { looks: seen, ...most, sheet: await page.evaluate(() => window.__sheet) }; await context.close();
    }
    await browser.close(); save('switch.json', report);
  },
  async same() {
    const report = {}; const still = { reducedMotion: 'reduce' };
    const cases = [
      ['webkit', '375x812', phone(375, 812, still)], ['webkit', '390x844', phone(390, 844, still)], ['webkit', '844x390', phone(844, 390, still)],
      ['webkit', '810x1080', ipad(810, 1080, still)], ['webkit', '820x1180', ipad(820, 1180, still)],
      ['chrome', '820x1180', { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, ...still }], ['chrome', '1440x900', { viewport: { width: 1440, height: 900 }, ...still }],
    ];
    for (const engine of ['webkit', 'chrome']) {
      const browser = await start[engine]();
      for (const [e, label, options] of cases) if (e === engine) for (const id of IDS) {
        const shots = []; let v; let panned; const fullSize = label;
        // (Chrome: the new build against itself too, for what differs between two runs.)
        for (const name of engine === 'chrome' ? ['old', 'new', 'old'] : ['old', 'new']) { const context = await browser.newContext(options); const page = await open(context, BUILDS[name], id); v = await windowBox(page); panned = await page.evaluate(() => { const x = document.querySelector('.hj-viewport'); return x.scrollWidth - x.clientWidth > 1 ? x.scrollLeft : false; }); const png = await page.screenshot(); shots.push(await raw(png)); if (engine === 'webkit' && name === 'new' && panned !== false) await sharp(png).jpeg({ quality: 82 }).toFile(join(out, `phone-${fullSize}-${id}-after.jpg`)); if (engine === 'webkit' && name === 'old' && panned !== false) await sharp(png).jpeg({ quality: 82 }).toFile(join(out, `phone-${fullSize}-${id}-before.jpg`)); await context.close(); }
        const [a, b, c] = shots; let itself = 0; let itselfMost = 0; if (c) for (let i = 0; i < a.data.length; i++) if (a.data[i] !== c.data[i]) { itself++; itselfMost = Math.max(itselfMost, Math.abs(a.data[i] - c.data[i])); }
        const dpr = options.deviceScaleFactor ?? 1; let n = 0; let elsewhere = 0; let most = 0;
        for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) { const i = (y * a.w + x) * 3; const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2])); if (!d) continue; n++; most = Math.max(most, d); const px = (x + 0.5) / dpr; const py = (y + 0.5) / dpr; const rim = py > v.top - 1 && py < v.bottom + 1 && (Math.abs(px - v.left) < 1.6 || Math.abs(px - v.right) < 1.6); if (!rim) elsewhere++; }
        (report[`${engine} ${label}`] ??= { panned })[id] = { pixelsThatDiffer: n, outsideTheSideRows: elsewhere, biggestDifference: most, ...(c ? { oldAgainstItself: { channelsThatDiffer: itself, biggestDifference: itselfMost } } : {}) };
      }
      await browser.close();
    }
    save('same.json', report);
  },
  async shots() {
    const browser = await start.webkit(); const report = {};
    for (const [w, h] of [[744, 1133], [768, 1024], [810, 1080], [820, 1180]]) for (const id of IDS) {
      const context = await browser.newContext(ipad(w, h)); const page = await open(context, BUILDS.new, id);
      await page.screenshot({ path: join(out, `${id}-${w}x${h}.jpg`), type: 'jpeg', quality: 85 });
      (report[`${w}x${h}`] ??= {})[id] = await page.evaluate(() => { const v = document.querySelector('.hj-viewport'); const r = v.getBoundingClientRect(); return { panned: v.scrollWidth - v.clientWidth > 1, heightOfScreen: +(r.height / innerHeight).toFixed(3), roomInView: +(v.clientWidth / v.scrollWidth).toFixed(2), page: document.documentElement.scrollHeight, sideways: document.documentElement.scrollWidth }; });
      await context.close();
    }
    await browser.close(); save('shots.json', report);
  },
  async pan() {
    const browser = await start.webkit(); const report = {};
    const view = (page) => page.evaluate(() => { const v = document.querySelector('.hj-viewport'); const u = document.querySelector('.hj-plate').clientWidth / 1672; return { centre: Math.round((v.scrollLeft + v.clientWidth / 2) / u), max: v.scrollWidth - v.clientWidth, height: +(v.clientHeight / innerHeight).toFixed(3) }; });
    const spots = (page) => page.evaluate(() => { const u = document.querySelector('.hj-plate').clientWidth / 1672; const p = document.querySelector('.hj-plate').getBoundingClientRect(); return [...document.querySelectorAll('.hj-shroom')].map((b) => { const r = b.getBoundingClientRect(); const a = b.querySelector('.hj-shroom-art').getBoundingClientRect(); return { id: b.dataset.spot, w: r.width, h: r.height, x: Math.round((a.left + a.width / 2 - p.left) / u), y: Math.round((a.top + a.height / 2 - p.top) / u) }; }); });
    for (const [w, h] of [[744, 1133], [768, 1024], [744, 1040], [601, 900], [799, 1100]]) {
      const row = (report[`${w}x${h}`] = {}); const context = await browser.newContext(ipad(w, h)); const page = await open(context, BUILDS.new, 'build');
      // The drift: the plate's own transform, 40 px out and back, once.
      let drift = 0; const xs = []; for (let i = 0; i < 160; i++) { const x = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.hj-plate')).transform).e); xs.push(x); drift = Math.abs(x) > Math.abs(drift) ? x : drift; await wait(25); }
      row.drift = { most: +drift.toFixed(1), backAtRest: xs.at(-1) === 0 }; row.opensAt = {}; row.smallestTapBox = 99;
      for (const id of IDS) { if (id !== 'build') { await page.locator(`.hj-tab[data-scene="${id}"]`).tap(); await settled(page, id); } const v = await view(page); row.opensAt[id] = v; for (const s of await spots(page)) row.smallestTapBox = Math.min(row.smallestTapBox, s.w, s.h); }
      row.smallestControl = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.hj-tab, .hj-controls .hj-link:not(.is-off)')].map((e) => e.getBoundingClientRect().height)));
      // Pan memory: panned, another scene, back, and over a reload.
      const before = await spots(page); const box = await windowBox(page); const y = (box.top + box.bottom) / 2;
      await page.mouse.move(box.right - 60, y); await page.mouse.down(); for (let i = 1; i <= 20; i++) { await page.mouse.move(box.right - 60 - i * 12, y); await wait(16); } await wait(120); await page.mouse.up(); await wait(900);
      const panned = (await view(page)).centre; await page.locator('.hj-tab[data-scene="grow"]').tap(); await settled(page, 'grow'); await page.locator('.hj-tab[data-scene="set"]').tap(); await settled(page, 'set'); const back = (await view(page)).centre; await page.reload(); await settled(page, 'set'); const reloaded = (await view(page)).centre;
      // Turned on its side and back, three times, one of them in the middle of a painting.
      row.panMemory = { opened: row.opensAt.set.centre, panned, back, reloaded };
      row.turns = []; for (let i = 0; i < 3; i++) { if (i === 2) { await page.locator('.hj-tab[data-scene="design"]').tap(); await wait(900); } await page.setViewportSize({ width: h, height: w }); await wait(500); const side = await view(page); const lines = await sides(page); await page.setViewportSize({ width: w, height: h }); await wait(500); if (i === 2) await settled(page, 'design'); const again = await view(page); row.turns.push({ onItsSide: { pansBy: side.max, lines, scroll: await page.evaluate(() => scrollX) }, uprightCentre: again.centre, height: again.height }); }
      await page.locator('.hj-tab[data-scene="set"]').tap(); await settled(page, 'set'); const after = await spots(page); row.mushroomsInPlace = after.length === before.length && after.every((s, i) => s.id === before[i].id && Math.abs(s.x - before[i].x) <= 1 && Math.abs(s.y - before[i].y) <= 1);
      row.console = page.log; await context.close();
    }
    await browser.close();
    // Chrome's own touch gestures: sideways pans the room, up and down scrolls the page.
    const chrome = await start.chrome(); report.touch = {};
    for (const [w, h] of [[744, 1133], [620, 640]]) {
      const context = await chrome.newContext(ipad(w, h)); const page = await open(context, BUILDS.new, 'grow'); await wait(3200); const cdp = await context.newCDPSession(page); const box = await windowBox(page); const x = w / 2; const y = Math.round((box.top + Math.min(box.bottom, h)) / 2);
      const swipe = async (dx, dy) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); for (let i = 1; i <= 20; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 20, y: y + dy * i / 20 }] }); await wait(12); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(900); return page.evaluate(() => ({ room: document.querySelector('.hj-viewport').scrollLeft, page: scrollY })); };
      const opened = await page.evaluate(() => ({ room: document.querySelector('.hj-viewport').scrollLeft, page: scrollY, pageCanScroll: document.documentElement.scrollHeight - innerHeight }));
      report.touch[`${w}x${h}`] = { opened, swipedRight: await swipe(200, 0), swipedLeft: await swipe(-300, 0), swipedUp: await swipe(0, -150) }; await context.close();
    }
    await chrome.close();
    save('pan.json', report);
  },
  async hunt() {
    const browser = await start.webkit(); const report = {};
    for (const [label, options] of [['ipad 1180x820', ipad(1180, 820)], ['ipad 1133x677', ipad(1133, 677)], ['mini 744x1133', ipad(744, 1133)], ['mini 768x1024', ipad(768, 1024)], ['mini 1133x744', ipad(1133, 744)], ['phone 390x844', phone(390, 844)]]) {
      const context = await browser.newContext(options); const page = await open(context, BUILDS.new, 'build'); const missed = []; let found = 0;
      for (const id of IDS) {
        if (id !== 'build') { await page.locator(`.hj-tab[data-scene="${id}"]`).tap(); await settled(page, id); }
        const ids = await page.evaluate(() => [...document.querySelectorAll('.hj-shroom')].map((b) => b.dataset.spot));
        for (const spot of ids) {
          const at = await page.evaluate(async (x) => { const v = document.querySelector('.hj-viewport'); const art = document.querySelector(`.hj-shroom[data-spot="${x}"] .hj-shroom-art`); const b = art.getBoundingClientRect(); const w = v.getBoundingClientRect(); if (v.scrollWidth - v.clientWidth > 1) v.scrollLeft += b.left + b.width / 2 - (w.left + w.width / 2); await new Promise((r) => setTimeout(r, 120)); const c = art.getBoundingClientRect(); window.scrollTo(0, Math.max(0, scrollY + c.top - innerHeight + 80)); const d = art.getBoundingClientRect(); return { x: d.left + d.width / 2, y: d.top + d.height / 2 }; }, spot);
          const seen = await page.evaluate((p) => { const e = document.elementFromPoint(p.x, p.y); return e?.closest('.hj-shroom')?.dataset.spot ?? null; }, at);
          await page.touchscreen.tap(at.x, at.y); await wait(60);
          const stored = await page.evaluate(() => localStorage.length); if (seen !== spot || !stored) missed.push(`${id}/${spot} (${seen})`);
        }
        await wait(1600); const n = await page.evaluate(() => document.querySelector('.hj-row.is-red .hj-num-now').textContent); found = Number(n);
      }
      await wait(1800);
      report[label] = { found: await page.evaluate(() => document.querySelector('.hj-row.is-red .hj-num-now').textContent), contact: await page.evaluate(() => getComputedStyle(document.querySelector('.hj-contact')).visibility), missed, console: page.log };
      if (/mini 744|mini 768/.test(label)) { await page.screenshot({ path: join(out, `all-50-${label.replace(' ', '-')}.jpg`), type: 'jpeg', quality: 85 }); await page.locator('.hj-contact').tap(); await wait(900); await page.screenshot({ path: join(out, `form-${label.replace(' ', '-')}.jpg`), type: 'jpeg', quality: 85 }); }
      await context.close();
    }
    await browser.close(); save('hunt.json', report);
  },
  async record() {
    const dir = join(site, 'node_modules/.hj/rec016'); rmSync(dir, { recursive: true, force: true });
    const browser = await start.webkit(); const context = await browser.newContext(ipad(744, 1133, { recordVideo: { dir, size: { width: 1133, height: 1133 } } })); const page = await open(context, BUILDS.new, 'build');
    await wait(4200); // the drift
    const box = await windowBox(page); const y = (box.top + box.bottom) / 2 - 120;
    const swipe = async (from, to) => { await page.mouse.move(from, y); await page.mouse.down(); const n = 22; for (let i = 1; i <= n; i++) { const t = i / n; await page.mouse.move(from + (to - from) * (t * t * (3 - 2 * t)), y); await wait(16); } await page.mouse.up(); await wait(900); };
    const find = async (end) => { const at = await page.evaluate((e) => { const w = document.querySelector('.hj-viewport').getBoundingClientRect(); const all = [...document.querySelectorAll('.hj-shroom')].filter((b) => !b.disabled && !/taken|found/.test(b.className)).map((b) => b.querySelector('.hj-shroom-art').getBoundingClientRect()).filter((r) => r.left > w.left + 4 && r.right < w.right - 4).sort((a, b) => (e === 'left' ? a.left - b.left : b.left - a.left)); const r = all[0]; return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, end); await page.touchscreen.tap(at.x, at.y); await wait(2600); };
    for (let i = 0; i < 4; i++) await swipe(box.left + 80, box.right - 80); await find('left');
    for (let i = 0; i < 5; i++) await swipe(box.right - 80, box.left + 80); await find('right');
    await page.setViewportSize({ width: 1133, height: 744 }); await wait(2500); await page.setViewportSize({ width: 744, height: 1133 }); await wait(2500);
    const log = page.log; await context.close(); await browser.close();
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(dir, readdirSync(dir).find((f) => f.endsWith('.webm'))), '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-crf', '23', join(out, 'mini-744x1133.mp4')]); console.log('mini-744x1133.mp4', log);
  },
};
const [name, ...rest] = process.argv.slice(2);
await run[name](...rest);
process.exit(0);

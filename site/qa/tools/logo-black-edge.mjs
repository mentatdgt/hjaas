// The painting's border after the logo tap (reviews/logo-black-edge-build.md). Serves a production build the way Vercel
// does (max-age=0, etags, 304s); the stylesheet can be made to arrive after the script.
//
//   HJ_DIST=<build> HJ_TAG=before|after node qa/tools/logo-black-edge.mjs <mode> [engine,…]
//   race    stylesheet late by 0 to 600 ms, first visit and reload: what the script sees as it mounts, and the border's colour
//   jitter  every file a few tens of ms late at random: how often 20 reloads come out black
//   taps    the logo tapped 1 and 5 times, back, forward: border, console, canvas memory, screenshots (HJ_LATE: stylesheet, ms)
//   home    from another scene; a held key or the middle button still opens a tab; Enter; the link itself
//   away    pagehide and pageshow: canvases given back and drawn again (the browser's own cache, and the events by hand)
//   net     edge canvases that get no context, go black, throw, or are lost later
//   paint   the first visit's painting, with the stylesheet on time and late
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit, chromium, firefox, devices } from 'playwright';
import sharp from 'sharp';
const site = fileURLToPath(new URL('../../', import.meta.url));
const dist = process.env.HJ_DIST ?? join(site, 'dist');
const tag = process.env.HJ_TAG ?? 'after';
const out = process.env.HJ_OUT ?? join(site, 'qa/logo-black-edge');
mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const save = (name, data) => writeFileSync(join(out, `${name}-${tag}.json`), `${JSON.stringify(data, null, 1)}\n`);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2' };
let cssLate = 0;
let jitter = 0;
let log = [];
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  try {
    const data = await readFile(join(dist, normalize(path === '/' ? '/index.html' : path)));
    const etag = `"${createHash('md5').update(data).digest('hex')}"`;
    const css = /index-.*\.css$/.test(path);
    const same = req.headers['if-none-match'] === etag;
    if (css || /index-.*\.js$|^\/$/.test(path)) log.push(`${css ? 'css' : path === '/' ? 'page' : 'js'} ${same ? 304 : 200}`);
    await wait(css ? cssLate : 0);
    if (jitter) await wait(Math.random() * jitter);
    const head = { 'Cache-Control': 'public, max-age=0, must-revalidate', ETag: etag, 'Content-Type': types[extname(path || '.html')] ?? 'text/html' };
    if (same) return res.writeHead(304, head).end();
    res.writeHead(200, head).end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const CRIOS = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.101 Mobile/15E148 Safari/604.1';
const SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const engines = { webkit: (o) => webkit.launch(o), chrome: (o) => chromium.launch({ channel: 'chrome', ...o }), firefox: (o) => firefox.launch({ channel: 'moz-firefox', ...o }) };
const pad = (w, h, userAgent) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, userAgent });
const CASES = {
  'ipad-1180x820-crios': ['webkit', pad(1180, 820, CRIOS)], 'ipad-1180x820-safari': ['webkit', pad(1180, 820, SAFARI)],
  'ipad-1366x1024-crios': ['webkit', pad(1366, 1024, CRIOS)], 'ipad-1366x1024-safari': ['webkit', pad(1366, 1024, SAFARI)],
  'phone-390x844': ['webkit', { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }],
  'desktop-chrome': ['chrome', { viewport: { width: 1440, height: 900 } }], 'desktop-firefox': ['firefox', { viewport: { width: 1440, height: 900 } }],
};
const IDS = ['build', 'grow', 'design', 'film', 'set'];
const SPOTS = Object.fromEntries(IDS.map((id) => [id, [...readFileSync(join(site, `src/scenes/${id}.ts`), 'utf8').matchAll(/\{ id: '([\w-]+)', art:/g)].map((m) => m[1])]));
const all = JSON.stringify({ scenes: Object.fromEntries(IDS.map((id) => [id, { found: SPOTS[id], seen: true, panX: null }])), unlocked: false, panned: true });
/** In every page: each canvas counted, whatever becomes of it; all 50 found, if asked for. */
const prepare = async (context, found) => {
  await context.addInitScript(() => {
    const made = (window.__canvases = []);
    const create = Document.prototype.createElement;
    Document.prototype.createElement = function (tag, ...rest) { const el = create.call(this, tag, ...rest); if (String(tag).toLowerCase() === 'canvas') made.push(new WeakRef(el)); return el; };
    window.__bytes = () => made.reduce((sum, ref) => { const c = ref.deref(); return sum + (c ? c.width * c.height * 4 : 0); }, 0);
    const append = Element.prototype.append;
    Element.prototype.append = function (...a) { append.apply(this, a); if (a[0]?.classList?.contains('hj-scene')) window.__mount = getComputedStyle(a[0]).backgroundColor; };
  });
  if (found) await context.addInitScript((finds) => {
    localStorage.setItem('hjaas:site:v2', finds);
  }, all);
};
const settled = (page) => page.waitForFunction(() => {
  const plate = document.querySelector('.hj-plate'); const skip = document.querySelector('.hj-controls .hj-link');
  return plate && skip.classList.contains('is-off') && !plate.querySelector('.hj-mushrooms').inert && document.querySelector('.hj-scene:not(.is-pre):not(.is-away)');
}, null, { timeout: 40000 });
const edgeIs = (page) => page.evaluate(() => [...document.querySelectorAll('.hj-viewport .hj-edge canvas')].map((c, i) => { if (!c.width) return 'none'; const x = [c.width >> 1, c.width >> 1, 0, c.width - 1][i]; const y = [0, c.height - 1, c.height >> 1, c.height >> 1][i]; return [...c.getContext('2d').getImageData(x, y, 1, 1).data].join(); }).join(' '));
/** The window's outermost ring, 4 CSS px in: paper all the way. Returns how many of its px are not, and the darkest. */
const ring = async (page, file) => {
  const image = await page.screenshot(file ? { path: file, type: 'jpeg', quality: 88 } : {});
  const shot = file ? await page.screenshot() : image;
  const r = await page.evaluate(() => { const b = document.querySelector('.hj-window').getBoundingClientRect(); const p = document.querySelector('.hj-plate').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, sides: p.width <= b.width + 2, vh: innerHeight }; });
  const { data, info } = await sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const k = info.width / (await page.evaluate(() => innerWidth));
  let off = 0; let darkest = 255; let n = 0;
  const look = (cx, cy) => { const x = Math.round(cx * k); const y = Math.round(cy * k); if (x < 0 || y < 0 || x >= info.width || y >= info.height) return; const i = (y * info.width + x) * 3; n++; const low = Math.min(data[i], data[i + 1], data[i + 2]); darkest = Math.min(darkest, low); if (Math.abs(data[i] - 246) > 14 || Math.abs(data[i + 1] - 243) > 14 || Math.abs(data[i + 2] - 236) > 14) off++; };
  for (let x = r.x + 4; x < r.x + r.w - 4; x++) { look(x, r.y + 4); look(x, r.y + r.h - 4); }
  if (r.sides) for (let y = r.y + 4; y < r.y + r.h - 4; y++) { look(r.x + 4, y); look(r.x + r.w - 4, y); }
  return { off, of: n, darkest };
};
const tapLogo = (page, touch) => page.evaluate(() => { document.querySelector('.hj-logo'); }).then(() => (touch ? page.tap('.hj-logo', { noWaitAfter: true }) : page.click('.hj-logo', { noWaitAfter: true })));
const only = process.argv[3]?.split(',');
const pick = (names) => (only ? names.filter((n) => only.some((o) => n.includes(o))) : names);

const run = {
  async race() {
    const report = {};
    for (const name of pick(Object.keys(engines))) {
      const browser = await engines[name]();
      for (const [kind, late] of [['first', 0], ['first', 150], ['first', 600], ['reload', 0], ['reload', 40], ['reload', 150], ['reload', 600]]) {
        const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
        await prepare(context); const page = await context.newPage();
        cssLate = kind === 'first' ? late : 0; log = [];
        await page.goto(base); await settled(page);
        if (kind === 'reload') { cssLate = late; log = []; await page.evaluate(() => { location.href = './'; }).catch(() => {}); await wait(700); await settled(page); }
        report[`${name} ${kind} css+${late}`] = { mount: await page.evaluate(() => window.__mount), edge: await edgeIs(page), ring: await ring(page), asked: log.join(', ') };
        console.log(name, kind, late, JSON.stringify(report[`${name} ${kind} css+${late}`]));
        await context.close();
      }
      await browser.close();
    }
    save('race', report);
  },
  async jitter() {
    const report = {};
    for (const name of pick(Object.keys(engines))) {
      const browser = await engines[name]();
      for (const ms of [20, 60, 150]) {
        const context = await browser.newContext({ viewport: { width: 1180, height: 820 } }); await prepare(context); const page = await context.newPage();
        cssLate = 0; jitter = ms; let black = 0;
        await page.goto(base); await page.waitForSelector('.hj-logo');
        for (let i = 0; i < 20; i++) { await page.evaluate(() => { window.__old = 1; location.href = './'; }).catch(() => {}); await page.waitForFunction(() => !window.__old && window.__mount && document.querySelector('.hj-logo'), null, { timeout: 20000 }); if ((await edgeIs(page)).includes('0,0,0,255')) black++; }
        await context.close();
        let first = 0;
        for (let i = 0; i < 10; i++) { const fresh = await browser.newContext({ viewport: { width: 1180, height: 820 } }); await prepare(fresh); const p = await fresh.newPage(); await p.goto(base); await p.waitForSelector('.hj-logo'); if ((await edgeIs(p)).includes('0,0,0,255')) first++; await fresh.close(); }
        report[`${name} 0-${ms} ms`] = `reloads: ${black} of 20 black; first visits: ${first} of 10`; console.log(name, ms, report[`${name} 0-${ms} ms`]);
      }
      jitter = 0; await browser.close();
    }
    save('jitter', report);
  },
  async taps() {
    const report = {}; const late = Number(process.env.HJ_LATE ?? 0);
    for (const name of pick(Object.keys(CASES))) for (const found of [true, false]) {
      const [engine, options] = CASES[name]; const browser = await engines[engine]();
      const { isMobile, ...rest } = options;
      const context = await browser.newContext(engine === 'firefox' ? rest : options); await prepare(context, found); const page = await context.newPage();
      const said = []; page.on('console', (m) => said.push(`${m.type()}: ${m.text()}`)); page.on('pageerror', (e) => said.push(`pageerror: ${e.message}`));
      let loads = 0; page.on('load', () => loads++);
      const key = `${name} ${found ? 'all50' : 'fresh'}`; const row = (report[key] = {});
      const shot = (what) => join(out, `${tag}-${name}-${found ? 'all50' : 'fresh'}-css${late}-${what}.jpg`);
      const note = async (what, keep) => { await settled(page); await wait(700); row[what] = { loads, edge: await edgeIs(page), ring: await ring(page, keep ? shot(what) : undefined), canvasBytes: await page.evaluate(() => window.__bytes()), url: page.url().replace(base, '/'), scene: await page.evaluate(() => document.querySelector('.hj-tab[aria-current]')?.dataset.scene), logo: await page.evaluate(() => document.querySelectorAll('.hj-logo').length) }; };
      cssLate = 0; await page.goto(`${base}robots.txt`); await page.goto(base); await settled(page); await wait(2800); await note('0 taps');
      cssLate = late;
      const tap = async () => { await tapLogo(page, options.hasTouch); await wait(600); await page.waitForSelector('.hj-logo'); await settled(page); await wait(2800); };
      await tap(); await note('1 tap');
      for (let i = 0; i < 4; i++) await tap();
      await note('5 taps', true);
      // (The old build's taps replace the page, so back leaves the site: forward then loads it again.)
      const home = () => page.url().startsWith(base) && !page.url().includes('robots');
      await page.goBack().catch(() => {}); await wait(600);
      if (home()) await note('back', found); else row.back = `left for ${page.url().replace(base, '/')}`;
      await page.goForward().catch(() => {}); await wait(600); await note('forward', found);
      await page.goto(`${base}robots.txt`); await page.goBack({ waitUntil: 'commit' }).catch(() => {}); await wait(800); await note('another page, and back', found);
      row.console = [...new Set(said)];
      console.log(key, JSON.stringify(row)); await browser.close();
    }
    save(`taps-css${late}`, report);
  },
  async home() {
    cssLate = 0;
    const report = {};
    for (const name of pick(Object.keys(engines))) {
      const browser = await engines[name](); const context = await browser.newContext({ viewport: { width: 1180, height: 820 } }); await prepare(context); const page = await context.newPage();
      let loads = 0; page.on('load', () => loads++);
      await page.goto(`${base}#grow`); await settled(page);
      const row = (report[name] = { href: await page.evaluate(() => [document.querySelector('.hj-logo').tagName, document.querySelector('.hj-logo').getAttribute('href'), document.querySelector('.hj-logo').href].join(' ').replace(location.origin, '')) });
      const where = async () => ({ url: page.url().replace(base, '/'), scene: await page.evaluate(() => document.querySelector('.hj-tab[aria-current]')?.dataset.scene), loads, edge: await edgeIs(page) });
      const until = async (id) => { await page.waitForFunction((want) => document.querySelector('.hj-tab[aria-current]')?.dataset.scene === want, id, { timeout: 20000 }); await settled(page); };
      await page.click('.hj-logo'); await until('build'); row['from grow'] = await where();
      await page.click('[data-scene=set]'); await until('set'); await page.focus('.hj-logo'); await page.keyboard.press('Enter'); await until('build'); row['Enter, from set'] = await where();
      await page.goBack(); await until('set'); row.back = await where();
      for (const [what, o] of [['held Meta', { modifiers: ['Meta'] }], ['middle button', { button: 'middle' }]]) {
        const opened = context.waitForEvent('page', { timeout: 4000 }).catch(() => null); await page.click('.hj-logo', o); const other = await opened; await wait(400);
        row[what] = { newTab: other ? other.url().replace(base, '/') : 'none', here: await where() }; await other?.close();
      }
      // Five taps straight after one another, in the middle of the painting back.
      if ((await where()).scene === 'build') { await page.click('[data-scene=set]'); await until('set'); }
      for (let i = 0; i < 5; i++) { await page.click('.hj-logo'); await wait(60); }
      await until('build'); await wait(3000); row['five quick taps'] = { ...(await where()), ring: await ring(page) };
      console.log(name, JSON.stringify(row)); await browser.close();
    }
    save('home', report);
  },
  async away() {
    cssLate = 0;
    const report = {};
    for (const name of pick(Object.keys(engines))) for (const [how, scene] of [['cache', ''], ['cache', '#film'], ['events', ''], ['events', '#grow'], ['events', '#film'], ['events', '#set'], ['painting', ''], ['switching', '']]) {
      const browser = await engines[name](name === 'chrome' ? { ignoreDefaultArgs: ['--disable-back-forward-cache'] } : {});
      const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 }); await prepare(context); const page = await context.newPage();
      const said = []; page.on('pageerror', (e) => said.push(`pageerror: ${e.message}`)); page.on('console', (m) => m.type() !== 'log' && said.push(m.text()));
      await page.goto(base + scene); const key = `${name} ${how} ${scene || '#build'}`; const row = (report[key] = {});
      if (how !== 'painting') await settled(page); else await page.waitForFunction(() => performance.getEntriesByName('hj-paint').length, null, { timeout: 30000 }).then(() => wait(400));
      if (how !== 'painting') await wait(2800);
      row.before = await page.evaluate(() => window.__bytes());
      await page.evaluate(() => { window.__kept = 1; window.addEventListener('pagehide', () => setTimeout(() => {}, 0)); });
      if (how === 'cache') {
        await page.evaluate(() => window.addEventListener('pagehide', () => { window.__hidden = window.__bytes(); }));
        await page.goto(`${base}robots.txt`); await page.evaluate(() => void setTimeout(() => history.back())); await wait(1500);
        row.restored = (await page.evaluate(() => window.__kept === 1)) ? 'as it was' : 'loaded afresh';
        row.hidden = await page.evaluate(() => window.__hidden ?? null);
      } else {
        if (how === 'switching') { await page.click('[data-scene=design]'); await wait(250); }
        row.hidden = await page.evaluate(() => { const at = scrollY; window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })); return window.__bytes() + at * 0; });
        await wait(600); row['still hidden'] = await page.evaluate(() => window.__bytes());
        await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
        await wait(how === 'painting' ? 900 : 0);
      }
      await settled(page); await wait(3200);
      Object.assign(row, { after: await page.evaluate(() => window.__bytes()), scene: await page.evaluate(() => document.querySelector('.hj-tab[aria-current]')?.dataset.scene), edge: await edgeIs(page), ring: await ring(page, name === 'webkit' && how !== 'cache' ? join(out, `${tag}-away-${name}-${how}${scene.replace('#', '-')}.jpg`) : undefined),
        her: await page.evaluate(() => [...document.querySelectorAll('.hj-viewport .hj-rachel canvas, .hj-viewport .hj-actor canvas')].map((c) => { if (!c.width) return 'none'; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++; return n > 50 ? 'drawn' : 'empty'; }).join(' ')), room: await page.evaluate(() => document.querySelector('.hj-room').naturalWidth), said: [...new Set(said)] });
      // It still works: another scene and back, and a find.
      await page.evaluate(() => document.querySelector('[data-scene=design]').click()); await page.waitForFunction(() => document.querySelector('.hj-tab[aria-current]')?.dataset.scene === 'design'); await settled(page); row.then = { edge: await edgeIs(page), ring: await ring(page) };
      console.log(key, JSON.stringify(row)); await browser.close();
    }
    save('away', report);
  },
  async net() {
    cssLate = 0;
    const report = {};
    for (const name of pick(Object.keys(engines))) for (const how of ['no context', 'black', 'throws', 'lost later', 'once']) {
      const browser = await engines[name](); const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 }); await prepare(context);
      await context.addInitScript((how) => {
        const isEdge = (c) => c?.parentElement?.className === 'hj-edge';
        const get = HTMLCanvasElement.prototype.getContext; const put = CanvasRenderingContext2D.prototype.putImageData;
        let n = 0;
        if (how === 'no context') HTMLCanvasElement.prototype.getContext = function (...a) { return isEdge(this) ? null : get.apply(this, a); };
        else if (how !== 'lost later') CanvasRenderingContext2D.prototype.putImageData = function (...a) {
          if (!isEdge(this.canvas) || (how === 'once' && n++ % 2)) return put.apply(this, a);
          if (how === 'throws') throw new Error('no memory');
          this.fillStyle = '#000'; this.fillRect(0, 0, this.canvas.width, this.canvas.height);
        };
      }, how);
      const page = await context.newPage(); const said = []; page.on('console', (m) => said.push(m.text())); page.on('pageerror', (e) => said.push(`pageerror ${e.message}`));
      await page.goto(base); await settled(page); await wait(1200);
      const row = (report[`${name} ${how}`] = {});
      if (how === 'lost later') {
        await page.evaluate(() => { for (const c of document.querySelectorAll('.hj-edge canvas')) { const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); } });
        await wait(100); row.black = await ring(page);
        await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await wait(700);
      }
      const ask = () => page.evaluate(() => [...document.querySelectorAll('.hj-viewport .hj-edge canvas')].map((c) => { const m = c.nextElementSibling; return `${c.width ? 'drawn' : 'none'}${m?.classList.contains('is-on') ? '+fade' : ''}`; }).join(' '));
      Object.assign(row, { strips: await ask(), ring: await ring(page, join(out, `${tag}-net-${name}-${how.replace(' ', '-')}.jpg`)) });
      await page.click('[data-scene=grow]'); await page.waitForFunction(() => document.querySelector('.hj-tab[aria-current]')?.dataset.scene === 'grow'); await settled(page);
      await page.click('[data-scene=build]'); await page.waitForFunction(() => document.querySelector('.hj-tab[aria-current]')?.dataset.scene === 'build'); await settled(page);
      row['after a switch and back'] = { strips: await ask(), ring: await ring(page) }; row.said = [...new Set(said)];
      console.log(name, how, JSON.stringify(row)); await browser.close();
    }
    save('net', report);
  },
  async paint() {
    const report = {};
    for (const name of pick(Object.keys(engines))) for (const late of [0, 600]) {
      const browser = await engines[name](); const context = await browser.newContext({ viewport: { width: 1180, height: 820 } }); await prepare(context); const page = await context.newPage();
      cssLate = late; await page.goto(base, { waitUntil: 'commit' });
      await page.waitForFunction(() => performance.getEntriesByName('hj-paint').length, null, { timeout: 30000 });
      const frames = [];
      const begun = Date.now();
      for (const at of [0, 500, 1500, 3000]) { await wait(Math.max(0, begun + at - Date.now())); const s = await page.evaluate(() => { const c = document.querySelector('.hj-plate .hj-paint:not(.is-veil)'); if (!c?.width) return null; const t = document.createElement('canvas'); t.width = 60; t.height = 34; const x = t.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, 60, 34); const d = x.getImageData(0, 0, 60, 34).data; let sum = 0; for (let i = 3; i < d.length; i += 4) sum += d[i]; return Math.round((sum / (60 * 34 * 255)) * 100); }); frames.push(`${at} ms: sheet covers ${s}%`); }
      await settled(page); report[`${name} css+${late}`] = { frames, mount: await page.evaluate(() => window.__mount), seconds: (Date.now() - begun) / 1000 };
      console.log(name, late, JSON.stringify(report[`${name} css+${late}`])); await browser.close();
    }
    save('paint', report);
  },
};
try { for (const mode of process.argv[2].split(',')) await run[mode](); } finally { server.close(); }

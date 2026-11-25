// Favicon, title and the Reset gap (reviews/favicon-title-build.md). Reads the production build (`npm run build` first)
// from dist/, served here with 404.html at every missing path, as the site is.
//
//   node qa/tools/favicon-title.mjs [build] [icons] [reset]     all of them without a name
// Writes to qa/favicon-title/.
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices, webkit } from 'playwright';

const site = fileURLToPath(new URL('../../', import.meta.url));
const out = process.env.HJ_OUT ?? join(site, 'qa/favicon-title');
const dist = process.env.HJ_DIST ?? join(site, 'dist');
mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const save = (name, data) => { writeFileSync(join(out, name), `${JSON.stringify(data, null, 1)}\n`); console.log(name, JSON.stringify(data)); };
const ICONS = ['favicon.ico', 'favicon-32.png', 'favicon-16.png', 'icon-192.png', 'apple-touch-icon.png'];
const LINKS = [
  ['icon', null, '48x48', '/favicon.ico'], ['icon', 'image/png', '32x32', '/favicon-32.png'], ['icon', 'image/png', '16x16', '/favicon-16.png'],
  ['icon', 'image/png', '192x192', '/icon-192.png'], ['apple-touch-icon', null, '180x180', '/apple-touch-icon.png'],
];
const TITLE = 'Hui Jie as a Service (HJaaS)';
const PAGES = { '/': TITLE, '/a/deep/missing/path': 'Page not found · HJaaS' };

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
let log = [];
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  try {
    const file = join(dist, normalize(path === '/' ? '/index.html' : path)); const data = await readFile(file);
    log.push({ path, status: 200 }); res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }); res.end(data);
  } catch { log.push({ path, status: 404 }); res.writeHead(404, { 'Content-Type': 'text/html' }).end(await readFile(join(dist, '404.html'))); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const iconLog = () => log.filter(({ path }) => ICONS.some((name) => path.endsWith(name))).map(({ path, status }) => `${status} ${path}`);
/** The links, the title, and every linked icon asked for by the page itself: its size as drawn. */
const look = (page) => page.evaluate(async () => ({
  title: document.title,
  ogTitle: document.querySelector('meta[property="og:title"]')?.content ?? null,
  links: [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')].map((l) => [l.rel, l.getAttribute('type'), l.getAttribute('sizes'), l.getAttribute('href')]),
  drawn: Object.fromEntries(await Promise.all([...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')].map(async (l) => {
    const image = new Image(); image.src = `${l.href}?qa`; await image.decode().catch(() => {}); return [l.getAttribute('href'), `${image.naturalWidth}x${image.naturalHeight}`];
  }))),
}));

const settled = (page) => page.waitForFunction(() => {
  const plate = document.querySelector('.hj-plate'); const skip = document.querySelector('.hj-controls .hj-link');
  return plate && skip.classList.contains('is-off') && !plate.querySelector('.hj-mushrooms').inert && document.querySelector('.hj-scene:not(.is-pre)');
}, null, { timeout: 40000 }).then(() => wait(400));
const IDS = ['build', 'grow', 'design', 'film', 'set'];
const SPOTS = Object.fromEntries(IDS.map((id) => [id, [...readFileSync(join(site, `src/scenes/${id}.ts`), 'utf8').matchAll(/\{ id: '([\w-]+)', art:/g)].map((m) => m[1])]));
const progress = (n) => JSON.stringify({ scenes: Object.fromEntries(IDS.map((id) => [id, { found: SPOTS[id].slice(0, n), seen: true, panX: null }])), unlocked: false, panned: true });

const run = {
  /** The built files, and the five links as they are written in both pages. */
  async build() {
    const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16);
    const links = (file) => [...readFileSync(join(dist, file), 'utf8').matchAll(/<link\s+([^>]*rel="(?:icon|apple-touch-icon)"[^>]*)>/g)].map((m) => m[1].replace(/\s*\/?$/, '').replace(/\s+/g, ' '));
    const html = readFileSync(join(dist, 'index.html'), 'utf8');
    save('build.json', {
      files: Object.fromEntries(ICONS.map((name) => [name, existsSync(join(dist, name)) && hash(join(dist, name)) === hash(join(site, '../assets/logo/favicon', name)) ? 'as delivered' : 'WRONG'])),
      index: { links: links('index.html'), title: html.match(/<title>(.*)<\/title>/)[1], ogTitle: html.match(/og:title" content="(.*?)"/)[1] },
      missing: { links: links('404.html'), title: readFileSync(join(dist, '404.html'), 'utf8').match(/<title>(.*)<\/title>/)[1] },
    });
  },

  /** Both pages in a new Chrome and a new WebKit: what the browser asks for by itself, and every icon from the page. */
  async icons() {
    const report = {};
    const problems = [];
    for (const [engine, start] of Object.entries({ chrome: () => chromium.launch({ channel: 'chrome', headless: false }), webkit: () => webkit.launch({ headless: false }) })) {
      for (const [path, title] of Object.entries(PAGES)) {
        const browser = await start(); const page = await (await browser.newContext({ viewport: { width: 1200, height: 750 } })).newPage(); log = [];
        const answer = await page.goto(base + path); await wait(4000);
        const r = (report[`${engine} ${path}`] = { status: answer.status(), browserAskedFor: iconLog() });
        log = []; Object.assign(r, await look(page)); r.eachIcon = iconLog(); r.titleAfterAScene = null;
        if (path === '/') { await settled(page); await page.click('.hj-tab[data-scene="grow"]'); await wait(1500); r.titleAfterAScene = await page.title(); }
        if (r.title !== title || JSON.stringify(r.links) !== JSON.stringify(LINKS) || r.eachIcon.length !== 5 || r.eachIcon.some((l) => !l.startsWith('200')) || (path === '/' && (r.ogTitle !== TITLE || r.titleAfterAScene !== TITLE))) problems.push(`${engine} ${path}`);
        await browser.close();
      }
    }
    report.problems = problems; save('icons.json', report);
    // Chrome's own list of its open tabs, each with the icon and the title Chrome keeps for it.
    const context = await chromium.launchPersistentContext('', { channel: 'chrome', headless: false, viewport: null, deviceScaleFactor: undefined, args: ['--window-size=1200,800', '--force-device-scale-factor=2'] });
    const first = context.pages()[0]; await first.goto(base); const second = await context.newPage(); await second.goto(`${base}/a/deep/missing/path`); await wait(3000);
    const tabs = await context.newPage(); await tabs.goto('chrome://tab-search.top-chrome/'); await tabs.setViewportSize({ width: 420, height: 420 }); await wait(2000);
    await tabs.screenshot({ path: join(out, 'chrome-tabs.png') }); await context.close();
  },

  /** 5 found in every scene: a 150 ms double tap, the label back after 4 s, then taps 1 s apart; a third tap after a double tap. */
  async reset() {
    const report = {};
    const PADS = { 'webkit iPad': [webkit, {}, devices['iPad (gen 7)']], 'webkit iPhone': [webkit, {}, devices['iPhone 13']], 'webkit desktop': [webkit, {}, { viewport: { width: 1440, height: 900 } }], 'chrome desktop': [chromium, { channel: 'chrome' }, { viewport: { width: 1440, height: 900 } }], 'chrome phone': [chromium, { channel: 'chrome' }, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }] };
    for (const [name, [engine, launch, options]] of Object.entries(PADS)) {
      const browser = await engine.launch(launch); const page = await (await browser.newContext(options)).newPage(); const r = (report[name] = {}); const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.addInitScript((value) => {
        if (!sessionStorage.getItem('qa')) { sessionStorage.setItem('qa', '1'); localStorage.setItem('hjaas:site:v2', value); }
        window.__taps = []; addEventListener('click', (e) => { if (e.target.closest?.('.hj-reset')) window.__taps.push(Math.round(e.timeStamp)); }, true);
      }, progress(5));
      await page.goto(base); await settled(page);
      const at = async () => { const b = await page.locator('.hj-reset').boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
      // At the same place both times, as a finger would: the button is not looked up in between.
      const tap = (x, y) => (options.hasTouch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
      const gaps = async () => { const t = await page.evaluate(() => window.__taps.splice(0)); return t.map((x) => x - t[0]); };
      const state = () => page.evaluate(() => ({ label: document.querySelector('.hj-reset').textContent, said: document.querySelector('.hj-controls .hj-sr').textContent, saved: Object.keys(localStorage).filter((k) => /^hjaas:site:v3:/.test(k) && /found/.test(k)).length + (localStorage.getItem('hjaas:site:v2') ? 1000 : 0), red: ['now', 'of'].map((k) => document.querySelector(`.hj-row.is-red .hj-num-${k}`).textContent.trim()).join(''), hiddenHere: document.querySelectorAll('.hj-shroom').length, painting: !document.querySelector('.hj-controls .hj-link').classList.contains('is-off') }));
      r.before = await state();
      let p = await at(); let t0 = Date.now(); await tap(...p); await wait(Math.max(0, 150 - (Date.now() - t0))); await tap(...p); await wait(300);
      r.doubleTap = { tapsMs: await gaps(), ...(await state()) }; await wait(1200); r.doubleTapLater = await state();
      await page.waitForFunction(() => document.querySelector('.hj-reset').textContent === 'Reset mushrooms', null, { polling: 20, timeout: 8000 }); r.labelBackAfterMs = Date.now() - t0; r.afterTheWait = await state();
      p = await at(); t0 = Date.now(); await tap(...p); await wait(Math.max(0, 150 - (Date.now() - t0))); await tap(...p); await wait(1000 - (Date.now() - t0)); r.secondDoubleTap = await state(); await tap(...p); await wait(300);
      r.doubleTapThenAThirdAt1s = { tapsMs: await gaps(), ...(await state()) };
      // 5 found again, and two taps 1 s apart.
      await page.evaluate((value) => localStorage.setItem('hjaas:site:v2', value), progress(5)); await page.reload(); await settled(page); r.foundAgain = await state();
      p = await at(); t0 = Date.now(); await tap(...p); await wait(1000 - (Date.now() - t0)); await tap(...p); await wait(300);
      r.twoTaps1sApart = { tapsMs: await gaps(), ...(await state()) }; await settled(page); await wait(600); r.settled = await state();
      await page.reload(); await settled(page); r.reloaded = await state(); r.errors = errors;
      await browser.close();
    }
    save('reset.json', report);
  },
};
for (const name of process.argv.length > 2 ? process.argv.slice(2) : Object.keys(run)) await run[name]();
server.close();
process.exit(0);

// Copy round 1 and Instrument Sans (reviews/copy-round-1-build.md, on main). Nothing is sent: /api/contact is the
// function itself with the fetch to Resend mocked. Reads the production build (`npm run build` first) from dist/,
// behind its built _headers. HJ_OLD=<folder>: an older build, for the font bytes "before".
//
//   node qa/tools/copy-round-1.mjs [shots] [fonts] [width] [fit] [form]     all of them without a name
// Writes to qa/copy-round-1/.
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const site = fileURLToPath(new URL('../../', import.meta.url));
const out = join(site, 'qa/copy-round-1');
mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const save = (name, data) => { writeFileSync(join(out, name), `${JSON.stringify(data, null, 1)}\n`); console.log(name, JSON.stringify(data)); };

Object.assign(process.env, { RESEND_API_KEY: 're_made_up', MAIL_FROM: 'HJaaS <from@example.org>', CONTACT_TO: 'inbox@example.org' });
const toResend = [];
globalThis.fetch = async (url, init) => { toResend.push({ url, body: JSON.parse(init.body) }); return Response.json({ id: 'mocked' }); };
const { default: contact } = await import('../../api/contact.js');

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain' };
let visitor = 0;
async function serve(dist) {
  const csp = readFileSync(join(dist, '_headers'), 'utf8').match(/Content-Security-Policy: (.*)/)[1];
  const answers = [];
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    if (path === '/api/contact') {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const reply = answers[0] ? Response.json({ ok: false }, { status: answers.shift() }) : await contact.fetch(new Request('https://www.hjaas.com/api/contact', { method: 'POST', body: Buffer.concat(chunks), headers: { 'Content-Type': req.headers['content-type'], Origin: 'https://www.hjaas.com', 'x-real-ip': `v${visitor++}` } }));
      res.writeHead(reply.status, Object.fromEntries(reply.headers)); res.end(await reply.text()); return;
    }
    try {
      const file = join(dist, normalize(path === '/' ? '/index.html' : path)); const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Content-Security-Policy': csp }); res.end(data);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { base: `http://127.0.0.1:${server.address().port}/`, answers, close: () => { server.close(); server.closeAllConnections(); } };
}

const IDS = ['build', 'grow', 'design', 'film', 'set'];
const SPOTS = Object.fromEntries(IDS.map((id) => [id, [...readFileSync(join(site, `src/scenes/${id}.ts`), 'utf8').matchAll(/\{ id: '([\w-]+)', art:/g)].map((m) => m[1])]));
/** Saved progress: that many found in each scene named. */
const progress = (found) => JSON.stringify({ scenes: Object.fromEntries(IDS.map((id) => [id, { found: SPOTS[id].slice(0, found[id] ?? 0), seen: true, panX: null }])), unlocked: false, panned: true });
const all = (n) => Object.fromEntries(IDS.map((id) => [id, n]));
const launch = { chrome: () => chromium.launch({ channel: 'chrome' }), webkit: () => webkit.launch() };
const SIZES = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };

/** A page on a scene, with that much found, its painting over. */
async function open(browser, options, base, found, hash = 'build') {
  const context = await browser.newContext({ reducedMotion: 'reduce', ...options });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`${m.type()}: ${m.text()}`); });
  page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
  await page.addInitScript((value) => { if (!sessionStorage.getItem('qa')) { sessionStorage.setItem('qa', '1'); localStorage.setItem('hjaas:site:v2', value); } }, progress(found));
  await page.goto(`${base}#${hash}`);
  await page.waitForSelector('.hj-plate', { state: 'visible' });
  await wait(options.reducedMotion === 'no-preference' ? 9000 : 3000);
  return { context, page, errors };
}
const said = (page) => page.evaluate(() => {
  const text = (s) => document.querySelector(s).textContent.replace(/\s+/g, ' ').trim();
  const row = (k) => `${text(`.hj-row.is-${k} .hj-num-now`)}${text(`.hj-row.is-${k} .hj-num-of`)} ${text(`.hj-row.is-${k} .hj-label`)}`;
  return { cream: row('cream'), red: row('red'), button: getComputedStyle(document.querySelector('.hj-contact')).visibility === 'visible' ? `${text('.hj-contact')} · ${text('.hj-prize-note')}` : null, tagline: text('.hj-tagline') };
});
const jpg = (page, name, clip) => page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 88, ...(clip && { clip }) });
// Playwright's own screenshot styles are refused by the CSP in WebKit, and logged: not the page's doing.
const own = (errors) => errors.filter((e) => !/stylesheet|inline style/i.test(e));
const openForm = async (page) => { await page.evaluate(() => document.querySelector('.hj-contact').click()); await wait(900); };
const press = (page, options) => (options.hasTouch ? page.tap('.hj-form .hj-send') : page.click('.hj-form .hj-send'));

const run = {
  async shots(server) {
    const report = {};
    for (const [engine, start] of Object.entries(launch)) {
      const browser = await start();
      for (const [size, options] of Object.entries(SIZES)) {
        const name = `${size}-${engine}`; const r = (report[name] = {});
        for (const [state, found, hash] of [['0-found', {}, 'build'], ['3-found', { build: 3 }, 'build'], ['10-found', { build: 10 }, 'build'], ['50-found', all(10), 'build']]) {
          const { context, page, errors } = await open(browser, options, server.base, found, hash);
          r[state] = await said(page);
          await jpg(page, `${name}-${state}`);
          if (state === '0-found') {
            const box = await page.evaluate(() => { const b = document.querySelector('.hj-masthead').getBoundingClientRect(); return { x: 0, y: 0, width: innerWidth, height: Math.ceil(b.bottom + 10) }; });
            await jpg(page, `${name}-masthead`, box);
          }
          if (state === '50-found') {
            await openForm(page); await jpg(page, `${name}-form-1-open`);
            const err = async (n) => page.evaluate((k) => { const e = document.querySelector(`#hj-${k}-err`); return e.hidden ? null : e.textContent; }, n);
            const errs = async () => ({ name: await err('name'), email: await err('email'), message: await err('message') });
            await press(page, options); await wait(300); r.empty = await errs();
            await page.evaluate(() => (document.querySelector('.hj-sheet-body').scrollTop = 0)); await wait(100); await jpg(page, `${name}-form-2-missing`);
            await page.fill('#hj-name', 'Wren'); await page.fill('#hj-email', 'wren@example'); await page.fill('#hj-message', 'A shelf for the mushroom lab.');
            await press(page, options); await wait(300); r.typo = await errs();
            await jpg(page, `${name}-form-3-typo`);
            server.answers.push(500);
            await page.fill('#hj-email', 'wren@example.org');
            await page.evaluate(() => document.querySelectorAll('.hj-chip input')[3].click());
            await press(page, options); await page.waitForSelector('.hj-failure:not([hidden])'); await wait(300);
            await page.evaluate(() => { const b = document.querySelector('.hj-sheet-body'); b.scrollTop = b.scrollHeight; }); await wait(100);
            r.failed = await page.textContent('.hj-failure'); await jpg(page, `${name}-form-4-failed`);
            await press(page, options); await page.waitForSelector('.hj-sent:not([hidden])'); await wait(700);
            r.sent = await page.evaluate(() => document.querySelector('.hj-sent').innerText.split('\n').filter(Boolean)); await jpg(page, `${name}-form-5-sent`);
          }
          const mine = own(errors).filter((e) => !/500 \(Internal/.test(e) && !/status of 500/.test(e)); // the browser's own line about the stub's 500
          if (mine.length) (r.errors ??= []).push([state, mine]);
          await context.close();
        }
      }
      await browser.close();
    }
    save('shots.json', report);
  },

  async fonts(server) {
    const PARTS = ['.hj-name', '.hj-tagline', '.hj-tab', '.hj-num', '.hj-label', '.hj-next', '.hj-link', '.hj-contact', '.hj-prize-note', '#hj-form-title', '.hj-field label', '.hj-hint', '#hj-name', '#hj-message', '.hj-chip span', '.hj-form .hj-send', '.hj-err', '.hj-sent h3', '.hj-sent-line', '.hj-sent .hj-send'];
    const report = { bytes: {}, style: {}, painted: {} };
    for (const [when, dist] of [['before', process.env.HJ_OLD], ['after', join(site, 'dist')]]) {
      if (!dist) continue;
      const its = when === 'after' ? server : await serve(dist);
      for (const [engine, start] of Object.entries(launch)) {
        const browser = await start(); const context = await browser.newContext(SIZES.desktop); const page = await context.newPage();
        const got = []; page.on('response', async (r) => { if (/\.woff2?$/.test(r.url())) got.push([r.url().split('/').pop(), (await r.body()).length]); });
        await page.goto(its.base); await wait(6000);
        report.bytes[`${when}, ${engine}`] = { files: got, total: got.reduce((a, g) => a + g[1], 0) };
        await browser.close();
      }
      if (its !== server) its.close();
    }
    for (const [engine, start] of Object.entries(launch)) {
      const browser = await start(); const { context, page } = await open(browser, SIZES.desktop, server.base, all(10));
      await openForm(page);
      report.style[engine] = await page.evaluate((parts) => {
        // Widths of the same words in the computed stack and in the one family alone: equal only if it is the font used.
        const c = document.createElement('canvas').getContext('2d');
        return Object.fromEntries(parts.map((s) => {
          const el = document.querySelector(s); if (!el) return [s, 'missing'];
          const st = getComputedStyle(el); const w = (f) => { c.font = `${st.fontWeight} 40px ${f}`; return c.measureText('Hui Jie 0123456789 grow mushrooms').width; };
          return [s, { first: st.fontFamily.split(',')[0], weight: st.fontWeight, size: st.fontSize, instrumentSans: /^"?Instrument Sans Variable/.test(st.fontFamily) && w(st.fontFamily) === w("'Instrument Sans Variable', monospace") && w(st.fontFamily) !== w('monospace') }];
        }));
      }, PARTS);
      report.loaded ??= {}; report.loaded[engine] = await page.evaluate(() => [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`));
      if (engine === 'chrome') { // which font the glyphs were really drawn with
        const cdp = await context.newCDPSession(page); await cdp.send('DOM.enable'); await cdp.send('CSS.enable'); const { root } = await cdp.send('DOM.getDocument');
        for (const s of PARTS) { const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: s }); const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId }); report.painted[s] = fonts.map((f) => `${f.familyName}${f.isCustomFont ? ' (web)' : ' (SYSTEM)'}`).join(', '); }
      }
      await browser.close();
    }
    save('fonts.json', report);
  },

  /** A first find in a scene: where the cream row's parts are, every frame, as "hiding in" turns into "found in". */
  async width(server) {
    const report = {};
    for (const [engine, start] of Object.entries(launch)) for (const [size, options] of Object.entries(SIZES)) for (const id of ['build', 'set']) {
      const browser = await start(); const { context, page } = await open(browser, { ...options, reducedMotion: 'no-preference' }, server.base, {}, id);
      await page.evaluate(() => {
        window.__at = []; const R = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return [b.left, b.top].map((n) => Math.round(n * 100) / 100); };
        const look = () => { const l = document.querySelector('.hj-row.is-cream .hj-label'); window.__at.push({ label: l.textContent, width: Math.round(l.getBoundingClientRect().width * 10) / 10, cream: R('.hj-row.is-cream .hj-label'), red: R('.hj-row.is-red .hj-label'), num: R('.hj-row.is-cream .hj-num-of'), caption: document.querySelector('.hj-caption').getBoundingClientRect().height }); requestAnimationFrame(look); }; look();
        document.querySelector('.hj-shroom').click();
      });
      await wait(2500);
      const at = await page.evaluate(() => window.__at);
      const places = (k) => [...new Set(at.map((a) => JSON.stringify(a[k])))];
      report[`${size}, ${engine}, ${id}`] = { frames: at.length, labels: [...new Set(at.map((a) => `${a.label} (${a.width} px)`))], creamLabelAt: places('cream'), redLabelAt: places('red'), numberAt: places('num'), captionHeight: places('caption') };
      await context.close(); await browser.close();
    }
    save('width.json', report);
  },

  /** The whole tagline, the tabs on their rows, the longest finished row, and the page's width, at many sizes. */
  async fit(server) {
    const rows = []; const browser = await launch.chrome();
    for (const [width, height] of [[320, 568], [340, 700], [360, 740], [375, 667], [375, 812], [390, 844], [412, 915], [430, 932], [600, 500], [601, 900], [700, 900], [768, 1024], [820, 1180], [900, 900], [1024, 768], [1280, 720], [1366, 768], [1440, 900], [1920, 1080], [2200, 1300], [2560, 1440], [568, 320], [667, 375], [844, 390], [932, 430]]) {
      const touch = width < 960; const { context, page } = await open(browser, { viewport: { width, height }, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch }, server.base, { build: 10, grow: 10, set: 10 }, 'set');
      rows.push(await page.evaluate(() => {
        const q = (s) => document.querySelector(s); const b = (s) => q(s).getBoundingClientRect(); const t = q('.hj-tagline'); const range = document.createRange(); range.selectNodeContents(t);
        const tabs = [...document.querySelectorAll('.hj-tab')]; const n = (x) => Math.round(x * 10) / 10;
        return { size: `${innerWidth}x${innerHeight}`, taglineRows: new Set([...range.getClientRects()].map((r) => r.y)).size, taglineWhole: t.scrollHeight <= t.clientHeight + 1 && t.scrollWidth <= t.clientWidth, tabRows: new Set(tabs.map((x) => x.getBoundingClientRect().y)).size, tabNamesUnbroken: tabs.every((x) => { const r = document.createRange(); r.selectNodeContents(x.firstChild); return r.getClientRects().length === 1; }), row: `${q('.hj-row.is-cream .hj-label').textContent} ${q('.hj-next').textContent.trim()}`, rowRoomLeft: n(b('.hj-caption').right - b('.hj-next').right), window: `${n(b('.hj-window').width)}x${n(b('.hj-window').height)}`, captionBottom: n(b('.hj-caption').bottom), pageWiderThanScreen: document.documentElement.scrollWidth > innerWidth };
      }));
      await context.close();
    }
    await browser.close(); save('fit.json', rows);
  },

  /** The form against the function itself, Resend mocked: every new choice, one at a time, then all six. */
  async form(server) {
    const report = {}; const { NEEDS } = await import('../../src/engine/needs.js');
    for (const [engine, start] of Object.entries(launch)) {
      const browser = await start(); const { context, page, errors } = await open(browser, SIZES.phone, server.base, all(10)); const r = (report[engine] = []);
      for (const picks of [...NEEDS.map((_, i) => [i]), NEEDS.map((_, i) => i)]) {
        toResend.length = 0; await openForm(page);
        await page.fill('#hj-name', 'Wren'); await page.fill('#hj-email', 'wren@example.org'); await page.fill('#hj-message', 'A shelf for the mushroom lab, please.');
        await page.evaluate((list) => list.forEach((i) => document.querySelectorAll('.hj-chip input')[i].click()), picks);
        await press(page, SIZES.phone); await page.waitForSelector('.hj-sent:not([hidden])', { timeout: 8000 });
        r.push({ picked: picks.map((i) => NEEDS[i]), says: await page.textContent('.hj-sent-line'), toResend: toResend.map((m) => m.body) });
        await page.evaluate(() => document.querySelector('.hj-done').click()); await wait(600);
      }
      report[`${engine} errors`] = own(errors); await context.close(); await browser.close();
    }
    save('form.json', report);
  },
};

const server = await serve(join(site, 'dist'));
for (const name of process.argv.length > 2 ? process.argv.slice(2) : Object.keys(run)) await run[name](server);
server.close();
process.exit(0);

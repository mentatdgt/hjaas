// Job 006, the finales: evidence in qa/finales/.
//   node qa/tools/finales.mjs network   first load of each scene (a new visitor): no finale request at all; then the
//                                       sixth find of a scene starts them, at low priority, first frame and held pose first
//   node qa/tools/finales.mjs record    each finale recorded (Chrome 1440 x 900, WebKit iPhone 390 x 844) via ?finale=,
//                                       with a screenshot of each held pose
//   node qa/tools/finales.mjs rules     revisit (held pose at once, only it and its blink fetched), reduced motion
//                                       (held at once, no flash), the tenth found before the finale is here (3 s, then held)
// Needs `npm run dev` (the ?finale= and ?found= switches work only there). Headed, as record.mjs: headless runs at 10 fps.
import { chromium, webkit, devices } from 'playwright';
import { mkdir, readdir, rename, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const base = process.env.HJ_URL ?? 'http://localhost:5173/';
const out = 'qa/finales';
const headless = process.env.HJ_HEADLESS === '1';
// A third argument (or HJ_ONLY), tabs comma-separated, e.g. `record film`, runs just those scenes; `rules` keeps its
// own fixed list.
const only = (process.argv[3] ?? process.env.HJ_ONLY)?.split(',');
const SCENES = [['build', 'build'], ['grow', 'grow'], ['design', 'design'], ['film', 'film'], ['set', 'setdesign']]
  .filter(([hash]) => !only || only.includes(hash));
// Every scene has a finale now (Film's pose approved 2026-11-28, job 008).
const PLAYS = SCENES;
const what = process.argv[2] ?? 'all';
await mkdir(out, { recursive: true });
const results = JSON.parse(await readFile(join(out, 'results.json'), 'utf8').catch(() => '{}'));
const save = () => writeFile(join(out, 'results.json'), `${JSON.stringify(results, null, 1)}\n`);
const ready = (page) => page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 90000 });

async function network() {
  // (Run for some scenes only, the others' results are kept.)
  results.network = only ? (results.network ?? {}) : {};
  for (const [hash] of SCENES) {
    const browser = await chromium.launch({ channel: 'chrome', headless });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    const log = [];
    cdp.on('Network.requestWillBeSent', (e) => log.push({ at: Math.round(e.timestamp * 1000), url: e.request.url.replace(base, '/'), priority: e.request.initialPriority }));
    // A new visitor's first load: the full painting, everything the scene fetches once it has settled, and a while more.
    await page.goto(`${base}?debug&reset#${hash}`);
    await ready(page);
    await page.waitForTimeout(6000);
    const first = log.filter((r) => !r.url.includes('/@') && !r.url.includes('/node_modules/') && !r.url.includes('/src/'));
    const finaleFirst = first.filter((r) => r.url.includes('/finale'));
    // Then five found: still none. The sixth: the finale's files, low priority, in order.
    await page.goto(`${base}?debug&found=5&intro=off#${hash}`);
    await ready(page);
    await page.waitForTimeout(3000);
    const before = log.length;
    const afterFive = log.filter((r) => r.url.includes('/assets/') && r.url.includes('/finale')).length;
    await page.locator('.hj-shroom').first().click();
    await page.waitForTimeout(5000);
    const sixth = log.slice(before).filter((r) => r.url.includes('/assets/') && r.url.includes('/finale'));
    results.network[hash] = {
      firstLoadRequests: first.length,
      firstLoadFinaleRequests: finaleFirst.length,
      finaleRequestsWithFiveFound: afterFive,
      afterSixthFind: sixth.map((r) => `${r.url.split('/').pop()} (${r.priority})`),
    };
    await writeFile(join(out, `network-first-load-${hash}.json`), `${JSON.stringify(first, null, 1)}\n`);
    console.log(hash, JSON.stringify(results.network[hash]));
    await browser.close();
  }
  await save();
}

/**
 * Turn screencast frames (JPEG, with their times in s) into a WebM, in Chrome itself: each frame is drawn on a canvas for
 * as long as it was on screen, and MediaRecorder records the canvas. (No ffmpeg on this machine, nor Playwright's own.)
 */
async function toWebm(browser, frames, file) {
  const page = await browser.newPage();
  await page.goto('about:blank');
  await page.evaluate(() => { window.__frames = []; });
  for (let i = 0; i < frames.length; i += 40) {
    await page.evaluate((chunk) => window.__frames.push(...chunk), frames.slice(i, i + 40));
  }
  const b64 = await page.evaluate(async () => {
    const list = window.__frames;
    const bitmaps = await Promise.all(list.map(async ({ data }) => createImageBitmap(await (await fetch(`data:image/jpeg;base64,${data}`)).blob())));
    const canvas = document.createElement('canvas');
    canvas.width = bitmaps[0].width - (bitmaps[0].width % 2);
    canvas.height = bitmaps[0].height - (bitmaps[0].height % 2);
    document.body.append(canvas);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmaps[0], 0, 0);
    const recorder = new MediaRecorder(canvas.captureStream(60), { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 8_000_000 });
    const parts = [];
    recorder.ondataavailable = (e) => parts.push(e.data);
    const done = new Promise((resolve) => { recorder.onstop = resolve; });
    recorder.start();
    const t0 = performance.now();
    const s0 = list[0].at;
    for (let i = 0; i < list.length; i++) {
      const due = (list[i].at - s0) * 1000;
      while (performance.now() - t0 < due) await new Promise((r) => requestAnimationFrame(r));
      ctx.drawImage(bitmaps[i], 0, 0, canvas.width, canvas.height);
    }
    await new Promise((r) => setTimeout(r, 300));
    recorder.stop();
    await done;
    const buffer = new Uint8Array(await new Blob(parts, { type: 'video/webm' }).arrayBuffer());
    let s = '';
    for (let i = 0; i < buffer.length; i += 0x8000) s += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
    return btoa(s);
  });
  await writeFile(file, Buffer.from(b64, 'base64'));
  await page.close();
}

async function record() {
  results.record = only ? (results.record ?? {}) : {};
  const browser = await chromium.launch({ channel: 'chrome', headless });
  for (const device of ['desktop', 'iphone']) {
    for (const [hash, name] of PLAYS) {
      const phone = device === 'iphone';
      const size = phone ? { width: 390, height: 844 } : { width: 1440, height: 900 };
      // The iPhone in Chrome's emulation (screencast is Chrome's): iPhone 14's 390 x 844 at 3x, touch.
      const context = await browser.newContext(phone ? { ...devices['iPhone 14'], viewport: size, defaultBrowserType: undefined } : { viewport: size });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text()));
      const cdp = await context.newCDPSession(page);
      const frames = [];
      cdp.on('Page.screencastFrame', (e) => {
        frames.push({ data: e.data, at: e.metadata.timestamp });
        void cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {});
      });
      // Every flash the page ever puts up is counted.
      await page.addInitScript(() => {
        window.__flashes = 0;
        new MutationObserver((list) => { for (const m of list) for (const n of m.addedNodes) if (n.classList?.contains('hj-flash')) window.__flashes++; })
          .observe(document, { childList: true, subtree: true });
      });
      await page.goto(`${base}?debug&reset&intro=off&finale=${name}#${hash}`);
      await ready(page);
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, everyNthFrame: 1, ...(phone ? { maxWidth: 780, maxHeight: 1688 } : {}) });
      await page.waitForFunction(() => window.__hj.finale?.phase === 'held' && window.__hj.finale.covers, null, { timeout: 60000 });
      await page.waitForTimeout(phone ? 1200 : 800);
      await page.screenshot({ path: join(out, `held-${name}-${device}.jpg`), type: 'jpeg', quality: 88 });
      // A while held, for a blink or two.
      await page.waitForTimeout(6500);
      await cdp.send('Page.stopScreencast');
      const r = await page.evaluate(() => {
        const f = window.__hj.finale;
        const t = f.log.map(([, at]) => at);
        return {
          shown: f.log.map(([p, at], i) => `${p.replace(/\.png$/, '')}+${i ? at - t[i - 1] : 0}`).join(' '),
          peakDecodedBytes: f.peak,
          decodedNow: f.bytes,
          canvasBytes: f.canvasBytes,
          set: document.querySelector('.hj-finale canvas') ? `${document.querySelector('.hj-finale canvas').width}px canvas` : '',
          longTasks: window.__hj.longTasks.length,
          flashes: window.__flashes,
          // Each actor on the page and whether the finale hid it, by its data-actor name.
          actors: Object.fromEntries([...document.querySelectorAll('[data-actor]')].map((el) => [el.dataset.actor, getComputedStyle(el).visibility])),
        };
      });
      results.record[`${name}-${device}`] = { ...r, videoFrames: frames.length, errors };
      console.log(name, device, JSON.stringify(results.record[`${name}-${device}`]));
      await context.close();
      await toWebm(browser, frames, join(out, `finale-${name}-${device}.webm`));
    }
  }
  await browser.close();
  await save();
  // The held poses in Safari's engine too, on the iPhone (if this Playwright's WebKit is installed).
  const safari = await webkit.launch({ headless }).catch((error) => {
    console.log('WebKit not installed here: no Safari screenshots', String(error).split('\n')[0]);
    return null;
  });
  if (!safari) return;
  for (const [hash, name] of PLAYS) {
    const context = await safari.newContext({ ...devices['iPhone 14'], viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${base}?debug&reset&intro=off&finale=${name}#${hash}`);
    await ready(page);
    await page.waitForFunction(() => window.__hj.finale?.phase === 'held' && window.__hj.finale.covers, null, { timeout: 60000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(out, `held-${name}-iphone-webkit.jpg`), type: 'jpeg', quality: 88 });
    results.record[`${name}-iphone-webkit`] = await page.evaluate(() => ({ shown: window.__hj.finale.log.map(([p]) => p.replace(/\.png$/, '')).join(' '), peakDecodedBytes: window.__hj.finale.peak }));
    await context.close();
  }
  await safari.close();
  await save();
}

async function rules() {
  results.rules = {};
  const browser = await chromium.launch({ channel: 'chrome', headless });
  const open = async (url, options = {}) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
    const page = await context.newPage();
    const requests = [];
    page.on('request', (r) => r.url().includes('/finale') && requests.push(r.url().split('/').pop()));
    // Every flash the page ever puts up is counted.
    await page.addInitScript(() => {
      window.__flashes = 0;
      new MutationObserver((list) => { for (const m of list) for (const n of m.addedNodes) if (n.classList?.contains('hj-flash')) window.__flashes++; })
        .observe(document, { childList: true, subtree: true });
    });
    await page.goto(url);
    await ready(page);
    return { context, page, requests };
  };
  const state = (page) => page.evaluate(() => ({ phase: window.__hj.finale?.phase, covers: window.__hj.finale?.covers, shown: window.__hj.finale?.log.map(([p]) => p).join(' '), flashes: window.__flashes }));

  // Revisit: a scene already complete (all fifty found) shows the held pose, never the run; only it and its blink fetched.
  for (const [hash] of [['build'], ['set'], ['film']]) {
    const { context, page, requests } = await open(`${base}?debug&reset&all=50&intro=off#${hash}`);
    await page.waitForTimeout(2500);
    results.rules[`revisit-${hash}`] = { ...(await state(page)), requests };
    await page.screenshot({ path: join(out, `revisit-${hash}.jpg`), type: 'jpeg', quality: 86 });
    await context.close();
  }
  // Away and back mid-finale: on return she holds the pose.
  {
    const { context, page } = await open(`${base}?debug&reset&intro=off&finale=setdesign#set`);
    await page.waitForFunction(() => window.__hj.finale?.covers, null, { timeout: 60000 });
    await page.waitForTimeout(600);
    await page.locator('.hj-tab[data-scene="build"]').click();
    await page.waitForTimeout(2500);
    await page.locator('.hj-tab[data-scene="set"]').click();
    await page.waitForTimeout(3000);
    results.rules['away-and-back-mid-finale'] = await state(page);
    await context.close();
  }
  // Reduced motion: the tenth find goes straight to the held pose; the film's flash never shows.
  for (const hash of ['film', 'set']) {
    const { context, page } = await open(`${base}?debug&reset&intro=off&found=9#${hash}`, { reducedMotion: 'reduce' });
    await page.waitForTimeout(4000);
    await page.locator('.hj-shroom').first().click();
    await page.waitForTimeout(2500);
    results.rules[`reduced-motion-${hash}`] = await state(page);
    await context.close();
  }
  // The flash with motion, for comparison.
  {
    const { context, page } = await open(`${base}?debug&reset&intro=off&found=9#film`);
    await page.waitForTimeout(4000);
    await page.locator('.hj-shroom').first().click();
    await page.waitForTimeout(2500);
    results.rules['motion-film'] = await state(page);
    await context.close();
  }
  // The tenth found before the finale is here: its files held back 4.5 s. She keeps her routine, gives up after 3 s,
  // and holds the pose when it arrives (never the run, too late).
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route(/\/finale\/.*\.webp$/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 4500));
      await route.continue();
    });
    const page = await context.newPage();
    await page.goto(`${base}?debug&reset&intro=off&found=9#build`);
    await ready(page);
    const t0 = await page.evaluate(() => performance.now());
    await page.locator('.hj-shroom').first().click();
    const samples = [];
    for (const wait of [1000, 2500, 3500, 6000, 9000]) {
      await page.waitForFunction((at) => performance.now() >= at, t0 + wait, { polling: 50 });
      const s = await state(page);
      samples.push(`${wait}ms: ${s.phase}/${s.covers ? 'finale' : 'routine'}`);
    }
    results.rules['not-ready-build'] = { samples, ...(await state(page)) };
    await context.close();
  }
  for (const [k, v] of Object.entries(results.rules)) console.log(k, JSON.stringify(v));
  await browser.close();
  await save();
}

if (what === 'network' || what === 'all') await network();
if (what === 'record' || what === 'all') await record();
if (what === 'rules' || what === 'all') await rules();

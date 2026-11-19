// Evidence for Wren's review 01. Needs `npm run dev` (5173) and, for item 3, `npm run build && npm run preview` (4173).
//   node qa/tools/review01.mjs flags     item 3: ?found=10 on dev vs production
import { chromium } from 'playwright';
import sharp from 'sharp';

const item = process.argv[2];
const browser = await chromium.launch();

async function shot(url, viewport, wait, settle = 1500) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await wait(page);
  await page.waitForTimeout(settle);
  const png = await page.screenshot();
  const info = await page.evaluate(() => ({
    counter: document.querySelector('.hj-pin')?.textContent?.replace(/\s+/g, ' ').trim(),
    action: !document.querySelector('.hj-pin-action')?.hidden,
  }));
  await page.close();
  return { png, info, errors };
}

async function sideBySide(out, a, b, labels) {
  const meta = await sharp(a).metadata();
  const label = (text) =>
    Buffer.from(`<svg width="${meta.width}" height="44"><rect width="100%" height="100%" fill="#111"/><text x="16" y="30" font-family="sans-serif" font-size="22" fill="#fff">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
  const col = (img, text) =>
    sharp({ create: { width: meta.width, height: meta.height + 44, channels: 3, background: '#111' } })
      .composite([{ input: label(text), top: 0, left: 0 }, { input: img, top: 44, left: 0 }])
      .png()
      .toBuffer();
  const [ca, cb] = await Promise.all([col(a, labels[0]), col(b, labels[1])]);
  await sharp({ create: { width: meta.width * 2 + 8, height: meta.height + 44, channels: 3, background: '#444' } })
    .composite([{ input: ca, top: 0, left: 0 }, { input: cb, top: 0, left: meta.width + 8 }])
    .jpeg({ quality: 80 })
    .toFile(out);
}

if (item === 'flags') {
  const viewport = { width: 1280, height: 760 };
  const wait = (page) => page.waitForSelector('.hj-pin');
  const dev = await shot('http://localhost:5173/?intro=off&found=10', viewport, wait, 2500);
  const prod = await shot('http://localhost:4173/?intro=off&found=10&debug', viewport, wait, 11000);
  const prodDebug = await (async () => {
    const page = await browser.newPage({ viewport });
    await page.goto('http://localhost:4173/?debug');
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => ({ hj: typeof window.__hj, debugOutline: !!document.querySelector('.is-debug') }));
    await page.close();
    return r;
  })();
  await sideBySide('qa/review-01/03-flags-dev-vs-prod.jpg', dev.png, prod.png, ['npm run dev  ?intro=off&found=10', 'production build  ?intro=off&found=10&debug']);
  console.log(JSON.stringify({ dev: dev.info, prod: prod.info, prodDebug, errors: [...dev.errors, ...prod.errors] }, null, 1));
}

if (item === 'hint') {
  // ?hint=2: the wiggle is due 2 s after the intro. Watch 16 s; once per visit means exactly one wiggle.
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.goto('http://localhost:5173/?intro=off&hint=2&seed=1');
  await page.waitForFunction(() => document.querySelectorAll('.hj-shroom-art').length > 0);
  const t0 = Date.now();
  await page.evaluate(() => {
    window.__wiggles = [];
    const start = performance.now();
    new MutationObserver((list) => {
      for (const m of list) {
        const el = m.target;
        if (!/rotate/.test(el.style.transform) || el.dataset.seen) continue;
        el.dataset.seen = '1';
        window.__wiggles.push({ spot: el.closest('.hj-shroom').dataset.spot, atS: +((performance.now() - start) / 1000).toFixed(1) });
        setTimeout(() => delete el.dataset.seen, 1000);
      }
    }).observe(document.querySelector('.hj-mushrooms'), { subtree: true, attributes: true, attributeFilter: ['style'] });
  });
  let caught = null;
  while (Date.now() - t0 < 16000) {
    const w = await page.evaluate(() => window.__wiggles.length);
    if (w && !caught) {
      const spot = await page.evaluate(() => window.__wiggles[0].spot);
      caught = await page.locator(`.hj-shroom[data-spot="${spot}"]`).boundingBox();
      await page.screenshot({ path: '/tmp/hint-full.png' });
    }
    await page.waitForTimeout(100);
  }
  const wiggles = await page.evaluate(() => window.__wiggles);
  await page.close();
  const pad = 60;
  const left = Math.max(0, Math.round(caught.x - pad));
  const top = Math.max(0, Math.round(caught.y - pad));
  const crop = { left, top, width: Math.min(1280 - left, Math.round(caught.width + pad * 2)), height: Math.min(760 - top, Math.round(caught.height + pad * 2)) };
  const zoom = await sharp('/tmp/hint-full.png').extract(crop).resize({ width: crop.width * 3, kernel: 'nearest' }).toBuffer();
  const zm = await sharp(zoom).metadata();
  const banner = Buffer.from(`<svg width="1280" height="60"><rect width="100%" height="100%" fill="#111"/><text x="16" y="38" font-family="sans-serif" font-size="22" fill="#fff">?hint=2, watched 16 s with no find: ${wiggles.length} wiggle(s) ${wiggles.map((w) => `[${w.spot} @ ${w.atS}s]`).join(' ')}</text></svg>`);
  await sharp('/tmp/hint-full.png')
    .extend({ top: 60, background: '#111' })
    .composite([{ input: banner, top: 0, left: 0 }, { input: zoom, top: 760 + 60 - zm.height - 10, left: 10 }])
    .jpeg({ quality: 80 })
    .toFile('qa/review-01/05-hint-once.jpg');
  console.log(JSON.stringify({ wiggles }, null, 1));
}

if (item === 'wink') {
  // One find on desktop Chromium and on an iPhone in WebKit; the pose log shows each reaction frame and how long it held.
  const { webkit, devices } = await import('playwright');
  const runs = [
    { name: 'desktop-chromium', browser, context: { viewport: { width: 1280, height: 760 } } },
    { name: 'iphone-webkit', browser: await webkit.launch(), context: { ...devices['iPhone 13'] } },
  ];
  const results = {};
  for (const run of runs) {
    const context = await run.browser.newContext(run.context);
    const page = await context.newPage();
    await page.goto('http://localhost:5173/?reset&intro=off&debug&seed=3');
    await page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 30000 });
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      window.__hj.poses.length = 0;
      const shrooms = [...document.querySelectorAll('.hj-shroom')];
      const vp = document.querySelector('.hj-viewport').getBoundingClientRect();
      const visible = shrooms.find((b) => { const r = b.getBoundingClientRect(); return r.left > vp.left && r.right < vp.right; });
      visible.click();
    });
    let shot = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 4000) {
      const last = await page.evaluate(() => window.__hj.poses.at(-1)?.[0]);
      if (!shot && last === 'reaction/rx_wink.png') {
        await page.waitForTimeout(90);
        const box = await page.locator('.hj-rachel').boundingBox();
        shot = { png: await page.screenshot({ clip: box }), dpr: run.context.deviceScaleFactor ?? 1 };
      }
      await page.waitForTimeout(15);
    }
    const poses = await page.evaluate(() => window.__hj.poses);
    const rx = poses.filter(([p]) => p.startsWith('reaction/'));
    const held = rx.map(([p, at], i) => [p.replace('reaction/', ''), rx[i + 1] ? rx[i + 1][1] - at : null]);
    results[run.name] = { held, shot };
    await context.close();
  }
  await runs[1].browser.close();
  const tiles = await Promise.all(
    Object.entries(results).map(async ([name, r]) => {
      const img = await sharp(r.shot.png).resize({ height: 520 }).toBuffer();
      const m = await sharp(img).metadata();
      const label = Buffer.from(`<svg width="${m.width}" height="40"><rect width="100%" height="100%" fill="#111"/><text x="10" y="27" font-family="sans-serif" font-size="20" fill="#fff">${name}: rx_wink</text></svg>`);
      return sharp(img).extend({ top: 40, background: '#111' }).composite([{ input: label, top: 0, left: 0 }]).png().toBuffer();
    }),
  );
  const metas = await Promise.all(tiles.map((t) => sharp(t).metadata()));
  await sharp({ create: { width: metas[0].width + metas[1].width + 8, height: 560, channels: 3, background: '#444' } })
    .composite([{ input: tiles[0], left: 0, top: 0 }, { input: tiles[1], left: metas[0].width + 8, top: 0 }])
    .jpeg({ quality: 85 })
    .toFile('qa/review-01/01-wink.jpg');
  for (const r of Object.values(results)) delete r.shot;
  console.log(JSON.stringify(results));
}

if (item === 'ladder') {
  // Before: the ladder-foot tile of the milestone-3 spots sheet. After: the same close-up now, at 2x.
  const sheet = await sharp('qa/m3/spots.jpg').metadata();
  const tw = sheet.width / 4, th = sheet.height / 3;
  const before = await sharp('qa/m3/spots.jpg').extract({ left: Math.round(tw * 3), top: Math.round(th), width: Math.round(tw), height: Math.round(th) }).resize(480, 360).toBuffer();
  const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:5173/?debug&reset&intro=off');
  await page.waitForFunction(() => window.__hj);
  await page.evaluate(() => { window.__hj.player.stop(); window.__hj.rachel.show('frame_01'); document.querySelector('.hj-mushrooms').classList.remove('is-debug'); });
  await page.waitForTimeout(300);
  const b = await page.locator('.hj-shroom[data-spot="ladder-foot"]').boundingBox();
  // Framed on the old spot (plate x 1298), so before and after line up.
  const after = await sharp(await page.screenshot({ clip: { x: 1298 - 120, y: b.y + b.height / 2 - 90, width: 240, height: 180 } })).resize(480, 360).toBuffer();
  const wide = await page.screenshot({ clip: { x: 1060, y: 560, width: 560, height: 381 } });
  await page.close();
  const tile = (img, text) => sharp(img).extend({ top: 40, background: '#111' }).composite([{ input: Buffer.from(`<svg width="480" height="40"><rect width="100%" height="100%" fill="#111"/><text x="10" y="27" font-family="sans-serif" font-size="20" fill="#fff">${text}</text></svg>`), top: 0, left: 0 }]).png().toBuffer();
  const wideT = await sharp(wide).resize({ height: 400 }).toBuffer();
  const wm = await sharp(wideT).metadata();
  await sharp({ create: { width: 480 * 2 + wm.width + 16, height: 400, channels: 3, background: '#444' } })
    .composite([{ input: await tile(before, 'before: drawing 5 (reads as a nail)'), left: 0, top: 0 }, { input: await tile(after, 'after: drawing 7, 14 px right, same size'), left: 488, top: 0 }, { input: wideT, left: 976, top: 0 }])
    .jpeg({ quality: 85 })
    .toFile('qa/review-01/06-ladder-foot.jpg');
}

if (item === 'dedupe') {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const requests = [];
  page.on('request', (r) => { const u = new URL(r.url()).pathname; if (u.includes('/rachel/')) requests.push(u.replace('/assets/scene1/', '')); });
  await page.goto('http://localhost:5173/?reset&intro=off&debug&seed=3');
  await page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 30000 });
  const onLoad = [...requests];
  const checks = await page.evaluate(async () => {
    // The very module instance the scene uses, so its frame cache is the one under test.
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => new URL(n).pathname === '/src/scene1/assets.ts');
    const { loadFrame, asset } = await import(url);
    const frames = window.__hj.rachel.frames;
    const k1 = frames.get('reaction/rx_K1.png');
    const k2 = frames.get('reaction/rx_K2.png');
    return {
      rx_K1_is_rachel_K1: k1 === (await loadFrame(asset('rachel/K1.webp'))),
      rx_K2_is_rachel_K2: k2 === (await loadFrame(asset('rachel/K2.webp'))),
      rx_frame_01_would_be_loop_frame_01: (await loadFrame(asset('rachel/frame_01.webp'))) === frames.get('frame_01'),
    };
  });
  const before = requests.length;
  requests.length = 0;
  requests.push(...onLoad);
  await page.evaluate(() => { window.__hj.poses.length = 0; document.querySelector('.hj-shroom').click(); });
  await page.waitForTimeout(3500);
  const played = await page.evaluate(() => window.__hj.poses.filter(([p]) => p.startsWith('reaction/')).map(([p]) => p.replace('reaction/', '')));
  const counts = requests.reduce((m, u) => ((m[u] = (m[u] || 0) + 1), m), {});
  const result = { requests: requests.length, fetchedTwice: Object.keys(counts).filter((u) => counts[u] > 1), requestsByCheck: before - onLoad.length, checks, reactionPoses: played.length, includesK1K2: played.includes('rx_K1.png') && played.includes('rx_K2.png') };
  const lines = [
    'Review 01 item 2: duplicate frames load once',
    '',
    ...Object.entries(counts).map(([u, n]) => `${n}x  ${u}`),
    '',
    ...Object.entries(checks).map(([k, v]) => `${v ? 'PASS' : 'FAIL'}  ${k}`),
    `${result.fetchedTwice.length === 0 ? 'PASS' : 'FAIL'}  no file fetched twice`,
    `${result.includesK1K2 ? 'PASS' : 'FAIL'}  one find played ${played.length} reaction poses, K1 and K2 included`,
  ];
  await page.setContent(`<pre style="font:15px/1.45 monospace;margin:20px">${lines.join('\n')}</pre>`);
  await page.screenshot({ path: 'qa/review-01/02-dedupe.png', fullPage: true });
  await page.close();
  console.log(JSON.stringify(result, null, 1));
}

await browser.close();

// Evidence for Wren's review 02. Frame timing for item 1 is qa/tools/intro-frames.mjs; this makes the screenshots.
//   node qa/tools/review02.mjs intro <before-url> <after-url>   item 1: the same seeded intro, old and new code
import { webkit, devices } from 'playwright';
import sharp from 'sharp';

const item = process.argv[2];

const label = (text, width) =>
  Buffer.from(
    `<svg width="${width}" height="44"><rect width="100%" height="100%" fill="#111"/><text x="16" y="30" font-family="sans-serif" font-size="22" fill="#fff">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`,
  );

/** Images in a grid, each with a caption above it. `rows` is an array of rows of { png, text }. */
async function grid(out, rows) {
  const meta = await sharp(rows[0][0].png).metadata();
  const cellW = meta.width;
  const cellH = meta.height + 44;
  const cols = Math.max(...rows.map((r) => r.length));
  const composites = [];
  rows.forEach((row, y) =>
    row.forEach(({ png, text }, x) => {
      composites.push({ input: label(text, cellW), top: y * (cellH + 8), left: x * (cellW + 8) });
      composites.push({ input: png, top: y * (cellH + 8) + 44, left: x * (cellW + 8) });
    }),
  );
  await sharp({ create: { width: cols * (cellW + 8) - 8, height: rows.length * (cellH + 8) - 8, channels: 3, background: '#444' } })
    .composite(composites)
    .jpeg({ quality: 82 })
    .toFile(out);
}

if (item === 'load') {
  // Item 2: when the room request starts and when the brush starts, on cold loads of production builds.
  //   node qa/tools/review02.mjs load <before-url> <after-url> [runs=3] [latency-ms=0]
  const [before, after] = process.argv.slice(3, 5);
  const runs = Number(process.argv[5] ?? 3);
  const latency = Number(process.argv[6] ?? 0);
  const measure = async (url) => {
    const browser = await webkit.launch();
    const context = await browser.newContext({ ...devices['iPhone 13'] });
    if (latency) await context.route('**/*', async (route) => {
      await new Promise((r) => setTimeout(r, latency));
      await route.continue();
    });
    await context.addInitScript(() => {
      new MutationObserver((list) => {
        for (const m of list) for (const n of m.addedNodes) if (n.classList?.contains('hj-paint')) window.__brush = performance.now();
      }).observe(document, { childList: true, subtree: true });
    });
    const page = await context.newPage();
    let roomRequests = 0;
    page.on('request', (r) => r.url().includes('room.webp') && roomRequests++);
    await page.goto(url);
    await page.waitForFunction(() => window.__brush > 0, null, { timeout: 60000 });
    const r = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource');
      const room = entries.find((e) => e.name.includes('room.webp'));
      const script = entries.find((e) => /\/assets\/index-.*\.js/.test(e.name));
      return {
        scriptStart: Math.round(script.startTime),
        roomStart: Math.round(room.startTime),
        roomEnd: Math.round(room.responseEnd),
        brush: Math.round(window.__brush),
      };
    });
    await browser.close();
    return { ...r, roomRequests };
  };
  const out = { latency, before: [], after: [] };
  for (let i = 0; i < runs; i++) {
    out.before.push(await measure(before));
    out.after.push(await measure(after));
  }
  for (const k of ['before', 'after']) for (const r of out[k]) console.log(k.padEnd(7), JSON.stringify(r));
  const keep = process.argv[7];
  if (keep) {
    const fs = await import('node:fs');
    fs.writeFileSync(keep, `${JSON.stringify(out)}\n`, { flag: 'a' });
  }
}

if (item === 'load-chart') {
  // Item 2's screenshot: the median run of each recorded setting as a timeline, before above after.
  const fs = await import('node:fs');
  const sets = fs.readFileSync(process.argv[3], 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const W = 1100;
  const scale = (W - 260) / Math.max(...sets.flatMap((s) => [...s.before, ...s.after].map((r) => r.brush))) * 0.95;
  let y = 20;
  let body = '';
  const bar = (x0, x1, colour, text) => {
    body += `<rect x="${240 + x0 * scale}" y="${y}" width="${Math.max(2, (x1 - x0) * scale)}" height="18" fill="${colour}"/>`;
    body += `<text x="${246 + x1 * scale}" y="${y + 14}" font-size="13" fill="#ddd" font-family="sans-serif">${text}</text>`;
  };
  for (const set of sets) {
    body += `<text x="16" y="${y + 14}" font-size="15" fill="#fff" font-family="sans-serif" font-weight="bold">${set.latency ? `+${set.latency} ms per request` : 'localhost, no added delay'}</text>`;
    y += 28;
    for (const k of ['before', 'after']) {
      const median = (key) => set[k].map((run) => run[key]).sort((a, b) => a - b)[Math.floor(set[k].length / 2)];
      const r = { roomStart: median('roomStart'), roomEnd: median('roomEnd'), brush: median('brush') };
      body += `<text x="32" y="${y + 14}" font-size="14" fill="#ccc" font-family="sans-serif">${k}: room request</text>`;
      bar(r.roomStart, r.roomEnd, k === 'before' ? '#b4573a' : '#5aa05a', `${r.roomStart}–${r.roomEnd} ms`);
      y += 24;
      body += `<text x="32" y="${y + 14}" font-size="14" fill="#ccc" font-family="sans-serif">${k}: brush starts</text>`;
      bar(r.brush, r.brush + 4, '#e8c060', `${r.brush} ms`);
      y += 30;
    }
    y += 10;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y + 10}"><rect width="100%" height="100%" fill="#1d120b"/>${body}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile('qa/review-02/02-room-load-timeline.png');
}

if (item === 'sprites') {
  // Item 3: the largest mushroom and the logo at their largest (2560 × 1440, 2× pixels), old files and new.
  //   node qa/tools/review02.mjs sprites <before-url> <after-url>
  const [before, after] = process.argv.slice(3, 5);
  const browser = await webkit.launch();
  const capture = async (url) => {
    const context = await browser.newContext({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector('.hj-note.is-on'), null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    const box = async (selector, pad) => {
      const b = await page.locator(selector).boundingBox();
      return { x: b.x - pad, y: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2 };
    };
    const shroom = await page.screenshot({ clip: await box('.hj-shroom[data-spot="tiles"]', 30) });
    const logo = await page.screenshot({ clip: await box('.hj-logo', 12) });
    await context.close();
    return { shroom, logo };
  };
  const a = await capture(before);
  const b = await capture(after);
  const zoom = (png, k) => sharp(png).metadata().then((m) => sharp(png).resize({ width: m.width * k, kernel: 'nearest' }).png().toBuffer());
  await grid('qa/review-02/03-sprites-before-after.jpg', [
    [
      { png: await zoom(a.shroom, 3), text: 'before: mushroom' },
      { png: await zoom(b.shroom, 3), text: 'after: mushroom' },
    ],
  ]);
  const logos = '/tmp/review02-logos.jpg';
  await grid(logos, [
    [
      { png: a.logo, text: 'before: logo' },
      { png: b.logo, text: 'after: logo' },
    ],
  ]);
  // One image for the report: mushrooms (3× zoom) above, logos (1:1 device pixels) below.
  const top = await sharp('qa/review-02/03-sprites-before-after.jpg').toBuffer();
  const bottom = await sharp(logos).toBuffer();
  const [mt, mb] = await Promise.all([sharp(top).metadata(), sharp(bottom).metadata()]);
  await sharp({ create: { width: Math.max(mt.width, mb.width), height: mt.height + mb.height + 8, channels: 3, background: '#444' } })
    .composite([{ input: top, top: 0, left: 0 }, { input: bottom, top: mt.height + 8, left: 0 }])
    .jpeg({ quality: 85 })
    .toFile('qa/review-02/03-sprites-before-after.jpg');
  await browser.close();
}

if (item === 'intro') {
  const [before, after] = process.argv.slice(3);
  const browser = await webkit.launch();
  const capture = async (base) => {
    const context = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await context.newPage();
    await page.goto(`${base}?reset&intro=full&seed=7&debug`);
    await page.waitForFunction(() => window.__hj?.marks?.introStart > 0, null, { timeout: 30000 });
    const start = await page.evaluate(() => window.__hj.marks.introStart);
    const at = async (ms) => {
      await page.waitForFunction((t) => performance.now() >= t, start + ms, { polling: 'raf' });
      return page.screenshot();
    };
    const wash = await at(2100);
    await page.waitForFunction(() => window.__hj.marks.introEnd > 0);
    await page.waitForTimeout(1500);
    const settled = await page.screenshot();
    // A resize hands the room over to the <img>; the scene must look the same afterwards.
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(400);
    await page.setViewportSize(devices['iPhone 13'].viewport);
    await page.waitForTimeout(800);
    const state = await page.evaluate(() => ({
      canvas: !!document.querySelector('.hj-paint'),
      roomOpacity: getComputedStyle(document.querySelector('.hj-room')).opacity,
    }));
    const resized = await page.screenshot();
    await context.close();
    return { wash, settled, resized, state };
  };
  const a = await capture(before);
  const b = await capture(after);
  // Rachel hammers and the logo glints, so compare only the room's own region, left of Rachel.
  const diff = async (x, y) => {
    const crop = { left: 0, top: 160, width: 150, height: 400 };
    const [pa, pb] = await Promise.all([x, y].map((png) => sharp(png).extract(crop).raw().toBuffer()));
    let sum = 0;
    for (let i = 0; i < pa.length; i++) sum += Math.abs(pa[i] - pb[i]);
    return (sum / pa.length).toFixed(2);
  };
  const settledDiff = await diff(a.settled, b.settled);
  const resizedDiff = await diff(a.resized, b.resized);
  await grid('qa/review-02/01-intro-before-after.jpg', [
    [
      { png: a.wash, text: 'before: wash, 2.1 s' },
      { png: b.wash, text: 'after: wash, 2.1 s' },
    ],
    [
      { png: a.settled, text: 'before: settled' },
      { png: b.settled, text: `after: settled (diff ${settledDiff}/255)` },
    ],
  ]);
  console.log(JSON.stringify({ settledDiff, afterResizeDiff: resizedDiff, before: a.state, after: b.state }, null, 1));
  await browser.close();
}

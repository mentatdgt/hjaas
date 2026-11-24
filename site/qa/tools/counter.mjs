// The two-mushroom counter and the phone view (reviews/hunt-counter-build.md). Results go to qa/counter/.
// Needs `npm run dev` (HJ_URL for another address); `trace` and `webkit` need the production build served
// (`npm run build && npm run preview`, HJ_PROD, default 4173).
//
//   node qa/tools/counter.mjs record [name]  60 fps recordings: find, complete, unlock, return × desktop, portrait, landscape; reduced motion; the drift
//   node qa/tools/counter.mjs timing         when each part starts and ends after a landing, read from the page
//   node qa/tools/counter.mjs states         counters, dots, Next and button against the saved finds; return visits; hint; drift; reduced motion
//   node qa/tools/counter.mjs phone          each scene's opening frame on three phones, and the two landscape phones; what is where
//   node qa/tools/counter.mjs hunt           the whole hunt in one visit, by tapping each drawing, with Next between scenes, on three devices
//   node qa/tools/counter.mjs trace          Chrome traces of a find and of the unlock: phone, processor slowed four times, production build
//   node qa/tools/counter.mjs webkit         a find, a finished scene and the unlock in WebKit (iPhone profile), production build
import { chromium, webkit, devices } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';

const base = process.env.HJ_URL ?? 'http://localhost:5173/';
const prod = process.env.HJ_PROD ?? 'http://localhost:4173/';
const out = new URL('../counter/', import.meta.url).pathname;
const tmp = new URL('../../node_modules/.hj/film/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const IDS = ['build', 'grow', 'design', 'film', 'set'];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const say = (label, value) => console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
const save = (name, data) => writeFile(`${out}${name}`, `${JSON.stringify(data, null, 1)}\n`);
const r1 = (n) => Math.round(n * 10) / 10;
const errorsOf = (page) => {
  const errors = [];
  // (A bare file opened to begin a recording on has no icon of its own.)
  page.on('console', (m) => m.type() === 'error' && !m.location().url.endsWith('/favicon.ico') && errors.push(m.text().slice(0, 200)));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
};
const ready = (page) => page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 60000 });
const ONLY = process.argv[3];
const run = {};

const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  portrait: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  landscape: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
/** The site's own spots, scene by scene. */
const spotsOf = async (page) => page.evaluate(async () => Object.fromEntries((await import('/src/scenes/index.ts')).SCENES.map((s) => [s.id, s.spots.map((x) => x.id)])));
let SPOTS;
const allSpots = async () => {
  if (SPOTS) return SPOTS;
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  await page.goto(`${base}?intro=off`);
  SPOTS = await spotsOf(page);
  await browser.close();
  return SPOTS;
};
/** Saved progress as the site keeps it: the first `n` finds of the site, scene by scene, every scene seen. */
const saved = async (n, extra = {}) => {
  let left = n;
  const scenes = {};
  for (const [id, spots] of Object.entries(await allSpots())) {
    scenes[id] = { found: spots.slice(0, Math.max(0, left)), seen: true, panX: null };
    left -= spots.length;
  }
  return JSON.stringify({ scenes, unlocked: false, panned: true, ...extra });
};
/** A page that opens with that progress saved (once: a reload keeps what the page itself saved). */
const withSaved = async (context, json) => context.addInitScript((value) => {
  if (location.protocol !== 'http:') return;
  if (!sessionStorage.getItem('qa')) { sessionStorage.setItem('qa', '1'); localStorage.setItem('hjaas:site:v2', value); }
}, json);

/** Bring the next unfound mushroom that keeps clear of the window's ends into view, and say where it is. */
const nextShroom = async (page) => {
  const at = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('.hj-shroom')];
    const view = document.querySelector('.hj-viewport');
    const of = (b) => { const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; };
    const mid = view.getBoundingClientRect().left + view.clientWidth / 2;
    const pick = buttons.sort((a, b) => Math.abs(of(a).x - mid) - Math.abs(of(b).x - mid))[0];
    const v = view.getBoundingClientRect();
    const b = of(pick);
    if (b.x < v.left + 30 || b.x > v.right - 30) view.scrollLeft += b.x - mid;
    return pick.dataset.spot;
  });
  await wait(700);
  return page.evaluate((id) => { const r = document.querySelector(`.hj-shroom[data-spot="${id}"]`).getBoundingClientRect(); return { id, x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, at);
};
const press = (page, at, touch) => (touch ? page.touchscreen.tap(at.x, at.y) : page.mouse.click(at.x, at.y));

// ---- Recordings: Chrome's own screencast, each frame with its time (the method of scene 5, round 2). ---------
const filmOf = async (context, page, dir) => {
  await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  const cdp = await context.newCDPSession(page);
  const frames = []; const writes = [];
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = `${dir}${String(frames.length).padStart(5, '0')}.jpg`;
    frames.push({ at: metadata.timestamp * 1000, file }); writes.push(writeFile(file, Buffer.from(data, 'base64')));
    void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  return { frames, start: () => cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 1 }), stop: async () => { await cdp.send('Page.stopScreencast'); await Promise.all(writes); } };
};
const toMp4 = async (frames, list, mp4) => {
  await writeFile(list, `ffconcat version 1.0\n${frames.map((f, i) => `file '${f.file}'\nduration ${(((frames[i + 1]?.at ?? f.at + 16.7) - f.at) / 1000).toFixed(6)}`).join('\n')}\n`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=60,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-movflags', '+faststart', mp4]);
};
const SCENARIOS = {
  find: { n: 16, hash: 'grow', after: 2600 },
  complete: { n: 19, hash: 'grow', after: 3000 },
  unlock: { n: 49, hash: 'set', after: 4800 },
};
run.record = async () => {
  const report = JSON.parse(await readFile(`${out}record.json`, 'utf8').catch(() => '{}'));
  const jobs = [];
  for (const device of Object.keys(DEVICES)) for (const name of [...Object.keys(SCENARIOS), 'return']) jobs.push({ name, device, reduced: false });
  for (const name of Object.keys(SCENARIOS)) jobs.push({ name, device: 'desktop', reduced: true });
  jobs.push({ name: 'drift', device: 'portrait', reduced: false });
  for (const { name, device, reduced } of jobs) {
    const title = `${name}-${device}${reduced ? '-reduced' : ''}`;
    if (ONLY && !title.includes(ONLY)) continue;
    const browser = await chromium.launch({ channel: 'chrome' });
    const context = await browser.newContext({ ...DEVICES[device], reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    const errors = errorsOf(page);
    const dir = `${tmp}${title}/`;
    const film = await filmOf(context, page, dir);
    if (name === 'return') {
      // A real return visit: all 50 saved, every scene seen, no flags but the one that exposes the page's state.
      await withSaved(context, await saved(50));
      await page.goto(`${base}robots.txt`); await wait(300); await film.start();
      await page.goto(`${base}#set`); await wait(3500);
      await film.stop();
    } else if (name === 'drift') {
      await page.goto(`${base}robots.txt`); await wait(300); await film.start();
      await page.goto(`${base}?reset&seed=7#build`); await wait(10500);
      await film.stop();
    } else {
      const s = SCENARIOS[name];
      await page.goto(`${base}?debug&reset&intro=off&seed=7&all=${s.n}#${s.hash}`); await ready(page);
      await page.addStyleTag({ content: '.hj-mushrooms.is-debug .hj-shroom { outline: none !important; background: none !important; }' });
      await wait(600);
      const at = await nextShroom(page);
      const touch = device !== 'desktop';
      await film.start(); await wait(500);
      await press(page, at, touch);
      await wait(s.after);
      await film.stop();
    }
    // Chrome sends a frame only when something has changed, so the gaps are counted where something moves:
    // the flight and the rolls, the glints, the cross-fade (ms from the landing).
    const landed = await page.evaluate(() => { const l = performance.getEntriesByName('hj-land').at(-1); return l ? performance.timeOrigin + l.startTime : null; });
    const paint = await page.evaluate(() => { const l = performance.getEntriesByName('hj-paint').at(-1); return l ? performance.timeOrigin + l.startTime : null; });
    const moves = name === 'drift' ? [[5700, 7700]] : reduced || name === 'return' ? [] : [[-380, 330], ...(name === 'find' ? [] : [[480, 1300]]), ...(name === 'unlock' ? [[930, 1750], [2040, 2380]] : [])];
    const from = name === 'drift' ? paint : landed;
    const gaps = film.frames.slice(1).map((f, i) => ({ at: film.frames[i].at - from, ms: f.at - film.frames[i].at })).filter((g) => moves.some(([a, b]) => g.at >= a && g.at + g.ms <= b + 40));
    await toMp4(film.frames, `${dir}list.txt`, `${out}${title}-60fps.mp4`);
    report[title] = { frames: film.frames.length, seconds: r1((film.frames.at(-1).at - film.frames[0].at) / 1000), movingFrames: gaps.length, longestGapWhileMovingMs: gaps.length ? r1(Math.max(...gaps.map((g) => g.ms))) : null, gapsOver34: gaps.filter((g) => g.ms > 34).map((g) => [Math.round(g.at), Math.round(g.ms)]), errors };
    say(title, report[title]);
    await browser.close();
    await save('record.json', report);
    await strip(title, film.frames, landed);
  }
};
/** A strip of the caption (and, on a computer, of the tabs) every so often after the press. */
const strip = async (title, frames, landed) => {
  const every = title.startsWith('drift') || title.startsWith('return') ? null : 150;
  if (!every) return;
  const t0 = landed - 150; const meta = await sharp(frames[0].file).metadata();
  const desktop = title.includes('desktop'); const land = title.includes('landscape');
  const k = meta.width / (desktop ? 1440 : land ? 844 : 390);
  const box = desktop ? [196, 724, 420, 84] : land ? [14, 318, 380, 70] : [14, 674, 362, 76];
  const crop = { left: Math.round(box[0] * k), top: Math.round(box[1] * k), width: Math.round(box[2] * k), height: Math.round(box[3] * k) };
  const n = Math.floor((frames.at(-1).at - t0) / every); const cols = 4;
  const W = 420; const H = Math.round((W * box[3]) / box[2]);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const f = frames.findLast((x) => x.at <= t0 + i * every) ?? frames[0];
    const cell = await sharp(f.file).extract(crop).resize(W, H).toBuffer();
    parts.push({ input: cell, left: (i % cols) * (W + 10), top: Math.floor(i / cols) * (H + 22) + 18 });
    parts.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="18"><text x="2" y="13" font-family="Helvetica" font-size="12" fill="#302e29">${i * every - 150} ms</text></svg>`), left: (i % cols) * (W + 10), top: Math.floor(i / cols) * (H + 22) });
  }
  await sharp({ create: { width: cols * (W + 10), height: Math.ceil(n / cols) * (H + 22) + 10, channels: 3, background: '#ffffff' } }).composite(parts).jpeg({ quality: 88 }).toFile(`${out}strip-${title}.jpg`);
};

// ---- When everything happens, read from the page every frame after a landing. --------------------------------
const PROBE = () => {
  const log = []; window.__log = log;
  const caption = window.__hj.caption; const land = caption.land.bind(caption);
  caption.land = (view) => { window.__landed = performance.now(); land(view); };
  const q = (s) => document.querySelector(s);
  const alpha = (el) => (el ? Number(getComputedStyle(el).opacity) : null);
  const ty = (el) => (el ? new DOMMatrix(getComputedStyle(el).transform).f : null);
  const tx = (el) => (el ? new DOMMatrix(getComputedStyle(el).transform).e : null);
  const sy = (el) => new DOMMatrix(getComputedStyle(el).transform).d;
  const tick = () => {
    if (window.__landed) {
      const row = {};
      for (const k of ['cream', 'red']) {
        const r = q(`.hj-row.is-${k}`); const old = r.querySelector('.hj-num-old');
        row[k] = { n: r.querySelector('.hj-num-now').textContent, inA: alpha(r.querySelector('.hj-num-now')), inY: ty(r.querySelector('.hj-num-now')), oldA: alpha(old) > 0 ? alpha(old) : null, oldY: alpha(old) > 0 ? ty(old) : null, label: r.querySelector('.hj-label').textContent, stem: 1 - sy(r.querySelector('[data-part=stem]')), cap: 1 - sy(r.querySelector('[data-part=cap]')), glintA: alpha(r.querySelector('.hj-m-glint')), glintX: tx(r.querySelector('.hj-m-glint')) };
      }
      const tab = q('.hj-tab[aria-current] .hj-tab-dot'); const next = q('.hj-next'); const c = q('.hj-counter'); const p = q('.hj-prize');
      log.push({ t: performance.now() - window.__landed, ...row, dot: alpha(tab), next: next.classList.contains('is-off') ? 0 : alpha(next), counter: getComputedStyle(c).visibility === 'hidden' ? 0 : alpha(c), counterY: ty(c), prize: getComputedStyle(p).visibility === 'hidden' ? 0 : alpha(p), prizeY: ty(p) });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
run.timing = async () => {
  const report = {};
  for (const reduced of [false, true]) for (const [name, s] of Object.entries(SCENARIOS)) {
    const browser = await chromium.launch({ channel: 'chrome' });
    const context = await browser.newContext({ ...DEVICES.desktop, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    await page.goto(`${base}?debug&reset&intro=off&seed=7&all=${s.n}#${s.hash}`); await ready(page); await wait(400);
    await page.evaluate(PROBE);
    const at = await nextShroom(page); await press(page, at, false); await wait(s.after + 600);
    const log = await page.evaluate(() => window.__log);
    const first = (f) => { const x = log.find(f); return x ? Math.round(x.t) : null; };
    const last = (f) => { const x = log.findLast(f); return x ? Math.round(x.t) : null; };
    const row = (k) => ({
      oldNumberOnScreen: [first((l) => l[k].oldA !== null), last((l) => l[k].oldA !== null)], oldRisesTo: r1(Math.min(0, ...log.map((l) => l[k].oldY ?? 0))),
      newNumberMoves: [first((l) => l[k].inY > 0.05), last((l) => l[k].inY > 0.05)], newComesFrom: r1(Math.max(0, ...log.map((l) => l[k].inY ?? 0))),
      numberBecomes: log.at(-1)[k].n, fillMoves: (() => { const f = log.filter((l, i) => i && (Math.abs(l[k].cap - log[i - 1][k].cap) > 0.0005 || Math.abs(l[k].stem - log[i - 1][k].stem) > 0.0005)); return f.length ? [Math.round(f[0].t), Math.round(f.at(-1).t)] : null; })(),
      fillEnds: { stem: r1(log.at(-1)[k].stem * 1000) / 1000, cap: r1(log.at(-1)[k].cap * 1000) / 1000 },
      labels: log.reduce((a, l) => (a.at(-1)?.[1] === l[k].label ? a : [...a, [Math.round(l.t), l[k].label]]), []), glint: [first((l) => l[k].glintA > 0), last((l) => l[k].glintA > 0)],
    });
    report[`${name}${reduced ? ' (reduced motion)' : ''}`] = {
      cream: row('cream'), red: row('red'), tabDot: { appears: first((l) => l.dot > 0), whole: first((l) => l.dot >= 0.999) }, next: { appears: first((l) => l.next > 0), whole: first((l) => l.next >= 0.999) },
      crossfade: { from: first((l) => l.prize > 0), buttonWhole: first((l) => l.prize >= 0.999), counterGone: last((l) => l.counter > 0), counterRisesTo: r1(Math.min(...log.map((l) => l.counterY))), buttonComesFrom: r1(Math.max(...log.map((l) => l.prizeY))) },
      longestFrameMs: r1(Math.max(...log.slice(1).map((l, i) => l.t - log[i].t))), focused: await page.evaluate(() => document.activeElement?.className), said: await page.evaluate(() => document.querySelector('.hj-caption-main [role=status]').textContent),
    };
    say(`${name}${reduced ? ' reduced' : ''}`, report[`${name}${reduced ? ' (reduced motion)' : ''}`]);
    await browser.close();
  }
  await save('timing.json', report);
};

// ---- What the page shows against what is saved. ---------------------------------------------------------------
const SHOWN = () => {
  const text = (s) => document.querySelector(s)?.textContent.replace(/\s+/g, ' ').trim();
  const row = (k) => ({ number: text(`.hj-row.is-${k} .hj-num-now`) + text(`.hj-row.is-${k} .hj-num-of`), label: text(`.hj-row.is-${k} .hj-label`), aria: document.querySelector(`.hj-row.is-${k} [role=img]`).getAttribute('aria-label') });
  const next = document.querySelector('.hj-next'); const b = document.querySelector('.hj-contact');
  const seen = (el) => getComputedStyle(el).visibility === 'visible' && el.getClientRects().length > 0;
  const tap = (el) => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el, '::before'); return [Math.round(Math.max(r.width, parseFloat(c.width) || 0)), Math.round(Math.max(r.height, parseFloat(c.height) || 0))]; };
  return { cream: row('cream'), red: row('red'), dots: [...document.querySelectorAll('.hj-tab.is-done')].map((t) => t.dataset.scene), next: seen(next) ? { tag: next.tagName, text: next.textContent.trim(), href: next.getAttribute('href'), tap: tap(next) } : null, button: seen(b) ? b.tagName : null, counterShown: seen(document.querySelector('.hj-row')), prizeLine: seen(b) ? text('.hj-prize-note') : null, moving: document.querySelector('.hj-caption-main').getAnimations({ subtree: true }).length, oldWords: /You found all 10|Swipe sideways|of 10 found$/.test(document.body.innerText) };
};
run.states = async () => {
  const report = { presets: {}, problems: [] };
  const bad = (what, detail) => { report.problems.push([what, detail]); say('PROBLEM', [what, detail]); };
  const browser = await chromium.launch({ channel: 'chrome' });
  const spots = await allSpots();
  const LABEL = { build: 'Build', grow: 'Grow', design: 'Design', film: 'Film', set: 'Set Design' };
  for (const n of [0, 1, 4, 5, 9, 10, 17, 24, 25, 26, 40, 49, 50]) {
    const context = await browser.newContext(DEVICES.desktop); const page = await context.newPage(); const errors = errorsOf(page);
    await withSaved(context, await saved(n));
    for (const id of IDS) {
      await page.goto('about:blank'); await page.goto(`${base}?debug#${id}`); await page.waitForFunction(() => window.__hj?.scene && !window.__hj.busy, null, { timeout: 60000 });
      const s = await page.evaluate(SHOWN);
      const counts = await page.evaluate(() => Object.fromEntries(Object.entries(JSON.parse(localStorage.getItem('hjaas:site:v2')).scenes).map(([k, v]) => [k, v.found.length])));
      const sum = Object.values(counts).reduce((a, b) => a + b, 0); const here = counts[id];
      const left = 10 - here; const want = { cream: `${here}/10`, red: `${sum}/50`, creamLabel: left === 0 ? `${LABEL[id]} complete` : here < left ? `found in ${LABEL[id]}` : `${left} more in ${LABEL[id]}`, redLabel: sum === 50 ? 'You found all 50' : 50 - sum > 25 ? 'find all 50 to contact Hui Jie' : `${50 - sum} more to contact Hui Jie`, dots: IDS.filter((k) => counts[k] === 10), button: sum === 50 ? 'BUTTON' : null };
      const got = { cream: s.cream.number, red: s.red.number, creamLabel: s.cream.label, redLabel: s.red.label, dots: s.dots, button: s.button };
      if (JSON.stringify(got) !== JSON.stringify(want)) bad(`saved ${n} at ${id}`, { got, want });
      if (s.cream.aria !== `${here} of 10 found in ${LABEL[id]}` || s.red.aria !== `${sum} of 50 found in all scenes`) bad('aria', s);
      if ((s.next !== null) !== (here === 10 && sum < 50)) bad('next', { n, id, next: s.next });
      if (s.next && (s.next.tag !== 'A' || s.next.tap[0] < 44 || s.next.tap[1] < 44)) bad('next link', s.next);
      if (s.counterShown === (sum === 50)) bad('counter and button', { n, id });
      if (s.oldWords) bad('old words', { n, id });
    }
    report.presets[n] = await page.evaluate(SHOWN);
    if (errors.length) bad('console', errors);
    await context.close();
  }
  say('presets', `${Object.keys(report.presets).length} hunts × 5 scenes, ${report.problems.length} problems`);

  // A return visit, watched from the first frame: the caption only fades up with the page; nothing in it rolls, glints or cross-fades.
  for (const n of [17, 20, 50]) {
    const context = await browser.newContext(DEVICES.desktop); const page = await context.newPage();
    await withSaved(context, await saved(n));
    await page.addInitScript(() => { window.__seen = new Set(); const look = () => { const el = document.querySelector('.hj-caption-main'); if (el) { for (const a of el.getAnimations({ subtree: true })) window.__seen.add(`${a.constructor.name} ${a.transitionProperty ?? ''} ${a.effect.target.className?.baseVal ?? a.effect.target.className}`.trim()); window.__first ??= { button: getComputedStyle(document.querySelector('.hj-contact')).visibility, n: document.querySelector('.hj-num-now').textContent }; } requestAnimationFrame(look); }; requestAnimationFrame(look); });
    await page.goto(`${base}#${n === 50 ? 'set' : 'grow'}`); await wait(3500);
    const seen = await page.evaluate(() => ({ first: window.__first, animations: [...window.__seen] }));
    report[`returnWith${n}`] = seen; say(`return with ${n}`, seen);
    if (seen.animations.some((a) => !/CSSTransition opacity hj-caption-main/.test(a))) bad('return visit moved', seen);
    if (n === 50 && seen.first.button !== 'visible') bad('button not there at once', seen);
    await context.close();
  }

  // One of each while it happens: quick finds, the switch mid-ceremony, Next.
  {
    const context = await browser.newContext(DEVICES.desktop); const page = await context.newPage(); const errors = errorsOf(page);
    await page.goto(`${base}?debug&reset&intro=off&seed=7&all=12#grow`); await ready(page);
    // Four finds in a row, 60 ms apart: every landing counts once.
    const ids = await page.evaluate(() => [...document.querySelectorAll('.hj-shroom')].slice(0, 4).map((b) => b.dataset.spot));
    for (const id of ids) { await page.evaluate((x) => document.querySelector(`.hj-shroom[data-spot="${x}"]`).click(), id); await wait(60); }
    await wait(1500);
    const quick = await page.evaluate(SHOWN); report.fourQuickFinds = { cream: quick.cream, red: quick.red, ghosts: await page.evaluate(() => [...document.querySelectorAll('.hj-num-old')].filter((e) => getComputedStyle(e).opacity !== '0').length) }; say('four quick finds', report.fourQuickFinds);
    if (quick.cream.number !== '6/10' || quick.red.number !== '16/50' || report.fourQuickFinds.ghosts) bad('four quick finds', report.fourQuickFinds);
    // The same, all in one frame.
    await page.evaluate(() => [...document.querySelectorAll('.hj-shroom')].slice(0, 3).forEach((b) => b.click())); await wait(1500);
    const once = await page.evaluate(SHOWN); if (once.cream.number !== '9/10' || once.red.number !== '19/50') bad('three at once', once);
    // The tenth, then Next while the ceremony runs, by keyboard.
    await page.evaluate(() => document.querySelector('.hj-shroom').click()); await page.waitForSelector('.hj-next:not(.is-off)'); await wait(400);
    const next = await page.evaluate(SHOWN); report.atTen = { cream: next.cream, next: next.next, dots: next.dots };
    await page.focus('.hj-next'); await page.keyboard.press('Enter'); await page.waitForFunction(() => location.hash === '#design' && window.__hj.scene.config.id === 'design' && !window.__hj.busy, null, { timeout: 30000 });
    const there = await page.evaluate(SHOWN); report.afterNext = { cream: there.cream, next: there.next, dots: there.dots, focus: await page.evaluate(() => document.activeElement.dataset?.scene ?? document.activeElement.tagName) }; say('after Next', report.afterNext);
    if (there.cream.number !== '0/10' || there.next || report.afterNext.focus !== 'design') bad('Next', report.afterNext);
    if (errors.length) bad('console', errors);
    await context.close();
  }
  {
    // The fiftieth, and a switch one second later: the button is simply there in the next scene.
    const context = await browser.newContext(DEVICES.desktop); const page = await context.newPage(); const errors = errorsOf(page);
    await page.goto(`${base}?debug&reset&intro=off&seed=7&all=49#set`); await ready(page);
    await page.evaluate(() => document.querySelector('.hj-shroom').click()); await wait(1400);
    await page.evaluate(() => (location.hash = '#grow')); await page.waitForFunction(() => window.__hj.scene.config.id === 'grow' && !window.__hj.busy, null, { timeout: 30000 }); await wait(2500);
    const s = await page.evaluate(SHOWN); report.switchMidUnlock = { button: s.button, counterShown: s.counterShown, dots: s.dots, line: s.prizeLine, moving: s.moving }; say('switch mid-unlock', report.switchMidUnlock);
    if (s.button !== 'BUTTON' || s.counterShown || s.dots.length !== 5 || s.moving) bad('switch mid-unlock', s);
    await page.click('.hj-contact'); report.formOpens = await page.evaluate(() => document.querySelector('.hj-dialog').open); if (!report.formOpens) bad('form', 'did not open');
    if (errors.length) bad('console', errors);
    await context.close();
  }

  // The hint: only a mushroom on screen. On a phone panned to where none is, nothing moves and it is still due.
  {
    const context = await browser.newContext(DEVICES.portrait); const page = await context.newPage();
    await page.goto(`${base}?debug&reset&intro=off&seed=7&hint=3#build`); await ready(page);
    report.hint = await page.evaluate(async () => {
      const view = document.querySelector('.hj-viewport'); const seen = () => [...document.querySelectorAll('.hj-shroom-art')].filter((a) => { const r = a.getBoundingClientRect(); const v = view.getBoundingClientRect(); return r.left >= v.left && r.right <= v.right; });
      const hunt = window.__hj.hunt; const moved = async () => { const before = new Set(); const t0 = performance.now(); while (performance.now() - t0 < 500) { await new Promise(requestAnimationFrame); for (const a of document.querySelectorAll('.hj-shroom-art')) if (a.style.transform && !/rotate\(0|none/.test(a.style.transform) && new DOMMatrix(getComputedStyle(a).transform).b !== 0) before.add(a.parentElement.dataset.spot); } return [...before]; };
      const out = [];
      for (const x of [0, 200, 420, 640, 10000]) {
        view.scrollLeft = x; await new Promise((r) => setTimeout(r, 120));
        const on = seen().map((a) => a.parentElement.dataset.spot); const said = hunt.hint(); const m = await moved(); out.push({ scrollLeft: Math.round(view.scrollLeft), onScreen: on, said, moved: m });
      }
      // With those on screen taken away, there is none to choose: it skips.
      for (const a of seen()) a.parentElement.style.display = 'none';
      for (const a of seen()) a.parentElement.style.display = 'none';
      out.push({ scrollLeft: Math.round(view.scrollLeft), onScreen: seen().map((a) => a.parentElement.dataset.spot), said: hunt.hint(), moved: await moved() });
      return out;
    });
    say('hint', report.hint);
    for (const h of report.hint) if (h.said !== h.onScreen.length > 0 || h.moved.some((id) => !h.onScreen.includes(id)) || (!h.onScreen.length && h.moved.length)) bad('hint', h);
    await context.close();
  }

  // The drift: after the painting, once, a first visit only; never with reduced motion, a return visit, or after a pan.
  const DRIFT = () => { window.__pan = []; window.__paint = null; const look = () => { const v = document.querySelector('.hj-viewport'); const m = performance.getEntriesByName('hj-paint').at(-1); if (v?.querySelector('.hj-plate')) window.__pan.push([performance.now() - (m ? m.startTime : 0), v.getBoundingClientRect().left - v.querySelector('.hj-plate').getBoundingClientRect().left, !!m]); requestAnimationFrame(look); }; requestAnimationFrame(look); };
  const drifts = async (label, { options = {}, url = `${base}?debug&seed=7#build`, progress = null, during = null, ms = 10500 }) => {
    const context = await browser.newContext({ ...DEVICES.portrait, ...options }); const page = await context.newPage();
    if (progress) await withSaved(context, progress);
    await page.addInitScript(DRIFT); await page.goto(url);
    if (during) await during(page);
    await wait(ms);
    const { pan, stored } = await page.evaluate(() => ({ pan: window.__pan.filter((p) => p[1] > 0), stored: JSON.parse(localStorage.getItem('hjaas:site:v2') ?? '{}') }));
    const start = pan[0]?.[1]; const moving = pan.filter((p, i) => i && Math.abs(p[1] - pan[i - 1][1]) > 0.01);
    const row = { startsAt: r1(start), furthest: r1(Math.max(...pan.map((p) => Math.abs(p[1] - start)))), endsAt: r1(pan.at(-1)[1]), firstMoveMsAfterTheBrushStarted: moving.length ? Math.round(moving[0][0]) : null, lastMove: moving.length ? Math.round(moving.at(-1)[0]) : null, biggestStepPx: r1(Math.max(0, ...moving.map((p) => Math.abs(p[1] - pan[pan.indexOf(p) - 1][1])))), savedPanned: stored.panned ?? null, savedPanX: stored.scenes?.build?.panX ?? null };
    report.drift ??= {}; report.drift[label] = row; say(`drift, ${label}`, row); await context.close(); return row;
  };
  const d = await drifts('first visit', {});
  if (Math.abs(d.furthest - 40) > 1 || Math.abs(d.endsAt - d.startsAt) > 1 || d.firstMoveMsAfterTheBrushStarted < 4750 || d.savedPanned || d.savedPanX !== null) bad('drift', d);
  for (const [label, o] of Object.entries({
    'reduced motion': { options: { reducedMotion: 'reduce' }, ms: 6000 },
    'return visit': { progress: await saved(0, { panned: false }), ms: 6000 },
    'another scene seen before': { progress: JSON.stringify({ scenes: { grow: { found: [], seen: true, panX: null } }, unlocked: false, panned: false }) },
    'landscape': { options: DEVICES.landscape },
  })) { const x = await drifts(label, o).catch((e) => ({ furthest: 0, none: e.message.slice(0, 80) })); report.drift[label] = x; if (x.furthest > 0.5) bad(`drift: ${label}`, x); }
  // A finger down in the middle of it: it stops where it is.
  {
    const context = await browser.newContext(DEVICES.portrait); const page = await context.newPage(); await page.addInitScript(DRIFT);
    await page.goto(`${base}?debug&seed=7#build`); await page.waitForFunction(() => { const p = window.__pan; return p?.length > 2 && performance.getEntriesByName('hj-paint').length && Math.abs(p.at(-1)[1] - p.find((x) => x[1] > 0)[1]) > 15; }, null, { timeout: 20000, polling: 'raf' });
    const at = await page.evaluate(() => { const v = document.querySelector('.hj-viewport'); const before = v.getBoundingClientRect().left - v.querySelector('.hj-plate').getBoundingClientRect().left; v.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true })); return before; });
    await wait(1500); const later = await page.evaluate(() => { const v = document.querySelector('.hj-viewport'); return v.getBoundingClientRect().left - v.querySelector('.hj-plate').getBoundingClientRect().left; });
    report.drift.touched = { stoppedAt: r1(at), later: r1(later) }; say('drift touched', report.drift.touched); if (Math.abs(at - later) > 1.01) bad('drift touched', report.drift.touched);
    await context.close();
  }
  await browser.close();
  await save('states.json', report);
  say('PROBLEMS', report.problems.length);
};

// ---- The phone: every scene's opening frame. --------------------------------------------------------------------
const HER = { build: [610, 912], grow: [845, 1145], design: [780, 1005], film: [1025, 1351], set: [738, 1050] };
// Two scenes do not open centred on her (round 2): what must be in view there, in plate px. Film: the two faces
// (hers even as she looks round) and her camera. Build: Rachel and the whole of her box.
const MUST_SHOW = { film: [[669, 815], [1133, 1262], [1025, 1140]], build: [[610, 912], [834, 1199]] };
run.phone = async () => {
  const report = { portrait: {}, landscape: {}, problems: [] };
  const browser = await chromium.launch({ channel: 'chrome' });
  const sizes = [[375, 667], [390, 844], [430, 932]];
  for (const [w, h] of [...sizes, [844, 390], [932, 430]]) {
    const side = w > h; const cells = [];
    for (const id of IDS) {
      const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const page = await context.newPage(); const errors = errorsOf(page);
      // The counters with something on them: 17 found.
      await page.goto(`${base}?debug&reset&intro=off&seed=7&all=17#${id}`); await ready(page);
      await page.addStyleTag({ content: '.hj-mushrooms.is-debug .hj-shroom { outline: none !important; background: none !important; }' });
      await wait(300);
      const row = await page.evaluate(({ her, must, id }) => {
        const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
        const view = document.querySelector('.hj-viewport'); const v = r('.hj-viewport'); const plate = r('.hj-plate'); const u = (plate.r - plate.l) / 1672;
        const hers = [plate.l + her[0] * u, plate.l + her[1] * u];
        const boxes = [...document.querySelectorAll('.hj-shroom')].map((b) => { const x = b.getBoundingClientRect(); return [x.width, x.height]; });
        return { windowPx: [Math.round(v.r - v.l), Math.round(v.b - v.t)], windowPctOfScreen: Math.round((1000 * (v.b - v.t)) / innerHeight) / 10, roomSeenPct: Math.round((100 * (v.r - v.l)) / (plate.r - plate.l)), herCentreOffPx: Math.round(((hers[0] + hers[1]) / 2 - (v.l + v.r) / 2) * 10) / 10, herInView: hers[0] >= v.l && hers[1] <= v.r, mustShowClearancePx: must && must.map(([a, b]) => [plate.l + a * u - v.l, v.r - plate.l - b * u].map((n) => Math.round(n * 10) / 10)), openedAtPlateX: Math.round(((v.l + v.r) / 2 - plate.l) / u), countersEnd: Math.round(r('.hj-row.is-red').b), controlsEnd: Math.round(r('.hj-controls').b), screen: innerHeight, pageTall: document.documentElement.scrollHeight, overlap: r('.hj-caption').t < v.b - 0.5, sideways: document.documentElement.scrollWidth - innerWidth, smallestTapBox: Math.min(...boxes.flat()), scrollbar: view.offsetHeight - view.clientHeight, touchAction: getComputedStyle(view).touchAction, id };
      }, { her: HER[id], must: MUST_SHOW[id], id });
      const ok = row.controlsEnd <= row.screen && row.pageTall <= row.screen && !row.overlap && row.sideways <= 0 && (side ? row.roomSeenPct >= 100 : row.windowPctOfScreen >= 55 && row.windowPctOfScreen <= 65 && (MUST_SHOW[id] ? row.mustShowClearancePx.flat().every((n) => n >= 0) : Math.abs(row.herCentreOffPx) <= 20 && row.herInView) && (row.smallestTapBox >= 44 || row.smallestTapBox === Infinity)) && !errors.length;
      if (!ok) report.problems.push({ w, h, ...row, errors });
      (report[side ? 'landscape' : 'portrait'][`${w}x${h}`] ??= {})[id] = row;
      const buf = await page.screenshot({ type: 'jpeg', quality: 88 });
      await writeFile(`${out}open-${w}x${h}-${id}.jpg`, buf);
      cells.push(await sharp(buf).resize(side ? 560 : 300).toBuffer());
      await context.close();
    }
    const m = await sharp(cells[0]).metadata(); const cols = side ? 2 : 5;
    await sharp({ create: { width: cols * (m.width + 10), height: Math.ceil(5 / cols) * (m.height + 10), channels: 3, background: '#888888' } }).composite(cells.map((input, i) => ({ input, left: (i % cols) * (m.width + 10), top: Math.floor(i / cols) * (m.height + 10) }))).jpeg({ quality: 88 }).toFile(`${out}open-${w}x${h}.jpg`);
    say(`${w}x${h}`, Object.values(report[side ? 'landscape' : 'portrait'][`${w}x${h}`]).map((x) => [x.id, x.windowPctOfScreen, x.roomSeenPct, x.openedAtPlateX, x.mustShowClearancePx ?? x.herCentreOffPx, x.controlsEnd, x.smallestTapBox]));
  }
  await browser.close(); await save('phone.json', report); say('PROBLEMS', report.problems);
};

// ---- Traces and WebKit, on the production build (no flags: progress is put in storage). ----------------------
const CATEGORIES = ['-*', 'toplevel', 'benchmark', 'cc', 'loading', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink.user_timing', 'v8.execute', 'latencyInfo', 'gpu', 'viz'];
run.trace = async () => {
  const traces = JSON.parse(await readFile(`${out}${process.env.HJ_OLD ? 'trace-before' : 'trace'}.json`, 'utf8').catch(() => '{}'));
  for (const [name, s] of Object.entries(SCENARIOS)) {
    if (ONLY && ONLY !== name) continue;
    const browser = await chromium.launch({ channel: 'chrome', headless: !!process.env.HJ_HEADLESS });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await withSaved(context, await saved(s.n));
    const page = await context.newPage(); const errors = errorsOf(page); const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Page.navigate', { url: `${prod}#${s.hash}` }); await wait(9000);
    const at = await nextShroom(page); await wait(800);
    const file = new URL(`../traces/counter${process.env.HJ_OLD ? '-before' : ''}-${name}-mobile-4x.json`, import.meta.url).pathname;
    await browser.startTracing(page, { categories: CATEGORIES });
    await wait(600);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(s.after + 700);
    await writeFile(file, await browser.stopTracing()); execFileSync('gzip', ['-f', file]);
    const shown = await page.evaluate(() => document.querySelector('.hj-num-now')?.textContent);
    await browser.close();
    const { traceEvents: ev } = JSON.parse(gunzipSync(await readFile(`${file}.gz`)).toString());
    // (The build before has no landing mark: 390 ms after the click there.)
    const click = ev.findLast((e) => e.name === 'EventDispatch' && e.args?.data?.type === 'click');
    const mark = ev.findLast((e) => e.name === 'hj-land' && String(e.cat).includes('user_timing')) ?? { ...click, ts: click.ts + 395000 };
    const when = (e) => Math.round((e.ts - mark.ts) / 1000);
    const end = name === 'unlock' ? 2700 : name === 'complete' ? 1600 : 900;
    const drops = ev.filter((e) => e.name === 'DroppedFrame' && e.pid === mark.pid).map(when);
    const tasks = ev.filter((e) => e.name === 'RunTask' && e.ph === 'X' && e.pid === mark.pid && e.tid === mark.tid);
    const longest = (from, to) => r1(Math.max(0, ...tasks.filter((e) => when(e) >= from && when(e) < to).map((e) => e.dur)) / 1000);
    const between = (from, to) => drops.filter((t) => t >= from && t < to);
    (traces[name] ??= []).push({ shown, framesBegun: ev.filter((e) => e.name === 'BeginFrame' && e.pid === mark.pid && when(e) >= -450 && when(e) < end).length, dropped: { theFlight: between(-450, 0), landingAndRolls: between(0, 800), theRest: between(800, end) }, longestTaskMs: { tapAndFlight: longest(-450, 0), landingAndRolls: longest(-1, 800), theRest: longest(800, end) }, window: [-450, end], errors });
    say(name, traces[name].at(-1)); await save(process.env.HJ_OLD ? 'trace-before.json' : 'trace.json', traces);
  }
};
run.webkit = async () => {
  const report = {};
  for (const [name, s] of Object.entries(SCENARIOS)) {
    const browser = await webkit.launch();
    const context = await browser.newContext({ ...devices['iPhone 14'], viewport: { width: 390, height: 844 } });
    await withSaved(context, await saved(s.n));
    const page = await context.newPage(); const errors = errorsOf(page);
    await page.goto(`${prod}#${s.hash}`); await wait(6000);
    const at = await nextShroom(page); await wait(800);
    await page.evaluate(() => { window.__f = []; addEventListener('click', () => (window.__click = performance.now()), true); let last = performance.now(); const t = (now) => { window.__f.push([now, now - last]); last = now; requestAnimationFrame(t); }; requestAnimationFrame(t); });
    await wait(300);
    await page.touchscreen.tap(at.x, at.y);
    const shots = name === 'unlock' ? [150, 1300, 2180, 3200] : name === 'complete' ? [150, 850, 1600] : [120, 1200];
    // Frame times first, undisturbed; the pictures come from a second go. (The build before has no landing mark.)
    await wait(s.after + 1000);
    const rows = await page.evaluate(() => { const l = performance.getEntriesByName('hj-land').at(-1)?.startTime ?? window.__click + 395; return window.__f.filter((f) => f[0] > l - 450 && f[0] < l + 3200).map((f) => [Math.round(f[0] - l), Math.round(f[1])]); });
    const atTap = rows.filter((r) => r[0] < -300); const after = rows.filter((r) => r[0] >= -300);
    if (process.env.HJ_OLD) { report[name] = { atTheTapMs: Math.max(...atTap.map((r) => r[1])), fromTheFlightOnMs: Math.max(...after.map((r) => r[1])), over34: rows.filter((r) => r[1] > 34) }; say(`before, ${name}`, report[name]); await browser.close(); continue; }
    const state = await page.evaluate(SHOWN);
    report[name] = { atTheTapMs: Math.max(...atTap.map((r) => r[1])), fromTheFlightOnMs: Math.max(...after.map((r) => r[1])), frames: rows.length, over34: rows.filter((r) => r[1] > 34), state: { cream: state.cream, red: state.red, dots: state.dots, next: state.next, button: state.button, line: state.prizeLine, counterShown: state.counterShown }, errors };
    say(name, report[name]);
    await page.screenshot({ path: `${out}webkit-${name}-end.jpg`, type: 'jpeg', quality: 86 });
    await context.close();
    const again = await browser.newContext({ ...devices['iPhone 14'], viewport: { width: 390, height: 844 } }); await withSaved(again, await saved(s.n)); const p2 = await again.newPage();
    await p2.goto(`${prod}#${s.hash}`); await wait(5000); const b = await nextShroom(p2); await wait(500); await p2.touchscreen.tap(b.x, b.y);
    await p2.waitForFunction(() => performance.getEntriesByName('hj-land').length > 0, null, { timeout: 8000, polling: 'raf' });
    const t0 = Date.now();
    const cells = []; for (const ms of shots) { await wait(Math.max(0, ms - (Date.now() - t0))); cells.push(await sharp(await p2.screenshot()).extract({ left: 0, top: Math.round(660 * 3), width: 390 * 3, height: 150 * 3 }).resize(585).toBuffer()); }
    const m = await sharp(cells[0]).metadata();
    await sharp({ create: { width: m.width, height: cells.length * (m.height + 8), channels: 3, background: '#888' } }).composite(cells.map((input, i) => ({ input, left: 0, top: i * (m.height + 8) }))).jpeg({ quality: 88 }).toFile(`${out}webkit-${name}.jpg`);
    await browser.close();
  }
  await save(process.env.HJ_OLD ? 'webkit-before.json' : 'webkit.json', report);
};

// ---- The whole hunt, one visit: every mushroom tapped on its drawing, Next from scene to scene, to the button. ----
run.hunt = async () => {
  const report = JSON.parse(await readFile(`${out}hunt.json`, 'utf8').catch(() => '{}'));
  for (const device of Object.keys(DEVICES)) {
    const browser = await chromium.launch({ channel: 'chrome' }); const context = await browser.newContext(DEVICES[device]); const page = await context.newPage(); const errors = errorsOf(page);
    const touch = device !== 'desktop'; const wrong = []; const counts = [];
    await page.goto(`${base}?debug&reset&intro=off&seed=7#build`); await ready(page);
    for (let n = 0; n < 5; n++) {
      const ids = await page.evaluate(() => [...document.querySelectorAll('.hj-shroom')].map((b) => b.dataset.spot));
      for (const id of ids) {
        await page.evaluate((x) => { const v = document.querySelector('.hj-viewport'); const r = document.querySelector(`.hj-shroom[data-spot="${x}"] .hj-shroom-art`).getBoundingClientRect(); const b = v.getBoundingClientRect(); v.scrollLeft += r.left + r.width / 2 - (b.left + b.width / 2); }, id);
        await wait(touch ? 350 : 60);
        const at = await page.evaluate((x) => { const r = document.querySelector(`.hj-shroom[data-spot="${x}"] .hj-shroom-art`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
        await press(page, at, touch); await wait(60);
        if (await page.locator(`.hj-shroom[data-spot="${id}"]`).count()) wrong.push(id);
        await wait(420);
      }
      await wait(1200);
      counts.push(await page.evaluate(() => [...document.querySelectorAll('.hj-num-now')].map((e) => e.textContent).join(' · ')));
      if (n < 4) {
        const next = page.locator('a.hj-next'); if (touch) await next.tap(); else await next.click();
        await page.waitForFunction((id) => window.__hj.scene.config.id === id && !window.__hj.busy, IDS[n + 1], { timeout: 30000 }); await wait(600);
      }
    }
    await wait(2500);
    const end = await page.evaluate(SHOWN);
    const button = page.locator('.hj-contact'); if (touch) await button.tap(); else await button.click();
    await wait(600);
    report[device] = { afterEachScene: counts, tapsThatMissed: wrong, dots: end.dots, button: end.button, counterShown: end.counterShown, formOpens: await page.evaluate(() => document.querySelector('.hj-dialog').open), errors };
    say(device, report[device]); await browser.close(); await save('hunt.json', report);
  }
};

const what = process.argv[2];
if (!run[what]) { console.error('node qa/tools/counter.mjs record|timing|states|phone|hunt|trace|webkit'); process.exit(1); }
await run[what]();

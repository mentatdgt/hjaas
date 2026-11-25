// Job 006, U5: a finished scene's tiny red mushroom, the tabs' focus ring and tap areas. Production builds: this one at
// HJ_PROD (4173), the one before at HJ_OLD_PROD (4196). Results: qa/review-fixes-02/tabs.json and pictures.
//   node qa/tools/tabs.mjs
import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const prod = process.env.HJ_PROD ?? 'http://localhost:4173/';
const old = process.env.HJ_OLD_PROD ?? 'http://localhost:4196/';
const dev = process.env.HJ_URL ?? 'http://localhost:5173/';
const out = new URL('../review-fixes-02/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const VIEWS = [[1440, 900, 1], [1440, 900, 2], [1024, 700, 2], [700, 900, 2], [390, 844, 3], [375, 667, 2], [360, 740, 2], [340, 700, 2], [320, 640, 2], [844, 390, 3], [2560, 1440, 1]];
const report = {};
const b0 = await chromium.launch({ channel: 'chrome' }); const p0 = await b0.newPage(); await p0.goto(`${dev}?intro=off`);
const SPOTS = await p0.evaluate(async () => Object.fromEntries((await import('/src/scenes/index.ts')).SCENES.map((s) => [s.id, s.spots.map((x) => x.id)]))); await b0.close();
const saved = (n) => { let left = n; const scenes = {}; for (const [id, spots] of Object.entries(SPOTS)) { scenes[id] = { found: spots.slice(0, Math.max(0, left)), seen: true, panX: null }; left -= spots.length; } return JSON.stringify({ scenes, unlocked: false, panned: true }); };
const open = async (browser, url, [w, h, dpr], n, hash = 'design') => {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: w < 900, hasTouch: w < 900 });
  await context.addInitScript((v) => { if (!sessionStorage.getItem('qa')) { sessionStorage.setItem('qa', '1'); localStorage.setItem('hjaas:site:v2', v); } }, saved(n));
  const page = await context.newPage(); const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text())); page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}#${hash}`); await page.waitForSelector('.hj-shroom, .hj-tab.is-done'); await page.waitForTimeout(1500);
  return { context, page, errors };
};
const look = (page) => page.evaluate(() => {
  const r2 = (n) => Math.round(n * 100) / 100;
  const menu = document.querySelector('.hj-menu'); const m = menu.getBoundingClientRect();
  return { menu: { scrolls: menu.scrollWidth > menu.clientWidth, height: r2(m.height), right: r2(m.right) }, pageScrolls: document.documentElement.scrollWidth > innerWidth, pageWidth: innerWidth, tabs: [...document.querySelectorAll('.hj-tab')].map((tab) => {
    const range = document.createRange(); range.selectNodeContents(tab.firstChild); const l = range.getBoundingClientRect();
    const mark = tab.querySelector('.hj-tab-mark'); const k = mark?.getBoundingClientRect();
    // The tap area: how far left and right of the label, on its middle line, a tap still goes to this tab.
    const y = l.top + l.height / 2; const own = (x) => document.elementFromPoint(x, y)?.closest('.hj-tab') === tab;
    let left = 0; while (left < 40 && own(l.left - left - 0.5)) left += 0.5; let right = 0; while (right < 40 && own(l.right + right + 0.5)) right += 0.5;
    const t = tab.getBoundingClientRect(); let up = 0; while (up < 40 && own2(t, -up)) up++; function own2() { return false; }
    return { name: tab.firstChild.data, x: r2(l.left), y: r2(l.top), w: r2(l.width), h: r2(l.height), tapLeft: left, tapRight: right, tapWidth: r2(left + l.width + right), tapHeight: r2(t.height), mark: k && mark.firstElementChild ? { left: r2(k.left - l.right), x: r2(k.left), right: r2(k.right), cy: r2(k.top + k.height / 2 - (l.top + l.height / 2)), h: r2(k.height), opacity: getComputedStyle(mark).opacity } : null };
  }) };
});
const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
for (const [engineName, engine, options] of [['chrome', chromium, { channel: 'chrome' }], ['webkit', webkit, {}]]) {
  const browser = await engine.launch(options);
  for (const view of VIEWS) {
    const key = `${engineName} ${view[0]}x${view[1]}@${view[2]}`;
    const a = await open(browser, prod, view, 20); const b = await open(browser, old, view, 20);
    const now = await look(a.page); const was = await look(b.page);
    const moved = Math.max(...now.tabs.map((t, i) => Math.max(Math.abs(t.x - was.tabs[i].x), Math.abs(t.y - was.tabs[i].y))));
    const row = { labelsMovedPx: moved, menuHeight: [was.menu.height, now.menu.height], menuScrolls: [was.menu.scrolls, now.menu.scrolls], pageScrollsSideways: now.pageScrolls, marksShown: now.tabs.filter((t) => Number(t.mark?.opacity) === 1).map((t) => t.name), tapWidth: now.tabs.map((t, i) => `${t.name} ${was.tabs[i].tapWidth} -> ${t.tapWidth}`), tapHeight: Math.min(...now.tabs.map((t) => t.tapHeight)), markToNextLabelPx: Math.min(...now.tabs.slice(0, -1).flatMap((t, i) => (now.tabs[i + 1].y === t.y && now.tabs[i].mark ? [now.tabs[i + 1].x - t.mark.right] : []))), lastMarkInsideMenuPx: Math.round((now.menu.right - now.tabs.at(-1).mark.right) * 100) / 100, markCentreFromLabelLine: now.tabs[0].mark.cy, markBoxHeight: now.tabs[0].mark.h };
    // Accessible names, and the picture itself at the screen's own pixels.
    row.names = await a.page.locator('.hj-tab').evaluateAll((els) => els.length) && await Promise.all((await a.page.getByRole('link').all()).map(async (l) => (await l.ariaSnapshot()).split('\n')[0])).then((x) => x.filter((s) => /Build|Grow|Design|Film|Set/.test(s)));
    const t0 = now.tabs[0];
    const clip = { x: Math.floor(t0.x) - 4, y: Math.floor(t0.y) - 8, width: Math.ceil(t0.w) + 24, height: Math.ceil(t0.h) + 16 };
    const png = await a.page.screenshot({ clip });
    { const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true }); const k = view[2]; const at = (x, y) => { const i = (y * info.width + x) * 3; return [data[i], data[i + 1], data[i + 2]]; }; const paper = lum(...at(1, 1));
      const contrast = (x, y) => { const l = lum(...at(x, y)); return (Math.max(paper, l) + 0.05) / (Math.min(paper, l) + 0.05); };
      const x0 = Math.floor((t0.x + t0.w - clip.x + 1.5) * k);
      // The mushroom's ink: everything of it over 1.15:1; its height; and, in 24 directions from its middle, the darkest px on the way out (its outline).
      let top = 1e9; let bottom = 0; let l = 1e9; let r = 0; for (let y = 0; y < info.height; y++) for (let x = x0; x < Math.min(info.width, (t0.mark.right - clip.x + 1.5) * k); x++) if (contrast(x, y) > 1.6) { top = Math.min(top, y); bottom = Math.max(bottom, y); l = Math.min(l, x); r = Math.max(r, x); }
      const cx = (l + r) / 2; const cy = (top + bottom) / 2; const rays = [];
      for (let q = 0; q < 24; q++) { const th = (q / 24) * 2 * Math.PI; let best = 1; for (let d = ((r - l) / 2) * 0.5; d < (r - l) * 0.8; d += 0.25) { const x = Math.round(cx + Math.cos(th) * d); const y = Math.round(cy + Math.sin(th) * d); if (x >= 0 && y >= 0 && x < info.width && y < info.height) best = Math.max(best, contrast(x, y)); } rays.push(Math.round(best * 10) / 10); }
      // The label's ink, for its middle: its first letter is a capital.
      let lt = 1e9; let lb = 0; for (let y = 0; y < info.height; y++) for (let x = Math.floor(4 * k); x < Math.floor(4 * k + t0.w * k); x++) if (contrast(x, y) > 2 && (y / k) < t0.h + 8) { lt = Math.min(lt, y); lb = Math.max(lb, y); }
      row.picture = { inkHeightCssPx: Math.round(((bottom - top + 1) / k) * 10) / 10, inkWidthCssPx: Math.round(((r - l + 1) / k) * 10) / 10, middleBelowLabelInkMiddlePx: Math.round(((cy - (lt + lb) / 2) / k) * 100) / 100, outlineContrastLowest: Math.min(...rays), outlineContrastAll: rays.join(' ') }; }
    // The focus ring: by the keyboard, on each tab; the ring must be all there.
    const rings = [];
    for (const [i, t] of now.tabs.entries()) {
      await a.page.evaluate((n) => document.querySelectorAll('.hj-tab')[n].focus(), 0);
      await a.page.locator('.hj-tab').nth(i).focus();
      await a.page.keyboard.press('Shift'); await a.page.waitForTimeout(40);
      rings.push(await a.page.evaluate((n) => { const tab = document.querySelectorAll('.hj-tab')[n]; const s = getComputedStyle(tab, '::after'); const t = tab.getBoundingClientRect(); const menu = document.querySelector('.hj-menu'); const m = menu.getBoundingClientRect(); const clipped = getComputedStyle(menu).overflowX !== 'visible'; const L = t.left + parseFloat(s.left); const R = t.right - parseFloat(s.right); return s.content === 'none' ? 'no ring' : { shown: tab.matches(':focus-visible'), inside: !clipped || (L >= m.left && R <= m.right && t.top + parseFloat(s.top) >= m.top && t.bottom - parseFloat(s.bottom) - 1.5 <= m.bottom), onScreen: L >= 0 && R <= innerWidth, left: Math.round(L * 10) / 10, right: Math.round(R * 10) / 10 }; }, i));
      if (engineName === 'chrome' || view[0] === 390) { const all = now.tabs; await a.page.screenshot({ path: `${out}.focus-${i}.png`, clip: { x: 0, y: Math.max(0, all[0].y - 20), width: view[0], height: Math.max(...all.map((z) => z.y)) - all[0].y + 60 } }); }
      void t;
    }
    row.rings = rings;
    row.errors = [...a.errors];
    report[key] = row;
    console.log(key, JSON.stringify(row));
    if (engineName === 'chrome' && [[1440, 1], [390, 3], [320, 2], [844, 3]].some(([w, d]) => view[0] === w && view[2] === d)) {
      const shots = []; let H = 0; let W = 0; for (let i = 0; i < 5; i++) { const s = sharp(`${out}.focus-${i}.png`); const md = await s.metadata(); W = md.width; shots.push({ input: `${out}.focus-${i}.png`, left: 0, top: H }); H += md.height + 4; }
      await sharp({ create: { width: W, height: H, channels: 3, background: '#b7b2a6' } }).composite(shots).png().toFile(`${out}tabs-focus-${view[0]}x${view[1]}.png`);
    }
    await a.context.close(); await b.context.close();
  }
  // The stills asked for: the menu with two finished scenes; a return visit; and the mushroom at 8x.
  for (const view of [[1440, 900, 1], [390, 844, 3]]) {
    const { context, page } = await open(browser, prod, view, 20);
    await page.screenshot({ path: `${out}menu-${engineName}-${view[0]}x${view[1]}.png` });
    await page.reload(); await page.waitForTimeout(2000);
    report[`${engineName} ${view[0]} after a reload`] = await page.evaluate(() => [...document.querySelectorAll('.hj-tab.is-done')].map((t) => t.dataset.scene + ' ' + getComputedStyle(t.querySelector('.hj-tab-mark')).opacity));
    const l = (await look(page)).tabs; const clip = { x: l[0].x - 6, y: l[0].y - 12, width: l[2].x + l[2].w + 18 - l[0].x, height: l[0].h + 24 };
    const z = await page.screenshot({ clip }); const md = await sharp(z).metadata(); const f = Math.max(1, Math.round(8 / view[2]));
    await sharp(z).resize(md.width * f, md.height * f, { kernel: 'nearest' }).png().toFile(`${out}menu-${engineName}-${view[0]}-8x.png`);
    await context.close();
  }
  await browser.close();
}
const { rm } = await import('node:fs/promises'); for (let i = 0; i < 5; i++) await rm(`${out}.focus-${i}.png`, { force: true });
await writeFile(`${out}tabs.json`, `${JSON.stringify(report, null, 1)}\n`);

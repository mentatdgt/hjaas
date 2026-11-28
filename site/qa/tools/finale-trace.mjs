// Job 006: a Chrome performance trace of a finale on a throttled phone (4x CPU, 390 x 844 at 3x, touch), from the
// `hj-finale` mark (the first frame on screen) for `span` ms; summarised by analyze-trace.mjs. Also counts layout shifts.
//   node qa/tools/finale-trace.mjs [setdesign] [span=6500]
import { chromium, devices } from 'playwright';
import { writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const [name = 'setdesign', span = '6500'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
// --baseline: the same window of the scene's own routine, without the finale, to compare against.
const BASELINE = process.argv.includes('--baseline');
const hash = { build: 'build', grow: 'grow', design: 'design', film: 'film', setdesign: 'set' }[name];
const base = process.env.HJ_URL ?? 'http://localhost:5173/';
const CATEGORIES = ['-*', 'toplevel', 'benchmark', 'cc', 'loading', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink.user_timing', 'v8.execute', 'latencyInfo', 'gpu', 'viz'];
const browser = await chromium.launch({ channel: 'chrome', headless: process.env.HJ_HEADLESS === '1' });
const context = await browser.newContext({ ...devices['iPhone 14'], viewport: { width: 390, height: 844 } });
const page = await context.newPage();
await page.addInitScript(() => {
  window.__shifts = [];
  new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__shifts.push([Math.round(e.startTime), e.value]); }).observe({ type: 'layout-shift', buffered: true });
});
const cdp = await context.newCDPSession(page);
await page.goto(`${base}?debug&reset&intro=off#${hash}`);
await page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 90000 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const file = `qa/finales/trace-${name}${BASELINE ? '-baseline' : ''}-mobile-4x.json`;
await browser.startTracing(page, { categories: CATEGORIES });
// The finale, as the QA switch plays it (all of its files fetched first, then from the top).
if (BASELINE) {
  await page.waitForTimeout(3000);
  await page.evaluate(() => performance.mark('hj-finale'));
} else {
  await page.evaluate(() => window.__hj.scene.rehearseFinale(window.__hj.scene.config.finale.name));
  await page.waitForFunction(() => window.__hj.finale.covers, null, { timeout: 60000 });
}
const startedAt = await page.evaluate(() => performance.now());
await page.waitForTimeout(Number(span) + 500);
await writeFile(file, await browser.stopTracing());
const app = await page.evaluate((from) => ({
  shown: window.__hj.finale?.log.map(([p, t], i, a) => `${p.replace(/\.png$/, '')}+${i ? t - a[i - 1][1] : 0}`).join(' '),
  peakDecodedBytes: window.__hj.finale?.peak,
  longTasks: window.__hj.longTasks.filter(([t]) => t >= from - 200),
  lateFrames: window.__hj.jank.filter(([t]) => t >= from - 200).length,
  layoutShifts: window.__shifts.filter(([t]) => t >= from - 200),
  set: document.querySelector('.hj-finale canvas')?.width,
}), startedAt);
await browser.close();
execFileSync('gzip', ['-f', file]);
const summary = execFileSync('node', ['qa/tools/analyze-trace.mjs', `${file}.gz`, '--mark', 'hj-finale', '--span', span, '--tasks'], { encoding: 'utf8' });
console.log(summary);
console.log(JSON.stringify(app, null, 1));
await writeFile(file.replace(/\.json$/, '.txt'), `${summary}\n${JSON.stringify(app, null, 1)}\n`);

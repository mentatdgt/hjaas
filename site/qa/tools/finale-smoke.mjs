// Job 006, a quick look: each scene opened with nine found, the tenth clicked, and what her finale shows.
//   node qa/tools/finale-smoke.mjs [scene ...]
import { chromium } from 'playwright';
const SCENES = process.argv.slice(2).length ? process.argv.slice(2) : ['build', 'grow', 'design', 'film', 'set'];
// Headed, as record.mjs: headless rendering runs at about 10 fps here and misrepresents the timing.
const browser = await chromium.launch({ channel: 'chrome', headless: process.env.HJ_HEADLESS === '1' });
for (const id of SCENES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const said = [];
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') said.push(m.text()); });
  page.on('pageerror', (e) => said.push(String(e)));
  await page.goto(`http://localhost:5173/?debug&reset&intro=off&found=9#${id}`);
  await page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  const before = await page.evaluate(() => ({ phase: window.__hj.finale?.phase, bytes: window.__hj.finale?.bytes }));
  const t0 = await page.evaluate(() => performance.now());
  await page.locator('.hj-shroom').first().click();
  await page.waitForTimeout(9000);
  const after = await page.evaluate(() => {
    const f = window.__hj.finale;
    const log = f.log.map(([p, t], i, a) => `${p}@${i ? t - a[i - 1][1] : 0}`);
    return { decodes: f.decodes.map(([p, ms]) => `${p.replace(/\.png$/, '')}:${ms}`).join(' '), phase: f.phase, covers: f.covers, peak: f.peak, bytes: f.bytes, log: log.join(' '), rachel: getComputedStyle(document.querySelector('.hj-viewport .hj-rachel')).visibility };
  });
  await page.screenshot({ path: `qa/finales/smoke-${id}.png` });
  const lag = await page.evaluate((t0) => ({ jank: window.__hj.jank.filter(([t]) => t > t0).map(([t, d]) => `${Math.round(t - t0)}+${d}`).join(' '), long: window.__hj.longTasks.filter(([t]) => t > t0).map(([t, d]) => `${Math.round(t - t0)}+${d}`).join(' '), start: window.__hj.finale.log[0] && Math.round(window.__hj.finale.log[0][1] - t0) }), t0);
  console.log(id, JSON.stringify(before), JSON.stringify(after), JSON.stringify(lag), said.slice(0, 5));
  await page.close();
}
await browser.close();

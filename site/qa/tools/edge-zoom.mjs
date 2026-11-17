// Close-up of Rachel's outline against the room at 3x, to check for edge fringe. node qa/tools/edge-zoom.mjs out.png
import { chromium } from 'playwright';
const out = process.argv[2] ?? 'qa/edge-zoom.png';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 });
await page.goto('http://localhost:5173/?debug&reset&intro=off');
await page.waitForFunction(() => window.__hj?.ready === true);
await page.evaluate(() => { window.__hj.player.stop(); window.__hj.rachel.show('frame_03'); });
await page.waitForTimeout(200);
await page.screenshot({ path: out, clip: { x: 590, y: 380, width: 330, height: 250 } });
await browser.close();
console.log(out);

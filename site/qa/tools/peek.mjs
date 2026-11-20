// A quick look while building. Needs `npm run dev`.
//   node qa/tools/peek.mjs <out.png> <width> <height> [query] [hash] [steps]
// steps, separated by ";":  wait:500  click:.selector  key:Tab  eval:<js>  evalfile:<path to js>  shot:<name>  (shot writes <out>-<name>.png)
// Env: WEBKIT=1 (WebKit instead of Chrome), RM=1 (reduced motion), OUTLINES=1 (keep the tap-box outlines).
import { chromium, webkit } from 'playwright';
const [file, w, h, query = 'reset&intro=off&seed=7', hash = '', steps = ''] = process.argv.slice(2);
const mobile = Number(w) <= 600;
const browser = process.env.WEBKIT ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: mobile ? 2 : 1, ...(process.env.WEBKIT ? {} : { isMobile: mobile }), hasTouch: mobile, reducedMotion: process.env.RM ? 'reduce' : 'no-preference' });
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.text()); });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`http://localhost:5173/?debug&${query}${hash ? `#${hash}` : ''}`);
await page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 30000 }).catch(() => console.log('not ready'));
const clean = () => page.evaluate(() => document.querySelectorAll('.hj-mushrooms').forEach((el) => el.classList.remove('is-debug')));
if (!process.env.OUTLINES) await clean();
for (const step of steps.split(';').filter(Boolean)) {
  const [verb, ...rest] = step.split(':');
  const arg = rest.join(':');
  if (verb === 'click') await page.click(arg, { force: true });
  else if (verb === 'wait') await page.waitForTimeout(Number(arg));
  else if (verb === 'key') await page.keyboard.press(arg);
  else if (verb === 'eval') console.log('eval:', JSON.stringify(await page.evaluate(arg)));
  else if (verb === 'evalfile') console.log('eval:', JSON.stringify(await page.evaluate((await import('node:fs')).readFileSync(arg, 'utf8'))));
  else if (verb === 'shot') { if (!process.env.OUTLINES) await clean(); await page.screenshot({ path: file.replace(/\.png$/, `-${arg}.png`) }); }
}
if (!process.env.OUTLINES) await clean();
await page.screenshot({ path: file, fullPage: true });
await browser.close();

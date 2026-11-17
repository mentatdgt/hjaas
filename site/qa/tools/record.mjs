// Records QA videos of the scene with Playwright.
//   node qa/tools/record.mjs <scenario> <desktop|iphone> [outDir]
// Scenarios: intro, loop, find, wiggle, finale, pan, reduced
import { chromium, webkit, devices } from 'playwright';
import { mkdir, rename, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const [scenario = 'find', device = 'desktop', outDir = 'qa/video'] = process.argv.slice(2);
const base = process.env.HJ_URL ?? 'http://localhost:5173/';
const tmp = join(outDir, `.tmp-${scenario}-${device}`);
await mkdir(tmp, { recursive: true });

const isPhone = device === 'iphone';
// Headed, so the recording shows real GPU-composited motion (headless rendering stutters and misrepresents it).
const headless = process.env.HJ_HEADLESS === '1';
const browser = isPhone ? await webkit.launch({ headless }) : await chromium.launch({ channel: 'chrome', headless });
const size = isPhone ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const context = await browser.newContext({
  ...(isPhone ? devices['iPhone 14'] : {}),
  viewport: size,
  recordVideo: { dir: tmp, size },
  reducedMotion: scenario === 'reduced' ? 'reduce' : 'no-preference',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const shot = (name) => page.screenshot({ path: join(outDir, `${scenario}-${device}-${name}.jpg`), type: 'jpeg', quality: 86 });
const ready = () => page.waitForFunction(() => window.__hj?.ready === true, null, { timeout: 30000 });
const tap = async (id) => {
  const el = page.locator(`.hj-shroom[data-spot="${id}"]`);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(isPhone ? 500 : 50);
  if (isPhone) await el.tap(); else await el.click();
};

const run = {
  async intro() {
    await page.goto(`${base}?debug&reset&intro=full&seed=7`);
    await page.waitForTimeout(600); await shot('a-paint-early');
    await page.waitForTimeout(700); await shot('b-paint-mid');
    await page.waitForTimeout(900); await shot('c-paint-late');
    await ready();
    await page.waitForTimeout(2500); await shot('d-settled');
    // Repeat visit: the quick version.
    await page.goto(`${base}?debug&intro=quick&seed=7`);
    await ready();
    await page.waitForTimeout(1500); await shot('e-quick-settled');
  },
  async loop() {
    await page.goto(`${base}?debug&reset&intro=off`);
    await ready();
    await page.waitForTimeout(60000);
    await shot('after-60s');
  },
  async find() {
    await page.goto(`${base}?debug&reset&intro=off&seed=3`);
    await ready();
    await page.waitForTimeout(1500); await shot('a-before');
    await tap('conduit');
    await page.waitForTimeout(250); await shot('b-flight');
    await page.waitForTimeout(450); await shot('c-landed');
    await page.waitForTimeout(900); await shot('d-reaction');
    await page.waitForTimeout(3000); await shot('e-back-to-work');
    await tap('screed');
    await page.waitForTimeout(4500); await shot('f-second-find');
  },
  async wiggle() {
    // The real thing: nothing is found for a minute, then one mushroom wiggles once (at about 60 s).
    await page.goto(`${base}?debug&reset&intro=off`);
    await ready();
    await page.waitForTimeout(66000);
    await shot('after-60s');
  },
  async finale() {
    await page.goto(`${base}?debug&reset&intro=off&found=9&seed=5`);
    await ready();
    await page.waitForTimeout(1200); await shot('a-nine');
    await tap('toolbox');
    await page.waitForTimeout(900); await shot('b-ten');
    await page.waitForTimeout(1300); await shot('c-shower');
    await page.waitForTimeout(2600); await shot('d-button');
    const button = page.locator('.hj-pin-action');
    if (isPhone) await button.tap(); else await button.click();
    await page.waitForTimeout(1200); await shot('e-form');
  },
  async pan() {
    await page.goto(`${base}?debug&reset&intro=off`);
    await ready();
    await page.waitForTimeout(2500); await shot('a-start');
    const scroller = page.locator('.hj-viewport');
    await scroller.evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' }));
    await page.waitForTimeout(1500); await shot('b-right');
    await scroller.evaluate((el) => el.scrollTo({ left: 0, behavior: 'smooth' }));
    await page.waitForTimeout(1500); await shot('c-left');
  },
  async reduced() {
    await page.goto(`${base}?debug&reset&intro=full`);
    await ready();
    await page.waitForTimeout(1500); await shot('a-settled');
    await tap('conduit');
    await page.waitForTimeout(1200); await shot('b-found');
    await page.waitForTimeout(6000);
  },
};

await run[scenario]();
await context.close();
await browser.close();
const [video] = (await readdir(tmp)).filter((f) => f.endsWith('.webm'));
// MP4 (H.264): plays in QuickTime and in the browser, and is a fraction of the size of the raw capture.
const final = join(outDir, `${scenario}-${device}.mp4`);
try {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(tmp, video), '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', final]);
} catch {
  await rename(join(tmp, video), final.replace('.mp4', '.webm'));
}
await rm(tmp, { recursive: true, force: true });
console.log(final, errors.length ? `\nERRORS:\n${errors.join('\n')}` : '(no page errors)');

// Scene 2, item 1: does scene 1 look exactly as it did before the engine refactor?
// Takes the same screenshots from two servers and compares them pixel by pixel.
//
//   node qa/tools/same-as-before.mjs <url of the version before> [url of this version]
//
// "Before" is any checkout of the commit to compare with, served on another port, for example:
//   git worktree add /tmp/before <commit> && cd /tmp/before/site && npx vite --port 5199 --strictPort
// Rachel is paused and the hammer rhythm seeded, so both pages show the same pose.
import { chromium } from 'playwright';
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const [before, after = 'http://localhost:5173/'] = process.argv.slice(2);
const out = new URL('../scene-2/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chrome' });

const shots = [
  ['first screen', 'reset&intro=off&seed=7', []],
  ['one found', 'reset&intro=off&seed=7', ['find:conduit']],
  ['nine found', 'reset&intro=off&seed=7&found=9', []],
  ['ten found, button', 'reset&intro=off&seed=7&found=9', ['find:toolbox']],
  ['form open', 'reset&intro=off&seed=7&found=10', ['form']],
];
const sizes = [[1440, 900], [390, 844], [360, 740]];

const take = async (base, width, height, query, steps) => {
  const phone = width <= 600;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}?debug&${query}`);
  {
    await page.waitForFunction(() => window.__hj?.ready === true);
    // Hold Rachel on her rest pose: the same picture on both pages.
    await page.getByRole('button', { name: 'Pause animation' }).click();
    await page.waitForTimeout(700);
    for (const step of steps) {
      if (step.startsWith('find:')) {
        await page.locator(`[data-spot="${step.slice(5)}"]`).click({ force: true });
        await page.waitForTimeout(3200);
      } else if (step === 'form') {
        await page.locator('.hj-contact').click();
        await page.waitForTimeout(900);
      }
    }
  }
  await page.evaluate(() => document.querySelector('.hj-mushrooms')?.classList.remove('is-debug'));
  await page.mouse.move(2, 2);
  await page.waitForTimeout(250);
  const png = await page.screenshot();
  await context.close();
  return { png, errors };
};

const rows = [];
for (const [width, height] of sizes) {
  for (const [name, query, steps] of shots) {
    const a = await take(before, width, height, query, steps);
    const b = await take(after, width, height, query, steps);
    const [pa, pb] = await Promise.all([a, b].map((s) => sharp(s.png).raw().toBuffer({ resolveWithObject: true })));
    let differing = 0;
    let worst = 0;
    const same = pa.info.width === pb.info.width && pa.info.height === pb.info.height;
    if (same) {
      for (let i = 0; i < pa.data.length; i += pa.info.channels) {
        const d = Math.max(Math.abs(pa.data[i] - pb.data[i]), Math.abs(pa.data[i + 1] - pb.data[i + 1]), Math.abs(pa.data[i + 2] - pb.data[i + 2]));
        if (d > 0) differing++;
        if (d > worst) worst = d;
      }
    }
    const row = { size: `${width}x${height}`, state: name, sameSize: same, differingPixels: differing, of: pa.info.width * pa.info.height, largestDifference: worst, errors: [...a.errors, ...b.errors] };
    rows.push(row);
    console.log(JSON.stringify(row));
    if (worst > 8) {
      await sharp(a.png).toFile(`${out}differs-${width}-${name.replace(/\W+/g, '-')}-before.png`);
      await sharp(b.png).toFile(`${out}differs-${width}-${name.replace(/\W+/g, '-')}-after.png`);
    }
  }
}
await browser.close();

// A difference of a few levels out of 255 in a pixel is rendering noise (anti-aliasing, the last step of a fade).
const exact = rows.filter((r) => r.differingPixels === 0).length;
const worst = Math.max(...rows.map((r) => r.largestDifference));
await writeFile(`${out}same-as-before.json`, `${JSON.stringify({ before, after, exact, of: rows.length, largestDifference: worst, rows }, null, 1)}\n`);
console.log(`${exact} of ${rows.length} states identical to the pixel; largest difference anywhere: ${worst} of 255`);

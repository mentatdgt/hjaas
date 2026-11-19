// Scene 2: is Rachel drawn where Wren's preview video has her?
// Compares the site's lab against frames of frames/017-lab-keyposes/lab-routine-preview.mp4. It first finds
// which square of the plate the preview shows (from the room alone), then checks that she lines up too.
// Needs `npm run dev`. Writes qa/scene-2/lab-vs-preview.jpg and prints the best alignment found.
//   node qa/tools/lab-vs-preview.mjs
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const out = new URL('../scene-2/', import.meta.url).pathname;
const video = new URL('../../../frames/017-lab-keyposes/lab-routine-preview.mp4', import.meta.url).pathname;
const REGION = { x: 562, y: 195, size: 720 }; // a first guess; fitted below
const N = 500; // compare at 500 px

const browser = await chromium.launch({ channel: 'chrome' });
const page = await (await browser.newContext({ viewport: { width: 2560, height: 1440 } })).newPage();
await page.goto('http://localhost:5173/?debug&reset&intro=off&seed=4#grow');
await page.waitForFunction(() => window.__hj?.ready === true && window.__hj.rachel?.has('thumbs_up#9'), null, { timeout: 60000 });
await page.evaluate(() => { window.__hj.player.stop(); document.querySelectorAll('.hj-shroom').forEach((el) => (el.style.visibility = 'hidden')); });
const plate = await page.locator('.hj-plate').boundingBox();
const u = plate.width / 1672;
const clip = { x: plate.x + REGION.x * u, y: plate.y + REGION.y * u, width: REGION.size * u, height: REGION.size * u };
const site = async (pose) => {
  await page.evaluate((name) => window.__hj.rachel.show(name), pose);
  await page.waitForTimeout(120);
  return sharp(await page.screenshot({ clip })).resize(N, N).removeAlpha().raw().toBuffer();
};
const preview = (seconds) => sharp(execFileSync('ffmpeg', ['-loglevel', 'error', '-ss', String(seconds), '-i', video, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], { maxBuffer: 1 << 26 })).resize(N, N).removeAlpha().raw().toBuffer();

// The whole plate as the site shows it, at plate size, with her on A1.
await page.evaluate(() => window.__hj.rachel.show('A1_mist_aim'));
await page.waitForTimeout(150);
const whole = await sharp(await page.screenshot({ clip: plate })).resize(1672, 941, { fit: 'fill' }).removeAlpha().raw().toBuffer();
const frame0 = await preview(0.2);
const at = (x, y) => { const i = (Math.round(y) * 1672 + Math.round(x)) * 3; return [whole[i], whole[i + 1], whole[i + 2]]; };
/** Mean difference between the preview frame and a square of the plate, over the given part of the frame (0..1). */
const compare = (rx, ry, size, part) => {
  let sum = 0; let n = 0;
  for (let v = part.y0; v < part.y1; v += 0.012) for (let h = part.x0; h < part.x1; h += 0.012) {
    const px = rx + h * size; const py = ry + v * size;
    if (px < 0 || py < 0 || px >= 1671 || py >= 940) continue;
    const j = (Math.round(v * (N - 1)) * N + Math.round(h * (N - 1))) * 3;
    const c = at(px, py);
    sum += Math.abs(c[0] - frame0[j]) + Math.abs(c[1] - frame0[j + 1]) + Math.abs(c[2] - frame0[j + 2]); n += 3;
  }
  return sum / n;
};
// 1. Which square of the plate does the preview show? Fitted on the room alone: the left third of the frame
//    and its top edge, where Rachel and the trolley never are.
const roomOnly = { x0: 0.02, x1: 0.3, y0: 0.02, y1: 0.6 };
let view = { diff: Infinity };
for (let size = 560; size <= 760; size += 4) for (let rx = 520; rx <= 700; rx += 4) for (let ry = 150; ry <= 300; ry += 4) {
  const diff = compare(rx, ry, size, roomOnly);
  if (diff < view.diff) view = { diff, rx, ry, size };
}
for (let size = view.size - 4; size <= view.size + 4; size++) for (let rx = view.rx - 4; rx <= view.rx + 4; rx++) for (let ry = view.ry - 4; ry <= view.ry + 4; ry++) {
  const diff = compare(rx, ry, size, roomOnly);
  if (diff < view.diff) view = { diff, rx, ry, size };
}
// 2. With the room lined up, is she lined up too? Slide the plate under the preview and see where the part of
//    the frame she and the trolley fill matches best. (0, 0) means she is drawn exactly where the preview has her.
const her = { x0: 0.18, x1: 0.82, y0: 0.12, y1: 0.98 };
let best = { diff: Infinity };
const slides = [];
for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
  const diff = compare(view.rx + dx, view.ry + dy, view.size, her);
  if (dx === 0 && dy === 0) slides.zero = diff;
  if (diff < best.diff) best = { diff, dx, dy };
}
const result = {
  previewShowsPlate: { x: [view.rx, view.rx + view.size], y: [view.ry, view.ry + view.size], roomDifference: Math.round(view.diff * 100) / 100 },
  herBestShiftPlatePx: [best.dx, best.dy],
  herDifferenceAtBestShift: Math.round(best.diff * 100) / 100,
  herDifferenceWithNoShift: Math.round(slides.zero * 100) / 100,
  herDifferenceShifted4Px: Math.round(compare(view.rx + 4, view.ry, view.size, her) * 100) / 100,
};
console.log(JSON.stringify(result));
REGION.x = view.rx; REGION.y = view.ry; REGION.size = view.size;
clip.x = plate.x + REGION.x * u; clip.y = plate.y + REGION.y * u; clip.width = clip.height = REGION.size * u;
best.t = 0.2;

// Side by side, for the eye: preview frames on top, the site on the same poses below.
const pairs = [[best.t, 'A1_mist_aim'], [null, 'A2_mist_squeeze'], [null, 'write_loop#12'], [null, 'K2_thumbs']];
await (await import('node:fs/promises')).writeFile(`${out}lab-vs-preview.json`, `${JSON.stringify(result, null, 1)}\n`);
const tiles = [];
const png = (raw) => sharp(raw, { raw: { width: N, height: N, channels: 3 } }).png().toBuffer();
tiles.push({ input: await png(frame0), left: 0, top: 40 });
// The preview at a few later moments (its own timing), for the same four kinds of pose.
for (const [i, t] of [[1, 1.0], [2, 9.5], [3, 22.5]]) tiles.push({ input: await png(await preview(t)), left: i * (N + 8), top: 40 });
for (let i = 0; i < pairs.length; i++) tiles.push({ input: await png(await site(pairs[i][1])), left: i * (N + 8), top: 40 + N + 48 });
const label = (text, y) => `<text x="8" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#302e29">${text}</text>`;
const width = 4 * N + 24;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${2 * N + 96}">${label("Wren's preview video (0, 1.0, 9.5 and 22.5 s)", 28)}${label('The site, on the same poses: aim, squeeze, writing, thumbs-up', N + 76)}</svg>`;
await sharp({ create: { width, height: 2 * N + 96, channels: 3, background: '#d9d6cf' } }).composite([{ input: Buffer.from(svg), left: 0, top: 0 }, ...tiles]).jpeg({ quality: 86 }).toFile(`${out}lab-vs-preview.jpg`);
await browser.close();

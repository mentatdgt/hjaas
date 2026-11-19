#!/usr/bin/env node
// Copies the approved art into site/public/assets/ as WebP: scene1/ for scene 1's own art, shared/ for
// the mushrooms and the logo, which every scene uses, scene2/ for the lab (Rachel's frames twice: as
// delivered, and a lighter set for narrow screens).
// The originals in frames/, scene/ and assets/ are only read, never changed.
// Re-run with `npm run assets` whenever Wren swaps a file; nothing else needs editing.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile, readdir, rm, stat } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const site = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(site, '..');
const assets = join(site, 'public/assets');
const out = join(assets, 'scene1');

// Small sprites (mushrooms, logo): lossy at quality 95 with exact alpha. At 3× zoom, on the floor and on the
// phone's dark band, they show no edges or banding next to lossless; go back to lossless if a new drawing does.
const sprite = { quality: 95, alphaQuality: 100, smartSubsample: true, effort: 6 };
// Sprites are at most 2× the largest the layout shows them, on the 2560 px screens it is tuned for.
// Mushrooms: the tallest spot (mushrooms.ts SPOTS) is 42 plate px; at 2560 × 1440 a find pops it to 77.1 CSS px,
// so 154 px (2 × 77.1, rounded down). Logo: 12cqw there, 307 CSS px. Never enlarged.
const MUSHROOM_H = 154;
const LOGO_W = 614;
// Rachel's 2x frames: lossy at quality 95, the bulk of the page weight. Alpha stays exact and smart chroma
// subsampling keeps colour from bleeding across the dark outlines. Check the outlines at 3x after raising
// or lowering the quality (qa/tools/review01.mjs outlines): raise it if halos or banding appear.
const frame = { quality: 95, alphaQuality: 100, smartSubsample: true, effort: 6 };
// The plate: near-lossless. About a third smaller than lossless, and no visible difference.
const plate = { nearLossless: true, quality: 60, effort: 6 };

const jobs = [];
const add = (from, to, opts = sprite, resize, dir = out) => jobs.push({ from: join(repo, from), to: join(dir, to), opts, resize });
// A job whose picture is put together here, not read straight from a file: `make` returns the sharp image.
const addMade = (make, to, opts) => jobs.push({ make, to: join(assets, to), opts });

add('scene/room-empty.png', 'room.webp', plate);

// Scene 2, the lab: the empty lab plate, and Rachel as delivered by task 017: stills, and clips of patches
// (frames.json lists them; routine.json is her routine and reaction). Both manifests are copied exactly as
// delivered, further down; the page swaps .png for .webp itself.
add('scene/mushroom-lab.png', 'scene2/room.webp', plate, undefined, assets);
const lab = 'frames/017-lab-keyposes/site';
const labFrames = JSON.parse(await readFile(join(repo, lab, 'frames.json'), 'utf8'));
// Lossy at quality 93 with exact alpha, like scene 1's frames: the patches sit over their stills, so the two
// must agree at the patch's edge, and they do at this quality (qa/tools/scene2.mjs frames checks the seam).
const labFrame = { quality: 93, alphaQuality: 100, smartSubsample: true, effort: 6 };
for (const file of [...Object.values(labFrames.stills), ...Object.values(labFrames.clips).flatMap((clip) => clip.frames)]) {
  add(`${lab}/${file}`, `scene2/rachel/${file.replace(/\.png$/, '.webp')}`, labFrame, undefined, assets);
}

// The same frames at three quarters of the size (1.5x), for narrow screens, where memory is short: a little
// over half the pixels. A patch is not simply shrunk, or it would no longer line up with its still to the
// pixel: it is put on its still at full size, the whole canvas is shrunk exactly as the still is, and the
// patch's rectangle (grown outward to whole pixels) is cut out of that. The set has its own frames.json,
// written further down, with the smaller canvas and the patches' new places.
const SMALL = 0.75;
const smallDir = 'scene2/rachel-1.5x';
const labCanvas = { w: labFrames.canvas.w, h: labFrames.canvas.h };
const labSmall = { w: labCanvas.w * SMALL, h: labCanvas.h * SMALL };
if (!Number.isInteger(labSmall.w) || !Number.isInteger(labSmall.h)) throw new Error(`The lab canvas (${labCanvas.w} x ${labCanvas.h}) does not shrink to whole pixels at ${SMALL}.`);
const pixels = new Map();
const rgba = (file) => {
  if (!pixels.has(file)) pixels.set(file, sharp(join(repo, lab, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }));
  return pixels.get(file);
};
const shrunk = (data) => sharp(data, { raw: { width: labCanvas.w, height: labCanvas.h, channels: 4 } }).resize(labSmall.w, labSmall.h, { kernel: 'lanczos3' });
const smallFrames = {
  note: `Made by npm run assets from ${lab}/frames.json: the same stills and clips at ${SMALL} of the size, for narrow screens. Do not edit; edit the delivered file and run npm run assets.`,
  canvas: { ...labFrames.canvas, w: labSmall.w, h: labSmall.h, note: undefined },
  stills: labFrames.stills,
  clips: {},
};
for (const file of Object.values(labFrames.stills)) {
  addMade(async () => shrunk((await rgba(file)).data), `${smallDir}/${file.replace(/\.png$/, '.webp')}`, labFrame);
}
for (const [name, clip] of Object.entries(labFrames.clips)) {
  const size = await sharp(join(repo, lab, clip.frames[0])).metadata();
  const left = Math.floor(clip.x * SMALL);
  const top = Math.floor(clip.y * SMALL);
  const area = { left, top, width: Math.ceil((clip.x + size.width) * SMALL) - left, height: Math.ceil((clip.y + size.height) * SMALL) - top };
  smallFrames.clips[name] = { base: clip.base, x: left, y: top, frames: clip.frames };
  for (const file of clip.frames) {
    addMade(async () => {
      const still = await rgba(labFrames.stills[clip.base]);
      const patch = await sharp(join(repo, lab, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      if (patch.info.width !== size.width || patch.info.height !== size.height) throw new Error(`${file} is not the size of the clip's first frame.`);
      // The patch replaces its rectangle of the still, as it does on the page.
      const whole = Buffer.from(still.data);
      for (let row = 0; row < patch.info.height; row++) {
        patch.data.copy(whole, ((clip.y + row) * labCanvas.w + clip.x) * 4, row * patch.info.width * 4, (row + 1) * patch.info.width * 4);
      }
      return shrunk(whole).extract(area);
    }, `${smallDir}/${file.replace(/\.png$/, '.webp')}`, labFrame);
  }
}

const loop = 'frames/016-upscale/approved';
const loopFrames = ['frame_01', 'frame_02', 'frame_03', 'frame_04', 'blink_half', 'blink_closed'];
for (const f of loopFrames) {
  add(`${loop}/${f}.png`, `rachel/${f}.webp`, frame);
}

// A reaction frame that is byte-identical to one of the upscaled frames (rx_frame_01 = frame_01, rx_K1 = K1, ...)
// is not copied again: shared.json points it at the one copy in rachel/, so the page downloads and decodes it once.
const digest = async (path) => createHash('sha256').update(await readFile(join(repo, path))).digest('hex');
const upscaled = new Map();
for (const f of await readdir(join(repo, loop))) {
  if (f.endsWith('.png')) upscaled.set(await digest(`${loop}/${f}`), f.replace('.png', ''));
}
const reaction = 'frames/005-reaction-motion/approved';
const shared = {};
for (const f of (await readdir(join(repo, reaction))).sort()) {
  if (!f.startsWith('rx_') || !f.endsWith('.png')) continue;
  const same = upscaled.get(await digest(`${reaction}/${f}`));
  if (same) {
    shared[f] = `rachel/${same}.webp`;
    if (!loopFrames.includes(same) && !jobs.some((job) => job.to === join(out, shared[f]))) add(`${loop}/${same}.png`, shared[f], frame);
    await rm(join(out, 'rachel/reaction', f.replace('.png', '.webp')), { force: true });
  } else {
    add(`${reaction}/${f}`, `rachel/reaction/${f.replace('.png', '.webp')}`, frame);
  }
}

for (let i = 1; i <= 9; i++) {
  const n = String(i).padStart(2, '0');
  add(`frames/003-mushrooms/approved/mushroom_${n}.png`, `shared/mushrooms/mushroom_${n}.webp`, sprite, { height: MUSHROOM_H }, assets);
}

add('assets/logo/hjaas-logo.png', 'shared/logo/logo.webp', sprite, { width: LOGO_W }, assets);

// Several at a time: encoding is slow (a few seconds for one of Rachel's frames) and each uses one core.
let total = 0;
const queue = [...jobs];
const work = async () => {
  for (let job = queue.shift(); job; job = queue.shift()) {
    const { from, to, opts, resize, make } = job;
    await mkdir(dirname(to), { recursive: true });
    const image = make ? await make() : sharp(from);
    if (resize) image.resize({ ...resize, withoutEnlargement: true });
    await image.webp(opts).toFile(to);
    const size = (await stat(to)).size;
    total += size;
    console.log(`${to.slice(assets.length + 1).padEnd(52)} ${(size / 1024).toFixed(0).padStart(5)} KB`);
  }
};
await Promise.all(Array.from({ length: Math.max(2, Math.min(8, availableParallelism() - 2)) }, work));

await copyFile(join(repo, lab, 'frames.json'), join(assets, 'scene2/rachel/frames.json'));
await copyFile(join(repo, lab, 'routine.json'), join(assets, 'scene2/rachel/routine.json'));
await writeFile(join(assets, smallDir, 'frames.json'), `${JSON.stringify(smallFrames, null, 1)}\n`);

// The reaction manifest is used as delivered; the player swaps .png for .webp itself.
await copyFile(join(repo, reaction, 'reaction.json'), join(out, 'rachel/reaction/reaction.json'));
await writeFile(join(out, 'rachel/reaction/shared.json'), `${JSON.stringify(shared, null, 1)}\n`);
console.log(`shared with rachel/: ${Object.keys(shared).join(', ') || 'none'}`);

// Favicon and home-screen icon: the reel on its own, which is drawn square.
for (const [size, name] of [[32, 'favicon-32.png'], [180, 'apple-touch-icon.png']]) {
  await sharp(join(repo, 'assets/logo/hjaas-reel.png'))
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(site, 'public', name));
}

// Link-preview image (og:image): the logo centred on the page colour, at the 1200 × 630 size link previews
// expect. PNG, because not every preview scraper reads WebP.
const logo = join(repo, 'assets/logo/hjaas-logo.png');
await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#f6f3ec' } })
  .composite([{ input: await sharp(logo).resize({ width: 900, withoutEnlargement: true }).toBuffer(), gravity: 'center' }])
  .png({ palette: true, quality: 90, effort: 10 })
  .toFile(join(site, 'public', 'og-image.png'));

console.log(`\n${jobs.length} images, ${(total / 1024 / 1024).toFixed(2)} MB`);

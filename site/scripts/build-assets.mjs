#!/usr/bin/env node
// Copies the approved art into site/public/assets/scene1/ as WebP.
// The originals in frames/, scene/ and assets/ are only read, never changed.
// Re-run with `npm run assets` whenever Wren swaps a file; nothing else needs editing.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile, readdir, rm, stat } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const site = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(site, '..');
const out = join(site, 'public/assets/scene1');

// Small sprites (mushrooms, logo): lossless.
const sprite = { lossless: true, effort: 6 };
// Rachel's 2x frames: lossy at quality 95, the bulk of the page weight. Alpha stays exact and smart chroma
// subsampling keeps colour from bleeding across the dark outlines. Check the outlines at 3x after raising
// or lowering the quality (qa/tools/review01.mjs outlines): raise it if halos or banding appear.
const frame = { quality: 95, alphaQuality: 100, smartSubsample: true, effort: 6 };
// The plate: near-lossless. About a third smaller than lossless, and no visible difference.
const plate = { nearLossless: true, quality: 60, effort: 6 };

const jobs = [];
const add = (from, to, opts = sprite) => jobs.push({ from: join(repo, from), to: join(out, to), opts });

add('scene/room-empty.png', 'room.webp', plate);

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
  add(`frames/003-mushrooms/approved/mushroom_${n}.png`, `mushrooms/mushroom_${n}.webp`);
}

add('assets/logo/tape-measure-temp.png', 'logo/logo.webp');

let total = 0;
for (const { from, to, opts } of jobs) {
  await mkdir(dirname(to), { recursive: true });
  await sharp(from).webp(opts).toFile(to);
  const size = (await stat(to)).size;
  total += size;
  console.log(`${basename(to).padEnd(22)} ${(size / 1024).toFixed(0).padStart(5)} KB`);
}

// The reaction manifest is used as delivered; the player swaps .png for .webp itself.
await copyFile(join(repo, reaction, 'reaction.json'), join(out, 'rachel/reaction/reaction.json'));
await writeFile(join(out, 'rachel/reaction/shared.json'), `${JSON.stringify(shared, null, 1)}\n`);
console.log(`shared with rachel/: ${Object.keys(shared).join(', ') || 'none'}`);

// A tiny blurred copy of the plate, stretched behind the stage so letterbox bars pick up the room's light.
await sharp(join(repo, 'scene/room-empty.png'))
  .resize(96)
  .blur(6)
  .modulate({ brightness: 0.4, saturation: 0.85 })
  .webp({ quality: 70 })
  .toFile(join(out, 'room-ambient.webp'));

// Temporary favicon: the reel, cropped square from the temp logo.
const logo = join(repo, 'assets/logo/tape-measure-temp.png');
const reel = { left: 0, top: 6, width: 298, height: 298 };
for (const [size, name] of [[32, 'favicon-32.png'], [180, 'apple-touch-icon.png']]) {
  await sharp(logo).extract(reel).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(join(site, 'public', name));
}

console.log(`\n${jobs.length} images, ${(total / 1024 / 1024).toFixed(2)} MB`);

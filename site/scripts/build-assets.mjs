#!/usr/bin/env node
// Copies the approved art into site/public/assets/scene1/ as WebP.
// The originals in frames/, scene/ and assets/ are only read, never changed.
// Re-run with `npm run assets` whenever Wren swaps a file; nothing else needs editing.
import { mkdir, readFile, writeFile, copyFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const site = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(site, '..');
const out = join(site, 'public/assets/scene1');

// Small sprites (mushrooms, logo): lossless.
const sprite = { lossless: true, effort: 6 };
// Rachel's 2x frames and the plate: near-lossless. About a third smaller than lossless,
// and no visible difference; the 19 Rachel frames are most of the page weight.
const frame = { nearLossless: true, quality: 60, effort: 6 };
const plate = { nearLossless: true, quality: 60, effort: 6 };

const jobs = [];
const add = (from, to, opts = sprite) => jobs.push({ from: join(repo, from), to: join(out, to), opts });

add('scene/room-empty.png', 'room.webp', plate);

const loop = 'frames/016-upscale/approved';
for (const f of ['frame_01', 'frame_02', 'frame_03', 'frame_04', 'blink_half', 'blink_closed']) {
  add(`${loop}/${f}.png`, `rachel/${f}.webp`, frame);
}

const reaction = 'frames/005-reaction-motion/approved';
for (const f of await readdir(join(repo, reaction))) {
  if (f.startsWith('rx_') && f.endsWith('.png')) add(`${reaction}/${f}`, `rachel/reaction/${f.replace('.png', '.webp')}`, frame);
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

#!/usr/bin/env node
// Copies the approved art into site/public/assets/ as WebP: scene1/ for scene 1's own art, shared/ for
// the mushrooms and the logo, which every scene uses.
// The originals in frames/, scene/ and assets/ are only read, never changed.
// Re-run with `npm run assets` whenever Wren swaps a file; nothing else needs editing.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile, readdir, rm, stat } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
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
  add(`frames/003-mushrooms/approved/mushroom_${n}.png`, `shared/mushrooms/mushroom_${n}.webp`, sprite, { height: MUSHROOM_H }, assets);
}

add('assets/logo/hjaas-logo.png', 'shared/logo/logo.webp', sprite, { width: LOGO_W }, assets);

let total = 0;
for (const { from, to, opts, resize } of jobs) {
  await mkdir(dirname(to), { recursive: true });
  const image = sharp(from);
  if (resize) image.resize({ ...resize, withoutEnlargement: true });
  await image.webp(opts).toFile(to);
  const size = (await stat(to)).size;
  total += size;
  console.log(`${basename(to).padEnd(22)} ${(size / 1024).toFixed(0).padStart(5)} KB`);
}

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

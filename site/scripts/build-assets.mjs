#!/usr/bin/env node
// Copies the approved art into site/public/assets/ as WebP: scene1/ for scene 1's own art, shared/ for
// the mushrooms and the logo, which every scene uses, scene2/ for the lab (Rachel's frames twice: as
// delivered, and a lighter set for narrow screens), scene3/ for the café and scene4/ for the film shoot
// (each its plate, and its whole cast as delivered). Each scene also gets the pencil lines of its edge.
// The originals in frames/, scene/ and assets/ are only read, never changed.
// Re-run with `npm run assets` whenever Wren swaps a file; nothing else needs editing.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile, readdir, rm, stat } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { dirname, join, sep } from 'node:path';
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

// Scenes delivered as a whole cast in one package (frames/NNN-…/site/): scene 3, the café (task 018),
// scene 4, the film shoot at the Merlion (task 020), and scene 5, the theatre backdrop (task 022). A package is read through its own frames.json, so a new
// delivery with the same layout (other stills, other clips, other boxes) needs nothing changed here.
//
// - A plate drawn larger than the page's plates (the café's, 2544 x 1432) is shrunk to their size.
// - The cast is used at the size delivered: the café's is about 1.5x the plate, the sharpest there is and
//   what a phone needs; the film scene's is the plate's own size and there is no larger master. Nothing is
//   enlarged.
// - A layer with a `scale` (the film scene's presenter: 2) has stills that many times its box. Decoded whole they
//   would be most of what a phone gives the page, so its first still is kept whole and each of the others is cut to
//   the rectangle where it differs from that one (`patches` in the page's frames.json; character.ts draws them).
// - A clip's patches may reach outside their actor's box (the café's first `sip` started 13 px above
//   Rachel's). The page draws an actor on a canvas the size of the box, so here the box is grown to hold
//   every patch and the actor's stills are padded with clear pixels to match. The frames.json the page
//   reads is written further down with the grown boxes; routine.json is copied as delivered.
//
// Where each cast is on the plate is also worked out here, for the scene's own file (src/scenes/*.ts) to
// read: each actor's box (nothing of the hunt may be put in one), and the smaller rectangle that holds every
// pixel the actor ever covers, stills and clips together (the painting's edge keeps clear of those). In
// plate px, rounded outward. Written further down as src/scenes/<scene>-cast.json.
//
// A piece of the room that moves is listed under `room`, not under `covers`: the edge fades it as it fades
// the plate. That is a layer the package marks `"scenery": true` (the Merlion's water, whose stills are cut
// out like an actor's), or one whose every still is a solid rectangle, with nothing cut out (the café's
// ceiling fan, from before packages said so).
//
// A layer's stills are the ones it lists, and any other still its routine names that the package's `stills`
// has and no layer lists (the film scene's blink stills for each mouth, given in its routine only).
//
// Two kinds of layer are not actors (cast.ts):
// - `"hunt_progress": k` (the theatre's backdrop patches, shown as the hunt goes on). Their stills are kept
//   lossless: they are drawn over one another and over the plate, and must meet them with no seam.
// - `"sprite_track"` (the stagehand): no stills, but a track (copied as delivered), sprites (WebP as usual) and
//   masks, kept lossless: a lossy mask would let the boots bleed onto the stage floor. The masks arrive as
//   grey (255 shows) and are shipped as alpha, so the page has nothing to work out when it decodes them.
const PACKAGES = [
  { dir: 'frames/018-cafe-scene/site', to: 'scene3', json: 'design-cast.json', lines: 'design-lines.png' },
  { dir: 'frames/020-film-scene/site', to: 'scene4', json: 'film-cast.json', lines: 'film-lines.png' },
  { dir: 'frames/022-theatre-scene/site', to: 'scene5', json: 'set-cast.json', lines: 'set-lines.png' },
];
const exact = { lossless: true, effort: 6 };
/** Every string in a routine (its stills, blink stills and the rest): what a layer's own list may have left out. */
const namesIn = (value) => (typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(namesIn) : value && typeof value === 'object' ? Object.values(value).flatMap(namesIn) : []);
/** A grey mask as black with that alpha. */
const alphaMask = async (file) => {
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) rgba[i * 4 + 3] = data[i * info.channels];
  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } });
};
const castFrame = { quality: 93, alphaQuality: 100, smartSubsample: true, effort: 6 };
// A still and the patches over it must agree where a patch ends: at 99 they are 0.9 levels apart there on average, of
// 255 (1.6 at 93), for a third more bytes. Lossless they would agree to the pixel, and weigh three times as much.
const patchFrame = { ...castFrame, quality: 99 };
// A patch's rim of unchanged picture is at least PATCH_RIM px, twice what character.ts leaves undrawn; and the patch
// starts and ends on a multiple of it, so that the halvings a browser shrinks by fall where the whole still's do.
const PATCH_RIM = 8;
/**
 * The rectangle in which two drawings of one size differ, with its rim. (Where both are clear there is no difference.)
 * `shrink`: the drawings as resized to this size, on whose px the rectangle then is.
 */
const differing = async (file, base, shrink) => {
  const picture = (name) => (shrink ? sharp(name).resize(shrink.width, shrink.height, { kernel: 'lanczos3' }) : sharp(name));
  const [a, b] = await Promise.all([file, base].map((name) => picture(name).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
  const { width, height } = a.info;
  if (width !== b.info.width || height !== b.info.height) throw new Error(`${file} is not the size of ${base}.`);
  let [left, top, right, bottom] = [width, height, 0, 0];
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data[i + 3] === 0 && b.data[i + 3] === 0) continue;
    if (a.data.readUInt32LE(i) === b.data.readUInt32LE(i)) continue;
    const x = (i / 4) % width;
    const y = Math.floor(i / 4 / width);
    [left, top, right, bottom] = [Math.min(left, x), Math.min(top, y), Math.max(right, x + 1), Math.max(bottom, y + 1)];
  }
  if (right <= left) throw new Error(`${file} is the same drawing as ${base}.`);
  const from = (px) => Math.max(0, Math.floor((px - PATCH_RIM) / PATCH_RIM) * PATCH_RIM);
  const to = (px, most) => Math.min(most, Math.ceil((px + PATCH_RIM) / PATCH_RIM) * PATCH_RIM);
  return { left: from(left), top: from(top), width: to(right, width) - from(left), height: to(bottom, height) - from(top) };
};
const casts = [];
for (const pack of PACKAGES) {
  const delivered = JSON.parse(await readFile(join(repo, pack.dir, 'frames.json'), 'utf8'));
  const routines = JSON.parse(await readFile(join(repo, pack.dir, 'routine.json'), 'utf8'));
  const listed = new Set(delivered.layers.flatMap((layer) => layer.stills ?? []));
  delivered.layers = delivered.layers.map((layer) => {
    const more = [...new Set(namesIn(routines.actors?.[layer.actor] ?? {}))].filter((name) => name in delivered.stills && !listed.has(name));
    return more.length ? { ...layer, stills: [...(layer.stills ?? []), ...more] } : { ...layer, stills: layer.stills ?? [] };
  });
  // (A new delivery may drop files the last one had: the folder is made afresh, unless only other files were asked for.)
  if (!process.argv[2] || [pack.to, 'cast'].includes(process.argv[2])) await rm(join(assets, pack.to, 'cast'), { recursive: true, force: true });
  add(`${pack.dir}/${delivered.plate}`, `${pack.to}/room.webp`, plate, { width: 1672, height: 941, fit: 'fill', kernel: 'lanczos3' }, assets);
  const forPage = { ...delivered, layers: [], clips: {} };
  forPage.canvas = { w: delivered.canvas.w, h: delivered.canvas.h };
  forPage.note = `Made by npm run assets from ${pack.dir}/frames.json: the same cast, with each actor's box grown to hold its clips' patches. Do not edit; edit the delivered file and run npm run assets.`;
  delete forPage.plate;
  for (const layer of delivered.layers) {
    // How far the layer's clips reach past its box, on each side.
    const grow = { left: 0, top: 0, right: 0, bottom: 0 };
    const clips = Object.entries(delivered.clips ?? {}).filter(([, clip]) => clip.layer === layer.actor);
    const sizes = new Map();
    for (const [name, clip] of clips) {
      const size = await sharp(join(repo, pack.dir, clip.frames[0])).metadata();
      sizes.set(name, size);
      grow.left = Math.max(grow.left, -clip.x);
      grow.top = Math.max(grow.top, -clip.y);
      grow.right = Math.max(grow.right, clip.x + size.width - layer.w);
      grow.bottom = Math.max(grow.bottom, clip.y + size.height - layer.h);
    }
    const grown = Object.values(grow).some((px) => px > 0);
    const scale = layer.scale ?? 1;
    if (scale !== 1 && (clips.length || layer.sprite_track || layer.hunt_progress !== undefined)) throw new Error(`${pack.dir}: the layer "${layer.actor}" has a "scale", which is for a layer of stills only.`);
    // (A dissolve blends two whole drawings: character.ts.)
    if (scale !== 1 && JSON.stringify(routines.actors?.[layer.actor] ?? {}).includes('"fade_ms":')) throw new Error(`${pack.dir}: the layer "${layer.actor}" has a "scale", so its stills are cut to patches, which cannot be dissolved ("fade_ms").`);
    const page = { ...layer, x: layer.x - grow.left, y: layer.y - grow.top, w: layer.w + grow.left + grow.right, h: layer.h + grow.top + grow.bottom };
    if (layer.sprite_track) {
      // The stagehand: WebP sprites, the masks lossless; the track is copied as delivered, further down.
      const webp = (file) => file.replace(/\.png$/, '.webp');
      page.sprites = Object.fromEntries(Object.entries(layer.sprites ?? {}).map(([name, file]) => [name, webp(file)]));
      for (const file of Object.values(layer.sprites ?? {})) add(`${pack.dir}/${file}`, `${pack.to}/cast/${webp(file)}`, castFrame, undefined, assets);
      for (const key of ['mask', 'body_mask']) {
        if (!layer[key]) continue;
        page[key] = webp(layer[key]);
        addMade(() => alphaMask(join(repo, pack.dir, layer[key])), `${pack.to}/cast/${page[key]}`, exact);
      }
    }
    forPage.layers.push(page);
    const stillFrame = layer.hunt_progress !== undefined ? exact : castFrame;
    for (const [name, clip] of clips) {
      forPage.clips[name] = { ...clip, x: clip.x + grow.left, y: clip.y + grow.top, w: sizes.get(name).width, h: sizes.get(name).height };
      // (A clip may name a frame twice, to hold it.)
      for (const file of new Set(clip.frames)) add(`${pack.dir}/${file}`, `${pack.to}/cast/${file.replace(/\.png$/, '.webp')}`, castFrame, undefined, assets);
    }
    for (const still of layer.stills) {
      const file = delivered.stills[still];
      if (scale !== 1) {
        const size = await sharp(join(repo, pack.dir, file)).metadata();
        if (size.width !== layer.w * scale || size.height !== layer.h * scale) throw new Error(`${pack.dir}/${file} is ${size.width} x ${size.height}, not ${scale} times its layer's box.`);
        const base = layer.stills[0];
        const where = `${pack.to}/cast/${file.replace(/\.png$/, '.webp')}`;
        if (still === base) {
          add(`${pack.dir}/${file}`, where, patchFrame, undefined, assets);
          continue;
        }
        const area = await differing(join(repo, pack.dir, file), join(repo, pack.dir, delivered.stills[base]));
        (page.patches ??= {})[still] = { base, x: area.left, y: area.top, w: area.width, h: area.height };
        addMade(() => sharp(join(repo, pack.dir, file)).ensureAlpha().extract(area), where, patchFrame);
        continue;
      }
      const to = `${pack.to}/cast/${file.replace(/\.png$/, '.webp')}`;
      if (grown) addMade(() => sharp(join(repo, pack.dir, file)).ensureAlpha().extend({ ...grow, background: { r: 0, g: 0, b: 0, alpha: 0 } }), to, stillFrame);
      else add(`${pack.dir}/${file}`, to, stillFrame, undefined, assets);
    }
  }

  const where = { note: `Made by npm run assets from ${pack.dir}/frames.json. Do not edit.`, boxes: {}, covers: {}, room: [] };
  const k = 1672 / delivered.canvas.w;
  const outward = ([l, t, r, b]) => [Math.floor(l * k), Math.floor(t * k), Math.ceil(r * k), Math.ceil(b * k)];
  for (const layer of forPage.layers) {
    where.boxes[layer.actor] = outward([layer.x, layer.y, layer.x + layer.w, layer.y + layer.h]);
    const original = delivered.layers.find((l) => l.actor === layer.actor);
    const scale = original.scale ?? 1;
    const pieces = [
      ...original.stills.map((still) => ({ file: delivered.stills[still], x: original.x, y: original.y })),
      ...Object.values(delivered.clips ?? {}).filter((clip) => clip.layer === layer.actor).flatMap((clip) => [...new Set(clip.frames)].map((file) => ({ file, x: original.x + clip.x, y: original.y + clip.y }))),
    ];
    let box = [Infinity, Infinity, -Infinity, -Infinity];
    let solid = true;
    for (const piece of pieces) {
      const { data, info } = await sharp(join(repo, pack.dir, piece.file)).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
      for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
          if (data[y * info.width + x] < 255) solid = false;
          if (data[y * info.width + x] <= 8) continue;
          box = [Math.min(box[0], piece.x + x / scale), Math.min(box[1], piece.y + y / scale), Math.max(box[2], piece.x + (x + 1) / scale), Math.max(box[3], piece.y + (y + 1) / scale)];
        }
      }
    }
    if (!pieces.length) continue; // (a layer with no stills: the stagehand, behind the backdrop)
    if (solid || layer.scenery === true) where.room.push(layer.actor);
    else if (box[0] <= box[2]) where.covers[layer.actor] = outward(box);
  }
  casts.push({ pack, delivered, forPage, where });
}

// The pencil lines of each scene's edge (scene/pencil/, made by tools/pencil_lines.py from the plates):
// greyscale, the size of the plate, 255 a full pencil line. The edge is only drawn in four strips along the
// plate's sides (src/engine/edge-band.json says how deep), so only those parts are shipped, as two pictures:
// the top strip over the bottom one, and the left strip beside the right one. Lossless: they are used as
// they are, grain and all.
//
// A piece of the room that moves (the café's fan: `room` above) cannot be drawn in pencil: a line stays
// where it is. The plate is delivered without the moving part, so inside such a piece's box the map keeps
// only the lines the plate itself would give (the fan's rod and hub, the beams behind it) and loses the
// rest (blades from a plate that still had them). "Would give" is the stroke test of tools/pencil_lines.py:
// darker than its blurred surroundings by enough. A map made from the delivered plate passes untouched.
const band = JSON.parse(await readFile(join(site, 'src/engine/edge-band.json'), 'utf8'));
const pencil = { lossless: true, effort: 6 };
const STROKE = { blur: 2.2, floor: 6, range: 16, over: 0.3, reach: 5 };
/** The map (raw greyscale), with the lines the plate does not have rubbed out of each box (in map px). */
async function withoutMovingLines(data, info, plateFile, boxes) {
  for (const box of boxes) {
    // The stroke test needs the plate around the box too, as far as the blur looks.
    const pad = 12;
    const left = Math.max(0, box.x - pad);
    const top = Math.max(0, box.y - pad);
    const width = Math.min(info.width, box.x + box.w + pad) - left;
    const height = Math.min(info.height, box.y + box.h + pad) - top;
    const grey = () => sharp(plateFile).resize(info.width, info.height, { fit: 'fill', kernel: 'lanczos3' }).greyscale().extract({ left, top, width, height });
    const [sharpOne, blurred] = await Promise.all([grey().raw().toBuffer(), grey().blur(STROKE.blur).raw().toBuffer()]);
    const stroke = new Uint8Array(width * height);
    for (let i = 0; i < stroke.length; i++) stroke[i] = (blurred[i] - sharpOne[i] - STROKE.floor) / STROKE.range > STROKE.over ? 1 : 0;
    // A line of the map may lie a few px from the stroke it was made from (the map is thickened and softened).
    const near = (x, y) => {
      for (let dy = -STROKE.reach; dy <= STROKE.reach; dy++) {
        for (let dx = -STROKE.reach; dx <= STROKE.reach; dx++) {
          const px = x - left + dx;
          const py = y - top + dy;
          if (px >= 0 && py >= 0 && px < width && py < height && stroke[py * width + px]) return true;
        }
      }
      return false;
    };
    for (let y = Math.max(0, box.y); y < Math.min(info.height, box.y + box.h); y++) {
      for (let x = Math.max(0, box.x); x < Math.min(info.width, box.x + box.w); x++) {
        if (data[y * info.width + x] && !near(x, y)) data[y * info.width + x] = 0;
      }
    }
  }
  return data;
}
// (The café's map is the size of its own, larger plate: it is shrunk with it.)
const castLines = casts.map(({ pack, delivered, where }) => [pack.lines, pack.to, { plate: join(repo, pack.dir, delivered.plate), canvas: delivered.canvas, boxes: delivered.layers.filter((layer) => where.room.includes(layer.actor)) }]);
for (const [map, dir, moving] of [['build-lines.png', 'scene1'], ['grow-lines.png', 'scene2'], ...castLines]) {
  const lines = (async () => {
    const file = sharp(join(repo, 'scene/pencil', map));
    const size = await file.metadata();
    if (Math.abs(size.width / size.height - 1672 / 941) > 0.002) throw new Error(`scene/pencil/${map} (${size.width} x ${size.height}) is not the shape of a plate.`);
    const fitted = (picture) => (size.width === 1672 && size.height === 941 ? picture : picture.resize(1672, 941, { fit: 'fill', kernel: 'lanczos3' }));
    if (!moving?.boxes.length) return fitted(file).greyscale().raw().toBuffer({ resolveWithObject: true });
    const { data, info } = await file.greyscale().raw().toBuffer({ resolveWithObject: true });
    const k = info.width / moving.canvas.w;
    const boxes = moving.boxes.map((layer) => ({ x: Math.floor(layer.x * k), y: Math.floor(layer.y * k), w: Math.ceil(layer.w * k), h: Math.ceil(layer.h * k) }));
    const kept = await withoutMovingLines(data, info, moving.plate, boxes);
    return fitted(sharp(kept, { raw: { width: info.width, height: info.height, channels: 1 } })).toColourspace('b-w').raw().toBuffer({ resolveWithObject: true });
  })();
  const cut = async (pieces, width, height) => {
    const { data, info } = await lines;
    if (info.width !== 1672 || info.height !== 941 || info.channels !== 1) throw new Error(`scene/pencil/${map} is not a 1672 x 941 greyscale picture.`);
    const picture = Buffer.alloc(width * height);
    // Each piece: a rectangle of the map (x, y, w, h) and where it goes in the picture (left, top).
    for (const [x, y, w, h, left, top] of pieces) {
      for (let row = 0; row < h; row++) data.copy(picture, (top + row) * width + left, (y + row) * info.width + x, (y + row) * info.width + x + w);
    }
    return sharp(picture, { raw: { width, height, channels: 1 } });
  };
  const sideTop = band.top - band.lap;
  const sideHeight = 941 - band.top - band.bottom + 2 * band.lap;
  addMade(() => cut([[0, 0, 1672, band.top, 0, 0], [0, 941 - band.bottom, 1672, band.bottom, 0, band.top]], 1672, band.top + band.bottom), `${dir}/pencil-tb.webp`, pencil);
  addMade(() => cut([[0, sideTop, band.side, sideHeight, 0, 0], [1672 - band.side, sideTop, band.side, sideHeight, band.side, 0]], 2 * band.side, sideHeight), `${dir}/pencil-lr.webp`, pencil);
}

const loop = 'frames/016-upscale/approved';
const reaction = 'frames/005-reaction-motion/approved';
// In-betweens that are another drawing but for an arm: only the part that differs is shipped, cut out and drawn over
// that other drawing (character.ts), or the decoded frames of six more whole drawings would not fit a phone's memory.
// What each is in the page (its pose), and the one it is drawn over. src/scenes/build-patches.json says where they go.
const PATCHES = [
  { pose: 'frame_01_02', base: 'frame_01', from: `${loop}/frame_01_02.png`, over: `${loop}/frame_01.png` },
  { pose: 'frame_02_03a', base: 'frame_02', from: `${loop}/frame_02_03a.png`, over: `${loop}/frame_02.png` },
  { pose: 'frame_02_03ab', base: 'frame_02', from: `${loop}/frame_02_03ab.png`, over: `${loop}/frame_02.png` },
  { pose: 'frame_02_03b', base: 'frame_02', from: `${loop}/frame_02_03b.png`, over: `${loop}/frame_02.png` },
  { pose: 'reaction/rx_K1_B36.png', base: 'reaction/rx_K1.png', from: `${reaction}/rx_K1_B36.png`, over: `${reaction}/rx_K1.png` },
  { pose: 'reaction/rx_B36_B39.png', base: 'reaction/rx_B36.png', from: `${reaction}/rx_B36_B39.png`, over: `${reaction}/rx_B36.png` },
];
const cutOut = (file) => PATCHES.some((patch) => patch.from === file);
const loopFrames = ['frame_01', 'frame_01_02', 'frame_02', 'frame_02_03a', 'frame_02_03ab', 'frame_02_03b', 'frame_03', 'frame_04', 'blink_half', 'blink_closed'];
for (const f of loopFrames) {
  if (!cutOut(`${loop}/${f}.png`)) add(`${loop}/${f}.png`, `rachel/${f}.webp`, frame);
}

// A reaction frame that is byte-identical to one of the upscaled frames (rx_frame_01 = frame_01, rx_K1 = K1, ...)
// is not copied again: shared.json points it at the one copy in rachel/, so the page downloads and decodes it once.
const digest = async (path) => createHash('sha256').update(await readFile(join(repo, path))).digest('hex');
const upscaled = new Map();
for (const f of await readdir(join(repo, loop))) {
  if (f.endsWith('.png')) upscaled.set(await digest(`${loop}/${f}`), f.replace('.png', ''));
}
const shared = {};
for (const f of (await readdir(join(repo, reaction))).sort()) {
  if (!f.startsWith('rx_') || !f.endsWith('.png')) continue;
  const same = upscaled.get(await digest(`${reaction}/${f}`));
  if (same) {
    shared[f] = `rachel/${same}.webp`;
    if (!loopFrames.includes(same) && !jobs.some((job) => job.to === join(out, shared[f]))) add(`${loop}/${same}.png`, shared[f], frame);
    await rm(join(out, 'rachel/reaction', f.replace('.png', '.webp')), { force: true });
  } else if (!cutOut(`${reaction}/${f}`)) {
    add(`${reaction}/${f}`, `rachel/reaction/${f.replace('.png', '.webp')}`, frame);
  }
}

for (let i = 1; i <= 9; i++) {
  const n = String(i).padStart(2, '0');
  add(`frames/003-mushrooms/approved/mushroom_${n}.png`, `shared/mushrooms/mushroom_${n}.webp`, sprite, { height: MUSHROOM_H }, assets);
}

add('assets/logo/hjaas-logo.png', 'shared/logo/logo.webp', sprite, { width: LOGO_W }, assets);

// Scene 1's frames at three quarters of the size as well, for narrow screens: the same files in a folder
// beside the full-size one, so the page only has to look in the other folder.
const small1 = join(out, 'rachel-1.5x');
for (const job of jobs.filter((j) => j.from && j.to.startsWith(join(out, 'rachel') + sep))) {
  jobs.push({
    make: async () => {
      const size = await sharp(job.from).metadata();
      return sharp(job.from).resize(Math.round(size.width * SMALL), Math.round(size.height * SMALL), { kernel: 'lanczos3' });
    },
    to: join(small1, job.to.slice(join(out, 'rachel').length + 1)),
    opts: job.opts,
  });
}

const buildPatches = { note: 'Made by npm run assets: the drawings of Build that are kept as patches, and where on their base they go. Do not edit.' };
for (const [dir, scale] of [['rachel/', 1], ['rachel-1.5x/', SMALL]]) {
  buildPatches[dir] = {};
  for (const { pose, base, from, over } of PATCHES) {
    const size = await sharp(join(repo, from)).metadata();
    // (Of the smaller set, cut from the whole drawing as it is shrunk, so that it lines up with its base to the pixel.)
    const shrink = scale === 1 ? undefined : { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
    const area = await differing(join(repo, from), join(repo, over), shrink);
    buildPatches[dir][pose] = { base, x: area.left, y: area.top };
    addMade(async () => {
      const whole = sharp(join(repo, from)).ensureAlpha();
      if (!shrink) return whole.extract(area);
      const { data, info } = await whole.resize(shrink.width, shrink.height, { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
      return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).extract(area);
    }, `scene1/${dir}${pose.replace(/\.png$/, '')}.webp`, patchFrame);
  }
}

// Several at a time: encoding is slow (a few seconds for one of Rachel's frames) and each uses one core.
// (`npm run assets -- pencil` makes only the files with that word in their path: quicker, after one change.)
let total = 0;
const only = process.argv[2];
const queue = jobs.filter((job) => !only || job.to.includes(only));
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

for (const { pack, forPage, where, delivered } of casts) {
  for (const layer of delivered.layers) {
    if (!layer.sprite_track) continue;
    await mkdir(dirname(join(assets, pack.to, 'cast', layer.sprite_track)), { recursive: true });
    await copyFile(join(repo, pack.dir, layer.sprite_track), join(assets, pack.to, 'cast', layer.sprite_track));
  }
  await writeFile(join(site, 'src/scenes', pack.json), `${JSON.stringify(where, null, 1)}\n`);
  await mkdir(join(assets, pack.to, 'cast'), { recursive: true });
  await writeFile(join(assets, pack.to, 'cast/frames.json'), `${JSON.stringify(forPage, null, 1)}\n`);
  await copyFile(join(repo, pack.dir, 'routine.json'), join(assets, pack.to, 'cast/routine.json'));
}
await copyFile(join(repo, lab, 'frames.json'), join(assets, 'scene2/rachel/frames.json'));
await copyFile(join(repo, lab, 'routine.json'), join(assets, 'scene2/rachel/routine.json'));
await writeFile(join(assets, smallDir, 'frames.json'), `${JSON.stringify(smallFrames, null, 1)}\n`);

await writeFile(join(site, 'src/scenes/build-patches.json'), `${JSON.stringify(buildPatches, null, 1)}\n`);

// The reaction manifest is used as delivered; the player swaps .png for .webp itself.
await copyFile(join(repo, reaction, 'reaction.json'), join(out, 'rachel/reaction/reaction.json'));
await writeFile(join(out, 'rachel/reaction/shared.json'), `${JSON.stringify(shared, null, 1)}\n`);
console.log(`shared with rachel/: ${Object.keys(shared).join(', ') || 'none'}`);
// The same two files for the smaller set, pointing at its own copies.
await copyFile(join(repo, reaction, 'reaction.json'), join(small1, 'reaction/reaction.json'));
await writeFile(join(small1, 'reaction/shared.json'), `${JSON.stringify(Object.fromEntries(Object.entries(shared).map(([file, path]) => [file, path.replace(/^rachel\//, 'rachel-1.5x/')])), null, 1)}\n`);

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

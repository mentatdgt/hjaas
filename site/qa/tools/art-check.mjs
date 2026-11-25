// Job 006, section 1: the new art of the café and the film shoot, as delivered and as built.
//   node qa/tools/art-check.mjs [folder of the assets before]     results: qa/review-fixes-02/art.json
// 1. Stills of a layer: where the delivered drawings differ is "what moves" (grown by 8 px, a WebP block's reach);
//    outside it the built stills are compared with each other, and, for scale, the earlier build's.
// 2. The mum's blink patches against the plate, along their own edge.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import sharp from 'sharp';

const repo = new URL('../../../', import.meta.url).pathname;
const assets = `${repo}site/public/assets/`;
const before = process.argv[2];
const report = {};
// Colour where a pixel is clear means nothing: premultiplied.
const load = async (file) => {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) data[i + c] = Math.round((data[i + c] * data[i + 3]) / 255);
  return { data, w: info.width, h: info.height };
};
const diff = (a, b, i) => Math.max(...[0, 1, 2, 3].map((c) => Math.abs(a.data[i * 4 + c] - b.data[i * 4 + c])));
const grow = (mask, w, h, r) => {
  const pass = (src, stride, n, lines, step) => { const out = new Uint8Array(src.length); for (let l = 0; l < lines; l++) { let last = -1e9; for (let i = 0; i < n; i++) { const k = l * step + i * stride; if (src[k]) last = i; if (i - last <= r) out[k] = 1; } last = 1e9; for (let i = n - 1; i >= 0; i--) { const k = l * step + i * stride; if (src[k]) last = i; if (last - i <= r) out[k] = 1; } } return out; };
  return pass(pass(mask, 1, w, h, w), w, h, w, 1);
};
const outside = (ref, still, mask) => { let max = 0; let n = 0; let over = 0; let sum = 0; for (let i = 0; i < mask.length; i++) { if (mask[i]) continue; const d = diff(ref, still, i); n++; sum += d; max = Math.max(max, d); if (d > 24) over++; } return { px: n, differing: undefined, max, over24: over, mean: Math.round((sum / n) * 1000) / 1000 }; };

for (const [scene, pack, dir, groups] of [
  ['child', 'frames/018-cafe-scene/site', 'scene3/cast', [['C_1', 'C_2', 'C_3']]],
  ['presenter', 'frames/020-film-scene/site', 'scene4/cast', [['M_1', 'M_1_mid', 'M_1_closed', 'M_1_blink', 'M_1_mid_blink', 'M_1_closed_blink'], ['M_2', 'M_2_closed', 'M_2_blink', 'M_2_closed_blink'], ['M_3', 'M_3_closed', 'M_3_blink', 'M_3_closed_blink'], ['M_1', 'M_12', 'M_2', 'M_13', 'M_3']]],
  ['rachel (film)', 'frames/020-film-scene/site', 'scene4/cast', [['R_A1_film', 'R_K0_turn', 'R_K1_look']]],
]) {
  const frames = JSON.parse(await readFile(`${repo}${pack}/frames.json`, 'utf8'));
  for (const group of groups) for (const name of group.slice(1)) {
    const file = (n) => frames.stills[n];
    const webp = (root, n) => `${root}${dir}/${file(n).replace('.png', '.webp')}`;
    const [a, b] = await Promise.all([group[0], name].map((n) => load(`${repo}${pack}/${file(n)}`)));
    const raw = new Uint8Array(a.w * a.h); let box = [1e9, 1e9, -1, -1]; let moving = 0;
    for (let i = 0; i < raw.length; i++) if (diff(a, b, i)) { raw[i] = 1; moving++; const x = i % a.w; const y = (i / a.w) | 0; box = [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x + 1), Math.max(box[3], y + 1)]; }
    // The delivered drawings again, outside the part that moved before this delivery.
    const mask = grow(raw, a.w, a.h, 8);
    const now = outside(...(await Promise.all([group[0], name].map((n) => load(webp(assets, n))))), mask);
    const row = { movingPx: moving, movingBox: box, ofStill: `${a.w}x${a.h}`, builtOutside: now };
    if (before && existsSync(webp(before, name))) row.builtOutsideBefore = outside(...(await Promise.all([group[0], name].map((n) => load(webp(before, n))))), mask);
    (report[scene] ??= {})[`${group[0]} / ${name}`] = row;
    console.log(scene, group[0], name, JSON.stringify(row));
  }
}

// The mum's blink: on the café's own canvas (2544 wide), her patches over the plate as delivered; and as built (the
// plate is shrunk to 1672: the patch is shrunk the same way, as the page draws it).
{
  const pack = 'frames/018-cafe-scene/site'; const frames = JSON.parse(await readFile(`${repo}${pack}/frames.json`, 'utf8'));
  const layer = frames.layers.find((l) => l.actor === 'mum');
  const seams = async (root, builtRoot) => {
    const out = {};
    for (const still of layer.stills) {
      const at = (root2, ext) => `${root2}/${frames.stills[still].replace('.png', ext)}`;
      const plate = await load(await sharp(`${root}/plate.png`).extract({ left: layer.x, top: layer.y, width: layer.w, height: layer.h }).png().toBuffer());
      const measure = (patch, pl) => { let edge = 0; let n = 0; let max = 0; for (let i = 0; i < patch.w * patch.h; i++) { const x = i % patch.w; const y = (i / patch.w) | 0; const al = patch.data[i * 4 + 3]; if (!al) continue; const rim = x < 2 || y < 2 || x >= patch.w - 2 || y >= patch.h - 2 || [[-2, 0], [2, 0], [0, -2], [0, 2]].some(([dx, dy]) => patch.data[((y + dy) * patch.w + x + dx) * 4 + 3] < 8); if (!rim) continue; // what the picture changes by here
        const d = Math.max(...[0, 1, 2].map((c) => Math.abs(patch.data[i * 4 + c] - pl.data[i * 4 + c] * (al / 255)))); edge += d; n++; max = Math.max(max, d); } return { rimPx: n, mean: Math.round((edge / n) * 100) / 100, max: Math.round(max) }; };
      out[still] = { delivered: measure(await load(at(root, '.png')), plate) };
      if (builtRoot) {
        // As the page shows it: the built plate, and the built patch drawn over it at 1672/2544.
        const room = sharp(`${builtRoot}scene3/room.webp`); const k = 1672 / 2544;
        const W = Math.round(layer.w * k); const H = Math.round(layer.h * k);
        const pl = await load(await room.extract({ left: Math.round(layer.x * k), top: Math.round(layer.y * k), width: W, height: H }).png().toBuffer());
        // (Straight alpha to the resizer: it premultiplies for itself.)
        const pa = await load(await sharp(at(`${builtRoot}scene3/cast`, '.webp')).resize(W, H, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer());
        out[still].built = measure(pa, pl);
      }
    }
    return out;
  };
  report.mumBlinkRim = await seams(`${repo}${pack}`, assets);
  console.log('mum', JSON.stringify(report.mumBlinkRim));
}
await writeFile(new URL('../review-fixes-02/art.json', import.meta.url), `${JSON.stringify(report, null, 1)}\n`);

// The painting's edge: it fades into the paper along a line that wanders a little, like the edge of a
// watercolour wash, with softly rounded corners. No frame, no mat.
//
// The edge is worked out once per scene from a seed (so it is the same on every visit) and drawn as one
// small canvas in the paper's colour, opaque outside the painting and clear inside. That canvas lies over
// the whole plate, on top of everything in it, and moves with the plate when a phone pans. Whatever is
// underneath (the room, the mushrooms, a painting in progress) simply never shows past the edge. Nothing
// is masked, so panning and painting cost what they did before.
//
// The same function that draws the edge also answers "how much of the painting shows here?", which is what
// keeps the hunt fair: every mushroom and its tap box must sit where the answer is at least 0.95 (edge.test.ts).
import { PLATE } from './assets';

/** `a-round` is the one the site ships. The others are kept for comparison (`?edge=`, dev only). */
export type EdgeStyle = 'a' | 'b' | 'c' | 'a-round';
export const EDGE_STYLES: readonly EdgeStyle[] = ['a-round', 'a', 'b', 'c'];
export const DEFAULT_EDGE: EdgeStyle = 'a-round';

interface Profile {
  /** How far the fade reaches in from each side, as a fraction of the plate's width (sides) or height (top, bottom). */
  side: number;
  top: number;
  bottom: number;
  /**
   * How much the line wanders, as a fraction of the fade's own width. The wandering stays inside the fade:
   * the plate's very edge is always paper, and the painting is always solid where the fade ends.
   */
  wander: number;
  /**
   * Rounded corners: the radius of each corner, as a fraction of the plate's width. The straight edges are
   * untouched; only the last `radius` of each one turns, and the fade follows the turn.
   */
  radius?: number;
  /**
   * A vignette: a superellipse through the middle of each side of the plate (times `reach`). `power` is
   * its exponent (higher is squarer) and `soft` the width of its fade, as a fraction of the half-plate.
   */
  corner?: { power: number; reach: number; soft: number };
}

const PROFILES: Record<EdgeStyle, Profile> = {
  // A, light: a thin soft edge. The bottom is thinnest: the floor, feet and low mushrooms are down there.
  a: { side: 0.04, top: 0.06, bottom: 0.025, wander: 0.28 },
  // B, medium: a little wider, and it wanders more.
  b: { side: 0.055, top: 0.08, bottom: 0.03, wander: 0.45 },
  // C, corners: the edges stay mostly intact; the fade is stronger toward the corners, like a soft vignette.
  c: { side: 0.03, top: 0.035, bottom: 0.025, wander: 0.22, corner: { power: 3, reach: 1.03, soft: 0.1 } },
  // The chosen one: A's thin soft edge, with the corners of a rounded rectangle, as in the mock-up
  // (reference/mockups/edge-CHOSEN-A-rounded.jpg): the long edges stay straight and thin, and only the
  // outer 6% of the width turns at each corner.
  'a-round': { side: 0.04, top: 0.06, bottom: 0.025, wander: 0.28, radius: 0.06 },
};

/** A fixed pseudo-random value in [0, 1) for a lattice point. */
function lattice(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1] with features about `cell` plate px across. */
function noise(x: number, y: number, cell: number, seed: number): number {
  const fx = x / cell;
  const fy = y / cell;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const top = lattice(ix, iy, seed) + (lattice(ix + 1, iy, seed) - lattice(ix, iy, seed)) * sx;
  const bottom = lattice(ix, iy + 1, seed) + (lattice(ix + 1, iy + 1, seed) - lattice(ix, iy + 1, seed)) * sx;
  return top + (bottom - top) * sy;
}

/** A number for a scene's name, so each scene's edge is its own and never changes. */
export function edgeSeed(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * How much of the painting shows at a point of the plate (plate px): 0 on the paper, 1 well inside.
 * In between, a smoothstep.
 */
export function edgeAlpha(style: EdgeStyle, seed: number): (x: number, y: number) => number {
  const p = PROFILES[style];
  const side = p.side * PLATE.w;
  const top = p.top * PLATE.h;
  const bottom = p.bottom * PLATE.h;
  const radius = (p.radius ?? 0) * PLATE.w;
  return (x, y) => {
    // 0 at the plate's edge, 1 where the fade ends, more further in.
    let f = Math.min(x / side, (PLATE.w - x) / side, y / top, (PLATE.h - y) / bottom);
    // Inside a corner's square, the edge is the corner's arc, not the two straight lines.
    const cx = radius - Math.min(x, PLATE.w - x);
    const cy = radius - Math.min(y, PLATE.h - y);
    if (cx > 0 && cy > 0) {
      const d = Math.hypot(cx, cy);
      // The fade is as wide as the side's where the arc meets the side, as the top's (or bottom's) where it
      // meets that, and turns smoothly from one to the other in between.
      const across = y < PLATE.h / 2 ? top : bottom;
      const width = d > 0 ? d / Math.hypot(cx / side, cy / across) : side;
      f = Math.min(f, (radius - d) / width);
    }
    if (p.corner) {
      const px = Math.abs((2 * x) / PLATE.w - 1);
      const py = Math.abs((2 * y) / PLATE.h - 1);
      const r = Math.pow(Math.pow(px, p.corner.power) + Math.pow(py, p.corner.power), 1 / p.corner.power) / p.corner.reach;
      f = Math.min(f, (1 - r) / p.corner.soft);
    }
    if (f <= 0) return 0;
    if (f >= 1) return 1;
    // The line wanders: large, medium and fine movements layered. It only ever moves inward from where
    // the fade would start and outward from where it would end, so it never leaves the fade.
    const wander = 0.42 * noise(x, y, 260, seed) + 0.3 * noise(x, y, 90, seed + 1) + 0.28 * noise(x, y, 28, seed + 2);
    const t = Math.min(1, Math.max(0, f * (1 + 2 * p.wander) - 2 * p.wander * (1 - wander)));
    return t * t * (3 - 2 * t);
  };
}

/** The painting must be at least this opaque behind a mushroom and behind every part of its tap box. */
export const SOLID = 0.95;

/** The lowest value of the edge over a rectangle of the plate (centre and size in plate px). */
export function lowestAlpha(alpha: (x: number, y: number) => number, cx: number, cy: number, w: number, h: number): number {
  let min = 1;
  for (let j = 0; j <= 8; j++) {
    for (let i = 0; i <= 8; i++) min = Math.min(min, alpha(cx - w / 2 + (w * i) / 8, cy - h / 2 + (h * j) / 8));
  }
  return min;
}

/**
 * Where a mushroom's tap box goes. It is at least 44 × 44 CSS px however small the drawing is, and centred
 * on the drawing unless that would put part of it in the painting's soft edge; then it moves inward, a
 * little at a time, until all of it is over solid painting. The drawing itself never moves.
 * `art` is the drawing's centre and size in plate px; `u` is CSS px per plate px. The result is in plate px.
 */
export function tapBox(
  alpha: (x: number, y: number) => number,
  art: { cx: number; cy: number; w: number; h: number },
  u: number,
): { cx: number; cy: number; w: number; h: number } {
  const w = Math.max(44, art.w * u + 10) / u;
  const h = Math.max(44, art.h * u + 10) / u;
  let { cx, cy } = art;
  const dx = cx < PLATE.w / 2 ? 2 : -2;
  const dy = cy < PLATE.h / 2 ? 2 : -2;
  // The box is placed on whole CSS pixels and the edge is drawn at a quarter of the plate's size, so it is
  // tested a little larger than it is: a CSS pixel and a few plate px on every side.
  const mw = w + 2 / u + 8;
  const mh = h + 2 / u + 8;
  for (let step = 0; step < 120 && lowestAlpha(alpha, cx, cy, mw, mh) < SOLID; step++) {
    // One small step toward the middle of the plate, along whichever axis helps more.
    if (lowestAlpha(alpha, cx + dx, cy, mw, mh) > lowestAlpha(alpha, cx, cy + dy, mw, mh)) cx += dx;
    else cy += dy;
  }
  return { cx, cy, w, h };
}

/**
 * The edge as a canvas in the paper's colour: opaque where the painting does not show, clear where it does.
 * A quarter of the plate's size is plenty for something this soft, and quick to work out (a scene loaded
 * in the background makes its edge while another scene is animating); the browser stretches it over the plate.
 */
export function edgeCanvas(style: EdgeStyle, seed: number, paper: [number, number, number]): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.className = 'hj-edge';
  canvas.setAttribute('aria-hidden', 'true');
  const w = (canvas.width = PLATE.w / 4);
  const h = (canvas.height = Math.round(PLATE.h / 4));
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(w, h);
  const alpha = edgeAlpha(style, seed);
  const sx = PLATE.w / w;
  const sy = PLATE.h / h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cover = 1 - alpha((x + 0.5) * sx, (y + 0.5) * sy);
      if (cover <= 0) continue;
      const i = (y * w + x) * 4;
      image.data[i] = paper[0];
      image.data[i + 1] = paper[1];
      image.data[i + 2] = paper[2];
      image.data[i + 3] = Math.round(cover * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

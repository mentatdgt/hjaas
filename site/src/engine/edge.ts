// The painting's edge: it melts into the paper the way a wash dries. The line wanders in and out, and its
// softness changes along its length: crisp in places, a wide melt in others. The corners are rounded. No
// frame, no mat. (`organic`, the one the site ships; reviews/scene-edge-organic.md. The older, even
// feathers are kept for comparison.)
//
// The edge is worked out once per scene from a seed (so it is the same on every visit) and drawn as one
// small canvas in the paper's colour, opaque outside the painting and clear inside. That canvas lies over
// the whole plate, on top of everything in it, and moves with the plate when a phone pans. Whatever is
// underneath (the room, the mushrooms, a painting in progress) simply never shows past the edge. Nothing
// is masked, so panning and painting cost what they did before.
//
// The same function that draws the edge also answers "how much of the painting shows here?", which is what
// keeps the hunt fair: every mushroom and its tap box must sit where the answer is at least 0.95 (edge.test.ts).
import { PLATE, idle } from './assets';

/** `organic` is the one the site ships. The others are kept for comparison (`?edge=`, dev only). */
export type EdgeStyle = 'organic' | 'a' | 'b' | 'c' | 'a-round';
export const EDGE_STYLES: readonly EdgeStyle[] = ['organic', 'a-round', 'a', 'b', 'c'];
export const DEFAULT_EDGE: EdgeStyle = 'organic';

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

const PROFILES: Record<Exclude<EdgeStyle, 'organic'>, Profile> = {
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

/** The name a scene's edge is seeded from: the scene's own, or one of its alternatives (types.ts, `edge`). */
export const edgeName = (scene: { id: string; edge?: number }): string => (scene.edge ? `${scene.id}:${scene.edge}` : scene.id);

/** A number for a scene's name, so each scene's edge is its own and never changes. */
export function edgeSeed(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return h >>> 0;
}

// The organic edge, in plate px, as the chosen mock-up was made (reference/mockups/edge-organic-123.jpg,
// option 2). `din` is how far a point is inside a rounded rectangle the size of the plate.
const ORGANIC = {
  /** The corners' radius, as a fraction of the plate's width. */
  radius: 0.06,
  /** How far the line wanders in or out at most, and the melt's width where it is neither wide nor crisp. */
  wander: 60,
  width: 60,
  /** How much the melt's width changes along the edge (0.75: from a quarter of `width` to one and three quarters). */
  widthSwing: 0.75,
  minWidth: 6,
  /** The wander's noise: cell sizes in px, and how much each counts. Large shapes first, then finer ones. */
  cells: [110, 45, 18, 7],
  weights: [1, 0.55, 0.3, 0.15],
  /** The width's noise: the large shapes only. */
  widthCells: [140, 60],
  widthWeights: [1, 0.55],
  /** The bottom fifth of the plate: the floor, feet and low mushrooms are there, so the edge is calmer and thinner. */
  bottomFrom: 0.8,
  bottomWidth: 0.55,
  bottomWander: 0.6,
} as const;
/** Further inside than this the painting is always solid: the most the line can wander plus the widest melt. */
const ORGANIC_REACH = ORGANIC.wander + ORGANIC.width * (1 + ORGANIC.widthSwing);

function organicAlpha(seed: number): (x: number, y: number) => number {
  const o = ORGANIC;
  const radius = o.radius * PLATE.w;
  /** Layered value noise, from about -1 to 1. */
  const layered = (x: number, y: number, cells: readonly number[], weights: readonly number[], salt: number): number => {
    let sum = 0;
    let total = 0;
    for (let i = 0; i < cells.length; i++) {
      sum += (2 * noise(x, y, cells[i], seed + salt + i) - 1) * weights[i];
      total += weights[i];
    }
    return sum / total;
  };
  return (x, y) => {
    const dx = Math.min(x, PLATE.w - x);
    const dy = Math.min(y, PLATE.h - y);
    // Inside a corner's square the edge is the corner's arc.
    const din = dx < radius && dy < radius ? radius - Math.hypot(radius - dx, radius - dy) : Math.min(dx, dy);
    if (din <= 0) return 0;
    if (din >= ORGANIC_REACH) return 1;
    const bottom = Math.min(1, Math.max(0, (y / PLATE.h - o.bottomFrom) / (1 - o.bottomFrom)));
    const width = Math.max(o.minWidth, o.width * (1 + o.widthSwing * layered(x, y, o.widthCells, o.widthWeights, 100)) * (1 - o.bottomWidth * bottom));
    const t = Math.min(1, Math.max(0, (din + o.wander * layered(x, y, o.cells, o.weights, 0) * (1 - o.bottomWander * bottom)) / width));
    return t * t * (3 - 2 * t);
  };
}

/**
 * How much of the painting shows at a point of the plate (plate px): 0 on the paper, 1 well inside.
 * In between, a smoothstep.
 */
export function edgeAlpha(style: EdgeStyle, seed: number): (x: number, y: number) => number {
  if (style === 'organic') return organicAlpha(seed);
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
 * It is drawn at a fraction of the plate's size and the browser stretches it over the plate: a quarter for
 * the even feathers, half for the organic edge, whose crisp places and fine wander need the detail.
 *
 * `spread: true` works it out a slice at a time in quiet moments (a scene loaded in the background makes
 * its edge while another scene is animating). The promise resolves when the canvas is complete.
 */
export function edgeCanvas(style: EdgeStyle, seed: number, paper: [number, number, number], spread = false): { canvas: HTMLCanvasElement; done: Promise<void> } {
  const canvas = document.createElement('canvas');
  canvas.className = 'hj-edge';
  canvas.setAttribute('aria-hidden', 'true');
  const shrink = style === 'organic' ? 2 : 4;
  const w = (canvas.width = PLATE.w / shrink);
  const h = (canvas.height = Math.round(PLATE.h / shrink));
  const ctx = canvas.getContext('2d')!;
  const alpha = edgeAlpha(style, seed);
  const sx = PLATE.w / w;
  const sy = PLATE.h / h;
  /** Rows `from` up to `to`, worked out and put on the canvas. */
  const rows = (from: number, to: number): void => {
    const image = ctx.createImageData(w, to - from);
    for (let y = from; y < to; y++) {
      for (let x = 0; x < w; x++) {
        const cover = 1 - alpha((x + 0.5) * sx, (y + 0.5) * sy);
        if (cover <= 0) continue;
        const i = ((y - from) * w + x) * 4;
        image.data[i] = paper[0];
        image.data[i + 1] = paper[1];
        image.data[i + 2] = paper[2];
        image.data[i + 3] = Math.round(cover * 255);
      }
    }
    ctx.putImageData(image, 0, from);
  };
  if (!spread) {
    rows(0, h);
    return { canvas, done: Promise.resolve() };
  }
  const done = (async () => {
    // A few milliseconds at a time, so whatever is animating keeps its frames.
    let y = 0;
    while (y < h) {
      await idle();
      const until = performance.now() + 4;
      while (y < h && performance.now() < until) {
        const to = Math.min(h, y + 8);
        rows(y, to);
        y = to;
      }
    }
  })();
  return { canvas, done };
}

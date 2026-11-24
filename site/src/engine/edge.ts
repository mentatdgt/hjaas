// The painting's edge: the colour gives way to pencil. Solid painting, then the colour fades along a
// wandering line, crisp in places and a wide melt in others, and the room's drawn lines carry on a little
// further as pencil before they break up and trail off into the paper. The corners are rounded, and the
// picture never ends on a straight cut: the last of it always fades. No frame, no mat. (`pencil`, the one
// the site ships; reviews/scene-edge-pencil.md. `organic`, the wash without the pencil, and the older,
// even feathers are kept for comparison.)
//
// The edge comes from a seed, one per scene (so it is the same on every visit), and is drawn in the paper's
// colour, opaque outside the painting and clear inside, with the pencil lines drawn into it. It lies over
// the plate, on top of everything in it, and moves with the plate when a phone pans. Whatever is underneath
// (the room, the mushrooms, a painting in progress) simply never shows past the edge. Nothing is masked,
// so panning and painting cost what they did before.
//
// The pencil needs the plate's own detail, so the edge is drawn at the plate's full size, but only where
// there is any: four strips along the plate's sides (edge-band.json), not a canvas the size of the plate.
// That is 2.6 MB a scene, so only the scene on show has its edge: it is drawn when the scene goes on show
// (about 60 ms of work, in slices of 7) and given back when it leaves. Nothing is drawn while the room is
// panned, painted or looked at.
//
// The same function that draws the edge also answers "how much of the painting shows here?", which is what
// keeps the hunt fair: every mushroom and its tap box must sit where the answer is at least 0.95 (edge.test.ts).
import { PLATE, asset, decodeBlob, fetchBlob, frameSize, releaseFrame, type Frame } from './assets';
import BAND from './edge-band.json';

/** `pencil` is the one the site ships. The others are kept for comparison (`?edge=`, dev only). */
export type EdgeStyle = 'pencil' | 'organic' | 'a' | 'b' | 'c' | 'a-round';
export const EDGE_STYLES: readonly EdgeStyle[] = ['pencil', 'organic', 'a-round', 'a', 'b', 'c'];
export const DEFAULT_EDGE: EdgeStyle = 'pencil';

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

const PROFILES: Record<Exclude<EdgeStyle, 'pencil' | 'organic'>, Profile> = {
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

// The wash's shape, in plate px, as the chosen mock-ups were made (reference/mockups/edge-organic-123.jpg,
// option 2, and edge-pencil-options.jpg, B). `din` is how far a point is inside a rounded rectangle the
// size of the plate. The pencil edge and the organic one share all of it.
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

// The pencil edge (reviews/scene-edge-pencil.md): two edges from the same wandering line. The colour ends
// along one; the pencil reaches out to the other, about where the colour used to end.
const PENCIL = {
  /** The colour gives way this much further in than the organic edge's did; the pencil carries on this much further out. */
  paintInset: 45,
  pencilInset: -10,
  /** Along the bottom the two are closer to the rim: the floor, the feet and the low mushrooms are there. */
  bottomInset: 0.75,
  /**
   * The plate's outer 28 px always fade to paper, wherever the line wanders. (Without it the organic edge
   * ends on the plate's own straight rim wherever its line runs outward.)
   */
  rim: 28,
  /** The strokes break apart as they head outward: noise this many px across, and how hard it bites. */
  breakCell: 9,
  breakSalt: 9,
  breakReach: 0.9,
  breakLift: 0.25,
  breakSoft: 0.35,
  /** Graphite, and how far a full line takes the paper toward it. */
  graphite: [78, 74, 70],
  strength: 0.85,
} as const;
/** Further inside than this the painting is always solid, whatever the seed. */
const PENCIL_REACH = PENCIL.paintInset + ORGANIC_REACH;

const smooth = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Both edges at a point of the plate: how much of the colour shows, and how far the pencil reaches. */
interface Wash {
  paint: number;
  pencil: number;
}

/** How far a point is inside the plate's rounded rectangle (negative or zero: outside it). */
function inside(x: number, y: number, radius: number): number {
  const dx = Math.min(x, PLATE.w - x);
  const dy = Math.min(y, PLATE.h - y);
  // Inside a corner's square the edge is the corner's arc.
  return dx < radius && dy < radius ? radius - Math.hypot(radius - dx, radius - dy) : Math.min(dx, dy);
}

/** How far down the plate's bottom fifth a point is, 0 to 1: there the edge is calmer, thinner and nearer the rim. */
const bottomOf = (y: number): number => Math.min(1, Math.max(0, (y / PLATE.h - ORGANIC.bottomFrom) / (1 - ORGANIC.bottomFrom)));

/** Both edges where the point is `din` inside, from the two noises there (each about -1 to 1). */
function washFrom(din: number, bottom: number, wander: number, swing: number, out: Wash): void {
  const o = ORGANIC;
  const p = PENCIL;
  const width = Math.max(o.minWidth, o.width * (1 + o.widthSwing * swing) * (1 - o.bottomWidth * bottom));
  const line = din + o.wander * wander * (1 - o.bottomWander * bottom);
  const inset = 1 - p.bottomInset * bottom;
  const rim = smooth(din / p.rim);
  out.paint = smooth((line - p.paintInset * inset) / width) * rim;
  out.pencil = smooth((line - p.pencilInset * inset) / width) * rim;
}

/**
 * A rectangle of the plate that the painting must be whole in, as [left, top, right, bottom] in plate px:
 * where a scene's cast comes nearer the plate's rim than the edge's line may wander (the café: Rachel's
 * boots and the cat are 35 px from the bottom, the old man's chair 60 px from the side). Around each one
 * the painting reaches out toward the rim in a soft lobe, as far as it needs to and no further; everywhere
 * else the edge is exactly what it is without them.
 *
 * The rule, as agreed with Wren (reviews/scene-3-build.md, section 5):
 * - only around the boxes that need it: a box further in than the edge can reach changes nothing;
 * - the plate's outer rim stays bare paper all the way round: the 28 px rim fade applies to the lobe too, so
 *   from paper to the whole painting is never less than 28 px. A box that reaches into that fade (the outer
 *   fringe of Rachel's shadow, which is part of her stills) is as whole there as the rim allows, and whole
 *   from 28 px in;
 * - no pencil band there: beside a box with 80 px of room or less the pencil ends where the colour does,
 *   and comes back along the lobe's shoulders (a box with 120 px or more keeps the ordinary pencil);
 * - everywhere else, the ordinary pencil edge.
 */
export type KeepBox = readonly [number, number, number, number] | readonly [number, number, number, number, 'hug'];

/**
 * A box marked `'hug'` is a part of the room, not the cast, that reaches up into the edge's reach (the film
 * scene's Merlion, whose head comes to 23 px from the top). A few such boxes, stacked, follow its outline.
 * The painting does not reach out to the rim in a lobe there: it bulges out around the boxes and follows
 * them, whole up to a few px from them and fading over a few dozen, its line wandering with the same noise
 * as the ordinary edge's. Further away the ordinary edge, pencil and all, is left exactly as it is. The rim
 * fade applies here as everywhere.
 */
const HUG = {
  /** Whole this far from the boxes, give or take `wobble` with the edge's own wander; then a fade this wide, give or take `swing` of it. */
  margin: 18,
  wobble: 16,
  width: 46,
  swing: 0.5,
} as const;
/** Beyond this distance from every hugged box, nothing changes. */
const HUG_REACH = HUG.margin + HUG.wobble + HUG.width * (1 + HUG.swing);

const isHug = (box: KeepBox): boolean => box[4] === 'hug';

/** The hugged boxes, and the rectangle beyond which none of them changes anything (most of the edge is out there). */
interface Hugs {
  boxes: readonly KeepBox[];
  near: readonly [number, number, number, number];
}
const hugsOf = (keep: readonly KeepBox[] | undefined): Hugs | null => {
  const boxes = (keep ?? []).filter(isHug);
  if (!boxes.length) return null;
  const near = [Math.min(...boxes.map((b) => b[0])) - HUG_REACH, Math.min(...boxes.map((b) => b[1])) - HUG_REACH, Math.max(...boxes.map((b) => b[2])) + HUG_REACH, Math.max(...boxes.map((b) => b[3])) + HUG_REACH] as const;
  return { boxes, near };
};

/** Raise the colour, at a point `din` inside the plate, around the hugged boxes near it. `wander`, `swing`: the ordinary edge's two noises there. */
function hug({ boxes, near }: Hugs, x: number, y: number, din: number, wander: number, swing: number, out: Wash): void {
  if (x < near[0] || y < near[1] || x > near[2] || y > near[3]) return;
  let dist = Infinity;
  for (const [left, top, right, bottom] of boxes) {
    const dx = Math.max(left - x, 0, x - right);
    const dy = Math.max(top - y, 0, y - bottom);
    dist = Math.min(dist, Math.hypot(dx, dy));
  }
  if (dist >= HUG_REACH) return;
  const width = HUG.width * (1 + HUG.swing * swing);
  const line = HUG.margin + HUG.wobble * wander;
  const paint = smooth((line + width - dist) / width) * smooth(din / PENCIL.rim);
  if (paint > out.paint) out.paint = paint;
  // (The pencil is never short of the colour.)
  if (out.pencil < out.paint) out.pencil = out.paint;
}

/** One side of a box the edge has to make room for: where along that side, and how near the rim it comes. */
interface Hold {
  side: 'top' | 'bottom' | 'left' | 'right';
  from: number;
  to: number;
  /** How far inside the plate the box's outer side is: the painting must be whole from here inward. */
  room: number;
}

const HOLD = {
  /** The lobe is whole this far beyond the box's ends, then eases back to the ordinary edge over `ease` px. */
  margin: 14,
  ease: 150,
  /** Its fade is at most this wide, and never more than this share of the room there is. */
  width: 24,
  share: 0.6,
  /** Where its fade starts wanders between this share of the room left over and all of it. */
  least: 0.35,
  /** Toward a corner of the plate, where another side is the nearer one, the lobe draws back over this many px. */
  corner: 70,
  /**
   * With this little room or less, there is no pencil band beside the box: the pencil ends with the colour.
   * With `roomy` or more, the pencil is left as it is (the box is barely within the edge's reach).
   */
  tight: 80,
  roomy: 120,
} as const;

function holdsOf(keep: readonly KeepBox[] | undefined): Hold[] {
  const holds: Hold[] = [];
  for (const [left, top, right, bottom] of (keep ?? []).filter((box) => !isHug(box))) {
    // Each side of the plate the box is within the edge's reach of.
    const sides: Array<[Hold['side'], number, number, number]> = [
      ['top', left, right, top],
      ['bottom', left, right, PLATE.h - bottom],
      ['left', top, bottom, left],
      ['right', top, bottom, PLATE.w - right],
    ];
    for (const [side, from, to, room] of sides) if (room < PENCIL_REACH) holds.push({ side, from, to, room });
  }
  return holds;
}

/**
 * Raise both edges, at a point `din` inside the plate, to what the boxes near it need: over a box and a
 * little to each side, the painting is whole from the box's outer side inward; further along, the lobe
 * draws back until the ordinary edge takes over. `wander` is the same noise that moves the ordinary edge.
 */
function lift(holds: readonly Hold[], x: number, y: number, din: number, wander: number, out: Wash): void {
  const p = PENCIL;
  for (const hold of holds) {
    const level = hold.side === 'top' || hold.side === 'bottom';
    // The lobe is measured from its own side of the plate, and belongs to the part of the plate that side governs.
    const across = hold.side === 'top' ? y : hold.side === 'bottom' ? PLATE.h - y : hold.side === 'left' ? x : PLATE.w - x;
    if (across >= PENCIL_REACH) continue;
    const other = level ? Math.min(x, PLATE.w - x) : Math.min(y, PLATE.h - y);
    const mine = smooth((other - across + HOLD.corner) / HOLD.corner);
    if (mine <= 0) continue;
    const along = level ? x : y;
    const off = along < hold.from ? hold.from - along : along > hold.to ? along - hold.to : 0;
    if (off >= HOLD.margin + HOLD.ease) continue;
    const away = smooth((off - HOLD.margin) / HOLD.ease);
    const back = (away + (1 - mine)) * PENCIL_REACH;
    const width = Math.max(1, Math.min(HOLD.width, hold.room * HOLD.share));
    const start = Math.max(0, hold.room - width - 1) * (HOLD.least + (1 - HOLD.least) * (0.5 + 0.5 * wander)) + back;
    const rim = smooth(din / p.rim);
    const paint = smooth((across - start) / width) * rim;
    if (paint > out.paint) out.paint = paint;
    // No pencil band beside the box: there the pencil ends with the colour. It comes back as the lobe draws back.
    const beside = (1 - away) * mine * smooth((HOLD.roomy - hold.room) / (HOLD.roomy - HOLD.tight));
    out.pencil = Math.max(out.paint, out.pencil - (out.pencil - out.paint) * beside);
  }
}

const sum = (values: readonly number[]): number => {
  let total = 0;
  for (const value of values) total += value;
  return total;
};

function pencilWash(seed: number, keep?: readonly KeepBox[]): (x: number, y: number, out: Wash) => void {
  const o = ORGANIC;
  const radius = o.radius * PLATE.w;
  const holds = holdsOf(keep);
  const hugs = hugsOf(keep);
  /** Layered value noise, from about -1 to 1. */
  const layers = (cells: readonly number[], weights: readonly number[], salt: number) => (x: number, y: number): number => {
    let total = 0;
    for (let i = 0; i < cells.length; i++) total += (2 * noise(x, y, cells[i], seed + salt + i) - 1) * weights[i];
    return total / sum(weights);
  };
  const wanderAt = layers(o.cells, o.weights, 0);
  const swingAt = layers(o.widthCells, o.widthWeights, 100);
  return (x, y, out) => {
    const din = inside(x, y, radius);
    if (din <= 0) out.paint = out.pencil = 0;
    else if (din >= PENCIL_REACH) out.paint = out.pencil = 1;
    else {
      const wander = wanderAt(x, y);
      const swing = swingAt(x, y);
      washFrom(din, bottomOf(y), wander, swing, out);
      if (holds.length) lift(holds, x, y, din, wander, out);
      if (hugs) hug(hugs, x, y, din, wander, swing, out);
    }
  };
}

/**
 * One layer of the same noise, set up to be read along rows of pixels: its lattice is worked out once, as
 * is everything that depends only on the column, and each row first blends the two lattice rows it lies
 * between. Reading a pixel is then two look-ups. (Several times quicker than asking point by point; the
 * answers agree to a dozen decimal places, the blending being done in the other order: edge.test.ts.)
 * `x0` and `w`: the columns, in plate px; each is read at its middle.
 */
function rowNoise(cell: number, seed: number, x0: number, w: number): { row: (y: number) => void; at: (i: number) => number } {
  const first = Math.floor((x0 + 0.5) / cell);
  const cols = Math.floor((x0 + w - 0.5) / cell) - first + 2;
  const rows = Math.ceil(PLATE.h / cell) + 2;
  const table = new Float64Array(cols * rows);
  for (let iy = 0; iy < rows; iy++) for (let ix = 0; ix < cols; ix++) table[iy * cols + ix] = lattice(first + ix, iy, seed);
  const column = new Int32Array(w);
  const sx = new Float64Array(w);
  for (let i = 0; i < w; i++) {
    const fx = (x0 + i + 0.5) / cell;
    const ix = Math.floor(fx);
    const tx = fx - ix;
    column[i] = ix - first;
    sx[i] = tx * tx * (3 - 2 * tx);
  }
  /** This row's lattice: the row above and the row below, blended. */
  const blend = new Float64Array(cols);
  return {
    row: (y) => {
      const fy = y / cell;
      const iy = Math.floor(fy);
      const ty = fy - iy;
      const sy = ty * ty * (3 - 2 * ty);
      const upper = iy * cols;
      for (let ix = 0; ix < cols; ix++) blend[ix] = table[upper + ix] + (table[upper + cols + ix] - table[upper + ix]) * sy;
    },
    at: (i) => {
      const c = column[i];
      return blend[c] + (blend[c + 1] - blend[c]) * sx[i];
    },
  };
}

/**
 * The pencil edge along rows of pixels, for drawing it: set the row, then ask column by column. Gives what
 * pencilWash() gives at each pixel's middle (to a dozen decimal places), and the break-up noise there. `x0`, `w`: the columns (plate px,
 * inside the plate).
 */
export function pencilRows(seed: number, x0: number, w: number, keep?: readonly KeepBox[]): { row: (y: number) => void; at: (i: number, out: Wash) => void; breakUp: (i: number) => number } {
  const o = ORGANIC;
  const radius = o.radius * PLATE.w;
  const holds = holdsOf(keep);
  const hugs = hugsOf(keep);
  const wander = o.cells.map((cell, i) => rowNoise(cell, seed + i, x0, w));
  const swing = o.widthCells.map((cell, i) => rowNoise(cell, seed + 100 + i, x0, w));
  const breaks = rowNoise(PENCIL.breakCell, seed + PENCIL.breakSalt, x0, w);
  const all = [...wander, ...swing, breaks];
  const wanderTotal = sum(o.weights);
  const swingTotal = sum(o.widthWeights);
  let y = 0;
  let bottom = 0;
  return {
    row: (rowY) => {
      y = rowY;
      bottom = bottomOf(y);
      for (const layer of all) layer.row(y);
    },
    at: (i, out) => {
      const din = inside(x0 + i + 0.5, y, radius);
      if (din <= 0) {
        out.paint = out.pencil = 0;
        return;
      }
      if (din >= PENCIL_REACH) {
        out.paint = out.pencil = 1;
        return;
      }
      let line = 0;
      for (let n = 0; n < wander.length; n++) line += (2 * wander[n].at(i) - 1) * o.weights[n];
      let width = 0;
      for (let n = 0; n < swing.length; n++) width += (2 * swing[n].at(i) - 1) * o.widthWeights[n];
      washFrom(din, bottom, line / wanderTotal, width / swingTotal, out);
      if (holds.length) lift(holds, x0 + i + 0.5, y, din, line / wanderTotal, out);
      if (hugs) hug(hugs, x0 + i + 0.5, y, din, line / wanderTotal, width / swingTotal, out);
    },
    breakUp: (i) => breaks.at(i),
  };
}

/** How far the pencil reaches at a point of the plate: 0 where there is none, 1 from where it is at full strength. */
export function pencilReach(seed: number, keep?: readonly KeepBox[]): (x: number, y: number) => number {
  const at = pencilWash(seed, keep);
  const out: Wash = { paint: 0, pencil: 0 };
  return (x, y) => (at(x, y, out), out.pencil);
}

/**
 * How much of the painting shows at a point of the plate (plate px): 0 on the paper, 1 well inside.
 * In between, a smoothstep.
 */
export function edgeAlpha(style: EdgeStyle, seed: number, keep?: readonly KeepBox[]): (x: number, y: number) => number {
  if (style === 'pencil') {
    const at = pencilWash(seed, keep);
    const out: Wash = { paint: 0, pencil: 0 };
    return (x, y) => (at(x, y, out), out.paint);
  }
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
  // The box is placed on whole CSS pixels, so it is tested a little larger than it is: a CSS pixel and a few
  // plate px on every side.
  const mw = w + 2 / u + 8;
  const mh = h + 2 / u + 8;
  for (let step = 0; step < 120 && lowestAlpha(alpha, cx, cy, mw, mh) < SOLID; step++) {
    // One small step toward the middle of the plate, along whichever axis helps more.
    if (lowestAlpha(alpha, cx + dx, cy, mw, mh) > lowestAlpha(alpha, cx, cy + dy, mw, mh)) cx += dx;
    else cy += dy;
  }
  // Never so far that the drawing is no longer under its own box (a phone on its side, where 44 px is a large part
  // of the room: there a little of the box may lie over the soft edge).
  cx = Math.min(art.cx + (w - art.w) / 2, Math.max(art.cx - (w - art.w) / 2, cx));
  cy = Math.min(art.cy + (h - art.h) / 2, Math.max(art.cy - (h - art.h) / 2, cy));
  return { cx, cy, w, h };
}

/** The painting's edge on the page: the layer that goes on the plate, above everything in it. */
export interface Edge {
  readonly el: HTMLDivElement;
  /**
   * Work the edge out and draw it, a few milliseconds at a time. Resolves when it is complete; at once if it
   * already is. (A scene makes its edge when it goes on show and gives it back when it leaves: see release().)
   */
  make(): Promise<void>;
  /** Give the pixels back. make() draws it again. */
  release(): void;
  /** All of it is drawn. */
  readonly whole: boolean;
  /** What its canvases take, in bytes (and, while it is being made, the line map being read). */
  readonly bytes: number;
  /** Copy it onto another canvas, over a plate drawn at this rectangle. */
  draw(ctx: CanvasRenderingContext2D, left: number, top: number, width: number, height: number): void;
}

/** One canvas of the edge, and the part of the plate it covers (plate px). */
interface Strip {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
}

function stripOn(el: HTMLElement, x: number, y: number, w: number, h: number): Strip {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 0;
  canvas.style.left = `${(x / PLATE.w) * 100}%`;
  canvas.style.top = `${(y / PLATE.h) * 100}%`;
  canvas.style.width = `${(w / PLATE.w) * 100}%`;
  canvas.style.height = `${(h / PLATE.h) * 100}%`;
  el.append(canvas);
  return { canvas, x, y, w, h };
}

/** Lets the page take a turn (an input, a frame) and comes straight back: no timer's minimum wait. */
function breathe(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(0);
  });
}
/** The longest the page's thread is kept at one go while an edge is made, in ms. */
const SLICE_MS = 7;

/**
 * The four strips of the pencil edge, in plate px: the top and bottom ones run the plate's whole width, the
 * side ones fill in between. Inside them all the painting is solid (edge.test.ts holds every scene to it),
 * so nothing is drawn there. The side strips lap `lap` px under the top and bottom ones: across the lap
 * each fades out as the other fades in, so that no seam shows where two canvases meet, at any zoom.
 */
export const STRIPS = {
  top: { x: 0, y: 0, w: PLATE.w, h: BAND.top },
  bottom: { x: 0, y: PLATE.h - BAND.bottom, w: PLATE.w, h: BAND.bottom },
  left: { x: 0, y: BAND.top - BAND.lap, w: BAND.side, h: PLATE.h - BAND.top - BAND.bottom + 2 * BAND.lap },
  right: { x: PLATE.w - BAND.side, y: BAND.top - BAND.lap, w: BAND.side, h: PLATE.h - BAND.top - BAND.bottom + 2 * BAND.lap },
} as const;

/**
 * The share of the edge a strip carries at a point: 1 everywhere but in a lap, where the two strips'
 * shares add up to 1. (A strip carrying share `s` of an edge of opacity `a` is drawn at 1 - (1 - a)^s:
 * one over the other, the two come to `a` exactly.)
 */
function share(name: keyof typeof STRIPS, x: number, y: number): number {
  if (x >= BAND.side && x < PLATE.w - BAND.side) return 1;
  const fromTop = (y - (BAND.top - BAND.lap)) / BAND.lap;
  const fromBottom = (PLATE.h - BAND.bottom + BAND.lap - y) / BAND.lap;
  // The side strip's share: none at its own ends, all of it past the lap.
  const side = Math.min(1, Math.max(0, fromTop), Math.max(0, fromBottom));
  return name === 'left' || name === 'right' ? side : 1 - side;
}

/**
 * The edge of a scene. `lines` is the address of the scene's pencil line maps, without the `-tb.webp` and
 * `-lr.webp` they end in (scripts/build-assets.mjs cuts them from scene/pencil/); without it, or if they
 * cannot be fetched, the colour fades the same way and there is simply no pencil. `keep`: see KeepBox.
 */
export function makeEdge(style: EdgeStyle, seed: number, paper: [number, number, number], lines?: string, keep?: readonly KeepBox[]): Edge {
  const el = document.createElement('div');
  el.className = 'hj-edge';
  el.setAttribute('aria-hidden', 'true');
  let made: Promise<void> | null = null;
  /** Counts release()s, so that a making under way knows it has been called off. */
  let round = 0;
  let working = 0;

  if (style !== 'pencil') {
    // The comparison styles: one small canvas, stretched over the plate (dev only).
    const strip = stripOn(el, 0, 0, PLATE.w, PLATE.h);
    return {
      el,
      make: () => (made ??= Promise.resolve(flatEdge(strip.canvas, style, seed, paper))),
      release: () => {
        made = null;
        strip.canvas.width = strip.canvas.height = 0;
      },
      get whole() {
        return strip.canvas.width > 0;
      },
      get bytes() {
        return strip.canvas.width * strip.canvas.height * 4;
      },
      draw: (ctx, left, top, width, height) => {
        if (strip.canvas.width) ctx.drawImage(strip.canvas, left, top, width, height);
      },
    };
  }

  const strips = (Object.keys(STRIPS) as (keyof typeof STRIPS)[]).map((name) => ({ name, ...stripOn(el, STRIPS[name].x, STRIPS[name].y, STRIPS[name].w, STRIPS[name].h) }));
  // The line maps, as downloaded: small, and kept, so the edge can be drawn again without the network.
  const files = lines
    ? [`${lines}-tb.webp`, `${lines}-lr.webp`].map((path) => {
        const file = fetchBlob(asset(path));
        file.catch((error) => console.warn(`[hjaas] ${path}: the pencil lines could not be loaded; the edge is drawn without them`, error));
        return file;
      })
    : null;
  // Where each strip's lines are in the two maps: top over bottom in one, left beside right in the other.
  const inMap = { top: [0, 0, 0], bottom: [0, 0, BAND.top], left: [1, 0, 0], right: [1, BAND.side, 0] } as const;
  const MAP_SIZES = [{ w: PLATE.w, h: BAND.top + BAND.bottom }, { w: 2 * BAND.side, h: STRIPS.left.h }];

  /**
   * Rows `from` up to `to` of a strip: `data` holds the strip's pencil lines when `lined` (their red is the
   * line's strength) and is turned, where it lies, into the edge's own pixels.
   */
  const out: Wash = { paint: 0, pencil: 0 };
  const fill = (data: Uint8ClampedArray, strip: Strip & { name: keyof typeof STRIPS }, wash: ReturnType<typeof pencilRows>, from: number, to: number, lined: boolean): void => {
    const p = PENCIL;
    const w = strip.w;
    const [r, g, b] = paper;
    const toR = p.graphite[0] - r;
    const toG = p.graphite[1] - g;
    const toB = p.graphite[2] - b;
    for (let j = from; j < to; j++) {
      const y = strip.y + j + 0.5;
      wash.row(y);
      // In a lap this strip carries only its share of the edge, where the other strip is too.
      const lap = share(strip.name, 0, y);
      for (let i = 0; i < w; i++) {
        const k = (j * w + i) * 4;
        wash.at(i, out);
        const cover = 1 - out.paint;
        if (cover <= 0) {
          data[k] = data[k + 1] = data[k + 2] = data[k + 3] = 0;
          continue;
        }
        // The pencil: the room's lines as far as the pencil reaches, breaking up as they go outward.
        const line = lined ? data[k] : 0;
        if (line > 0 && out.pencil > 0) {
          const keep = smooth((wash.breakUp(i) - (1 - out.pencil) * p.breakReach + p.breakLift) / p.breakSoft);
          const pen = (line / 255) * out.pencil * keep * p.strength;
          // (Whole numbers: a typed array rounds a fraction itself, but slowly.)
          data[k] = (r + toR * pen + 0.5) | 0;
          data[k + 1] = (g + toG * pen + 0.5) | 0;
          data[k + 2] = (b + toB * pen + 0.5) | 0;
        } else {
          data[k] = r;
          data[k + 1] = g;
          data[k + 2] = b;
        }
        const x = strip.x + i;
        const s = lap < 1 && (x < BAND.side || x >= PLATE.w - BAND.side) ? lap : 1;
        data[k + 3] = ((s === 1 ? cover : 1 - Math.pow(1 - cover, s)) * 255 + 0.5) | 0;
      }
    }
  };

  const draw = async (mine: number): Promise<void> => {
    const scratch = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    let until = 0;
    /** Before each few rows: hand the thread back if this slice has had its time. False: called off. */
    const turn = async (): Promise<boolean> => {
      if (performance.now() >= until) {
        await breathe();
        until = performance.now() + SLICE_MS;
      }
      return mine === round;
    };
    try {
      for (let map = 0; map < 2; map++) {
        let source: Frame | null = null;
        if (files && scratch) {
          source = await files[map].then(decodeBlob).catch(() => null);
          const size = source ? frameSize(source) : null;
          if (source && (size!.w !== MAP_SIZES[map].w || size!.h !== MAP_SIZES[map].h)) {
            console.warn(`[hjaas] ${lines}: the pencil lines are not the size of the edge's strips (run npm run assets); the edge is drawn without them`);
            releaseFrame(source);
            source = null;
          }
        }
        if (mine !== round) {
          if (source) releaseFrame(source);
          return;
        }
        working = source ? MAP_SIZES[map].w * MAP_SIZES[map].h * 4 : 0;
        try {
          for (const strip of strips) {
            const [which, mx, my] = inMap[strip.name];
            if (which !== map) continue;
            const { canvas, w, h } = strip;
            const wash = pencilRows(seed, strip.x, w, keep);
            // The strip's lines, read back as numbers once (their red is the line's strength), and then
            // turned into the edge where they are.
            let image: ImageData;
            if (source && scratch) {
              scratch.canvas.width = w;
              scratch.canvas.height = h;
              scratch.globalCompositeOperation = 'copy';
              scratch.drawImage(source, mx, my, w, h, 0, 0, w, h);
              image = scratch.getImageData(0, 0, w, h);
              scratch.canvas.width = scratch.canvas.height = 0;
            } else {
              image = new ImageData(w, h);
            }
            // A few rows between looks at the clock: a wide strip's rows are long.
            const rows = w > 400 ? 4 : 24;
            for (let y0 = 0; y0 < h; y0 += rows) {
              if (!(await turn())) return;
              fill(image.data, strip, wash, y0, Math.min(h, y0 + rows), source !== null);
            }
            // The canvas gets its pixels only now, whole.
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d')!.putImageData(image, 0, 0);
          }
        } finally {
          if (source) releaseFrame(source);
          working = 0;
        }
      }
    } finally {
      if (scratch) scratch.canvas.width = scratch.canvas.height = 0;
    }
  };

  return {
    el,
    make: () => (made ??= draw(round)),
    release: () => {
      round++;
      made = null;
      for (const strip of strips) strip.canvas.width = strip.canvas.height = 0;
    },
    get whole() {
      // (Each strip's canvas gets its pixels only when they are all worked out.)
      return strips.every((strip) => strip.canvas.width > 0);
    },
    get bytes() {
      return strips.reduce((sum, strip) => sum + strip.canvas.width * strip.canvas.height * 4, working);
    },
    draw: (ctx, left, top, width, height) => {
      const kx = width / PLATE.w;
      const ky = height / PLATE.h;
      for (const strip of strips) {
        if (strip.canvas.width) ctx.drawImage(strip.canvas, left + strip.x * kx, top + strip.y * ky, strip.w * kx, strip.h * ky);
      }
    },
  };
}

/**
 * One of the comparison edges, drawn on a canvas in the paper's colour: opaque where the painting does not
 * show, clear where it does. It is drawn at a fraction of the plate's size and the browser stretches it
 * over the plate: a quarter for the even feathers, half for the organic edge, whose crisp places and fine
 * wander need the detail.
 */
function flatEdge(canvas: HTMLCanvasElement, style: EdgeStyle, seed: number, paper: [number, number, number]): void {
  const shrink = style === 'organic' ? 2 : 4;
  const w = (canvas.width = PLATE.w / shrink);
  const h = (canvas.height = Math.round(PLATE.h / shrink));
  const ctx = canvas.getContext('2d')!;
  const alpha = edgeAlpha(style, seed);
  const sx = PLATE.w / w;
  const sy = PLATE.h / h;
  const image = ctx.createImageData(w, h);
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
}

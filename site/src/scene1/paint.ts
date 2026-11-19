// "Painted into existence": the room appears as loose brush strokes, region by region.
//
// How it holds frame rate: the brush lays plain, solid strokes onto a hidden canvas, the stencil. After
// each frame's strokes, only the patch they touched is redrawn on the visible canvas: the stencil's patch,
// then the room's own pixels kept only where the stencil has paint. Both are straight copies between
// canvases of the same size, which every browser does quickly.
// (Until review 03 the strokes were drawn with the room image as a canvas pattern. Chrome is quick at that;
// Safari's engine is not: measured in WebKit on a Mac, the painting ran at 10 frames a second or fewer.)
//
// The wash happens on the same canvases, and the visible one then stays on as the room: nothing is swapped
// at the end. Where nothing is painted yet the canvas is clear, and the blank sheet under it shows through.
// There are no mask images; the strokes are a few hand-placed paths, roughened by a seeded generator.
import { PLATE } from './assets';
import { EASE_STROKE } from './motion';
import { seeded, type Rng } from './schedule';

interface StrokePlan {
  /** Control points in plate px. The brush follows a smooth curve through them. */
  via: Array<[number, number]>;
  width: number;
  /** Seconds from the start of the intro. */
  at: number;
  /** Seconds the stroke takes. */
  takes: number;
}

// Back wall -> window light -> floor -> props. Walls and floor leave the props' corners for the last strokes.
// Unhurried: each stroke takes 0.48 to 1.28 s, and they overlap unevenly, so the painting runs 4.32 s.
const STROKES: StrokePlan[] = [
  // Back wall
  { via: [[890, 80], [1250, 95], [1275, 255], [905, 265], [890, 425], [1275, 440]], width: 250, at: 0, takes: 1.24 },
  { via: [[1690, 40], [-10, 45], [-10, 165], [700, 170]], width: 195, at: 0.28, takes: 1.12 },
  { via: [[1275, 590], [900, 565]], width: 225, at: 0.72, takes: 0.6 },
  // Window light
  { via: [[30, 265], [700, 255], [725, 400], [40, 405], [20, 545], [720, 545]], width: 235, at: 1.12, takes: 1.28 },
  { via: [[805, 130], [795, 640]], width: 245, at: 1.68, takes: 0.68 },
  // Floor
  { via: [[900, 690], [545, 655], [545, 765], [1265, 775]], width: 195, at: 2.12, takes: 1 },
  { via: [[1275, 880], [520, 870]], width: 225, at: 2.48, takes: 0.8 },
  { via: [[560, 948], [1275, 952]], width: 150, at: 2.8, takes: 0.56 },
  // Props
  { via: [[60, 440], [265, 600], [60, 720], [335, 800], [120, 925], [490, 905]], width: 235, at: 2.88, takes: 1.04 },
  { via: [[425, 615], [505, 700], [645, 700]], width: 150, at: 3.24, takes: 0.48 },
  { via: [[1345, 90], [1320, 420]], width: 180, at: 3.12, takes: 0.56 },
  { via: [[1485, 60], [1400, 480], [1300, 865]], width: 235, at: 3.24, takes: 0.76 },
  { via: [[1605, 80], [1640, 500], [1505, 700], [1645, 905]], width: 245, at: 3.52, takes: 0.8 },
];

/** When the last stroke lifts off, in seconds (before any time scaling). */
export const PAINT_SECONDS = Math.max(...STROKES.map((stroke) => stroke.at + stroke.takes));

interface Bristle {
  offset: number; // across the stroke, in plate px
  width: number;
  lead: number; // how far ahead of (or behind) the brush centre this bristle runs, in plate px
  alpha: number;
  wobble: number;
  phase: number;
}

interface Stroke {
  plan: StrokePlan;
  // The path, sampled every few px: position, unit normal, and distance along the path.
  x: Float32Array;
  y: Float32Array;
  nx: Float32Array;
  ny: Float32Array;
  length: number;
  step: number;
  bristles: Bristle[];
  drawn: number; // how far along the path has been painted, in plate px
}

const SAMPLE_PX = 9;

/** A smooth curve through the control points (Catmull-Rom), sampled at even steps. */
function buildStroke(plan: StrokePlan, rnd: Rng): Stroke {
  const pts = plan.via;
  const dense: Array<[number, number]> = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const steps = Math.max(8, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 6));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const a = -0.5 * t3 + t2 - 0.5 * t;
      const b = 1.5 * t3 - 2.5 * t2 + 1;
      const c = -1.5 * t3 + 2 * t2 + 0.5 * t;
      const d = 0.5 * t3 - 0.5 * t2;
      dense.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
    }
  }
  dense.push(pts[pts.length - 1]);

  // Resample at even arc length.
  const xs: number[] = [dense[0][0]];
  const ys: number[] = [dense[0][1]];
  let carry = 0;
  for (let i = 1; i < dense.length; i++) {
    let [ax, ay] = dense[i - 1];
    const [bx, by] = dense[i];
    let seg = Math.hypot(bx - ax, by - ay);
    while (carry + seg >= SAMPLE_PX) {
      const t = (SAMPLE_PX - carry) / seg;
      ax += (bx - ax) * t;
      ay += (by - ay) * t;
      xs.push(ax);
      ys.push(ay);
      seg = Math.hypot(bx - ax, by - ay);
      carry = 0;
    }
    carry += seg;
  }
  const n = xs.length;
  const x = Float32Array.from(xs);
  const y = Float32Array.from(ys);
  const nx = new Float32Array(n);
  const ny = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    const dx = x[b] - x[a];
    const dy = y[b] - y[a];
    const len = Math.hypot(dx, dy) || 1;
    nx[i] = -dy / len;
    ny[i] = dx / len;
  }

  // A brush is a row of bristles. The middle ones lay the paint down; the outer ones run thin, streaky
  // and a little late, which is what makes the edge look brushed rather than cut.
  const w = plan.width;
  const bristles: Bristle[] = [];
  const core = 6;
  for (let i = 0; i < core; i++) {
    const across = (i / (core - 1) - 0.5) * 0.72;
    bristles.push({
      offset: across * w + (rnd() - 0.5) * w * 0.05,
      width: w * (0.24 + rnd() * 0.07),
      // Uneven leads give the front of the stroke its fingers.
      lead: (rnd() - 0.5) * w * 0.7,
      alpha: 1,
      wobble: w * 0.014,
      phase: rnd() * 6.28,
    });
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      bristles.push({
        offset: side * w * (0.47 + i * 0.05 + rnd() * 0.025),
        width: w * (0.03 + rnd() * 0.055),
        lead: -w * (0.05 + rnd() * 0.6),
        alpha: 0.55 + rnd() * 0.4,
        wobble: w * 0.022,
        phase: rnd() * 6.28,
      });
    }
  }

  return { plan, x, y, nx, ny, length: (n - 1) * SAMPLE_PX, step: SAMPLE_PX, bristles, drawn: 0 };
}


/** A patch of the canvas, in canvas pixels. */
interface Patch {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export class Painter {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  /** Where the brush has been: solid strokes, never shown. */
  private readonly stencil: HTMLCanvasElement;
  private readonly brush: CanvasRenderingContext2D;
  /** The room at the canvas's own size, so painting a patch is a straight copy. */
  private readonly room: HTMLCanvasElement;
  private readonly strokes: Stroke[];
  private readonly k: number;
  private dirty: Patch | null = null;
  private washed = 0;
  private begun = false;

  constructor(room: CanvasImageSource, cssWidth: number, seed = 11) {
    // Enough pixels to look painted, few enough to stay fast: at most 2x, and never more than ~2.2 MP.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssHeight = (cssWidth * PLATE.h) / PLATE.w;
    const fit = Math.min(1, Math.sqrt(2_200_000 / (cssWidth * dpr * cssHeight * dpr)));
    const k = (cssWidth * dpr * fit) / PLATE.w;
    this.k = k;
    const width = Math.round(PLATE.w * k);
    const height = Math.round(PLATE.h * k);
    const sheet = (): HTMLCanvasElement => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    };

    this.canvas = sheet();
    this.canvas.className = 'hj-paint';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d')!;

    this.room = sheet();
    const roomCtx = this.room.getContext('2d')!;
    roomCtx.imageSmoothingQuality = 'high';
    roomCtx.drawImage(room, 0, 0, width, height);

    this.stencil = sheet();
    this.brush = this.stencil.getContext('2d')!;
    // The brush draws in plate px.
    this.brush.setTransform(k, 0, 0, k, 0, 0);
    this.brush.lineCap = 'round';
    this.brush.lineJoin = 'round';
    this.brush.strokeStyle = '#000';
    this.brush.fillStyle = '#000';

    const rnd = seeded(seed);
    this.strokes = STROKES.map((plan) => buildStroke(plan, rnd));

    // Run the whole sheet through every step once, empty, so neither the first stroke nor the first frame
    // of the wash (the only full-sheet frames) has anything to set up.
    this.dirty = { x0: 0, y0: 0, x1: width, y1: height };
    this.show();
  }

  /** True until the first stroke is laid: a blank sheet, ready to be painted. */
  get fresh(): boolean {
    return !this.begun;
  }

  /** Paint everything due by `seconds`. Returns true once every stroke is finished. */
  paintTo(seconds: number): boolean {
    this.begun = true;
    let done = true;
    for (const stroke of this.strokes) {
      const { plan } = stroke;
      const t = (seconds - plan.at) / plan.takes;
      if (t <= 0) {
        done = false;
        continue;
      }
      // The brush centre runs a little past the end so the trailing bristles finish too.
      const reach = stroke.length + plan.width * 0.6;
      // The hand speeds up into a stroke and eases off at the end.
      const target = EASE_STROKE(Math.min(1, t)) * reach;
      if (target > stroke.drawn) {
        this.lay(stroke, stroke.drawn, target);
        stroke.drawn = target;
      }
      if (t < 1) done = false;
    }
    this.show();
    return done;
  }

  /**
   * The wash: the whole plate comes up under the strokes, `amount` from 0 to 1. Laying a thin, even coat
   * over the stencil takes every pixel's coverage from c to c + amount × (1 − c), which is exactly what the
   * strokes over a fading copy of the plate would give.
   */
  wash(amount: number): void {
    if (amount <= this.washed) return;
    if (amount >= 1) {
      // The room is complete: draw it whole, and let go of the two working canvases.
      this.washed = 1;
      this.dirty = null;
      this.ctx.drawImage(this.room, 0, 0);
      this.stencil.width = this.stencil.height = 0;
      this.room.width = this.room.height = 0;
      return;
    }
    const { brush } = this;
    brush.globalAlpha = 1 - (1 - amount) / (1 - this.washed);
    brush.fillRect(0, 0, PLATE.w, PLATE.h);
    brush.globalAlpha = 1;
    this.washed = amount;
    this.dirty = { x0: 0, y0: 0, x1: this.canvas.width, y1: this.canvas.height };
    this.show();
  }

  /** Lay down the stretch of a stroke between two brush positions, on the stencil. */
  private lay(stroke: Stroke, from: number, to: number): void {
    if (this.washed >= 1) return;
    const { brush } = this;
    const { x, y, nx, ny, step, length } = stroke;
    const last = x.length - 1;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const bristle of stroke.bristles) {
      // Each bristle paints its own stretch; a small overlap with the previous frame hides the joins.
      const a = Math.max(0, from + bristle.lead - step);
      const b = Math.min(length, to + bristle.lead);
      if (b <= a) continue;
      const i0 = Math.floor(a / step);
      const i1 = Math.min(last, Math.ceil(b / step));
      if (i1 <= i0) continue;
      const reach = bristle.width / 2 + 2;
      brush.globalAlpha = bristle.alpha;
      brush.lineWidth = bristle.width;
      brush.beginPath();
      for (let i = i0; i <= i1; i++) {
        const off = bristle.offset + Math.sin(i * 0.21 + bristle.phase) * bristle.wobble;
        const px = x[i] + nx[i] * off;
        const py = y[i] + ny[i] * off;
        if (i === i0) brush.moveTo(px, py);
        else brush.lineTo(px, py);
        if (px - reach < minX) minX = px - reach;
        if (px + reach > maxX) maxX = px + reach;
        if (py - reach < minY) minY = py - reach;
        if (py + reach > maxY) maxY = py + reach;
      }
      brush.stroke();
    }
    brush.globalAlpha = 1;
    if (minX > maxX) return;

    // Remember the patch this touched, in canvas pixels.
    const { k, canvas } = this;
    const patch = {
      x0: Math.max(0, Math.floor(minX * k) - 1),
      y0: Math.max(0, Math.floor(minY * k) - 1),
      x1: Math.min(canvas.width, Math.ceil(maxX * k) + 1),
      y1: Math.min(canvas.height, Math.ceil(maxY * k) + 1),
    };
    const d = this.dirty;
    this.dirty = d
      ? { x0: Math.min(d.x0, patch.x0), y0: Math.min(d.y0, patch.y0), x1: Math.max(d.x1, patch.x1), y1: Math.max(d.y1, patch.y1) }
      : patch;
  }

  /** Bring the visible canvas up to date: the room's pixels, wherever the stencil now has paint. */
  private show(): void {
    const d = this.dirty;
    if (!d) return;
    this.dirty = null;
    const w = d.x1 - d.x0;
    const h = d.y1 - d.y0;
    if (w <= 0 || h <= 0) return;
    const { ctx } = this;
    ctx.save();
    // Everything below stays inside the patch, in every browser.
    ctx.beginPath();
    ctx.rect(d.x0, d.y0, w, h);
    ctx.clip();
    ctx.clearRect(d.x0, d.y0, w, h);
    ctx.drawImage(this.stencil, d.x0, d.y0, w, h, d.x0, d.y0, w, h);
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(this.room, d.x0, d.y0, w, h, d.x0, d.y0, w, h);
    ctx.restore();
  }
}

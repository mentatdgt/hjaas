// "Painted into existence": the room appears as loose brush strokes, region by region.
//
// How it holds frame rate: the finished picture (the room and its mushrooms) is already on the page, drawn
// once before anything moves, under a sheet: one canvas filled with the blank paper's colour (a first
// visit) or with a picture of the scene being left (a switch between scenes). Each brush stroke rubs that
// sheet away along its path. A frame is a handful of plain strokes on one canvas; the browser never redraws
// the room. The wash thins what is left of the sheet until nothing remains.
//
// (Until review 03 the strokes were drawn with the room image as a canvas pattern. Chrome is quick at that;
// Safari's engine is not: measured in WebKit on a Mac, the painting ran at 10 to 20 frames a second.)
//
// There are no mask images; the strokes are a few hand-placed paths, roughened by a seeded generator.
import { EASE_STROKE } from './motion';
import { seeded, type Rng } from './steps';
import type { StrokePlan } from './types';

const PLATE_W = 1672;

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


export interface SheetOptions {
  /** The sheet's size on the page, in CSS px. */
  width: number;
  height: number;
  /** Fills the fresh sheet. It is given the context in sheet CSS px. */
  fill: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  strokes: readonly StrokePlan[];
  /** Plays the strokes this many times faster (the short brush between scenes). */
  pace?: number;
  /** Most pixels the sheet may have. A plain colour needs few; a picture needs more. */
  maxPixels?: number;
  seed?: number;
}

export class Painter {
  /** The sheet over the picture. Fully clear once the wash is done. */
  readonly canvas: HTMLCanvasElement;
  /** When the last stroke lifts off, in seconds. */
  readonly seconds: number;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly strokes: Stroke[];
  private readonly pace: number;
  /** Canvas pixels per CSS px. */
  private readonly px: number;
  private readonly size: { width: number; height: number };
  /** The sheet's extent in plate px. */
  private span = { x: 0, w: 0, h: 0 };
  private washed = 0;
  private begun = false;

  constructor(options: SheetOptions) {
    const { width, height, pace = 1, maxPixels = 1_100_000, seed = 11 } = options;
    // At most 2x, and never more than `maxPixels`.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fit = Math.min(1, Math.sqrt(maxPixels / (width * dpr * height * dpr)));
    this.px = dpr * fit;
    this.size = { width, height };

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'hj-paint';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.width = Math.round(width * this.px);
    this.canvas.height = Math.round(height * this.px);
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.save();
    this.ctx.setTransform(this.px, 0, 0, this.px, 0, 0);
    options.fill(this.ctx, width, height);
    this.ctx.restore();

    const rnd = seeded(seed);
    this.pace = pace;
    this.strokes = options.strokes.map((plan) => buildStroke(plan, rnd));
    this.seconds = Math.max(...options.strokes.map((stroke) => stroke.at + stroke.takes)) / pace;
    this.aim(width / PLATE_W, 0);
  }

  /**
   * Tell the brush how its plate px map onto the sheet: `unit` CSS px per plate px, and which plate x sits
   * at the sheet's left edge. A sheet over the whole plate is aimed at 0 (the default); a sheet over a
   * phone's window onto the plate, at that window's pan position.
   */
  aim(unit: number, originX: number): void {
    const { ctx } = this;
    const k = unit * this.px;
    // From here on the brush works in plate px, and everything it draws takes the sheet away.
    ctx.setTransform(k, 0, 0, k, -originX * k, 0);
    this.span = { x: originX, w: this.size.width / unit, h: this.size.height / unit };
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#000';
    // One stroke off the edge of the sheet, so the first real one has nothing to set up.
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(originX - 60, -60);
    ctx.lineTo(originX - 40, -40);
    ctx.stroke();
  }

  /** True until the first stroke is laid: a whole sheet, ready to be painted through. */
  get fresh(): boolean {
    return !this.begun;
  }

  /** Paint everything due by `seconds`. Returns true once every stroke is finished. */
  paintTo(seconds: number): boolean {
    this.begun = true;
    const at = seconds * this.pace;
    let done = true;
    for (const stroke of this.strokes) {
      const { plan } = stroke;
      const t = (at - plan.at) / plan.takes;
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
    return done;
  }

  /**
   * The wash: whatever the brush missed comes up evenly, `amount` from 0 to 1. Each call thins the sheet
   * that is left, so the picture's coverage only ever goes from c to c + amount × (1 − c).
   */
  wash(amount: number): void {
    if (amount <= this.washed) return;
    this.begun = true;
    const { ctx, span } = this;
    ctx.globalAlpha = amount >= 1 ? 1 : 1 - (1 - amount) / (1 - this.washed);
    ctx.fillRect(span.x - 2, -2, span.w + 4, span.h + 4);
    ctx.globalAlpha = 1;
    this.washed = Math.min(1, amount);
  }

  /** Rub the sheet away along the stretch of a stroke between two brush positions. */
  private lay(stroke: Stroke, from: number, to: number): void {
    if (this.washed >= 1) return;
    const { ctx } = this;
    const { x, y, nx, ny, step, length } = stroke;
    const last = x.length - 1;
    for (const bristle of stroke.bristles) {
      // Each bristle paints its own stretch; a small overlap with the previous frame hides the joins.
      const a = Math.max(0, from + bristle.lead - step);
      const b = Math.min(length, to + bristle.lead);
      if (b <= a) continue;
      const i0 = Math.floor(a / step);
      const i1 = Math.min(last, Math.ceil(b / step));
      if (i1 <= i0) continue;
      ctx.globalAlpha = bristle.alpha;
      ctx.lineWidth = bristle.width;
      ctx.beginPath();
      for (let i = i0; i <= i1; i++) {
        const off = bristle.offset + Math.sin(i * 0.21 + bristle.phase) * bristle.wobble;
        const px = x[i] + nx[i] * off;
        const py = y[i] + ny[i] * off;
        if (i === i0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

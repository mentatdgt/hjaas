// "Painted into existence": the room appears as loose brush strokes, region by region.
//
// How it holds frame rate: nothing is masked. Each stroke is drawn onto one canvas with the room plate
// itself as the paint (a canvas pattern), and a frame only draws the short new length of each stroke.
// There are no mask images; the strokes are a few hand-placed paths, roughened by a seeded generator.
import { PLATE } from './assets';
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
const STROKES: StrokePlan[] = [
  // Back wall
  { via: [[890, 80], [1250, 95], [1275, 255], [905, 265], [890, 425], [1275, 440]], width: 250, at: 0, takes: 0.62 },
  { via: [[1690, 40], [-10, 45], [-10, 165], [700, 170]], width: 195, at: 0.14, takes: 0.56 },
  { via: [[1275, 590], [900, 565]], width: 225, at: 0.36, takes: 0.3 },
  // Window light
  { via: [[30, 265], [700, 255], [725, 400], [40, 405], [20, 545], [720, 545]], width: 235, at: 0.56, takes: 0.64 },
  { via: [[805, 130], [795, 640]], width: 245, at: 0.84, takes: 0.34 },
  // Floor
  { via: [[900, 690], [545, 655], [545, 765], [1265, 775]], width: 195, at: 1.06, takes: 0.5 },
  { via: [[1275, 880], [520, 870]], width: 225, at: 1.24, takes: 0.4 },
  { via: [[560, 948], [1275, 952]], width: 150, at: 1.4, takes: 0.28 },
  // Props
  { via: [[60, 440], [265, 600], [60, 720], [335, 800], [120, 925], [490, 905]], width: 235, at: 1.44, takes: 0.52 },
  { via: [[425, 615], [505, 700], [645, 700]], width: 150, at: 1.62, takes: 0.24 },
  { via: [[1345, 90], [1320, 420]], width: 180, at: 1.56, takes: 0.28 },
  { via: [[1485, 60], [1400, 480], [1300, 865]], width: 235, at: 1.62, takes: 0.38 },
  { via: [[1605, 80], [1640, 500], [1505, 700], [1645, 905]], width: 245, at: 1.76, takes: 0.4 },
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

// The hand speeds up into a stroke and eases off at the end.
const brushEase = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export class Painter {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly strokes: Stroke[];
  private readonly paint: CanvasPattern;

  constructor(room: CanvasImageSource, cssWidth: number, seed = 11) {
    // Enough pixels to look painted, few enough to stay fast: at most 2x, and never more than ~2.2 MP.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssHeight = (cssWidth * PLATE.h) / PLATE.w;
    const fit = Math.min(1, Math.sqrt(2_200_000 / (cssWidth * dpr * cssHeight * dpr)));
    const k = (cssWidth * dpr * fit) / PLATE.w;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'hj-paint';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.width = Math.round(PLATE.w * k);
    this.canvas.height = Math.round(PLATE.h * k);
    this.ctx = this.canvas.getContext('2d')!;
    // Draw in plate px from here on.
    this.ctx.setTransform(k, 0, 0, k, 0, 0);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.paint = this.ctx.createPattern(room, 'no-repeat')!;
    this.ctx.strokeStyle = this.paint;

    const rnd = seeded(seed);
    this.strokes = STROKES.map((plan) => buildStroke(plan, rnd));
  }

  /** Paint everything due by `seconds`. Returns true once every stroke is finished. */
  paintTo(seconds: number): boolean {
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
      const target = brushEase(Math.min(1, t)) * reach;
      if (target > stroke.drawn) {
        this.lay(stroke, stroke.drawn, target);
        stroke.drawn = target;
      }
      if (t < 1) done = false;
    }
    return done;
  }

  /** Lay down the stretch of a stroke between two brush positions. */
  private lay(stroke: Stroke, from: number, to: number): void {
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

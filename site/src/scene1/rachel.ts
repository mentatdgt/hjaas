import { PLATE, type Frame, frameSize } from './assets';

// Where Rachel sits on the plate (HANDOVER §2), ported from composite() in tools/preview_timing.py:
// the figure is 455 plate px tall, its frame's left edge is at x = 600 and its feet line is at y = 868.
const PLACE = { left: 600, baseline: 868, height: 455 } as const;

// The ground shadow, as in composite(): 0.95 × the frame width, about 30 plate px deep, rgba(60,30,10,0.43).
const SHADOW = { width: 0.95, depth: 0.065 * PLACE.height, inset: 0.02, lift: 0.6, soften: 10 } as const;

export interface Placement {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
}

/** First and last rows of the frame whose alpha is above 10. */
function alphaRows(frame: Frame): { top: number; bot: number } {
  const { w, h } = frameSize(frame);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(frame, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  const rowHasInk = (y: number): boolean => {
    const end = (y + 1) * w * 4;
    for (let i = y * w * 4 + 3; i < end; i += 4) if (data[i] > 10) return true;
    return false;
  };
  let top = 0;
  while (top < h - 1 && !rowHasInk(top)) top++;
  let bot = h - 1;
  while (bot > top && !rowHasInk(bot)) bot--;
  return { top, bot };
}

/** The transform every Rachel frame shares. Computed from the contact frame, so sharper art is a file swap. */
export function placeRachel(contact: Frame): Placement {
  const { w, h } = frameSize(contact);
  const { top, bot } = alphaRows(contact);
  const scale = PLACE.height / (bot - top);
  return {
    left: PLACE.left,
    top: PLACE.baseline - bot * scale,
    width: w * scale,
    height: h * scale,
    scale,
  };
}

const pct = (value: number, of: number): string => `${(value / of) * 100}%`;

export class Rachel {
  readonly el: HTMLDivElement;
  readonly shadow: HTMLDivElement;
  readonly placement: Placement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly frames: Map<string, Frame>;
  private readonly source: { w: number; h: number };
  private pose = '';

  constructor(frames: Map<string, Frame>, contact = 'frame_01') {
    this.frames = frames;
    const first = frames.get(contact);
    if (!first) throw new Error(`Rachel: missing contact frame "${contact}"`);
    this.source = frameSize(first);
    this.placement = placeRachel(first);
    const p = this.placement;

    this.shadow = document.createElement('div');
    this.shadow.className = 'hj-shadow';
    // The box is grown by the blur radius so the gradient can fade to nothing inside it.
    const sw = p.width * SHADOW.width + SHADOW.soften * 2;
    const sh = SHADOW.depth + SHADOW.soften * 2;
    Object.assign(this.shadow.style, {
      left: pct(p.left + p.width * SHADOW.inset - SHADOW.soften, PLATE.w),
      top: pct(PLACE.baseline - SHADOW.depth * SHADOW.lift - SHADOW.soften, PLATE.h),
      width: pct(sw, PLATE.w),
      height: pct(sh, PLATE.h),
    });

    this.el = document.createElement('div');
    this.el.className = 'hj-rachel';
    Object.assign(this.el.style, {
      left: pct(p.left, PLATE.w),
      top: pct(p.top, PLATE.h),
      width: pct(p.width, PLATE.w),
      height: pct(p.height, PLATE.h),
    });

    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d')!;
    this.el.append(this.canvas);

    this.pose = contact;
  }

  add(name: string, frame: Frame): void {
    this.frames.set(name, frame);
  }

  has(name: string): boolean {
    return this.frames.has(name);
  }

  get current(): string {
    return this.pose;
  }

  /** Match the canvas to the pixels it covers on screen. Call after layout changes. */
  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cssW = this.el.clientWidth;
    if (!cssW) return;
    // Never above the art's own resolution: extra pixels would only be interpolated.
    const w = Math.min(Math.round(cssW * dpr), this.source.w);
    const h = Math.round((w * this.source.h) / this.source.w);
    if (this.canvas.width === w && this.canvas.height === h) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.draw();
  }

  /** Switch pose. One draw call on one canvas: there is never a frame with two poses or none. */
  show(name: string): void {
    if (name === this.pose) return;
    if (!this.frames.has(name)) return;
    this.pose = name;
    this.draw();
  }

  private draw(): void {
    const frame = this.frames.get(this.pose);
    if (!frame || !this.canvas.width) return;
    const { ctx, canvas } = this;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // 'copy' replaces every pixel, so the old pose is cleared and the new one drawn in a single step.
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
  }
}

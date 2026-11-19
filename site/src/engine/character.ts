// A scene's character: one canvas that shows one pose at a time, placed on the plate as her scene says.
import { PLATE, type Frame, frameSize, idle } from './assets';
import type { Placement } from './types';

/** What a character needs to know about herself to be drawn. */
export interface CharacterSetup {
  /** The frame she rests on. */
  rest: string;
  placement: Placement;
}

/** A clip frame: one patch, drawn over its base still at (x, y) in the still's own pixels, replacing what was there. */
export interface Patch {
  base: string;
  x: number;
  y: number;
  frame: Frame;
}

// The ground shadow of a standing figure, as in composite() in tools/preview_timing.py:
// 0.95 × the frame width, about 30 plate px deep for a 455 px figure, rgba(60,30,10,0.43).
const SHADOW = { width: 0.95, depth: 0.065, inset: 0.02, lift: 0.6, soften: 10 } as const;
const SHADOW_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 0.43],
  [0.52, 0.4],
  [0.74, 0.24],
  [0.9, 0.08],
  [1, 0],
];

// The most pixels her canvas may have. Scene 1's cut-out frames are well under it; full-plate frames
// (scene 2) are held to it so a pose change stays one cheap draw on a phone.
const MAX_PIXELS = 2_600_000;

export interface Box {
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

/**
 * Where every frame of the character goes on the plate, in plate px. For a standing figure it is worked
 * out from the rest frame's own pixels, so sharper art is only a file swap.
 */
export function place(rest: Frame, placement: Placement): Box {
  const { w, h } = frameSize(rest);
  if (placement.kind === 'box') {
    return { left: placement.x, top: placement.y, width: placement.width, height: placement.height, scale: placement.width / w };
  }
  const { top, bot } = alphaRows(rest);
  const scale = placement.height / (bot - top);
  return { left: placement.left, top: placement.baseline - bot * scale, width: w * scale, height: h * scale, scale };
}

const pct = (value: number, of: number): string => `${(value / of) * 100}%`;

export class Character {
  readonly el: HTMLDivElement;
  /** The soft ground shadow of a standing figure. Null when the frames carry their own. */
  readonly shadow: HTMLDivElement | null = null;
  /** The frame she rests on. */
  readonly rest: string;
  readonly placement: Box;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly frames: Map<string, Frame>;
  private readonly source: { w: number; h: number };
  private readonly patches = new Map<string, Patch>();
  private pose: string;
  /** The whole-canvas frame now on the canvas (under any patch). */
  private drawn = '';
  /** The rectangle of that frame now covered by a patch ('' when it is clean). */
  private patched = '';
  private scratch: CanvasRenderingContext2D | null = null;

  constructor(frames: Map<string, Frame>, config: CharacterSetup) {
    this.frames = frames;
    this.rest = config.rest;
    const first = frames.get(config.rest);
    if (!first) throw new Error(`Character: missing rest frame "${config.rest}"`);
    this.source = frameSize(first);
    this.placement = place(first, config.placement);
    const p = this.placement;

    if (config.placement.kind === 'standing' && config.placement.shadow) {
      const { baseline, height } = config.placement;
      this.shadow = document.createElement('div');
      this.shadow.className = 'hj-shadow';
      // The box is grown by the blur radius so the gradient can fade to nothing inside it.
      const depth = SHADOW.depth * height;
      Object.assign(this.shadow.style, {
        left: pct(p.left + p.width * SHADOW.inset - SHADOW.soften, PLATE.w),
        top: pct(baseline - depth * SHADOW.lift - SHADOW.soften, PLATE.h),
        width: pct(p.width * SHADOW.width + SHADOW.soften * 2, PLATE.w),
        height: pct(depth + SHADOW.soften * 2, PLATE.h),
      });
    }

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

    this.pose = config.rest;
    for (const frame of frames.values()) this.warm(frame);
  }

  add(name: string, frame: Frame): void {
    this.frames.set(name, frame);
    this.warm(frame);
  }

  /** Add a clip frame: a patch over one of her stills. */
  addPatch(name: string, patch: Patch): void {
    this.patches.set(name, patch);
    this.warm(patch.frame);
  }

  has(name: string): boolean {
    return this.frames.has(name) || this.patches.has(name);
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
    const wanted = Math.min(Math.round(cssW * dpr), this.source.w);
    const cap = Math.sqrt((MAX_PIXELS * this.source.w) / this.source.h);
    const w = Math.round(Math.min(wanted, cap));
    const h = Math.round((w * this.source.h) / this.source.w);
    if (this.canvas.width === w && this.canvas.height === h) return;
    const first = this.canvas.width === 0;
    this.canvas.width = w;
    this.canvas.height = h;
    this.drawn = '';
    this.patched = '';
    this.draw();
    // Frames added before the canvas had a size were rehearsed too small: once more, at the real size.
    // One at a time, in quiet moments: together they took a whole frame (measured in WebKit: about 60 ms
    // for scene 2's seven stills), which showed as a hitch when the lab was first opened.
    if (first) {
      const frames = [...this.frames.values()];
      void (async () => {
        for (const frame of frames) {
          await idle();
          this.warm(frame);
        }
      })();
    }
  }

  /** Switch pose. One draw call on one canvas: there is never a frame with two poses or none. */
  show(name: string): void {
    if (name === this.pose) return;
    if (!this.has(name)) return;
    this.pose = name;
    this.draw();
  }

  /**
   * Copy her, as she looks now, onto another canvas (the sheet the brush rubs away when the visitor leaves
   * this scene). `origin` is that canvas's place on the page; the context works in CSS px.
   */
  sketch(ctx: CanvasRenderingContext2D, origin: DOMRect): void {
    if (this.shadow) {
      const s = this.shadow.getBoundingClientRect();
      const cx = s.left - origin.left + s.width / 2;
      const cy = s.top - origin.top + s.height / 2;
      ctx.save();
      // The same soft ellipse as .hj-shadow in site.css.
      ctx.translate(cx, cy);
      ctx.scale(s.width / 2, s.height / 2);
      const soft = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      for (const [at, alpha] of SHADOW_STOPS) soft.addColorStop(at, `rgba(60, 30, 10, ${alpha})`);
      ctx.fillStyle = soft;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
    if (!this.canvas.width) return;
    const r = this.el.getBoundingClientRect();
    ctx.drawImage(this.canvas, r.left - origin.left, r.top - origin.top, r.width, r.height);
  }

  /**
   * Draw a frame once, out of sight and at the size it will be shown, so its first appearance is only a
   * draw call. (Measured in WebKit on a Mac: the first draw of a decoded frame took about 100 ms, which
   * stalled scene 1's first swing and the first frame of scene 2's clips. A tiny rehearsal draw is not
   * enough for the larger frames: it has to be at the real size.)
   */
  private warm(frame: Frame): void {
    this.scratch ??= document.createElement('canvas').getContext('2d');
    const scratch = this.scratch;
    if (!scratch) return;
    const { canvas } = this;
    const s = canvas.width ? canvas.width / this.source.w : 0;
    const size = frameSize(frame);
    const w = Math.max(2, Math.round(size.w * s));
    const h = Math.max(2, Math.round(size.h * s));
    if (scratch.canvas.width < w || scratch.canvas.height < h) {
      scratch.canvas.width = Math.max(scratch.canvas.width, w);
      scratch.canvas.height = Math.max(scratch.canvas.height, h);
    }
    scratch.imageSmoothingQuality = 'high';
    scratch.globalCompositeOperation = 'copy';
    scratch.drawImage(frame, 0, 0, w, h);
  }

  private draw(): void {
    const { ctx, canvas } = this;
    if (!canvas.width) return;
    const patch = this.patches.get(this.pose);
    const whole = patch ? patch.base : this.pose;
    const frame = this.frames.get(whole);
    if (!frame) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const size = patch ? frameSize(patch.frame) : null;
    // Patches of the same clip all cover the same rectangle, so the next one replaces the last entirely.
    const area = patch && size ? `${patch.x},${patch.y},${size.w},${size.h}` : '';
    // A whole frame: 'copy' replaces every pixel, so the old pose is cleared and the new one drawn in a
    // single step. (Not needed when a clip frame goes onto its own still, clean or under the same clip.)
    if (!patch || this.drawn !== whole || (this.patched !== '' && this.patched !== area)) {
      ctx.globalCompositeOperation = 'copy';
      ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
    }
    this.drawn = whole;
    this.patched = area;
    if (!patch) return;
    // A clip frame: the patch replaces its rectangle of the still. The rectangle is trimmed to whole canvas
    // pixels, so its edge is never blended, and the patch is drawn at its exact place, so nothing inside it
    // shifts against the still around it. (The patch has a margin of unchanged picture on every side.)
    if (!size) return;
    const s = canvas.width / this.source.w;
    const x0 = Math.ceil(patch.x * s);
    const y0 = Math.ceil(patch.y * s);
    const x1 = Math.floor((patch.x + size.w) * s);
    const y1 = Math.floor((patch.y + size.h) * s);
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    ctx.clearRect(x0, y0, x1 - x0, y1 - y0);
    ctx.drawImage(patch.frame, patch.x * s, patch.y * s, size.w * s, size.h * s);
    ctx.restore();
  }
}

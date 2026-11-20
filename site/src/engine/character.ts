// A scene's character: one canvas that shows one pose at a time, placed on the plate as her scene says.
import { PLATE, type Frame, frameSize, idle, releaseFrame } from './assets';
import { NOTHING } from './clips';
import type { Placement } from './types';

/** What a character needs to know about herself to be drawn. */
export interface CharacterSetup {
  /** The frame she rests on. NOTHING for an actor who is part of the plate and only drawn now and then. */
  rest: string;
  placement: Placement;
  /** The size of her frames, in their own pixels. Leave out and it is the rest frame's. */
  size?: { w: number; h: number };
  /** Her element's class: `hj-rachel` (the default) for the one the scene is about, `hj-actor` for the rest of a cast. */
  className?: string;
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
export function place(rest: Frame | null, placement: Placement, size?: { w: number; h: number }): Box {
  if (placement.kind === 'box') {
    const w = size?.w ?? (rest ? frameSize(rest).w : placement.width);
    return { left: placement.x, top: placement.y, width: placement.width, height: placement.height, scale: placement.width / w };
  }
  if (!rest) throw new Error('Character: a standing figure is placed by her rest frame.');
  const { w, h } = frameSize(rest);
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
  /** QA: how many times she was asked for a pose that was not in memory (she stays on the one before). */
  missed = 0;
  /** The whole-canvas frame now on the canvas (under any patch). */
  private drawn = '';
  /** The rectangle of that frame now covered by a patch ('' when it is clean). */
  private patched = '';
  /** Her canvas holds two poses part-way through a dissolve (see dissolve()), not one clean frame. */
  private mixed = false;
  private scratch: CanvasRenderingContext2D | null = null;
  private scratchIdle = 0;

  constructor(frames: Map<string, Frame>, config: CharacterSetup) {
    this.frames = frames;
    this.rest = config.rest;
    const first = frames.get(config.rest) ?? null;
    if (!first && !config.size) throw new Error(`Character: missing rest frame "${config.rest}"`);
    this.source = config.size ?? frameSize(first!);
    this.placement = place(first, config.placement, config.size);
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
    this.el.className = config.className ?? 'hj-rachel';
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
    // The frame her canvas was waiting for (a scene come back to, whose frames had all been given back).
    if (!this.drawn && (name === this.pose || name === this.patches.get(this.pose)?.base)) this.draw();
  }

  /**
   * Take a whole frame away again (a scene out of sight gives its frames back). The caller releases its
   * pixels: one image can stand for two poses.
   */
  drop(name: string): void {
    this.frames.delete(name);
  }

  /** The frames her canvas needs to be drawn again as it is: the pose on show, and the still under a clip frame. */
  get showing(): string[] {
    const patch = this.patches.get(this.pose);
    return patch ? [this.pose, patch.base] : [this.pose];
  }

  /**
   * Out of sight: give back the canvases' own memory. resize() draws her again, as she was, when her
   * scene is back on the page.
   */
  sleep(): void {
    this.canvas.width = 0;
    this.canvas.height = 0;
    if (this.scratch) {
      this.scratch.canvas.width = 0;
      this.scratch.canvas.height = 0;
    }
    this.drawn = '';
    this.patched = '';
    this.mixed = false;
  }

  /** Add a clip frame: a patch over one of her stills. */
  addPatch(name: string, patch: Patch): void {
    const old = this.patches.get(name);
    this.patches.set(name, patch);
    if (old && old.frame !== patch.frame) releaseFrame(old.frame);
  }

  /**
   * Take a clip frame away again and give its pixels back (reel.ts decides when). The frame she is showing
   * is never taken: her canvas may have to be drawn again, after a resize.
   */
  dropPatch(name: string): void {
    const patch = this.patches.get(name);
    if (!patch || name === this.pose) return;
    this.patches.delete(name);
    releaseFrame(patch.frame);
  }

  /** The width of her art, in its own pixels (QA: tells the full-size set from the lighter one). */
  get sourceWidth(): number {
    return this.source.w;
  }

  /** What her decoded stills and her canvases take, in bytes (clip frames are counted by the reel). */
  get bytes(): { stills: number; canvases: number } {
    let stills = 0;
    // One image can stand for two poses: it is counted once.
    for (const frame of new Set(this.frames.values())) {
      const { w, h } = frameSize(frame);
      stills += w * h * 4;
    }
    const scratch = this.scratch?.canvas;
    return { stills, canvases: this.canvas.width * this.canvas.height * 4 + (scratch ? scratch.width * scratch.height * 4 : 0) };
  }

  has(name: string): boolean {
    return name === NOTHING || this.frames.has(name) || this.patches.has(name);
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
    if (name === this.pose && !this.mixed) return;
    if (!this.has(name)) {
      this.missed++;
      return;
    }
    this.pose = name;
    this.draw();
  }

  /**
   * Switch pose by a true cross-dissolve: the canvas holds `from` and `name` blended, `t` of the way from
   * the one to the other (0 to 1; call it every frame, and at 1 she is simply showing `name`). Each pixel is
   * the weighted sum of the two drawings, colour and coverage alike, so where their outlines differ the room
   * behind shows through by exactly as much as it should: what the package's preview does (routine.json,
   * `fade_ms`). Two whole poses only: a clip frame, or a pose not in memory, is shown at once.
   */
  dissolve(from: string, name: string, t: number): void {
    const a = from === NOTHING ? null : this.frames.get(from);
    const b = name === NOTHING ? null : this.frames.get(name);
    if (t >= 1 || from === name || (from !== NOTHING && !a) || (name !== NOTHING && !b) || !this.canvas.width) {
      this.show(name);
      return;
    }
    const { ctx, canvas } = this;
    this.pose = name;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // 'copy' leaves the first drawing at its share; 'lighter' adds the second at its own.
    ctx.globalCompositeOperation = 'copy';
    ctx.globalAlpha = 1 - t;
    if (a) ctx.drawImage(a, 0, 0, canvas.width, canvas.height);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (b) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = t;
      ctx.drawImage(b, 0, 0, canvas.width, canvas.height);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.drawn = '';
    this.patched = '';
    this.mixed = true;
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
    // The rehearsal canvas is as large as her own: it is given back once the frames have stopped arriving.
    window.clearTimeout(this.scratchIdle);
    this.scratchIdle = window.setTimeout(() => {
      scratch.canvas.width = 0;
      scratch.canvas.height = 0;
    }, 1500);
  }

  private draw(): void {
    const { ctx, canvas } = this;
    if (!canvas.width) return;
    const mixed = this.mixed;
    this.mixed = false;
    if (this.pose === NOTHING) {
      if (this.drawn || mixed) ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.drawn = '';
      this.patched = '';
      return;
    }
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

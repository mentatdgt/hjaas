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
  /**
   * Her art is larger than the canvas it stands on (a layer with a `scale`: cast.ts), so an ordinary screen shows it
   * at less than half its size: it is then shrunk in two steps. (WebKit shrinks by more than half with jagged lines.)
   */
  fine?: boolean;
  /** Her element's class: `hj-rachel` (the default) for the one the scene is about, `hj-actor` for the rest of a cast. */
  className?: string;
}

/** A clip frame: one patch, drawn over its base still at (x, y) in the still's own pixels, replacing what was there. */
export interface Patch {
  base: string;
  x: number;
  y: number;
  frame: Frame;
  /**
   * It is one of her stills, of which only this much differs from `base` (see clips.ts, `patches`): kept as long as
   * her stills are. Its rim is unchanged picture, RIM px of which are never drawn.
   */
  still?: boolean;
}

/**
 * A still's patch is drawn this many of its own px in from its rim (npm run assets leaves at least twice as many
 * unchanged): where a shrunken picture ends, its last px are a little off, and would show as a line.
 */
const RIM = 4;

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
/** The rehearsal canvas is given back this long after the last frame it was needed for. */
const SCRATCH_MS = 1500;
const SCRATCH_PAINTING_MS = 5000;
/** How long a frame spends rehearsing stills before a painting, in ms (see Character.rehearse). */
const REHEARSE_MS = 6;

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
  canvas.width = canvas.height = 0;
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

/**
 * How many pixels her canvas has: the ones it covers on screen (`cssW` CSS px across), never more than her art's own
 * (`source`; interpolated pixels are no sharper), and never more than one cheap draw's worth.
 */
export function backing(cssW: number, dpr: number, source: { w: number; h: number }): { w: number; h: number } {
  const wanted = Math.min(Math.round(cssW * Math.min(dpr || 1, 3)), source.w);
  const cap = Math.sqrt((MAX_PIXELS * source.w) / source.h);
  const w = Math.round(Math.min(wanted, cap));
  return { w, h: Math.round((w * source.h) / source.w) };
}

const pct = (value: number, of: number): string => `${(value / of) * 100}%`;

/**
 * Where a standing figure's ground shadow goes, for a frame at `p` (plate px) whose feet are on `baseline`, the figure
 * `height` tall. The box is grown by the blur radius so the gradient can fade to nothing inside it. (A finale's frame
 * takes her shadow over, sized to its own box: finale.ts.)
 */
export function shadowStyle(p: { left: number; width: number }, baseline: number, height: number): Record<'left' | 'top' | 'width' | 'height', string> {
  const depth = SHADOW.depth * height;
  return {
    left: pct(p.left + p.width * SHADOW.inset - SHADOW.soften, PLATE.w),
    top: pct(baseline - depth * SHADOW.lift - SHADOW.soften, PLATE.h),
    width: pct(p.width * SHADOW.width + SHADOW.soften * 2, PLATE.w),
    height: pct(depth + SHADOW.soften * 2, PLATE.h),
  };
}

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
  /** Called whenever her canvas has been drawn afresh (a live screen that shows her listens: screen.ts). */
  onDraw: (() => void) | null = null;
  /** The whole-canvas frame now on the canvas (under any patch). */
  private drawn = '';
  /** The rectangle of that frame now covered by a patch ('' when it is clean). */
  private patched = '';
  /** Her canvas holds two poses part-way through a dissolve (see dissolve()), not one clean frame. */
  private mixed = false;
  private readonly fine: boolean;
  /** For art shown at less than half its size: where it is halved on the way (see `fine`). */
  private half: CanvasRenderingContext2D | null = null;
  private scratch: CanvasRenderingContext2D | null = null;
  private scratchIdle = 0;
  /** A brush is at work over her: giving back the rehearsal canvas waits until it is done (it can cost a frame). */
  painting = false;
  /** Stills not yet rehearsed at her canvas's real size (see resize() and rehearse()). */
  private unrehearsed: string[] = [];

  constructor(frames: Map<string, Frame>, config: CharacterSetup) {
    this.frames = frames;
    this.rest = config.rest;
    this.fine = config.fine === true;
    const first = frames.get(config.rest) ?? null;
    if (!first && !config.size) throw new Error(`Character: missing rest frame "${config.rest}"`);
    this.source = config.size ?? frameSize(first!);
    this.placement = place(first, config.placement, config.size);
    const p = this.placement;

    if (config.placement.kind === 'standing' && config.placement.shadow) {
      this.shadow = document.createElement('div');
      this.shadow.className = 'hj-shadow';
      Object.assign(this.shadow.style, shadowStyle(p, config.placement.baseline, config.placement.height));
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
    window.clearTimeout(this.scratchIdle);
    this.canvas.width = 0;
    this.canvas.height = 0;
    if (this.scratch) {
      this.scratch.canvas.width = 0;
      this.scratch.canvas.height = 0;
    }
    if (this.half) {
      this.half.canvas.width = 0;
      this.half.canvas.height = 0;
    }
    this.unrehearsed = [];
    this.drawn = '';
    this.patched = '';
    this.mixed = false;
  }

  /** Add a clip frame: a patch over one of her stills. */
  addPatch(name: string, patch: Patch): void {
    const old = this.patches.get(name);
    this.patches.set(name, patch);
    if (old && old.frame !== patch.frame) releaseFrame(old.frame);
    if (!patch.still) return;
    // Before she is on the page they come all at once: rehearsed one by one, as after a sleep (see resize()).
    if (this.el.isConnected) this.warm(patch.frame);
    else this.rehearseLater([name]);
    // The still her canvas was waiting for (see add()).
    if (!this.drawn && name === this.pose) this.draw();
  }

  /**
   * Take a clip frame away again and give its pixels back (reel.ts decides when). The frame she is showing
   * is never taken: her canvas may have to be drawn again, after a resize.
   */
  dropPatch(name: string, force = false): void {
    const patch = this.patches.get(name);
    if (!patch || (!force && name === this.pose)) return;
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
    for (const patch of this.patches.values()) {
      if (!patch.still) continue;
      const { w, h } = frameSize(patch.frame);
      stills += w * h * 4;
    }
    const canvases = [this.canvas, this.scratch?.canvas, this.half?.canvas];
    return { stills, canvases: canvases.reduce((sum, canvas) => sum + (canvas ? canvas.width * canvas.height * 4 : 0), 0) };
  }

  has(name: string): boolean {
    return name === NOTHING || this.frames.has(name) || this.patches.has(name);
  }

  get current(): string {
    return this.pose;
  }

  /** Match the canvas to the pixels it covers on screen. Call after layout changes. */
  resize(): void {
    const cssW = this.el.clientWidth;
    if (!cssW) return;
    const { w, h } = backing(cssW, window.devicePixelRatio, this.source);
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
    // (Before a first-visit painting they are not left to the quiet moments: see rehearse().)
    if (first) {
      const stills = [...this.patches].filter(([, patch]) => patch.still).map(([name]) => name);
      this.rehearseLater([...this.frames.keys(), ...stills], true);
    }
  }

  /** Rehearse these, one at a time, in quiet moments: after any that are waiting already, or instead of them. */
  private rehearseLater(names: string[], instead = false): void {
    const alone = this.unrehearsed.length === 0;
    this.unrehearsed = instead ? names : [...this.unrehearsed, ...names];
    if (!alone) return;
    void (async () => {
      while (this.unrehearsed.length) {
        await idle();
        this.rehearseNext();
      }
    })();
  }

  /** The next still waiting to be rehearsed, if it is still in memory. */
  private rehearseNext(): void {
    const name = this.unrehearsed.shift() ?? '';
    const frame = this.frames.get(name) ?? this.patches.get(name)?.frame;
    if (frame) this.warm(frame);
  }

  /**
   * Rehearse every still that is waiting, a few milliseconds at a time, one batch to a frame: nothing is on show,
   * and a painting is about to start. Resolves when the last has been drawn and the rehearsal canvas given back.
   */
  async rehearse(): Promise<void> {
    const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));
    // (Nothing waiting, and no rehearsal canvas to give back.)
    if (!this.unrehearsed.length && !this.scratch?.canvas.width) return;
    while (this.unrehearsed.length) {
      await frame();
      const until = performance.now() + REHEARSE_MS;
      do this.rehearseNext();
      while (this.unrehearsed.length && performance.now() < until);
    }
    // (Two frames on, the last of them has reached the screen's side: only then can its canvas go.)
    await frame();
    await frame();
    if (this.unrehearsed.length || !this.scratch) return;
    window.clearTimeout(this.scratchIdle);
    this.scratch.canvas.width = 0;
    this.scratch.canvas.height = 0;
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
   * `fade_ms`). Two whole poses only: a patch (a clip frame, or a still kept as one), or a pose not in memory, is shown at once.
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
    this.onDraw?.();
  }

  /**
   * Copy the part of her that lies in a rectangle of the plate (plate px) onto another canvas, where the
   * whole rectangle fills dx, dy, dw, dh. For a picture of the scene inside the scene (screen.ts).
   */
  copy(ctx: CanvasRenderingContext2D, region: { x: number; y: number; w: number; h: number }, dx: number, dy: number, dw: number, dh: number): void {
    const { canvas, placement: p } = this;
    if (!canvas.width) return;
    const left = Math.max(region.x, p.left);
    const top = Math.max(region.y, p.top);
    const right = Math.min(region.x + region.w, p.left + p.width);
    const bottom = Math.min(region.y + region.h, p.top + p.height);
    if (right <= left || bottom <= top) return;
    const sx = canvas.width / p.width;
    const sy = canvas.height / p.height;
    const kx = dw / region.w;
    const ky = dh / region.h;
    ctx.drawImage(canvas, (left - p.left) * sx, (top - p.top) * sy, (right - left) * sx, (bottom - top) * sy, dx + (left - region.x) * kx, dy + (top - region.y) * ky, (right - left) * kx, (bottom - top) * ky);
  }

  /**
   * Copy her, as she looks now, onto another canvas (the sheet the brush rubs away when the visitor leaves
   * this scene). `origin` is that canvas's place on the page; the context works in CSS px.
   */
  sketch(ctx: CanvasRenderingContext2D, origin: DOMRect, body = true): void {
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
    // (`body` false: her shadow only, as a finale has taken her place over it.)
    if (!body || !this.canvas.width) return;
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
    }, this.painting ? SCRATCH_PAINTING_MS : SCRATCH_MS);
  }

  private draw(): void {
    if (!this.canvas.width) return;
    this.paint();
    this.onDraw?.();
  }

  /** Draw one of her frames at this place on her canvas, in two steps if it is `fine` and shown at less than half its size. */
  private put(frame: Frame, x: number, y: number, w: number, h: number): void {
    const { ctx } = this;
    const size = frameSize(frame);
    if (!this.fine || this.canvas.width * 2 >= this.source.w) {
      ctx.drawImage(frame, x, y, w, h);
      return;
    }
    this.half ??= document.createElement('canvas').getContext('2d')!;
    const { canvas } = this.half;
    const halfW = Math.ceil(this.source.w / 2);
    if (canvas.width !== halfW) {
      canvas.width = halfW;
      canvas.height = Math.ceil(this.source.h / 2);
    }
    this.half.imageSmoothingEnabled = true;
    this.half.imageSmoothingQuality = 'high';
    this.half.globalCompositeOperation = 'copy';
    this.half.drawImage(frame, 0, 0, size.w / 2, size.h / 2);
    ctx.drawImage(canvas, 0, 0, size.w / 2, size.h / 2, x, y, w, h);
  }

  private paint(): void {
    const { ctx, canvas } = this;
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
      this.put(frame, 0, 0, canvas.width, canvas.height);
    }
    this.drawn = whole;
    this.patched = area;
    if (!patch) return;
    // A clip frame: the patch replaces its rectangle of the still. The rectangle is trimmed to whole canvas
    // pixels, so its edge is never blended, and the patch is drawn at its exact place, so nothing inside it
    // shifts against the still around it. (The patch has a margin of unchanged picture on every side.)
    if (!size) return;
    const s = canvas.width / this.source.w;
    // (A still's patch is drawn exactly as the whole still would be: to the canvas's height as well as its width.)
    const sy = patch.still ? canvas.height / this.source.h : s;
    let x0 = Math.ceil(patch.x * s);
    let y0 = Math.ceil(patch.y * sy);
    let x1 = Math.floor((patch.x + size.w) * s);
    let y1 = Math.floor((patch.y + size.h) * sy);
    if (patch.still) {
      // (Where the patch ends at the edge of the canvas, so does the still.)
      x0 = patch.x > 0 ? Math.ceil((patch.x + RIM) * s) : 0;
      y0 = patch.y > 0 ? Math.ceil((patch.y + RIM) * sy) : 0;
      x1 = patch.x + size.w < this.source.w ? Math.floor((patch.x + size.w - RIM) * s) : canvas.width;
      y1 = patch.y + size.h < this.source.h ? Math.floor((patch.y + size.h - RIM) * sy) : canvas.height;
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    ctx.clearRect(x0, y0, x1 - x0, y1 - y0);
    this.put(patch.frame, patch.x * s, patch.y * sy, size.w * s, size.h * sy);
    ctx.restore();
  }
}

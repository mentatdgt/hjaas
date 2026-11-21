// A live screen in the picture: the back of Rachel's camera in the film scene, showing what she is filming.
//
// It is a small canvas on the actor who holds it. Whenever the picture under her changes (the room, or an
// actor drawn before her: each says so as it is drawn), the part of the scene the screen shows is put
// together again and drawn into it, scaled down, with the red recording dot over its corner. Where the
// screen is depends on the pose she is in (she lowers the camera when she turns), so it is moved with her,
// in the same frame.
//
// There is no loop of its own: the dot's blink is counted on her player's frames (player.ts, onFrame).
import { PLATE } from './assets';
import type { CastScreen, Rect } from './cast';
import type { Character } from './character';

/** The screen's picture sits this far inside the screen's rectangle, in plate px. */
const INSET = 2;
/** The recording dot, in plate px: its width, how far inside the picture's corner it sits, and its half-beat. */
export const DOT = { size: 6, inset: 2, colour: '#EB1E1E', ms: 500 } as const;

/** The screen's picture, in plate px, for a pose of the actor who holds it; null on a pose that has no screen. */
export function pictureFor(screen: CastScreen, pose: string): Rect | null {
  const r = screen.rects[pose];
  if (!r || r.w <= 2 * INSET || r.h <= 2 * INSET) return null;
  return { x: r.x + INSET, y: r.y + INSET, w: r.w - 2 * INSET, h: r.h - 2 * INSET };
}

/** Whether the dot is lit, `ms` after the screen came on: on for a half-beat, off for one. Always lit when held still. */
export function dotLit(ms: number, still: boolean): boolean {
  return still || Math.floor(Math.max(0, ms) / DOT.ms) % 2 === 0;
}

const pct = (value: number, of: number): string => `${(value / of) * 100}%`;

export class Viewfinder {
  readonly el: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly screen: CastScreen;
  private readonly holder: Character;
  private readonly under: readonly Character[];
  private readonly room: HTMLImageElement;
  /** Paused, or reduced motion: the dot stays lit. */
  private readonly still: () => boolean;
  /** The source at its own size, and the same halved and halved again on the way down to the screen's. */
  private readonly steps: CanvasRenderingContext2D[] = [];
  private picture: Rect | null = null;
  private placed = '';
  private since = 0;
  private lit = true;
  private asleep = false;

  /** `under`: the actors drawn before the one who holds the screen, bottom to top. */
  constructor(screen: CastScreen, holder: Character, under: readonly Character[], room: HTMLImageElement, still: () => boolean) {
    this.screen = screen;
    this.holder = holder;
    this.under = under;
    this.room = room;
    this.still = still;
    this.el = document.createElement('canvas');
    this.el.className = 'hj-finder';
    this.el.setAttribute('aria-hidden', 'true');
    this.ctx = this.el.getContext('2d')!;
    holder.el.append(this.el);
    // Anything that changes what the screen shows, or where it is, draws it again there and then.
    for (const character of [holder, ...under]) character.onDraw = () => this.draw();
    room.addEventListener('load', () => this.draw());
    this.since = performance.now();
    this.resize();
  }

  /** One frame of her player's loop: the dot goes on or off when its half-beat is up. */
  frame(now: number): void {
    const lit = dotLit(now - this.since, this.still());
    if (lit === this.lit) return;
    this.lit = lit;
    this.draw();
  }

  /** Match the canvas to the pixels it covers on screen. Call after layout changes, and when the scene is back on the page. */
  resize(): void {
    this.asleep = false;
    this.placed = '';
    this.draw();
  }

  /** Out of sight: give back the canvases' memory. resize() brings the screen back. */
  sleep(): void {
    this.asleep = true;
    for (const canvas of [this.el, ...this.steps.map((step) => step.canvas)]) {
      canvas.width = 0;
      canvas.height = 0;
    }
    this.placed = '';
  }

  /** Put the screen where it is on her current pose, and draw what it shows now. */
  draw(): void {
    if (this.asleep) return;
    const { el, ctx, holder, screen } = this;
    const picture = pictureFor(screen, holder.current);
    this.picture = picture;
    el.style.display = picture ? '' : 'none';
    if (!picture) return;
    const p = holder.placement;
    const key = `${picture.x},${picture.y},${picture.w},${picture.h},${holder.el.clientWidth}`;
    if (key !== this.placed) {
      this.placed = key;
      Object.assign(el.style, {
        left: pct(picture.x - p.left, p.width),
        top: pct(picture.y - p.top, p.height),
        width: pct(picture.w, p.width),
        height: pct(picture.h, p.height),
      });
      // As many pixels as it covers on screen: one plate px is `shown` screen px.
      const shown = (holder.el.getBoundingClientRect().width / p.width) * Math.min(window.devicePixelRatio || 1, 3);
      const w = Math.max(8, Math.round(picture.w * shown));
      const h = Math.max(8, Math.round(picture.h * shown));
      if (el.width !== w || el.height !== h) {
        el.width = w;
        el.height = h;
      }
    }
    if (!holder.el.clientWidth) return;

    // The scene under her, at the source's own size: the room, then each actor drawn before her.
    const { source } = screen;
    const full = this.step(0, Math.round(source.w), Math.round(source.h));
    const { room } = this;
    if (room.complete && room.naturalWidth) {
      const k = room.naturalWidth / PLATE.w;
      full.drawImage(room, source.x * k, source.y * k, source.w * k, source.h * k, 0, 0, full.canvas.width, full.canvas.height);
    } else {
      full.clearRect(0, 0, full.canvas.width, full.canvas.height);
    }
    for (const character of this.under) character.copy(full, source, 0, 0, full.canvas.width, full.canvas.height);

    // Down to the screen's size by halves, then the rest in one go: each halving is an exact average, so the
    // lit windows and the thin outlines stay steady however small the screen is, in every browser.
    let from = full;
    for (let i = 1; from.canvas.width / 2 >= el.width && from.canvas.height / 2 >= el.height; i++) {
      const half = this.step(i, Math.ceil(from.canvas.width / 2), Math.ceil(from.canvas.height / 2));
      half.drawImage(from.canvas, 0, 0, from.canvas.width, from.canvas.height, 0, 0, half.canvas.width, half.canvas.height);
      from = half;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(from.canvas, 0, 0, from.canvas.width, from.canvas.height, 0, 0, el.width, el.height);
    ctx.globalCompositeOperation = 'source-over';
    if (!this.lit) return;
    const u = el.width / picture.w;
    ctx.fillStyle = DOT.colour;
    ctx.beginPath();
    ctx.arc((DOT.inset + DOT.size / 2) * u, (DOT.inset + DOT.size / 2) * u, (DOT.size / 2) * u, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Copy the screen, as it looks now, onto another canvas (the sheet the brush rubs away when the visitor
   * leaves this scene). `origin` is that canvas's place on the page; the context works in CSS px.
   */
  sketch(ctx: CanvasRenderingContext2D, origin: DOMRect): void {
    if (!this.picture || !this.el.width) return;
    const r = this.el.getBoundingClientRect();
    ctx.drawImage(this.el, r.left - origin.left, r.top - origin.top, r.width, r.height);
  }

  /** What the screen's canvases take, in bytes. */
  get bytes(): number {
    return [this.el, ...this.steps.map((step) => step.canvas)].reduce((sum, canvas) => sum + canvas.width * canvas.height * 4, 0);
  }

  /** The nth working canvas, at this size, cleared of nothing: every use draws over all of it. */
  private step(n: number, w: number, h: number): CanvasRenderingContext2D {
    this.steps[n] ??= document.createElement('canvas').getContext('2d')!;
    const step = this.steps[n];
    if (step.canvas.width !== w || step.canvas.height !== h) {
      step.canvas.width = w;
      step.canvas.height = h;
    }
    step.imageSmoothingEnabled = true;
    step.imageSmoothingQuality = 'high';
    step.globalCompositeOperation = n === 0 ? 'source-over' : 'copy';
    return step;
  }
}

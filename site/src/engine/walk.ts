// A sprite-track layer (cast.ts): the theatre's stagehand, seen only as his boots in the dark gap under the
// backdrop's hem as he crosses behind it. Now and then he walks right to left, and back a little later.
//
// The track gives, frame by frame, where each of two boots is (the sprite's bottom-centre) and how far it is
// turned. Each frame of a walk the boots are drawn as the track says, the far one first and darker, onto a
// canvas the size of the mask, and then only what lies inside the mask is kept: the gap itself. Nothing is
// in between two frames of the track: the boots are drawn to roll and plant, not slide. Between walks the
// canvas is clear.
//
// When: the first walk some seconds after the scene starts working, then out and back and a long wait, all
// drawn afresh each time from the routine's ranges. Time only counts while the scene is at work and shown:
// paused, it holds the frame it is on (and carries on from there); with reduced motion the boots never
// show; out of sight it starts again from the first wait. There is no loop of its own: each frame of the
// lead's player moves it on (player.ts, onFrame).
import { decodeBlob, releaseFrame, type Frame } from './assets';
import type { Walker } from './cast';
import { reducedMotion } from './motion';
import type { Rng } from './steps';

/** One boot in one frame of a track: where its bottom-centre is (the package's px), how far it is turned (degrees clockwise), and whether it is the far one. */
interface Boot {
  x: number;
  y: number;
  rot: number;
  far: boolean;
}
interface Track {
  fps: number;
  sprite: string;
  frames: ReadonlyArray<readonly Boot[]>;
}
export interface TrackFile {
  gap_mask_xy?: readonly [number, number];
  [track: string]: unknown;
}

/** The far boot is drawn this much darker (its colour times this; its alpha as it is). */
const FAR = 0.85;
/** After a stall (a hidden tab, a busy moment), time moves on by no more than this. */
const MAX_STEP_MS = 250;

const pct = (value: number, of: number): string => `${(value / of) * 100}%`;

export class Walk {
  readonly el: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly walker: Walker;
  private readonly tracks: Readonly<Record<string, Track>>;
  /** The gap's top-left corner, in the package's px. */
  private readonly origin: readonly [number, number];
  private readonly size: { w: number; h: number };
  private readonly rnd: Rng;
  /** Paused (or reduced motion): nothing moves on. */
  private readonly still: () => boolean;
  /** Each sprite as delivered, and darker, for the far boot. */
  private readonly sprites = new Map<string, { near: CanvasImageSource; far: CanvasImageSource; w: number; h: number }>();
  /** The mask, as alpha. */
  private mask: HTMLCanvasElement | null = null;
  /** Where in the routine: waiting (ms left), or walking (which track, ms into it). */
  private state: { waiting: number } | { walking: string; ms: number } | null = null;
  /** Which of `sequence` comes next. */
  private next = 0;
  private last = 0;
  private drawn = -1;

  constructor(walker: Walker, track: TrackFile, sprites: ReadonlyMap<string, Frame>, mask: Frame | null, size: { w: number; h: number }, rnd: Rng, still: () => boolean) {
    this.walker = walker;
    this.rnd = rnd;
    this.still = still;
    const tracks: Record<string, Track> = {};
    for (const name of walker.routine.sequence) tracks[name] = track[name] as Track;
    this.tracks = tracks;
    this.origin = track.gap_mask_xy ?? [0, 0];
    this.size = size;
    for (const [name, frame] of sprites) {
      const w = frame.width;
      const h = frame.height;
      const far = document.createElement('canvas');
      far.width = w;
      far.height = h;
      const f = far.getContext('2d')!;
      f.drawImage(frame, 0, 0);
      // Darker, alpha untouched: multiply by grey, then put the sprite's own alpha back.
      f.globalCompositeOperation = 'multiply';
      f.fillStyle = `rgb(${Math.round(255 * FAR)}, ${Math.round(255 * FAR)}, ${Math.round(255 * FAR)})`;
      f.fillRect(0, 0, w, h);
      f.globalCompositeOperation = 'destination-in';
      f.drawImage(frame, 0, 0);
      this.sprites.set(name, { near: frame, far, w, h });
    }
    if (mask) {
      // Grey to alpha: 255 is the gap.
      const c = document.createElement('canvas');
      c.width = mask.width;
      c.height = mask.height;
      const m = c.getContext('2d', { willReadFrequently: true })!;
      m.drawImage(mask, 0, 0);
      const image = m.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < image.data.length; i += 4) {
        image.data[i + 3] = image.data[i];
        image.data[i] = image.data[i + 1] = image.data[i + 2] = 0;
      }
      m.putImageData(image, 0, 0);
      this.mask = c;
      releaseFrame(mask);
    }
    this.el = document.createElement('canvas');
    this.el.className = 'hj-walk';
    this.el.setAttribute('aria-hidden', 'true');
    const k = walker.scale;
    Object.assign(this.el.style, {
      left: pct(this.origin[0] * k, 1672),
      top: pct(this.origin[1] * k, 941),
      width: pct(size.w * k, 1672),
      height: pct(size.h * k, 941),
    });
    // (Sized when the scene goes on the page: see wake().)
    this.el.width = 0;
    this.el.height = 0;
    this.ctx = this.el.getContext('2d')!;
  }

  /** One frame of the lead's player: time moves on, and the boots are drawn where the track has them. */
  frame(now: number): void {
    const step = this.last ? Math.min(MAX_STEP_MS, now - this.last) : 0;
    this.last = now;
    if (reducedMotion()) {
      // The boots never show; the walk starts afresh when motion is back.
      if (this.state && 'walking' in this.state) this.clear();
      this.state = null;
      return;
    }
    if (this.still()) return;
    this.state ??= { waiting: this.roll(this.walker.routine.first_ms) };
    if ('waiting' in this.state) {
      this.state.waiting -= step;
      if (this.state.waiting > 0) return;
      this.state = { walking: this.walker.routine.sequence[this.next], ms: 0 };
    } else {
      this.state.ms += step;
    }
    const track = this.tracks[this.state.walking];
    const index = Math.floor((this.state.ms * track.fps) / 1000);
    if (index >= track.frames.length) {
      // That walk is over: clear, and wait for the next.
      this.clear();
      this.next = (this.next + 1) % this.walker.routine.sequence.length;
      this.state = { waiting: this.roll(this.next === 0 ? this.walker.routine.every_ms : this.walker.routine.return_after_ms) };
      return;
    }
    if (index !== this.drawn) this.draw(track, index);
  }

  /** The scene is out of sight: clear, give the canvas back, and start from the first wait when it is back. */
  sleep(): void {
    this.state = null;
    this.next = 0;
    this.last = 0;
    this.drawn = -1;
    this.el.width = 0;
    this.el.height = 0;
  }

  /** The scene is going on the page again. */
  wake(): void {
    if (this.el.width === this.size.w && this.el.height === this.size.h) return;
    this.el.width = this.size.w;
    this.el.height = this.size.h;
    this.last = 0;
    this.drawn = -1;
  }

  /** QA: where in the routine it is. */
  get now(): { waiting?: number; walking?: string; frame?: number } {
    if (!this.state) return {};
    if ('waiting' in this.state) return { waiting: Math.round(this.state.waiting) };
    const track = this.tracks[this.state.walking];
    return { walking: this.state.walking, frame: Math.floor((this.state.ms * track.fps) / 1000) };
  }

  /** QA: start a walk now (one of the sequence's tracks), as the routine would. */
  walkNow(track = this.walker.routine.sequence[0]): void {
    this.next = Math.max(0, this.walker.routine.sequence.indexOf(track));
    this.state = { walking: track, ms: 0 };
  }

  /** What the canvases take, in bytes. */
  get bytes(): number {
    let total = this.el.width * this.el.height * 4 + (this.mask ? this.mask.width * this.mask.height * 4 : 0);
    for (const sprite of this.sprites.values()) total += sprite.w * sprite.h * 4 * 2;
    return total;
  }

  private roll([least, most]: readonly [number, number]): number {
    return least + this.rnd() * (most - least);
  }

  private clear(): void {
    this.ctx.clearRect(0, 0, this.el.width, this.el.height);
    this.drawn = -1;
  }

  private draw(track: Track, index: number): void {
    const { ctx } = this;
    const sprite = this.sprites.get(track.sprite);
    if (!sprite || !this.el.width) return;
    this.drawn = index;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, this.el.width, this.el.height);
    // The far boot first, then the near one over it.
    const boots = [...track.frames[index]].sort((a, b) => Number(b.far) - Number(a.far));
    for (const boot of boots) {
      ctx.setTransform(1, 0, 0, 1, boot.x - this.origin[0], boot.y - this.origin[1]);
      ctx.rotate((boot.rot * Math.PI) / 180);
      ctx.drawImage(boot.far ? sprite.far : sprite.near, -sprite.w / 2, -sprite.h);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.mask) {
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(this.mask, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}

/** Decode what a walker needs: its sprites and its mask. */
export async function decodeWalk(sprites: ReadonlyMap<string, Blob>, mask: Blob | null): Promise<{ sprites: Map<string, Frame>; mask: Frame | null }> {
  const decoded = new Map<string, Frame>();
  for (const [name, blob] of sprites) decoded.set(name, await decodeBlob(blob));
  return { sprites: decoded, mask: mask ? await decodeBlob(mask) : null };
}

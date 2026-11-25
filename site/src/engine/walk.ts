// A sprite-track layer (cast.ts): the theatre's stagehand. Now and then he crosses behind the backdrop, right
// to left, and comes back a little later. He is seen only where he really would be: in the dark slot between
// the backdrop and the curtain the whole man, and from there on his boots, in the gap under the hem.
//
// The track gives, frame by frame, what to draw, in order: each entry is a sprite, where its bottom-centre
// goes and how far it is turned; whether it is the far boot (drawn darker); and whether it is his whole body
// (drawn as delivered, perhaps mirrored). A frame is kept inside a mask: the body mask for a frame with a body
// in it, the gap mask for one with only boots. Both lie on one canvas, the size of the larger mask. Nothing is
// in between two frames of the track: the drawings are made to roll and plant, not slide. Between walks the
// canvas is clear.
//
// When: the first walk some seconds after the scene starts working, then out and back and a long wait, all
// drawn afresh each time from the routine's ranges. Time only counts while the scene is at work and shown:
// paused, it holds the frame it is on (and carries on from there); with reduced motion he never shows; out of
// sight it starts again from the first wait, and every picture is given back (the body's drawings are 9 MB):
// they are decoded again, from the downloaded files, as the scene goes on. (The first time, they are downloaded
// once the scene has been painted: there is all of the first wait for it.) There is no loop of its own: each
// frame of the lead's player moves it on (player.ts, onFrame).
import { decodeBlob, decodePart, idle, releaseFrame, type Frame } from './assets';
import type { Walker } from './cast';
import { reducedMotion } from './motion';
import type { Rng } from './steps';

/** One entry of one frame of a track: which sprite, where its bottom-centre is (the package's px), how far it is turned (degrees clockwise). */
interface Entry {
  s: string;
  x: number;
  y: number;
  rot: number;
  /** The far boot: drawn darker. */
  far?: boolean;
  /** His whole body: never darkened, and kept inside the body mask. */
  body?: boolean;
  /** Mirrored left-right about its bottom-centre. */
  flip?: boolean;
}
interface Track {
  fps: number;
  frames: ReadonlyArray<readonly Entry[]>;
}
export interface TrackFile {
  gap_mask_xy?: readonly [number, number];
  body_mask_xy?: readonly [number, number];
  [track: string]: unknown;
}

/** A walker's downloaded files. (The masks are alpha: npm run assets makes them so.) */
export interface WalkFiles {
  sprites: ReadonlyMap<string, Blob>;
  mask: Blob | null;
  bodyMask: Blob | null;
}

/** A sprite, the far boot's darker copy of it (only for a sprite the track ever draws far), and its size. */
interface Sprite {
  near: Frame;
  far: HTMLCanvasElement | null;
  w: number;
  h: number;
}
/** A mask, or the part of it that is ever used, and where its top-left corner is on the plate (the package's px). */
interface Mask {
  frame: Frame;
  x: number;
  y: number;
}
interface Pictures {
  sprites: Map<string, Sprite>;
  gap: Mask | null;
  body: Mask | null;
}

/** The far boot is drawn this much darker (its colour times this; its alpha as it is). */
const FAR = 0.85;
/** After a stall (a hidden tab, a busy moment), time moves on by no more than this. */
const MAX_STEP_MS = 250;

const pct = (value: number, of: number): string => `${(value / of) * 100}%`;

/** A boot's darker copy: multiplied by grey, its own alpha put back. */
function darker(frame: Frame): HTMLCanvasElement {
  const far = document.createElement('canvas');
  far.width = frame.width;
  far.height = frame.height;
  const f = far.getContext('2d')!;
  f.drawImage(frame, 0, 0);
  f.globalCompositeOperation = 'multiply';
  f.fillStyle = `rgb(${Math.round(255 * FAR)}, ${Math.round(255 * FAR)}, ${Math.round(255 * FAR)})`;
  f.fillRect(0, 0, far.width, far.height);
  f.globalCompositeOperation = 'destination-in';
  f.drawImage(frame, 0, 0);
  return far;
}

export class Walk {
  readonly el: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly walker: Walker;
  private readonly tracks: Readonly<Record<string, Track>>;
  private readonly files: WalkFiles;
  /** The two masks' top-left corners, in the package's px. The canvas lies at the larger one's: the body mask's, if there is one. */
  private readonly gapAt: readonly [number, number];
  private readonly bodyAt: readonly [number, number];
  private readonly origin: readonly [number, number];
  private size: { w: number; h: number } | null = null;
  /** The package's whole canvas: what a walker without masks draws on. */
  private readonly whole: { w: number; h: number };
  private readonly rnd: Rng;
  /** Paused (or reduced motion): nothing moves on. */
  private readonly still: () => boolean;
  /** What is decoded, while the scene is on show. */
  private pictures: Pictures | null = null;
  private waking: Promise<void> | null = null;
  /** Counts the times it has gone to sleep: a decode that ends after one is thrown away. */
  private slept = 0;
  /** Where in the routine: waiting (ms left), or walking (which track, ms into it). */
  private state: { waiting: number } | { walking: string; ms: number } | null = null;
  /** Which of `sequence` comes next. */
  private next = 0;
  private last = 0;
  private drawn = -1;
  /** What of the canvas the last drawing may have marked. */
  private marked: { x: number; y: number; w: number; h: number } | null = null;

  constructor(walker: Walker, track: TrackFile, files: WalkFiles, whole: { w: number; h: number }, rnd: Rng, still: () => boolean) {
    this.walker = walker;
    this.files = files;
    this.whole = whole;
    this.rnd = rnd;
    this.still = still;
    const tracks: Record<string, Track> = {};
    for (const name of walker.routine.sequence) tracks[name] = track[name] as Track;
    this.tracks = tracks;
    this.gapAt = track.gap_mask_xy ?? [0, 0];
    this.bodyAt = track.body_mask_xy ?? [0, 0];
    this.origin = files.bodyMask ? this.bodyAt : files.mask ? this.gapAt : [0, 0];
    this.el = document.createElement('canvas');
    this.el.className = 'hj-walk';
    this.el.setAttribute('aria-hidden', 'true');
    // (Sized when the scene goes on the page: see wake().)
    this.el.width = 0;
    this.el.height = 0;
    this.ctx = this.el.getContext('2d')!;
  }

  /** One frame of the lead's player: time moves on, and he is drawn where the track has him. */
  frame(now: number): void {
    const step = this.last ? Math.min(MAX_STEP_MS, now - this.last) : 0;
    this.last = now;
    if (reducedMotion()) {
      // He never shows; the walk starts afresh when motion is back.
      if (this.state && 'walking' in this.state) this.clear();
      this.state = null;
      return;
    }
    if (this.still()) return;
    this.state ??= { waiting: this.roll(this.walker.routine.first_ms) };
    if ('waiting' in this.state) {
      this.state.waiting -= step;
      if (this.state.waiting > 0) return;
      this.state = this.start(this.walker.routine.sequence[this.next]);
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

  /** The scene is out of sight: give the canvas and every picture back, and start from the first wait when it is back. */
  sleep(): void {
    this.state = null;
    this.next = 0;
    this.last = 0;
    this.drawn = -1;
    this.marked = null;
    this.el.width = 0;
    this.el.height = 0;
    this.slept++;
    this.waking = null;
    if (this.pictures) release(this.pictures);
    this.pictures = null;
  }

  /** The scene is going on the page: decode the pictures (again). Resolves when they are here. */
  wake(): Promise<void> {
    this.waking ??= this.decode();
    return this.waking;
  }

  private async decode(): Promise<void> {
    const turn = this.slept;
    this.last = 0;
    this.drawn = -1;
    const pictures = await this.load();
    if (turn !== this.slept) {
      // It went out of sight meanwhile.
      if (pictures) release(pictures);
      return;
    }
    // (Without its pictures there is no walk; the scene is whole without it.)
    if (!pictures || !this.size) return;
    this.pictures = pictures;
    this.el.width = this.size.w;
    this.el.height = this.size.h;
    const k = this.walker.scale;
    Object.assign(this.el.style, {
      left: pct(this.origin[0] * k, 1672),
      top: pct(this.origin[1] * k, 941),
      width: pct(this.size.w * k, 1672),
      height: pct(this.size.h * k, 941),
    });
  }

  private async load(): Promise<Pictures | null> {
    const far = new Set(this.entries().filter((entry) => entry.far && !entry.body).map((entry) => entry.s));
    const sprites = new Map<string, Sprite>();
    const pictures: Pictures = { sprites, gap: null, body: null };
    const jobs = [...this.files.sprites].map(async ([name, blob]) => {
      const frame = await decodeBlob(blob);
      const sprite: Sprite = { near: frame, far: null, w: frame.width, h: frame.height };
      sprites.set(name, sprite);
      if (!far.has(name)) return;
      // (Each in a quiet moment: she is at work.)
      await idle();
      sprite.far = darker(frame);
    });
    const masks = async (): Promise<void> => {
      if (this.files.mask) pictures.gap = { frame: await decodeBlob(this.files.mask), x: this.gapAt[0], y: this.gapAt[1] };
      if (!this.files.bodyMask) return;
      // Only the part of the body mask the body is ever drawn in is kept (it is mostly the gap, again).
      const whole = await decodeBlob(this.files.bodyMask);
      pictures.body = { frame: whole, x: this.bodyAt[0], y: this.bodyAt[1] };
      this.size = { w: whole.width, h: whole.height };
    };
    const done = await Promise.allSettled([...jobs, masks()]);
    if (done.some((job) => job.status === 'rejected')) {
      release(pictures);
      return null;
    }
    if (pictures.body && this.files.bodyMask) {
      const { frame } = pictures.body;
      let left = frame.width;
      let right = 0;
      for (const entry of this.entries()) {
        const sprite = entry.body ? sprites.get(entry.s) : undefined;
        if (!sprite) continue;
        left = Math.min(left, Math.max(0, Math.floor(entry.x - sprite.w / 2 - this.bodyAt[0]) - 1));
        right = Math.max(right, Math.min(frame.width, Math.ceil(entry.x + sprite.w / 2 - this.bodyAt[0]) + 1));
      }
      const part = right > left && right - left < frame.width ? await decodePart(this.files.bodyMask, { x: left, y: 0, w: right - left, h: frame.height }) : null;
      if (part) {
        releaseFrame(frame);
        pictures.body = { frame: part, x: this.bodyAt[0] + left, y: this.bodyAt[1] };
      }
    }
    this.size ??= pictures.gap ? { w: pictures.gap.frame.width, h: pictures.gap.frame.height } : this.whole;
    return pictures;
  }

  /** Every entry of every track. */
  private entries(): Entry[] {
    return Object.values(this.tracks).flatMap((track) => track.frames.flat());
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
    this.state = this.start(track);
  }

  /** What the canvas and the pictures take, in bytes. */
  get bytes(): number {
    let total = this.el.width * this.el.height * 4;
    if (!this.pictures) return total;
    for (const sprite of this.pictures.sprites.values()) total += sprite.w * sprite.h * 4 * (sprite.far ? 2 : 1);
    for (const mask of [this.pictures.gap, this.pictures.body]) if (mask) total += mask.frame.width * mask.frame.height * 4;
    return total;
  }

  /**
   * The start of a track: half a frame in. A 60 fps track on a 60 Hz screen moves on one frame at a time, and
   * the screen's times are rounded (to a whole ms in Safari): counted from 0, each would fall on the edge
   * between two track frames, and now and then one would be shown twice and the next never.
   */
  private start(track: string): { walking: string; ms: number } {
    return { walking: track, ms: 500 / this.tracks[track].fps };
  }

  private roll([least, most]: readonly [number, number]): number {
    return least + this.rnd() * (most - least);
  }

  /** Wipe what the last drawing marked. */
  private clear(): void {
    const { marked } = this;
    if (marked) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(marked.x, marked.y, marked.w, marked.h);
    }
    this.marked = null;
    this.drawn = -1;
  }

  private draw(track: Track, index: number): void {
    const { ctx, pictures } = this;
    if (!pictures || !this.el.width) return;
    this.clear();
    this.drawn = index;
    const entries = track.frames[index].filter((entry) => pictures.sprites.has(entry.s));
    // Only the part of the canvas these drawings touch is worked on (turned, a sprite stays within its diagonal).
    let box = [this.el.width, this.el.height, 0, 0];
    for (const entry of entries) {
      const { w, h } = pictures.sprites.get(entry.s)!;
      const x = entry.x - this.origin[0];
      const y = entry.y - this.origin[1];
      const reach = Math.hypot(w / 2, h);
      const [l, t, r, b] = entry.rot ? [x - reach, y - reach, x + reach, y + reach] : [x - w / 2, y - h, x + w / 2, y];
      box = [Math.min(box[0], l), Math.min(box[1], t), Math.max(box[2], r), Math.max(box[3], b)];
    }
    const x = Math.max(0, Math.floor(box[0]) - 1);
    const y = Math.max(0, Math.floor(box[1]) - 1);
    const w = Math.min(this.el.width, Math.ceil(box[2]) + 1) - x;
    const h = Math.min(this.el.height, Math.ceil(box[3]) + 1) - y;
    if (w <= 0 || h <= 0) return;
    this.marked = { x, y, w, h };
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    for (const entry of entries) {
      const sprite = pictures.sprites.get(entry.s)!;
      ctx.setTransform(entry.flip ? -1 : 1, 0, 0, 1, entry.x - this.origin[0], entry.y - this.origin[1]);
      if (entry.rot) ctx.rotate(((entry.flip ? -1 : 1) * entry.rot * Math.PI) / 180);
      ctx.drawImage((entry.far && !entry.body && sprite.far) || sprite.near, -sprite.w / 2, -sprite.h);
    }
    const mask = entries.some((entry) => entry.body) ? pictures.body : pictures.gap;
    if (mask) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(mask.frame, mask.x - this.origin[0], mask.y - this.origin[1]);
    }
    ctx.restore();
  }
}

function release(pictures: Pictures): void {
  for (const sprite of pictures.sprites.values()) {
    releaseFrame(sprite.near);
    if (sprite.far) sprite.far.width = sprite.far.height = 0;
  }
  for (const mask of [pictures.gap, pictures.body]) if (mask) releaseFrame(mask.frame);
}

// The hunt's progress, shown in the picture: the theatre's backdrop, painted one more swath for each mushroom
// found in the scene (cast.ts, `hunt_progress`). The k-th piece is shown once k are found.
//
// One canvas, the size of all the pieces together, holds every piece already shown, drawn once in order
// ("baked"): the page never draws ten pieces a frame. A new piece fades in on a small canvas of its own over
// it, by opacity alone (the compositor's work), and is baked when the fade ends. Coming back to the scene, or
// with reduced motion, the pieces are simply there.
//
// Only the pieces the hunt has reached are downloaded before the scene is shown, and the next one straight after;
// the others follow in hunt order, once the scene has settled (stream()). A piece found before its file is here is
// downloaded at once. The pieces' files are kept as downloaded. Out of sight the canvas is given back; the pieces are decoded
// again and baked when the scene comes back. The next piece to show is kept decoded, so a find's fade starts
// on the find.
import { PLATE, decodeBlob, idle, releaseFrame, type Frame } from './assets';
import type { ProgressPiece, Rect } from './cast';
import { CSS_EASE_OUT, reducedMotion } from './motion';

const pct = (value: number, of: number): string => `${(value / of) * 100}%`;

/** Where a rectangle of the plate goes on the page: as a share of the plate, so it scales with it. */
function place(el: HTMLElement, box: Rect): void {
  Object.assign(el.style, { left: pct(box.x, PLATE.w), top: pct(box.y, PLATE.h), width: pct(box.w, PLATE.w), height: pct(box.h, PLATE.h) });
}

/** Downloads the file of a piece (its index in the list). */
export type PieceLoader = (index: number, signal?: AbortSignal) => Promise<Blob>;

export class Progress {
  readonly el: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly pieces: readonly ProgressPiece[];
  private readonly load: PieceLoader;
  /** The pieces' files, as downloaded or on their way. */
  private readonly files: Array<Promise<Blob> | undefined>;
  private readonly fadeMs: number;
  /** How many of this scene's mushrooms are found. */
  private readonly found: () => number;
  /** The rectangle of the plate all the pieces lie in. */
  private readonly area: Rect;
  /** How many pieces are drawn on the canvas. */
  private baked = 0;
  /** How many pieces are shown or fading in. */
  private shown = 0;
  /** The next piece's picture, decoded ahead (index in `pieces`). */
  private ahead: { index: number; frame: Promise<Frame | null> } | null = null;
  /** Fades under way, each with its piece's picture, baked in order as they end. */
  private readonly fading = new Map<number, { frame: Frame; overlay: HTMLCanvasElement; done: boolean }>();
  private awake = false;
  private generation = 0;
  private work: Promise<void> = Promise.resolve();

  /** `files`: those downloaded already, in order from the first; `load` fetches another. */
  constructor(pieces: readonly ProgressPiece[], files: readonly Blob[], load: PieceLoader, fadeMs: number, found: () => number) {
    this.pieces = pieces;
    this.load = load;
    this.files = pieces.map((_, i) => (files[i] ? Promise.resolve(files[i]) : undefined));
    this.fadeMs = fadeMs;
    this.found = found;
    const left = Math.floor(Math.min(...pieces.map((p) => p.box.x)));
    const top = Math.floor(Math.min(...pieces.map((p) => p.box.y)));
    const right = Math.ceil(Math.max(...pieces.map((p) => p.box.x + p.box.w)));
    const bottom = Math.ceil(Math.max(...pieces.map((p) => p.box.y + p.box.h)));
    this.area = { x: left, y: top, w: right - left, h: bottom - top };
    this.el = document.createElement('canvas');
    this.el.className = 'hj-progress';
    this.el.setAttribute('aria-hidden', 'true');
    place(this.el, this.area);
    this.ctx = this.el.getContext('2d')!;
  }

  /** Draw every piece the hunt has reached, at once (the scene is going on the page). Resolves when they are drawn. */
  wake(): Promise<void> {
    if (this.awake) return this.work;
    this.awake = true;
    const at = this.generation;
    this.work = this.work.then(async () => {
      if (at !== this.generation) return;
      this.el.width = this.area.w;
      this.el.height = this.area.h;
      this.baked = 0;
      const want = Math.min(this.pieces.length, this.found());
      for (let i = 0; i < want; i++) {
        const frame = await this.decode(i);
        if (at !== this.generation) {
          if (frame) releaseFrame(frame);
          return;
        }
        if (frame) this.bake(i, frame);
      }
      this.shown = want;
      this.prepare();
    });
    return this.work;
  }

  /**
   * The hunt has moved on: show every piece it has reached that is not shown yet, fading in (each from now,
   * over the package's fade_ms, ease-out), or at once with reduced motion or out of sight. (Back, if it has been
   * reset: the canvas is drawn again from the start.)
   */
  reach(): void {
    if (!this.awake) return;
    const want = Math.min(this.pieces.length, this.found());
    if (want < this.shown) {
      this.sleep();
      this.shown = want;
      void this.wake();
      return;
    }
    const at = this.generation;
    while (this.shown < want) {
      const index = this.shown++;
      this.work = this.work.then(async () => {
        if (at !== this.generation) return;
        const frame = await this.decode(index);
        if (!frame || at !== this.generation) {
          if (frame) releaseFrame(frame);
          return;
        }
        if (document.hidden || reducedMotion() || this.fadeMs <= 0) this.bake(index, frame);
        else this.fade(index, frame);
        this.prepare();
      });
    }
  }

  finishMotion(): void {
    for (const { overlay } of this.fading.values()) {
      for (const animation of overlay.getAnimations()) animation.finish();
    }
  }

  /** Out of sight: give the canvas back, and any picture held for the next piece. A fade under way ends at once. */
  sleep(): void {
    this.awake = false;
    this.generation++;
    // (Coming back never waits for a download still under way from before.)
    this.work = Promise.resolve();
    for (const [, fade] of this.fading) {
      fade.overlay.getAnimations().forEach((a) => a.cancel());
      fade.overlay.remove();
      fade.overlay.width = fade.overlay.height = 0;
      releaseFrame(fade.frame);
    }
    this.fading.clear();
    void this.ahead?.frame.then((frame) => frame && releaseFrame(frame));
    this.ahead = null;
    this.el.width = 0;
    this.el.height = 0;
    this.baked = 0;
  }

  /** Copy what is shown onto another canvas (the sheet the brush rubs away when the visitor leaves). */
  sketch(ctx: CanvasRenderingContext2D, origin: DOMRect): void {
    if (!this.el.width) return;
    const r = this.el.getBoundingClientRect();
    ctx.drawImage(this.el, r.left - origin.left, r.top - origin.top, r.width, r.height);
    for (const [, fade] of this.fading) {
      const f = fade.overlay.getBoundingClientRect();
      ctx.globalAlpha = Number(getComputedStyle(fade.overlay).opacity);
      ctx.drawImage(fade.overlay, f.left - origin.left, f.top - origin.top, f.width, f.height);
      ctx.globalAlpha = 1;
    }
  }

  /** QA: how many pieces are shown, and how many are drawn into the canvas. */
  get state(): { shown: number; baked: number; fading: number } {
    return { shown: this.shown, baked: this.baked, fading: this.fading.size };
  }

  /** What the canvases and the pictures held take, in bytes. */
  get bytes(): number {
    let total = this.el.width * this.el.height * 4;
    for (const [, fade] of this.fading) total += fade.overlay.width * fade.overlay.height * 4 * 2;
    if (this.ahead && this.pieces[this.ahead.index]) total += this.pieces[this.ahead.index].box.w * this.pieces[this.ahead.index].box.h * 4;
    return total;
  }

  /**
   * Download the pieces whose files are not here yet, in hunt order from the next one to show, one at a time, until
   * `signal` says to stop. `most`: only so many of them (the next one: it does not wait for a quiet moment).
   */
  async stream(signal: AbortSignal, most = Infinity): Promise<void> {
    for (let i = Math.max(this.shown, this.found()); i < this.pieces.length && most > 0; i++, most--) {
      if (this.files[i]) {
        // (On its way already, asked for by a find: the next one waits for it.)
        await this.files[i]!.catch(() => {});
        continue;
      }
      if (most === Infinity) await idle();
      if (signal.aborted) return;
      await this.file(i, signal).catch(() => {});
      if (signal.aborted) return;
      // (The next piece is kept decoded, so a find's fade starts on the find.)
      if (i === this.shown) this.prepare();
    }
  }

  /** QA: which pieces' files are here or on their way. */
  get downloaded(): number[] {
    return this.files.flatMap((file, i) => (file ? [i] : []));
  }

  /** A piece's file: here already, on its way, or fetched now. One that fails, or is called off, is asked for again next time. */
  private file(index: number, signal?: AbortSignal): Promise<Blob> {
    const here = this.files[index];
    if (here) return here;
    const file = this.load(index, signal);
    this.files[index] = file;
    file.catch(() => {
      if (this.files[index] === file) this.files[index] = undefined;
    });
    return file;
  }

  /** Keep the next piece decoded, ready for the next find, once its file is here. */
  private prepare(): void {
    const next = this.shown;
    const file = this.files[next];
    if (!this.awake || next >= this.pieces.length || this.ahead?.index === next || !file) return;
    this.ahead = { index: next, frame: file.then(decodeBlob).catch(() => null) };
  }

  /** A piece's picture: the one decoded ahead, or decoded now (its file downloaded first, if need be). */
  private decode(index: number): Promise<Frame | null> {
    const ahead = this.ahead?.index === index ? this.ahead.frame : null;
    if (ahead) this.ahead = null;
    // (A download that was called off as the visitor went elsewhere is asked for again, now its piece is wanted.)
    const now = (): Promise<Frame | null> => this.file(index).catch(() => this.file(index)).then(decodeBlob).catch(() => null);
    return ahead ? ahead.then((frame) => frame ?? now()) : now();
  }

  private bake(index: number, frame: Frame): void {
    const { box } = this.pieces[index];
    this.ctx.drawImage(frame, Math.round(box.x - this.area.x), Math.round(box.y - this.area.y));
    releaseFrame(frame);
    this.baked = Math.max(this.baked, index + 1);
  }

  private fade(index: number, frame: Frame): void {
    const { box } = this.pieces[index];
    const overlay = document.createElement('canvas');
    overlay.className = 'hj-progress is-fading';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.width = Math.round(box.w);
    overlay.height = Math.round(box.h);
    overlay.getContext('2d')!.drawImage(frame, 0, 0);
    place(overlay, box);
    overlay.style.opacity = '0';
    // Over the canvas, and over any piece still fading in under it.
    ([...this.fading.values()].at(-1)?.overlay ?? this.el).after(overlay);
    const entry = { frame, overlay, done: false };
    this.fading.set(index, entry);
    const animation = overlay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: this.fadeMs, easing: CSS_EASE_OUT, fill: 'forwards' });
    void animation.finished.then(
      () => {
        entry.done = true;
        // Baked in order: a piece that ends its fade before the one under it waits for it.
        for (let i = this.baked; this.fading.get(i)?.done; i++) {
          const fade = this.fading.get(i)!;
          this.fading.delete(i);
          this.bake(i, fade.frame);
          fade.overlay.remove();
        }
      },
      () => {},
    );
  }
}

// How a picture arrives in the window. Three ways, one clock each. "Painted" is for this visit only: site.ts keeps
// it in memory, and nothing saved from an earlier visit ever skips a painting.
//
// 1. A scene's first appearance in a visit, the opening one's too: its room is painted in over about five
//    seconds, then the page goes quiet.
//
//   Element             Role        Starts    Lasts    Motion                      Relationship
//   Brush strokes       Lead        0         4.32 s   paint, region by region     uneven and overlapping
//   The edge's pencil   Support     -         -        sketched in beside each stroke   with the paint, never before it
//   The wash            Support     4.06 s    0.42 s   the rest of the picture fades up   overlaps the last strokes
//   Mushrooms           Decoration  -         -        painted with the room       usable from the wash on
//   Character + shadow  Lead        -         -        painted with the room       at her first frame, quite still
//   Caption             Support     4.56 s    0.20 s   fade + 4 px rise            just behind the wash (first showing only)
//   Idle routine        -           4.74 s    -        first move at about 5.0 s   0.26 s after the wash: the paint is dry
//
// 2. A return to a scene already painted in this visit: the new picture is brushed in over the old one with
//    the same strokes, played faster.
//
//   Element             Role        Starts    Lasts    Motion                      Relationship
//   Brush strokes       Lead        0         2.40 s   the old picture comes off   the first painting's, 1.8 times as fast
//   The wash            Support     2.30 s    0.35 s   the rest of the old fades   overlaps the last strokes
//   Character           -           2.65 s    -        carries on                  as the last of the old picture goes
//
// 3. Reduced motion: no brushwork. Everything shows together in 200 ms, the colour and the pencil of the edge
//    alike: a blank sheet (or a copy of the picture being left) fades off the finished picture.
//
// A painting may be left for another scene at any moment: halt() stops the brush and leaves its sheet where it
// is. The half-painted picture fades off whole, sheet and all, before a first painting; before a brush-over it
// is what the copy shows, as it stands. Either way it is never seen finished, and the next scene is painted.
// Only Skip, or a tap on the tab of the scene being painted, jumps to the finished picture (skip()).
//
// What stays still, and why: the page, the logo and the frame never move (the picture is the only event);
// neither the mushrooms nor the character has an entrance of its own. They are painted by the same strokes as
// the room around them, so at no moment is the room there and she not: a mushroom beside the place she was
// still to fill would give itself away (review: scene-5-build-round4.md).
//
// How it is built: the finished picture is on the page from the start, under a sheet that the brush rubs
// away (paint.ts): blank paper for a first painting, a copy of the picture being left for a brush-over. She is under
// it too, drawn once and not again until it is gone, so a frame of painting costs only its strokes. The
// picture's one-off cost of being drawn is paid before the clock starts (site.ts, Scene.drawn()), and nothing is swapped or cleared
// when the brush stops: the sheet, by then clear, is taken away a little later.
//
// The pencil of the edge lies over that sheet (the edge is what stops the paint at the painting's shape),
// so in a first painting it has a veil of its own: a second, coarse sheet of blank paper, only where
// the edge holds the colour back. The same strokes take it away, each about 70 px wider than its paint and
// a little softer in time (paint.ts, VEIL): the pencil beyond the colour is sketched in beside each stroke
// as it gets there, over about a fifth of a second, and never shows where the paint has not come yet.
import { PLATE } from './assets';
import { EASE_OUT, gsap } from './motion';
import { Painter } from './paint';
import { paperCss } from './paper';
import type { Scene } from './scene';

export interface Stage {
  root: HTMLElement;
  /** The fixed window onto the room (the scroller's parent). A switch's sheet lies over it. */
  window: HTMLElement;
  viewport: HTMLElement;
  caption: HTMLElement;
  seed?: number;
}

const REVEAL_MS = 200;
/** How far past its paint a stroke brings the edge's pencil up, in plate px (reviews/scene-edge-pencil.md, 3b). */
const PENCIL_SPREAD = 70;
/** The veil over the edge's pencil is plain paper with soft strokes through it: a quarter of the plate's size does. */
const VEIL_PIXELS = 100_000;
/**
 * The veil is the edge itself, in plain paper, laid down twice and then that many times doubled: 32 layers.
 * So it is all but whole wherever the edge holds any colour back to speak of (under it the pencil shows at
 * 1% at the very most), and it is not there at all where the whole painting shows.
 */
const VEIL_DOUBLINGS = 4;
/** How long the clear sheet stays on after the brush stops, before it is taken off the page. */
const TIDY_MS = 2500;
/** A return to a scene already painted in this visit: the brush, then the wash, in seconds. */
const SWITCH_BRUSH_S = 2.4;
const SWITCH_WASH_S = 0.35;

/** What lies over a picture whose painting has been left part way. */
export interface Sheets {
  /** The sheet the brush was rubbing away. */
  sheet: HTMLCanvasElement | null;
  /** The sheet lies over the window (a brush-over's), not over the plate. */
  overWindow: boolean;
  veil: HTMLCanvasElement | null;
}

export class Transition {
  private readonly stage: Stage;
  private fade: Animation | null = null;
  private finishFade: ((show: boolean) => void) | null = null;
  private brushCrop: { x: number; width: number; w: number; h: number } | null = null;
  private finishBrush: (() => void) | null = null;
  private timeline: gsap.core.Timeline | null = null;
  private painter: Painter | null = null;
  /** Over the edge's pencil while a first-visit painting has not reached it. */
  private veil: Painter | null = null;
  /** The veil has its shape (it takes it from the edge, which may be drawn only after prepare()). */
  private veiled = false;
  /** The edge, while it is kept out of sight until a painting's veil can have its shape. */
  private hidden: HTMLElement[] = [];
  /** The blank sheet of a reveal. */
  private blank: HTMLElement | null = null;
  private tidy = 0;
  /** The painting about to play is the page's first showing, so the caption arrives with it. */
  private withCaption = false;
  /** The caption has yet to arrive with the painting under way. */
  private captionDue = false;

  constructor(stage: Stage) {
    this.stage = stage;
  }

  /** QA: what the sheet on the page takes, in bytes (none when there is no sheet). */
  get sheetBytes(): number {
    return [this.painter, this.veil].reduce((sum, sheet) => sum + (sheet ? sheet.canvas.width * sheet.canvas.height * 4 : 0), 0);
  }

  /** True while a brush is at work. */
  get running(): boolean {
    return this.timeline !== null || this.fade !== null;
  }

  /** How long the brush at work has been at it, in seconds. Null when there is none (a fade is not one). */
  get brushing(): number | null {
    return this.timeline?.time() ?? null;
  }

  /** The sheet over the window, if there is one: it does not go when the plate does. */
  get overWindow(): HTMLElement | null {
    return this.painter && !this.veil ? this.painter.canvas : null;
  }

  /**
   * Another scene is about to take this one's place: the brush stops where it is. Its sheet stays on the page, for
   * the old picture to leave under, until prepare() or cover(). Returns how long it had been at work, in seconds.
   */
  halt(): number {
    const worked = this.brushing ?? 0;
    this.timeline?.kill();
    this.timeline = null;
    this.brushCrop = null;
    window.clearTimeout(this.tidy);
    const done = this.finishBrush;
    this.finishBrush = null;
    // The page's first painting has not brought the caption yet: it comes by itself, once it says where the visitor is going.
    if (this.captionDue) {
      this.captionDue = false;
      gsap.to(this.stage.caption, { opacity: 1, y: 0, delay: 0.5, duration: 0.2, ease: EASE_OUT, clearProps: 'opacity,transform,willChange' });
    }
    done?.();
    return worked;
  }

  /** Jump to the finished picture, at any point. */
  skip(): void {
    // Rendering the timeline at its end clears the sheet, frees the mushrooms, shows the character and the
    // caption, and runs the callbacks, exactly as if it had played through.
    this.timeline?.progress(1);
    this.finishFade?.(true);
  }

  /** Finish a prepared picture even if its animation clock has not started. */
  finish(scene: Scene): void {
    if (this.running) {
      this.skip();
      return;
    }
    if (this.veil) {
      const edge = scene.plate.querySelector<HTMLElement>('.hj-edge');
      if (edge) gsap.set(edge, { clearProps: 'opacity' });
      if (this.withCaption) gsap.set(this.stage.caption, { clearProps: 'opacity,transform' });
      this.captionDue = false;
    }
    this.clear();
    this.show(scene);
  }

  /**
   * The room under a brush-over has moved in its window. Panned, the brush follows it: what is left of the old
   * picture stays where it is, and the strokes still to come go where the new one has got to. With the window
   * itself another shape (the phone turned), the sheet no longer fits it: straight to the finished picture.
   */
  cropChanged(view: { x: number; width: number }): void {
    const crop = this.brushCrop;
    if (!crop) return;
    const { clientWidth: w, clientHeight: h } = this.stage.window;
    if (crop.width !== view.width || crop.w !== w || crop.h !== h) this.skip();
    else if (crop.x !== view.x) {
      crop.x = view.x;
      this.painter?.aim(w / Math.min(view.width, PLATE.w), view.x);
    }
  }

  /** Simply there. */
  show(scene: Scene): void {
    this.stage.root.classList.remove('is-pre');
    scene.hunt.el.inert = false;
    scene.work();
  }

  /** Reduced motion: everything together in 200 ms. */
  reveal(scene: Scene): Promise<void> {
    const { root } = this.stage;
    this.clear();
    // The finished picture is put up whole under a blank sheet, and the sheet fades off it: one opacity
    // animation, run by the compositor. (Each part fading up by itself would not do: while the edge is
    // only part there, the room under it shows right to the plate's rim, and its pencil before its colour.)
    const blank = document.createElement('div');
    blank.className = 'hj-blank';
    blank.setAttribute('aria-hidden', 'true');
    blank.style.background = paperCss(root);
    scene.hunt.el.inert = true;
    scene.plate.append(blank);
    this.blank = blank;
    // The caption is not in the picture: it has a transition of its own (site.css).
    root.classList.add('is-revealing');
    void root.offsetWidth;
    root.classList.remove('is-pre');
    return this.fadeSheet(blank, scene, () => root.classList.remove('is-revealing'));
  }

  /**
   * Set the page up for a first painting about to start: a blank sheet over the finished picture, the
   * character and all. Call it a moment before paint(), so the picture under the sheet is drawn before
   * the clock starts and not in the painting's first frame.
   */
  prepare(scene: Scene): void {
    const { root, caption } = this.stage;
    const { plate, hunt } = scene;
    const first = root.classList.contains('is-pre');
    this.withCaption = first;
    this.clear();
    this.captionDue = first;
    // The sheet has the colour of the page the painting sits on.
    const paper = paperCss(this.stage.root);
    this.painter = new Painter({
      width: plate.clientWidth,
      height: plate.clientHeight,
      fill: (ctx, width, height) => {
        ctx.fillStyle = paper;
        ctx.fillRect(0, 0, width, height);
      },
      strokes: scene.config.strokes,
      seed: this.stage.seed,
    });
    // Over the room, the mushrooms, the character and the rest of her cast (whoever is put on the plate later
    // goes under it too: Scene.mark); under the painting's soft edge, so the brush never paints past it.
    scene.mark.after(this.painter.canvas);
    // The edge's pencil would be there before any paint, so it gets a veil of the same paper, which the
    // same strokes take away as they pass. On top of the plate; it goes on the page now, empty, and takes
    // its shape from the edge as soon as that is drawn. Until then the edge stays out of sight.
    this.veil = new Painter({
      width: plate.clientWidth,
      height: plate.clientHeight,
      fill: () => {},
      strokes: scene.config.strokes,
      maxPixels: VEIL_PIXELS,
      spread: PENCIL_SPREAD,
      seed: this.stage.seed,
    });
    this.veil.canvas.classList.add('is-veil');
    plate.append(this.veil.canvas);
    this.veiled = false;
    this.drape(scene, paper);
    // The caption arrives with the picture the first time; afterwards it is already there and stays.
    const hidden: HTMLElement[] = [];
    const edge = plate.querySelector<HTMLElement>('.hj-edge');
    if (edge && !this.veiled) hidden.push(edge);
    if (first) {
      hidden.push(caption);
      // Its layer is made now: made as it fades in, it cost WebKit a frame of 35 ms.
      caption.style.willChange = 'opacity, transform';
    }
    if (hidden.length) gsap.set(hidden, { opacity: 0 });
    this.hidden = edge && !this.veiled ? [edge] : [];
    // Unpainted mushrooms can't be found yet, by pointer or by keyboard.
    hunt.el.inert = true;
    root.classList.remove('is-pre');
  }

  /** Give the veil the edge's shape, if the edge is drawn and the veil has none yet. */
  private drape(scene: Scene, paper: string): void {
    if (this.veiled || !this.veil) return;
    this.veil.refill((ctx, width, height) => {
      this.veiled = scene.edgeOnto(ctx, 0, 0, width, height) && scene.edgeOnto(ctx, 0, 0, width, height);
      for (let i = 0; i < VEIL_DOUBLINGS; i++) ctx.drawImage(ctx.canvas, 0, 0, width, height);
      // The edge's own pencil came along: plain paper, in the same shape.
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, width, height);
    });
  }

  /** The first painting of a visit. Resolves when everything is settled, or when it is left (halt()). */
  paint(scene: Scene, collectDuringWash = true): Promise<void> {
    const { caption } = this.stage;
    const { hunt } = scene;
    if (!this.painter?.fresh) this.prepare(scene);
    const painter = this.painter!;
    const veil = this.veil;
    // The edge was drawn after prepare() (a scene opened for the first time from another): veil it now,
    // and let it show.
    const edge = scene.plate.querySelector<HTMLElement>('.hj-edge');
    if (!this.veiled) {
      this.drape(scene, paperCss(this.stage.root));
      if (edge) gsap.set(edge, { clearProps: 'opacity' });
    }

    // (QA: where a trace of the production build finds the painting.)
    performance.mark('hj-paint');
    return new Promise((resolve) => {
      const clock = { t: 0 };
      const wash = painter.seconds - 0.26;
      const workAt = wash + 0.68;
      const captionAt = wash + 0.5;
      const timeline = this.clock(painter, resolve);

      // The strokes. GSAP's ticker is the clock, so the paint, the wash and what follows cannot drift apart.
      // Each takes the sheet off the room and, in the same frame, the veil off the pencil around it.
      const stroke = (): void => {
        painter.paintTo(clock.t);
        veil?.paintTo(clock.t);
      };
      timeline.to(clock, { t: painter.seconds, duration: painter.seconds, ease: 'none', onUpdate: stroke }, 0);

      // The wash: whatever the brush missed comes up evenly, the edge's pencil along with the picture, so the
      // two finish together. From here the mushrooms can be found.
      const washed = { amount: 0 };
      const rinse = (): void => {
        painter.wash(washed.amount);
        veil?.wash(washed.amount);
      };
      timeline.call(() => void (hunt.el.inert = false), undefined, collectDuringWash ? wash : wash + 0.42);
      timeline.to(washed, { amount: 1, duration: 0.42, ease: 'power1.inOut', onUpdate: rinse }, wash);

      // She has been painted with the room, at her first frame. A still moment (0.26 s) once the last of the
      // sheet has gone, so she never moves under paint, then she gets to work.
      timeline.call(() => scene.work(), undefined, workAt);

      // The caption, as the wash ends.
      if (this.withCaption) {
        timeline.call(() => void (this.captionDue = false), undefined, captionAt + 0.2);
        timeline.fromTo(caption, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.2, ease: EASE_OUT }, captionAt);
      } else {
        // Keeps the painting the same length whether or not the caption arrives with it.
        timeline.to({}, { duration: 0.2 }, captionAt);
      }
    });
  }

  /**
   * The start of a switch between scenes: lay a copy of the picture as it is now (`sketch` draws it) over
   * the window. Whatever is then changed underneath stays out of sight until brushOver() or fadeOver(). If its
   * painting was left part way, the copy shows it so: `sketch` is given the sheets still over it.
   */
  cover(sketch: (ctx: CanvasRenderingContext2D, origin: DOMRect, sheets: Sheets) => void, next: Scene): void {
    const { window: frame } = this.stage;
    const left: Sheets = { sheet: this.painter?.canvas ?? null, overWindow: this.overWindow !== null, veil: this.veil?.canvas ?? null };
    this.clear(true);
    next.hunt.el.inert = true;
    const origin = frame.getBoundingClientRect();
    this.painter = new Painter({
      width: frame.clientWidth,
      height: frame.clientHeight,
      fill: (ctx) => sketch(ctx, origin, left),
      strokes: next.config.strokes,
      pace: Math.max(...next.config.strokes.map((stroke) => stroke.at + stroke.takes)) / SWITCH_BRUSH_S,
      // It holds a picture, so it needs the picture's detail.
      maxPixels: 2_000_000,
      seed: this.stage.seed,
    });
    // (Their pixels go back now, and not when the browser gets round to it.)
    for (const canvas of [left.sheet, left.veil]) if (canvas) canvas.width = canvas.height = 0;
    this.painter.canvas.classList.add('is-over-window');
    frame.append(this.painter.canvas);
  }

  /**
   * The new picture is brushed in over the old one. `view` says which part of the new plate the window
   * shows (plate x at its left edge, plate px across), so the strokes follow the new picture.
   */
  brushOver(scene: Scene, view: { x: number; width: number }): Promise<void> {
    const painter = this.painter;
    if (!painter) {
      this.show(scene);
      return Promise.resolve();
    }
    const { clientWidth: w, clientHeight: h } = this.stage.window;
    this.brushCrop = { ...view, w, h };
    painter.aim(w / Math.min(view.width, PLATE.w), view.x);
    performance.mark('hj-brush');
    return new Promise((resolve) => {
      const clock = { t: 0 };
      const timeline = this.clock(painter, resolve);
      timeline.to(clock, { t: painter.seconds, duration: painter.seconds, ease: 'none', onUpdate: () => void painter.paintTo(clock.t) }, 0);
      const washed = { amount: 0 };
      timeline.to(
        washed,
        { amount: 1, duration: SWITCH_WASH_S, ease: 'power1.inOut', onUpdate: () => painter.wash(washed.amount) },
        painter.seconds - 0.1,
      );
      // She was drawn under the old picture, still; she starts as the last of it goes.
      timeline.call(() => this.show(scene), undefined, painter.seconds + SWITCH_WASH_S - 0.1);
    });
  }

  /** Reduced motion: the old picture fades off the new one in 200 ms. */
  fadeOver(scene: Scene): Promise<void> {
    const painter = this.painter;
    if (!painter) {
      this.show(scene);
      return Promise.resolve();
    }
    return this.fadeSheet(painter.canvas, scene);
  }

  private fadeSheet(sheet: HTMLElement, scene: Scene, done?: () => void): Promise<void> {
    const fade = sheet.animate([{ opacity: 1 }, { opacity: 0 }], { duration: REVEAL_MS, easing: 'linear', fill: 'forwards' });
    this.fade = fade;
    return new Promise((resolve) => {
      const finish = (show: boolean): void => {
        this.finishFade = null;
        this.fade = null;
        fade.onfinish = null;
        if (show) {
          fade.finish();
          this.show(scene);
          if (sheet === this.blank) this.tidy = window.setTimeout(() => this.clear(), TIDY_MS);
          else this.clear();
        } else {
          fade.cancel();
        }
        done?.();
        resolve();
      };
      this.finishFade = finish;
      fade.onfinish = () => finish(true);
    });
  }

  /** The page is being left: take every sheet off it, and whatever a painting that has not begun was keeping out of sight is shown. */
  release(): void {
    this.clear();
    this.unhide();
  }

  /** Shown again: what prepare() kept out of sight. */
  private unhide(): void {
    if (this.hidden.length) gsap.set(this.hidden, { clearProps: 'opacity' });
    this.hidden = [];
  }

  /** Take any sheet off the page now, and give their pixels back (`keep`: the caller has still to copy them). */
  clear(keep = false): void {
    window.clearTimeout(this.tidy);
    this.finishFade?.(false);
    this.brushCrop = null;
    this.stage.caption.style.willChange = '';
    this.timeline?.kill();
    this.timeline = null;
    this.finishBrush?.();
    this.finishBrush = null;
    this.lift(keep);
    this.blank?.remove();
    this.blank = null;
  }

  /** The sheet and the veil come off the page. (A canvas waiting to be collected still counts against what iOS gives a page.) */
  private lift(keep = false): void {
    for (const sheet of [this.painter, this.veil]) {
      if (!sheet) continue;
      sheet.canvas.remove();
      if (!keep) sheet.canvas.width = sheet.canvas.height = 0;
    }
    this.painter = this.veil = null;
  }

  /** A timeline that owns the brush until it completes. */
  private clock(painter: Painter, done: () => void): gsap.core.Timeline {
    const timeline = gsap.timeline({
      onComplete: () => {
        // Nothing is swapped or cleared here: GSAP's end values stay inline and the sheet, now clear, stays
        // where it is. (In WebKit, changing the plate's layers in this frame repainted all of it at once:
        // review 02 measured 55–60 ms.) It is taken away a little later, when only the character is moving.
        this.timeline = null;
        this.finishBrush = null;
        this.brushCrop = null;
        this.tidy = window.setTimeout(() => {
          if (this.painter !== painter || this.timeline) return;
          this.lift();
          this.stage.caption.style.willChange = '';
        }, TIDY_MS);
        done();
      },
    });
    this.timeline = timeline;
    this.finishBrush = done;
    return timeline;
  }
}

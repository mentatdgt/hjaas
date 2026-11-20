// How a picture arrives in the window. Three ways, one clock each:
//
// 1. The first visit to a scene: its room is painted in over about five seconds, then the page goes quiet.
//
//   Element             Role        Starts    Lasts    Motion                      Relationship
//   Brush strokes       Lead        0         4.32 s   paint, region by region     uneven and overlapping
//   The edge's pencil   Support     -         -        sketched in beside each stroke   with the paint, never before it
//   The wash            Support     4.06 s    0.42 s   the rest of the room fades up   overlaps the last strokes
//   Mushrooms           Decoration  -         -        painted with the room       usable from the wash on
//   Character + shadow  Lead        4.40 s    0.28 s   fade + 4 px settle          as the wash lands
//   Caption             Support     4.56 s    0.20 s   fade + 4 px rise            just behind her (first showing only)
//   Idle routine        -           4.74 s    -        first move at about 5.0 s   after a brief still moment
//
// 2. A switch to a scene already seen: the new picture is brushed in over the old one with the same
//    strokes, played quickly: about 1.2 s of brush and a 0.25 s wash, 1.45 s in all.
//
// 3. A return visit, or reduced motion: no brushwork. Everything shows together in 200 ms, the colour and
//    the pencil of the edge alike: a blank sheet fades off the finished picture.
//
// What stays still, and why: the page, the logo and the frame never move (the picture is the only event);
// the mushrooms have no entrance of their own (they belong to the room, and the brush paints them with it).
//
// How it is built: the finished picture is on the page from the start, under a sheet that the brush rubs
// away (paint.ts): blank paper for a first visit, a copy of the picture being left for a switch. The
// picture's one-off cost of being drawn is paid before the clock starts, and nothing is swapped or cleared
// when the brush stops: the sheet, by then clear, is taken away a little later.
//
// The pencil of the edge lies over that sheet (the edge is what stops the paint at the painting's shape),
// so in a first-visit painting it has a veil of its own: a second, coarse sheet of blank paper, only where
// the edge holds the colour back. The same strokes take it away, each about 70 px wider than its paint and
// a little softer in time (paint.ts, VEIL): the pencil beyond the colour is sketched in beside each stroke
// as it gets there, over about a fifth of a second, and never shows where the paint has not come yet.
import { PLATE } from './assets';
import { EASE_OUT, gsap } from './motion';
import { Painter } from './paint';
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
/** A switch between scenes: the brush, then the wash, in seconds. */
const SWITCH_BRUSH_S = 1.2;
const SWITCH_WASH_S = 0.25;

export class Transition {
  private readonly stage: Stage;
  private timeline: gsap.core.Timeline | null = null;
  private painter: Painter | null = null;
  /** Over the edge's pencil while a first-visit painting has not reached it. */
  private veil: Painter | null = null;
  /** The veil has its shape (it takes it from the edge, which may be drawn only after prepare()). */
  private veiled = false;
  /** The blank sheet of a reveal. */
  private blank: HTMLElement | null = null;
  private tidy = 0;
  /** The painting about to play is the page's first showing, so the caption arrives with it. */
  private withCaption = false;

  constructor(stage: Stage) {
    this.stage = stage;
  }

  /** QA: what the sheet on the page takes, in bytes (none when there is no sheet). */
  get sheetBytes(): number {
    return [this.painter, this.veil].reduce((sum, sheet) => sum + (sheet ? sheet.canvas.width * sheet.canvas.height * 4 : 0), 0);
  }

  /** True while a brush is at work. */
  get running(): boolean {
    return this.timeline !== null;
  }

  /** Jump to the finished picture, at any point. */
  skip(): void {
    // Rendering the timeline at its end clears the sheet, frees the mushrooms, shows the character and the
    // caption, and runs the callbacks, exactly as if it had played through.
    this.timeline?.progress(1);
  }

  /** Simply there. */
  show(scene: Scene): void {
    this.stage.root.classList.remove('is-pre');
    scene.work();
  }

  /** A return visit, or reduced motion: everything together in 200 ms. */
  reveal(scene: Scene): Promise<void> {
    const { root } = this.stage;
    this.clear();
    // The finished picture is put up whole under a blank sheet, and the sheet fades off it: one opacity
    // animation, run by the compositor. (Each part fading up by itself would not do: while the edge is
    // only part there, the room under it shows right to the plate's rim, and its pencil before its colour.)
    const blank = document.createElement('div');
    blank.className = 'hj-blank';
    blank.setAttribute('aria-hidden', 'true');
    blank.style.background = getComputedStyle(root).backgroundColor;
    scene.plate.append(blank);
    this.blank = blank;
    // The caption is not in the picture: it has a transition of its own (site.css).
    root.classList.add('is-revealing');
    void root.offsetWidth;
    root.classList.remove('is-pre');
    blank.animate([{ opacity: 1 }, { opacity: 0 }], { duration: REVEAL_MS, easing: 'linear', fill: 'forwards' });
    return new Promise((resolve) => {
      window.setTimeout(() => {
        root.classList.remove('is-revealing');
        scene.work();
        // The sheet, clear by now, is taken away a little later (as after a painting: see clock()).
        this.tidy = window.setTimeout(() => {
          if (this.blank !== blank) return;
          blank.remove();
          this.blank = null;
        }, TIDY_MS);
        resolve();
      }, REVEAL_MS + 20);
    });
  }

  /**
   * Set the page up for a first-visit painting about to start: a blank sheet over the finished picture, the
   * character out of sight. Call it a moment before paint(), so the picture under the sheet is drawn before
   * the clock starts and not in the painting's first frame.
   */
  prepare(scene: Scene): void {
    const { root, caption } = this.stage;
    const { plate, character, hunt } = scene;
    const first = root.classList.contains('is-pre');
    this.withCaption = first;
    this.clear();
    // The sheet has the colour of the page the painting sits on.
    const paper = getComputedStyle(this.stage.root).backgroundColor;
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
    // Over the room, her shadow and the mushrooms; under the character, who is not painted, and under the
    // painting's soft edge, so the brush never paints past it.
    plate.insertBefore(this.painter.canvas, character?.el ?? plate.querySelector('.hj-edge'));
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
    if (character) hidden.push(character.el);
    if (character?.shadow) hidden.push(character.shadow);
    if (first) hidden.push(caption);
    if (hidden.length) gsap.set(hidden, { opacity: 0 });
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

  /** The first-visit painting. Resolves when everything is settled. */
  paint(scene: Scene): Promise<void> {
    const { caption } = this.stage;
    const { character, hunt } = scene;
    if (!this.painter?.fresh) this.prepare(scene);
    const painter = this.painter!;
    const veil = this.veil;
    // The edge was drawn after prepare() (a scene opened for the first time from another): veil it now,
    // and let it show.
    const edge = scene.plate.querySelector<HTMLElement>('.hj-edge');
    if (!this.veiled) {
      this.drape(scene, getComputedStyle(this.stage.root).backgroundColor);
      if (edge) gsap.set(edge, { clearProps: 'opacity' });
    }

    return new Promise((resolve) => {
      const clock = { t: 0 };
      const wash = painter.seconds - 0.26;
      const characterAt = wash + 0.34;
      const captionAt = wash + 0.5;
      const timeline = this.clock(painter, resolve);

      // The strokes. GSAP's ticker is the clock, so the paint, the wash and the entrances cannot drift apart.
      // Each takes the sheet off the room and, in the same frame, the veil off the pencil around it.
      const stroke = (): void => {
        painter.paintTo(clock.t);
        veil?.paintTo(clock.t);
      };
      timeline.to(clock, { t: painter.seconds, duration: painter.seconds, ease: 'none', onUpdate: stroke }, 0);

      // The wash: whatever the brush missed comes up evenly. From here the mushrooms can be found.
      // (What is left of the veil goes twice as fast: it is over her too, and she comes in as the wash ends.)
      const washed = { amount: 0 };
      const rinse = (): void => {
        painter.wash(washed.amount);
        veil?.wash(Math.min(1, washed.amount * 2));
      };
      timeline.call(() => void (hunt.el.inert = false), undefined, wash);
      timeline.to(washed, { amount: 1, duration: 0.42, ease: 'power1.inOut', onUpdate: rinse }, wash);

      // The character: no paint on her. A short fade and a small settle, a still moment, then she gets to work.
      if (character) {
        const parts = character.shadow ? [character.el, character.shadow] : [character.el];
        timeline.fromTo(parts, { opacity: 0 }, { opacity: 1, duration: 0.28, ease: 'power1.out' }, characterAt);
        timeline.fromTo(character.el, { y: -4 }, { y: 0, duration: 0.28, ease: EASE_OUT }, characterAt);
      }
      timeline.call(() => scene.work(), undefined, characterAt + 0.34);

      // The caption, just behind her.
      if (this.withCaption) {
        timeline.fromTo(caption, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.2, ease: EASE_OUT }, captionAt);
      } else {
        // Keeps the painting the same length whether or not the caption arrives with it.
        timeline.to({}, { duration: 0.2 }, captionAt);
      }
    });
  }

  /**
   * The start of a switch between scenes: lay a copy of the picture as it is now (`sketch` draws it) over
   * the window. Whatever is then changed underneath stays out of sight until brushOver() or fadeOver().
   */
  cover(sketch: (ctx: CanvasRenderingContext2D, origin: DOMRect) => void, next: Scene): void {
    const { window: frame } = this.stage;
    this.clear();
    const origin = frame.getBoundingClientRect();
    this.painter = new Painter({
      width: frame.clientWidth,
      height: frame.clientHeight,
      fill: (ctx) => sketch(ctx, origin),
      strokes: next.config.strokes,
      pace: Math.max(...next.config.strokes.map((stroke) => stroke.at + stroke.takes)) / SWITCH_BRUSH_S,
      // It holds a picture, so it needs the picture's detail.
      maxPixels: 2_000_000,
      seed: this.stage.seed,
    });
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
      scene.work();
      return Promise.resolve();
    }
    painter.aim(this.stage.window.clientWidth / Math.min(view.width, PLATE.w), view.x);
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
      timeline.call(() => scene.work(), undefined, painter.seconds + SWITCH_WASH_S - 0.1);
    });
  }

  /** Reduced motion: the old picture fades off the new one in 200 ms. */
  fadeOver(scene: Scene): Promise<void> {
    const painter = this.painter;
    if (!painter) {
      scene.work();
      return Promise.resolve();
    }
    const fade = painter.canvas.animate([{ opacity: 1 }, { opacity: 0 }], { duration: REVEAL_MS, easing: 'linear', fill: 'forwards' });
    return fade.finished.then(() => {
      if (this.painter === painter) this.clear();
      scene.work();
    });
  }

  /** Take any sheet off the page now. */
  clear(): void {
    window.clearTimeout(this.tidy);
    this.timeline?.kill();
    this.timeline = null;
    this.painter?.canvas.remove();
    this.painter = null;
    this.veil?.canvas.remove();
    this.veil = null;
    this.blank?.remove();
    this.blank = null;
  }

  /** A timeline that owns the brush until it completes. */
  private clock(painter: Painter, done: () => void): gsap.core.Timeline {
    const timeline = gsap.timeline({
      onComplete: () => {
        // Nothing is swapped or cleared here: GSAP's end values stay inline and the sheet, now clear, stays
        // where it is. (In WebKit, changing the plate's layers in this frame repainted all of it at once:
        // review 02 measured 55–60 ms.) It is taken away a little later, when only the character is moving.
        this.timeline = null;
        this.tidy = window.setTimeout(() => {
          if (this.painter !== painter || this.timeline) return;
          painter.canvas.remove();
          this.painter = null;
          this.veil?.canvas.remove();
          this.veil = null;
        }, TIDY_MS);
        done();
      },
    });
    this.timeline = timeline;
    return timeline;
  }
}

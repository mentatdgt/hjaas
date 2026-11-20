// How a picture arrives in the window. Three ways, one clock each:
//
// 1. The first visit to a scene: its room is painted in over about five seconds, then the page goes quiet.
//
//   Element             Role        Starts    Lasts    Motion                      Relationship
//   The edge's pencil   Support     0         0.32 s   fade                        the sketch, before any colour
//   Brush strokes       Lead        0.32 s    4.32 s   paint, region by region     uneven and overlapping
//   The wash            Support     4.38 s    0.42 s   the rest of the room fades up   overlaps the last strokes
//   Mushrooms           Decoration  -         -        painted with the room       usable from the wash on
//   Character + shadow  Lead        4.72 s    0.28 s   fade + 4 px settle          as the wash lands
//   Caption             Support     4.88 s    0.20 s   fade + 4 px rise            just behind her (first showing only)
//   Idle routine        -           5.06 s    -        first move at about 5.3 s   after a brief still moment
//
// 2. A switch to a scene already seen: the new picture is brushed in over the old one with the same
//    strokes, played quickly: about 1.2 s of brush and a 0.25 s wash, 1.45 s in all.
//
// 3. A return visit, or reduced motion: no brushwork. The edge's pencil in 120 ms, then everything else
//    together in 200 ms: 300 ms in all.
//
// What stays still, and why: the page, the logo and the frame never move (the picture is the only event);
// the mushrooms have no entrance of their own (they belong to the room, and the brush paints them with it).
//
// How it is built: the finished picture is on the page from the start, under a sheet that the brush rubs
// away (paint.ts): blank paper for a first visit, a copy of the picture being left for a switch. The
// picture's one-off cost of being drawn is paid before the clock starts, and nothing is swapped or cleared
// when the brush stops: the sheet, by then clear, is taken away a little later.
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
/** In a reveal, the edge's pencil has this long to itself before everything else starts (site.css). */
const REVEAL_LEAD_MS = 100;
/**
 * A first-visit painting starts with the edge's pencil, alone: the sketch, then the colour. The brush waits
 * for it, because the edge is also what stops the paint at the painting's shape, and must be all there
 * before any paint is.
 */
const PENCIL_S = 0.32;
/** How long the clear sheet stays on after the brush stops, before it is taken off the page. */
const TIDY_MS = 2500;
/** A switch between scenes: the brush, then the wash, in seconds. */
const SWITCH_BRUSH_S = 1.2;
const SWITCH_WASH_S = 0.25;

export class Transition {
  private readonly stage: Stage;
  private timeline: gsap.core.Timeline | null = null;
  private painter: Painter | null = null;
  private tidy = 0;
  /** The painting about to play is the page's first showing, so the caption arrives with it. */
  private withCaption = false;

  constructor(stage: Stage) {
    this.stage = stage;
  }

  /** QA: what the sheet on the page takes, in bytes (none when there is no sheet). */
  get sheetBytes(): number {
    const canvas = this.painter?.canvas;
    return canvas ? canvas.width * canvas.height * 4 : 0;
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

  /** A return visit, or reduced motion: the edge's pencil, then everything else together in 200 ms. */
  reveal(scene: Scene): Promise<void> {
    const { root } = this.stage;
    // One opacity transition on every part (site.css), run by the compositor.
    root.classList.add('is-revealing');
    void root.offsetWidth;
    root.classList.remove('is-pre');
    return new Promise((resolve) => {
      window.setTimeout(() => {
        root.classList.remove('is-revealing');
        scene.work();
        resolve();
      }, REVEAL_LEAD_MS + REVEAL_MS + 20);
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
    // The caption arrives with the picture the first time; afterwards it is already there and stays.
    const hidden: HTMLElement[] = [];
    // The edge's pencil comes up first, in paint(). (Unseen, the edge hides nothing: the sheet does that.)
    const edge = plate.querySelector<HTMLElement>('.hj-edge');
    if (edge) hidden.push(edge);
    if (character) hidden.push(character.el);
    if (character?.shadow) hidden.push(character.shadow);
    if (first) hidden.push(caption);
    if (hidden.length) gsap.set(hidden, { opacity: 0 });
    // Unpainted mushrooms can't be found yet, by pointer or by keyboard.
    hunt.el.inert = true;
    root.classList.remove('is-pre');
  }

  /** The first-visit painting. Resolves when everything is settled. */
  paint(scene: Scene): Promise<void> {
    const { caption } = this.stage;
    const { character, hunt } = scene;
    if (!this.painter?.fresh) this.prepare(scene);
    const painter = this.painter!;
    const edge = scene.plate.querySelector<HTMLElement>('.hj-edge');

    return new Promise((resolve) => {
      const clock = { t: 0 };
      const wash = PENCIL_S + painter.seconds - 0.26;
      const characterAt = wash + 0.34;
      const captionAt = wash + 0.5;
      const timeline = this.clock(painter, resolve);

      // The pencil of the edge, on bare paper.
      if (edge) timeline.fromTo(edge, { opacity: 0 }, { opacity: 1, duration: PENCIL_S, ease: 'power1.out' }, 0);

      // The strokes. GSAP's ticker is the clock, so the paint, the wash and the entrances cannot drift apart.
      timeline.to(clock, { t: painter.seconds, duration: painter.seconds, ease: 'none', onUpdate: () => void painter.paintTo(clock.t) }, PENCIL_S);

      // The wash: whatever the brush missed comes up evenly. From here the mushrooms can be found.
      const washed = { amount: 0 };
      timeline.call(() => void (hunt.el.inert = false), undefined, wash);
      timeline.to(washed, { amount: 1, duration: 0.42, ease: 'power1.inOut', onUpdate: () => painter.wash(washed.amount) }, wash);

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
        }, TIDY_MS);
        done();
      },
    });
    this.timeline = timeline;
    return timeline;
  }
}

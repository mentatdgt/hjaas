// The opening. The paper page, the identity and a "Skip" control are simply there from the first moment;
// only the picture arrives. On a first visit the room is painted in over about five seconds, then the page
// goes quiet. One sequence, one clock.
//
//   Element             Role        Starts    Lasts    Motion                      Relationship
//   Brush strokes       Lead        0         4.32 s   paint, region by region     uneven and overlapping
//   The wash            Support     4.06 s    0.42 s   the rest of the room fades up   overlaps the last strokes
//   Mushrooms           Decoration  -         -        painted with the room       usable from the wash on
//   Rachel + shadow     Lead        4.40 s    0.28 s   fade + 4 px settle          as the wash lands
//   Caption             Support     4.56 s    0.20 s   fade + 4 px rise            just behind Rachel
//   Hammer loop         -           4.74 s    -        first swing at about 5.0 s  after a brief still moment
//
// What stays still, and why: the page, the logo and the frame never move (the picture is the only event);
// the mushrooms have no entrance of their own (they belong to the room, and the brush paints them with it).
//
// How it is built: the room and the mushrooms are on the page from the start, under a sheet of blank paper
// that the brush rubs away (paint.ts). Their one-off cost of being drawn is paid before the clock starts,
// and nothing is swapped or cleared when the painting ends: the sheet, by then clear, is taken away later.
//
// A return visit, and reduced motion, get no brushwork: everything shows together in 200 ms.
import { EASE_OUT, gsap } from './motion';
import { PAINT_SECONDS, Painter } from './paint';

/** `paint`: the full painting. `reveal`: everything together in 200 ms. `off`: simply there. */
export type IntroMode = 'paint' | 'reveal' | 'off';

export interface IntroParts {
  root: HTMLElement;
  plate: HTMLElement;
  rachel: HTMLElement;
  shadow: HTMLElement;
  mushrooms: HTMLElement;
  caption: HTMLElement;
  seed?: number;
  /** Rachel is in place: start the hammer loop. */
  onRachel: () => void;
}

const REVEAL_MS = 200;
/** How long the clear sheet stays on after a painting, before it is taken off the page. */
const TIDY_MS = 2500;

export class Intro {
  private readonly parts: IntroParts;
  private timeline: gsap.core.Timeline | null = null;
  private painter: Painter | null = null;
  private tidy = 0;
  /** The painting about to play is the page's first showing, so the caption arrives with it. */
  private withCaption = false;

  constructor(parts: IntroParts) {
    this.parts = parts;
  }

  /** True while the room is being painted. */
  get painting(): boolean {
    return this.timeline !== null;
  }

  /**
   * Set the page up for a painting about to start: a blank sheet over the finished picture, Rachel out of
   * sight. Call it a moment before play('paint'), so the picture under the sheet is drawn before the clock
   * starts and not in the painting's first frame.
   */
  prepare(): void {
    const { root, plate, rachel, shadow, mushrooms, caption } = this.parts;
    const first = root.classList.contains('is-pre');
    this.withCaption = first;
    window.clearTimeout(this.tidy);
    this.painter?.canvas.remove();
    // The sheet has the colour of the blank window it lies in.
    const paper = getComputedStyle(plate.parentElement ?? plate).backgroundColor;
    this.painter = new Painter(paper, plate.clientWidth, this.parts.seed);
    // Over the room, her shadow and the mushrooms; under Rachel, who is not painted.
    plate.insertBefore(this.painter.canvas, rachel);
    // The caption arrives with the picture the first time; on a replay it is already there and stays.
    gsap.set(first ? [rachel, shadow, caption] : [rachel, shadow], { opacity: 0 });
    // Unpainted mushrooms can't be found yet, by pointer or by keyboard.
    mushrooms.inert = true;
    root.classList.remove('is-pre');
  }

  /**
   * Shows the scene. It starts hidden (`.is-pre`); the first call reveals it, and a later call with `paint`
   * paints the room again from a blank sheet. Resolves when everything is settled.
   */
  play(mode: IntroMode): Promise<void> {
    const { root, rachel, shadow, mushrooms, caption } = this.parts;

    if (mode === 'off') {
      root.classList.remove('is-pre');
      this.parts.onRachel();
      return Promise.resolve();
    }

    if (mode === 'reveal') {
      // One opacity transition on every part (scene.css), run by the compositor.
      root.classList.add('is-revealing');
      void root.offsetWidth;
      root.classList.remove('is-pre');
      return new Promise((resolve) => {
        window.setTimeout(() => {
          root.classList.remove('is-revealing');
          this.parts.onRachel();
          resolve();
        }, REVEAL_MS + 20);
      });
    }

    if (!this.painter?.fresh) this.prepare();
    const painter = this.painter!;

    return new Promise((resolve) => {
      const clock = { t: 0 };
      const wash = PAINT_SECONDS - 0.26;
      const rachelAt = wash + 0.34;
      const captionAt = wash + 0.5;

      const timeline = gsap.timeline({
        onComplete: () => {
          // Nothing is swapped or cleared here: GSAP's end values stay inline and the sheet, now clear, stays
          // where it is. (In WebKit, changing the plate's layers in this frame repainted all of it at once:
          // review 02 measured 55–60 ms.) It is taken away a little later, when only Rachel is moving.
          this.timeline = null;
          this.tidy = window.setTimeout(() => {
            if (this.painter !== painter || this.timeline) return;
            painter.canvas.remove();
            this.painter = null;
          }, TIDY_MS);
          resolve();
        },
      });
      this.timeline = timeline;

      // The strokes. GSAP's ticker is the clock, so the paint, the wash and the entrances cannot drift apart.
      timeline.to(
        clock,
        {
          t: PAINT_SECONDS,
          duration: PAINT_SECONDS,
          ease: 'none',
          onUpdate: () => {
            painter.paintTo(clock.t);
          },
        },
        0,
      );

      // The wash: whatever the brush missed comes up evenly. From here the mushrooms can be found.
      const washed = { amount: 0 };
      timeline.call(() => void (mushrooms.inert = false), undefined, wash);
      timeline.to(
        washed,
        { amount: 1, duration: 0.42, ease: 'power1.inOut', onUpdate: () => painter.wash(washed.amount) },
        wash,
      );

      // Rachel: no paint on her. A short fade and a small settle, a still moment, then she gets to work.
      timeline.fromTo([rachel, shadow], { opacity: 0 }, { opacity: 1, duration: 0.28, ease: 'power1.out' }, rachelAt);
      timeline.fromTo(rachel, { y: -4 }, { y: 0, duration: 0.28, ease: EASE_OUT }, rachelAt);
      timeline.call(this.parts.onRachel, undefined, rachelAt + 0.34);

      // The caption, just behind her.
      if (this.withCaption) {
        timeline.fromTo(caption, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.2, ease: EASE_OUT }, captionAt);
      }
    });
  }

  /** Jump to the finished picture, at any point of the painting. */
  skip(): void {
    // Rendering the timeline at its end clears the sheet, frees the mushrooms, shows Rachel and the caption,
    // and runs the callbacks, exactly as if it had played through.
    this.timeline?.progress(1);
  }
}

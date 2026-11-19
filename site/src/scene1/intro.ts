// The opening. The paper page, the identity and a "Skip" control are simply there from the first moment;
// only the picture arrives. On a first visit the room is painted in over about five seconds, then the page
// goes quiet. One sequence, one clock.
//
//   Element             Role        Starts    Lasts    Motion                      Relationship
//   Brush strokes       Lead        0         4.32 s   paint, region by region     uneven and overlapping
//   Room (the wash)     Support     4.06 s    0.42 s   fade under the strokes      overlaps the last strokes
//   Mushrooms           Decoration  4.06 s    0.42 s   fade, no movement           together with the wash; usable at once
//   Rachel + shadow     Lead        4.40 s    0.28 s   fade + 4 px settle          as the wash lands
//   Caption             Support     4.56 s    0.20 s   fade + 4 px rise            just behind Rachel
//   Hammer loop         -           4.68 s    -        first swing at about 5.0 s  after a brief still moment
//
// What stays still, and why: the page, the logo and the frame never move (the picture is the only event);
// the mushrooms only fade (they belong to the room, and movement would give them away).
//
// A return visit, and reduced motion, get no brushwork: everything shows together in 200 ms.
import { EASE_OUT, gsap } from './motion';
import { PAINT_SECONDS, Painter } from './paint';

/** `paint`: the full painting. `reveal`: everything together in 200 ms. `off`: simply there. */
export type IntroMode = 'paint' | 'reveal' | 'off';

export interface IntroParts {
  root: HTMLElement;
  plate: HTMLElement;
  room: HTMLImageElement;
  /** The plate as decoded pixels: the paint the brush uses. */
  roomPixels: CanvasImageSource;
  rachel: HTMLElement;
  shadow: HTMLElement;
  mushrooms: HTMLElement;
  caption: HTMLElement;
  seed?: number;
  /** Rachel is in place: start the hammer loop. */
  onRachel: () => void;
}

const REVEAL_MS = 200;

export class Intro {
  private readonly parts: IntroParts;
  private timeline: gsap.core.Timeline | null = null;
  private painter: Painter | null = null;
  private handOver: ResizeObserver | null = null;

  constructor(parts: IntroParts) {
    this.parts = parts;
  }

  /** True while the room is being painted. */
  get painting(): boolean {
    return this.timeline !== null;
  }

  /**
   * Shows the scene. It starts hidden (`.is-pre`); the first call reveals it, and a later call with `paint`
   * paints the room again from a blank sheet. Resolves when everything is settled.
   */
  play(mode: IntroMode): Promise<void> {
    const { root, room, rachel, shadow, mushrooms, caption } = this.parts;
    const scene = [room, mushrooms, shadow, rachel];
    const first = root.classList.contains('is-pre');

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

    // Everything in the picture is laid out but invisible; from here GSAP owns its opacity.
    // The caption arrives with the picture the first time; on a replay it is already there and stays.
    gsap.set(first ? [...scene, caption] : scene, { opacity: 0 });
    // Unpainted mushrooms can't be found yet.
    gsap.set(mushrooms, { visibility: 'hidden' });
    root.classList.remove('is-pre');
    this.startPainter();
    const painter = this.painter!;

    return new Promise((resolve) => {
      const clock = { t: 0 };
      const wash = PAINT_SECONDS - 0.26;
      const rachelAt = wash + 0.34;
      const captionAt = wash + 0.5;

      const timeline = gsap.timeline({
        onComplete: () => {
          // Nothing is swapped or cleared here: the canvas stays on as the room and GSAP's end values stay
          // inline. In WebKit, handing over to the <img> and clearing the inline styles repainted the whole
          // plate in one frame (measured in review 02: 55–60 ms, 80–150 ms on a loaded CPU).
          this.timeline = null;
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

      // The wash: the real plate comes up underneath and fills whatever the brush missed. It is drawn into
      // the brush's own canvas rather than faded in as the <img>, which WebKit repainted on every frame.
      const washed = { amount: 0 };
      timeline.set(mushrooms, { visibility: 'inherit' }, wash);
      timeline.to(
        washed,
        { amount: 1, duration: 0.42, ease: 'power1.inOut', onUpdate: () => painter.wash(washed.amount) },
        wash,
      );
      timeline.to(mushrooms, { opacity: 1, duration: 0.42, ease: 'power1.inOut' }, wash);

      // Rachel: no paint on her. A short fade and a small settle, a still moment, then she gets to work.
      timeline.fromTo([rachel, shadow], { opacity: 0 }, { opacity: 1, duration: 0.28, ease: 'power1.out' }, rachelAt);
      timeline.fromTo(rachel, { y: -4 }, { y: 0, duration: 0.28, ease: EASE_OUT }, rachelAt);
      timeline.call(this.parts.onRachel, undefined, rachelAt + 0.28);

      // The caption, just behind her.
      if (first) {
        timeline.fromTo(caption, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.2, ease: EASE_OUT }, captionAt);
      }
    });
  }

  /** Jump to the finished picture, at any point of the painting. */
  skip(): void {
    // Rendering the timeline at its end paints every stroke, lays the wash, shows Rachel and the caption,
    // and runs the callbacks, exactly as if it had played through.
    this.timeline?.progress(1);
  }

  /** A fresh sheet for the brush. The canvas of an earlier painting is taken away. */
  private startPainter(): void {
    const { plate, room, roomPixels, seed } = this.parts;
    this.handOver?.disconnect();
    this.painter?.canvas.remove();
    const painter = new Painter(roomPixels, plate.clientWidth, seed);
    this.painter = painter;
    plate.insertBefore(painter.canvas, room.nextSibling);

    // The canvas is the room from now on. The <img> takes over only if the plate is resized, when
    // everything repaints anyway. A painting in progress is finished first.
    const paintedWidth = plate.clientWidth;
    const handOver = new ResizeObserver(() => {
      if (plate.clientWidth === paintedWidth) return;
      handOver.disconnect();
      this.skip();
      gsap.set(room, { clearProps: 'opacity' });
      painter.canvas.remove();
      if (this.painter === painter) this.painter = null;
    });
    handOver.observe(plate);
    this.handOver = handOver;
  }
}

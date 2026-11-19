// The opening: the room is painted in, Rachel settles into it and starts work, then the logo and the
// counter arrive. One sequence, one clock.
//
//   Element             Role        Starts    Lasts    Motion                      Relationship
//   Brush strokes       Lead        0         2.16 s   paint, region by region     -
//   Room (the wash)     Support     1.90 s    0.42 s   fade under the strokes      overlaps the last strokes
//   Mushrooms           Decoration  1.90 s    0.42 s   fade, no movement           together with the wash
//   Rachel + shadow     Lead        2.22 s    0.46 s   fade + 10 px settle         starts as the wash lands
//   Hammer loop         -           2.60 s    -        first swing                 once she has settled
//   Logo                Support     2.66 s    0.52 s   fade + 10 px settle         after Rachel
//   Logo glint          Decoration  3.10 s    0.65 s   first sweep                 lands as the logo settles
//   Counter             Support     2.80 s    0.44 s   fade + 8 px settle          overlaps the logo
//   Hunt prompt         Decoration  3.16 s    0.20 s   fade                        after the counter
//
// What stays still, and why: the letterbox light fades with the wash rather than moving; the mushrooms
// only fade (they belong to the room, and movement would give them away); the counter's parts arrive as
// one object, not staggered.
import { EASE_OUT, gsap } from './motion';
import { PAINT_SECONDS, Painter } from './paint';

export type IntroMode = 'full' | 'quick' | 'reduced' | 'off';

export interface IntroParts {
  root: HTMLElement;
  plate: HTMLElement;
  room: HTMLImageElement;
  /** The plate as decoded pixels: the paint the brush uses. */
  roomPixels: CanvasImageSource;
  ambient: HTMLElement;
  rachel: HTMLElement;
  shadow: HTMLElement;
  mushrooms: HTMLElement;
  logo: HTMLElement;
  counter: HTMLElement;
  seed?: number;
  /** Rachel is in place: start the hammer loop. */
  onRachel: () => void;
  /** The logo has landed: first glint. */
  onLogo: () => void;
  /** The counter is in: show the hunt prompt. */
  onCounter: () => void;
}

/** Plays the intro. The scene starts hidden (`.is-pre`); this reveals it and resolves when all is settled. */
export function playIntro(mode: IntroMode, parts: IntroParts): Promise<void> {
  const { root, plate, room, ambient, rachel, shadow, mushrooms, logo, counter } = parts;
  const scene = [room, ambient, mushrooms, shadow, rachel];
  const hud = [logo, counter];

  const finish = (): void => {
    gsap.set([...scene, ...hud], { clearProps: 'opacity,transform,visibility' });
    root.classList.remove('is-pre');
  };

  if (mode === 'off') {
    finish();
    parts.onRachel();
    parts.onLogo();
    parts.onCounter();
    return Promise.resolve();
  }

  // Everything is laid out but invisible; from here GSAP owns the opacity.
  gsap.set([...scene, ...hud], { opacity: 0 });
  root.classList.remove('is-pre');

  if (mode === 'reduced') {
    // No strokes and no movement: the whole scene fades in together.
    return new Promise((resolve) => {
      parts.onRachel();
      gsap.to([...scene, ...hud], {
        opacity: 1,
        duration: 0.3,
        ease: 'none',
        onComplete: () => {
          finish();
          parts.onLogo();
          parts.onCounter();
          resolve();
        },
      });
    });
  }

  // A repeat visit gets the same painting, played quickly.
  const pace = mode === 'quick' ? 0.36 : 1;
  // Unpainted mushrooms can't be found yet.
  gsap.set(mushrooms, { visibility: 'hidden' });
  const painter = new Painter(parts.roomPixels, plate.clientWidth, parts.seed);
  plate.insertBefore(painter.canvas, room.nextSibling);

  return new Promise((resolve) => {
    const clock = { t: 0 };
    const wash = PAINT_SECONDS * pace - 0.26 * pace;
    const rachelAt = wash + (mode === 'quick' ? 0.2 : 0.32);
    const logoAt = rachelAt + (mode === 'quick' ? 0.16 : 0.44);

    const timeline = gsap.timeline({
      onComplete: () => {
        // Nothing is swapped or cleared here: the canvas stays on as the room and GSAP's end values stay
        // inline. In WebKit, handing over to the <img> and clearing the inline styles repainted the whole
        // plate in one frame (measured: 55–60 ms, 80–150 ms on a loaded CPU).
        // The <img> takes over only if the plate is resized, when everything repaints anyway.
        const paintedWidth = plate.clientWidth;
        const handOver = new ResizeObserver(() => {
          if (plate.clientWidth === paintedWidth) return;
          handOver.disconnect();
          gsap.set(room, { clearProps: 'opacity' });
          painter.canvas.remove();
        });
        handOver.observe(plate);
        resolve();
      },
    });

    // The strokes. GSAP's ticker is the clock, so the paint, the wash and the entrances cannot drift apart.
    timeline.to(
      clock,
      {
        t: PAINT_SECONDS,
        duration: PAINT_SECONDS * pace,
        ease: 'none',
        onUpdate: () => {
          painter.paintTo(clock.t);
        },
        onComplete: () => {
          painter.paintTo(PAINT_SECONDS + 1);
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
    timeline.to([ambient, mushrooms], { opacity: 1, duration: 0.42, ease: 'power1.inOut' }, wash);

    // Rachel: no paint on her. A short fade and settle, then she gets to work.
    timeline.fromTo(
      [rachel, shadow],
      { opacity: 0 },
      { opacity: 1, duration: 0.3, ease: 'power1.out' },
      rachelAt,
    );
    timeline.fromTo(rachel, { y: -10 }, { y: 0, duration: 0.46, ease: EASE_OUT }, rachelAt);
    timeline.call(parts.onRachel, undefined, rachelAt + 0.38);

    // Logo, then the counter just behind it.
    timeline.fromTo(
      logo,
      { opacity: 0, y: -10, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.52, ease: EASE_OUT },
      logoAt,
    );
    timeline.call(parts.onLogo, undefined, logoAt + 0.44);
    timeline.fromTo(
      counter,
      { opacity: 0, y: -8 },
      { opacity: 1, y: 0, duration: 0.44, ease: EASE_OUT },
      logoAt + 0.14,
    );
    timeline.call(parts.onCounter, undefined, logoAt + 0.5);
  });
}

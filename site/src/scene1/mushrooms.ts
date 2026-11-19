// The hunt: ten tiny mushrooms hidden around the room.
import { asset, loadImage } from './assets';
import { flags } from './flags';
import { EASE_OUT, gsap, reducedMotion } from './motion';

export interface Spot {
  /** Stable id, saved in localStorage. Never reuse or renumber. */
  id: string;
  /** Which drawing: frames/003-mushrooms/approved/mushroom_NN.png */
  art: number;
  /** Plate px: the centre of the drawing, left to right. */
  x: number;
  /** Plate px: where the drawing's base rests. */
  y: number;
  /** Height in plate px. Further back in the room means smaller. */
  h: number;
  flip?: boolean;
  /** CSS filter so it sits in that spot's light. Static, never animated. */
  tint?: string;
  /** CSS clip-path, in % of the drawing's box: hides the part tucked behind something in the plate. */
  tuck?: string;
  /** Draw a small contact shadow (for mushrooms standing on a surface). */
  grounded?: boolean;
}

// Left to right, which is also the Tab order.
// Sizes follow depth: about 18 px at the back wall, about 42 px at the front edge of the floor.
const SHADE = 'brightness(0.84) saturate(0.92) sepia(0.12)';
const LIT = 'brightness(1.02) saturate(1.05) sepia(0.14)';
export const SPOTS: Spot[] = [
  { id: 'sill', art: 7, x: 421, y: 549, h: 18, tint: LIT },
  { id: 'drape', art: 8, x: 388, y: 753, h: 28, tint: SHADE, tuck: 'polygon(17% 0, 100% 0, 100% 100%, 57% 100%)' },
  { id: 'skirting', art: 2, x: 574, y: 643, h: 20, tint: LIT, grounded: true },
  { id: 'screed', art: 6, x: 588, y: 921, h: 40, tint: SHADE, grounded: true },
  { id: 'tiles', art: 3, x: 1152, y: 929, h: 42, tint: LIT, grounded: true },
  { id: 'conduit', art: 9, x: 1181, y: 642, h: 20, tint: LIT },
  { id: 'socket', art: 1, x: 1270, y: 345, h: 18, tint: SHADE },
  // Not drawing 5: at this size its slender stem reads as a nail standing on the tiles.
  { id: 'ladder-foot', art: 7, x: 1312, y: 845, h: 36, tint: SHADE, grounded: true },
  { id: 'ladder-step', art: 4, x: 1404, y: 472, h: 24, tint: LIT },
  // The tenth is drawing 1 again, mirrored and twice the size of the one in the socket.
  { id: 'toolbox', art: 1, x: 1432, y: 909, h: 40, flip: true, tint: SHADE, tuck: 'polygon(0 0, 61% 0, 69% 100%, 0 100%)', grounded: true },
];

const artUrl = (art: number): string => asset(`mushrooms/mushroom_${String(art).padStart(2, '0')}.webp`);

export interface HuntOptions {
  plate: HTMLElement;
  /** Layer above everything, where a collected mushroom flies. */
  flyLayer: HTMLElement;
  found: ReadonlySet<string>;
  /** Screen rect the mushroom flies into. */
  target: () => DOMRect;
  /** The moment of the click or key press. */
  onFind: (spot: Spot) => void;
  /** The moment the mushroom lands in the counter. */
  onLand: (spot: Spot) => void;
}

export class Hunt {
  readonly el: HTMLDivElement;
  private readonly options: HuntOptions;
  private readonly buttons = new Map<string, HTMLButtonElement>();

  private constructor(options: HuntOptions, aspect: Map<number, number>) {
    this.options = options;
    this.el = document.createElement('div');
    this.el.className = 'hj-mushrooms';
    if (flags.debug) this.el.classList.add('is-debug');

    for (const spot of SPOTS) {
      if (options.found.has(spot.id)) continue;
      const w = spot.h * (aspect.get(spot.art) ?? 1);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hj-shroom';
      button.dataset.spot = spot.id;
      button.setAttribute('aria-label', 'Hidden mushroom');
      // The drawing's centre, in plate px. scene.css turns it into the tap box's position.
      button.style.setProperty('--cx', String(spot.x));
      button.style.setProperty('--cy', String(spot.y - spot.h / 2));
      button.style.setProperty('--w', String(w));
      button.style.setProperty('--h', String(spot.h));
      if (spot.grounded) button.classList.add('is-grounded');

      const art = document.createElement('span');
      art.className = 'hj-shroom-art';
      if (spot.tint) art.style.filter = spot.tint;
      if (spot.tuck) art.style.clipPath = spot.tuck;
      const img = document.createElement('img');
      img.src = artUrl(spot.art);
      img.alt = '';
      img.draggable = false;
      if (spot.flip) img.classList.add('is-flipped');
      art.append(img);
      button.append(art);

      button.addEventListener('click', () => this.collect(spot));
      this.buttons.set(spot.id, button);
      this.el.append(button);
    }
  }

  /** Decodes the drawings first, so sizes are known and nothing pops in. */
  static async create(options: HuntOptions): Promise<Hunt> {
    const arts = [...new Set(SPOTS.map((spot) => spot.art))];
    const images = await Promise.all(arts.map((art) => loadImage(artUrl(art))));
    const aspect = new Map(arts.map((art, i) => [art, images[i].naturalWidth / images[i].naturalHeight]));
    return new Hunt(options, aspect);
  }

  get remaining(): number {
    return this.buttons.size;
  }

  /** One unfound mushroom gives a single tiny wiggle. Prefers one the visitor can currently see. */
  hint(): void {
    const candidates = [...this.buttons.values()];
    if (candidates.length === 0) return;
    const visible = candidates.filter((button) => inView(button));
    const pool = visible.length ? visible : candidates;
    const art = pool[Math.floor(Math.random() * pool.length)].querySelector<HTMLElement>('.hj-shroom-art')!;
    if (reducedMotion()) {
      // No movement: a brief dip in opacity instead.
      gsap.timeline().to(art, { opacity: 0.45, duration: 0.14, ease: 'none' }).to(art, { opacity: 1, duration: 0.2, ease: 'none' });
      return;
    }
    // A few degrees, pivoting on the base, under 400 ms, once.
    gsap
      .timeline({ defaults: { ease: 'sine.inOut' } })
      .to(art, { rotation: 7, duration: 0.09 })
      .to(art, { rotation: -5, duration: 0.11 })
      .to(art, { rotation: 2.5, duration: 0.09 })
      .to(art, { rotation: 0, duration: 0.08 });
  }

  private collect(spot: Spot): void {
    const button = this.buttons.get(spot.id);
    if (!button) return;
    this.buttons.delete(spot.id);

    const { flyLayer, target, onFind, onLand } = this.options;
    const art = button.querySelector<HTMLElement>('.hj-shroom-art')!;
    // Measure everything first, then change the page: no layout is forced mid-change.
    const from = art.getBoundingClientRect();
    const layer = flyLayer.getBoundingClientRect();
    const to = target();

    // Keyboard users carry on from the next mushroom.
    if (document.activeElement === button) this.focusNext(button);

    // The drawing leaves the plate and flies on its own layer, above the counter.
    const flyer = document.createElement('span');
    flyer.className = 'hj-flyer';
    const img = art.querySelector('img')!.cloneNode(true) as HTMLImageElement;
    flyer.append(img);
    Object.assign(flyer.style, {
      left: `${from.left - layer.left}px`,
      top: `${from.top - layer.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
    });
    flyLayer.append(flyer);
    button.remove();
    onFind(spot);

    const done = (): void => {
      flyer.remove();
      onLand(spot);
    };

    if (reducedMotion()) {
      gsap.to(flyer, { opacity: 0, duration: 0.2, ease: 'none', onComplete: done });
      return;
    }

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const lift = Math.max(8, from.height * 0.4);
    const popScale = 1.2;
    const endScale = Math.min(1.1, Math.max(0.3, (to.height * 0.92) / from.height));

    // The arc bulges upward: a control point off the straight line, on its upper side.
    const sx = 0;
    const sy = -lift;
    const vx = dx - sx;
    const vy = dy - sy;
    const length = Math.hypot(vx, vy) || 1;
    let nx = -vy / length;
    let ny = vx / length;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const bulge = Math.min(150, Math.max(26, length * 0.24));
    const cx = sx + vx * 0.45 + nx * bulge;
    const cy = sy + vy * 0.45 + ny * bulge;
    const lean = dx >= 0 ? 1 : -1;

    const flight = { t: 0 };
    gsap
      .timeline({ onComplete: done })
      // Lift and pop: it comes free of its hiding spot.
      .to(flyer, { y: sy, scale: popScale, duration: 0.14, ease: EASE_OUT })
      // Then the arc into the counter. Slow off the mark, quick through the middle, soft on arrival.
      .to(flight, {
        t: 1,
        duration: 0.42,
        ease: 'power2.inOut',
        onUpdate: () => {
          const t = flight.t;
          const u = 1 - t;
          gsap.set(flyer, {
            x: u * u * sx + 2 * u * t * cx + t * t * dx,
            y: u * u * sy + 2 * u * t * cy + t * t * dy,
            scale: popScale + (endScale - popScale) * t * t,
            rotation: Math.sin(Math.PI * t) * 16 * lean,
            opacity: t < 0.93 ? 1 : 1 - (t - 0.93) / 0.07,
          });
        },
      });
  }

  private focusNext(after: HTMLButtonElement): void {
    const all = [...this.el.querySelectorAll<HTMLButtonElement>('.hj-shroom')];
    const index = all.indexOf(after);
    const next = all[index + 1] ?? all[index - 1];
    next?.focus({ preventScroll: false });
  }
}

function inView(el: HTMLElement): boolean {
  const viewport = el.closest('.hj-viewport');
  if (!viewport) return true;
  const a = el.getBoundingClientRect();
  const b = viewport.getBoundingClientRect();
  return a.right > b.left && a.left < b.right;
}

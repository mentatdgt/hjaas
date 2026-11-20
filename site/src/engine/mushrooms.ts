// The hunt: a scene's ten tiny mushrooms, hidden around its room.
import { asset, loadImage } from './assets';
import { tapBox } from './edge';
import { flags } from './flags';
import { EASE_OUT, gsap, reducedMotion } from './motion';
import type { Spot } from './types';

const artUrl = (art: number): string => asset(`shared/mushrooms/mushroom_${String(art).padStart(2, '0')}.webp`);

export interface HuntOptions {
  spots: readonly Spot[];
  /** How much of the painting shows at a point of the plate (edge.ts). Tap boxes keep to where it is solid. */
  edge: (x: number, y: number) => number;
  plate: HTMLElement;
  /** Layer above everything, where a collected mushroom flies. */
  flyLayer: HTMLElement;
  found: ReadonlySet<string>;
  /** Screen rect the mushroom travels to. */
  target: () => DOMRect;
  /** The moment of the click or key press. */
  onFind: (spot: Spot) => void;
  /** The moment the mushroom reaches the caption. */
  onLand: (spot: Spot) => void;
}

export class Hunt {
  readonly el: HTMLDivElement;
  private readonly options: HuntOptions;
  private readonly buttons = new Map<string, HTMLButtonElement>();
  /** Each drawing's centre and size, in plate px. */
  private readonly art = new Map<string, { cx: number; cy: number; w: number; h: number }>();

  private constructor(options: HuntOptions, aspect: Map<number, number>) {
    this.options = options;
    this.el = document.createElement('div');
    this.el.className = 'hj-mushrooms';
    if (flags.debug) this.el.classList.add('is-debug');

    for (const spot of options.spots) {
      if (options.found.has(spot.id)) continue;
      const w = spot.h * (aspect.get(spot.art) ?? 1);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hj-shroom';
      button.dataset.spot = spot.id;
      button.setAttribute('aria-label', 'Hidden mushroom');
      // The drawing's centre, in plate px.
      button.style.setProperty('--cx', String(spot.x));
      button.style.setProperty('--cy', String(spot.y - spot.h / 2));
      this.art.set(spot.id, { cx: spot.x, cy: spot.y - spot.h / 2, w, h: spot.h });
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

  /**
   * Place every tap box for the plate's current size (`u`: CSS px per plate px). A box near the painting's
   * soft edge moves inward until all of it is over solid painting; its drawing stays where it was painted.
   */
  layout(u: number): void {
    if (!u) return;
    for (const [id, button] of this.buttons) {
      const art = this.art.get(id)!;
      const box = tapBox(this.options.edge, art, u);
      // Whole CSS pixels, so the box and its focus ring are crisp.
      button.style.setProperty('--bx', `${Math.round(box.cx * u)}px`);
      button.style.setProperty('--by', `${Math.round(box.cy * u)}px`);
    }
  }

  /** Decodes the drawings first, so sizes are known and nothing pops in. */
  static async create(options: HuntOptions): Promise<Hunt> {
    const arts = [...new Set(options.spots.map((spot) => spot.art))];
    const images = await Promise.all(arts.map((art) => loadImage(artUrl(art))));
    const aspect = new Map(arts.map((art, i) => [art, images[i].naturalWidth / images[i].naturalHeight]));
    return new Hunt(options, aspect);
  }

  get remaining(): number {
    return this.buttons.size;
  }

  /**
   * Copy the mushrooms still hidden onto another canvas (the sheet the brush rubs away when the visitor
   * leaves this scene). `origin` is that canvas's place on the page; the context works in CSS px.
   */
  sketch(ctx: CanvasRenderingContext2D, origin: DOMRect): void {
    const tints = 'filter' in ctx;
    for (const button of this.buttons.values()) {
      const art = button.querySelector<HTMLElement>('.hj-shroom-art')!;
      const img = art.querySelector('img')!;
      const r = art.getBoundingClientRect();
      const x = r.left - origin.left;
      const y = r.top - origin.top;
      ctx.save();
      if (button.classList.contains('is-grounded')) {
        // The same contact shadow as .hj-shroom.is-grounded::before in site.css.
        ctx.save();
        ctx.translate(x + r.width / 2, y + r.height);
        ctx.scale(r.width * 0.45, r.height * 0.11);
        const soft = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        soft.addColorStop(0, 'rgba(50, 25, 8, 0.42)');
        soft.addColorStop(1, 'rgba(50, 25, 8, 0)');
        ctx.fillStyle = soft;
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
      }
      // The part tucked behind something stays hidden: the same polygon as the CSS clip-path.
      const points = [...art.style.clipPath.matchAll(/(-?[\d.]+)%?\s+(-?[\d.]+)%?/g)];
      if (points.length >= 3) {
        ctx.beginPath();
        for (const [, px, py] of points) ctx.lineTo(x + (Number(px) / 100) * r.width, y + (Number(py) / 100) * r.height);
        ctx.closePath();
        ctx.clip();
      }
      // Its light. (Safari's canvas has no filters; there the copy is untinted for the second it is on screen.)
      if (tints && art.style.filter) ctx.filter = art.style.filter;
      if (img.classList.contains('is-flipped')) {
        ctx.translate(x + r.width, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, r.width, r.height);
      } else {
        ctx.drawImage(img, x, y, r.width, r.height);
      }
      ctx.restore();
    }
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

    // The drawing leaves the plate and travels on its own layer, above the page.
    const flyer = document.createElement('span');
    flyer.className = 'hj-flyer';
    // The drawing's own image is moved, not copied: it is already decoded and drawn at this size.
    flyer.append(art.querySelector('img')!);
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
      // No flight: the count changes at once and the mushroom fades where it stood.
      onLand(spot);
      gsap.to(flyer, { opacity: 0, duration: 0.2, ease: 'none', onComplete: () => flyer.remove() });
      return;
    }

    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const lift = Math.max(5, from.height * 0.25);
    const popScale = 1.08;
    const endScale = Math.min(1, Math.max(0.3, (to.height * 0.92) / from.height));

    // A shallow arc: a control point a little off the straight line, on its upper side.
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
    const bulge = Math.min(64, Math.max(12, length * 0.12));
    const cx = sx + vx * 0.45 + nx * bulge;
    const cy = sy + vy * 0.45 + ny * bulge;

    const flight = { t: 0 };
    gsap
      .timeline({ onComplete: done })
      // It comes free of its hiding spot with a small lift.
      .to(flyer, { y: sy, scale: popScale, duration: 0.09, ease: EASE_OUT })
      // Then straight to the caption: 300 ms, no spin, fading as it arrives so it never lands on the words.
      .to(flight, {
        t: 1,
        duration: 0.3,
        ease: 'power2.inOut',
        onUpdate: () => {
          const t = flight.t;
          const u = 1 - t;
          gsap.set(flyer, {
            x: u * u * sx + 2 * u * t * cx + t * t * dx,
            y: u * u * sy + 2 * u * t * cy + t * t * dy,
            scale: popScale + (endScale - popScale) * t * t,
            opacity: t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3,
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

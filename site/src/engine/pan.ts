// Portrait phones show a crop of the room about 60% of the screen tall and the visitor swipes sideways to
// explore.
//
// The crop is a native horizontal scroller. That is what makes it feel native: the browser itself follows
// the finger 1:1, adds momentum and eases into the edges, all off the main thread, so panning stays smooth
// even while Rachel is hammering. Up-and-down swipes are not claimed (touch-action: pan-x pan-y), so the
// page scrolls under the same finger. This file only sets the starting position, adds mouse dragging for
// narrow desktop windows, and shows a new visitor, once, that the room moves: it drifts a little way and back.
import { PLATE } from './assets';
import { reducedMotion } from './motion';

/** How far the room drifts, in CSS px, and how long it takes each way. */
const DRIFT_PX = 40;
const DRIFT_MS = 1200;
/** sine.inOut: it sets off and comes back without a jolt at either end or at the turn. */
const DRIFT_EASE = 'cubic-bezier(0.37, 0, 0.63, 1)';

const TOUCHES = ['pointerdown', 'touchstart', 'wheel', 'keydown'] as const;

export class Pan {
  private readonly viewport: HTMLElement;
  private plate: HTMLElement | null = null;
  /** The plate x the scene opens centred on: Rachel. */
  private focusX = PLATE.w / 2;
  /** Plate x at the middle of the crop, once the visitor has panned. Until then the scene's own focus applies. */
  private centreX: number | null = null;
  private drifting: Animation | null = null;
  private settingScroll = false;
  private readonly onPan: (centreX: number) => void;
  private panned: boolean;

  /** `panned`: the visitor has panned before. `onPan` is called with the new position (plate x at the middle of the window) on every pan. */
  constructor(viewport: HTMLElement, panned: boolean, onPan: (centreX: number) => void) {
    this.viewport = viewport;
    this.panned = panned;
    this.onPan = onPan;
    viewport.addEventListener('scroll', this.onScroll, { passive: true });
    // The visitor's own hand ends the drift at once, wherever it is.
    for (const type of TOUCHES) viewport.addEventListener(type, this.stopDrift, { passive: true });
    this.enableMouseDrag();
  }

  /**
   * Point the pan at a scene's plate: the plate x it opens centred on, and where this visitor left it (plate x
   * at the middle of the window, or null). Call when the plate goes into the window.
   */
  use(plate: HTMLElement, focusX: number, savedX: number | null): void {
    this.stopDrift();
    this.plate = plate;
    this.focusX = focusX;
    this.centreX = savedX;
    this.layout();
  }

  markPanned(): void {
    this.panned = true;
  }

  /** The plate x at the window's left edge, and how many plate px the window shows. */
  get view(): { x: number; width: number } {
    const u = this.plate ? this.plate.clientWidth / PLATE.w : 0;
    if (!u) return { x: 0, width: PLATE.w };
    return { x: this.viewport.scrollLeft / u, width: this.viewport.clientWidth / u };
  }

  /** True when the room is wider than its window, i.e. the visitor can pan. */
  get active(): boolean {
    return this.viewport.scrollWidth - this.viewport.clientWidth > 1;
  }

  /** Keep the same part of the room in the middle when the layout changes. */
  layout(): void {
    if (!this.plate || !this.active) return;
    const u = this.plate.clientWidth / PLATE.w;
    if (!u) return;
    this.stopDrift();
    const centre = this.centreX ?? this.focusX;
    this.scrollTo(centre * u - this.viewport.clientWidth / 2);
  }

  /** A scroll of the page's own, which is not a pan. */
  private scrollTo(left: number): void {
    this.settingScroll = true;
    this.viewport.scrollLeft = left;
    // The scroll event for this arrives asynchronously; ignore that one.
    requestAnimationFrame(() => {
      this.settingScroll = false;
    });
  }

  /**
   * A new visitor's sign that the room can be panned: it moves 40 px one way and back, once. Nothing is said and
   * nothing is saved. Never with reduced motion, nor once they have panned. It is the plate that moves, on the
   * compositor, and not the scroller: a scroll position is rounded to whole pixels, which a slow drift shows.
   */
  drift(): void {
    if (this.panned || this.drifting || !this.plate || !this.active || reducedMotion()) return;
    const from = this.viewport.scrollLeft;
    const room = this.viewport.scrollWidth - this.viewport.clientWidth - from;
    // Toward the side with more to see.
    const x = room >= from ? -DRIFT_PX : DRIFT_PX;
    const drift = this.plate.animate(
      [
        { transform: 'none', easing: DRIFT_EASE },
        { transform: `translateX(${x}px)`, easing: DRIFT_EASE },
        { transform: 'none' },
      ],
      { duration: 2 * DRIFT_MS },
    );
    drift.onfinish = () => (this.drifting = null);
    this.drifting = drift;
  }

  /** Cut short, the room stays where it has got to: what was drift becomes scroll. */
  stopDrift = (): void => {
    if (!this.drifting || !this.plate) return;
    const x = new DOMMatrix(getComputedStyle(this.plate).transform).e;
    this.drifting.onfinish = null;
    this.drifting.cancel();
    this.drifting = null;
    this.scrollTo(this.viewport.scrollLeft - x);
  };

  destroy(): void {
    this.drifting?.cancel();
    this.viewport.removeEventListener('scroll', this.onScroll);
    for (const type of TOUCHES) this.viewport.removeEventListener(type, this.stopDrift);
  }

  private onScroll = (): void => {
    const u = this.plate ? this.plate.clientWidth / PLATE.w : 0;
    if (!u || this.settingScroll) return;
    this.centreX = (this.viewport.scrollLeft + this.viewport.clientWidth / 2) / u;
    this.panned = true;
    this.onPan(this.centreX);
  };

  /** Touch pans natively. A mouse has no native drag-to-scroll, so narrow desktop windows get one here. */
  private enableMouseDrag(): void {
    const { viewport } = this;
    let startX = 0;
    let startScroll = 0;
    let dragging = false;
    let pointerId = -1;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0; // px per ms
    let glide = 0;

    const onMove = (event: PointerEvent): void => {
      if (event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      if (!dragging && Math.abs(dx) > 5) {
        dragging = true;
        viewport.setPointerCapture(pointerId);
        viewport.classList.add('is-dragging');
      }
      if (!dragging) return;
      viewport.scrollLeft = startScroll - dx;
      const now = performance.now();
      if (now > lastT) velocity = 0.7 * velocity + 0.3 * ((event.clientX - lastX) / (now - lastT));
      lastX = event.clientX;
      lastT = now;
    };

    const onUp = (event: PointerEvent): void => {
      if (event.pointerId !== pointerId) return;
      pointerId = -1;
      viewport.removeEventListener('pointermove', onMove);
      if (!dragging) return;
      dragging = false;
      viewport.classList.remove('is-dragging');
      // The click that ends a drag must not also pick a mushroom.
      const swallow = (click: MouseEvent): void => click.stopPropagation();
      viewport.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(() => viewport.removeEventListener('click', swallow, { capture: true }), 0);
      // Carry on with the hand's speed and ease to a stop.
      if (performance.now() - lastT > 80 || reducedMotion()) return;
      let v = velocity;
      let previous = performance.now();
      const step = (now: number): void => {
        const dt = Math.min(now - previous, 32);
        previous = now;
        viewport.scrollLeft -= v * dt;
        v *= Math.pow(0.996, dt);
        if (Math.abs(v) > 0.02) glide = requestAnimationFrame(step);
      };
      glide = requestAnimationFrame(step);
    };

    viewport.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || !this.active) return;
      cancelAnimationFrame(glide);
      pointerId = event.pointerId;
      startX = lastX = event.clientX;
      startScroll = viewport.scrollLeft;
      lastT = performance.now();
      velocity = 0;
      viewport.addEventListener('pointermove', onMove);
    });
    viewport.addEventListener('pointerup', onUp);
    viewport.addEventListener('pointercancel', onUp);
  }
}

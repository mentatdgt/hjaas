// Portrait phones show a crop of the room as tall as the screen allows (4:5 up to 2:3) and the visitor swipes
// sideways to explore.
//
// The crop is a native horizontal scroller. That is what makes it feel native: the browser itself follows
// the finger 1:1, adds momentum and eases into the edges, all off the main thread, so panning stays smooth
// even while Rachel is hammering. Up-and-down swipes are not claimed (touch-action: pan-x pan-y), so the
// page scrolls under the same finger. This file only sets the starting position, adds mouse dragging for
// narrow desktop windows, and shows the one-time swipe hint.
import { PLATE } from './assets';
import { reducedMotion } from './motion';

/** A scene's opening framing on a phone: the plate x ranges shown by a 4:5 window and by a 2:3 window. */
export interface PhoneStart {
  wide: readonly [number, number];
  tall: readonly [number, number];
}

// Windows between 4:5 and 2:3 are framed in between. Plate px, at full plate height.
const WIDTH_4_5 = (PLATE.h * 4) / 5;
const WIDTH_2_3 = (PLATE.h * 2) / 3;

function startCentre(start: PhoneStart, visibleWidth: number): number {
  const wide = (start.wide[0] + start.wide[1]) / 2;
  const tall = (start.tall[0] + start.tall[1]) / 2;
  const t = Math.min(1, Math.max(0, (WIDTH_4_5 - visibleWidth) / (WIDTH_4_5 - WIDTH_2_3)));
  return wide + (tall - wide) * t;
}

const CHEVRON = `<svg viewBox="0 0 10 16" aria-hidden="true" focusable="false"><path d="M7.5 2 2.5 8l5 6"/></svg>`;
// TODO(copy): placeholder wording.
const SWIPE_HINT = 'Swipe sideways';

export class Pan {
  private readonly viewport: HTMLElement;
  private plate: HTMLElement | null = null;
  private start: PhoneStart = { wide: [0, PLATE.w], tall: [0, PLATE.w] };
  /** Plate x at the middle of the crop, once the visitor has panned. Until then the start framing applies. */
  private centreX: number | null = null;
  private hint: HTMLElement | null = null;
  private settingScroll = false;
  private readonly onPan: (centreX: number) => void;
  private panned: boolean;

  /**
   * `hintHost` is where the swipe hint goes (the caption). `panned`: the visitor has panned before, so no
   * hint. `onPan` is called with the new position (plate x at the middle of the window) on every pan.
   */
  constructor(viewport: HTMLElement, hintHost: HTMLElement, panned: boolean, onPan: (centreX: number) => void) {
    this.viewport = viewport;
    this.panned = panned;
    this.onPan = onPan;
    if (!panned) {
      // Made now and shown later, so that showing it changes nothing but its opacity.
      const hint = document.createElement('p');
      hint.className = 'hj-swipe';
      hint.setAttribute('aria-hidden', 'true');
      hint.innerHTML = `${CHEVRON}<span>${SWIPE_HINT}</span>${CHEVRON.replace('<svg ', '<svg class="is-right" ')}`;
      hintHost.append(hint);
      this.hint = hint;
    }
    viewport.addEventListener('scroll', this.onScroll, { passive: true });
    this.enableMouseDrag();
  }

  /**
   * Point the pan at a scene's plate: its opening framing, and where this visitor left it (plate x at the
   * middle of the window, or null). Call when the plate goes into the window.
   */
  use(plate: HTMLElement, start: PhoneStart, savedX: number | null): void {
    this.plate = plate;
    this.start = start;
    this.centreX = savedX;
    this.layout();
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
    const centre = this.centreX ?? startCentre(this.start, this.viewport.clientWidth / u);
    this.settingScroll = true;
    this.viewport.scrollLeft = centre * u - this.viewport.clientWidth / 2;
    // The scroll event for this arrives asynchronously; ignore that one.
    requestAnimationFrame(() => {
      this.settingScroll = false;
    });
  }

  /** A small, still line in the caption, once the scene has settled. It leaves at the first pan. */
  showHint(): void {
    if (this.panned || !this.active) return;
    this.hint?.classList.add('is-on');
  }

  destroy(): void {
    this.viewport.removeEventListener('scroll', this.onScroll);
    this.hint?.remove();
  }

  private onScroll = (): void => {
    const u = this.plate ? this.plate.clientWidth / PLATE.w : 0;
    if (!u || this.settingScroll) return;
    this.centreX = (this.viewport.scrollLeft + this.viewport.clientWidth / 2) / u;
    this.panned = true;
    this.onPan(this.centreX);
    this.dismissHint();
  };

  private dismissHint(): void {
    const hint = this.hint;
    if (!hint) return;
    this.hint = null;
    hint.classList.remove('is-on');
    window.setTimeout(() => hint.remove(), 400);
  }

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

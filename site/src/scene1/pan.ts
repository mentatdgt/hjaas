// Portrait phones show a crop of the room as tall as the screen allows (4:5 up to 2:3) and the visitor swipes
// sideways to explore.
//
// The crop is a native horizontal scroller. That is what makes it feel native: the browser itself follows
// the finger 1:1, adds momentum and eases into the edges, all off the main thread, so panning stays smooth
// even while Rachel is hammering. Up-and-down swipes are not claimed (touch-action: pan-x pan-y), so the
// page scrolls under the same finger. This file only sets the starting position, adds mouse dragging for
// narrow desktop windows, and shows the one-time swipe hint.
import { PLATE } from './assets';
import { gsap, reducedMotion } from './motion';

// The crop starts on Rachel and the box. A 4:5 crop shows plate x 514-1267 (scene/README.md), a 2:3 crop
// x 590-1220 (review 01); crops in between are framed in between. Plate px, at full plate height.
const START_4_5 = { centre: (514 + 1267) / 2, width: (PLATE.h * 4) / 5 };
const START_2_3 = { centre: (590 + 1220) / 2, width: (PLATE.h * 2) / 3 };

function startCentre(visibleWidth: number): number {
  const t = Math.min(1, Math.max(0, (START_4_5.width - visibleWidth) / (START_4_5.width - START_2_3.width)));
  return START_4_5.centre + (START_2_3.centre - START_4_5.centre) * t;
}

const CHEVRON = `<svg viewBox="0 0 10 16" aria-hidden="true" focusable="false"><path d="M7.5 2 2.5 8l5 6"/></svg>`;
// TODO(copy): placeholder wording.
const SWIPE_HINT = 'Swipe sideways';

export class Pan {
  private readonly viewport: HTMLElement;
  private readonly plate: HTMLElement;
  /** Plate x at the middle of the crop, once the visitor has panned. Until then the start framing applies. */
  private centreX: number | null = null;
  private hint: HTMLElement | null = null;
  private settingScroll = false;
  private readonly onFirstPan: () => void;
  private panned: boolean;

  constructor(viewport: HTMLElement, plate: HTMLElement, alreadyPanned: boolean, onFirstPan: () => void) {
    this.viewport = viewport;
    this.plate = plate;
    this.panned = alreadyPanned;
    this.onFirstPan = onFirstPan;
    viewport.addEventListener('scroll', this.onScroll, { passive: true });
    this.enableMouseDrag();
  }

  /** True when the room is wider than its window, i.e. the visitor can pan. */
  get active(): boolean {
    return this.viewport.scrollWidth - this.viewport.clientWidth > 1;
  }

  /** Keep the same part of the room in the middle when the layout changes. */
  layout(): void {
    if (!this.active) return;
    const u = this.plate.clientWidth / PLATE.w;
    if (!u) return;
    const centre = this.centreX ?? startCentre(this.viewport.clientWidth / u);
    this.settingScroll = true;
    this.viewport.scrollLeft = centre * u - this.viewport.clientWidth / 2;
    // The scroll event for this arrives asynchronously; ignore that one.
    requestAnimationFrame(() => {
      this.settingScroll = false;
    });
  }

  /** A small, still line in the caption, once the scene has settled. It leaves at the first pan. */
  showHint(host: HTMLElement): void {
    if (this.panned || !this.active || this.hint) return;
    const hint = document.createElement('p');
    hint.className = 'hj-swipe';
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML = `${CHEVRON}<span>${SWIPE_HINT}</span>${CHEVRON.replace('<svg ', '<svg class="is-right" ')}`;
    host.append(hint);
    this.hint = hint;
    gsap.fromTo(hint, { opacity: 0 }, { opacity: 1, duration: reducedMotion() ? 0 : 0.3, ease: 'none', delay: 0.4 });
  }

  destroy(): void {
    this.viewport.removeEventListener('scroll', this.onScroll);
    this.hint?.remove();
  }

  private onScroll = (): void => {
    const u = this.plate.clientWidth / PLATE.w;
    if (!u || this.settingScroll) return;
    this.centreX = (this.viewport.scrollLeft + this.viewport.clientWidth / 2) / u;
    if (!this.panned) {
      this.panned = true;
      this.onFirstPan();
    }
    this.dismissHint();
  };

  private dismissHint(): void {
    const hint = this.hint;
    if (!hint) return;
    this.hint = null;
    gsap.to(hint, { opacity: 0, duration: 0.2, ease: 'none', onComplete: () => hint.remove() });
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

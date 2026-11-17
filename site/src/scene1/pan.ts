// Portrait phones show a 4:5 crop of the room and the visitor swipes sideways to explore.
//
// The crop is a native horizontal scroller. That is what makes it feel native: the browser itself follows
// the finger 1:1, adds momentum and eases into the edges, all off the main thread, so panning stays smooth
// even while Rachel is hammering. This file only sets the starting position, adds mouse dragging for
// narrow desktop windows, and runs the one-time swipe hint.
import { PLATE } from './assets';
import { gsap, reducedMotion } from './motion';

// The crop starts centred on Rachel: plate x 514-1267 at full plate height (scene/README.md).
const START_CENTRE_X = (514 + 1267) / 2;

const HAND = `
<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path d="M9.4 11.6V5.3a1.55 1.55 0 0 1 3.1 0v5.2l4.3.9c1.2.25 2 1.4 1.8 2.6l-.6 3.9a3 3 0 0 1-3 2.6h-3.3a3 3 0 0 1-2.3-1.1l-3.6-4.3a1.4 1.4 0 0 1 2-1.95z"/>
</svg>`;
const CHEVRON = `<svg viewBox="0 0 10 16" aria-hidden="true" focusable="false"><path d="M7.5 2 2.5 8l5 6"/></svg>`;

export class Pan {
  private readonly viewport: HTMLElement;
  private readonly plate: HTMLElement;
  private centreX = START_CENTRE_X;
  private hint: HTMLElement | null = null;
  private hintLoop: gsap.core.Timeline | null = null;
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
    this.settingScroll = true;
    this.viewport.scrollLeft = this.centreX * u - this.viewport.clientWidth / 2;
    // The scroll event for this arrives asynchronously; ignore that one.
    requestAnimationFrame(() => {
      this.settingScroll = false;
    });
  }

  /** A small hand that nudges sideways, once the scene has settled. It leaves at the first pan. */
  showHint(host: HTMLElement): void {
    if (this.panned || !this.active || this.hint) return;
    const hint = document.createElement('div');
    hint.className = 'hj-swipe';
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML = `<span class="hj-swipe-chev">${CHEVRON}</span><span class="hj-swipe-hand">${HAND}</span><span class="hj-swipe-chev is-right">${CHEVRON}</span>`;
    host.append(hint);
    this.hint = hint;
    gsap.fromTo(hint, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'none', delay: 0.4 });
    if (reducedMotion()) return;
    const hand = hint.querySelector('.hj-swipe-hand');
    // An attention loop: wait, nudge twice, rest a good while, repeat.
    this.hintLoop = gsap
      .timeline({ repeat: -1, repeatDelay: 3.2, delay: 1.1, defaults: { ease: 'sine.inOut' } })
      .to(hand, { x: -9, duration: 0.34 })
      .to(hand, { x: 7, duration: 0.44 })
      .to(hand, { x: -6, duration: 0.4 })
      .to(hand, { x: 0, duration: 0.34 });
  }

  destroy(): void {
    this.viewport.removeEventListener('scroll', this.onScroll);
    this.hintLoop?.kill();
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
    this.hintLoop?.kill();
    this.hintLoop = null;
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

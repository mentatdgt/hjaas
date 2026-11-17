// The counter: a small enamel pin in the corner (cream face, thin gold rim). When all the mushrooms
// are found, the same pin widens into the "Contact Hui Jie" button.
import { sweepGlint } from './glint';
import { EASE_OUT, gsap, reducedMotion, settle } from './motion';

const ICON = `
<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path class="hj-ico-stem" d="M9.3 13.6h5.4l.95 5.3c.17.95-.5 1.7-1.45 1.7H9.8c-.95 0-1.62-.75-1.45-1.7z"/>
  <path class="hj-ico-cap" d="M2.9 12.3c0-5 4-8.9 9.1-8.9s9.1 3.9 9.1 8.9c0 1.05-.8 1.7-1.85 1.7H4.75c-1.05 0-1.85-.65-1.85-1.7z"/>
  <circle class="hj-ico-dot" cx="8" cy="9.4" r="1.55"/>
  <circle class="hj-ico-dot" cx="12.9" cy="6.9" r="1.3"/>
  <circle class="hj-ico-dot" cx="16.8" cy="10.3" r="1.25"/>
</svg>`;

// Padding inside the pin, in CSS px. Keep in step with .hj-pin in scene.css.
const PAD_LEFT = 13;
const ICON_W = 22;
const GAP = 8;
const PAD_RIGHT_COUNT = 16;
const PAD_RIGHT_LABEL = 20;

export class Counter {
  readonly el: HTMLDivElement;
  readonly action: HTMLButtonElement;
  private readonly pin: HTMLDivElement;
  private readonly icon: HTMLSpanElement;
  private readonly count: HTMLSpanElement;
  private readonly label: HTMLSpanElement;
  private readonly strip: HTMLSpanElement;
  private readonly glintBar: HTMLSpanElement;
  private readonly note: HTMLParagraphElement;
  private readonly status: HTMLParagraphElement;
  private readonly total: number;
  private value: number;
  private widths = { count: 118, button: 190 };
  private roll: gsap.core.Tween | null = null;
  private noteTimer = 0;

  constructor(total: number, value: number) {
    this.total = total;
    this.value = value;

    this.el = document.createElement('div');
    this.el.className = 'hj-counter';
    this.el.dataset.state = 'counting';
    this.el.innerHTML = `
      <div class="hj-pin">
        <span class="hj-pin-shadow"></span>
        <span class="hj-pin-rim"></span>
        <span class="hj-pin-glint"><span class="hj-glint-bar"></span></span>
        <span class="hj-pin-face"></span>
        <span class="hj-pin-face hj-pin-face--go"></span>
        <span class="hj-pin-icon">${ICON}</span>
        <span class="hj-pin-count" aria-hidden="true">
          <span class="hj-odo"><span class="hj-odo-strip"><span>${value}</span></span></span>
          <span class="hj-pin-of">/ ${total}</span>
        </span>
        <span class="hj-pin-label" aria-hidden="true">Contact Hui Jie</span>
        <button class="hj-pin-action" type="button" hidden aria-haspopup="dialog">Contact Hui Jie</button>
      </div>
      <p class="hj-note" aria-hidden="true"></p>
      <p class="hj-sr" role="status" aria-live="polite"></p>
    `;
    const q = <T extends HTMLElement>(selector: string): T => this.el.querySelector<T>(selector)!;
    this.pin = q('.hj-pin');
    this.icon = q('.hj-pin-icon');
    this.count = q('.hj-pin-count');
    this.label = q('.hj-pin-label');
    this.strip = q('.hj-odo-strip');
    this.glintBar = q('.hj-glint-bar');
    this.note = q('.hj-note');
    this.status = q('.hj-sr');
    this.action = q('.hj-pin-action');
  }

  /** Size the pin from its real text. Call once it is in the document, and again when the font arrives. */
  measure(): void {
    const count = PAD_LEFT + ICON_W + GAP + this.count.offsetWidth + PAD_RIGHT_COUNT;
    const button = PAD_LEFT + ICON_W + GAP + this.label.offsetWidth + PAD_RIGHT_LABEL;
    if (!this.count.offsetWidth) return;
    this.widths = { count: Math.ceil(count), button: Math.ceil(Math.max(button, count)) };
    const style = this.pin.style;
    style.setProperty('--wc', `${this.widths.count}px`);
    style.setProperty('--wb', `${this.widths.button}px`);
    style.setProperty('--d0', `${this.widths.button - this.widths.count}px`);
    style.setProperty('--k', String(this.widths.count / this.widths.button));
  }

  /** Where a collected mushroom should land: the pin's own mushroom. */
  targetRect(): DOMRect {
    return this.icon.getBoundingClientRect();
  }

  get current(): number {
    return this.value;
  }

  /** A mushroom has landed: roll the number, give the pin a tiny squash and a glint on the rim. */
  land(value: number): void {
    const previous = this.value;
    this.value = value;
    this.status.textContent = `${value} of ${this.total} mushrooms found`;
    if (reducedMotion()) {
      this.crossfade(value);
      return;
    }
    this.rollTo(previous, value);
    gsap
      .timeline({ overwrite: true })
      .to(this.pin, { scaleX: 1.055, scaleY: 0.955, duration: 0.075, ease: 'power2.out' })
      .to(this.pin, { scaleX: 1, scaleY: 1, duration: 0.52, ease: settle });
    this.glint();
  }

  /** Set the number with no ceremony (restoring saved progress). */
  set(value: number): void {
    this.value = value;
    this.roll?.kill();
    this.strip.replaceChildren(digit(value));
    gsap.set(this.strip, { yPercent: 0 });
  }

  glint(): void {
    const width = this.el.dataset.state === 'unlocked' ? this.widths.button : this.widths.count;
    const bar = this.glintBar.offsetWidth;
    sweepGlint(this.glintBar, -bar * 1.2, width + bar * 0.4);
  }

  /** A short line under the pin. Passing a duration makes it leave by itself. */
  say(text: string, forMs?: number): void {
    window.clearTimeout(this.noteTimer);
    this.note.textContent = text;
    this.note.classList.add('is-on');
    if (forMs) this.noteTimer = window.setTimeout(() => this.hush(), forMs);
  }

  hush(): void {
    window.clearTimeout(this.noteTimer);
    this.note.classList.remove('is-on');
  }

  get noteText(): string {
    return this.note.classList.contains('is-on') ? (this.note.textContent ?? '') : '';
  }

  private rollTo(from: number, to: number): void {
    // Like an odometer: the old number leaves upward as the new one arrives from below.
    this.roll?.kill();
    this.strip.replaceChildren(digit(from), digit(to));
    this.roll = gsap.fromTo(
      this.strip,
      { yPercent: 0 },
      {
        yPercent: -50,
        duration: 0.5,
        ease: EASE_OUT,
        onComplete: () => {
          this.strip.replaceChildren(digit(to));
          gsap.set(this.strip, { yPercent: 0 });
        },
      },
    );
  }

  private crossfade(to: number): void {
    this.roll?.kill();
    gsap.set(this.strip, { yPercent: 0 });
    this.roll = gsap.to(this.strip, {
      opacity: 0,
      duration: 0.12,
      ease: 'none',
      onComplete: () => {
        this.strip.replaceChildren(digit(to));
        gsap.to(this.strip, { opacity: 1, duration: 0.18, ease: 'none' });
      },
    });
  }
}

function digit(value: number): HTMLSpanElement {
  const span = document.createElement('span');
  span.textContent = String(value);
  return span;
}

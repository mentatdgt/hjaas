// The hunt's caption under the picture: "3 of 10 found" beside a small mushroom, and a line saying what
// the hunt is for. Plain text on the page, with one quick, quiet update per find. Each scene has its own
// count. Once every mushroom of every scene is found, the "Contact Hui Jie" button joins the caption, and
// from then on it stays, in every scene.
import { CSS_EASE_OUT, reducedMotion } from './motion';

export const MUSHROOM_ICON = `
<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path class="hj-ico-stem" d="M9.3 13.6h5.4l.95 5.3c.17.95-.5 1.7-1.45 1.7H9.8c-.95 0-1.62-.75-1.45-1.7z"/>
  <path class="hj-ico-cap" d="M2.9 12.3c0-5 4-8.9 9.1-8.9s9.1 3.9 9.1 8.9c0 1.05-.8 1.7-1.85 1.7H4.75c-1.05 0-1.85-.65-1.85-1.7z"/>
  <circle class="hj-ico-dot" cx="8" cy="9.4" r="1.55"/>
  <circle class="hj-ico-dot" cx="12.9" cy="6.9" r="1.3"/>
  <circle class="hj-ico-dot" cx="16.8" cy="10.3" r="1.25"/>
</svg>`;

export class Caption {
  readonly el: HTMLDivElement;
  /**
   * The "Contact Hui Jie" button. Until the hunt is complete it is laid out but out of sight and out of
   * reach (`.is-waiting`), so that showing it later costs no first layout of its text.
   */
  readonly action: HTMLButtonElement;
  private readonly tally: HTMLParagraphElement;
  private readonly icon: HTMLSpanElement;
  private readonly number: HTMLSpanElement;
  private readonly note: HTMLParagraphElement;
  private readonly status: HTMLParagraphElement;
  private readonly total: number;
  private value = 0;

  constructor(total: number) {
    this.total = total;

    this.el = document.createElement('div');
    this.el.className = 'hj-caption-main';
    this.el.innerHTML = `
      <button class="hj-contact is-waiting" type="button" aria-haspopup="dialog">${MUSHROOM_ICON}Contact Hui Jie</button>
      <p class="hj-tally" aria-hidden="true">
        <span class="hj-tally-icon">${MUSHROOM_ICON}</span>
        <span><span class="hj-tally-n">0</span> of ${total} found</span>
      </p>
      <p class="hj-note" aria-hidden="true"></p>
      <p class="hj-sr" role="status" aria-live="polite"></p>
    `;
    const q = <T extends HTMLElement>(selector: string): T => this.el.querySelector<T>(selector)!;
    this.tally = q('.hj-tally');
    this.icon = q('.hj-tally-icon');
    this.number = q('.hj-tally-n');
    this.note = q('.hj-note');
    this.status = q('.hj-sr');
    this.action = q('.hj-contact');
  }

  /** Where a collected mushroom should land: the caption's own mushroom. */
  targetRect(): DOMRect {
    return this.icon.getBoundingClientRect();
  }

  get current(): number {
    return this.value;
  }

  /**
   * Show a scene's state, with no ceremony: its count, the line beside it, and whether the Contact button
   * has been earned. A finished scene shows only its line; the count has done its job.
   */
  set(count: number, note: string, unlocked: boolean): void {
    this.value = count;
    this.number.textContent = String(count);
    this.tally.hidden = count >= this.total;
    this.action.classList.toggle('is-waiting', !unlocked);
    this.note.textContent = note;
  }

  /** The same, as a short cross-fade: out, change, in. For the unlock, a finished scene, a change of scene. */
  change(count: number, note: string, unlocked: boolean, announce = ''): void {
    if (announce) this.status.textContent = announce;
    if (reducedMotion() || !this.el.isConnected) {
      this.set(count, note, unlocked);
      return;
    }
    const leave = this.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease', fill: 'forwards' });
    void leave.finished.then(() => {
      this.set(count, note, unlocked);
      leave.cancel();
      this.el.animate(
        [
          { opacity: 0, transform: 'translateY(4px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 260, easing: CSS_EASE_OUT },
      );
    });
  }

  /**
   * A mushroom has landed: the number changes, with one short rise and fade (200 ms).
   * `also` is added to the screen-reader announcement.
   */
  land(value: number, also = ''): void {
    this.value = value;
    this.status.textContent = `${value} of ${this.total} mushrooms found.${also ? ` ${also}.` : ''}`;
    this.number.textContent = String(value);
    if (reducedMotion()) return;
    this.number.animate(
      [
        { opacity: 0.15, transform: 'translateY(3px)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 200, easing: CSS_EASE_OUT },
    );
  }

  get unlocked(): boolean {
    return !this.action.classList.contains('is-waiting');
  }

  /** The line beside the count. A change of words is a short cross-fade, not a movement. */
  say(text: string): void {
    if (this.note.textContent === text) return;
    if (!this.note.textContent || reducedMotion() || !this.note.isConnected) {
      this.note.textContent = text;
      return;
    }
    this.note.style.opacity = '0';
    window.setTimeout(() => {
      this.note.textContent = text;
      this.note.style.opacity = '';
    }, 160);
  }
}

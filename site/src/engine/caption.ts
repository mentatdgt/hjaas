// The hunt's two counters under the picture, and the Contact button they turn into.
//
//   cream mushroom   this scene, of 10    "7/10  3 more in Build"
//   red mushroom     all scenes, of 50    "17/50  find all 50 to contact Hui Jie"
//
// Each mushroom fills from the bottom, stem first, then cap. Once every mushroom of every scene is found, both
// rows cross-fade into the "Contact Hui Jie" button: one element, the counter becomes the button.
//
// What a find does, from the moment its mushroom lands (HANDOVER-hunt-counter.md, section 2):
//
//      0 ms   the cream fill (500 ms), the cream number rolls, its label changes
//     90      the same for the red row
//    450      the scene's tenth: a glint across the cream cap (900 ms), the red mushroom on its tab
//    650      and the "Next" link fades in
//    900      the site's fiftieth: a glint across the red cap (900 ms)
//   2000      and both rows cross-fade into the button (450 ms, 4 px rise)
//
// Only a find moves anything. A scene change is one short fade of the whole caption, and a return visit shows
// the saved state at once. Everything shown comes from a HuntView (state.ts), worked out from the saved finds.
import { CSS_EASE_OUT, reducedMotion } from './motion';
import { fillOf, hereLabel, siteLabel, stemFinds, type CounterCopy, type HuntView } from './state';

const CAP = 'M1 14.4C1 6.7 6.9 1 15 1s14 5.7 14 13.4c0 2.3-1.6 3.6-3.9 3.6H4.9C2.6 18 1 16.7 1 14.4z';
const STEM = 'M10.4 17h9.2l1.2 9.1c.2 1.7-.8 2.9-2.4 2.9h-6.8c-1.6 0-2.6-1.2-2.4-2.9z';
/** The stem's outline, open at the top, where the cap's own line closes it. */
const STEM_LINE = 'M10.3 18 9.2 26.1c-.2 1.7.8 2.9 2.4 2.9h6.8c1.6 0 2.6-1.2 2.4-2.9L19.7 18';
const SPOTS = '<circle cx="8.3" cy="11.2" r="2.3"/><circle cx="15.2" cy="6.4" r="2"/><circle cx="21.6" cy="11.8" r="2.1"/>';

// Drawn, not typed: the page's font has no arrow, and the browser's search for one took 150 ms on a slowed phone.
const ARROW = '<svg class="hj-arrow" viewBox="0 0 14 10" aria-hidden="true" focusable="false"><path d="M1 5h11.5M8.7 1.2 12.6 5 8.7 8.8"/></svg>';

/**
 * A mushroom, drawn in code: the cap 28 × 17 px and the stem 12 × 12 px, outlined in the page's ink. This is the
 * whole, full mushroom, or only its fill, or only its outline.
 */
function mushroom(kind: 'cream' | 'red', part: 'whole' | 'fill' | 'line' = 'whole'): string {
  const fill = (name: string, path: string): string => (part === 'line' ? '' : `<path class="hj-m-${name}" d="${path}"/>`);
  const line = (path: string): string => (part === 'fill' ? '' : `<path class="hj-m-line" d="${path}"/>`);
  const spots = kind === 'red' && part !== 'line' ? `<g class="hj-m-spots">${SPOTS}</g>` : '';
  return `<svg class="hj-mush is-${kind}" viewBox="0 0 30 30" aria-hidden="true" focusable="false">${fill('stem', STEM)}${line(STEM_LINE)}${fill('cap', CAP)}${spots}${line(CAP)}</svg>`;
}

/**
 * A counter's mushroom: the full fill, a cover in the page's paper over the stem and over the cap, the outline
 * on top. A cover shrinks upward (scaleY), so the fill comes up from the bottom, spots and all. The covers and
 * the glint are boxes of the page, cut to the drawing's shape, so the compositor moves them.
 */
const counter = (kind: 'cream' | 'red'): string => `<span class="hj-m">${mushroom(kind, 'fill')}<span class="hj-m-clip"><span class="hj-m-cover" data-part="stem"></span></span><span class="hj-m-clip"><span class="hj-m-cover" data-part="cap"></span><span class="hj-m-glint"></span></span>${mushroom(kind, 'line')}</span>`;

/** The red mushroom, full: the Contact button's icon, the form's, and (tiny) a finished scene's tab's. */
export const MUSHROOM_ICON = mushroom('red');

const ROLL_OUT_MS = 160;
const ROLL_IN_MS = 200;
const ROLL_PX = 8;
const RED_AFTER_MS = 90;
const SAY_AT = 300;
const CREAM_GLINT_AT = 450;
const NEXT_AT = 650;
const RED_GLINT_AT = 900;
const BUTTON_AT = 2000;
const GLINT_MS = 900;
const CROSSFADE_MS = 450;
const CSS_EASE_GLINT = 'cubic-bezier(.645, .045, .355, 1)';

/** An element's one piece of text, changed in place: a new text node would lay the whole page out again. */
const read = (el: HTMLElement): string => (el.firstChild as Text).data;
const write = (el: HTMLElement, text: string): void => void ((el.firstChild as Text).data = text);

/** One counter: its mushroom, its number, its label. */
class Row {
  readonly el: HTMLDivElement;
  readonly art: HTMLSpanElement;
  private readonly now: HTMLSpanElement;
  /** The number being replaced, on its way up and out. Always there, so a find adds nothing to the page. */
  private readonly old: HTMLSpanElement;
  private readonly of: HTMLSpanElement;
  private readonly label: HTMLSpanElement;
  private readonly covers: Record<'stem' | 'cap', HTMLElement>;
  private readonly shine: HTMLElement;
  private relabel = 0;
  private rolling: Animation[] = [];
  private glinting: Animation | null = null;

  constructor(kind: 'cream' | 'red') {
    this.el = document.createElement('div');
    this.el.className = `hj-row is-${kind}`;
    this.el.innerHTML = `<span class="hj-row-art" role="img">${counter(kind)}</span><span class="hj-num" aria-hidden="true"><span class="hj-num-n"><span class="hj-num-now">0</span><span class="hj-num-old">0</span></span><span class="hj-num-of"></span></span><span class="hj-label">.</span>`;
    const q = <T extends Element>(selector: string): T => this.el.querySelector<T>(selector)!;
    this.art = q('.hj-row-art');
    this.now = q('.hj-num-now');
    this.old = q('.hj-num-old');
    this.of = q('.hj-num-of');
    this.label = q('.hj-label');
    this.covers = { stem: q('[data-part="stem"]'), cap: q('[data-part="cap"]') };
    this.covers.stem.parentElement!.style.clipPath = `path('${STEM}')`;
    this.covers.cap.parentElement!.style.clipPath = `path('${CAP}')`;
    this.shine = q('.hj-m-glint');
  }

  /** Simply so: no roll, no fill. */
  set(found: number, total: number, label: string, spoken: string): void {
    this.still();
    // (Not getAnimations(): asking brings the page's style up to date there and then, in the middle of a change.)
    this.glinting?.cancel();
    this.glinting = null;
    this.el.classList.remove('is-filling');
    write(this.now, String(found));
    this.of.textContent = `/${total}`;
    write(this.label, label);
    this.fill(found, total, spoken);
  }

  /** A find: the fill rises, the number rolls, the label changes. All three can be cut short by the next find. */
  roll(found: number, total: number, label: string, spoken: string): void {
    if (reducedMotion()) {
      this.set(found, total, label, spoken);
      return;
    }
    this.still();
    this.el.classList.add('is-filling');
    this.fill(found, total, spoken);
    write(this.old, read(this.now));
    write(this.now, String(found));
    const out = this.old.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(-${ROLL_PX}px)` }], { duration: ROLL_OUT_MS, easing: CSS_EASE_OUT });
    const into = this.now.animate([{ opacity: 0, transform: `translateY(${ROLL_PX}px)` }, { opacity: 1, transform: 'none' }], { duration: ROLL_IN_MS, easing: CSS_EASE_OUT });
    this.rolling = [out, into];
    if (read(this.label) === label) return;
    this.label.classList.add('is-changing');
    this.relabel = window.setTimeout(() => {
      write(this.label, label);
      this.label.classList.remove('is-changing');
    }, 140);
  }

  /** A soft light across the cap, once. */
  glint(): void {
    if (reducedMotion()) return;
    this.glinting = this.shine.animate(
      [
        { transform: 'translateX(-15px) skewX(-18deg)', opacity: 1 },
        { transform: 'translateX(36px) skewX(-18deg)', opacity: 1 },
      ],
      { duration: GLINT_MS, easing: CSS_EASE_GLINT },
    );
  }

  private fill(found: number, total: number, spoken: string): void {
    const part = fillOf(found, total, stemFinds(total));
    this.covers.stem.style.transform = `scaleY(${1 - part.stem})`;
    this.covers.cap.style.transform = `scaleY(${1 - part.cap})`;
    this.art.setAttribute('aria-label', spoken);
  }

  private still(): void {
    window.clearTimeout(this.relabel);
    this.label.classList.remove('is-changing');
    for (const animation of this.rolling) animation.cancel();
    this.rolling = [];
  }
}

export interface CaptionCopy extends CounterCopy {
  next: string;
  contact: string;
  /** The mushrooms' own names, for screen readers. */
  hereSpoken: (found: number, total: number, scene: string) => string;
  siteSpoken: (found: number, total: number) => string;
  /** Announced when the button comes. */
  unlock: (total: number) => string;
}

export interface CaptionEvents {
  /** A finished scene has had its moment: the mushroom on its tab is due. */
  onDone: () => void;
  /** The counter has become the button. */
  onButton: () => void;
}

export class Caption {
  readonly el: HTMLDivElement;
  /**
   * The "Contact Hui Jie" button. Until the hunt is complete it is laid out in the counter's place but out of
   * sight and out of reach (`.is-off`), so that showing it later costs no first layout of its text.
   */
  readonly action: HTMLButtonElement;
  /** "Next: Grow →": to the next scene with something left to find. Only beside a finished scene's counter. */
  readonly next: HTMLAnchorElement;
  private readonly copy: CaptionCopy;
  private readonly events: CaptionEvents;
  private readonly counter: HTMLDivElement;
  private readonly prize: HTMLDivElement;
  private readonly prizeNote: HTMLParagraphElement;
  private readonly cream = new Row('cream');
  private readonly red = new Row('red');
  private readonly status: HTMLParagraphElement;
  private timers: number[] = [];
  private running: Animation[] = [];
  private button = false;
  /** The numbers the counters show, or are about to (the red row follows the cream one by 90 ms). */
  private counts = { here: 0, site: 0 };

  constructor(copy: CaptionCopy, events: CaptionEvents) {
    this.copy = copy;
    this.events = events;
    this.el = document.createElement('div');
    this.el.className = 'hj-caption-main';
    this.el.innerHTML = `
      <div class="hj-counter"></div>
      <div class="hj-prize is-off">
        <button class="hj-contact" type="button" aria-haspopup="dialog">${MUSHROOM_ICON}${copy.contact}</button>
        <p class="hj-prize-note"></p>
      </div>
      <p class="hj-sr" role="status" aria-live="polite"></p>
    `;
    const q = <T extends HTMLElement>(selector: string): T => this.el.querySelector<T>(selector)!;
    this.counter = q('.hj-counter');
    this.prize = q('.hj-prize');
    this.prizeNote = q('.hj-prize-note');
    this.action = q('.hj-contact');
    this.status = q('.hj-sr');
    this.next = document.createElement('a');
    this.next.className = 'hj-next is-off';
    this.cream.el.append(this.next);
    this.counter.append(this.cream.el, this.red.el);
  }

  /**
   * Every number and every word the counters can come to show, laid out once, unseen, while nothing is moving:
   * the first layout of new text is what a landing would otherwise wait for (34 ms on a slowed phone). Call it
   * once, before the page's motion starts; the scenes' names are the menu's.
   */
  prepare(scenes: readonly string[], total: number): void {
    const { copy } = this;
    const numbers = Array.from({ length: total + 1 }, (_, i) => i).join(' ');
    const words = scenes.flatMap((scene) => [copy.hereFound(scene), copy.hereMore(1, scene), copy.hereDone(scene)]);
    const el = document.createElement('div');
    el.className = 'hj-rehearse';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<span class="hj-num">${numbers} /${total}</span><span class="hj-label">${numbers} ${words.join(' ')} ${copy.siteAll(total)} ${copy.siteMore(1)} ${copy.siteDone(total)}</span><span class="hj-next">${copy.next} ${scenes.join(' ')}</span><span class="hj-said">${numbers} ${copy.unlock(total)} ${copy.hereSpoken(0, 0, '')}. ${words.join('. ')}.</span>`;
    this.el.append(el);
  }

  /** Where a collected mushroom should land: the cream mushroom. */
  targetRect(): DOMRect {
    return this.cream.art.getBoundingClientRect();
  }

  /** The numbers on screen. */
  get current(): { here: number; site: number } {
    return { ...this.counts };
  }

  /** The counter has become the button. */
  get unlocked(): boolean {
    return this.button;
  }

  /** Show a scene's state, with no ceremony. */
  set(view: HuntView): void {
    this.calm();
    this.counts = { here: view.here.found, site: view.site.found };
    this.cream.set(view.here.found, view.here.total, ...this.creamWords(view));
    this.red.set(view.site.found, view.site.total, ...this.redWords(view));
    this.point(view);
    this.next.classList.toggle('is-off', !this.offersNext(view));
    this.prizeNote.textContent = this.copy.siteDone(view.site.total);
    this.turn(view.unlocked);
  }

  settle(view: HuntView, justEarned: boolean): void {
    const announce = view.unlocked && (justEarned || !this.button);
    this.set(view);
    if (announce) this.status.textContent = this.copy.unlock(view.site.total);
  }

  /** Another scene's state, as one short fade of the whole caption: out, change, in. */
  change(view: HuntView, announce = '', instant = false): void {
    if (announce) this.status.textContent = announce;
    // The button is the same in every scene: nothing to change.
    const same = this.button && view.unlocked;
    if (same || instant || reducedMotion() || !this.el.isConnected) {
      this.set(view);
      return;
    }
    this.calm();
    const leave = this.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease', fill: 'forwards' });
    this.running.push(leave);
    leave.onfinish = () => {
      this.set(view);
      this.running.push(this.el.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: CSS_EASE_OUT }));
    };
  }

  /**
   * A mushroom has landed on the cream counter. `view` is the hunt as it is now; another mushroom may still be
   * in the air, so each landing counts one more and never more than have been found.
   */
  land(view: HuntView): void {
    // (QA: where a trace of the production build finds a landing.)
    performance.mark('hj-land');
    const here = { ...view.here, found: Math.min(view.here.found, this.counts.here + 1) };
    const site = { ...view.site, found: Math.min(view.site.found, this.counts.site + 1) };
    const at: HuntView = { ...view, here, site };
    this.counts = { here: here.found, site: site.found };
    const done = here.found >= here.total;
    const unlocked = view.unlocked && site.found >= site.total;
    const cream = this.creamWords(at);
    this.cream.roll(here.found, here.total, ...cream);
    // (Said a moment later: nothing is added to the landing's own frame.)
    this.after(SAY_AT, () => (this.status.textContent = `${cream[1]}. ${cream[0]}.`));
    // The red row a moment behind.
    this.after(reducedMotion() ? 0 : RED_AFTER_MS, () => this.red.roll(site.found, site.total, ...this.redWords(at)));
    if (done) {
      this.point(at);
      this.after(CREAM_GLINT_AT, () => {
        this.cream.glint();
        this.events.onDone();
      });
      if (this.offersNext(at)) {
        this.after(NEXT_AT, () => {
          this.next.classList.remove('is-off');
          this.running.push(this.next.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease' }));
        });
      }
    }
    if (unlocked) {
      // The two blocks get their layers now, not in the cross-fade's first frame.
      this.el.classList.add('is-turning');
      this.after(RED_GLINT_AT, () => this.red.glint());
      this.after(BUTTON_AT, () => this.become(at));
    }
  }

  /** Both rows cross-fade into the button. */
  private become(view: HuntView): void {
    this.status.textContent = this.copy.unlock(view.site.total);
    this.turn(true);
    // Both are on the page for the length of the fade.
    this.counter.classList.add('is-leaving');
    const calm = reducedMotion();
    const rise = (px: number): string => (calm ? 'none' : `translateY(${px}px)`);
    const timing: KeyframeAnimationOptions = { duration: CROSSFADE_MS, easing: calm ? 'linear' : CSS_EASE_OUT, fill: 'backwards' };
    const out = this.counter.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: rise(-4) }], { ...timing, fill: 'both' });
    const into = this.prize.animate([{ opacity: 0, transform: rise(4) }, { opacity: 1, transform: 'none' }], timing);
    this.running.push(out, into);
    into.onfinish = () => {
      this.counter.classList.remove('is-leaving');
      this.el.classList.remove('is-turning');
      out.cancel();
      this.events.onButton();
    };
  }

  /** The counter, or the button. */
  private turn(button: boolean): void {
    this.button = button;
    this.counter.classList.toggle('is-off', button);
    this.prize.classList.toggle('is-off', !button);
  }

  private offersNext(view: HuntView): boolean {
    return view.next !== null && view.here.found >= view.here.total;
  }

  private point(view: HuntView): void {
    if (!view.next || this.next.hash === `#${view.next.id}`) return;
    this.next.href = `#${view.next.id}`;
    this.next.innerHTML = `<span class="hj-next-word">${this.copy.next} </span>${view.next.label} ${ARROW}`;
  }

  /** A counter's label, and its mushroom's name for screen readers. */
  private creamWords(view: HuntView): [string, string] {
    return [hereLabel(this.copy, view.label, view.here), this.copy.hereSpoken(view.here.found, view.here.total, view.label)];
  }

  private redWords(view: HuntView): [string, string] {
    return [siteLabel(this.copy, view.site), this.copy.siteSpoken(view.site.found, view.site.total)];
  }

  private after(ms: number, then: () => void): void {
    if (ms <= 0) then();
    else this.timers.push(window.setTimeout(then, ms));
  }

  /** Whatever was under way is over: the visitor has moved on. */
  private calm(): void {
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers = [];
    for (const animation of this.running) {
      animation.onfinish = null;
      animation.cancel();
    }
    this.running = [];
    this.counter.classList.remove('is-leaving');
    this.el.classList.remove('is-turning');
  }
}

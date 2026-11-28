// The prize for finding all fifty: a contact form that opens from the caption-turned-button.
// Its words: reviews/copy-round-1-build.md, section 4, with job 005's changes. (The choices are in needs.js and the
// email rule in email.js, both shared with the server.)
import { MUSHROOM_ICON } from './caption';
import { EMAIL } from './email.js';
import { NEEDS } from './needs.js';
import { CONTACT_LIMITS, SendError, canSend, needsLength, submitContact, type ContactPayload } from './submit';

const CLOSE_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 3.5l9 9m0-9l-9 9"/></svg>`;
const TICK_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.6 8.4l2.9 2.9 5.9-6.2"/></svg>`;

const CHEVRON_ICON = `<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2.5 4.5L6 8l3.5-3.5"/></svg>`;

type FieldName = 'name' | 'email' | 'phone' | 'message';
/** Where a message can show: one per field, and one for the reply group as a whole (neither email nor phone). */
type ErrorName = FieldName | 'reply';
type Phone = typeof import('./phone');

// The order they are checked and focused in. (The reply group's message sits above the email box, so it goes first.)
const FIELDS: FieldName[] = ['name', 'email', 'phone', 'message'];
// Characters a field takes. The phone box takes a number as written ("+44 (0)7911 123-456"), longer than its E.164.
const TYPED_LIMITS: Record<FieldName, number> = { name: CONTACT_LIMITS.name, email: CONTACT_LIMITS.email, phone: 32, message: CONTACT_LIMITS.message };

const RULES: Record<'name' | 'email' | 'message', (value: string) => string> = {
  name: (value) => (value ? '' : 'What should I call you?'),
  // Optional, but a wrong one is never let through.
  email: (value) => (!value || EMAIL.test(value) ? '' : 'That email looks a bit off. Typo?'),
  message: (value) => (value ? '' : 'A few words, so I know where to start.'),
};

const NO_REPLY = 'Add an email or a phone number so I can reply.';
// (No country name for a + code that belongs to none.)
const wrongNumber = (country: string): string =>
  country ? `That number doesn't look right for ${country}. Check the digits or pick a different country code.` : "That number doesn't look right.";

// The one country shown before the phone module has loaded, and the default.
const SINGAPORE = { code: 'SG', name: 'Singapore', dial: '65' };
const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Pasting, dropping, or an autofill/suggestion fills the box in one go; typing does not (it is left alone).
const filledInOneGo = (event: Event): boolean => !(event as InputEvent).inputType || /^insert(?:FromPaste|FromDrop|ReplacementText)$/.test((event as InputEvent).inputType);

const COPY = {
  send: 'Send it',
  sending: 'Sending',
  notConnected: 'This form is not switched on yet, so messages cannot be sent from here for now.',
  notSent: 'This form is not switched on yet, so your message has not been sent.',
  // No connection, a timeout, the server's own trouble, or an answer that is not its {"ok":true}.
  failed: "Couldn't send your message just now. It's all still here, so please try again in a moment.",
  busy: 'Too many tries. Please wait a minute and try again.',
  // The status line, heard but not seen (role="status").
  sendingStatus: 'Sending your message…',
  sentStatus: 'Message sent.',
  testStatus: 'Test mode: nothing was sent.',
};

/** 429: the server's Retry-After, in words. A minute (what api/contact.js says) or none: the plain line. */
export function busyMessage(seconds?: number): string {
  if (!seconds || seconds <= 0) return COPY.busy;
  if (seconds < 60) return `Too many tries. Please try again in ${seconds} second${seconds === 1 ? '' : 's'}.`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes === 1) return COPY.busy;
  return minutes <= 60 ? `Too many tries. Please try again in ${minutes} minutes.` : 'Too many tries. Please try again later.';
}

/** What the alert says when a send fails. */
export function failureMessage(error: unknown): string {
  if (!(error instanceof SendError)) return COPY.failed;
  if (error.reason === 'not-connected') return COPY.notSent;
  if (error.reason === 'busy') return busyMessage(error.retryAfter);
  return COPY.failed;
}

const EXIT_MS = 240;
// How long the iPhone keyboard takes to finish rising before a focused field is brought into view.
const SETTLE_MS = 300;
// Room the sheet needs above the button to show the whole form, every error line included (it is 420 px wide
// wherever it hangs from the button). With less, it sits in the middle instead. qa/tools/form-compact.mjs checks it.
const SHEET_ROOM = 680;

/** A phone or tablet: no hover, a finger. */
const isTouch = (): boolean => window.matchMedia?.('(hover: none) and (pointer: coarse)').matches ?? false;

export class ContactForm {
  private readonly dialog: HTMLDialogElement;
  private readonly body: HTMLElement;
  private readonly form: HTMLFormElement;
  private readonly sent: HTMLElement;
  private readonly alert: HTMLElement;
  private readonly send: HTMLButtonElement;
  private readonly trigger: HTMLElement;
  private readonly country: HTMLSelectElement;
  private readonly title: HTMLElement;
  private readonly status: HTMLElement;
  private readonly shown = new Set<ErrorName>();
  /** The visual viewport being followed (touch screens, while open), and the timer that reveals a focused field. */
  private viewport: VisualViewport | null = null;
  private fitFrame = 0;
  private revealTimer = 0;
  private closing = 0;
  private sending = false;
  private checking = false;
  private phone: Phone | null = null;
  private loading: Promise<Phone> | null = null;
  private submission = 0;
  private pending: AbortController | null = null;
  private prepared = false;

  constructor(host: HTMLElement, trigger: HTMLElement) {
    this.trigger = trigger;
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'hj-dialog';
    this.dialog.setAttribute('aria-labelledby', 'hj-form-title');
    this.dialog.innerHTML = `
      <div class="hj-sheet">
        <header class="hj-sheet-head">
          <h2 id="hj-form-title" tabindex="-1">Hi! What have you got in mind?</h2>
          <button type="button" class="hj-close" aria-label="Close">${CLOSE_ICON}</button>
        </header>
        <div class="hj-sheet-body">
          <form class="hj-form" novalidate>
            <p class="hj-alert hj-notice" role="status" hidden></p>
            <div class="hj-field">
              <label for="hj-name">Your name</label>
              <input id="hj-name" name="name" type="text" placeholder="Timothée Chalamet" autocomplete="name" autocapitalize="words" maxlength="${CONTACT_LIMITS.name}" required aria-describedby="hj-name-err" />
              <p class="hj-err" id="hj-name-err" aria-live="polite" hidden></p>
            </div>
            <fieldset class="hj-field hj-reply">
              <legend>How should I reply? <span class="hj-hint" id="hj-reply-hint">Email, phone, or both (at least one)</span></legend>
              <!-- Not a live region: it only appears on Send, which moves focus to Email, and Email (and Phone) are
                   described by it while it shows. So it is heard once, as Email is focused (form.ts, describeReply). -->
              <p class="hj-err" id="hj-reply-err" hidden></p>
              <div class="hj-sub">
                <label for="hj-email">Email</label>
                <input id="hj-email" name="email" type="email" autocomplete="email" inputmode="email" spellcheck="false" autocapitalize="off" placeholder="timothee@gmail.com" maxlength="${TYPED_LIMITS.email}" aria-describedby="hj-email-err" />
                <p class="hj-err" id="hj-email-err" aria-live="polite" hidden></p>
              </div>
              <div class="hj-sub">
                <label for="hj-phone">Phone</label>
                <div class="hj-tel">
                  <span class="hj-country">
                    <select id="hj-country" name="country" autocomplete="tel-country-code" aria-label="Country code"><option value="${SINGAPORE.code}" selected>${SINGAPORE.name} +${SINGAPORE.dial}</option></select>
                    <span class="hj-country-face" aria-hidden="true"><span class="hj-country-code">${SINGAPORE.code} +${SINGAPORE.dial}</span>${CHEVRON_ICON}</span>
                  </span>
                  <input id="hj-phone" name="phone" type="text" inputmode="tel" autocomplete="tel-national" placeholder="9888 1135" maxlength="${TYPED_LIMITS.phone}" aria-describedby="hj-phone-err" />
                </div>
                <p class="hj-err" id="hj-phone-err" aria-live="polite" hidden></p>
              </div>
            </fieldset>
            <fieldset class="hj-field hj-needs">
              <legend>What can I help with? <span class="hj-hint">Optional, pick any</span></legend>
              <div class="hj-chips">
                ${NEEDS.map((need) => `<label class="hj-chip"><input type="checkbox" name="need" value="${need}" /><span>${TICK_ICON}${need}</span></label>`).join('')}
              </div>
            </fieldset>
            <div class="hj-field">
              <label for="hj-message">Tell me about it</label>
              <textarea id="hj-message" name="message" rows="3" placeholder="The space, the timeline, the feeling you're after. Rough is fine." maxlength="${CONTACT_LIMITS.message}" required aria-describedby="hj-message-err"></textarea>
              <p class="hj-err" id="hj-message-err" aria-live="polite" hidden></p>
            </div>
            <div class="hj-trap" aria-hidden="true">
              <label for="hj-extra">Leave this empty</label>
              <input id="hj-extra" name="extra" type="text" tabindex="-1" autocomplete="off" data-1p-ignore data-lpignore="true" data-bwignore data-form-type="other" />
            </div>
            <p class="hj-alert hj-failure" role="alert" hidden></p>
            <button type="submit" class="hj-send"><span class="hj-send-label">${COPY.send}</span></button>
          </form>
          <div class="hj-sent" hidden>
            <span class="hj-sent-mark">${MUSHROOM_ICON}<span class="hj-sent-tick">${TICK_ICON}</span></span>
            <h3 id="hj-sent-title" tabindex="-1">Got it, thank you.</h3>
            <p class="hj-sent-line"></p>
            <p class="hj-dev-note" hidden>Test mode: nothing was sent. The message is in the browser console.</p>
            <button type="button" class="hj-send hj-done"><span class="hj-send-label">Back to the scenes</span></button>
          </div>
        </div>
        <!-- Always there, so screen readers hear "Sending your message…" and then "Message sent." -->
        <p class="hj-sr" id="hj-status" role="status"></p>
      </div>
    `;
    host.append(this.dialog);

    const q = <T extends HTMLElement>(selector: string): T => this.dialog.querySelector<T>(selector)!;
    this.body = q('.hj-sheet-body');
    this.form = q<HTMLFormElement>('.hj-form');
    this.sent = q('.hj-sent');
    this.alert = q('.hj-failure');
    this.send = q<HTMLButtonElement>('.hj-form .hj-send');
    this.country = this.form.elements.namedItem('country') as HTMLSelectElement;
    this.title = q('#hj-form-title');
    this.status = q('#hj-status');

    if (!canSend) {
      // Say so before anyone writes a message, not after.
      const notice = q('.hj-notice');
      notice.textContent = COPY.notConnected;
      notice.hidden = false;
      this.send.setAttribute('aria-disabled', 'true');
    }

    q('.hj-close').addEventListener('click', () => this.close());
    q('.hj-done').addEventListener('click', () => this.close());
    // Escape is a keyboard action: it closes at once, with no exit animation.
    this.dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.close(true);
    });
    // A click on the dimmed room behind the sheet closes it.
    this.dialog.addEventListener('click', (event) => {
      if (event.target === this.dialog) this.close();
    });

    for (const name of FIELDS) {
      const input = this.field(name);
      input.addEventListener('blur', () => {
        // A full international number typed in: pick its country, keep the rest as written.
        if (name === 'phone') this.adoptCountry();
        if (input.value.trim()) this.check(name);
      });
      // Once a message is showing, clear it the moment the problem is fixed.
      input.addEventListener('input', (event) => {
        if (name === 'phone' && filledInOneGo(event)) this.adoptCountry();
        if (this.shown.has(name)) this.check(name);
        if ((name === 'email' || name === 'phone') && this.shown.has('reply')) this.checkReply();
      });
    }
    this.country.addEventListener('change', () => {
      this.showCountry();
      if (this.shown.has('phone')) this.check('phone');
    });

    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.submit();
    });

    // On a touch screen, once the keyboard has settled, bring the focused field into view inside the sheet.
    this.form.addEventListener('focusin', (event) => {
      if (!this.viewport) return;
      window.clearTimeout(this.revealTimer);
      const target = event.target as HTMLElement;
      this.revealTimer = window.setTimeout(() => this.reveal(target), SETTLE_MS);
    });

    // The sheet hangs from the button; keep it there if the window changes while it is open.
    window.addEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    if (this.dialog.open) this.anchor();
  };

  destroy(): void {
    this.cancelSubmission();
    this.unfollowViewport();
    window.removeEventListener('resize', this.onResize);
    window.clearTimeout(this.closing);
    this.dialog.remove();
  }

  /**
   * Touch screens: the iPhone keyboard shrinks the visual viewport and leaves the layout viewport (which a fixed
   * sheet hangs from) where it was, so the bottom of the form would sit under the keyboard. While the sheet is
   * open it is placed and sized from window.visualViewport instead (site.css, .is-vv). Without it, or zoomed in,
   * the usual layout stays.
   */
  private followViewport(): void {
    const viewport = window.visualViewport;
    if (this.viewport || !viewport || !isTouch()) return;
    this.viewport = viewport;
    viewport.addEventListener('resize', this.onViewport);
    viewport.addEventListener('scroll', this.onViewport);
    this.fitViewport();
  }

  private unfollowViewport(): void {
    window.clearTimeout(this.revealTimer);
    if (this.fitFrame) cancelAnimationFrame(this.fitFrame);
    this.fitFrame = 0;
    if (!this.viewport) return;
    this.viewport.removeEventListener('resize', this.onViewport);
    this.viewport.removeEventListener('scroll', this.onViewport);
    this.viewport = null;
  }

  private onViewport = (): void => {
    if (this.fitFrame) return;
    this.fitFrame = requestAnimationFrame(() => {
      this.fitFrame = 0;
      this.fitViewport();
    });
  };

  private fitViewport(): void {
    const viewport = this.viewport;
    if (!viewport || !this.dialog.open) return;
    // Pinch-zoomed: the visitor is looking closer on purpose; the sheet stays where the layout puts it.
    const on = Math.abs(viewport.scale - 1) < 0.01;
    this.dialog.classList.toggle('is-vv', on);
    if (!on) return;
    this.dialog.style.setProperty('--vv-top', `${Math.round(viewport.offsetTop)}px`);
    this.dialog.style.setProperty('--vv-height', `${Math.round(viewport.height)}px`);
    // A button now under the keyboard can no longer have the sheet hang from it (anchor() sees the visible area).
    this.anchor();
  }

  /** The focused field (with its label and error, if they fit) scrolled into view inside the sheet: block 'nearest'. */
  private reveal(target: HTMLElement): void {
    if (!this.dialog.open || document.activeElement !== target || !this.body.contains(target)) return;
    const view = this.body.getBoundingClientRect();
    const group = target.closest<HTMLElement>('.hj-sub, .hj-field');
    const whole = group?.getBoundingClientRect();
    const box = whole && whole.bottom - whole.top <= view.bottom - view.top - 16 ? whole : target.getBoundingClientRect();
    const margin = 8;
    if (box.top < view.top + margin) this.body.scrollTop -= view.top + margin - box.top;
    else if (box.bottom > view.bottom - margin) this.body.scrollTop += box.bottom - (view.bottom - margin);
  }

  /**
   * Lay the sheet out once, unseen, before the scene appears. The first layout of the form (its fonts,
   * fields and chips) is the one slow step of opening it; done ahead of time, the tap is answered at once.
   */
  prepare(): void {
    if (this.dialog.open || this.prepared) return;
    this.prepared = true;
    this.dialog.classList.add('is-preparing');
    void this.dialog.offsetHeight;
    this.dialog.classList.remove('is-preparing');
  }

  /** Opens the sheet from the button. `instant` skips the entrance (keyboard-initiated opens). */
  open(instant = false): void {
    window.clearTimeout(this.closing);
    this.closing = 0;
    // The phone checks and the country list arrive with the first opening, never with a scene.
    void this.loadPhone().catch(() => {});
    // Measure where the button is before anything is changed, so the measurement forces no restyle.
    if (!this.dialog.open) this.anchor();
    this.dialog.classList.toggle('is-instant', instant);
    if (this.dialog.open) {
      // Reopened while closing: carry on from wherever the exit had got to.
      this.dialog.classList.add('is-open');
      this.followViewport();
      return;
    }
    this.dialog.showModal();
    this.followViewport();
    this.body.scrollTop = 0;
    if (instant) this.dialog.classList.add('is-open');
    // Next frame, so the entrance transition has a starting state to move from.
    else requestAnimationFrame(() => {
      if (this.dialog.open && !this.closing) this.dialog.classList.add('is-open');
    });

    if (!this.sent.hidden) return;
    // With a mouse or keyboard, start typing straight away. On touch, focusing a field would raise the
    // keyboard over the form before it has been seen, so focus rests on the title instead.
    (isTouch() ? this.title : this.field('name')).focus({ preventScroll: true });
  }

  close(instant = false): void {
    if (!this.dialog.open) return;
    this.cancelSubmission();
    this.unfollowViewport();
    window.clearTimeout(this.closing);
    this.dialog.classList.toggle('is-instant', instant);
    this.dialog.classList.remove('is-open');
    const finish = (): void => {
      this.closing = 0;
      this.dialog.close();
      this.dialog.classList.remove('is-vv');
      // A sent message is done: the next opening starts with an empty form.
      if (!this.sent.hidden) this.reset();
    };
    if (instant) finish();
    else this.closing = window.setTimeout(finish, EXIT_MS);
  }

  /** The sheet opens upward from the button, its left edge on the button's. */
  private anchor(): void {
    const anchor = this.trigger.getBoundingClientRect();
    const width = Math.min(420, window.innerWidth - 24);
    const left = Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12));
    // The part of the page in sight: all of it, or (touch screens, keyboard up) the visual viewport.
    const following = this.viewport && this.dialog.classList.contains('is-vv') ? this.viewport : null;
    const top = following ? following.offsetTop : 0;
    const bottom = following ? following.offsetTop + following.height : window.innerHeight;
    // Too little room above the button for the whole form, or the button out of sight; the sheet then sits in
    // the middle (site.css).
    this.dialog.classList.toggle('is-centred', anchor.top - top - 26 < SHEET_ROOM || anchor.top > bottom);
    this.dialog.style.setProperty('--anchor-left', `${Math.round(left)}px`);
    this.dialog.style.setProperty('--anchor-bottom', `${Math.round(window.innerHeight - anchor.top + 10)}px`);
  }

  private field(name: FieldName): HTMLInputElement | HTMLTextAreaElement {
    return this.form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  }

  /** libphonenumber-js and the country list, loaded once. A failed load is tried again next time. */
  private loadPhone(): Promise<Phone> {
    this.loading ??= import('./phone').then(
      (phone) => {
        this.phone = phone;
        this.fillCountries(phone);
        return phone;
      },
      (error: unknown) => {
        this.loading = null;
        throw error;
      },
    );
    return this.loading;
  }

  private fillCountries(phone: Phone): void {
    const picked = this.countryCode();
    this.country.innerHTML = phone
      .countryOptions()
      .map(({ code, name, dial }) => `<option value="${code}"${code === SINGAPORE.code ? ' selected' : ''}>${escapeHtml(name)} +${dial}</option>`)
      .join('');
    this.country.value = picked;
    this.showCountry();
  }

  /** The picked country's ISO code. Never empty: Singapore until the visitor picks another. */
  private countryCode(): string {
    return this.country.value || SINGAPORE.code;
  }

  /** The closed select shows the compact "SG +65"; its list has the full names. */
  private showCountry(): void {
    const code = this.countryCode();
    const dial = this.phone ? this.phone.dialCode(code) : SINGAPORE.dial;
    this.dialog.querySelector<HTMLElement>('.hj-country-code')!.textContent = `${code} +${dial}`;
  }

  /** "+44 7911 123456" (or "0044 ...") in the phone box: pick United Kingdom and keep "7911 123456". */
  private adoptCountry(): void {
    if (!this.phone) return;
    const input = this.field('phone');
    const found = this.phone.splitInternational(input.value, this.countryCode());
    if (!found) return;
    this.country.value = found.country;
    input.value = found.national;
    this.showCountry();
  }

  private showError(name: ErrorName, message: string): void {
    const error = this.dialog.querySelector<HTMLElement>(`#hj-${name}-err`)!;
    error.textContent = message;
    error.hidden = !message;
    if (message) this.shown.add(name);
    else this.shown.delete(name);
  }

  /** Red edges: a field's own problem, or, for email and phone, the group's (neither filled in). */
  private markInvalid(name: FieldName): void {
    const invalid = this.shown.has(name) || ((name === 'email' || name === 'phone') && this.shown.has('reply'));
    this.field(name).setAttribute('aria-invalid', invalid ? 'true' : 'false');
  }

  private rule(name: FieldName, value: string): string {
    if (name !== 'phone') return RULES[name](value);
    // Without the library nothing can be said yet; submit() waits for it before checking.
    if (!value || !this.phone) return '';
    const country = this.phone.phoneProblem(value, this.countryCode());
    return country === null ? '' : wrongNumber(country);
  }

  /** Validates one field and shows or clears its message. Returns true when the field is fine. */
  private check(name: FieldName): boolean {
    const input = this.field(name);
    const max = TYPED_LIMITS[name];
    const message = input.value.length > max ? `Use ${max} characters or fewer.` : this.rule(name, input.value.trim());
    this.showError(name, message);
    this.markInvalid(name);
    return !message;
  }

  /** At least one way to reply. Returns true when there is one. */
  private checkReply(): boolean {
    const none = !this.field('email').value.trim() && !this.field('phone').value.trim();
    this.showError('reply', none ? NO_REPLY : '');
    for (const name of ['email', 'phone'] as const) {
      this.markInvalid(name);
      this.describeReply(name, none);
    }
    return !none;
  }

  /** While the group's line shows, Email and Phone are described by it too (before their own line). */
  private describeReply(name: 'email' | 'phone', shown: boolean): void {
    this.field(name).setAttribute('aria-describedby', shown ? `hj-reply-err hj-${name}-err` : `hj-${name}-err`);
  }

  private async submit(): Promise<void> {
    if (this.sending || this.checking || !canSend || !this.dialog.open || this.closing) return;
    let phone = this.phone;
    if (!phone && this.field('phone').value.trim()) {
      // Only if Send comes before the library has arrived (it is asked for as the form opens).
      this.checking = true;
      try {
        phone = await this.loadPhone();
      } catch {
        phone = null;
      } finally {
        this.checking = false;
      }
      if (!this.dialog.open || this.closing) return;
      if (!phone) {
        // The phone checks could not be loaded (no connection): nothing was sent, everything is still there.
        this.alert.textContent = COPY.failed;
        this.alert.hidden = false;
        return;
      }
    }
    this.adoptCountry();
    const fine = { name: this.check('name'), reply: this.checkReply(), email: this.check('email'), phone: this.check('phone'), message: this.check('message') };
    // A filled-in field that is wrong stops the send, even when the other way to reply is fine.
    const first = !fine.name ? 'name' : !fine.reply || !fine.email ? 'email' : !fine.phone ? 'phone' : !fine.message ? 'message' : null;
    if (first) {
      this.field(first).focus();
      return;
    }
    const data = new FormData(this.form);
    const email = String(data.get('email') ?? '').trim();
    const typedPhone = String(data.get('phone') ?? '').trim();
    const e164 = typedPhone && phone ? phone.toE164(typedPhone, this.countryCode()) : null;
    const payload: ContactPayload = {
      name: String(data.get('name') ?? '').trim(),
      ...(email ? { email } : {}),
      ...(e164 ? { phone: e164 } : {}),
      needs: data.getAll('need').map(String),
      message: String(data.get('message') ?? '').trim(),
      extra: String(data.get('extra') ?? ''),
    };

    if (needsLength(payload.needs) > CONTACT_LIMITS.needs) {
      this.alert.textContent = `Use ${CONTACT_LIMITS.needs} characters or fewer for your selections.`;
      this.alert.hidden = false;
      return;
    }

    this.alert.hidden = true;
    const id = ++this.submission;
    const request = new AbortController();
    this.pending = request;
    this.setSending(true);
    this.status.textContent = COPY.sendingStatus;
    try {
      const result = await submitContact(payload, request.signal);
      if (id !== this.submission || !this.dialog.open) return;
      this.showSent(payload, result === 'test');
    } catch (error) {
      if (id !== this.submission || !this.dialog.open) return;
      // The alert (role="alert") says why; the status line falls quiet. Every field keeps what was written.
      this.status.textContent = '';
      this.alert.textContent = failureMessage(error);
      this.alert.hidden = false;
      // Focus never left the Send button, so "try again" is one key press away.
    } finally {
      if (id === this.submission) {
        this.pending = null;
        this.setSending(false);
      }
    }
  }

  private cancelSubmission(): void {
    this.submission++;
    this.pending?.abort();
    this.pending = null;
    if (this.sending) {
      this.setSending(false);
      this.status.textContent = '';
    }
  }

  private setSending(sending: boolean): void {
    this.sending = sending;
    // aria-disabled, not disabled: a disabled button would drop keyboard focus mid-send.
    if (sending) this.send.setAttribute('aria-disabled', 'true');
    else this.send.removeAttribute('aria-disabled');
    this.send.classList.toggle('is-sending', sending);
    this.send.querySelector('.hj-send-label')!.textContent = sending ? COPY.sending : COPY.send;
  }

  private showSent({ email, phone }: ContactPayload, testMode: boolean): void {
    this.form.hidden = true;
    this.sent.hidden = false;
    // Only the confirmation now: the question goes, and the confirmation names the dialog.
    this.title.hidden = true;
    this.dialog.setAttribute('aria-labelledby', 'hj-sent-title');
    this.status.textContent = testMode ? COPY.testStatus : COPY.sentStatus;
    this.sent.querySelector<HTMLElement>('.hj-sent-line')!.textContent = email
      ? `I'll reply to ${email}.`
      : `I'll get back to you on ${this.phone && phone ? this.phone.formatInternational(phone) : phone}.`;
    this.sent.querySelector<HTMLElement>('.hj-dev-note')!.hidden = !testMode;
    this.body.scrollTop = 0;
    this.sent.querySelector<HTMLElement>('h3')!.focus({ preventScroll: true });
  }

  private reset(): void {
    this.form.reset();
    this.form.hidden = false;
    this.sent.hidden = true;
    this.alert.hidden = true;
    this.title.hidden = false;
    this.dialog.setAttribute('aria-labelledby', 'hj-form-title');
    this.status.textContent = '';
    for (const name of [...this.shown]) this.showError(name, '');
    for (const name of FIELDS) this.field(name).removeAttribute('aria-invalid');
    this.describeReply('email', false);
    this.describeReply('phone', false);
    // form.reset() picked Singapore again (its option is the default); the face follows.
    this.showCountry();
  }
}

// The prize for finding all fifty: a contact form that opens from the caption-turned-button.
// Its words: reviews/copy-round-1-build.md, section 4. (The choices are in needs.js, shared with the server.)
import { MUSHROOM_ICON } from './caption';
import { NEEDS } from './needs.js';
import { CONTACT_LIMITS, SendError, canSend, needsLength, submitContact, type ContactPayload } from './submit';

const CLOSE_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 3.5l9 9m0-9l-9 9"/></svg>`;
const TICK_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.6 8.4l2.9 2.9 5.9-6.2"/></svg>`;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type FieldName = 'name' | 'email' | 'message';

const RULES: Record<FieldName, (value: string) => string> = {
  name: (value) => (value ? '' : 'What should I call you?'),
  email: (value) =>
    !value ? 'I need an email to reply to.' : EMAIL.test(value) ? '' : 'That email looks a bit off. Typo?',
  message: (value) => (value ? '' : 'A few words, so I know where to start.'),
};

const COPY = {
  send: 'Send it',
  sending: 'Sending',
  notConnected: 'This form is not switched on yet, so messages cannot be sent from here for now.',
  notSent: 'This form is not switched on yet, so your message has not been sent.',
  failed: "That didn't go through. Check your connection and try again?",
};

const EXIT_MS = 240;

export class ContactForm {
  private readonly dialog: HTMLDialogElement;
  private readonly body: HTMLElement;
  private readonly form: HTMLFormElement;
  private readonly sent: HTMLElement;
  private readonly alert: HTMLElement;
  private readonly send: HTMLButtonElement;
  private readonly trigger: HTMLElement;
  private readonly shown = new Set<FieldName>();
  private closing = 0;
  private sending = false;
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
              <input id="hj-name" name="name" type="text" autocomplete="name" autocapitalize="words" maxlength="${CONTACT_LIMITS.name}" required aria-describedby="hj-name-err" />
              <p class="hj-err" id="hj-name-err" aria-live="polite" hidden></p>
            </div>
            <div class="hj-field">
              <label for="hj-email">Where should I reply?</label>
              <input id="hj-email" name="email" type="email" autocomplete="email" inputmode="email" spellcheck="false" maxlength="${CONTACT_LIMITS.email}" required aria-describedby="hj-email-err" />
              <p class="hj-err" id="hj-email-err" aria-live="polite" hidden></p>
            </div>
            <fieldset class="hj-field hj-needs">
              <legend>What can I help with? <span class="hj-hint">Pick any</span></legend>
              <div class="hj-chips">
                ${NEEDS.map((need) => `<label class="hj-chip"><input type="checkbox" name="need" value="${need}" /><span>${TICK_ICON}${need}</span></label>`).join('')}
              </div>
            </fieldset>
            <div class="hj-field">
              <label for="hj-message">Tell me about it</label>
              <textarea id="hj-message" name="message" rows="4" placeholder="The space, the timeline, the feeling you're after. Rough is fine." maxlength="${CONTACT_LIMITS.message}" required aria-describedby="hj-message-err"></textarea>
              <p class="hj-err" id="hj-message-err" aria-live="polite" hidden></p>
            </div>
            <div class="hj-trap" aria-hidden="true">
              <label for="hj-website">Website</label>
              <input id="hj-website" name="website" type="text" tabindex="-1" autocomplete="off" data-1p-ignore data-lpignore="true" data-bwignore />
            </div>
            <p class="hj-alert hj-failure" role="alert" hidden></p>
            <button type="submit" class="hj-send"><span class="hj-send-label">${COPY.send}</span></button>
          </form>
          <div class="hj-sent" hidden>
            <span class="hj-sent-mark">${MUSHROOM_ICON}<span class="hj-sent-tick">${TICK_ICON}</span></span>
            <h3 tabindex="-1">Got it, thank you.</h3>
            <p class="hj-sent-line" role="status"></p>
            <p class="hj-dev-note" hidden>Test mode: nothing was sent. The message is in the browser console.</p>
            <button type="button" class="hj-send hj-done"><span class="hj-send-label">Back to the scenes</span></button>
          </div>
        </div>
      </div>
    `;
    host.append(this.dialog);

    const q = <T extends HTMLElement>(selector: string): T => this.dialog.querySelector<T>(selector)!;
    this.body = q('.hj-sheet-body');
    this.form = q<HTMLFormElement>('.hj-form');
    this.sent = q('.hj-sent');
    this.alert = q('.hj-failure');
    this.send = q<HTMLButtonElement>('.hj-form .hj-send');

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

    for (const name of Object.keys(RULES) as FieldName[]) {
      const input = this.field(name);
      input.addEventListener('blur', () => {
        if (input.value.trim()) this.check(name);
      });
      // Once a message is showing, clear it the moment the problem is fixed.
      input.addEventListener('input', () => {
        if (this.shown.has(name)) this.check(name);
      });
    }

    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.submit();
    });

    // The sheet hangs from the button; keep it there if the window changes while it is open.
    window.addEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    if (this.dialog.open) this.anchor();
  };

  destroy(): void {
    this.cancelSubmission();
    window.removeEventListener('resize', this.onResize);
    window.clearTimeout(this.closing);
    this.dialog.remove();
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
    // Measure where the button is before anything is changed, so the measurement forces no restyle.
    if (!this.dialog.open) this.anchor();
    this.dialog.classList.toggle('is-instant', instant);
    if (this.dialog.open) {
      // Reopened while closing: carry on from wherever the exit had got to.
      this.dialog.classList.add('is-open');
      return;
    }
    this.dialog.showModal();
    this.body.scrollTop = 0;
    if (instant) this.dialog.classList.add('is-open');
    // Next frame, so the entrance transition has a starting state to move from.
    else requestAnimationFrame(() => {
      if (this.dialog.open && !this.closing) this.dialog.classList.add('is-open');
    });

    if (!this.sent.hidden) return;
    // With a mouse or keyboard, start typing straight away. On touch, focusing a field would raise the
    // keyboard over the form before it has been seen, so focus rests on the title instead.
    const touch = window.matchMedia?.('(hover: none) and (pointer: coarse)').matches ?? false;
    (touch ? this.dialog.querySelector<HTMLElement>('#hj-form-title')! : this.field('name')).focus({ preventScroll: true });
  }

  close(instant = false): void {
    if (!this.dialog.open) return;
    this.cancelSubmission();
    window.clearTimeout(this.closing);
    this.dialog.classList.toggle('is-instant', instant);
    this.dialog.classList.remove('is-open');
    const finish = (): void => {
      this.closing = 0;
      this.dialog.close();
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
    // A short window leaves too little room above the button; the sheet then sits in the middle (scene.css).
    this.dialog.classList.toggle('is-centred', anchor.top - 26 < 480 || anchor.top > window.innerHeight);
    this.dialog.style.setProperty('--anchor-left', `${Math.round(left)}px`);
    this.dialog.style.setProperty('--anchor-bottom', `${Math.round(window.innerHeight - anchor.top + 10)}px`);
  }

  private field(name: FieldName): HTMLInputElement | HTMLTextAreaElement {
    return this.form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  }

  /** Validates one field and shows or clears its message. Returns true when the field is fine. */
  private check(name: FieldName): boolean {
    const input = this.field(name);
    const max = CONTACT_LIMITS[name];
    const message = input.value.length > max ? `Use ${max} characters or fewer.` : RULES[name](input.value.trim());
    const error = this.dialog.querySelector<HTMLElement>(`#hj-${name}-err`)!;
    error.textContent = message;
    error.hidden = !message;
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (message) this.shown.add(name);
    else this.shown.delete(name);
    return !message;
  }

  private async submit(): Promise<void> {
    if (this.sending || !canSend || !this.dialog.open || this.closing) return;
    const names = Object.keys(RULES) as FieldName[];
    const invalid = names.filter((name) => !this.check(name));
    if (invalid.length) {
      this.field(invalid[0]).focus();
      return;
    }
    const data = new FormData(this.form);
    const payload: ContactPayload = {
      name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      needs: data.getAll('need').map(String),
      message: String(data.get('message') ?? '').trim(),
      website: String(data.get('website') ?? ''),
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
    try {
      const result = await submitContact(payload, request.signal);
      if (id !== this.submission || !this.dialog.open) return;
      this.showSent(payload.email, result === 'test');
    } catch (error) {
      if (id !== this.submission || !this.dialog.open) return;
      this.alert.textContent = error instanceof SendError && error.reason === 'not-connected' ? COPY.notSent : COPY.failed;
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
    if (this.sending) this.setSending(false);
  }

  private setSending(sending: boolean): void {
    this.sending = sending;
    // aria-disabled, not disabled: a disabled button would drop keyboard focus mid-send.
    if (sending) this.send.setAttribute('aria-disabled', 'true');
    else this.send.removeAttribute('aria-disabled');
    this.send.classList.toggle('is-sending', sending);
    this.send.querySelector('.hj-send-label')!.textContent = sending ? COPY.sending : COPY.send;
  }

  private showSent(email: string, testMode: boolean): void {
    this.form.hidden = true;
    this.sent.hidden = false;
    this.sent.querySelector<HTMLElement>('.hj-sent-line')!.textContent = `I'll reply to ${email}.`;
    this.sent.querySelector<HTMLElement>('.hj-dev-note')!.hidden = !testMode;
    this.body.scrollTop = 0;
    this.sent.querySelector<HTMLElement>('h3')!.focus({ preventScroll: true });
  }

  private reset(): void {
    this.form.reset();
    this.form.hidden = false;
    this.sent.hidden = true;
    this.alert.hidden = true;
    for (const name of [...this.shown]) {
      this.shown.delete(name);
      const error = this.dialog.querySelector<HTMLElement>(`#hj-${name}-err`)!;
      error.hidden = true;
      this.field(name).removeAttribute('aria-invalid');
    }
  }
}

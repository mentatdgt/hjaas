// The prize for finding all ten: a contact form that opens from the counter-turned-button.
import { SendError, submitContact, type ContactPayload } from './submit';

const NEEDS = ['Build', 'Design', 'Film', 'Grow', 'Travel', 'Something else'] as const;

const CLOSE_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 3.5l9 9m0-9l-9 9"/></svg>`;
const SENT_ICON = `
<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <circle class="hj-sent-ring" cx="24" cy="24" r="21"/>
  <path class="hj-sent-tick" d="M15 24.5l6.2 6.2L33.5 18"/>
</svg>`;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type FieldName = 'name' | 'email' | 'message';

const RULES: Record<FieldName, (value: string) => string> = {
  name: (value) => (value ? '' : 'Add your name.'),
  email: (value) =>
    !value ? 'Add your email so Hui Jie can reply.' : EMAIL.test(value) ? '' : 'That email looks incomplete. Check it for typos.',
  message: (value) => (value ? '' : 'Write a few words about what you need.'),
};

const EXIT_MS = 240;

export class ContactForm {
  private readonly dialog: HTMLDialogElement;
  private readonly sheet: HTMLElement;
  private readonly form: HTMLFormElement;
  private readonly sent: HTMLElement;
  private readonly alert: HTMLElement;
  private readonly send: HTMLButtonElement;
  private readonly trigger: HTMLElement;
  private readonly shown = new Set<FieldName>();
  private closing = 0;

  constructor(host: HTMLElement, trigger: HTMLElement) {
    this.trigger = trigger;
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'hj-dialog';
    this.dialog.setAttribute('aria-labelledby', 'hj-form-title');
    this.dialog.innerHTML = `
      <div class="hj-sheet">
        <header class="hj-sheet-head">
          <h2 id="hj-form-title">Contact Hui Jie</h2>
          <button type="button" class="hj-close" aria-label="Close">${CLOSE_ICON}</button>
        </header>
        <form class="hj-form" novalidate>
          <div class="hj-field">
            <label for="hj-name">Your name</label>
            <input id="hj-name" name="name" type="text" autocomplete="name" autocapitalize="words" required aria-describedby="hj-name-err" />
            <p class="hj-err" id="hj-name-err" hidden></p>
          </div>
          <div class="hj-field">
            <label for="hj-email">Email</label>
            <input id="hj-email" name="email" type="email" autocomplete="email" inputmode="email" spellcheck="false" required aria-describedby="hj-email-err" />
            <p class="hj-err" id="hj-email-err" hidden></p>
          </div>
          <fieldset class="hj-field hj-needs">
            <legend>What do you need?</legend>
            <div class="hj-chips">
              ${NEEDS.map((need) => `<label class="hj-chip"><input type="checkbox" name="need" value="${need}" /><span>${need}</span></label>`).join('')}
            </div>
          </fieldset>
          <div class="hj-field">
            <label for="hj-message">Message</label>
            <textarea id="hj-message" name="message" rows="4" required aria-describedby="hj-message-err"></textarea>
            <p class="hj-err" id="hj-message-err" hidden></p>
          </div>
          <p class="hj-alert" role="alert" hidden></p>
          <button type="submit" class="hj-send"><span class="hj-send-label">Send to Hui Jie</span></button>
        </form>
        <div class="hj-sent" hidden tabindex="-1">
          ${SENT_ICON}
          <h3>Message sent</h3>
          <p>Hui Jie will reply by email.</p>
          <p class="hj-dev-note" hidden>Test mode: nothing was sent. The message is in the browser console.</p>
          <button type="button" class="hj-send hj-done"><span class="hj-send-label">Back to the room</span></button>
        </div>
      </div>
    `;
    host.append(this.dialog);

    const q = <T extends HTMLElement>(selector: string): T => this.dialog.querySelector<T>(selector)!;
    this.sheet = q('.hj-sheet');
    this.form = q<HTMLFormElement>('.hj-form');
    this.sent = q('.hj-sent');
    this.alert = q('.hj-alert');
    this.send = q<HTMLButtonElement>('.hj-form .hj-send');

    q('.hj-close').addEventListener('click', () => this.close());
    q('.hj-done').addEventListener('click', () => this.close());
    // Escape closes with the same exit as the close button.
    this.dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.close();
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
  }

  open(): void {
    if (this.dialog.open) return;
    window.clearTimeout(this.closing);
    // The sheet opens from the button: anchor it to the button's corner.
    const anchor = this.trigger.getBoundingClientRect();
    this.dialog.style.setProperty('--anchor-top', `${Math.round(anchor.bottom + 10)}px`);
    this.dialog.style.setProperty('--anchor-right', `${Math.round(Math.max(12, window.innerWidth - anchor.right))}px`);
    this.dialog.showModal();
    // Next frame, so the entrance transition has a starting state to move from.
    requestAnimationFrame(() => this.dialog.classList.add('is-open'));
    if (this.sent.hidden) this.field('name').focus({ preventScroll: true });
  }

  close(): void {
    if (!this.dialog.open) return;
    this.dialog.classList.remove('is-open');
    this.closing = window.setTimeout(() => {
      this.dialog.close();
      // A sent message is done: the next opening starts with an empty form.
      if (!this.sent.hidden) this.reset();
    }, EXIT_MS);
  }

  private field(name: FieldName): HTMLInputElement | HTMLTextAreaElement {
    return this.form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  }

  /** Validates one field and shows or clears its message. Returns true when the field is fine. */
  private check(name: FieldName): boolean {
    const input = this.field(name);
    const message = RULES[name](input.value.trim());
    const error = this.dialog.querySelector<HTMLElement>(`#hj-${name}-err`)!;
    error.textContent = message;
    error.hidden = !message;
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (message) this.shown.add(name);
    else this.shown.delete(name);
    return !message;
  }

  private async submit(): Promise<void> {
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
    };

    this.alert.hidden = true;
    this.setSending(true);
    try {
      const result = await submitContact(payload);
      this.showSent(result === 'test');
    } catch (error) {
      this.alert.textContent =
        error instanceof SendError && error.reason === 'not-connected'
          ? 'This form is not switched on yet, so your message has not been sent.'
          : 'Your message could not be sent. Check your connection and try again.';
      this.alert.hidden = false;
    } finally {
      this.setSending(false);
    }
  }

  private setSending(sending: boolean): void {
    this.send.disabled = sending;
    this.send.classList.toggle('is-sending', sending);
    this.send.querySelector('.hj-send-label')!.textContent = sending ? 'Sending' : 'Send to Hui Jie';
  }

  private showSent(testMode: boolean): void {
    // Hold the sheet's height so swapping the form for the confirmation does not make it jump.
    this.sheet.style.minHeight = `${this.sheet.offsetHeight}px`;
    this.form.hidden = true;
    this.sent.hidden = false;
    this.sent.querySelector<HTMLElement>('.hj-dev-note')!.hidden = !testMode;
    this.sent.focus({ preventScroll: true });
  }

  private reset(): void {
    this.form.reset();
    this.form.hidden = false;
    this.sent.hidden = true;
    this.alert.hidden = true;
    this.sheet.style.minHeight = '';
    for (const name of [...this.shown]) {
      this.shown.delete(name);
      const error = this.dialog.querySelector<HTMLElement>(`#hj-${name}-err`)!;
      error.hidden = true;
      this.field(name).removeAttribute('aria-invalid');
    }
  }
}

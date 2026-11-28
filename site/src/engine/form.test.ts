import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ContactForm } from './form';
import { NEEDS } from './needs.js';
import { SendError, submitContact } from './submit';

vi.mock('./submit', async (original) => ({
  ...await original<typeof import('./submit')>(),
  canSend: true,
  submitContact: vi.fn(),
}));

class Element extends EventTarget {
  readonly attrs = new Map<string, string>();
  readonly nodes = new Map<string, Element>();
  readonly props = new Map<string, string>();
  readonly style = { setProperty: (name: string, value: string) => this.props.set(name, value) };
  readonly classes = new Set<string>();
  readonly classList = {
    add: (name: string) => this.classes.add(name),
    remove: (name: string) => this.classes.delete(name),
    toggle: (name: string, on = !this.classes.has(name)) => (on ? this.classes.add(name) : this.classes.delete(name), on),
    contains: (name: string) => this.classes.has(name),
  };
  readonly getBoundingClientRect = vi.fn(() => ({ left: 20, top: 650, bottom: 690 }));
  readonly elements = { namedItem: (name: string): Element => this.querySelector(name) };
  innerHTML = '';
  textContent = '';
  value = '';
  hidden = false;
  open = false;
  scrollTop = 0;
  group: Element | null = null;
  querySelector(selector: string): Element {
    if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
    return this.nodes.get(selector)!;
  }
  closest() { return this.group; }
  reset() { for (const node of this.nodes.values()) node.value = ''; }
  contains() { return true; }
  setAttribute(name: string, value: string) { this.attrs.set(name, value); }
  removeAttribute(name: string) { this.attrs.delete(name); }
  showModal() { this.open = true; }
  close() { this.open = false; }
  append() {}
  remove() {}
  focus() { focused = this; }
}
let focused: Element | null = null;

/** A phone's visual viewport: resize and scroll events, and the size of the part in sight. */
class Viewport extends EventTarget {
  height = 664;
  offsetTop = 0;
  scale = 1;
  readonly added: string[] = [];
  readonly removed: string[] = [];
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null) { this.added.push(type); super.addEventListener(type, listener); }
  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null) { this.removed.push(type); super.removeEventListener(type, listener); }
}

function setup({ touch = false, viewport = undefined as Viewport | undefined } = {}) {
  const dialog = new Element();
  const trigger = new Element();
  const window = Object.assign(new EventTarget(), {
    clearTimeout, setTimeout, innerWidth: 800, innerHeight: 750, visualViewport: viewport,
    matchMedia: () => ({ matches: touch }),
  });
  vi.stubGlobal('requestAnimationFrame', (run: () => void) => setTimeout(run, 0));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  const node = dialog.querySelector('.hj-form');
  const sent = dialog.querySelector('.hj-sent');
  const send = dialog.querySelector('.hj-form .hj-send');
  const alert = dialog.querySelector('.hj-failure');
  sent.hidden = alert.hidden = true;
  const values = { name: 'Wren', email: 'before@example.org', message: 'Hello' };
  for (const [name, value] of Object.entries(values)) node.querySelector(name).value = value;
  const needs = ['Building or renovating'];
  vi.stubGlobal('window', window);
  vi.stubGlobal('document', { createElement: () => dialog, get activeElement() { return focused; } });
  vi.stubGlobal('FormData', class {
    get(name: string) { return node.querySelector(name).value; }
    getAll() { return needs; }
  });
  const form = new ContactForm(new Element() as unknown as HTMLElement, trigger as unknown as HTMLElement);
  form.open(true);
  const sendForm = () => node.dispatchEvent(new Event('submit', { cancelable: true }));
  const country = node.querySelector('country');
  // The phone module is loaded as the form opens; the full country list is the sign it has arrived.
  const phoneReady = () => vi.waitFor(() => expect(country.innerHTML).toContain('United Kingdom +44'));
  const status = dialog.querySelector('#hj-status');
  const title = dialog.querySelector('#hj-form-title');
  return { form, dialog, node, sent, send, sendForm, alert, needs, trigger, window, country, phoneReady, status, title };
}

beforeEach(() => vi.mocked(submitContact).mockReset());
afterEach(() => vi.unstubAllGlobals());

it('shows length constraints and rejects oversized values in the form', () => {
  const { dialog, node, needs, alert, sendForm } = setup();
  expect(dialog.innerHTML).toMatch(/name="name"[^>]*maxlength="100"/);
  expect(dialog.innerHTML).toMatch(/name="email"[^>]*maxlength="254"/);
  expect(dialog.innerHTML).toMatch(/name="message"[^>]*maxlength="4000"/);
  node.querySelector('name').value = 'a'.repeat(101);
  sendForm();
  expect(dialog.querySelector('#hj-name-err').hidden).toBe(false);
  node.querySelector('name').value = 'Wren';
  needs.push('x'.repeat(500));
  sendForm();
  expect(alert.textContent).toContain('500 characters');
  expect(submitContact).not.toHaveBeenCalled();
});

it('ignores a closed submission and leaves the newer submission in control', async () => {
  const { form, node, sendForm, sent, send } = setup();
  let resolveOld!: (result: 'sent') => void;
  let resolveNew!: (result: 'sent') => void;
  vi.mocked(submitContact).mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
    .mockReturnValueOnce(new Promise((resolve) => { resolveNew = resolve; }));

  sendForm();
  const firstSignal = vi.mocked(submitContact).mock.calls[0][1];
  form.close(true);
  expect(firstSignal?.aborted).toBe(true);

  node.querySelector('email').value = 'after@example.org';
  form.open(true);
  sendForm();
  resolveOld('sent');
  await Promise.resolve();
  expect(sent.hidden).toBe(true);
  expect(send.attrs.get('aria-disabled')).toBe('true');

  resolveNew('sent');
  await Promise.resolve();
  expect(sent.hidden).toBe(false);
  expect(sent.querySelector('.hj-sent-line').textContent).toBe("I'll reply to after@example.org.");
  expect(send.attrs.has('aria-disabled')).toBe(false);
});

it('ignores a late error after close, and removes its window listener on teardown', async () => {
  const { form, sendForm, alert, trigger, window } = setup();
  let reject!: (error: Error) => void;
  vi.mocked(submitContact).mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
  sendForm();
  form.close(true);
  reject(new Error('late'));
  await Promise.resolve();
  expect(alert.hidden).toBe(true);
  form.open(true);
  trigger.getBoundingClientRect.mockClear();
  window.dispatchEvent(new Event('resize'));
  expect(trigger.getBoundingClientRect).toHaveBeenCalledOnce();
  form.destroy();
  window.dispatchEvent(new Event('resize'));
  expect(trigger.getBoundingClientRect).toHaveBeenCalledOnce();
});

it('hides the honeypot from visitors and autofill, and sends what is in it as "extra"', () => {
  const { dialog, node, sendForm } = setup();
  const [, trap] = dialog.innerHTML.match(/<div class="hj-trap" aria-hidden="true">([\s\S]*?)<\/div>/)!;
  expect(trap).toContain('<label for="hj-extra">Leave this empty</label>');
  const input = trap.match(/<input [^>]*>/)![0];
  expect(input).toMatch(/^<input id="hj-extra" name="extra" type="text" tabindex="-1" autocomplete="off" /);
  // Password managers: 1Password, LastPass, Bitwarden, Dashlane.
  for (const ignore of ['data-1p-ignore', 'data-lpignore="true"', 'data-bwignore', 'data-form-type="other"']) expect(input).toContain(ignore);
  // Nothing autofill would take for a website, a name, an email or a phone.
  expect(trap).not.toMatch(/website|url|name="(?:name|email|tel|phone)"/i);
  vi.mocked(submitContact).mockResolvedValue('sent');
  node.querySelector('extra').value = 'https://spam.example';
  sendForm();
  expect(submitContact).toHaveBeenCalledWith(expect.objectContaining({ extra: 'https://spam.example' }), expect.anything());
  expect(vi.mocked(submitContact).mock.calls[0][0]).not.toHaveProperty('website');
});

it('offers the six choices, in tab order, and says what the brief says', () => {
  const { dialog } = setup();
  const boxes = [...dialog.innerHTML.matchAll(/<input type="checkbox" name="need" value="([^"]*)" \/><span><svg[\s\S]*?<\/svg>([^<]*)<\/span>/g)];
  const labels = ['Building or renovating', 'Mushrooms', 'Designing a space', 'Production for a shoot', 'Designing a set', 'Something else'];
  expect(NEEDS).toEqual(labels);
  expect(boxes.map((box) => box[1])).toEqual(labels);
  expect(boxes.map((box) => box[2])).toEqual(labels);
  for (const words of [
    'tabindex="-1">Hi! What have you got in mind?</h2>', '>Your name</label>', 'placeholder="Timothée Chalamet"',
    '<legend>How should I reply? <span class="hj-hint" id="hj-reply-hint">Email, phone, or both (at least one)</span></legend>',
    '>Email</label>', 'placeholder="timothee@gmail.com"', '>Phone</label>', 'placeholder="9888 1135"', 'aria-label="Country code"',
    '<option value="SG" selected>Singapore +65</option>',
    '<legend>What can I help with? <span class="hj-hint">Optional, pick any</span></legend>', '>Tell me about it</label>',
    'placeholder="The space, the timeline, the feeling you\'re after. Rough is fine."', '>Send it</span>',
    '>Got it, thank you.</h3>', '>Back to the scenes</span>', 'aria-label="Close"',
  ]) expect(dialog.innerHTML).toContain(words);
});

it('marks up email and phone the autofill way, neither of them required', () => {
  const { dialog } = setup();
  const tag = (id: string): string => dialog.innerHTML.match(new RegExp(`<(?:input|select) id="${id}"[^>]*>`))![0];
  // The hint is in the legend, so it is in the group's name. The group's error describes the two fields while it
  // shows (not the fieldset too, and it is no live region), so it is heard once.
  expect(dialog.innerHTML).toContain('<fieldset class="hj-field hj-reply">');
  expect(dialog.innerHTML).toContain('<p class="hj-err" id="hj-reply-err" hidden></p>');
  expect(tag('hj-email')).toMatch(/name="email" type="email" autocomplete="email" inputmode="email" spellcheck="false" autocapitalize="off"/);
  expect(tag('hj-country')).toMatch(/name="country" autocomplete="tel-country-code" aria-label="Country code"/);
  // tel-national belongs to the text group: a text box, with the phone keypad.
  expect(tag('hj-phone')).toMatch(/name="phone" type="text" inputmode="tel" autocomplete="tel-national"/);
  expect(tag('hj-email')).toContain('aria-describedby="hj-email-err"');
  expect(tag('hj-phone')).toContain('aria-describedby="hj-phone-err"');
  for (const id of ['hj-email', 'hj-phone', 'hj-country']) expect(tag(id)).not.toContain('required');
  // Name, email, country, phone, needs, message: the order they are in is the Tab order.
  const order = ['id="hj-name"', 'id="hj-email"', 'id="hj-country"', 'id="hj-phone"', 'name="need"', 'id="hj-message"', 'class="hj-send"'].map((s) => dialog.innerHTML.indexOf(s));
  expect(order).toEqual([...order].sort((a, b) => a - b));
});

it('lists every country A to Z, Singapore first and picked, values ISO codes, never an empty choice', async () => {
  const { country, phoneReady, dialog } = setup();
  await phoneReady();
  const options = [...country.innerHTML.matchAll(/<option value="([^"]*)"( selected)?>([^<]*)<\/option>/g)];
  expect(options.length).toBe(245);
  expect(options[0].slice(1)).toEqual(['SG', ' selected', 'Singapore +65']);
  expect(options.filter((o) => o[2]).length).toBe(1);
  expect(options.every((o) => /^[A-Z]{2}$/.test(o[1]))).toBe(true);
  expect(options.filter((o) => o[1] === 'SG').length).toBe(1);
  const names = options.slice(1).map((o) => o[3].replace(/ \+\d+$/, '').replace(/&amp;/g, '&'));
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  expect(country.innerHTML).toContain('>United Kingdom +44</option>');
  expect(country.innerHTML).toContain('>Bosnia &amp; Herzegovina +387</option>');
  expect(country.value).toBe('SG');
  expect(dialog.querySelector('.hj-country-code').textContent).toBe('SG +65');
});

it('asks for a way to reply when there is neither, and sends nothing', async () => {
  const { dialog, node, sendForm, phoneReady } = setup();
  await phoneReady();
  node.querySelector('email').value = '  ';
  sendForm();
  expect(dialog.querySelector('#hj-reply-err').textContent).toBe('Add an email or a phone number so I can reply.');
  expect(dialog.querySelector('#hj-reply-err').hidden).toBe(false);
  expect(dialog.querySelector('#hj-email-err').hidden).toBe(true);
  expect(dialog.querySelector('#hj-phone-err').hidden).toBe(true);
  expect(node.querySelector('email').attrs.get('aria-invalid')).toBe('true');
  expect(node.querySelector('phone').attrs.get('aria-invalid')).toBe('true');
  // Both are described by the group's line while it shows, so Email, focused, says it.
  expect(node.querySelector('email').attrs.get('aria-describedby')).toBe('hj-reply-err hj-email-err');
  expect(node.querySelector('phone').attrs.get('aria-describedby')).toBe('hj-reply-err hj-phone-err');
  expect(focused).toBe(node.querySelector('email'));
  expect(submitContact).not.toHaveBeenCalled();
  // After a first try, it clears as soon as either is filled in, and the descriptions go back to their own.
  node.querySelector('phone').value = '9';
  node.querySelector('phone').dispatchEvent(new Event('input'));
  expect(dialog.querySelector('#hj-reply-err').hidden).toBe(true);
  expect(node.querySelector('email').attrs.get('aria-describedby')).toBe('hj-email-err');
  expect(node.querySelector('phone').attrs.get('aria-describedby')).toBe('hj-phone-err');
});

it('stops a bad email or a bad number, even when the other one is fine', async () => {
  const { dialog, node, sendForm, phoneReady } = setup();
  await phoneReady();
  const said = (name: string): string | null => (dialog.querySelector(`#hj-${name}-err`).hidden ? null : dialog.querySelector(`#hj-${name}-err`).textContent);
  node.querySelector('email').value = 'wren@example';
  sendForm();
  expect(said('email')).toBe('That email looks a bit off. Typo?');
  expect(focused).toBe(node.querySelector('email'));

  node.querySelector('email').value = 'wren@example.org';
  node.querySelector('phone').value = '1234 5678';
  sendForm();
  expect(said('email')).toBe(null);
  const wrongForSingapore = "That number doesn't look right for Singapore. Check the digits or pick a different country code.";
  expect(said('phone')).toBe(wrongForSingapore);
  expect(node.querySelector('phone').attrs.get('aria-invalid')).toBe('true');
  expect(focused).toBe(node.querySelector('phone'));

  node.querySelector('phone').value = '9888 abcd';
  sendForm();
  expect(said('phone')).toBe(wrongForSingapore);
  // A + code that belongs to no country: no country to name.
  node.querySelector('phone').value = '+999 1234 5678';
  sendForm();
  expect(said('phone')).toBe("That number doesn't look right.");
  expect(submitContact).not.toHaveBeenCalled();

  // Spaces, dashes, dots and brackets are fine; the message clears as it is put right.
  for (const number of ['9888 1135', '9888-1135', '9888.1135', '(9888) 1135']) {
    node.querySelector('phone').value = '1234';
    sendForm();
    expect(said('phone')).not.toBe(null);
    node.querySelector('phone').value = number;
    node.querySelector('phone').dispatchEvent(new Event('input'));
    expect(said('phone')).toBe(null);
  }
});

it('takes a pasted international number: picks its country and keeps the rest as typed', async () => {
  const { dialog, node, country, phoneReady } = setup();
  await phoneReady();
  node.querySelector('phone').value = '+44 7911 123456';
  node.querySelector('phone').dispatchEvent(new Event('input'));
  expect(country.value).toBe('GB');
  expect(node.querySelector('phone').value).toBe('7911 123456');
  expect(dialog.querySelector('.hj-country-code').textContent).toBe('GB +44');
});

it('sends a phone only, in E.164, and says it will get back on it', async () => {
  const { node, sendForm, sent, phoneReady } = setup();
  await phoneReady();
  vi.mocked(submitContact).mockResolvedValue('sent');
  node.querySelector('email').value = '';
  node.querySelector('phone').value = '9888 1135';
  sendForm();
  const [payload] = vi.mocked(submitContact).mock.calls[0];
  expect(payload).toMatchObject({ name: 'Wren', phone: '+6598881135' });
  expect(payload).not.toHaveProperty('email');
  await vi.waitFor(() => expect(sent.hidden).toBe(false));
  expect(sent.querySelector('.hj-sent-line').textContent).toBe("I'll get back to you on +65 9888 1135.");
});

it('sends both when both are there, a pasted foreign number in its own country, and replies to the email', async () => {
  const { node, sendForm, sent, country, phoneReady } = setup();
  await phoneReady();
  vi.mocked(submitContact).mockResolvedValue('sent');
  node.querySelector('phone').value = '+44 7911 123456'; // typed, not pasted: it is sorted out on Send
  sendForm();
  expect(country.value).toBe('GB');
  const [payload] = vi.mocked(submitContact).mock.calls[0];
  expect(payload).toMatchObject({ email: 'before@example.org', phone: '+447911123456' });
  await vi.waitFor(() => expect(sent.hidden).toBe(false));
  expect(sent.querySelector('.hj-sent-line').textContent).toBe("I'll reply to before@example.org.");
});

it('asks for what is missing, and says when a message did not go through', async () => {
  const { dialog, node, alert, sendForm, phoneReady } = setup();
  await phoneReady();
  for (const name of ['name', 'email', 'message']) node.querySelector(name).value = ' ';
  sendForm();
  const said = (name: string): string => dialog.querySelector(`#hj-${name}-err`).textContent;
  expect(said('name')).toBe('What should I call you?');
  expect(said('reply')).toBe('Add an email or a phone number so I can reply.');
  expect(said('message')).toBe('A few words, so I know where to start.');
  expect(focused).toBe(node.querySelector('name'));
  node.querySelector('email').value = 'wren@example';
  sendForm();
  expect(said('email')).toBe('That email looks a bit off. Typo?');
  expect(submitContact).not.toHaveBeenCalled();

  Object.entries({ name: 'Wren', email: 'wren@example.org', message: 'Hello' }).forEach(([name, value]) => (node.querySelector(name).value = value));
  vi.mocked(submitContact).mockRejectedValueOnce(new Error('offline'));
  sendForm();
  await Promise.resolve();
  expect(alert.textContent).toBe(OUTAGE);
});

const OUTAGE = "Couldn't send your message just now. It's all still here, so please try again in a moment.";
const BUSY = 'Too many tries. Please wait a minute and try again.';

it.each<[string, () => unknown, string]>([
  ['no connection, a timeout, a 5xx or an answer without ok: true', () => new SendError('failed'), OUTAGE],
  ['anything unexpected', () => new Error('offline'), OUTAGE],
  ['a 429 with no Retry-After', () => new SendError('busy'), BUSY],
  ['a 429 with the function\'s Retry-After: 60', () => new SendError('busy', 60), BUSY],
  ['a 429 with Retry-After: 30', () => new SendError('busy', 30), 'Too many tries. Please try again in 30 seconds.'],
  ['a 429 with Retry-After: 1', () => new SendError('busy', 1), 'Too many tries. Please try again in 1 second.'],
  ['a 429 with Retry-After: 150', () => new SendError('busy', 150), 'Too many tries. Please try again in 3 minutes.'],
  ['a 429 with Retry-After: 0', () => new SendError('busy', 0), BUSY],
  ['no endpoint in production', () => new SendError('not-connected'), 'This form is not switched on yet, so your message has not been sent.'],
])('after %s: says so, keeps every field filled, and Send works again', async (_, error, words) => {
  const { node, alert, sendForm, send, sent, status, phoneReady } = setup();
  await phoneReady();
  node.querySelector('phone').value = '9888 1135';
  vi.mocked(submitContact).mockRejectedValueOnce(error());
  sendForm();
  expect(status.textContent).toBe('Sending your message…');
  await vi.waitFor(() => expect(alert.hidden).toBe(false));
  expect(alert.textContent).toBe(words);
  expect(sent.hidden).toBe(true);
  expect(status.textContent).toBe('');
  expect(send.attrs.has('aria-disabled')).toBe(false);
  expect(['name', 'email', 'phone', 'message'].map((name) => node.querySelector(name).value)).toEqual(['Wren', 'before@example.org', '9888 1135', 'Hello']);
  expect(node.querySelector('country').value).toBe('SG');
});

it('on a send, says "Sending your message…", then "Message sent."; the question goes and the confirmation takes focus', async () => {
  const { dialog, node, sendForm, sent, status, title, form } = setup();
  let finish!: (result: 'sent') => void;
  vi.mocked(submitContact).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  expect(dialog.innerHTML).toContain('<p class="hj-sr" id="hj-status" role="status"></p>');
  // The sent line is no second live region: the status line is the one that speaks.
  expect(dialog.innerHTML).toContain('<p class="hj-sent-line"></p>');
  expect(dialog.attrs.get('aria-labelledby')).toBe('hj-form-title');
  sendForm();
  expect(status.textContent).toBe('Sending your message…');
  expect(title.hidden).toBe(false);
  finish('sent');
  await vi.waitFor(() => expect(sent.hidden).toBe(false));
  expect(status.textContent).toBe('Message sent.');
  expect(node.hidden).toBe(true);
  expect(title.hidden).toBe(true);
  expect(dialog.innerHTML).toContain('<h3 id="hj-sent-title" tabindex="-1">Got it, thank you.</h3>');
  expect(dialog.attrs.get('aria-labelledby')).toBe('hj-sent-title');
  expect(focused).toBe(sent.querySelector('h3'));
  // Closed, it starts again from the question, quiet.
  form.close(true);
  expect(title.hidden).toBe(false);
  expect(status.textContent).toBe('');
  expect(dialog.attrs.get('aria-labelledby')).toBe('hj-form-title');
});

it('says test mode in the status line when nothing was sent', async () => {
  const { sendForm, sent, status } = setup();
  vi.mocked(submitContact).mockResolvedValueOnce('test');
  sendForm();
  await vi.waitFor(() => expect(sent.hidden).toBe(false));
  expect(status.textContent).toBe('Test mode: nothing was sent.');
});

it('holds email to the server\'s own rule, so "a@b.com." is stopped on the page', async () => {
  const { dialog, node, sendForm, phoneReady } = setup();
  await phoneReady();
  const said = () => (dialog.querySelector('#hj-email-err').hidden ? null : dialog.querySelector('#hj-email-err').textContent);
  for (const email of ['a@b.com.', 'a@b.c', 'wren@example', 'two@one.com,b@c.com', 'Wren <wren@example.org>', 'a"b@c.com', 'wren@exa mple.org']) {
    node.querySelector('email').value = email;
    sendForm();
    expect([email, said()]).toEqual([email, 'That email looks a bit off. Typo?']);
  }
  expect(submitContact).not.toHaveBeenCalled();
  node.querySelector('email').value = 'timothee@gmail.com';
  node.querySelector('email').dispatchEvent(new Event('input'));
  expect(said()).toBe(null);
});

it('without a visual viewport, or not on a touch screen, keeps the usual layout', () => {
  const viewport = new Viewport();
  const { dialog } = setup({ touch: false, viewport });
  expect(viewport.added).toEqual([]);
  expect(dialog.classes.has('is-vv')).toBe(false);
  const { dialog: other } = setup({ touch: true });
  expect(other.classes.has('is-vv')).toBe(false);
});

it('on a touch screen, follows the visual viewport while open (the iPhone keyboard), and lets go on close', async () => {
  const viewport = new Viewport();
  const { form, dialog } = setup({ touch: true, viewport });
  expect(viewport.added.sort()).toEqual(['resize', 'scroll']);
  expect(dialog.classes.has('is-vv')).toBe(true);
  expect(dialog.props.get('--vv-top')).toBe('0px');
  expect(dialog.props.get('--vv-height')).toBe('664px');
  // The keyboard rises: the part in sight shrinks, and Safari scrolls the page a little.
  viewport.height = 368;
  viewport.offsetTop = 120;
  viewport.dispatchEvent(new Event('resize'));
  viewport.dispatchEvent(new Event('scroll'));
  await vi.waitFor(() => expect(dialog.props.get('--vv-height')).toBe('368px'));
  expect(dialog.props.get('--vv-top')).toBe('120px');
  // The button (top 650) is under the keyboard now: the sheet cannot hang from it.
  expect(dialog.classes.has('is-centred')).toBe(true);
  // Pinch-zoomed: back to the usual layout.
  viewport.scale = 2;
  viewport.dispatchEvent(new Event('resize'));
  await vi.waitFor(() => expect(dialog.classes.has('is-vv')).toBe(false));
  form.close(true);
  expect(viewport.removed.sort()).toEqual(['resize', 'scroll']);
  viewport.scale = 1;
  viewport.height = 500;
  viewport.dispatchEvent(new Event('resize'));
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(dialog.props.get('--vv-height')).toBe('368px');
  // Opened again, it follows again.
  form.open(true);
  expect(dialog.props.get('--vv-height')).toBe('500px');
  form.destroy();
  expect(viewport.removed.length).toBe(4);
});

it('on a touch screen, brings a focused field into view inside the sheet once the keyboard has settled', () => {
  vi.useFakeTimers();
  try {
    const viewport = new Viewport();
    const { dialog, node } = setup({ touch: true, viewport });
    const body = dialog.querySelector('.hj-sheet-body');
    body.getBoundingClientRect.mockReturnValue({ left: 0, top: 100, bottom: 400 });
    const message = node.querySelector('message');
    const field = new Element();
    message.group = field;
    field.getBoundingClientRect.mockReturnValue({ left: 0, top: 480, bottom: 590 });
    message.focus();
    // (No bubbling in this stand-in DOM: the form hears the focus with the field as its target.)
    const focusin = new Event('focusin');
    Object.defineProperty(focusin, 'target', { value: message });
    node.dispatchEvent(focusin);
    vi.advanceTimersByTime(299);
    expect(body.scrollTop).toBe(0);
    vi.advanceTimersByTime(1);
    // Nearest: just enough that the field's bottom (with its error line) clears the sheet's bottom by 8 px.
    expect(body.scrollTop).toBe(590 - (400 - 8));
    // Already in view: nothing moves.
    node.dispatchEvent(focusin);
    field.getBoundingClientRect.mockReturnValue({ left: 0, top: 200, bottom: 310 });
    vi.advanceTimersByTime(300);
    expect(body.scrollTop).toBe(198);
    // Above the top: scrolled back up to it.
    field.getBoundingClientRect.mockReturnValue({ left: 0, top: 40, bottom: 150 });
    node.dispatchEvent(focusin);
    vi.advanceTimersByTime(300);
    expect(body.scrollTop).toBe(198 - (108 - 40));
    // A field that no longer has focus when the keyboard settles is left alone.
    field.getBoundingClientRect.mockReturnValue({ left: 0, top: 480, bottom: 590 });
    node.dispatchEvent(focusin);
    node.querySelector('name').focus();
    vi.advanceTimersByTime(300);
    expect(body.scrollTop).toBe(130);
  } finally {
    vi.useRealTimers();
  }
});

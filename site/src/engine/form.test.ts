import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ContactForm } from './form';
import { NEEDS } from './needs.js';
import { submitContact } from './submit';

vi.mock('./submit', async (original) => ({
  ...await original<typeof import('./submit')>(),
  canSend: true,
  submitContact: vi.fn(),
}));

class Element extends EventTarget {
  readonly attrs = new Map<string, string>();
  readonly nodes = new Map<string, Element>();
  readonly style = { setProperty() {} };
  readonly classList = { add() {}, remove() {}, toggle() {} };
  readonly getBoundingClientRect = vi.fn(() => ({ left: 20, top: 650 }));
  readonly elements = { namedItem: (name: string): Element => this.querySelector(name) };
  innerHTML = '';
  textContent = '';
  value = '';
  hidden = false;
  open = false;
  querySelector(selector: string): Element {
    if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
    return this.nodes.get(selector)!;
  }
  setAttribute(name: string, value: string) { this.attrs.set(name, value); }
  removeAttribute(name: string) { this.attrs.delete(name); }
  showModal() { this.open = true; }
  close() { this.open = false; }
  append() {}
  remove() {}
  focus() { focused = this; }
}
let focused: Element | null = null;

function setup() {
  const dialog = new Element();
  const trigger = new Element();
  const window = Object.assign(new EventTarget(), { clearTimeout, setTimeout, innerWidth: 800, innerHeight: 750 });
  const node = dialog.querySelector('.hj-form');
  const sent = dialog.querySelector('.hj-sent');
  const send = dialog.querySelector('.hj-form .hj-send');
  const alert = dialog.querySelector('.hj-failure');
  sent.hidden = alert.hidden = true;
  const values = { name: 'Wren', email: 'before@example.org', message: 'Hello' };
  for (const [name, value] of Object.entries(values)) node.querySelector(name).value = value;
  const needs = ['Building or renovating'];
  vi.stubGlobal('window', window);
  vi.stubGlobal('document', { createElement: () => dialog });
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
  return { form, dialog, node, sent, send, sendForm, alert, needs, trigger, window, country, phoneReady };
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

it('hides the honeypot from visitors and sends what is in it', () => {
  const { dialog, node, sendForm } = setup();
  const [, trap] = dialog.innerHTML.match(/<div class="hj-trap" aria-hidden="true">([\s\S]*?)<\/div>/)!;
  expect(trap).toMatch(/name="website"[^>]*tabindex="-1"[^>]*autocomplete="off"/);
  vi.mocked(submitContact).mockResolvedValue('sent');
  node.querySelector('website').value = 'https://spam.example';
  sendForm();
  expect(submitContact).toHaveBeenCalledWith(expect.objectContaining({ website: 'https://spam.example' }), expect.anything());
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
    '<legend>How should I reply?</legend>', '<p class="hj-hint" id="hj-reply-hint">Email, phone, or both</p>',
    '>Email</label>', 'placeholder="timothee@gmail.com"', '>Phone</label>', 'placeholder="9888 1135"', 'aria-label="Country code"',
    '<option value="SG" selected>Singapore +65</option>',
    '<legend>What can I help with? <span class="hj-hint">Pick any</span></legend>', '>Tell me about it</label>',
    'placeholder="The space, the timeline, the feeling you\'re after. Rough is fine."', '>Send it</span>',
    '>Got it, thank you.</h3>', '>Back to the scenes</span>', 'aria-label="Close"',
  ]) expect(dialog.innerHTML).toContain(words);
});

it('marks up email and phone the autofill way, neither of them required', () => {
  const { dialog } = setup();
  const tag = (id: string): string => dialog.innerHTML.match(new RegExp(`<(?:input|select) id="${id}"[^>]*>`))![0];
  expect(dialog.innerHTML).toMatch(/<fieldset class="hj-field hj-reply" aria-describedby="hj-reply-hint hj-reply-err">/);
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
  expect(focused).toBe(node.querySelector('email'));
  expect(submitContact).not.toHaveBeenCalled();
  // After a first try, it clears as soon as either is filled in.
  node.querySelector('phone').value = '9';
  node.querySelector('phone').dispatchEvent(new Event('input'));
  expect(dialog.querySelector('#hj-reply-err').hidden).toBe(true);
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
  expect(said('phone')).toBe("That number doesn't look right for Singapore.");
  expect(node.querySelector('phone').attrs.get('aria-invalid')).toBe('true');
  expect(focused).toBe(node.querySelector('phone'));

  node.querySelector('phone').value = '9888 abcd';
  sendForm();
  expect(said('phone')).toBe("That number doesn't look right for Singapore.");
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
  expect(alert.textContent).toBe("That didn't go through. Check your connection and try again?");
});

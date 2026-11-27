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
  focus() {}
}

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
  return { form, dialog, node, sent, send, sendForm, alert, needs, trigger, window };
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
    'tabindex="-1">Hi! What have you got in mind?</h2>', '>Your name</label>', '>Email or phone number</label>', 'placeholder="Timothée Chalamet"', 'placeholder="timothee@gmail.com or +65 9888 1135"',
    '<legend>What can I help with? <span class="hj-hint">Pick any</span></legend>', '>Tell me about it</label>',
    'placeholder="The space, the timeline, the feeling you\'re after. Rough is fine."', '>Send it</span>',
    '>Got it, thank you.</h3>', '>Back to the scenes</span>', 'aria-label="Close"',
  ]) expect(dialog.innerHTML).toContain(words);
});

it('asks for what is missing, and says when a message did not go through', async () => {
  const { dialog, node, alert, sendForm } = setup();
  for (const name of ['name', 'email', 'message']) node.querySelector(name).value = ' ';
  sendForm();
  const said = (name: string): string => dialog.querySelector(`#hj-${name}-err`).textContent;
  expect(said('name')).toBe('What should I call you?');
  expect(said('email')).toBe('I need an email or phone number to reply to.');
  expect(said('message')).toBe('A few words, so I know where to start.');
  node.querySelector('email').value = 'wren@example';
  sendForm();
  expect(said('email')).toBe("That doesn't look like an email or phone number. Typo?");
  node.querySelector('email').value = '12345';
  sendForm();
  expect(said('email')).toBe("That doesn't look like an email or phone number. Typo?");
  expect(submitContact).not.toHaveBeenCalled();

  Object.entries({ name: 'Wren', email: 'wren@example.org', message: 'Hello' }).forEach(([name, value]) => (node.querySelector(name).value = value));
  vi.mocked(submitContact).mockRejectedValueOnce(new Error('offline'));
  sendForm();
  await Promise.resolve();
  expect(alert.textContent).toBe("That didn't go through. Check your connection and try again?");
});

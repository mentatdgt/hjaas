import { describe, expect, it, vi } from 'vitest';
import { plainClick, samePage } from './home';
import { PAPER, paperFrom, stylesheets } from './paper';

describe('the paper', () => {
  it('is read from a solid background', () => {
    expect(paperFrom('rgb(246, 243, 236)')).toEqual([246, 243, 236]);
    expect(paperFrom('rgba(30, 31, 32, 1)')).toEqual([30, 31, 32]);
    expect(paperFrom('rgb(1 2 3)')).toEqual([1, 2, 3]);
  });
  it('is never black because there is no background yet', () => {
    for (const css of ['rgba(0, 0, 0, 0)', 'transparent', '', 'rgba(0, 0, 0, 0.5)', 'rgb(0 0 0 / 0%)', 'color(srgb 0 0 0)']) expect(paperFrom(css), css).toEqual([...PAPER]);
  });
});

describe('waiting for the stylesheet', () => {
  const link = (sheet: unknown = null): EventTarget & { sheet: unknown } => Object.assign(new EventTarget(), { sheet });
  const doc = (links: unknown[], readyState = 'interactive') => {
    const view = new EventTarget();
    return { view, doc: { querySelectorAll: () => links, readyState, defaultView: view } as unknown as Document };
  };
  const state = async (promise: Promise<void>) => {
    const done = vi.fn();
    void promise.then(done);
    await new Promise((resolve) => setTimeout(resolve));
    return done;
  };
  it('does not wait for one that is here, nor once the document has loaded', async () => {
    expect(await state(stylesheets(doc([link({})]).doc))).toHaveBeenCalled();
    expect(await state(stylesheets(doc([link()], 'complete').doc))).toHaveBeenCalled();
  });
  it('waits for every one on its way, whether it comes or fails', async () => {
    const [a, b] = [link(), link()];
    const done = await state(stylesheets(doc([a, b, link({})]).doc));
    a.dispatchEvent(new Event('load'));
    await new Promise((resolve) => setTimeout(resolve));
    expect(done).not.toHaveBeenCalled();
    b.dispatchEvent(new Event('error'));
    await new Promise((resolve) => setTimeout(resolve));
    expect(done).toHaveBeenCalled();
  });
  it('gives up when the document has loaded without a word from it', async () => {
    const { doc: document, view } = doc([link()]);
    const done = await state(stylesheets(document));
    view.dispatchEvent(new Event('load'));
    await new Promise((resolve) => setTimeout(resolve));
    expect(done).toHaveBeenCalled();
  });
});

describe('the logo on the home page', () => {
  it('knows its own page', () => {
    expect(samePage('https://x.com/', 'https://x.com/?a=1#grow')).toBe(true);
    expect(samePage('https://x.com/', 'https://x.com/index.html#set')).toBe(true);
    expect(samePage('https://x.com/', 'https://x.com/about')).toBe(false);
    expect(samePage('https://x.com/', 'https://y.com/')).toBe(false);
  });
  it('leaves a click that asks for something else alone', () => {
    const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
    expect(plainClick(click)).toBe(true);
    for (const other of [{ button: 1 }, { metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { defaultPrevented: true }]) expect(plainClick({ ...click, ...other })).toBe(false);
  });
});

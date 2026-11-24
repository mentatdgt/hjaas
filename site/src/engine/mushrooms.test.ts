import { afterEach, expect, it, vi } from 'vitest';
import { Hunt } from './mushrooms';

vi.mock('./motion', () => ({
  EASE_OUT: 'none',
  reducedMotion: () => false,
  gsap: {
    timeline: ({ onComplete }: { onComplete: () => void }) => ({
      to() { return this; },
      progress() { onComplete(); },
    }),
  },
}));

class Element extends EventTarget {
  readonly children: Element[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style = { setProperty() {} };
  className = '';
  readonly classList = { add() {} };
  inert = false;
  naturalWidth = 20;
  naturalHeight = 30;

  constructor(readonly tag = 'img') { super(); }
  append(...children: Element[]) { this.children.push(...children); }
  setAttribute() {}
  querySelector(selector: string) {
    return this.children.find((child) => selector === child.tag || selector === `.${child.className}`);
  }
  getBoundingClientRect() { return { left: 10, top: 10, width: 20, height: 30 }; }
  remove() {}
  async decode() {}
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('ignores a hidden mushroom and settles a collected flight exactly once', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('Image', Element);
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('document', { createElement: (tag: string) => new Element(tag), activeElement: null });
  const onFind = vi.fn();
  const onLand = vi.fn();
  const layer = new Element();
  const spot = { id: 'a', x: 10, y: 30, h: 30, art: 1 };
  const hunt = await Hunt.create({
    spots: [spot],
    edge: () => 1,
    plate: new Element() as unknown as HTMLElement,
    flyLayer: layer as unknown as HTMLElement,
    found: new Set<string>(),
    target: () => new Element().getBoundingClientRect() as DOMRect,
    onFind,
    onLand,
  });
  const button = hunt.el.children[0];
  hunt.el.inert = true;
  button.dispatchEvent(new Event('click'));
  expect(onFind).not.toHaveBeenCalled();

  hunt.el.inert = false;
  button.dispatchEvent(new Event('click'));
  expect(onFind).toHaveBeenCalledExactlyOnceWith(spot);
  expect(onLand).not.toHaveBeenCalled();
  hunt.finishMotion();
  hunt.finishMotion();
  await vi.runAllTimersAsync();
  expect(onFind).toHaveBeenCalledOnce();
  expect(onLand).toHaveBeenCalledExactlyOnceWith(spot);
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Scene } from './scene';
import { Transition } from './transition';

vi.mock('./paint', () => ({
  Painter: class {
    canvas = new Element();
    seconds = 1.2;
    aim() {}
    paintTo() {}
    wash() {}
  },
}));
vi.mock('./motion', () => ({
  EASE_OUT: 'none',
  gsap: {
    timeline: ({ onComplete }: { onComplete: () => void }) => {
      const callbacks: Array<() => void> = [];
      return {
        to() { return this; },
        call(callback: () => void) { callbacks.push(callback); return this; },
        progress() {
          callbacks.forEach((callback) => callback());
          onComplete();
        },
        kill() {},
      };
    },
  },
}));

class Element {
  clientWidth = 400;
  clientHeight = 300;
  style = {};
  classList = { add() {}, remove() {} };
  setAttribute() {}
  append() {}
  remove() {}
  getBoundingClientRect() { return {}; }
  animate() { return { onfinish: null, finish() {}, cancel() {} }; }
}

const setup = () => {
  const frame = new Element();
  const transition = new Transition({
    root: new Element(),
    window: frame,
    viewport: new Element(),
    caption: new Element(),
  } as unknown as ConstructorParameters<typeof Transition>[0]);
  const scene = { plate: new Element(), hunt: { el: { inert: false } }, work: vi.fn(), config: { strokes: [{ at: 0, takes: 1 }] } };
  return { transition, frame, scene, next: scene as unknown as Scene };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('document', { createElement: () => new Element() });
  vi.stubGlobal('getComputedStyle', () => ({ backgroundColor: 'white' }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('interaction during scene reveals', () => {
  it('keeps return-visit mushrooms inert until Skip completes the reveal', async () => {
    const { transition, scene, next } = setup();
    const done = transition.reveal(next);
    expect(scene.hunt.el.inert).toBe(true);
    expect(scene.work).not.toHaveBeenCalled();
    transition.skip();
    await done;
    expect(scene.hunt.el.inert).toBe(false);
    expect(scene.work).toHaveBeenCalledOnce();
  });

  it.each(['pan', 'resize'])('keeps a switched scene inert until a %s invalidates the crop', async (change) => {
    const { transition, frame, scene, next } = setup();
    const crop = { x: 100, width: 640 };
    transition.cover(() => {}, next);
    expect(scene.hunt.el.inert).toBe(true);
    const done = transition.brushOver(next, crop);
    transition.cropChanged(crop);
    expect(scene.hunt.el.inert).toBe(true);
    if (change === 'resize') frame.clientHeight++;
    transition.cropChanged({ ...crop, x: change === 'pan' ? 120 : crop.x });
    await done;
    expect(scene.hunt.el.inert).toBe(false);
    expect(scene.work).toHaveBeenCalledOnce();
  });
});

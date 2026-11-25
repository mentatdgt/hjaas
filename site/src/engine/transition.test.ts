import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Scene } from './scene';
import { Transition } from './transition';

const aimed: number[][] = [];
let made: Array<{ strokes: Array<{ at: number; takes: number }>; pace?: number }> = [];
vi.mock('./paint', () => ({
  Painter: class {
    canvas = new Element();
    seconds: number;
    constructor(options: { strokes: Array<{ at: number; takes: number }>; pace?: number; fill: (ctx: unknown, w: number, h: number) => void }) {
      made.push(options);
      this.seconds = Math.max(...options.strokes.map((s) => s.at + s.takes)) / (options.pace ?? 1);
      options.fill({ fillRect() {} }, 400, 300);
    }
    get fresh() { return true; }
    refill() {}
    aim(...args: number[]) { aimed.push(args); }
    paintTo() {}
    wash() {}
  },
}));
let tweens: Array<{ duration: number; at: number }> = [];
let elapsed = 0;
const captioned: object[] = [];
vi.mock('./motion', () => ({
  EASE_OUT: 'none',
  gsap: {
    set() {},
    to(_: unknown, vars: object) { captioned.push(vars); },
    timeline: ({ onComplete }: { onComplete: () => void }) => {
      const callbacks: Array<() => void> = [];
      return {
        to(_: unknown, { duration }: { duration: number }, at: number) { tweens.push({ duration, at }); return this; },
        fromTo() { return this; },
        call(callback: () => void) { callbacks.push(callback); return this; },
        time: () => elapsed,
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
  width = 10;
  height = 10;
  on = new Set<string>();
  classList = { add: (c: string) => void this.on.add(c), remove: (c: string) => void this.on.delete(c), contains: (c: string) => this.on.has(c) };
  removed = false;
  setAttribute() {}
  querySelector() { return null; }
  append() {}
  after() {}
  remove() { this.removed = true; }
  getBoundingClientRect() { return {}; }
  animate() { return { onfinish: null, finish() {}, cancel() {} }; }
}

const setup = () => {
  const frame = new Element();
  const root = new Element();
  const transition = new Transition({
    root,
    window: frame,
    viewport: new Element(),
    caption: new Element(),
  } as unknown as ConstructorParameters<typeof Transition>[0]);
  const scene = { plate: new Element(), mark: new Element(), edgeOnto: () => true, hunt: { el: { inert: false } }, work: vi.fn(), config: { strokes: [{ at: 0, takes: 1 }] } };
  return { transition, frame, root, scene, next: scene as unknown as Scene };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('performance', { mark() {}, now: () => 0 });
  aimed.length = captioned.length = 0;
  made = [];
  tweens = [];
  elapsed = 0;
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

  it('keeps a switched scene inert until a resize invalidates the crop', async () => {
    const { transition, frame, scene, next } = setup();
    const crop = { x: 100, width: 640 };
    transition.cover(() => {}, next);
    expect(scene.hunt.el.inert).toBe(true);
    const done = transition.brushOver(next, crop);
    transition.cropChanged(crop);
    expect(scene.hunt.el.inert).toBe(true);
    frame.clientHeight++;
    transition.cropChanged(crop);
    await done;
    expect(scene.hunt.el.inert).toBe(false);
    expect(scene.work).toHaveBeenCalledOnce();
  });

  it('a pan does not finish a brush-over: the brush follows the room', () => {
    const { transition, scene, next } = setup();
    transition.cover(() => {}, next);
    void transition.brushOver(next, { x: 100, width: 640 });
    expect(aimed).toEqual([[400 / 640, 100]]);
    transition.cropChanged({ x: 130, width: 640 });
    expect(aimed.at(-1)).toEqual([400 / 640, 130]);
    expect(transition.running).toBe(true);
    expect(scene.hunt.el.inert).toBe(true);
    expect(scene.work).not.toHaveBeenCalled();
  });
});

describe('a return to a scene painted in this visit', () => {
  it('is 2.4 s of brush and a 0.35 s wash, whatever the plan', () => {
    const { transition, scene, next } = setup();
    scene.config.strokes = [{ at: 0, takes: 2 }, { at: 3.3, takes: 1.02 }];
    transition.cover(() => {}, next);
    expect(made[0].pace).toBeCloseTo(4.32 / 2.4);
    void transition.brushOver(next, { x: 0, width: 1672 });
    expect(tweens.map((tween) => tween.duration)).toEqual([expect.closeTo(2.4), 0.35]);
    expect(tweens[1].at).toBeCloseTo(2.3);
  });
});

describe('a painting left for another scene', () => {
  it('stops where it is: it is never finished, its sheet stays on, and it is over', async () => {
    const { transition, scene, next } = setup();
    const done = transition.paint(next, false);
    expect(transition.brushing).toBe(0);
    elapsed = 2;
    expect(transition.halt()).toBe(2);
    await done;
    expect(transition.running).toBe(false);
    expect(transition.brushing).toBe(null);
    expect(scene.hunt.el.inert).toBe(true);
    expect(scene.work).not.toHaveBeenCalled();
    expect(transition.sheetBytes).toBeGreaterThan(0);
    // Nothing is tidied away later, while the old picture is still leaving under it.
    vi.advanceTimersByTime(10_000);
    expect(transition.sheetBytes).toBeGreaterThan(0);
  });

  it('before a brush-over: the copy shows it as it stood, and its sheets are given back', () => {
    const { transition, next } = setup();
    void transition.paint(next, false);
    transition.halt();
    let given: { sheet: Element; veil: Element; overWindow: boolean } | undefined;
    let then = 0;
    transition.cover((_, __, sheets) => {
      given = sheets as unknown as typeof given;
      then = given!.sheet.width;
    }, next);
    expect(given!.overWindow).toBe(false);
    expect(then).toBe(10);
    expect([given!.sheet, given!.veil].map((canvas) => [canvas.removed, canvas.width, canvas.height])).toEqual([[true, 0, 0], [true, 0, 0]]);
  });

  it('a brush-over left part way goes into the next copy, as a sheet over the window', () => {
    const { transition, next } = setup();
    transition.cover(() => {}, next);
    expect(transition.overWindow).not.toBe(null);
    void transition.brushOver(next, { x: 0, width: 1672 });
    transition.halt();
    let over = false;
    transition.cover((_, __, sheets) => void (over = sheets.overWindow && sheets.sheet !== null), next);
    expect(over).toBe(true);
  });

  it('brings the caption, if the painting was to bring it', () => {
    const { transition, root, next } = setup();
    root.classList.add('is-pre');
    void transition.paint(next);
    transition.halt();
    expect(captioned).toHaveLength(1);
    void transition.paint(next);
    transition.halt();
    expect(captioned).toHaveLength(1);
  });
});

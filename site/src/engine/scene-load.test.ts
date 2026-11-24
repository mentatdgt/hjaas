import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPlate, warmPlate } from './assets';
import growFrames from '../../public/assets/scene2/rachel/frames.json';
import growRoutine from '../../public/assets/scene2/rachel/routine.json';
import { Scene } from './scene';
import { SCENES } from '../scenes';

vi.mock('./edge', () => ({
  edgeAlpha: () => () => 1,
  edgeName: () => 'build',
  makeEdge: () => ({ el: {}, make: async () => {}, release() {} }),
}));

vi.mock('./character', () => ({
  Character: class {
    readonly el = new Element();
    readonly shadow = null;
    readonly rest: string;
    constructor(private frames: Map<string, unknown>, setup: { rest: string }) { this.rest = setup.rest; }
    get showing() { return [this.rest]; }
    has(name: string) { return this.frames.has(name); }
    add(name: string, frame: unknown) { this.frames.set(name, frame); }
    drop(name: string) { this.frames.delete(name); }
    resize() {}
    sleep() {}
    show() {}
  },
}));

const decode = vi.fn<(src: string) => Promise<void>>();
const config = SCENES[0];

class Element {
  src = '';
  dataset = {};
  style = { setProperty() {} };
  classList = { add() {} };
  naturalWidth = 166;
  naturalHeight = 154;
  append() {}
  insertBefore() {}
  replaceChildren() {}
  remove() {}
  addEventListener() {}
  setAttribute(_name: string, _value: string) {}
  removeAttribute() { this.src = ''; }
  decode() { return decode(this.src); }
}

const load = (room = config) => Scene.load(room, {
  flyLayer: new Element() as unknown as HTMLElement,
  found: new Set(),
  target: () => new DOMRect(),
  rnd: () => 0,
  still: () => false,
  shownWidth: () => 1440,
  onFind: () => {},
  onLand: () => {},
  onLayout: () => {},
  edge: { style: 'pencil', seed: () => 0, paper: [255, 255, 255] },
}, true);

describe('recoverable room assets', () => {
  beforeEach(() => {
    decode.mockReset().mockResolvedValue();
    vi.stubGlobal('Image', Element);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal('document', { createElement: () => new Element(), createComment: () => ({}) });
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    // A denied cast download must still leave the room and hunt intact.
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('retries a failed mushroom sprite and builds the hunt', async () => {
    const failed = new Set<string>();
    decode.mockImplementation(async (src) => {
      if (src.includes('/mushrooms/') && !failed.has(src)) {
        failed.add(src);
        throw new Error('sprite unavailable on first attempt');
      }
    });
    const scene = await load();
    expect(scene.hunt.remaining).toBe(config.spots.length);
    for (const src of failed) expect(decode.mock.calls.filter(([url]) => url === src)).toHaveLength(2);
    expect(failed.size).toBeGreaterThan(0);
  });

  it('stands another drawing in for a lost sprite, and fails only when all are lost', async () => {
    decode.mockImplementation(async (src) => {
      if (src.includes(`mushroom_${String(config.spots[0].art).padStart(2, '0')}`)) throw new Error('sprite unavailable');
    });
    expect((await load()).hunt.remaining).toBe(config.spots.length);
    decode.mockImplementation(async (src) => {
      if (src.includes('/mushrooms/')) throw new Error('sprites unavailable');
    });
    await expect(load()).rejects.toThrow('sprites unavailable');
  });

  it('keeps a playable hunt when a cast frame fails', async () => {
    const requested: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      requested.push(url);
      return new Response(null, { status: 404 });
    }));
    const scene = await load();
    expect(requested.some((url) => url.endsWith('.webp'))).toBe(true);
    expect(scene.character).toBeNull();
    expect(scene.hunt.remaining).toBe(config.spots.length);
  });

  it('closes a reaction bitmap that finishes after its scene is left and releases the held frame on destroy', async () => {
    const frame = () => ({ width: 100, height: 100, close: vi.fn() });
    const stills: Array<ReturnType<typeof frame>> = [];
    const late = frame();
    let complete!: (bitmap: ReturnType<typeof frame>) => void;
    let decodingStarted!: () => void;
    const started = new Promise<void>((resolve) => { decodingStarted = resolve; });
    const decoding = new Promise<ReturnType<typeof frame>>((resolve) => { complete = resolve; });
    vi.stubGlobal('requestIdleCallback', (fn: () => void) => queueMicrotask(fn));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/reaction.json')) return new Response(JSON.stringify({ frames: [{ file: 'late.png', ms: 100 }] }));
      if (url.endsWith('/shared.json')) return new Response('{}');
      return new Response(url);
    }));
    vi.stubGlobal('createImageBitmap', async (blob: Blob) => {
      if ((await blob.text()).endsWith('/late.webp')) {
        decodingStarted();
        return decoding;
      }
      const bitmap = frame();
      stills.push(bitmap);
      return bitmap;
    });
    const scene = await load();
    expect(scene.character).not.toBeNull();
    const reaction = scene.loadMore();
    await started;
    scene.rest();
    complete(late);
    await reaction;
    expect(late.close).toHaveBeenCalledOnce();
    expect(scene.character?.has('reaction/late.png')).toBe(false);
    expect(stills.some((bitmap) => bitmap.close.mock.calls.length === 0)).toBe(true);
    scene.destroy();
    await Promise.resolve();

    expect(stills.every((bitmap) => bitmap.close.mock.calls.length === 1)).toBe(true);
    const decodedCount = stills.length;
    await scene.enter();
    expect(scene.character).toBeNull();
    expect(stills).toHaveLength(decodedCount);
  });

  it('waits for idle to warm a room at low priority and skips a departed opening room', async () => {
    const callbacks: Array<() => void> = [];
    const priorities: string[] = [];
    vi.stubGlobal('requestIdleCallback', (fn: () => void) => callbacks.push(fn));
    vi.stubGlobal('Image', class extends Element {
      setAttribute(name: string, value: string) {
        if (name === 'fetchpriority') priorities.push(value);
      }
    });
    const active = warmPlate('scene2/room.webp', () => true);
    const departed = warmPlate('scene3/room.webp', () => false);
    expect(decode).not.toHaveBeenCalled();
    callbacks.splice(0).forEach((fn) => fn());
    await Promise.all([active, departed]);
    expect(decode).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('scene2/room.webp'));
    expect(priorities).toEqual(['low']);
  });

  it('parks the clip queue of a departed room and restarts it on return', async () => {
    const requested: string[] = [];
    let nextRequest!: (url: string) => void;
    let finish!: (response: Response) => void;
    const awaitRequest = () => new Promise<string>((resolve) => { nextRequest = resolve; });
    vi.stubGlobal('requestIdleCallback', (fn: () => void) => queueMicrotask(fn));
    vi.stubGlobal('createImageBitmap', async () => ({ width: 100, height: 100, close() {} }));
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/frames.json')) return new Response(JSON.stringify(growFrames));
      if (url.endsWith('/routine.json')) return new Response(JSON.stringify(growRoutine));
      if (init?.priority !== 'low') return new Response(url);
      requested.push(url);
      nextRequest(url);
      return new Promise<Response>((resolve) => { finish = resolve; });
    }));
    const scene = await load(SCENES[1]);
    expect(scene.character).not.toBeNull();
    const firstRequest = awaitRequest();
    const firstQueue = scene.loadMore();
    const first = await firstRequest;
    scene.rest();
    finish(new Response(first));
    await firstQueue;
    expect(requested).toEqual([first]);

    await scene.enter();
    const resumedRequest = awaitRequest();
    const resumedQueue = scene.loadMore();
    expect(await resumedRequest).toBe(first);
    scene.rest();
    finish(new Response(first));
    await resumedQueue;
    expect(requested).toEqual([first, first]);
    scene.destroy();
  });

  it('gives a slow room a minute, then expires, and a fresh load can succeed', async () => {
    vi.useFakeTimers();
    decode.mockImplementation(() => new Promise(() => {}));
    let expired = false;
    const failed = loadPlate('room.webp').catch((error: Error) => {
      expired = true;
      return error;
    });
    await vi.advanceTimersByTimeAsync(50_000);
    expect(expired).toBe(false);
    await vi.runAllTimersAsync();
    expect(String(await failed)).toContain('deadline exceeded');
    expect(decode).toHaveBeenCalledOnce();
    decode.mockResolvedValue();
    // Under another address: the stalled request, which the preload keeps open, is not waited for again.
    await expect(loadPlate('room.webp')).resolves.toMatchObject({ src: expect.stringContaining('room.webp?again=1') });
  });
});

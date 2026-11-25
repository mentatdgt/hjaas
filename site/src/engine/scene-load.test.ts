import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPlate, retainAssets, warmRoom } from './assets';
import growFrames from '../../public/assets/scene2/rachel/frames.json';
import growRoutine from '../../public/assets/scene2/rachel/routine.json';
import { Casting, Scene } from './scene';
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
    addPatch(name: string, patch: { frame: unknown }) { this.frames.set(name, patch.frame); }
    dropPatch(name: string) { this.frames.delete(name); }
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
    vi.stubGlobal('HTMLImageElement', Element);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal('requestAnimationFrame', (fn: () => void) => setTimeout(fn, 1));
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
    // (Nothing downloaded in one test is here in the next.)
    retainAssets()();
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
    await scene.stock();
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

  it('paints her on the drawing she rests on, then brings the others, and only then starts her routine', async () => {
    const requested: string[] = [];
    const waiting: Array<() => void> = [];
    vi.stubGlobal('requestIdleCallback', (fn: () => void) => queueMicrotask(fn));
    vi.stubGlobal('createImageBitmap', async () => ({ width: 100, height: 100, close() {} }));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      requested.push(url.split('/').pop()!);
      if (url.endsWith('/frame_01.webp')) return new Response(url);
      return new Promise<Response>((resolve) => waiting.push(() => resolve(new Response(url))));
    }));
    const scene = await load();
    // Nothing but the rest pose before the scene was ready; the others are asked for from then on.
    expect(requested[0]).toBe('frame_01.webp');
    expect(scene.character?.has('frame_01')).toBe(true);
    expect(scene.character?.has('frame_02')).toBe(false);
    await vi.waitFor(() => expect(requested).toHaveLength(10));
    const poses: string[] = [];
    const loops = vi.spyOn(scene.player!, 'setLoop');
    scene.player!.onPose = (pose) => poses.push(pose);
    vi.stubGlobal('document', { ...document, hidden: false });
    scene.work();
    expect(poses).toEqual(['frame_01']);
    const stocked = scene.stock();
    expect(loops).not.toHaveBeenCalled();
    waiting.forEach((arrive) => arrive());
    await stocked;
    expect(scene.character?.has('frame_02')).toBe(true);
    expect(loops).toHaveBeenCalledOnce();
    scene.destroy();
  });

  it('stops downloading for a room another has been asked from, and carries on if the visitor stays', async () => {
    const pending: Array<{ name: string; signal: AbortSignal; arrive: () => void }> = [];
    vi.stubGlobal('requestIdleCallback', (fn: () => void) => queueMicrotask(fn));
    vi.stubGlobal('createImageBitmap', async () => ({ width: 100, height: 100, close() {} }));
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/frame_01.webp')) return Promise.resolve(new Response(url));
      return new Promise<Response>((resolve, reject) => {
        const signal = init!.signal!;
        if (signal.aborted) return reject(signal.reason);
        signal.addEventListener('abort', () => reject(signal.reason));
        pending.push({ name: url, signal, arrive: () => resolve(new Response(url)) });
      });
    }));
    const scene = await load();
    const first = scene.stock();
    await vi.waitFor(() => expect(pending).toHaveLength(9));
    scene.pause();
    await first;
    expect(pending.every(({ signal }) => signal.aborted)).toBe(true);
    expect(console.warn).not.toHaveBeenCalled();
    await scene.stock();
    expect(pending).toHaveLength(9);
    scene.resume();
    await vi.waitFor(() => expect(pending).toHaveLength(18));
    pending.slice(9).forEach(({ arrive }) => arrive());
    await scene.stock();
    expect(scene.character?.has('blink_closed')).toBe(true);
    scene.destroy();
  });

  it('starts the cast with the room, calls it off for another scene, and starts afresh', async () => {
    const asked: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      asked.push(url);
      return new Promise<Response>((_, reject) => init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason)));
    }));
    const casting = new Casting(SCENES[1], { shownWidth: () => 390, found: new Set() } as never);
    const first = casting.start(new Promise(() => {}));
    expect(casting.start()).toBe(first);
    expect(asked.map((url) => url.split('/').pop())).toEqual(['frames.json', 'routine.json']);
    casting.cancel();
    await expect(first).rejects.toThrow();
    expect(casting.start()).not.toBe(first);
    expect(asked).toHaveLength(4);
    casting.cancel();
  });

  it('downloads a room ahead at low priority without decoding it; the room itself waits for it', async () => {
    const calls: Array<[string, RequestInit]> = [];
    let finish!: () => void;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return new Response(new ReadableStream({ start: (c) => void (finish = () => c.close()) }));
    }));
    const control = new AbortController();
    const warm = warmRoom('scene2/room.webp', control.signal);
    const room = loadPlate('scene2/room.webp');
    await vi.waitFor(() => expect(finish).toBeDefined());
    expect(calls).toHaveLength(1);
    expect(calls[0][1].priority).toBe('low');
    expect(decode).not.toHaveBeenCalled();
    finish();
    await warm;
    await room;
    expect(decode).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('scene2/room.webp'));
  });

  it('gives a room ahead up when called off, and when nothing arrives', async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal('fetch', vi.fn((_: string, init: RequestInit) => {
      signals.push(init.signal!);
      return new Promise<Response>((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(init.signal!.reason)));
    }));
    const control = new AbortController();
    const called = warmRoom('scene3/room.webp', control.signal);
    control.abort();
    await expect(called).rejects.toThrow();
    vi.useFakeTimers();
    const stalled = warmRoom('scene3/room.webp', new AbortController().signal).catch(() => 'given up');
    await vi.advanceTimersByTimeAsync(9000);
    expect(await stalled).toBe('given up');
    expect(signals.every((signal) => signal.aborted)).toBe(true);
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

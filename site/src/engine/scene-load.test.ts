import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cutFrom, loadPlate, retainAssets, warmPlate } from './assets';
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

const host = () => ({
  flyLayer: new Element() as unknown as HTMLElement,
  found: new Set<string>(),
  target: () => new DOMRect(),
  rnd: () => 0,
  still: () => false,
  shownWidth: () => 1440,
  onFind: () => {},
  onLand: () => {},
  onLayout: () => {},
  edge: { style: 'pencil' as const, seed: () => 0, paper: [255, 255, 255] as [number, number, number] },
});
const load = (room = config) => Scene.load(room, host(), true);

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

  it('asks for a scene\'s cast together with its room, and decodes none of it before the scene is opened', async () => {
    const requested: string[] = [];
    const bitmaps = vi.fn(async () => ({ width: 100, height: 100, close() {} }));
    vi.stubGlobal('createImageBitmap', bitmaps);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      requested.push(url.split('/').pop()!);
      if (url.endsWith('/frames.json')) return new Response(JSON.stringify(growFrames));
      if (url.endsWith('/routine.json')) return new Response(JSON.stringify(growRoutine));
      return new Response(url);
    }));
    let roomHere!: () => void;
    decode.mockImplementation((src) => (src.endsWith('/room.webp') ? new Promise((resolve) => { roomHere = resolve; }) : Promise.resolve()));
    const coming = Scene.load(SCENES[1], host(), false);
    // The room is still on its way: her manifests and the drawing she rests on have been asked for (and nothing else).
    await vi.waitFor(() => expect(requested).toHaveLength(3));
    expect(requested.slice(0, 2).sort()).toEqual(['frames.json', 'routine.json']);
    expect(requested[2]).toMatch(/\.webp$/);
    roomHere();
    const scene = await coming;
    await scene.loaded();
    expect(bitmaps).not.toHaveBeenCalled();
    expect(scene.character).toBeNull();
    await scene.enter();
    expect(scene.character).not.toBeNull();
    expect(requested.filter((name) => name === requested[2])).toHaveLength(1);
    scene.destroy();
  });

  it('calls a cast off when another scene is asked for first, and starts afresh when it is wanted again at once', async () => {
    const pending: Array<{ signal: AbortSignal; arrive: () => void }> = [];
    const requested: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => new Promise<Response>((resolve, reject) => {
      const signal = init!.signal!;
      requested.push(url);
      signal.addEventListener('abort', () => reject(signal.reason));
      pending.push({ signal, arrive: () => resolve(new Response(url)) });
    })));
    const casting = new Casting(config, { ...host(), shownWidth: () => 390 });
    const first = casting.start();
    first.catch(() => {});
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    casting.cancel();
    const again = casting.start();
    expect(again).not.toBe(first);
    await expect(first).rejects.toThrow();
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[0].signal.aborted).toBe(true);
    // The same drawing again, not the one a wider screen gets.
    expect(requested[1]).toBe(requested[0]);
    pending[1].arrive();
    await expect(again).resolves.toBeTypeOf('function');
    // All here: kept.
    casting.cancel();
    expect(casting.start()).toBe(again);
    expect(pending).toHaveLength(2);
  });

  it('cuts a live screen from the room without downloading it again', async () => {
    const img = { src: 'http://x/room.webp' } as HTMLImageElement;
    const part = { x: 10.2, y: 20, w: 30, h: 40 };
    const bitmaps = vi.fn(async (source: unknown) => ({ from: source }));
    vi.stubGlobal('createImageBitmap', bitmaps);
    const asked = vi.fn(async () => new Response('bytes'));
    vi.stubGlobal('fetch', asked);
    expect((await cutFrom(img, part)) as unknown).toMatchObject({ from: expect.any(Blob) });
    expect(asked).toHaveBeenCalledExactlyOnceWith('http://x/room.webp', expect.objectContaining({ cache: 'only-if-cached', mode: 'same-origin' }));
    // The browser has not kept it: from the picture on the page, and still never from the network.
    for (const answer of [() => Promise.reject(new TypeError('not cached')), async () => new Response(null, { status: 504 })]) {
      asked.mockReset().mockImplementation(answer as () => Promise<Response>);
      expect((await cutFrom(img, part)) as unknown).toEqual({ from: img });
      expect(bitmaps).toHaveBeenLastCalledWith(img, 10, 20, 30, 40);
      expect(asked).toHaveBeenCalledOnce();
    }
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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cutFrom, keepsRooms, loadPlate, retainAssets, savesData, warmRoom } from './assets';
import setFrames from '../../public/assets/scene5/cast/frames.json';
import setRoutine from '../../public/assets/scene5/cast/routine.json';
import setWalk from '../../public/assets/scene5/cast/stagehand/walk.json';
import growFrames from '../../public/assets/scene2/rachel/frames.json';
import growRoutine from '../../public/assets/scene2/rachel/routine.json';
import misterFrames from '../../public/assets/scene2/cast/frames.json';
import misterRoutine from '../../public/assets/scene2/cast/routine.json';
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
  getAttribute(name: string) { return name === 'src' ? this.src || null : null; }
  removeAttribute() { this.src = ''; }
  decode() { return decode(this.src); }
  getContext() { return { drawImage() {}, clearRect() {} }; }
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
/** Grow's manifests: Rachel's (rachel/), and the room's moving parts' (cast/, the mist). Null for any other file. */
const growManifest = (url: string): Response | null => {
  const mist = url.includes('/scene2/cast/');
  if (url.endsWith('/frames.json')) return new Response(JSON.stringify(mist ? misterFrames : growFrames));
  if (url.endsWith('/routine.json')) return new Response(JSON.stringify(mist ? misterRoutine : growRoutine));
  return null;
};
/** Everyone on a scene's plate, bottom to top. */
const castOf = (scene: Scene): Array<{ character: { rest: string; el: { dataset: Record<string, string> } } }> => (scene as unknown as { casts: [] }).casts;

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

  it('asks for Build\'s reaction again when a tap called it off and the visitor stays', async () => {
    const requested: string[] = [];
    let hold: (() => void) | null = null;
    vi.stubGlobal('requestIdleCallback', (fn: () => void) => queueMicrotask(fn));
    vi.stubGlobal('createImageBitmap', async () => ({ width: 100, height: 100, close() {} }));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      requested.push(url.split('/').pop()!);
      if (url.endsWith('/reaction.json')) return new Response(JSON.stringify({ frames: [{ file: 'one.png', ms: 100 }, { file: 'two.png', ms: 100 }] }));
      if (url.endsWith('/shared.json')) return new Response('{}');
      // (The reaction's first drawing is on its way when the visitor taps.)
      if (url.endsWith('/one.webp') && !hold) return new Promise<Response>((resolve) => { hold = () => resolve(new Response(url)); });
      return new Response(url);
    }));
    const scene = await load();
    await scene.stock();
    const first = scene.loadMore();
    await vi.waitFor(() => expect(hold).not.toBeNull());
    // A tap, and back before its file has come: the reaction is asked for afresh, not handed the one that gives up.
    scene.pause();
    scene.resume();
    hold!();
    await first;
    await vi.waitFor(() => expect(requested.filter((name) => name === 'two.webp').length).toBeGreaterThan(0));
    expect(requested.filter((name) => name === 'one.webp')).toHaveLength(1);
    scene.destroy();
  });

  it('tells its host once everything it fetches after settling is here, and not while it is paused', async () => {
    const pending: Array<() => void> = [];
    const filesIn = vi.fn();
    vi.stubGlobal('requestIdleCallback', (fn: () => void) => queueMicrotask(fn));
    vi.stubGlobal('createImageBitmap', async () => ({ width: 100, height: 100, close() {} }));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/frame_01.webp')) return new Response(url);
      return new Promise<Response>((resolve) => pending.push(() => resolve(new Response(url))));
    }));
    const scene = await Scene.load(config, { ...host(), onFilesIn: filesIn }, true);
    const paused = scene.loadMore();
    scene.pause();
    pending.splice(0).forEach((arrive) => arrive());
    await paused;
    expect(filesIn).not.toHaveBeenCalled();
    expect(scene.filesIn).toBe(false);
    scene.resume();
    // (Everything it asks for arrives.)
    await vi.waitFor(() => {
      pending.splice(0).forEach((arrive) => arrive());
      expect(filesIn).toHaveBeenCalledOnce();
    });
    expect(scene.filesIn).toBe(true);
    scene.pause();
    expect(scene.filesIn).toBe(false);
    scene.destroy();
  });

  it('asks for a scene\'s cast together with its room, and decodes none of it before the scene is opened', async () => {
    const requested: string[] = [];
    const bitmaps = vi.fn(async () => ({ width: 100, height: 100, close() {} }));
    vi.stubGlobal('createImageBitmap', bitmaps);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      requested.push(url.split('/').pop()!);
      const manifest = growManifest(url);
      if (manifest) return manifest;
      return new Response(url);
    }));
    let roomHere!: () => void;
    decode.mockImplementation((src) => (src.endsWith('/room.webp') ? new Promise((resolve) => { roomHere = resolve; }) : Promise.resolve()));
    const coming = Scene.load(SCENES[1], host(), false);
    // The room is still on its way: her manifests and the drawing she rests on have been asked for, and the mist's
    // manifests and its first drawing (and nothing else).
    await vi.waitFor(() => expect(requested).toHaveLength(6));
    expect(requested.filter((name) => name.endsWith('.json')).sort()).toEqual(['frames.json', 'frames.json', 'routine.json', 'routine.json']);
    const drawings = requested.filter((name) => name.endsWith('.webp'));
    expect(drawings).toHaveLength(2);
    expect(drawings).toContain('M1.webp');
    roomHere();
    const scene = await coming;
    await scene.loaded();
    expect(bitmaps).not.toHaveBeenCalled();
    expect(scene.character).toBeNull();
    await scene.enter();
    expect(scene.character).not.toBeNull();
    for (const drawing of drawings) expect(requested.filter((name) => name === drawing)).toHaveLength(1);
    // The mist under her; she is the lead.
    expect(castOf(scene).map((cast) => cast.character.el.dataset.actor ?? 'rachel')).toEqual(['mister', 'rachel']);
    expect(castOf(scene)[1].character).toBe(scene.character);
    expect(castOf(scene)[0].character.rest).toBe('M1');
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

  it('downloads the next room ahead at low priority, keeps none of it, and its scene waits for it rather than download it twice', async () => {
    const asked: Array<{ url: string; init?: RequestInit }> = [];
    let send!: (chunk: Uint8Array | null) => void;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      asked.push({ url, init });
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          send = (chunk) => (chunk ? controller.enqueue(chunk) : controller.close());
        },
      });
      return new Response(body);
    }));
    const blobs = vi.spyOn(Response.prototype, 'blob');
    const control = new AbortController();
    const warm = warmRoom('scene2/room.webp', control.signal);
    // (Asked twice: the same download.)
    expect(warmRoom('scene2/room.webp', control.signal)).toBe(warm);
    await vi.waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0].init).toMatchObject({ priority: 'low' });
    const plate = loadPlate('scene2/room.webp');
    send(new Uint8Array(1000));
    await new Promise((resolve) => setTimeout(resolve, 5));
    // The scene's own <img> waits for it.
    expect(decode).not.toHaveBeenCalled();
    send(null);
    await warm;
    await plate;
    expect(decode).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('scene2/room.webp'));
    expect(asked).toHaveLength(1);
    expect(blobs).not.toHaveBeenCalled();
  });

  it('gives up a room downloaded ahead when called off, and its scene then downloads it itself', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init!.signal!.addEventListener('abort', () => reject(new DOMException('called off', 'AbortError')));
    })));
    const control = new AbortController();
    const warm = warmRoom('scene3/room.webp', control.signal);
    const plate = loadPlate('scene3/room.webp');
    control.abort();
    await expect(warm).rejects.toThrow();
    await plate;
    expect(decode).toHaveBeenCalledOnce();
  });

  it('asks only the browser\'s cache whether rooms are kept, and hears when data is to be saved', async () => {
    const asked = vi.fn(async () => new Response('x'));
    vi.stubGlobal('fetch', asked);
    expect(await keepsRooms('scene1/room.webp')).toBe(true);
    expect(asked).toHaveBeenCalledWith(expect.stringContaining('scene1/room.webp'), expect.objectContaining({ cache: 'only-if-cached' }));
    asked.mockImplementation(async () => { throw new TypeError('not cached'); });
    expect(await keepsRooms('scene1/room.webp')).toBe(false);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('navigator', { connection: { saveData: true } });
    expect(savesData()).toBe(true);
    vi.stubGlobal('navigator', {});
    expect(savesData()).toBe(false);
  });

  it('opens the theatre on the backdrop pieces already earned, then the next one; the rest and the stagehand only once it has settled', async () => {
    const requested: string[] = [];
    vi.stubGlobal('requestIdleCallback', (fn: () => void) => queueMicrotask(fn));
    vi.stubGlobal('createImageBitmap', async () => ({ width: 100, height: 100, close() {} }));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const name = url.split('/assets/scene5/cast/').pop()!;
      requested.push(name);
      if (name === 'frames.json') return new Response(JSON.stringify(setFrames));
      if (name === 'routine.json') return new Response(JSON.stringify(setRoutine));
      if (name.endsWith('walk.json')) return new Response(JSON.stringify(setWalk));
      return new Response(url);
    }));
    const set = SCENES.find((scene) => scene.id === 'set')!;
    const found = new Set(set.spots.slice(0, 2).map((spot) => spot.id));
    const scene = await Scene.load(set, { ...host(), found }, true);
    const pieces = (): string[] => requested.filter((name) => name.startsWith('backdrop_'));
    const stagehand = (): string[] => requested.filter((name) => name.startsWith('stagehand/'));
    // Ready to paint: the two pieces earned, the third on its way (not waited for), no stagehand.
    expect(pieces().slice(0, 2)).toEqual(['backdrop_01/P_01.webp', 'backdrop_02/P_02.webp']);
    await vi.waitFor(() => expect(pieces()).toHaveLength(3));
    expect(pieces()[2]).toBe('backdrop_03/P_03.webp');
    expect(stagehand()).toEqual([]);
    await scene.stock();
    expect(pieces()).toHaveLength(3);
    expect(stagehand()).toEqual([]);
    expect(scene.memory).toBeDefined();
    // Settled: the others in hunt order, then he joins.
    await scene.loadMore();
    expect(pieces()).toEqual(Array.from({ length: 10 }, (_, i) => `backdrop_${String(i + 1).padStart(2, '0')}/P_${String(i + 1).padStart(2, '0')}.webp`));
    expect(stagehand().length).toBeGreaterThan(10);
    expect(requested.indexOf(stagehand()[0])).toBeGreaterThan(requested.indexOf('backdrop_10/P_10.webp'));
    // Each file once.
    expect(new Set(requested).size).toBe(requested.length);
    scene.destroy();
  });

  it('parks the clip queue of a departed room and restarts it on return', async () => {
    const requested: string[] = [];
    let nextRequest!: (url: string) => void;
    let finish!: (response: Response) => void;
    const awaitRequest = () => new Promise<string>((resolve) => { nextRequest = resolve; });
    vi.stubGlobal('requestIdleCallback', (fn: () => void) => queueMicrotask(fn));
    vi.stubGlobal('createImageBitmap', async () => ({ width: 100, height: 100, close() {} }));
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const manifest = growManifest(url);
      if (manifest) return manifest;
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

  it('calls off Grow\'s later clips on a tap, and carries on from the same frame if the visitor stays', async () => {
    const pending: Array<{ url: string; signal: AbortSignal; arrive: () => void }> = [];
    vi.stubGlobal('requestIdleCallback', (fn: () => void) => queueMicrotask(fn));
    vi.stubGlobal('createImageBitmap', async () => ({ width: 100, height: 100, close() {} }));
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const manifest = growManifest(url);
      if (manifest) return manifest;
      if (init?.priority !== 'low') return new Response(url);
      return new Promise<Response>((resolve, reject) => {
        const signal = init.signal!;
        signal.addEventListener('abort', () => reject(signal.reason));
        pending.push({ url, signal, arrive: () => resolve(new Response(url)) });
      });
    }));
    const scene = await load(SCENES[1]);
    const more = scene.loadMore();
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    // A tap: the clip's request is given up at once, and nothing more is asked for.
    scene.pause();
    await more;
    expect(pending[0].signal.aborted).toBe(true);
    expect(pending).toHaveLength(1);
    expect(console.warn).not.toHaveBeenCalled();
    // The visitor stays: the same frame again, and then the next.
    scene.resume();
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[1].url).toBe(pending[0].url);
    pending[1].arrive();
    await vi.waitFor(() => expect(pending).toHaveLength(3));
    expect(pending[2].url).not.toBe(pending[0].url);
    scene.destroy();
  });

  it('shows Grow without its mist, and Rachel as ever, when the mist\'s files cannot be had', async () => {
    vi.stubGlobal('requestIdleCallback', (fn: () => void) => queueMicrotask(fn));
    vi.stubGlobal('createImageBitmap', async () => ({ width: 100, height: 100, close() {} }));
    for (const lost of ['/scene2/cast/frames.json', '/scene2/cast/routine.json', '/scene2/cast/mister/M1.webp']) {
      vi.mocked(console.warn).mockClear();
      vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        if (url.includes(lost)) return new Response(null, { status: 404 });
        return growManifest(url) ?? new Response(url);
      }));
      const scene = await load(SCENES[1]);
      expect(scene.character, lost).not.toBeNull();
      expect(castOf(scene), lost).toHaveLength(1);
      expect(castOf(scene)[0].character).toBe(scene.character);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('moving parts could not be loaded'), expect.anything());
      await scene.stock();
      await scene.loadMore();
      scene.destroy();
      retainAssets()();
    }
  });

  it('keeps Rachel playing when only the mist\'s later drawings fail: it holds its first', async () => {
    vi.stubGlobal('requestIdleCallback', (fn: () => void) => queueMicrotask(fn));
    vi.stubGlobal('createImageBitmap', async () => ({ width: 100, height: 100, close() {} }));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (/\/scene2\/cast\/mister\/M[234]\.webp/.test(url)) return new Response(null, { status: 404 });
      return growManifest(url) ?? new Response(url);
    }));
    const scene = await load(SCENES[1]);
    expect(castOf(scene)).toHaveLength(2);
    await scene.stock();
    // She is on the plate, the lead, over the mist.
    expect(scene.character).not.toBeNull();
    expect(castOf(scene)[1].character).toBe(scene.character);
    expect((castOf(scene)[0].character as unknown as { has: (name: string) => boolean }).has('M1')).toBe(true);
    expect((castOf(scene)[0].character as unknown as { has: (name: string) => boolean }).has('M2')).toBe(false);
    scene.destroy();
  });

  it('does not wait long for a stalled mist: Rachel goes on, the room as painted', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 100, height: 100, close() {} }));
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/scene2/cast/')) {
        return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)));
      }
      return growManifest(url) ?? new Response(url);
    }));
    const started = performance.now();
    const scene = await load(SCENES[1]);
    expect(performance.now() - started).toBeLessThan(3500);
    expect(scene.character).not.toBeNull();
    expect(castOf(scene)).toHaveLength(1);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('moving parts are late'));
    scene.destroy();
  });

  it('gives back the mist\'s drawing if Rachel\'s cannot be decoded', async () => {
    const closed: string[] = [];
    vi.stubGlobal('createImageBitmap', async (blob: Blob) => {
      const url = await blob.text();
      if (url.includes('/rachel/')) throw new Error('cannot decode');
      return { width: 100, height: 100, close() { closed.push(url); } };
    });
    // (Nor by the page's own <img>, which a failed bitmap falls back to.)
    decode.mockImplementation(async (src) => {
      if (src.startsWith('blob:')) throw new Error('cannot decode');
    });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => growManifest(url) ?? new Response(url)));
    const scene = await load(SCENES[1]);
    expect(scene.character).toBeNull();
    await vi.waitFor(() => expect(closed.some((url) => url.endsWith('/M1.webp'))).toBe(true));
    scene.destroy();
  });

  it('a scene without a finale (Film, for now) never fetches or plays one, even complete; one with a finale does', async () => {
    const requested: string[] = [];
    vi.stubGlobal('requestIdleCallback', (fn: () => void) => queueMicrotask(fn));
    vi.stubGlobal('createImageBitmap', async () => ({ width: 100, height: 100, close() {} }));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      requested.push(url);
      if (url.includes('/finale')) return new Response(null, { status: 404 });
      return new Response(url);
    }));
    const complete = (room: typeof config) => Scene.load(room, { ...host(), found: new Set(room.spots.map((spot) => spot.id)) }, true);
    // Film's own config: its finale is a comment until its pose is approved.
    expect(SCENES.find((scene) => scene.id === 'film')?.finale).toBeUndefined();
    // Build with its finale taken away: the same scene, every mushroom found, settled; nothing of a finale.
    const without = await complete({ ...config, finale: undefined });
    await without.loadMore();
    without.syncFinds();
    expect(without.finaleShow).toBeNull();
    expect(requested.filter((url) => url.includes('/finale'))).toEqual([]);
    without.destroy();
    // (Build as it is, complete: it does ask for its held pose, so the check above can fail.)
    const withFinale = await complete(config);
    await withFinale.loadMore();
    expect(withFinale.finaleShow).not.toBeNull();
    await vi.waitFor(() => expect(requested.some((url) => url.includes('/scene1/finale/'))).toBe(true));
    withFinale.destroy();
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

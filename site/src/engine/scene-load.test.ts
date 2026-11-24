import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPlate } from './assets';
import { Scene } from './scene';
import { SCENES } from '../scenes';

vi.mock('./edge', () => ({
  edgeAlpha: () => () => 1,
  edgeName: () => 'build',
  makeEdge: () => ({ el: {}, make: async () => {} }),
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
  addEventListener() {}
  setAttribute() {}
  removeAttribute() { this.src = ''; }
  decode() { return decode(this.src); }
}

const load = () => Scene.load(config, {
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
    vi.stubGlobal('document', { createElement: () => new Element(), createComment: () => ({}) });
    vi.stubGlobal('ResizeObserver', class { observe() {} });
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

  it('expires a stalled room after two attempts, and a fresh load can succeed', async () => {
    vi.useFakeTimers();
    decode.mockImplementation(() => new Promise(() => {}));
    const failed = expect(loadPlate('room.webp')).rejects.toThrow('deadline exceeded');
    await vi.runAllTimersAsync();
    await failed;
    expect(decode).toHaveBeenCalledTimes(2);
    decode.mockResolvedValue();
    await expect(loadPlate('room.webp')).resolves.toMatchObject({ src: expect.stringContaining('room.webp') });
  });
});

// The theatre's backdrop: which of its pieces are downloaded, and when.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Progress } from './progress';

class Canvas {
  className = '';
  style = {};
  width = 0;
  height = 0;
  setAttribute() {}
  getContext() { return { drawImage() {} }; }
}
const pieces = Array.from({ length: 10 }, (_, i) => ({ at: i + 1, name: `P_${i}`, file: `${i}.webp`, box: { x: 0, y: 0, w: 10, h: 10 } }));

describe('progress pieces', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { createElement: () => new Canvas(), hidden: true });
    vi.stubGlobal('requestIdleCallback', (fn: () => void) => queueMicrotask(fn));
    vi.stubGlobal('createImageBitmap', async () => ({ width: 10, height: 10, close() {} }));
  });
  afterEach(() => void vi.unstubAllGlobals());

  const make = (found: { n: number }, load?: (i: number, signal?: AbortSignal) => Promise<Blob>) => {
    const asked: number[] = [];
    const earned = Array.from({ length: found.n }, () => new Blob(['x']));
    const progress = new Progress(pieces, earned, (i, signal) => {
      asked.push(i);
      return load ? load(i, signal) : Promise.resolve(new Blob(['x']));
    }, 700, () => found.n);
    return { asked, progress };
  };

  it('fetches the next piece only, then the rest in hunt order', async () => {
    const { asked, progress } = make({ n: 3 });
    const signal = new AbortController().signal;
    await progress.stream(signal, 1);
    expect(asked).toEqual([3]);
    await progress.wake();
    expect(progress.state.baked).toBe(3);
    await progress.stream(signal);
    expect(asked).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(progress.downloaded).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('stops when called off, and fetches a piece that is earned before its turn', async () => {
    const found = { n: 0 };
    const { asked, progress } = make(found);
    await progress.wake();
    const control = new AbortController();
    control.abort();
    await progress.stream(control.signal);
    expect(asked).toEqual([]);
    found.n = 2;
    progress.reach();
    await vi.waitFor(() => expect(progress.state.baked).toBe(2));
    expect(asked).toEqual([0, 1]);
  });

  it('asks again for a piece whose download a tap called off', async () => {
    const found = { n: 0 };
    const { asked, progress } = make(found, (_, signal) => new Promise((resolve, reject) => {
      if (!signal) return resolve(new Blob(['x']));
      signal.addEventListener('abort', () => reject(new DOMException('called off', 'AbortError')));
    }));
    await progress.wake();
    const control = new AbortController();
    const streaming = progress.stream(control.signal, 1);
    control.abort();
    await streaming;
    expect(progress.downloaded).toEqual([]);
    found.n = 1;
    progress.reach();
    await vi.waitFor(() => expect(progress.state.baked).toBe(1));
    expect(asked).toEqual([0, 0]);
  });
});

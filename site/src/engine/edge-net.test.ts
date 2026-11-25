// The edge where a browser will not draw it: it is tried once more, and then a plain fade in the paper's colour stands in.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { makeEdge, type Edge } from './edge';
import { PAPER } from './paper';

type Outcome = 'ok' | 'black' | 'null' | 'lost' | 'throws';
let outcome: (canvas: Canvas) => Outcome;
/** Probes read this whatever is drawn on them. */
let lies = false;

class Node {
  className = '';
  style: Record<string, string> = {};
  children: Node[] = [];
  classList = {
    set: new Set<string>(),
    contains(name: string) { return this.set.has(name); },
    toggle(name: string, on: boolean) { if (on) this.set.add(name); else this.set.delete(name); },
  };
  listeners = new Map<string, () => void>();
  setAttribute() {}
  append(...nodes: Node[]) { this.children.push(...nodes); }
  addEventListener(type: string, listener: () => void) { this.listeners.set(type, listener); }
}
class Canvas extends Node {
  width = 300;
  height = 150;
  puts = 0;
  pixel = [0, 0, 0, 0];
  state: Outcome = 'ok';
  getContext(_: string, options?: object) {
    const canvas = this;
    this.state = options ? 'ok' : outcome(this);
    if (this.state === 'null') return null;
    return {
      canvas,
      fillStyle: '',
      globalCompositeOperation: '',
      isContextLost: () => canvas.state === 'lost',
      putImageData(image: { data: Uint8ClampedArray; width: number; height: number }) {
        canvas.puts++;
        if (canvas.state === 'throws') throw new Error('no memory');
        const at = (image.width >> 1) * 4;
        canvas.pixel = canvas.state === 'black' ? [0, 0, 0, 255] : [...PAPER, 255];
        expect(image.data[at]).toBeTypeOf('number');
      },
      fillRect() { canvas.pixel = [...PAPER, 255]; },
      drawImage(from: Canvas) { canvas.pixel = from.pixel; },
      getImageData: () => ({ data: lies ? [9, 200, 77, 255] : canvas.pixel }),
    };
  }
}

beforeEach(() => {
  lies = false;
  outcome = () => 'ok';
  vi.stubGlobal('document', { createElement: (tag: string) => (tag === 'canvas' ? new Canvas() : new Node()) });
  vi.stubGlobal('ImageData', class { data: Uint8ClampedArray; constructor(public width: number, public height: number) { this.data = new Uint8ClampedArray(width * height * 4); } });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const make = async (): Promise<{ edge: Edge; strips: Canvas[]; on: () => boolean[] }> => {
  const edge = makeEdge('pencil', 7, [...PAPER]);
  const nodes = (edge.el as unknown as Node).children;
  const strips = nodes.filter((node): node is Canvas => node instanceof Canvas);
  await edge.make();
  return { edge, strips, on: () => nodes.filter((node) => !(node instanceof Canvas)).map((node) => node.classList.contains('is-on')) };
};
const none = [false, false, false, false];

it('draws each strip once where it can', async () => {
  const { edge, strips, on } = await make();
  expect(strips.map((strip) => strip.puts)).toEqual([1, 1, 1, 1]);
  expect(on()).toEqual(none);
  expect(edge.whole).toBe(true);
});

it('trusts a strip it cannot read', async () => {
  lies = true;
  const { strips, on } = await make();
  expect(strips.map((strip) => strip.puts)).toEqual([1, 1, 1, 1]);
  expect(on()).toEqual(none);
});

it.each(['black', 'null', 'lost', 'throws'] as const)('tries a strip that is %s once more, and then the plain fade stands in', async (bad) => {
  let first: Canvas | undefined;
  outcome = (canvas) => ((first ??= canvas) === canvas ? bad : 'ok');
  const { edge, strips, on } = await make();
  expect(on()).toEqual([true, false, false, false]);
  expect([strips[0].width, strips[0].height, strips[0].style.display]).toEqual([0, 0, 'none']);
  expect(strips[0].puts).toBe(bad === 'null' ? 0 : 2);
  expect(edge.whole).toBe(true);
  // Made afresh when the scene is next on show.
  outcome = () => 'ok';
  edge.release();
  expect(on()).toEqual(none);
  await edge.make();
  expect(on()).toEqual(none);
  expect(strips[0].width).toBeGreaterThan(0);
});

it('draws again what worked the second time', async () => {
  let asked = 0;
  outcome = () => (asked++ === 0 ? 'black' : 'ok');
  const { strips, on } = await make();
  expect(strips[0].puts).toBe(2);
  expect(on()).toEqual(none);
});

it('covers a strip that is lost later, and draws it again', async () => {
  const { edge, strips, on } = await make();
  strips[1].pixel = [0, 0, 0, 255];
  edge.check();
  expect(on()).toEqual([false, true, false, false]);
  await edge.make();
  expect(on()).toEqual(none);
  // The browser's own word for it, and its word that it is back.
  outcome = (canvas) => (canvas === strips[2] ? 'lost' : 'ok');
  strips[2].listeners.get('contextlost')!();
  await edge.make();
  expect(on()).toEqual([false, false, true, false]);
  outcome = () => 'ok';
  strips[2].listeners.get('contextrestored')!();
  await edge.make();
  expect(on()).toEqual(none);
});

it('leaves a released edge alone', async () => {
  const { edge, strips, on } = await make();
  edge.release();
  edge.check();
  strips[0].listeners.get('contextlost')!();
  await edge.make();
  expect(on()).toEqual(none);
});

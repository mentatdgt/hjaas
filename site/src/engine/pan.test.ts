import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Pan } from './pan';

class Viewport extends EventTarget {
  clientWidth = 390;
  scrollWidth = 1000;
  private left = 0;
  get scrollLeft() { return this.left; }
  set scrollLeft(value: number) {
    this.left = Math.max(0, Math.min(value, this.scrollWidth - this.clientWidth));
  }
}

let frames: FrameRequestCallback[];
beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
});
afterEach(() => vi.unstubAllGlobals());

it('restores the portrait centre after landscape clamps the scroller', () => {
  const viewport = new Viewport();
  const plate = { clientWidth: 1000 };
  const save = vi.fn();
  const pan = new Pan(viewport as unknown as HTMLElement, false, save);
  pan.use(plate as HTMLElement, 836, null);
  frames.splice(0).forEach((frame) => frame(0));

  viewport.scrollLeft = 610;
  viewport.dispatchEvent(new Event('scroll'));
  expect(save).toHaveBeenCalledOnce();
  const portraitCentre = pan.view.x + pan.view.width / 2;

  viewport.clientWidth = viewport.scrollWidth = plate.clientWidth = 844;
  viewport.scrollLeft = viewport.scrollLeft;
  pan.layout();
  viewport.dispatchEvent(new Event('scroll'));
  expect(viewport.scrollLeft).toBe(0);
  expect(save).toHaveBeenCalledOnce();

  viewport.clientWidth = 390;
  viewport.scrollWidth = plate.clientWidth = 1000;
  pan.layout();
  expect(viewport.scrollLeft).toBeCloseTo(610);
  expect(pan.view.x + pan.view.width / 2).toBeCloseTo(portraitCentre);
});

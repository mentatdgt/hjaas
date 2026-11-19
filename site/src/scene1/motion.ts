// Shared motion vocabulary for the scene's UI: one family of curves, so everything feels related.
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { flags } from './flags';

gsap.registerPlugin(CustomEase);
if (flags.slow && flags.slow > 0) gsap.globalTimeline.timeScale(1 / flags.slow);

// The same two curves as --hj-ease-out and --hj-ease-in-out in scene.css.
export const EASE_OUT = CustomEase.create('hj.out', '0.23, 1, 0.32, 1');
export const EASE_IN_OUT = CustomEase.create('hj.inOut', '0.77, 0, 0.175, 1');
export const CSS_EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

const query = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export function reducedMotion(): boolean {
  return query?.matches ?? false;
}

export function onReducedMotionChange(listener: (reduced: boolean) => void): () => void {
  if (!query) return () => {};
  const handler = (event: MediaQueryListEvent): void => listener(event.matches);
  query.addEventListener('change', handler);
  return () => query.removeEventListener('change', handler);
}

export { gsap };

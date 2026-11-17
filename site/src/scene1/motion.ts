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
export const CSS_EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';

/** A spring that settles with almost no bounce (damping ratio 0.82, about 1% overshoot). */
export function settle(t: number): number {
  const zeta = 0.82;
  const omega = 12;
  const damped = omega * Math.sqrt(1 - zeta * zeta);
  const decay = Math.exp(-zeta * omega * t);
  return 1 - decay * (Math.cos(damped * t) + ((zeta * omega) / damped) * Math.sin(damped * t));
}

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

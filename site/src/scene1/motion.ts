// Shared motion vocabulary for the scene's UI: one family of curves, so everything feels related.

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

// The same curves as in scene.css, for GSAP.
export const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
export const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';

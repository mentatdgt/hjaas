// The glint: one diagonal highlight that sweeps across metal. The logo and the counter's rim share it,
// so the two read as the same object family.
import { CSS_EASE_IN_OUT, reducedMotion } from './motion';

export const GLINT_MS = 650;

/**
 * Sweeps `bar` from `fromPx` to `toPx` (its own translateX, in CSS px). The bar is invisible at rest.
 * Runs on the compositor (Web Animations, transform only). Restarting mid-sweep is safe.
 */
export function sweepGlint(bar: HTMLElement, fromPx: number, toPx: number): void {
  if (reducedMotion()) return;
  for (const running of bar.getAnimations()) running.cancel();
  bar.animate(
    [
      { transform: `translateX(${fromPx}px) skewX(-20deg)`, opacity: 1 },
      { transform: `translateX(${toPx}px) skewX(-20deg)`, opacity: 1 },
    ],
    // Ease-in-out that is fast in the middle: the light catches, flashes across, and lets go.
    { duration: GLINT_MS, easing: CSS_EASE_IN_OUT },
  );
}

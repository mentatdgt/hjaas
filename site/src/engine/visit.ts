// What one visit remembers of its paintings, and what a tap on a tab means while one is under way. Kept in memory
// for as long as the page lives and never saved: every visit opens with a painting, and every scene's first
// appearance in it is one (reviews/paint-every-switch.md).

/** A scene left this soon into its first painting was never really shown: the next time it is painted in full again. */
export const GLIMPSE_S = 1;
/** A second tap on a tab this soon after its scene's first stroke is a double tap, not a wish to skip. */
export const DOUBLE_TAP_S = 0.4;

export class Visit {
  private readonly painted = new Set<string>();

  /** The scene has not been painted in this visit: it gets its full painting. Otherwise a brush-over. */
  isNew(scene: string): boolean {
    return !this.painted.has(scene);
  }

  /** The scene's picture has been seen finished. */
  finished(scene: string): void {
    this.painted.add(scene);
  }

  /** The scene was left for another, `seconds` into its painting. True if it counts as painted. */
  left(scene: string, seconds: number): boolean {
    if (seconds >= GLIMPSE_S) this.painted.add(scene);
    return this.painted.has(scene);
  }
}

/**
 * A tap on a scene's tab. `brushing`: how long a brush has been at work in the window, in seconds; null when it is
 * a fade that is under way; undefined when nothing is. Finish: jump to the finished picture.
 */
export function tabFinishes(tab: string, current: string | undefined, wanted: string, brushing: number | null | undefined): boolean {
  // Only the tab of the scene being painted, and only if no other has been asked for since.
  if (tab !== current || wanted !== current || brushing === undefined) return false;
  return brushing === null || brushing > DOUBLE_TAP_S;
}

// What a tap on "Reset mushrooms" means: the first one asks, the second one resets
// (reviews/copy-round-2-build.md, reviews/favicon-title-build.md).

/** How long "Tap again to reset" waits for the second tap. */
export const RESET_WAIT_MS = 4000;
/** A second tap sooner than this after the first is an accidental double tap. */
export const RESET_GAP_MS = 500;

/**
 * `armedAt`: when the first tap came, undefined if none is waiting for its second. `at`: when this one came. Both are
 * the events' own times, so that a second tap kept waiting by a busy page is still known for a double tap.
 */
export function resetTap(armedAt: number | undefined, at: number): 'arm' | 'ignore' | 'reset' {
  if (armedAt === undefined) return 'arm';
  return at - armedAt < RESET_GAP_MS ? 'ignore' : 'reset';
}

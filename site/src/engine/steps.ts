// The small vocabulary every character animation is written in: a pose, and how long to hold it.

export interface Step {
  pose: string;
  ms: number;
  /**
   * Poses that may be shown shortly after this one and are not kept in memory all the time (clip frames:
   * see reel.ts). The player passes the list on as each step begins, so they are decoded by the time they
   * are needed. Left out by routines whose every pose is always ready.
   */
  soon?: readonly string[];
  /**
   * A long hold that may be cut short: when a reaction is waiting, it ends once it has lasted this many ms
   * (clips.ts: a hold away from the rest pose, with a way home after it).
   */
  brief?: number;
  /**
   * Dissolve into this pose from the one before it, over this many ms at the start of the step: a true
   * cross-dissolve of the two drawings (routine.json's `fade_ms`). Left out: an instant cut.
   */
  fade?: number;
}

export type Rng = () => number;

/** Small seeded generator (mulberry32) for repeatable QA runs; the live site uses Math.random. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Paused, or reduced motion: she holds her rest pose. The player keeps ticking, so a find is still
 * answered and the routine picks up again within a fifth of a second of being asked to.
 */
export function* holdSchedule(rest: string): Generator<Step, never> {
  for (;;) yield { pose: rest, ms: 200 };
}

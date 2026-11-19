// The small vocabulary every character animation is written in: a pose, and how long to hold it.

export interface Step {
  pose: string;
  ms: number;
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

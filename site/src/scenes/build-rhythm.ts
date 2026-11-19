// Scene 1's idle routine: the hammer rhythm, ported from schedule() in tools/preview_timing.py. The site
// never plays the frames at a fixed rate: every swing is rolled fresh, so the loop never repeats.
// (It stays as code, not a routine manifest, so that it keeps matching the script it was ported from.)

import type { Rng, Step } from '../engine/steps';

type Range = readonly [number, number];

const CONTACT = 'frame_01';
const LIFT = 'frame_02';
const WIND_UP = 'frame_03';
const DOWN_SWING = 'frame_04';

// Milliseconds per pose.
const SWING: ReadonlyArray<readonly [string, Range]> = [
  [CONTACT, [260, 460]],
  [LIFT, [110, 150]],
  [WIND_UP, [240, 420]],
  [DOWN_SWING, [60, 80]], // kept snappy for impact
];
const TAP: ReadonlyArray<readonly [string, Range]> = [
  [CONTACT, [160, 220]], // small tap: contact -> lift -> contact
  [LIFT, [80, 100]],
];
const PAUSE: Range = [1100, 2000]; // stop and look at the work
const BLINK: ReadonlyArray<Step> = [
  { pose: 'blink_half', ms: 40 },
  { pose: 'blink_closed', ms: 70 },
  { pose: 'blink_half', ms: 40 },
];
const BLINK_MS = 150;

const randint = (rnd: Rng, [lo, hi]: Range): number => lo + Math.floor(rnd() * (hi - lo + 1));
const uniform = (rnd: Rng, lo: number, hi: number): number => lo + rnd() * (hi - lo);

/** Hold the contact frame for ms, slipping a blink in the middle. Blinks only ever happen here. */
function* withBlink(ms: number, rnd: Rng): Generator<Step> {
  const pre = randint(rnd, [Math.floor(ms * 0.25), Math.floor(ms * 0.55)]);
  yield { pose: CONTACT, ms: pre };
  yield* BLINK;
  yield { pose: CONTACT, ms: Math.max(ms - pre - BLINK_MS, 40) };
}

/** The endless hammer loop. */
export function* hammerSchedule(rnd: Rng = Math.random): Generator<Step, never> {
  let swingsUntilPause = randint(rnd, [3, 6]);
  for (;;) {
    if (swingsUntilPause === 0) {
      yield* withBlink(randint(rnd, PAUSE), rnd);
      swingsUntilPause = randint(rnd, [3, 6]);
      continue;
    }
    if (rnd() < 0.2) {
      // Occasionally a couple of quick taps before the swing.
      for (let taps = randint(rnd, [1, 2]); taps > 0; taps--) {
        for (const [pose, range] of TAP) yield { pose, ms: randint(rnd, range) };
      }
    }
    const tempo = uniform(rnd, 0.9, 1.15); // each swing a little faster or slower
    for (const [pose, range] of SWING) {
      const ms = Math.floor(randint(rnd, range) * tempo);
      if (pose === CONTACT && ms > 330 && rnd() < 0.3) yield* withBlink(ms, rnd);
      else yield { pose, ms };
    }
    swingsUntilPause--;
  }
}

export const CONTACT_POSE = CONTACT;

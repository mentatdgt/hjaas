// The routine engine, tested with a small made-up manifest: scene 1's frame names, rearranged into two
// loops with a transition between them. `npm test` runs it.
import { describe, expect, it } from 'vitest';
import { checkRoutine, routineFrames, routineSchedule, type RoutineManifest } from './routine';
import { seeded, type Step } from './steps';

const fake: RoutineManifest = {
  rest: 'frame_01',
  order: ['swing', 'study'],
  loops: {
    swing: {
      frames: [
        { frame: 'frame_01', ms: [300, 450] },
        { frame: 'frame_02', ms: 120 },
        { frame: 'frame_03', ms: [240, 420] },
      ],
      cycles: [2, 4],
      pause: { frame: 'frame_01', ms: [1000, 2000] },
    },
    study: {
      frames: [
        { frame: 'frame_04', ms: [600, 900] },
        { frame: 'frame_02', ms: [200, 300] },
      ],
      cycles: 1,
    },
  },
  transitions: {
    'swing>study': [{ frame: 'K1', ms: 80 }],
    'study>swing': [
      { frame: 'K2', ms: 60 },
      { frame: 'K1', ms: 60 },
    ],
  },
  blink: {
    on: ['frame_01'],
    every: [3000, 6000],
    frames: [
      { frame: 'blink_half', ms: 40 },
      { frame: 'blink_closed', ms: 70 },
      { frame: 'blink_half', ms: 40 },
    ],
  },
};

const take = (manifest: RoutineManifest, n: number, seed = 7): Step[] => {
  const routine = routineSchedule(manifest, seeded(seed));
  return Array.from({ length: n }, () => routine.next().value);
};

/** The steps with blinks taken back out: a blink and the hold around it become one hold again. */
const withoutBlinks = (steps: Step[]): Step[] => {
  const out: Step[] = [];
  for (let i = 0; i < steps.length; i++) {
    if (steps[i + 1]?.pose === 'blink_half' && steps[i + 4]) {
      out.push({ pose: steps[i].pose, ms: steps.slice(i, i + 5).reduce((sum, step) => sum + step.ms, 0) });
      i += 4;
    } else {
      out.push(steps[i]);
    }
  }
  return out;
};

describe('routineSchedule', () => {
  it('only ever shows frames the manifest names, each for a positive time', () => {
    const named = new Set(routineFrames(fake));
    for (const step of take(fake, 2000)) {
      expect(named.has(step.pose)).toBe(true);
      expect(step.ms).toBeGreaterThan(0);
    }
  });

  it('plays the loops in order, the right number of times, with the transitions between them', () => {
    const steps = withoutBlinks(take(fake, 3000)).map((step) => step.pose);
    let i = 0;
    let rounds = 0;
    while (i + 20 < steps.length) {
      let swings = 0;
      while (steps[i] === 'frame_01' && steps[i + 1] === 'frame_02' && steps[i + 2] === 'frame_03') {
        swings++;
        i += 3;
      }
      expect(swings).toBeGreaterThanOrEqual(2);
      expect(swings).toBeLessThanOrEqual(4);
      // The pause, the transition out, one round of the second loop, the transition back.
      expect(steps.slice(i, i + 6)).toEqual(['frame_01', 'K1', 'frame_04', 'frame_02', 'K2', 'K1']);
      i += 6;
      rounds++;
    }
    expect(rounds).toBeGreaterThan(50);
  });

  it('rolls every hold inside its range', () => {
    const steps = withoutBlinks(take(fake, 3000));
    const ranges: Record<string, Array<[number, number]>> = {
      frame_01: [[300, 450], [1000, 2000]],
      frame_02: [[120, 120], [200, 300]],
      frame_03: [[240, 420]],
      frame_04: [[600, 900]],
      K1: [[80, 80], [60, 60]],
      K2: [[60, 60]],
    };
    for (const step of steps.slice(0, -5)) {
      const fits = ranges[step.pose].some(([lo, hi]) => step.ms >= lo - 1e-6 && step.ms <= hi + 1e-6);
      expect(fits, `${step.pose} held ${step.ms} ms`).toBe(true);
    }
  });

  it('blinks only inside a hold on a frame that allows it, and comes back to that frame', () => {
    const steps = take(fake, 4000);
    let blinks = 0;
    for (let i = 0; i < steps.length - 4; i++) {
      if (steps[i].pose !== 'blink_half' || steps[i - 1]?.pose === 'blink_closed') continue;
      blinks++;
      expect(steps[i - 1].pose).toBe('frame_01');
      expect(steps.slice(i, i + 3).map((step) => [step.pose, step.ms])).toEqual([
        ['blink_half', 40],
        ['blink_closed', 70],
        ['blink_half', 40],
      ]);
      expect(steps[i + 3].pose).toBe('frame_01');
    }
    expect(blinks).toBeGreaterThan(20);
  });

  it('spaces blinks by about the time asked for', () => {
    const steps = take(fake, 6000);
    let clock = 0;
    const times: number[] = [];
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].pose === 'blink_closed') times.push(clock);
      clock += steps[i].ms;
    }
    const gaps = times.slice(1).map((time, i) => time - times[i]);
    // Never sooner than the shortest interval. She can only blink on a long enough hold of frame_01, so a
    // blink can be late by the wait for the next such hold, but not by more than a few seconds.
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(3000 - 150);
    expect(Math.max(...gaps)).toBeLessThan(6000 + 7000);
    const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    expect(mean).toBeGreaterThan(3500);
    expect(mean).toBeLessThan(9000);
  });

  it('keeps the length of a hold when a blink is slipped into it', () => {
    const noBlink: RoutineManifest = { ...fake, blink: undefined };
    const plain = take(noBlink, 400, 3).reduce((sum, step) => sum + step.ms, 0);
    expect(plain).toBeGreaterThan(0);
    for (const step of withoutBlinks(take(fake, 3000)).filter((s) => s.pose === 'frame_01').slice(0, -5)) {
      expect(step.ms).toBeLessThanOrEqual(2000 + 1e-6);
    }
  });

  it('is repeatable with a seed, and different with another', () => {
    expect(take(fake, 300, 5)).toEqual(take(fake, 300, 5));
    expect(take(fake, 300, 5)).not.toEqual(take(fake, 300, 6));
  });

  it('cuts straight from loop to loop when there is no transition', () => {
    const cut: RoutineManifest = { ...fake, transitions: undefined, blink: undefined };
    const steps = take(cut, 600).map((step) => step.pose);
    expect(steps).not.toContain('K1');
    expect(steps).not.toContain('K2');
  });
});

describe('routineFrames', () => {
  it('lists every frame to load, once', () => {
    expect(routineFrames(fake).sort()).toEqual(
      ['K1', 'K2', 'blink_closed', 'blink_half', 'frame_01', 'frame_02', 'frame_03', 'frame_04'].sort(),
    );
  });
});

describe('checkRoutine', () => {
  it('accepts the fake manifest', () => {
    expect(checkRoutine(fake)).toEqual([]);
  });

  it('says what is wrong, in words', () => {
    expect(checkRoutine(null)).toHaveLength(1);
    expect(checkRoutine({ ...fake, order: ['swing', 'dance'] }).join(' ')).toContain('"dance"');
    expect(checkRoutine({ ...fake, rest: '' }).join(' ')).toContain('"rest"');
    expect(checkRoutine({ ...fake, transitions: { 'swing>nowhere': [] } }).join(' ')).toContain('swing>nowhere');
    expect(checkRoutine({ ...fake, loops: { ...fake.loops, study: { frames: [], cycles: 1 } } }).join(' ')).toContain('"study"');
    expect(checkRoutine({ ...fake, blink: { on: [], every: 4000, frames: fake.blink!.frames } }).join(' ')).toContain('blink.on');
  });

  it('refuses to play a broken manifest', () => {
    expect(() => routineSchedule({ ...fake, order: [] }).next()).toThrow(/order/);
  });
});

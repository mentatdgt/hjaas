// The clip routine reader, tested on the manifests Wren delivered for scene 2 (copied into public/ by
// `npm run assets`), so a change to those files that the engine cannot play fails here first.
import { describe, expect, it } from 'vitest';
import framesJson from '../../public/assets/scene2/rachel/frames.json';
import routineJson from '../../public/assets/scene2/rachel/routine.json';
import { checkClips, clipPose, clipReaction, clipSchedule, clipsInUse, type ClipFrames, type ClipRoutine, type Signal } from './clips';
import { seeded, type Step } from './steps';

const frames = framesJson as unknown as ClipFrames;
const routine = routineJson as unknown as ClipRoutine;
const REST = 'A1_mist_aim';

const take = (n: number, seed = 7, has: (clip: string) => boolean = () => true): Step[] => {
  const schedule = clipSchedule(frames, routine, seeded(seed), has);
  return Array.from({ length: n }, () => schedule.next().value);
};
const clipOf = (pose: string): string => pose.split('#')[0];
const indexOf = (pose: string): number => Number(pose.split('#')[1]);
const lengths = Object.fromEntries(Object.entries(frames.clips).map(([name, clip]) => [name, clip.frames.length]));

describe("scene 2's manifests", () => {
  it('can be played', () => {
    expect(checkClips(frames, routine)).toEqual([]);
  });

  it('draws her canvas at plate (680, 210), 490 × 690', () => {
    expect(frames.canvas).toMatchObject({ w: 980, h: 1380, plate_x: 680, plate_y: 210, plate_w: 490, plate_h: 690 });
  });

  it('loads the routine clips before the reaction clips', () => {
    expect(clipsInUse(routine)).toEqual({ routine: ['mist_to_write', 'write_loop'], reaction: ['look_up', 'thumbs_up'] });
  });
});

describe('clipSchedule', () => {
  it('only shows stills and clip frames that exist, each for a positive time', () => {
    for (const step of take(3000)) {
      expect(step.ms).toBeGreaterThan(0);
      if (step.pose.includes('#')) {
        expect(indexOf(step.pose)).toBeGreaterThanOrEqual(0);
        expect(indexOf(step.pose)).toBeLessThan(lengths[clipOf(step.pose)]);
      } else {
        expect(step.pose in frames.stills).toBe(true);
      }
    }
  });

  it('follows the routine: 2 to 4 sprays, a pause, into writing, 1 or 2 rounds, and back', () => {
    const steps = take(6000).filter((step) => step.pose !== 'A1_blink_half');
    // Merge the two halves of a hold that a blink was taken out of.
    const poses: string[] = [];
    for (const step of steps) if (poses[poses.length - 1] !== step.pose || step.pose.includes('#')) poses.push(step.pose);
    let i = 0;
    let rounds = 0;
    while (i + 200 < poses.length) {
      let sprays = 0;
      while (poses[i] === REST && poses[i + 1] === 'A2_mist_squeeze' && poses[i + 2] === 'A3_mist_lift') {
        sprays++;
        i += 3;
      }
      expect(sprays).toBeGreaterThanOrEqual(2);
      expect(sprays).toBeLessThanOrEqual(4);
      expect(poses[i]).toBe(REST); // the pause
      i++;
      for (let f = 0; f < lengths.mist_to_write; f++) expect(poses[i++]).toBe(clipPose('mist_to_write', f));
      let writes = 0;
      while (poses[i] === clipPose('write_loop', 0)) {
        for (let f = 0; f < lengths.write_loop; f++) expect(poses[i++]).toBe(clipPose('write_loop', f));
        writes++;
      }
      expect(writes).toBeGreaterThanOrEqual(1);
      expect(writes).toBeLessThanOrEqual(2);
      for (let f = lengths.mist_to_write - 1; f >= 0; f--) expect(poses[i++]).toBe(clipPose('mist_to_write', f));
      expect(poses[i]).toBe(REST); // the hold after coming back, which runs into the next round's first aim
      rounds++;
    }
    expect(rounds).toBeGreaterThan(20);
  });

  it('respects the ranges: sprays, the pause, and the clips at their frame times', () => {
    const steps = take(4000);
    for (const step of steps) {
      if (step.pose === 'A2_mist_squeeze') expect(step.ms >= 280 && step.ms <= 360).toBe(true);
      if (step.pose === 'A3_mist_lift') expect(step.ms >= 380 && step.ms <= 480).toBe(true);
      if (clipOf(step.pose) === 'mist_to_write' && step.pose.includes('#')) expect(step.ms).toBe(83);
      if (clipOf(step.pose) === 'write_loop' && step.pose.includes('#')) expect(step.ms).toBe(125);
      if (step.pose === 'A1_blink_half') expect(step.ms).toBe(50);
    }
    // One spray (aim, squeeze, lift) takes 1.06 to 1.49 s.
    for (let i = 0; i + 2 < steps.length; i++) {
      if (steps[i].pose === REST && steps[i + 1].pose === 'A2_mist_squeeze' && steps[i - 1]?.pose === 'A3_mist_lift') {
        const spray = steps[i].ms + steps[i + 1].ms + steps[i + 2].ms;
        expect(spray).toBeGreaterThanOrEqual(1060);
        expect(spray).toBeLessThanOrEqual(1490);
      }
    }
  });

  it('blinks only inside a marked hold on A1, about every 3 to 6 s of that pose being available', () => {
    const steps = take(8000);
    let clock = 0;
    const blinks: number[] = [];
    steps.forEach((step, i) => {
      if (step.pose === 'A1_blink_half') {
        blinks.push(clock);
        expect(steps[i - 1].pose).toBe(REST);
        expect(steps[i + 1].pose).toBe(REST);
        // A marked hold is 600 ms or longer; the sprays' own aims (400 to 650 ms) are never split.
        expect(steps[i - 1].ms + step.ms + steps[i + 1].ms).toBeGreaterThanOrEqual(600 - 1e-6);
      }
      clock += step.ms;
    });
    expect(blinks.length).toBeGreaterThan(40);
    const gaps = blinks.slice(1).map((at, i) => at - blinks[i]);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(3000 - 200);
  });

  it('keeps to her stills until the routine clips have loaded', () => {
    const none = take(400, 3, () => false);
    expect(none.some((step) => step.pose.includes('#'))).toBe(false);
    expect(new Set(none.map((step) => step.pose))).toEqual(new Set([REST, 'A2_mist_squeeze', 'A3_mist_lift', 'A1_blink_half']));
    // One of the two is not enough: the transition without the loop it leads to would strand her.
    expect(take(400, 3, (clip) => clip === 'mist_to_write').some((step) => step.pose.includes('#'))).toBe(false);
  });

  it('is repeatable with a seed', () => {
    expect(take(500, 5)).toEqual(take(500, 5));
    expect(take(500, 5)).not.toEqual(take(500, 6));
  });
});

describe('the reaction entry rule', () => {
  /** Run the routine until `when` says so, then tell it a reaction is waiting and collect the way home. */
  const interrupt = (when: (step: Step) => boolean, seed = 7): { at: Step; home: Step[] } => {
    const schedule = clipSchedule(frames, routine, seeded(seed));
    let signal: Signal;
    let at: Step | null = null;
    const home: Step[] = [];
    for (let i = 0; i < 5000; i++) {
      const step = schedule.next(signal).value;
      if (at) {
        home.push(step);
        if (step.pose === REST) return { at, home };
      } else if (when(step)) {
        at = step;
        signal = 'react';
      }
    }
    throw new Error('never came home');
  };

  it('from the writing loop: finishes the frame, plays mist_to_write in reverse, then rests', () => {
    const { at, home } = interrupt((step) => step.pose === clipPose('write_loop', 9));
    expect(at.pose).toBe(clipPose('write_loop', 9));
    const expected = Array.from({ length: lengths.mist_to_write }, (_, i) => clipPose('mist_to_write', lengths.mist_to_write - 1 - i));
    expect(home.map((step) => step.pose)).toEqual([...expected, REST]);
    expect(home.slice(0, -1).every((step) => step.ms === 83)).toBe(true);
  });

  it('part-way into the transition: runs it back from where it had got to', () => {
    const { home } = interrupt((step) => step.pose === clipPose('mist_to_write', 6));
    expect(home.map((step) => step.pose)).toEqual([5, 4, 3, 2, 1, 0].map((i) => clipPose('mist_to_write', i)).concat(REST));
  });

  it('on the way back from writing: carries on to the end', () => {
    // Skip the forward pass through frame 20, and interrupt at frame 20 coming back.
    let seen = 0;
    const { home } = interrupt((step) => step.pose === clipPose('mist_to_write', 20) && ++seen === 2);
    expect(home[0].pose).toBe(clipPose('mist_to_write', 19));
    expect(home.length).toBe(21);
    expect(home[home.length - 1].pose).toBe(REST);
  });

  it('between sprays: straight to the aim', () => {
    expect(interrupt((step) => step.pose === 'A2_mist_squeeze').home.map((step) => step.pose)).toEqual([REST]);
    expect(interrupt((step) => step.pose === 'A3_mist_lift').home.map((step) => step.pose)).toEqual([REST]);
  });

  it('starts the routine again from the top afterwards', () => {
    const schedule = clipSchedule(frames, routine, seeded(7));
    let step = schedule.next().value;
    while (step.pose !== clipPose('write_loop', 3)) step = schedule.next().value;
    do step = schedule.next('react').value;
    while (step.pose !== REST);
    // The player plays the reaction here. Then:
    const after = Array.from({ length: 4 }, () => schedule.next().value.pose);
    expect(after.slice(0, 3)).toEqual([REST, 'A2_mist_squeeze', 'A3_mist_lift']);
  });
});

describe('clipReaction', () => {
  const reaction = clipReaction(frames, routine)!;

  it('plays look up, beam, thumbs-up, hold, and back, as timed in routine.json', () => {
    const poses = reaction.steps.map((step) => step.pose);
    const up = lengths.look_up;
    const thumbs = lengths.thumbs_up;
    expect(poses.slice(0, up)).toEqual(Array.from({ length: up }, (_, i) => clipPose('look_up', i)));
    expect(poses.slice(up, up + thumbs)).toEqual(Array.from({ length: thumbs }, (_, i) => clipPose('thumbs_up', i)));
    expect(poses[up + thumbs]).toBe('K2_thumbs');
    expect(poses[poses.length - 1]).toBe(REST);
    // The first seven frames of the look up are held 90 ms, the rest 70; the last one 250 ms longer.
    expect(reaction.steps.slice(0, 7).every((step) => step.ms === 90)).toBe(true);
    expect(reaction.steps.slice(7, up - 1).every((step) => step.ms === 70)).toBe(true);
    expect(reaction.steps[up - 1].ms).toBe(70 + 250);
    expect(reaction.steps.slice(up, up + thumbs).every((step) => step.ms === 75)).toBe(true);
    expect(reaction.steps[up + thumbs].ms).toBe(1100);
    // Back down: thumbs_up then look_up, reversed, at 55 ms.
    expect(poses[up + thumbs + 1]).toBe(clipPose('thumbs_up', thumbs - 1));
    expect(poses[poses.length - 2]).toBe(clipPose('look_up', 0));
    expect(reaction.steps.slice(up + thumbs + 1, -1).every((step) => step.ms === 55)).toBe(true);
    expect(reaction.steps[reaction.steps.length - 1].ms).toBe(300);
  });

  it('takes 5.2 s in all', () => {
    // 7 × 90 + 10 × 70 + 250 + 10 × 75 + 1100 + 10 × 55 + 17 × 55 + 300
    expect(reaction.steps.reduce((sum, step) => sum + step.ms, 0)).toBe(5215);
  });

  it('has the thumbs-up as its one held pose, for paused or reduced motion', () => {
    expect(reaction.still).toEqual([{ pose: 'K2_thumbs', ms: 1100 }]);
  });
});

describe('checkClips', () => {
  it('says what is wrong, in words', () => {
    const broken = { ...routine, routine: [...routine.routine, { clip: 'somersault', ms: 80 }] } as ClipRoutine;
    expect(checkClips(frames, broken).join(' ')).toContain('"somersault"');
    expect(checkClips({ ...frames, stills: {} }, routine).length).toBeGreaterThan(3);
    expect(() => clipSchedule(frames, broken).next()).toThrow(/somersault/);
  });
});

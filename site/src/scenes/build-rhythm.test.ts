// Scene 1's hammer rhythm (build-rhythm.ts): the order of the drawings, how long each is held, where she blinks.
import { describe, expect, it } from 'vitest';
import reaction from '../../public/assets/scene1/rachel/reaction/reaction.json';
import { seeded, type Step } from '../engine/steps';
import { build } from './build';
import { CONTACT_POSE, HAMMER_FRAMES, hammerSchedule } from './build-rhythm';

const take = (n: number, seed = 7): Step[] => {
  const loop = hammerSchedule(seeded(seed));
  return Array.from({ length: n }, () => loop.next().value);
};
const RISE = ['frame_01_02', 'frame_02', 'frame_02_03a', 'frame_02_03ab', 'frame_02_03b', 'frame_03', 'frame_04'];
const TAP = ['frame_01_02', 'frame_02', 'frame_01_02'];
const isBlink = (step: Step): boolean => step.pose.startsWith('blink');

/** What she does between two holds of the contact frame: a list of moves, blinks left out. */
const moves = (steps: Step[]): Step[][] => {
  const out: Step[][] = [];
  let move: Step[] = [];
  for (const step of steps) {
    if (step.pose !== CONTACT_POSE && !isBlink(step)) move.push(step);
    else if (move.length) {
      out.push(move);
      move = [];
    }
  }
  return out;
};
const names = (move: Step[]): string => move.map((step) => step.pose).join(' ');
const ALL = [1, 2, 3, 7, 11].flatMap((seed) => moves(take(6000, seed)));
const swings = ALL.filter((move) => names(move) === RISE.join(' '));
const taps = ALL.filter((move) => names(move) === TAP.join(' '));

describe('the hammer rhythm', () => {
  it('rises through every in-between and falls in one, or taps up to the lift and back: nothing else', () => {
    expect(swings.length).toBeGreaterThan(1000);
    expect(taps.length).toBeGreaterThan(100);
    expect(swings.length + taps.length).toBe(ALL.length);
  });

  it('holds each drawing of a swing as long as it should, at the swing\'s own tempo (0.9 to 1.15)', () => {
    const holds: Array<[number, number]> = [[45, 55], [60, 80], [45, 55], [45, 55], [35, 45], [130, 270], [60, 80]];
    for (const swing of swings) {
      swing.forEach((step, i) => {
        expect(step.ms, step.pose).toBeGreaterThanOrEqual(Math.floor(holds[i][0] * 0.9));
        expect(step.ms, step.pose).toBeLessThanOrEqual(holds[i][1] * 1.15);
      });
    }
    // From leaving the box to the wind-up, about a quarter of a second.
    const rise = swings.map((swing) => swing.slice(0, 5).reduce((sum, step) => sum + step.ms, 0));
    const mean = rise.reduce((a, b) => a + b, 0) / rise.length;
    expect(mean).toBeGreaterThan(250);
    expect(mean).toBeLessThan(275);
  });

  it('a whole swing is about 890 ms before its tempo, as it was without the in-betweens', () => {
    const CONTACT_MS = (260 + 460) / 2;
    const TEMPO = (0.9 + 1.15) / 2;
    const away = swings.map((swing) => swing.reduce((sum, step) => sum + step.ms, 0));
    const whole = away.reduce((a, b) => a + b, 0) / away.length / TEMPO + CONTACT_MS;
    expect(whole).toBeGreaterThan(875);
    expect(whole).toBeLessThan(905);
  });

  it('the reaction goes up and down through the thumb\'s in-betweens in two frames of 60 Hz each', () => {
    const quick = reaction.frames.filter(({ file }) => /B36/.test(file)).map(({ file, ms }) => [file, ms]);
    const [a, b, c] = ['rx_K1_B36.png', 'rx_B36.png', 'rx_B36_B39.png'];
    expect(quick).toEqual([[a, 33], [b, 33], [c, 33], [c, 33], [b, 33], [a, 33]]);
    expect(reaction.frames.filter(({ ms }) => ms > 0 && ms < 33)).toEqual([]);
  });

  it('holds a tap\'s drawings 40, 50 to 70 and 40 ms', () => {
    for (const [up, lift, down] of taps) {
      expect(up.ms).toBe(40);
      expect(lift.ms).toBeGreaterThanOrEqual(50);
      expect(lift.ms).toBeLessThanOrEqual(70);
      expect(down.ms).toBe(40);
    }
  });

  it('a tap is always followed by the contact frame', () => {
    const steps = take(20000);
    let seen = 0;
    for (let i = 4; i < steps.length; i++) {
      if (steps[i - 1].pose !== 'frame_01_02' || steps[i - 2].pose !== 'frame_02') continue;
      seen++;
      expect(steps[i].pose).toBe(CONTACT_POSE);
    }
    expect(seen).toBeGreaterThan(50);
  });

  it('blinks on the contact frame only: half, closed, half, with the contact frame before and after', () => {
    const steps = take(20000);
    let blinks = 0;
    for (let i = 1; i < steps.length - 3; i++) {
      if (!isBlink(steps[i]) || isBlink(steps[i - 1])) continue;
      blinks++;
      expect(steps[i - 1].pose).toBe(CONTACT_POSE);
      expect(steps.slice(i, i + 3).map((step) => [step.pose, step.ms])).toEqual([['blink_half', 40], ['blink_closed', 70], ['blink_half', 40]]);
      expect(steps[i + 3].pose).toBe(CONTACT_POSE);
    }
    expect(blinks).toBeGreaterThan(100);
  });

  it('shows the drawings the scene loads, all of them and no others', () => {
    const { character } = build;
    expect(character?.kind).toBe('frames');
    expect(character?.kind === 'frames' && character.frames).toEqual(HAMMER_FRAMES);
    expect(new Set(take(6000).map((step) => step.pose))).toEqual(new Set(HAMMER_FRAMES));
  });

  it('every drawing kept as a patch lies over a whole one, in both sizes, and is the same six', () => {
    const { character } = build;
    if (character?.kind !== 'frames') throw new Error('Build is drawn from frames');
    const sets = [character.dir, character.small!.dir].map((dir) => character.patches![dir]);
    expect(Object.keys(sets[0])).toEqual(['frame_01_02', 'frame_02_03a', 'frame_02_03ab', 'frame_02_03b', 'reaction/rx_K1_B36.png', 'reaction/rx_B36_B39.png']);
    expect(Object.keys(sets[1])).toEqual(Object.keys(sets[0]));
    for (const set of sets) for (const [pose, patch] of Object.entries(set)) {
      expect(patch.base in set, pose).toBe(false);
      if (!pose.startsWith('reaction/')) expect(character.frames).toContain(patch.base);
      expect(Math.min(patch.x, patch.y), pose).toBeGreaterThanOrEqual(0);
    }
  });
});

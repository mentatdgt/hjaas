// Scene 2's routine manifest is a stub until Rachel's lab frames exist. These tests hold it to the target
// timings in reviews/scene-2-build.md, so the stub is at least a playable, correctly paced routine.
import { describe, expect, it } from 'vitest';
import stub from '../../public/assets/scene2/rachel/routine.json';
import { checkRoutine, routineFrames, routineSchedule, type RoutineManifest } from '../engine/routine';
import { seeded, type Step } from '../engine/steps';
import { LAB_CAST, grow } from './grow';

const manifest = stub as unknown as RoutineManifest;

describe("scene 2's routine stub", () => {
  it('can be played, and rests on the frame the cast config names', () => {
    expect(checkRoutine(manifest)).toEqual([]);
    expect(manifest.rest).toBe(LAB_CAST.rest);
  });

  it("uses only task 017's poses", () => {
    expect(routineFrames(manifest).sort()).toEqual(['A1', 'A1_blink_half', 'A2', 'A3', 'B1', 'B2'].sort());
  });

  it('is unhurried: sprays of 0.9 to 1.3 s, 2 to 4 at a time, a 1 to 2 s pause, then 4 to 7 s of writing', () => {
    const routine = routineSchedule({ ...manifest, blink: undefined }, seeded(4));
    const steps: Step[] = Array.from({ length: 4000 }, () => routine.next().value);
    let i = 0;
    let rounds = 0;
    while (i + 20 < steps.length) {
      let sprays = 0;
      while (steps[i].pose === 'A1' && steps[i + 1].pose === 'A2' && steps[i + 2].pose === 'A3') {
        const spray = steps[i].ms + steps[i + 1].ms + steps[i + 2].ms;
        expect(spray).toBeGreaterThanOrEqual(900);
        expect(spray).toBeLessThanOrEqual(1300);
        sprays++;
        i += 3;
      }
      expect(sprays).toBeGreaterThanOrEqual(2);
      expect(sprays).toBeLessThanOrEqual(4);
      expect(steps[i].pose).toBe('A1');
      expect(steps[i].ms).toBeGreaterThanOrEqual(1000);
      expect(steps[i].ms).toBeLessThanOrEqual(2000);
      expect(steps.slice(i + 1, i + 4).map((step) => step.pose)).toEqual(['B1', 'B2', 'B1']);
      const writing = steps[i + 1].ms + steps[i + 2].ms + steps[i + 3].ms;
      expect(writing).toBeGreaterThanOrEqual(4000);
      expect(writing).toBeLessThanOrEqual(7000);
      i += 4;
      rounds++;
    }
    expect(rounds).toBeGreaterThan(100);
  });

  it('blinks only on A1', () => {
    const routine = routineSchedule(manifest, seeded(9));
    const steps: Step[] = Array.from({ length: 3000 }, () => routine.next().value);
    let blinks = 0;
    for (let i = 1; i < steps.length - 1; i++) {
      if (steps[i].pose !== 'A1_blink_half') continue;
      blinks++;
      expect(steps[i - 1].pose).toBe('A1');
      expect(steps[i + 1].pose).toBe('A1');
    }
    expect(blinks).toBeGreaterThan(30);
  });
});

describe('scene 2', () => {
  it('has ten hiding spots with their own ids, left to right, inside the plate', () => {
    expect(grow.spots).toHaveLength(10);
    expect(new Set(grow.spots.map((spot) => spot.id)).size).toBe(10);
    const xs = grow.spots.map((spot) => spot.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    for (const spot of grow.spots) {
      expect(spot.x).toBeGreaterThan(0);
      expect(spot.x).toBeLessThan(1672);
      expect(spot.y).toBeLessThanOrEqual(941);
    }
    // Spread across the width, so a phone visitor has to pan both ways from the opening view.
    expect(Math.min(...xs)).toBeLessThan(400);
    expect(Math.max(...xs)).toBeGreaterThan(1300);
  });

  it('is painted in as long as scene 1 is', () => {
    expect(Math.max(...grow.strokes.map((stroke) => stroke.at + stroke.takes))).toBeCloseTo(4.32, 2);
  });
});

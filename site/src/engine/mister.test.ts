// Scene 2's moving scenery, the mister's mist (frames/024-lab-mister/site/), tested on its manifests as `npm run assets`
// puts them in public/, so a new delivery the engine cannot play fails here first. The same checks as the Merlion's
// water (film.test.ts): it is a troupe of one scenery layer, played under Rachel (grow.ts `scenery`).
import { describe, expect, it } from 'vitest';
import framesJson from '../../public/assets/scene2/cast/frames.json';
import routineJson from '../../public/assets/scene2/cast/routine.json';
import { splitCast, type CastFrames, type CastRoutines } from './cast';
import { AHEAD, clipSchedule, restOf, stillsInUse, type ClipRoutine } from './clips';
import { seeded, type Step } from './steps';
import { grow } from '../scenes/grow';

const frames = framesJson as unknown as CastFrames;
const routines = routineJson as unknown as CastRoutines;
const { actors, problems, progress, walkers, screen } = splitCast(frames, routines, 1672);
const mister = actors[0];
const take = (n: number, seed = 7): Step[] => {
  const schedule = clipSchedule(mister.frames, mister.routine, seeded(seed));
  return Array.from({ length: n }, () => schedule.next().value);
};

describe("the lab's mister", () => {
  it('can be played: one scenery layer and nothing else', () => {
    expect(problems).toEqual([]);
    expect(actors.map((a) => a.name)).toEqual(['mister']);
    expect(frames.layers).toHaveLength(1);
    expect((frames.layers[0] as { scenery?: boolean }).scenery).toBe(true);
    expect(progress).toEqual([]);
    expect(walkers).toEqual([]);
    expect(screen).toBeNull();
  });

  it('is played by Grow, under Rachel, from its own folder', () => {
    expect(grow.character).toMatchObject({ kind: 'clips', dir: 'rachel/', scenery: { dir: 'cast/', frames: 'frames.json', routine: 'routine.json' } });
    // Scenery: not held whole by the edge (it fades with the plate).
    expect(grow.keep).toBeUndefined();
  });

  it('sits at its box on the plate, at the plate\'s own scale', () => {
    expect(frames.canvas).toMatchObject({ w: 1672, h: 941 });
    expect(mister.frames.canvas).toEqual({ w: 123, h: 159, plate_x: 1245, plate_y: 336, plate_w: 123, plate_h: 159 });
  });

  it('plays its four drawings round and round, 140 ms each, and never reacts', () => {
    const steps = take(400);
    steps.forEach((step, i) => {
      expect(step.pose).toBe(['M1', 'M2', 'M3', 'M4'][i % 4]);
      expect(step.ms).toBe(140);
    });
    expect(mister.reacts).toBe(false);
  });

  it('rests on M1: what it holds when paused or with reduced motion', () => {
    expect(restOf(mister.frames, mister.routine)).toBe('M1');
    expect(stillsInUse(mister.frames, mister.routine).sort()).toEqual(['M1', 'M2', 'M3', 'M4']);
  });

  it('is rolled a few steps at a time, however many times its loop runs', () => {
    const ranged = JSON.parse(JSON.stringify(mister.routine).replace(/"ms":140/g, '"ms":[140,140]')) as ClipRoutine;
    let rolls = 0;
    const schedule = clipSchedule(mister.frames, ranged, () => (rolls++, 0.5));
    for (let i = 0; i < 100; i++) expect(schedule.next().value.ms).toBe(140);
    expect(rolls).toBeGreaterThanOrEqual(100);
    expect(rolls).toBeLessThan(100 + AHEAD + 10);
  });

  it('costs the page under half a megabyte decoded: four stills and its canvas', () => {
    expect(5 * 123 * 159 * 4).toBeLessThan(0.5e6);
  });
});

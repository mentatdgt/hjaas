// The prize (BIBLE section 1, changed 2026-11-21): the Contact button waits for every mushroom in every
// scene, worked out from the finds and never from a saved flag. And `?all=N`, the QA preset that fills the
// first N finds of the whole site.
import { describe, expect, it } from 'vitest';
import { SCENES } from '../scenes';
import { noteFor, presetAll, siteCount, unlockedBy, type HuntScene, type NoteCopy } from './state';

// Five made-up scenes of ten spots each, as the site will have.
const FIVE: HuntScene[] = ['build', 'grow', 'design', 'film', 'set'].map((id) => ({ id, spots: Array.from({ length: 10 }, (_, i) => ({ id: `${id}-${i}` })) }));
const finds = (scenes: readonly HuntScene[], counts: Record<string, number>) => {
  const sets = new Map(scenes.map((scene) => [scene.id, new Set(scene.spots.slice(0, counts[scene.id] ?? 0).map((spot) => spot.id))]));
  return (id: string): ReadonlySet<string> => sets.get(id) ?? new Set();
};
const all = (n: number) => Object.fromEntries(FIVE.map((scene) => [scene.id, n]));

describe('the unlock', () => {
  it('stays locked while any scene has a mushroom left, however many scenes are done', () => {
    expect(unlockedBy(FIVE, finds(FIVE, {}))).toBe(false);
    expect(unlockedBy(FIVE, finds(FIVE, { build: 10 }))).toBe(false);
    expect(unlockedBy(FIVE, finds(FIVE, { ...all(10), set: 9 }))).toBe(false);
  });

  it('opens when every mushroom of every scene is found', () => {
    expect(unlockedBy(FIVE, finds(FIVE, all(10)))).toBe(true);
    expect(siteCount(FIVE, finds(FIVE, all(10)))).toEqual({ found: 50, total: 50 });
  });

  it('counts only spots the scene has: a stray id (a spot since replaced, another scene\'s) never completes it', () => {
    const stray = (id: string): ReadonlySet<string> => new Set([...Array.from({ length: 9 }, (_, i) => `${id}-${i}`), 'somewhere-else']);
    expect(siteCount(FIVE, stray)).toEqual({ found: 45, total: 50 });
    expect(unlockedBy(FIVE, stray)).toBe(false);
  });

  it('is never earned by a site with no mushrooms', () => {
    expect(unlockedBy([], () => new Set())).toBe(false);
  });

  it('holds for the scenes the site has now', () => {
    const everything = (id: string): ReadonlySet<string> => new Set(SCENES.find((scene) => scene.id === id)!.spots.map((spot) => spot.id));
    expect(unlockedBy(SCENES, everything)).toBe(true);
    const lastLeft = (id: string): ReadonlySet<string> => {
      const scene = SCENES.find((s) => s.id === id)!;
      return new Set(scene.spots.slice(0, id === SCENES.at(-1)!.id ? -1 : undefined).map((spot) => spot.id));
    };
    expect(unlockedBy(SCENES, lastLeft)).toBe(false);
  });
});

describe('?all=N', () => {
  const counts = (n: number) => Object.fromEntries(Object.entries(presetAll(FIVE, n)).map(([id, spots]) => [id, spots.length]));

  it('fills the site scene by scene, in menu order', () => {
    expect(counts(0)).toEqual({ build: 0, grow: 0, design: 0, film: 0, set: 0 });
    expect(counts(9)).toEqual({ build: 9, grow: 0, design: 0, film: 0, set: 0 });
    expect(counts(10)).toEqual({ build: 10, grow: 0, design: 0, film: 0, set: 0 });
    expect(counts(11)).toEqual({ build: 10, grow: 1, design: 0, film: 0, set: 0 });
    expect(counts(49)).toEqual({ build: 10, grow: 10, design: 10, film: 10, set: 9 });
    expect(counts(50)).toEqual({ build: 10, grow: 10, design: 10, film: 10, set: 10 });
  });

  it('takes each scene\'s spots in their own order, and leaves only the last scene\'s last one at 49', () => {
    const preset = presetAll(FIVE, 49);
    expect(preset.build).toEqual(FIVE[0].spots.map((spot) => spot.id));
    expect(preset.set).toEqual(FIVE[4].spots.slice(0, 9).map((spot) => spot.id));
    expect(unlockedBy(FIVE, (id) => new Set(preset[id]))).toBe(false);
    expect(unlockedBy(FIVE, (id) => new Set(presetAll(FIVE, 50)[id]))).toBe(true);
  });

  it('is held to 0 and the site\'s total', () => {
    expect(counts(-5)).toEqual(counts(0));
    expect(counts(80)).toEqual(counts(50));
    expect(counts(9.7)).toEqual(counts(9));
  });

  it('works on the scenes the site has now', () => {
    const total = SCENES.reduce((sum, scene) => sum + scene.spots.length, 0);
    const preset = presetAll(SCENES, total - 1);
    expect(Object.values(preset).reduce((sum, spots) => sum + spots.length, 0)).toBe(total - 1);
    expect(preset[SCENES.at(-1)!.id]).toHaveLength(SCENES.at(-1)!.spots.length - 1);
  });
});

describe('the line beside the count', () => {
  const COPY: NoteCopy = {
    prompt: (here) => `Find the ${here} hidden mushrooms`,
    prize: (site) => `Find all ${site} to reach Hui Jie`,
    doneHere: (here, elsewhere) => `You found all ${here} here. ${elsewhere} more in the other scenes`,
    done: (here) => `You found all ${here}`,
  };

  it('asks for this scene\'s ten before the first find, then counts the whole site', () => {
    expect(noteFor(COPY, 0, 10, { found: 0, total: 50 })).toBe('Find the 10 hidden mushrooms');
    expect(noteFor(COPY, 0, 10, { found: 23, total: 50 })).toBe('Find the 10 hidden mushrooms');
    expect(noteFor(COPY, 3, 10, { found: 3, total: 50 })).toBe('Find all 50 to reach Hui Jie');
  });

  it('once a scene is done, says how many are still to find in the others', () => {
    expect(noteFor(COPY, 10, 10, { found: 10, total: 50 })).toBe('You found all 10 here. 40 more in the other scenes');
    expect(noteFor(COPY, 10, 10, { found: 49, total: 50 })).toBe('You found all 10 here. 1 more in the other scenes');
  });

  it('when every mushroom is found, the scene is simply done', () => {
    expect(noteFor(COPY, 10, 10, { found: 50, total: 50 })).toBe('You found all 10');
  });
});

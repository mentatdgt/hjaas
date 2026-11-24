// The prize (BIBLE section 1, changed 2026-11-21): the Contact button waits for every mushroom in every
// scene, worked out from the finds and never from a saved flag. And `?all=N`, the QA preset that fills the
// first N finds of the whole site.
import { describe, expect, it } from 'vitest';
import { SCENES } from '../scenes';
import { fillOf, hereLabel, huntView, presetAll, siteCount, siteLabel, stemFinds, unlockedBy, type CounterCopy, type HuntScene, type NamedScene } from './state';

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

describe('the two counters', () => {
  const COPY: CounterCopy = {
    hereFound: (scene) => `found in ${scene}`,
    hereMore: (left, scene) => `${left} more in ${scene}`,
    hereDone: (scene) => `${scene} complete`,
    siteAll: (total) => `find all ${total} to contact Hui Jie`,
    siteMore: (left) => `${left} more to contact Hui Jie`,
    siteDone: (total) => `You found all ${total}`,
  };
  const here = (found: number) => hereLabel(COPY, 'Set Design', { found, total: 10 });
  const site = (found: number) => siteLabel(COPY, { found, total: 50 });

  it('cream: what is found while that is under half, what is left from halfway on, and complete', () => {
    expect([0, 1, 4].map(here)).toEqual(Array(3).fill('found in Set Design'));
    expect(here(5)).toBe('5 more in Set Design');
    expect(here(7)).toBe('3 more in Set Design');
    expect(here(9)).toBe('1 more in Set Design');
    expect(here(10)).toBe('Set Design complete');
  });

  it('red: all 50 while more than 25 are left, then how many are left, down to 1', () => {
    expect([0, 17, 24].map(site)).toEqual(Array(3).fill('find all 50 to contact Hui Jie'));
    expect(site(25)).toBe('25 more to contact Hui Jie');
    expect(site(26)).toBe('24 more to contact Hui Jie');
    expect(site(49)).toBe('1 more to contact Hui Jie');
    expect(site(50)).toBe('You found all 50');
  });

  it('fill stem first, then cap: the stem over finds 1 to 3 (cream) and 1 to 15 (red)', () => {
    expect([stemFinds(10), stemFinds(50)]).toEqual([3, 15]);
    const cream = (n: number) => fillOf(n, 10, stemFinds(10));
    expect(cream(0)).toEqual({ stem: 0, cap: 0 });
    expect(cream(3)).toEqual({ stem: 1, cap: 0 });
    expect(cream(4).cap).toBeCloseTo(1 / 7);
    expect(cream(10)).toEqual({ stem: 1, cap: 1 });
    const red = (n: number) => fillOf(n, 50, stemFinds(50));
    expect(red(15)).toEqual({ stem: 1, cap: 0 });
    expect(red(16).cap).toBeCloseTo(1 / 35);
    expect(red(50)).toEqual({ stem: 1, cap: 1 });
  });
});

describe('one set of finds', () => {
  const NAMED: NamedScene[] = FIVE.map((scene) => ({ ...scene, label: scene.id.toUpperCase() }));

  it('the counters, the tab dots, the Next link and the unlock all read it, whatever it holds', () => {
    // A few hundred different hunts, each looked at from every scene.
    for (let n = 0; n < 400; n++) {
      const counts = Object.fromEntries(NAMED.map((scene, i) => [scene.id, Math.min(10, (n * (7 + 4 * i)) % 14)]));
      const found = finds(NAMED, counts);
      for (const scene of NAMED) {
        const view = huntView(NAMED, found, scene.id);
        const sum = Object.values(counts).reduce((a, b) => a + b, 0);
        expect(view.here).toEqual({ found: counts[scene.id], total: 10 });
        // Red is the sum of the per-scene counts: there is no second count.
        expect(view.site).toEqual({ found: sum, total: 50 });
        expect(view.site).toEqual(siteCount(NAMED, found));
        expect(view.done).toEqual(NAMED.filter((s) => counts[s.id] === 10).map((s) => s.id));
        // The unlock is the rule that was there, and says the same as the count and the dots.
        expect(view.unlocked).toBe(unlockedBy(NAMED, found));
        expect(view.unlocked).toBe(sum === 50);
        expect(view.unlocked).toBe(view.done.length === NAMED.length);
        expect(view.next === null).toBe(NAMED.every((s) => s === scene || counts[s.id] === 10));
        if (view.next) expect(counts[view.next.id]).toBeLessThan(10);
      }
    }
  });

  it('counts a stray id (a spot since replaced) nowhere', () => {
    const stray = (id: string): ReadonlySet<string> => new Set([...Array.from({ length: 9 }, (_, i) => `${id}-${i}`), 'somewhere-else']);
    const view = huntView(NAMED, stray, 'film');
    expect(view.here.found).toBe(9);
    expect(view.site.found).toBe(45);
    expect(view.done).toEqual([]);
    expect(view.unlocked).toBe(false);
  });

  it('Next goes on round the menu to the next scene with something left, and is gone when none is', () => {
    const next = (counts: Record<string, number>, from: string) => huntView(NAMED, finds(NAMED, counts), from).next?.id ?? null;
    expect(next({ build: 10 }, 'build')).toBe('grow');
    expect(next({ build: 10, grow: 10, design: 10 }, 'build')).toBe('film');
    expect(next({ set: 10 }, 'set')).toBe('build');
    expect(next({ ...all(10), grow: 9 }, 'set')).toBe('grow');
    expect(next(all(10), 'set')).toBe(null);
  });

  it('holds for the scenes the site has now, with their own tab names', () => {
    const preset = presetAll(SCENES, 49);
    const view = huntView(SCENES, (id) => new Set(preset[id]), 'set');
    expect(view).toMatchObject({ label: 'Set Design', here: { found: 9, total: 10 }, site: { found: 49, total: 50 }, done: ['build', 'grow', 'design', 'film'], unlocked: false });
    const done = presetAll(SCENES, 50);
    expect(huntView(SCENES, (id) => new Set(done[id]), 'build')).toMatchObject({ site: { found: 50, total: 50 }, next: null, unlocked: true });
  });
});

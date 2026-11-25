import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isProgressKey, loadProgress, resetProgress, saveFind, savePan, saveSeen } from './state';

const scenes = [
  { id: 'build', spots: [{ id: 'a' }, { id: 'b' }], replaced: { original: 'a' } },
  { id: 'grow', spots: [{ id: 'a' }] },
];

let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    key: (i: number) => [...storage.keys()][i] ?? null,
    get length() { return storage.size; },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('saved progress across tabs', () => {
  it('merges finds written from two stale snapshots by scene and spot', () => {
    const tabA = loadProgress(scenes);
    const tabB = loadProgress(scenes);
    expect(tabA.scenes.build.found).toEqual([]);
    expect(tabB.scenes.build.found).toEqual([]);
    saveFind('build', 'a');
    saveFind('build', 'b');
    saveFind('grow', 'a');
    saveSeen('grow');
    const merged = loadProgress(scenes);
    expect(merged.scenes.build.found).toEqual(['a', 'b']);
    expect(merged.scenes.grow).toMatchObject({ found: ['a'], seen: true });
    expect(merged.unlocked).toBe(true);
  });

  it('keeps the earned unlock when a stale tab saves a pan', () => {
    const stale = loadProgress(scenes);
    saveFind('build', 'a');
    saveFind('build', 'b');
    saveFind('grow', 'a');
    expect(stale.unlocked).toBe(false);
    savePan('build', 280);
    const merged = loadProgress(scenes);
    expect(merged.scenes.build).toMatchObject({ found: ['a', 'b'], panX: 280 });
    expect(merged.unlocked).toBe(true);
  });

  it('preserves v1 and v2 progress, including replaced spots, and derives the unlock', () => {
    storage.set('hjaas:scene1:v1', JSON.stringify({ found: ['original'], panX: 390, seenIntro: true, unlocked: true }));
    expect(loadProgress(scenes)).toMatchObject({ unlocked: false, scenes: { build: { found: ['a'], panX: 390, seen: true } } });
    storage.set('hjaas:site:v2', JSON.stringify({ scenes: { build: { found: ['original', 'b'] } }, unlocked: true }));
    saveFind('grow', 'a');
    expect(loadProgress(scenes)).toMatchObject({ unlocked: true, scenes: { build: { found: ['a', 'b'] } } });
  });
});

it('a reset forgets every find of every version, and nothing that is not the site\'s', () => {
  storage.set('hjaas:scene1:v1', JSON.stringify({ found: ['a'] }));
  storage.set('hjaas:site:v2', JSON.stringify({ scenes: { build: { found: ['b'], seen: true } }, panned: true }));
  storage.set('someone-else', '1');
  saveFind('build', 'a');
  saveFind('grow', 'a');
  saveSeen('grow');
  savePan('build', 280);
  expect(loadProgress(scenes).unlocked).toBe(true);
  const kept = [...storage.keys()].filter((key) => !isProgressKey(key));
  resetProgress();
  expect([...storage.keys()]).toEqual(kept);
  expect(kept).toEqual(['someone-else']);
  expect(loadProgress(scenes)).toMatchObject({ unlocked: false, panned: false, scenes: { build: { found: [], seen: false, panX: null }, grow: { found: [] } } });
});

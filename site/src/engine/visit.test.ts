import { describe, expect, it } from 'vitest';
import { DOUBLE_TAP_S, GLIMPSE_S, Visit, tabFinishes } from './visit';

describe('what a visit remembers', () => {
  it('every scene is new to every visit, whatever an earlier one painted', () => {
    const before = new Visit();
    before.finished('film');
    expect(before.isNew('film')).toBe(false);
    expect(new Visit().isNew('film')).toBe(true);
  });

  it('a painting seen to its end, or left once it has been seen, counts; a glimpse does not', () => {
    const visit = new Visit();
    expect(visit.left('film', GLIMPSE_S - 0.1)).toBe(false);
    expect(visit.isNew('film')).toBe(true);
    expect(visit.left('film', 2)).toBe(true);
    expect(visit.isNew('film')).toBe(false);
    visit.finished('design');
    // A brush-over left at once does not undo it.
    expect(visit.left('design', 0)).toBe(true);
    expect(visit.isNew('design')).toBe(false);
    expect(visit.isNew('set')).toBe(true);
  });
});

describe('a tap on a tab', () => {
  it('finishes only the picture of its own scene, while that is being painted', () => {
    expect(tabFinishes('film', 'film', 'film', 2)).toBe(true);
    // Another scene's tab changes scene, painted.
    expect(tabFinishes('design', 'film', 'film', 2)).toBe(false);
    // Nothing is being painted.
    expect(tabFinishes('film', 'film', 'film', undefined)).toBe(false);
  });

  it('a second tap on a scene still on its way, or only just begun, does nothing', () => {
    // Film is loading, over Build.
    expect(tabFinishes('film', 'build', 'film', undefined)).toBe(false);
    expect(tabFinishes('film', 'build', 'film', 3)).toBe(false);
    // In the window, under its blank sheet.
    expect(tabFinishes('film', 'film', 'film', undefined)).toBe(false);
    expect(tabFinishes('film', 'film', 'film', DOUBLE_TAP_S / 2)).toBe(false);
  });

  it('back to the scene being painted, after asking for another: it goes on', () => {
    expect(tabFinishes('film', 'film', 'design', 2)).toBe(false);
  });

  it('cuts a reduced-motion fade short', () => {
    expect(tabFinishes('film', 'film', 'film', null)).toBe(true);
  });
});

// Rules every scene's hunt has to keep (reviews/scene-2-hunt-difficulty.md, "Fairness rules"). The rules
// about tap boxes and the painting's edge are in engine/edge.test.ts.
import { describe, expect, it } from 'vitest';
import { SCENES } from '.';

/** The area of a `polygon(x% y%, ...)` clip-path, as a share of the drawing's box. */
function shareKept(tuck: string): number {
  const points = [...tuck.matchAll(/(-?[\d.]+)%?\s+(-?[\d.]+)%?/g)].map(([, x, y]) => [Number(x), Number(y)]);
  let twice = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    twice += x0 * y1 - x1 * y0;
  }
  return Math.abs(twice) / 2 / 10000;
}

describe('every scene\'s hunt', () => {
  for (const scene of SCENES) {
    it(`${scene.label}: ten hiding spots, each with its own id, left to right`, () => {
      expect(scene.spots).toHaveLength(10);
      expect(new Set(scene.spots.map((spot) => spot.id)).size).toBe(10);
      // The order of the list is the Tab order: left to right, give or take a neighbour's width.
      for (let i = 1; i < scene.spots.length; i++) expect(scene.spots[i].x, `${scene.spots[i].id} comes after ${scene.spots[i - 1].id}`).toBeGreaterThanOrEqual(scene.spots[i - 1].x - 60);
    });

    it(`${scene.label}: every mushroom is at least 14 px tall and at least 60% in view`, () => {
      for (const spot of scene.spots) {
        expect(spot.h, spot.id).toBeGreaterThanOrEqual(14);
        if (spot.tuck) expect(shareKept(spot.tuck), `${spot.id} is tucked too far`).toBeGreaterThanOrEqual(0.6);
        if (spot.opacity !== undefined) expect(spot.opacity, spot.id).toBeGreaterThanOrEqual(0.8);
      }
    });

    it(`${scene.label}: a replaced spot hands its find to a spot that exists, and its id is not used again`, () => {
      for (const [old, now] of Object.entries(scene.replaced ?? {})) {
        expect(scene.spots.some((spot) => spot.id === now), `${old} -> ${now}`).toBe(true);
        expect(scene.spots.some((spot) => spot.id === old), `${old} is in use again`).toBe(false);
      }
      // Two old spots never hand their find to the same new one: the count would drop by one.
      const targets = Object.values(scene.replaced ?? {});
      expect(new Set(targets).size).toBe(targets.length);
    });
  }

  it('Grow hides three of its ten among the crop, as cream toadstools, never the nail-shaped drawing', () => {
    const grow = SCENES.find((scene) => scene.id === 'grow')!;
    const crop = grow.spots.filter((spot) => spot.id.startsWith('crop-'));
    expect(crop).toHaveLength(3);
    for (const spot of crop) expect([4, 6], spot.id).toContain(spot.art);
    expect(grow.spots.some((spot) => spot.art === 5)).toBe(false);
  });
});

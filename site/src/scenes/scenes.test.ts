// Rules every scene's hunt has to keep (reviews/scene-2-hunt-difficulty.md, "Fairness rules"). The rules
// about tap boxes and the painting's edge are in engine/edge.test.ts.
import { describe, expect, it } from 'vitest';
import { SCENES } from '.';
import cast from './design-cast.json';
import filmCast from './film-cast.json';

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

  it('Design keeps every mushroom off its cast: none is on, behind or inside any actor\'s box', () => {
    const design = SCENES.find((scene) => scene.id === 'design')!;
    // (Widest drawing: 166 px to 154 of height.)
    const widest = 166 / 154;
    for (const spot of design.spots) {
      const left = spot.x - (spot.h * widest) / 2;
      const right = spot.x + (spot.h * widest) / 2;
      for (const [actor, [l, t, r, b]] of Object.entries(cast.boxes)) {
        const apart = right < l || left > r || spot.y < t || spot.y - spot.h > b;
        expect(apart, `${spot.id} is in ${actor}'s box`).toBe(true);
      }
      // The mum is part of the plate: she sits on the window seat, over about these px.
      expect(right < 425 || left > 625 || spot.y < 365 || spot.y - spot.h > 705, `${spot.id} is on the mum`).toBe(true);
    }
  });

  it('Design has three easy finds, four medium and three hard, and they are spread across the room', () => {
    const design = SCENES.find((scene) => scene.id === 'design')!;
    const thirds = [0, 1, 2].map((n) => design.spots.filter((spot) => Math.min(2, Math.floor(spot.x / (1672 / 3))) === n).length);
    for (const count of thirds) expect(count).toBeGreaterThanOrEqual(2);
    // The hard ones are the colour of what they stand in or beside: cream or the chanterelle, never red.
    const hard = design.spots.filter((spot) => ['sunlight', 'cups', 'counter'].includes(spot.id));
    expect(hard).toHaveLength(3);
    for (const spot of hard) expect([4, 6, 8], spot.id).toContain(spot.art);
    const easy = design.spots.filter((spot) => ['floor', 'window-seat', 'corner'].includes(spot.id));
    expect(easy).toHaveLength(3);
    for (const spot of easy) expect([1, 2, 3], spot.id).toContain(spot.art);
    expect(design.spots.some((spot) => spot.art === 5)).toBe(false);
  });
  it('Film keeps every mushroom off its cast: none is on, behind or inside the box of the water, the presenter or Rachel', () => {
    const film = SCENES.find((scene) => scene.id === 'film')!;
    expect(Object.keys(filmCast.boxes).sort()).toEqual(['presenter', 'rachel', 'water']);
    // (Widest drawing: 166 px to 154 of height.)
    const widest = 166 / 154;
    for (const spot of film.spots) {
      const left = spot.x - (spot.h * widest) / 2;
      const right = spot.x + (spot.h * widest) / 2;
      for (const [actor, [l, t, r, b]] of Object.entries(filmCast.boxes)) {
        const apart = right < l || left > r || spot.y < t || spot.y - spot.h > b;
        expect(apart, `${spot.id} is in ${actor}'s box`).toBe(true);
      }
    }
  });

  it('Film has three easy finds, four medium and three hard, and they are spread across the scene', () => {
    const film = SCENES.find((scene) => scene.id === 'film')!;
    expect(film.spots).toHaveLength(10);
    const thirds = [0, 1, 2].map((n) => film.spots.filter((spot) => Math.min(2, Math.floor(spot.x / (1672 / 3))) === n).length);
    for (const count of thirds) expect(count).toBeGreaterThanOrEqual(3);
    // The hard ones are the colour of what they stand beside: red by the red brake calipers, cream on the
    // Merlion's cream scales, the chanterelle among the orange flowers.
    const hard = Object.fromEntries(film.spots.filter((spot) => ['wheel', 'merlion', 'flowers'].includes(spot.id)).map((spot) => [spot.id, spot.art]));
    expect(hard).toEqual({ wheel: 1, merlion: 4, flowers: 8 });
    // The easy ones are red, on open ground, and the biggest.
    const easy = film.spots.filter((spot) => ['paving', 'forecourt', 'steps'].includes(spot.id));
    expect(easy).toHaveLength(3);
    for (const spot of easy) {
      expect([1, 2, 3], spot.id).toContain(spot.art);
      expect(spot.h, spot.id).toBeGreaterThanOrEqual(28);
    }
    for (const spot of film.spots) expect(spot.h, spot.id).toBeGreaterThanOrEqual(18);
    expect(film.spots.some((spot) => spot.art === 5)).toBe(false);
    // Left to right, which is the Tab order.
    expect(film.spots.map((spot) => spot.x)).toEqual([...film.spots.map((spot) => spot.x)].sort((a, b) => a - b));
  });

  it('Film keeps the painting whole under the presenter, and under Rachel above her waist only', () => {
    const film = SCENES.find((scene) => scene.id === 'film')!;
    const [, , , presenterBottom] = filmCast.covers.presenter;
    expect(film.keep).toContainEqual(filmCast.covers.presenter);
    expect(film.keep).toContainEqual([filmCast.covers.rachel[0], filmCast.covers.rachel[1], filmCast.covers.rachel[2], 760]);
    // And the Merlion's head, which reaches up into the top edge's reach: hugged, from its crown down.
    const hugged = film.keep!.filter((box) => box[4] === 'hug');
    expect(hugged.length).toBeGreaterThanOrEqual(5);
    expect(Math.min(...hugged.map((box) => box[1]))).toBe(23);
    expect(Math.min(...hugged.map((box) => box[0]))).toBeLessThanOrEqual(900);
    expect(Math.max(...hugged.map((box) => box[2]))).toBeGreaterThanOrEqual(1095);
    expect(film.keep).toHaveLength(2 + hugged.length);
    // The water is scenery: the edge fades it with the plate.
    expect(filmCast.room).toEqual(['water']);
    expect(presenterBottom).toBeLessThan(941 - 28);
  });
});

describe('Film on a phone', () => {
  it("opens with both faces in the window, at the tallest phone's crop as at the widest (Wren's review of build 01)", () => {
    const film = SCENES.find((scene) => scene.id === 'film')!;
    // Measured from the package: his face, and hers even mid-reaction (R_K1_look).
    const faces = { presenter: [669, 815], rachel: [1133, 1262] };
    for (const [shape, [left, right]] of Object.entries(film.phoneStart)) {
      for (const [who, [from, to]] of Object.entries(faces)) {
        expect(from, `${who}'s face at the ${shape} crop`).toBeGreaterThanOrEqual(left);
        expect(to, `${who}'s face at the ${shape} crop`).toBeLessThanOrEqual(right);
      }
    }
  });
});

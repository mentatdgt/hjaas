// Rules every scene's hunt has to keep (reviews/scene-2-hunt-difficulty.md, "Fairness rules"). The rules
// about tap boxes and the painting's edge are in engine/edge.test.ts.
import { describe, expect, it } from 'vitest';
import { SCENES } from '.';
import cast from './design-cast.json';
import filmCast from './film-cast.json';
import setCast from './set-cast.json';

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

describe('On a phone', () => {
  // Rachel at her first frame, with what she holds and without her furniture, in plate px (measured on the page:
  // qa/counter/phone.json). The narrowest opening window is 2:3 (627 px); its sides fade over 12 of its px (21).
  const HER: Record<string, readonly [number, number]> = { build: [610, 912], grow: [845, 1145], design: [780, 1005], film: [1025, 1351], set: [738, 1050] };
  const HALF = 627 / 2;
  const FADE = 12 * (627 / 354);
  const scene = (id: string) => SCENES.find((s) => s.id === id)!;

  it('every scene but Build and Film opens centred on Rachel (hunt-counter-build.md section 3)', () => {
    for (const { id, focusX } of SCENES) {
      if (id === 'build' || id === 'film') continue;
      const [left, right] = HER[id];
      expect(Math.abs(focusX - (left + right) / 2), id).toBeLessThanOrEqual(30);
    }
  });

  it('all of Rachel is in view in every scene but Film', () => {
    for (const { id, focusX } of SCENES) {
      if (id === 'film') continue;
      expect(HER[id][0], id).toBeGreaterThan(focusX - HALF);
      expect(HER[id][1], id).toBeLessThan(focusX + HALF);
    }
  });

  it('Build opens on Rachel and all of her box: her clear of the side fade, its far end past the half of it', () => {
    // Her hip and the box's far corner, over every frame she has (they are drawn in one frame with her).
    const { focusX } = scene('build');
    expect(610).toBeGreaterThanOrEqual(focusX - HALF + FADE);
    expect(1199).toBeLessThanOrEqual(focusX + HALF - FADE / 2);
  });

  it('Film opens as the user approved it, with both faces and the camera in view', () => {
    const { focusX } = scene('film');
    expect(focusX).toBe(977);
    // Measured from the package: his face, hers even mid-reaction (R_K1_look), and her camera.
    for (const [what, [left, right]] of Object.entries({ presenter: [669, 815], rachel: [1133, 1262], camera: [1025, 1140] })) {
      expect(left, what).toBeGreaterThanOrEqual(focusX - HALF);
      expect(right, what).toBeLessThanOrEqual(focusX + HALF);
    }
  });
});

describe('Set Design', () => {
  const scene = SCENES.find((s) => s.id === 'set')!;
  // (Widest drawing: 166 px to 154 of height.)
  const widest = 166 / 154;
  const boxOf = (spot: (typeof scene.spots)[number]) => [spot.x - (spot.h * widest) / 2, spot.y - spot.h, spot.x + (spot.h * widest) / 2, spot.y] as const;
  const apart = ([l, t, r, b]: readonly number[], [L, T, R, B]: readonly number[]) => r < L || l > R || b < T || t > B;

  it('is the fifth tab, "Set Design", at #set', () => {
    expect(SCENES.map((s) => s.id)).toEqual(['build', 'grow', 'design', 'film', 'set']);
    expect(scene.label).toBe('Set Design');
  });

  it('keeps every mushroom off Rachel, the backdrop\'s swaths, the lamp, and the gap and the slot the stagehand walks in (brief section 5, round 2 section 4)', () => {
    const forbidden: Record<string, readonly number[]> = {
      "Rachel's layer": [702, 75, 1096, 575],
      'the backdrop': [929, 0, 1529, 562],
      "the lamp's layer": [1327, 0, 1427, 101],
      // The gap under the hem is y 554 to 636 where the mask is set; no mushroom is anywhere in that band.
      'the gap under the hem': [0, 554, 1672, 636],
      // Between the backdrop and the curtain the stagehand is seen whole (round 2, section 4; the mask as delivered).
      'the slot by the curtain': [1502, 101, 1609, 553],
    };
    for (const spot of scene.spots) for (const [what, area] of Object.entries(forbidden)) expect(apart(boxOf(spot), area), `${spot.id} is on ${what}`).toBe(true);
    // And the package agrees about where Rachel and the lamp are.
    expect(setCast.boxes.rachel).toEqual([702, 75, 1096, 575]);
    expect(setCast.boxes.lamp).toEqual([1327, 0, 1427, 101]);
  });

  it('has three easy finds, four medium and three hard, spread across the stage, left to right', () => {
    expect(scene.spots).toHaveLength(10);
    const thirds = [0, 1, 2].map((n) => scene.spots.filter((spot) => Math.min(2, Math.floor(spot.x / (1672 / 3))) === n).length);
    for (const count of thirds) expect(count).toBeGreaterThanOrEqual(3);
    const easy = scene.spots.filter((spot) => ['boards', 'drop-cloth', 'cart-front'].includes(spot.id));
    expect(easy).toHaveLength(3);
    for (const spot of easy) {
      expect([1, 2, 3], spot.id).toContain(spot.art);
      expect(spot.h, spot.id).toBeGreaterThanOrEqual(28);
    }
    // The hard ones are hidden by likeness: yellow by the yellow tripod, pale caps by the pale pots and cloth.
    const hard = Object.fromEntries(scene.spots.filter((spot) => ['coil', 'pots', 'paint-pail'].includes(spot.id)).map((spot) => [spot.id, spot.art]));
    expect(hard).toEqual({ coil: 7, pots: 4, 'paint-pail': 4 });
    for (const spot of scene.spots) expect(spot.h, spot.id).toBeGreaterThanOrEqual(18);
    expect(scene.spots.some((spot) => spot.art === 5)).toBe(false);
    expect(scene.spots.map((spot) => spot.x)).toEqual([...scene.spots.map((spot) => spot.x)].sort((a, b) => a - b));
  });

  it('keeps the painting whole under Rachel and around the lamp\'s cage and the slot by the curtain; she answers at once, and a second find holds her salute', () => {
    expect(scene.keep).toContainEqual(setCast.covers.rachel);
    const hugged = scene.keep!.filter((box) => box[4] === 'hug');
    expect(hugged.length).toBeGreaterThanOrEqual(3);
    const inLamp = ([l, t, r, b]: readonly unknown[]) => Number(l) >= 1327 && Number(r) <= 1427 && Number(t) >= 20 && Number(b) <= 101;
    const inSlot = ([l, t, r, b]: readonly unknown[]) => Number(l) >= 1500 && Number(r) <= 1609 && Number(t) >= 101 && Number(b) <= 637;
    for (const box of hugged) expect(inLamp(box) !== inSlot(box), box.join()).toBe(true);
    expect(hugged.filter(inLamp)).toHaveLength(5);
    // The slot's boxes follow one another without a break, from above the stagehand's head to the foot of the gap.
    const slot = hugged.filter(inSlot).map((box) => [Number(box[1]), Number(box[3])]);
    expect([slot[0][0], slot.at(-1)![1]]).toEqual([125, 637]);
    for (let i = 1; i < slot.length; i++) expect(slot[i][0]).toBe(slot[i - 1][1]);
    expect(setCast.room).toEqual(expect.arrayContaining(['lamp', 'backdrop_01', 'backdrop_10']));
    expect(scene.answer).toBe('at-once');
    expect(scene.again).toBe('hold');
  });
});

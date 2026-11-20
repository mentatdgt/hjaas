// The painting's soft edge must never hide the hunt: every mushroom, and every part of its tap box, has to
// sit where the painting is at least 0.95 opaque. This samples the edge under every hiding spot of every scene.
import { describe, expect, it } from 'vitest';
import { SCENES } from '../scenes';
import { DEFAULT_EDGE, EDGE_STYLES, SOLID, edgeAlpha, edgeName, edgeSeed, lowestAlpha, tapBox } from './edge';

const PLATE = { w: 1672, h: 941 };
// Width over height of the nine mushroom drawings (frames/003-mushrooms/approved, as built by npm run assets).
const ASPECT = [152, 117, 149, 164, 45, 166, 158, 163, 166].map((w) => w / 154);
// CSS px per plate px, from the largest desktop to the smallest phone.
const SCALES = {
  'desktop 2560': 1799 / 1672,
  'desktop 1440': 1040 / 1672,
  'desktop 1024': 820 / 1672,
  'phone 390': 531 / 941,
  'phone 360': 486 / 941,
  // The smallest the room is ever shown: a 320 px phone too short for more than a 4:5 window.
  'phone 320, short': 355 / 941,
};

describe('the painting behind every mushroom', () => {
  for (const scene of SCENES) {
    const alpha = edgeAlpha(DEFAULT_EDGE, edgeSeed(edgeName(scene)));

    it(`${scene.label}: every drawing sits where the painting is at least 0.95 opaque`, () => {
      for (const spot of scene.spots) {
        const w = spot.h * ASPECT[spot.art - 1];
        const value = lowestAlpha(alpha, spot.x, spot.y - spot.h / 2, w, spot.h);
        expect(value, `${scene.id}/${spot.id} is ${Math.round(value * 100) / 100}`).toBeGreaterThanOrEqual(SOLID);
      }
    });

    it(`${scene.label}: every tap box does too, at desktop and phone sizes, and still covers its drawing`, () => {
      for (const [name, u] of Object.entries(SCALES)) {
        for (const spot of scene.spots) {
          const w = spot.h * ASPECT[spot.art - 1];
          const box = tapBox(alpha, { cx: spot.x, cy: spot.y - spot.h / 2, w, h: spot.h }, u);
          const value = lowestAlpha(alpha, box.cx, box.cy, box.w, box.h);
          expect(value, `${scene.id}/${spot.id} tap box on ${name} is ${Math.round(value * 100) / 100}`).toBeGreaterThanOrEqual(SOLID);
          // Moving the box inward must not leave any of the drawing outside it.
          expect(spot.x - w / 2, `${scene.id}/${spot.id} on ${name}: left`).toBeGreaterThanOrEqual(box.cx - box.w / 2 - 0.5);
          expect(spot.x + w / 2, `${scene.id}/${spot.id} on ${name}: right`).toBeLessThanOrEqual(box.cx + box.w / 2 + 0.5);
          expect(spot.y - spot.h, `${scene.id}/${spot.id} on ${name}: top`).toBeGreaterThanOrEqual(box.cy - box.h / 2 - 0.5);
          expect(spot.y, `${scene.id}/${spot.id} on ${name}: bottom`).toBeLessThanOrEqual(box.cy + box.h / 2 + 0.5);
        }
      }
    });

    it(`${scene.label}: no two tap boxes overlap, at any of those sizes`, () => {
      for (const [name, u] of Object.entries(SCALES)) {
        const boxes = scene.spots.map((spot) => ({ id: spot.id, ...tapBox(alpha, { cx: spot.x, cy: spot.y - spot.h / 2, w: spot.h * ASPECT[spot.art - 1], h: spot.h }, u) }));
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i];
            const b = boxes[j];
            const apart = Math.abs(a.cx - b.cx) >= (a.w + b.w) / 2 || Math.abs(a.cy - b.cy) >= (a.h + b.h) / 2;
            expect(apart, `${scene.id}: ${a.id} and ${b.id} overlap on ${name}`).toBe(true);
          }
        }
      }
    });
  }
});

describe('the edge itself', () => {
  it('is paper at the very edge of the plate and solid in the middle, in every style', () => {
    for (const style of EDGE_STYLES) {
      const alpha = edgeAlpha(style, edgeSeed('build'));
      for (let i = 0; i <= 40; i++) {
        const x = (PLATE.w * i) / 40;
        const y = (PLATE.h * i) / 40;
        expect(alpha(x, 0)).toBe(0);
        expect(alpha(x, PLATE.h)).toBe(0);
        expect(alpha(0, y)).toBe(0);
        expect(alpha(PLATE.w, y)).toBe(0);
      }
      expect(alpha(PLATE.w / 2, PLATE.h / 2)).toBe(1);
      expect(alpha(400, 300)).toBe(1);
    }
  });

  it('is the same on every visit, and each scene has its own', () => {
    const a = edgeAlpha(DEFAULT_EDGE, edgeSeed('build'));
    const again = edgeAlpha(DEFAULT_EDGE, edgeSeed('build'));
    const other = edgeAlpha(DEFAULT_EDGE, edgeSeed('grow'));
    let differs = false;
    for (let x = 0; x < PLATE.w; x += 23) {
      expect(a(x, 30)).toBe(again(x, 30));
      if (a(x, 30) !== other(x, 30)) differs = true;
    }
    expect(differs).toBe(true);
  });

  it('finishes inside the stated width: solid where the fade ends, half-way along each side', () => {
    const ends = { a: [0.04, 0.06, 0.025], b: [0.055, 0.08, 0.03], 'a-round': [0.04, 0.06, 0.025] } as const;
    for (const [style, [side, top, bottom]] of Object.entries(ends)) {
      const alpha = edgeAlpha(style as keyof typeof ends, edgeSeed('grow'));
      for (let x = 700; x <= 972; x += 7) {
        expect(alpha(x, top * PLATE.h + 1)).toBe(1);
        expect(alpha(x, PLATE.h - bottom * PLATE.h - 1)).toBe(1);
      }
      for (let y = 400; y <= 540; y += 7) {
        expect(alpha(side * PLATE.w + 1, y)).toBe(1);
        expect(alpha(PLATE.w - side * PLATE.w - 1, y)).toBe(1);
      }
    }
  });

  it('rounds only the corners of the chosen style: the outer 6% of the width, as in the mock-up', () => {
    const alpha = edgeAlpha('a-round', edgeSeed('build'));
    const plain = edgeAlpha('a', edgeSeed('build'));
    const r = 0.06 * PLATE.w;
    // Just past each corner's arc: paper, where A still has paint.
    for (const [x, y] of [[28, 28], [PLATE.w - 28, 28], [28, PLATE.h - 28], [PLATE.w - 28, PLATE.h - 28]]) {
      expect(plain(x, y)).toBeGreaterThan(0);
      expect(alpha(x, y)).toBe(0);
    }
    // Everywhere outside the four corner squares the two are the same: the long edges stay straight and thin.
    for (let y = 0; y <= PLATE.h; y += 13) {
      for (let x = Math.ceil(r); x <= PLATE.w - r; x += 37) expect(alpha(x, y)).toBe(plain(x, y));
    }
    for (let x = 0; x <= PLATE.w; x += 13) {
      for (let y = Math.ceil(r); y <= PLATE.h - r; y += 29) expect(alpha(x, y)).toBe(plain(x, y));
    }
    // And the turn is smooth: no step where the arc meets the straight edges.
    for (const y of [20, 40]) expect(Math.abs(alpha(r - 0.5, y) - alpha(r + 0.5, y))).toBeLessThan(0.05);
    for (const x of [20, 40]) expect(Math.abs(alpha(x, r - 0.5) - alpha(x, r + 0.5))).toBeLessThan(0.05);
  });

  // The organic edge (reviews/scene-edge-organic.md): what makes it read as a drying wash and not a feather.
  describe('the organic edge', () => {
    const alpha = edgeAlpha('organic', edgeSeed('build'));
    /** Along the top edge at `x`: where the painting reaches a tenth, a half and nine tenths, in px from the rim. */
    const crossing = (x: number): { thin: number; half: number; solid: number } => {
      const at = (level: number): number => {
        for (let y = 0; y < 400; y += 0.5) if (alpha(x, y) >= level) return y;
        return 400;
      };
      return { thin: at(0.1), half: at(0.5), solid: at(0.9) };
    };
    // Clear of the corners, every 9 px along the top.
    const along = Array.from({ length: 150 }, (_, i) => crossing(160 + i * 9));

    it('is solid well inside, and paper outside its rounded corners', () => {
      for (const [x, y] of [[170, 170], [PLATE.w - 170, 170], [170, PLATE.h - 170], [PLATE.w - 170, PLATE.h - 170], [836, 470]]) expect(alpha(x, y)).toBe(1);
      for (const [x, y] of [[20, 20], [PLATE.w - 20, 20], [20, PLATE.h - 20], [PLATE.w - 20, PLATE.h - 20]]) expect(alpha(x, y)).toBe(0);
    });

    it('wanders in and out: the line is not at one depth', () => {
      const depths = along.map((c) => c.half);
      expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(35);
      // In places it runs out past the plate: there the picture ends on its own rim.
      expect(depths.some((depth) => depth <= 1)).toBe(true);
      expect(depths.some((depth) => depth > 30)).toBe(true);
    });

    it('is crisp in places and a wide melt in others', () => {
      // Where the line is inside the plate, the distance over which the painting comes up.
      const melts = along.filter((c) => c.thin > 1).map((c) => c.solid - c.thin);
      expect(melts.length).toBeGreaterThan(40);
      expect(Math.min(...melts)).toBeLessThan(16);
      expect(Math.max(...melts)).toBeGreaterThan(48);
    });

    it('is calmer and thinner along the bottom, where the floor, the feet and the low mushrooms are', () => {
      const reach = (fromBottom: boolean): number => {
        let deepest = 0;
        for (let x = 160; x < PLATE.w - 160; x += 7) {
          let d = 0;
          while (d < 300 && alpha(x, fromBottom ? PLATE.h - d : d) < 1) d++;
          deepest = Math.max(deepest, d);
        }
        return deepest;
      };
      expect(reach(true)).toBeLessThan(reach(false) * 0.75);
      expect(reach(true)).toBeLessThanOrEqual(80);
    });

    it('never reaches further in than 165 px, on any side, for any scene', () => {
      for (const scene of SCENES) {
        const a = edgeAlpha('organic', edgeSeed(edgeName(scene)));
        for (let i = 0; i <= 200; i++) {
          const x = 166 + ((PLATE.w - 332) * i) / 200;
          const y = 166 + ((PLATE.h - 332) * i) / 200;
          expect(a(x, 166)).toBe(1);
          expect(a(x, PLATE.h - 166)).toBe(1);
          expect(a(166, y)).toBe(1);
          expect(a(PLATE.w - 166, y)).toBe(1);
        }
      }
    });
  });
});

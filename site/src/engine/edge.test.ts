// The painting's soft edge must never hide the hunt: every mushroom, and every part of its tap box, has to
// sit where the painting is at least 0.95 opaque. This samples the edge under every hiding spot of every scene.
import { describe, expect, it } from 'vitest';
import { SCENES } from '../scenes';
import BAND from './edge-band.json';
import { DEFAULT_EDGE, EDGE_STYLES, SOLID, STRIPS, edgeAlpha, edgeName, edgeSeed, lowestAlpha, pencilReach, pencilRows, tapBox } from './edge';

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
    const alpha = edgeAlpha(DEFAULT_EDGE, edgeSeed(edgeName(scene)), scene.keep);

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

  // The pencil edge (reviews/scene-edge-pencil.md): the colour gives way to pencil, and nothing ends on a cut.
  describe('the pencil edge', () => {
    it('is the one the site ships', () => {
      expect(DEFAULT_EDGE).toBe('pencil');
    });

    it('never ends on a straight cut: the plate\'s rim is paper all the way round, and the last 28 px always fade', () => {
      for (const scene of SCENES) {
        const paint = edgeAlpha('pencil', edgeSeed(edgeName(scene)), scene.keep);
        const pencil = pencilReach(edgeSeed(edgeName(scene)), scene.keep);
        for (let i = 0; i <= 2000; i++) {
          const x = (PLATE.w * i) / 2000;
          const y = (PLATE.h * i) / 2000;
          for (const [px, py] of [[x, 0], [x, PLATE.h], [0, y], [PLATE.w, y]]) {
            expect(paint(px, py)).toBe(0);
            expect(pencil(px, py)).toBe(0);
          }
          // Just inside the rim there is next to nothing yet, and nowhere in the last 28 px is there more than
          // that fade allows: 4% at 3 px, a half at 14 px.
          for (const [px, py, dx, dy] of [[x, 0, 0, 1], [x, PLATE.h, 0, -1], [0, y, 1, 0], [PLATE.w, y, -1, 0]]) {
            expect(paint(px + dx, py + dy)).toBeLessThan(0.005);
            for (let d = 1; d <= 28; d++) {
              const t = d / 28;
              const most = t * t * (3 - 2 * t) + 1e-9;
              expect(paint(px + d * dx, py + d * dy)).toBeLessThanOrEqual(most);
              expect(pencil(px + d * dx, py + d * dy)).toBeLessThanOrEqual(most);
            }
          }
        }
      }
    }, 30_000);

    it('where the organic edge ended on the rim, this one fades', () => {
      // Along the top of Build's first edge, the organic line runs out past the plate in places.
      const organic = edgeAlpha('organic', edgeSeed('build'));
      const paint = edgeAlpha('pencil', edgeSeed('build'));
      const pencil = pencilReach(edgeSeed('build'));
      let cuts = 0;
      for (let x = 160; x < PLATE.w - 160; x += 3) {
        if (organic(x, 1) > 0.5) cuts++;
        expect(paint(x, 1)).toBeLessThan(0.005);
        expect(pencil(x, 1)).toBeLessThan(0.005);
      }
      expect(cuts).toBeGreaterThan(10);
    });

    it('has the pencil reach further out than the colour, everywhere', () => {
      const paint = edgeAlpha('pencil', edgeSeed('grow'));
      const pencil = pencilReach(edgeSeed('grow'));
      let ahead = 0;
      for (let y = 2; y < PLATE.h; y += 7) {
        for (let x = 2; x < PLATE.w; x += 7) {
          expect(pencil(x, y)).toBeGreaterThanOrEqual(paint(x, y));
          if (pencil(x, y) > 0.5 && paint(x, y) < 0.05) ahead++;
        }
      }
      // A real band of pencil with no colour under it.
      expect(ahead).toBeGreaterThan(1500);
    });

    it('pulls the colour in about 45 px from where the organic edge had it, less along the bottom', () => {
      const organic = edgeAlpha('organic', edgeSeed('grow'));
      const paint = edgeAlpha('pencil', edgeSeed('grow'));
      /** Where the colour reaches a half, coming in from the top (or up from the bottom) at `x`. */
      const half = (alpha: (x: number, y: number) => number, x: number, fromBottom: boolean): number => {
        for (let d = 0; d < 300; d += 0.5) if (alpha(x, fromBottom ? PLATE.h - d : d) >= 0.5) return d;
        return 300;
      };
      const shift = (fromBottom: boolean): number => {
        const shifts: number[] = [];
        for (let x = 200; x < PLATE.w - 200; x += 11) {
          const before = half(organic, x, fromBottom);
          // (Where the organic line was out past the rim, there is nothing to measure from.)
          if (before > 2) shifts.push(half(paint, x, fromBottom) - before);
        }
        return shifts.sort((a, b) => a - b)[Math.floor(shifts.length / 2)];
      };
      expect(shift(false)).toBeGreaterThan(38);
      expect(shift(false)).toBeLessThan(52);
      expect(shift(true)).toBeGreaterThan(8);
      expect(shift(true)).toBeLessThan(30);
    });

    it('is solid everywhere inside its four strips, for every scene: nothing is drawn there', () => {
      // The strips are all the edge is drawn in (edge-band.json). Inside them, and under the laps where two
      // of them meet, the painting must be whole, or it would be cut off along a straight line.
      expect(STRIPS.left.y).toBe(BAND.top - BAND.lap);
      for (const scene of SCENES) {
        const paint = edgeAlpha('pencil', edgeSeed(edgeName(scene)), scene.keep);
        for (let y = BAND.top - BAND.lap - 1; y <= PLATE.h - BAND.bottom + BAND.lap + 1; y += 1) {
          for (let x = BAND.side - 1; x <= PLATE.w - BAND.side + 1; x += y < BAND.top + 2 || y > PLATE.h - BAND.bottom - 2 ? 1 : 3) {
            if (paint(x, y) < 1) throw new Error(`${scene.id}: the painting is ${paint(x, y)} at ${x}, ${y}, inside the strips. Deepen edge-band.json (and run npm run assets) or choose another edge.`);
          }
        }
        for (let y = BAND.top - BAND.lap - 1; y <= PLATE.h - BAND.bottom + BAND.lap + 1; y += 3) {
          for (const x of [BAND.side - 1, BAND.side, PLATE.w - BAND.side, PLATE.w - BAND.side + 1]) expect(paint(x, y), `${scene.id} at ${x}, ${y}`).toBe(1);
        }
      }
    });

    it('is drawn row by row from tables of its noise, which give the answers the plain noise does', () => {
      const seed = edgeSeed('grow:129');
      const paint = edgeAlpha('pencil', seed);
      const pencil = pencilReach(seed);
      const out = { paint: 0, pencil: 0 };
      for (const [x0, w] of [[0, PLATE.w], [0, 152], [PLATE.w - 152, 152], [700, 33]]) {
        const rows = pencilRows(seed, x0, w);
        for (let y = 0.5; y < PLATE.h; y += 13) {
          rows.row(y);
          for (let i = 0; i < w; i += 7) {
            rows.at(i, out);
            expect(Math.abs(out.paint - paint(x0 + i + 0.5, y))).toBeLessThan(1e-9);
            expect(Math.abs(out.pencil - pencil(x0 + i + 0.5, y))).toBeLessThan(1e-9);
          }
        }
      }
    });

    it('is solid well inside, whatever the seed', () => {
      for (let n = 0; n < 40; n++) {
        const paint = edgeAlpha('pencil', edgeSeed(`any:${n}`));
        for (let i = 0; i <= 60; i++) {
          const x = 211 + ((PLATE.w - 422) * i) / 60;
          const y = 211 + ((PLATE.h - 422) * i) / 60;
          for (const [px, py] of [[x, 211], [x, PLATE.h - 211], [211, y], [PLATE.w - 211, y]]) expect(paint(px, py)).toBe(1);
        }
      }
    });
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

describe('a cast near the rim (the café)', () => {
  const scene = SCENES.find((s) => s.id === 'design')!;
  const seed = edgeSeed(edgeName(scene));
  const paint = edgeAlpha('pencil', seed, scene.keep);
  const pencil = pencilReach(seed, scene.keep);
  const plain = edgeAlpha('pencil', seed);
  const plainPencil = pencilReach(seed);
  const rim = (d: number): number => { const t = Math.min(1, Math.max(0, d / 28)); return t * t * (3 - 2 * t); };
  const din = (x: number, y: number): number => Math.min(x, PLATE.w - x, y, PLATE.h - y);

  it('has actors nearer the rim than any edge leaves whole: without their boxes the painting fades under them', () => {
    let faded = 0;
    for (const [l, t, r, b] of scene.keep!) for (let x = l; x <= r; x += 4) for (const y of [t, b]) if (plain(x, y) < 1) faded++;
    expect(faded).toBeGreaterThan(20);
  });

  it('is whole under every pixel of every box, down to the rim\'s own fade; inside that, as whole as the rim allows', () => {
    // (Rachel's shadow, which comes with her since package v7.4, reaches about 18 px from the plate's bottom.)
    let inTheRimsFade = 0;
    for (const [l, t, r, b] of scene.keep!) {
      for (let y = t; y <= b; y += 1) for (let x = l; x <= r; x += x === l || y === t || y === b ? 1 : 3) {
        const d = din(x, y);
        if (d >= 28) expect(paint(x, y), `(${x}, ${y})`).toBe(1);
        else {
          inTheRimsFade++;
          expect(paint(x, y), `(${x}, ${y})`).toBeCloseTo(rim(d), 9);
        }
      }
    }
    // Only the last few rows of one box: nobody stands in the rim's fade.
    expect(inTheRimsFade).toBeGreaterThan(0);
    for (const [l, t, r, b] of scene.keep!) expect(Math.min(l, t, PLATE.w - r, PLATE.h - b), 'a box no nearer the rim than 15 px').toBeGreaterThanOrEqual(15);
  });

  it('still leaves the rim bare paper, and nothing above the 28 px fade', () => {
    for (let x = 0; x <= PLATE.w; x += 1) for (const y of [0, PLATE.h]) expect(paint(x, y)).toBe(0);
    for (let y = 0; y <= PLATE.h; y += 1) for (const x of [0, PLATE.w]) expect(paint(x, y)).toBe(0);
    for (let y = 1; y < PLATE.h; y += 3) for (let x = 1; x < PLATE.w; x += 3) {
      const d = din(x, y);
      if (d > 28) continue;
      expect(paint(x, y), `(${x}, ${y})`).toBeLessThanOrEqual(rim(d) + 1e-9);
      expect(pencil(x, y)).toBeLessThanOrEqual(rim(d) + 1e-9);
    }
  });

  it('only ever adds to the ordinary edge, and changes nothing far from the boxes', () => {
    const near = (x: number, y: number): boolean => scene.keep!.some(([l, t, r, b]) => x > l - 170 && x < r + 170 && y > t - 170 && y < b + 170);
    let changed = 0;
    for (let y = 2; y < PLATE.h; y += 5) for (let x = 2; x < PLATE.w; x += 5) {
      expect(paint(x, y)).toBeGreaterThanOrEqual(plain(x, y));
      if (paint(x, y) !== plain(x, y)) changed++;
      if (!near(x, y)) {
        expect(paint(x, y), `(${x}, ${y})`).toBe(plain(x, y));
        expect(pencil(x, y)).toBe(plainPencil(x, y));
      }
    }
    expect(changed).toBeGreaterThan(100);
  });

  it('has no pencil band beside the boxes that need the room, and the pencil never ends short of the colour', () => {
    for (let y = 2; y < PLATE.h; y += 4) for (let x = 2; x < PLATE.w; x += 4) expect(pencil(x, y)).toBeGreaterThanOrEqual(paint(x, y) - 1e-12);
    // Straight out from Rachel's boots and the cat (the bottom), and from the old man (the right side).
    const boxes = scene.keep!.filter(([, , r, b]) => PLATE.h - b < 60 || PLATE.w - r < 80);
    expect(boxes.length).toBeGreaterThanOrEqual(3);
    for (const [l, t, r, b] of boxes) {
      if (PLATE.h - b < 60) for (let x = l; x <= r; x += 3) for (let y = b; y < PLATE.h; y += 1) expect(pencil(x, y) - paint(x, y), `(${x}, ${y})`).toBeLessThan(1e-9);
      if (PLATE.w - r < 80) for (let y = t; y <= b; y += 3) for (let x = r; x < PLATE.w; x += 1) expect(pencil(x, y) - paint(x, y), `(${x}, ${y})`).toBeLessThan(1e-9);
    }
  });

  it('has no step in it: neighbouring pixels never differ by much', () => {
    let steepest = 0;
    for (let y = 1; y < PLATE.h - 1; y += 1) for (let x = 1; x < PLATE.w - 1; x += 1) {
      if (din(x, y) > 215) { x += 3; continue; }
      const here = paint(x, y);
      steepest = Math.max(steepest, Math.abs(paint(x + 1, y) - here), Math.abs(paint(x, y + 1) - here));
    }
    // The ordinary edge's crispest places come to about 0.25 a pixel (a 6 px fade).
    expect(steepest).toBeLessThan(0.3);
  });

  it('is drawn row by row as it is asked point by point', () => {
    const out = { paint: 0, pencil: 0 };
    for (const [x0, w] of [[0, 1672], [1520, 152]] as const) {
      const rows = pencilRows(seed, x0, w, scene.keep);
      for (const y of [600.5, 850.5, 905.5, 925.5]) {
        rows.row(y);
        for (let i = 0; i < w; i += 7) {
          rows.at(i, out);
          expect(out.paint).toBeCloseTo(paint(x0 + i + 0.5, y), 9);
          expect(out.pencil).toBeCloseTo(pencil(x0 + i + 0.5, y), 9);
        }
      }
    }
  });
});


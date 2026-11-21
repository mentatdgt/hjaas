// The live screen of a cast package (the film scene's camera), tested on the package as `npm run assets`
// puts it in public/: where the screen is on each of her stills, and the recording dot's beat.
import { describe, expect, it } from 'vitest';
import framesJson from '../../public/assets/scene4/cast/frames.json';
import routineJson from '../../public/assets/scene4/cast/routine.json';
import cafeFrames from '../../public/assets/scene3/cast/frames.json';
import cafeRoutine from '../../public/assets/scene3/cast/routine.json';
import { splitCast, type CastFrames, type CastRoutines } from './cast';
import { DOT, dotLit, pictureFor } from './screen';

const frames = framesJson as unknown as CastFrames;
const routines = routineJson as unknown as CastRoutines;
const { screen, problems } = splitCast(frames, routines, 1672);

describe("the film scene's camera screen", () => {
  it('is held by the actor whose stills place it, and shows what is drawn before her', () => {
    expect(problems).toEqual([]);
    expect(screen?.actor).toBe('rachel');
    const order = frames.layers.map((layer) => layer.actor);
    // Everyone the screen shows is under her: the water and the presenter.
    expect(order.slice(0, order.indexOf('rachel'))).toEqual(['water', 'presenter']);
    const { source } = screen!;
    for (const name of ['water', 'presenter']) {
      const layer = frames.layers.find((l) => l.actor === name)!;
      const overlaps = layer.x < source.x + source.w && layer.x + layer.w > source.x && layer.y < source.y + source.h && layer.y + layer.h > source.y;
      expect(overlaps, name).toBe(true);
    }
    // She is not in her own picture.
    const hers = frames.layers.find((l) => l.actor === 'rachel')!;
    expect(source.x + source.w).toBeLessThanOrEqual(hers.x);
  });

  it('has a place on every still she is ever shown on, inside her own box', () => {
    const hers = frames.layers.find((l) => l.actor === 'rachel')!;
    for (const still of hers.stills) {
      const picture = pictureFor(screen!, still);
      expect(picture, still).not.toBeNull();
      // Two px inside the screen's rectangle, all round.
      const rect = frames.camera_screen!.rect_by_still[still];
      expect(picture).toEqual({ x: rect.x + 2, y: rect.y + 2, w: rect.w - 4, h: rect.h - 4 });
      expect(picture!.x).toBeGreaterThanOrEqual(hers.x);
      expect(picture!.y).toBeGreaterThanOrEqual(hers.y);
      expect(picture!.x + picture!.w).toBeLessThanOrEqual(hers.x + hers.w);
      expect(picture!.y + picture!.h).toBeLessThanOrEqual(hers.y + hers.h);
    }
    // It moves when she lowers the camera to look round.
    expect(pictureFor(screen!, 'R_K1_look')).not.toEqual(pictureFor(screen!, 'R_A1_film'));
    expect(pictureFor(screen!, 'R_K0_turn')).toEqual(pictureFor(screen!, 'R_A1_film'));
    // A pose with no screen: there is nothing to draw.
    expect(pictureFor(screen!, 'somewhere else')).toBeNull();
  });

  it('is the same shape as what it shows, near enough that nothing looks squeezed', () => {
    const { source } = screen!;
    for (const still of Object.keys(screen!.rects)) {
      const picture = pictureFor(screen!, still)!;
      expect(Math.abs(picture.w / picture.h - source.w / source.h)).toBeLessThan(0.03);
    }
  });

  it('is scaled with the canvas when a package is drawn larger than the plate', () => {
    const doubled = { ...frames, canvas: { w: frames.canvas.w * 2, h: frames.canvas.h * 2 } } as CastFrames;
    const half = splitCast(doubled, routines, 1672).screen!;
    expect(half.source).toEqual({ x: 300, y: 125, w: 160, h: 145 });
    expect(half.rects.R_A1_film.w).toBe(22);
  });

  it('says what is wrong with a screen that cannot be drawn', () => {
    const noOne = { ...frames, camera_screen: { source: frames.camera_screen!.source, rect_by_still: { R_A1_film: frames.camera_screen!.rect_by_still.R_A1_film, M_1: { x: 1, y: 1, w: 10, h: 10 } } } } as CastFrames;
    expect(splitCast(noOne, routines, 1672).problems.join(' ')).toMatch(/which no one layer has/);
    const empty = { ...frames, camera_screen: { source: { x: 0, y: 0, w: 0, h: 10 }, rect_by_still: {} } } as CastFrames;
    expect(splitCast(empty, routines, 1672).problems.join(' ')).toMatch(/camera_screen/);
  });

  it('a package without one has none (the café)', () => {
    expect(splitCast(cafeFrames as unknown as CastFrames, cafeRoutine as unknown as CastRoutines, 1672).screen).toBeNull();
  });
});

describe('the recording dot', () => {
  it('is lit for half a second and dark for half a second, evenly, from the moment the screen comes on', () => {
    expect(DOT.ms).toBe(500);
    for (let ms = 0; ms < 6000; ms += 7) expect(dotLit(ms, false), `${ms}`).toBe(Math.floor(ms / 500) % 2 === 0);
    expect(dotLit(0, false)).toBe(true);
    expect(dotLit(499.9, false)).toBe(true);
    expect(dotLit(500, false)).toBe(false);
    expect(dotLit(999.9, false)).toBe(false);
    expect(dotLit(1000, false)).toBe(true);
  });

  it('stays lit when the scene is held still (paused, or reduced motion)', () => {
    for (let ms = 0; ms < 3000; ms += 50) expect(dotLit(ms, true)).toBe(true);
  });

  it('is six plate px across, two inside the corner of the picture, in the red the package names', () => {
    expect([DOT.size, DOT.inset, DOT.colour]).toEqual([6, 2, '#EB1E1E']);
  });
});

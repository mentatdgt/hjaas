// The finale's rules (finale.ts, Director and the helpers), on a clock moved by hand: when it starts, how long each
// drawing shows, the held pose and its blinks, a scene already complete, reduced motion, a finale not here in time,
// and when its files are fetched at all.
import { describe, expect, it } from 'vitest';
import { BLINK_MS, Director, FETCH_AT, FLASH_UP_MS, WAIT_MS, fetchOrder, fetchScope, needs, type FinaleManifest, type Readiness } from './finale';
import buildJson from '../../../frames/finale/build/finale.json';
import designJson from '../../../frames/finale/design/finale.json';
import growJson from '../../../frames/finale/grow/finale.json';
import setdesignJson from '../../../frames/finale/setdesign/finale.json';

// (As delivered, in frames/finale/.)
const build = buildJson as unknown as FinaleManifest;
const design = designJson as unknown as FinaleManifest;
const grow = growJson as unknown as FinaleManifest;
const setdesign = setdesignJson as unknown as FinaleManifest;

const RUN: FinaleManifest = {
  plate: { x: 0, y: 0, w: 100, h: 100 },
  size: [150, 150],
  frames: [
    { file: 'A.png', ms: 800 },
    { file: 'B.png', ms: 167 },
    { file: 'C.png', ms: 83 },
    { file: 'H.png', ms: 100 },
  ],
  blink: 'H_blink.png',
  parts: { stills: { 'A.png': 'A.png', 'H.png': 'H.png' }, patches: { 'B.png': { base: 'A.png', x: 1, y: 2, w: 3, h: 4 }, 'C.png': { base: 'A.png', same: true }, 'H_blink.png': { base: 'H.png', x: 5, y: 5, w: 5, h: 5 } } },
};
/** A finale that cuts straight to its held pose under a camera flash (as Film's will, once its pose is approved). */
const FLASH: FinaleManifest = {
  plate: { x: 0, y: 0, w: 100, h: 100 },
  size: [150, 150],
  frames: [{ file: 'H.png', ms: 100 }],
  blink: 'H_blink.png',
  transition: 'flash',
  parts: { stills: { 'H.png': 'H.png' }, patches: { 'H_blink.png': { base: 'H.png', x: 5, y: 5, w: 5, h: 5 } } },
};
const READY: Readiness = { still: false, playable: true, heldReady: true, blinkReady: true };
const NOTHING: Readiness = { still: false, playable: false, heldReady: false, blinkReady: false };
/** Blinks come exactly 3 s apart (rnd 0). */
const steady = (): number => 0;

/** What shows at each of these times. */
const at = (director: Director, times: number[], ready = READY): Array<string | null> => times.map((t) => director.update(t, ready));

describe('the finale starts on the tenth find, and keeps exact time', () => {
  it('nothing before the trigger: her routine', () => {
    const d = new Director(RUN, steady);
    expect(d.update(1000, READY)).toBeNull();
    expect(d.phase).toBe('routine');
  });

  it('each drawing for its own ms, from the clock (not frames), then the held pose', () => {
    const d = new Director(RUN, steady);
    d.trigger(1000, READY);
    expect(d.phase).toBe('playing');
    expect(at(d, [1000, 1799, 1800, 1966, 1967, 2049, 2050])).toEqual(['A.png', 'A.png', 'B.png', 'B.png', 'C.png', 'C.png', 'H.png']);
    // (One late frame of the page skips nothing in time: at 1990 it is C, whatever came before.)
    const late = new Director(RUN, steady);
    late.trigger(0, READY);
    expect(late.update(990, READY)).toBe('C.png');
    expect(at(d, [2149, 2150, 2500])).toEqual(['H.png', 'H.png', 'H.png']);
    expect(d.phase).toBe('held');
  });

  it('the held pose blinks for 133 ms every 3 to 6 s', () => {
    const d = new Director(RUN, steady);
    d.trigger(0, READY);
    // Held from 1150 (800 + 167 + 83 + 100); the first blink 3 s later.
    expect(d.update(1150, READY)).toBe('H.png');
    expect(d.phase).toBe('held');
    expect(at(d, [4149, 4150, 4150 + BLINK_MS - 1, 4150 + BLINK_MS])).toEqual(['H.png', 'H_blink.png', 'H_blink.png', 'H.png']);
    // The next is rolled from the end of that one: 3 s with rnd 0, 6 s with rnd 1.
    expect(d.update(4283 + 3000, READY)).toBe('H_blink.png');
    const slow = new Director(RUN, () => 1);
    slow.trigger(0, READY);
    expect(at(slow, [1150, 7149, 7150])).toEqual(['H.png', 'H.png', 'H_blink.png']);
  });

  it('a blink not decoded yet is skipped (the held pose stays)', () => {
    const d = new Director(RUN, steady);
    d.trigger(0, READY);
    d.update(1150, READY);
    expect(d.update(4200, { ...READY, blinkReady: false })).toBe('H.png');
  });

  it('a flash finale (a fixture: no delivered finale has one now) cuts under the flash: at its peak, not before', () => {
    const d = new Director(FLASH, steady);
    d.trigger(500, READY);
    expect(d.flashAt).toBe(500);
    expect(d.update(500 + FLASH_UP_MS - 1, READY)).toBeNull();
    expect(d.update(500 + FLASH_UP_MS, READY)).toBe('H.png');
    expect(d.update(500 + FLASH_UP_MS + 100, READY)).toBe('H.png');
    expect(d.phase).toBe('held');
  });

  it('a pause stops the clock; it carries on where it was', () => {
    const d = new Director(RUN, steady);
    d.trigger(0, READY);
    expect(d.update(700, READY)).toBe('A.png');
    d.pause(700);
    d.resume(5700);
    expect(d.update(5799, READY)).toBe('A.png');
    expect(d.update(5800, READY)).toBe('B.png');
  });

  it('left mid-way (the scene out of sight): it ends on the held pose', () => {
    const d = new Director(RUN, steady);
    d.trigger(0, READY);
    d.update(900, READY);
    d.finish(950);
    expect(d.phase).toBe('held');
    expect(d.update(960, READY)).toBe('H.png');
  });

  it('a hunt reset: back to her routine, and it can play again', () => {
    const d = new Director(RUN, steady);
    d.trigger(0, READY);
    d.reset();
    expect(d.update(100, READY)).toBeNull();
    d.trigger(200, READY);
    expect(d.update(200, READY)).toBe('A.png');
  });
});

describe('a scene already complete, and reduced motion', () => {
  it('revisit: the held pose at once, never the run before it, and no flash', () => {
    const d = new Director(FLASH, steady);
    d.complete(100);
    expect(d.flashAt).toBeNull();
    expect(d.update(100, READY)).toBe('H.png');
    const run = new Director(RUN, steady);
    run.complete(100);
    expect(run.update(100, READY)).toBe('H.png');
    // A later trigger (finds land again after a sync) does not replay it.
    run.trigger(200, READY);
    expect(run.update(200, READY)).toBe('H.png');
  });

  it('reduced motion (or paused): straight to the held pose, no flash, no blinks', () => {
    const still = { ...READY, still: true };
    const d = new Director(FLASH, steady);
    d.trigger(0, still);
    expect(d.flashAt).toBeNull();
    expect(d.update(0, still)).toBe('H.png');
    const run = new Director(RUN, steady);
    run.trigger(0, still);
    expect(at(run, [0, 4000, 4100, 9000], still)).toEqual(['H.png', 'H.png', 'H.png', 'H.png']);
  });

  it('motion stopped part-way: the held pose from then on', () => {
    const d = new Director(RUN, steady);
    d.trigger(0, READY);
    expect(d.update(100, READY)).toBe('A.png');
    expect(d.update(200, { ...READY, still: true })).toBe('H.png');
  });
});

describe('the tenth find before the finale is here', () => {
  it('the held pose is here: cut to it (with the flash, for a finale that has one)', () => {
    const d = new Director(RUN, steady);
    d.trigger(0, { ...NOTHING, heldReady: true });
    expect(d.update(0, { ...NOTHING, heldReady: true })).toBe('H.png');
    const f = new Director(FLASH, steady);
    f.trigger(0, { ...NOTHING, heldReady: true });
    expect(f.flashAt).toBe(0);
    expect(f.update(FLASH_UP_MS, { ...NOTHING, heldReady: true })).toBe('H.png');
  });

  it('nothing here: her routine, and the finale as soon as it is ready (within 3 s)', () => {
    const d = new Director(RUN, steady);
    d.trigger(0, NOTHING);
    expect(d.phase).toBe('waiting');
    expect(d.update(1000, NOTHING)).toBeNull();
    // The held pose arriving meanwhile does not cut the wait short: the finale is waited for.
    expect(d.update(1500, { ...NOTHING, heldReady: true })).toBeNull();
    expect(d.update(2000, READY)).toBe('A.png');
    expect(d.update(2800, READY)).toBe('B.png');
  });

  it('after 3 s it gives up: the held pose when it arrives', () => {
    const d = new Director(RUN, steady);
    d.trigger(0, NOTHING);
    expect(d.update(WAIT_MS, NOTHING)).toBeNull();
    // (The whole finale is here too late: it is not played.)
    expect(d.update(WAIT_MS + 500, { ...READY, heldReady: false })).toBeNull();
    expect(d.update(WAIT_MS + 900, { ...NOTHING, heldReady: true })).toBe('H.png');
    expect(d.phase).toBe('held');
  });
});

describe('what is fetched, and when', () => {
  it('nothing before six of the ten; the whole finale from six on', () => {
    for (let found = 0; found < FETCH_AT; found++) expect(fetchScope(found, 10)).toBe('none');
    for (let found = FETCH_AT; found < 10; found++) expect(fetchScope(found, 10)).toBe('all');
    expect(FETCH_AT).toBe(6);
  });

  it('a scene complete when shown: only the held pose and its blink; the tenth found just now: the whole', () => {
    expect(fetchScope(10, 10)).toBe('held');
    expect(fetchScope(10, 10, true)).toBe('all');
    expect(fetchOrder(setdesign,'held')).toEqual(['H.png', 'H_blink.png']);
    expect(fetchOrder(build,'held')).toEqual(['F17_ok.png', 'H_blink_ok.png']);
  });

  it('the first frame and the held pose first, each after its base; then the rest in order, each file once', () => {
    const order = fetchOrder(build,'all');
    expect(order.slice(0, 3)).toEqual(['F00_ok.png', 'F17_ok.png', 'H_blink_ok.png']);
    // (18 drawings and the blink.)
    expect(order).toHaveLength(19);
    expect(new Set(order).size).toBe(order.length);
    const set = fetchOrder(setdesign,'all');
    expect(set.slice(0, 3)).toEqual(['A00.png', 'H.png', 'H_blink.png']);
    // A patch comes after its base.
    expect(set.indexOf('R2.png')).toBeGreaterThan(set.indexOf('R1.png'));
    expect(fetchOrder(RUN, 'all')).toEqual(['A.png', 'H.png', 'H_blink.png', 'B.png']);
  });

  it('a patch needs its base; one that is `same` is its base', () => {
    expect(needs(RUN, 'B.png')).toEqual(['A.png', 'B.png']);
    expect(needs(RUN, 'C.png')).toEqual(['A.png']);
    expect(needs(RUN, 'H.png')).toEqual(['H.png']);
  });

  it('decodes only a few ahead while playing; the held pose and blink always', () => {
    const d = new Director(build,steady);
    expect(d.upcoming(0)).toEqual(['F00_ok.png', 'F17_ok.png', 'H_blink_ok.png']);
    d.trigger(0, READY);
    expect(d.upcoming(900)).toEqual(['F01_ok.png', 'F02_ok.png', 'F03_ok.png', 'F04_ok.png', 'F17_ok.png', 'H_blink_ok.png']);
  });
});

describe('the delivered finales', () => {
  it('none of them flashes: only a finale with `transition: "flash"` does', () => {
    for (const m of [RUN, build, grow, design, setdesign]) {
      const d = new Director(m, steady);
      d.trigger(0, READY);
      expect(d.flashAt).toBeNull();
    }
  });

  it.each([['build', build], ['grow', grow], ['design', design], ['setdesign', setdesign]] as const)('%s: every frame and patch is listed, the held pose last', (_name, manifest) => {
    const m = manifest;
    const known = new Set([...Object.keys(m.parts?.stills ?? {}), ...Object.keys(m.parts?.patches ?? {})]);
    for (const { file, ms } of m.frames) {
      expect(known.has(file), file).toBe(true);
      expect(ms).toBeGreaterThan(0);
    }
    if (m.blink) expect(known.has(m.blink)).toBe(true);
    expect(m.size[0] / m.plate.w).toBeCloseTo(1.5, 1);
  });
});

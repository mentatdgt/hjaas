// A whole cast in one package, tested on the café's manifests as `npm run assets` puts them in public/, so
// a new delivery that the engine cannot play fails here first. Also the reaction's vocabulary that the
// café's next delivery is expected to use (reviews/scene-3-build.md, section 3).
import { describe, expect, it } from 'vitest';
import framesJson from '../../public/assets/scene3/cast/frames.json';
import routineJson from '../../public/assets/scene3/cast/routine.json';
import { leadOf, splitCast, type CastFrames, type CastRoutines } from './cast';
import { NOTHING, checkClips, clipReaction, clipSchedule, restOf, type ClipFrames, type ClipRoutine, type Signal } from './clips';
import { seeded, type Step } from './steps';

const frames = framesJson as unknown as CastFrames;
const routines = routineJson as unknown as CastRoutines;
const { actors, problems } = splitCast(frames, routines, 1672);
const actor = (name: string) => actors.find((a) => a.name === name)!;
const take = (name: string, n: number, seed = 7): Step[] => {
  const { frames: own, routine } = actor(name);
  const schedule = clipSchedule(own, routine, seeded(seed));
  return Array.from({ length: n }, () => schedule.next().value);
};

describe("the café's package", () => {
  it('can be played', () => {
    expect(problems).toEqual([]);
  });

  it('is six actors, bottom to top, each with a routine of their own', () => {
    expect(actors.map((a) => a.name)).toEqual(frames.layers.map((layer) => layer.actor));
    expect(actors.length).toBeGreaterThanOrEqual(2);
    for (const a of actors) expect(Object.keys(routines.actors), a.name).toContain(a.name);
  });

  it('has one actor who answers a find, and she is the lead', () => {
    expect(actors.filter((a) => a.reacts).map((a) => a.name)).toEqual(['rachel']);
    expect(leadOf(actors)?.name).toBe('rachel');
  });

  it('puts every actor on the plate at its layer, scaled from the canvas', () => {
    const k = 1672 / frames.canvas.w;
    for (const layer of frames.layers) {
      const { canvas } = actor(layer.actor).frames;
      expect(canvas.plate_x).toBeCloseTo(layer.x * k);
      expect(canvas.plate_y).toBeCloseTo(layer.y * k);
      expect(canvas.plate_w).toBeCloseTo(layer.w * k);
      expect(canvas.w).toBe(layer.w);
      // Inside the plate.
      expect(canvas.plate_x).toBeGreaterThanOrEqual(0);
      expect(canvas.plate_x + canvas.plate_w).toBeLessThanOrEqual(1672);
      expect(canvas.plate_y + canvas.plate_h).toBeLessThanOrEqual(941.5);
    }
  });

  it("keeps every clip's patches inside its actor's box (npm run assets grows the box to hold them)", () => {
    for (const [name, clip] of Object.entries(frames.clips ?? {}) as Array<[string, { layer: string; x: number; y: number; w?: number; h?: number }]>) {
      const layer = frames.layers.find((l) => l.actor === clip.layer)!;
      expect(clip.x, name).toBeGreaterThanOrEqual(0);
      expect(clip.y, name).toBeGreaterThanOrEqual(0);
      expect(clip.x + (clip.w ?? 0), name).toBeLessThanOrEqual(layer.w);
      expect(clip.y + (clip.h ?? 0), name).toBeLessThanOrEqual(layer.h);
    }
  });

  it('gives each actor only their own stills and clips', () => {
    for (const a of actors) {
      const layer = frames.layers.find((l) => l.actor === a.name)!;
      expect(Object.keys(a.frames.stills)).toEqual([...layer.stills]);
      for (const name of Object.keys(a.frames.clips)) expect(frames.clips![name].layer).toBe(a.name);
    }
  });
});

describe('every actor plays by themselves', () => {
  for (const a of actors) {
    it(`${a.name}: only poses of their own, each for a positive time`, () => {
      for (const step of take(a.name, 1500)) {
        expect(step.ms).toBeGreaterThan(0);
        if (step.pose === NOTHING) continue;
        if (step.pose.includes('#')) expect(Object.keys(a.frames.clips)).toContain(step.pose.split('#')[0]);
        else expect(Object.keys(a.frames.stills)).toContain(step.pose);
      }
    });
  }

  it('the mum is part of the plate: nothing is drawn of her but a blink now and then', () => {
    const steps = take('mum', 400);
    expect(restOf(actor('mum').frames, actor('mum').routine)).toBe(NOTHING);
    const nothing = steps.filter((step) => step.pose === NOTHING);
    for (const step of nothing) {
      expect(step.ms).toBeGreaterThanOrEqual(4000);
      expect(step.ms).toBeLessThanOrEqual(8000);
    }
    const shown = steps.filter((step) => step.pose !== NOTHING).reduce((sum, step) => sum + step.ms, 0);
    const all = steps.reduce((sum, step) => sum + step.ms, 0);
    expect(shown / all).toBeLessThan(0.06);
  });

  it('they are out of step: no two actors change pose at the same moments', () => {
    const times = (name: string): number[] => {
      let at = 0;
      return take(name, 200, 3).map((step) => (at += step.ms));
    };
    const cat = new Set(times('cat').map((t) => Math.round(t)));
    const together = times('barista').filter((t) => cat.has(Math.round(t))).length;
    expect(together).toBeLessThan(5);
  });

  it('only stills are needed until the clips have loaded', () => {
    const { frames: own, routine } = actor('rachel');
    const schedule = clipSchedule(own, routine, seeded(1), () => false);
    for (let i = 0; i < 300; i++) expect(schedule.next().value.pose).not.toContain('#');
  });
});

describe('Rachel in the café', () => {
  const { frames: own, routine } = actor('rachel');
  const REST = 'R_A1_sketch';
  /** Play until `when` says so, then say a find is waiting, and collect what follows up to the rest pose. */
  const interrupt = (when: (step: Step) => boolean, seed = 5): { at: Step; home: Step[] } => {
    const schedule = clipSchedule(own, routine, seeded(seed));
    let step = schedule.next().value;
    for (let i = 0; i < 5000 && !when(step); i++) step = schedule.next().value;
    const at = step;
    const home: Step[] = [];
    let signal: Signal = 'react';
    for (let i = 0; i < 200; i++) {
      step = schedule.next(signal).value;
      signal = 'react';
      home.push(step);
      if (step.pose === REST) break;
    }
    return { at, home };
  };

  it('rests on the still her reaction starts from, though the manifest does not name it', () => {
    expect(routine.reaction?.enter_from).toBeUndefined();
    expect(restOf(own, routine)).toBe(REST);
  });

  it('sketching: a find is answered from the next rest frame', () => {
    const { home } = interrupt((step) => step.pose === 'R_A2_stroke');
    expect(home.map((step) => step.pose)).toEqual([REST]);
  });

  it('with the cup at her lips: the hold may be cut to 300 ms, then the sip runs backwards, then she rests', () => {
    const { at, home } = interrupt((step) => step.pose === 'R_B1_sip');
    expect(at.brief).toBe(300);
    const n = own.clips.sip.frames.length;
    expect(home.slice(0, n).map((step) => step.pose)).toEqual(Array.from({ length: n }, (_, i) => `sip#${n - 1 - i}`));
    expect(home[n].pose).toBe(REST);
  });

  it('part-way into the sip: it runs back from where it had got to, with no jump', () => {
    const { at, home } = interrupt((step) => step.pose === 'sip#9');
    expect(at.pose).toBe('sip#9');
    expect(home.slice(0, 9).map((step) => step.pose)).toEqual(['sip#8', 'sip#7', 'sip#6', 'sip#5', 'sip#4', 'sip#3', 'sip#2', 'sip#1', 'sip#0']);
    expect(home[9].pose).toBe(REST);
  });

  it('names every clip frame before it is shown, on the way home too', () => {
    for (const when of [(step: Step) => step.pose === 'R_B1_sip', (step: Step) => step.pose === 'sip#20']) {
      const schedule = clipSchedule(own, routine, seeded(11));
      let step = schedule.next().value;
      let ready = new Set(step.soon ?? []);
      let signal: Signal;
      for (let i = 0; i < 4000; i++) {
        if (when(step)) signal = 'react';
        const next = schedule.next(signal).value;
        if (next.pose.includes('#')) expect(ready.has(next.pose), `${next.pose} after ${step.pose}`).toBe(true);
        ready = new Set([...(step.soon ?? []), ...(next.soon ?? [])]);
        step = next;
        if (signal && step.pose === REST) break;
      }
    }
  });

  it('reacts as routine.json says: looks up, holds the look, and comes back down', () => {
    const reaction = clipReaction(own, routine)!;
    const n = own.clips.look_up.frames.length;
    expect(reaction.steps.slice(0, n).map((step) => step.pose)).toEqual(Array.from({ length: n }, (_, i) => `look_up#${i}`));
    expect(reaction.steps[n]).toEqual({ pose: 'R_K1_look', ms: 1300 });
    expect(reaction.still).toEqual([{ pose: 'R_K1_look', ms: 1300 }]);
    expect(reaction.steps.at(-1)?.pose).toBe(REST);
  });
});

describe("the reaction the café's next delivery will use", () => {
  // Rachel's manifests, with the two stills and the reaction the brief describes: look up, hold the look,
  // hold a smile in which she may blink, and a way back that is another clip or a reversed one.
  const own: ClipFrames = { ...actor('rachel').frames, stills: { ...actor('rachel').frames.stills, R_K2_smile: 'rachel/R_K2_smile.png', R_K1_blink: 'rachel/R_K1_blink.png' } };
  const base = actor('rachel').routine;
  const withReaction = (steps: unknown[], blink: unknown = base.blink): ClipRoutine => ({ ...base, blink, reaction: { steps } } as unknown as ClipRoutine);
  const smile = (extra: object) => [
    { clip: 'look_up', ms: 60 },
    { still: 'R_K1_look', ms: [500, 700] },
    { still: 'R_K2_smile', ms: [1200, 1600], ...extra },
    { clip: 'sip', ms: 50, reverse: true },
    { still: 'R_A1_sketch', ms: 300 },
  ];
  const poses = (steps: Step[]): string[] => steps.map((step) => step.pose).filter((pose) => !pose.includes('#'));

  it('can be checked and played', () => {
    for (const routine of [withReaction(smile({ blink: 'R_K1_blink' })), withReaction(smile({ blink: { still: 'R_K1_blink', ms: 80 } })), withReaction(smile({ blink_ok: true }), [base.blink, { on: 'R_K2_smile', frames: [{ still: 'R_K1_blink', ms: 90 }] }])]) {
      expect(checkClips(own, routine)).toEqual([]);
      expect(restOf(own, routine)).toBe('R_A1_sketch');
    }
  });

  it('holds the look, then the smile, and comes back by the other clip, reversed', () => {
    const reaction = clipReaction(own, withReaction(smile({})))!;
    expect(poses(reaction.steps)).toEqual(['R_K1_look', 'R_K2_smile', 'R_A1_sketch']);
    expect(reaction.steps.find((step) => step.pose === 'R_K1_look')?.ms).toBe(600);
    expect(reaction.steps.find((step) => step.pose === 'R_K2_smile')?.ms).toBe(1400);
    const back = reaction.steps.filter((step) => step.pose.startsWith('sip#')).map((step) => step.pose);
    expect(back[0]).toBe(`sip#${own.clips.sip.frames.length - 1}`);
    expect(back.at(-1)).toBe('sip#0');
    // The smile is the held pose when motion is paused or reduced.
    expect(reaction.still).toEqual([{ pose: 'R_K2_smile', ms: 1400 }]);
  });

  it('rolls the holds afresh each time, inside their ranges', () => {
    const reaction = clipReaction(own, withReaction(smile({})))!;
    const rnd = seeded(2);
    const looks = Array.from({ length: 40 }, () => reaction.roll(rnd).find((step) => step.pose === 'R_K1_look')!.ms);
    expect(Math.min(...looks)).toBeGreaterThanOrEqual(500);
    expect(Math.max(...looks)).toBeLessThanOrEqual(700);
    expect(new Set(looks.map(Math.round)).size).toBeGreaterThan(10);
  });

  for (const [how, extra, blink] of [
    ['named on the step', { blink: 'R_K1_blink' }, undefined],
    ['given with its time', { blink: { still: 'R_K1_blink', ms: 80 } }, undefined],
    ['allowed by a blink rule for that still', { blink_ok: true }, [base.blink, { on: ['R_K2_smile'], frames: [{ still: 'R_K1_blink', ms: 90 }] }]],
  ] as const) {
    it(`may blink inside the smile: ${how}`, () => {
      const reaction = clipReaction(own, withReaction(smile(extra), blink ?? base.blink))!;
      const rnd = seeded(4);
      let blinked = 0;
      for (let i = 0; i < 60; i++) {
        const steps = reaction.roll(rnd);
        const held = poses(steps);
        if (held.includes('R_K1_blink')) {
          blinked++;
          // In the middle of the smile, which comes back afterwards, and the whole still takes the rolled time.
          expect(held).toEqual(['R_K1_look', 'R_K2_smile', 'R_K1_blink', 'R_K2_smile', 'R_A1_sketch']);
          const at = steps.findIndex((step) => step.pose === 'R_K1_blink');
          expect(steps[at - 1].ms).toBeGreaterThanOrEqual(240);
          expect(steps[at + 1].ms).toBeGreaterThanOrEqual(240);
          const total = steps[at - 1].ms + steps[at].ms + steps[at + 1].ms;
          expect(total).toBeGreaterThanOrEqual(1200);
          expect(total).toBeLessThanOrEqual(1600);
        } else {
          expect(held).toEqual(['R_K1_look', 'R_K2_smile', 'R_A1_sketch']);
        }
      }
      // Allowed, not certain: more often than not.
      expect(blinked).toBeGreaterThan(25);
      expect(blinked).toBeLessThan(60);
      // The plain list (what is kept decoded, and what stands in before a roll) has no blink.
      expect(poses(reaction.steps)).not.toContain('R_K1_blink');
    });
  }
});

describe('splitCast', () => {
  it('says what is wrong, in words', () => {
    expect(splitCast({} as CastFrames, routines, 1672).problems[0]).toMatch(/canvas/);
    expect(splitCast({ canvas: { w: 10, h: 10 }, layers: [], stills: {} }, routines, 1672).problems[0]).toMatch(/layers/);
    const missing = splitCast({ ...frames, layers: frames.layers.filter((layer) => layer.actor !== 'cat') }, routines, 1672).problems;
    expect(missing.join(' ')).toMatch(/"cat", who has no layer/);
    const stray = splitCast({ ...frames, clips: { ...frames.clips, wave: { layer: 'dog', base: 'x', x: 0, y: 0, frames: ['a.png'] } } }, routines, 1672).problems;
    expect(stray.join(' ')).toMatch(/"wave" belongs to the layer "dog"/);
    const still = splitCast({ ...frames, layers: frames.layers.map((layer) => (layer.actor === 'cat' ? { ...layer, stills: ['cat_9'] } : layer)) }, routines, 1672).problems;
    expect(still.join(' ')).toMatch(/cat/);
  });

  it('lets an actor with no routine simply stand there', () => {
    const { actors: some, problems: none } = splitCast(frames, { actors: { rachel: routines.actors.rachel } }, 1672);
    expect(none).toEqual([]);
    const cat = some.find((a) => a.name === 'cat')!;
    const schedule = clipSchedule(cat.frames, cat.routine, seeded(1));
    expect(schedule.next().value.pose).toBe(frames.layers.find((layer) => layer.actor === 'cat')!.stills[0]);
  });
});

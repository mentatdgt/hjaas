// A whole cast in one package, tested on the café's manifests as `npm run assets` puts them in public/, so
// a new delivery that the engine cannot play fails here first. Also the reaction's vocabulary that the
// café's next delivery is expected to use (reviews/scene-3-build.md, section 3).
import { describe, expect, it } from 'vitest';
import framesJson from '../../public/assets/scene3/cast/frames.json';
import routineJson from '../../public/assets/scene3/cast/routine.json';
import { leadOf, splitCast, type CastFrames, type CastRoutines } from './cast';
import { NOTHING, checkClips, clipReaction, clipSchedule, restOf, stillsInUse, type ClipFrames, type ClipRoutine, type Signal } from './clips';
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

});

describe('Rachel in the café', () => {
  const { frames: own, routine } = actor('rachel');
  const REST = 'R_A1_sketch';

  it('rests on the still her routine opens on, though the manifest does not name it', () => {
    expect(routine.reaction?.enter_from).toBeUndefined();
    expect(restOf(own, routine)).toBe(REST);
  });

  it('sketching: a find is answered from the next rest frame', () => {
    const schedule = clipSchedule(own, routine, seeded(5));
    let step = schedule.next().value;
    while (step.pose !== 'R_A2_stroke') step = schedule.next().value;
    expect(schedule.next('react').value.pose).toBe(REST);
  });

  it('blinks only in the middle of a hold on the sketch pose, after the dissolve into it', () => {
    const steps = take('rachel', 3000);
    let blinks = 0;
    steps.forEach((step, i) => {
      if (step.pose !== 'R_A1_blink') return;
      blinks++;
      expect(steps[i - 1].pose).toBe(REST);
      expect(steps[i + 1].pose).toBe(REST);
      // The part of the hold before the blink is at least as long as the dissolve it starts with.
      expect(steps[i - 1].ms).toBeGreaterThanOrEqual(steps[i - 1].fade ?? 0);
      expect(step.fade).toBeUndefined();
      expect(steps[i + 1].fade).toBeUndefined();
    });
    expect(blinks).toBeGreaterThan(20);
  });

  it('reacts as routine.json says, with every hold inside its range', () => {
    const reaction = clipReaction(own, routine)!;
    const written = routine.reaction!.steps as Array<{ still: string; ms: number | [number, number]; fade_ms?: number }>;
    expect(reaction.steps.map((step) => step.pose)).toEqual(written.map((item) => item.still));
    const rnd = seeded(8);
    for (let n = 0; n < 20; n++) {
      const rolled = reaction.roll(rnd);
      rolled.forEach((step, i) => {
        const { ms, fade_ms } = written[i];
        expect(step.ms).toBeGreaterThanOrEqual(typeof ms === 'number' ? ms : ms[0]);
        expect(step.ms).toBeLessThanOrEqual(typeof ms === 'number' ? ms : ms[1]);
        expect(step.fade).toBe(fade_ms);
      });
    }
    // Her held pose, for paused or reduced motion, is the one she holds longest.
    expect(reaction.still.map((step) => step.pose)).toEqual(['R_K2_smile']);
    expect(reaction.steps.at(-1)?.pose).toBe(REST);
  });
});

describe('fade_ms: a dissolve into a still', () => {
  it('is carried by the step it is written on, in a loop and out of one', () => {
    for (const a of actors) {
      const written = new Map<string, Set<number | undefined>>();
      for (const item of a.routine.routine) {
        for (const step of 'steps' in item ? item.steps : 'still' in item ? [item] : []) {
          if (step.still) written.set(step.still, (written.get(step.still) ?? new Set()).add(step.fade_ms));
        }
      }
      const blinks = new Set(([] as string[]).concat(...[a.routine.blink ?? []].flat().map((rule) => rule.frames.map((frame) => frame.still))));
      const steps = take(a.name, 600);
      steps.forEach((step, i) => {
        if (step.pose === NOTHING || blinks.has(step.pose)) return expect(step.fade, `${a.name} ${step.pose}`).toBeUndefined();
        // (The rest of a hold, after a blink in the middle of it, cuts back.)
        if (i > 0 && blinks.has(steps[i - 1].pose)) return expect(step.fade).toBeUndefined();
        expect([...written.get(step.pose)!], `${a.name} ${step.pose}`).toContain(step.fade);
      });
    }
  });

  it("is what the café's package uses everywhere but in blinks", () => {
    expect(take('cat', 50).filter((step) => step.fade === 1000).length).toBeGreaterThan(30);
    expect(take('mum', 50).every((step) => step.fade === undefined)).toBe(true);
    expect(take('barista', 50).every((step) => step.fade !== undefined)).toBe(true);
  });

  it('never outlasts the hold it opens', () => {
    for (const a of actors) for (const step of take(a.name, 400)) if (step.fade) expect(step.fade, `${a.name} ${step.pose}`).toBeLessThanOrEqual(step.ms);
  });
});

describe('only the stills the manifests show are loaded', () => {
  it('leaves out a pose no routine uses', () => {
    const used = stillsInUse(actor('barista').frames, actor('barista').routine);
    expect(used).toEqual(['B_1', 'B_2', 'B_4']);
    expect(Object.keys(actor('barista').frames.stills)).toContain('B_3');
    const hers = stillsInUse(actor('rachel').frames, actor('rachel').routine);
    expect(hers).toEqual(expect.arrayContaining(['R_A1_sketch', 'R_A2_stroke', 'R_A1_blink', 'R_K1_blink', 'R_K1_look', 'R_K2_smile']));
    expect(hers).not.toContain('R_B1_sip');
  });

  it('never leaves out one that is shown', () => {
    for (const a of actors) {
      const used = new Set(stillsInUse(a.frames, a.routine));
      for (const step of take(a.name, 800)) if (step.pose !== NOTHING) expect(used.has(step.pose), `${a.name} ${step.pose}`).toBe(true);
      for (const step of clipReaction(a.frames, a.routine)?.steps ?? []) expect(used.has(step.pose)).toBe(true);
    }
  });
});

// The vocabulary the café's first delivery used, and that a later one may use again (reviews/scene-3-build.md,
// sections 2 and 3): clips of patches, a hold away from the rest pose that a find may cut short, a reaction
// with a clip, held looks, a smile she may blink in, and a way back by another clip or a reversed one.
describe('a cast member with clips (made up: the café has none for now)', () => {
  const own: ClipFrames = {
    canvas: { w: 100, h: 100, plate_x: 0, plate_y: 0, plate_w: 50, plate_h: 50 },
    stills: { sketch: 'a.png', sip: 'b.png', look: 'c.png', smile: 'd.png', blink: 'e.png', look_blink: 'f.png' },
    clips: {
      sip: { base: 'sketch', x: 10, y: 0, frames: Array.from({ length: 12 }, (_, i) => `sip_${i}.png`) },
      look_up: { base: 'sketch', x: 5, y: 5, frames: Array.from({ length: 8 }, (_, i) => `look_${i}.png`) },
    },
  };
  const sketching = [
    { loop: 'sketch', repeat: [2, 3], steps: [{ still: 'sketch', ms: [500, 900], blink_ok: true }, { still: 'sketch', ms: 300 }] },
    { clip: 'sip', ms: 80 },
    { still: 'sip', ms: [1800, 2600] },
    { clip: 'sip', ms: 70, reverse: true },
    { still: 'sketch', ms: [600, 1000] },
  ];
  const blink = { on: 'sketch', frames: [{ still: 'blink', ms: 90 }], every_ms: [3000, 6000] };
  const withReaction = (steps: unknown[], rules: unknown = blink): ClipRoutine => ({ routine: sketching, blink: rules, reaction: { steps } } as unknown as ClipRoutine);
  const smile = (extra: object) => [
    { clip: 'look_up', ms: 60 },
    { still: 'look', ms: [500, 700] },
    { still: 'smile', ms: [1200, 1600], fade_ms: 150, ...extra },
    { clip: 'sip', ms: 50, reverse: true },
    { still: 'sketch', ms: 300 },
  ];
  const routine = withReaction(smile({}));
  const poses = (steps: Step[]): string[] => steps.map((step) => step.pose).filter((pose) => !pose.includes('#'));
  /** Play until `when` says so, then say a find is waiting, and collect what follows up to the rest pose. */
  const interrupt = (when: (step: Step) => boolean, has: (clip: string) => boolean = () => true): { at: Step; home: Step[] } => {
    const schedule = clipSchedule(own, routine, seeded(5), has);
    let step = schedule.next().value;
    for (let i = 0; i < 5000 && !when(step); i++) step = schedule.next().value;
    const at = step;
    const home: Step[] = [];
    for (let i = 0; i < 200; i++) {
      step = schedule.next('react' as Signal).value;
      home.push(step);
      if (step.pose === 'sketch') break;
    }
    return { at, home };
  };

  it('can be checked, and rests on the base still of the reaction\'s first clip', () => {
    for (const r of [routine, withReaction(smile({ blink: 'look_blink' })), withReaction(smile({ blink: { still: 'look_blink', ms: 80 } })), withReaction(smile({ blink_ok: true }), [blink, { on: 'smile', frames: [{ still: 'look_blink', ms: 90 }] }])]) {
      expect(checkClips(own, r)).toEqual([]);
      expect(restOf(own, r)).toBe('sketch');
    }
    expect(checkClips(own, withReaction(smile({ blink: 'nowhere' }))).join(' ')).toMatch(/"nowhere"/);
  });

  it('with the cup at her lips: the hold may be cut to 300 ms, then the sip runs backwards, then she rests', () => {
    const { at, home } = interrupt((step) => step.pose === 'sip');
    expect(at.brief).toBe(300);
    expect(home.slice(0, 12).map((step) => step.pose)).toEqual(Array.from({ length: 12 }, (_, i) => `sip#${11 - i}`));
    expect(home[12].pose).toBe('sketch');
  });

  it('part-way into the sip: it runs back from where it had got to, with no jump', () => {
    const { home } = interrupt((step) => step.pose === 'sip#4');
    expect(home.map((step) => step.pose)).toEqual(['sip#3', 'sip#2', 'sip#1', 'sip#0', 'sketch']);
  });

  it('until the sip has loaded she never has the cup at her lips: the pose only the clip leads to is passed over', () => {
    const schedule = clipSchedule(own, routine, seeded(1), () => false);
    for (let i = 0; i < 300; i++) expect(['sketch', 'blink']).toContain(schedule.next().value.pose);
  });

  it('reacts: looks up, holds the look, dissolves into the smile, and comes back by the other clip, reversed', () => {
    const reaction = clipReaction(own, routine)!;
    expect(poses(reaction.steps)).toEqual(['look', 'smile', 'sketch']);
    expect(reaction.steps.find((step) => step.pose === 'look')).toEqual({ pose: 'look', ms: 600 });
    expect(reaction.steps.find((step) => step.pose === 'smile')).toEqual({ pose: 'smile', ms: 1400, fade: 150 });
    const back = reaction.steps.filter((step) => step.pose.startsWith('sip#')).map((step) => step.pose);
    expect(back[0]).toBe('sip#11');
    expect(back.at(-1)).toBe('sip#0');
    expect(reaction.still).toEqual([{ pose: 'smile', ms: 1400 }]);
  });

  for (const [how, extra, rules] of [
    ['named on the step', { blink: 'look_blink' }, blink],
    ['given with its time', { blink: { still: 'look_blink', ms: 80 } }, blink],
    ['allowed by a blink rule for that still', { blink_ok: true }, [blink, { on: ['smile'], frames: [{ still: 'look_blink', ms: 90 }] }]],
  ] as const) {
    it(`may blink inside the smile: ${how}`, () => {
      const reaction = clipReaction(own, withReaction(smile(extra), rules))!;
      const rnd = seeded(4);
      let blinked = 0;
      for (let i = 0; i < 60; i++) {
        const steps = reaction.roll(rnd);
        const held = poses(steps);
        if (held.includes('look_blink')) {
          blinked++;
          // In the middle of the smile, which comes back afterwards, and the whole hold takes the rolled time.
          expect(held).toEqual(['look', 'smile', 'look_blink', 'smile', 'sketch']);
          const at = steps.findIndex((step) => step.pose === 'look_blink');
          expect(steps[at - 1].ms).toBeGreaterThanOrEqual(240);
          expect(steps[at - 1].fade).toBe(150);
          expect(steps[at + 1].ms).toBeGreaterThanOrEqual(240);
          expect(steps[at + 1].fade).toBeUndefined();
          const total = steps[at - 1].ms + steps[at].ms + steps[at + 1].ms;
          expect(total).toBeGreaterThanOrEqual(1200);
          expect(total).toBeLessThanOrEqual(1600);
        } else {
          expect(held).toEqual(['look', 'smile', 'sketch']);
        }
      }
      // Allowed, not certain: more often than not.
      expect(blinked).toBeGreaterThan(25);
      expect(blinked).toBeLessThan(60);
      // The plain list (what is kept decoded, and what stands in before a roll) has no blink.
      expect(poses(reaction.steps)).not.toContain('look_blink');
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

// A whole cast in one package, tested on the café's manifests as `npm run assets` puts them in public/, so
// a new delivery that the engine cannot play fails here first. Also the reaction's vocabulary that the
// café's next delivery is expected to use (reviews/scene-3-build.md, section 3).
import { describe, expect, it } from 'vitest';
import framesJson from '../../public/assets/scene3/cast/frames.json';
import routineJson from '../../public/assets/scene3/cast/routine.json';
import { leadOf, splitCast, type CastFrames, type CastRoutines } from './cast';
import { backing } from './character';
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

  it('is its actors, bottom to top, each with a routine of their own', () => {
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

  it('the mum is part of the plate: nothing is drawn of her but a sip at the start of her loop, then four blinks', () => {
    const steps = take('mum', 600);
    expect(restOf(actor('mum').frames, actor('mum').routine)).toBe(NOTHING);
    const shown = steps.filter((step) => step.pose !== NOTHING);
    // Each pass (package v10): M_S1 220, M_S2 1.4-1.8 s, M_S1 220, then four blinks of three frames each.
    const PASS = ['M_S1', 'M_S2', 'M_S1', ...Array(4).fill(['M_blink_half', 'M_blink_closed', 'M_blink_half']).flat()];
    const passes = Math.floor(shown.length / PASS.length);
    expect(passes).toBeGreaterThan(20);
    for (let n = 0; n < passes; n++) expect(shown.slice(n * PASS.length, (n + 1) * PASS.length).map((step) => step.pose)).toEqual(PASS);
    for (const step of steps) {
      if (step.pose === 'M_S2') {
        expect(step.ms).toBeGreaterThanOrEqual(1400);
        expect(step.ms).toBeLessThanOrEqual(1800);
      }
      if (step.pose === 'M_S1') expect(step.ms).toBe(220);
    }
    // A loop of about 22 s, a little over a tenth of it with anything of her drawn.
    const all = steps.reduce((sum, step) => sum + step.ms, 0);
    expect(all / passes / 1000).toBeGreaterThan(21);
    expect(all / passes / 1000).toBeLessThan(23.5);
    expect(shown.reduce((sum, step) => sum + step.ms, 0) / all).toBeLessThan(0.15);
  });

  it('they are out of step: no two actors change pose at the same moments', () => {
    const times = (name: string): number[] => {
      let at = 0;
      return take(name, 200, 3).map((step) => (at += step.ms));
    };
    const cat = new Set(times('cat').map((t) => Math.round(t)));
    const together = times('child').filter((t) => cat.has(Math.round(t))).length;
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

  it('sketching: a find is answered from the next rest frame, and the stroke she is on may end at 300 ms', () => {
    const schedule = clipSchedule(own, routine, seeded(5));
    let step = schedule.next().value;
    while (step.pose !== 'R_A2_stroke') step = schedule.next().value;
    expect(step.brief).toBe(300);
    expect(schedule.next('react').value.pose).toBe(REST);
    // (Only for her: nobody else is waited for, so nobody else's holds are marked.)
    for (const a of actors) if (!a.reacts) for (const other of take(a.name, 100)) expect(other.brief).toBeUndefined();
  });

  // The coffee sip (package v6 on): reach, lift, sip, lift, reach, as cuts between drawn poses.
  const SIP = ['R_S1_reach', 'R_S2_lift', 'R_B1_sip', 'R_S2_lift', 'R_S1_reach'];
  const sipping = new Set(SIP);
  /** Play to the nth pose of the sip, say a find is waiting, and collect what follows up to the rest pose. */
  const found = (nth: number): { at: Step; home: Step[] } => {
    const schedule = clipSchedule(own, routine, seeded(11));
    let step = schedule.next().value;
    for (let seen = -1; ; step = schedule.next().value) {
      if (sipping.has(step.pose)) seen++;
      else seen = -1;
      if (seen === nth) break;
    }
    const at = step;
    const home: Step[] = [];
    do home.push((step = schedule.next('react').value));
    while (step.pose !== REST && home.length < 50);
    return { at, home };
  };

  it('sips her coffee once in each pass of the routine: five poses, all cuts, back to the sketch', () => {
    const steps = take('rachel', 2000);
    const runs: string[][] = [];
    steps.forEach((step, i) => {
      if (!sipping.has(step.pose)) return;
      expect(step.fade).toBeUndefined();
      if (i > 0 && sipping.has(steps[i - 1].pose)) runs[runs.length - 1].push(step.pose);
      else {
        expect(steps[i - 1].pose).toBe(REST);
        runs.push([step.pose]);
      }
      if (!sipping.has(steps[i + 1]?.pose ?? REST)) {
        expect(steps[i + 1]?.pose ?? REST).toBe(REST);
        expect(steps[i + 1]?.fade).toBeUndefined();
      }
    });
    expect(runs.length).toBeGreaterThan(20);
    for (const run of runs.slice(0, -1)) expect(run).toEqual(SIP);
  });

  it('never blinks during the sip, or on the frames beside it', () => {
    const steps = take('rachel', 4000);
    steps.forEach((step, i) => {
      if (step.pose !== 'R_A1_blink') return;
      expect(sipping.has(steps[i - 1].pose)).toBe(false);
      expect(sipping.has(steps[i + 1].pose)).toBe(false);
    });
    expect(steps.some((step) => step.pose === 'R_A1_blink')).toBe(true);
  });

  it('a find during the sip: she finishes it first, with the cup at her lips for 300 ms, and only then is home', () => {
    const quick = (steps: Step[]): Array<[string, number]> => steps.map((step) => [step.pose, step.ms]);
    const down: Array<[string, number]> = [['R_S2_lift', 210], ['R_S1_reach', 230], [REST, 300]];
    // Reaching for the cup, and lifting it: the rest of the sip, the long hold cut short.
    expect(quick(found(0).home)).toEqual([['R_S2_lift', 190], ['R_B1_sip', 300], ...down]);
    expect(quick(found(1).home)).toEqual([['R_B1_sip', 300], ...down]);
    // With the cup at her lips: that hold itself may end at 300 ms.
    const lips = found(2);
    expect(lips.at.pose).toBe('R_B1_sip');
    expect(lips.at.brief).toBe(300);
    expect(lips.at.ms).toBeGreaterThanOrEqual(1800);
    expect(quick(lips.home)).toEqual(down);
    // On the way down she simply carries on.
    expect(quick(found(3).home)).toEqual(down.slice(1));
    expect(quick(found(4).home)).toEqual(down.slice(2));
    // Nothing on the way home is dissolved, blinked in or skipped.
    for (let nth = 0; nth < 5; nth++) for (const step of found(nth).home) expect(step.fade).toBeUndefined();
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
    const written = routine.reaction!.steps as Array<{ still: string; ms: number | [number, number] }>;
    expect(reaction.steps.map((step) => step.pose)).toEqual(written.map((item) => item.still));
    const rnd = seeded(8);
    for (let n = 0; n < 20; n++) {
      const rolled = reaction.roll(rnd);
      rolled.forEach((step, i) => {
          const { ms } = written[i];
        expect(step.ms).toBeGreaterThanOrEqual(typeof ms === 'number' ? ms : ms[0]);
        expect(step.ms).toBeLessThanOrEqual(typeof ms === 'number' ? ms : ms[1]);
        expect(step.fade).toBeUndefined();
      });
    }
    // Her held pose, for paused or reduced motion, is the one she holds longest.
    expect(reaction.still.map((step) => step.pose)).toEqual(['R_K2_smile']);
    expect(reaction.steps.at(-1)?.pose).toBe(REST);
  });
});

describe('the rest of the café (package v10)', () => {
  it('the barista circles the cup with her cloth on cuts alone, a few rounds, then pauses and glances up', () => {
    const steps = take('barista', 600);
    const seen = new Set(steps.map((step) => step.pose));
    expect([...seen].sort()).toEqual(['B_1', 'B_2_polish', 'B_3_polish', 'B_4_glance', 'B_P1', 'B_P2', 'B_P3']);
    for (const step of steps) expect(step.fade).toBeUndefined();
    // The circle: always in this order, each pose 140-200 ms.
    const CIRCLE = ['B_1', 'B_P1', 'B_2_polish', 'B_P2', 'B_3_polish', 'B_P3'];
    steps.forEach((step, i) => {
      const at = CIRCLE.indexOf(step.pose);
      if (at > 0) expect(steps[i - 1]?.pose ?? CIRCLE[at - 1]).toBe(CIRCLE[at - 1]);
      if (at > 0) {
        expect(step.ms).toBeGreaterThanOrEqual(140);
        expect(step.ms).toBeLessThanOrEqual(200);
      }
    });
    // Between the rounds and the glance, a long B_1; the glance comes from it and goes back to it.
    steps.forEach((step, i) => {
      if (step.pose !== 'B_4_glance' || i === 0) return;
      expect(steps[i - 1]).toMatchObject({ pose: 'B_1' });
      expect(steps[i - 1].ms).toBeGreaterThanOrEqual(1500);
      expect(steps[i + 1]?.pose ?? 'B_1').toBe('B_1');
    });
  });

  it('the old man blinks on his reading pose only, and turns his page in five drawn steps, on cuts', () => {
    const steps = take('oldman', 3000);
    const TURN = ['T1', 'T2', 'R0', 'R1', 'R2'];
    const MS: Record<string, number> = { T1: 130, T2: 140, R0: 130, R1: 170, R2: 160 };
    let turns = 0;
    let blinks = 0;
    let readSince = 0;
    let t = 0;
    let lastTurn = -1;
    const gaps: number[] = [];
    steps.forEach((step, i) => {
      expect(step.fade).toBeUndefined();
      if (step.pose === 'O_blink') {
        blinks++;
        expect(step.ms).toBe(100);
        expect([steps[i - 1].pose, steps[i + 1]?.pose ?? 'O_1']).toEqual(['O_1', 'O_1']);
      }
      if (step.pose === 'T1' && i + 5 < steps.length) {
        turns++;
        expect(steps.slice(i, i + 5).map((each) => [each.pose, each.ms])).toEqual(TURN.map((pose) => [pose, MS[pose]]));
        expect(steps[i + 5]?.pose ?? 'O_1').toBe('O_1');
        if (lastTurn >= 0) gaps.push(t - lastTurn);
        lastTurn = t;
      }
      if (step.pose === 'O_1') readSince += step.ms;
      t += step.ms;
    });
    expect(turns).toBeGreaterThan(100);
    expect(blinks).toBeGreaterThan(100);
    expect(readSince).toBeGreaterThan(0);
    // A page every 5-7 s (and the old O_2/O_3 are gone).
    gaps.sort((a, b) => a - b);
    expect(gaps[Math.floor(gaps.length * 0.05)]).toBeGreaterThan(4500);
    expect(gaps[Math.floor(gaps.length * 0.95)]).toBeLessThan(7200);
    expect(steps.some((step) => step.pose === 'O_2' || step.pose === 'O_3')).toBe(false);
  });

  it('the cat flicks her tail out and back twice a loop, at its start and about 60% through, and breathes in between', () => {
    const steps = take('cat', 2100);
    const FLICK: Array<[string, number]> = [['cat_F1', 110], ['cat_F2', 500], ['cat_F1', 110]];
    let flicks = 0;
    let t = 0;
    const starts: number[] = [];
    steps.forEach((step, i) => {
      if (step.pose === 'cat_F2') {
        flicks++;
        expect([steps[i - 1], step, steps[i + 1]].map((each) => [each.pose, each.ms])).toEqual(FLICK);
        starts.push(t - steps[i - 1].ms);
      }
      if (step.pose.startsWith('cat_F')) expect(step.fade).toBeUndefined();
      t += step.ms;
    });
    expect(flicks).toBeGreaterThan(150);
    expect(steps.some((step) => step.pose === 'cat_3')).toBe(false);
    // Every other flick opens a pass; the one between comes at about 60% of it.
    for (let n = 0; n + 2 < starts.length; n += 2) {
      const share = (starts[n + 1] - starts[n]) / (starts[n + 2] - starts[n]);
      expect(share).toBeGreaterThan(0.5);
      expect(share).toBeLessThan(0.7);
    }
  });

  it('the child colours with his head down, then looks up at his mum and back, on cuts', () => {
    const steps = take('child', 1200);
    let looks = 0;
    steps.forEach((step, i) => {
      if (step.pose !== 'C_3' || i === 0) return;
      looks++;
      expect(step.fade).toBeUndefined();
      expect(step.ms).toBeGreaterThanOrEqual(1500);
      expect(step.ms).toBeLessThanOrEqual(2000);
      expect(steps[i - 1].pose).toBe('C_1');
      expect(steps[i + 1]?.pose ?? 'C_1').toBe('C_1');
      expect(steps[i + 1]?.fade).toBeUndefined();
    });
    expect(looks).toBeGreaterThan(20);
    // Colouring is the one place he dissolves.
    expect(steps.filter((step) => step.fade === 150).length).toBeGreaterThan(500);
  });
});

describe('fade_ms: a dissolve into a still', () => {
  it('is played only from one still of a loop into another still of the same loop', () => {
    for (const a of actors) {
      // Each loop's stills, with the dissolve written on them.
      const loops = a.routine.routine.flatMap((item) => ('steps' in item ? [new Map(item.steps.map((step) => [step.still ?? NOTHING, step.fade_ms]))] : []));
      const steps = take(a.name, 600);
      let fades = 0;
      steps.forEach((step, i) => {
        if (step.fade === undefined) return;
        fades++;
        const before = steps[i - 1];
        expect(before, `${a.name} ${step.pose}`).toBeDefined();
        const loop = loops.find((stills) => stills.has(step.pose) && stills.has(before.pose));
        expect(loop, `${a.name}: ${before.pose} into ${step.pose}`).toBeDefined();
        expect(step.fade).toBe(loop!.get(step.pose));
        // (A still held twice in a row, as the cat's cat_1 when her breathing loop repeats: the player draws no
        // dissolve for it, there being nothing to dissolve from.)
      });
      if (loops.some((stills) => [...stills.values()].some((ms) => ms))) expect(fades, a.name).toBeGreaterThan(50);
    }
  });

  it('is not played coming into a loop: from the flick the cat comes back to breathing on a cut', () => {
    const cat = take('cat', 400);
    let returns = 0;
    cat.forEach((step, i) => {
      if (i < 2 || cat[i - 1].pose !== 'cat_F1' || cat[i - 2].pose !== 'cat_F2') return;
      returns++;
      expect(step.pose).toBe('cat_1');
      expect(step.fade).toBeUndefined();
      expect(cat[i + 1].fade).toBe(1000);
    });
    expect(returns).toBeGreaterThan(10);
    // The very first pose of all is not dissolved into either.
    for (const a of actors) expect(take(a.name, 1)[0].fade, a.name).toBeUndefined();
  });

  it('is ignored anywhere else, whatever a manifest says: a hold by itself and the whole reaction cut', () => {
    const { frames: own, routine } = actor('cat');
    const wrong = {
      routine: [...routine.routine.map((item) => ('steps' in item ? item : { ...item, fade_ms: 400 })), { still: 'cat_2', ms: 500, fade_ms: 400 }],
      reaction: { steps: [{ still: 'cat_F2', ms: 500, fade_ms: 400 }, { still: 'cat_1', ms: 300, fade_ms: 400 }] },
    } as unknown as ClipRoutine;
    const schedule = clipSchedule(own, wrong, seeded(3));
    const steps = Array.from({ length: 300 }, () => schedule.next().value);
    for (const step of steps) if (step.fade !== undefined) expect(step.fade).toBe(1000);
    const reaction = clipReaction(own, wrong)!;
    for (const step of [...reaction.steps, ...reaction.roll(seeded(2))]) expect(step.fade).toBeUndefined();
  });

  it('is only ever written between two stills of the same loop: every other change is a cut (the package\'s rule)', () => {
    for (const a of actors) {
      for (const item of a.routine.routine) if (!('steps' in item)) expect((item as { fade_ms?: number }).fade_ms, `${a.name}, outside a loop`).toBeUndefined();
      for (const item of a.routine.reaction?.steps ?? []) expect((item as { fade_ms?: number }).fade_ms, `${a.name}'s reaction`).toBeUndefined();
    }
    // The cat breathes on dissolves; her flick, the mum's sip and blink and the old man's page turn cut.
    expect(take('cat', 210).filter((step) => step.fade === 1000).length).toBeGreaterThan(120);
    expect(take('mum', 50).every((step) => step.fade === undefined)).toBe(true);
    expect(take('oldman', 50).every((step) => step.fade === undefined)).toBe(true);
  });

  it('never outlasts the hold it opens, but for the cat breathing back to cat_1', () => {
    // Package v10 (approved with its preview, which plays it the same way): the cat's cat_1 holds are 700-900 ms
    // and her dissolves 1 s, so the one from cat_2 back to cat_1 is ended at 70-90% by the next step: the same
    // still again (the loop repeating) or her flick, both cuts.
    for (const a of actors) {
      const steps = take(a.name, 400);
      steps.forEach((step, i) => {
        if (!step.fade || step.fade <= step.ms) return;
        // (cat_1 > cat_1: the loop repeating, where the player draws no dissolve at all.)
        expect(['cat cat_2 > cat_1', 'cat cat_1 > cat_1']).toContain(`${a.name} ${steps[i - 1]?.pose} > ${step.pose}`);
      });
    }
  });
});

describe('a piece of the room that moves (the fan)', () => {
  const fan = actors.find((a) => a.name === 'fan');
  it.runIf(fan)('plays its frames round and round, evenly, and never reacts', () => {
    const steps = take('fan', 200);
    const frames = Object.keys(fan!.frames.stills);
    steps.forEach((step, i) => {
      expect(step.pose).toBe(frames[i % frames.length]);
      expect(step.ms).toBe(steps[0].ms);
      expect(step.fade).toBeUndefined();
    });
    expect(fan!.reacts).toBe(false);
  });

  it.runIf(fan)('is rolled a few steps at a time, however many times its loop runs', () => {
    let rolls = 0;
    const schedule = clipSchedule(fan!.frames, fan!.routine, () => (rolls++, 0.5));
    for (let i = 0; i < 100; i++) schedule.next();
    // (A thousand turns of the loop rolled at once would ask for a time 24,000 times.)
    expect(rolls).toBeLessThan(200);
  });
});

describe('only the stills the manifests show are loaded', () => {
  it('leaves out a pose no routine uses', () => {
    const { frames: own, routine } = actor('barista');
    const used = stillsInUse(own, routine);
    expect(used.length).toBeGreaterThan(0);
    // A pose for a later routine, carried in the package but not yet played.
    const more: ClipFrames = { ...own, stills: { ...own.stills, B_polish: 'barista/B_polish.png' } };
    expect(stillsInUse(more, routine)).toEqual(used);
    const hers = stillsInUse(actor('rachel').frames, actor('rachel').routine);
    expect(hers).toEqual(expect.arrayContaining(['R_A1_sketch', 'R_A2_stroke', 'R_A1_blink', 'R_K1_blink', 'R_K1_look', 'R_K2_smile']));
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

  it('reacts: looks up, holds the look, smiles, and comes back by the other clip, reversed', () => {
    const reaction = clipReaction(own, routine)!;
    expect(poses(reaction.steps)).toEqual(['look', 'smile', 'sketch']);
    expect(reaction.steps.find((step) => step.pose === 'look')).toEqual({ pose: 'look', ms: 600 });
    // (The made-up manifest asks for a dissolve into the smile. A reaction is all cuts, so it gets none.)
    expect(reaction.steps.find((step) => step.pose === 'smile')).toEqual({ pose: 'smile', ms: 1400, gesture: true });
    const back = reaction.steps.filter((step) => step.pose.startsWith('sip#')).map((step) => step.pose);
    expect(back[0]).toBe('sip#11');
    expect(back.at(-1)).toBe('sip#0');
    expect(reaction.still).toEqual([{ pose: 'smile', ms: 1400, gesture: true }]);
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
          expect(steps[at - 1].fade).toBeUndefined();
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

describe('a layer with a scale', () => {
  const pack = (layer: object = {}): CastFrames =>
    ({
      canvas: { w: 836, h: 470 },
      layers: [{ actor: 'man', x: 100, y: 50, w: 40, h: 60, stills: ['a', 'b'], ...layer }],
      stills: { a: 'a.png', b: 'b.png' },
    }) as CastFrames;
  const routine = { actors: { man: { routine: [{ still: 'b', ms: 100 }] } } } as unknown as CastRoutines;

  it('has stills that many times its box, and the box itself stays where it was', () => {
    const { actors: [man], problems: wrong } = splitCast(pack({ scale: 2 }), routine, 1672);
    expect(wrong).toEqual([]);
    expect(man.frames.canvas).toEqual({ w: 80, h: 120, plate_x: 200, plate_y: 100, plate_w: 80, plate_h: 120 });
  });

  it('is exactly as before without one, and one of 1 is the same as none', () => {
    const { actors: [man] } = splitCast(pack(), routine, 1672);
    expect(man.frames).toEqual({ canvas: { w: 40, h: 60, plate_x: 200, plate_y: 100, plate_w: 80, plate_h: 120 }, stills: { a: 'a.png', b: 'b.png' }, clips: {} });
    expect(splitCast(pack({ scale: 1 }), routine, 1672).actors[0].frames).toEqual(man.frames);
  });

  it('gets the pixels it covers on the screen, up to its scale times its box; without one, up to its box', () => {
    const twice = { w: 80, h: 120 };
    const once = { w: 40, h: 60 };
    // A phone: 21 CSS px across at 3 px each. A desktop at 2x. An ordinary screen. A very large one.
    expect([[21, 3], [30, 2], [30, 1], [70, 2]].map(([css, dpr]) => backing(css, dpr, twice).w)).toEqual([63, 60, 30, 80]);
    expect([[21, 3], [30, 2], [30, 1], [70, 2]].map(([css, dpr]) => backing(css, dpr, once).w)).toEqual([40, 40, 30, 40]);
    expect(backing(30, 1, twice)).toEqual(backing(30, 1, once));
  });

  it('cannot be smaller than its box', () => {
    for (const scale of [0, 0.5, -2, 'two']) expect(splitCast(pack({ scale }), routine, 1672).problems.join(' ')).toContain('"scale"');
  });

  it('may have stills that are patches over another, which comes with them', () => {
    const { actors: [man], problems: wrong } = splitCast(pack({ scale: 2, patches: { b: { base: 'a', x: 8, y: 16 } } }), routine, 1672);
    expect(wrong).toEqual([]);
    expect(man.frames.patches).toEqual({ b: { base: 'a', x: 8, y: 16 } });
    // The routine only ever names the patch.
    expect(stillsInUse(man.frames, man.routine).sort()).toEqual(['a', 'b']);
  });

  it('says what is wrong with a patch', () => {
    const wrong = (patches: object): string => splitCast(pack({ scale: 2, patches }), routine, 1672).problems.join(' ');
    expect(wrong({ b: { base: 'c', x: 0, y: 0 } })).toContain('"c"');
    expect(wrong({ a: { base: 'b', x: 0, y: 0 }, b: { base: 'a', x: 0, y: 0 } })).toContain('is a patch itself');
    expect(wrong({ b: { base: 'a', x: -1, y: 0 } })).toContain('x and y');
  });
});

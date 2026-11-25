// Scene 4, the film shoot at the Merlion, tested on its manifests as `npm run assets` puts them in public/
// (frames/020-film-scene/site/), so a new delivery that the engine cannot play fails here first. The same
// package format as the café's (cast.test.ts); what is new here is a routine that leaves blinking to its
// blink rule, and the reaction's held gesture.
import { describe, expect, it } from 'vitest';
import cafeFramesJson from '../../public/assets/scene3/cast/frames.json';
import cafeRoutineJson from '../../public/assets/scene3/cast/routine.json';
import framesJson from '../../public/assets/scene4/cast/frames.json';
import routineJson from '../../public/assets/scene4/cast/routine.json';
import { leadOf, splitCast, type CastFrames, type CastRoutines } from './cast';
import { AHEAD, clipReaction, clipSchedule, restOf, stillsInUse, type ClipFrames, type ClipRoutine } from './clips';
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

describe("the film scene's package", () => {
  it('can be played', () => {
    expect(problems).toEqual([]);
  });

  it('is the water, the presenter and Rachel, bottom to top, each with a routine of their own', () => {
    expect(actors.map((a) => a.name)).toEqual(['water', 'presenter', 'rachel']);
    expect(frames.layers.map((layer) => layer.actor)).toEqual(['water', 'presenter', 'rachel']);
    for (const a of actors) expect(Object.keys(routines.actors), a.name).toContain(a.name);
  });

  it('has one actor who answers a find, and she is the lead', () => {
    expect(actors.filter((a) => a.reacts).map((a) => a.name)).toEqual(['rachel']);
    expect(leadOf(actors)?.name).toBe('rachel');
  });

  it('is drawn at the size of the plate, the presenter at twice it: every actor sits at its layer, pixel for pixel', () => {
    expect(frames.canvas).toMatchObject({ w: 1672, h: 941 });
    for (const layer of frames.layers) {
      const { canvas } = actor(layer.actor).frames;
      expect([canvas.plate_x, canvas.plate_y, canvas.plate_w, canvas.plate_h]).toEqual([layer.x, layer.y, layer.w, layer.h]);
      const scale = layer.actor === 'presenter' ? 2 : 1;
      expect(layer.scale ?? 1, layer.actor).toBe(scale);
      expect([canvas.w, canvas.h]).toEqual([layer.w * scale, layer.h * scale]);
      expect(layer.x + layer.w).toBeLessThanOrEqual(1672);
      expect(layer.y + layer.h).toBeLessThanOrEqual(941);
    }
  });

  it('never dissolves: no fade_ms is written, and every change of pose is a cut', () => {
    // (As a field of a step. The package's own note mentions the word.)
    expect(JSON.stringify(routineJson)).not.toContain('"fade_ms":');
    for (const a of actors) {
      for (const step of take(a.name, 800)) expect(step.fade, `${a.name} ${step.pose}`).toBeUndefined();
      const reaction = clipReaction(a.frames, a.routine);
      for (const step of [...(reaction?.steps ?? []), ...(reaction?.roll(seeded(3)) ?? [])]) expect(step.fade).toBeUndefined();
    }
  });

  it('cuts no hold short for a find: the one who reacts never leaves her rest pose', () => {
    for (const a of actors) for (const step of take(a.name, 400)) expect(step.brief, `${a.name} ${step.pose}`).toBeUndefined();
  });

  it('downloads every still it shows, and shows no other', () => {
    for (const a of actors) {
      const used = new Set(stillsInUse(a.frames, a.routine));
      for (const step of take(a.name, 800)) expect(used.has(step.pose), `${a.name} ${step.pose}`).toBe(true);
      for (const step of clipReaction(a.frames, a.routine)?.steps ?? []) expect(used.has(step.pose)).toBe(true);
    }
    // All the drawings are in use.
    expect(actors.flatMap((a) => stillsInUse(a.frames, a.routine)).sort()).toEqual(Object.keys(frames.stills).sort());
  });

  it("gives the camera's screen a place for every pose of the actor who holds it", () => {
    const screen = (framesJson as unknown as { camera_screen: { source: { x: number; y: number; w: number; h: number }; rect_by_still: Record<string, { x: number; y: number; w: number; h: number }> } }).camera_screen;
    const rachel = frames.layers.find((layer) => layer.actor === 'rachel')!;
    expect(Object.keys(screen.rect_by_still).sort()).toEqual([...rachel.stills].sort());
    for (const rect of Object.values(screen.rect_by_still)) {
      // Inside her layer, and a little larger than the 2 px it is inset by on every side.
      expect(rect.x).toBeGreaterThanOrEqual(rachel.x);
      expect(rect.y).toBeGreaterThanOrEqual(rachel.y);
      expect(rect.x + rect.w).toBeLessThanOrEqual(rachel.x + rachel.w);
      expect(rect.y + rect.h).toBeLessThanOrEqual(rachel.y + rachel.h);
      expect(Math.min(rect.w, rect.h)).toBeGreaterThan(8);
    }
    // What it shows is the presenter, not herself.
    expect(screen.source.x + screen.source.w).toBeLessThanOrEqual(rachel.x);
  });
});

describe("the presenter's patches", () => {
  const { frames: own, routine } = actor('presenter');
  const layer = frames.layers.find((l) => l.actor === 'presenter')! as (typeof frames.layers)[number] & { patches: Record<string, { base: string; x: number; y: number; w: number; h: number }> };

  it('are all his stills but the first, which is whole and under every one of them', () => {
    expect(Object.keys(own.patches ?? {}).sort()).toEqual(Object.keys(own.stills).filter((name) => name !== 'M_1').sort());
    for (const patch of Object.values(own.patches ?? {})) expect(patch.base).toBe('M_1');
    expect(restOf(own, routine)).toBe('M_1');
  });

  it('lie inside his drawing, with a rim that falls on the same grid as it', () => {
    for (const [name, p] of Object.entries(layer.patches)) {
      for (const n of [p.x, p.y, p.w, p.h]) expect(n % 8, name).toBe(0);
      expect(p.x + p.w, name).toBeLessThanOrEqual(own.canvas.w);
      expect(p.y + p.h, name).toBeLessThanOrEqual(own.canvas.h);
    }
  });

  it('keep his decoded stills within 12 MB of the sixteen at the plate\'s own size', () => {
    const now = own.canvas.w * own.canvas.h * 4 + Object.values(layer.patches).reduce((sum, p) => sum + p.w * p.h * 4, 0);
    const canvas = own.canvas.w * own.canvas.h * 4;
    const before = 17 * layer.w * layer.h * 4; // sixteen stills and his canvas
    expect(now + canvas - before).toBeLessThan(12e6);
  });
});

describe("the Merlion's water", () => {
  it('plays its three drawings round and round, 110 ms each, and never reacts', () => {
    const steps = take('water', 300);
    steps.forEach((step, i) => {
      expect(step.pose).toBe(['W_1', 'W_2', 'W_3'][i % 3]);
      expect(step.ms).toBe(110);
    });
    expect(actor('water').reacts).toBe(false);
  });

  it('is rolled a few steps at a time, however many times its loop runs', () => {
    // The same loop with its times written as ranges, so that every step rolled asks for one.
    const { frames: own, routine } = actor('water');
    const ranged = JSON.parse(JSON.stringify(routine).replace(/"ms":110/g, '"ms":[110,110]')) as ClipRoutine;
    let rolls = 0;
    const schedule = clipSchedule(own, ranged, () => (rolls++, 0.5));
    for (let i = 0; i < 100; i++) expect(schedule.next().value.ms).toBe(110);
    // (A thousand turns of the loop rolled at once would ask 3,000 times.)
    expect(rolls).toBeGreaterThanOrEqual(100);
    expect(rolls).toBeLessThan(100 + AHEAD + 10);
  });
});

describe('the presenter', () => {
  const { routine } = actor('presenter');
  // Every mouth he talks with, and its blink: the same mouth with his eyes shut (package, 15:15).
  /** The drawings his gestures pass through. */
  const BETWEEN = ['M_1_12', 'M_12', 'M_1_13', 'M_13'];
  const MOUTHS = ['M_1', 'M_1_mid', 'M_1_closed', 'M_2', 'M_2_closed', 'M_3', 'M_3_closed'];
  const BLINK_OF = Object.fromEntries(MOUTHS.map((mouth) => [mouth, `${mouth}_blink`]));
  const BLINKS = new Set(Object.values(BLINK_OF));
  const isBlink = (pose: string): boolean => BLINKS.has(pose);
  const mouthOf = (blink: string): string => blink.replace(/_blink$/, '');
  const steps = take('presenter', 12000);
  /** What he is doing in a pose: talking with his hands open, pointing, or hands together; or the in-between. */
  const doing = (pose: string): string => {
    const mouth = isBlink(pose) ? mouthOf(pose) : pose;
    if (BETWEEN.includes(mouth)) return mouth;
    return mouth.startsWith('M_1_') || mouth === 'M_1' ? 'talk 1' : mouth.startsWith('M_2') ? 'talk 2' : mouth.startsWith('M_3') ? 'talk 3' : mouth;
  };
  /** The widest range written for each still, over the whole routine. */
  const written = new Map<string, [number, number]>();
  for (const item of routine.routine) {
    for (const step of 'steps' in item ? item.steps : 'still' in item ? [item] : []) {
      const [low, high] = typeof step.ms === 'number' ? [step.ms, step.ms] : step.ms;
      const now = written.get(step.still!) ?? [Infinity, -Infinity];
      written.set(step.still!, [Math.min(now[0], low), Math.max(now[1], high)]);
    }
  }

  it('leaves blinking to his blink rule: no hold is marked blink_ok', () => {
    expect(JSON.stringify(routines.actors.presenter)).not.toContain('blink_ok');
    expect(routine.blink).toMatchObject({ on: MOUTHS, still_for: BLINK_OF, ms: 110, every_ms: [2500, 6000] });
    // Never on an in-between.
    for (const still of BETWEEN) expect(JSON.stringify(routine.blink)).not.toContain(`"${still}"`);
    expect(actor('presenter').reacts).toBe(false);
  });

  it('talks, points at the view, talks, brings his hands together, and round again, each gesture through its in-betweens', () => {
    const phases: string[] = [];
    for (const step of steps) if (phases[phases.length - 1] !== doing(step.pose)) phases.push(doing(step.pose));
    const round = ['talk 1', 'M_1_12', 'M_12', 'talk 2', 'M_12', 'M_1_12', 'talk 1', 'M_1_13', 'M_13', 'talk 3', 'M_13', 'M_1_13'];
    expect(phases.length).toBeGreaterThan(200);
    phases.forEach((phase, i) => expect(phase, `phase ${i}`).toBe(round[i % round.length]));
    // An in-between is one drawing of 60 ms, never held and never doubled.
    steps.forEach((step, i) => {
      if (!BETWEEN.includes(step.pose)) return;
      expect(step.ms).toBe(60);
      expect(steps[i + 1]?.pose).not.toBe(step.pose);
    });
  });

  it('holds every pose for a time in its written range, except where a blink took part of the hold', () => {
    steps.forEach((step, i) => {
      if (isBlink(step.pose)) return;
      const [low, high] = written.get(step.pose)!;
      expect(step.ms, step.pose).toBeLessThanOrEqual(high);
      const beside = isBlink(steps[i - 1]?.pose ?? '') || isBlink(steps[i + 1]?.pose ?? '');
      // (Beside a blink: what was left of the hold, which is shown only if it is 50 ms or more.)
      expect(step.ms, step.pose).toBeGreaterThanOrEqual(beside ? 50 : low);
    });
  });

  it('blinks for 110 ms on the mouth he is holding, which stays as it was, and never on an in-between', () => {
    let blinks = 0;
    let sameMouthAfter = 0;
    const kinds = new Set<string>();
    steps.forEach((step, i) => {
      if (!isBlink(step.pose) || i === 0 || i === steps.length - 1) return;
      blinks++;
      kinds.add(step.pose);
      expect(step.ms).toBe(110);
      // Only ever after another mouth (never straight out of an in-between), and never two blinks running.
      expect(MOUTHS, `before blink ${blinks}`).toContain(steps[i - 1].pose);
      expect(isBlink(steps[i + 1].pose)).toBe(false);
      // The hold it blinks in carries on, on the same mouth, if 50 ms or more of it is left.
      if (steps[i + 1].pose === mouthOf(step.pose)) sameMouthAfter++;
      else expect(MOUTHS.includes(steps[i + 1].pose) || BETWEEN.includes(steps[i + 1].pose)).toBe(true);
    });
    expect(blinks).toBeGreaterThan(100);
    // Most of his holds are shorter than a blink and a 50 ms rest: there the blink is the whole hold, and he
    // goes on to the next mouth from it. In the longer ones he is back on the same mouth after it.
    expect(sameMouthAfter / blinks).toBeGreaterThan(0.25);
    // He blinks while pointing and with his hands together too.
    for (const kind of ['M_2_blink', 'M_2_closed_blink', 'M_3_blink', 'M_3_closed_blink', 'M_1_blink']) expect([...kinds]).toContain(kind);
  });

  it('blinks every few seconds: never sooner than the 2.5 s the rule asks, and on average well inside a gesture or two more', () => {
    let clock = 0;
    const at: number[] = [];
    for (const step of steps) {
      if (isBlink(step.pose)) at.push(clock);
      clock += step.ms;
    }
    const gaps = at.slice(1).map((t, i) => t - at[i]);
    // (From the end of one blink to the start of the next. A blink in the middle of a long hold may come up
    // to half that hold early.)
    expect(Math.min(...gaps) - 110).toBeGreaterThanOrEqual(2500 - 240);
    const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    // The rule's own average is 4.25 s. He may blink on every mouth now, so a blink that falls due waits
    // for one hold at most (and one more after an in-between).
    expect(mean).toBeGreaterThan(3800);
    expect(mean).toBeLessThan(5000);
    expect(Math.max(...gaps)).toBeLessThan(6000 + 1100);
  });

  it('blinks in the short holds too, by giving the blink the start of the hold', () => {
    // Holds of under 270 ms cannot take a blink in the middle (110 ms, and 80 ms either side).
    let atTheStart = 0;
    let inTheMiddle = 0;
    steps.forEach((step, i) => {
      if (!isBlink(step.pose) || i === 0 || i === steps.length - 1) return;
      const before = steps[i - 1];
      const after = steps[i + 1];
      if (before.pose === after.pose && before.ms + 110 + after.ms <= written.get(after.pose)![1] && before.ms + 110 + after.ms >= 270 && before.ms >= 80 && after.ms >= 80) inTheMiddle++;
      else atTheStart++;
    });
    expect(atTheStart).toBeGreaterThan(20);
    expect(inTheMiddle).toBeGreaterThan(5);
  });
});

describe('Rachel, filming', () => {
  const { frames: own, routine } = actor('rachel');
  const REST = 'R_A1_film';

  it('rests on the still her routine opens on, though the manifest does not name it', () => {
    expect(routine.reaction?.enter_from).toBeUndefined();
    expect(restOf(own, routine)).toBe(REST);
  });

  it('holds still: nothing but her filming pose, a minute at a time, and no blink', () => {
    expect(routine.blink).toBeUndefined();
    for (const step of take('rachel', 50)) expect(step).toEqual({ pose: REST, ms: 60000, soon: [] });
  });

  it('a find never sends her routine anywhere: she is on her rest pose already', () => {
    const schedule = clipSchedule(own, routine, seeded(2));
    schedule.next();
    for (let i = 0; i < 5; i++) expect(schedule.next('react').value).toMatchObject({ pose: REST, ms: 60000 });
  });

  it('reacts as routine.json says: the turn, the look back held 1.6 to 2 s, the turn, and filming again', () => {
    const reaction = clipReaction(own, routine)!;
    expect(reaction.steps).toEqual([
      { pose: 'R_K0_turn', ms: 90 },
      { pose: 'R_K1_look', ms: 1800, gesture: true },
      { pose: 'R_K0_turn', ms: 90 },
      { pose: REST, ms: 500 },
    ]);
    const rnd = seeded(8);
    const looks = new Set<number>();
    for (let n = 0; n < 40; n++) {
      const rolled = reaction.roll(rnd);
      expect(rolled.map((step) => step.pose)).toEqual(['R_K0_turn', 'R_K1_look', 'R_K0_turn', REST]);
      expect(rolled.map((step) => step.ms).filter((_, i) => i !== 1)).toEqual([90, 90, 500]);
      expect(rolled[1].ms).toBeGreaterThanOrEqual(1600);
      expect(rolled[1].ms).toBeLessThanOrEqual(2000);
      looks.add(Math.round(rolled[1].ms));
      // The look is the gesture, and nothing else is: a second find holds it afresh (player.ts, prolong).
      expect(rolled.map((step) => step.gesture === true)).toEqual([false, true, false, false]);
    }
    expect(looks.size).toBeGreaterThan(20);
  });

  it('answers with the look alone, held, when motion is paused or reduced', () => {
    expect(clipReaction(own, routine)!.still).toEqual([{ pose: 'R_K1_look', ms: 1800, gesture: true }]);
  });
});

describe('who may blink where', () => {
  const own: ClipFrames = {
    canvas: { w: 10, h: 10, plate_x: 0, plate_y: 0, plate_w: 10, plate_h: 10 },
    stills: { a: 'a.png', b: 'b.png', c: 'c.png', wave: 'w.png', shut: 's.png' },
    clips: {},
  };
  const talking = (marked: boolean): ClipRoutine =>
    ({
      routine: [
        { loop: 'talk', repeat: [3, 5], steps: [{ still: 'a', ms: [90, 160] }, { still: 'b', ms: [70, 120] }, { still: 'c', ms: [280, 480], ...(marked ? { blink_ok: true } : {}) }] },
        { still: 'wave', ms: 100 },
      ],
      blink: { on: ['a', 'b', 'c'], frames: [{ still: 'shut', ms: 110 }], every_ms: [1500, 2500] },
    }) as unknown as ClipRoutine;
  const play = (routine: ClipRoutine, n = 6000): Step[] => {
    const schedule = clipSchedule(own, routine, seeded(9));
    return Array.from({ length: n }, () => schedule.next().value);
  };
  const neighbours = (steps: Step[]): Array<[string, string]> => steps.flatMap((step, i) => (step.pose === 'shut' && i > 0 && i < steps.length - 1 ? [[steps[i - 1].pose, steps[i + 1].pose] as [string, string]] : []));

  it('a routine that marks a hold blink_ok blinks in the middle of marked holds only, as before', () => {
    const blinks = neighbours(play(talking(true)));
    expect(blinks.length).toBeGreaterThan(100);
    for (const [before, after] of blinks) expect([before, after]).toEqual(['c', 'c']);
  });

  it('a routine that marks none may blink on any still its rule names, short holds included', () => {
    const steps = play(talking(false));
    const blinks = neighbours(steps);
    expect(blinks.length).toBeGreaterThan(100);
    // In place of the start of a short hold: after the pose before it, and before what is left of its own.
    expect(blinks.some(([before, after]) => before !== after)).toBe(true);
    expect(blinks.some(([, after]) => after === 'a' || after === 'b')).toBe(true);
    for (const [before, after] of blinks) {
      expect(['a', 'b', 'c']).toContain(before);
      expect(['a', 'b', 'c']).toContain(after);
    }
    // Never two blinks without a pose between them, and never beside the wave.
    steps.forEach((step, i) => {
      if (step.pose === 'shut') expect(steps[i + 1]?.pose).not.toBe('shut');
    });
  });

  it("the café's Rachel still blinks only where her routine says: never in the holds either side of her sip", () => {
    const cafe = splitCast(cafeFramesJson as unknown as CastFrames, cafeRoutineJson as unknown as CastRoutines, 1672).actors.find((a) => a.name === 'rachel')!;
    expect(JSON.stringify(cafe.routine.routine)).toContain('blink_ok');
    const schedule = clipSchedule(cafe.frames, cafe.routine, seeded(7));
    const steps = Array.from({ length: 6000 }, () => schedule.next().value);
    let sips = 0;
    steps.forEach((step, i) => {
      // Reaching for the cup: the hold before it is the unmarked one that follows her last stroke, whole.
      if (step.pose === 'R_S1_reach' && steps[i - 1]?.pose === 'R_A1_sketch' && i >= 2) {
        sips++;
        expect(steps[i - 2].pose).toBe('R_A2_stroke');
        expect(steps[i - 1].ms).toBeGreaterThanOrEqual(500);
        expect(steps[i - 1].ms).toBeLessThanOrEqual(800);
      }
      // Back from the cup: the unmarked hold that follows is whole too, with no blink taken out of it.
      if (step.pose === 'R_S1_reach' && steps[i - 1]?.pose === 'R_S2_lift' && i < steps.length - 2) {
        expect(steps[i + 1].pose).toBe('R_A1_sketch');
        expect(steps[i + 1].ms).toBeGreaterThanOrEqual(700);
        expect(steps[i + 1].ms).toBeLessThanOrEqual(1000);
        expect(steps[i + 2].pose).not.toBe('R_A1_blink');
      }
    });
    expect(sips).toBeGreaterThan(50);
    expect(steps.some((s) => s.pose === 'R_A1_blink')).toBe(true);
  });
});

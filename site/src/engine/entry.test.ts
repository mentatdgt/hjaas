// A reaction come into from the middle of a routine drawn through in-betweens (the theatre's Rachel), played
// from the delivered package on a stand-in for her canvas and a clock moved by hand. See Entry in clips.ts and
// Player.entry.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import framesJson from '../../public/assets/scene5/cast/frames.json';
import routineJson from '../../public/assets/scene5/cast/routine.json';
import { splitCast, type CastFrames, type CastRoutines } from './cast';
import type { Character } from './character';
import { checkClips, clipEntry, clipReaction, clipSchedule, stillsInUse, type ClipRoutine } from './clips';
import { Player } from './player';
import { seeded, type Step } from './steps';

let clock = 0;
let queue: Array<(now: number) => void> = [];
const frame = (ms = 1000 / 60): void => {
  clock += ms;
  const due = queue;
  queue = [];
  for (const callback of due) callback(clock);
};
const run = (ms: number): void => {
  const until = clock + ms;
  while (clock < until) frame();
};
beforeEach(() => {
  clock = 1000;
  queue = [];
  vi.stubGlobal('requestAnimationFrame', (callback: (now: number) => void) => queue.push(callback));
  vi.stubGlobal('cancelAnimationFrame', () => {
    queue = [];
  });
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const rachel = splitCast(framesJson as unknown as CastFrames, routineJson as unknown as CastRoutines, 1672).actors.find((actor) => actor.name === 'rachel')!;
const { frames } = rachel;
const routine = rachel.routine as ClipRoutine;
const REST = 'R_A1';
const spec = routine.reaction!;
const full = (): Step[] => clipReaction(frames, routine)!.steps;

interface Shown {
  pose: string;
  at: number;
  ms: number;
}
/** Her player on a stand-in, and everything it showed (each pose once, however many steps held it). */
const make = (seed: number, schedule = clipSchedule(frames, routine, seeded(seed))) => {
  const her = { rest: REST, current: REST, show: (pose: string) => void (her.current = pose), dissolve: (_: string, pose: string) => void (her.current = pose) };
  const player = new Player(her as unknown as Character, schedule);
  player.entry = clipEntry(routine);
  const log: Shown[] = [];
  player.onPose = (pose, at) => {
    const last = log[log.length - 1];
    if (last) last.ms = at - last.at;
    if (last?.pose !== pose) log.push({ pose, at, ms: 0 });
  };
  player.start();
  return { player, log, her };
};
/** Run until she has shown `pose` for `into` ms, then find a mushroom. Where in the log the answer begins. */
const findOn = (it: ReturnType<typeof make>, pose: string, into: number): number => {
  for (let i = 0; i < 20000; i++) {
    const last = it.log[it.log.length - 1];
    if (last.pose === pose && clock - last.at >= into) break;
    frame();
  }
  expect(it.her.current).toBe(pose);
  void it.player.react(full(), true);
  return it.log.length - 1;
};

/** Which still may follow which: everything the package itself plays one after the other. */
const next = new Set<string>();
const chain = (names: readonly (string | null)[]): void => names.forEach((name, i) => i && next.add(`${names[i - 1]}>${name}`));
for (const item of routine.routine) if ('steps' in item) chain([...item.steps.map((step) => step.still), item.steps[0].still]);
chain(routine.routine.map((item) => ('steps' in item ? REST : 'still' in item ? item.still : null)));
chain([REST, 'R_A1_blink', REST]);
for (const [from, steps] of Object.entries(spec.lead_in!)) chain([from, ...steps.map((step) => step.still), full()[0].pose]);
chain([REST, ...full().map((step) => step.pose)]);
chain(['R_A1_blink', full()[0].pose]);
// (Nearly at rest: the first drawing of a move, one on the way out, which the package says needs no lead-in.)
for (const name of Object.keys(frames.stills)) if (name.startsWith('R_T_') && !spec.lead_in![name]) chain([name, full()[0].pose]);

describe('the package', () => {
  it('can be played, and the lead-in stills are among those loaded', () => {
    expect(checkClips(frames, routine)).toEqual([]);
    const used = new Set(stillsInUse(frames, routine));
    for (const steps of Object.values(spec.lead_in!)) for (const step of steps) expect(used.has(step.still)).toBe(true);
  });

  it('is refused, in words, with a lead-in that names a still it does not have, or no time', () => {
    const broken = (reaction: object): string => checkClips(frames, { ...routine, reaction: { ...spec, ...reaction } } as ClipRoutine).join(' ');
    expect(broken({ lead_in: { R_A9: [] } })).toContain('"R_A9"');
    expect(broken({ lead_in: { R_A1: [{ still: 'R_A8', ms: 33 }] } })).toContain('"R_A8"');
    expect(broken({ lead_in: { R_A1: [{ still: 'R_A1' }] } })).toContain('needs a time');
    expect(broken({ min_show_by_still: { R_A7: 100 } })).toContain('"R_A7"');
    expect(broken({ min_show_ms: -1 })).toContain('min_show_ms');
  });

  it('a reaction without any of it is come into as before', () => {
    expect(clipEntry({ ...routine, reaction: { steps: spec.steps } })).toBeNull();
    expect(clipEntry({ ...routine, reaction: undefined })).toBeNull();
  });
});

describe('a find', () => {
  it('from every still in lead_in: those steps, then the reaction, each drawing on screen its 2 or 3 frames', () => {
    for (const from of Object.keys(spec.lead_in!)) {
      const it = make(3);
      const at = findOn(it, from, 0);
      run(1200);
      const lead = spec.lead_in![from];
      const expected = [from, ...lead.map((step) => step.still), ...full().map((step) => step.pose)];
      expect(it.log.slice(at, at + lead.length + 6).map((s) => s.pose)).toEqual(expected.slice(0, lead.length + 6));
      for (const [i, step] of lead.entries()) expect(Math.round(it.log[at + 1 + i].ms / (1000 / 60))).toBe(step.ms === 33 ? 2 : Math.round((step.ms as number) / (1000 / 60)));
      for (let i = 0; i < 4; i++) expect(Math.round(it.log[at + 1 + lead.length + i].ms / (1000 / 60))).toBe(3);
    }
  });

  it('at rest, long enough: the reaction at once, with nothing before it', () => {
    const it = make(3);
    const at = findOn(it, REST, 200);
    frame();
    expect(it.log[at].pose).toBe(REST);
    expect(it.her.current).toBe('R_T_A1_K1_1');
  });

  it('between two frames of the page: the first drawing is still painted on all its frames', () => {
    for (const [pose, first, count] of [['R_B2_dip', 'R_T_A1_B2_3', 2], [REST, 'R_T_A1_K1_1', 3]] as const) {
      const it = make(3);
      if (pose === REST) run(3000);
      findOn(it, pose, 250);
      // What each frame paints is what she is on once its callbacks have run.
      let painted = 0;
      for (let i = 0; i < 8; i++) {
        frame();
        if (it.her.current === first) painted++;
      }
      expect(painted).toBe(count);
    }
  });

  it('lets the still on screen finish showing first: 120 ms, 500 for the lean, or its own time if shorter', () => {
    for (const [pose, least] of [['R_A3_stroke_out', 120], ['R_A2_stroke_low', 120], ['R_B2_dip', 120], ['R_B1_lean', 500], [REST, 120], ['R_T_A2_A3_2', 50]] as const) {
      const it = make(5);
      if (pose === REST) run(3000);
      const at = findOn(it, pose, 0);
      run(1200);
      expect(it.log[at].pose).toBe(pose);
      expect(it.log[at].ms).toBeGreaterThanOrEqual(least - 9);
      expect(it.log[at].ms).toBeLessThanOrEqual(least + 18);
    }
    // Shown long enough already: not a frame longer.
    const it = make(5);
    findOn(it, 'R_B1_lean', 700);
    frame();
    expect(it.her.current).toBe(REST);
  });

  it('found again: held, never led in again, whatever moment the second find comes at', () => {
    for (const after of [0, 40, 200, 420, 900, 2300, 2500]) {
      const it = make(3);
      const at = findOn(it, 'R_A3_stroke_out', 10);
      run(after);
      const reacting = it.player.reacting;
      if (reacting) it.player.prolong();
      run(5000);
      const poses = it.log.slice(at).map((s) => s.pose);
      const salute = poses.indexOf('R_K1_salute');
      expect(reacting).toBe(true);
      expect(poses.filter((pose) => pose === 'R_K1_salute').length).toBe(1);
      expect(poses.slice(0, salute)).toEqual(['R_A3_stroke_out', ...spec.lead_in!.R_A3_stroke_out.map((s) => s.still), ...full().slice(0, 4).map((s) => s.pose)]);
      if (after === 900) expect(it.log[at + salute].ms).toBeGreaterThan(1800 + 300);
    }
  });

  it('afterwards: the routine at its next rest step, with a whole rest step, never in the middle of a move', async () => {
    for (const from of ['R_A3_stroke_out', 'R_B2_dip', 'R_B1_lean', 'R_T_A2_A3_1', REST]) {
      const it = make(9);
      const at = findOn(it, from, from.includes('_T_') ? 0 : 130);
      run(4000);
      const poses = it.log.slice(at).map((s) => s.pose);
      const back = poses.indexOf(REST, poses.indexOf('R_K1_salute'));
      expect(poses[back - 1]).toBe('R_T_A1_K1_1');
      // At rest for the reaction's 400 ms and the routine's own hold after it.
      const rest = it.log[at + back];
      const then = it.log[at + back + 1];
      if (then) {
        expect(rest.ms).toBeGreaterThan(400 + 60);
        expect(['R_T_A1_A2_1', 'R_B1_lean', 'R_T_A1_B2_0', 'R_A1_blink']).toContain(then.pose);
      }
    }
  });

  it('at any moment at all: no drawing follows one the package does not put next to it, and none is skipped', () => {
    let finds = 0;
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const it = make(seed);
      const rnd = seeded(seed * 77);
      for (let k = 0; k < 12; k++) {
        run(300 + rnd() * 5000);
        if (it.player.reacting) it.player.prolong();
        else {
          seen.add(it.her.current);
          finds++;
          void it.player.react(clipReaction(frames, routine)!.roll(rnd), true);
        }
      }
      const bad = it.log.slice(1).map((s, i) => `${it.log[i].pose}>${s.pose}`).filter((pair) => !next.has(pair));
      expect(bad).toEqual([]);
      // In-betweens: three frames each, two on the way back to rest. Never fewer, and never more than one over.
      for (const s of it.log.slice(0, -1)) if (s.pose.startsWith('R_T_')) expect(Math.round(s.ms / (1000 / 60))).toBeGreaterThanOrEqual(2);
    }
    expect(finds).toBeGreaterThan(400);
    expect(seen.size).toBeGreaterThan(8);
  });

  it('with late frames (a slow phone): still none skipped', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const it = make(seed);
      const rnd = seeded(seed);
      for (let i = 0; i < 1500; i++) {
        frame(rnd() < 0.15 ? 30 + rnd() * 250 : 1000 / 60);
        if (rnd() < 0.01 && !it.player.reacting) void it.player.react(full(), true);
      }
      expect(it.log.slice(1).map((s, i) => `${it.log[i].pose}>${s.pose}`).filter((pair) => !next.has(pair))).toEqual([]);
      // Nor hurried through, to make up for the late frame: each is on screen two frames at least (or one late one).
      for (const s of it.log.slice(0, -1)) if (s.pose.startsWith('R_T_')) expect(s.ms).toBeGreaterThan(25);
    }
  });

  it("is shown evenly whatever the screen's rounding (Safari gives whole milliseconds)", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const it = make(seed);
      let t = clock;
      const bump = (): void => {
        t += 1000 / 60;
        frame(Math.round(t) - clock);
      };
      for (let i = 0; i < 3000; i++) bump();
      for (const s of it.log.slice(0, -1)) if (s.pose.startsWith('R_T_')) expect(Math.round(s.ms / (1000 / 60))).toBe(3);
    }
      // And when a hold is a whole number of frames, which puts the move on the frame's edge.
    const chainOut = full().slice(0, 4);
    const it = make(1, (function* (): Generator<Step, never> {
      for (;;) {
        yield { pose: REST, ms: 500 };
        yield* chainOut;
      }
    })() as ReturnType<typeof clipSchedule>);
    const t0 = clock;
    const rnd = seeded(4);
    for (let i = 1; i <= 2000; i++) frame(t0 + i * (1000 / 60) + (rnd() - 0.5) * 1.2 - clock);
    for (const s of it.log.slice(0, -1)) if (s.pose.startsWith('R_T_')) expect(Math.round(s.ms / (1000 / 60))).toBe(3);
  });

  it('paused, or without the full reaction: the one held pose at once, with no lead-in', () => {
    const it = make(3);
    for (let i = 0; i < 20000 && it.her.current !== 'R_A3_stroke_out'; i++) frame();
    void it.player.react(clipReaction(frames, routine)!.still, true, false);
    expect(it.her.current).toBe('R_K1_salute');
  });

  it('put back to rest while a find waits (the room painted again): the find is dropped and her promise kept', async () => {
    const it = make(3);
    findOn(it, 'R_B1_lean', 0);
    expect(it.player.reacting).toBe(true);
    it.player.settle();
    expect(it.player.reacting).toBe(false);
    expect(it.her.current).toBe(REST);
  });
});

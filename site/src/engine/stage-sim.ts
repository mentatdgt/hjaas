// QA only (tests and the café round 10 schedule check; the site never imports it): several actors' schedules
// played on one simulated clock, as scene.ts's players play them, with the same Stage they are given there.
//
// Each actor's step begins when the one before it ends; a schedule is asked for its next step at that moment
// (so `since` is 0 for the actor being asked), and another actor's plan is read from where her own step began,
// exactly as Player.planned() does. `delay` puts an actor's first move off, as Scene.stagger() does.
import { clipSchedule, planOf, type ClipFrames, type ClipRoutine, type Planned, type Stage } from './clips';
import type { Rng, Step } from './steps';

export interface SimActor {
  name: string;
  frames: ClipFrames;
  routine: ClipRoutine;
  /** Her first move is put off by this long. */
  delay?: number;
  /**
   * Her routine is only started this long after the others (her drawings came late: the page holds her still
   * until then). Meanwhile it is waiting, and its plan is read as the player reads a waiting one.
   */
  late?: number;
}

/** One step as shown: from `at` to `at + ms`. */
export interface Shown {
  pose: string;
  at: number;
  ms: number;
}

/** Plays the actors for `ms` of simulated time; each actor's steps as they were shown. `stage: false` gives no Stage (the rule is then ignored). */
export function simulate(actors: readonly SimActor[], ms: number, rnd: Rng, options: { stage?: boolean } = {}): Map<string, Shown[]> {
  const useStage = options.stage !== false;
  const state = new Map<string, { schedule: Generator<Step, never, unknown>; step: Step; start: number; shown: Shown[] }>();
  let now = 0;
  const stage = (name: string): Stage => ({
    since: () => now - (state.get(name)?.start ?? now),
    other: (actor): Planned | null => {
      const them = state.get(actor);
      if (!them || actor === name) return null;
      const plan = planOf(them.schedule)!;
      const since = now - them.start;
      return { busy: (stills, from, to) => plan(stills, from + since, to + since).map(([a, b]) => [a - since, b - since] as const) };
    },
  });
  // Every actor's schedule exists before any is asked for a step (as on the page: all are made, then started).
  for (const actor of actors) {
    const schedule = clipSchedule(actor.frames, actor.routine, rnd, () => true, useStage ? stage(actor.name) : undefined);
    state.set(actor.name, { schedule, step: { pose: '', ms: 0 }, start: (actor.delay ?? 0) + (actor.late ?? 0), shown: [] });
  }
  const late = new Set(actors.filter((actor) => actor.late).map((actor) => actor.name));
  // All are started at 0. A delay is a first step that ends that much later: to the player it began `delay`
  // from now (its elapsed starts below 0), and so it does here.
  now = 0;
  for (const [name, s] of state) {
    // (Held still until then: her first step is asked for as the hold ends.)
    if (late.has(name)) continue;
    do s.step = s.schedule.next().value;
    while (s.step.ms <= 0);
    s.shown.push({ pose: s.step.pose, at: s.start, ms: s.step.ms });
  }
  for (;;) {
    let next: string | null = null;
    let end = Infinity;
    for (const [name, s] of state) {
      if (s.start + s.step.ms < end) {
        end = s.start + s.step.ms;
        next = name;
      }
    }
    if (next === null || end > ms) break;
    const s = state.get(next)!;
    now = end;
    s.start = end;
    do s.step = s.schedule.next().value;
    while (s.step.ms <= 0);
    s.shown.push({ pose: s.step.pose, at: end, ms: s.step.ms });
  }
  return new Map([...state].map(([name, s]) => [name, s.shown]));
}

/** The runs of these poses, joined where they touch: [start, end] each. */
export function runsOf(shown: readonly Shown[], poses: readonly string[]): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  for (const step of shown) {
    if (!poses.includes(step.pose)) continue;
    const last = runs[runs.length - 1];
    if (last && Math.abs(last[1] - step.at) < 1e-6) last[1] = step.at + step.ms;
    else runs.push([step.at, step.at + step.ms]);
  }
  return runs;
}

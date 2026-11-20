// The idle routine as data. A character's routine.json lists loops (a few frames played round and round),
// how many times each loop runs, the frames that carry her from one loop to the next, and where she may
// blink. This file turns that manifest into the endless list of steps the player shows.
//
// A manifest looks like this (times in ms; a time is one number, or [shortest, longest] to roll each time):
//
//   {
//     "rest": "A1",                                  the frame a reaction starts from and returns to
//     "order": ["mist", "write"],                    the loops, in turn, for ever
//     "loops": {
//       "mist":  { "frames": [{ "frame": "A1", "ms": [300, 450] }, { "frame": "A2", "ms": 300 }, ...],
//                  "cycles": [2, 4],                 how many times round, rolled each visit to the loop
//                  "pause": { "frame": "A1", "ms": [1000, 2000] } },      optional: a hold after the last cycle
//       "write": { "frames": [...], "cycles": 1 }
//     },
//     "transitions": { "mist>write": [{ "frame": "T1", "ms": 80 }, ...], "write>mist": [...] },   optional
//     "blink": { "on": ["A1"], "every": [3000, 6000],
//                "frames": [{ "frame": "A1_blink_half", "ms": 50 }, ...] }                         optional
//   }
//
// Blinks only ever happen in the middle of a hold on one of the frames named in "on", and only when the
// hold is long enough to finish the blink on the same frame.
import type { Rng, Step } from './steps';

/** A time in ms: fixed, or rolled between two values each time. */
export type Duration = number | readonly [number, number];

export interface RoutineFrame {
  frame: string;
  ms: Duration;
}

export interface RoutineLoop {
  frames: readonly RoutineFrame[];
  /** How many times round before moving on. */
  cycles: Duration;
  /** A hold after the last cycle, before the transition out. */
  pause?: RoutineFrame;
}

export interface RoutineManifest {
  /** The frame a reaction starts from and returns to. The player waits for it before reacting. */
  rest: string;
  /** Loop names, played in turn, for ever. */
  order: readonly string[];
  loops: Readonly<Record<string, RoutineLoop>>;
  /** Frames played between two loops, keyed "from>to". No entry: a straight cut. */
  transitions?: Readonly<Record<string, readonly RoutineFrame[]>>;
  blink?: {
    /** The only frames she may blink on. */
    on: readonly string[];
    /** Time between blinks. */
    every: Duration;
    /** The blink itself, played in the middle of a hold; the hold's frame comes back afterwards. */
    frames: readonly RoutineFrame[];
  };
}

/** A hold must leave at least this long before and after a blink. */
const BLINK_MARGIN_MS = 60;

const isDuration = (value: unknown): value is Duration =>
  (typeof value === 'number' && value >= 0) ||
  (Array.isArray(value) && value.length === 2 && value.every((n) => typeof n === 'number' && n >= 0) && value[0] <= value[1]);

const isFrame = (value: unknown): value is RoutineFrame =>
  typeof value === 'object' && value !== null && typeof (value as RoutineFrame).frame === 'string' && isDuration((value as RoutineFrame).ms);

/** Everything wrong with a manifest, in plain words. An empty list means it can be played. */
export function checkRoutine(manifest: unknown): string[] {
  const problems: string[] = [];
  const m = manifest as Partial<RoutineManifest> | null;
  if (typeof m !== 'object' || m === null) return ['The routine is not an object.'];
  if (typeof m.rest !== 'string' || !m.rest) problems.push('"rest" must name a frame.');
  if (!Array.isArray(m.order) || m.order.length === 0) problems.push('"order" must list at least one loop.');
  const loops = (typeof m.loops === 'object' && m.loops !== null ? m.loops : {}) as Record<string, RoutineLoop>;
  for (const name of Array.isArray(m.order) ? m.order : []) {
    if (!(name in loops)) problems.push(`"order" names the loop "${name}", which "loops" does not have.`);
  }
  let playable = false;
  for (const [name, loop] of Object.entries(loops)) {
    if (!Array.isArray(loop?.frames) || loop.frames.length === 0) problems.push(`The loop "${name}" has no frames.`);
    else if (!loop.frames.every(isFrame)) problems.push(`The loop "${name}" has a frame without a name or a time.`);
    else if (loop.frames.some((frame) => (typeof frame.ms === 'number' ? frame.ms : frame.ms[1]) > 0)) playable = true;
    if (!isDuration(loop?.cycles)) problems.push(`The loop "${name}" needs "cycles": a number, or [fewest, most].`);
    if (loop?.pause !== undefined && !isFrame(loop.pause)) problems.push(`The loop "${name}" has a "pause" without a frame or a time.`);
  }
  if (!playable && problems.length === 0) problems.push('No loop has a frame that lasts any time.');
  for (const [key, frames] of Object.entries(m.transitions ?? {})) {
    const [from, to, extra] = key.split('>');
    if (extra !== undefined || !(from in loops) || !(to in loops)) problems.push(`The transition "${key}" must be "loop>loop", using loop names.`);
    if (!Array.isArray(frames) || !frames.every(isFrame)) problems.push(`The transition "${key}" has a frame without a name or a time.`);
  }
  if (m.blink !== undefined) {
    const { on, every, frames } = m.blink as NonNullable<RoutineManifest['blink']>;
    if (!Array.isArray(on) || on.length === 0) problems.push('"blink.on" must list the frames she may blink on.');
    if (!isDuration(every)) problems.push('"blink.every" must be a time, or [shortest, longest].');
    if (!Array.isArray(frames) || frames.length === 0 || !frames.every(isFrame)) problems.push('"blink.frames" must list the blink\'s frames.');
  }
  return problems;
}

/** Every frame the manifest names: what has to be loaded before the routine can play. */
export function routineFrames(manifest: RoutineManifest): string[] {
  const names = new Set<string>([manifest.rest]);
  for (const loop of Object.values(manifest.loops)) {
    for (const { frame } of loop.frames) names.add(frame);
    if (loop.pause) names.add(loop.pause.frame);
  }
  for (const frames of Object.values(manifest.transitions ?? {})) for (const { frame } of frames) names.add(frame);
  for (const { frame } of manifest.blink?.frames ?? []) names.add(frame);
  return [...names];
}

/**
 * The endless routine. Throws if the manifest cannot be played (see checkRoutine).
 * `rnd` is Math.random on the live site and a seeded generator in tests and QA.
 */
export function* routineSchedule(manifest: RoutineManifest, rnd: Rng = Math.random): Generator<Step, never> {
  const problems = checkRoutine(manifest);
  if (problems.length) throw new Error(`routine: ${problems.join(' ')}`);

  const roll = (d: Duration): number => (typeof d === 'number' ? d : d[0] + rnd() * (d[1] - d[0]));
  const count = (d: Duration): number => (typeof d === 'number' ? Math.round(d) : d[0] + Math.floor(rnd() * (d[1] - d[0] + 1)));

  const { blink } = manifest;
  const blinkMs = blink ? blink.frames.reduce((sum, frame) => sum + (typeof frame.ms === 'number' ? frame.ms : frame.ms[1]), 0) : 0;
  let sinceBlink = 0;
  let nextBlink = blink ? roll(blink.every) : Infinity;

  /** One hold, with a blink slipped into the middle when one is due and it fits. */
  function* hold(frame: string, ms: number): Generator<Step> {
    if (ms <= 0) return;
    if (blink && blink.on.includes(frame) && ms >= blinkMs + 2 * BLINK_MARGIN_MS && sinceBlink + ms / 2 >= nextBlink) {
      const spare = ms - blinkMs;
      const before = BLINK_MARGIN_MS + rnd() * (spare - 2 * BLINK_MARGIN_MS);
      yield { pose: frame, ms: before };
      let spent = 0;
      for (const step of blink.frames) {
        const stepMs = typeof step.ms === 'number' ? step.ms : roll(step.ms);
        spent += stepMs;
        yield { pose: step.frame, ms: stepMs };
      }
      yield { pose: frame, ms: Math.max(BLINK_MARGIN_MS, ms - before - spent) };
      sinceBlink = ms - before - spent;
      nextBlink = roll(blink.every);
      return;
    }
    sinceBlink += ms;
    yield { pose: frame, ms };
  }

  for (let at = 0; ; at = (at + 1) % manifest.order.length) {
    const name = manifest.order[at];
    const loop = manifest.loops[name];
    for (let cycles = Math.max(1, count(loop.cycles)); cycles > 0; cycles--) {
      for (const frame of loop.frames) yield* hold(frame.frame, roll(frame.ms));
    }
    if (loop.pause) yield* hold(loop.pause.frame, roll(loop.pause.ms));
    const next = manifest.order[(at + 1) % manifest.order.length];
    for (const frame of manifest.transitions?.[`${name}>${next}`] ?? []) yield* hold(frame.frame, roll(frame.ms));
  }
}

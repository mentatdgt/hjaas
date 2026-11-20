// The routine engine's second manifest format: the one Wren's pipeline delivers (frames/NNN-…/site/).
//
// Two files describe a character:
//
//   frames.json   the canvas she is drawn on and where it sits on the plate; her stills (whole-canvas
//                 images); and her clips. A clip is a list of patches: each frame of a clip is its base still
//                 with one patch drawn over it at (x, y), replacing what was there.
//   routine.json  the idle routine (stills held for a rolled time, loops of stills, clips played forwards
//                 or backwards, a loop of a clip), where she may blink, and the reaction.
//
// This file turns the two into what the player shows: an endless list of steps for the routine, and a fixed
// list for the reaction. A pose is named after its still ("A1_mist_aim") or its clip frame ("write_loop#12").
//
// The reaction entry rule: a reaction starts from one still (`reaction.enter_from`). The player tells the
// routine when a reaction is waiting; the routine then finishes the frame it is on and takes the shortest
// way back to that still: a clip being played is run back to its start, and from the writing loop the
// transition is played in reverse, as routine.json's note asks.
//
// Later additions (the café, whose package holds a whole cast: see cast.ts, which hands each actor to this
// file as if it were alone):
//
//   - `"still": null` holds on nothing at all: an actor who is part of the plate and is only drawn for a
//     moment (a blink patch).
//   - `reaction.enter_from` may be left out: it is then the base still of the reaction's first clip.
//   - A hold on another still that the routine leaves by clips alone (sip, hold, sip backwards) is cut short
//     when a reaction is waiting, and those clips are its way home.
//   - Blinks: `blink` may be a list of rules, and a rule's `on` a list of stills. A hold in the reaction
//     may blink too: `"blink_ok": true` (the rule for that still is used), or `"blink"` naming the blink's
//     still or giving its frames. Times in the reaction may be ranges, rolled each time she reacts.
//
// Clip frames are large, so they are not all kept decoded (reel.ts). Each step of the routine therefore says
// which clip frames may be shown soon after it (`soon`): the next few if nothing interrupts, and the first
// few of the way home, in case a reaction is asked for.
import type { Rng, Step } from './steps';

/** A time in ms: fixed, or rolled between two values each time. */
type Ms = number | readonly [number, number];

export interface ClipFrames {
  /** The character's canvas, and the plate rectangle it is drawn into. */
  canvas: { w: number; h: number; plate_x: number; plate_y: number; plate_w: number; plate_h: number };
  /** Still name -> file. */
  stills: Readonly<Record<string, string>>;
  /** Clip name -> its base still, where its patches go on the canvas, and the patch files in order. */
  clips: Readonly<Record<string, { base: string; x: number; y: number; frames: readonly string[] }>>;
}

type RoutineItem =
  | { loop: string; repeat: Ms; steps: ReadonlyArray<{ still: string | null; ms: Ms }> }
  | { loop: string; repeat: Ms; clip: string; ms: number }
  | { still: string | null; ms: Ms; blink_ok?: boolean }
  | { clip: string; ms: number; reverse?: boolean };

type BlinkFrames = ReadonlyArray<{ still: string; ms: number }>;
/** Where she may blink (on which stills), what the blink is, and how often. */
interface BlinkRule {
  on: string | readonly string[];
  frames: BlinkFrames;
  every_ms?: Ms;
}

type ReactionItem =
  | { clip: string; ms: number; reverse?: boolean; first_ms?: number; first_n?: number }
  | { hold_last: number }
  | { still: string; ms: Ms; blink_ok?: boolean; blink?: string | { still?: string; ms?: number; frames?: BlinkFrames } };

export interface ClipRoutine {
  routine: readonly RoutineItem[];
  blink?: BlinkRule | readonly BlinkRule[];
  reaction?: { enter_from?: string; steps: readonly ReactionItem[] };
}

/** The pose of an actor who is not drawn at all (`"still": null`). */
export const NOTHING = '';
/** A blink in a held pose of a reaction lasts this long when the manifest does not say. */
const BLINK_MS = 90;
/** A hold that a waiting reaction may cut short is still held this long (the café's note: "hold B1 300 ms"). */
const BRIEF_MS = 300;

const blinkRules = (routine: ClipRoutine): readonly BlinkRule[] => (!routine.blink ? [] : Array.isArray(routine.blink) ? routine.blink : [routine.blink as BlinkRule]);
const blinksOn = (rule: BlinkRule, still: string): boolean => (typeof rule.on === 'string' ? rule.on === still : rule.on.includes(still));

/**
 * The still a reaction starts from and returns to; for an actor who never reacts, the one the routine opens
 * on. It is what she holds when motion is paused or reduced.
 */
export function restOf(frames: ClipFrames, routine: ClipRoutine): string {
  const { reaction } = routine;
  if (reaction?.enter_from) return reaction.enter_from;
  for (const item of reaction?.steps ?? []) if ('clip' in item && frames.clips[item.clip]) return frames.clips[item.clip].base;
  const first = routine.routine?.[0];
  if (first && 'steps' in first) return first.steps[0]?.still ?? NOTHING;
  if (first && 'still' in first) return first.still ?? NOTHING;
  return Object.keys(frames.stills)[0] ?? NOTHING;
}

/** What the player passes to the routine each time it asks for the next step. */
export type Signal = 'react' | undefined;

/** The pose name of one frame of a clip. */
export const clipPose = (clip: string, index: number): string => `${clip}#${index}`;

/** A hold must leave at least this long before and after a blink. */
const BLINK_MARGIN_MS = 80;

/**
 * How many steps ahead clip frames are asked for. A clip always follows a hold or another clip, so the first
 * frames have at least a hold's length to be decoded in, and the rest at least AHEAD frame times each
 * (a third of a second at the fastest clip's 83 ms a frame; a frame takes a few hundredths to decode).
 * Each one more is another frame held in memory, and the lab has little to spare on a phone.
 */
export const AHEAD = 4;
/** How many frames of the way home are kept ready, in case a reaction is asked for at the next step. */
export const HOME_READY = 3;

/** Everything wrong with the two manifests, in plain words. An empty list means they can be played. */
export function checkClips(frames: ClipFrames, routine: ClipRoutine): string[] {
  const problems: string[] = [];
  const still = (name: unknown, where: string, orNothing = false): void => {
    if (orNothing && name === null) return;
    if (typeof name !== 'string' || !(name in (frames.stills ?? {}))) problems.push(`${where} names the still "${String(name)}", which frames.json does not have.`);
  };
  const clip = (name: unknown, where: string): void => {
    if (typeof name !== 'string' || !(name in (frames.clips ?? {}))) problems.push(`${where} names the clip "${String(name)}", which frames.json does not have.`);
  };
  const c = frames.canvas;
  if (!c || !(c.w > 0 && c.h > 0 && c.plate_w > 0 && c.plate_h > 0)) problems.push('frames.json needs a "canvas" with its size and its place on the plate.');
  for (const [name, entry] of Object.entries(frames.clips ?? {})) {
    still(entry.base, `The clip "${name}"`);
    if (!Array.isArray(entry.frames) || entry.frames.length === 0) problems.push(`The clip "${name}" has no frames.`);
  }
  if (!Array.isArray(routine.routine) || routine.routine.length === 0) problems.push('routine.json needs a "routine" with at least one step.');
  let holds = false;
  for (const item of routine.routine ?? []) {
    if ('steps' in item) {
      for (const step of item.steps) still(step.still, `The loop "${item.loop}"`, true);
      holds ||= item.steps.length > 0;
    } else if ('clip' in item) clip(item.clip, 'loop' in item ? `The loop "${item.loop}"` : 'The routine');
    else {
      still(item.still, 'The routine', true);
      holds = true;
    }
  }
  if (!holds) problems.push('The routine needs at least one still: it is all she can do until her clips have loaded.');
  for (const rule of blinkRules(routine)) {
    for (const on of typeof rule.on === 'string' ? [rule.on] : Array.isArray(rule.on) ? rule.on : [undefined]) still(on, '"blink.on"');
    if (!Array.isArray(rule.frames) || rule.frames.length === 0) problems.push('"blink.frames" must list the blink\'s frames.');
    for (const frame of rule.frames ?? []) still(frame.still, '"blink.frames"');
  }
  if (routine.reaction) {
    if (routine.reaction.enter_from !== undefined) still(routine.reaction.enter_from, '"reaction.enter_from"');
    for (const item of routine.reaction.steps ?? []) {
      if ('clip' in item) clip(item.clip, 'The reaction');
      else if ('still' in item) {
        still(item.still, 'The reaction');
        const blink = item.blink;
        if (typeof blink === 'string') still(blink, 'A blink in the reaction');
        else if (blink) for (const frame of blink.frames ?? (blink.still !== undefined ? [{ still: blink.still }] : [])) still(frame.still, 'A blink in the reaction');
      }
    }
  }
  return problems;
}

/** The clips the idle routine plays, and the ones only the reaction needs: the order to load them in. */
export function clipsInUse(routine: ClipRoutine): { routine: string[]; reaction: string[] } {
  const idle = new Set<string>();
  for (const item of routine.routine) if ('clip' in item) idle.add(item.clip);
  const reaction = new Set<string>();
  for (const item of routine.reaction?.steps ?? []) if ('clip' in item && !idle.has(item.clip)) reaction.add(item.clip);
  return { routine: [...idle], reaction: [...reaction] };
}

/** One frame of a clip, in playing order. */
function clipSteps(frames: ClipFrames, clip: string, ms: number, reverse = false): Step[] {
  const steps = frames.clips[clip].frames.map((_, index) => ({ pose: clipPose(clip, index), ms }));
  return reverse ? steps.reverse() : steps;
}

/**
 * The endless idle routine. Throws if the manifests cannot be played (see checkClips).
 *
 * `has(clip)` says whether a clip's frames have loaded. Until every clip the routine uses is there, she
 * keeps to her stills (clips and loops of clips are passed over), so the scene can start on the stills alone.
 * The generator is told, through next(), when a reaction is waiting (see the reaction entry rule above).
 */
export function* clipSchedule(
  frames: ClipFrames,
  routine: ClipRoutine,
  rnd: Rng = Math.random,
  has: (clip: string) => boolean = () => true,
): Generator<Step, never, Signal> {
  const problems = checkClips(frames, routine);
  if (problems.length) throw new Error(`routine: ${problems.join(' ')}`);

  const roll = (ms: Ms): number => (typeof ms === 'number' ? ms : ms[0] + rnd() * (ms[1] - ms[0]));
  const count = (n: Ms): number => (typeof n === 'number' ? Math.round(n) : n[0] + Math.floor(rnd() * (n[1] - n[0] + 1)));
  // (An actor who never reacts has nowhere to be called home to.)
  const rest = routine.reaction ? restOf(frames, routine) : '';
  const needed = clipsInUse(routine).routine;
  // The transition that leads into each loop of a clip: played in reverse, it is the way back out.
  const wayIn = new Map<string, { clip: string; ms: number }>();
  routine.routine.forEach((item, i) => {
    const before = routine.routine[i - 1];
    if ('clip' in item && 'loop' in item && before && 'clip' in before && !('loop' in before)) wayIn.set(item.loop, { clip: before.clip, ms: before.ms });
  });

  const rules = blinkRules(routine);
  const every = rules.find((rule) => rule.every_ms !== undefined)?.every_ms;
  let sinceBlink = 0;
  let nextBlink = every !== undefined ? roll(every) : Infinity;

  /** A moment of the routine: the step to show, and the steps that lead from it back to the rest still. */
  interface Moment {
    step: Step;
    home: Step[];
  }

  /**
   * One hold of a still, with a blink slipped into the middle when one is due, allowed and fits. `home` is
   * the way back to the rest still from a hold somewhere else (see wayBack): such a hold may be cut short.
   */
  function* hold(still: string | null, ms: number, blinkOk: boolean, home: Step[] | null = null): Generator<Moment> {
    const pose = still ?? NOTHING;
    const blink = blinkOk && every !== undefined ? rules.find((rule) => blinksOn(rule, pose)) : undefined;
    const blinkMs = blink ? blink.frames.reduce((sum, frame) => sum + frame.ms, 0) : 0;
    if (blink && ms >= blinkMs + 2 * BLINK_MARGIN_MS && sinceBlink + ms / 2 >= nextBlink) {
      const before = BLINK_MARGIN_MS + rnd() * (ms - blinkMs - 2 * BLINK_MARGIN_MS);
      yield { step: { pose, ms: before }, home: [] };
      for (const frame of blink.frames) yield { step: { pose: frame.still, ms: frame.ms }, home: [] };
      yield { step: { pose, ms: ms - before - blinkMs }, home: [] };
      sinceBlink = ms - before - blinkMs;
      nextBlink = roll(every!);
      return;
    }
    sinceBlink += ms;
    yield home ? { step: { pose, ms, brief: BRIEF_MS }, home } : { step: { pose, ms }, home: [] };
  }

  /**
   * From a hold on a still that is not the rest one: the way back, when the routine itself gets back to the
   * rest still from here by clips alone (the café: sip, hold, sip backwards, sketch). Null when it does not.
   */
  const wayBack = (index: number): Step[] | null => {
    const steps: Step[] = [];
    for (let i = index + 1; i < routine.routine.length; i++) {
      const item = routine.routine[i];
      if ('loop' in item) return null;
      if ('clip' in item) steps.push(...clipSteps(frames, item.clip, item.ms, item.reverse));
      else return item.still === rest && steps.length ? steps : null;
    }
    return null;
  };

  /** One pass through the routine. */
  function* pass(): Generator<Moment> {
    const withClips = needed.every(has);
    for (const [index, item] of routine.routine.entries()) {
      if ('steps' in item) {
        for (let n = Math.max(1, count(item.repeat)); n > 0; n--) {
          // Blinks are for the marked holds; a loop's own holds on the same still are too short to matter.
          for (const step of item.steps) yield* hold(step.still, roll(step.ms), false);
        }
      } else if ('clip' in item && 'loop' in item) {
        if (!withClips) continue;
        // From anywhere in a loop of a clip, the way home is the transition that led in, played backwards.
        const back = wayIn.get(item.loop);
        const home = back ? clipSteps(frames, back.clip, back.ms, true) : [];
        for (let n = Math.max(1, count(item.repeat)); n > 0; n--) {
          for (const step of clipSteps(frames, item.clip, item.ms)) {
            sinceBlink += step.ms;
            yield { step, home };
          }
        }
      } else if ('clip' in item) {
        if (!withClips) continue;
        const steps = clipSteps(frames, item.clip, item.ms, item.reverse);
        const forwards = clipSteps(frames, item.clip, item.ms);
        for (let i = 0; i < steps.length; i++) {
          sinceBlink += steps[i].ms;
          // Part-way through a transition, the way home is back along it to its first frame: what is left of
          // it when it is already running backwards, what has been played, reversed, when it runs forwards.
          const played = item.reverse ? steps.slice(i + 1) : forwards.slice(0, i).reverse();
          yield { step: steps[i], home: frames.clips[item.clip].base === rest ? played : [] };
        }
      } else {
        const elsewhere = rest && withClips && item.still !== null && item.still !== rest;
        yield* hold(item.still, roll(item.ms), item.blink_ok === true, elsewhere ? wayBack(index) : null);
      }
    }
  }

  /** The clip frames among these steps. */
  const clipFrames = (steps: readonly Step[]): string[] => [...new Set(steps.map((step) => step.pose).filter((pose) => pose !== NOTHING && !(pose in frames.stills)))];

  for (;;) {
    // A whole pass is rolled at once, so that every step can say what follows it.
    const moments = [...pass()];
    for (let i = 0; i < moments.length; i++) {
      const { step, home } = moments[i];
      const soon = clipFrames([
        ...moments.slice(i + 1, i + 1 + AHEAD).map((moment) => moment.step),
        // Should a reaction be asked for during this step or the next: the start of the way home from each.
        ...home.slice(0, HOME_READY),
        ...(moments[i + 1]?.home.slice(0, HOME_READY) ?? []),
      ]);
      const signal = yield { ...step, soon };
      if (signal !== 'react' || !rest || step.pose === rest) continue;
      // A reaction is waiting: go home, then offer the rest still. The player starts the reaction on it,
      // and afterwards the routine begins again from the top.
      for (let j = 0; j < home.length; j++) yield { ...home[j], soon: clipFrames(home.slice(j + 1, j + 1 + AHEAD)) };
      yield { pose: rest, ms: 300 };
      break;
    }
  }
}

/** A reaction: what scene.ts needs to play it (see clipReaction). */
export interface ClipReaction {
  /** The reaction as a list of steps, with every time that is a range at its middle and no blinks. */
  steps: Step[];
  /** The same, rolled afresh: ranges rolled, and a blink in a hold that allows one, more often than not. */
  roll: (rnd?: Rng) => Step[];
  /** The one held pose that stands in for it when motion is paused or reduced, or while its clips load. */
  still: Step[];
}

/** Null when routine.json has no reaction. */
export function clipReaction(frames: ClipFrames, routine: ClipRoutine): ClipReaction | null {
  const { reaction } = routine;
  if (!reaction) return null;
  const rest = restOf(frames, routine);
  const rules = blinkRules(routine);
  const middle = (ms: Ms): number => (typeof ms === 'number' ? ms : (ms[0] + ms[1]) / 2);
  const build = (rnd: Rng | null): Step[] => {
    const steps: Step[] = [];
    for (const item of reaction.steps) {
      if ('hold_last' in item) {
        // Stay on the frame just shown for this much longer.
        if (steps.length) steps[steps.length - 1] = { ...steps[steps.length - 1], ms: steps[steps.length - 1].ms + item.hold_last };
      } else if ('clip' in item) {
        const frameSteps = clipSteps(frames, item.clip, item.ms);
        // A slower start: the first few frames of the clip are held a little longer.
        if (item.first_ms !== undefined) for (let i = 0; i < Math.min(item.first_n ?? 0, frameSteps.length); i++) frameSteps[i].ms = item.first_ms;
        steps.push(...(item.reverse ? frameSteps.reverse() : frameSteps));
      } else {
        const ms = rnd && typeof item.ms !== 'number' ? item.ms[0] + rnd() * (item.ms[1] - item.ms[0]) : middle(item.ms);
        // A blink in the middle of the hold, if the manifest allows one here: its own, or the still's rule.
        const own = typeof item.blink === 'string' ? [{ still: item.blink, ms: BLINK_MS }] : item.blink ? (item.blink.frames ?? (item.blink.still ? [{ still: item.blink.still, ms: item.blink.ms ?? BLINK_MS }] : null)) : null;
        const blink = own ?? (item.blink_ok ? rules.find((rule) => blinksOn(rule, item.still))?.frames : undefined);
        const blinkMs = blink ? blink.reduce((sum, frame) => sum + frame.ms, 0) : 0;
        if (rnd && blink && ms >= blinkMs + 6 * BLINK_MARGIN_MS && rnd() < 0.7) {
          const before = 3 * BLINK_MARGIN_MS + rnd() * (ms - blinkMs - 6 * BLINK_MARGIN_MS);
          steps.push({ pose: item.still, ms: before }, ...blink.map((frame) => ({ pose: frame.still, ms: frame.ms })), { pose: item.still, ms: ms - before - blinkMs });
        } else {
          steps.push({ pose: item.still, ms });
        }
      }
    }
    return steps;
  };
  // The still held longest is the gesture itself.
  const held = reaction.steps.filter((item): item is Extract<ReactionItem, { still: string }> => 'still' in item && item.still !== rest);
  const longest = held.reduce<{ still: string; ms: number } | null>((a, b) => (!a || middle(b.ms) > a.ms ? { still: b.still, ms: middle(b.ms) } : a), null);
  return { steps: build(null), roll: (rnd = Math.random) => build(rnd), still: longest ? [{ pose: longest.still, ms: longest.ms }] : [] };
}

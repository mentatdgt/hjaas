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
//   - A hold on another still of the rest still's own loop (the stroke of her sketching) is cut to 300 ms
//     when a reaction is waiting, and she reacts from there.
//   - Away from the rest still on poses the routine passes through one after another (reach, lift, sip, lift,
//     reach, and back to the sketch), a waiting reaction does not interrupt: she finishes what she is doing,
//     with any long hold on the way cut short, and reacts once she is home.
//   - Blinks: `blink` may be a list of rules, and a rule's `on` a list of stills. Instead of one blink for
//     all of them (`frames`), a rule may give each still its own (`still_for`: still -> its blink still,
//     shown for `ms`): the film scene's presenter closes his eyes on whichever mouth he is holding, so the
//     mouth never jumps. A hold in the reaction
//     may blink too: `"blink_ok": true` (the rule for that still is used), or `"blink"` naming the blink's
//     still or giving its frames. Times in the reaction may be ranges, rolled each time she reacts.
//   - A routine that never says `blink_ok` at all (the film scene's presenter, who talks in holds of a tenth
//     of a second) may blink on any still its blink rule names: see `hold` in clipSchedule.
//   - The reaction's longest hold is its gesture (the look back, the smile): its steps are marked
//     (steps.ts, `gesture`), for a scene where a second find holds it afresh.
//   - `"fade_ms"` on a still of a loop: the still is dissolved in from the pose before it over that long, at
//     the start of its hold (a true cross-dissolve: character.ts). Only between two stills of the same loop:
//     coming into the loop, and anywhere else (a hold by itself, a blink, the whole reaction), the pose
//     changes at once whatever the manifest says. A dissolved head turn is a ghost with two faces.
//   - A reaction may say how it is come into from whatever she is doing (the theatre, whose moves are all drawn
//     through in-betweens): `"lead_in"`, still -> the steps that lead from it back to rest, played before the
//     reaction's own; and `"min_show_ms"` (`"min_show_by_still"` for one still), how long the still on screen
//     is shown before it is left. After such a reaction she picks the routine up at its next rest step. See
//     `Entry` below; the player does the rest.
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
  | { loop: string; repeat: Ms; steps: ReadonlyArray<{ still: string | null; ms: Ms; blink_ok?: boolean; fade_ms?: number }> }
  | { loop: string; repeat: Ms; clip: string; ms: number }
  | { still: string | null; ms: Ms; blink_ok?: boolean }
  | { clip: string; ms: number; reverse?: boolean };

type BlinkFrames = ReadonlyArray<{ still: string; ms: number }>;
/** Where she may blink (on which stills), what the blink is, and how often. */
interface BlinkRule {
  on: string | readonly string[];
  /** The blink, whichever of the `on` stills it is in. */
  frames?: BlinkFrames;
  /** Or a blink still for each of them, shown for `ms`. */
  still_for?: Readonly<Record<string, string>>;
  ms?: number;
  every_ms?: Ms;
}

type ReactionItem =
  | { clip: string; ms: number; reverse?: boolean; first_ms?: number; first_n?: number }
  | { hold_last: number }
  | { still: string; ms: Ms; blink_ok?: boolean; blink?: string | { still?: string; ms?: number; frames?: BlinkFrames } };

export interface ClipRoutine {
  routine: readonly RoutineItem[];
  blink?: BlinkRule | readonly BlinkRule[];
  reaction?: {
    enter_from?: string;
    steps: readonly ReactionItem[];
    lead_in?: Readonly<Record<string, ReadonlyArray<{ still: string; ms: Ms }>>>;
    min_show_ms?: number;
    min_show_by_still?: Readonly<Record<string, number>>;
  };
}

/** How a reaction is come into, and left, from the middle of a routine drawn through in-betweens (the player plays it). */
export interface Entry {
  /** From the pose she is in, the steps back to rest, played before the reaction's own. None: it starts straight away. */
  leadIn: (pose: string) => readonly Step[];
  /** The pose on screen is shown at least this long (or for its own planned time, if that is shorter) before it is left. */
  minShow: (pose: string) => number;
}

/** The pose of an actor who is not drawn at all (`"still": null`). */
export const NOTHING = '';
/** A blink in a held pose of a reaction lasts this long when the manifest does not say. */
const BLINK_MS = 90;
/** A hold that a waiting reaction cuts short is still held this long (the café's note: "B1 300 ms"). */
const BRIEF_MS = 300;

const blinkRules = (routine: ClipRoutine): readonly BlinkRule[] => (!routine.blink ? [] : Array.isArray(routine.blink) ? routine.blink : [routine.blink as BlinkRule]);
/** The blink that may come in a hold of this still: the rule's one blink, or the still's own. */
const blinkFrames = (rule: BlinkRule, still: string): BlinkFrames => {
  if (rule.frames) return rule.frames;
  const own = rule.still_for?.[still];
  return own ? [{ still: own, ms: rule.ms ?? BLINK_MS }] : [];
};
const blinksOn = (rule: BlinkRule, still: string): boolean => (typeof rule.on === 'string' ? rule.on === still : rule.on.includes(still)) && blinkFrames(rule, still).length > 0;

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
/** A blink that takes the start of a short hold: what is left of the hold is shown if it is at least this long. */
const BLINK_REST_MS = 50;

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
    const on = typeof rule.on === 'string' ? [rule.on] : Array.isArray(rule.on) ? rule.on : [undefined];
    for (const name of on) still(name, '"blink.on"');
    if (rule.still_for && !rule.frames) {
      for (const name of on) if (typeof name === 'string' && !rule.still_for[name]) problems.push(`"blink.still_for" has no blink still for "${name}", which "blink.on" names.`);
      for (const [name, blink] of Object.entries(rule.still_for)) still(blink, `"blink.still_for" (for "${name}")`);
      if (!(typeof rule.ms === 'number' && rule.ms > 0)) problems.push('"blink.ms" must say how long a blink still is shown.');
    } else {
      if (!Array.isArray(rule.frames) || rule.frames.length === 0) problems.push('"blink.frames" must list the blink\'s frames (or "blink.still_for" a blink still for each still).');
      for (const frame of rule.frames ?? []) still(frame.still, '"blink.frames"');
    }
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
    const { lead_in: leadIn, min_show_ms: least, min_show_by_still: leastBy } = routine.reaction;
    const time = (ms: unknown): boolean => (Array.isArray(ms) ? ms.length === 2 && ms.every((n) => typeof n === 'number' && n > 0) && ms[0] <= ms[1] : typeof ms === 'number' && ms > 0);
    for (const [name, steps] of Object.entries(leadIn ?? {})) {
      still(name, '"reaction.lead_in"');
      if (!Array.isArray(steps)) problems.push(`"reaction.lead_in" needs a list of steps for "${name}".`);
      else
        for (const step of steps) {
          still(step.still, `"reaction.lead_in" (from "${name}")`);
          if (!time(step.ms)) problems.push(`"reaction.lead_in" (from "${name}") needs a time for "${String(step.still)}".`);
        }
    }
    for (const name of Object.keys(leastBy ?? {})) still(name, '"reaction.min_show_by_still"');
    if ([least, ...Object.values(leastBy ?? {})].some((ms) => ms !== undefined && !(typeof ms === 'number' && ms >= 0))) problems.push('"reaction.min_show_ms" and "reaction.min_show_by_still" must be times in ms.');
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

/** The stills the manifests ever show: the routine's, the blinks' and the reaction's, and every clip's base. */
export function stillsInUse(frames: ClipFrames, routine: ClipRoutine): string[] {
  const used = new Set<string>();
  const add = (name: string | null | undefined): void => void (name && used.add(name));
  const clipBase = (name: string): void => add(frames.clips?.[name]?.base);
  for (const item of routine.routine ?? []) {
    if ('steps' in item) for (const step of item.steps) add(step.still);
    else if ('clip' in item) clipBase(item.clip);
    else add(item.still);
  }
  for (const rule of blinkRules(routine)) {
    for (const on of typeof rule.on === 'string' ? [rule.on] : rule.on) add(on);
    for (const frame of rule.frames ?? []) add(frame.still);
    for (const blink of Object.values(rule.still_for ?? {})) add(blink);
  }
  add(routine.reaction?.enter_from);
  for (const steps of Object.values(routine.reaction?.lead_in ?? {})) for (const step of steps) add(step.still);
  for (const item of routine.reaction?.steps ?? []) {
    if ('clip' in item) clipBase(item.clip);
    else if ('still' in item) {
      add(item.still);
      if (typeof item.blink === 'string') add(item.blink);
      else if (item.blink) for (const frame of item.blink.frames ?? [{ still: item.blink.still }]) add(frame.still);
    }
  }
  return [...used].filter((name) => name in frames.stills);
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
  // A routine that marks no hold `blink_ok` leaves the choice to its blink rule: any hold on a still the
  // rule names may blink. One that marks any hold blinks in the marked holds only.
  const free = !routine.routine.some((item) => ('steps' in item ? item.steps.some((step) => step.blink_ok !== undefined) : 'still' in item && item.blink_ok !== undefined));
  /** The pose of the step before the one being rolled. */
  let last = '';

  /** A moment of the routine: the step to show, and the steps that lead from it back to the rest still. */
  interface Moment {
    step: Step;
    home: Step[];
  }

  /**
   * One hold of a still, with a blink slipped into the middle when one is due, allowed and fits. `home` is
   * the way back to the rest still from a hold somewhere else (see wayBack): such a hold may be cut short.
   * `fadeMs` is for a still of a loop that follows another still of the same loop, and for nothing else.
   *
   * Where the routine leaves blinking to its rule (`free`), a hold too short to blink in the middle of gives
   * the blink its start: the blink is shown in place of the pose, and the pose for what is left of the
   * hold. Only when the blink is due, and only after another pose the rule names: someone talking blinks
   * between two shapes of his mouth, never on the frame he comes out of a gesture.
   */
  function* hold(still: string | null, ms: number, blinkOk: boolean, home: Step[] | null = null, fadeMs?: number): Generator<Moment> {
    const pose = still ?? NOTHING;
    const before = last;
    last = pose;
    // The dissolve belongs to the start of the hold: after a blink in the middle of it, the pose is simply back.
    const fade = fadeMs !== undefined && fadeMs > 0 ? { fade: fadeMs } : {};
    const blink = (blinkOk || free) && every !== undefined ? rules.find((rule) => blinksOn(rule, pose)) : undefined;
    const frames = blink ? blinkFrames(blink, pose) : [];
    const blinkMs = frames.reduce((sum, frame) => sum + frame.ms, 0);
    // (A blink waits for the dissolve into the pose to finish.)
    const lead = Math.max(BLINK_MARGIN_MS, fadeMs ?? 0);
    if (blink && ms >= blinkMs + lead + BLINK_MARGIN_MS && sinceBlink + ms / 2 >= nextBlink) {
      const first = lead + rnd() * (ms - blinkMs - lead - BLINK_MARGIN_MS);
      yield { step: { pose, ms: first, ...fade }, home: [] };
      for (const frame of frames) yield { step: { pose: frame.still, ms: frame.ms }, home: [] };
      yield { step: { pose, ms: ms - first - blinkMs }, home: [] };
      sinceBlink = ms - first - blinkMs;
      nextBlink = roll(every!);
      return;
    }
    if (blink && free && !fade.fade && sinceBlink >= nextBlink && blinksOn(blink, before)) {
      for (const frame of frames) yield { step: { pose: frame.still, ms: frame.ms }, home: [] };
      const left = ms - blinkMs;
      if (left >= BLINK_REST_MS) yield { step: { pose, ms: left }, home: [] };
      // (With nothing left of the hold, the blink itself is the step before the next one.)
      else last = frames[frames.length - 1].still;
      sinceBlink = left >= BLINK_REST_MS ? left : 0;
      nextBlink = roll(every!);
      return;
    }
    sinceBlink += ms;
    yield home ? { step: { pose, ms, brief: BRIEF_MS, ...fade }, home } : { step: { pose, ms, ...fade }, home: [] };
  }

  /**
   * From a hold on a still that is not the rest one: the way back, when the routine itself gets back to the
   * rest still from here without a loop on the way (the café: reach, lift, sip, lift, reach, sketch). It is
   * the routine carried on, with any long hold cut to BRIEF_MS. Null when the routine has no such way.
   */
  const wayBack = (index: number): Step[] | null => {
    const steps: Step[] = [];
    for (let i = index + 1; i < routine.routine.length; i++) {
      const item = routine.routine[i];
      if ('loop' in item) return null;
      if ('clip' in item) steps.push(...clipSteps(frames, item.clip, item.ms, item.reverse));
      else if (item.still === rest) return steps.length ? steps : null;
      else steps.push({ pose: item.still ?? NOTHING, ms: Math.min(typeof item.ms === 'number' ? item.ms : item.ms[0], BRIEF_MS) });
    }
    return null;
  };

  /** One pass through the routine. */
  function* pass(): Generator<Moment> {
    const withClips = needed.every(has);
    for (const [index, item] of routine.routine.entries()) {
      if ('steps' in item) {
        // A dissolve is for a still that follows another of this loop: she comes into the loop on a cut.
        let inside = false;
        // In the rest still's own loop the other stills are a step away from it (the stylus an inch along):
        // a waiting reaction need not sit such a hold out, and there is nothing to play on the way home.
        const beside = rest !== '' && item.steps.some((step) => step.still === rest);
        for (let n = Math.max(1, count(item.repeat)); n > 0; n--) {
          // Blinks are for the marked holds, in a loop as anywhere.
          for (const step of item.steps) {
            yield* hold(step.still, roll(step.ms), step.blink_ok === true, beside && step.still !== rest ? [] : null, inside ? step.fade_ms : undefined);
            inside = true;
          }
        }
      } else if ('clip' in item && 'loop' in item) {
        if (!withClips) continue;
        // From anywhere in a loop of a clip, the way home is the transition that led in, played backwards.
        const back = wayIn.get(item.loop);
        const home = back ? clipSteps(frames, back.clip, back.ms, true) : [];
        for (let n = Math.max(1, count(item.repeat)); n > 0; n--) {
          for (const step of clipSteps(frames, item.clip, item.ms)) {
            sinceBlink += step.ms;
            last = step.pose;
            yield { step, home };
          }
        }
      } else if ('clip' in item) {
        if (!withClips) continue;
        const steps = clipSteps(frames, item.clip, item.ms, item.reverse);
        const forwards = clipSteps(frames, item.clip, item.ms);
        for (let i = 0; i < steps.length; i++) {
          sinceBlink += steps[i].ms;
          last = steps[i].pose;
          // Part-way through a transition, the way home is back along it to its first frame: what is left of
          // it when it is already running backwards, what has been played, reversed, when it runs forwards.
          const played = item.reverse ? steps.slice(i + 1) : forwards.slice(0, i).reverse();
          yield { step: steps[i], home: frames.clips[item.clip].base === rest ? played : [] };
        }
      } else {
        // Without her clips, a pose that only a clip leads to is passed over with it (the cup at her lips).
        const before = routine.routine[index - 1];
        if (!withClips && before && 'clip' in before && !('loop' in before) && !before.reverse && item.still !== frames.clips[before.clip].base) continue;
        const elsewhere = rest && withClips && item.still !== null && item.still !== rest;
        yield* hold(item.still, roll(item.ms), item.blink_ok === true, elsewhere ? wayBack(index) : null);
      }
    }
  }

  /** The clip frames among these steps. */
  const clipFrames = (steps: readonly Step[]): string[] => [...new Set(steps.map((step) => step.pose).filter((pose) => pose !== NOTHING && !(pose in frames.stills)))];

  for (;;) {
    // A pass is rolled a few steps ahead of where she is, so that every step can say what follows it. (Not
    // all at once: a loop may run a thousand times, as the café's fan does.)
    const rolling = pass();
    const ahead: Moment[] = [];
    const rollAhead = (): void => {
      while (ahead.length <= AHEAD) {
        const next = rolling.next();
        if (next.done) return;
        ahead.push(next.value);
      }
    };
    for (rollAhead(); ahead.length; rollAhead()) {
      const { step, home } = ahead.shift()!;
      rollAhead();
      const soon = clipFrames([
        ...ahead.slice(0, AHEAD).map((moment) => moment.step),
        // Should a reaction be asked for during this step or the next: the start of the way home from each.
        ...home.slice(0, HOME_READY),
        ...(ahead[0]?.home.slice(0, HOME_READY) ?? []),
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
  // The still held longest is the gesture itself.
  const held = reaction.steps.filter((item): item is Extract<ReactionItem, { still: string }> => 'still' in item && item.still !== rest);
  const gesture = held.reduce<Extract<ReactionItem, { still: string }> | null>((a, b) => (!a || middle(b.ms) > middle(a.ms) ? b : a), null);
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
        const rule = item.blink_ok ? rules.find((r) => blinksOn(r, item.still)) : undefined;
        const blink = own ?? (rule ? blinkFrames(rule, item.still) : undefined);
        const blinkMs = blink ? blink.reduce((sum, frame) => sum + frame.ms, 0) : 0;
        // (Both parts of a gesture that a blink splits are the gesture; the blink between them is not.)
        const mark = item === gesture ? { gesture: true } : {};
        if (rnd && blink && ms >= blinkMs + 6 * BLINK_MARGIN_MS && rnd() < 0.7) {
          const before = 3 * BLINK_MARGIN_MS + rnd() * (ms - blinkMs - 6 * BLINK_MARGIN_MS);
          steps.push({ pose: item.still, ms: before, ...mark }, ...blink.map((frame) => ({ pose: frame.still, ms: frame.ms })), { pose: item.still, ms: ms - before - blinkMs, ...mark });
        } else {
          steps.push({ pose: item.still, ms, ...mark });
        }
      }
    }
    return steps;
  };
  return { steps: build(null), roll: (rnd = Math.random) => build(rnd), still: gesture ? [{ pose: gesture.still, ms: middle(gesture.ms), gesture: true }] : [] };
}

/** How this routine's reaction is come into, when it says so (see Entry). Null: as it always was. */
export function clipEntry(routine: ClipRoutine): Entry | null {
  const { reaction } = routine;
  if (!reaction || (reaction.lead_in === undefined && reaction.min_show_ms === undefined && reaction.min_show_by_still === undefined)) return null;
  const leads = new Map(Object.entries(reaction.lead_in ?? {}).map(([from, steps]) => [from, steps.map((step): Step => ({ pose: step.still, ms: typeof step.ms === 'number' ? step.ms : (step.ms[0] + step.ms[1]) / 2 }))]));
  const least = new Map(Object.entries(reaction.min_show_by_still ?? {}));
  return { leadIn: (pose) => leads.get(pose) ?? [], minShow: (pose) => least.get(pose) ?? reaction.min_show_ms ?? 0 };
}

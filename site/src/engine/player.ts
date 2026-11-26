import type { Character } from './character';
import { planOf, type Entry, type Planned } from './clips';
import type { Step } from './steps';

/** A routine. It is told, each time it is asked for a step, whether a reaction is waiting (clips.ts uses that). */
export type Schedule = Iterator<Step, unknown, 'react' | undefined>;

// A frame that arrives late is absorbed: time accumulates and the schedule catches up,
// so one slow frame never shifts the rhythm. After a real stall we don't fast-forward further than this.
const MAX_CATCH_UP_MS = 250;
/** A step no longer than this is a drawing a move passes through, not a hold (see Player.entry). */
const PASSING_MS = 60;
/** How far through a routine to look for its next rest step. */
const MAX_LOOK = 2000;

/**
 * Plays a character's poses from a schedule, on requestAnimationFrame with accumulated time.
 * A reaction can be queued at any moment; it always starts from, and returns to, the rest frame
 * (scene 1: the hammer's contact frame).
 */
export class Player {
  private readonly rachel: Character;
  private readonly rest: string;
  private loop: Schedule;
  /** The schedule the step on show came from (none: the rest pose before her first step, or a reaction's). */
  private from: Schedule | null = null;
  private step: Step;
  private elapsed = 0;
  private last = 0;
  private raf = 0;
  private running = false;

  /** A dissolve under way: the pose it started from. (The step being played says how long it takes.) */
  private fadingFrom: string | null = null;

  /** How long the pose on show has been on show, in ms: over several steps, if they hold the same pose. */
  private shown = 0;
  /** The length of a frame of this screen, in ms: the last one that was not late. */
  private frame = 1000 / 60;

  private queued: Step[] | null = null;
  /** The queued reaction waits only for the pose on show to have been shown long enough (see `entry`). */
  private settling = false;
  private reaction: Step[] | null = null;
  private reactionIndex = 0;
  private reactionDone: (() => void) | null = null;

  /** Called on every pose change. Used by QA to log the rhythm. */
  onPose: ((pose: string, at: number) => void) | null = null;
  /** Called as each step begins: a step may say which poses to have ready next (steps.ts, `soon`). */
  onStep: ((step: Step) => void) | null = null;
  /**
   * Called once at the end of every frame she is running, with the frame's time: for whatever else in the
   * scene has to keep time with her without a loop of its own (the film scene's camera: its REC dot).
   */
  onFrame: ((now: number) => void) | null = null;

  /**
   * How a reaction that cuts in is come into, for a routine drawn through in-betweens (clips.ts, Entry). With it:
   *
   *   - the pose on show is first shown as long as the entry asks, and the reaction begins with the entry's way
   *     back to rest from that pose;
   *   - after the reaction the routine is picked up at its next rest step, never in the middle of a move;
   *   - the drawings a move passes through are never skipped, and are shown evenly: 50 ms is three frames of
   *     a 60 Hz screen each time. (A late frame holds the move up; it does not cut a drawing out of it. And a
   *     move starts half a frame in: started on the frame's edge, the screen's and the browser's rounding
   *     would give one drawing four frames and the next two.)
   */
  entry: Entry | null = null;

  constructor(character: Character, loop: Schedule) {
    this.rachel = character;
    this.rest = character.rest;
    this.step = { pose: this.rest, ms: 0 };
    this.loop = loop;
  }

  get reacting(): boolean {
    return this.reaction !== null || this.queued !== null;
  }

  /** How long ago, in ms of play, the step she is on began (less than 0 while a delay puts her next move off). */
  get since(): number {
    return this.elapsed + this.lag();
  }

  /**
   * The time since her last frame, as her next one will count it: so that two players read in the same frame
   * agree, whichever of them has run its own frame yet.
   */
  private lag(): number {
    return this.running ? Math.min(Math.max(0, performance.now() - this.last), MAX_CATCH_UP_MS) : 0;
  }

  /**
   * What her routine will show, in ms from now (clips.ts, Planned: another actor's blink `avoid` asks). From the
   * routine she is playing; or from the one waiting to start, which begins as the step on show ends (her own
   * routine, once her drawings are in). Null while she reacts or holds still: then nobody knows.
   */
  planned(): Planned | null {
    if (this.reacting) return null;
    const playing = this.from !== null && this.from === this.loop;
    const plan = planOf(this.loop);
    if (!plan) return null;
    // How long ago the plan's first step began (its step on show), or, for one waiting, less than 0: until this step ends.
    const at = playing ? this.since : this.since - this.step.ms;
    return { busy: (stills, from, to) => plan(stills, from + at, to + at).map(([a, b]) => [a - at, b - at] as const) };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    if (this.step.ms === 0) this.enter(this.nextLoopStep());
    this.raf = requestAnimationFrame(this.tick);
  }

  /** Put the next pose change off by this long (one of several actors, so that they do not all move at once). */
  delay(ms: number): void {
    this.elapsed -= ms;
  }

  /** Stops on the current pose. start() carries on from the same point. */
  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /**
   * Stop and put her back on the rest frame, dropping any reaction. start() then begins the routine afresh.
   * Used when the room is painted again.
   */
  settle(): void {
    this.stop();
    this.queued = null;
    this.settling = false;
    this.reaction = null;
    this.reactionDone?.();
    this.reactionDone = null;
    this.elapsed = 0;
    this.shown = 0;
    this.fadingFrom = null;
    this.from = null;
    this.step = { pose: this.rest, ms: 0 };
    this.rachel.show(this.rest);
    this.onStep?.(this.step);
  }

  /** Complete active motion and restart the rhythm only if the scene is still playing. */
  finishMotion(loop: Schedule, resetRoutine: boolean, resume: boolean): void {
    if (!resetRoutine && !this.reacting) return;
    this.loop = loop;
    this.settle();
    if (resume) this.start();
  }

  /** Swap the rhythm (reduced motion on or off). Takes effect at the next step. */
  setLoop(loop: Schedule): void {
    this.loop = loop;
  }

  /**
   * Play a reaction. Resolves when she is back on the contact frame. If she is already reacting,
   * resolves at once and the running reaction is left alone. `now`: it cuts straight in from whatever pose
   * she is in (the theatre: she turns to the visitor mid-stroke), instead of waiting for her rest pose.
   * `led`: by way of the entry, if she has one (see `entry`).
   */
  react(steps: Step[], now = false, led = true): Promise<void> {
    if (this.reacting || steps.length === 0) return Promise.resolve();
    return new Promise((resolve) => {
      this.reactionDone = resolve;
      this.queued = steps;
      if (now && led && this.entry) {
        // (On the next frame at the soonest: begun between two frames, its first drawing would lose one of its own.)
        this.settling = true;
        return;
      }
      // On the contact frame already: go now. Otherwise the swing finishes first, so the hammer never teleports.
      if (this.step.pose === this.rest || now) {
        this.elapsed = 0;
        this.beginReaction();
      } else if (this.step.brief !== undefined) {
        // A long hold somewhere else (the café: the cup at her lips) ends early, and the routine takes her home.
        this.step = { ...this.step, ms: Math.min(this.step.ms, Math.max(this.elapsed, this.step.brief)) };
      }
    });
  }

  /**
   * A second find while she is reacting: if she is holding the reaction's gesture (steps.ts, `gesture`),
   * she holds it afresh from now. The reaction is not started again, and nothing is queued. True if the
   * find is answered by the reaction under way: the gesture is being held, or is still to come. False if
   * she is not reacting, or is already on her way back.
   */
  prolong(): boolean {
    const steps = this.reaction ?? this.queued;
    if (!steps) return false;
    if (this.reaction && this.step.gesture) {
      this.elapsed = 0;
      return true;
    }
    const at = this.reaction ? this.reactionIndex : -1;
    return steps.some((step, i) => i > at && step.gesture === true);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    const passed = Math.min(now - this.last, MAX_CATCH_UP_MS);
    this.elapsed += passed;
    this.shown += passed;
    this.last = now;
    if (passed > 4 && passed < 20) this.frame = passed;
    if (this.entry) this.keepEven();
    else
      while (this.elapsed >= this.step.ms) {
        this.elapsed -= this.step.ms;
        this.advance();
      }
    this.blend();
    this.onFrame?.(now);
    this.raf = requestAnimationFrame(this.tick);
  };

  /** One step at most a frame: the drawings of a move are never skipped, and are shown evenly (see `entry`). */
  private keepEven(): void {
    if (this.settling && this.whenShown()) return;
    const { ms } = this.step;
    if (this.elapsed < ms) return;
    this.elapsed -= ms;
    this.advance();
    // A move begins half a frame in, and begins so again after a late frame: no drawing is cut short to catch up.
    if (this.step.ms <= PASSING_MS && (ms > PASSING_MS || this.elapsed > this.frame)) this.elapsed = this.frame / 2;
  }

  /** A reaction is waiting for the pose on show to have been shown long enough: start it, if it has. */
  private whenShown(): boolean {
    const least = this.entry?.minShow(this.step.pose) ?? 0;
    if (this.shown < least && this.elapsed < this.step.ms) return false;
    this.elapsed = this.frame / 2;
    this.queued = [...(this.entry?.leadIn(this.step.pose) ?? []), ...this.queued!];
    this.beginReaction();
    return true;
  }

  private advance(): void {
    if (this.reaction) {
      this.reactionIndex++;
      if (this.reactionIndex < this.reaction.length) {
        this.enter(this.reaction[this.reactionIndex]);
        return;
      }
      // Back to work: a beat on the contact frame, then the loop carries on.
      this.reaction = null;
      this.reactionDone?.();
      this.reactionDone = null;
      this.enter(this.entry ? this.nextRest() : { pose: this.rest, ms: 320 + Math.random() * 160 });
      return;
    }
    const next = this.nextLoopStep();
    if (this.queued && next.pose === this.rest) {
      // The swing has landed. The reaction takes the place of this contact hold.
      this.beginReaction();
      return;
    }
    this.enter(next);
  }

  private beginReaction(): void {
    this.from = null;
    this.reaction = this.queued;
    this.queued = null;
    this.settling = false;
    this.reactionIndex = 0;
    this.enter(this.reaction![0]);
  }

  private nextLoopStep(): Step {
    for (;;) {
      const { value } = this.loop.next(this.queued ? 'react' : undefined);
      const step = value as Step;
      this.from = this.loop;
      if (step.ms > 0) return step;
    }
  }

  /** The routine's next step at rest, passing over what comes before it. */
  private nextRest(): Step {
    for (let i = 0; i < MAX_LOOK; i++) {
      const step = this.nextLoopStep();
      if (step.pose === this.rest) return step;
    }
    return { pose: this.rest, ms: 400 };
  }

  private enter(step: Step): void {
    const from = this.rachel.current;
    if (step.pose !== this.step.pose) this.shown = 0;
    this.step = step;
    // A step may dissolve in from the pose before it (steps.ts, `fade`); blend() carries it on each frame.
    this.fadingFrom = step.fade && step.fade > 0 && from !== step.pose ? from : null;
    if (this.fadingFrom === null) this.rachel.show(step.pose);
    else this.rachel.dissolve(this.fadingFrom, step.pose, 0);
    this.onStep?.(step);
    this.onPose?.(step.pose, performance.now());
  }

  /** One frame of a dissolve, eased as the package's preview eases it (smoothstep). */
  private blend(): void {
    if (this.fadingFrom === null) return;
    const t = Math.min(1, Math.max(0, this.elapsed / (this.step.fade ?? 1)));
    this.rachel.dissolve(this.fadingFrom, this.step.pose, t * t * (3 - 2 * t));
    if (t >= 1) this.fadingFrom = null;
  }
}

import type { Character } from './character';
import type { Step } from './steps';

/** A routine. It is told, each time it is asked for a step, whether a reaction is waiting (clips.ts uses that). */
export type Schedule = Iterator<Step, unknown, 'react' | undefined>;

// A frame that arrives late is absorbed: time accumulates and the schedule catches up,
// so one slow frame never shifts the rhythm. After a real stall we don't fast-forward further than this.
const MAX_CATCH_UP_MS = 250;

/**
 * Plays a character's poses from a schedule, on requestAnimationFrame with accumulated time.
 * A reaction can be queued at any moment; it always starts from, and returns to, the rest frame
 * (scene 1: the hammer's contact frame).
 */
export class Player {
  private readonly rachel: Character;
  private readonly rest: string;
  private loop: Schedule;
  private step: Step;
  private elapsed = 0;
  private last = 0;
  private raf = 0;
  private running = false;

  /** A dissolve under way: the pose it started from. (The step being played says how long it takes.) */
  private fadingFrom: string | null = null;

  private queued: Step[] | null = null;
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

  constructor(character: Character, loop: Schedule) {
    this.rachel = character;
    this.rest = character.rest;
    this.step = { pose: this.rest, ms: 0 };
    this.loop = loop;
  }

  get reacting(): boolean {
    return this.reaction !== null || this.queued !== null;
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
    this.reaction = null;
    this.reactionDone?.();
    this.reactionDone = null;
    this.elapsed = 0;
    this.fadingFrom = null;
    this.step = { pose: this.rest, ms: 0 };
    this.rachel.show(this.rest);
    this.onStep?.(this.step);
  }

  /** Swap the rhythm (reduced motion on or off). Takes effect at the next step. */
  setLoop(loop: Schedule): void {
    this.loop = loop;
  }

  /**
   * Play a reaction. Resolves when she is back on the contact frame. If she is already reacting,
   * resolves at once and the running reaction is left alone. `now`: it cuts straight in from whatever pose
   * she is in (the theatre: she turns to the visitor mid-stroke), instead of waiting for her rest pose.
   */
  react(steps: Step[], now = false): Promise<void> {
    if (this.reacting || steps.length === 0) return Promise.resolve();
    return new Promise((resolve) => {
      this.reactionDone = resolve;
      this.queued = steps;
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
    this.elapsed += Math.min(now - this.last, MAX_CATCH_UP_MS);
    this.last = now;
    while (this.elapsed >= this.step.ms) {
      this.elapsed -= this.step.ms;
      this.advance();
    }
    this.blend();
    this.onFrame?.(now);
    this.raf = requestAnimationFrame(this.tick);
  };

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
      this.enter({ pose: this.rest, ms: 320 + Math.random() * 160 });
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
    this.reaction = this.queued;
    this.queued = null;
    this.reactionIndex = 0;
    this.enter(this.reaction![0]);
  }

  private nextLoopStep(): Step {
    for (;;) {
      const { value } = this.loop.next(this.queued ? 'react' : undefined);
      const step = value as Step;
      if (step.ms > 0) return step;
    }
  }

  private enter(step: Step): void {
    const from = this.rachel.current;
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

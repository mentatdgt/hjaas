import type { Rachel } from './rachel';
import { CONTACT_POSE, type Step } from './schedule';

// A frame that arrives late is absorbed: time accumulates and the schedule catches up,
// so one slow frame never shifts the rhythm. After a real stall we don't fast-forward further than this.
const MAX_CATCH_UP_MS = 250;

/**
 * Plays Rachel's poses from a schedule, on requestAnimationFrame with accumulated time.
 * A reaction can be queued at any moment; it always starts from, and returns to, the contact frame.
 */
export class RachelPlayer {
  private readonly rachel: Rachel;
  private loop: Iterator<Step>;
  private step: Step = { pose: CONTACT_POSE, ms: 0 };
  private elapsed = 0;
  private last = 0;
  private raf = 0;
  private running = false;

  private queued: Step[] | null = null;
  private reaction: Step[] | null = null;
  private reactionIndex = 0;
  private reactionDone: (() => void) | null = null;

  /** Called on every pose change. Used by QA to log the rhythm. */
  onPose: ((pose: string, at: number) => void) | null = null;

  constructor(rachel: Rachel, loop: Iterator<Step>) {
    this.rachel = rachel;
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

  /** Stops on the current pose. start() carries on from the same point. */
  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Swap the rhythm (reduced motion on or off). Takes effect at the next step. */
  setLoop(loop: Iterator<Step>): void {
    this.loop = loop;
  }

  /**
   * Play a reaction. Resolves when she is back on the contact frame. If she is already reacting,
   * resolves at once and the running reaction is left alone.
   */
  react(steps: Step[]): Promise<void> {
    if (this.reacting || steps.length === 0) return Promise.resolve();
    return new Promise((resolve) => {
      this.reactionDone = resolve;
      this.queued = steps;
      // On the contact frame already: go now. Otherwise the swing finishes first, so the hammer never teleports.
      if (this.step.pose === CONTACT_POSE) {
        this.elapsed = 0;
        this.beginReaction();
      }
    });
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    this.elapsed += Math.min(now - this.last, MAX_CATCH_UP_MS);
    this.last = now;
    while (this.elapsed >= this.step.ms) {
      this.elapsed -= this.step.ms;
      this.advance();
    }
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
      this.enter({ pose: CONTACT_POSE, ms: 320 + Math.random() * 160 });
      return;
    }
    const next = this.nextLoopStep();
    if (this.queued && next.pose === CONTACT_POSE) {
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
      const { value } = this.loop.next();
      if (value.ms > 0) return value;
    }
  }

  private enter(step: Step): void {
    this.step = step;
    this.rachel.show(step.pose);
    this.onPose?.(step.pose, performance.now());
  }
}

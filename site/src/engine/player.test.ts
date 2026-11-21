// The player's two additions for the film scene: a second find that holds the reaction's gesture afresh
// (prolong), and the hook that lets something else keep time with her loop (onFrame). Played here on a
// stand-in for her canvas and a clock moved by hand, a frame at a time.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from './character';
import { Player, type Schedule } from './player';
import { holdSchedule, type Step } from './steps';

const FRAME = 16;
let clock = 0;
let frames: Array<(now: number) => void> = [];
/** Let this much time pass, a frame at a time. */
const run = (ms: number): void => {
  for (let passed = 0; passed < ms; passed += FRAME) {
    clock += FRAME;
    const due = frames;
    frames = [];
    for (const frame of due) frame(clock);
  }
};

beforeEach(() => {
  clock = 1000;
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (frame: (now: number) => void) => frames.push(frame));
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** All the player asks of a character: her rest pose, the pose she is on, and to be shown another. */
const standIn = (): Character => {
  const her = { rest: 'film', current: 'film', show: (pose: string) => void (her.current = pose), dissolve: (_from: string, pose: string) => void (her.current = pose) };
  return her as unknown as Character;
};
const REACTION: Step[] = [
  { pose: 'turn', ms: 90 },
  { pose: 'look', ms: 1000, gesture: true },
  { pose: 'turn', ms: 90 },
  { pose: 'film', ms: 500 },
];
/** A routine that leaves the rest pose: a swing of 300 ms, then the rest pose for 300 ms, and round again. */
function* swinging(): Generator<Step, never, 'react' | undefined> {
  for (;;) {
    yield { pose: 'swing', ms: 300 };
    yield { pose: 'film', ms: 300 };
  }
}

describe('a second find while she is reacting (prolong)', () => {
  it('holds the gesture afresh from the second find, without starting the reaction again', async () => {
    const her = standIn();
    const player = new Player(her, holdSchedule('film') as Schedule);
    const poses: string[] = [];
    player.onPose = (pose) => poses.push(pose);
    player.start();
    run(100);
    let done = false;
    void player.react(REACTION).then(() => (done = true));
    expect(her.current).toBe('turn');
    run(90 + 600);
    expect(her.current).toBe('look');
    const before = poses.length;
    expect(player.prolong()).toBe(true);
    // Without the second find the look would have ended 400 ms from here.
    run(900);
    expect(her.current).toBe('look');
    expect(poses.length).toBe(before);
    // A whole hold from the second find, then the way back as written.
    run(160);
    expect(her.current).toBe('turn');
    run(100);
    expect(her.current).toBe('film');
    expect(player.reacting).toBe(true);
    run(520);
    await Promise.resolve();
    expect(done).toBe(true);
    expect(player.reacting).toBe(false);
    // Once only: the turn was not played again.
    expect(poses.filter((pose) => pose === 'look').length).toBe(1);
    expect(poses.filter((pose) => pose === 'turn').length).toBe(2);
  });

  it('before the gesture: the find is answered by the look that is coming, and nothing changes', () => {
    const her = standIn();
    const player = new Player(her, holdSchedule('film') as Schedule);
    player.start();
    run(50);
    void player.react(REACTION);
    run(32);
    expect(her.current).toBe('turn');
    expect(player.prolong()).toBe(true);
    // The turn takes its 90 ms all the same, and the look its 1000.
    run(64);
    expect(her.current).toBe('look');
    run(960);
    expect(her.current).toBe('look');
    run(64);
    expect(her.current).toBe('turn');
  });

  it('while the reaction waits for her to come home: true, and it does not start early', () => {
    const her = standIn();
    const player = new Player(her, swinging());
    player.start();
    run(48);
    expect(her.current).toBe('swing');
    void player.react(REACTION);
    expect(player.prolong()).toBe(true);
    run(100);
    expect(her.current).toBe('swing');
    // The swing lands, and the reaction takes the place of the rest hold.
    run(200);
    expect(her.current).toBe('turn');
  });

  it('on her way back, after the reaction, or with none: false, and nothing changes', async () => {
    const her = standIn();
    const player = new Player(her, holdSchedule('film') as Schedule);
    expect(player.prolong()).toBe(false);
    player.start();
    run(50);
    expect(player.prolong()).toBe(false);
    void player.react(REACTION);
    run(90 + 1000 + 32);
    expect(her.current).toBe('turn');
    expect(player.prolong()).toBe(false);
    run(96);
    expect(her.current).toBe('film');
    expect(player.prolong()).toBe(false);
    // (It ends when it would have.)
    run(480);
    await Promise.resolve();
    expect(player.reacting).toBe(false);
    expect(player.prolong()).toBe(false);
  });

  it('a reaction with no gesture marked is never held longer', () => {
    const her = standIn();
    const player = new Player(her, holdSchedule('film') as Schedule);
    player.start();
    run(50);
    void player.react(REACTION.map(({ gesture: _gesture, ...step }) => step));
    run(90 + 600);
    expect(her.current).toBe('look');
    expect(player.prolong()).toBe(false);
    run(420);
    expect(her.current).toBe('turn');
  });
});

describe('the hook for whatever keeps time with her (onFrame)', () => {
  it('is called once a frame while she runs, with the frame time, and not while she is stopped', () => {
    const player = new Player(standIn(), holdSchedule('film') as Schedule);
    const times: number[] = [];
    player.onFrame = (now) => times.push(now);
    run(100);
    expect(times).toEqual([]);
    player.start();
    run(10 * FRAME);
    expect(times.length).toBe(10);
    times.forEach((now, i) => expect(now).toBe(times[0] + i * FRAME));
    player.stop();
    run(200);
    expect(times.length).toBe(10);
    // start() carries on, still once a frame, through a reaction as well.
    player.start();
    void player.react(REACTION);
    run(20 * FRAME);
    expect(times.length).toBe(30);
  });
});

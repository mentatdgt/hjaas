// A blink that keeps clear of another actor (clips.ts, Avoid): the café's Rachel does not blink while the mum
// sips (reviews/cafe-round10-build.md, section 2). Played on one clock with stage-sim.ts, as the players play it.
import { describe, expect, it } from 'vitest';
import framesJson from '../../public/assets/scene3/cast/frames.json';
import routineJson from '../../public/assets/scene3/cast/routine.json';
import { splitCast, type CastFrames, type CastRoutines } from './cast';
import { checkClips, clipSchedule, type ClipFrames, type ClipRoutine, type Planned } from './clips';
import { runsOf, simulate, type Shown, type SimActor } from './stage-sim';
import { seeded } from './steps';

const frames = framesJson as unknown as CastFrames;
const routines = routineJson as unknown as CastRoutines;
const { actors, problems } = splitCast(frames, routines, 1672);
const actor = (name: string) => actors.find((a) => a.name === name)!;
const SIP = ['M_S1', 'M_S2'];
const BLINK = 'R_A1_blink';
const MARGIN = 1000;
/** Rachel's routine as it was before the rule: the same, without `avoid`. */
const without = (routine: ClipRoutine): ClipRoutine => {
  const { avoid: _, ...blink } = routine.blink as { avoid?: unknown };
  return { ...routine, blink: blink as ClipRoutine['blink'] };
};

/** Rachel and the mum for `minutes`, the mum's first move put off as the scene staggers her (0-0.9 s). */
const cafe = (seed: number, minutes: number, rule = true): { rachel: Shown[]; mum: Shown[] } => {
  const rnd = seeded(seed);
  const rachel = actor('rachel');
  const cast: SimActor[] = [
    { name: 'rachel', frames: rachel.frames, routine: rule ? rachel.routine : without(rachel.routine) },
    { name: 'mum', frames: actor('mum').frames, routine: actor('mum').routine, delay: rnd() * 900 },
  ];
  const shown = simulate(cast, minutes * 60_000, rnd);
  return { rachel: shown.get('rachel')!, mum: shown.get('mum')! };
};

/** Rachel's blinks that come during a sip, or within the margin of one. */
const clashes = (rachel: Shown[], mum: Shown[], margin = MARGIN): number => {
  const sips = runsOf(mum, SIP);
  return runsOf(rachel, [BLINK]).filter(([a, b]) => sips.some(([s, e]) => a < e + margin && b > s - margin)).length;
};

describe("the café's package says it", () => {
  it('on Rachel\'s blink, for the mum\'s sip, with a margin of 1 s; and it can be played', () => {
    expect(problems).toEqual([]);
    expect((actor('rachel').routine.blink as { avoid?: unknown }).avoid).toEqual({ actor: 'mum', stills: ['M_S1', 'M_S2'], margin_ms: 1000 });
    // Nobody else's routine has one.
    for (const a of actors) if (a.name !== 'rachel') expect(JSON.stringify(a.routine.blink ?? {})).not.toContain('avoid');
  });
});

describe('Rachel does not blink while the mum sips', () => {
  it('never during a sip or within 1 s of one, over 30 minutes of play, from several starts', () => {
    let blinks = 0;
    let sips = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const { rachel, mum } = cafe(seed, 30);
      expect(clashes(rachel, mum), `seed ${seed}`).toBe(0);
      blinks += runsOf(rachel, [BLINK]).length;
      sips += runsOf(mum, SIP).length;
    }
    expect(sips).toBeGreaterThan(400);
    expect(blinks).toBeGreaterThan(1500);
  });

  it('also when the mum starts late (her drawings came after Rachel\'s): her waiting routine is read too', () => {
    let sips = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const rnd = seeded(500 + seed);
      const rachel = actor('rachel');
      const shown = simulate(
        [
          { name: 'rachel', frames: rachel.frames, routine: rachel.routine },
          { name: 'mum', frames: actor('mum').frames, routine: actor('mum').routine, late: 500 + rnd() * 20_000 },
        ],
        60_000,
        rnd,
      );
      expect(clashes(shown.get('rachel')!, shown.get('mum')!), `seed ${seed}`).toBe(0);
      sips += runsOf(shown.get('mum')!, SIP).length;
    }
    expect(sips).toBeGreaterThan(80);
  });

  it('which without the rule she would (the check can fail)', () => {
    const { rachel, mum } = cafe(1, 30, false);
    expect(clashes(rachel, mum)).toBeGreaterThan(20);
  });

  it('blinks as often as before away from the sip: her rhythm is the same, only a blink due by a sip waits for it', () => {
    /** The gaps between her blinks, from blink to blink, that do not reach into a sip or its margins. */
    const gaps = (rule: boolean): number[] => {
      const all: number[] = [];
      for (let seed = 1; seed <= 6; seed++) {
        const { rachel, mum } = cafe(seed, 30, rule);
        const sips = runsOf(mum, SIP);
        const blinks = runsOf(rachel, [BLINK]);
        for (let i = 1; i < blinks.length; i++) {
          const [a, b] = [blinks[i - 1][0], blinks[i][0]];
          if (!sips.some(([s, e]) => a < e + MARGIN && b > s - MARGIN)) all.push(b - a);
        }
      }
      return all;
    };
    const mean = (xs: number[]): number => xs.reduce((sum, x) => sum + x, 0) / xs.length;
    const [rule, before] = [gaps(true), gaps(false)];
    expect(rule.length).toBeGreaterThan(800);
    expect(Math.abs(mean(rule) / mean(before) - 1)).toBeLessThan(0.03);
    // And over all: a little fewer, by the waits (each sip takes about 4 s out of her 22).
    let [n, m] = [0, 0];
    for (let seed = 1; seed <= 6; seed++) {
      n += runsOf(cafe(seed, 30).rachel, [BLINK]).length;
      m += runsOf(cafe(seed, 30, false).rachel, [BLINK]).length;
    }
    expect(n / m).toBeGreaterThan(0.85);
    expect(n / m).toBeLessThan(1);
  });

  it('keeps every other rule of her blink: in the middle of a sketch hold, never on the frames beside the coffee', () => {
    const { rachel } = cafe(4, 30);
    rachel.forEach((step, i) => {
      if (step.pose !== BLINK) return;
      expect(rachel[i - 1].pose).toBe('R_A1_sketch');
      expect(rachel[i + 1]?.pose ?? 'R_A1_sketch').toBe('R_A1_sketch');
      expect(step.ms).toBe(90);
    });
  });

  it('plays her poses for the same times: only where her blinks fall moves', () => {
    // Joined back up, her holds are the routine's, whatever the rule did with the blinks.
    const { rachel } = cafe(2, 10);
    const joined: Array<{ pose: string; ms: number }> = [];
    for (const step of rachel) {
      const pose = step.pose === BLINK ? 'R_A1_sketch' : step.pose;
      const last = joined[joined.length - 1];
      if (last && last.pose === pose && (step.pose === BLINK || rachel[rachel.indexOf(step) - 1]?.pose === BLINK)) last.ms += step.ms;
      else joined.push({ pose, ms: step.ms });
    }
    for (const hold of joined) {
      if (hold.pose === 'R_A2_stroke') {
        expect(hold.ms).toBeGreaterThanOrEqual(600);
        expect(hold.ms).toBeLessThanOrEqual(900);
      }
    }
  });
});

// A made-up pair, to see the wait itself: she holds one still for 1 s at a time and blinks every 3 s; the
// other sips for 10 s, after 2 s, again and again.
const own = (stills: string[]): ClipFrames => ({ canvas: { w: 10, h: 10, plate_x: 0, plate_y: 0, plate_w: 10, plate_h: 10 }, stills: Object.fromEntries(stills.map((s) => [s, `${s}.png`])), clips: {} });
const her: SimActor = {
  name: 'her',
  frames: own(['A', 'A_blink']),
  routine: { routine: [{ still: 'A', ms: 1000, blink_ok: true }], blink: { on: 'A', frames: [{ still: 'A_blink', ms: 90 }], every_ms: 3000, avoid: { actor: 'other', stills: ['S'], margin_ms: 500 } } } as unknown as ClipRoutine,
};
const other: SimActor = { name: 'other', frames: own(['S']), routine: { routine: [{ still: null, ms: 2000 }, { still: 'S', ms: 10_000 }] } };

describe('a blink that waits (made up)', () => {
  it('is postponed, not dropped: it comes in the first hold after the margin has passed, as soon as it is clear', () => {
    const shown = simulate([her, other], 120_000, seeded(9));
    const blinks = runsOf(shown.get('her')!, ['A_blink']);
    const sips = runsOf(shown.get('other')!, ['S']);
    expect(sips.length).toBeGreaterThan(8);
    for (const [s, e] of sips) {
      // None in the way.
      expect(blinks.filter(([a, b]) => a < e + 500 && b > s - 500)).toEqual([]);
      // Each 12 s pass leaves 2 s clear, minus the margins: 1 s. One blink is waiting by then (every 3 s): it
      // comes at the first moment she may blink after the margin, in that 1 s.
      const after = blinks.find(([a]) => a >= e + 500);
      if (!after || after[0] > 118_000) continue;
      expect(after[0]).toBeLessThan(e + 500 + 1000);
    }
  });

  it('is checked again as it is shown: if the other actor has started meanwhile and is in the way, it waits', () => {
    // Nobody is known when her hold begins and its blink is decided; by the blink, the other is sipping.
    let known = false;
    const sipping: Planned = { busy: (_stills, from, to) => (from < 5000 && to > -5000 ? [[-5000, 5000]] : []) };
    const stage = { since: () => 0, other: () => (known ? sipping : null) };
    const routine = { ...her.routine, blink: { ...(her.routine.blink as object), every_ms: 1 } } as unknown as ClipRoutine;
    const schedule = clipSchedule(her.frames, routine, seeded(4), () => true, stage);
    const first = schedule.next().value;
    expect(first.pose).toBe('A');
    known = true;
    const rest = [schedule.next().value, schedule.next().value];
    // The blink's place is held on her pose: the hold is all hers, its parts adding up to its length.
    expect(rest.map((step) => step.pose)).toEqual(['A', 'A']);
    expect(first.ms + rest[0].ms + rest[1].ms).toBeCloseTo(1000);
    expect(rest[0].ms).toBe(90);
    // And once it is clear, the blink comes, at the first chance.
    known = false;
    let blinked = false;
    for (let i = 0; i < 6 && !blinked; i++) blinked = schedule.next().value.pose === 'A_blink';
    expect(blinked).toBe(true);
  });

  it('is ignored without a stage, or while the other actor is not playing a routine', () => {
    const free = simulate([her, other], 60_000, seeded(9), { stage: false });
    const blinks = runsOf(free.get('her')!, ['A_blink']);
    const sips = runsOf(free.get('other')!, ['S']);
    expect(blinks.filter(([a, b]) => sips.some(([s, e]) => a < e && b > s)).length).toBeGreaterThan(5);
    // Alone (the other's layer did not come): she blinks every 3 s or so.
    const alone = simulate([her], 60_000, seeded(9));
    expect(runsOf(alone.get('her')!, ['A_blink']).length).toBeGreaterThan(15);
  });

  it('leaves a routine without it exactly as it was, stage or none', () => {
    const { frames: f, routine } = actor('oldman');
    const a = clipSchedule(f, routine, seeded(3));
    const b = clipSchedule(f, routine, seeded(3), () => true, { since: () => 0, other: () => null });
    for (let i = 0; i < 500; i++) expect(b.next().value).toEqual(a.next().value);
  });
});

describe('what is wrong with an avoid, in words', () => {
  it('in the routine itself', () => {
    const routine = (avoid: unknown) => ({ routine: [{ still: 'A', ms: 1000 }], blink: { on: 'A', frames: [{ still: 'A_blink', ms: 90 }], every_ms: 3000, avoid } }) as unknown as ClipRoutine;
    expect(checkClips(own(['A', 'A_blink']), routine({ actor: 'mum', stills: ['M_S1'], margin_ms: 1000 }))).toEqual([]);
    expect(checkClips(own(['A', 'A_blink']), routine({ actor: 'mum', stills: [] })).join(' ')).toContain('"blink.avoid"');
    expect(checkClips(own(['A', 'A_blink']), routine({ actor: 'mum', stills: ['M_S1'], margin_ms: -1 })).join(' ')).toContain('margin_ms');
  });

  it('in the cast: an actor who is not there, or a still she does not have', () => {
    const r = (avoid: unknown): CastRoutines => {
      const rachel = { ...(routines.actors.rachel as ClipRoutine), blink: { ...((routines.actors.rachel as ClipRoutine).blink as object), avoid } };
      return { actors: { ...routines.actors, rachel } } as unknown as CastRoutines;
    };
    expect(splitCast(frames, r({ actor: 'waiter', stills: ['M_S1'] }), 1672).problems.join(' ')).toContain('"waiter"');
    expect(splitCast(frames, r({ actor: 'mum', stills: ['M_S9'] }), 1672).problems.join(' ')).toContain('"M_S9"');
  });
});

// The same with the real players, on a clock moved a frame at a time (as player.test.ts does), the way scene.ts
// wires them: Rachel's routine sees the mum through her player. The mum holds still until her drawings are in
// (a hold schedule), then her routine is set waiting, as stock() does. Now and then a frame is late.
describe('with the players', () => {
  it('keeps the rule on the screen: also when the mum starts late, and through late frames', async () => {
    const { Player } = await import('./player');
    const { holdSchedule } = await import('./steps');
    const { vi } = await import('vitest');
    let clock = 0;
    let queue: Array<(now: number) => void> = [];
    vi.stubGlobal('requestAnimationFrame', (frame: (now: number) => void) => queue.push(frame));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const spy = vi.spyOn(performance, 'now').mockImplementation(() => clock);
    try {
      let clashed = 0;
      let unknowable = 0;
      let stalled = 0;
      let sips = 0;
      let blinks = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const rnd = seeded(900 + seed);
        clock = 0;
        queue = [];
        const standIn = (rest: string) => {
          const her = { rest, current: rest, show: (pose: string) => void (her.current = pose), dissolve: (_f: string, pose: string) => void (her.current = pose) };
          return her as unknown as import('./character').Character;
        };
        const shown: Record<string, Shown[]> = { rachel: [], mum: [] };
        const players: Record<string, InstanceType<typeof Player>> = {};
        const stage = (name: string) => ({
          since: () => players[name].since,
          other: (who: string) => (who === name ? null : players[who]?.planned() ?? null),
        });
        const rachel = actor('rachel');
        const mum = actor('mum');
        players.rachel = new Player(standIn('R_A1_sketch'), clipSchedule(rachel.frames, rachel.routine, rnd, () => true, stage('rachel')));
        players.mum = new Player(standIn(''), holdSchedule(''));
        for (const name of ['rachel', 'mum']) players[name].onPose = (pose, at) => {
          const list = shown[name];
          if (list.length) list[list.length - 1].ms = at - list[list.length - 1].at;
          list.push({ pose, at, ms: 0 });
        };
        players.mum.delay(rnd() * 900);
        players.rachel.start();
        players.mum.start();
        const late = 500 + rnd() * 20_000;
        let switched = false;
        const stalls: number[] = [];
        while (clock < 10 * 60_000) {
          const stall = rnd() < 0.002;
          clock += stall ? 120 + rnd() * 300 : 16.7;
          if (stall) stalls.push(clock);
          if (!switched && clock >= late) {
            switched = true;
            players.mum.setLoop(clipSchedule(mum.frames, mum.routine, rnd, () => true, stage('mum')));
          }
          const due = queue;
          queue = [];
          for (const frame of due) frame(clock);
        }
        for (const list of Object.values(shown)) list.pop();
        // What no schedule can help, set aside by name: a blink shown before the mum's routine existed (her
        // drawings came after it), and a gap that a late frame made shorter on the screen than in the plan.
        const sp = runsOf(shown.mum, SIP);
        for (const [a, b] of runsOf(shown.rachel, [BLINK])) {
          const hit = sp.find(([x, y]) => a < y + MARGIN && b > x - MARGIN);
          if (!hit) continue;
          const [from, to] = hit[1] <= a ? [hit[1], a] : [b, hit[0]];
          if (a < late) unknowable++;
          else if (stalls.some((t) => t >= from - 20 && t <= to + 20)) stalled++;
          else clashed++;
        }
        sips += runsOf(shown.mum, SIP).length;
        blinks += runsOf(shown.rachel, [BLINK]).length;
      }
      expect(sips).toBeGreaterThan(250);
      expect(blinks).toBeGreaterThan(800);
      expect(clashed).toBe(0);
      // (Each a few in two hours of play, with a late mum in every run and a frame of 120-420 ms every 8 s or so.)
      expect(unknowable).toBeLessThanOrEqual(4);
      expect(stalled).toBeLessThanOrEqual(6);
    } finally {
      spy.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});

describe("a player's plan", () => {
  it('of a routine waiting to start: it begins as the step on show ends; of one playing: from where its step began', async () => {
    const { Player } = await import('./player');
    const { holdSchedule } = await import('./steps');
    const { vi } = await import('vitest');
    let clock = 0;
    let queue: Array<(now: number) => void> = [];
    vi.stubGlobal('requestAnimationFrame', (frame: (now: number) => void) => queue.push(frame));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const spy = vi.spyOn(performance, 'now').mockImplementation(() => clock);
    const tick = (ms: number) => {
      for (let t = 0; t < ms; t += 10) {
        clock += 10;
        const due = queue;
        queue = [];
        for (const frame of due) frame(clock);
      }
    };
    try {
      const her = { rest: '', current: '', show: (pose: string) => void (her.current = pose), dissolve: () => {} };
      const player = new Player(her as unknown as import('./character').Character, holdSchedule(''));
      player.start();
      tick(50);
      // Held still: nobody knows.
      expect(player.planned()).toBeNull();
      const mum = actor('mum');
      player.setLoop(clipSchedule(mum.frames, mum.routine, seeded(1)));
      // Waiting: the hold has 150 ms left, then 50 ms of nothing, then M_S1 for 220 ms.
      expect(player.planned()!.busy(['M_S1'], 0, 1000)).toEqual([[200, 420]]);
      tick(250);
      // Playing, 50 ms into M_S1.
      expect(player.since).toBe(50);
      expect(player.planned()!.busy(['M_S1'], -1000, 300)).toEqual([[-50, 170]]);
    } finally {
      spy.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});

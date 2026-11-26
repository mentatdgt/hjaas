// A blink that keeps clear of another actor (clips.ts, Avoid): the café's Rachel does not blink while the mum
// sips (reviews/cafe-round10-build.md, section 2). Played on one clock with stage-sim.ts, as the players play it.
import { describe, expect, it } from 'vitest';
import framesJson from '../../public/assets/scene3/cast/frames.json';
import routineJson from '../../public/assets/scene3/cast/routine.json';
import { splitCast, type CastFrames, type CastRoutines } from './cast';
import { checkClips, clipSchedule, type ClipFrames, type ClipRoutine } from './clips';
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

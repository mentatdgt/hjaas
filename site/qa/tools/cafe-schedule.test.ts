// Job 023b, the brief's schedule check (reviews/cafe-round10-build.md): the engine's own schedules (splitCast,
// clipSchedule) for Rachel and the mum on one clock (src/engine/stage-sim.ts), 30 minutes of play from each of 20
// starts, the mum staggered 0-0.9 s as on the page. With the rule (the package as built) and before it (the same
// routine without "avoid"). Writes qa/cafe-round10/schedule.json. Skipped by `npm test`; run it with
//
//   HJ_SCHEDULE=1 npx vitest run qa/tools/cafe-schedule.test.ts
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import framesJson from '../../public/assets/scene3/cast/frames.json';
import routineJson from '../../public/assets/scene3/cast/routine.json';
import { splitCast, type CastFrames, type CastRoutines } from '../../src/engine/cast';
import type { ClipRoutine } from '../../src/engine/clips';
import { runsOf, simulate } from '../../src/engine/stage-sim';
import { seeded } from '../../src/engine/steps';

const { actors } = splitCast(framesJson as unknown as CastFrames, routineJson as unknown as CastRoutines, 1672);
const actor = (name: string) => actors.find((a) => a.name === name)!;
const MINUTES = 30;
const STARTS = 20;
const MARGIN = 1000;

describe.runIf(process.env.HJ_SCHEDULE)('the café schedule over 30 minutes', () => {
  it('Rachel never blinks during or within 1 s of the mum sip; her rate otherwise as before', () => {
    const result: Record<string, unknown> = { minutes: MINUTES, starts: STARTS, margin_ms: MARGIN };
    for (const rule of [true, false]) {
      let blinks = 0;
      let sips = 0;
      let during = 0;
      let within = 0;
      let longest = 0;
      const away: number[] = [];
      for (let seed = 1; seed <= STARTS; seed++) {
        const rnd = seeded(1000 + seed);
        const rachel = actor('rachel');
        const { avoid: _, ...plain } = rachel.routine.blink as { avoid?: unknown };
        const shown = simulate(
          [
            { name: 'rachel', frames: rachel.frames, routine: rule ? rachel.routine : ({ ...rachel.routine, blink: plain } as ClipRoutine) },
            { name: 'mum', frames: actor('mum').frames, routine: actor('mum').routine, delay: rnd() * 900 },
          ],
          MINUTES * 60_000,
          rnd,
        );
        const s = runsOf(shown.get('mum')!, ['M_S1', 'M_S2']);
        const b = runsOf(shown.get('rachel')!, ['R_A1_blink']);
        sips += s.length;
        blinks += b.length;
        for (const [a, e] of b) {
          if (s.some(([x, y]) => a < y && e > x)) during++;
          else if (s.some(([x, y]) => a < y + MARGIN && e > x - MARGIN)) within++;
        }
        for (let i = 1; i < b.length; i++) {
          const gap = b[i][0] - b[i - 1][0];
          longest = Math.max(longest, gap);
          if (!s.some(([x, y]) => b[i - 1][0] < y + MARGIN && b[i][0] > x - MARGIN)) away.push(gap);
        }
      }
      const mean = away.reduce((sum, x) => sum + x, 0) / away.length;
      result[rule ? 'with_rule' : 'before'] = {
        sips,
        blinks,
        blinks_per_minute: Math.round((blinks / (MINUTES * STARTS)) * 100) / 100,
        blinks_during_a_sip: during,
        blinks_within_1s_of_a_sip: within,
        mean_gap_between_blinks_away_from_sips_ms: Math.round(mean),
        gaps_away_from_sips: away.length,
        longest_gap_ms: Math.round(longest),
      };
    }
    const w = result.with_rule as Record<string, number>;
    const b = result.before as Record<string, number>;
    result.blink_rate_change = `${Math.round((w.blinks / b.blinks - 1) * 1000) / 10}% overall; ${Math.round((w.mean_gap_between_blinks_away_from_sips_ms / b.mean_gap_between_blinks_away_from_sips_ms - 1) * 1000) / 10}% in the mean gap away from sips`;
    writeFileSync(new URL('../cafe-round10/schedule.json', import.meta.url), `${JSON.stringify(result, null, 1)}\n`);
    console.log(JSON.stringify(result, null, 1));
    expect(w.blinks_during_a_sip + w.blinks_within_1s_of_a_sip).toBe(0);
  });
});

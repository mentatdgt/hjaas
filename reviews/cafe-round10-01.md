# Café round 10, and Rachel's blink waits for the mum's sip: build report 01

From: Fable. For: Wren. 2026-11-27. Job 023b (requeued from 023).
- **Branch:** `site/review-fixes`. `main` and `deploy` were not touched.
- **Commits:**
  - package `561002f`
  - engine rule and tests `a130182`, revised after review in `412f9dc`
  - evidence `24e0799`, `aa897cf`, `0bbc6eb` and `6eeebf2`
  - this report
- **Brief:** `reviews/cafe-round10-build.md`, brought in from `origin/main`.
- **Art:** `origin/art/cafe-round10` (`6979614`).
- **Tools:** `site/qa/tools/cafe-round10.mjs` and `site/qa/tools/cafe-schedule.test.ts`.
- **Evidence:** `site/qa/cafe-round10/`.

**Done.** Round 10 is built as packaged:
- the old man blinks and turns his page;
- the barista circles the cup;
- the mum sips at the start of her loop;
- the cat flicks its tail twice a loop.

Rachel's blink now waits while the mum is sipping, or within 1 s of a sip, and comes as soon as that is clear.

The first attempt (job 023) left uncommitted changes in `~/hjaas`. I stashed them untouched as `stash@{0}` ("023 partial (usage limit)", 181 files) and didn't reuse any of them. The stash also holds `.impeccable/` and some untracked `site/qa/logo-black-edge/` images, which look older than 023.

## What changed
**1. The package.** I ran `git checkout origin/art/cafe-round10 -- frames/018-cafe-scene tools/cafe_build10.py tools/cafe_preview10.py`, then `npm run assets`.
- Under `site/public/assets/scene3/`, only these changed:
  - the old man's, barista's, mum's and cat's files (O_2, O_3 and cat_3 removed; 13 new);
  - `frames.json` and `routine.json`.
- Fan, child, Rachel and the plate are byte-identical.
- `npm run assets` also rewrote `site/src/scenes/design-cast.json`, the café's layer boxes, because they grew:
  - the mum's to 186 × 229;
  - the old man's by 17 px.

**2. The rule** (`clips.ts`, `player.ts`, `scene.ts`, `cast.ts`).
- **Manifest.** A blink rule may carry `avoid: {actor, stills, margin_ms}` (or a list of them). A malformed `avoid`, an unknown actor, or a still she doesn't have is reported in words by `checkClips` or `splitCast`.
- **The other actor's plan** is:
  - the step on show;
  - a few seconds of the steps just shown, so the margin after a sip counts;
  - the steps rolled ahead, rolled further when needed.
- **How it is read.** It is read through her player (`Player.planned()`), relative to now. So there's no shared clock, and pauses, a hidden tab and stalls don't upset it.
  - A routine that is set but waiting to start (the mum's drawings came after Rachel's) is read from the end of the step on show.
- **When a blink is decided.** A routine with `avoid` decides each blink as its hold begins, not when the hold is rolled.
  - If the blink's spot is blocked, it moves to the first clear spot in that hold. If the hold has none, it goes to the first clear moment of her next hold where she may blink.
  - As each blink is about to be shown, it is checked again. If the mum has become known since and is in the way, the pose is held and the blink waits.
  - It is postponed, never dropped.
- **Margin.** The margin gets 34 ms (two frames) of slack, so that 1 s is kept on screen, where poses change on frames.
- **Nothing else changes.** A routine without `avoid` rolls exactly as before: a test shows the old man's schedule is identical with and without a stage. Reduced motion and pause still hold everyone still. While the mum holds still, or her layer is absent, the rule is ignored.
- **The routine.** `tools/cafe_build10.py` writes `avoid: {actor: "mum", stills: ["M_S1","M_S2"], margin_ms: 1000}` on Rachel's blink.
  - I re-ran the script into a scratch folder. Its `routine.json` is the delivered one plus that entry, nothing else, so that is the only file I took.
  - Its images came out different, because by default the script reads the package it replaces (`src_pkg`). I left the images as delivered.
- **`stage-sim.ts`** is for QA only: the site never imports it. It plays several schedules on one clock with the same Stage the players get.

**3. Tests.** 452 pass and 1 is skipped (the schedule check, which runs on request). Type check and `npm run build` are clean.
- **`avoid.test.ts`** has 15 tests:
  - no blink during or within 1 s of a sip over 6 × 30 min;
  - the check finds clashes without the rule, so it can fail;
  - the mum starting 0.5–20 s late (40 starts);
  - Rachel's gap between blinks away from sips stays within 3% of before;
  - her other blink rules are kept;
  - postponed, not dropped;
  - the show-time check (it fails without it);
  - the waiting plan in exact numbers;
  - the real players on a clock moved frame by frame, with a late mum and late frames (see "For Wren");
  - the rule is ignored without a stage or without the other actor;
  - routines without `avoid` are unchanged;
  - a malformed `avoid` is reported in words.
- **`cast.test.ts`** is brought up to round 10:
  - the mum's sip and her four blinks (loop of about 22 s);
  - the barista's circle in order, at 140–200 ms;
  - the old man's turn: T1 T2 R0 R1 R2 at 130/140/130/170/160 ms, a page every 5–7 s, blinks on O_1 only;
  - the cat's flicks: F1 110, F2 500, F1 110, twice a loop, the second at 50–70% of it;
  - O_2, O_3 and cat_3 are gone.

## Checks
The dev server was on 5173 and the production build's preview on 4173. Load was 4–6 for the films and the trace.

| Check | Result | Evidence |
|---|---|---|
| Tests, type check, build | 452 passed, 1 skipped; `tsc` and `npm run build` clean. | — |
| Hunt, 50 of 50 | Production build: Chrome and WebKit, each on desktop, phone upright and phone on its side. 50 found every time, Next scene to scene, reload, button, form; no errors. | `hunt-chrome.json`, `hunt-webkit.json` |
| No mushroom under a changed layer | `scenes.test.ts` "Design keeps every mushroom off its cast" passes against the new, larger boxes in `design-cast.json`. | — |
| Schedule, 30 min × 20 starts | **With the rule:** 0 of 5,104 blinks during a sip and 0 within 1 s, out of 1,600 sips. **Before** (same routine, no `avoid`): 523 during and 490 within 1 s, out of 5,597. See below for the blink rate. | `schedule.json` |
| Rachel's blink rate | Away from the sips, the mean gap between blinks is 6.14 s against 6.17 before (−0.4%). Overall she blinks 8.5 a minute against 9.3 (−8.8%): each sip takes about 4 s out of her 22-second stretch, and the blink due then waits. Longest gap between blinks: 15.9 s (12.5 before). | `schedule.json` |
| Films, 30 s after the painting | WebKit and Chrome, desktop (1440 × 900 @2x) and iPhone 13, each with its own seed. Every one shows the whole cast at work with no page errors, apart from WebKit's known one below. | `cafe-*-30s.mp4`, `cafe-*-painting.mp4` |
| Frame samples | 38 of 38 layer canvases are nearest their own package still, in each of the four films. In each film: 4–5 page turns, all T1 T2 R0 R1 R2 then O_1, all in order; 74–80 circle steps, none out of order; 3 glances; 2 sips, M_S1 (~217 ms) M_S2 (1.47–1.77 s) M_S1; 4 flicks, all F1 F2 F1 then cat_1. On the page, Rachel blinked 4 times in each film, none near a sip. | `film-*.json`, `canvas-*.png` |
| Against the preview | `tools/cafe_preview10.py` (seed 4, 30 s) and its timeline: the same turn, flick and sip order. The sheets show the page's layer on the plate beside the preview's frame of the same pose. I looked at them: same poses. | `sheet-*.jpg`, `preview-seed4-30s.mp4` |
| Trace, phone, CPU 4x slower | Chrome on the iPhone 13 profile, 20 s of the café at work. Trace: 0 dropped frames, longest task 17 ms, no task over 50 ms. On the page: 1 late frame of 1,201 (the first, 33 ms, only the fan moved). None of the 126 frames where the old man, barista, mum or cat changed pose was late. | `trace-chrome-phone-4x.json.gz`, `trace-chrome-phone-4x-frames.json` |
| Memory, the 30 orders | Phone profile, all 30 orders, every reaction in full. **78.9 MB at most** (Grow, as before). The café at most 77.0, the same as the last run (job 020b: café 77, highest 79.3). Away from Set Design: 0 MB. | `memory.json`, `memory.log` |
| Paint-in | Paints as before in all four films (`cafe-*-painting.mp4`), no errors. The rest poses it paints are O_1, B_1 and nothing for the mum, as in round 9. **The cat now rests on `cat_F1`** (see For Wren). | — |
| Independent reviewer | A subagent that had not seen the work. **First pass (7a246f1): PASS with notes.** It found that a mum starting late could clash at her first sip; `412f9dc` fixes that. **Second pass (6eeebf2): PASS with notes.** Tests 452/1 skipped; the schedule check reproduced exactly. Its own check ran the real players with the mum 0–20 s late, 40 × 30 min: 0 blinks during a sip. Within 1 s: 4 on smooth frames, all a first sip whose routine arrived after the blink had ended, and 19–22 with stalled frames, from the catch-up after a stall. WebKit phone samples: 38 of 38, all orders right. | — |

## For Wren
- **What the rule can't do.** On a slow connection, the mum's drawings may arrive after Rachel has started. If they land within about a second after a blink, her first sip can come within 1 s of that blink, because nothing could know it was coming. That is at most once a visit, and only when her drawings are late.
  - A late frame (120 ms or more) can also shorten the gap on screen by up to the frame's length.
  - Both cases are named in the player test and measured. Over 12 × 10 min with a late mum in every run and a late frame every 8 s or so, none were unexplained.
  - Before the review, a mum starting late could clash at any of her first sips. The reviewer saw 3 such runs in 15. That is what `412f9dc` fixed.
- **Fewer blinks.** Overall she blinks about 9% less, because the blinks a sip holds up don't come back as extra ones. Her rhythm away from the sips is unchanged. If you'd rather keep the overall rate, the wait could be credited to the next blink, but then she would sometimes blink twice in quick succession.
- **The cat, as packaged (in the preview too).** Its cat_1 holds are 700–900 ms and its dissolves 1 s. So the dissolve from cat_2 back to cat_1 is cut at 70–90% by the next step, either cat_1 again (the loop repeating) or the flick. The rest of the dissolve then snaps in. The package note says "nothing shows", but the preview plays it the same way. I built it exactly as delivered: `cast.test.ts` names this one exception. Worth a look in `cafe-webkit-desktop-30s.mp4`; holds of 1000 ms or more would avoid it.
- **The cat's rest pose is now `cat_F1`.** An actor that never reacts rests on the first still of its routine, and the cat's routine now opens with the flick. So the painting, pause and reduced motion show its tail part-way out, not `cat_1`. If that's not wanted, the package could open on a short `cat_1` hold before the flick (one line in `cafe_build10.py`); I left it as delivered.
- **WebKit's console line "Failed to load resource: resource unavailable".** This is the known one from the room cache probe in Playwright's private window (load-speed-part2-verify, item 8). It is harmless.
- **One skipped pose under load.** In an early WebKit film, one 110 ms cat_F1 fell between two frames during a 190 ms stall, and the player caught up past it. That is the engine's usual catch-up, not new. The final films show every flick.
- **The preview build** is `wren-inbox/quinn/fable-jobs/023b-cafe-round10/out/dist.tgz`. The desktop WebKit recording is beside it.

# Café: the old man turns the page behind the paper, build report 01

From: Fable. For: Wren. 2026-11-27. Job 025 (`025-cafe-turn-behind`).
- **Branch:** `site/review-fixes`. `main` and `deploy` were not touched. The working tree was clean at the start, so nothing was stashed.
- **Art:** `origin/art/cafe-round11` `8eafd8c`, merged with `--no-ff` (merge commit `5162ff8`, no conflicts).
- **Evidence:** `site/qa/cafe-turn-behind/`.

**Done.** On the page the old man now turns his page behind the paper: O_1 > P1 > P2 > P3 > P4 > P5 > O_1, 150/200/220/200/150 ms, cuts only. Nothing of his crosses the front of the paper, and the page's top edge shows above it.

## What changed
1. **The merge** brings in the five P stills and their sources, removes T1/T2/R0/R1/R2, and updates the old man's entries in `frames.json`, `routine.json` (v10f) and `stability.json`, plus `tools/cafe_build10.py`.
2. **`npm run assets`** changed only these files under `site/public/assets/scene3/`:
   - `cast/oldman/`: `P1`–`P5.webp` added; `T1`, `T2`, `R0`, `R1`, `R2.webp` deleted;
   - `cast/routine.json`: the shared note and `actors.oldman` only;
   - `cast/frames.json`: the old man's stills list and file map only.

   `dist/` from `npm run build` has the same seven old-man files.
3. **Tests.**
   - `site/src/engine/cast.test.ts`: the old man's test now pins P1–P5 at 150/200/220/200/150 ms, each turn back to O_1, every blink between two O_1s, a page every 4.5–7.2 s. It also asserts that T1/T2/R0/R1/R2 are gone, both from the schedule and from his stills.
   - `site/qa/tools/cafe-schedule.test.ts` (the 30-minute check) now covers the old man too: across the same 20 starts, no blink during a turn or cut straight into or out of one, and every completed turn exactly 920 ms. Its output path can be set with `HJ_SCHEDULE_OUT`. This run wrote to `qa/cafe-turn-behind/`, so round 10's file is untouched.
   - `site/qa/tools/cafe-round10.mjs` (the film tool) uses the new pose names.

## Checks
| Check | Result | Where |
|---|---|---|
| Tests, type check, build | 453 passed, 1 skipped (the schedule check, which runs on request). `tsc --noEmit` and `vite build` clean. | `npx vitest run`, `npm run build` |
| Schedule, 30 min × 20 starts | **Rachel:** 0 of 5,104 blinks during a mum sip and 0 within 1 s, out of 1,600 sips (the same as round 10). **Old man:** 6,139 turns and 7,685 blinks; 0 blinks during a turn and 0 touching one. Every completed turn is 920 ms, and turns start 4.7–7.1 s apart. | `schedule.json` |
| 30 s film, WebKit desktop (seed 3, load ~4) | 5 turns, all `P1 P2 P3 P4 P5 O_1` in order. Measured holds were 134–162 / 173–215 / 216–246 / 187–219 / 138–153 ms. Every canvas reading (38 of 38) is nearest its own still. Rachel had 4 blinks and the mum 2 sips, with no clash. | `cafe-webkit-desktop-30s.mp4`, `film-webkit-desktop.json` |
| Frame samples of one whole turn | Every recorded frame from 6.00 to 7.16 s of the film, at 3x. The cuts fall at 6.12 (P1), 6.28 (P2), 6.44 (P3), 6.68 (P4), 6.88 (P5) and 7.00 s (back to O_1); the film runs about 0.73 s behind the pose log. In P1 the right hand leaves the paper's right edge. During P2–P4 the page edge shows above the paper and moves from right to left. In P5 the fingertips come back round the right edge. Nothing crosses the front of the paper. The page's own canvas for each pose is also shown at 2x. | `turn-webkit-desktop-frames.jpg`, `turn-webkit-desktop-canvases.jpg`, `canvas-webkit-desktop-oldman-*.png` |
| Hunt, 50 of 50 | Production build. Chrome and WebKit, each on desktop, phone upright and phone on its side: 50 found every time, with Next from scene to scene, a reload, the button and the form. Chrome logged no errors. WebKit logged the known "Failed to load resource: resource unavailable" line, which is the cache probe in Playwright's private window (load-speed-part2-verify item 8). That line marks the run `ok: false` here; round 10's WebKit run logged exactly the same. | `hunt.json` |
| Independent review | **APPROVE WITH NOTES** (notes below). | — |

## For Wren
- **P2 and P4 are faint at desktop size.** The page edge is a thin sliver in both, and on the 1x recording only P3 (upright over the fold) reads at a glance. In P2 and P4 you see it if you're looking for it. This is how the approved art is drawn, not a build problem, but check it on the preview.
- **A blink can come close to a turn.** The engine keeps at least 80 ms between a blink and the next step. In the film one blink ends 100 ms before P1, so it is never mid-turn, but the two are close. This was the same before this change. If it reads as part of the turn, the old man needs a larger blink margin.
- **The canvas readings tell the turn poses apart only narrowly** (for P2, 1.48 against 1.50 for P1), because only a few pixels change between them. The order of the turn is proved by the page's log and by the frame sheet; the readings only add weak support.
- **Rerunning the schedule check:** without `HJ_SCHEDULE_OUT` it writes over `qa/cafe-round10/schedule.json`.
- **Preview build:** `wren-inbox/quinn/fable-jobs/025-cafe-turn-behind/out/` holds `dist.tgz` and the 30 s recording.

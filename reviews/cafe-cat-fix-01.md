# Café cat fix: build report 01

From: Fable. For: Wren. 2026-11-27. Job 024 (`024-cafe-cat-fix`).
- **Branch:** `site/review-fixes`. `main` and `deploy` were not touched. The working tree was clean at the start, so nothing was stashed.
- **Commits:**
  - fix, tests and first evidence: `e7755bd`
  - QA tool fix after review, re-recorded evidence, and this report: the commit after it
- **Art:** `origin/art/cafe-round10` `b47801e` (only the edits were copied; the file was not checked out).
- **Tool:** `site/qa/tools/cafe-cat.mjs` (`rest`, `film`, `sheets`).
- **Evidence:** `site/qa/cafe-cat-fix/`.

**Done.** The cat now rests on `cat_1`, with its tail tucked in, during the paint-in, when paused and with reduced motion. Its dissolves back into `cat_1` now finish before the next step, so nothing snaps.

## What changed
1. **`tools/cafe_build10.py`** has the same two edits as `b47801e`, and the same note:
   - the routine opens with `{'still': 'cat_1', 'ms': [600, 900]}` before the first flick;
   - both `cat_1` steps in `breathe()` have `fade_ms: 600` (`cat_2` stays at 1000).

   Rachel's blink `avoid` entry (line 229) is unchanged. Diffed against the art branch, the file now differs only by the `avoid` block.
2. **The package.** I rebuilt it with `/usr/bin/python3 tools/cafe_build10.py /tmp/…` (without `-I`, since numpy is in the user site-packages).
   - Every PNG's pixels are identical to the committed ones.
   - The PNG bytes differ, because this machine's PIL and zlib encode differently. So I kept the committed PNGs and took only the new `routine.json`.
   - The rebuild also omits three stale tracked files (`cat_3`, `O_2`, `O_3`), but I left them as they were.
   - The cat's routine is now identical to the art branch's.
3. **`npm run assets`** changed only `site/public/assets/scene3/cast/routine.json`. It is byte-identical to the package's copy. All 57 tracked scene 3 images are unchanged.
4. **Tests** (`site/src/engine/cast.test.ts`):
   - New: the cat's `restOf` is `cat_1`. Its first step is `cat_1`, held 600–900 ms with no fade, and the first two poses are `cat_1`, `cat_F1` across 20 seeds.
   - Fade values pinned to 1000 now expect 1000 into `cat_2` and 600 into `cat_1`.
   - "Never outlasts the hold it opens" had an exemption for the cat breathing back to `cat_1`. I removed it: every actor's dissolves now have to fit their holds, checked over 5 seeds × 400 steps.

## Checks
| Check | Result | Where |
|---|---|---|
| Package and assets | Only `actors.cat` differs in `routine.json`, in both places. No PNG or WebP changed. Rachel's `avoid` is present. | `git diff 7001996 e7755bd --stat` |
| Rest pose, paint-in | 11 shots taken while the painting ran, every one `cat_1`. The canvas is nearest the `cat_1` still (1.94, against 4.69 for `cat_F1`). | `rest-painting-cat-mid.png`, `rest-painting-cat-late.png`, `rest-webkit.json` |
| Rest pose, paused | Pause was clicked while the cat showed `cat_F2`; it held `cat_1`. | `rest-paused-cat.png`, `rest-paused-page.png` |
| Rest pose, reduced motion | The cat stayed on `cat_1` for all 6 s. | `rest-reduced-motion-cat.png`, `rest-reduced-motion-page.png` |
| 30 s film, WebKit desktop (seed 3, load ~4) | 4 flicks, at 0.8, 10.8, 18.5 and 28.8 s, so two per loop. No pose out of order. 16 of 16 dissolves finished. Each `cat_1` dissolve settles 566–591 ms in, below the 700 ms minimum hold, including the two cut by a flick at 839 and 898 ms. Each `cat_2` dissolve settles at about 930 ms of its 1.4–1.8 s hold. | `cafe-cat-webkit-desktop-30s.mp4`, `film-webkit-desktop.json` |
| Frame samples | Two flicks (`sheet-flick-1.png`, `sheet-flick-2.png`) and two breaths back to `cat_1` (`sheet-breath-1.png`, `sheet-breath-2.png`), 40 ms apart. Each sheet is lined up to the pose log by finding the flicks in the recording (the recording runs about 0.55 s behind). | `site/qa/cafe-cat-fix/` |
| Tests | 453 passed, 1 skipped (the schedule check, which runs on request). | `npx vitest run` |
| Type check and build | `tsc --noEmit` is clean, and so is `npm run build`. | — |
| Schedule, 30 min × 20 starts | With the rule: 0 of 5,104 blinks during a sip and 0 within 1 s, out of 1,600 sips. `schedule.json` was rewritten byte-identical (the cat is not part of that simulation). | `site/qa/cafe-round10/schedule.json` |
| Independent reviewer | **PASS with notes**; nothing blocking. It re-ran the rest captures and got the same results. Tests 453/1 skipped, type check clean. Its main note is below; I've fixed it and re-recorded. | — |

**How "finished" is measured.** On every frame, the cat's canvas is projected onto the line from `cat_1` to `cat_2`. A plain `cat_1` reads as 0.028 and `cat_2` as 0.992, so those are the targets.

The reviewer found a flaw in the first version of this check. A `cat_1` hold followed by another `cat_1` hold (the breathing loop repeating, or the routine wrapping back to its opening `cat_1`) shows up as one long run. Its last frame therefore proves nothing: the old build would have passed 6 of its 8 breaths. A dissolve now passes only if it reaches its still within the shortest hold it can get (700 ms for `cat_1`, 1,400 ms for `cat_2`) and is still there on the run's last frame.

## For Wren
- **The rest before the loop's first flick is longer.** When the routine wraps, the last breath's `cat_1` (700–900 ms) runs into the opening `cat_1` (600–900 ms). The cat therefore rests 1.3–1.8 s before the loop's first flick, against 0.7–0.9 s before the mid-loop one. In the film this was 1,333 ms at 17.0 s. This comes from the art-branch design; I didn't change it.
- **The routine notes are now slightly stale.** I left the text as delivered.
  - The cat's note still says "Flick at the start of the loop".
  - The top-level note in `routine.json` still says "1 s dissolves".
  - Changing the top-level note would have changed more than the cat's entry.
- **One WebKit console error:** `Failed to load resource: resource unavailable`. It appears in 023b's WebKit films too (desktop and phone), so it isn't new here. I didn't chase it.
- **The film covers WebKit desktop only, one seed.** The unit test checks every hold, over five seeds.
- The preview build (`dist.tgz`) and the recording are in `wren-inbox/quinn/fable-jobs/024-cafe-cat-fix/out/`.

# The fixed Build art, one more swing step, the swing's timing: build report 02

From: Fable. For: Wren and the user. 2026-11-25. Job 010. Branch: `site/review-fixes`; `main` was not touched.
Evidence: `site/qa/build-no-glasses-02/`. "Before" is `3e13a58` (job 009).

**Result: built as briefed. One check not fully met: "no loose pixels", 2 px in `frame_01_02`** (section 4). 287 tests, type check and build pass; no console errors in any run.

```
cd ~/hjaas && git checkout site/review-fixes && git pull && cd site && npm install && npm run dev
HJ_OUT=../build-no-glasses-02/ node qa/tools/build-no-glasses.mjs faces|seam|record|held|leave|memory
```

## 1. The art

The seven files from `origin/main` by path, then `npm run assets` (both sizes). Only Build's files changed. `frame_02_03ab` ships as a patch over `frame_02`, as its neighbours do; no file of the loop's in-betweens is whole. `rx_B36` and `frame_03` are whole, as before.

## 2. Timing

- **Swing** as briefed. **`frame_03`'s hold is 130 to 270 ms (was 240 to 420):** 130 ms less on average, because the rise is now 260 ms where it was 130 before job 008. A swing is 890 ms before its tempo, as it was. I narrowed the range too: 110 at the short end would have been 6 frames.
- **Tap:** unchanged.
- **Reaction:** all six 25 and 30 ms steps are 33 ms, in `frames/005-reaction-motion/approved/reaction.json`. **That file is changed on this branch only; `main` still has the old numbers.**
- Tests: the rhythm's are updated, and two are new (a swing's whole time; the reaction's quick steps).

## 3. Checks

| | Check | Result |
|---|---|---|
| ✅ | No glasses, no scratches: 29 drawings, both sizes (`faces-*.png` 1:1, `eyes-*-2x.png`) | None at 1:1. |
| ⚠️ | No loose pixels (`faces.json`) | **`frame_01_02`: 2 px beside the claw (3 px at 1.5x).** Full set otherwise: single px only, at outlines, in 9 drawings. 1.5x: no others. |
| ✅ | Her eyes in the rise (`*-rise-1to1.jpg`, each drawing at the recording's own px; also `*-rise.jpg`) | Both whole in every drawing of the swing. |
| ✅ | 60 fps recordings: desktop, phone, and a 3x phone window (500 wide); three swings, a tap, a reaction | No drawing skipped. Eyes and all that should not move: no px differs by more than 16 levels between frames (JPEG). No pop, no flicker. |
| ✅ | Patches on her real canvas, 7 windows, Chrome and WebKit (`seam.json`) | Where nothing moves: 0.6 levels of 255 on average, 17 at most. Coming from any other drawing: identical. |
| ✅ | On screen, 60 s each: desktop, phone 4x slower, WebKit (`held.json`) | **The reaction's quick steps: 2 frames of 60 Hz every time, 72 of 72.** `02_03ab` 2 to 4 (mostly 3), `02_03b` 2 or 3. None missed. Rise to wind-up 266 to 268 ms (with the tempo). |
| ✅ | Left while a patch is on her canvas, and back (`leave.json`) | The same picture; the reaction plays. |
| ✅ | "Room painted but she isn't", Build (`paint/`) | 0 frames, Chrome and WebKit, desktop and phone. |
| ✅ | Memory, Build's own, phone at rest (`memory.json`) | 60.2 to 60.9 MB: **+0.75**. Desktop +1.3. |
| ✅ | 30 visiting orders (`memory/`) | **78.5 MB highest, 78.4 before** (in Grow both times). Every reaction in full, no skipped frame, no errors. |
| ✅ | Whole hunt (`hunt/`, `hunt-webkit/`) | 50 of 50 with Next, button and form: desktop, phone upright and on its side, Chrome and WebKit. |

## 4. For Wren (`art-notes-3x.png`)

1. **`frame_01_02`**: 2 loose black px left of the claw (at 481, 473). The only loose thing I would fix.
2. **`frame_02_03ab`**: strap and neckline meet the arm without an outline, as a soft edge; visible at 3x, on screen about 50 ms.
3. **`rx_K1_B36`**: flat skin-coloured patches either side of the nail, and a stepped outline under the hammer's handle (33 ms).
4. **`frame_03`**: the scratch is gone at 1:1; at 3x a few faint px remain by the arm's line.
5. **The patches `frame_01_02`, `frame_02_03b` and `rx_K1_B36` keep their file names but changed; `frame_02_03b` (and `frame_01_02` at 1.5x) is also drawn at another place now.** A browser holding job 008's or 009's copies would draw an arm out of place. A host that revalidates (Vercel's default) is safe; a preview at the same address as an earlier one may need one hard reload.

## 5. Recordings from earlier jobs

**Screencast MP4s from earlier jobs have rounded times.** ffmpeg's list of pictures (`ffconcat`) puts each on a 40 ms grid, so a 50 ms drawing can show for 33 or 83. What is in the pictures and all logged numbers are unaffected; only the playback rhythm is. I measured it on this job's first films, against the page's log, then fixed this job's recorder (`build-no-glasses.mjs`); the films here match the log to a frame. `counter`, `film-2x`, `paint-in`, `paint-switch` and `scene5` use the same list and I did not change or measure them. Judge swing rhythm from this job's films, not older ones.

## 6. Not done

- No real phone, no DevTools trace: not asked. The slowed run counts frames instead.
- The paint check ran while the memory runs were loading the Mac, so its Chrome films had gaps and are not kept; the numbers and strips are.
- `.DS_Store` and `.impeccable/` were untracked before I started; left alone.

## 7. Preview build

`wren-inbox/quinn/fable-jobs/010-build-art-fixes/out/dist.tgz`, the final production build.

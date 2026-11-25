# Build without glasses, and the hammer's and thumb's in-betweens: build report 01

From: Fable. For: Wren and the user. 2026-11-25. Job 008. Branch: `site/review-fixes`; `main` was not touched.
Evidence: `site/qa/build-no-glasses/`. "Before" is `60f19b8`, run beside this build.

**Result: built as briefed, with one check not met: "no speckles".** `frame_03` keeps scratch marks from the glasses' arm (section 3). A swing is also about 10% longer than before (section 2). 274 tests, type check and build pass; no console errors in any run.

```
cd ~/hjaas && git checkout site/review-fixes && git pull && cd site && npm install && npm run dev
node qa/tools/build-no-glasses.mjs faces|seam|record|held|leave|memory
```

## 1. The art

Both folders from `origin/main` by path, then `npm run assets` (both sizes). Only Build's files changed. `rx_frame_01`, `rx_K1` and `rx_K2` are byte-identical to theirs and still shared. Against the old drawings, all 23 differ in the eye area only.

**The five new drawings are shipped as patches, which the brief did not ask for.** Whole, they cost 11.8 MB more on a phone and took the first visiting orders to **83 MB**, over the limit. Each is another drawing but for an arm, so only that part is kept and drawn over the other (`PATCHES` in `build-assets.mjs`, `src/scenes/build-patches.json`; the engine's patches from job 007). The other files are whole, as before.

## 2. The schedule

As briefed, in `build-rhythm.ts`; blinks only on `frame_01`. The ranges are before each swing's own tempo (0.9 to 1.15), as for the other drawings.

There were no tests of the rhythm, so I wrote them: `build-rhythm.test.ts`, 7 tests.

**"Keeps about its total time" and the numbers don't quite agree.** From leaving the box to the wind-up was 130 ms and is now 220 (226 measured), so a swing goes from about 890 to 980 ms, +10%. A tap goes from about 280 to 330 ms. I used your numbers; taking 90 ms off `frame_03`'s hold (240 to 420) would give the old total.

## 3. Checks

| | Check | Result |
|---|---|---|
| ✅ | No glasses, 28 drawings, both sizes (`faces-*.png` 1:1, `eyes-*-2x.png`) | None in any. |
| ⚠️ | No speckles | **`frame_03`: scratch marks left of her eye**, what is left of the glasses' arm; on screen at each wind-up (240 to 420 ms). `rx_A52`: faint rings beside the pupils. Otherwise only loose px of 1 to 3 px at the outlines (`faces.json`). |
| ✅ | Patches on her real canvas, 7 windows, Chrome and WebKit (`seam.json`) | Where the drawing does not move: 0.5 levels of 255 on average, 17 at most. Coming from any other drawing: identical. |
| ✅ | Recordings, 60 fps: desktop, phone (390, CSS px) and a 3x phone window (500 wide) | Three swings, a tap and the reaction in each. Where nothing should move, the eyes included, no frame differs from the last by more than 16 levels on one px (JPEG). No drawing skipped. |
| ✅ | The rise and the thumb (`*-rise.jpg`, `*-thumb-up.jpg`, `*-thumb-down.jpg`, also `*-tap`, `*-wink`) | Every new step shows, in order. |
| ✅ | On screen, 60 s each: desktop, phone 4x slower, WebKit (`held.json`) | The hammer's three in-betweens: 2 to 4 frames of 60 Hz (one of 1 in the slowed run). No drawing missed. 33 swings and 9 taps in each, no other move (the WebKit log begins mid-swing). |
| ✅ | Left while a patch is on her canvas, and back (`leave.json`) | The same picture; every frame returns; the reaction plays through the new drawings. |
| ✅ | "Room painted but she isn't" | 0 frames, Chrome and WebKit, desktop and phone (`paint/`). |
| ✅ | Her face in one stroke (`face/`) | Partly painted for 33 ms, as in job 006. |
| ✅ | Memory, Build's own, phone at rest (`memory.json`) | 58.5 MB before, 60.2 now: **+1.6**. The page's most with Build alone: 67.3 to 68.9. Desktop +2.7. |
| ✅ | 30 visiting orders (`memory/`) | **78.1 MB highest, 77.8 before** (in Grow, both times). Every reaction in full, no skipped frame, no errors. |
| ✅ | Whole hunt | 50 of 50 with Next, reload, button and form: desktop, phone upright and on its side, Chrome and WebKit (`hunt/`). |

## 4. Preview build

`wren-inbox/quinn/fable-jobs/008-build-no-glasses-inbetweens/out/dist.tgz`, the final production build.

## 5. For Wren (`art-notes-3x.png`)

1. **`frame_03`**: the scratch marks above. The one drawing of the 28 I would fix first.
2. **`frame_01_02`**: a dark cut line across the upper arm, jagged outlines, two loose px by the hammer.
3. **`frame_02_03b`**: the forearm covers her eyes for about 50 ms, with bits of eye left around the fist and a ragged outline below it. The eyes blink out and back in every swing; that is the drawing, not the player.
4. **`rx_B36`**, as before: a blurred, greenish hand, now between two sharp drawings and so easier to see (32 ms).
5. The reaction's 25 and 30 ms steps are one or two frames of 60 Hz, unevenly. 33 ms would be two every time.

## 6. Not done, and readings I took

- No real phone, and no DevTools performance trace: not asked; the 4x slower run above counts frames instead.
- The recordings' first few seconds (before the last three swings and tap) are cut off.
- `HAMMER_FRAMES` in `build-rhythm.ts` is now the one list of the loop's drawings; `build.ts` reads it.
- `.DS_Store` and `.impeccable/` were untracked before I started; left alone.

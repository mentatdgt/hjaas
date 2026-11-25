# Job 008-build-no-glasses-inbetweens: Build without glasses, and smoother hammer and thumbs-up

Branch: `site/review-fixes` in `~/hjaas` (`git fetch origin`, check it out, `git pull --rebase`). If the working tree has uncommitted tracked changes, stop and report them. Never touch `main`.

## 1. New Build art from main
Bring `frames/016-upscale/approved` and `frames/005-reaction-motion/approved` from `origin/main` by path (commits `e9075ce`, `5fbb91d`):
- **No glasses:** all 23 of Rachel's Build drawings have new eyes (round white eyes, dot pupils; only the eye area changed). `rx_frame_01`, `rx_K1`, `rx_K2` are still byte-identical to `frame_01`, `K1`, `K2`, so the asset build keeps sharing them.
- **New in-betweens:** `frame_01_02` (halfway contact → lift), `frame_02_03a` and `frame_02_03b` (a third and two thirds of lift → wind-up), and in the reaction `rx_K1_B36`, `rx_B36_B39` (the thumb coming up). `reaction.json` already threads the two reaction ones both ways.

Run `npm run assets` (both the full set and the 1.5x set for narrow screens) and commit the regenerated assets.

## 2. The hammer schedule
Add the three new frames to Build's frame list (`src/scenes/build.ts`) and to `src/scenes/build-rhythm.ts`, so the hammer rises through them and each swing keeps about its total time:
- SWING: `frame_01` (as now) → `frame_01_02` 45–55 ms → `frame_02` 60–80 ms → `frame_02_03a` 45–55 ms → `frame_02_03b` 45–55 ms → `frame_03` (as now) → `frame_04` (as now, the snap stays) → `frame_01`.
- TAP (the small taps): `frame_01` → `frame_01_02` 40 ms → `frame_02` 50–70 ms → `frame_01_02` 40 ms → `frame_01`.
- Blinks still only on `frame_01`. Update the rhythm's tests.

## 3. Checks
- Contact sheet of all 28 Build drawings' faces at 1:1: no glasses anywhere, no speckles, both full and 1.5x sets.
- 60 fps recordings (desktop and phone) of three hammer swings, a tap and the reaction (thumbs-up and wink): no pop, no flicker of the eyes between frames, the hammer rising through the new steps. Strips of the rise and of the thumb.
- Round 4's "room painted but she isn't" stays 0 frames for Build; the paint-in still covers her face in one stroke (job 006).
- Memory: Build's share and the 30-order total, against before (must stay under 80 MB).
- Tests, type check, build, no console errors; the whole hunt 50 of 50 on desktop and phone.

## 4. Report and preview build
Write `reviews/build-no-glasses-01.md`, commit and push `site/review-fixes`. Then `npm run build` and `tar czf ~/hjaas/wren-inbox/quinn/fable-jobs/008-build-no-glasses-inbetweens/out/dist.tgz -C site/dist .` (make `out/`; that one file is the only thing you may write in `wren-inbox/`).

Report: done or not; the commit hash; one line per section; anything Wren should look at.

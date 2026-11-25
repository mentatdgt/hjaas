# Job 007-film-presenter-2x: the Film presenter at double size

Branch: `site/review-fixes` in `~/hjaas` (`git fetch origin`, check it out, `git pull --rebase`). If the working tree has uncommitted tracked changes, stop and report them. Never touch `main`.

Brief: `git show origin/main:reviews/film-presenter-2x-build.md`. Do all of it, including every check, then write `reviews/film-presenter-2x-01.md`, commit and push `site/review-fixes`.

**Also: two new in-betweens (Quinn 036), so his gestures start smoothly.** `presenter2x/M_1_12.png` and `presenter2x/M_1_13.png` (2x, pixel-identical to `M_1` outside the arms). Add them to the presenter layer's stills in `frames.json` and change `routine.json` so each gesture passes through them, keeping the gesture's total time:
- `M_1 → M_1_12 (60 ms) → M_12 (60 ms) → talk_M_2` and back `M_12 (60) → M_1_12 (60) → M_1`.
- `M_1 → M_1_13 (60 ms) → M_13 (60 ms) → talk_M_3` and back `M_13 (60) → M_1_13 (60) → M_1`.
- Never blink on `M_1_12` / `M_1_13` (they're in-betweens, like `M_12` and `M_13`).
Record his gestures at 60 fps on the phone profile and say how far the arms move per step (they should be about 30 px or less at plate scale).

Then make the phone preview build again with everything in it: `npm run build` and `tar czf ~/hjaas/wren-inbox/quinn/fable-jobs/007-film-presenter-2x/out/dist.tgz -C site/dist .` (make `out/`; that one file is the only thing you may write in `wren-inbox/`).

Report: done or not; the commit hash; one line per brief section; the memory numbers; anything Wren should look at.

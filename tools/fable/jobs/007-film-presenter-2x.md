# Job 007-film-presenter-2x: the Film presenter at double size

Branch: `site/review-fixes` in `~/hjaas` (`git fetch origin`, check it out, `git pull --rebase`). If the working tree has uncommitted tracked changes, stop and report them. Never touch `main`.

Brief: `git show origin/main:reviews/film-presenter-2x-build.md`. Do all of it, including every check, then write `reviews/film-presenter-2x-01.md`, commit and push `site/review-fixes`.

Then make the phone preview build again with everything in it: `npm run build` and `tar czf ~/hjaas/wren-inbox/quinn/fable-jobs/007-film-presenter-2x/out/dist.tgz -C site/dist .` (make `out/`; that one file is the only thing you may write in `wren-inbox/`).

Report: done or not; the commit hash; one line per brief section; the memory numbers; anything Wren should look at.

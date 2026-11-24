# Job 001-scene5-round3-finish: finish scene 5 round 3 and write its report

Branch: `site/scene-5` in `~/hjaas`. Brief: the "Round 3" section of `git show origin/main:reviews/scene-5-build-round2.md`.

An earlier session did most of round 3 and pushed it (`2cccadf` in-betweens and engine; `ee1d43f` 60 fps recordings, timing, stages, fade checks), then stopped before writing the report. Finish it:

1. `git fetch origin`, check out `site/scene-5`, `git pull --rebase`.
2. Look at the uncommitted change to `site/qa/scene5/frames.json` and the untracked `site/qa/tools/_ab.mjs`. If they're unfinished round 3 work, finish and commit them. If they're scratch, stash them (message: "job 001 scratch") and don't commit them. Say which in the report. Never commit `.DS_Store` or `.impeccable/`.
3. Check every item the Round 3 brief asks for against what's committed. Re-run a check only if its evidence is missing or stale: `npm test`, type check, and the round 3 checks in `site/qa/tools/scene5.mjs`. Confirm in particular: the stroke, dip and salute play through the in-betweens with no jumps; `reaction.lead_in` brings her to rest before the salute; `min_show_ms` 120 and `R_B1_lean` 500 hold; after the reaction she resumes at the next `R_A1`; memory over 30 visiting orders stays under 80 MB.
4. Write `reviews/scene-5-review-03.md` in the same shape as `reviews/scene-5-review-02.md`: how to see it, a table of asked-for vs result vs evidence, what changed in the engine, frame times, memory, anything not done.
5. Commit and `git push origin site/scene-5`.

Report: done or not; the commit hash; one line per brief item; anything Wren should look at in the recordings.

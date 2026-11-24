# Job 003-hunt-counter: the two-mushroom counter and the phone view

Brief: `git show origin/main:reviews/hunt-counter-build.md`. Spec: `git show origin/main:HANDOVER-hunt-counter.md`.

0. **First, a guard.** `git fetch origin`. If `reviews/scene-5-review-04.md` isn't on `origin/site/scene-5`, round 4 isn't finished: change nothing and end with the report "round 4 not finished; job 003 not started".
1. If the working tree has uncommitted changes, stop and report them; don't stash or commit someone else's work.
2. Make `site/counter` from `origin/site/scene-5` as the brief's section 0 says, and do everything the brief asks, including every check.
3. Write `reviews/hunt-counter-review-01.md`, commit and `git push -u origin site/counter`.

Report: done or not; the commit hash; one line per brief section; anything Wren should look at in the recordings.

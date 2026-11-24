# Job 002-paint-rachel-in: paint Rachel in with the room (all scenes)

Branch: `site/scene-5` in `~/hjaas`. Brief: `git show origin/main:reviews/scene-5-build-round4.md`.

0. **First, a guard.** `git fetch origin`. If `reviews/scene-5-review-03.md` isn't on `origin/site/scene-5`, round 3 is still being finished by another session: change nothing and end with the report "round 3 not finished; job 002 not started".
1. Check out `site/scene-5` and `git pull --rebase`. If the working tree has uncommitted changes, stop and report them; don't stash or commit someone else's work.
2. Do what the brief asks, in full, including every check.
3. Write `reviews/scene-5-review-04.md`, commit and `git push origin site/scene-5`.

Report: done or not; the commit hash; one line per brief item; anything Wren should look at in the recordings.

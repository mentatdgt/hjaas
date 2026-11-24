# Job 005-review-fixes: apply Quinn's code and security fixes and check them in browsers

Quinn reviewed the site (`git show origin/main:reviews/quinn-site-review-030.md`) and made 11 fixes as patches, one per finding, against `site/counter` at `3288e10`. Wren chose the fixes and checked that the patches apply cleanly. Your job: put them on a branch and prove in real browsers that nothing broke and the fixes work.

Patches (read only; don't change anything else in `wren-inbox/`): `~/hjaas/wren-inbox/quinn/jobs/031-code-security-fixes/out/patches/*.patch`. Quinn's notes on them: `…/031-code-security-fixes/out/report.md`.

1. `git fetch origin`. If the working tree has uncommitted tracked changes, stop and report them.
2. Make `site/review-fixes` from `origin/site/counter` and apply the patches in order with `git am` (keep Quinn as the author). If one doesn't apply, stop and report which.
3. `npm install` if needed, `npm run build`, the type check and the full test suite (Quinn's count was 256).
4. **Nothing broke** (production build, Chrome and WebKit): the whole hunt on desktop, phone portrait and landscape (50 of 50); the paint-in of all five scenes (round 4's "room painted but she isn't" test still 0 frames); a scene switch and a return visit; a find, a scene completing and the 50 unlock (recordings into `site/qa/review-fixes/`); reduced motion. Compare with round 2's counter recordings: no visible change except where a fix intends one.
5. **The fixes work**, one check each, written down with its evidence:
   - **C1:** block one mushroom sprite, then one cast frame, then a whole room (Playwright route abort): the hunt still works, the room shows, Retry room recovers.
   - **C2:** two tabs; find in each; reload: both finds kept; a stale tab's pan never removes a find or the unlock.
   - **C3:** during a scene switch and a return reveal, a tap where a hidden mushroom sits collects nothing.
   - **C4:** portrait, pan to the right edge, rotate to landscape and back: the crop is where it was.
   - **C8:** `#%E0%A4%A` and other bad fragments open Build without an error.
   - **C5:** switch reduced motion on in the middle of the paint-in and of a find's flight: it settles at once, counted once.
   - **C6 / C7:** memory over 30 visiting orders still under 80 MB and released when scenes are left; network log shows only the likely next room warmed, at low priority, after the opening.
   - **S3:** serve `site/dist` with the `_headers` applied (state how) and show zero CSP violations in the console of Chrome and WebKit through the opening, a find, a scene switch and the unlock; the response headers as served.
   - **S4:** `npm run dev` listens on 127.0.0.1 only; `dev:lan` on the network.
   - **S1:** the form's length limits and the 15 s timeout (with a stub endpoint).
6. Throttled-phone trace (4×), find and unlock, six runs each, against `site/counter` in turn: no worse than round 2.
7. If a check fails, fix it on this branch with a clear commit and say so; don't change the counter's design or the art.
8. Write `reviews/review-fixes-01.md` (in the shape of the other build reports), commit and `git push -u origin site/review-fixes`.

Report: done or not; the commit hash; one line per check; anything Wren should look at.

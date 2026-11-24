# Job 004-counter-round2: phone framing fixes and fresh evidence

Branch: `site/counter` in `~/hjaas` (`git fetch origin`, check it out, `git pull --rebase`). Your round 1 report: `reviews/hunt-counter-review-01.md`. Wren reviewed it; three things to do:

1. **Film on a phone keeps its approved framing.** Centring on Rachel cut the presenter down to a hand. The user approved Film's two-face framing earlier, so it wins over "centred on Rachel" for this scene only: set `focusX: 977` in `src/scenes/film.ts` (as you suggested) and update its test. Check in the 390×844 still that both Rachel and the presenter's face are in view.
2. **Build on a phone shows her whole box.** Move Build's start just enough that the far end of the box she's hammering is in view, with Rachel still well inside the frame. Say the value you chose.
3. **Fresh evidence on the final build.** Your recordings, traces and WebKit runs came before the last change (tap boxes, 355 px minimum height). Re-run on the build as pushed: the find, complete and unlock recordings (desktop, portrait, landscape), the throttled-phone trace (find and unlock, six runs, against round 4's build as before), and the WebKit check. Replace the files in `site/qa/counter/` and the opening stills for Film and Build at all five sizes.
4. **Housekeeping:** update the older QA tools that still look for the old caption's classes, so they run against the new counter.

Don't change the counter's design or timings. Add a "Round 2" section to `reviews/hunt-counter-review-01.md` (what changed, the new numbers), commit and `git push origin site/counter`.

Report: done or not; the commit hash; one line per item; the new trace numbers against round 1's.

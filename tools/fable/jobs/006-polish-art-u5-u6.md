# Job 006-polish-art-u5-u6: new art from main, a tiny red mushroom on finished tabs, Rachel's face painted in one go

Branch: `site/review-fixes` in `~/hjaas` (`git fetch origin`, check it out, `git pull --rebase`). If the working tree has uncommitted tracked changes, stop and report them. Never touch `main`.

## 1. New art from main
The user asked for art fixes, now on `main` (commit `e0228e5`):
- **Film:** Rachel's cheek edge is a soft curve in `R_A1_film`; the presenter's outlines are thinner on all 16 stills.
- **Design:** the mum's hair (in the plate and her two blink patches) and the child's hair (C_1–C_3) are a little flatter in colour, with the window's rim light kept.

Bring `frames/018-cafe-scene/site` and `frames/020-film-scene/site` from `origin/main` by path, run `npm run assets`, and commit the regenerated assets. Check: the presenter's and the child's stills are still pixel-identical outside their moving parts once built, the mum's blink shows no seam against the plate, and the camera screen still shows the presenter live.

## 2. U5: a tiny red mushroom instead of the cream dot (user's choice)
When a scene is complete (10/10), its menu tab now gets a **very tiny red mushroom** instead of the 5 px cream dot: the same drawing as the counter's red mushroom (red cap with cream spots, cream stem, ink outline), filled, about 9–10 CSS px tall, placed where the dot is, vertically centred on the label. It must read at that size (outline contrast at least 3:1 against the paper) and stay on return visits. The tab's accessible name says the scene is complete. Also from Quinn's U5: draw the tab focus outline inside the scrolling menu so it isn't clipped, and give each tab more horizontal tap area (invisible padding from the gap between tabs) without moving the labels.

## 3. U6: Rachel's face painted in one go (user's OK)
In Design (about 1.65–2.25 s) and Build (about 0.8–2.0 s) a stroke boundary stops on Rachel's face or head, so half of it shows for a while. Change those scenes' stroke plans so her face and head are covered within one stroke (or two strokes that overlap there within 100 ms), still together with the room around her. Keep the 5 s painting and the look of the strokes. Re-run round 4's "room painted but she isn't" test (must stay 0 frames in all five scenes) and make new strips of her face for Design and Build: no frame shows a partly painted face for more than 100 ms.

## 4. Preview build for the user's phone
After everything passes: `npm run build`, then pack the production build for Wren: `tar czf ~/hjaas/wren-inbox/quinn/fable-jobs/006-polish-art-u5-u6/out/dist.tgz -C site/dist .` (make the `out/` folder; this one file is the only thing you may write in `wren-inbox/`).

## 5. Checks and report
Tests, type check, build, no console errors; the whole hunt (50 of 50) on desktop and phone portrait in Chrome and WebKit; recordings of a scene completing (the tab's red mushroom appearing) on desktop and phone; stills of the menu with two finished scenes at 390×844 and 1440×900. Write `reviews/review-fixes-02.md`, commit and `git push origin site/review-fixes`.

Report: done or not; the commit hash; one line per section; anything Wren should look at.

# New art, the tab's red mushroom, Rachel's face in one go: build report 02

From: Fable. For: Wren and the user. 2026-11-25. Job 006. Branch: `site/review-fixes`; `main` was not touched.
Evidence: `site/qa/review-fixes-02/`. "Before" is the build of report 01 (`699c8c0`), run beside this one.

**Result: done.** 258 tests, type check and build pass; no console errors in any run. One reading to check: "pixel-identical once built" (section 1).

```
cd ~/hjaas && git checkout site/review-fixes && git pull && cd site && npm install && npm run dev
node qa/tools/face.mjs plan|record    node qa/tools/tabs.mjs    node qa/tools/art-check.mjs [assets before]
```

## 1. New art

`frames/018-cafe-scene/site` and `frames/020-film-scene/site` from `origin/main` by path, then `npm run assets`: exactly the 23 pictures of `e0228e5` changed, nothing else.

| | Check | Result |
|---|---|---|
| ⚠️ | Child and presenter outside their moving parts | **As delivered: identical**, all 16 stills and C_1 to C_3. **As built: not to the pixel, and never were**: the cast is lossy WebP (quality 93). Differences outside the moving parts: 0.15 to 0.63 levels of 255 on average for the presenter (before 0.18 to 0.63), up to 1.15 for the child (before 0.92); largest 16, at no pixel over 24 (`art.json`). I left the encoder as it is. |
| ✅ | Moving parts | The child's are the same px as before. The presenter's are a little wider (41 to 372 px a still at the mouth and eyes, about 1000 to 1300 at the arms): thinner lines redrawn there. |
| ✅ | The mum's blink | No seam. Along the patch's rim: 1 level at most from the plate as delivered; as built 0.9 on average, 14 at most. At 5x I see none. |
| ✅ | The camera screen | Live in Chrome and WebKit: 285 of 285 pose changes under it shown in the same frame, none late, no flicker (`film/`). Every actor is where the package puts it (`film/preview.json`, `cafe/preview.json`). |

## 2. U5: the red mushroom

The counter's own drawing (`MUSHROOM_ICON`), full, in place of the dot. Its outline is thicker for its size (1 px on screen), or it would not be ink at all there.

| | Check, 11 windows in Chrome and WebKit | Result (`tabs.json`) |
|---|---|---|
| ✅ | Height | 9.3 to 9.5 px on phones and 2x screens, 9 to 10 on 1x. |
| ✅ | Outline against the paper | Lowest of 24 directions, as drawn on screen: 3.9:1 (1x screen); 10:1 or more on 2x and 3x. |
| ✅ | Vertical place | Within 1 px of the middle of the label's letters. |
| ✅ | Labels | 0 px moved in all 22. The menu is no taller and still fits one row at 390, 375 and 360. |
| ✅ | Tap areas | Each tab now has the whole gap: "Film" 31 to 53 px wide at 390, 48 at the least anywhere; 44 high; none overlaps another. |
| ✅ | Focus ring | All of it inside the menu on every tab (`tabs-focus-*.png`). |
| ✅ | Name | "Build, scene complete". Only once it is so. |
| ✅ | Stays | After a reload; `counter.mjs states`: 13 hunts × 5 scenes, 0 problems. |

Stills: `menu-{chrome,webkit}-{1440x900,390x844}.png`, close up `menu-*-8x.png`. Recordings of a scene completing: `counter/complete-desktop-60fps.mp4`, `complete-portrait-60fps.mp4`
(and `-desktop-reduced`). It fades in over 260 ms from 0.9 of its size with the cream glint; under reduced motion it only fades.

## 3. U6: Rachel's face

In each scene one long stroke now crosses the middle of the wall and paints her whole head, at its quickest there, with the room around it. No other stroke reaches her head before it.
The strokes keep their look (same brush), and the painting its 4.32 s of brush. In Design the second floor stroke also starts sooner and further left (see below). `paint.ts` is unchanged.

| Partly painted (5 to 95%), Chrome, every recorded frame at 60 fps | Face before | Face now | Head and hair before | now |
|---|---|---|---|---|
| Build, desktop and phone | 1367 ms | **33 ms** | 1400 ms | 50 ms |
| Design, desktop and phone | 950 ms | **33 ms** | about 1030 ms | 67 ms |

WebKit (screenshots every 50 to 75 ms, so coarse): face 51 to 62 ms. At 240 steps a second on the plans alone: face 46 and 42 ms (`face-plan.json`). Strips: `face-{build,design}-{desktop,phone}.jpg`, and `-before`, `-webkit`.

| | Check | Result |
|---|---|---|
| ✅ | Round 4's "room painted but she isn't" | 0 frames, five scenes, desktop and phone, Chrome and WebKit (`paint/paint.json`, `paint-webkit.json`). |
| | What it found on the way | My first two versions of Design each failed it once: one sector in one frame (a late bristle over her hair, then the table's left edge between two floor strokes). Both fixed; then 0 in five more takes of Design on each device (three WebKit, two Chrome). |
| ✅ | Skip, Replay, slow network, reduced motion, switches, return visit | As in round 4 (`paint/states.json`, `switch.json`). |
| ✅ | Painting, phone, 4x slower, headed Chrome, three runs each of Build and Design | 0 dropped frames; longest task 10 ms. |

A stroke's bristles come from its place in the list: adding, removing or reordering strokes changes every later one, so run both tests again after any change to a plan.

## 4. The whole hunt

50 of 50, with Next, reload, button and form: desktop, phone upright and on its side, Chrome and WebKit, on the final build (`hunt/hunt.json`). Content policy: 0 violations in WebKit and Chrome (`hunt/s3.json`).

## 5. Preview build

`wren-inbox/quinn/fable-jobs/006-polish-art-u5-u6/out/dist.tgz`, the final production build.

## 6. For Wren

1. **Lossy stills** (section 1): true pixel identity would need lossless WebP for the presenter and the child. I did not change it: it would make the presenter heavier on slow phones.
2. **At 1x** (an ordinary desktop screen) the mushroom's spots are single pixels: it reads as a red mushroom, the spots as light specks. `menu-chrome-1440-8x.png`.
3. The tab's focus ring has changed look on desktop too: it is now a box in the tab's own height, the same everywhere.
4. Build's and Design's paintings now go across the room in wider sweeps than before (no zig-zag on the windows). Worth a look: `paint/scene1-paint-60fps.mp4`, `scene3-paint-60fps.mp4`.

## 7. Not done, and readings I took

- No real phone and no screen reader.
- "Face" and "head" are boxes on the plate (`face.mjs`), her own silhouette inside them. "Partly painted" is 5 to 95%.
- "The accessible name says the scene is complete": I put it in the tab's `aria-label` instead of hidden text (which read "Build , all found", with a space).
- Round 2's find and unlock traces were not run again. The recordings of Build, Grow, Film and Set Design are from before Design's last two changes; those four scenes did not change after.
- `s3` and `states` results were checked; `review-fixes.mjs`, `scene3.mjs` and `scene4.mjs` now take `HJ_OUT`. `.DS_Store` and `.impeccable/` were untracked before I started; left alone.

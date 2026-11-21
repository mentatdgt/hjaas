# Scene 5 "Set Design" (the theatre backdrop): build brief

For: Fable. From: Wren (scene-5 chat), 2026-11-21.
Rules for unattended work are in `HANDOVER.md`. The look and the rules are in `BIBLE.md` (§1, §3 row 5 and §4c).

## 0. When and where
- **Branch:** create `site/scene-5` from the tip of `origin/site/scene-4` (2e19df6 or later). Scenes 3 and 4 aren't merged yet; the branches merge in order later: 3, 4, then 5.
- **Bring in the scene-5 files from `main`** (they aren't on the site branches):
  `git fetch origin && git checkout origin/main -- frames/022-theatre-scene/site scene/pencil/set-lines.png tools/theatre_preview.py frames/022-theatre-scene/theatre-preview.mp4`
  Don't merge `main` into the branch. Read this brief and `BIBLE.md` from `origin/main`.
- Never merge into any branch, and never touch `main`.

## 1. What scene 5 is
The fifth tab in the scene menu: **Set Design** (exactly that label), after Build, Grow, Design and Film. Scene id `set`, address `#set`. Lazy-load it like Grow, Design and Film. It takes the place the menu kept for Travel: update the comment in `src/scenes/index.ts`.

A theatre stage, lit warm from the floodlight on the left.
- **Rachel** stands on a wooden A-frame ladder painting a huge backdrop. Its left part is painted (sky, hills, a lake); its right part is bare canvas with pencil lines.
- **The backdrop fills in as the visitor hunts.** Each mushroom found in this scene paints one more swath; at 10/10 here it is complete.
- **A stagehand** crosses behind the backdrop about once a minute. Only his boots show, in the dark gap under the backdrop's hem: right to left, then back 10–15 s later. Never any more of him.
- **The caged work lamp** at the top right swings slowly on its rope. The curtain and fly ropes stay still.
- **On a mushroom find:** Rachel turns her head to the visitor, smiles and raises her brush in a little salute, then goes back to painting.

Preview of the intent: `frames/022-theatre-scene/theatre-preview.mp4` (32 s), made by `tools/theatre_preview.py` from the same files. The user approved it (2026-11-21).

## 2. Assets: `frames/022-theatre-scene/site/` on `main`
- **`plate.png`:** 1672×941, the empty stage (Rachel and the lamp removed; the backdrop at its starting state).
- **`frames.json`:**
  - **Canvas:** 1672×941, the 1× set. There is no larger master. **Don't upscale it for phones.**
  - **Layers, in drawing order over the plate:**
    - `backdrop_01` … `backdrop_10`: one still each (`P_01` … `P_10`), at the x, y in the file. `"scenery": true` and `"hunt_progress": k` (new, see §3b).
    - `stagehand`: no stills. `"sprite_track": "stagehand/walk.json"`, `"sprites"` (`boot_L`, `boot_R`) and `"mask": "stagehand/gap_mask.png"` (new, see §3a).
    - `lamp`: x 1327, y 0; 36 stills `L_00` … `L_35`. `"scenery": true`.
    - `rachel`: x 702, y 75, 394×500; 7 stills.
  - Each still is **RGBA with a soft 1 px edge**. Draw it at its layer's x, y with normal alpha blending.
  - Within a layer, every still is pixel-identical to the first outside the part that moves, so **every change is an instant cut and nothing flickers**.
- **`routine.json`:** one entry per actor. Rachel and the lamp use the café's step vocabulary (`loop`, `repeat`, `still`, `ms` ranges, `blink_ok`, `blink` with `on` + `frames`, `reaction`). **No `fade_ms` anywhere.** The `stagehand` and `backdrop` entries are new (see §3).
- **`stagehand/walk.json`:** two tracks, `rtl` (sprite `boot_L`) and `ltr` (sprite `boot_R`), each 137 frames at 30 fps (4.57 s). Per frame, two boots: `x`, `y` (the sprite's bottom-centre, in canvas px), `rot` (degrees clockwise about that point) and `far`. `gap_mask_xy` is `[0, 554]`.
- **`stagehand/gap_mask.png`:** 1672×83, 8-bit greyscale, placed at `gap_mask_xy`. 255 = the dark gap under the hem.
- **Pencil line map:** `scene/pencil/set-lines.png`, 1672×941, registered to `plate.png` (made with `tools/pencil_lines.py`).
- Add the package to `scripts/build-assets.mjs` like Film's: `{ dir: 'frames/022-theatre-scene/site', to: 'scene5', json: 'set-cast.json', lines: 'set-lines.png' }`. Read `scenery`, `hunt_progress`, `sprite_track`, `sprites` and `mask` from `frames.json`; don't name actors in the build script.
- **Keep `gap_mask` lossless** (PNG or lossless WebP): a lossy mask lets the boots bleed onto the stage floor. The boots, the lamp and the patches convert to WebP as usual, as long as the stage comparison in §8 holds.

## 3. Three engine additions

### 3a. `sprite_track` layers (the stagehand's boots)
- While a walk plays, each frame: take the track frame `floor(elapsed_ms × fps / 1000)`. Don't interpolate between track frames (the preview doesn't, and the boots are built to roll, not slide).
- Draw the far boot first, then the near one: the track's sprite, its bottom-centre at x, y, rotated by `rot` degrees clockwise about that point. Draw the **far boot 15% darker** (RGB × 0.85, alpha unchanged); make that darker sprite once at load.
- **Clip to the mask:** draw the boots into an offscreen 1672×83 canvas offset by `gap_mask_xy`, then keep only what's inside the mask (`destination-in` with the mask as alpha). Draw that over the backdrop patches and under the lamp and Rachel. The ladder, pots and cart are in the plate in front of the gap, and the mask already leaves them out.
- After the last frame, clear the layer. Nothing of him shows between walks.
- Paused mid-walk: hold the current frame; carry on from there on Play.

### 3b. `hunt_progress` layers (the backdrop fills in)
- Layer `backdrop_k` is shown once **k mushrooms of this scene** are found. Finds in other scenes don't count.
- **On a find:** when the count becomes k, fade `backdrop_k` in over **700 ms, ease-out**, starting at the same moment as her reaction.
- **Saved with the hunt:** on load or a return visit, patches 1…found are shown at once, with no fade. The first-visit painting paints them in as part of the scene.
- **Reduced motion:** no fade; the patch appears.
- Patches overlap and are drawn in order 1…10. Once a fade ends, bake the patch into the scenery canvas, so the frame loop never redraws ten patches.
- At 10/10 the backdrop is complete. Step through all 11 stages (0…10) in the QA (§8).

### 3c. The stagehand's schedule (`routine.json` → `stagehand`)
- The first walk starts **8–15 s** (`first_ms`) after the scene has settled after its painting.
- Each crossing: play `rtl` once; wait **10–15 s** (`return_after_ms`); play `ltr` once. Then wait **40–70 s** (`every_ms`) and repeat. Random values are drawn fresh each time.
- **None** while paused, while the scene is hidden or switched away (start again from `first_ms` when it comes back), or with reduced motion (the boots never show).
- He never reacts to finds, and finds never interrupt a walk.

## 4. Routines (summary; the data is authoritative)
- **Lamp:** `L_00` → `L_35`, 100 ms each, forever (one 3.6 s pendulum swing). It's scenery: the edge treats it like the plate. Reduced motion: hold `L_00` (it hangs straight).
- **Rachel:**
  - **The paint loop:** R_A1 → R_A2_stroke_low → R_A3_stroke_out → R_A2_stroke_low, 3–6 times, with the holds in the data. Then she leans back to judge it (R_B1_lean, 2–3 s), comes back (R_A1), dips the brush in the pot on the ladder (R_B2_dip), and comes back again.
  - **Blinks:** R_A1_blink for 100 ms, every 3–6 s, only on R_A1 holds marked `blink_ok`.
  - **Reaction on a find:** cut straight to R_K1_salute from whatever pose she's in, hold it 1.7–2.1 s, then R_A1 for 400 ms, then back into the loop.
  - **A second find mid-reaction:** use `again: 'hold'`, as Film does. Extend the K1 hold; never restart it.

## 5. The hunt: 10 mushrooms
Place them yourself, following `reviews/scene-2-hunt-difficulty.md`: **3 easy, 4 medium, 3 hard**, spread across the full width.
- **Fairness rules:** always visible, never under UI, hit areas ≥ 44 px, no overlaps.
- **Never on or behind any of these (canvas px):**
  - Rachel's layer: x 702–1096, y 75–575;
  - any backdrop patch: x 929–1529, y 0–562 (the patches would paint over a mushroom);
  - the lamp's layer: x 1327–1427, y 0–101;
  - the gap under the hem: y 554–636 wherever `gap_mask` > 0 (the boots walk there).
- `aPaint` ≥ 0.95 under every mushroom and tap box.
- **Good hiding places:**
  - the dripping paint pots and their drips, front left and under the cart;
  - the paint cart: its shelves, brushes and rag;
  - the blue splatters on the drop cloth;
  - the floodlight's tripod and the coiled cable at its foot;
  - the leaning scenery flats on the left;
  - the knots of the fly ropes at the top left;
  - the curtain's gold tassel on the right;
  - the ladder's feet (below Rachel's layer);
  - the stage boards and the seat backs along the bottom.
- The stage is warm and busy: check that the hard ones are hidden by likeness (a pale cap among the paint pots, red against the curtain), not by darkness.

## 6. The prize: all 50, and the form
The site now has five scenes. **The contact form unlocks only when all 50 mushrooms are found, 10 in each scene** (BIBLE §1, changed 2026-11-21). Today it unlocks when the first scene reaches 10/10 (`finish()` and the load-time check in `site.ts`). Change that:
- **Derive the unlock**, don't trust a saved flag: unlocked = every scene in `SCENES` has all its spots found. Recompute it on load and after every find. Ignore a saved `unlocked: true` from the old rule (there are no visitors yet, only our test browsers).
- **A scene reaching 10/10** shows that scene as done, as now, but doesn't unlock anything unless it was the last one.
- **The 50th find**, in whichever scene, earns the Contact button with the unlock moment and its screen-reader announcement.
- **Placeholder copy** (it stays `TODO(copy)`): the prize line counts the whole site, e.g. "Find all 50 to reach Hui Jie". Once a scene is done, its line says how many are still to find in the other scenes. Update the `index.html` description placeholders the same way (they still say ten). Don't redesign the counter: the gallery-label counter is still waiting for the user's decision (BIBLE §2).
- **The contact form's checkbox list:** replace `'Travel'` with `'Set Design'` in `NEEDS` (`form.ts`): Build, Design, Film, Grow, Set Design, Something else.
- **QA preset:** add `?all=N` (0–50): fills N finds across the scenes in menu order and is never saved, like `?found=`. `?all=49#set` leaves only Set Design's last spot to find: use it to record the unlock.

## 7. Edge and phones
- Pencil edge B with Round 3b's reveal, using `set-lines.png` (`lines: 'set'` or whatever prefix your build gives it).
- **Rachel gets `aPaint` = 1** under every pixel she ever covers.
- **The lamp** hangs from the top rim. Let the rim fade its rope as it fades the fly ropes, but keep the cage painted (`aPaint` ≥ 0.95 under its whole swing). Use a `'hug'` keep box like the Merlion's if the edge's line comes too near.
- **Phones:** the default view centres on plate x 930, so Rachel's whole layer (x 702–1096) and the start of the bare canvas are in view at every phone shape: `phoneStart` `wide` [554, 1306], `tall` [617, 1243]. Panning works as in the other scenes.
- **The menu with five tabs:** keep the label exactly "Set Design". If the five tabs don't fit on one line at 320 px, let the menu wrap onto a second centred line: no truncation, no scrolling, no shorter label. Show it in a screenshot.

## 8. Budgets and QA
**Budgets**
- **Whole page under 80 MB** on the phone profile, with all five scenes visited in any order. A hidden scene releases its decoded frames.
- Scene 5 is light: 7 Rachel stills, 36 small lamp stills, 10 patches, 2 boots and a mask (2.4 MB as PNG, plus the 2.3 MB plate).
- 60 fps on a throttled phone, including during a patch fade and a walk. No long tasks over about 12 ms in WebKit.

**Evidence (as for scenes 2–4)**
- **Screenshots:** Set Design at 1440×900, 390×844 (panned left and right) and 360×740; the menu at 320 px.
- **The backdrop, stage by stage:** a contact sheet of the page's scene at 0…10 found (`?found=0#set` … `?found=10#set`). Compare each against a straight alpha-over of `plate.png` + `P_01…P_k` from the package: mean difference under 1 level inside the backdrop, and no visible seam or pale island at any stage. If lossy WebP leaves a seam, ship the patches as lossless WebP.
- **Against the preview:** the page against `theatre-preview.mp4` frames: Rachel, the lamp and the boots within a screen pixel of their places.
- **Playwright recordings:**
  1. **45 s** from settled, with the default schedule: at least one full crossing (out and back), two finds, the lean and the dip.
  2. **The 10th find:** from `?found=9#set`, the last patch fades in with her salute, and the scene shows done.
  3. **The unlock:** from `?all=49`, the 50th find opens the Contact button. Show a 10/10 scene *without* the unlock as well.
  4. **Reduced motion:** no walks, the lamp still, patches appear without a fade.
- **The boots at 1:1:** frames of the page's walk, both directions, next to the preview's. They roll off the toe and land on the heel, never slide, and never show outside the gap (not on the ladder's feet, the pots or the cart).
- **Chrome DevTools trace** on the throttled phone profile: the painting, a find with its patch fade, and a walk.
- **Check against `.claude/skills/review-animations/STANDARDS.md`.** In particular:
  - no flicker on cuts;
  - the patch fade is smooth and never pops;
  - the lamp loops without a hitch at L_35 → L_00;
  - the boots' timing is even.
- **Report** in `reviews/scene-5-review-01.md`, in the pattern of `scene-4-review-01.md` (how to see it, then the asked/result/evidence table). Then Wren reviews.

## 9. Not yet
- **Copy:** none for this scene yet.
- **Dust motes** in the floodlight's beam (BIBLE §4c, optional): don't build them in this round.

# Scene 5 "Set Design": build brief, round 2 (the stagehand)

For: Fable. From: Wren (scene-5 chat), 2026-11-23.
Round 1 (`reviews/scene-5-build.md`, your report `scene-5-review-01.md`) passed Wren's review. Since then the user has changed the stagehand. Everything else in the scene stays as you built it.

## 0. Where
- Keep working on `site/scene-5`. Never merge, never touch `main`.
- **Bring the new package in from `main` by path, replacing the old one completely** (sprites were renamed, and old files must not linger):
  `git fetch origin && git rm -r -q frames/022-theatre-scene/site && git checkout origin/main -- frames/022-theatre-scene/site frames/022-theatre-scene/theatre-preview.mp4 tools/theatre_preview.py`
  Then `npm run assets`.
- Read this brief and `BIBLE.md` §4c from `origin/main`.
- **Interim art:** the full-body drawings `L_B09` … `L_B16` are being redrawn by Quinn (job 022l). When Wren says so, run the same two commands again and re-run your checks. File names, sizes and data format stay exactly the same, so no code change should be needed for the swap.

## 1. What changed, in the user's words and decisions (2026-11-22/23)
- **The boots walk on a drawn walk cycle.** 16 hand-drawn poses of the boot (heel strike, roll, heel rise, toe-off, swing), mirrored for the walk back. The track is now **60 fps** (299 frames, about 5 s per crossing), and the planted heel or toe never slides.
- **He is seen whole where he really would be.** Between the backdrop's right edge and the red curtain there is an open, dark slot. When he walks through it he is seen as the whole man, the stagehand from the character sheet (`frames/022-theatre-scene/incoming/022_stagehand_sheet.png`), in the dim backstage light. Walking out he comes from behind the curtain, crosses the slot, and goes on behind the backdrop, where only his boots show under the hem. Walking back he does the reverse and goes behind the curtain. Walking left, his boots go out of sight behind the leaning flat (the backdrop's left edge is behind it).
- The backdrop, plate, patches and pencil map are **unchanged** from round 1 apart from a pixel-identical rebuild. A brief extension of the backdrop on `main` (11a624c) was undone.

## 2. The data (`frames/022-theatre-scene/site/stagehand/`)
- **`walk.json`:** `rtl` and `ltr`, each `{ fps: 60, frames: [...] }`.
  - **A frame is a list of entries, drawn in order.** Each entry: `s` (sprite name), `x`, `y` (the sprite's bottom-centre, canvas px), `rot` (always 0 now), `far`, and optionally `body: true` and `flip: true`.
  - There is **no `track.sprite` any more**: use each entry's `s`.
  - Also in `walk.json`: `sprites` (the list of names), `gap_mask_xy` [0, 554] and `body_mask_xy` [0, 101].
- **Boot frames:** two entries, far first.
  - Sprites `L_W01` … `L_W08b` (walking left) and `R_W01` … `R_W08b` (walking right): 32 small sprites, 91×91.
  - Draw the far one 15% darker, as now.
  - Clip to `gap_mask.png` (1672×83) placed at `gap_mask_xy`.
- **Body frames:** one entry with `body: true`, sprite `L_B01` … `L_B16` (16 sprites, 316×459).
  - Draw it **not** darkened. The drawing already carries its own backstage shading.
  - If `flip: true`, mirror it left-right about its bottom-centre x (the walk back reuses the left-facing drawings).
  - Clip it to `body_mask.png` (1672×536) placed at `body_mask_xy`: the slot plus the gap under the hem.
- **`frames.json`:** the `stagehand` layer now has `sprites` (all 48), `mask` (the gap) and `body_mask`.
- **Pick the frame by time:** `floor(ms × fps / 1000)`, with no interpolation. Body frames come in one continuous run at the start of `rtl` and the end of `ltr`. The switch between body and boots happens behind the paint cart, at a frame where both agree; don't smooth it.

## 3. Engine changes
1. **Per-entry sprite**, and the body entries as above.
2. **The walker's canvas** is now the size of `body_mask` (1672×536 at `body_mask_xy`), because the body mask contains the gap. For boot frames, clip with the gap mask drawn at its own offset inside that canvas (y 554 − 101 = 453); for body frames, clip with the body mask. Everything else stays: draw order (over the backdrop patches, under the lamp and Rachel), the schedule (`routine.json` → `stagehand`, unchanged), pause, reduced motion (no walks) and hidden scene.
3. **Memory:** the 16 body sprites are about 9.3 MB decoded.
   - Decode them only while Set Design is showing, and release them when it's hidden, like the cast's frames. The 0.6 MB you keep away from Set Design must stay about that.
   - Make the darker copies only for the boot sprites (`*_W*`), never for the body.
   - Whole page still under 80 MB in your 30 visiting orders.

## 4. The hunt
No mushroom or tap box inside the slot, where he now appears: canvas x 1505–1606, y 105–553 (the `body_mask` above y 554). If any of your ten spots falls there, move it, and keep the 3/4/3 difficulty mix.

## 5. Evidence (into `reviews/scene-5-review-02.md`, in the pattern of review 01)
- **1:1 frame strips of the slot, both directions,** next to the matching frames of `theatre-preview.mp4`. They must show:
  - him coming out from behind the curtain;
  - crossing the slot as a whole man;
  - going behind the backdrop with only the boots under the hem;
  - the walk back into the curtain.
- **The hand-over:** the frames around the switch from body to boots (rtl frames 70–78; ltr the matching ones). Nothing jumps.
- **The left end:** his boots go out of sight at the leaning flat. Nothing shows between the flats.
- **A 60 fps Playwright recording** of a full crossing out and back, with the default schedule or your QA shortcut.
- **A Chrome DevTools trace** on the throttled phone during a crossing that includes the body frames: 60 fps, no long tasks.
- **Memory:** your 30 orders again.
- **The standards check** (`.claude/skills/review-animations/STANDARDS.md`) for the walk.
- Then Wren reviews and the user does the phone check.

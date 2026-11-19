# Scene 2: Wren's review 04 (2026-11-20)

For: Fable, on `site/scene-2`.
- Run `git pull origin main` first: the lab frames changed (see item 1).
- Commit per item and push. Never merge into other branches. Work unattended, and log decisions in the report.

Overall: very good. Rachel's lab routine, the lazy loading, the 20 mushrooms at full opacity, the quieter page and the edge are all right in principle. Four fixes:

## 1. New mist_to_write frames (Wren's fix for your 30% jump)
`frames/017-lab-keyposes/site/` is updated:
- `mist_to_write` now starts from video frames 1–4, which match A1, so the first frame differs from A1 in **0.4% of the figure** (it was 30%). It has 32 frames (was 26), with a new patch origin; read it from `frames.json`.
- `routine.json` is unchanged.

Run `npm run assets`, then re-check the hand-off from A1 into the clip and back in a frame-by-frame recording.

## 2. Corners: much tighter (user's choice)
The production corners are far rounder than the chosen mock-up (`reference/mockups/edge-CHOSEN-A-rounded.jpg`); at 1440×900 the painting reads as a pill shape. Match the mock-up:
- The rounding should only affect roughly the outer **5–7% of the width** at each corner.
- The long straight edges stay straight and thin.
- Raise the superellipse exponent (try 14–20) or switch to a rounded-rectangle distance with a corner radius of about 6% of the plate width.
- Put a side-by-side of the mock-up and the build at 1440×900 in `site/qa/edge/corners.jpg`.

## 3. Memory: Rachel's lab frames decoded at once (~180 MB) are too much for older iPhones
Mobile Safari can kill a page well below that.
- **Decode per clip and release:** keep only the 7 stills decoded permanently, about 38 MB at 2×.
  - Decode a clip's patches with `createImageBitmap` during the hold before it plays. Every clip is preceded by a hold of at least 600 ms.
  - Release them with `ImageBitmap.close()` when the clip is done. Keep the encoded blobs in memory, so re-decoding is fast.
  - For the reaction (which can start at any moment), keep `look_up` and `thumbs_up` decoded while the Grow scene is visible. They're small (about 28 + 18 MB at 2×).
- **A lighter phone variant:** have `npm run assets` also output a 1.5× set of the lab stills and patches. Use it when the scene is shown under 900 CSS px wide; that needs about 56% of the memory. Keep 2× for desktop. Check that the edges at 1.5× still look sharp on a 390×844 @3× screenshot.
- **Report:** peak decoded image memory with Grow open on the phone profile (estimate it from the bitmap sizes), before and after. Target under 80 MB.

## 4. The WebKit frames over 50 ms (first lab open, the writing loop, the tap on a find)
These are most likely image decodes on the main thread. After item 3:
- **First lab open:** start decoding the lab stills when the Grow tab gets hover, focus or pointerdown, and during the first part of the brush transition. Don't draw Rachel until her stills are decoded (the brush covers it).
- **Writing loop:** pre-decode its patches as in item 3, so no decode happens mid-loop.
- **A find:** `look_up` and `thumbs_up` are already decoded (item 3), so the 92 ms tap frame should go. If not, trace it and say what it is.
- Re-run the same WebKit checks (12 runs of the first lab open, a full routine cycle, 5 finds). Report before and after.

## Leave as is
- The blink: a single 50 ms half-closed frame is fine for now.
- No ground shadow, no paper grain, the edge drawn as a paper layer: all fine.

## Done means
- Add a "Review 04" section to `site/qa/REPORT.md` with ✅/❌ and numbers per item.
- Push, and paste a short summary.

---
id: 001-hammer-loop
status: approved             # draft | open | delivered | changes-requested | approved
frames: 4
grid: 2x2                # columns x rows
fps: 12
loop: true
references:
  - reference/scene-keyframe-hammering.png   # THE pose, framing and lighting target
  - reference/hjaas1.png                     # outfit 2 (tank + tan shorts, bandana & bun), full body
  - reference/hjaas4.png                     # bandana & bun face details
  - reference/hjaas5.png                     # expression 13 FOCUS (bandana & bun): tongue out, eyes on the work
used_on: contracting scene, idle loop (she hammers the box until a visitor finds a mushroom)
---

# 001 — Hammering the box (loop)

## What the animation shows
Rachel kneels beside the open wooden box from the keyframe and hammers a nail into its near corner, over and over. Only her hammer arm and the hammer move. This is the first test of the pipeline, so precision matters more than flair.

## What goes in each cell
Rachel **and the wooden box together**, exactly as posed in `reference/scene-keyframe-hammering.png`: same kneeling pose, same camera angle, same box (open-top, light wood, two dividers), same expression (13 FOCUS: tongue out, eyes on the nail). Nothing else from the room: no floor, no tiles, no wall, no ladder, no shadow.

The box is part of the drawing because her hands touch it; it must look identical in all four cells.

## Frame-by-frame
| # | Pose / action | Hold (ticks at 12 fps) |
|---|---|---|
| 1 | **Contact.** Exactly the keyframe: hammer head resting on the nail at the box's near corner, other hand steadying the nail. | 2 |
| 2 | **Lift.** Hammer arm bends up; hammer head about level with her chin, angled back. | 1 |
| 3 | **Wind-up.** Hammer raised highest, head above her bandana, wrist cocked back. The anticipation pose. | 2 |
| 4 | **Down-swing.** Hammer halfway down, head roughly level with her shoulder, travelling toward the nail. | 1 |

Frames 1 → 2 → 3 → 4 → back to 1 must read as one smooth swing; the hammer head should follow a clean arc.

## Must stay identical in every frame
- Everything except the hammer arm and the hammer: head, face, expression, glasses, bun, bandana, body, legs, boots, the steadying hand, and the box
- Her position and size in the cell (same spot, same scale)
- Outfit 2: black tank, tan cargo shorts, dark socks, brown boots, gold pendant, grey zig-zag bandana with high messy bun and loose curls

## Lighting (overrides delivery-spec rule 6)
Match the keyframe's lighting: warm golden light from the window on the LEFT. Warm highlights on her left side, slightly deeper warm shadow on her right, same colour warmth as the keyframe. Outline style stays as on the model sheets. Light the box the same way.

## Size and background
- Make the sheet **as large as you can**, landscape. If your reply can state the pixel size you produced, do.
- Each cell: Rachel + box filling about 80% of the cell width, with the 8% margins from the delivery spec.
- Transparent background, or flat pure green `#00FF00` with no shadow, gradient or floor.

## Avoid
- Redrawing the face or body differently between frames (this is the most common failure)
- Motion blur, smear lines, speed lines or impact stars (the site adds effects)
- Any part of the hammer crossing into a neighbouring cell, especially in frame 3
- Room elements, floor, cast shadows, labels, grid lines, frame numbers

## QC pass criteria (Wren checks these)
- Body, face and box consistent enough across frames that only the arm region needs swapping (Wren stabilises by keeping frame 1's body and box)
- Rachel + box size and position vary < 2% across frames
- Colours and lighting match frame 1 and the keyframe
- Clean background, no green fringe, no stray marks
- Swing reads smoothly at the timing above; no jump from frame 4 back to 1
- Recorded, not a fail: the pixel height of Rachel in each cell (target for crisp phones is ~900px; Wren reports what we got)

## Site playback timing (decided 2026-11-17, replaces the fixed holds above)
The site does not play the four frames at a fixed rate. Per swing: contact 260–460 ms, lift 110–150 ms, wind-up 240–420 ms, down-swing 60–80 ms (kept snappy for impact), with each swing ×0.9–1.15 overall. About 1 in 5 swings is preceded by 1–2 small taps (contact → lift → contact). Every 3–6 swings she pauses on the contact frame for 1.1–2.0 s (blinks happen here). Average ≈ 55 swings/min. Reference implementation: `tools/preview_timing.py`; preview: `approved/in-scene-timing.mp4`.

## Revision notes
### Round 1 — Batch 01 (2026-11-17): APPROVED after Wren stabilisation
- Raw sheet: 1536×1024, cells 768×512, Rachel ~430 px tall. Automated QC flagged green fringe on all frames and a ~24 px horizontal jump between columns; Quinn also noted changing nail height.
- Fixed in post with `tools/stabilise_frames.py` (anchor = the box; diff 20, grow 14): green keyed and despilled, every frame registered to frame 1, frame 1's body/box kept and only changed areas (hammer arm, steadying hand + nail, slight head bob) swapped in. Result: box, legs and boots pixel-steady; single clean nail; clean hammer arc 1→2→3→4.
- `approved/frame_01..04.png` (573×458) are the stabilised frames to use; `raw-qc/` keeps the automated report on the raw sheet.
- Open issue, not a fail: resolution. Rachel is ~430 px tall vs the ~900 px target for crisp phones. Decide later between an upscaler pass or regenerating frames larger.

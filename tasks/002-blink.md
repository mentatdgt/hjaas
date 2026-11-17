---
id: 002-blink
status: open             # draft | open | delivered | changes-requested | approved
frames: 2
grid: separate images     # one image per pose, each an edit of the base frame
fps: 24
loop: false
references:
  - frames/001-hammer-loop/approved/frame_01.png   # THE base image: copy it exactly
  - reference/hjaas4.png
used_on: contracting scene; the site swaps in only her eye area, so she can blink during any hammer frame
---

# 002 — Blink

## What the animation shows
A natural blink, using the approved frame 1 of the hammer loop as the base. The site plays it as open → half → closed → half → open over about 150 ms, at random intervals.

## Frame-by-frame
| # | Pose / action |
|---|---|
| 1 | **Half-closed.** Upper eyelids come halfway down over her eyes, behind the glasses. Pupils partly hidden. |
| 2 | **Closed.** Eyes fully shut: a gently curved lid line inside each lens, lashes as on the model sheet. |

## Delivery for this task (overrides delivery-spec rules 1 and 4)
Make each pose as an **edit of `frames/001-hammer-loop/approved/frame_01.png`**: start from that exact image, change only what this task describes, and deliver **one image per pose** (not a sprite sheet). Keep the same framing and the same size as the base image if you can; if your output canvas must be bigger, keep Rachel and the box at the same scale and add flat pure green `#00FF00` around them. Background: flat pure green `#00FF00` or transparent. Editing the approved frame keeps her identical, which matters more here than having one sheet.

## Must stay identical in every frame
- Everything except the eyelids: glasses (frames and lens shapes), eyebrows, the rest of the face, hair, body, hammer, box, position and size in the cell
- Same size and lighting as `frames/001-hammer-loop/approved/frame_01.png`

## Avoid
- Changing the eyebrows, mouth or tongue
- Making the lenses look empty or skin-coloured (closed eyes sit behind the glass, like the model sheet's LOL frame)

## QC pass criteria (Wren checks these)
- Outside the eye area, each cell matches the base frame closely enough to align (Wren only uses the eye area)
- Lid shapes read as a soft, natural blink when played open → half → closed → half → open

## Revision notes
_(Wren writes here after each QC round)_

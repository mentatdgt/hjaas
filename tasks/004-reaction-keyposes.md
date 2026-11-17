---
id: 004-reaction-keyposes
status: open             # draft | open | delivered | changes-requested | approved
frames: 2
grid: separate images     # one image per pose, each an edit of the base frame
fps: 1                   # key poses for 005, not played directly
loop: false
references:
  - frames/001-hammer-loop/approved/frame_01.png   # THE base image: same body, box, size, position
  - reference/hjaas4.png                           # 03 DELIGHTED (bandana & bun) for the beaming face
  - reference/hjaas2.png                           # head turnarounds
used_on: contracting scene; the start and end poses that task 005's video fills in between
---

# 004 — Reaction key poses (look up, beam, thumbs up)

## What these are
The two "end" poses of the reaction a visitor sees after finding a mushroom. The motion between them is generated in task 005, so these poses must be clean and exact.

## Cell-by-cell
| # | Pose |
|---|---|
| 1 | **Beaming at the viewer.** Still kneeling exactly as in the base frame, hammer still in hand resting on the box, other hand still on the box. Her head lifts and turns so she looks **straight into the camera**, eyes open, with a big beaming smile (like 03 DELIGHTED on `reference/hjaas4.png`). |
| 2 | **Thumbs up.** Exactly cell 1, plus the hand that was steadying the nail now raised to about shoulder height, giving the camera a clear thumbs up. Hammer hand unchanged. |

## Delivery for this task (overrides delivery-spec rules 1 and 4)
Make each pose as an **edit of `frames/001-hammer-loop/approved/frame_01.png`**: start from that exact image, change only what this task describes, and deliver **one image per pose** (not a sprite sheet). Keep the same framing and the same size as the base image if you can; if your output canvas must be bigger, keep Rachel and the box at the same scale and add flat pure green `#00FF00` around them. Background: flat pure green `#00FF00` or transparent. Editing the approved frame keeps her identical, which matters more here than having one sheet.

## Must stay identical in both cells and to the base frame
- Kneeling body, legs, boots, hammer hand and hammer, the box, position and size in the cell
- Outfit, bandana, bun, glasses, pendant, lighting (warm light from the LEFT)

## Avoid
- Standing up, shifting her knees, moving the box
- A thumbs-up hand that looks detached: the arm must clearly come from her shoulder
- Closed "laughing" eyes in these poses (she should make eye contact)

## QC pass criteria (Wren checks these)
- Body and box line up with frame 1 of 001 (only head, face and the raised arm differ)
- Eye contact reads as looking at the viewer
- Thumbs-up hand has correct anatomy (four fingers curled, thumb up) and connects naturally to the arm

## Revision notes
_(Wren writes here after each QC round)_

---
id: 015-wink
status: approved             # draft | open | delivered | changes-requested | approved
frames: 2
grid: separate images     # one image per pose, each an edit of the base frame
fps: 24
loop: false
references:
  - frames/004-reaction-keyposes/approved/frame_02.png   # THE base image (K2: beaming, thumbs-up): copy it exactly
  - frames/002-blink/approved/blink_closed.png           # how closed lids look behind her glasses
  - reference/hjaas4.png
used_on: contracting scene; during the reaction's thumbs-up hold she gives one playful wink. The site swaps in only her eye area.
---

# 015 — Wink (on the thumbs-up)

## What the animation shows
At the end of the reaction, Rachel is beaming at the viewer with a thumbs-up (K2). During that hold she gives **one quick, playful, confident wink**. The site plays open → half → wink → wink (held) → half → open, over about 350 ms.

## Frame-by-frame
| # | Pose / action |
|---|---|
| 1 | **Half-wink.** The eye on the **viewer's right** (her left eye) is half closed: the upper lid comes halfway down behind the glasses. The other eye stays fully open. |
| 2 | **Wink.** That same eye is fully shut in a happy, upward-curving lid line (a smiling "^" crease, with lashes as on the model sheet). The cheek on that side lifts very slightly, and the eyebrow on that side dips a touch. The other eye stays fully open and bright, looking at the viewer. |

## Delivery for this task (overrides delivery-spec rules 1 and 4)
- Make each pose as an **edit of `frames/004-reaction-keyposes/approved/frame_02.png`**: start from that exact image, change only what this task describes, and deliver **one image per pose**, not a sprite sheet.
- Keep the same framing and size as the base image if you can. If your output canvas must be bigger, keep Rachel and the box at the same scale and add flat pure green `#00FF00` around them.
- Background: flat pure green `#00FF00` or transparent.

## Must stay identical in every frame
- Everything outside the winking eye area: the other eye, the glasses (frames and lens shapes), the mouth and beaming smile, the hair, bandana, body, thumbs-up hand, hammer, box, and her position and size.
- Same size and lighting as the base frame.

## Avoid
- Closing both eyes. It must clearly be a wink, not a blink.
- Changing the mouth shape, or adding a tongue.
- Lenses that look empty or skin-coloured. The closed eye sits behind the glass, like in `002-blink/approved/blink_closed.png`.
- A sleepy or sad lid. The wink curves upward and happy.

## Self-check loop (max 3 attempts)
Score each frame ✅/❌/⚠️ against this checklist:
- [ ] Only the viewer's-right eye changes; the other eye is open.
- [ ] Glasses unchanged.
- [ ] Mouth unchanged.
- [ ] The wink lid curves upward and happy.
- [ ] Everything else matches the base so it can be overlaid.

If anything is ❌ and attempts remain, redo it. Deliver the best attempt with an honest report.

## QC pass criteria (Wren checks these)
- Outside the eye area, each image matches the base frame closely enough to align (Wren only uses the eye area).
- Played open → half → wink → half → open, it reads as one confident, charming wink.

## Revision notes
### Round 1 (2026-11-17): APPROVED after Wren compositing
- Quinn chose half-wink attempt 3 and full wink attempt 2 (1403×1121, ≈2.45×). The face was redrawn slightly, so only the eye, lid and eyebrow area of the viewer's-right eye was used, registered onto the 2× K2.
- While doing this, Wren found a lumpy outline on the 2× K2 thumb, carried over from the old K2. It was replaced with Quinn's clean thumb from the same delivery. `frames/016-upscale/approved/K2.png` and `005/approved/rx_K2.png` are updated.
- Output: `frames/005-reaction-motion/approved/rx_wink_half.png` and `rx_wink.png`. In `reaction.json` the thumbs-up hold is now K2 300 ms → half-wink 50 → wink 260 → half-wink 50 → K2 240.

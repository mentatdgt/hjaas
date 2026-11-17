---
id: 015-wink
status: open             # draft | open | delivered | changes-requested | approved
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
_(Wren writes here after each QC round)_

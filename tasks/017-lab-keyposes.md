---
id: 017-lab-keyposes
status: approved             # draft | open | delivered | changes-requested | approved
frames: 9                 # 1 anchor + 8 poses
grid: separate images     # one image per pose, all 1672×941, all registered to the lab plate
references:
  - reference/mockups/mockup-lab-1-trolley-CHOSEN.png   # THE ANCHOR the user chose. Start everything from it.
  - reference/hjaas6.png    # lab look: white lab coat, dark top, gold pendant, olive cargo pants, brown boots, round glasses, low ponytail
  - reference/hjaas7.png    # lab-ponytail expressions (03 "Delighted" for the beam)
  - scene/mushroom-lab.png  # the empty lab plate (the anchor's background)
used_on: scene 2 ("Grow"), the mushroom lab. These are the KEY poses; Wren builds the motion between them.
---

# 017: Rachel in the lab, key poses (anchored on the chosen mock-up)

## The anchor
The user chose `reference/mockups/mockup-lab-1-trolley-CHOSEN.png`: Rachel standing behind a small stainless trolley on wheels, misting a tray of oyster mushrooms, with a clipboard on the trolley. **Every image in this task is an edit of that image.**
- Keep Rachel, the trolley, the tray and the props at exactly the same position, size and canvas (1672×941).
- Change only what each step says.

## Step 0: fix the anchor, then make the green version
**0a. `017_anchor_scene.png`:** the chosen mock-up with ONE fix. The **clipboard is the wrong way round.**
- Rotate it so it faces Rachel, readable from where she stands: the clip at the end farthest from her, the paper's top edge pointing away from her.
- Nothing else changes.

**0b. `017_anchor_green.png`:** the same image as 0a, but the room replaced by **flat pure green `#00FF00`.**
- Keep Rachel, the trolley, the tray, the jars and bottle on it, and the clipboard at exactly the same pixels, position and size.
- No floor, no shadow, no room.

**From here on, every pose is an edit of `017_anchor_green.png`:** the same 1672×941 canvas, green background, Rachel and the trolley in exactly the same place.

## The routine (for context)
Calm and unhurried:
- a few slow sprays of the tray;
- then she sets the bottle down, picks up the clipboard and writes, glancing at the tray;
- then back to misting.

When a visitor finds a mushroom, she looks up at them, beams and gives a thumbs-up.

## The eight poses (edits of `017_anchor_green.png`)
| # | File | Pose |
|---|---|---|
| 1 | `017_A1_mist_aim.png` | **Base pose, as in the anchor:** spray bottle in her right hand aimed at the tray, finger on the trigger, left hand resting on the trolley, looking at the tray, soft smile. Should be almost identical to the anchor. |
| 2 | `017_A2_mist_squeeze.png` | Same as 1, but the trigger is squeezed and a soft, fine, translucent mist cone sprays over the tray. Nothing else moves. |
| 3 | `017_A3_mist_lift.png` | Same as 1, but the bottle is lifted a little and tilted, as between sprays; she watches the mist settle. Nothing else moves. |
| 4 | `017_B1_write.png` | **Writing:** the bottle stands on the trolley beside the tray. She holds the clipboard (facing her) in her left hand at chest height and writes with a pen in her right hand, looking down at it. Body, feet and trolley exactly as in 1. |
| 5 | `017_B2_glance.png` | Same as 4, but her head and eyes turn slightly toward the tray, checking something; the pen pauses. |
| 6 | `017_A1_blink_half.png` | Exactly pose 1, with her eyes half closed behind the glasses. |
| 7 | `017_K1_beam.png` | From pose 1: she lifts her head and looks **straight at the viewer** with a big, warm, beaming smile (like expression 03 "Delighted" in `hjaas7.png`). Only her head and neck turn; the bottle stays in her lowered right hand, and her left hand stays on the trolley. |
| 8 | `017_K2_thumbs.png` | Same as 7, but her **left** hand comes up off the trolley in a confident thumbs-up beside her shoulder. Same beaming face; everything else as 7. |

## Must stay identical across all poses
- Her outfit (`hjaas6.png`), hair and ponytail, glasses, pendant and proportions.
- Her feet and legs.
- The trolley, its wheels, the tray and its mushrooms, and the canvas position and size.
- Line weight, flat colours and soft cel shading as in the anchor. Key light from the left.

## Avoid
- Redrawing her from scratch, or changing her size or position.
- Shadows, a floor or a room in the green images.
- A hurried or exaggerated look; this scene is calm.
- Text inside the images.

## Self-check loop (max 3 attempts per image)
Compare each image **side by side with `017_anchor_green.png`** and score ✅/❌/⚠️:
- [ ] Same canvas, and Rachel and the trolley in the same position and size.
- [ ] Only the described change was made.
- [ ] Outfit, glasses and ponytail match `hjaas6.png`.
- [ ] Flat green background (0b onwards), no shadows.
- [ ] The clipboard faces her (0a onwards).

Deliver all ten files (0a, 0b and the 8 poses) with an honest report.

## What Wren does next
1. QC and stabilisation against the anchor.
2. An upscale for phones.
3. Video in-betweening: bottle down / clipboard up, look up → beam → thumbs-up.
4. Timing (the misting routine is slow), then a hand-off to the site.

## Revision notes
_(Wren writes here after each QC round)_

### Round 1 (2026-11-19): APPROVED 7 of 8; B2 replaced by a video loop
- **No glasses** in these poses, at the user's instruction to Quinn (scene 1's Rachel wears glasses; the user may want to confirm this is intended).
- Lower body, boots, wheels and trolley are pixel-identical across poses, and all poses are registered to the lab plate (1672×941; draw at 0,0).
- **Approved and keyed** (transparent): `approved/A1_mist_aim`, `A2_mist_squeeze`, `A3_mist_lift`, `B1_write`, `A1_blink_half`, `K1_beam`, `K2_thumbs`.
- **B2_glance rejected:** the whole head was redrawn (it would jiggle against B1), and one eye is half-lidded and lopsided. The writing loop will instead be a short Higgsfield clip that starts and ends on B1 (pen moving, one glance at the tray), so it loops seamlessly.
- Minor, accepted: a small sleeve redraw in A3.
- Next (Higgsfield, quoted first): A1→B1 (bottle down, clipboard up), the B1 writing loop, A1→K1 (look up and beam), K1→K2 (thumbs-up). Optionally a 2× upscale of the drawn poses for phones.

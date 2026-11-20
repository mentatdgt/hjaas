---
id: 020-film-scene
status: open             # draft | open | delivered | changes-requested | approved
frames: many              # see the lists below
grid: separate images     # one image per file, ALL the same size as 020_scene.png and registered to it
references:
  - frames/019-film-staging/incoming/019_r2.png   # the approved staging. Start from this.
  - reference/hjaas1.png    # Rachel: black tank, loose wavy dark-brown hair. NO glasses, ever
  - reference/hjaas3.png    # Rachel's loose-hair expressions (warm smile for the look-back)
used_on: scene 4 ("Film"). Wren turns these into the site animation.
---

# 020: The film scene, everything needed for animation

Work in order. **Every image after step 1 is an EDIT of `020_scene.png`**: same canvas size, same position and size of every person and object. Never redraw anything from scratch, so all the pieces stay lined up.

## Step 1: `020_scene.png` (the final scene). Then STOP for approval.
Edit `019_r2.png` and change only these:
1. **Move Rachel right** by about 7% of the width, together with her camera, same size and crop, so her camera lens is clearly clear of the presenter's raised hand: a gap of background at least 4% of the width between them. Her head ends up at about 66–80% of the width.
2. **Camera screen:** the screen on the back of her DSLR (the side facing us) is a plain, flat, dark-grey rectangle with a thin bezel. Nothing on it: the site draws the picture and the red recording dot there.
3. Fill in naturally where Rachel used to be (car, hedge, paving).
4. Keep everything else exactly: the presenter, the car, the Merlion and its water, Marina Bay Sands, the light. No glasses on Rachel. No text.

## Step 2: `020_plate.png` (the empty scene)
The same image as `020_scene.png` with **Rachel, the presenter and the Merlion's water (the arc and the splash in the bay)** removed, and what was behind them filled in naturally. Keep the car, the Merlion statue, the bay, everything else. Every pixel outside the removed areas stays identical.

## Step 3: a green anchor for each moving piece
Same image as `020_scene.png`, but everything except that piece is replaced by **flat pure green `#00FF00`**. The piece stays at exactly the same pixels. No shadows, no floor.
- `020_rachel_green.png`: Rachel plus her camera, cut along the bottom edge of the frame.
- `020_man_green.png`: the presenter, head to shoes (not his shadow, not the car).
- `020_water_green.png`: the water arc from the Merlion's mouth plus the splash where it hits the bay.

## Step 4: poses, each an edit of that piece's green anchor
Same canvas, green background, piece in exactly the same place. Change only what's described.

**Rachel** (seen from behind, so no blink needed):
| File | Pose |
|---|---|
| `020_R_A1_film.png` | **Base:** exactly the anchor, filming the presenter. |
| `020_R_B1_glance.png` | She tips her head down a little to check the camera screen. A touch more of her cheek shows. Camera and hands stay put. |
| `020_R_K1_look.png` | **Reaction:** she turns her head and shoulders to look back over her right shoulder, straight at the viewer, with a warm, genuine smile (like "warm smile" in `hjaas3.png`). Camera stays in her hands, lowered slightly. No glasses. |
| `020_R_K2_peace.png` | The same as K1, plus a small peace sign with her free hand near her shoulder. |

**Presenter** (lively, mid-sentence; every gesture stays on HIS side, never closer than 4% of the width to Rachel's camera):
| File | Pose |
|---|---|
| `020_M_1.png` | **Base:** exactly the anchor, both hands open, mouth open, talking. |
| `020_M_1_closed.png` | Exactly M_1 with his mouth closed in a smile (for lip-flap). |
| `020_M_1_blink.png` | Exactly M_1 with his eyes closed. |
| `020_M_2.png` | He points back over his shoulder at the Merlion with his right hand (on our left); his other hand rests at his waist. Mouth open. |
| `020_M_3.png` | Both hands together in front of his chest, as if making a point. Mouth open. |

**Water** (a hand-drawn loop: same path, different breakup):
| File | Pose |
|---|---|
| `020_W_1.png`, `020_W_2.png`, `020_W_3.png` | The arc and the splash. The arc's path and thickness stay identical; only the streaks, droplets and splash shapes change, so that cycling them looks like flowing water. |

## Delivery
- All files above, named exactly, each **exactly the same size as `020_scene.png`**. If you can make `020_scene.png` larger than 1672×941 (your native size, e.g. 2580×1432), do: it's sharper on phones. Then keep every later file at that size; never resize or crop.
- One contact sheet of all of them.
- An honest report of the self-check.

## Self-check (max 3 attempts per image)
- [ ] `020_scene` has the step-1 changes and nothing else changed.
- [ ] `020_plate` is identical to `020_scene` outside the removed pieces.
- [ ] Every green anchor and pose overlays `020_scene` exactly: same position and size. Put each on top of the scene to check.
- [ ] Each pose changes only what's described.
- [ ] Rachel: loose wavy hair, no bandana, no glasses, black tank.
- [ ] The presenter's hands never come within 4% of the width of Rachel's camera, in any pose.
- [ ] Flat green backgrounds, no shadows, no text.

## Notes for Wren and Fable (not for Quinn)
- **Layers:** plate → water → presenter → Rachel.
- **Water:** cycle W_1–3 at about 8–10 fps with short crossfades. Add a subtle shimmer to the bay reflections in code.
- **REC light and screen:** code, no art. Draw a blinking red dot (about 1 s cycle) on the camera screen. Proposed: the screen shows a live, scaled copy of the presenter layer.
- **Phone window:** shifted for this scene to about 37–85% of the width, so both people fit.
- **Higgsfield clips** (quote first): Rachel A1→B1 (glance) and A1→K1 (look back), and the presenter M_1→M_2 and M_1→M_3. That's 4 × 4.5 = 18 credits, No upscales if the scene comes at 2580×1432.
- **Hunt nooks:** wheel arches, the bollard lamps, the railing posts, the planter kerb, the lit steps, paving cracks, the kiosk base.

## Revision notes
### Step 1 (2026-11-20, Wren): APPROVED from a screenshot preview
Rachel has moved right: her lens is now about 11% of the width clear of the presenter's hand. The camera screen is a plain dark rectangle, and nothing else has changed. Quinn continues with steps 2–4. The original is in `frames/020-film-scene/incoming/020_scene.png`, at **1672×941** (Quinn's output, the same size as scenes 1 and 2). Every step 2–4 file must be exactly 1672×941. Upscale the Higgsfield clips if phones need it.
Phone window note for Fable: her head now sits at about 72–85% of the width, so shift the window to about 37–85%.

### Round 1 (plate only, 2026-11-20): the car is too long
Seen in the plate, the car reads as a stretched limo: two rear doors and three side windows, with the wheels about 3.4 car-heights apart. In `020_plate`, shorten it to a normal fastback saloon: one front door and one rear door, two side windows, the wheels about 2 car-heights apart. Keep the nose, the front wheel and the colours where they are; move the rear wheel and the tail right. Fill in the promenade, railing and bollard behind. Also remove the faint ghost of the water jet in the sky. The anchors and poses are unaffected. Wren rebuilds `020_scene` as the plate plus the anchors once the new plate is in.

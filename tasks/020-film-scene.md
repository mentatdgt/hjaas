---
id: 020-film-scene
status: approved                     # draft | open | delivered | changes-requested | approved
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

### QC round 1, batch 1 (2026-11-20, Wren)
All 16 files are 1672×941, with pure `#00FF00` backgrounds. Every anchor matches the scene pixel for pixel. The car is now a normal fastback (wheelbase about 2.2 car-heights), and the water ghost is gone. Clearance between the presenter and the camera is 81 px or more in every pose.
- **PASS → `approved/`:** the three anchors; R_A1, R_B1; M_1, M_1_closed, M_1_blink, M_2, M_3; W_1–3.
- **Wren fixes:** `approved/020_plate.png` gets the presenter's ground shadow back from the original scene (his feet never move, and without it he floated). `approved/020_scene.png` is rebuilt as the plate plus W_1, M_1 and R_A1, so it now has the shorter car.
- **Accepted:** M_2 points left, toward Marina Bay Sands and the spout, not at the Merlion. The brief had the side wrong, and it reads well. The peace-sign pose is dropped.
- **FAIL:** `020_R_K1_look.png`: **Rachel wears glasses.**

### Round 2 (Quinn)
Redo `020_R_K1_look.png` only, as an edit of `020_rachel_green.png`: the same look back over her shoulder with a warm smile, the same hair, tank, camera and hands, **with no glasses at all**. Draw the bare eyes as in `reference/hjaas3.png` "warm smile", without the frames. Keep her waist and shorts at exactly the same pixels. 1672×941, green background.

### QC round 2 (2026-11-20, Wren): APPROVED
`020_R_K1_look` has no glasses, a warm smile and bare eyes, and the waist and shorts match the anchor exactly. All 14 pieces are in `approved/`. Next: Higgsfield in-betweens (quote first).

### Round 3 (Quinn): restyle Rachel to the new master look
While 020 was in progress, the café chat approved Rachel's master look, `reference/rachel/M01_rachel_model.png`. BIBLE §2 now requires it for every scene. Scene 4's Rachel was drawn from the old sheets, so her four files need the same restyle the café got. **The presenter, water, plate and scene stay as they are.**

Files, each an EDIT of the current approved file, 1672×941, flat `#00FF00`: `020_rachel_green`, `020_R_A1_film`, `020_R_B1_glance`, `020_R_K1_look`.
- **Hair:** M01's hair: big, soft waves with volume, M01's brown, drawn as a few solid shapes with **one** hard shadow tone. No gradients, no gloss. It may grow a little up and out to the right, but **never further left than now** (it must stay clear of the presenter's hands).
- **Skin:** M01's warm tan, flat plus one hard shadow tone.
- **K1 face (eye rule):** big round white eyes, each about ¼ of the face's width, almost touching; the small curved "C" nose overlaps their inner edges; dot pupils, no lashes. A warm smile like M01's. **No glasses.**
- **Unchanged pixels:** camera, hands, arms' position, tank top, shorts, and the bottom crop. B1 stays a head tip toward the camera; K1 stays a look back over her shoulder at the viewer.
- Outline weight: the same as the presenter's.

Self-check: all four files keep the same pose differences; the hair never extends further left than before; there are no glasses; and the A1 and K1 hair and skin colours match M01. Deliver the four files plus one image of A1 and K1 next to the M01 face.

### QC round 3 (2026-11-20, Wren): close; three fixes
Registration is perfect: the camera, hands, tank, shorts and bottom crop are pixel-identical; the hair never goes further left than x 1017 (999 in K1); the green is pure. The hair now has M01's volume and colour. See `incoming/round3/wren_r3_on_plate.png`.
1. **K1 eyes:** the whites have no outline and are a touch small. Use M01's eyes: round whites with the **same thick dark outline** as the rest of her, each about ¼ of the face's width, almost touching, with the "C" nose overlapping their inner edges.
2. **A1, B1 (and rachel_green) hair shadow:** the one big dark blob in the middle of the back of her hair reads as a hole. Replace it with **2–3 narrow dark strands following the waves**, like the inner layers on M01. Same silhouette.
3. **Skin:** her arms, shoulders and hands are still the old pale peach, so in K1 they don't match her new orange-tan face. Recolour all her visible skin (all four files) to M01's warm tan, with one hard shadow tone. Shapes and pixels' positions stay identical.
Everything else stays.

### Round 3, presenter additions (user, 2026-11-20): he must look like he's talking in every pose
Lip-flap is done in code by swapping mouth frames, so every held pose needs a closed mouth. Each file is an edit of the existing one, nothing else changes:
- `020_M_2_closed.png`: M_2 with his mouth closed in a smile.
- `020_M_3_closed.png`: M_3 with his mouth closed in a smile.
- `020_M_1_mid.png`: M_1 with his mouth half open (a third mouth shape for lip-sync).
Higgsfield prompts will say "talking animatedly". If a clip's mouth looks wrong, Wren overlays the drawn mouth frames instead.

### QC round 3b (2026-11-20, Wren): APPROVED
- **Rachel (4 files):** the silhouettes are identical to round 3 (0 px mask difference). The hair shadow is now narrow strands, all her skin is M01's warm tan, and K1's eyes are outlined, almost touching, with the C nose overlapping. No glasses.
- **Presenter:** M_1_mid, M_2_closed and M_3_closed change only the mouth (about 40×30 px), so all three poses now lip-flap.
- `approved/` is updated; the old Rachel files are in `pre-round3/`. `approved/020_scene.png` is rebuilt (plate + W_1 + M_1 + R_A1).
- **Talking:** cycle M_x ↔ M_x_closed (+ M_1_mid in M_1) at about 4–7 swaps a second, with pauses; random blinks in M_1.
- Next: Higgsfield, clip 1 first (M_1 → M_2, 4.5 credits), after the user's OK.

# HJaaS Batch 02 — delivery and QC
Date: 17 November 2026
Reviewer/illustrator: Quinn

## Result
Four best source candidates delivered after three attempts per image (12 generations total).
None receives an all-pass verdict. The generator enlarged/redrew the artwork, so the images do not meet the original-frame scale/alignment requirement. They need alignment and local cleanup before production use. No repository files or task statuses were changed.

## Step 0 and source provenance
Read in full on main: tasks/BATCH-02.md, tasks/README.md, reference/README.md, tasks/002-blink.md, tasks/004-reaction-keyposes.md.
Opened and studied exact frames/001-hammer-loop/approved/frame_01.png.
Visually inspected reference/hjaas4.png (03 DELIGHTED) and reference/hjaas2.png in GitHub.
Main observed at packaging: cda4b3016a0d7e8d7622c9ab2a8740b4c0f4f100.
Base image Git blob SHA: 1fea9d3d7da79c826ddc9357b28246028753ad49.
BATCH-02.md Git blob SHA: 1c9b5e3be27a23af5e3de17a8abc45d3aac67a1f.
hjaas4.png Git blob SHA: e3568244fd8f2fa184b05abe9eea9a7bee1b9a22.
hjaas2.png Git blob SHA: 4205a5482b73dc76cdb041469ca880d89569d76c.
Images #1, #2 and every #3 attempt used the exact approved base as the edit input.
Every #4 attempt used selected image #3 attempt 3 as the edit input.
Image #3 is a selected best candidate under the three-attempt rule, not an all-pass approved asset.

## Review method and limits
Visual side-by-side comparisons with the appropriate source; reduced comparison views made only for internal inspection. Delivered PNGs are unmodified generation outputs.
Dimensions read from PNGs; transparency and alpha > 0.5 bounds inspected programmatically.
✅ = the stated visible criterion was checked and passed.
❌ = a requirement visibly failed.
⚠️ = fine detail differs, exact identity cannot be confirmed, or a criterion was not fully verified.
A retained pose is not a claim of pixel identity. Partly occluded gripping hands cannot have all five digits independently counted. No animation playback or in-site test was performed.

## Selected outputs
| Image | Task / pose | Attempt delivered | Size | File |
|---|---|---|---|---|
| #1 | 002 / half-closed | 1 of 3 | 1403 × 1121 px | 002-blink-half-closed.png |
| #2 | 002 / fully closed | 1 of 3 | 1403 × 1121 px | 002-blink-closed.png |
| #3 | 004 / beaming at viewer | 3 of 3 | 1403 × 1121 px | 004-reaction-beaming.png |
| #4 | 004 / beaming + thumbs up | 2 of 3 | 1403 × 1121 px | 004-reaction-thumbs-up.png |

## Image #1 (002, half-closed)
Delivered attempt 1. Size 1403 × 1121 px.
- ✅ Both upper lids descend over the pupils; visible eye portions remain white.
- ✅ Warm tan lids rather than blank white lids; half-blink reads clearly.
- ⚠️ Glasses/lens outlines recognizable and retained, but exact shape identity not guaranteed.
- ⚠️ Eyebrows, mouth and tongue visually retain the source expression; fine lines are redrawn.
- ⚠️ Grey zigzag/dot bandana, bun and curls retained in appearance, not verified identical in every mark.
- ✅ Same recognizable kneeling pose; no added body parts.
- ⚠️ Gripping hands inspected; digits overlap and not all five can be independently counted.
- ❌ Everything except eyelids identical: enlarged output and small redraw differences.
- ❌ Original 573 × 458 px canvas / subject pixel scale retained.
- ✅ Warm light from the left retained.
- ✅ Transparent PNG background.
- ✅ Avoids empty or uniformly skin-coloured lenses.
- ❌ Outside-eye alignment with base: not ready for a direct eye-area swap.
- ✅ Soft half-blink shape on visual inspection.
- ⚠️ Natural full blink sequence/cadence not tested in playback.
Known issues: enlargement, small geometry/line drift, no production alignment pass.

Attempt log:
1. Selected: best retained source appearance; failed original scale/alignment.
2. Smaller top-left composition, but scale/geometry still shifted and a brown glow was added; rejected.
3. Green-background attempt changed glasses and source geometry more; rejected.

## Image #2 (002, fully closed)
Delivered attempt 1. Size 1403 × 1121 px.
- ✅ Two gentle closed-lid curves; no visible pupils.
- ✅ White lenses remain visibly present; not empty or skin-coloured.
- ⚠️ Glasses outlines recognizable; exact contour identity not established.
- ⚠️ Eyebrows, mouth and tongue visually retain source expression; fine details redrawn.
- ⚠️ Bandana motif, bun and curls retained in appearance with fine differences.
- ✅ Same recognizable kneeling pose and hand placements.
- ⚠️ Gripping/steadying hands checked visually; occluded digits prevent a full independent count.
- ❌ Everything except eyelids identical.
- ❌ Original canvas and pixel scale retained.
- ✅ Warm light from the left retained.
- ✅ Transparent PNG background.
- ❌ Outside-eye alignment with base.
- ✅ Soft closed-eye shape.
- ⚠️ Open–half–closed–half–open playback not tested.
Known issues: enlargement, small non-eye redraw differences. Closed-lid lines are readable, but the frame needs local alignment/cleanup.

Attempt log:
1. Selected: simple natural lid curves and closest overall retained appearance.
2. Pendant, bandana and clothing changed more; scale still wrong.
3. Extra lashes, enlarged canvas and fine redraw differences; not better overall than attempt 1.

## Image #3 (004, beaming at viewer)
Delivered attempt 3. Size 1403 × 1121 px.
- ✅ Head faces the camera with two open eyes and two visible pupils.
- ✅ Direct eye contact and broad delighted smile.
- ✅ Same recognizable kneeling body, knees, boots and forward lean.
- ✅ Both hands stay in their original roles; no premature thumbs up.
- ⚠️ Hammer hand and steadying hand visually inspected; overlap prevents full digit count.
- ❌ Body, legs, boots, hammer hand, hammer, box, position and pixel size identical to base: enlarged/redrawn.
- ⚠️ Outfit, glasses, pendant, bandana motif and bun retained in appearance; hair/bandana details differ.
- ✅ Warm light from the left retained.
- ✅ No standing up or gross knee/box repositioning.
- ✅ Open eyes rather than closed laughing eyes.
- ❌ Body/box line up with original frame at native pixel scale.
- ❌ Only head angle/face changed: small changes outside permitted area remain.
- ✅ Transparent PNG background.
Known issues: enlargement; changed bun/bandana and facial proportions; minor non-head redraw. Best candidate selected, not all-pass approved.

Attempt log:
1. Strong delight and eye contact, but larger facial proportions and changed bun; scale failed.
2. Smaller smile, changed neck and tank outline; scale failed.
3. Selected: broad smile and shorter neck, with good retained overall pose; strict identity/alignment still failed.

## Image #4 (004, thumbs up)
Delivered attempt 2. Size 1403 × 1121 px. Edit source: image #3, attempt 3.
- ✅ Same open-eyed beaming expression and direct gaze retained visually.
- ✅ Correct steadying arm raised; foreground hammer arm remains in its original role.
- ✅ Clear upright thumb.
- ✅ Four curled fingers counted in the raised fist, plus one thumb: five digits.
- ✅ Wrist and forearm connect continuously to the shoulder; no detached hand.
- ✅ Raised hand at about shoulder height.
- ✅ No extra steadying hand remains on box.
- ⚠️ Foreground gripping hand partly occluded; not all five digits independently countable.
- ✅ Same recognizable kneeling body/legs/boots and box composition as selected #3.
- ⚠️ Hammer/box, face, glasses, bandana and bun closely retained relative to #3, but fine contours/edges differ.
- ❌ All non-arm artwork identical to #3: small redraw differences remain.
- ❌ Body/box align with original approved frame at native scale: inherits #3 enlargement.
- ✅ Warm light from left retained.
- ✅ No standing up, gross knee/box movement, detached hand or closed laughing eyes.
- ✅ Transparent PNG background.
Known issues: inherited scale mismatch to frame 1, minor edge/prop drift from #3. Correct readable anatomy is not a claim of complete alignment.

Attempt log:
1. Clear anatomy, slightly shifted bun contour and fine differences.
2. Selected: good source retention and clear four-finger fist/one-thumb anatomy.
3. Also readable, but bun edge and nail/prop details changed; not better than attempt 2.

## Measured alignment evidence
Bounds use alpha > 0.5, inclusive pixel coordinates; they are a diagnostic, not a full registration test.
| Image | Canvas | Opaque bounds x,y to x,y | Opaque extent |
|---|---|---|---|
| Approved base | 573 × 458 | 9,21 to 563,448 | 555 × 428 |
| #1 selected | 1403 × 1121 | 22,51 to 1381,1093 | 1360 × 1043 |
| #2 selected | 1403 × 1121 | 21,51 to 1380,1101 | 1360 × 1051 |
| #3 selected | 1403 × 1121 | 22,46 to 1383,1095 | 1362 × 1050 |
| #4 selected | 1403 × 1121 | 22,45 to 1382,1094 | 1361 × 1050 |

The generation process did not preserve the base pixel scale. All four need registration and local cleanup before Wren can approve/use them.


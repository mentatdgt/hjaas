# 018 café — approved-base asset set

## Delivery

28 scene assets, each exactly **2580 × 1432 PNG**: the unchanged approved scene, the empty plate, six green anchors, and 20 poses. Two additional contact sheets show full-canvas placement and enlarged details; contact-sheet dimensions differ from production assets.

The repository’s approved `frames/018-cafe-scene/approved/018_scene.png` was the source for this set. Earlier 1672×941 outputs were not reused. The approved source canvas was never resized or cropped. Generation ran one image at a time, in plate → anchors → poses order, with independent visual and numerical review.

## Self-check result

| Check | Result |
|---|---|
| Required filenames/count and 2580×1432 canvases | PASS: all 28 assets |
| Approved scene unchanged | PASS: original source file included |
| Six anchors preserve original RGB at the original coordinates | PASS: zero foreground RGB mismatches |
| Base sketch / polishing / colouring / reading / sleeping holds | PASS: five exact anchor copies |
| Edited poses preserve pixels outside their declared edit regions | PASS: zero differences outside those regions for all 15 edits |
| Requested actions, gaze directions, original style and no Rachel glasses | Visual PASS |
| Flat #00FF00 anchor/pose backgrounds, no floor or cast shadows | Visual PASS; fine matte edges remain approximate |
| Mum remains in the plate | PASS |
| Plate preserves every pixel outside actual removed actors/shadows | **PARTIAL / strict requirement not fully met** |

## Important limitations

**The plate is a usable visual reconstruction, not a pixel-perfect removal plate.** All moving characters and Rachel’s furniture/props are removed; the mum remains. The child’s chairs/table, old man’s chair/table/kopi, espresso machine, grinder and décor remain in the composition. However, some previously visible furniture and background pixels within broader reconstruction regions were replaced by generated equivalents. Hidden chair portions were also reconstructed. Minor floor tonal transitions and small furniture differences remain.

The plate has 721,944 changed pixels and zero changes outside its declared reconstruction mask. That mask is broader than the actual removed silhouettes. This measurement therefore **does not certify** the stricter preservation requirement. Mum pixels and protected kopi/table/pedestal/grinder regions were retained from the source.

**Editor resolution:** full-scene generation returned approximately 1684/1685×934 intermediates. Only local reconstructed fill was mapped onto the original 2580×1432 canvas. Close-up references were also used for masks and pose edits, then mapped locally to that same canvas. No production canvas or approved scene was shrunk, enlarged or cropped, but generated local detail was resampled. The result is not a claim that every generated detail was rendered natively at 2580×1432. Some fill is softer, and some pose detail sharper, than its surroundings.

**Cutout edges:** retained anchor colour pixels are exact source pixels; silhouettes are not mathematically perfect segmentations. Some soft edges and hair wisps are approximate by about 1–2 pixels. The automatic child matte was rejected because it included furniture/background. It was replaced with a hand-traced native-coordinate mask retaining the visible child, held crayon and two knee components.

**Pose exactness:** unchanged regions outside edit masks are exact. Inside generated edit regions, small shading, line or shape differences can accompany the requested movement. Foreground-only blending corrected visible joins on Rachel’s sip/viewer-look and barista polishing holds. The old man’s lifted-page pose required local cleanup of the previous forearm silhouette. These edits pass normal-size visual review; they are not a guarantee of zero animation shimmer at every boundary.

## Pose review

- Rachel: base sketch, small stylus stroke, skin-coloured half-blink, contented eyes-closed sip with one cup and saucer and stylus on the table, and a warm viewer look. No glasses or extra iPad screen.
- Barista: three empty handled-cup/white-cloth polishing holds; B_4 looks down-left toward Rachel with a friendly smile and the original hands/props.
- Child: two colouring holds; C_3 looks up-right toward his mum and grins with the crayon raised. Lower visible knees stay anchored and table occlusion remains green.
- Old man: reading, a lifted right page corner, and a settled new spread with turned-page folds/layout. Newspaper graphics are abstract blocks, with no readable text. Kopi remains in the plate, not the green assets.
- Cat: sleeping, a subtle but visible upper-body breathing change, and a clearly raised front tail tip. Other regions stay anchored.
- Mum: half-closed and fully closed skin-coloured eyelids. Only the declared eye band changes; the rest of her anchor is exact. The mum also remains in the plate as requested.

## Attempts

Plate: two generated passes. Each anchor: one generated matte, with source-colour restoration and manual child-mask correction. Each of the 15 edited poses: one generated edit; five base poses are exact copies. No image exceeded three generation attempts. Local mask and join refinements were compositing corrections, not additional generations.

Per-file QC JSON and aggregate registration checks are included. The contact sheets are review aids; production PNGs retain their complete original canvas and positions.

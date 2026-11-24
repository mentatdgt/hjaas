---
id: 022-theatre-scene
status: approved           # preview v3 OK'd by the user 2026-11-21 21:13 ("okay for now"); tab name "Set Design"
type: scene
---
# 022: Scene 5, set design (theatre backdrop)

Chosen 2026-11-21 from mock-ups 021a–e (A, theatre backdrop). The user restored mock-up A's busyness (seats, ropes, dripping pots); only the hem gap, the wing and the ladder pot were added (job 021g). Outfit: white tank, navy cargos (job 021i). Locked scene: `frames/022-theatre-scene/incoming/022_scene_LOCKED_1536x1024.png`.

## Pieces (Quinn loop jobs, all QC'd by Wren)
- 022a plate (Rachel removed; no change outside her box)
- 022b/c Rachel's poses: A2_stroke_low, A3_stroke_out, A1_blink, B1_lean, B2_dip, K1_salute (crops of the locked scene)
- 022d stagehand boot, facing each way
- 022e finished backdrop (changes only inside the backdrop)

## Built by Wren
- `tools/theatre_build.py`: Rachel's stills = base cut against the plate + only the moving part, colour-matched.
- `tools/theatre_lamp.py`: lamp cut out, plate filled behind it, 36 rigid pendulum frames.
- `tools/theatre_walk.py`: boots as rigid sprites (roll off the toe, arc, land on the heel), 30 fps tracks, clipped to the gap under the hem.
- `tools/theatre_package.py`: site package (café format) + 10 backdrop patches spreading rightward from the painted edge.
- `tools/theatre_preview.py`: preview video.

## Package: `frames/022-theatre-scene/site/`
Layers in order: backdrop_01..10 (hunt progress), stagehand (sprite track + mask), lamp, rachel. See `routine.json` notes.

## 2026-11-22: gap mask closed over the curtain (Fable's review 01)
Fable's build review found the boots drawn over the right-hand curtain at the end of the walk back (plate x 1560–1672): the curtain's shadowed folds passed the mask's darkness test. `tools/theatre_walk.py` now closes the mask from the curtain's left edge rightward, row by row; `tools/theatre_package.py` keeps the mask at the full 1672 px width. Only `stagehand/gap_mask.png` changed (identical left of x 1480); the rebuild matches the package; QA ALL OK; preview re-rendered (v4, walk timing unchanged).

## 2026-11-23: the stagehand's walk, drawn (Quinn jobs 022g, 022h, 022i)
The user found the boots unnatural (too small, rigid sliding sprite), then jerky, and saw boots with "no person" at the ends.
- **Drawn walk cycle:** Quinn drew 8 keys (022g) and 8 in-betweens (022h) of the boot walking, in `approved/quinn/walk/`. `tools/theatre_walk.py` steps each foot through the 16 drawings (~15 drawings/s), pinning the heel (W01–W03b) or the toe tip (W04–W05) to the floor, and carrying the boot through the air from toe-off to the next heel strike. Track at 60 fps. Boot size: a man's work boot (SOLE_W 66 Quinn px). The far foot is the same, 15% darker. `walk.json` now names a sprite per boot (`s`), from `sprites` (L_W01…, R_W01… mirrored).
- **The ends:** the boots only show under the backdrop's hem. Left: the mask closes at the backdrop's left edge (x 338 Quinn), so he goes behind the leaning flat. Right: Quinn painted the backdrop into the dark slot beside the curtain (022i, both bare and finished); `tools/theatre_extend_backdrop.py` takes only that slot (`approved/quinn/ext/slot_mask.png`), colour-matched, and heals the old edge line. The backdrop now runs behind the curtain, and the boots go straight from under the hem behind the curtain.
- Checked: QA ALL OK; rebuild identical; no backward moves or jumps in the track; backdrop stages 0–10 clean including the new strip; both ends frame by frame. Preview at 60 fps.

## 2026-11-23 (later): the stagehand seen whole where he would be; the backdrop extension undone
The user rejected extending the backdrop ("you cheated"): the stagehand must be shown, from his character sheet. Undone (plate, patches and pencil map back to the originals, pixel-identical). Now:
- **Full-body walk:** Quinn drew him walking in 16 poses (022j: B01–B08 pass; 022k: B09–B16 failed QC, redone as 022l). `tools/theatre_body_inputs.py` made each pose's canvas with his two boots placed exactly where the boot track has them at that moment, so his legs go into the same boots.
- **In the scene** (`tools/theatre_walk.py`): under the hem only the boots (60 fps). While any part of him could be in the open slot between the backdrop and the curtain, the whole drawn man is shown (one drawing per moment, placed by his near boot), clipped to `body_mask` (slot + gap). He starts and ends behind the curtain (X_RIGHT 1610). The switch to boots-only happens behind the paint cart, at a moment's middle where boots and drawing agree. Body shaded for backstage: as lit as the boots at the floor, darker towards his head. Walking left he goes out of sight at the leaning flat (mask closed left of the backdrop).
- Body sprites: left-facing only, mirrored (`flip`) for the walk back, to save memory.
- Fable round-2 brief: `reviews/scene-5-build-round2.md`.
- **022l passed (2026-11-23 20:30):** B09–B16 boots identical, arms and bob right. All 16 final in `approved/quinn/body/`. Keying fills the small green flecks at the shin seams. Steady hips: Quinn drew him centred between his feet, which made his body move in bursts; `theatre_walk.py` now leans each drawing's legs (0 at the cuffs, full at the hips, up to ±20 Quinn px) so his body travels at the walking pace while the boots stay pinned. Checked: both crossings frame by frame at 1:1, 60 fps clip; QA ALL OK; rebuild identical.

## 2026-11-24: Rachel's hand movements smoothed (Quinn 022m)
The user found her hand movements jerky: she cut straight between poses (A1→A2 72 px, A2→A3 92 px brush jumps). Quinn drew 11 arm-only in-betweens as edits of green_A1 (head and legs pixel-identical): A1→A2 ×2, A2→A3 ×3, A1→B2 (dip) ×3, A1→K1 (salute) ×3, in `approved/quinn/arm/`. `theatre_build.py --inbetweens` turns each into R_T_*.png = base + only the moved arm and brush (the whole connected changed patch, so brush tips stay whole). `routine.json` plays them for 50 ms each, forwards and back, in the strokes, the dip and the salute. Brush now moves 14–31 px per drawing in the strokes. QA ALL OK; rebuild identical; checked in the scene and in a 60 fps preview. Lean (B1) is still a cut (a whole-body move, not a hand movement).
- **Round 2 of the smoothing (2026-11-24 evening):** Quinn 022n filled the two big gaps (T_A1_B2_0, T_A1_B2_2b, T_A1_K1_1b): dip steps now 31/31/42/27/29/20 px, salute 12/22/25/29/7. `tools/theatre_routine.py` writes Rachel's routine from the in-between chains on every rebuild, plus `reaction.lead_in` (from any pose, back to rest through her in-betweens at 33 ms each before the salute), `reaction.min_show_ms` 120 (no one-frame pops; the lean 500 ms) and, in the preview, resuming at rest after a salute. An independent sub-agent matched every frame of the 60 fps preview to its drawing: median step 23 px, p90 31 px (before: 69 / 92, max 129); no one-frame pops, no fringe, holes or ghosting; the only jumps over 45 px are the lean (a cut by design).

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

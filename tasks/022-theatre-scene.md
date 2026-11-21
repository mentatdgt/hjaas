---
id: 022-theatre-scene
status: preview            # waiting for the user's verdict on the first preview
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

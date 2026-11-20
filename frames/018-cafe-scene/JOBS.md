# Higgsfield jobs for 018 (café)

Approved by the user ("go", 2026-11-20 20:22). Sound off. 9 credits.

## Video (Kling 3.0, std, 3 s, 1:1, 4.5 credits each)
Inputs: `hf-inputs/vid_*.png`, crops of the composited scene at x 1103, y 509, 592×592 (2580×1432 canvas). Other cast in their base poses.

| Clip | Start → end | Purpose | Job id |
|---|---|---|---|
| V1 coffee break | A1_sketch → B1_sip | Sets the stylus down, lifts the cup and sips (reversed to return) | 4ffaf17a-3ce5-4dbd-b921-0deec07d345b |
| V2 look up | A1_sketch → K1_look | Reaction to a mushroom find (reversed to return) | 904ba116-3616-4797-ba28-a08773d9e53f |

No upscales are needed: the café is drawn at 2580×1432, so it's already sharp enough for phones.

## Round 2: re-cut for the restyled Rachel (approved "go", 2026-11-20 22:15; 13.5 credits)
Inputs: `hf-inputs/v2/` (same crop, edges anti-aliased).
| Clip | Start → end | Job id |
|---|---|---|
| sip | A1_sketch → B1_sip | 75123d29-665a-4d43-9f40-3f6ece33f4f3 |
| look_up | A1_sketch → K1_look | 1cf43506-6da5-499c-a21c-e23665be9e08 |
| back_to_work | K2_smile → A1_sketch | 82b75594-39f0-4ce8-ad96-c4ef774c6311 |

### Round 2 results
- **sip:** used (frames 8–66 every 2nd, plus 70 and 73). Clean: the stylus goes down, the cup comes up, the eyes close, no drift.
- **look_up:** not used. The head lift happens in about 0.4 s, inside a malformed blink (orange eyelid shapes, frames 21–27); the rest is static.
- **back_to_work:** not used. Static, then a pop at frame 39.
- Instead, the reaction is drawn holds with blinks (A1_blink → K1_blink → K1 → K2 smile → K1 → K1_blink → A1_blink → A1). In this flat cartoon style that reads more natural than the clips.

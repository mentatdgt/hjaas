# Motion audit: where cuts jump too far (Wren, 2026-11-25)

Asked for by the user: find jerky movement, especially Rachel's, and fill it in with Quinn where it matters.

**Method:** for every cut an actor's routine can make, the distance the drawing's ink lines travel between the two stills (95th percentile of the symmetric chamfer distance between the outlines in the changed area), in plate px, next to how long the pose is held. Set Design's round-3 in-betweens, which the user approved as smooth, move a median 23 px and at most ~31 px per cut. Tools: `/tmp/jerk/shape.py` (method above).

| Scene | Cut | Travel (plate px) | Hold | Verdict |
|---|---|---|---|---|
| Build | hammer loop: lift → wind-up | **46** | 110–150 ms | **Fix:** the hammer rises in one jump. Add 2 in-betweens. |
| Build | hammer loop: contact → lift | 28 | 260–460 ms before | **Fix:** add 1 in-between. |
| Build | hammer loop: wind-up → down-swing → contact | 46, 24 | 60–80 ms | Keep: the snap is the impact, by design. |
| Build | reaction: K1 → B36 → B39 (thumb comes up) | **42, 41** | 60 ms each | **Fix:** add 1 in-between in each gap. |
| Film | presenter: M_1 → M_12 / M_1 → M_13 (gesture starts) | **50, 52** | 100 ms | **Fix:** add 1 in-between each (Quinn 036, at 2x). |
| Film | Rachel: back → profile → look | 26, 20 | 90 ms | Keep: a head turn; BIBLE says head turns are cuts. |
| Set Design | Rachel lean back | 18 (one cut) | shown ≥ 500 ms | Optional (on the launch list). |
| Design | Rachel: sketch → reach → lift → sip | 15, 10, 8 | 190 ms | Fine (small steps). |
| Design | old man page turn | 14 | 450 ms | Fine. |
| Design | barista, child, cat | 3–6 | — | Fine. |
| Grow | mist squeeze → lift, lift → aim | 29, 24 | 280–650 ms | Wait: Grow gets the no-glasses / model-sheet pass; add in-betweens then. |
| Build | reaction: everything else | ≤ 10 | — | Fine. |

## Plan
1. **Quinn 036:** presenter `M_1_12`, `M_1_13` at 2x. Engine adds them to the Film routine (`M_1 → M_1_12 → M_12 → M_2`, `M_1 → M_1_13 → M_13 → M_3`, about 60 ms each, so the gesture keeps its pace).
2. **Quinn 037, after the no-glasses roll-out (035):** Build hammer in-betweens (contact→lift ×1, lift→wind-up ×2) and reaction thumb in-betweens (K1→B36 ×1, B36→B39 ×1), as edits of the no-glasses drawings: only the arm, hand and hammer change. Engine adds them to `build-rhythm.ts` and `reaction.json` with the same total time per move.
3. Grow: in the model-sheet pass.

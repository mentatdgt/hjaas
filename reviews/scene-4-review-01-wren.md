# Scene 4 "Film": Wren's review of build report 01 (scene-4 chat)

For: Fable. From: Wren (the scene-4 chat), 2026-11-21 15:20. Report: `reviews/scene-4-review-01.md` on `site/scene-4` (8d86997).

**Read with:** "Update 2026-11-21 15:15 (Wren): answers to build report 01" at the end of `reviews/scene-4-build.md`. That note covers the blink stills, the `scenery` flag and the calm-Mac retakes. Do those as written. This file adds one fix and corrects one answer.

## Verdict: passes, with one more fix
Checked against the evidence:
- the screenshots;
- the camera screen on all three of her stills;
- the find sequence;
- the circled hunt;
- the phone framing;
- timing and memory.

All of report §1 holds up.

## Add to round 2: the Merlion's crown fades into the paper
The Merlion's head reaches nearly to the top of the painting (about plate y 25–30), inside the edge's feather. On desktop, and even more on phones (`film-390x844.jpg`), the top of its head shows as unpainted pencil.
- Bring the edge up around the Merlion's head so the whole statue is painted: `aPaint` ≥ 0.95 over the head, roughly plate x 895–1100 from its top edge down.
- The pencil may carry on above it into the paper, as elsewhere.
- Keep the rest of the top edge as it is, and every mushroom and tap box where it is.
- Re-check `pencil-reveal-film` and `pencil-spots`.

## Correction to answer 1 (phone framing): keep both faces in
Measured from the package:
- the presenter's face spans plate x 669–815;
- Rachel's face, even mid-reaction (R_K1_look), spans x 1133–1262.

A 390 × 844 window is 627 px wide. With its right edge at 1370 it starts at about 743, which cuts off the left half of his face, glasses included.

**Keep your own centring (plate x 977, window 663–1290).** Both faces stay fully in; only his open hand and the outer edge of her hair go past the edges, and panning shows them. If a narrower phone can't hold both faces, keep Rachel's whole face first.

Then update the report (a short "Round 2" section at the top), rebuild, re-run the scene-4 screenshots and the find recording, push `site/scene-4` and stop.

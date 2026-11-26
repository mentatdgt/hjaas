# Build brief: café round 10 (old man, barista, mum, cat) and "Rachel doesn't blink while the mum sips"

**Approved by the user 2026-11-26.** The art is packaged and checked on branch **`art/cafe-round10`** (commit `6979614`): `frames/018-cafe-scene/site/` (routine note v10d), built by `tools/cafe_build10.py`, with the Quinn sources in `frames/018-cafe-scene/round10/`. Previews were made with `tools/cafe_preview10.py`, and every timing was checked with the engine's own `splitCast`/`clipSchedule` run in Node.

## What changes in the scene
- **Old man:** a blink on his reading pose every 3–6.5 s. A page turn every 5–6.5 s: O_1 → T1 130 → T2 140 → R0 130 → R1 170 → R2 160 → O_1. He lifts the corner and raises the page, lets go, and the page falls over by itself while his arm stays on his side. The paper's print never changes. O_2 and O_3 are gone.
- **Barista:** her cloth circles the cup: B_1 → P1 → B_2 → P2 → B_3 → P3, 140–200 ms each, a few rounds, then her pause and glance as before.
- **Mum:** her layer grew to cover her arm, cup and head. She sips at the start of her loop (M_S1 220 → M_S2 1.4–1.8 s → M_S1 220), then blinks four times. Her loop is about 22 s.
- **Cat:** cat_3 is gone. The tail flicks out and back (F1 110 → F2 500 → F1 110) twice per loop, at the start and at about 60%, with breathing in between, never during a flick.
- **Everyone else** (fan, child, Rachel, the plate) is byte-identical.

## 1. Bring the package in
`git checkout origin/art/cafe-round10 -- frames/018-cafe-scene tools/cafe_build10.py tools/cafe_preview10.py`, then `npm run assets`. The only files that should change under `site/public/assets/scene3/` are the old man's, barista's, mum's and cat's, plus `frames.json`/`routine.json`. If anything else changes, stop and report it.

## 2. New engine rule: Rachel doesn't blink while the mum sips
Each actor runs on its own clock, so about a third of the mum's later sips land on or within 1 s of a Rachel blink, and timing alone can't fix that (measured over 100 hours). Add a small, general rule:
- In a routine's `blink` block, an optional `avoid` entry: `{"actor": "mum", "stills": ["M_S1", "M_S2"], "margin_ms": 1000}`. While that actor is showing one of those stills, or within `margin_ms` of starting or ending one, the blink waits and happens as soon as it's clear (it is postponed, not dropped).
- Add it to Rachel's blink in the café's `routine.json`, via `tools/cafe_build10.py` so a rebuild keeps it. No other scene uses it.
- With reduced motion nothing animates, as today. If the mum's layer failed to load, the rule is ignored.

## Must not change
The other scenes; the hunt (no mushroom under a changed layer: check); Rachel's reactions; memory under 80 MB; 60 fps; the paint-in.

## Checks for the report
- Tests (add ones for `avoid`: postponed, not dropped; never during the sip or within 1 s), type check, build. The hunt is 50 of 50 on desktop and phone.
- The engine's schedule over 30 minutes of simulated play: zero Rachel blinks during or within 1 s of a mum sip, and Rachel's blink rate otherwise the same as before (report both).
- WebKit and Chrome, desktop and phone: a 30 s recording of the café after its painting. Frame samples of the old man's turn, the barista's circle, the mum's sip and both cat flicks. Compare them with `art/cafe-round10`'s preview (`tools/cafe_preview10.py`): same poses, same order.
- Trace, phone at 4x slower: no dropped frames from the new loops. Memory: the 30 orders.
- An independent reviewer subagent re-runs the schedule check and the frame samples.

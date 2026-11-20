# Scene 2 (Grow): make the hunt more challenging (user request, 2026-11-20)

For: Fable, on `site/scene-2`, after review 04.
- Commit and push. Never merge into other branches.

**Problem:** the lab is white and pale grey, so red and yellow toadstools pop out instantly, and some are big (drain h34, floor h40). The user wants **a few** to be less obvious and slightly more challenging, but still fair and fun.

## The difficulty curve: 3 easy, 4 medium, 3 hard
Keep the first finds quick, so people learn what they're looking for. Make the last few take a proper look.

**Easy (keep about as they are):** `door` (red), `bench` (yellow), `switch-box` (yellow).

**Medium (smaller, in shade, less contrast):**
- `drain`: red h34 → a **cream/white** drawing (4 or 6) at **h20–22**, tinted SHADE, tucked right beside the drain grate.
- `floor`: h40 → **h24–26**, moved into the shadow under the trolley's bottom shelf, between the wheels, so it peeks out behind a wheel. The trolley's lower half never animates, so it's safe to draw over.
- `pipe`: red → **yellow**, h16, so it reads like a small fitting on the pipe until you look closely.
- `under-shelf`: keep it, but h16 and darker in the shade.

**Hard: the joke of the scene, an imposter among the crop.** A mushroom farmer's lab is full of mushrooms, so hide three of the hunt's toadstools among her real oyster mushrooms. Use the cream/white drawings (4 and 6; not 5, which reads as a nail), tinted to the local light:
- `crop-shelf`: on the middle shelf, between two grow bags or jars, at h16–20. Its bottom is hidden behind the shelf lip (see "Tucking" below).
- `crop-hood`: inside the glass fume hood on the left, among the jars of oyster mushrooms, at h16–18. Seen through the glass, so slightly lower contrast (about 85% opacity is fine here).
- `crop-rack`: on the right-hand rack, among the oyster bags on a middle shelf, at h16–18, slightly overlapping a bag.

These replace `bench-corner`, `rack` and `humidifier`, so the total stays **10**. Keep the existing IDs where a spot just moves; use the new IDs for the three new spots. The saved progress of anyone who has already found a replaced spot should still count: map their old IDs onto the new ones.

## Tucking (partial cover without new art)
To make a mushroom sit behind a shelf lip or a jar edge, clip its lower part with a straight or slightly angled line matching that edge (a `clip-path` polygon on the drawing, in plate coordinates). It must stay at least **60% visible.** Never clip the tap area.

## Fairness rules (must hold)
- Every hunt mushroom is still **a toadstool shape** (a rounded cap on a stem), so on a close look it's clearly different from the fan-shaped oyster mushrooms. Never use an oyster-shaped drawing.
- At least **60% visible,** at least **h14** in plate px, and never fully the same colour as its surroundings.
- Tap areas stay at least 44×44 CSS px, don't overlap, and sit where the edge mask is ≥ 0.95.
- Keyboard Tab still reaches all ten in a sensible order.
- The one 60 s hint wiggle stays as it is.
- On a 390×844 phone, each hard one must still be spottable when the visitor pans to it. Check it on a screenshot at phone scale and say honestly whether you can find it.

## QA
- A desktop screenshot and three phone screenshots (left, centre, right) with **no markers,** plus the same set with the ten spots circled and labelled easy/medium/hard: `site/qa/hunt/grow-*.jpg`.
- Add a "Hunt difficulty (Grow)" section to `site/qa/REPORT.md`, with a ✅/❌ per fairness rule.

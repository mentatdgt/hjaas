# Site round 4 (on `site/scene-5`): Rachel is painted in with the room

From: Wren. For: Fable. 2026-11-24. Asked for by the user after seeing round 3.

## The problem
On a first visit the brush paints the room and its mushrooms, the wash finishes, and only then does Rachel fade in (`transition.ts`, `paint()`: `characterAt = wash + 0.34`). For about a third of a second the room is complete without her, so a mushroom painted next to where she will be stands out and gives itself away.

## What we want
**She is painted in at the same time as the background**, by the same strokes, like any other part of the picture. No fade or settle of her own after the wash.

This is an engine change in `site/src/engine/transition.ts`, so it applies to **every scene** (1 to 5), not just Set Design. That's intended: the same giveaway is in every scene.

## How (suggested; keep the 60 fps design)
1. **In `prepare()`, put the character under the sheet.** Today the sheet goes `scene.mark.after(...)`, over the room, her shadow and the mushrooms but under the character. Move it (or her) so the sheet is over her too. She's drawn once, before the clock starts, at her first frame (her rest pose), and doesn't redraw while the sheet covers her, so the painting still costs only strokes.
2. **She holds still at that first frame while she is being painted.** `scene.work()` starts at the same moment as today, or as soon as the wash ends; keep a short still beat so she doesn't move while paint is still drying on her.
3. **Remove her separate fade and the 4 px settle** (`timeline.fromTo(parts, …)` and `character.el` y) on the first-visit painting. Other entrance parts in `scene.entrance` that are part of the picture (a cast painted with the room) follow the same rule: painted, not faded.
4. **The veil over the pencil edge** currently washes twice as fast "because she comes in as the wash ends". Re-time it so the edge and the picture finish together now that she's part of the picture.
5. **Stroke plans:** check every scene's `strokes` so her area isn't left for last on its own (that would make her the giveaway instead). She should be covered as part of a stroke that also covers the room around her, at a point in the sequence like any other region.
6. **Unchanged:** a return visit's 200 ms reveal and a switch between scenes (she was already in the picture being left, so check she's under the sheet there too and doesn't flash); the slow-network case where she arrives after the picture is on show (`scene.ts`: she fades in, as now); `?intro=off`; reduced motion.

## Checks
- A 60 fps recording of the first-visit painting for **each of the five scenes**, desktop 1440×900 and phone 390×844: `site/qa/paint/scene{1..5}-paint-60fps.mp4`.
- For each, a strip of 1:1 crops around Rachel every 50 ms through the painting, showing her appearing under the strokes with the room around her, never after it: `site/qa/paint/scene{N}-rachel-strip.jpg`.
- No frame where the room around her is fully painted and she isn't (state the test you used per scene).
- Throttled-phone trace (4×) of the first-visit painting for scenes 1 and 5: no dropped frames, longest task as before. WebKit check on one scene.
- Scene switch and return visit recorded once each (no flash of her).
- `npm test`, type check, no console errors.

## Report
`reviews/scene-5-review-04.md`, in the shape of review 02. Push `site/scene-5`. Don't merge anything.

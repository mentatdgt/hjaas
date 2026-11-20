# Edge, round 2: organic and irregular (user's pick: option 2)

For: Fable, on `site/scene-2`. Do it together with review 05. Commit and push. Never merge into other branches.

**User:** the current edge "looks like a very regular feather; want it more organic and irregular." They chose **option 2** in `reference/mockups/edge-organic-123.jpg`: the edge **wanders in and out**, and **the softness varies along its length**. Crisp-ish in places, a wide melt into the paper in others, like a real drying wash. No bleeds, no pale patches (that's option 3).

## How the mock-up was made (match its look)
In plate pixels (1672×941):
- **Base shape:** the current rounded rectangle (corner radius 6% of the width). `din` is the distance in px inside its edge.
- **Noise:** `fbm` is value noise at 4 scales: cell sizes 110, 45, 18 and 7 px, weights 1, 0.55, 0.3 and 0.15, normalised to about −1..1. Seeded and fixed per scene; use a different seed for each scene.
- **The bottom band:** `bottom` = 0 above 80% of the plate height, rising to 1 at the bottom edge.
- **Varying width:** `w = 60 × (1 + 0.75 × fbm_w) × (1 − 0.55 × bottom)`, with a minimum of 6 px. `fbm_w` uses the large scales only (140 and 60 px).
- **The wander:** `t = (din + 60 × fbm × (1 − 0.6 × bottom)) / w`.
- **Alpha:** smoothstep of `t` clamped to 0..1. The painting is mixed into the paper colour by that alpha.
- **Scale these numbers with the plate,** so the look is the same on every screen. On phones the visible window shows the plate's own edge, as now.

## Keep
- **Every mushroom and its tap area at ≥ 0.95 opacity.** If the new wander reaches one, nudge that spot minimally; don't weaken the edge.
- **Rachel fully opaque** in every pose (check the union of all her frames in both scenes).
- **The paint-in still reveals into this shape.**
- **Production gets only this edge** (`?edge=organic`, the new default). The older styles stay dev-only.
- **The edge is drawn once,** so panning and switching scenes stay smooth (re-check in WebKit).

## QA
- Screenshots of Build and Grow at 1440×900, 390×844 and 360×740.
- A side-by-side of the mock-up and the build at 1440×900: `site/qa/edge/organic-compare.jpg`.
- The mushroom ≥ 0.95 check, plus the Rachel-opacity check.
- Add an "Edge (organic)" section to `site/qa/REPORT.md`.

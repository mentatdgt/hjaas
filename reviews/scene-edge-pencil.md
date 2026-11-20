# Edge, round 3: no hard cuts, and the paint gives way to pencil (user's pick: B)

For: Fable, on `site/scene-2`. Run `git pull origin main` first (as a merge, as before). Commit and push. Never merge into other branches.

**User:** the organic edge is good, but in places it ends on **solid, hard, straight edges**, which ruins the effect. Also, the colour should give way to **pencil sketch lines** near the edge: solid painting, then the colour fades, and the lines carry on as pencil before trailing off into the paper.

The user picked **option B** in `reference/mockups/edge-pencil-options.jpg` (third column; close-up in `edge-pencil-detail.jpg`, left half). They turned down the wider versions (`edge-pencil-options-2.jpg`, middle and right) because they eat into the picture.

## 1. Why there are hard cuts (Wren's recipe was wrong)
In `organicAlpha`, at the plate's rim `din` is near 0, but `din + wander × fbm` can be positive. So alpha is above 0 right at the rim and the painting is cut by the plate's rectangle. **Fix:**
- `a = smoothstep((din − inset × (1 − 0.75 × bottom) + wander × fbm × (1 − 0.6 × bottom)) / width) × smoothstep(din / 28)`
- The last factor makes the plate's outer 28 px always fade to paper, so there's never a straight cut.
- Everything else (noise, widths, `bottom`, corner radius, seeds) stays as now. `smoothstep` clamps `t` to 0..1 as before.

## 2. Two edges from the same noise
- **Paint:** `aPaint = a` with `inset = 45`. The colour fades about 45 px further in than now (less at the bottom).
- **Pencil reach:** `aPencil = a` with `inset = −10`. That's about where the colour ended before this round.

Both use the same seed and noise, so the pencil band follows the paint's wandering edge.

## 3. Pencil lines: already made, use them as they are
- `scene/pencil/build-lines.png` and `scene/pencil/grow-lines.png`: 8-bit greyscale, 1672×941, registered to each plate. 255 = full pencil line. The graphite grain is baked in.
- Made by `tools/pencil_lines.py` from the plates. Wren will make the café's from `018_plate` later.

**Runtime break-up** (strokes break apart as they head outward):
- `brk = noise(x, y, 9 px cells, seed + 9)`
- `keep = smoothstep((brk − (1 − aPencil) × 0.9 + 0.25) / 0.35)`
- `pen = lines × aPencil × keep`

## 4. Drawing it (keeps your one-overlay design)
The edge overlay stays one canvas over the whole plate, drawn once per scene:
- **Overlay alpha:** `1 − aPaint`, as now.
- **Overlay colour per pixel:** the paper colour mixed toward graphite `rgb(78, 74, 70)` by `0.85 × pen`.

Inside the painting the overlay is clear, so there's no pencil over the paint. Out on the paper, the lines show as pencil. The overlay now has fine detail, so it must be drawn at the plate's full resolution, scaled to the screen like the plate. A blurred, small canvas won't do.

**Memory:** the overlay now needs real pixels. Keep the whole page under 80 MB on the phone profile (the lab was at 78). Suggested: draw only the edge band as four strips (top, bottom, left, right; about 140 px deep at plate scale) instead of a full-plate canvas. Free anything else if needed, and report what changed.

**Cost:** compute in slices as now (no long tasks over about 12 ms in WebKit).

## 5. Keep
- **Mushrooms:** every mushroom and its tap area at `aPaint` ≥ 0.95 (no pencil over a mushroom). Nudge spots minimally or choose a seed, as last round. All 20 must stay findable.
- **Rachel:** fully opaque in every pose (`aPaint` = 1 under the union of her frames) in both scenes.
- **The paint-in reveals into this shape,** with the pencil appearing first and then the colour. If simpler, the pencil can simply be there from the start; say which you did.
- **Production gets only this edge** (`?edge=pencil`, the new default). Keep `organic` as a dev-only comparison.
- **The edge is drawn once,** so panning and switching stay smooth.

## QA
- Screenshots of Build and Grow at 1440×900, 390×844 and 360×740, phones panned fully left and right.
- `site/qa/edge/pencil-compare.jpg`: mock-up B beside the build at 1440×900, plus 2× close-ups of a top corner and a side.
- **No straight cut anywhere:** sample alpha along the plate's rim (must be 0) and show the four corners close up.
- The mushroom ≥ 0.95 and Rachel-opacity checks, and peak memory on the phone profile.
- Add an "Edge (pencil)" section to `site/qa/REPORT.md`.

**Note for later (café):** the cast (barista, child, old man, cat) and the mum get the same rule as Rachel: `aPaint` = 1 under them.

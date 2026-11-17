---
id: 003-mushrooms
status: approved             # draft | open | delivered | changes-requested | approved
frames: 9
grid: 3x3                # columns x rows
fps: 1                   # not an animation: a set of props
loop: false
references:
  - scene/room-empty.png                     # THE style and lighting target: these sit on its floor
  - reference/scene-keyframe-hammering.png
used_on: the mushroom hunt, scattered around every scene; visitors click them to collect
---

# 003 — Hidden mushrooms (prop set)

## What this is
Nine small mushroom props that the site scatters around the room for visitors to find. Not an animation: each cell is a different mushroom. The site scales them down for ones further back in the room, so draw them all at the same size.

## Cell-by-cell
| # | Mushroom |
|---|---|
| 1 | Red cap with white spots, single, short and round |
| 2 | Red cap with white spots, single, taller with a slimmer cap |
| 3 | Red with white spots, a little cluster of 3 (one big, two small) |
| 4 | White, single button mushroom |
| 5 | White, single, tall and slim (enoki-like) |
| 6 | White, cluster of 3 |
| 7 | Yellow, single, short and round |
| 8 | Yellow, single, wavy-edged cap (chanterelle-like) |
| 9 | Yellow, cluster of 3 |

## Must be consistent across all nine
- Same drawing style as `scene/room-empty.png` (they sit inside that room, so match its painted look and line quality, not the flat model sheets)
- Same camera angle as the room: seen from slightly above, standing upright
- Same lighting as the room: warm golden light from the LEFT, highlights on the left of each cap and stem, warmer shadow on the right
- Same size: each mushroom (or cluster) fills about 70% of its cell's height
- Same baseline: the bottom of every stem sits on the same invisible line near the bottom of its cell

## Background
Transparent, or flat pure green `#00FF00`. No ground, grass, soil or cast shadow (the site adds a small shadow).

## Avoid
- Faces, eyes or cute characters on the mushrooms
- Glow, sparkles or outlines thicker than the room's
- Anything crossing into a neighbouring cell; labels, grid lines, numbers

## QC pass criteria (Wren checks these)
- All nine match the room's style and lighting when placed on `scene/room-empty.png`
- Colours read clearly as red, white and yellow against the warm room
- Clean edges, no green fringe
- Baseline and size consistent enough to place them by their stem bottom

## Revision notes
### Round 1 — Batch 01 (2026-11-17): APPROVED
- Transparent 1254×1254 sheet. Heights/baselines vary between cells (Quinn flagged), which doesn't matter: Wren cut each mushroom out by its outline (`approved/mushroom_01..09.png`) and the site places each by its stem bottom.
- Style and left-side lighting match the reno room (see `approved/preview-in-room.png`). The white mushrooms read slightly cool; the site can warm-tint per scene.

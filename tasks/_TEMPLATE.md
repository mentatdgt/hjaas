---
id: NNN-short-name
status: draft            # draft | open | delivered | changes-requested | approved
frames: 8
grid: 4x2                # columns x rows
fps: 8
loop: true
references:
  - reference/<file>.png
used_on: <where on the site this plays, e.g. hero section idle>
---

# NNN — Title

## What the animation shows
One or two plain sentences.

## Frame-by-frame
| # | Pose / action |
|---|---|
| 1 | |
| 2 | |

## Must stay identical in every frame
-

## Avoid
-

## QC pass criteria (Wren checks these)
- Character height varies < 4% across frames
- Feet/baseline drift < 2% of cell height
- Colours match frame 1 and the reference (no palette drift)
- Clean background, no green fringe, no stray marks
- Motion reads smoothly when played at the fps above; loop has no visible jump (if loop: true)

## Revision notes
_(Wren writes here after each QC round)_

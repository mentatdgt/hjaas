# iPad: side lines, and the phone view on iPad mini: build report 01

Brief: `reviews/ipad-edge-lines-build.md` (on main). Branch `site/review-fixes`, code in `830a82b`. Only `site/src/engine/site.css` changed in `src`; the art, `edge.ts`, timings and scripts are untouched. Tool: `site/qa/tools/ipad-edge-lines.mjs`. Evidence: `site/qa/ipad-edge-lines/`. Everything ran in Playwright's WebKit and desktop Chrome: **no real iPad was used.**

**Done: both parts.**

## Part 1: the cause
- **WebKit draws a canvas at whole CSS pixels, and a picture at whole screen pixels.** Where the window starts at half a CSS px (1133x677: x = 156.5), the edge canvases' boxes are right (painted red, they reach the window's side), but their contents move to 157. The edge lies one screen pixel off the room, and the room's own outermost column shows, at full strength and full height, on one or both sides. So it depends only on the window's exact size, as the brief guessed.
- Reproduced on a plain load at: iPad mini on its side 1133x744, 768x1024 upright, and 261 of the 844 sizes swept. The exact sizes of the Air (1180x820) and Pro (1194x834, 1366x1024) are clean in this engine, which is why the sweep was needed.
- **Desktop Chrome has it too, rarely:** 8 of 844 sizes, right side.
- **Fix:** `clip-path: inset(1px)` wherever the whole room shows (also a phone on its side); `inset(1px 0)` in the panned view. 1 px is enough at every size. What it hides at the sizes that had no line: 3 of 255 levels at most, in single rows of the outermost pixel.

## Logo tap: do the two bugs share a cause?
- **Not proven, and not seen here.** After the tap the window's box, the four edge canvases' sizes and the line count are the same as before it (Safari and CriOS agents; 1180x820, 1180x690, 1133x677, 1366x1024; 1 and 5 taps, back, forward). A size has the line before the tap and after it, or never. User agent makes no difference.
- **The black border did not reproduce** (corner pixels are paper in every state). It is not this rounding: rounding can show one column of the room, never black. It stays with job 018. Why the user sees the lines only after a tap in Safari is also not explained by this; the window's height changing around the reload (toolbars) would do it.
- The console sometimes says "reaction frames unavailable … EncodingError" after quick taps: on the old build too (a load cut short by the next).

## Part 2
- The phone layout's limit is 799 px upright (one place in the CSS). **The JS has no limit of its own:** it asks whether the window scrolls, so the two cannot disagree.
- A tier for 601 to 799 px: one-row tagline beside a larger logo, 18 px tabs, 34 px name, larger counters and controls.
- **Reading taken:** the contact form's own 600 px rule (the bottom sheet) is left: at 744 px the form stays the 420 px panel over its button, which fits; a sheet 744 px wide would look stretched.

## Checks
| Check | Result |
| --- | --- |
| Sweep, WebKit, 4 widths x 650 to 860, five scenes (4220) | with a line: **1305 before, 0 after** |
| Sweep, WebKit, CriOS agent, Build (844) | 261 before, 0 after |
| Sweep, Chrome, five scenes (4220) | 40 before, 0 after |
| Sweep, columns just inside the cut (2 to 5 screen px) | none changed; no run uncovered |
| The iPads' own sizes, both ways up, five scenes | before: lines at 1133x744 and 768x1024; after: 0 |
| 4x crops | `crops-*.png`: 1180x820 (clean before too), and the worst sizes 1180x690, 1133x677, 1194x700, 1366x784 |
| Logo tap, Safari and CriOS agents | before: 940 rows at 1180x690, 919 at 1133x677; after: 0 after 1 and 5 taps, back and forward |
| Between scenes (the copy over the window) | 0 after |
| Phones 375x812, 390x844 (WebKit, five scenes, before vs after) | **0 pixels differ** |
| 844x390, 810x1080, 820x1180 (WebKit) | at most 57 pixels, 4 levels, all in the outermost column |
| Chrome 820x1180, 1440x900 | 125 to 350 pixels by 1 level (rounding at the clip); Film at 820x1180 sometimes 3887, old against old does it too; Build at 820x1180 has 2 pixels over 2 levels. Nothing visible |
| 744x1133, 768x1024 (five scenes) | phone view; the crop is 65% of the screen, 53 and 60% of the room in view; no sideways scroll |
| 810x1080, 820x1180 | whole room |
| Drift, focus, pan memory, turning (744x1133, 768x1024, 744x1040, 601x900, 799x1100) | 40 px and back, once; opens on Rachel; kept over a scene change and a reload (within 1 plate px); three turns, one in mid-painting: nothing stuck, no lines on its side, mushrooms in place |
| Tap boxes and controls | 44 px at least |
| Real touch swipes (Chrome) | sideways pans the room; up scrolls the page where it can |
| Hunt, by taps | 50 of 50 at 1180x820, 1133x677, 1133x744, 744x1133, 768x1024, 390x844 |
| Recording | `mini-744x1133.mp4`: painting, drift, swipes to both ends (mouse drags: Playwright's WebKit has no touch swipe), a find at each end, turned and back |
| Tests, types, build | 389 of 389; clean; builds |

## Independent reviewer
It had not seen the work, and wrote its own scripts against `830a82b`. **Verdict: PASS with notes, no defects.**
- Lines: 37 left and 35 right before, 0 after (every 7th height, outermost 4 px too). 844x390 at 3x: 1 of 6 heights before, 0 after. 600x900, 375x812, 390x844: 0 pixels differ (one 390x844 pair of Build differed across the whole window; three repeats were 0).
- It saw one 93 px run **while painting**, 1133x677, and could not repeat it. I looked again (every frame that could be caught, 6 loads a build): it is the paint effect at its rim, one look at a time, 3 to 4 levels of 255; the old build does it with 3 to 6. Not visible, not changed.
- Film's top shows an off-paper run of up to 204 px, before and after alike: not from this change.

## For Wren
1. **The user should look on the iPad** (Chrome and Safari, landscape, after a logo tap).
2. At 744x1133 full screen about 97 px of paper is left under the controls (the 65% limit). In Safari's window, 60 to 90 px shorter, it nearly goes.
3. Set Design's crop cuts the art's raised top-right corner into a small stub at the right side (as at 600x900 before).

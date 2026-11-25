# Build brief: the Film presenter at double size

From: Wren. For: Fable. 2026-11-25. Asked for by the user ("have Quinn redraw the man at double size, test it and deploy").

## Why
On a phone the Film scene is shown about 1.6 device px per plate px, and the whole package is 1x (`frames/020-film-scene/site`, canvas 1672×941), so the presenter looks soft and his outlines heavy. Quinn redrew him at **2x** with crisp, thinner lines (jobs 032 base, 033 parts); Wren assembled his 16 stills from the base plus the parts. Everything else in the Film scene stays 1x.

## The package (on `main`)
The 2x stills are in **`frames/020-film-scene/site/presenter2x/`**: the same 16 names, 640×1216 RGBA, keyed with clean edges. Within the folder every still is pixel-identical to `M_1` outside the part that moves (mouth, eyes, arms). **Switch the package to them:** in `frames/020-film-scene/site/frames.json` point the 16 presenter stills at `presenter2x/` and give the presenter layer **`"scale": 2`** (its box stays `x 601, y 254, w 320, h 608` in canvas px). Commit that change on main's package via your branch's copy (bring the package from `origin/main` by path first). Keep `presenter/` (the 1x set) for comparison; the page no longer loads it. Every other layer is unchanged.

## What to build
1. **Per-layer scale** in `cast.ts` / `build-assets.mjs`: a layer with `scale: s` has stills of `s×w` by `s×h`, drawn into its box. Its canvas is backed at `min(devicePixelRatio, s)` times the box so phones get the extra sharpness and desktops lose nothing. A layer without `scale` behaves exactly as now. Unit tests for both.
2. **Memory:** don't hold 16 full 2x stills (about 50 MB decoded). Keep the first still whole and the others as patches: each still cropped at build time to the rectangle where it differs from `M_1`, drawn over `M_1`. (Or another scheme with the same effect.) The presenter must add **no more than 12 MB** over today's Film scene; the whole site stays under 80 MB over 30 visiting orders. Under 900 px wide you may use a 1.5x copy if that's what it takes, as Build and Grow do.
3. **The camera screen** (`camera_screen` in frames.json: a live copy of the canvas region around him into Rachel's DSLR) still shows him live and sharp, in canvas px as now.
4. **Unchanged:** his routine and timings, blinks, the reaction, the paint-in (Rachel and the presenter painted in with the room; "room painted but she isn't" stays 0), the hunt boxes, Film's phone framing (`focusX 977`).

## Checks
- Stills of him at 390×844 (DPR 3) and 1440×900 (DPR 2), before and after, crop 1:1, in `site/qa/film-2x/`: sharper, thinner lines, same place (overlay difference image).
- A 60 fps recording of his talking loop on the phone profile: no pop, flicker or seam where a patch meets the base; blink and mouth changes clean.
- The camera screen recording.
- Memory: 30 visiting orders, highest value and Film's share, against today.
- Throttled phone trace (4×) entering Film and through two of his gestures: no worse than today.
- Tests, type check, build, no console errors; the whole hunt 50 of 50 desktop and phone.

## Report
`reviews/film-presenter-2x-01.md`. Push to `site/review-fixes`. Don't merge anything.

## Wren review of Engine job 007 (2026-11-25): approved
- Build `60f19b8` on `site/review-fixes` is now in the phone preview.
- He is crisp on the phone (543 px wide, was 320). The memory, hunt, camera screen and trace checks pass.
- **Timing:** keep 60 + 60 ms. The extra 20 ms reads smoother.
- **Arm steps of 37–76 px after the first in-between:** accepted for now. The arcs read correctly at 60 ms. Add a second in-between only if the user sees a jump.
- **Wristband:** plain in `M_1` is correct, because the palm faces up there and the watch face is on the back of the wrist.
- **Follow-ups for the next art pass:**
  1. Remove the cyan speck in his hair by the temple. It is the same in all 18 stills, so fix it the same way in every one.
  2. Clean the dotted white line and black bits by the sleeve in `M_1_12` and `M_1_13`.
  3. Optional: a closed-mouth version of each in-between, for when he gestures from `M_1_closed`.

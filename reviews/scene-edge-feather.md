# Watercolour edge on the paintings (both scenes)

For: Fable, on `site/scene-2` (so it applies to Build and Grow). Do this after the scene-2 structure and the frame drop-in.
- Commit per item and push. Never merge into other branches.
- The user asked for it on 2026-11-19: "the image is a hard edge then a border; feather to white along the edges, watercolour, more organic."
- **UPDATED (user, 22:57):** the user prefers a **soft** feather, but **thinner** than the first mock-up, which was too diffuse and ate into the image. **No deckle, no pigment rim, no paler wash, no grey smoke:** the painting simply fades to the paper colour.
- The mock-ups to match are in `reference/mockups/edge-options-2-ABC.jpg`. Build all three behind `?edge=a|b|c` (dev-only), default **a**:
  - **A, light:** a thin soft edge. The fade covers about 4% of the width on the sides, 6% at the top and 2.5% at the bottom, with gentle noise so the line wanders slightly.
  - **B, medium:** a little wider (sides about 5.5%, top 8%, bottom 3%) and wanders more.
  - **C, corners:** the edges stay mostly intact (about 3%), and the fade is stronger toward the corners, like a soft vignette.
- Wherever the text below says soft/deckle, read it as A/B/C. Ignore the pigment-rim and thinned-wash steps.
- The older mock-up (`edge-options-soft-vs-deckle.jpg`) is superseded.

## Build
1. **Remove the mat and the fine border** around the painting. The painting sits straight on the paper page.
2. **A procedural edge mask, generated once per scene** (seeded, so it's the same every visit) and **attached to the plate**, so it moves with the painting when a phone pans. Never attach it to the viewing window.
   - **The boundary:** distance from the plate edge plus layered value noise (large, medium and fine scales), so the edge wanders organically.
   - **The thinned wash:** inside the boundary, the paint lightens toward the paper over about 5–8% of the plate width, mixing about 45% toward the paper colour, with a slight desaturation.
   - **A pigment rim (deckle only):** a faint darker line in the paint's own colour (not grey), just inside the boundary, with noise in its strength.
   - **Widths, as fractions of the plate:** sides about 7%, top about 6%, **bottom about 2.5%**. The floor, Rachel's feet and the low mushrooms are near the bottom.
3. **Two styles behind a dev switch** so the user can compare: `?edge=soft` and `?edge=deckle`, default **deckle**.
   - **soft:** a wide, smooth fade with no crisp boundary and no rim.
   - **deckle:** as in the bottom mock-up.
   - Production uses the default; the switch is dev-only, like the others.
4. **Performance:** bake the mask into the room canvas once (the canvas that already stays on as the room after the paint-in) rather than using CSS `mask-image` on a scrolling element. Rachel and the mushrooms sit on top, inside the painted area. Verify in WebKit: panning and the end of the intro still have no frames over about 50 ms.
5. **The paint-in reveals into that shape:** strokes may run to the boundary but never paint outside it, and the final wash fills only inside the mask.
6. **Protect the hunt:**
   - Every mushroom and its tap area must sit where the mask is at least 0.95 opaque.
   - Move any spot that isn't, by the smallest amount, staying on a believable surface. Likely candidates: `tiles`, `screed` and `toolbox` in Build, and any floor-edge spots in Grow.
   - An active, invisible mushroom must never happen.
   - Add a QA check that samples the mask under every spot.
7. **Phones:** the plate's own feathered edges show when panning to the far left or right. The viewing window's side edges get only a very narrow soft fade (about 12 px), so it doesn't look cut, and it's applied to the window, not to the hunt. The top and bottom of the phone window show the plate's real feathered edges.
8. **Paper:** keep the page colour (`#F6F3EC`). Optionally add a very faint static grain on the page around the painting.

## QA
- Screenshots of all three edge styles (A, B, C), for both scenes, at 1440×900, 390×844 and 360×740.
- One recording of the intro with the new edge, on desktop and iPhone (WebKit).
- A mask-under-every-mushroom check: all ≥ 0.95.
- Add an "Edge" section to `site/qa/REPORT.md` and a side-by-side image, `site/qa/edge/compare.jpg`, so the user can pick A, B or C in the morning.

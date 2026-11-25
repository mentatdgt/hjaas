# Build brief: iPad: the lines at the scene's sides, and the phone view on iPad mini

**Reported by the user 2026-11-26:** on iPad **in landscape**, every scene shows a thin line at its left and right edges. And in portrait the whole landscape scene is squeezed into the frame: the user wants **the phone experience on iPad mini** (zoomed crop, swipe sideways) and the whole scene kept on full-size iPads.

## Likely cause (Wren, from the code)
`site.css`, `.hj-viewport`: `clip-path: inset(1px 0)`. Its comment explains that where the window sits at a fraction of a pixel, WebKit snaps the room's picture to screen pixels but not the edge layer, so the room's outermost row showed as a hairline. The fix covered the **top and bottom** only, because on a phone held upright the sides cut through the middle of the room (it pans). On an iPad the whole plate shows, so the same hairline shows at the **left and right**.

## Do
1. **Reproduce first**, in WebKit (Playwright's iPad devices, DPR 2): 820x1180 and 1180x820 (iPad Air), 768x1024 and 1024x768, 1024x1366 and 1366x1024 (iPad Pro 12.9"), all five scenes, after the painting and with the edge drawn. Zoom 4x on both sides and save crops. If the cause is something else, find it and say what it is.
2. **Fix:** wherever the whole plate is shown (not the panned phone view), also leave out the side pixels: `clip-path: inset(1px)`. Keep `inset(1px 0)` for the panned view. If 1px isn't enough at some sizes, use the smallest inset that clears every size, and don't cover any of the painting's pencil trail.
3. Don't change the art, the edge drawing (`edge.ts`), timings or layout.

## Part 2: the phone view on iPad mini, upright
Today the phone layout (the tall crop panned sideways, counters stacked under the scene, controls on a row below) applies to `@media (orientation: portrait)` plus `@container (max-width: 600px)` (site.css ~line 1496), and possibly to the same limit in the JS (`pan.ts`, `site.ts`).
- **Raise the limit to 799 px wide in portrait,** everywhere it's used, so the CSS and the JS always agree. iPad mini upright is 744x1133 (6th gen) or 768x1024 (5th gen): phone view. Every full-size iPad upright is 810 px or wider (810x1080, 820x1180, 834x1194, 1024x1366): unchanged, whole scene.
- Between 601 and 799 px the phone layout has to look intentional, not stretched: the masthead, tabs, counters and controls at sensible sizes, and the crop's height about 55–65% of the screen, as on phones (`HANDOVER-hunt-counter.md` §4). Rotating to landscape goes back to the whole scene, and rotating back is clean (no stuck pan, mushrooms in place).
- The pan memory, the one-time drift hint, focus on Rachel at open, and 44 px tap targets all work as on phones.

## Checks for the report
- Before and after 4x crops of both sides, at every size above, all five scenes, in WebKit. Plus Chrome at 820x1180 and 1440x900, to show nothing changed there.
- The panned phone view (375x812, 390x844 WebKit) is unchanged: before and after screenshots match apart from the top and bottom pixel rows.
- **Part 2,** WebKit with Playwright's iPad devices: screenshots of all five scenes at 744x1133 and 768x1024 (phone view), and at 810x1080 and 820x1180 (whole scene, unchanged apart from Part 1). A recording at 744x1133: open, the drift, swipe across the whole room, find a mushroom at each end, rotate to landscape and back.
- Phones (375x812, 390x844) look exactly as before.
- Tests, type check and build pass. The hunt is 50 of 50 (mushrooms near the left and right edges can still be tapped).

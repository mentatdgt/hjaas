# Build brief: the lines at the scene's left and right edges on iPad

**Reported by the user 2026-11-26:** on iPad, every scene shows a thin line at its left and right edges.

## Likely cause (Wren, from the code)
`site.css`, `.hj-viewport`: `clip-path: inset(1px 0)`. Its comment explains that where the window sits at a fraction of a pixel, WebKit snaps the room's picture to screen pixels but not the edge layer, so the room's outermost row showed as a hairline. The fix covered the **top and bottom** only, because on a phone held upright the sides cut through the middle of the room (it pans). On an iPad the whole plate shows, so the same hairline shows at the **left and right**.

## Do
1. **Reproduce first**, in WebKit (Playwright's iPad devices, DPR 2): 820x1180 and 1180x820 (iPad Air), 768x1024 and 1024x768, 1024x1366 and 1366x1024 (iPad Pro 12.9"), all five scenes, after the painting and with the edge drawn. Zoom 4x on both sides and save crops. If the cause is something else, find it and say what it is.
2. **Fix:** wherever the whole plate is shown (not the panned phone view), also leave out the side pixels: `clip-path: inset(1px)`. Keep `inset(1px 0)` for the panned view. If 1px isn't enough at some sizes, use the smallest inset that clears every size, and don't cover any of the painting's pencil trail.
3. Don't change the art, the edge drawing (`edge.ts`), timings or layout.

## Checks for the report
- Before and after 4x crops of both sides, at every size above, all five scenes, in WebKit. Plus Chrome at 820x1180 and 1440x900, to show nothing changed there.
- The panned phone view (375x812, 390x844 WebKit) is unchanged: before and after screenshots match apart from the top and bottom pixel rows.
- Tests, type check and build pass. The hunt is 50 of 50 (mushrooms near the left and right edges can still be tapped).

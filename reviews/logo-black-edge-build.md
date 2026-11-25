# Build brief: the painting's border turns black after tapping the logo

**Reported by the user 2026-11-26** (photo: `reviews/assets/logo-black-edge-ipad.jpg`): Chrome on iPad, landscape, all 50 found. After tapping the logo, everything outside the painting's feathered edge, up to the window's rectangle, is **solid black** instead of paper. The masthead, counters and controls are normal. Fix it for every browser.


**Update from the user (01:46):** in **Safari** on iPad the border does NOT turn black, but after tapping the logo the **thin lines at the left and right sides** appear (job 016's bug). In **Chrome** on iPad the same tap turns the whole border black. So both may come from the same thing: how the page and its edge canvases are rebuilt after the logo's reload (for example, edge strips that partly fail or are drawn at a different size or fraction of a pixel on reload). Whichever job runs first: test the logo tap, and say whether the two bugs share a cause.

## Lead (Wren, from the code; not yet proven)
- The logo is a link (`options.homeHref`), so tapping it reloads the page.
- The paper border is drawn on canvases (`edge.ts`: strips along the plate's sides, plus a scratch canvas, `putImageData`).
- iOS WebKit (which Chrome on iPad uses) has a hard total canvas-memory limit. During a reload the old page's canvases (room, character, paint sheet, logo, edge) may still be held, for example by the back-forward cache. The new page's canvases can then fail to get memory. In WebKit a canvas that can't get its backing store can render black. Look for "Total canvas memory use exceeds the maximum limit" in the console.

## Do
1. **Reproduce first.** WebKit with Playwright's iPad devices, landscape (1180x820 and 1366x1024), DPR 2, a Chrome-on-iPad user agent (CriOS) and plain Safari's. State `?all` (all 50 found) and a fresh visit. Tap the logo once, then 5 times in a row, and wait for each load. Also press back and forward. Record the console. Find the real cause. If it isn't the lead, say what it is.
2. **Fix the cause,** not the symptom. Whatever it is, the result must be:
   - **The logo doesn't reload a page that's already the home page.** On the home page, a tap takes the visitor to the opening scene the same way a tab does (no full reload). Keep it a real link, so open-in-new-tab, copy-link and no-JavaScript still work.
   - **Canvases are released when the page is hidden or unloaded** (`pagehide`): every canvas the site made (room, character, sheet, logo, edge, scratch) is set to 0x0. Rebuild them on `pageshow` with `persisted`, so back-forward cache restores work.
   - **A safety net:** if any edge canvas fails to get its context or memory, or `isContextLost()` is true, the edge falls back to something that's never black: redraw it once, and if that fails, hide the strip and let a CSS paper-coloured mask stand in.
3. Don't change the art, the edge's look when it works, or the timings.

## Checks for the report
- Before and after: the reproduction steps in WebKit (iPad, CriOS and Safari user agents), Chrome, Firefox and Edge on desktop, and phones (390x844 WebKit). Screenshots after 5 logo taps, and after back and forward. The after must show no black anywhere.
- The total canvas memory the site holds (sum of width x height x 4) before and after 5 taps: it must not grow from tap to tap.
- Tests, type check and build pass. The hunt is 50 of 50. The paint-in still plays on the first visit.

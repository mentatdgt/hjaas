# Build brief: copy round 2 (tagline, Reset mushrooms, 404 text)

**Approved by the user 2026-11-26.** Branch `site/review-fixes` (the live site is `deploy` = this branch plus `site/middleware.js`).

## 1. Shorter tagline
`site/src/engine/site.ts`, `COPY.tagline`:
`I design, build and film spaces. Also, mushrooms.`

Why: the old line wrapped to five rows in a ~890 px wide window, beside the tabs. Job 013b added space and font-size changes in `site.css` to fit the long line (two reserved rows on desktop, three rows of 14 px on phones, 11.5 px when a phone is held sideways). **Re-fit them for the short line:** go back to the larger tagline size wherever it now fits, and reserve only the rows the new line needs. The target is one row on desktop, at most two at ~890 px wide, and at most two on a 375 px phone. Keep the masthead height steady between widths, with no jump in the picture's position.

## 2. "Replay painting" becomes "Reset mushrooms"
The button in `site.ts` (`COPY.replay`, the `replay` click handler around line 852) changes what it does:
- **Label:** `Reset mushrooms`.
- **Shown** only when the visitor has found at least one mushroom anywhere. Otherwise hidden, with the layout reserving no gap for it.
- **First tap:** the label changes to `Tap again to reset all 50` for 4 s, then changes back. It's announced to screen readers (`aria-live`). Nothing is cleared yet.
- **Second tap within 4 s:** clear all saved progress (`resetProgress()` in `state.ts`) **and** the in-memory hunt. Every mushroom in every scene is back, the counters read `0/10 hiding in …` and `find all 50 to contact Hui Jie`, the tab marks are cleared, the Contact Hui Jie button is locked again, and Set Design's backdrop goes back to its starting state. Then the current scene repaints, exactly as Replay painting did (reuse that code path), so the mushrooms appear with the paint.
- It does nothing while a painting or scene change is under way (the same `busy()` guard as today).
- Another tab of the site that is open at the same time follows the reset (the existing `storage` listener at ~line 514 should already handle this; check it).
- Skip, Pause animation and Play animation are unchanged.

## 3. 404 page
`site/public/404.html` only (keep everything else in the 404 package untouched):
- **Text:** `This page is still on the drawing board.` then the link `Back to the main site!` (href `/`).
- **Closer to her boots:** today the art's box ends 115 canvas px below the 404 and the boots, then there is the page gap, so the line floats far away. Crop the bottom of the viewBox so the art ends about 24 canvas px below the lowest of the boots and the 404's baseline (the numeral's bbox bottom in `404.json` is the ground line). Do the same in the phone viewBox, and update the CSS `aspect-ratio` values to match both. Then set the gap so the text's top sits **16–24 CSS px below the boots** at 1280x800 and at iPhone 13 size. The art plus text stays centred on the page as one group.

## Must not change
Art, animation timing, the hunt's logic (apart from the reset), the form, `api/`, `middleware.js`, the 404's images and JSON.

## Checks for the report
1. Tests, type check and build pass, and the hunt is 50 of 50 (Chrome and WebKit, desktop and phone).
2. **Tagline:** screenshots of the masthead at 375, 390, 568x320 (sideways), 890x800, 1280x720 and 1440x900, in Chrome and WebKit. Report the row count at each size. The fit check (no clipping, no sideways scroll) across the same 25 sizes as job 013b.
3. **Reset:** find 3 mushrooms in Build and 2 in Grow, then: one tap (label changes, nothing cleared, back after 4 s); two taps (all of it cleared, repainted, counters and tab marks reset, Contact locked again). Do it again after all 50 (`?all`), and confirm the form is locked and Set Design's backdrop restarts. Reload: still reset. Two tabs: the second follows. A recording of the two-tap reset on a phone.
4. **404:** screenshots at 1280x800 and iPhone 13 with the gap measured in CSS px. Rerun job 014's checks 2, 3 and 5.

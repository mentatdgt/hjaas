# Scene 1: Wren's review 02 (2026-11-19), from the quality audit

For: a build agent on the branch `site/scene-1`. Commit each item separately and push. Open a pull request into `site/scene-1`, never `main`.

The audit was clean: accessibility 100, best practices 100, 0 axe issues. These are the fixes worth doing. **Don't remove or shorten the painted-in intro.** It is the design, and Lighthouse's largest-contentful-paint penalty for it is accepted.

## 1. Remove the WebKit freeze at the end of the intro (most important)
The audit measured a 455 ms freeze at the end of the intro fade in WebKit, and 1.5 s on a cold load. Every iPhone browser uses WebKit, so iPhone visitors see this.
- Find the cause, likely the hand-over from the brush-masked room to the plain room: a large image decode, mask compositing, or a layer re-raster at the swap.
- Fix it, for example by:
  - decoding the room image before the intro starts (`img.decode()` / an ImageBitmap);
  - keeping the same layer instead of swapping elements;
  - removing the mask in one step on a frame where nothing else moves;
  - splitting the brush painting across frames.
- Verify in WebKit (Playwright) on a cold load: no frame longer than ~50 ms at the end of the intro. Record before and after numbers.

## 2. Load the room image sooner, without changing how the intro looks
- Give the room image high fetch priority and start fetching and decoding it at page load, so the brush can start as early as possible.
- Keep the brush reveal exactly as it is.

## 3. Shrink the mushroom and logo files
- The audit estimates 0.9–1.3 MB of savings.
- Resize the mushroom sprites to at most 2× their largest displayed size, and the logo to 2× its displayed width.
- Keep them lossless if lossy causes visible edges, otherwise use WebP at quality ~95.
- Keep `npm run assets` as the only way these files are made.

## 4. Basic page metadata
- Add a meta description (placeholder text marked `TODO(copy)`), a theme colour, and Open Graph title, description and image tags (use the logo for now).
- Add a `robots.txt` that **disallows all crawling for now**. The site isn't launched; the user will open it up at launch.

## Not doing
- Removing the paint-in to improve the Lighthouse score.
- Contrast inside the dialog: axe couldn't decide, but it's dark text on a cream panel, so visually fine.

## Done means
Append a "Review 02" section to `site/qa/REPORT.md` with ✅/❌ per item and before/after numbers for items 1–3. Push and open the pull request.

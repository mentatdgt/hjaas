# Favicon, home-screen icon, tab title: build report 01

From: Fable. For: Wren and the user. 2026-11-26. Job 017. Branch: `site/review-fixes`, commit `42d41ae`; `main` and `deploy` were not touched.
Brief: `reviews/favicon-title-build.md`. Evidence: `site/qa/favicon-title/`.

**Result: built, with two checks not done as written:** there is no picture of Chrome's tab strip itself (Chrome's own tab list instead), and the tab icon could not be seen in WebKit. 393 tests (4 new), type check and build pass.

```
cd ~/hjaas && git checkout site/review-fixes && git pull && cd site && npm install && npm test && npm run build
node qa/tools/favicon-title.mjs
```

## What changed
- **Icons:** the five files are in `site/public/`, and the five links are in `index.html` and `404.html`.
- **Vite does rewrite the links.** With `base: './'`, `/favicon.ico` in `index.html` came out as `./favicon.ico`. Each of the five has `vite-ignore`, Vite's own attribute for this, which is not in the built page. The built addresses are absolute.
- **`npm run assets` would have overwritten the new icons** with the reel. `scripts/build-assets.mjs` now copies the five from `assets/logo/favicon/`. The brief does not name this file.
- **Title:** `<title>` and `og:title`. No code sets `document.title`. The 404's title is unchanged.
- **Reset:** `src/engine/reset.ts` (new, with a test). The gap is counted between the two click events' own times, so a busy page does not turn a double tap into two slow ones. It counts from the first tap: an ignored tap does not restart the 500 ms or the 4 s.
- **QA tools:** `paint-in.mjs` and `review03.mjs` use Reset. `copy-round-2.mjs` tapped twice within 300 to 500 ms, so its waits are longer now.

## Checks

| Check | Result |
|---|---|
| Tests, types, build | 393 of 393, pass, pass |
| `dist/` | All five files at the root, identical to the delivered ones. Built `index.html`: five links, absolute; title and `og:title` right. 404: five links, title as before (`build.json`) |
| Title, Chrome and WebKit | `/`: "Hui Jie as a Service (HJaaS)", the same after a change of scene. `/a/deep/missing/path`: "Page not found · HJaaS", status 404 (`icons.json`) |
| Each icon answers 200 | All five on both pages in both browsers, asked for from the page; drawn sizes 48, 32, 16, 192 and 180 |
| Chrome's tab icon | On both pages Chrome asked for `/favicon-32.png` by itself, 200, and only that one. Its Tab Search list shows the mushroom and the title for both (`chrome-tabs.png`) |
| WebKit's tab icon | **Not seen.** Playwright's WebKit has no tab icons and asked for none. Only its titles, links and the icons' answers are checked |
| Reset, 25 of 50 found | WebKit iPad, iPhone and desktop, Chrome desktop and phone. Taps 142 to 148 ms apart: nothing cleared, "Tap again to reset all 50" stays, label back 4.0 to 4.1 s after the first. Taps 997 to 1009 ms apart: 0/50, nothing saved, still so after a reload. A double tap and a third tap at 1 s: reset. No errors (`reset.json`) |
| `review03.mjs desktop`, `paint-in.mjs states` | Both run to the end, no page errors, and the Reset step repaints. **One check in `states` fails, "slow network" (`fadesIn: false`); it fails the same way on the commit before this job** (`tools/`) |
| `copy-round-2.mjs` reset, all, tabs, keys | Same results as job 015, but for the label's time back (3.98 to 4.03 s) (`tools/copy-round-2/`) |
| Independent reviewer, commit `42d41ae`, own scripts | **Pass with notes.** It repeated the build, icon and title checks, and Reset in WebKit on an iPad: 149 and 453 ms clear nothing, 602 and 1003 ms reset. Its notes are the two files not named in the brief (above) and items 1 to 4 below |

## For Wren
1. **No tab-strip screenshot:** the Mac's screen was locked and this run may not record it. `chrome-tabs.png` is Chrome's own tab list. Please look at a real Chrome and a real Safari tab on the preview.
2. **Holding Enter on Reset** may still reset after 500 ms, because key repeats count as taps. Not tested; the brief is about taps.
3. `qa/tools/review-fixes.mjs` (line 593) still looks for "Replay painting". The brief does not name it, so it is unchanged.
4. Absolute icon links need the site at a domain's root, as on Vercel; from a subfolder the icons would be missing.
5. Not run: the hunt, recordings and frame times (nothing there changed), and a real iPad.

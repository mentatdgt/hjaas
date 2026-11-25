# Copy round 2: build report 01

From: Fable. For: Wren and the user. 2026-11-26. Job 015. Branch: `site/review-fixes`; `main` and `deploy` were not touched.
Brief: `reviews/copy-round-2-build.md`. Evidence: `site/qa/copy-round-2/`. No email was sent.

**Result: built.** 389 tests (2 new), type check and build pass. The hunt is 50 of 50.

```
cd ~/hjaas && git checkout site/review-fixes && git pull && cd site && npm install && npm test && npm run build
node qa/tools/copy-round-2.mjs      (`all` also needs npm run dev)
```

## 1. Tagline
- The line is the brief's. From 885 px wide up it is **one row** at every width measured, also in short windows. From 761 to 884 px and on phones it is two rows.
- **Size:** 17.3 px at 1440 (was 15.6), 15.4 at 1280, 14.6 at 890; 14.5 on phones (was 14); 13 on a phone on its side (was 11.5), 12 under 800 px, 11 under 640 px.
- **How it fits:** one row, as large as the space between the logo and the tabs allows, never under 14.4 px. In a short window, where the picture is narrower than that row needs, the masthead stands out past the picture (as it already did on phones held sideways). Before, the picture's width was all it had: that is how a short 890 px window got many rows.
- **Space given back:** 1440x900: the masthead is 76.8 px, the picture starts 11 px higher than in 013b's fit. 1280x720: the picture is 880 px wide (866). 375x667: the window is 388 px tall (371).
- **The tabs take their own row only at 760 px and under** (013b: 860).
- `text-wrap` is `balance`, not `pretty`: WebKit's `pretty` made three rows of it at 568x320.

## 2. Reset mushrooms
- As the brief says. It is in `site.ts`; `syncFinds()` (`mushrooms.ts`) now also brings mushrooms back, and the backdrop (`progress.ts`) can go back.
- **The storage listener did not handle a reset:** it only ever added finds. It now follows one: the second tab's mushrooms, counters, tab marks, Contact button and backdrop go back at once, without repainting.
- **Readings taken:** it is offered with reduced motion too (Replay was not), and the room then comes back by the 200 ms fade. After a first find it fades in once the counter has settled. A reset also clears the saved "seen" and pan positions, as `resetProgress()` does.
- **Place:** on desktop Reset is left of Pause, so it can appear and change its words without moving Pause. On phones it is right of Pause. Room for the longer label is kept on the open side.
- After a keyboard reset the focus goes to Skip, then Pause (with reduced motion: the scene's tab).

## 3. 404
- Text and link as in the brief. viewBox `0 0 1672 854`; phone `144 0 1384 854` (the numeral's bottom, 830.2, plus 24). Both `aspect-ratio` values match. The gap is a formula, so the text box is 18 px below the boots at any width.
- Also: the text is centred (the new line wraps on a phone and was set left), the link stays on one row, and in windows 700 px tall and over the space under the text equals the space over the numeral, so what is seen is centred.

## 4. Checks

| Check | Result |
|---|---|
| Tests, types, build | 389 of 389, pass, pass |
| Hunt | 50 of 50 by tapping: desktop, phone upright and on its side, Chrome and WebKit. No missed taps, no errors (`hunt/`, `hunt-webkit/`) |
| Tagline rows, Chrome = WebKit | 375x812: 2. 390x844: 2. 568x320: 2. 890x800: 1. 1280x720: 1. 1440x900: 1 (`tagline.json`, `masthead-*.png`) |
| Fit | 013b's 25 sizes and 5 short windows, Chrome and WebKit: no clipping, no sideways scroll, whole tab names, arming Reset moves nothing (`fit.json`) |
| Steady | Every second width from 1700 to 320 px, 900 and 620 px tall: the masthead and picture move over 2 px at three places only: 760 (tabs' row, 27 px; was 44 at 860), 600 (phone layout, 4 px), 349 (tabs wrap, 44 px, as before) (`steady.json`) |
| Reset, 3 in Build and 2 in Grow | Desktop and phone, Chrome and WebKit, with motion and reduced. One tap: label and `aria-live` change, nothing cleared, label back after 4 s. Two taps: nothing saved, repainted, 0/10 and 0/50, all 10 hidden in both scenes. Two taps during a scene change: nothing. Reload: still reset. No errors (`reset.json`) |
| Tab marks, and after all 50 | Marks gone, Contact hidden, saved finds gone after a reload; finds count again from 1 (`reset.json`). `?all=50` on the dev server: backdrop 10 pieces, then 0; 3 after three finds (`all.json`, `set-*.jpg`) |
| Two tabs | Chrome and WebKit, a tab on Build and one on Set Design: both follow; a find made afterwards in the second reaches the first; after all 50 the second's Contact button is locked again (`tabs.json`) |
| Keyboard | Focus, Tab order, Skip during the reset's painting (`keys.json`) |
| Recording | `reset-phone.mp4` (Chrome, 390x844): a tap, 4 s, two taps. Sheet: `reset-phone-sheet.jpg` |
| 404 gap | Boots to the text's box: 17.9 px at both sizes; to the capitals 21.6 to 21.7. Chrome and WebKit (`404.json`, `404-*.png`) |
| 404, centred | 1280x800: 144.4 px over the numeral, 144.4 under the text. iPhone 13: 201.3 and 202.1 |
| 404, job 014's check 2 | Status 404, no failed requests, font loaded, no page errors, no sideways scroll, both sizes and browsers. The only console line is the browser's own for the address |
| Check 3 | 8 s at 1280x800 in Chrome: every film frame is one single pose, or the moment before Rachel appears. 482 page samples: one arm in each. Chrome only sent the 42 frames that changed (`404-arms.json`) |
| Check 5 | Two screenshots 2 s apart: identical at 1280x800 in both browsers and at iPhone 13 in WebKit. **Chrome at iPhone 13: not identical;** 117 colour values differ by 1 of 255. The old page does the same (38 to 217 values), so it is Chrome's drawing of the images, not motion |
| Not touched | Art, the form, `api/`, `middleware.js`, the 404's images and JSON |

## 5. For Wren
1. **At 890 px the line ends 16 px before "Build".** One row, as the target allows, but close. Two rows there is one number in `site.css` (`@container (max-width: 885px)`).
2. **A double tap resets:** the second tap counts however soon it comes, as the brief says.
3. **An open contact form** in a second tab stays open when the first tab resets, so that nothing typed is lost. Once closed, it is locked.
4. **`qa/tools/paint-in.mjs states` and `review03.mjs desktop`** click "Replay painting", which is gone. They were not run or changed.
5. Not measured: frame times of the reset's repaint. It uses Replay's painting code.

# Copy round 1 and Instrument Sans: build report 01

From: Fable. For: Wren and the user. 2026-11-25. Job 013b. Branch: `site/review-fixes`; `main` and `deploy` were not touched.
Brief: `reviews/copy-round-1-build.md` (on `main`). Evidence: `site/qa/copy-round-1/`. No email was sent.

**Result: built.** 387 tests (13 new), type check and build pass. No console errors. The hunt is 50 of 50.

```
cd ~/hjaas && git checkout site/review-fixes && git pull && cd site && npm install && npm test && npm run build
node qa/tools/copy-round-1.mjs      (shots, fonts, width, fit, form)
```

## 1. What changed

- **Font.** `@fontsource-variable/instrument-sans` 5.3.0, weight axis, its Latin file only (`src/engine/font.css`, `font-display: swap`). Bricolage Grotesque, Spectral and `--hj-serif` are gone. The stack is the brief's.
- **Tagline, search text, counter, form:** the brief's words, exactly. `hereNone` is in `CounterCopy`, in `hereLabel` and in the unseen measuring of `caption.ts`.
- **The choices** are in one file, `src/engine/needs.js`, imported by the form and by `api/contact.js`. The tests send each choice to the function and check that the mail says it, and that the five old scene names are refused.
- **QA tools:** `copy-round-1.mjs` is new; `counter.mjs` and `contact-form.mjs` know the new words.

## 2. Readings taken

- **The bounded font wait is not on this branch.** The page still awaits `document.fonts.ready`, as it did before this job; left as it was.
- **"Latin subset only, as today":** today's build also shipped Latin Extended and Vietnamese files, which browsers did not download. Now only the Latin file is in the build.
- **Weights:** "Hui Jie", the form's title and "Got it, thank you." are 500 (Spectral had only 400, and a 400 sans read too light beside its line). Labels, chips and buttons keep theirs (400, 500, 600).
- **`TODO(copy)`** is also gone from the comment over `COPY` in `site.ts`. Skip, Pause animation, Play animation, Replay painting and Scenes are still the words they were; this round does not name them.

## 3. Layout the new words moved

The tagline is twice as long as its placeholder, and the new font's figures and tabs have other widths. Without changes the tagline was cut or ran to 12 rows at some sizes, and "Set Design" broke in two in the menu. So, in `site.css` only:

| Where | Change |
|---|---|
| Desktop | The tagline has two rows (15.6 px at 1440, was 17.3); the page reserves them. The picture is the same size at 1024, 1440 and 2200, and starts 11 px lower at 1440 |
| Laptops | The picture gives up room where height is short, e.g. 866 px wide at 1280 × 720 |
| Windows up to 860 px, tablets | The tabs go on their own row over the picture, at the right |
| Phones upright | The tagline has three rows of 14 px beside the logo (four at 349 px and under). The window is as tall as before at 375 × 812, 390 × 844 and 430 × 932; 371 px instead of 388 at 375 × 667, 444 instead of 461 at 360 × 740 |
| Phones on their side | Two rows of 11.5 px; name 20 px; picture 458 px wide instead of 465 at 844 × 390 |
| Counter | The number column is set in `em`: the font's `ch` is its wider proportional zero. Labels on phones are 14 to 13 px, so that "10/10 Set Design complete Next: Design →" stays on its row |
| Form title | 20 px, so that it is one row on a 375 px phone. "Got it, thank you." is 22 px |
| Message field | The placeholder's grey is set (`#756f64`): the browsers' own differ, and Safari's is faint |

## 4. Checks

| Check | Result |
|---|---|
| Font bytes downloaded | Before 63,040 (two files), after **30,092** (one). Chrome and WebKit (`fonts.json`) |
| Instrument Sans everywhere | 20 parts (masthead, tabs, counter, buttons, form): computed style and text widths in Chrome and WebKit, and Chrome's report of the font drawn wherever the part was on screen |
| Screenshots | Chrome and WebKit, 375 px and 1440 px: masthead; 0, 3, 10 and all 50 found; form open, missing fields, email typo, send failed, sent |
| The cream label | A first find in Build and Set Design, every frame, 2 sizes × 2 browsers: "hiding in" → "found in" with label, number, red label and caption all at the same place. The word itself is 2.5 px shorter, with nothing after it (`width.json`) |
| Fit | 25 sizes, 320 to 2560 px (`fit.json`): whole tagline, unbroken tab names, the longest finished row inside the page, no sideways scroll. One exception: section 5, 2 |
| End to end | The production build's form in Chrome and WebKit, `/api/contact` the real function, Resend mocked: each of the six choices alone, then all six, accepted. The JSON Resend would get is below and in `form.json` |
| Vercel's bundling | `@vercel/nft` (Vercel's file tracer) on `api/contact.js` includes `src/engine/needs.js`. Not run on Vercel itself |
| Hunt | 50 of 50 by tapping, desktop, phone upright and on its side, Chrome and WebKit: no missed taps, form opens, no errors (`hunt/`, `hunt-webkit/`) |
| Counter states | 13 saved hunts × 5 scenes, return visits, quick finds, Next, the drift: 0 problems (`hunt/states.json`) |
| No markers left | No `TODO(copy)` in `index.html` or `src/` |
| Not touched | `middleware.js`, the art, animation timing, the hunt's logic, memory |

All on the final build, except the counter states, which ran just before the last change of two font sizes (the form's title and "Got it, thank you.").

What Resend would get ("Production for a shoot" picked):

```
{"from":"HJaaS <from@example.org>","to":["inbox@example.org"],"reply_to":"wren@example.org","subject":"HJaaS: Wren",
 "text":"Name: Wren\nEmail: wren@example.org\nNeeds: Production for a shoot\n\nA shelf for the mushroom lab, please.\n"}
```

## 5. For Wren

1. **The sent state still has the dialog's title over it:** "Hi! What have you got in mind?", then "Got it, thank you." The brief does not change it; hiding the title there may read better.
2. **On a phone 568 px wide or less held sideways** the tagline is cut after two rows (the placeholder was cut there too).
3. **On a 375 px phone the chips take four rows,** in the brief's order, with "Designing a space" and "Something else" alone on theirs.
4. `STATUS.md` still lists the copy as `TODO(copy)`; left for you.

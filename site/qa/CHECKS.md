# Functional checks

Run on the final code with Playwright (Chrome unless noted), 2026-11-18. Each line is a measured result,
not a reading of the code.

## Rachel

| Check | Result |
|---|---|
| Hammer rhythm over 62 s (`m2/rhythm-60s.json`) | 48 swings a minute. Median holds: contact 300 ms, lift 133 ms, wind-up 349 ms, down-swing 67 ms. All inside the brief's ranges once rounded to 60 Hz frames. |
| Blinks | 21 in 62 s. Every one is half, closed, half, and starts and ends on the contact frame. |
| Flicker: one pixel of her hair in every frame of the one-minute recordings | Desktop: 1,478 frames, luminance 57 to 58, never missing. iPhone WebKit: 1,504 frames, 48 to 49, never missing. |
| Edge fringe (`m2/edge-zoom-3x.jpg`) | None visible at 3× against the orange doorway and the wall. |
| Tab hidden for 2.5 s | 0 pose changes while hidden; the loop carries on when the tab returns (15 pose changes in the next 2.5 s). |
| Reaction joins the loop | Starts only from the contact frame and hands back to it (pose log). |
| Two finds 0.9 s apart | Counter reads 2; one reaction played, not two. |

## Hunt and counter

| Check | Result |
|---|---|
| Hit areas at 1440×900, 844×390, 390×844, 412×915, 375×667 | Smallest is 44 × 44 CSS px; no two overlap at any size. |
| Tab order | Logo, then the mushrooms left to right: sill, drape, skirting, screed, tiles, conduit, socket, ladder-foot, ladder-step, toolbox. |
| Enter on a focused mushroom | It is found, focus moves to the next mushroom, and "1 of 10 mushrooms found. Find all 10 to reach Hui Jie." is announced. |
| Progress after a reload | The found mushroom stays found and the counter shows it. |
| Hint | With nothing found, one mushroom wiggles once at 60 s: 7° at most, 318 ms. |
| Flight | 140 ms lift and pop, then a 420 ms arc; fades over the last 7% (`m3/flight-slow.jpg`). |
| Landing (`m3/counter-landing.jpg`) | The digit rolls, the pin squashes and settles, and the glint crosses the rim, in about 600 ms. |

## Phone

| Check | Result |
|---|---|
| Starting crop at 390×844 and 412×915 | Plate x 514 to 1267, as specified. |
| Page scroll | None: the page is exactly as wide and as tall as the screen at every size tested. |
| Layout shift | 0.00 in every trace. |

## Unlock and form

| Check | Result |
|---|---|
| Finding all ten for real | The counter becomes the button, focus moves to it, "All 10 mushrooms found. The Contact Hui Jie button is now available." is announced, and the unlock is saved. |
| Reload after that | The button is there straight away, with no mushrooms left, after the quick intro (1.6 s). |
| Empty submit | Three messages, one under each required field; focus goes to the name. |
| Bad email | "That email looks incomplete. Check it for typos." appears on leaving the field and clears as soon as it is fixed. |
| Send on the dev server | "Sending", then the sent state in test mode; the payload is in the console and nothing leaves the browser. |
| Send on a production build with no endpoint (`m6/prod-form-not-connected.jpg`) | The sheet says the form is not switched on as soon as it opens; Send is off; pressing it does nothing and never shows a sent state. |
| Escape | Closes the sheet and returns focus to the button. |

## Reduced motion

| Check | Result |
|---|---|
| Intro | A 312 ms fade; no paint canvas is created. |
| Rachel | Contact holds with blinks and one or two small taps; no full swings. |
| Find | The mushroom fades; the number cross-fades (`video/reduced-desktop.mp4`, `video/reduced-iphone.mp4`). |

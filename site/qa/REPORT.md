# HJaaS site, scene 1 — build report

Built overnight on 2026-11-17/18 from `HANDOVER.md`, on the branch **`site/scene-1`** (pushed, not
merged). All seven milestones are done and each one was committed and pushed separately.

## See it on your Mac

```
cd ~/hjaas/site && npm install && npm run dev
```

Then open **http://localhost:5173/**

- To watch the full intro again: http://localhost:5173/?reset&intro=full
- To jump straight to the unlocked button and the form: http://localhost:5173/?found=10&intro=off
- On your phone, on the same Wi-Fi: use the "Network" address the command prints.

Evidence paths below are inside `site/qa/`.

## Section 3: what was asked for

### 3.1 The living scene

| | Requirement | Evidence |
|---|---|---|
| ✅ | The room fills the stage; desktop, tablet and landscape phones show the whole room | `screens/desktop-01-fresh.jpg`, `desktop-13-tablet-1024x768.jpg`, `desktop-12-landscape-phone-844x390.jpg` |
| ✅ | Rachel placed exactly as `composite()` does, with a soft ground shadow drawn in code | `m1/desktop-static.jpg` (matches the timing reference video); `src/scene1/rachel.ts` |
| ✅ | Sharper art is a file swap: her scale comes from the image | Already used: the site runs on the 2× frames from `frames/016-upscale/` with no code change |
| ✅ | Hammer loop with human timing, ported from `schedule()` with live randomness | `m2/rhythm-60s.json`, `video/loop-desktop.mp4`, `video/loop-iphone.mp4` |
| ✅ | Blinks only on the contact frame: half 40 ms, closed 70 ms, half 40 ms | `CHECKS.md` (21 blinks in 62 s, none malformed) |
| ✅ | Instant, glitch-free pose switching from pre-decoded frames, timed on `requestAnimationFrame` | `CHECKS.md`: Rachel is present in all 1,478 desktop and 1,504 iPhone frames of the one-minute recordings |
| ✅ | Pauses when the tab is hidden and resumes cleanly | `CHECKS.md` |

### 3.2 Mushroom hunt and counter

| | Requirement | Evidence |
|---|---|---|
| ✅ | Ten mushrooms in believable hiding spots across the whole width | `m3/spots.jpg` (close-ups of all ten) |
| ✅ | Scaled for depth: 18 px at the back wall to 42 px at the front | `src/scene1/mushrooms.ts` (`SPOTS`) |
| ✅ | No glow or outline; a slight warm tint per spot | `m3/spots.jpg` |
| ✅ | Hit areas at least 44 × 44 px, never overlapping | `CHECKS.md` (five screen sizes), `impeccable/assessment-b/mechanical.json` |
| ✅ | Nine drawings, ten spots: drawing 1 is reused mirrored at more than twice the size, at the far end of the room | `m3/spots.jpg` (socket and toolbox) |
| ✅ | On a find the mushroom lifts, pops and flies in an arc into the counter (560 ms) | `m3/flight-slow.jpg`, `video/find-desktop.mp4`, `video/find-iphone.mp4` |
| ✅ | A find during a reaction still counts and does not restart her | `CHECKS.md` |
| ✅ | Counter shown as a small enamel pin: cream face, thin gold rim, a drawn mushroom, tabular figures | `screens/desktop-01-fresh.jpg`, `screens/iphone-01-fresh.jpg` |
| ✅ | The digit rolls like an odometer; the pin squashes (peak 1.055) and settles with almost no bounce; the rim glints | `m3/counter-landing.jpg` (the pin every 50 ms as a mushroom lands) |
| ✅ | Reduced motion: the number cross-fades | `video/reduced-desktop.mp4`, `video/reduced-iphone.mp4` |
| ✅ | One hint: after 60 s without a find, one mushroom wiggles once (7°, 318 ms) | `video/wiggle-desktop.mp4`, `video/wiggle-iphone.mp4` (the wiggle is at about 1:00) |
| ✅ | Keyboard: Tab goes through the mushrooms left to right, with a visible ring | `screens/desktop-04-keyboard-focus-on-mushroom.jpg`, `CHECKS.md` |
| ✅ | Progress is remembered per visitor (`localStorage`, guarded) | `CHECKS.md`; `src/scene1/state.ts` |

### 3.3 Reaction

| | Requirement | Evidence |
|---|---|---|
| ✅ | A data-driven player: the site plays `reaction.json` exactly as you delivered it | `src/scene1/reaction.ts`; `screens/desktop-02-first-find-reaction.jpg` |
| ✅ | Always enters from and returns to the contact frame, after the current swing lands | `CHECKS.md` |
| ✅ | Real frames instead of the placeholder: the pull brought `frames/005-reaction-motion/approved/`, so the dissolve placeholder was never needed | `m3/find-reaction.jpg` |
| ⚠️ | The wink is not in yet (task 015 is still open), so she holds the thumbs-up for 0.9 s without it | It will arrive as new entries in `reaction.json` plus image files |

### 3.4 Intro

| | Requirement | Evidence |
|---|---|---|
| ✅ | The room is painted in by loose brush strokes, back wall, window light, floor, then props, in 2.16 s | `m4/paint-stages.jpg`, `video/intro-desktop.mp4`, `video/intro-iphone.mp4` |
| ✅ | Rachel appears last with a short fade and settle, then starts work; then the logo with its first glint; then the counter | Same videos; the timeline is written out at the top of `src/scene1/intro.ts` |
| ✅ | Strokes are made in code; there are no mask images | `src/scene1/paint.ts` |
| ✅ | Holds frame rate on a throttled phone profile | `traces/SUMMARY.md`: 1 dropped frame in 195, no long tasks |
| ✅ | Full intro the first time, a quick version (about 0.8 s of painting) afterwards | The second half of `video/intro-*.mp4` |
| ✅ | Reduced motion: a 300 ms fade and occasional taps instead of swings | `video/reduced-*.mp4`, `CHECKS.md` |

### 3.5 Mobile

| | Requirement | Evidence |
|---|---|---|
| ✅ | Portrait phones show a 4:5 crop starting on plate x 514–1267 | `screens/iphone-01-fresh.jpg`, `CHECKS.md` |
| ✅ | Panning follows the finger, has momentum, eases into the edges, no vertical scroll fighting | `video/pan-iphone.mp4`; `traces/SUMMARY.md`: 0 dropped frames |
| ✅ | A one-time swipe hint that leaves at the first pan | `screens/iphone-01-fresh.jpg` (the small hand at the foot of the room) |
| ✅ | Hit areas stay 44 px; no page scroll; no layout shift | `CHECKS.md` |
| ✅ | Tested at 390 × 844 (WebKit) and 412 × 915 | `screens/iphone-*.jpg`, `screens/android-412-*.jpg`; also 360 px wide: `screens/narrow-360-*.jpg` |
| ⚠️ | Not yet tried under a real thumb | Everything above is emulation on this Mac |

### 3.6 Logo and glint

| | Requirement | Evidence |
|---|---|---|
| ✅ | The temporary tape-measure PNG, not recoloured or redrawn | `screens/desktop-01-fresh.jpg` |
| ✅ | 201 px wide at 1440, 129 px on an iPhone | `impeccable/assessment-b/mechanical.json` |
| ✅ | Temporary favicon cropped from the reel at 32 and 180 px | `site/public/favicon-32.png`, `site/public/apple-touch-icon.png` |
| ✅ | Glint every 9 s and on hover or focus, 650 ms, clipped to the logo's own alpha | `m4/logo-glint.jpg`; `src/scene1/logo.ts` |
| ✅ | Enters in the intro after Rachel | `video/intro-*.mp4` |

### 3.7 Unlock and contact form

| | Requirement | Evidence |
|---|---|---|
| ✅ | At 10/10 Rachel reacts once more and tiny mushrooms shower for about a second | `m6/shower-mid.jpg`, `video/finale-desktop.mp4`, `video/finale-iphone.mp4` |
| ✅ | The counter itself widens into "Contact Hui Jie" in one motion | `m6/morph-frames-desktop.jpg`, `m6/morph-frames-iphone.jpg` (the morph frozen at six points) |
| ✅ | A sheet opens from that button: name, email, six choice chips, message | `screens/desktop-06-form-open.jpg`, `screens/iphone-06-form-open.jpg` |
| ✅ | Labelled fields, inline validation, success and error states | `screens/*-07-form-validation.jpg`, `*-09-form-sending.jpg`, `*-10-form-sent-test-mode.jpg`, `m6/prod-form-not-connected.jpg` |
| ✅ | Not reachable before 10/10; the counter says once, briefly, what the hunt is for | `screens/desktop-02-first-find-reaction.jpg` |
| ✅ | Sending is one small function behind `TODO(form-endpoint)`; a production build never pretends | `src/scene1/submit.ts`; `m6/prod-form-not-connected.jpg` |
| ✅ | The unlock is remembered | `CHECKS.md` |
| ✅ | Critiqued and polished with Impeccable | `impeccable/CRITIQUE.md` |

## Section 5: QA

| | Requirement | Evidence |
|---|---|---|
| ✅ | Playwright videos of the intro, a minute of the loop, a find, the 60 s wiggle and the finale with the form, on desktop 1440 × 900 and iPhone portrait in WebKit | `video/` (13 MP4 files) |
| ⚠️ | A limit of those videos: they are 25 frames a second, and the small flying mushroom is mostly missing from them mid-flight | The flight and the morph are shown as frozen frames instead: `m3/flight-slow.jpg`, `m6/morph-frames-*.jpg` |
| ✅ | Screenshots of every state | `screens/` (46 images: desktop, iPhone, Android 412, 360 px, landscape, tablet, 2560 px, reduced motion) |
| ⚠️ | DevTools traces of the intro, a find, the unlock and a phone pan at 4× CPU throttling with phone emulation | `traces/SUMMARY.md`. No stalls; the target of zero dropped frames and zero long tasks is met with the tracer off and narrowly missed with it on (numbers below) |
| ✅ | Motion review against `STANDARDS.md`, item by item | `MOTION-REVIEW.md`: no fails, four deliberate departures with reasons |
| ✅ | Impeccable critique on the logo slot, counter, unlock and form, and fixes | `impeccable/CRITIQUE.md`: 24 of 32; all five priority issues fixed; the detector now reports nothing |
| ✅ | Watched the recordings for the earlier complaints | See below |

**The earlier complaints, checked one by one:**

- **Jerky rhythm:** the loop is never a fixed frame rate; 48 swings a minute with taps and pauses (`m2/rhythm-60s.json`).
- **Unnatural blinks:** only ever on the contact frame, in a pause or a long hold.
- **Pose pops:** the reaction uses the real in-between frames; poses are never cross-faded.
- **Disconnected hand:** every frame shares one transform, and the box and hands are inside her frames.
- **Framing too tight:** desktop shows the whole room; phones show the agreed 4:5 crop.
- **Flicker on pose switch:** none in about 1,500 recorded frames each on desktop and iPhone.
- **Edge fringe:** none at 3× (`m2/edge-zoom-3x.jpg`).

## Performance numbers

iPhone-sized viewport at pixel ratio 3, CPU throttled 4×, Chrome DevTools traces:

| Scenario | Frames | Dropped | Long tasks (over 50 ms) | Longest task |
|---|---|---|---|---|
| Intro reveal | 195 | 1 | 0 | 24 ms |
| First find | 216 | 1 | 0 | 27 ms |
| Second find | 216 | 5 | 0 | 16 ms |
| 10/10 unlock | 216 | 6 | 1 (50 ms, as the last mushroom lands) | 50 ms |
| Form opening | 54 | 3 | 1 (67 ms, at the tap) | 67 ms |
| Phone pan | 240 | 0 | 0 | 33 ms |

Run again with the same throttling but the tracer off, the scene's own frame log recorded no late
frames and no long tasks in any of the five scenarios.

The traces earned their keep. They found a 480 ms freeze on every counter glint and a 420 ms freeze in
the middle of the first unlock, both of which are fixed; `traces/SUMMARY.md` lists all six findings.

## What is placeholder

- **The wink.** Not delivered yet; the thumbs-up hold plays without it.
- **The logo.** The temporary cut-out, and the favicon made from it.
- **The form endpoint.** Nothing is sent anywhere until `VITE_FORM_ENDPOINT` is set (`site/README.md` explains). On the dev server the form runs in a clearly labelled test mode.
- **All copy.** The only words are in two lists, `COPY` in `src/scene1/index.ts` and `COPY` in `src/scene1/form.ts`.
- The reaction is **not** placeholder: it is your `reaction.json` and frames.

## Decisions I made

**Art and assets**

1. Used the 2× frames and the real reaction from tonight's pull, as the handover's late note allows. The dissolve placeholder was not built.
2. WebP: near-lossless for Rachel and the room (a third smaller, no visible difference), lossless for the mushrooms and logo. First load is about 4.3 MB; the reaction's 4.5 MB loads after the intro.
3. The ground shadow is defined against her height, not the image's pixel size. The reference function would have halved it with the 2× frames.

**Rachel**

4. Blinks follow `preview_timing.py` exactly: every pause blinks, and 30% of long contact holds. The brief says "about 30% of the time"; the script is the stated source.
5. The loop measures 48 swings a minute, which is what the script produces. The task file's "about 55" looks optimistic.
6. If she is still reacting when the tenth mushroom is found, she finishes and then reacts once more, so the last find always gets its own.
7. Reduced motion shows only the held thumbs-up pose, with no head or arm travel.

**The hunt**

8. Hiding spots, left to right: window sill, behind the drape's edge, by the skirting, on the screed, on the tiles, on the conduit, in the wall socket, by the ladder's foot, on a ladder step, behind the toolbox. Two are tucked behind things by clipping.
9. No pointer cursor over mushrooms. It would let a visitor find them by sweeping the mouse.
10. The hint repeats: one wiggle for each quiet minute, and it prefers a mushroom currently on screen.
11. Words: "Find the 10 hidden mushrooms", then once after the first find "Find all 10 to reach Hui Jie", and "You found all 10" at the end.

**Intro**

12. The room is painted out of darkness rather than onto pale paper. It matches the dark surround and avoids a bright flash at load.
13. "Once per visit" read as: the full intro the first time ever on a device, the quick one after that.
14. The strokes are drawn with the room image itself as the paint, on one canvas. Nothing is masked, which is why it holds frame rate.

**Phone**

15. Panning is the browser's own scrolling, not custom physics. It is the only way to get true finger-following and momentum, and it stays smooth while Rachel animates.
16. On phones the logo and counter sit in a row above the room, and the row and room are centred together.

**Logo, counter, form**

17. The logo links to the page itself, so that "glint on focus" means something. Say if you would rather it were not a link.
18. Above 1800 px wide the logo and pin grow past the brief's 220 px, because at 2560 px they looked lost.
19. Typeface: Bricolage Grotesque, bundled with the site (no outside requests). It is a new dependency, as are `sharp` (image conversion) and `playwright` (QA), both build-time only.
20. The chips are multi-select and optional. The form is a sheet under the button on desktop and rises from the bottom on phones.
21. On a touch screen the form does not focus a field on opening, so the keyboard does not cover it before it has been seen.
22. With no endpoint, a production build says so as soon as the form opens and switches Send off, rather than after someone has written a message.
23. The morph takes 500 ms, longer than the standards' 300 ms for interface motion: it happens once and is the celebration.
24. Opening the form from the keyboard, and Escape, are instant, per the standards.
25. After the critique the prompt line became a small cream tag instead of a dark pill, so it belongs with the pin.

**Process**

26. Impeccable's product interview was skipped because you were asleep; `HANDOVER.md` stood in for it.
27. Raw traces (about 22 MB) and the review agents' screenshots (about 220 MB) are on this Mac only, not in git. Their summaries and measurements are committed.
28. QA videos are MP4 so they open in QuickTime.
29. I added review switches to the address (`?reset`, `?intro=`, `?found=`, `?slow=`, `?debug`); `site/README.md` lists them.
30. I did not touch `reference/`, `scene/`, `frames/`, `tasks/`, `tools/` or `wren-inbox/`, and ran no image or video generation.

## For Wren: the art pipeline

1. **Logo cut-out.** The temporary PNG has pale grey smears under the reel and at the tape's tip. They disappear on the wall but show clearly on the phone's dark band (`screens/iphone-01-fresh.jpg`). The final needs a clean alpha, and at least 620 px wide: it is shown up to 307 px on large retina monitors.
2. **The wink (015).** Add its frames to `reaction.json` inside the K2 hold and drop the files next to it. No code changes.
3. **One in-between for the look-up.** Between `rx_A49` and `rx_A53`, as task 005 already notes. It drops in the same way as the wink.
4. **A 2× room plate.** At 1672 px the room is stretched 1.5× on a 2560 px monitor and about 1.55× on a phone at pixel ratio 3, while Rachel is now crisp. A 3344 px plate would close that gap; the code only needs the file.
5. **Foreground cut-outs.** Mushrooms can only be tucked behind straight edges by clipping. Separate transparent layers for the ladder, toolbox, bucket and drape would let mushrooms and Rachel go properly behind them, and give better hiding spots.
6. **Page weight.** Rachel's 19 frames are 6.5 MB as near-lossless WebP. Lossy WebP at quality 95 is 138 KB a frame instead of 345 KB, which would cut the page by about 4 MB. I kept to the brief's "lossless or near-lossless"; your call.
7. **Mushrooms on phones.** At the specified sizes the far ones are about 9 to 10 px tall on a phone. They are findable, but the hunt is noticeably harder there than on desktop. Worth playing on a real phone before deciding whether phones should get them larger.
8. **Duplicate frames.** `rx_frame_01`, `rx_K1` and `rx_K2` are byte-identical to the loop's `frame_01`, `K1` and `K2`. Harmless, but the manifest could point at one copy.

## Not done, or not verified

- **A real phone.** Nothing here has been touched by a finger on a real iPhone or Android phone.
- **Safari performance.** WebKit was recorded and screenshotted, not traced.
- **The only route to the form is the hunt.** The review flagged this as the page's biggest drop-off risk. It is the concept, so I left it; a later scene may want a second way in.
- **The Contact button is at the top of the phone screen,** out of easy thumb reach, because it is the counter. Also left as designed.

## Review 01

Fixes from `reviews/scene-1-review-01.md`, items 1–7, on `cursor/scene-1-review-01-fixes-0663` (branched from
`site/scene-1`, with `origin/main` merged in). Done in the order 3, 5, 1, 6, 2, 7, 4; each item is its own
commit. Item 8 waits for Wren's files. Evidence is in `qa/review-01/`; `qa/tools/review01.mjs <item>` remakes it.

| | Item | Evidence |
|---|---|---|
| ✅ | **1. New art from `main`.** `npm run assets` brings in the wink and the fixed K2. The player plays the new `reaction.json` with no code change. One find on desktop Chromium held the frames for half-wink 50 ms, wink 267 ms, half-wink 49 ms (manifest: 50 / 260 / 50). On an iPhone in WebKit the right frames played in the right order, but this VM's software-rendered WebKit dropped a frame there, so the wink held 391 ms and the closing half-wink was skipped. Worth one look on a real iPhone. | `review-01/01-wink.jpg` |
| ✅ | **2. Duplicate frames load once.** `npm run assets` hashes the sources. A reaction frame that is byte-identical to an upscaled frame (`rx_frame_01`, `rx_K1`, `rx_K2`) is written once under `rachel/` and listed in `rachel/reaction/shared.json`. `loadFrame` caches by URL, so the reaction reuses the decoded frame. `reaction.json` is unchanged. Each of the 22 frame and manifest files is requested once. Before this, nothing was actually fetched twice: the site's loop never uses K1 or K2, and `rx_frame_01` has a 0 ms hold. The change makes sure it stays that way when the manifest changes. | `review-01/02-dedupe.png` |
| ✅ | **3. Production ignores the URL switches.** They are read only when `import.meta.env.DEV` is true. On the production build, `?found=10&intro=off&debug` gives 0/10, no Contact button, the normal intro and no `window.__hj`. On `npm run dev` all switches still work. `qa/tools/prod-form.mjs` now starts from saved progress instead of `?found=10`. | `review-01/03-flags-dev-vs-prod.jpg` |
| ✅ | **4. Phones use the screen height.** The stage is `min(150cqw, available height)`, so 2:3 where it fits. Short screens get whatever height is left, exactly as before. The pan starts on plate x 590–1220 at 2:3, and on 514–1267 at 4:5, with crops in between framed in between. At 390×844, 412×915 and 360×740 (Chromium phone emulation), and at 390×844 in WebKit: 2:3 stage, crop at plate x 591–1218, logo and counter in the top row, swipe hint shown. The page never scrolls, even when wheeled, and the stage's box is identical in every frame from first paint to 12 s. The only layout shift (0.002) is the counter's hidden rehearsal at about 60 ms, before the scene is shown. It is the same before this change. | `review-01/04-phones.jpg` |
| ✅ | **5. One hint wiggle per visit.** The hint clock stops after the first wiggle. With `?hint=2`, 16 s without a find gives exactly one wiggle. | `review-01/05-hint-once.jpg` |
| ✅ | **6. Ladder-foot mushroom.** It is now drawing 7, the round golden cap, instead of drawing 5, which read as a nail. It moved 14 plate px right so the wider cap clears the ladder foot. Same spot id, same height (36), so depth scaling holds and saved progress is untouched. There are still ten spots. Drawing 5 is no longer used. | `review-01/06-ladder-foot.jpg` |
| ✅ | **7. Lossy WebP q95 for Rachel.** The loop and reaction frames go from 7.10 MB to 2.97 MB, and the scene's assets from 9.30 MB to 5.17 MB. Settings: alpha kept exact, smart chroma subsampling. At 3× the outlines show no halos and no banding. Across all 20 frames the alpha error is 0 and the worst colour PSNR is 39.7 dB (`rx_wink`), so quality stays at 95. Mushrooms, logo and favicon stay lossless; the plate stays near-lossless. | `review-01/07-outlines-3x.jpg` |

Light QA only, as asked: no video recordings and no performance traces this round.

## Review 02

Fixes from `reviews/scene-1-review-02.md`, items 1–4, on `cursor/scene-1-review-02-a93e` (branched from
`site/scene-1`, with `origin/main` merged in). Done in order, one commit per item. The painted-in intro
is untouched in length and look. Evidence is in `qa/review-02/`. `qa/tools/intro-frames.mjs` measures item 1;
`qa/tools/review02.mjs <intro|load|load-chart|sprites|meta>` makes the rest.

All timings: Playwright WebKit 27.2 on this Linux VM (software rendering), production build (`npm run preview`),
**cold load**: a new browser and a new context for every run, so no HTTP cache and no saved progress (the full
intro plays). "Before" is `site/scene-1` with `main` merged; "after" is this branch.

| | Item | Before → after | Evidence |
|---|---|---|---|
| ✅ | **1. WebKit freeze at the end of the intro.** Cause: when the intro ended, the brush canvas was removed and GSAP cleared the inline styles on seven elements in the same frame, so WebKit repainted the whole plate at once. It was the one frame over 50 ms that kept coming back, always at 3.24 s. During the wash, the `<img>` fading in under the strokes also repainted the plate on every frame. Fix: the wash is drawn into the brush's own canvas. The paint is the room's own pixels, so this gives exactly the same image. The canvas then stays on as the room: nothing is swapped and nothing is cleared when the intro ends. The `<img>` takes over only if the plate is resized, when everything repaints anyway. | Longest frame from the wash to 1 s after the intro, iPhone 13 profile, 16 runs each: **before 39–62 ms**, a frame over 50 ms in 4 of 16 runs (60, 62, 51, 53 ms), always at the hand-over. **After 36–47 ms, 0 frames over 50 ms in all 16 runs.** The worst frame over the whole intro is the same frame in every run. The hammer loop afterwards: worst frame 22–31 ms before, 21–33 ms after. Desktop 1280 × 760: 27–40 ms before, 28–30 ms after. | `review-02/01-frames-raw.txt` (every run), `review-02/01-intro-before-after.jpg` |
| ✅ | **2. Room image loads sooner.** A `<link rel="preload" as="image" fetchpriority="high">` in the page head starts the room download while the script is still loading. `loadRoom()` now requests it as an `<img>`, the only kind of request WebKit matches to that preload (a `fetch()` downloaded the 1.26 MB room twice), and makes the brush's ImageBitmap from it. It is still downloaded once, in WebKit and in Chromium. The reveal is the same code. | Room request starts (ms after navigation, 3 runs each): **45–51 → 4–5** on localhost, and **504–509 → 309–312** with 150 ms added to every request. Brush starts: **1070–1082 → 921–964 ms** with the added 150 ms. On localhost there is no change (612–621 before, 614–683 after; 597–630 → 614–666 over 6 more runs): there the brush waits for the counter's hidden unlock rehearsal (about 0.45 s), not for the room. | `review-02/02-room-load-timeline.png` (median runs), `review-02/02-room-load-raw.jsonl` |
| ✅ | **3. Smaller mushrooms and logo.** `npm run assets` sizes every mushroom to 154 px tall: the tallest spot is 42 plate px, and at 2560 × 1440 the collect pop (1.2×) shows it at 77.1 CSS px at most, so 154 px is 2 × 77.1 rounded down (fix round 1: it was 160 px, 2.08×, over the 2× limit). The logo is capped at 614 px wide (2× its 307 CSS px at 2560 px) and never enlarged, so the 564 px temporary logo keeps its size. Both are now WebP q95 with exact alpha: at 3× zoom, on the floor and on the dark band, they show no edges or banding next to lossless. | Mushrooms 1–9: 94,974 / 60,358 / 117,028 / 77,608 / 27,048 / 116,000 / 85,738 / 87,176 / 110,286 B → 11,678 / 8,368 / 13,908 / 12,066 / 4,958 / 13,740 / 11,222 / 11,134 / 13,908 B (776,216 → 100,982 B). Logo 164,076 → 59,136 B. **Total 940,292 → 160,118 B (−780 KB, −83 %).** All scene images: 5.17 → 4.18 MB. The audit guessed 0.9–1.3 MB of savings; the real figure is lower because these files were 0.94 MB in total and the logo could not be resized. | `review-02/03-sprites-before-after.jpg`, `review-02/03-sizes-before.txt`, `review-02/03-sizes-after.txt` |
| ✅ | **4. Page metadata.** Meta description and `og:description` are placeholders whose text starts with `TODO(copy): `, so the marker shows wherever the text does (fix round 1: before, it was only in an HTML comment). Theme colour (kept, `#1d120b`), Open Graph type, title, description and image. `robots.txt` is `User-agent: *` / `Disallow: /`. The image is a 1200 × 630 PNG of the logo on the page colour, made by `npm run assets`, because not every link-preview scraper reads WebP. | – | `review-02/04-metadata.png` (read back from the production build) |

Notes:

- **At launch,** open up `public/robots.txt` and give `og:image` the full address (`TODO(launch)` in `index.html`): link previews need an absolute URL, and the site's domain isn't known yet. Crawlers only read `robots.txt` at a domain's root, so it does nothing if the site is served from a subfolder (for example a GitHub Pages project site).
- **The audit's 455 ms and 1.5 s freezes did not reproduce here.** The worst single frame I saw was 392 ms, at the logo's arrival, on the first WebKit launch on this VM. It did not come back, even with the OS file cache dropped before each run. Every other "before" run showed the smaller, repeatable stall at the hand-over, which is what the fix removes. A real iPhone should still get one look.
- **Under artificial CPU load the intro is still heavy.** With three of this VM's four cores kept busy (`intro-frames.mjs … 3`), the hand-over frame of 78–157 ms is gone, but wash and entrance frames stay at 60–110 ms before and after (raw numbers in `01-frames-raw.txt`). That load starves WebKit's own processes: frames stay this slow even with all wash work switched off. So it is not a measure of this page.
- **Tried and dropped:** giving each fading part its own layer (`will-change`) made it worse in this WebKit: 22–24 frames over 50 ms under load instead of 12–19.
- **One unexplained console error.** One quick-intro run on `npm run dev` logged an image "EncodingError". It did not happen again in 10 more runs (quick and full, dev and production), so it was most likely the dev server serving a file while `npm run assets` was rewriting it.

Light QA only, as asked: one screenshot per item, no video recordings, no performance traces.

## Review 03 (elegant)

Built from `reviews/scene-1-review-03-elegant.md` on the new branch **`site/scene-1-elegant`**, made from
`site/scene-1`. Nothing was merged into `site/scene-1` or `main`. One commit per item, plus four follow-up
commits where the QA found something to fix. Evidence is in `qa/review-03/`; `qa/tools/review03.mjs` remakes it.

**To see it:** `cd ~/hjaas && git checkout site/scene-1-elegant && cd site && npm install && npm run dev`, then
open http://localhost:5173/. Add `?reset` to the address to see the first-visit painting again. The two
versions share saved progress, so use `?reset` after switching branches too.

**Before and after, side by side:** `review-03/compare.jpg`.

Two things to know before reading the table:

- **Nothing here has been on a real phone.** Safari was tested as Playwright's WebKit on this Mac.
- **The painting was slow in Safari's engine, and still is on `site/scene-1`.** Measured in WebKit on this
  Mac, the old brush ran at 10 to 20 frames a second. This branch paints a different way and runs at full
  rate (item 4). `site/scene-1` was not touched, so it still has the slow brush.

| | Item | What was done, and what was measured | Evidence |
|---|---|---|---|
| ✅ | **1. The page and the frame** | A chalk page (`#F6F3EC`) with warm charcoal text (`#302E29`, 12.2:1). The full-screen dark surround and the ambient glow layer are gone, with their image file. The whole room sits in a pale mat with a fine border and is **1040 px wide on a 1440 × 900 window**, 820 px at 1024 × 768 and 1799 px at 2560 × 1440. Page and caption fit the window at all three, with no scrolling. Above it: the logo and "Hui Jie" in a serif (Spectral), then a visible `TODO(copy)` line. Below it: the hunt caption. | `review-03/screen-1440x900.jpg`, `screen-1024x768.jpg`, `screen-2560x1440.jpg` |
| ⚠️ | 1, optional paper grain | Not added. On the mat it is too narrow to see, and anywhere else it would sit under text. | – |
| ✅ | **2. Phones** | 18 px page margins and a 6 px mat. The window is as tall as the screen allows, from 4:5 up to 2:3 (2:3 at 390 × 844, 412 × 915 and 360 × 740), and keeps review 01's framing on Rachel and the box. The swipe hint is one still line in the caption ("Swipe sideways"), shown once. | `review-03/screen-390x844.jpg`, `screen-412x915.jpg`, `screen-360x740.jpg` |
| ✅ | 2, page scroll and sideways pan | The window no longer claims up-and-down swipes (`touch-action: pan-x pan-y`). On a screen shorter than the page (390 × 664 and 390 × 560): dragging up on the picture scrolls the page and leaves the room where it is, dragging sideways pans the room and leaves the page where it is, and a drag that starts on a mushroom scrolls without collecting it. Tested with real touch gestures in Chrome and with wheel input in WebKit (Playwright's WebKit cannot make touch gestures). | `review-03/phone-checks.json` (`scroll`) |
| ✅ | 2, tap boxes | The boxes for `tiles`, `screed` and `toolbox` move inward and sit 5 px inside the picture's bottom edge; each drawing stays where it was painted. At all three phone sizes, in WebKit: every box is 44 × 44 px, none overlap, every edge of every box takes a tap, and the 4 px focus ring is inside the picture. | `review-03/tapboxes-390x844-right.jpg`, `tapboxes-390x844-left.jpg`, `state-phone-3-focus-ring-bottom-edge.jpg`, `phone-checks.json` |
| ✅ | **3. Quieter interface** | The counter is caption text: "3 of 10 found" with the small mushroom, equal-width digits. A find changes the number with one 200 ms rise and fade. A collected mushroom reaches the caption in 390 ms (it was 560 ms) on a shallow arc, with no spin. The enamel, rim, squash, rolling number and the counter's glint are removed; only the logo glints. | `review-03/state-desktop-2-one-found.jpg` |
| ✅ | 3, the 10/10 unlock | No mushroom shower. Rachel reacts, and 0.9 s later the caption fades out and a flat, outlined "Contact Hui Jie" button fades in where it stood (140 ms out, 260 ms in). | `review-03/state-desktop-4-tenth-found-reaction.jpg`, `state-desktop-5-contact-button.jpg` |
| ✅ | 3, buttons and the form | The form is a flat sheet of the same paper that opens upward from the button (from the bottom edge on phones): fine outlines, one solid Send button, 140 ms press feedback. Control edges are 3.8:1 or better; the lowest text contrast is 5.7:1. | `review-03/state-desktop-6-form.jpg`, `state-desktop-7-form-errors.jpg`, `state-desktop-8-form-sent-test-mode.jpg`, and the same three for `phone` |
| ✅ | 3, cursor | The cursor is the normal arrow over a mushroom, the same as over the room. Hovering one changes no pixel. No mushroom has a tooltip. | `review-03/desktop-checks.json` (`cursorAndKeyboard`) |
| ✅ | **4. The paint-in, first visit** | The page, the identity and "Skip" are there from the first moment. Every stroke starts twice as late and takes twice as long (0.48 to 1.28 s each, 4.32 s in all), eased with `cubic-bezier(0.645, 0.045, 0.355, 1)`, on a blank sheet inside the mat. Measured in the page, in Chrome and in WebKit: mushrooms usable at 4.08–4.11 s, Rachel 4.43–4.70 s with a 4 px settle, caption 4.58–4.80 s, **first swing 4.98 s**. | `review-03/intro-first-visit-desktop.mp4`, `intro-first-visit-iphone.mp4` (WebKit), their `-stills.jpg`, `timeline.json` |
| ✅ | 4, smooth in both browsers | The recordings above ran at **312 frames in 5.2 s with the longest frame 18 ms (Chrome)** and **311 frames, longest 45 ms (iPhone profile, WebKit)**. The old brush managed 75 to 96 frames in the same 5.2 s in WebKit, with frames of 100 to 500 ms. | `review-03/timeline.json` |
| ✅ | 4, Skip | Finishes the picture at once: 80 ms after the click the caption, Rachel and the mushrooms are all there, and a mushroom can be found straight away. Until its part of the room is painted a mushroom cannot be found, by pointer or by keyboard. | `review-03/desktop-checks.json` (`skip`), `state-desktop-1-painting.jpg` |
| ✅ | 4, return visits | No brushwork: everything shows together in 183 ms (measured). Found mushrooms, the unlock and the phone's pan position are kept. A "Replay painting" link sits under the picture and paints the room again from a blank sheet. | `review-03/desktop-checks.json` (`returnVisit`, `replay`) |
| ⚠️ | 4, WebKit cold load, end of the intro | Review 02's fix is kept in spirit: nothing is swapped or cleared when the painting ends. Production build, new browser for every run. **Longest frame from the wash to 1 s after the end: 23–41 ms in 16 of 18 iPhone-profile runs; 56 ms and 117 ms in the other two.** Desktop: 28–37 ms in 5 of 5. This Mac was busy with other apps throughout (load 4 to 6), which is the likeliest cause of the two outliers, but I can't prove it. | `review-03/webkit-cold-load-raw.txt` |
| ✅ | **5. Pause** | "Pause animation" sits with the other controls under the picture. Rachel finishes her swing and holds her working pose; the logo's idle glint stops too. "Play animation" brings both back. While paused, a find is still answered with one held thumbs-up. | `review-03/desktop-checks.json` (`pause`) |
| ✅ | 5, reduced motion | Everything shows together in 200 ms. No strokes, no glints, no flights. Rachel holds her working pose. A found mushroom fades where it stood and the count changes at once. Skip, Pause and Replay are not offered, as there is nothing for them to act on. | `review-03/state-desktop-9-reduced-motion.jpg`, `desktop-checks.json` (`reducedMotion`) |
| ✅ | **6. QA** | Screenshots at all six sizes, one recording of the first-visit painting on desktop and one on an iPhone profile in WebKit, the WebKit cold-load check, all ten mushrooms found by tapping at three phone sizes in WebKit, page scroll plus sideways pan, and the side-by-side image. | `review-03/` |

### Performance on a slow phone profile

Chrome DevTools, phone-sized window at pixel ratio 3, CPU slowed 4×.

| Scenario | Frame slots | Dropped | Tasks over 50 ms | Longest task |
|---|---|---|---|---|
| First-visit painting, to 1 s after it ends | 348 | 6 | 2 (54 ms at the wash, 59 ms at the end) | 59 ms |
| A find (trip to the caption, count, reaction) | 216 | 0 | 0 | 15 ms |
| 10/10 unlock | 252 | 3 | 0 | 20 ms |
| Form opening | 78 | 4 | 0 | 27 ms |
| Pan across the room, then page scroll | 216 | 0 | 0 | 6 ms |

With the same slowdown but the tracer off, the scene's own frame log recorded **no late frame and no long
task** in any of the five. The target (none while anything animates) is met without the tracer and missed by
4 and 9 ms with it, in the painting only. Layout shift is 0.00 throughout.

### What the QA found, and what changed because of it

| Found | Cause | Change |
|---|---|---|
| In WebKit the painting ran at 10 to 20 frames a second. | Each stroke was drawn with the room image as a canvas pattern, which Safari's engine does slowly. | The room and the mushrooms are on the page from the start, drawn once, under one canvas filled with the paper's colour. Each stroke rubs the paper away. A frame is now a few plain strokes on one small canvas. The picture looks the same. |
| Rachel's first swing stalled for about 100 ms in WebKit. | The first draw of each of her frames is slow there. | Every frame is drawn once, out of sight, as it loads. |
| One heavy frame at the start of the wash (243 ms on the slow phone profile, 53–105 ms on a WebKit cold load). | The mushrooms were styled and drawn for the first time in the same frame as the first full-sheet wash. | They are now under the paper from the start, so that cost is paid before the clock starts. As a side effect the brush paints the mushrooms in with the room. |
| A 185 ms task as the painting ended (slow phone profile). | Swapping Skip for the other controls, and adding the swipe hint, each forced a layout. | All three controls and the hint are laid out from the start and swapped by visibility. |
| The first frames of the painting sometimes stalled (200–330 ms). | The clock started while the browser was still drawing the picture under the sheet. | The painting waits until frames arrive on time (at least 130 ms of them) before it starts. |
| A 73 ms task at the unlock, and a slow tap on the Contact button (slow phone profile). | The button's text was laid out for the first time at the swap; the form measured the button after changing its own classes. | The button is laid out ahead, out of sight. The form measures first. |
| With reduced motion the thumbs-up flashed for 0.3 s. | The wink (review 01) split the hold into pieces, and the still reaction took the longest piece. | The still reaction holds the thumbs-up for the manifest's whole hold, 0.9 s. |

### Motion, against the standards

| Motion | Duration and easing | Verdict |
|---|---|---|
| Painting | 4.32 s of strokes, each `cubic-bezier(0.645, 0.045, 0.355, 1)`; the only long motion, once per visitor, skippable | ✅ a first-run moment, never repeated uninvited |
| Rachel in, caption in | 280 ms and 200 ms, ease-out, 4 px | ✅ |
| Return-visit reveal | 200 ms, opacity only | ✅ |
| Mushroom to the caption | 90 ms lift, 300 ms travel, ease-in-out, fades over the last 30% | ✅ under 400 ms |
| Count update | 200 ms, ease-out, 3 px | ✅ |
| Caption to button | 140 ms out, 260 ms in, ease-out, 4 px | ✅ |
| Form | 260 ms in and 180 ms out on desktop, from the button's corner; 420 ms in and 240 ms out as a sheet on phones | ✅ exits faster than entrances |
| Press feedback | 140 ms, scale 0.97–0.98 | ✅ |
| Opening the form from the keyboard, Escape | Instant | ✅ |
| Automatic motion | The hammer loop and the logo's 9 s glint, both stopped by Pause | ✅ |

### Decisions I made

1. **The branch.** `git pull origin main` would not run on `site/scene-1`: the two have diverged, and git asked how to combine them. I did not merge `main` into `site/scene-1`. I made `site/scene-1-elegant` from it and merged `main` into the new branch to get the review file, which is how reviews 01 and 02 were done.
2. **The serif is Spectral,** bundled with the site (22 KB). It is a new dependency (`@fontsource/spectral`).
3. **The logo is untouched:** same file, same size rule, same link, same glint, same drop shadow. That shadow was made for the dark wall and looks heavier on paper. Yours to decide.
4. **The second line under "Hui Jie"** shows the words `TODO(copy): what Hui Jie does, in one line`, so the placeholder is visible wherever the text is.
5. **The line beside the count stays put.** "Find the 10 hidden mushrooms" until the first find, then "Find all 10 to reach Hui Jie". The handover had it appear once, briefly; a line that comes and goes is more motion than this version wants.
6. **Mushrooms are painted in with the room,** and can be found from the wash on (4.06 s). The review had them appear with the wash.
7. **Picture size.** 72.2% of the window's width, reduced when the window is too short for the caption to stay on screen, and never below 540 px. On very short windows the page scrolls.
8. **Phones rarely need to scroll.** The window's height is fitted to the screen, so at the three test sizes everything is on one screen. The page scrolls whenever the screen is shorter than that, such as Safari with its toolbars showing.
9. **Pause stops the logo's idle glint as well as the hammering.** It is not remembered between visits, so nobody returns to a still page without knowing why.
10. **Paused or with reduced motion, a find is answered with one held pose** (the thumbs-up), not the full reaction. The review says Rachel holds her working pose; I kept this one change of pose because it is the only sign that she noticed.
11. **"Replay painting" is offered after a first visit too,** not only on return visits.
12. **Skip pressed before the art has loaded** shows the finished picture as soon as it has.
13. **The form opens upward from the button** on desktop, sits in the middle of windows too short for that, and rises from the bottom on phones.
14. **The scene now takes only its width from its host** and is as tall as its content, so the host page scrolls. Before, it filled a fixed box.
15. **Removed:** `room-ambient.webp`, `finale.ts`, `counter.ts`. The link-preview image and the browser's theme colour are now the paper colour.
16. **Impeccable's detector reports one thing:** a cream page background, which it calls a default choice. It is the colour the review asked for, so I left it.
17. **`?intro=quick`** now means the 200 ms reveal of a return visit.
18. **New placeholder words,** all marked `TODO(copy)` in the code: Skip, Pause animation, Play animation, Replay painting, Swipe sideways.
19. **The older QA files** (`CHECKS.md`, `MOTION-REVIEW.md`, `traces/SUMMARY.md`, `impeccable/CRITIQUE.md`, and the tools other than `review03*.mjs` and `intro-frames.mjs`) describe `site/scene-1` and were left as they are.

### Not done, or not verified

- **A real phone,** and Safari itself. The paint fix is measured in Playwright's WebKit on a Mac, which shares Safari's drawing code but is not an iPhone.
- **Touch gestures in WebKit.** Playwright's WebKit cannot make them, so scroll and pan were driven by wheel input there and by touch gestures in Chrome only.
- **Two of 18 cold-load runs** had a frame over 50 ms at the end of the intro (above).
- **`site/scene-1` still has the slow brush** in Safari's engine. Say if you want the same fix there.
- Raw traces (`qa/traces/r3-*.json.gz`, 14 MB) are on this Mac only, as before.

## Logo swap

From `reviews/logo-swap.md`, on `site/scene-1-elegant`, in one commit. Evidence: `qa/logo-swap/logo-swap.jpg`
(`qa/tools/logo-swap.mjs` remakes it).

| | Step | Result |
|---|---|---|
| ✅ | 1. The logo comes from `assets/logo/hjaas-logo.png` | `npm run assets` writes it at 614 × 234 px (the `LOGO_W` cap is unchanged), 48 KB. The glint is clipped to the new image's own transparency with no code change. |
| ✅ | 2. Favicon and touch icon from `assets/logo/hjaas-reel.png` | A plain resize to 32 and 180 px. The fixed crop is gone. The reel reads clearly at 32 px. |
| ✅ | 3. Link-preview image from the new logo | 1200 × 630, the logo 900 px wide on the paper colour. |
| ✅ | 4. `npm run assets` run and checked | Only the logo, the two icons and the link-preview image changed; every other asset came out byte-for-byte the same. Nothing in `site/` uses `tape-measure-temp.png` any more; the file is still in the repo. |

One thing to look at: **the new logo is wider and flatter** (2.6:1; the temporary one was 1.7:1). At the same
width it is 202 × 77 px on a 1440 px window, where the old one was 202 × 119 px, so it looks smaller and the
"HJaaS" lettering is about 10 px tall. I kept the width rule as it was. If you want it larger, it is one line:
`--logo-w` in `scene.css`.

## Scene 2 (structure)

Built from `reviews/scene-2-build.md` on the new branch **`site/scene-2`**, made from `site/scene-1-elegant`
after the logo swap. Nothing was merged into any other branch. One commit per item, done in the order
4, 1, 2, 3, 5 (the routine engine first, because the scene engine uses it). Evidence is in `qa/scene-2/`;
`qa/tools/scene2.mjs` and `qa/tools/same-as-before.mjs` remake it.

**To see it:** `cd ~/hjaas && git checkout site/scene-2 && cd site && npm install && npm run dev`, then open
http://localhost:5173/. The lab is at http://localhost:5173/#grow. Add `?reset` before the `#` to start as a
new visitor.

Three things to know first:

- **Scene 2 is a still picture for now.** Its plate is the chosen mock-up, with Rachel and the trolley drawn
  in. She does not move or react until `tasks/017` delivers her frames. Everything around her works.
- **Nothing here has been on a real phone.** Safari was tested as Playwright's WebKit on this Mac.
- **On a slow phone the first switch to a scene starts late.** On Chrome's slow-phone profile about one
  second passes between the tap and the brush starting, while the new picture is drawn for the first time
  out of sight. The tab changes at once and the old picture stays up, so it reads as a pause, not a freeze.
  Later switches start within a tenth of a second.

| | Item | What was done, and what was measured | Evidence |
|---|---|---|---|
| ✅ | **1. A reusable scene engine** | `src/scene1/` is now `src/engine/` plus one file per scene in `src/scenes/`. A scene's file only describes it: plate, character frames and placement, idle routine, reaction folder, the ten hiding spots, the paint-in strokes, the phone framing. Mushrooms and the logo moved to `assets/shared/`. | `src/engine/types.ts`, `src/scenes/build.ts` |
| ✅ | 1, scene 1 behaves exactly as before | Compared with the commit before the refactor, at 1440 × 900, 390 × 844 and 360 × 740, in five states each (first screen, one found, nine found, ten found with the button, form open): **11 of 15 screenshots are identical to the pixel; in the other four the largest difference is 4 levels out of 255**, which is rendering noise. The first-visit painting measures the same: 312 frames in 5.2 s, longest 17 ms, first swing at 4.98 s in Chrome; 310 frames, longest 44 ms in WebKit. Review 03's behaviour checks (skip, replay, return visit, pause, reduced motion, cursor, keyboard, ten mushrooms at three phone sizes, scroll and pan) all pass again. | `scene-2/same-as-before.json`, `scene-2/scene-1-after-refactor/` (recordings, `timeline.json`, check results) |
| ✅ | **2. Scene menu** | Two plain text tabs, Build and Grow, at the end of the masthead just above the picture; on phones on their own row under the name. One row at every size tested, each tab 44 px tall, the current one in darker text with a fine underline and `aria-current`. They are links inside a `nav`, so they are in the Tab order (logo, Build, Grow, then the mushrooms) and Enter follows them. With one scene there is no menu. | `scene-2/screen-build-1440x900.jpg`, `screen-grow-390x844.jpg`, `nav-checks.json` (`keyboard`) |
| ✅ | 2, switching | The new picture is brushed in over the old one with the new scene's own strokes, played quickly, then a short wash: **1.43 to 1.56 s measured** (asked for: 1.2 to 1.6 s). Clicking a tab again finishes the picture in about 50 ms, as does Skip. Clicking the other tab mid-brush finishes this picture and goes on to that one. | `scene-2/switch-build-grow-build-desktop.mp4`, `switch-build-grow-build-iphone.mp4` (WebKit), their `-stills.jpg`, `nav-checks.json` (`switch`) |
| ✅ | 2, first visit and revisits | The first visit to a scene is its full painting from a blank sheet (5.2 s measured for the lab); a revisit is the short brush (1.48 s). Reduced motion: the old picture fades off the new one in 200 ms (199 and 204 ms measured), with no strokes. | `scene-2/first-visit-to-grow-painting.jpg`, `nav-checks.json` (`firstVisit`, `reducedMotion`) |
| ✅ | 2, the address | `#grow` is the lab; a plain address or `#build` is scene 1; an unknown name is scene 1. A click changes the address, and back and forward move the picture. Opening `#grow` directly shows the lab. | `nav-checks.json` (`address`) |
| ✅ | 2, state per scene | Each scene keeps its own found mushrooms and, on a phone, its own pan position, across switches and across a reload (scene 1 left at 60 px and the lab at 400 px came back at 60 and 400). Progress saved by the one-scene version is carried over to scene 1. | `hunt-checks.json` (`pan per scene`) |
| ⚠️ | **3. The lab** | The plate is the chosen mock-up (`reference/mockups/mockup-lab-1-trolley-CHOSEN.png`), framed like scene 1, marked `PLACEHOLDER until tasks/017` in `grow.ts` and `build-assets.mjs`. Rachel is in the picture but still, and there is no reaction; a find still travels to the caption and counts. `LAB_CAST` is written for her frames as full-plate images drawn at the plate's corner, with no placement maths. | `scene-2/screen-grow-1440x900.jpg`, `src/scenes/grow.ts` |
| ✅ | 3, ten mushrooms | Left to right: by the door, under the bench, on the floor in the sun, on the bench corner, under the middle shelf, on the pipe, on the switch box, beside the humidifier, by the drain, under the rack on the right. Sizes follow depth, 18 to 40 plate px. None is on the trolley or behind Rachel, where her frames will go. Two of the ten are pale drawings; the rest are red or golden. A cooler tint than scene 1's. Tap boxes are 44 px, none overlap, all sit inside the picture, at 390 × 844 and 360 × 740. | `scene-2/tapboxes-grow-390x844-left.jpg`, `tapboxes-grow-390x844-right.jpg`, `hunt-checks.json` |
| ✅ | 3, phones | The same pannable window, 2:3 at the sizes tested, opening on plate x 616 to 1243, centred on Rachel and the trolley. | `scene-2/screen-grow-390x844.jpg`, `screen-grow-360x740.jpg` |
| ✅ | **4. Data-driven routine** | `routine.ts` plays a manifest: named loops with a hold range per frame, how many cycles each loop runs, the frames between loops, blinks only in the middle of a long enough hold on a named frame, and the frame a reaction starts from. It also says in words what is wrong with a manifest. Tested with a made-up manifest of scene 1's frame names. | `src/engine/routine.ts`, `src/engine/routine.test.ts` |
| ⚠️ | 4, scene 2's manifest | A stub, `public/assets/scene2/rachel/routine.json`, with the target timings: 2 to 4 sprays of 0.9 to 1.3 s, a 1 to 2 s pause, 4 to 7 s of writing with one glance, blinks on A1 every 3 to 6 s. Tests hold it to those numbers. It is not played yet, and its two transitions are empty until the in-between frames exist. **`npm test`: 18 tests, all pass.** | `src/scenes/grow.test.ts` |
| ✅ | **5. QA** | Screenshots of both scenes at 1440 × 900, 390 × 844 and 360 × 740. A recording of Build → Grow → Build → Grow on desktop and on an iPhone profile in WebKit. | `scene-2/screen-*.jpg`, `switch-build-grow-build-*.mp4` |
| ✅ | 5, all 20 mushrooms | Found by tapping in WebKit at 390 × 844 and 360 × 740, and by clicking in Chrome at 1440 × 900: ten in each scene, each scene with its own count. | `hunt-checks.json`, `hunt-webkit-390-2-grow-done.jpg` |
| ✅ | 5, Contact unlocks after the first 10/10 | Finishing scene 1 first: the button appears there, and is already there on arriving in the lab at "0 of 10 found". Finishing the lab first, with scene 1 untouched: the same the other way round. | `hunt-checks.json` (`lab first`) |
| ✅ | 5, state survives a reload | After a reload the address still names the lab, both scenes show "You found all 10", and the button is there. | `hunt-checks.json` (`afterReload`) |
| ⚠️ | 5, WebKit cold load, the switch | Production build, a new browser for every run, six runs per profile, two switches per run. **iPhone profile: longest frame 20 to 35 ms in 12 of 12 switches.** Desktop: 28 to 40 ms in 10 of 12; one switch had a 57 ms frame at the click, and one had a single 305 ms frame 0.3 s after the brush had finished, which I could not reproduce or explain. | `scene-2/switch-frames-webkit-cold.json` |

### On a slow phone profile

Chrome DevTools, phone-sized window at pixel ratio 3, CPU slowed 4×, tracer off, the scene's own frame log.

| Scenario | Late frames | Tasks over 50 ms |
|---|---|---|
| First switch to the lab | 383 ms and 601 ms, both before the brush starts | 205 ms and 162 ms, at the tap |
| Switch back to scene 1 | One of 100 ms, at the tap | 0 |
| Switch to the lab again | 0 | 0 |
| A find in the lab | 0 | 0 |

The brush itself ran clean each time. The cost is at the tap: copying the old picture onto the sheet, and the
browser drawing the new picture for the first time.

### What is placeholder

- **Scene 2's picture and Rachel.** The mock-up stands in for the empty lab plus her frames. No routine, no
  blink, no reaction in scene 2 yet.
- **Scene 2's `routine.json`.** Target timings only; the transitions are empty.
- **Words.** The scene names (Build, Grow) are from the review. The menu's screen-reader label ("Scenes"),
  the two picture descriptions, and everything listed under review 03 are still `TODO(copy)`.
- From before: the form endpoint.

### Decisions I made

1. **The unlock is shared, as Wren assumed.** The first scene to reach 10 of 10 earns the Contact button; it then shows in every scene, beside that scene's own count.
2. **A first visit to a scene through the menu** clears the old picture to a blank sheet (160 ms) and plays the full painting. A revisit gets the short brush.
3. **How the switch is drawn.** A copy of the picture being left is laid over the window and the brush rubs it away, the same method as the first-visit painting. Safari's canvas cannot tint, so in Safari the copy's mushrooms are untinted for the second and a half it is on screen.
4. **The menu is on the same line as the name on desktop,** so the picture keeps its size. On phones it has its own row.
5. **Scene 1's hammer rhythm stays as code,** not a manifest, so it keeps matching the script it was ported from. Both kinds feed the same player.
6. **The hint wiggle is still once per visit,** in whichever scene the visitor is in at the time.
7. **Pause applies to every scene.** In the lab it only stops the logo's glint for now, so the control looks idle there.
8. **Other scenes load in the background** once the opening scene has settled (1.2 MB for the lab), so a switch does not wait for a download.
9. **Saved progress has a new format** (per scene). The old one is read once and carried over.
10. **The lab's smallest mushrooms are 18 plate px,** like scene 1's, not smaller: at 16 they were under 9 px on a phone.
11. **Full-plate character frames are drawn on a canvas capped at 2.6 megapixels,** so a pose change stays cheap on phones. Scene 1's cut-out frames are far below the cap and unaffected.
12. **`vitest` is a new dev dependency,** for `npm test`.
13. **Before the logo swap I ran `git pull origin main`** as a merge of `main` into `site/scene-1-elegant`, which brought in the two briefs and task 017. Nothing went the other way.

### For Wren, about task 017

1. **A blink needs a closed-eyes frame.** The task lists only `A1_blink_half`. The stub blinks with that one frame for 110 ms. Scene 1 uses half, closed, half.
2. **A find during the writing loop.** The reaction starts from A1, and writing keeps her off A1 for 4 to 7 s. She needs either the write-to-mist transition frames, so the engine can take her back first, or a second reaction that starts from B1. Until then a find while she writes would wait.
3. **Frames could be cropped to Rachel and the trolley** with an offset, instead of full 1672 × 941 images. They would be smaller files and cheaper to draw on phones. The engine draws full-plate frames today; a crop needs a small addition.
4. **Nothing may be hidden on the trolley or behind her.** The ten spots avoid that area, so they are valid for the mock-up and for the real frames.

### Not done, or not verified

- **A real phone,** and Safari itself.
- **The routine engine has not played real frames.** It is unit-tested, and the same player runs scene 1.
- **The one-second pause before the first switch on a slow phone** (above). It could be shortened by drawing the next scene ahead of time, at the cost of memory; I left it.
- **The unexplained 305 ms frame** in one of 12 desktop WebKit switches.

## Scene 2 frames

From `reviews/scene-2-frames-dropin.md`, on `site/scene-2`, after pulling `main`. One commit, plus the QA here.
Evidence is in `qa/scene-2/`; `qa/tools/scene2.mjs lab`, `record-lab` and `qa/tools/lab-vs-preview.mjs` remake it.
This replaces everything the "Scene 2 (structure)" section above lists as placeholder for the lab.

**To see it:** `cd ~/hjaas && git checkout site/scene-2 && cd site && npm install && npm run dev`, then open
http://localhost:5173/#grow

| | Asked for | What was done, and what was measured | Evidence |
|---|---|---|---|
| ✅ | The real frames on `scene/mushroom-lab.png`; the mock-up plate removed | The lab's plate is the empty lab. Rachel is task 017's delivery: 7 stills and 4 clips (78 patches). Her canvas is drawn at plate (680, 210), 490 × 690. | `scene-2/screen-grow-1440x900.jpg` |
| ✅ | Matches the preview video | The preview shows plate x 560–1300, y 180–920 (fitted from the room alone). With the room lined up, Rachel lines up to within 1 plate px: the difference between the two pictures is lowest at a shift of (−1, 0) and more than doubles at 4 px. Same poses, side by side, in the image. | `scene-2/lab-vs-preview.jpg`, `lab-vs-preview.json` |
| ✅ | The engine reads the delivered format | `src/engine/clips.ts` reads `frames.json` and `routine.json` exactly as delivered (they are copied, not rewritten). A clip frame is its base still with one patch drawn over it on the same canvas, in the same step. | `src/engine/clips.ts`, `clips.test.ts` |
| ✅ | Respect the ranges | One full cycle, watched in the page: 3 sprays, into writing, two rounds of the writing loop, and back, in 16.4 s. Measured holds against the manifest: squeeze 283–351 ms (280–360), lift 382–485 ms (380–480), transition frames 83 ms on average (66–100 at 60 frames a second), writing frames 125 ms on average (114–136), blink 50 ms, only on the aim pose. | `scene-2/lab-checks.json` (`routine-desktop-chrome`) |
| ✅ | The reaction entry rule | A find while she mists: she finishes the pose and looks up 0.38 s after the tap. A find while she writes: she finishes the frame, plays `mist_to_write` in reverse, then looks up, 2.24–2.39 s after the tap. The reaction then runs 5.2 s, thumbs-up at its middle, as timed in `routine.json`. | `lab-checks.json` (`fromMisting`, `fromWriting`), `scene-2/lab-routine-and-reaction-desktop.mp4` |
| ✅ | Nothing jumps between a patch and its still | Outside a patch, not one pixel differs from the still, in Chrome and in WebKit. Just inside a patch's edge the two differ by 0.5 to 1.4 levels out of 255 on average at phone size. | `lab-checks.json` (`seams-…`) |
| ✅ | WebP, exact alpha, through `npm run assets` | Quality 93, exact alpha: stills 1.2 MB, clips 7.7 MB, the lab plate 1.2 MB. | `scripts/build-assets.mjs` |
| ✅ | Lazy-loaded when Grow is first opened, stills first, then clips | While a visitor stays in scene 1, nothing of hers is fetched. On first opening the lab: the two manifests and the stills, and she starts misting on those. Then the clips, in this order: `mist_to_write`, `write_loop`, `look_up`, `thumbs_up`. Scene 1's own download is unchanged at 4.2 MB. | `lab-checks.json` (`lazy`) |
| ✅ | Recordings: the routine and one reaction, desktop and iPhone (WebKit) | A full cycle (misting, writing, back), then a find and the thumbs-up, on both. | `scene-2/lab-routine-and-reaction-desktop.mp4`, `-iphone.mp4`, and their `-stills.jpg` |
| ⚠️ | Frame timing in WebKit | Chrome: 2,242 frames in 37 s, longest 19 ms. WebKit, iPhone profile: 1,985 frames in 33 s, **two over 50 ms (65 and 54 ms)**, both in the writing loop; an earlier run had one of 119 ms. The reaction in WebKit: one frame of 92 ms at the tap when she was misting, none over 41 ms when she was writing. | `lab-checks.json` (`routine-iphone-webkit`) |
| ✅ | On a slow phone profile (Chrome, CPU slowed 4×) | A full 17 s cycle: no late frame, no long task. The reaction, with the tracer on: no long task, longest frame 35 ms. | Measured live; raw trace on this Mac (`qa/traces/lab-reaction-mobile-4x.json.gz`) |
| ✅ | Reaction gesture | Thumbs-up, as delivered. | – |

`npm test`: 40 tests, all pass. 18 of them run the routine reader on the two delivered files.

### Still placeholder in scene 2

Nothing in the picture. What remains is words (the scene name and its screen-reader description are still
`TODO(copy)`) and the things listed for Wren below.

### Decisions I made

1. **The lab's plate still downloads in the background** once scene 1 has settled (1.2 MB), so the first switch does not wait for it. Her frames do not: they are fetched only when Grow is first opened.
2. **Until her clips have arrived she keeps to her stills:** sprays, pauses and blinks. A find in that time gets one held thumbs-up.
3. **Part-way through the transition into writing, a find runs the transition back** from where it had got to, and on the way back out it simply carries on. `routine.json` only says what to do from the writing loop.
4. **No ground shadow under her or the trolley,** as in the preview video. Scene 1 draws one in code; say if the lab should too.
5. **A patch replaces a rectangle of its still trimmed to whole canvas pixels,** and is drawn at its exact place. That is what keeps the seam invisible at any size.
6. **Each frame is drawn once out of sight, at its real size, as it loads.** A tiny rehearsal draw, enough for scene 1, was not enough for these larger frames in WebKit.
7. **My own loop-manifest format from the structure round is still in the engine** (`routine.ts`, tested) but no scene uses it now. Its stub for the lab is deleted.

### For Wren

1. **The cut from the aim pose into `mist_to_write` is the largest in the set.** Its first frame differs from the still over about 30% of the figure; the other three clips start within 1 to 2.3% (phone size). It plays as delivered. One or two earlier frames of that clip would soften it.
2. **Memory on phones.** Her 78 patches decode to about 180 MB, on top of scene 1's 85 MB. I could not test what an older iPhone does with that. If it matters, half-size patches for small screens would cut it to a quarter.
3. **The blink is one half-closed frame for 50 ms.** A closed-eyes frame would make it read as a blink.

## Edge

From `reviews/scene-edge-feather.md`, on `site/scene-2`, for both scenes. One commit. Evidence is in `qa/edge/`;
`qa/tools/edge.mjs` remakes it.

**To choose again, or just to compare:** `qa/edge/compare.jpg` has the chosen edge beside A, B and C. On
`npm run dev`, add `?edge=a`, `?edge=b` or `?edge=c` before the `#`.

| | Asked for | What was done, and what was measured | Evidence |
|---|---|---|---|
| ✅ | 1. No mat, no border | Both are gone. The painting sits straight on the page. | `edge/a-round-build-1440x900.jpg` |
| ✅ | The chosen edge as the only production edge | A with rounded corners: a thin soft fade (4% of the width at the sides, 6% of the height at the top, 2.5% at the bottom), a line that wanders with three layers of noise, corners turned by a superellipse of exponent 6 (since Review 04: a rounded rectangle, radius 6% of the width), and a smoothstep to the paper colour. No deckle, rim, paler wash or grey. A, B and C exist only in development. | `edge/compare.jpg`, `src/engine/edge.ts` |
| ✅ | 2. Generated once per scene, seeded, attached to the plate | Worked out once from the scene's name, so it is the same on every visit and each scene has its own. It belongs to the plate and pans with it. | `edge/a-round-build-390x844-left.jpg`, `-right.jpg` |
| ✅ | 4. No CSS mask on a scrolling element | The edge is one small canvas in the paper's colour (418 × 235 px) lying over the plate. Nothing is masked. | `src/engine/edge.ts` |
| ✅ | 5. The paint-in reveals into that shape | The brush's sheet lies under the edge, so no stroke and no wash can show past it. | `edge/intro-first-visit-desktop.mp4`, `-iphone.mp4` (WebKit) |
| ✅ | 6. Every mushroom and tap box where the edge is at least 0.95 opaque | **All 20 mushrooms and all 20 tap boxes read 1.00**, read back from the page in Chrome at 1440 × 900 and 2560 × 1440 and in WebKit at 390 × 844, 360 × 740 and 320 × 640. Every box is 44 px or more, covers its drawing, and overlaps no other. `npm test` checks the same from the edge's formula at six sizes. | `edge/spots.json`, `src/engine/edge.test.ts` |
| ✅ | 6, spots moved by the smallest amount | In Build, three at the front of the floor moved straight up: `screed` 7 px, `tiles` 15 px, `toolbox` 21 px (plate px). In Grow, `bench` moved 34 px along under the bench. Nothing else moved. | `src/scenes/build.ts`, `grow.ts` |
| ✅ | 7. Phones | The window's sides have a 12 px fade into the paper; its top and bottom show the plate's real edge, and so do the far left and right when panned there. | `edge/a-round-grow-390x844.jpg`, `-left.jpg`, `-right.jpg` |
| ⚠️ | 8. Optional paper grain | Not added. | – |
| ✅ | QA: all styles, both scenes, three sizes | 40 screenshots: A-round, A, B and C, for Build and Grow, at 1440 × 900, 390 × 844 (with both ends of the room) and 360 × 740. | `edge/*.jpg` |
| ✅ | QA: recording of the intro with the new edge | Desktop (Chrome) and iPhone profile (WebKit). 312 frames in 5.2 s on both, longest 19 ms and 25 ms. | `edge/intro-first-visit-*.mp4`, `edge/timeline.json` |
| ✅ | No frame over about 50 ms at the end of the intro (WebKit, cold load, production build) | **27 to 33 ms in 10 of 10 iPhone-profile runs; 28 to 30 ms in 5 of 5 desktop runs.** | `edge/webkit-cold-intro-raw.txt` |
| ⚠️ | No frame over about 50 ms when switching scenes (WebKit, cold load, production build) | Back to Build: 26 to 34 ms in 12 of 12. To the lab, the first time it is opened: **one or two frames of 46 to 66 ms** within 0.15 s of the tap, before the brush starts, in all 12 runs. That is the lab being drawn for the first time under the old picture. During the brush itself no frame was over 50 ms. | `edge/switch-frames-webkit-cold.json` |
| ✅ | Panning (WebKit, phone) | 19 ms longest, in 3 of 3 runs, in both scenes. | `edge/pan-webkit.json` |
| ✅ | On a slow phone profile (Chrome, CPU slowed 4×, tracer off) | The first-visit painting and the 3 s after it: no late frame, no long task. Panning: none. Switching: one frame of about 100 ms at the tap (67 ms the first time the lab opens), then the brush runs clean. | Measured live |

### What the QA found, and what changed because of it

| Found | Cause | Change |
|---|---|---|
| A faint line of the old picture at the right of the window during a switch. | The copy of the old picture and its edge were drawn to the same rim, so a sliver of room showed between them. | The edge is drawn a pixel wider than the room on that copy. Checked on the page too: at the plate's rim the colour is within 1 level of the paper. |
| A 119 ms hitch 0.4 s after the intro on the slow phone profile. | The lab's edge was being worked out, at half the plate's size, while Rachel hammered. | It is worked out at a quarter of the size. The hitch is gone. |
| Tap boxes near the corners could still touch the fade. | A fixed margin cannot follow rounded corners. | Each box is placed from the edge's real shape, each time the plate changes size. |
| On a 320 px phone two of the lab's tap boxes overlapped. | The boxes are larger in the room's terms on small screens. | `bench` moved 34 px along; `npm test` now checks every pair at six sizes. |

### Decisions I made

1. **The percentages are of the width for the sides and of the height for the top and bottom.** The brief says "of the plate". Taken all of the width, the bottom fade would have been 42 px deep and covered the floor's mushrooms.
2. **The line wanders inside the fade, never outside it.** The plate's very rim is always paper and the painting is always solid where the fade ends, so the stated widths are the whole of the edge.
3. **The rounded corners are a little rounder than in the mock-up.** I used the exponent the brief gives (6). It is one number in `edge.ts` (`power`); 8 is tighter. (Changed in Review 04: the corners are now a rounded rectangle.)
4. **The edge is a paper-coloured layer over the plate,** not baked into the room image as the brief suggests. This site keeps the room as an image and paints by rubbing a sheet away, so there is no room canvas to bake into. The effect and the cost are the same, and the mushrooms and Rachel are kept inside the edge as well.
5. **The blank sheet the brush paints on is now the page's own colour,** since there is no mat for it to sit in.
6. **C is my reading of "stronger toward the corners".** It is for comparison only.
7. **The picture is the same size as before** (1040 px on a 1440 px window). Without the mat the page is 40 px shorter.

### Not done, or not verified

- **A real phone,** and Safari itself.
- **The 46 to 66 ms frame when the lab is first opened** (above). It could be removed by drawing the lab ahead of time, at the cost of memory.
- **The two frames over 50 ms in the lab's writing loop in WebKit** (Scene 2 frames, above). I could not find their cause; they did not appear in Chrome, in WebKit without a window, or on the slow phone profile.

## Review 04

`reviews/scene-2-review-04.md`, on `site/scene-2`. All four items are built, committed and pushed (the work
was paused twice at the user's request and picked up again). `main` was pulled first, as a merge into
`site/scene-2`; nothing was merged into any other branch and no push failed.

Two things are not a clean ✅: the page's total memory, because of scene 1 (item 3), and the tap of a
find, which is much shorter but still over 50 ms on the first find in the test browser (item 4).

| | Item | What was done, and what was measured | Evidence |
|---|---|---|---|
| ✅ | 1. New `mist_to_write` frames | `npm run assets` on the updated frames: 32 frames, patch origin read from `frames.json` (13, 13). | `public/assets/scene2/rachel/` |
| ✅ | 1. The hand-off from the aim still into the clip, and back | On the page, the cut from `A1_mist_aim` into the clip's first frame changes **0.5% of the figure** (iPhone profile, WebKit) and 1.2% (desktop Chrome at 2×). It was 30%. The way back out is the same. | `review-04/handoff-*-strip.jpg`, `handoff-*-frame-by-frame.mp4`, `handoff.json` |
| ✅ | 2. Corners much tighter | The corners are those of a rounded rectangle with a radius of **6% of the plate's width**. Outside the four corner squares the edge is exactly style A (`npm test` checks this). | `edge/corners.jpg` |
| ✅ | 2. Mushrooms still on solid painting | **All 20 mushrooms and all 20 tap boxes read 1.00**, read back from the page in Chrome at 1440 × 900 and 2560 × 1440 and in WebKit at 390 × 844, 360 × 740 and 320 × 640. | `edge/spots.json` |
| ✅ | 3. Decode and release | Her clip frames stay as downloaded (about 8 MB) and are decoded a few frames ahead of being shown, then given back. The 7 stills stay decoded. `look_up` and `thumbs_up` stay decoded while Grow is on show. When the visitor leaves for Build, everything but the stills is given back. | `src/engine/reel.ts`, `clips.ts` |
| ✅ | 3. A 1.5× set for phones | `npm run assets` now also makes `scene2/rachel-1.5x/`. It is used when the picture is shown under 900 CSS px wide; desktop keeps 2×. | `scripts/build-assets.mjs`, `src/scenes/grow.ts` |
| ✅ | 3. Edges at 1.5× still sharp at 390 × 844 @3× | Side by side with the 2× set at the screen's own pixels: I can see no difference in her outlines, face or hand. | `review-04/sharpness-390x844@3x.jpg` |
| ✅ | 3. Peak decoded memory of her lab frames, phone profile, under 80 MB | **Before: 243 MB. After: peak 66.9 MB** (from the bitmap sizes, sampled every frame through two cycles and two reactions). After leaving for Build: 21 MB. Desktop (2×): peak 114.9 MB. | `review-04/memory.json` |
| ⚠️ | 3. The whole page, not only the lab | **Scene 1's own Rachel frames are 84 MB decoded and stay decoded** while Grow is open. The review did not know this and I did not change it. With them, a phone that opened Build first holds about 165 MB of decoded images with Grow open. See "For Wren". | Sizes measured from the files |
| ✅ | 4. First lab open: no frame over 50 ms | **Before: 39 to 65 ms. After: 21 to 43 ms on the iPhone profile and 29 to 39 ms on desktop, in 12 of 12 runs each** (WebKit, cold load, production build). | `review-04/first-lab-open-before-item-4.json`, `-after-item-4.json` |
| ✅ | 4. Decoding off the page's thread | All of her frames, in both scenes, are decoded in a background worker. Her lab stills start downloading and decoding when the pointer or a finger is on the Grow tab, or it gets keyboard focus. On a switch the room is drawn first and she one frame later, under the old picture. | `src/engine/assets.ts`, `site.ts`, `scene.ts` |
| ✅ | 4. Writing loop: no decode mid-loop, no frame over 50 ms | WebKit without a window: **longest frame 20 ms** in two full cycles (it was 65 and 54 ms). With a window there is one frame of 100 to 116 ms, always 15.2 s after the page opens. **That one is the test browser, not the site:** an empty page in the same browser has it too (119 ms at 15.1 s). Wren's two earlier frames were 15.05 s apart for the same reason. | `review-04/cycle-and-finds-webkit.json`, `webkit-window-stalls.json` |
| ⚠️ | 4. The tap of a find | **It was not image decoding.** With the image as the tap's target, WebKit delivered the click up to 55 ms after the finger lifted. The tap now lands on the button and the click arrives within 3 ms. Five finds, iPhone profile: **the first 60 to 68 ms (it was 92 to 123), the others 18 to 52 ms.** On desktop all five are 17 to 35 ms. What is left of the first one starts 41 to 51 ms before the click reaches the page, so it is the test delivering the tap; the site's own share is under 20 ms. | `review-04/cycle-and-finds-webkit.json` |
| ⚠️ | 4. The landing of a find | The frame in which a mushroom lands at the caption is 18 to 45 ms on the iPhone profile. Not over 50, but the longest thing left; the first change of the number costs about 34 ms once. | same |
| ✅ | 4. Nothing else broke | All 20 mushrooms can still be found and counted at 390 × 844, 360 × 740 and 1440 × 900. Menu, skip, back button, reduced motion, keyboard: pass. Lazy loading unchanged: nothing of hers is fetched before Grow is opened. No frame of hers arrived late, also with the processor slowed 6×. | `review-04/hunt-checks.json`, `nav-checks.json`, `lab-checks.json`, `slow-phone.json` |
| ⚠️ | 4. The opening painting, re-measured | Not conclusive: the Mac was busy with an iCloud sync and both the old and the new build stalled now and then. Old and new alternating, 12 runs each: the end of the intro was 18 to 34 ms (old) and 18 to 58 ms (new: ten runs of 18 to 23, one of 46, one of 58). The first, quiet batch of the new build was 19 ms in 5 of 5. | `review-04/intro-webkit-cold.txt` |
| ✅ | Recordings | The lab routine with one reaction, and Build → Grow → Build, on desktop (Chrome) and the iPhone profile (WebKit), from the final code. | `review-04/lab-routine-and-reaction-*.mp4`, `switch-build-grow-build-*.mp4` |

`npm test`: 46 of 46 pass (6 new tests check that every clip frame is asked for before it is shown).

### Item 1 in numbers

Every pose around the hand-off was shown one at a time on the real page, and each was compared with the one
before it (the share of the figure's pixels that change by more than 24 levels).

| From, to | iPhone profile (WebKit) | Desktop (Chrome, 2×) |
|---|---|---|
| Aim still into the clip's first frame | 0.5% | 1.2% |
| The clip's first four steps | 0.9 to 1.6% | 0.9 to 1.6% |
| The clip's last frame into the writing loop | 6.1% | 5.7% |
| The writing loop's last frame back to its first | 1.0% | 1.0% |
| The writing loop back into the clip (played backwards) | 6.5% | 6.1% |
| The clip's first frame back to the aim still | 0.5% | 1.2% |

Inside the clip, a step changes between 0.3% and 22% of the figure. The first step where her arm starts to
move (the fifth) is 16%; the largest, mid-way, are 21 to 22%.

### Item 2: what moved

- `toolbox` is back where it was first placed (it had moved 21 px only because of the round corner).
- `screed` is now 5 px above its first place (it was 7 px).
- `tiles` stays 15 px above its first place: it is the straight bottom edge that covers it, not the corner.
- Nothing in Grow moved.

### Item 3 in numbers

Decoded image memory of Rachel's lab frames, from the bitmap sizes.

| | Before | After, phone profile (1.5× set) | After, desktop (2× set) |
|---|---|---|---|
| Stills (7) | 37.9 MB | 21.3 MB | 37.9 MB |
| Clip frames | 204.8 MB, all 84 at once | 42.0 MB at most: the reaction's 27 frames (26.1 MB) and up to 9 of the routine's | 74.5 MB at most |
| Her two canvases | about 3 MB | 3.5 MB | 2.6 MB |
| **Peak with Grow open** | **243 MB** | **66.9 MB** | **114.9 MB** |
| After leaving for Build | 243 MB | 21.3 MB | 37.9 MB |

- **No frame arrived late.** In two cycles and two reactions she never had to skip a frame, on the phone
  profile, on desktop, after coming back from Build, and with the processor slowed 4× and 6× in Chrome.
- **The patches still line up.** At 1.5× the mean difference at a patch's edge is 0.4 to 1.2 levels of 255.
- **Download:** the 1.5× set is 7.4 MB against 9.4 MB.

### Item 4: what the tracing showed

**The long frames "in the writing loop".** They were never in the writing loop. WebKit with a window, as
Playwright runs it on this Mac, stalls for 60 to 120 ms about 15 s after a page opens, and sometimes again
15 s later, whatever the page is doing. Rachel reaches her first writing loop at about that time. An empty
page shows the same stall; the lab with Rachel paused shows it; WebKit without a window never does.

**The tap of a find.** Each part of a find run by itself (the mushroom leaving the plate, the flying copy,
her reaction, saving) leaves every frame at 15 to 20 ms. The time went before the site's code ran:

| Part of the frame | Before | After |
|---|---|---|
| From the finger lifting to the click reaching the page | 52 to 63 ms on the first find, 12 to 26 ms on most later ones | 0 to 6 ms |
| The site's own handler | 1 to 13 ms | 1 to 6 ms (the flying mushroom is the drawing's own image, moved; it used to be a copy) |
| Longest frame at the tap, first find, iPhone profile | 92 to 123 ms | 60 to 68 ms |
| Longest frame at the tap, later finds, iPhone profile | 61 to 75 ms | 18 to 52 ms |

Two things about the "before" figures: part of the 61 to 75 ms came from the test scrolling the room to
reach a mushroom that was off screen (the test now pans first, as a visitor would), and the colour filters
on the mushrooms turned out not to matter (tested).

### Still open

- **The first find's tap frame is still 60 to 68 ms in the test browser.** It begins before the click
  arrives, so I cannot shorten it from the site. A real iPhone delivers taps differently; this needs a look
  on a real phone.
- **The opening painting should be measured again on a quiet Mac** (see the table).
- **Scene 1's 84 MB** (see "For Wren").

### Decisions I made

1. **A rounded rectangle, not a higher exponent,** for the corners. A superellipse bends the long edges a
   little whatever its exponent; a rounded rectangle leaves them exactly as they are in A.
2. **`toolbox` and `screed` moved back** towards their first places, since the instruction for the edge was
   to move spots as little as needed.
3. **The hand-off "recording" is stepped, not filmed in real time.** Playwright films at 25 frames a second
   and would miss frames; stepping shows every pose once, as a strip and as a film at two poses a second.
4. **Clip frames are decoded a few at a time, not a whole clip at a time.** The review asks for a whole clip
   to be decoded in the hold before it. That cannot reach 80 MB on a phone: at 1.5× the stills (21 MB), the
   reaction clips (26 MB) and `mist_to_write` alone (57 MB) come to 104 MB. And `write_loop` has no hold
   before it: it follows `mist_to_write` directly. So each step of the routine names the next 5 frames, and
   the first 3 of the way back in case a find interrupts her; at most 9 routine frames are decoded at once.
5. **"Under 900 CSS px wide" is the width of the window the picture is shown in,** read once, when her frames
   are first fetched. Turning a phone or resizing a browser afterwards does not swap sets.
6. **The 1.5× patches are cut from the shrunken whole picture,** not shrunk one by one, so they still line
   up with their still to the pixel. On a phone her canvas is then exactly the size of the art.
7. **The asset script now encodes several images at once.** It took about ten minutes; it takes about two.
8. **"Replay painting" restarts her routine from the top.** Before, replaying while she wrote put her back
   on the aim still and then jumped into the middle of the writing clip.
9. **A switch no longer waits for her frames before it reacts to the tap.** The menu and caption change at
   once. Under the old picture the brush waits up to 0.6 s for her; on a slower network it starts without
   her and she fades in when she arrives. A first-ever visit to a scene (the full painting) still waits,
   with the old picture up, because the painting brings her in.
10. **Scene 1's frames are decoded in the worker too.** It is the same code path.
11. **Hovering a tab while a painting is under way does not start a download,** so nothing competes with
    the brush.
12. **A tap lands on a mushroom's button, never on the image inside it** (`pointer-events: none` on the
    drawing). The button always covers its drawing, so what can be tapped is unchanged.
13. **The five-finds test pans the room to the mushroom before timing the tap.** Otherwise the test's own
    scrolling is counted as part of the tap.
14. **I did not chase the 34 ms first change of the number,** or the first find's remaining frame, any
    further: neither is the site's to shorten, as far as I could measure.

### For Wren

- **Scene 1 holds 84 MB of decoded frames** (20 frames of 1146 × 916: 8 for the routine, 12 for the
  reaction), for as long as the page is open. That is now more than the lab. Giving them back while Grow is
  open, and a lighter set for phones, would work the same way as for the lab; I did not do it because the
  review is about the lab and scene 1's timing was tuned with care.
- **The 16% step where her arm starts to move** in `mist_to_write` is in the range of the clip's other fast
  steps; see `review-04/handoff-desktop-chrome-strip.jpg`.
- **On a desktop screen at 1× (not Retina),** about 10% of her figure's pixels change when any clip starts,
  because the patch and the still are shrunk separately to a third of their size. It was like this before
  this review; I have not judged by eye whether it shows.

### Not done, or not verified

- **"Still open",** above.
- **A real phone,** and Safari itself. The memory figures are sums of bitmap sizes, not what a phone reports.
- **The corners against the mock-up by eye only.** The mock-up's edge is also rougher than style A's, which
  was not part of this review and was not changed.

## Hunt difficulty (Grow)

`reviews/scene-2-hunt-difficulty.md`, on `site/scene-2`. `main` was pulled first (as a merge); nothing was
merged into any other branch.

The lab's hunt now has a curve: three easy finds, four that take a second look, and three hidden among
Rachel's own oyster mushrooms. The total is still 10.

**Screenshots** (`site/qa/hunt/`): `grow-desktop.jpg`, `grow-phone-left.jpg`, `grow-phone-centre.jpg` and
`grow-phone-right.jpg` have no markers. The same four with `-circled` have the ten spots circled and
labelled easy, medium or hard. `grow-phone-hard-*-at-phone-size.jpg` show each hard one as a 390 × 844
phone shows it, with no zoom.

### The ten

| Spot | Level | What changed | Size (plate px) |
|---|---|---|---|
| `door` | easy | Nothing: red, by the door. | 28 |
| `bench` | easy | Nothing: yellow, under the bench. | 22 |
| `switch-box` | easy | Nothing: yellow, on the switch box. | 18 |
| `under-shelf` | medium | Smaller (it was 18) and darker, in the shadow under the shelves. | 16 |
| `floor` | medium | Was 40 px on the sunlit floor. Now under the trolley's bottom shelf, partly behind its back wheel. | 24 |
| `pipe` | medium | Was red. Now yellow and smaller, on the pipe beside its coupling. | 16 |
| `drain` | medium | Was red and 34 px. Now a cream one in shade, right beside the drain's grate. | 21 |
| `crop-hood` | hard | New. Inside the glass fume hood, between the two jars of oyster mushrooms, at 85% opacity. | 18 |
| `crop-shelf` | hard | New. On the middle shelf, between the first two grow bags; its foot is behind the shelf's lip. | 20 |
| `crop-rack` | hard | New. On the right-hand rack's middle shelf, against the foot of the pink oysters' bag. | 18 |

`bench-corner`, `humidifier` and `rack` are gone. A visitor who had found one of them keeps the find: it
counts for `crop-hood`, `crop-shelf` and `crop-rack` in that order.

### Fairness rules

| | Rule | What was measured | Evidence |
|---|---|---|---|
| ✅ | Three easy, four medium, three hard; ten in all | As in the table above. | `hunt/checks.json` |
| ⚠️ | Every one is a toadstool: a rounded cap on a stem, never an oyster shape | Nine of the ten are. **`bench` is the chanterelle drawing** (a funnel on a stem), as it was before; the review says to keep it. It is bright yellow, on the floor, nowhere near the crop. The three among the crop are the plain cream toadstools (drawings 4 and 6), never drawing 5. | `hunt/grow-desktop-circled.jpg` |
| ✅ | At least 60% visible | The least visible are `floor` (89%, behind the wheel) and `crop-shelf` (91%, behind the shelf lip), measured on the page with Rachel on each of her seven stills. None is ever behind her arms or head. | `hunt/checks.json` |
| ✅ | At least 14 px tall | The smallest are 16 px (`under-shelf`, `pipe`). | `hunt/checks.json`, `npm test` |
| ✅ | Never fully the colour of its surroundings | The mushroom's pixels differ from what is behind them by 61 levels of 255 on average at the least (`crop-hood`); the others by 63 to 151. | `hunt/checks.json` |
| ✅ | Tap areas at least 44 × 44 CSS px, not overlapping, where the edge is at least 0.95 | All ten read 1.00 under the drawing and under the tap box, the smallest box is 44 px and none overlap, at 1440 × 900, 2560 × 1440, 390 × 844, 360 × 740 and 320 × 640. Clipping a drawing does not clip its tap area. | `edge/spots.json`, `npm test` |
| ✅ | Tab reaches all ten in a sensible order | Left to right: door, bench, crop-hood, under-shelf, crop-shelf, floor, pipe, switch-box, drain, crop-rack. | `hunt/checks.json` |
| ✅ | The hint wiggle stays as it is | Not changed. Checked once with a short delay: a mushroom wiggled. | – |
| ✅ | Saved progress still counts | A visitor saved with door, bench-corner, humidifier and rack found opens Grow on "4 of 10 found", with six left to find. | `hunt/checks.json`, `npm test` |
| ✅ | All 20 mushrooms can still be found and counted | Both scenes, at 390 × 844, 360 × 740 and 1440 × 900, including the unlock and a reload. | Run of `qa/tools/scene2.mjs hunt` |
| ⚠️ | Each hard one spottable on a 390 × 844 phone | See below: honest answer, not a clean yes. | `hunt/grow-phone-hard-*-at-phone-size.jpg` |

`npm test`: 53 of 53 pass (7 new tests for these rules, for both scenes).

### Can I find the hard ones on a phone?

On a 390 × 844 phone the room is shown at a little over half its size, so the hard ones are 10 to 11 CSS
px tall, about the size of the back-wall mushrooms that were already there.

- **Looking at the phone-size screenshots without the markers, knowing they are among the crop:** I found
  `crop-shelf` and `crop-rack` after a careful look along the shelves. I could only confirm `crop-hood` by
  comparing with the circled version; between two jars of white substrate, behind glass, it is the hardest.
- **At the phone's own pixel density** (what the eye gets with the phone held close) all three are plainly
  small toadstools: a round cap on a stem, a shade darker and browner than the oysters around them.
- **My judgement:** they are fair but demanding on a phone, and `crop-hood` is at the edge of fair. I made
  the three as large as the review allows (18, 20 and 18 px) for this reason. If it should be kinder,
  `crop-hood` could go to full opacity; that is one number in `src/scenes/grow.ts`.
- I am an unusual judge here: I knew where they were. A person who has not seen the answers should try it.

### Decisions I made

1. **Which old spot hands its find to which new one:** bench-corner to crop-hood, humidifier to crop-shelf,
   rack to crop-rack. Each pair is in the same part of the room.
2. **`floor` is covered by the wheel itself, not by a clip.** Rachel's frames include the trolley and are
   drawn over the mushrooms, so the wheel hides part of the mushroom without any new art. I checked that
   nothing of hers ever covers that spot except the wheel.
3. **There is no painted shadow under the trolley,** so `floor` gets its shade from its tint and a small
   contact shadow of its own.
4. **`crop-shelf`'s clip is in percent of the drawing, not plate coordinates.** That is the form the site
   already had for tucked mushrooms. It is the straight line of the shelf's lip.
5. **`pipe` and `under-shelf` use the same yellow drawing** (7, the single cap), at different shades.
6. **A fourth tint, for the crop:** most of the warmth taken out, so a cream toadstool sits in the same
   greys and creams as the oysters.
7. **`bench` keeps its chanterelle,** as the review says to keep the easy three. See the ⚠️ above.
8. **The hard ones are at the top of their allowed sizes,** for phones.

### Not done, or not verified

- **Nobody who does not know the answers has tried it.** That is the real test of "fair and fun".
- **A real phone.**
- **Timing:** how long each takes to find was not measured; "easy, medium, hard" is by design, not by test.

## Review 05

`reviews/scene-2-review-05.md`, on `site/scene-2`. `main` was pulled first (as a merge); nothing was merged
into any other branch and no push failed.

Item 1 is built and meets its memory target. **Item 2 could not be done as asked:** the Mac was not quiet.
iCloud sync was using 30 to 60% of a processor core the whole time and I cannot pause it from here. The
numbers are reported with that caveat, and with a side-by-side against the previous build to tell the Mac's
noise from a change in the site.

| | Item | What was done, and what was measured | Evidence |
|---|---|---|---|
| ✅ | 1. Only the visible scene keeps decoded frames | A scene that goes out of sight gives back its room's picture and every frame of its character except the one on her canvas. The downloaded files are kept; coming back decodes them again while the brush is at work. | `src/engine/scene.ts` (`rest`, `ready`), `site.ts` |
| ✅ | 1. A 1.5× set of Rachel's Build frames for phones | `npm run assets` makes `scene1/rachel-1.5x/` (860 × 687 against 1146 × 916). Used when the picture is shown under 900 CSS px wide. | `scripts/build-assets.mjs`, `src/scenes/build.ts` |
| ✅ | 1. Build's reaction frames decoded only while Build is visible | They are given back with the rest when the visitor leaves, and decoded again on return, after the routine's own frames. Until they are back a find gets no reaction (it still counts). | `src/engine/scene.ts` |
| ✅ | 1. Peak decoded memory, phone profile, under 80 MB in each case | **Build only: 60.7 MB. Build, then Grow: 77.4 MB (it was about 165). Grow, then Build: 68.4 MB.** A new visitor, who gets the full paintings, adds the painting's sheet: 65.1, 77.4 and 69.8 MB. | `review-05/memory.json` |
| ✅ | 1. No visible wait when switching back | After each switch her full reaction played at the next find, and she never had to skip a frame of her routine. | `review-05/memory.json` |
| ⚠️ | 1. Switching both ways, no frame over about 50 ms (WebKit) | 12 cold runs per profile, four switches each (to Grow, back, to Grow again, back). **94 of 96 switches had no frame over 50 ms: iPhone profile 19 to 35 ms, desktop 23 to 39 ms.** Two had one: 59 ms (iPhone, back to Build) and 72 ms (desktop). The previous build, measured alternately on the same busy Mac, shows the same kind of stray frame at the same rate. | `review-05/switch-frames-webkit-cold.json`, `switch-frames-before-and-after.txt` |
| ⚠️ | 1. Sharpness of the 1.5× Build set on a phone | At 390 × 844 @3× her canvas is 860 px where the screen would use 1032, a stretch of 1.2×. Side by side I cannot tell the two apart at the size a phone shows them; at single screen pixels her outlines are a little softer. | `review-05/build-sharpness-390x844@3x.jpg` |
| ❌ | 2. The opening painting on a quiet Mac | **Not on a quiet Mac.** Ten cold loads, iPhone profile: longest frame at the end of the intro **21 to 45 ms in 8 runs, 60 and 111 ms in 2.** In the 4 s after it: 20 to 28 ms in 6 runs, 74 to 144 ms in 4. The previous build stalls the same way under the same conditions (see below). | `review-05/intro-webkit-cold.txt` |
| ✅ | Nothing else broke | All 20 mushrooms can be found and counted at three sizes; menu, skip, back button, reduced motion and keyboard pass; the lab's routine has no frame over 21 ms in WebKit without a window. | `review-05/hunt-checks.json`, `nav-checks.json` |

`npm test`: 53 of 53 pass.

### Item 1 in numbers

Decoded images and canvases on the whole page, from their sizes, sampled every frame. iPhone profile
(390 × 844), WebKit. "Peak" is the highest moment, including during the switch.

| Case | Peak | What it is made of at that moment |
|---|---|---|
| Build only | **60.7 MB** | Her 20 Build frames 47.3, her canvases 4.7, the room 6.3, the rest 2.4 |
| Build, then Grow | **77.4 MB** | The lab's stills and clip frames 63.3, her canvas 3.0, the lab's room 6.3, one Build frame kept 2.4, the rest 2.4 |
| Grow, then Build | **68.4 MB** | Her Build frames 47.3, canvases 4.7, Build's room 6.3, the switch's sheet 3.0, one lab still kept 3.0, the rest 2.4 |
| Grow only (for reference) | 75.1 MB | As "Build, then Grow" without the kept Build frame |
| Grow, then Build, then Grow again | 77.4 MB | The same as "Build, then Grow" |
| New visitor, Build only (opening painting) | 65.1 MB | Build only, plus the painting's sheet 4.4 |
| New visitor, Build, then Grow (full painting of the lab) | 77.4 MB | The peak comes later, in her routine, when the sheet is gone |
| New visitor, Grow, then Build | 69.8 MB | As above, plus the painting's sheet 4.4 |

"The rest" is the nine mushroom drawings, the logo and the two edges. Before this review, Build then Grow
was about 165 MB.

**The lab is the tight one, at 75 to 77 MB.** Of that, 42 MB is clip frames: 26 MB for the two reaction
clips the earlier review asked to keep decoded, and up to 16 MB for the nine routine frames around the one
on screen.

**Desktop is unchanged in kind:** it keeps the 2× sets (her Build frames are 84 MB there, the lab's peak
about 115 MB), but it too now holds only the scene on show.

### Item 2: why the numbers are not clean

The same test, run alternately on the previous build (before review 05) and this one, six cold loads
each, straight after the ten above:

| Build | End of intro, longest frame (ms) | The 4 s after, longest frame (ms) |
|---|---|---|
| Previous | 41, 36, 28, **88**, 28, 36 | 22, 21, 24, 18, 19, 20 |
| Review 05 | 18, 35, 20, 33, 19, 20 | 19, 22, 23, 20, 38, 20 |
| Previous | 18, 19, 18, 35, 18, 18 | 18, 18, 20, 21, 18, 19 |
| Review 05 | 33, 30, **63**, 22, 38, 19 | 21, **174**, 19, 20, 18, 21 |

Both builds have quiet batches (18 to 38 ms) and batches with a stray long frame. I read that as the Mac,
not the site, but it is not proof.

**To get the clean numbers:** pause iCloud sync and close other apps, then

```
cd ~/hjaas/site && npm run build && npm run preview
```

and, in a second tab,

```
cd ~/hjaas/site && node qa/tools/intro-frames.mjs 10 iphone
```

The last line it prints has the ten runs: `endGap` is the end of the intro, `fullGap` the whole painting.

### Decisions I made

1. **The old scene's images are given back at the start of the switch, not at the end.** The review says
   "once the incoming scene is fully shown". But the old picture is only a copy on a sheet from the first
   frame of the switch, and holding its frames until the end would put both scenes' frames in memory during
   the brush: about 120 MB. So they go one frame after the tap, before the new scene's frames arrive.
2. **The room's picture is given back too,** not only her frames. Without that, Build then Grow is 83.7 MB.
   Coming back decodes it again before anything is put on the page (the file is already downloaded).
3. **One frame is kept: the one on her canvas.** If the window is resized while she is away, or the moment
   she comes back, her canvas can be drawn at once. That is 2.4 or 3.0 MB.
4. **Her canvas and its rehearsal canvas are given back as well** while she is out of sight, and the
   rehearsal canvas 1.5 s after any frames stop arriving.
5. **What counts as "decoded image memory":** every decoded image and every canvas the page holds: her
   frames, both rooms, the mushrooms, the logo, the edges, her canvases, and the painting's or the switch's
   sheet. The page keeps this account itself (`__hj.memory`, with `?debug`).
6. **The other scene's room is still downloaded in the background** after the opening, so a first switch
   does not wait for the network. It is no longer kept decoded.
7. **Releasing the old scene has a frame of its own,** the one after the tap's. In the tap's own frame it
   made the switch's first frame 5 to 15 ms longer.
8. **If the 1.5× set cannot be fetched, the 2× set is used.** A phone on a failing connection could
   therefore end up with the heavier set.
9. **I did not shrink the lab further.** It could lose 2 to 4 MB by keeping fewer frames decoded around the
   one on screen, at the cost of less slack on a slow phone.

### Not done, or not verified

- **Item 2 on a quiet Mac,** as above.
- **A real phone.** The memory figures are sums of image and canvas sizes, not what a phone reports. The
  browser may hold more (for example copies on the graphics card), or less.
- **Whether the browser really frees a room's picture** when the page lets go of it. The page drops it; what
  WebKit then does with the decoded copy is its own business.

## Edge (organic)

`reviews/scene-edge-organic.md`, on `site/scene-2`. `main` was pulled first (as a merge); nothing was merged
into any other branch and no push failed. (The work was paused once at the user's request and finished
afterwards.)

The new edge is built, is the default, and passes every check except the one I could not make cleanly:
**smoothness in WebKit could not be measured**, because the Mac was heavily loaded by other work the whole
time. Under that load the old edge stalls exactly as often as the new one, which is all I can say.

| | Asked for | What was done, and what was measured | Evidence |
|---|---|---|---|
| ✅ | The organic edge, as the mock-up was made | Built from the review's recipe, in plate pixels: the rounded rectangle (radius 6% of the width), four scales of noise for the wander (up to 60 px in or out), a melt whose width changes along the edge (15 to 105 px, down to 6 at the least), and a calmer, thinner bottom fifth. Seeded per scene. It scales with the plate, so it is the same picture on every screen. | `src/engine/edge.ts` |
| ✅ | The mock-up beside the build at 1440 × 900 | To my eye the character matches option 2: the line wanders, the softness changes, and where the wander runs out past the plate the picture ends on a crisp straight line, as in the mock-up. | `edge/organic-compare.jpg` |
| ✅ | Production gets only this edge | `organic` is the default. `a-round`, `a`, `b` and `c` remain for `?edge=` in development. | `src/engine/edge.ts`, `edge/compare.jpg` |
| ✅ | Screenshots at 1440 × 900, 390 × 844 and 360 × 740 | Both scenes, with the phone also panned fully left and right. On phones the window shows the plate's own edge at top and bottom, and at the far left and right when panned there. | `edge/organic-build-*.jpg`, `edge/organic-grow-*.jpg` |
| ✅ | Every mushroom and tap area at 0.95 or more | Read back from the edge as drawn on the page: **every drawing at 0.988 or more, every tap box at 0.973 or more**, in Chrome at 1440 × 900 and 2560 × 1440 and in WebKit at 390 × 844, 360 × 740 and 320 × 640. Every box is 44 px, covers its drawing and overlaps no other. `npm test` checks the same from the formula at six sizes. | `edge/spots.json`, `src/engine/edge.test.ts` |
| ✅ | Nudge a spot minimally, don't weaken the edge | Three of Build's mushrooms along the bottom moved up: `screed` 13 px, `tiles` 7 px, `toolbox` 4 px. Nothing in Grow moved. All 20 can still be found and counted. | `src/scenes/build.ts`, `edge/organic-pick.json`, `edge/organic-hunt-checks.json` |
| ✅ | Rachel fully opaque in every pose | Every pixel any of her frames ever covers, in both scenes (20 frames in Build, 7 stills and 84 clip frames in Grow), read from the formula and from the edge as drawn: **1.00 everywhere.** The fade comes no nearer to her than 46 px in Build and 10 px in Grow (under the trolley's wheels). | `edge/organic-rachel.json` |
| ✅ | The paint-in still reveals into this shape | At 1.2, 2.4 and 3.6 s of a first-visit painting, in both scenes: of 678 and 418 points the edge leaves as paper, none showed paint, while 39% to 95% of the inside was painted. Recorded on desktop and the iPhone profile. | `edge/organic-reveal.json`, `organic-*-mid-painting.jpg`, `organic-intro-first-visit-*.mp4` |
| ✅ | The edge is drawn once | Once per scene, when the scene loads. It is one canvas over the plate, as before; nothing is worked out while panning, painting or switching. | `src/engine/edge.ts`, `scene.ts` |
| ⚠️ | Panning stays smooth (WebKit) | Longest frame 18 to 45 ms in 16 of 18 pans; two had a stray frame (64 and 74 ms). The old edge, alternated with it, has the same (one of 101 ms in 12 pans). The Mac was busy. | `edge/organic-pan-before-and-after.txt`, `pan-webkit.json` |
| ❌ | Switching scenes stays smooth (WebKit) | **Could not be measured.** With the Mac loaded as it was, 30 of 72 switches had a frame over 50 ms with the organic edge, and 30 of 72 with the old edge, alternated with it. | `edge/organic-switch-before-and-after.txt` |
| ✅ | Memory still under 80 MB on the phone profile | Build only 63.0 MB; Build, then Grow **78.0 MB**; Grow, then Build 70.8 MB. A new visitor: 67.4, 78.0 and 72.2 MB. | `edge/organic-memory.json` |

`npm test`: 58 of 58 pass. Five new tests hold the edge's character: that it wanders, that it is crisp in
places and a wide melt in others, that it is calmer along the bottom, and that it never reaches further in
than 165 px.

### What the edge costs

- **Memory:** it is drawn at half the plate's size, not a quarter, because its crisp places and its finest
  wander need the detail. That is 1.6 MB per scene against 0.4. To stay under 80 MB with the lab open, the
  lab now keeps one frame fewer decoded ahead of the one on screen (four, not five). With the processor
  slowed 4× and 6× she still never had to skip a frame.
- **Time to work out:** 17 ms in WebKit and 28 ms in Chrome on this Mac (the old edge: 3 ms); 168 ms with
  the processor slowed 4×. The opening scene's edge is worked out before the page shows. The other
  scene's is worked out a slice at a time in the background: the page is never kept busy for more than
  12 ms, also at 4×. (`edge/organic-cost.json`)

### Decisions I made

1. **The picture can end on a straight, crisp line at the plate's own rim.** The recipe lets the wander run
   outward as well as inward, and there is no picture beyond the plate, so where it runs outward the picture
   simply stops. The mock-up does the same. The earlier edges never did this.
2. **Build uses the 22nd of its possible edges.** Each scene's edge comes from a seed. With Build's own first
   seed the three mushrooms at the front of the floor would have had to move 10, 13 and 24 px, and two tap
   boxes would have overlapped on the smallest phone. I tried 64 seeds and took the one that asks least of
   them (13, 7 and 4 px). The edge is no weaker for it: it is the same recipe with a different throw of the
   dice. Grow keeps its own first seed, which needs nothing moved and leaves Rachel clear.
3. **No seed clears Build's floor mushrooms without moving them:** they stood 25 to 32 px from the bottom.
4. **Half the plate's size for the edge's canvas,** and one frame fewer ahead in the lab to pay for it, as
   above.
5. **A scene out of sight keeps its edge.** I first had it give the edge back and keep it as a small file.
   Making that file blocks the page for about 15 ms in WebKit on this Mac, which would be far more on a
   phone, so I took it out again.
6. **"Paper" in the paint-in check means paper there and for 6 px around.** Right beside a crisp stretch
   the stretched half-size edge leaves a trace of its neighbour a pixel or two wide.
7. **The numbers are the review's own:** no gain was added to the noise to make the wander larger or
   smaller than the recipe gives.

### Not done, or not verified

- **Smoothness of switching in WebKit with this edge,** as above. To measure it on a quiet Mac (iCloud
  sync paused, other apps closed): `cd ~/hjaas/site && npm run build && npm run preview`, then in a second
  tab `cd ~/hjaas/site && node qa/tools/review05.mjs switches 12`. The last line it prints has the longest
  frame of each switch, in ms, for the iPhone profile and for desktop.
- **A real phone.**
- **The match with the mock-up is by eye.** The shapes cannot be the same: the mock-up's seed is its own.

## Edge (pencil)

`reviews/scene-edge-pencil.md`, on `site/scene-2`. `main` was pulled first (as a merge); nothing was merged
into any other branch and no push failed.

Both parts are built and are the default: **the painting never ends on a straight cut**, and **the colour
gives way to pencil** (option B). Every check in the brief passes. One thing is done differently from the
brief, on purpose: the edge is not drawn once and kept, it is drawn each time its scene goes on show
(decision 1). That is what keeps the page under 80 MB.

| | Asked for | What was done, and what was measured | Evidence |
|---|---|---|---|
| ✅ | No hard cuts (item 1) | The review's fix, as written: the plate's outer 28 px always fade to paper. Three readings, all the way round both plates: the formula on the rim is 0 at all 10,456 points; the edge as drawn on the page lets none of the painting through on the rim, or 1 and 2 px inside it, and never more than the 28 px fade allows; on the screen at 1440 × 900 every pixel along the plate's outline is paper (off by 1 of 255 at most). On the organic edge as it shipped, the painting was over half strength 1 px from the rim along 7.2% of Build's rim and 5.1% of Grow's. | `edge/pencil-rim.json`, `edge/pencil-corners.jpg` |
| ✅ | Two edges from the same noise (item 2) | The colour ends 45 px further in than before (less along the bottom); the pencil reaches 10 px further out than the colour used to. Same seed and noise, so the pencil band follows the colour's wandering edge. | `src/engine/edge.ts`, `edge.test.ts` |
| ✅ | The pencil lines, as made (item 3) | `scene/pencil/build-lines.png` and `grow-lines.png` are used as they are, lossless. The strokes break up toward the outside with the review's formula. | `scripts/build-assets.mjs`, `public/assets/scene1/pencil-*.webp`, `scene2/pencil-*.webp` |
| ✅ | Drawn at the plate's full resolution, as strips (item 4) | Four strips along the plate's sides, at the plate's own pixels, scaled to the screen like the plate: 152 px deep at the top and sides, 112 px at the bottom. The overlay is `1 − aPaint` in the paper's colour, mixed toward graphite by `0.85 × pen`. | `src/engine/edge.ts`, `edge-band.json` |
| ✅ | The mock-up beside the build, with close-ups | To my eye the character matches B: solid painting, the colour melting off, the room's lines carrying on in pencil and breaking up. | `edge/pencil-compare.jpg` |
| ✅ | Screenshots at 1440 × 900, 390 × 844 and 360 × 740 | Both scenes; both phone sizes also panned fully left and right. | `edge/pencil-build-*.jpg`, `edge/pencil-grow-*.jpg` |
| ✅ | Every mushroom and tap area at 0.95 or more, no pencil over a mushroom | Read back from the edge as drawn on the page, in Chrome at 1440 × 900 and 2560 × 1440 and in WebKit at 390 × 844, 360 × 740 and 320 × 640: **every drawing at 1.00, every tap box at 0.969 or more, no pencil over any drawing.** Every box is 44 px, covers its drawing and overlaps no other. | `edge/pencil-spots.json`, `edge.test.ts` |
| ✅ | All 20 still findable | Every mushroom of both scenes clicked or tapped on the drawing itself, on desktop, the iPhone profile and a 320 × 640 phone: 20 of 20 each time. Grow's hunt rules (sizes, how much shows, Tab order, saved progress) still hold. | `edge/pencil-find.json`, `edge/pencil-hunt-checks.json` |
| ✅ | Nudge minimally or choose a seed | Both. Build has a new edge (the 243rd of 1500 tried) and three floor mushrooms moved up: `screed` 7 px, `tiles` 7 px, `toolbox` 13 px. Grow has a new edge (the 129th) and nothing moved. | `src/scenes/build.ts`, `grow.ts`, `edge/pencil-pick.json` |
| ✅ | Rachel fully opaque in every pose | Under every pixel any of her frames ever covers, in both scenes, by the formula and on the edge as drawn: **1.00 everywhere, and no pencil over her.** The fade comes no nearer to her than 6 px in Build (under her boots) and 10 px in Grow. | `edge/pencil-rachel.json` |
| ✅ | The paint-in: the pencil first, then the colour (**changed in round 3b, at the end of this section: the pencil now arrives with the colour**) | Done as asked, not the simpler way: the pencil fades up alone for 0.32 s, then the brush starts. Checked at a quarter of the speed: while the pencil is alone, none of the 47,495 points inside Build's painting (46,511 in Grow's) has any colour. Then at 1.2, 2.4 and 3.6 s: no bare-paper point shows anything, and none of the 5,776 points past the colour's edge (5,871 in Grow) shows paint, only paper or pencil. Recorded on desktop and the iPhone profile. | `pencil-film-*.mp4`, `pencil-film-*-stills.jpg` (re-recorded in round 3b) |
| ✅ | Production gets only this edge | `pencil` is the default. `organic` and the older ones remain for `?edge=` in development. | `src/engine/edge.ts` |
| ✅ | Memory under 80 MB on the phone profile | Build only **62.5 MB**; Build, then Grow **77.5 MB**; Grow, then Build **70.3 MB**. A new visitor: 66.9, 77.5 and 71.6 MB. (Last round: 63.0, 78.0, 70.8.) She never had to skip a frame. | `edge/pencil-memory.json` |
| ✅ | Compute in slices, nothing over about 12 ms in WebKit | Drawing an edge is 50 to 95 ms of work in WebKit, in slices: the page was never held for more than 8 ms (9 ms in Chrome; 9 to 19 ms with the processor slowed 4× and 6×). | `edge/pencil-cost.json` |
| ✅ | Panning stays smooth (WebKit) | 12 pans with the pencil edge, 12 with the organic one, alternated: longest frame 19 to 28 ms and 19 to 32 ms. None over 50 ms. | `edge/pencil-pan-before-and-after.txt` |
| ✅ | Switching stays smooth (WebKit) | Measured this time (the Mac was calmer). Coming back to a scene, 54 switches on the iPhone profile: longest frame **23 to 39 ms**; the build before, alternated with it: 19 to 46 ms. Desktop: 27 to 44 ms. From the tap to the end of the brush a switch takes 1.57 to 1.60 s; with the organic edge 1.51 to 1.60 s. | `edge/pencil-switch-before-and-after.txt`, `pencil-switch-frames-webkit-cold.json`, `pencil-switch.json` |
| ⚠️ | (not this round's) The lab's first opening | One frame of 53 to 65 ms in 5 of 18 cold loads on the iPhone profile. The build before this round does the same (54 to 72 ms in 3 of 12), so the edge is not the cause. See "Not done". | `edge/pencil-switch-before-and-after.txt` |

`npm test`: 66 of 66 pass. Eight new tests hold the pencil edge: paper on the whole rim and nothing above
the 28 px fade, a fade where the organic edge was cut, the pencil always reaching further than the colour,
the colour about 45 px further in (less along the bottom), the painting whole inside the four strips for
every scene, and the quick way of drawing it agreeing with the formula.

### What the user will see

- **The edge:** as in mock-up B. The amount of pencil depends on what the room has near its sides: Grow has
  a lot (shelving, the door, the window), Build less along the top and bottom.
- **A first visit:** a faint pencil sketch of the room's outer lines comes up on the bare page, and a third
  of a second later the brush starts. The whole painting is about 5.25 s instead of 4.95. *(Round 3b took
  this out again: see the end of this section.)*
- **A return visit, or reduced motion:** the pencil comes up in 120 ms, everything else in 200 ms just
  behind it: 300 ms in all instead of 200. *(Round 3b: 200 ms again, all together.)*

### What changed in memory and loading

- **The edge is 2.6 MB per scene** at full size in strips (the organic one was 1.6 MB at half size; a
  full-plate canvas at full size would be 6.3 MB).
- **Only the scene on show has an edge now.** Last round both scenes kept theirs (3.2 MB together). Now a
  scene gives its edge back when it leaves and draws it again when it returns. That is why the peak went
  down by 0.5 MB although the edge grew.
- **Nothing else was freed.** The lab still keeps four frames decoded ahead.
- **Page weight:** two small line pictures per scene, 86 KB for Build and 115 KB for Grow (Build's were
  118 KB before the line maps were made again, see the end of this section).
- **The opening appears about 0.1 to 0.2 s later** on a cold load (the brush's sheet goes in 309 to 621 ms
  after the page starts, against 224 to 349 ms), because the edge is drawn first. In exchange the opening
  is smoother: see the next section.

### The opening painting in WebKit (the open item from review 05)

Ten cold loads of the production build on the iPhone profile, this build and the one before it:

| | Longest frame through the whole painting | Runs with a frame over 50 ms |
|---|---|---|
| Pencil edge | 25 to 50 ms | 0 of 10 |
| Before this round | 25 to 297 ms | 4 of 10 (78, 105, 246 and 297 ms, just before the brush starts) |

The organic edge was worked out in one go as the scene was set up. The pencil edge is worked out in slices,
which removes that stall. Her loop afterwards: 19 to 23 ms, no frame over 50. The Mac was not idle (iCloud's
sync was still using about two thirds of one core), so this is not the "quiet Mac" run review 05 asked for,
but the numbers are clean. (`edge/pencil-intro-frames-webkit.txt`)

### Decisions I made

1. **The edge is drawn each time a scene goes on show, not once.** The brief says "drawn once, so panning
   and switching stay smooth", and also to free something if memory needs it. Keeping two full-size edges
   would have put the lab at 80.1 MB. So the scene out of sight gives its edge back, like its other
   pictures, and the edge is drawn again under the picture being left, before anything of the new scene
   can show. Cost: 50 to 95 ms of work per switch, in slices of 7 ms, which adds 10 to 60 ms to a 1.5 s
   switch. Nothing is drawn while panning, painting or looking. The other way to get under 80 MB was to
   keep both edges and drop the one frame of Rachel a hidden scene keeps (77.7 MB); I can switch to that
   if Wren prefers "once" to the letter.
2. **Through every switch the edge is there first.** Checked in screenshots taken as fast as they come, in
   Chrome and WebKit: no point past the colour's edge ever showed paint.
3. **The strips are 152 px deep (112 at the bottom), not about 140.** The colour reaches up to 147 px in
   with these two edges. A strip too shallow would cut the painting along a straight line, which is the
   very fault this round removes. A test holds every scene to it.
4. **Where two strips meet they overlap by 4 px,** each fading out as the other fades in, so that the two
   together are exactly the edge. Canvases that simply touch can show a hairline at some zoom levels.
5. **New edges for both scenes, chosen from 1500.** The colour now fades about 45 px further in, and
   Rachel's feet are 73 px (Build) and 63 px (Grow) from the bottom. With last round's edges the fade
   crossed her feet. About a third of all edges keep her whole; of those I took the one that moves the
   mushrooms least. No edge leaves Build's three floor mushrooms where they were.
6. **Build's three floor mushrooms are now 25, 29 and 17 px above where they were first placed** (small
   moves over the edge rounds). They still stand on the floor and read correctly to my eye.
7. *(Undone in round 3b.)* **The pencil gets 0.32 s to itself before the brush.** The edge is also what stops the paint at the
   painting's shape, so it has to be fully there before any paint is. Fading it in while the brush was
   already at work would have shown the first strokes right to the plate's rim.
8. *(Undone in round 3b.)* **The short reveal is staggered for the same reason** (the pencil 120 ms, then the rest). With reduced
   motion on, in about 20 screenshots through it per scene, no paint showed past the edge.
9. **`?edge=organic` now shows the organic edge on the new seeds,** so it compares like with like. Some
   mushrooms sit in its fade; it is for comparison only.
10. **The overlay's colour follows the brief's formula.** The mock-up's script applies the pencil in a
    slightly different order; the difference is under 1% and only where paint and pencil overlap.

### For Wren

- **Build's toolbox became a dark graphite patch at the right edge,** because its line map was nearly solid
  there. Fixed since by Wren in the line maps: see "After Wren's review" at the end of this section.
- **The café:** put its line map in `scene/pencil/`, add one line to the list in
  `scripts/build-assets.mjs`, set `lines: 'pencil'` in its config, and run `node qa/tools/pencil.mjs pick`.
  The tool takes everything the scene's character ever covers and lists the edges that keep the colour
  whole under it. It reads one character per scene: the café's cast and the mum will need their frames
  added to that check.
- **Few edges fit:** of 1500, 50 suit Build and 14 suit Grow (Rachel whole, inside the strips, no tap
  boxes overlapping). If the café finds none, deepen the strips in `edge-band.json` (about 0.2 MB per
  10 px) and run `npm run assets`.
- **On a phone, the window's own left and right sides are a straight 12 px fade** where the room carries
  on beyond the window. That is not the painting's edge and I did not touch it, but it is straight. The
  plate's real edge shows when the visitor pans to either end.

### Not done, or not verified

- **A real phone.** Everything above is Playwright's WebKit and Chrome on this Mac.
- **A fully quiet Mac.** The timings were clean this time, but iCloud's sync was running throughout.
- **The lab's first opening** still has one frame of 53 to 72 ms in about a quarter of cold loads on the
  iPhone profile, in this build and the one before. It falls about 40 to 55 ms after the tap. I did not
  trace it this round.
- **Memory is counted from picture and canvas sizes,** as before. While an edge is being drawn the page
  also holds one strip's pixels as numbers (1 MB at most) for a few tens of milliseconds; that is not in
  the figures, and it is never at the lab's peak.
- **The match with the mock-up is by eye.** The shapes cannot be the same: the mock-up's seed is its own.

### After Wren's review (2026-11-20): new line maps, no code changes

Round 3 was approved. Wren made both line maps again on `main` (outlines only; big dark fills no longer
turn into graphite). I merged `main`, ran `npm run assets -- pencil` and checked again. No code changed,
and the edge is still drawn again when a scene returns, as decided.

| | Check | Result | Evidence |
|---|---|---|---|
| ✅ | The graphite patch by the toolbox | Gone. In the strip beside the toolbox the line map was over half strength on 80% of the pixels; now on 7%. What is left there is the toolbox's own dark paint fading out, like every other colour at the edge. | `edge/pencil-toolbox-before-after.jpg` |
| ✅ | Every mushroom at 0.95 or more | Unchanged at five sizes: every drawing 1.00, every tap box 0.969 or more, no pencil over a drawing. | `edge/pencil-spots.json` |
| ✅ | Rachel fully opaque | Unchanged: 1.00 under all 31,445 (Build) and 40,322 (Grow) pixels she covers, no pencil over her. | `edge/pencil-rachel.json` |
| ✅ | No straight cut | Unchanged: the rim is paper all the way round in both scenes. | `edge/pencil-rim.json` |
| ✅ | Shot again | `pencil-compare.jpg`, `pencil-corners.jpg`, and the screenshots at the three sizes (they showed the old patch). | `edge/` |

- **Mock-up B in `pencil-compare.jpg` still shows the patch,** because the mock-up picture in `reference/`
  was made with the old line maps. The build beside it no longer has it.
- **Not shot again:** the films and the painting stills (`pencil-film-*`, `pencil-*-painting-*`). They show
  the old patch by the toolbox; nothing else in them changed.
- **Not measured again:** memory, timings and the finding of all 20 mushrooms. The line pictures have the
  same pixel sizes and no code changed, so none of these can have moved.

### Round 3b (2026-11-20): the pencil arrives with the colour, not before

The user found it strange that the line drawings were already there when the colour came in. Now the pencil
beyond the colour is sketched in beside each brush stroke as the stroke gets there.

| | Asked for | Result | Evidence |
|---|---|---|---|
| ✅ | Drop the pencil-only fade-up | Gone. The brush starts at once, and the painting is back to its old length: wash at 4.06 s, Rachel at 4.40 s, caption at 4.56 s, about 4.95 s in all (it was 5.25 s). | `src/engine/transition.ts` |
| ✅ | Drive the pencil from the paint-in reveal, spread outward by about 70 px | Each stroke brings up the pencil around its own paint, 70 px further out, with a soft falloff. Read back every frame of a painting at a quarter speed (about 1,100 frames per run, both scenes, desktop Chrome and the iPhone profile in WebKit): the pencil never showed more than 51 to 54 px from paint that was already there, in about 2 million readings per run. | `edge/pencil-reveal.json` |
| ✅ | Pencil never shows where the colour has not come yet | The same readings: for every pencil point, the pencil was half up no sooner than 8 to 12 ms after the brush first laid paint within 70 px of it (median 87 to 92 ms after; nine in ten within 0.2 s in Grow and 0.34 s in Build). Before the brush starts, the page is bare paper: under what covers the pencil it shows at 1% at the very most (measured: 99.2% of the paper's pixels exact, the rest within 6 of 255). | `edge/pencil-reveal.json` |
| ✅ | Sketched in over about 150 to 250 ms | A pencil point takes 142 to 154 ms (median) to go from a tenth to nine tenths there; nine in ten take under 188 to 204 ms. 2 to 4% take over 0.4 s: they sit just outside one stroke's reach and are finished by the next stroke. | `edge/pencil-reveal.json` |
| ✅ | No paint past the edge, still | Screenshots at 0.3, 0.9, 1.5, 2.3, 3.0 and 3.7 s, both scenes: none of the 622 (Build) and 640 (Grow) bare-paper points shows anything, and none of the 5,776 and 5,871 points past the colour's edge shows paint. | `edge/pencil-reveal.json` |
| ✅ | The same for the return-visit reveal | The finished picture is put up whole under a blank sheet of paper, and the sheet fades off it in 200 ms: colour and pencil are exactly as far along as each other in every screenshot (difference 0.001 at most), and nothing shows past the edge. It is 200 ms again, not 300. | `edge/pencil-reveal.json` |
| ✅ | Recorded on desktop and the iPhone profile | A first visit, then to Grow (its own painting) and back, on desktop Chrome and on the iPhone profile in WebKit. | `edge/pencil-film-desktop.mp4`, `edge/pencil-film-iphone.mp4`, and their `-stills.jpg` |
| ✅ | Three stills: early, middle, late | Build and Grow on desktop at 0.9, 2.3 and 3.7 s, and Build on the iPhone profile. | `edge/pencil-reveal-build-*.jpg`, `pencil-reveal-grow-*.jpg`, `pencil-reveal-iphone-*.jpg` |
| ⚠️ | Keep the frame budget in WebKit | The extra work is small: about 0.06 ms of script per frame while the brush is at work (the longest single frame of brush work 1 to 4 ms, the same as before). But the Mac was very busy all evening (load 10 to 16), and on it **both** builds dropped frames, so I could not show the 50 ms figure of the last round for either. Measured in turn: see below. | `edge/pencil-3b-frames-webkit.txt` |
| ✅ | Under 80 MB | Unchanged at the peak: 77.5 MB with the lab open. A first-visit painting holds 0.4 MB more while it runs (Build as a new visitor 67.3 MB, was 66.9). | `edge/pencil-memory.json` |

**How it works.** The pencil is part of the edge, which lies over the sheet of paper that the brush rubs
away (the edge is what stops the paint at the painting's shape). So the pencil gets a veil of its own: a
second, coarse sheet of paper (a quarter of the plate's size, 0.4 MB) that lies only where the edge holds
the colour back. The brush's own strokes take it off, with the same bristles, 70 px wider and in two
passes: one with the brush that only thins the veil, and one 0.18 s behind that takes it off. Nothing is
read back from the screen and nothing is filtered, so it costs a handful of extra line strokes on a small
canvas per frame.

**The frame budget, as far as this evening's Mac allows.** WebKit, iPhone profile, this build and the one
before it measured in turn:

- **Script per frame of the painting** (8 loads each, dev server): while the brush is at work, 34 to 88 ms
  of script in total over about 240 frames, against 26 to 74 ms before; the longest single frame's script 1
  to 4 ms in both.
- **Two frames are over 12 ms of script in both builds,** and were before this round: the frame in which
  the wash starts and the mushrooms become findable (4 to 28 ms now, 6 to 44 ms before), and the frame in
  which Rachel comes in (7 to 27 ms now, 10 to 38 ms before). Not from this round; I have not traced them.
- **Frame times through the opening painting** (production build, 12 cold loads each): frames over 50 ms
  in 11 of 12 loads now and 12 of 12 before, almost all of them at the same four moments at the end of
  the painting in both. While the brush is at work: 23 such frames in 7 of 12 loads now, 10 in 8 of 12
  before. That is bursts in three of the loads; with this much else running I cannot tell whether the veil
  has any part in it. It needs measuring again on a quiet machine.
- **The short reveal** (production build, 18 reloads now, 18 before): every frame of the 200 ms reveal was
  17 to 18 ms now (17 to 61 ms before). Taking the blank sheet off again, 2.5 s later, cost nothing
  measurable.

**Decisions I made (round 3b)**

1. **The spread is worked out from the brush strokes, not by filtering the reveal mask.** The brief
   suggests a max-filter and a blur on a small copy of the mask each frame. Reading a canvas back every
   frame is the kind of work that makes WebKit drop frames, so the veil is drawn with the same strokes,
   wider. The result is the same shape: the reveal, grown by about 70 px, soft at its rim.
2. **The pencil finishes about 0.1 s after its colour, not exactly with it.** To take 150 to 250 ms the
   pencil must either start well before the colour or end a little after it. It starts when the paint is
   about 70 px away and is complete about 0.18 s behind the brush.
3. **The faint outer fringe of the colour comes up with the pencil.** The veil has to cover the pencil
   wherever the colour is thin, so the colour's last few percent there arrive with the pencil's timing,
   not the brush's. Where 99.5% or more of the painting shows, the veil is 15% at most; where all of it
   shows, there is none.
4. **The return-visit reveal is a blank sheet fading off the finished picture,** in place of each part
   fading up by itself. It is the only way the edge's pencil and the colour can be exactly together without
   the room showing past the edge on the way in. It is also 200 ms again.
5. **A scene opened for the first time from another** draws its edge after the blank sheet is up. The edge
   stays out of sight until the veil has taken its shape from it, in the painting's first frame.
6. **The switch between scenes already seen is unchanged:** the new picture, pencil and all, was already
   brushed in under the old one.

**Not done, or not verified**

- **A quiet machine.** See the frame budget above. Everything else here does not depend on timing.
- **A real phone.**
- **The two slow frames at the wash and at Rachel's entrance** (over 12 ms of script in both builds).


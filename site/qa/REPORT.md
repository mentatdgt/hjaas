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

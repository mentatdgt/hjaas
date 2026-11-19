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

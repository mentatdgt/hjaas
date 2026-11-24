# Performance traces

Recorded 2026-11-18 with the Chrome DevTools MCP server (`performance_start_trace` /
`performance_stop_trace`) on the final code of `site/scene-1`, against the dev server.

**Profile for every run:** iPhone-sized viewport 390 × 844 at device pixel ratio 3, mobile and touch
emulation, **CPU throttled 4×**.

## Results

"Frame slots" is the number of 60 Hz frames in the window. "Dropped" counts the compositor's
`DroppedFrame` events in it. Tasks are main-thread tasks; a long task is one over 50 ms.

| Scenario | Window | Frame slots | Dropped | Long tasks | Longest task |
|---|---|---|---|---|---|
| Intro reveal (paint, Rachel, logo, counter) | 3.26 s | 195 | 1 | 0 | 24 ms |
| Find, first of the visit (flight, counter, reaction) | 3.6 s | 216 | 1 | 0 | 27 ms |
| Find, second | 3.6 s | 216 | 5 | 0 | 16 ms |
| 10/10 unlock (flight, counter, shower, reaction, morph) | 3.6 s | 216 | 6 | 1 (50 ms, as the last mushroom lands) | 50 ms |
| Form opening | 0.9 s | 54 | 3 | 1 (67 ms, at the tap, before the sheet moves) | 67 ms |
| Phone pan (three sweeps across the room) | 4.0 s | 240 | 0 | 0 | 33 ms |

The dropped frames are isolated: the longest run anywhere in these windows is two frames in a row.

## The same scenarios without the tracer

DevTools tracing adds its own load: it profiles every function call and captures a full-resolution
screenshot of each frame. The scene has its own frame log (`?debug`, `window.__hj.jank`: every frame
that arrives more than 25 ms after the previous one, plus the browser's long-task observer), so each
scenario was run again with the same throttling and emulation but tracing off:

| Scenario | Late frames | Long tasks |
|---|---|---|
| Intro reveal | 0 | 0 |
| Find, first | 0 | 0 |
| Find, second | 0 | 0 |
| 10/10 unlock, then opening the form | 0 | 0 |
| Phone pan | 0 | 0 |

## Against the target

The target was no dropped frames during motion and no long tasks while anything animates.

- **Met** for the pan, and for every scenario when the tracer is not running.
- **Not fully met under the tracer:** 1 to 6 isolated dropped frames per scenario (0.5% to 3% of
  frames), one task of exactly 50 ms as the tenth mushroom lands, and one of 67 ms at the tap that
  opens the form. At 4× throttling those are about 12 ms and 17 ms of real work.

## What the traces found, and what was changed

These problems were real and were fixed before the numbers above were taken.

| Found | Cause | Change |
|---|---|---|
| A 480 ms freeze each time the counter glinted. | A `drop-shadow` filter on the pin was re-rendered on every frame of the glint inside it. | The pin's shadow is its own layer; the glint runs outside any filtered or clipped element. |
| About 420 ms frozen in the middle of the first unlock morph, on the GPU side. Later morphs were smooth. | The first time the browser draws those effects it has to prepare them. | The unlock is rehearsed once at 2% opacity while the page loads (`counter.ts`, `warm()`), so the cost is paid before anything is visible. |
| A 105 ms hitch on the first frame of the intro, and late frames while the reaction frames loaded. | Images were being decoded on the main thread at the moment they were first drawn. | Rachel's frames and the room are decoded off the main thread from their bytes, and the reaction frames load one at a time in idle moments after the intro. |
| A 76 ms layout in the middle of the logo and counter entrance. | The prompt line's text was laid out for the first time as it appeared. | The text is laid out, unseen, before the intro. Font weights were cut to three. |
| Long tasks of 83 ms at a click and 105 ms at a landing. | Layout was being forced between changes to the page; the pin was re-rasterised at each scale of its squash. | Measurements are taken before any change; the number rolls inside its own layout boundary; the pin keeps one layer. |
| A 106 to 186 ms task at the tap that opens the form. | The sheet's first layout. | The sheet is laid out once, unseen, before the scene appears. |

## Reproducing

The raw traces are 4 to 9 MB each and are not in git; they are on the Mac that made them, in this
folder (`intro-`, `find-`, `unlock-` and `pan-mobile-4x.json.gz`), and open in Chrome DevTools'
Performance panel. To record them again: emulate `390x844x3,mobile,touch` with CPU throttling 4, then

| Trace | Page | Steps |
|---|---|---|
| intro | `?debug&reset&intro=full&seed=7` | Start the trace with a reload; stop after `window.__hj.ready`. Window: `__hj.marks.introStart` to `introEnd`. |
| find | `?debug&reset&intro=off&seed=3` | `performance.mark('hj-find')`, click `[data-spot="conduit"]`, wait 3.6 s; `performance.mark('hj-find-2')`, click `[data-spot="tiles"]`. |
| unlock | `?debug&reset&intro=off&seed=5&found=9` | Scroll the room fully right; `performance.mark('hj-unlock')`, click `[data-spot="toolbox"]`, wait 4.4 s; `performance.mark('hj-form')`, click `.hj-pin-action`. |
| pan | `?debug&reset&intro=off&seed=5` | `performance.mark('hj-pan')`, then smooth-scroll `.hj-viewport` to its right end, to 0, and to 266. |

`node qa/tools/analyze-trace.mjs <trace> --mark hj-find --span 3600` prints the numbers for a window;
`node qa/tools/busy.mjs` lists which threads were busy.

## Limits

- This is Chrome on a Mac pretending to be a phone. Throttling the CPU does not model a phone's GPU or
  memory. The numbers say the work per frame is small; they do not replace a real phone.
- The pan was driven by smooth scrolling from script, which uses the same compositor path as a finger
  but is not a finger.
- The intro trace was taken just before the last pre-intro change (laying the form out before the
  scene appears). That work happens before the measured window; the untraced run above is on the final code.
- Safari was not traced. The WebKit recordings in `../video/` show the same motion running there.

## Scene 3 (the café), 2026-11-21

Two more traces, same phone profile (`390x844x3,mobile,touch`, CPU throttling 4), production build
(`npm run build && npm run preview`), recorded with the Chrome DevTools MCP server. Raw files, not in git:
`s3-cafe-paint-in-mobile-4x.json.gz` and `s3-switching-mobile-4x.json.gz`.

| Trace | What | Result (`node qa/tools/analyze-trace.mjs <trace> --tasks`) |
|---|---|---|
| café paint-in | A new visitor opens `#design` (storage cleared, reload): the first-visit painting with the fan and the supporting cast painted in, then Rachel. Window 1.4 to 7.4 s after navigation. | 360 frames begun, 1 dropped. No main-thread task over 50 ms; the longest 38 ms (at 4× slow-down). LCP 1.38 s, CLS 0.01. |
| switching | From the café: Build (first visit, full painting), Grow (first visit), back to the café and to Build (the short brush). 24 s. | 1454 frames begun, 77 dropped, in four clusters: 21 as Build is put on the plate for the first time (a 166 ms task: layout, and measuring her rest frame), 5 as Grow is, 42 on the way back to the café, 9 on the way back to Build. Six tasks over 50 ms; the two at the short-brush switches are the room's picture being decoded again (89 and 97 ms at 4× slow-down), which every scene pays on the way back since review 05. |

The frame times without the tracer, in WebKit and in throttled Chrome, are in `../scene3/frames.json`. With
the tracer on, the way back to the café is the busiest moment of all: its 43 stills (24 of them the fan's)
are decoded and drawn once again while the brush is at work. Unthrottled in WebKit the same switch is 20 to
27 ms a frame.


## Scene 3 again, café package v7.3 (the final art), 2026-11-21

The same two traces on v7.3 (20 fan frames, Rachel's nine stills), same profile, production build. Raw
files, not in git: `s3-v73-cafe-paint-in-mobile-4x.json.gz` and `s3-v73-switching-mobile-4x.json.gz`.

| Trace | What | Result (`node qa/tools/analyze-trace.mjs <trace> --tasks`) |
|---|---|---|
| café paint-in | A new visitor opens `#design` (storage cleared before the page's script runs, reload). Window 0.7 to 6.7 s after navigation. | 360 frames begun, none dropped. No main-thread task over 50 ms; the longest 9 ms (at 4× slow-down). LCP 0.73 s, CLS 0.00. |
| switching | From the café: Build (first visit, full painting), Grow (first visit), back to the café and to Build (the short brush). 24 s. | 1420 frames begun, 43 dropped, in the same four clusters: 19 as Build is put on the plate for the first time (a 117 ms task: layout), 5 as Grow is, 10 on the way back to the café (42 with v5), 9 on the way back to Build. Four tasks over 50 ms; the two at the short-brush switches are the room's picture being decoded again (97 and 102 ms at 4× slow-down). CLS 0.02. |

(A first try at the paint-in trace cleared the storage and then reloaded: the page saves its progress as it
is left, so the reload was a return visit with the 200 ms reveal. That file was replaced.)

## Scene 3, café package v7.4 (Rachel's shadow in her stills), 2026-11-21

One trace, same profile, production build of `site/scene-3` at 8eec30d. Raw file, not in git:
`s3-v74-paint-in-and-switching-mobile-4x.json.gz`.

| Part | What | Result (`node qa/tools/analyze-trace.mjs <trace> <from> <to> --tasks`) |
|---|---|---|
| café paint-in | A new visitor opens `#design` (storage cleared before the page's script runs). Window 0.7 to 6.7 s. | 360 frames begun, none dropped. Longest main-thread task 8 ms (at 4× slow-down). LCP 0.75 s. |
| switching | Build (first visit), Grow (first visit), back to the café and to Build (the short brush). Window 8.5 to 30.6 s. | 1326 frames begun, 24 dropped: 3 as Build goes on the plate, 3 as Grow does, 10 on the way back to the café, 8 on the way back to Build. Three tasks over 50 ms: 73 ms as Build is first put on the plate, and the room's picture decoded again at the two short-brush switches (97 and 100 ms). CLS 0.02. |

## Scene 4 (Film: the Merlion at night), 2026-11-21

Two traces, same phone profile (`390x844x3,mobile,touch`, CPU throttling 4), production build of
`site/scene-4`, recorded with the Chrome DevTools MCP server. Raw files, not in git:
`s4-film-paint-in-and-find-mobile-4x.json.gz` and `s4-switching-mobile-4x.json.gz`.

| Trace | Part | Result (`node qa/tools/analyze-trace.mjs <trace> <from> <to> --tasks`) |
|---|---|---|
| paint-in and find | Film painted for the first time (0.6 to 6.6 s after navigation): the water and the presenter painted in with the scene, then Rachel and her camera's screen. | 361 frames begun, 2 dropped. No main-thread task over 50 ms; the longest 24 ms (at 4× slow-down). LCP 0.63 s, CLS 0.00. |
| | Film at work (6.6 to 8.6 s): the water every 110 ms, the presenter talking, the camera's screen redrawn with each. | 120 frames begun, none dropped. Longest task 6 ms. |
| | A find (`--mark hj-qa-find --span 3500`): the mushroom's trip, Rachel's turn, her look, the screen moving with the camera, and back. | 210 frames begun, 3 dropped (within half a second of the tap). No task over 50 ms; the longest 47 ms. |
| switching | A new visitor (storage cleared before the page's script runs) opens `#film`: its painting, 0.6 to 6.6 s. | 360 frames begun, 6 dropped, all between 0.87 and 0.96 s as the painting starts (one 60 ms task: the cast going on the plate). |
| | Then Build, Grow and Design for the first time (full paintings), back to Film, to Build and to Film again (the short brush). 33 s. | 2007 frames begun, 63 dropped, where each scene goes on the plate: 8 (Build, first time), 4 (Grow), 5 (Design), 10 (back to Film), 29 (back to Build), 7 (back to Film). Seven tasks over 50 ms: two of 98 and 99 ms as Build and Design are first put on the plate, and at each short-brush switch the room's picture decoded again (93 to 104 ms at 4× slow-down), as in every scene since review 05. CLS 0.02. |

The frame times without the tracer, in WebKit and in throttled Chrome, are in `../scene4/frames.json`.

### Scene 4 on the reshaped car (brief update after build 01)

One trace, same profile, production build with the new plate: `s4-film-car2-paint-in-and-find-mobile-4x.json.gz`
(raw, not in git). Taken at load 9 to 13 (iCloud Drive syncing), so noisier than the two above: the painting
(1.4 to 7.4 s) 360 frames begun, 14 dropped, four tasks of 53 to 124 ms (layout, a garbage collection); at
work 174 begun, 1 dropped; a find 210 begun, 8 dropped, one task of 96 ms. On the calm Mac the same parts
dropped 2, 0 and 3.

### Scene 4, round 2 (blink stills for every mouth, the Merlion hugged)

`s4-film-r2-paint-in-and-find-mobile-4x.json.gz` (raw, not in git), production build, load 4.6: the painting
(1.1 to 7.1 s) 360 frames begun, 1 dropped, longest task 20 ms; at work 114 begun, none dropped; a find 210
begun, 3 dropped, longest task 32 ms. Before the painting starts (0.9 s, blank paper) one task of 104 ms puts
the cast on the plate.

## Scene 5 (Set Design: the theatre backdrop), 2026-11-21

Two traces, phone profile (`390x844x3,mobile,touch`, CPU throttling 4), production build of `site/scene-5`,
the Mac calm (load about 2). Raw files, not in git: `s5-set-paint-in-find-walk-mobile-4x.json.gz` and
`s5-switching-mobile-4x.json.gz`.

| Trace | Part | Result |
|---|---|---|
| paint-in, find, walk | A new visitor opens `#set` (storage cleared before the page's script runs): the painting, 1.0 to 7.0 s. | 360 frames begun, none dropped. Longest task 13 ms. LCP 0.74 s, CLS 0.00. |
| | At work, 7.0 to 9.6 s (the lamp, Rachel). | 156 begun, none dropped. Longest task 3 ms. |
| | A find (`--mark hj-qa-find --span 3000`): the salute and the swath's 700 ms fade. | 180 begun, none dropped. Longest task 31 ms. |
| | The first walk, as scheduled (`--mark hj-qa-walk --span 4600`). | 276 begun, 1 dropped. Longest task 25 ms. (The trace's own page script read the boots' canvas every 100 ms to find the walk.) |
| switching | From Set Design: Build, Grow, Design and Film for the first time, back to Set Design, to Build and to Set Design (the short brush). 41 s. | 2444 begun, 40 dropped, where each scene goes on the plate: 4 (Build), 3 (Grow), 6 (Design), 1 (Film), 9 (back to Set Design), 9 (Build), 8 (Set Design). Five tasks over 50 ms: 50 and 62 ms as Design first goes on, and the room's picture decoded again at each short-brush switch (115 to 131 ms at 4×). CLS 0.02. |

### Scene 5, round 2 (the stagehand's drawn walk), 2026-11-23

One trace, same profile, production build of `site/scene-5`, the window panned right to the slot. Raw file, not
in git: `s5r2-crossing-mobile-4x.json.gz`.

| Part | Result |
|---|---|
| Out (`--mark hj-qa-walk --span 5000`): the whole man in the slot, then the boots. | 300 begun, none dropped. Longest task 5 ms. |
| Back (`--mark hj-qa-back --span 5000`): the boots, then the whole man. | 300 begun, none dropped. Longest task 2 ms. |

### Scene 5, round 3 (Rachel's in-betweens), 2026-11-24

One trace, same profile, production build of `site/scene-5`: a new visitor (storage cleared before the page's
script), then three finds. Load 3.9 when it ended. Raw file, not in git: `s5r3-moves-mobile-4x.json.gz`.
"Dropped" counts `droppedAffectingSmoothness`.

| Part | Result |
|---|---|
| The painting (1.0 to 7.0 s) | 360 begun, 6 dropped, all between 1.0 and 1.1 s, where one task of 52 ms puts the cast on the plate (blank paper, before the brush moves). None after that. |
| At work, 5 s (`--mark hj-qa-work --span 5000`): her strokes through the in-betweens | 300 begun, 1 dropped. Longest task 17 ms. |
| Three finds (`--mark hj-qa-find1`, `2`, `3`, `--span 3500`): lead-in, salute, back, with the swath's fade | 210 begun each; 1, 0 and 0 dropped. Longest task 27, 34 and 11 ms. |

The two builds measured in turn without the tracer: `../scene5/frames-r3-vs-r2.json`.

## Round 4 (Rachel painted in with the room), 2026-11-25

The painting of a new visitor, phone profile (`390x844x3,mobile,touch`, CPU throttling 4), production build,
Chrome, recorded by `node qa/tools/paint-in.mjs trace` (CDP, headless, the page navigated with no script of the tool's own
in it). Four runs of each scene, in turn with round 3's build (with the same `hj-paint` mark added); load about
3. Times are from `hj-paint`, the performance mark the page now sets as the painting's clock starts. Numbers of
all 16 runs: `../paint/trace.json`, `../paint/trace-before.json`. Raw (not in git): `r4-build-paint-mobile-4x.json.gz`,
`r4-set-paint-mobile-4x.json.gz`.

| | Build | Set Design |
|---|---|---|
| Frames begun, 0 to 6 s | 360 in each run | 360 in each run |
| Dropped in the first 100 ms | 0, 0, 0, 0 | 0, 0, 0, 0 |
| Dropped in the painting (0 to 4.75 s) | 0, 0, 0, 0 | 0, 0, 0, 0 |
| Dropped after it (4.75 to 6 s, she starts work) | 0, 1, 0, 0 (at 4.76 s) | 0, 0, 0, 0 |
| Longest task while painting | 6 to 11 ms (round 3: 8 to 11) | 4 to 6 ms (round 3: 4 to 7) |
| Longest task setting up, on blank paper | 41 to 49 ms (round 3: 76 to 91) | 36 to 38 ms, one run 102 (round 3: 76 to 93) |
| The clock starts after navigation | 876 to 924 ms (round 3: 840 to 923) | 1349 to 1427 ms (round 3: 1317 to 1381) |

Round 3's "6 dropped in the first tenth of a second" were before its clock: with the mark added, its build drops
7 to 11 frames on blank paper and none from the first stroke on. The window 1.0 to 7.0 s was counted from navigation.
What is left there (3 to 12 frames) is still paper: nothing on screen moves.


## The two-mushroom counter (2026-11-25, `site/counter`)

`node qa/tools/counter.mjs trace`: headed Chrome driven by a script, production build, 390 × 844 at 3×, processor
slowed four times, progress put in storage. Six runs of each, the build before (`site/scene-5`) in turn. Counted from
the landing (`hj-land`). Numbers: `qa/counter/trace.json`, `trace-before.json`; what was found and changed:
`reviews/hunt-counter-review-01.md`, section 3.

| | Dropped at the tap, per run | In the flight | First two frames of the landing | After that |
|---|---|---|---|---|
| A find | 4, 1, 5, 2, 4, 2 (before: 2, 1, 1, 5, 2, 3) | 0 | 1 in two runs of six (before: 1 to 3 in three of six) | 0 |
| A scene's tenth | 6, 1, 3, 0, 3, 4 | 0 | 1 in three runs of six | 0 |
| The fiftieth | 1, 3, 1, 7, 1, 7 (before: 1, 1, 1, 4, 1, 1) | 2 in two runs of six | 2 in two runs of six (before: 2 in one) | 0 |

### Round 2 (the phone framing, same day)

The same, on the final build (source `9ceff98`), in turn with round 4's (`528746a`); load 3.2 to 3.9. Round 1's table above is
kept for comparison; `trace.json` and `trace-before.json` now hold these runs.

| | Dropped at the tap, per run | In the flight | First two frames of the landing | After that |
|---|---|---|---|---|
| A find | 3, 1, 3, 4, 5, 5 (before: 2, 1, 5, 1, 1, 4) | 0 | 2, 1, 1 in three runs of six (before: 1 in one; 3 at 45 to 76 ms in another) | 0 |
| A scene's tenth | 4, 3, 3, 3, 1, 3 | 0 | 2, 1, 1 in three runs of six | 0 |
| The fiftieth | 4, 3, 1, 7, 6, 5 (before: 3, 5, 5, 6, 3, 6) | 1 in one run of six (before: 1 or 2 in all six) | 0 (before: 0) | 0 |

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

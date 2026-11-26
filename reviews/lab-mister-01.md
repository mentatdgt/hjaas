# The lab's mister mists: build report 01

From: Fable. For: Wren. 2026-11-26. Job 022. Branch `site/review-fixes`: code `07b785a`, evidence `8766b7c`, and a test fix with this report. `main` and `deploy` were not touched.
Brief: job 022. Engine notes: `reviews/lab-mister-engine-notes.md`. Tool: `site/qa/tools/lab-mister.mjs`. Evidence: `site/qa/lab-mister/`.

**Done.** Grow plays the mister's mist (M1 to M4, 140 ms each, forever) under Rachel. It is painted in with the room, holds M1 when paused or with reduced motion, and a failed or stalled mist leaves the room's own painted mist with Rachel unaffected.

## What changed
I followed the engine notes, with two additions: the mist must never stall Rachel, and its stills are encoded at higher quality.
- **`types.ts`:** `ClipCast.scenery?: { dir, frames, routine }`, the room's moving parts as a cast package.
- **`scene.ts`, `Casting.fetch`:** for a clips cast with `scenery`, the mist is loaded with the existing `troupe()` code at the same time as Rachel. Its actors come first in the list, so they sit under her and over the mushrooms.
  - `troupe(…, scenery = true)` has no lead, so the mist is `hj-actor`; `hj-rachel` and the lead stay Rachel's (`leadOf` picks her: she reacts).
  - **Never at her cost:**
    - Manifests or first still fail: the mist is left out, with a warning.
    - Decode fails: `troupe()` gives back what it decoded, and she goes on alone.
    - Her decode fails: the mist's decoded frame is given back.
    - Mist late: once her first drawing is here, the mist gets 2 s (`SCENERY_GRACE_MS`); after that the scene goes on without it, as painted.
- **`grow.ts`:** `scenery: { dir: 'cast/', … }`. `keep` stays unset (the mist is scenery and the edge fades it with the plate; the edge doesn't reach it anyway).
- **`build-assets.mjs`:** a `PACKAGES` entry for `frames/024-lab-mister/site` → `scene2/cast/`, `grow-cast.json`. A package with no `plate` adds no room job, and one with `lines: null` is left out of the pencil maps. The stills use `patchFrame` (q99), per the notes' option: 5 KB each.
  - `npm run assets` changed nothing else: only the new `scene2/cast/` and `grow-cast.json` appeared.
- **Tests (+23 run, 433 in all):**
  - `mister.test.ts` copies Film's water checks: the loop, 140 ms, never reacts, rests on M1, rolled a few steps at a time.
  - `scenes.test.ts`: no Grow mushroom in the mister's box, `room: ['mister']`, no `keep`.
  - `scene-load.test.ts`: the mist is asked for together with the room and decoded only when the scene opens, under Rachel. It also covers the manifest, routine or M1 blocked, M2 to M4 blocked (holds M1), the mist stalled (she goes on within the grace), and her decode failing (M1 given back).

## Checks
Dev build on 5191, production previews of this build and of `557ab37` on 4193 and 4194.

| Check | Result |
|---|---|
| Tests, types, build | 433 of 433, clean, builds |
| Hunt | 50 of 50 by taps, with Next, button and form, desktop, portrait and landscape, Chrome (`hunt/`) and WebKit (`hunt-webkit/`). A tap where the switch-box mushroom's tap box overlaps the mist box (3 to 13 px) finds it: casts have `pointer-events: none` |
| The loop, read every frame for 6 s (`cycle-*.json`) | Chrome and WebKit, desktop and the phone panned to the mist: M1 → M2 → M3 → M4 → M1 in order every time, mean 139.7 to 140.1 ms, longest 150 to 152, 0 gaps over 160. One canvas picture per pose. 0 page frames over 25 ms |
| Frame samples and seams (`frames-*.png`, `frame-*-M1..M4.png`) | Each pose held and shot over the room, and the same with the mist hidden. Outside the box: 0 to 1 levels (WebKit phone: 5). At the rim (3 px either side): p99 3 / 5 / 13 / 16 levels (Chrome desktop, WebKit desktop, Chrome phone, WebKit phone), **the same in all four poses**, so it is static and not a flicker. It is the canvas's own resampling of the room the patch repeats, mostly where the pipe and the lid's outline cross the edge. At 6 to 8x zoom no jog or edge shows (both agents and the reviewer looked) |
| 6 s recordings after the painting (`grow-*-6s.mp4`) | All four: painting 4.77 s, then the mist cycling (mean 140 ms, 0 gaps over 160) with Rachel at work. Made without `?debug`'s tap outlines. The WebKit phone video has a grey margin, which is how Playwright records WebKit at 3x |
| Pause and reduced motion (`still-*.json`) | All four: paused, M1 only, 0 changes (Rachel holds too), and 14 changes in 2 s after Play. Reduced motion: M1 only, 0 changes |
| Mist files failing (`fail-*.json`, `fail-*.png`) | Blocked (`scene2/cast/**`), stills blocked and stalled, all four configs: Rachel alone on the plate, the lead, her routine as in a normal load (Chrome 15 vs 17 pose changes in 8 s; WebKit 46 to 48 vs 47 to 50), a find works, the room's painted mist shows with no hole. Blocked: ready no later than normal. Stalled: 0.8 to 2.7 s later than normal (the grace), and the mist stays absent for the visit |
| Memory, the 30 orders (`memory/`) | **Highest 78.9 MB** (return visitor, Grow), **78.2** new visitor; budget 80. Before: 78.5 and 78.4. Grow's own frames 61.6 → 61.9 MB, canvases 3.0 → 3.1 (the mist: +0.4 MB). Every reaction played in full; 0 frames skipped |
| Trace, Chrome, phone, 4x slower, production builds in turn (`trace.json`, `trace-run2.json`, traces `trace-grow-phone-4x-*.json.gz`) | Three runs, each Build → Grow by its tab (painting), then the window panned to the mist and 12 s traced. Calm run (load 2.4, 6 rounds each): dropped frames during the painting 0,0,0,0,0,2 now vs 0,4,1,2,0,6 before; mist in view 0,0,0,0,1,0 now vs 0,2,0,0,2,2 before. The first run, during the memory runs (load 4 to 7), had now worse in the painting (6,4,3,0 vs 1,0,0,0); a second at load 3.7 was even (0,1,1 vs 0,0,0 painting; 0,1,6 vs 3,1,0 in view). Traces here are bimodal, and in the calm run the loop shows no cost |
| Console | Nothing new. Every load in both browsers logs one failed `room.webp` request (the room asked for twice), on `557ab37` too: 3 of 3 loads each, both builds |

## Independent reviewer
It had not seen the work and wrote its own scripts. **PASS with notes.** It found tests and types clean and the build working, and the assets consistent with the package and nothing else changed. It confirmed the mist under Rachel, the only `.hj-rachel` being Rachel, the loop in order, pause and reduced motion on M1, and that with the mist blocked she plays and a find works. Leaving Grow and coming back three times, the mist is still there and cycling with steady memory. It saw no seam. Its notes:
1. **With `?seed=`, Rachel's Grow timeline differs from older builds:** the mist draws from the same seeded random numbers (its stagger and its schedule). Visitors are not affected (no seed); it matters only to QA that compares seeded Grow runs across builds.
2. **A stalled mist delays her by up to 2 s and is not retried that visit:** bounded, as designed. A very slow network could lose the mist for the visit; the room then shows as painted.
3. **The q99 stills differ from `room.webp` by 1.3 levels on average where they repeat it (at most 12):** not visible.
4. **Memory headroom is about 1.1 MB.**
5. **M1 is fainter than the room's painted mist:** see 1 below.
6. A test assertion that could not fail: fixed with this report.

## For Wren
1. **M1 is fainter and softer than the painted mist on the plate.** M1 is what reduced motion and "Pause animation" show, and the painted mist is what shows if the files fail. This is the art as delivered; say if the held frame should be denser.
2. **Phone memory is now 78.9 of 80 MB.** Anything new in Grow or Build needs the 30 orders again.
3. The stalled-mist grace (2 s) is a judgement call: long enough that a normal network never loses the mist, short enough that a hung request costs Rachel little.

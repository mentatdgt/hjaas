# Load speed part 2: verification (job 020b), and the missing Part B report

Branch `site/review-fixes`. Head checked: `217d4ae` (Part A `3dffd05`, Part B `ec0a94a`, plus the art rebuild and the Grow mist). Compared with `7382186`, the build before Part A. `main` and `deploy` untouched.

**Result: VERIFIED, with two fixes.** The independent reviewer found two real bugs in Part A/B. Both are fixed in this commit (smallest changes, with tests) and re-checked:
1. **Build's reaction stopped downloading after a tap away and back** (`scene.ts`, `more()`). Tapping another tab, then Build again before the other scene opened, handed back a reaction download that had already given up. She then never reacted to finds in Build until she left it. Now a called-off download is never handed back; a new one starts. Browser repro: 3 → **16 of 16** reaction files, Chrome and WebKit.
2. **The next room was fetched ahead before the scene's own files were in.** This happened after Skip, a hurried switch, the back-forward cache or a tab shown again. Now it starts only once the scene's `loadMore()` has finished, via a new `onFilesIn` host callback and a `filesIn` flag that pause and rest clear. Repro (Chrome, Slow 4G, Skip): the look-ahead used to start at 13.3 s with 18 of Build's own files (2.2 MB) still to come. It now starts at 25.9 s, with none left.

Timings below were measured on `217d4ae`. The two fixes don't touch the path to the first stroke.

## Timings: tap (or page load) to first stroke, median of 3, seconds (`qa/load-speed-2v/timings-*.json`)
Tool: `qa/tools/load-speed-2b.mjs timings`. That is load-speed.mjs's visit, plus "opening Film" (added here) and the switches after a fetch ahead; the two builds alternate within each set of 3. Phone profile 390x844. The Mac's load was 4 to 10 during the runs.

| | WebKit Fast 4G | WebKit Slow 4G | Chrome Fast 4G | Chrome Slow 4G |
|---|---|---|---|---|
| Opening Build | 2.50 → 2.48 | 9.43 → 9.48 | 2.48 → 2.53 | 9.47 → 9.41 |
| Opening Set Design | 3.86 → **2.52** | 15.44 → **9.03** | 3.93 → **2.46** | 15.49 → **9.10** |
| Opening Film | 3.63 → **2.52** | 15.78 → **9.58** | 2.96 → 2.85 | 9.76 → 9.56 |
| Cold switch to Grow | 2.08 → 2.16 | 8.54 → 8.33 | 2.04 → 1.96 | 8.47 → 8.20 |
| Cold switch to Design | 2.25 → 2.14 | 8.75 → 8.37 | 2.26 → 2.13 | 8.69 → 8.38 |
| Cold switch to Film | 2.28 → 2.11 | 8.86 → 8.34 | 2.17 → 2.08 | 8.72 → 8.27 |
| Cold switch to Set Design | 4.10 → **2.04** | 15.83 → **7.76** | 3.99 → **1.87** | 15.60 → **7.65** |
| Switch to Grow after its room was fetched ahead | 0.79 → 0.82 | 2.61 → 2.05 | 0.87 → 0.80 | 2.60 → 1.98 |
| Switch Film → Set Design after its room was fetched ahead | 2.84 → **0.80** | 9.43 → **1.62** | 2.75 → **0.78** | 9.05 → **1.46** |

**Worse anywhere?** Nothing beyond noise:
- **Opening Build:** +50 ms in Chrome Fast 4G and WebKit Slow 4G. The runs overlap: before 2.47–3.34 s, now 2.39–2.58 s (Chrome Fast 4G).
- **WebKit Fast 4G, cold switch to Grow:** +80 ms (before 2.07–2.14 s, now 1.95–2.17 s). That switch now carries the Grow mist's 6 extra files (job 022: 12 → 15 requests), not anything from Part A/B.
- **When the room fetched ahead arrives:** later than before, because it is now fetched only once the scene's own files are in. Build → Grow on Slow 4G: 23 s after the first stroke, against 15.5 s for the old warm-up.

## Checks
| | Check | Result |
|---|---|---|
| ✅ | 1. Timings (above) | Set Design (opening −6.4 s, cold switch −8 s on Slow 4G) and Film's opening in WebKit (−6.2 s Slow 4G) are much faster. Everything else is the same or slightly faster. Rapid tapping, 7 tabs 250 ms apart (`load-speed-2v-rapid.mjs`): first stroke 30.7 → **25.3 s** after the last tap, both browsers. |
| ✅ | 2. Network, every room once (`network.json`, `b/`) | Normal windows, WebKit and Chrome: every room downloaded once in full in all cases. That covers openings of Film, Set and Build, a tour of all five and back, and Grow tapped while it was being fetched ahead (+ one 304). Film in WebKit: **2 → 1** (3680 → 2447 kB). Private WebKit window (no cache at all): going back to Film downloads its room again, 3 → 2 (before) → now; no regression. Part B cases, see the line below. |
| ✅ | 3. Film's camera screen (`screen.json`) | Pixel-identical to `7382186` (with today's art) in all 8 cases: WebKit/Chrome, normal/private window, opening/switch. |
| ✅ | 4. Tap away, rapid, failures (`tapaway.json`; after the fixes `fix-tapaway/`) | Every case ends with her at work in the scene asked for. The first scene's cast is called off and no cast requests follow. Never "room painted but she isn't", apart from a failed cast (the room is shown without her, as designed; she is back on the next visit). Failed room: Retry works. No room downloaded twice. Only Grow's four manifests (280–570 B each) come down whole twice in Chrome after a called-off cast, because Chrome drops a cache entry it was writing when cancelled. |
| — | 5. Trace, Chrome phone 4x slower (`trace-fast.json`, `trace-*.json.gz`) | 3 rounds each, builds alternating, at load 7 to 10. Dropped frames over the opening + 4 switches: **now 34/5/48/13/10 vs before 24/25/21/16/50** (totals 110 vs 136 over 3 rounds). The rounds swing both ways: Design now 7, 13, 28 against Set before 1, 37, 12. Can't tell the builds apart at this load. Worth a calm re-run. |
| ✅ | 6. Memory, phone (`memory/memory.json`, `switch/memory.json`) | 30 orders: highest **79.3 MB** (budget 80, margin **0.7 MB**). The peak is one moment in one order (return visitor Design → Set → Grow → Film → Build, at the switch back to Design): Design's canvases (4.1 MB) were made before Build's drawings had been released. Job 022 measured the same order on the same code at 75.2. The next highest is 78.9; every other order is ≤ 78.8. Every reaction played in full. Rapid taps (2 s to 120 ms): highest 69.6 MB, never two casts, two edges or more than two rooms. Re-run of that one order: see below. |
| ✅ | 7. Tests, type check, build; hunt | **435 tests pass** (2 new: the reaction restart, `onFilesIn`), type check and build clean. Hunt **50 of 50** in Chrome and WebKit: desktop, phone upright and on its side, Next, reload, button, form (`hunt/`). |
| ✅ | 8. The failed `room.webp` request | It comes from **Part B's `keepsRooms()`**, not Part A. Once a scene has settled, it asks the browser's cache (only) whether it kept the room on show, and stops reading as soon as it has the answer. **Chrome:** one `net::ERR_ABORTED` row in the Network panel on every page load, in every scene; served from cache, **0 bytes**, nothing in the console. **WebKit normal window:** nothing. **WebKit private window** (and Playwright's default WebKit contexts): one console line, "Failed to load resource: resource unavailable". It comes from that cache miss (once per visit; look-ahead is then off) and from Film's screen cut (`cutFrom`, which falls back to the `<img>`). **Harmless:** no download, nothing shown to visitors. Left as is. |
| ✅ | 9. Memory margin | 79.3 MB worst of 30 (above), 0.7 MB under the budget. Typical worst is 78.2–78.9. |
| ✅ | Set Design (`b/set.json`) | Same picture as before (0 and 4 found, both browsers, both lines). Before the first stroke only the pieces earned + the next (0 found: P_01; 4 found: P_01–05), against 10 pieces and 51 stagehand files before. The stagehand joins 6–13 s after the first stroke and walks 17–27 s after it. Counted from page load that is about the same as before, because the stroke now comes 6 s sooner on Slow 4G. |

## Reviewer (independent subagent, had not seen the work)
**FAIL on one regression**, which is fixed here (bug 1 above), plus the look-ahead timing (bug 2, also fixed). It re-ran checks 2 and 4 on `217d4ae` and confirmed the results above: every room once in normal windows, Film 2 → 1 in WebKit, she always ends at work. Its other notes, not changed here:
- A fetch ahead called off at 99% is thrown away whole. Seen once: Set Design's room in a failed-cast run.
- Grow's tiny manifests come down twice in Chrome rapid taps.
- The WebKit-private console lines (check 8).
- `keepsRooms` uses the plain room address, so after a stalled room loaded as `?again=N` there is no look-ahead for the rest of the visit.
- A mist later than its 2 s allowance doesn't show that visit.
- Pre-existing: `enter()` can briefly decode a cast for a scene that has already rested.
Its scripts are in `qa/load-speed-2v/review/`.

## Part B report (job 020 ended before writing one)
Job 020 (`ec0a94a`) built:
1. **Set Design's backdrop:** only the pieces already earned are downloaded before the first stroke. The next one follows straight after, the rest in hunt order once the scene has settled (`Progress.stream`). A piece found before its file is here is fetched at once.
2. **The stagehand** is downloaded once the scene has settled and joins when ready (`callWalkers`).
3. **Next room ahead:** after a scene settles, the room of the next tab not yet shown is fetched into the HTTP cache at low priority, read and let go, never decoded (`warmRoom`, `lookAhead`).
   - One at a time; called off on any tab tap, reset or leaving the page.
   - Skipped on save-data, and in browsers that keep no cache (`keepsRooms`).
   - If its scene is tapped meanwhile, the room's `<img>` waits for it rather than downloading again.
4. **Grow's later clips give way to a tap,** and carry on from the same frame.

Its checks were not finished. They are this report.

## Not done / for Wren
- The trace (check 5) needs a calm re-run (load under 5) to say anything.
- Phone memory is 0.7 MB from the limit in the worst order. Anything new in Build, Grow or Design needs the 30 orders again.
- Untracked `site/qa/load-speed-2b/` is job 020's partial evidence, measured against `a252d17`. I left it alone. Its tool, `qa/tools/load-speed-2b.mjs`, is committed here.

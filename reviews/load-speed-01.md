# A faster opening (load speed, part 1): build report 01

From: Fable. For: Wren and the user. 2026-11-25. Job 011b. Branch: `site/review-fixes`; `main` and `deploy` were not touched.
Brief: `reviews/load-speed-build.md` (on `main`), **part 1 only**. "Before" is `c605053` (job 010). Evidence: `site/qa/load-speed/`.

**Result: built.** On Slow 4G the first stroke in Build comes after 10.1 s (13.7 before), on Fast 4G after 2.4 s (3.3). 289 tests, type check and build pass.

```
cd ~/hjaas && git checkout site/review-fixes && git pull && cd site && npm install && npm run build
HJ_OLD_DIST=<a build of c605053> node qa/tools/load-speed.mjs timings webkit 3     (or: rest, trace)
node qa/tools/away-and-back.mjs
```

## 1. What changed

- **The painting starts once the room, the hunt's art, the edge and the drawing she rests on are here.** The hunt's art and the edge's two line maps are now asked for together with the room, not after it.
- **Her other drawings are downloaded from then on.** They are decoded four at a time and first drawn in quiet moments between frames, a few ms a frame. Clips and reactions come after them, as before.
- **Her routine starts when all the drawings it can show are here**, also after Skip. Until then she holds the rest pose. A find made then counts; she answers only with drawings that are here.
- **Shared code:** the same holds for the first painting of every scene, and for every actor in Design, Film and Set Design. A cold switch gains too, because it waits for fewer drawings; its cast still starts after its room (part 2).
- **A tap on another scene** calls off what the scene on show was still downloading for its routine, so the tap has the network; staying or coming back carries on. (Needed here: those downloads used to be over before the painting.)
- The next room in Build's opening is still warmed as before, but only after her own drawings.

**Not built (part 2):** cast with the room, the new next-room fetch, Theatre's pieces and walkers later, Grow's clips giving way. Job 011's versions of these are on `wip/011-load-speed`.

## 2. Before and after

WebKit, phone 390x844, through a server that behaves like the line, both builds in turn. Page load to first stroke, 3 runs each, median (all runs in `timings-webkit.json`). Bytes and requests are those asked for before the first stroke; some of hers are already on their way by then.

| Opening | Slow 4G before | now | | Fast 4G before | now | | kB and requests (Slow) before | now |
|---|---|---|---|---|---|---|---|---|
| **Build** | 13.71 s | **10.08 s** | -3.6 | 3.27 s | **2.36 s** | -0.9 | 2,495 kB, 30 | **1,793 kB, 27** |
| Grow | 14.35 | 9.76 | -4.6 | 3.33 | 2.47 | -0.9 | 2,605, 27 | 1,805, 27 |
| Design | 17.11 | 9.99 | -7.1 | 4.17 | 2.70 | -1.5 | 3,145, 66 | 1,824, 34 |
| Film | 19.56 | 15.93 | -3.6 | 4.29 | 3.57 | -0.7 | 3,709, 45 | 3,042, 32 |
| Set Design | 20.30 | 15.72 | -4.6 | 5.19 | 4.10 | -1.1 | 3,773, 139 | 2,991, 90 |

Build on Fast 4G: 2,495 kB in 30 requests before, 1,953 kB in 27 now.

When she first moves, counted from the first stroke (`rest.json`, one run each, so about 0.3 s of it is her routine's own chance): the same as before on both lines (Build in WebKit 4.9 s and 4.9 s on Slow, 4.9 and 5.0 on Fast). **Design on Slow 4G: 6.6 s, 5.8 before** (her first stroke is 7 s earlier).

## 3. Checks

| | Check | Result |
|---|---|---|
| ✅ | "Room painted but she isn't", Build (`paint/`): on Fast 4G, her drawings arriving during the brush | 0 frames, whole of her, outline and sectors: desktop and phone, Chrome and WebKit. |
| ✅ | The same, all five scenes, 25 switches (`switch/she.json`) | 0 frames: desktop Chrome, phone Chrome 4x slower, iPhone WebKit. |
| ✅ | Painted on the same pixels as before (`rest.json`) | Identical, all actors of all five scenes: Chrome desktop and phone, WebKit phone. |
| ✅ | Her other drawings held back, with and without Skip: Build, Grow, Set; Chrome and WebKit | She holds the rest pose for 8 s, a find counts, and she starts work when they arrive. |
| ✅ | Slow 4G: away mid-painting and back, there and back, Skip (`away-and-back.json`) | She is at work in the end, 6 of 6. No drawing downloaded whole twice. No errors. |
| ✅ | Trace, Chrome phone 4x slower, Fast 4G, 5 rounds in turn (`trace-fast.json`) | **The brush (to 4.0 s): 0 dropped frames in 10 of 10.** The wash after it: now 1, 0, 3, 17, 4 dropped; before 8, 0, 3, 3, 3. Bimodal on this Mac in both builds. In the saved traces no task over 8 ms before the wash. |
| ✅ | 30 visiting orders (`memory/`) | **78.5 MB highest** (78.4 to 78.5 in jobs 009 and 010; in Grow each time). Every reaction in full, no errors. |
| ⚠️ | Skipped frames in those orders | Grow's clips skipped 1 to 12 frames in 5 of 30 orders, 0 in job 010's. Those runs shared the Mac with other checks (load up to 18). The same 5 orders alone (`memory-calm/`): **0**. |
| ✅ | Rapid tapping, a tap every 2 s to 120 ms (`switch/memory.json`) | 69.6 MB highest; never two casts or two edges. |
| ✅ | Skip, own tab, back to the scene being painted, a failed room, reduced motion, pan, turn (`switch/states.json`) | As they should, Chrome and WebKit. The only console errors are the blocked room's own. |
| ✅ | Whole hunt (`hunt/`) | 50 of 50 with button and form: desktop, phone upright and on its side, Chrome and WebKit. |
| ✅ | Tests, type check, build | 289 pass. |

## 4. For Wren

1. **Film's opening downloads its room twice** (the live screen is cut from a second request, made before the first has ended). It did before as well. Job 011 has a fix: about 1.2 MB and 6 s on Slow 4G (9.97 s in its runs). I left it because it is bound up with "cast with the room".
2. **Set Design** still waits for all ten backdrop pieces and the stagehand (part 2): most of its 90 requests.
3. **I read "first sequence" as every drawing her routine can show**, because the routine picks at random. The clips (Grow and the casts) still join later, as today.

## 5. Not done

- No Chrome timings on the slowed lines (the job asked for WebKit), and no trace on Slow 4G.
- No real phone.
- The trace's wash is too noisy on this Mac to show a difference of a few frames either way.

## 6. Preview build

`wren-inbox/quinn/fable-jobs/011b-load-speed-opening/out/dist.tgz`, the final production build (its files are byte for byte those measured).

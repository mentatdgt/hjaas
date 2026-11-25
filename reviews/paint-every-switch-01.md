# Paint on every change of scene: build report 01

From: Fable. For: Wren and the user. 2026-11-25. Job 009. Branch: `site/review-fixes`; `main` was not touched.
Evidence: `site/qa/paint-switch/`. "Before" is `f37159e`, run beside this build.

**Result: built as briefed, all four points. Two things are not shown by these checks: a real iPhone, and the Claude app's viewer itself.** 285 tests, type check and build pass. No console errors, except the requests the failed-room test makes fail and my own frame logger in the sandboxed frame (it may not read the canvas there, so that log stops after the Café). The pixel test of round 4's rule flags 2 sector-frames now and then in Film on the phone, as the build before does (section 4).

```
cd ~/hjaas && git checkout site/review-fixes && git pull && cd site && npm install && npm run build && npm run preview
node qa/tools/paint-switch.mjs record|trace|states|repro     (she, memory: npm run dev)
```

## 1. The cause

WebKit iPhone profile, fresh storage, every frame logged (`repro-before.json`, `repro-after.json`). How long the picture was being painted over in the window (a full painting is about 3 s there, 0 means it popped in):

| What was done | Before | Now |
|---|---|---|
| Each tab tapped when the last painting is over | 3.2 s, then brush-overs of 0.8 to 0.9 s | 3.2 s, then 1.6 to 1.8 s |
| **(a)** Another scene's tab, 0.4 s before to 3.5 s into the opening | **Painted, 3.2 s** (the opening itself snapped to finished) | Painted; the opening is left as it stands |
| **The same tab tapped again while its scene is still loading** (a double tap, or after 1 s of nothing on a slow network) | **0: popped in, 4 of 4** (Film, Café and Set Design slow; Film double-tapped) | Painted, 2.8 to 3.2 s |
| Another tab while a scene is still loading, 400 ms apart | **0 for the scenes passed over**, which were then "seen" for good | Never shown; painted in full when next opened |
| **(b)** Later visit, every scene marked seen | Opening 200 ms fade, then 0.8 to 0.9 s | Full paintings |
| Cross-origin frame; sandboxed frame without storage; click instead of touch; 30 frames a second | Painted | Painted |
| `document.hidden` forced true after the opening | 0 | 0 (unchanged) |

- **The likely cause is a second tap while the scene loads.** On a slow network nothing on the page answers the first tap for 2.5 to 6 s, and the old rule was "any tap while a switch is under way finishes it". It made every new scene arrive filled in, and the first one was painted, as the user said.
- **Cause (a) as written does not happen:** the tap's click finished the opening before the address changed, so the switch then started afresh, with painting.
- **Cause (b) is real but does not fit alone:** with every scene seen, the opening would not have been painted either. It does explain returns that are too quick to read.
- `document.hidden` is false in a frame in WebKit, and the opening waits for it to be false, so a viewer that always reports the page hidden would not have shown the opening.
- I cannot say which of these the user's phone did.

## 2. What was built

1. **"Painted" lasts for one visit**, in memory (`visit.ts`). The saved `seen` is now read only to tell a newcomer (the drift). Finds and pan are saved as before.
2. **A return is a brush-over**: 2.4 s of brush, a 0.35 s wash that starts 0.1 s before the brush ends (as it did): 2.65 s.
3. **A tab tap mid-painting**: the painting goes on until the asked-for scene's files are here, then stops where it is. Before a full painting the half-painted picture fades off whole, sheet and all (160 ms). Before a brush-over it is what the copy shows. Nothing is seen finished. Only Skip, or the painted scene's own tab, finishes at once.
4. **Reduced motion** is unchanged.
5. `transition.ts`'s header is rewritten. Tests: 11 new (`visit.test.ts`, `transition.test.ts`), the pan test changed (below).

Readings I took:
- A scene left less than **1 s** into its first painting does not count as painted, so it gets the full painting next time. Left later, it counts.
- A second tap on a tab **while its scene loads, or in the first 0.4 s of its painting, does nothing** (a double tap).
- **A pan no longer finishes a brush-over**: the brush follows the room. The brief's "only" reads so, and at 2.4 s it would have happened often on a phone. Turning the phone still finishes it.
- Tapped back to the scene being painted, after asking for another: the painting simply goes on.
- If the asked-for room fails to load, the painting goes on and Retry is offered.

## 3. Recordings

`visit-*`, `taps-*`, `reload-*`: `-desktop-60fps.mp4` (Chrome, 1440×900) and `-iphone-60fps.mp4` (WebKit), each with its `-strip.jpg` (0, 0.5, 1, 2, 3 s). Reload: found mushrooms stay found, the opening paints again.

WebKit cannot be recorded at 60 fps, so its page is drawn at 60: its clock is moved on 1/60 s at a time, with a screenshot after each. Loading takes no time in those films, and they prove no frame rate. `taps-*` goes on to a brush-over left for another brush-over.

## 4. Checks

| | Check | Result |
|---|---|---|
| ✅ | "Room painted but she isn't": every frame, all 20 ways from scene to scene, full and brush-over, plus 9 left part way (`she.json`) | 0 of about 5,600 frames each on desktop, phone 4x slower and WebKit |
| ⚠️ | The same, round 4's pixel test, first paintings (`paint/paint.json`) | Whole of her and her outline: 0 in all ten. **Film, phone: 2 sector-frames** in one take. Three more takes of each build: 0, 0, 2 now and 0, 2, 0 before. |
| ✅ | Memory, 30 orders (`memory/`) | **78.4 MB highest, 78.1 in job 008** (in Grow, at work). Every reaction in full, no drawing skipped, no errors. |
| ✅ | Memory, 48 taps at 2, 1, 0.6, 0.3 and 0.12 s (`memory.json`) | **75.8 MB highest, 69.9 before.** More than before because a painting goes on while the next room is decoded (and it has sheets). At a cut the copy is made while the old sheets are still there, inside one task the log cannot see: 3 MB more at most. |
| ✅ | Never two scenes decoded at once | One cast and one edge at any frame, both builds. As before, the next scene's **room** (6.3 MB) is decoded while the old one is still up: 2 rooms, never 3. |
| ✅ | Trace, phone, 4x slower, 8 runs of each build in turn, 5 of them before the last small changes (`trace.json`), dropped of about 285 frames | Opening 0 in all. Full switches 0, but 1 twice (Film) and 2 once (Café); before: 0 in all. Brush-over 0 of 162 in all. |
| ⚠️ | The same, a painting left 2 s in, and the one after it | 2 to 5 dropped at the cut (before: 2 to 3), one task of about 42 ms either way; the next painting 5 in 3 of 8 runs (before: 4 in 2 of 8). |
| ✅ | Skip, own tab, back, slow and failed room, find and pan over a reload, pan and turn in a brush-over, reduced motion (`states.json`) | As the brief says, Chrome and WebKit. |
| ✅ | Whole hunt (`hunt*/`) | 50 of 50 with the button and the form: desktop, phone upright and on its side; Chrome without and with paintings, WebKit with. |

## 5. For Wren

1. **Nothing answers a tap until the scene is loaded** (2.5 to 6 s at 0.7 s a file): the underlined tab moves only when the scene goes in. A small "on its way" state on the tab would help most on a phone. Not built: not in the brief.
2. The fade, the blank page and the first stroke take about 0.5 s after a tap, as before.
3. A hidden page still finishes at once (nothing to watch). If it is the viewer after all, look there.
4. Two of my tools for earlier jobs were touched: `paint-in.mjs switch` asks for the reveal by `?intro=quick`, and `counter.mjs hunt` can run with paintings and in WebKit. `?intro=full` is now the default and does nothing.
5. `.DS_Store` and `.impeccable/` were untracked before I started; left alone.
6. The caption's delay at a cut opening was the last change (0.3 to 0.5 s); `states` and `repro` ran just before it. The `taps` and `reload` films are on the final build.

## 6. Preview build

`wren-inbox/quinn/fable-jobs/009-paint-every-switch/out/dist.tgz`, the final production build.

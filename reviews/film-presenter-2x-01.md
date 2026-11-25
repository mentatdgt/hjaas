# The Film presenter at double size, and his gestures' in-betweens: build report 01

From: Fable. For: Wren and the user. 2026-11-25. Job 007. Branch: `site/review-fixes`; `main` was not touched.
Evidence: `site/qa/film-2x/`. "Before" is `fc7884c`, run beside this build.

**Result: built as briefed, with two points that don't meet the job's wording:** three of the six arm steps move more than 30 px (section 4), and a gesture takes 20 ms longer each way than before (section 4). 267 tests, type check and build pass; no console errors in any run.

```
cd ~/hjaas && git checkout site/review-fixes && git pull && cd site && npm install && npm run dev
node qa/tools/film-2x.mjs stills|seam|record|memory|steps|trace
```

## 1. Per-layer scale

`frames.json`: the 16 stills and the two in-betweens point at `presenter2x/`, the layer has `"scale": 2`, its box is as it was. `presenter/` stays in the package; the page has no file from it.

| | Check | Result (`stills.json`, `*-M_*.png`, `*-face.png`) |
|---|---|---|
| ✅ | His canvas | 390×844 (3x): 543×1032, was 320×608. 1440×900 (2x): 398×756, was 320×608. 1440×900 (1x): 199×378, as before. 2560×1440 (2x): 640×1216. |
| ✅ | Sharper, 1:1 | Edge contrast (squared steps between neighbouring px) 4.1 to 4.2 times before on the phone in Chrome, 2.8 in WebKit; 2.7 on desktop 2x. The inner lines are visibly finer. **The outer outline is hardly thinner**: dark px in his box change by +1% (M_1), -7% (M_2), 0% (M_3). |
| ✅ | Same place | Best match at a shift of 0, 0 device px in every still, size and browser. The overlay (third picture in each) shows only the redrawn lines. |
| ✅ | Desktop at 1x | WebKit shrank the 2x drawing (to under half) with jagged hair. Such a layer is now halved first, then shrunk; the jaggedness is gone (`webkit-1440x900-1x-face.jpg`). |

**My reading of "min(devicePixelRatio, s) times the box":** his canvas has the screen pixels it covers, at most 2 × his box. Taken literally it would be 640 px wide on a phone that shows 543 (then shrunk again), and 1x on an ordinary large desktop screen.

## 2. Memory

`M_1` is whole; the other 17 are patches cut to where they differ from it (8 px margin, on an 8 px grid).

| | Check | Result |
|---|---|---|
| ✅ | Film's share, phone, opened first (`memory.json`) | 29.7 MB before, 34.6 now: **+4.9 at rest, +5.4 at the most** (limit 12). Decoded stills of the whole cast +3.4; canvases +1.5. Desktop 1x +4.2, 2x +4.1 at most. No 1.5x copy was needed. |
| ✅ | 30 visiting orders | **77.8 MB highest, 77.8 before**; every reaction in full, no skipped frame, no errors (`memory/`, `memory-before/`). Film opened first: 37.8 to 38.4 MB returning (32.9), 42.6 to 43.2 new (37.7). The six orders that open with Film were run again on the final build. |
| | Download | His files are 0.73 MB (0.54 before), at quality 99 instead of 93: where a patch ends it then differs 0.9 levels from the base, not 1.6. Lossless would be 1.9 MB. |

## 3. Seams, the camera screen, what must not change

| | Check | Result |
|---|---|---|
| ✅ | Every still on his real canvas, 7 windows, Chrome and WebKit (`seam.json`) | Where the drawing does not move, his canvas differs from `M_1`'s by 0.24 levels of 255 on average, **10 at most**; none over 16. |
| ✅ | 60 fps recordings, 28 s each (`talking-*.mp4`, `record.json`) | In the part of him that never moves, no recorded frame differs from the last by more than 12 levels on one px (phone), 16 (desktop): the recorder's JPEG. `talking-phone-3x-60fps.mp4` is a real 3x window, 500 px wide (Chrome opens none narrower), so you can see his mouth and blinks px for px. The phone-profile one (390×844) records in CSS px. |
| ✅ | Camera screen | Live, same frame: 288 of 288 pose changes under it in Chrome, 293 of 293 in WebKit; no flicker; the same place as before (`scene4/`, `camera-screen-*.mp4`). |
| ✅ | Routine, blinks | Two browsers, 60 s each: order, holds, blinks right; never a blink on an in-between (`scene4/presenter.json`). |
| ✅ | Every actor where the package puts it; hunt boxes; `focusX` 977 | `scene4/preview.json`; the boxes are identical. His drawing's own extent shrank by 1 px a side, so the painting's edge keeps clear of 1 px less (`film-cast.json`). |
| ⚠️ | "Room painted but she isn't" | 0 in 4 calm takes of Film in Chrome (desktop and phone), and in one earlier take in Chrome and in WebKit. One further phone take, with the Mac busy with three other runs, read 2 (one sector of her outline, 33 ms). **The old build also reads 2 in one of 4 calm takes**, so I judge it not new; both are kept in `paint/`. The whole of her: 0 in every take. Skip, Replay, slow network and reduced motion are as they were (`paint/states.json`). |
| ✅ | Throttled phone (4x), headed Chrome, 5 runs each in turn (`trace.json`, two traces) | Painting: 0 dropped frames, longest task 3.6 ms (4.9 before). 30 s of him at work, both gestures: 0 dropped, longest task 25 ms (22), 13.0 ms busy a second (12.2). On the blank paper before the first stroke: 9 dropped in 5 runs (7); the first stroke is at 963 ms after the tap (950). |
| | Found on the way | My first version warmed all 17 patches in one 24 ms task and dropped more frames there (15 in 6 runs, 6 before). They are now warmed one at a time. |
| ✅ | Whole hunt | 50 of 50 with Next, reload, button and form: desktop, phone upright and on its side, Chrome and WebKit (`hunt/`). |

## 4. The in-betweens

Wired as asked, 60 ms each, in reverse on the way back; never blinked on. Measured: 48 to 70 ms each (3 or 4 frames of a 60 Hz screen).

**"Keeping the gesture's total time" and "60 ms, 60 ms" don't agree:** the old in-between was 100 ms, the two are 120. I used your numbers. 50 + 50 would keep 100, and is three even frames each on a 60 Hz screen.

How far the arms move at each step, in plate px, landmarks read off the drawings by eye (a few px either way; `steps.json`):

| | M_1 → M_1_12 | M_1_12 → M_12 | M_12 → M_2 |
|---|---|---|---|
| Left hand / its fingertip | 9 / 17 | 20 / 19 | **44 / 48** |
| Left elbow | 3 | 10 | **76** |
| Right hand / its wristband | 29 / 32 | **64** / 10 | 33 / 26 |

| | M_1 → M_1_13 | M_1_13 → M_13 | M_13 → M_3 |
|---|---|---|---|
| Left hand / elbow | 18 / 6 | **57** / 11 | 26 / 5 |
| Right hand / its wristband | 32 / 26 | **47** / 23 | **37** / 18 |

The gestures do start smoothly now (about 30 or less). The steps after that are still long: the arm flipping up at M_12 → M_2, and the hands from M_1_12 and M_1_13. Strips: `phone-3x-gesture-*.jpg`.

## 5. Preview build

`wren-inbox/quinn/fable-jobs/007-film-presenter-2x/out/dist.tgz`, the final production build (34 MB).

## 6. For Wren

1. **Art at 2x that shows** (`art-notes-4x.png`): a dotted white line and loose black bits between the sleeve and the hand in `M_1_12` and `M_1_13`; bright blue, with a cyan dot, in the hair beside his right temple (all stills), also seen on the phone; smaller blue specks at his ear and neck.
2. **His wristband** is plain red in `M_1` and a watch with a black face in the other poses, so the face appears as a gesture starts.
3. **His mouth opens** during an in-between whatever he was saying (they are drawn open). As before, but there are two now.
4. As a phone opens Film, his pointing hand is outside the picture on the left (the framing is unchanged).
5. The next in-betweens that would help most: M_12 → M_2, then M_1_12 → M_12 (right hand) and M_1_13 → M_13.

## 7. Not done, and readings I took

- No real phone. The 4x trace was run on this Mac's Chrome.
- The 30 orders were run before the warming change (it only moves when patches are first drawn). The six orders that open with Film were run again after it.
- The trace enters Film from Build by its tab (first visit, full painting), then 30 s of his routine, which holds both gestures; production builds have no pose log to cut them out by.
- A layer with `scale` may hold stills only: `npm run assets` stops with a message on clips, dissolves or a sprite track in one.
- `qa/tools/art-check.mjs` (job 006) compares whole stills and does not know the patches; `film-2x.mjs seam` takes its place for him.
- `.DS_Store` and `.impeccable/` were untracked before I started; left alone.

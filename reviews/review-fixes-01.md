# Quinn's code and security fixes in browsers: build report 01

From: Fable. For: Wren and the user. 2026-11-25. Job 005; Quinn's review: `reviews/quinn-site-review-030.md` (on `main`); patches: job 031.
Branch: `site/review-fixes`, made from `origin/site/counter` (`3288e10`). All 11 patches went on in order with `git am`
(author Quinn, kept). `main` was not touched. No tracked file was changed in the working tree before I started.

**Result: the fixes work, but not all as delivered.** The browsers showed seven faults in the patched build. All seven are
fixed here, in seven commits of mine (section 2). 258 tests pass (Quinn's 256, two new, one of Quinn's rewritten); type check and build are clean.

**To see it**

```
cd ~/hjaas && git checkout site/review-fixes && git pull && cd site && npm install && npm run dev
node qa/tools/review-fixes.mjs <check> [chrome|webkit]     # npm run build && npm run preview first; the list is at the top of the file
```

Evidence is in `site/qa/review-fixes/`. "Before" is `site/counter`'s build, run beside this one.

## 1. The checks

| | Check | Result | Evidence |
|---|---|---|---|
| ✅ | The whole hunt | 50 of 50, Next from scene to scene, reload, button, form: desktop, upright, on its side; Chrome and WebKit. | `hunt.json` |
| ✅ | No visible change | The finished picture and counters, 5 scenes × 3 devices × 2 browsers, with 17 and with 50 found: 60 pictures, **0 pixels** differ from before. | `same.json` |
| ✅ | Paint-in, five scenes | "Room painted but she isn't": 0 frames, desktop and phone. Chrome at 60 fps, as in round 4. WebKit from screenshots (76 to 92 a painting, about every 40 to 85 ms, so it could miss a single frame). | `paint/paint.json`, `paint-webkit.json` |
| ✅ | Switches, return visit, Skip, Replay | As in round 4. | `paint/switch.json`, `paint/states.json` |
| ✅ | Find, scene complete, unlock | 16 recordings on the production build; reduced motion among them. Timings within a frame or two of round 2's. Gaps: none over 34 ms, but for the ends of the glints, after the light has left the cap (50 to 100 ms; 50 to 83 in round 2). | `counter/*-60fps.mp4`, `timing.json`, `record.json` |
| ✅ | Counter states, phones | 13 hunts × 5 scenes, return visits, hint, drift: 0 problems. Five screen sizes: 0 problems. | `counter/states.json`, `phone.json` |
| ✅ | **C1** one sprite | Room shows, 10 of 10 found (after a fix). All nine lost: Retry room, and it recovers. | `c1.json`, `c1-sheet.jpg` |
| ✅ | **C1** one cast frame | In each of the five scenes: the room without her, 10 of 10 found, and she is there on coming back. | `c1.json` |
| ✅ | **C1** a room | At the opening: Retry room, again if still blocked, then it recovers; another tab works meanwhile. On a switch: the old room stays and its hunt goes on. A room that never answers: Retry after 60 s, and it recovers (after a fix). | `c1.json`, `c1-stalled.json`, `c1-phone.jpg` |
| ✅ | **C1** slow network | Opens at 1600, 1000, 700 and 400 kbit/s, with her, at the same moment as before (after a fix). | `slow.json` |
| ✅ | **C2** two tabs | Finds in each: all kept, and seen in the other at once. A stale tab's pan: 50 stored and the button kept in both. A pan survives an immediate reload. Before: a find lost, 49 stored, no button. | `c2.json` |
| ✅ | **C3** hidden mushrooms | Taps, scripted clicks and focus during eight switches and the return reveal: 0 collected, none took focus, and a tap works once clear. Before: 90 collected. A pan ends the short brush at once. | `c3.json` |
| ✅ | **C4** rotation | Right and left edges, two phones: the crop is where it was, also after a reload (WebKit after a fix). | `c4.json` |
| ✅ | **C8** fragments | 18, as the address and as a change of it: the right room, the matching preload, no errors. | `c8.json` |
| ✅ | **C5** reduced motion, live | In the painting, a switch, a flight, the tenth, the fiftieth and its ceremony: settled within one frame, counted once, landed once (after a fix). Motion back on: she works again. | `c5.json` |
| ✅ | **C5** tab hidden | Painting and flight finish; counted once. A painting not yet begun waits to be seen (after a fix). | `c5.json` |
| ✅ | **C6** memory | 30 orders: highest 77.8 MB (77.8 before), no skipped reactions, no errors. A scene left behind keeps one frame at most (Build 2.4 MB, Grow 3.0, Film 0.4), as before; also when left while its reaction loads. I could not make the old build hold more there, so that leak itself is proven only by Quinn's unit test. | `memory/`, `c6.json` |
| ✅ | **C7** network | After the opening: only the next unfinished scene's `room.webp`, at Low (Chrome). Nothing on hover or focus; nothing with 50 found. Before: all four other rooms and their edges, at High. WebKit does not report priority. | `c7.json` |
| ✅ | **S3** policy | 0 violations, 0 console errors, 0 failed requests in Chrome and WebKit through paintings, finds, switches, Replay, reload, unlock, form and reduced motion. Control: inline script, style attribute, `data:` image, cross-origin fetch, blob worker and framing are all stopped and seen. | `s3.json` |
| ✅ | **S4** hosts | `dev` and `preview`: 127.0.0.1 only, refused from the network. `dev:lan`, `preview:lan`: open. MCP launchers pinned. | `s4.txt` |
| ✅ | **S1** form | Typing stops at 100 and 4000; over-long name, email, message and choices put in by script are refused with no request; exact limits (100, 254, 4000) are sent. A 500 keeps the draft. No answer: gives up at 15.1 s, closes the connection, ignores a late answer. Closing cancels. | `s1.json` |
| ✅ | Trace, 4× | No worse (section 3). | `counter/trace.json`, `trace-before.json` |

**How S3 was served.** `run.s3` in `qa/tools/review-fixes.mjs`: a static server on 127.0.0.1 that reads `dist/_headers`
(Netlify / Cloudflare Pages format) and puts its headers on every response. As served, on every path:

```
content-security-policy: default-src 'none'; base-uri 'none'; object-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self'; style-src-attr 'none'; img-src 'self' blob:; font-src 'self'; worker-src 'self'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'
x-content-type-options: nosniff
referrer-policy: strict-origin-when-cross-origin
permissions-policy: accelerometer=(), autoplay=(), bluetooth=(), camera=(), display-capture=(), fullscreen=(), geolocation=(), gyroscope=(), hid=(), magnetometer=(), microphone=(), midi=(), payment=(), serial=(), usb=()
```

The real host's responses still have to be checked. With an endpoint set, its origin is added to `connect-src` and the form got through (`s1.json`).

## 2. What failed and was fixed

| Fix | What the browsers showed | Commit |
|---|---|---|
| C1 | **On a slow phone the site no longer opened.** The 8 s limit gave up on the room twice below about 1.2 Mbit/s (seen at 1000, 700 and 400 kbit/s), and on Rachel. Before, it opened late (20 to 48 s). Now a minute, without a second long wait. | `10da33d` |
| C1 | One sprite lost took the whole room with it. Another of the scene's own drawings stands in, so all ten can be found. | `76c1455` |
| C1 | Retry did not recover from a room that never answers: it was given the same stalled request, kept open by the preload. WebKit also waited twice. | `f81879b` |
| C5 | Opened in a background tab, or left while it loaded, a first visit was counted as painted without ever being painted. | `dcbe053` |
| C5 | In Chrome, Set Design did not notice reduced motion going on. The likely reason: its walk reads the setting every frame, and Chrome then sends no event. Film's live screen reads it the same way; it was not tested before the fix. | `cc02dcf` |
| C5 | Cancelling a glint forced a style pass as the page loads (Chrome), which began an invisible transition on Next. | `e5b4adc` |
| C4 | In WebKit a rotation was still saved as a pan. | `ac96717` |

`cc02dcf` also removes an `export {}` that stopped the decoder worker on the dev server (never in the built site).
Nothing in the counter's design or the art was changed.

## 3. Frame times

Phone profile, 4× slower, production build, headed Chrome, in turn with `site/counter`. Dropped frames at the tap, per run. The
first six favoured the old build for a find, so I ran six more with the order reversed:

| | First six | Sum | Six more | Sum | Round 2 |
|---|---|---|---|---|---|
| A find, **now** | 4, 2, 4, 4, 2, 5 | 21 | 0, 3, 3, 1, 4, 1 | 12 | 3, 1, 3, 4, 5, 5 (21) |
| A find, before | 1, 1, 5, 1, 1, 5 | 14 | 4, 1, 1, 4, 5, 1 | 16 | |
| The fiftieth, **now** | 2, 1, 1, 3, 4, 1 | 12 | 5, 1, 1, 5, 5, 1 | 18 | 4, 3, 1, 7, 6, 5 (26) |
| The fiftieth, before | 2, 0, 6, 3, 4, 5 | 20 | 1, 3, 1, 1, 6, 2 | 14 | |

- All 24 runs each: 63 now, 64 before. Not told apart. Longest task at a tap: 76 and 81 ms now (find, fiftieth); 73 and 93 before; 73 and 102 in round 2.
- In the flight: none now; one in one run before. First two frames of a landing: a find 1 in two runs of twelve (before: 6 in four); the fiftieth 1 in two of twelve (before: 1 in one).
- **Later:** one frame about 2014 ms after the fiftieth's landing (the cross-fade's start) in two of twelve runs, and in one of twelve before. Round 2 had none there.
- **The painting**, 4×, three runs each of Build and Set Design: 0 dropped, in both builds. WebKit: longest frame 19 to 28 ms (before: 20 to 40).
- **WebKit**, a find, a tenth and the fiftieth, two runs: at the tap 19 to 42 ms (before 18 to 36); from the flight on 19 to 27 (before 19 to 30).

## 4. For Wren

1. **A failed opening is blank paper** with "Retry room" small at the foot (`c1-sheet.jpg`, `c1-phone.jpg`; under the counters on a phone, 10 px
   more page at 390×844). No logo either. Nothing says what happened. Copy and place are yours.
2. **The minute.** A room that never answers leaves blank paper for 60 s before Retry. It cannot be much shorter without
   shutting out slow phones: at 400 kbit/s the opening takes 48 s. A "still loading" line would help both.
3. **Leaving the tab in the middle of a painting finishes it** (Quinn's choice): a phone visitor who looks away comes back to the finished room and has to press Replay. The same for a first-visit switch, even before its first stroke.
4. **The slow-network opening itself** is 12.6 s at 1.6 Mbit/s, before and now: 1.25 MB of room, then her frames.
5. Finds are saved under new keys (`hjaas:site:v3:…`); the old record is read and left alone. Going back to the old build would not show finds made since.

## 5. What was not done, and readings I took

- **No real phone, no deployed host, no assistive technology.** Rotation is the browser's emulation; in Chrome the pan is a synthesized swipe, in WebKit the scroll position was set.
- "Block one sprite … the hunt still works" I read as: blocked for good, all ten still findable. That needed the stand-in.
- The tab-hidden checks set `document.hidden` by script: Playwright does not hide tabs.
- The memory orders, the pictures of five phones, `timing` and `states` run on the dev server (they need `window.__hj`), like round 2. The memory run was at `cc02dcf` (before the last two commits, which touch the glint and the room's retry).
  The frame times and recordings are at `e5b4adc`; `f81879b` only changes what happens after a stalled room. Every check in `review-fixes.mjs` but `slow` and `c6` (run before the last two commits) was run again on the final build.
- The older QA tools were not run again, but for `counter`, `paint-in` and `scene5 memory` (`HJ_OUT` sends their results elsewhere). `scene2.mjs` was changed to read the new keys and not run.
- `.DS_Store` and `.impeccable/` were untracked before I started; left alone.

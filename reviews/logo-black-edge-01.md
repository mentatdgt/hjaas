# The black border after the logo tap: build report 01

From: Fable. For: Wren and the user. 2026-11-26. Job 018. Branch `site/review-fixes`, code `5931708` and `8f86747`; `main` and `deploy` were not touched.
Brief: `reviews/logo-black-edge-build.md`. Tool: `site/qa/tools/logo-black-edge.mjs`. Evidence: `site/qa/logo-black-edge/`.

**Done. Reproduced, the cause proven, fixed.** Two limits: no real iPad was used, and Microsoft Edge is not on this Mac (Chrome, the same engine, was tested).

## The cause (not canvas memory)
- **WebKit runs the site's script before its stylesheet when the stylesheet comes a little later.** Chrome and Firefox wait for it. `site.ts` read the paper's colour once, from the page's background, as it mounted. With no stylesheet that is `rgba(0, 0, 0, 0)`, which it took as black: the edge was drawn correctly, in black paper.
- **Reproduced** in Playwright's WebKit. Stylesheet 40 ms late: black after every tap, on every iPad size, both user agents, and the phone (`ipad-crios-5-taps-before.jpg` matches the user's photo, pale pencil lines in the black included). With only random delays of 0 to 20, 60 and 150 ms on every file: 8, 9 and 14 of 20 reloads black, and 1, 4 and 5 of 10 first visits. Chrome and Firefox: never.
- **Why the logo tap:** a link to the page itself makes WebKit ask for the page, script and stylesheet again. On that reload both files answer 304 and it is a race. On a first visit the script is the larger file and usually comes second.
- Job 016 could not reproduce it because its server answered at once. A canvas that gets no memory would be a straight rectangle; the photo's border has its feather. No memory message was ever in the console.
- Why the user's Safari escaped and Chrome did not: not proven. User agent makes no difference here, so it is most likely timing.

**The two bugs do not share a cause.** In the old build every box (window, plate, room, edge strips) is identical with the stylesheet on time and late, at 1180x820, 1133x677 and 1180x690, so a late stylesheet cannot bring the side lines. Why they came after a tap in Safari is still not explained; a tap no longer reloads, so nothing is rebuilt then.

## What changed
- **`paper.ts` (new):** nothing is mounted until every linked stylesheet is here, has failed, or the document has loaded. A see-through or unreadable background is never taken for the paper.
- **Logo:** on the home page a plain tap or Enter does what Build's tab does, with no load. Still a real `<a href="./">`; new-tab clicks are left alone.
- **Page left (`pagehide`):** every canvas is set to 0x0, and back on `pageshow`. Sheets taken off the page now also give their pixels back at once (they used to wait to be collected: 4 to 5 MB).
- **Safety net (`edge.ts`):** each strip is checked after drawing (one pixel, through a small canvas) and again when the tab comes back to the front; `contextlost` and `contextrestored` are followed. Once more if it failed, then a plain CSS fade in the paper's colour (`net-plain-fade.jpg`). A browser that hides its canvases' true pixels is trusted, not masked.
- **Reading taken:** a page left in the middle of a change of scene (about a second), or before its opening painting began, is loaded afresh at the same address when it is come back to. Finds are kept. Carrying on is not safe: Firefox drops messages as it freezes a page.

## Checks (before = `7ddd9fa`, after = `8f86747`)
| Check | Result |
|---|---|
| Logo 1 and 5 taps, back, forward, another page and back; all 50 and fresh; WebKit iPad 1180x820 and 1366x1024 (CriOS, Safari), WebKit 390x844, Chrome, Firefox; stylesheet 40 ms late | Border px off paper. Before: **all of them** in every WebKit case after 1 and 5 taps, 0 in Chrome and Firefox. After: **0 everywhere** (`taps-css40-*.json`, `sheet-before.jpg`, `sheet-after.jpg`) |
| The same, stylesheet on time | After: 0 (run on `5931708` only) |
| Stylesheet late by 0 to 600 ms, first visit and reload | Before: WebKit black in 5 of 7. After: 0 of 7 (`race-*.json`) |
| Random delays, WebKit, 60 reloads and 30 first visits | Before 31 and 10 black. After 0 and 0 (`jitter-*.json`) |
| Page loads from 5 taps | Before 5. After 0 |
| Canvas memory over 5 taps (every canvas, attached or not) | After: the same to the byte at 0, 1 and 5 taps: 3.99 MB (1180x820), 4.47 (1366x1024), 5.06 (phone), 3.12 (desktop). Before, at 0 taps: 8.8, 9.3, 9.9 and 5.6 to 10 |
| `pagehide` | 0 bytes: Build, Grow, Film and Set, in mid-painting and mid-switch, three browsers |
| Back from the browser's own cache | Chrome and Firefox: 0 while away, all drawn again. Playwright's WebKit has no such cache: events by hand there |
| Logo from Grow, Enter from Set, back, held Cmd, five quick taps | As the tab; a new tab for Cmd; clean. Middle button: new tab in Chrome and Firefox; Playwright's WebKit navigates instead (the reviewer saw the same before) |
| Edge canvases: no context, black, throwing, lost later, failing once | Never black, three browsers, also after a change of scene and back (`net-after.json`) |
| Edge's look | Its pixels are identical in all five scenes, WebKit and Chrome (`edge-pixels.txt`) |
| Cost | The check reads take 4 to 13 ms a scene in all, before anything shows. Frame times were not measured |
| First visit's painting, stylesheet on time and 600 ms late | Plays in all three, the same coverage as before |
| Hunt | 50 of 50 by taps at six sizes (`hunt.json`) |
| Tests, types, build | 410 of 410 (17 new), clean, builds |
| Console | Nothing new from the site. Chrome's "multiple readback" warning and Firefox's "operation is insecure" come from the test script |

"Another page and back" shows a higher sum in WebKit and Chrome: there the page loads afresh, and it was measured before the painting's sheet is taken off (2.5 s).

## Independent reviewer
It had not seen the work and wrote its own scripts. **First verdict, `5931708`: FAIL** on one regression of mine: in Firefox, leaving in mid-switch and coming back could leave the painting hidden for good. It also found 10 to 19 frames without the edge on overlapping returns (leaving again within 80 ms), and canvases not at 0 when left in mid-switch. **Second verdict, `8f86747`: PASS with notes.** 0 of 16 stuck in Firefox, 0 frames without the edge in 18 runs, 0 dark border samples anywhere, 410 tests pass. It finds the reload on return acceptable. Its notes:
1. WebKit, events by hand: back from Set to Build and left again at once, 2.46 MB (her canvas) appears while away. Not traced; the picture recovers.
2. Chrome, all four strips failed: a faint hairline at the painting's rectangle in the plain fade. Not changed.
3. Not tested: a real iPad, WebKit's own cache.

## For Wren
1. **Please have the user try the preview on the iPad**, Chrome and Safari: reload several times (a reload is the old trigger now that the tap does not load), then the logo.
2. The first logo tap adds `#build` to the address, as the tab does.
3. A logo tap while Build is being painted finishes the painting, as its tab does.

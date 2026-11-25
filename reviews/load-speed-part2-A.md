# Load speed part 2, A (job 019): build report 01 — NOT DONE (checks not run)

Branch `site/review-fixes`, code commit `3dffd05`. `main` and `deploy` untouched.

## Built (Part A)
1. **Cast with the room:** a switch now asks for the new scene's cast manifests and rest-pose drawings in the same moment as its room (`Casting` in `scene.ts`, kept per scene in `site.ts`). If another scene is tapped first, its cast download is called off (and asked for afresh if it is wanted again). Nothing is decoded before the scene goes on the plate, as before. Set Design's pieces and stagehand files are now fetched alongside the stills instead of after them (no other Part B change).
2. **Film's room downloaded twice — cause and fix:** the camera screen's copy of the room was cut from a second `fetch()` of `room.webp`. WebKit never shares an `<img>`/preload request with `fetch()`, so it downloaded the whole 1.2 MB again (Chrome only revalidated it, 304). Now the screen is cut from the browser's cache only (`cache: 'only-if-cached'`), and where there is none (a private window) from the `<img>` itself (`cutFrom` in `assets.ts`).

## Checks run
| | Check | Result |
|---|---|---|
| ✅ | Tests, type check, build | 413 pass (3 new: cast asked with the room, cancel/restart, screen never re-downloaded) |
| ✅ | Network, Film opening, Slow 4G | WebKit normal and private: room.webp **2 → 1** full downloads, 3,680 → 2,446 kB. Chrome: 1 download, its 304 revalidation gone. One expected console message in WebKit private ("resource unavailable", the cache miss before the fallback). `site/qa/load-speed-2a/network-*.json` if present. |
| ❌ | Timings, trace, memory (30 orders, rapid taps), hunt 50/50, reviewer subagent | **Not run.** The Mac went to load average 86 (other work) and my check runs timed out; the job's 3 hours ran out. |

## For Wren
- Run before merging: `HJ_OUT=../load-speed-2a/ HJ_OLD_DIST=<build of 7382186> HJ_DIST=dist node qa/tools/load-speed.mjs timings webkit 3` (now includes a cold switch to Film), `node qa/tools/load-speed-2a.mjs network|screen|tapaway`, the memory runs and the hunt.
- The preview tarball below is the build of this commit.

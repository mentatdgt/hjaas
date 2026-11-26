# Art rebuild 01 (job 021): the site's images rebuilt from the cleaned art

Branch `site/review-fixes`, on top of jobs 015–020.

## What was done
1. Brought the 21 PNGs cleaned in `c10c0f1` on `origin/main` into the branch by path (all 18 `frames/020-film-scene/site/presenter2x/*.png`, `frames/016-upscale/approved/frame_01_02.png`, `frame_02_03ab.png`, `frames/005-reaction-motion/approved/rx_K1_B36.png`), plus the artist's sheet `reviews/assets/art-cleanup-before-after.png`.
2. Ran `npm run assets` in `site/` (444 images, 32.78 MB).

## Asset files that changed (9)
Scene 1 (both resolutions):
- `site/public/assets/scene1/rachel/frame_01_02.webp`
- `site/public/assets/scene1/rachel-1.5x/frame_01_02.webp`
- `site/public/assets/scene1/rachel/frame_02_03ab.webp`
- `site/public/assets/scene1/rachel-1.5x/frame_02_03ab.webp`
- `site/public/assets/scene1/rachel/reaction/rx_K1_B36.webp`
- `site/public/assets/scene1/rachel-1.5x/reaction/rx_K1_B36.webp`

Scene 4 (presenter):
- `site/public/assets/scene4/cast/presenter2x/M_1.webp`
- `site/public/assets/scene4/cast/presenter2x/M_1_12.webp`
- `site/public/assets/scene4/cast/presenter2x/M_1_13.webp`

Nothing else under `site/public/assets/` changed. `frames.json`, `routine.json`, `src/scenes/*-cast.json` and `build-patches.json` are unchanged, so the patch rectangles stayed where they were.

**Why only 3 of the 18 presenter stills changed.** The build keeps `M_1` whole and cuts each of the other 17 stills to the rectangle where it differs from `M_1`: mouth, eyes, and the sleeve for `M_1_12` and `M_1_13`. The hair speck (x405–411, y126–135 on the still) is outside every one of those rectangles, so on the page the hair always comes from `M_1`. The other 15 patches came out byte-identical. That is expected, not a missed rebuild.

## Independent review (subagent)
The reviewer compared every changed WebP against a copy of the assets taken before the rebuild. It decoded the pixels, diffed them, and saved before/after/diff crops at 4x (on light and dark grounds) in `reviews/assets/art-rebuild-01/`.

| File | Changed spot (patch px, diff > 8) | Outside it: px > 2 / > 8, max | Verdict |
|---|---|---|---|
| rachel/frame_01_02 | x297–298 y24–26 | 450 / 0, max 5 | PASS: stray dot gone |
| rachel-1.5x/frame_01_02 | x232–233 y18–20 | 554 / 0, max 5 | PASS |
| rachel/frame_02_03ab | x181–210 y301–316 | 112 / 0, max 4 | PASS: strap outline one clean line |
| rachel-1.5x/frame_02_03ab | x134–156 y236–248 | 853 / 0, max 7 | PASS |
| rachel/reaction/rx_K1_B36 | x100–148 y220–234, x111–150 y251–263 | 152 / 0, max 4 | PASS: handle edges smooth, no halo |
| rachel-1.5x/reaction/rx_K1_B36 | x75–109 y167–177, x83–113 y190–199 | 333 / 0, max 6 | PASS |
| presenter2x/M_1 | x404–412 y126–135 | 980 / 0, max 5 | PASS: cyan speck now hair blue, alpha intact |
| presenter2x/M_1_12 | x459–476 y132–155 | 131 / 0, max 4 | PASS: dotted line and black tab gone |
| presenter2x/M_1_13 | x443–454 y88–114, x449–453 y130–136 | 265 / 0, max 5 | PASS: dotted lines and black nub gone |

- Sizes are identical before and after for all 9 files.
- The changed spots match the edits in the source PNGs to within a pixel or two.
- Outside the fixes no pixel moved by more than 7 levels (mean 0.01–0.19). That is WebP re-encoding noise.
- The two scene 1 resolutions put the same fix in the same place on the frame.

**Verdict: PASS.** Every intended defect is gone, the fixes added nothing, and nothing else changed. I opened the M_1 and M_1_13 crops myself and they agree.

### Found along the way (older, not caused by this rebuild)
Single magenta/purple pixels sit along some outlines:
- M_1's hair edge
- the M_1_12 and M_1_13 sleeve outlines (clearest on dark)
- the claw outline in frame_01_02
- the top of the rx_K1_B36 handle

They are the same before and after and come from the source PNGs (139 of them in `M_1.png`). They're visible in the crops. They need a separate artist pass if they matter at display size.

## Checks
- `npm test`: 28 files, 420 tests, all passed.
- `npm run build` (tsc + vite): built clean.
- Preview build: `wren-inbox/quinn/fable-jobs/021-art-rebuild/out/dist.tgz`.

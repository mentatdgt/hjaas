# HJaaS: scene recipe

How a new scene goes from idea to live. Proven on scene 2 (lab, task 017), in use for scene 3 (café, task 018). **Last updated: 2026-11-20.**

## 0. Decide (user + Wren)
Pick the scene, then record these in `BIBLE.md` §3: outfit, hair, the loop (two stages works well), the reaction, and any supporting cast.

## 1. Stage it (Quinn)
1. Quinn draws **3 staging mock-ups** on the scene backdrop. The user picks one.
2. Fix rounds on that mock-up until the user is happy: positions, scale, gazes, props, light. **Get this right first**: every later image is an edit of it.
3. Wren writes the task (`tasks/NNN-name.md`) from `_TEMPLATE.md`.

## 2. Pieces (Quinn, one task, in order)
All at **the exact size of the approved scene** (no resizing; Wren normalises to the site ratio at packaging), each an **edit** of the previous image, so everything stays registered.
1. **`NNN_scene.png`:** the final approved scene. Stop for the user's approval.
2. **`NNN_plate.png`:** the same scene with every moving character removed and the background filled in. Still characters stay.
3. **Green anchors:** one per moving character, everything else flat `#00FF00`. A character hidden behind furniture is cut along that edge.
4. **Poses:** edits of each anchor. Base pose, a small in-loop change, a blink, the second stage of the loop, the reaction. For the cast: 2–4 small loop poses each.
5. A contact sheet and an honest self-check (max 3 attempts per image).

**Rule (2026-11-21): never cut a character out by comparing the scene with the plate.** Wherever she matches what's behind her (navy on a blue sky, brown boots on a ladder, paint-tipped bristles) she turns see-through. Every character's outline comes from a green-screen cut-out of each pose (Quinn job, masks not regeneration), and every still passes `tools/theatre_qa.py`-style checks (full opacity inside the cut, nothing outside it, legs and face unchanged where they should be) and a 1:1 look at every distinct pose in the preview before the user sees anything.

**Rule (2026-11-21): a generated pose is never used whole.** Wren builds every pose as the approved base plus only the moving part, colour-matched (`tools/cafe_build5.py`). Ask Quinn for crops of one character through the Quinn loop (`QUINN-LOOP.md`).

## 3. QC (Wren)
User drops the files into `wren-inbox` (or attaches a zip) and says **"QC NNN"**. Wren keys the green, overlays each piece on the scene to check registration, and checks identity, hands, outfit and style. Pass → `frames/NNN/approved/`; fail → numbered "Round N" notes in the task.

## 4. In-betweens (Wren, Higgsfield, after a quote)
- Kling 3.0 std, 3 s, **4.5 credits** per clip, between key poses (e.g. base → stage 2, base → reaction). Upscale is 2 credits if needed.
- Inputs are imported from `raw.githubusercontent.com` (repo is public). The user downloads the results into `wren-inbox` (the proxy blocks the download domain).
- Processing: key out, register on a stable region, colour-fit **once per clip** on pixels with diff < 25, keep only clean frames (drop smears), composite only the moving zones.

**Lesson from the café (2026-11-20): AI video only suits the softer, painterly characters (it worked for the lab).** For flat model-sheet characters, Kling redraws the face and hair its own way: the clip pops at both ends and the face morphs. Use drawn poses with timed holds instead: cuts for head turns and expressions (hide them behind a blink), short dissolves only between near-identical poses. If you do try a clip, buy ONE first and check every frame before buying more.

## 5. Package (Wren)
- Base stills plus **cropped patches** per clip; `frames.json` lists positions; `routine.json` describes the loop and timings (data-driven, so Fable's engine plays it).
- 1× and 1.5× (phone) sets, WebP. Preview video for the user. Tools: `tools/lab_build_stills.py`, `lab_build_clips.py`, `build_lib.py`, `lab_package.py`.

## 6. Build (Fable)
1. Once scene N-1 is merged, cut `site/scene-N` from `main`.
2. Wren writes the drop-in brief in `reviews/` (assets, placement, routine, hunt spots, reaction).
3. Fable builds, records with Playwright, traces with Chrome DevTools on a throttled phone profile, and checks against `.claude/skills/review-animations/STANDARDS.md`. Fable reports, and Wren reviews.
4. The user checks it on a phone → Wren's OK → merge into `main`.

## 7. Hunt (Wren + Fable)
10 mushrooms: 3 easy, 4 medium, 3 hard (some hidden among similar shapes). Fair rules: always visible, never under UI, hit area ≥ 44 px, no overlaps, spread across the full width.

## Costs per scene (typical)
2–4 Higgsfield clips (9–18 credits) plus optional upscales (2 each). Quinn and Fable runs are covered by the user's plans.

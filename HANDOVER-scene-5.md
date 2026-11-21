# Handover: scene 5, set design (theatre)

For **Wren** (Claude) in a new chat. From Wren (café chat), 2026-11-21 19:30 JST.
Read first: `STATUS.md` (where everything stands), `BIBLE.md` (what's decided; it wins over older notes), `SCENE-RECIPE.md` (method, including the 2026-11-21 rules), `QUINN-LOOP.md` (Quinn without the user carrying files).
This replaces the earlier Travel handover: **the user replaced Travel with set design** (2026-11-21).

## 1. Where things stand (all scenes)
| # | Tab | State | Owner |
|---|---|---|---|
| 1 | Build | On `main`. Still needs the model-sheet restyle and **glasses removed** (decided: no glasses anywhere). | later task |
| 2 | Grow | On `main`. Light model-sheet restyle later. | later task |
| 3 | Design (café) | Art final (package v7.5 on `main`). Fable has it on `site/scene-3`. Waiting for the user's phone check, then merge. | you (the café chat is ending) |
| 4 | Film (Merlion) | Art final. Fable's build on `site/scene-4` (stacked on scene 3). Round 2 reviewed by the Film chat. Waiting for the phone check. Sean's consent needed before launch. | **the Film Wren chat owns Film; don't touch it** |
| 5 | Set Design (theatre) | **Art final** (v3 OK'd 21:13). Package `frames/022-theatre-scene/site/` committed. Fable brief `reviews/scene-5-build.md` written. | **you** |

Merges: `site/scene-3` → `main` after the phone check, then `site/scene-4`. Never merge into `main` without Wren's review and the user's OK.

## 2. Scene 5 in one paragraph
Rachel stands on a wooden A-frame ladder on a theatre stage, painting a huge backdrop: the left part is painted sky, hills and lake, the right part bare canvas with pencil lines. **The backdrop fills in as the visitor hunts:** each mushroom found in this scene paints one more swath, and at 10/10 it is complete. A **stagehand** (middle-aged contractor, grey T-shirt, jeans, tan boots) crosses behind the backdrop about once a minute. Only his boots show, in the dark gap under its hem: right to left with purpose, then 10–15 s later left to right. No glimpse of him, no peeking (the user found that creepy). The **caged work lamp** at the top right swings slowly. Mock-up A's busyness stays: seat backs along the bottom, knotted ropes, dripping paint pots, paint cart.

## 3. Decisions the user made (don't reopen)
- Scene: mock-up A (theatre backdrop), from five options (`frames/021-set-staging/021_contact.jpg`).
- **Keep the original's busyness:** seats, ropes and pots. The cleaner recompose (job 021f) was rejected.
- **Outfit for this scene:** white tank top, navy cargo trousers, brown boots, gold pendant, hair loose and wavy. No glasses.
- Animation ideas approved: strokes ↔ lean back ↔ dip the brush. Reaction: turns her head to you, smiles, raises the brush in a salute. Backdrop fills with the hunt. Lamp swings. Curtain stays still.
- Stagehand: boots only, right to left, then back. No glimpse.
- Model: the user is on Opus 5.5 and is saving Fable for site building.

## 4. Answered (2026-11-21 21:13, scene-5 Wren chat)
1. **Preview v3: "okay for now."** Art is final; no fixes asked. The optional tweaks (bigger or brighter boots, softer pose changes) were not taken up.
2. **Tab name: "Set Design."** It replaces "Travel" in the menu and in the contact form's checkbox. Scene id and address: `set`, `#set`.
3. Fable's brief is written: `reviews/scene-5-build.md`.

## 5. Files
- `tasks/022-theatre-scene.md`: the task record.
- `frames/021-set-staging/`: the five mock-ups.
- `frames/022-theatre-scene/incoming/`:
  - `022_scene_LOCKED_1536x1024.png`: **the locked scene**;
  - candidates v1–v3;
  - the stagehand design sheet and in-scene test.
- `frames/022-theatre-scene/approved/quinn/`:
  - `plate.png` (Rachel removed);
  - `plate_finished.png` (the backdrop completed);
  - the six pose crops (A2_stroke_low, A3_stroke_out, A1_blink, B1_lean, B2_dip, K1_salute; each a crop of the scene at x 330–1354);
  - `boot_facing_left/right.png`.
- `frames/022-theatre-scene/approved/green/`: Quinn's green-screen cut-outs of all seven poses (job 022f). **Every outline comes from these.**
- `frames/022-theatre-scene/site/`: **the package** (café format).
  - `frames.json` layers in draw order: `backdrop_01..10` (`hunt_progress` 1–10, `scenery`), `stagehand` (`sprite_track` + `mask`), `lamp` (36 frames, `scenery`), `rachel` (7 stills).
  - `routine.json`: the hand-written routines and notes, kept across rebuilds.
  - `stagehand/walk.json`: tracks `rtl` and `ltr` at 30 fps; per frame, two boots with x, y (bottom-centre), rot and far.
  - Canvas 1672×941 = Quinn space 1536×1024 cropped to y 120–984 and scaled by 1672/1536.

## 6. Tools (all in `tools/`), and the rebuild
`bash tools/theatre_rebuild.sh <work_dir> [--preview]` rebuilds everything from the repo. It was checked identical to the committed package at 19:25. In order:
1. `theatre_lamp.py`: cuts the lamp out, fills the plate behind it, renders the rigid pendulum frames.
2. `theatre_build.py`: Rachel's stills. Colour from the drawings, outline from the green cut-outs. Strokes change only her arm and brush (never her face). Blink changes only her eyes. Lean, dip and salute swap her whole upper body, cut across the jeans. Legs and boots never change.
3. `theatre_walk.py`: boots as rigid sprites that roll off the toe, arc and land on the heel, so they never slide. Clipped to the dark gap under the hem.
4. `theatre_qa.py`: **must say ALL OK.** It checks full opacity inside every outline, nothing outside it, unchanged legs, and an unchanged face on strokes. It also writes a sheet.
5. `theatre_package.py`: writes the package. The backdrop patches are ten equal visible swaths. The paint front only moves rightward, so no islands are left.
6. `theatre_preview.py`: preview video, with finds at 6.5, 12.5, 19.5 and 26 s and walks at 3 s and about 18.6 s.
Then copy `<work_dir>/site` to `frames/022-theatre-scene/site`.

## 7. Lessons from this scene (now rules in SCENE-RECIPE)
- **Never cut a character out by comparing the scene with the plate.** Wherever she matches the background, she goes see-through. Always use green-screen cut-outs from Quinn, made with masks, not regeneration.
- **Before showing the user anything:**
  - run the QA script;
  - look at **every distinct pose in the actual video at 1:1**: boots, trousers, torso, brush, face;
  - step through the backdrop stages one by one.
  The user caught three rounds of artefacts that a proper check would have caught. Don't repeat that.
- Don't let Quinn redraw the head in arm-only poses: the face then jitters between strokes.
- Patch edges must not run through hair, faces or waists. Swap whole regions and cut where the join can't show.

## 8. Next steps (in order)
1. Get the user's verdict on v3 and the tab name. Fix anything they flag, re-run the QA script, check 1:1, re-render, commit.
2. Write **Fable's build brief**, `reviews/scene-5-build.md`, in the pattern of `reviews/scene-4-build.md`. It must cover:
   - **branching:** a new tab on `site/scene-5`, stacked on `site/scene-4` (or cut from `main` if 3 and 4 have merged by then);
   - **assets:** built from `frames/022-theatre-scene/site/`;
   - **draw order:** plate, backdrop patches, boots (clipped to `gap_mask`), lamp, Rachel;
   - **three engine additions:** (a) `sprite_track` layers (draw sprites per frame from `walk.json` at x, y, rot about the bottom-centre, the far boot 15% darker, clipped to the mask); (b) `hunt_progress` layers (the k-th find in this scene fades in `backdrop_k` over 700 ms with ease-out, starting with her reaction; saved with the hunt; shown at once on a return visit; no fade with reduced motion); (c) the stagehand schedule from `routine.json` (first walk 8–15 s, then every 40–70 s, `rtl` then `ltr` after 10–15 s; none when paused or with reduced motion);
   - **the hunt:** 10 mushrooms (3 easy, 4 medium, 3 hard), never on actor layers or the backdrop patches, at least 44 px tap boxes;
   - **the prize:** the contact form unlocks at **all 50**, five scenes × 10 (BIBLE §1);
   - **"Travel" replaced** by the new tab name in the menu and in the contact form's checkbox;
   - **Fable's usual evidence:** Playwright recordings, a Chrome DevTools trace on a throttled phone, the review-animations standards, and memory under 80 MB.
3. Review Fable's report like the café and Film ones: evidence first, then a short paste for the user.
4. Phone checks of scenes 3–5, then merges in order.

## 9. The Quinn loop (how you work with Quinn)
- **Jobs:** `~/hjaas/wren-inbox/quinn/jobs/NNN-name/` on the user's Mac, through the device bridge, with `job.md` and `in/*.png`.
  - Commit the images first and `job.md` last (the watcher starts a job as soon as `job.md` exists).
  - Results land in `out/`, then `DONE` or `FAILED` appears.
  - Jobs run one at a time; each takes 5–25 min.
- **Next job numbers:** the scene-5 jobs used 021a–i and 022a–f. Number new ones **022g and on**.
- **Running:** the user keeps `bash ~/hjaas/wren-inbox/quinn/quinn_watch.sh` running in Terminal, with the Mac awake and the Claude desktop app open.
- **Collecting:** stage `out/*.png` with `device_stage_files`, QC, and copy the approved files into the repo.
- **Rules:**
  - ask for crops of one character;
  - say what must not change;
  - ask for masks, not regeneration, when pixels must stay;
  - allow at most 3 rounds per piece, then report to the user.

## 10. How the user likes to work
- Low cognitive load: one short, paste-ready prompt per step, with the details in the repo.
- One clear, certain recommendation. Verify before giving step-by-step instructions. Don't jump between plans.
- **Check work properly before showing it** (see §7). They notice artefacts and lose trust when they're the one finding them.
- Never make them relay between Wren and Quinn.
- Get a cost quote and their yes before any paid Higgsfield job. Scene 5 used none: there's no AI video for flat-style faces.
- **Never:**
  - pass a real person's photo to Quinn;
  - commit secrets;
  - draw glasses on Rachel.
- **Names:**
  - Quinn = ChatGPT (draws, via the Codex loop);
  - Fable = Claude Fable 5.2 in Claude Code on the Mac (builds the site);
  - Foreman = Grok orchestrator;
  - you = Wren.
- **Git:** run `git pull --rebase origin main` before every commit (the Film chat commits too). Repo `mentatdgt/hjaas`; the Mac copy is at `~/hjaas`.

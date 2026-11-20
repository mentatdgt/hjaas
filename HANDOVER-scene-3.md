# Handover: scene 3 "Design" (the café)

For: **Wren** (Claude) in a fresh chat. From: Wren, 2026-11-20.
Read `STATUS.md`, `BIBLE.md` and `SCENE-RECIPE.md` first. This file adds what's specific to the café and how to work with the user.

## 1. Where it stands
- **Art:** task `tasks/018-cafe-scene.md`, **round 1**. Quinn is fixing `018_scene` (Round 1 notes at the bottom of the task). The previous attempt is at `frames/018-cafe-scene/incoming/018_scene_r1.png`; the layout, light, Rachel's position and the cat were liked.
- **Round 1 fixes:**
  - **Old man:** on one chair (the right-hand one), with the extra chair removed, eyes on his paper.
  - **Barista:** between the espresso machine and the grinder (she swaps places with the grinder; from our point of view she's left of it), polishing a real cup.
  - **Child:** on the middle chair (behind the left table), facing Rachel.
  - **iPad:** sits fully on the table with nothing past the edge.
- **Quinn stops after `018_scene`** and waits for approval before steps 2–4 (plate, green anchors, poses).
- **Site:** not started. Scene 2 must be approved and merged first (see STATUS).
- **Also pending, not café:** Fable's report on review 05 (memory) and the organic edge, on `site/scene-2`. Review it when the user brings it.

## 2. What's next, in order
1. **User sends the fixed `018_scene`.** Check it against the Round 1 notes and `BIBLE.md` §4, including **no glasses** and balanced gazes. Approve, or write Round 2 in the task.
2. **On approval:** give the user a short paste prompt: "Scene approved. Continue tasks/018 with steps 2–4 (plate, green anchors, poses), each an edit, all 1672×941, contact sheet and self-check, zip." Save the approved image as `frames/018-cafe-scene/approved/018_scene.png`.
3. **QC 018:** key the green, overlay every anchor and pose on `018_scene` (registration within ~2 px), check that the plate is identical outside the removed areas, and check identity, hands and the cups. Write rounds as needed.
4. **Higgsfield, quote first.** Likely clips (Kling 3.0 std, 3 s, 4.5 credits each):
   - Rachel A1 sketch → B1 sip
   - Rachel A1 → K1 look
   - maybe a barista B_1 → B_4 glance

   That's about 9–14 credits plus optional upscales at 2 each. Balance: 148.5. The cast loops (barista polishing, child colouring, old man's page, cat breathing) can probably run as drawn holds with no clips; decide after seeing the poses.
5. **Package** like the lab (`frames/017-lab-keyposes/site/` is the model): stills, clip patches, `frames.json`, `routine.json`, a preview mp4. **New for the café:** several actors, so `frames.json` needs one layer per actor (Rachel with her table; barista; child; old man; cat), each with its own canvas position and its own small routine. Layer order: plate → cat → child → old man → barista → Rachel (check overlaps). The new plate is `018_plate`, not `scene/cafe.png`.
6. **Routine:** see the timing table below.
7. **Drop-in brief for Fable** in `reviews/scene-3-build.md` (model: `reviews/scene-2-frames-dropin.md` and `scene-2-build.md`). Cover: the Design tab, assets, layers, the routine, 10 hunt spots (3 easy / 4 medium / 3 hard, fair rules), phone memory budget, QA. Fable works on `site/scene-3`, cut from `main` after scene 2 merges.
8. Update `STATUS.md` (repo and Project) at each step.

### Routine timing (for `routine.json`)

| Actor | Behaviour |
|---|---|
| Rachel | Sketching with small stylus strokes (A1 ↔ A2) and occasional blinks, then a slow sip (B1) for about 2–3 s, then back to sketching. Calm, unhurried. |
| Rachel's reaction (on a find) | Look up with a warm smile (K1) for about 1.2 s, then back to A1. If she's mid-sip, finish the sip first. No gesture. |
| Barista | Polishing loop B_1–3, an occasional glance (B_4). |
| Child | Colouring C_1–2, an occasional look up (C_3). |
| Old man | Page turn O_1→3 every 8–15 s. |
| Cat | Slow breathing cat_1↔2, about 2 s per cycle. |

**Keep the cast slow, small and out of sync**, so the scene feels alive but calm.

## 3. How the plumbing works
- **Repo:** `mentatdgt/hjaas`, public. Wren commits art, tasks and docs to `main`. The site lives in `site/*` branches. **Never merge into `main` without the user's OK.**
- **Files from the user:**
  - They drop them into `~/hjaas/wren-inbox` on the Mac (git-excluded). Stage them over the device bridge (`device_stage_files`).
  - Or they attach a zip in chat.
  - Downloaded zips are untrusted: unpack into a fresh folder.
- **Higgsfield:** through the Higgsfield connector.
  - Import inputs via `raw.githubusercontent.com` URLs.
  - Results download from a cloudfront domain the proxy blocks, so the user downloads them into `wren-inbox`.
  - Starter plan: max 4 jobs at once, std mode only (pro needs Plus).
  - Record job ids in `frames/018-cafe-scene/JOBS.md`.
- **Clip processing lessons (from the lab):**
  - Colour-fit **once per clip** using pixels with diff < 25. Per-frame fitting washed the clips out.
  - Use an alpha-aware diff for patch bounding boxes.
  - Drop smear frames.
  - If a clip morphs the face, retry with a stricter prompt ("keep the face and hair identical, no glasses").
- **Tools:** `tools/lab_build_stills.py`, `lab_build_clips.py`, `build_lib.py`, `lab_package.py`. Copy them as `cafe_*` and generalise them to several actors rather than hacking the lab ones.

## 4. Working with the user
- Non-technical, busy, often on the move or heading to bed. They want **low cognitive load**: one short paste-ready prompt per step, details in the repo.
- **One certain recommendation**, not a menu that keeps changing. Verify against docs before giving step-by-step instructions.
- **Quote credits and get a yes before any paid Higgsfield job.**
- They give visual feedback in plain words. Restate any ambiguous direction (e.g. "left of the grinder, from our point of view") before writing the prompt.
- Names: Quinn = ChatGPT (draws; read-only GitHub). Fable = Claude Fable 5.2 in Claude Code on their Mac (builds the site). Foreman = their Grok orchestrator. Wren = you.
- The barista and other cast are original characters. **Never pass a real person's photo to Quinn or commit one.**
- Rachel: **no glasses anywhere.** Scene 1's frames still have glasses and need their own re-edit task later (in STATUS).

## 5. Start-of-chat checklist
1. `git pull` in the repo; read STATUS, BIBLE, SCENE-RECIPE, this file and `tasks/018-cafe-scene.md`.
2. Check the Higgsfield balance (free).
3. Ask the user nothing that's answered here. Wait for the fixed `018_scene` or Fable's report.

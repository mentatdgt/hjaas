# Handover: scene 5 (Travel)

> **Superseded 2026-11-21:** the user replaced Travel with a set-design scene (theatre backdrop). See BIBLE §3 and §4c, STATUS, and `frames/021-set-staging/`.

For **Wren** (Claude) in a new chat. From Wren (café chat), 2026-11-21.
Read these first: `STATUS.md` for where things stand, `BIBLE.md` for what's fixed (it wins over older notes), `SCENE-RECIPE.md` for the method, and `QUINN-LOOP.md` for how to work with Quinn without the user carrying files. This file covers only what's specific to Travel.

## 1. The situation
- **Scenes 1–2** (Build, Grow) are merged into `main`.
- **Scene 3** (Design, the café): the art is final (package v7.5 on `main`). Fable is integrating it on `site/scene-3`, and the café chat owns it. **Don't touch task 018 or the café files.**
- **Scene 4** (Film, Merlion): the art is packaged (task 020). Fable has built it on `site/scene-4`, stacked on `site/scene-3`. Fable's report (`reviews/scene-4-review-01.md`) is still to come, and the café chat reviews it.
- **This chat owns scene 5, Travel:** choosing what it is, staging it with Quinn, task 021 onwards, its package and its Fable brief.

## 2. What exists
- Backdrop `scene/travel-lookout.png` (task 009): a rocky mountain lookout over a green valley with a river, golden light from the left. **The location is a placeholder** I assumed to suit the hiking outfit.
- Outfit reference: outfit 3, technical hiking gear (`reference/hjaas1.png`).
- Rachel's model sheet: `reference/rachel/M01_rachel_model.png` (task M01). It's the drawing reference for her face and proportions in every new scene. **No glasses, ever.**
- BIBLE §3 row: `5 Travel | TBD | TBD | TBD | Look and a small wave`.

## 3. First job: settle the scene with the user (one short question with choices)
Record the answers in `BIBLE.md` §3:
1. **Location:** keep the mountain lookout, or a real trip of Rachel's? If it changes, Quinn redraws the backdrop first (task 021). If it stays, check that the backdrop still matches the warm painted look of the café and Film. If it doesn't, give it a light restyle pass.
2. **Outfit and hair:** hiking gear from `hjaas1.png`, with a bandana and bun, or loose hair.
3. **The two-stage loop,** for example: looking out with a hand shading her eyes ↔ a sip from a water bottle, or taking a photo on her phone.
4. **Supporting life:** a bird, a drifting cloud, swaying grass? Keep it to one or two small moving things, like the café's fan and cat.
5. **The reaction to a find:** the BIBLE says "look and a small wave". The user found the café's look-to-camera unnatural, so propose a wave **without** turning to camera (or a small turn of the head only), and confirm.

## 4. Then follow the recipe, using what the café taught us
1. **Staging (task 021):** 3 mock-ups from Quinn on the backdrop. The user picks one, then fix rounds until it's right. Every later image is an edit of this one.
2. **Pieces (task 022):** the scene, then the plate, then green anchors, then poses, all at the scene's exact size.
3. **Build every pose as the approved base plus only the moving part,** pasted and colour-matched. Pixels elsewhere stay identical, so nothing flickers. The proven tools are `tools/cafe_build7.py` (zone, fit, paste) and `tools/quinn_register.py` (aligns a Quinn crop back onto the base).
4. **No AI video for Rachel's flat-style face** (Kling morphs and pops it). Head turns and expressions are drawn poses, cut and hidden behind a blink. Dissolves only between near-identical stills of the same loop.
5. **Mechanical things move rigidly and physically** (the café fan used a rigid model). Don't use blur or warping: they look photographic or "AI".
6. **Shadows belong to the person who casts them:** a character's shadow goes in her own stills, never in the plate, so it can't appear before she does (café v7.4).
7. **The style must be consistent across the whole scene:** the same subtle painted gradation on everyone, with Rachel drawn to the model sheet.
8. **Package** in the café format: `frames.json` (layers with x, y, w and h, plus stills) and `routine.json` (per-actor loops, still/ms ranges, `fade_ms`, a reaction block). Render a preview with `tools/cafe_preview.py`. Audit it: no pixel changes outside actor boxes.
9. **Fable brief** in `reviews/scene-5-build.md`. Fable builds on `site/scene-5`, stacked on `site/scene-4`, unless scene 4 has merged into `main` by then.

## 5. Working with Quinn: use the loop, not the user
- Jobs go in `~/hjaas/wren-inbox/quinn/jobs/NNN-name/` on the user's Mac (over the device bridge): `job.md`, `in/*.png`, then `out/`, with `DONE` or `FAILED` when finished. The user keeps `quinn_watch.sh` running in Terminal.
- Ask for **crops of one character**, never whole scenes, and never use a returned image whole.
- Check every 10 minutes with a timed check-in. Allow a maximum of 3 rounds per piece, then tell the user.
- Number jobs from where the folder's highest number leaves off.

## 6. Sharing the repo with the café chat
- Run `git pull --rebase origin main` before every commit. Touch only scene-5 files and your own row in `STATUS.md`.
- Higgsfield credits are shared. Travel shouldn't need any (no AI video). Any paid job needs a quote and the user's yes.
- Never pass a real person's photo to Quinn, and never commit one.

## 7. How the user likes to work
- Low cognitive load: one short, paste-ready prompt per step, with the details in the task file.
- One clear, certain recommendation, verified before giving step-by-step instructions. Don't jump between plans.
- Restate any ambiguous visual direction before acting on it.
- Don't make the user relay between Wren and Quinn.
- Names: Quinn = ChatGPT (draws, via the Codex loop). Fable = Claude Fable 5.2 in Claude Code (builds the site). Foreman = Grok orchestrator. You = Wren.

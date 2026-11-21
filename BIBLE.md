# HJaaS: the bible

What's decided. Everyone (Wren, Quinn, Fable, Foreman) follows this. If a task, review or old note disagrees, this file wins; then fix the other file. **Last updated: 2026-11-21.**

## 1. The site
- **HJaaS: Hui Jie As a Service.** A gift for Hui Jie (English name **Rachel**), an interior designer who also does contracting, video, mushroom farming and set design. It should feel handmade, warm, playful and elegant, never like a template or a game HUD.
- **Format:** a painting sitting on a paper page, not a full-bleed screen. Each scene is a living hand-drawn illustration with a small scene menu: Build / Grow / Design / Film / Set Design.
- **The hunt:** 10 hidden mushrooms per scene (user confirmed 2026-11-21, knowing it's a lot). Difficulty: 3 easy, 4 medium, 3 hard. Fair: always visible, never under UI, hit areas ≥ 44 px.
- **Hint:** one gentle wiggle after 60 s, once per visit. No more hand-holding.
- **Prize (changed 2026-11-21):** the contact form unlocks only when **every mushroom in every scene** is found (10 × 5 = 50). No email shortcut: the site is a fun gift, not a sales tool. Progress must be saved in the visitor's browser so they can come back and carry on.
- **Text:** none yet besides the logo, counter, hunt prompt, unlock moment and form labels. The user adds copy later.

## 2. Look and motion
- **Art:** a Gravity Falls-*style* 2D cartoon (style only, original characters). Characters have round white eyes with dot pupils (no lashes or eyeliner), hair as solid shapes, flat colour with one hard shadow tone, thick even outlines, slightly stylised proportions. Not anime, not cosy painterly illustration. Backgrounds can be painted and detailed, with warm light from the left. **Rachel's master look: `reference/rachel/M01_rachel_model.png`** (approved 2026-11-20). Its style table is the rule for Rachel and the barista. The café's child, mum, old man and cat keep their original, slightly softer look by the user's choice (2026-11-20). Don't restyle them.
- **Logo:** the tape-measure pin, `assets/logo/hjaas-logo.png`; favicon `assets/logo/hjaas-reel.png`.
- **Page:** paper-coloured page with the scene inset; the edge is the **organic watercolour feather with a pencil trail** (option B, `reviews/scene-edge-pencil.md`): the colour fades, pencil lines carry on a little and trail off into the paper. Never a hard straight cut.
- **Intro:** 5 s watercolour paint-in with doubled strokes, easing `cubic-bezier(0.645, 0.045, 0.355, 1)`. Skip and pause available; reduced motion respected.
- **UI:** quiet and small. The counter is a little enamel-pin jewel, not a HUD. **Under review (2026-11-21):** the user finds the pin cartoony; proposal is a gallery-label counter in the page margin (pencil mushroom outlines that wash with colour, label flips from "3 of 10 found" to "3 more here" past halfway, scene dots in the menu, a "Write to Rachel" goal line). Mockups: the "HJaaS mushroom hunt: counter mockups" canvas. Not decided until the user OKs it.
- **Motion bar:** smooth and human, never jerky. Randomised holds, natural blinks, no popping or pose glitches. 60 fps on a throttled phone.

## 3. Rachel
**Locked in every frame:** **no glasses, ever** (the reference sheets show glasses; ignore that). Dark brown hair, warm tan skin, gold round pendant on a thin cord, the reference style. Real person, so keep her likeness kind and flattering.

| Scene | Outfit | Hair | Loop | Reaction to a mushroom find |
|---|---|---|---|---|
| 1 Build | Outfit 1: black tank, olive cargo pants, brown boots | Loose, wavy | Hammering a box, with taps and pauses | Looks up and beams, then thumbs-up (sometimes a wink) |
| 2 Grow | Lab: white lab coat over a dark top, olive cargos, boots (`hjaas6.png`) | Low ponytail, dark tie | Mist → write on the clipboard → rotate the rack, unhurried | Looks up, thumbs-up (may change to a peace sign) |
| 3 Design | Outfit 1 | Loose, wavy | Sketch on the iPad ↔ sip a hot coffee, two stages | Looks up at you with a warm smile, no gesture |
| 4 Film | Black tank, tan cargo shorts (seen from behind, cropped at the thighs) | Loose, wavy, no bandana | Holds still, filming the presenter with a DSLR; the screen shows him live and the red REC dot blinks (no head movement) | Looks back over her shoulder at you and smiles |
| 5 Set Design (tab name "Set Design", user 2026-11-21; replaces Travel in the menu and the contact form) | White tank top, navy cargo trousers, brown boots (user 2026-11-21, for variety) | Loose, wavy | On a ladder painting a theatre backdrop: brush strokes ↔ leans back to judge it, then dips the brush in the pot hooked on the ladder | Turns her head to you, smiles, raises the brush in a little salute |

The reaction changes per scene so the thumbs-up doesn't repeat everywhere.

## 4. Supporting cast (café)
All original characters, described in words. Never based on a real person's photo.
- **Barista:** a young Gen-Z Indian woman with a warm deep brown complexion, long dark layered hair with curtain bangs, silver hoops, a white ribbed top and a dark apron. She stands behind the counter between the espresso machine and the grinder, polishing a cup.
- **Mum:** sits on the sunlit window seat, watching her child. She stays still apart from a blink (part of the plate).
- **Child:** a boy at the left table on the middle chair, colouring with crayons. He looks down at his drawing with his mouth closed, and now and then looks up at his mum and grins.
- **Old man:** sits on one chair at the right table, reading a newspaper, with a kopi.
- **Cat:** a ginger tabby asleep on the floor at the lower right, beside Rachel's chair.
- **Rendering in the café (user, 2026-11-21):** everyone is painted like the café's own characters (child, mum): warm brown outlines, soft painted shading, the warm window light. Rachel and the barista keep their model-sheet *drawing* (faces, round eyes, hair shapes) but get this rendering. Black outlines and flat fills look pasted in here.
- **Ceiling fan:** turns slowly, hand-drawn blades, no motion blur (rendered from the plate by `tools/cafe_fan.py`).
- **Composition:** Rachel in the centre and in focus, with slight background softness. Gazes balanced, not everyone looking left. Corners kept open (the edge feathers them).

## 4b. Supporting cast (film)
- **Presenter:** an original character, described in words only: a friendly young East Asian man with short black hair and thin glasses, a black short-sleeved shirt with a clip-on mic, a watch, light-grey jeans and white sneakers. He stands in front of a silver fastback car (no badges), talking to camera with lively gestures and blinks. His gestures always stay clear of Rachel's camera.
- **Merlion water:** flows constantly (a hand-drawn loop).

## 4c. Supporting cast and set (scene 5, theatre)
- **The backdrop fills in with the hunt:** part of the sky is bare canvas with pencil lines; each find in this scene paints one more patch; at 10/10 here it is complete (Wren cuts the stages from the finished and pencil versions).
- **Stagehand (user 2026-11-21 17:54):** an original character: a middle-aged contractor in a grey T-shirt and jeans, tan work boots (design: `frames/022-theatre-scene/incoming/022_stagehand_sheet.png`). Every 40–70 s (random) he crosses BEHIND the backdrop, seen only as his boots and jean cuffs in the gap under the hem: right to left, walking with purpose. 10–15 s later he walks back left to right. **No glimpse of him, no peeking** (could seem creepy). Boots animated as rigid pieces that lift, swing and plant, so they never slide.
- **Ambient:** the caged work lamp swings rigidly on its rope (built). Not built (optional, for Fable in code if wanted): dust motes drifting in the floodlight beam. The fly ropes and the velvet curtain stay still.
- **Scene look (user 2026-11-21):** keep mock-up A's busyness: seat backs along the bottom, knotted fly ropes, dripping paint pots, paint cart.

## 5. Working rules
- **Roles:** Wren (Claude) does art direction, QC, tasks, Higgsfield jobs and commits. Quinn (ChatGPT) draws, with read-only GitHub access. Fable (Claude Fable 5.2 in Claude Code on the Mac) builds the site. Foreman (Grok) dispatches Cursor agents for PRs into site branches. The user carries files and makes the calls.
- **Money:** a cost quote and the user's approval before every paid Higgsfield job.
- **Merging:** nothing merges into `main` without Wren's review and the user's OK.
- **Prompts for the user:** one short paste-ready prompt per step. Details live in the repo, not the paste.
- **Art edits:** every pose is an edit of a green anchor at the approved scene's exact size, never a redraw. Get the scene approved before drawing poses.
- **No flicker, by construction (2026-11-21):** every animation pose is the actor's approved base image plus ONLY the part that moves, pasted and colour-matched by Wren. A generated pose is never used whole. Head turns and expressions are cuts hidden by blinks; soft fades only inside small loops. No AI video for flat-style faces.
- **The Quinn loop:** Wren sends Quinn jobs and collects results directly (`QUINN-LOOP.md`). The user sees finished previews, not intermediate files.
- **Never commit:** secrets, cookies or real people's photos used as character references.

# HJaaS: the bible

What's decided. Everyone (Wren, Quinn, Fable, Foreman) follows this. If a task, review or old note disagrees, this file wins; then fix the other file. **Last updated: 2026-11-20.**

## 1. The site
- **HJaaS: Hui Jie As a Service.** A gift for Hui Jie (English name **Rachel**), an interior designer who also does contracting, video, mushroom farming and travel. It should feel handmade, warm, playful and elegant, never like a template or a game HUD.
- **Format:** a painting sitting on a paper page, not a full-bleed screen. Each scene is a living hand-drawn illustration with a small scene menu (Build / Grow / Design / …).
- **The hunt:** 10 hidden mushrooms per scene. Difficulty: 3 easy, 4 medium, 3 hard. Fair: always visible, never under UI, hit areas ≥ 44 px.
- **Hint:** one gentle wiggle after 60 s, once per visit. No more hand-holding.
- **Prize:** finding 10/10 in any scene for the first time unlocks the contact form.
- **Text:** none yet besides the logo, counter, hunt prompt, unlock moment and form labels. The user adds copy later.

## 2. Look and motion
- **Art:** flat colours, thick dark outlines, warm light from the left, hand-drawn proportions (large head, small hands). Match `reference/` and the approved scene-1 frames.
- **Logo:** the tape-measure pin, `assets/logo/hjaas-logo.png`; favicon `assets/logo/hjaas-reel.png`.
- **Page:** paper-coloured page with the scene inset; the edge is the **organic watercolour feather with a pencil trail** (option B, `reviews/scene-edge-pencil.md`): the colour fades, pencil lines carry on a little and trail off into the paper. Never a hard straight cut.
- **Intro:** 5 s watercolour paint-in with doubled strokes, easing `cubic-bezier(0.645, 0.045, 0.355, 1)`. Skip and pause available; reduced motion respected.
- **UI:** quiet and small. The counter is a little enamel-pin jewel, not a HUD.
- **Motion bar:** smooth and human, never jerky. Randomised holds, natural blinks, no popping or pose glitches. 60 fps on a throttled phone.

## 3. Rachel
**Locked in every frame:** **no glasses, ever** (the reference sheets show glasses; ignore that). Dark brown hair, warm tan skin, gold round pendant on a thin cord, the reference style. Real person, so keep her likeness kind and flattering.

| Scene | Outfit | Hair | Loop | Reaction to a mushroom find |
|---|---|---|---|---|
| 1 Build | Outfit 1: black tank, olive cargo pants, brown boots | Loose, wavy | Hammering a box, with taps and pauses | Looks up and beams, then thumbs-up (sometimes a wink) |
| 2 Grow | Lab: white lab coat over a dark top, olive cargos, boots (`hjaas6.png`) | Low ponytail, dark tie | Mist → write on the clipboard → rotate the rack, unhurried | Looks up, thumbs-up (may change to a peace sign) |
| 3 Design | Outfit 1 | Loose, wavy | Sketch on the iPad ↔ sip a hot coffee, two stages | Looks up at you with a warm smile, no gesture |
| 4 Film | Black tank, tan cargo shorts (seen from behind, cropped at the thighs) | Loose, wavy, no bandana | TBD: filming a presenter at night, Merlion and Marina Bay Sands behind (task 019) | Looks back over her shoulder at you and smiles |
| 5 Travel | TBD | TBD | TBD | Look and a small wave |

The reaction changes per scene so the thumbs-up doesn't repeat everywhere.

## 4. Supporting cast (café)
All original characters, described in words. Never based on a real person's photo.
- **Barista:** a young Gen-Z Indian woman with a warm deep brown complexion, long dark layered hair with curtain bangs, silver hoops, a white ribbed top and a dark apron. She stands behind the counter between the espresso machine and the grinder, polishing a cup.
- **Mum:** sits on the sunlit window seat, watching her child. She stays still apart from a blink (part of the plate).
- **Child:** a boy at the left table on the middle chair, facing Rachel, colouring with crayons.
- **Old man:** sits on one chair at the right table, reading a newspaper, with a kopi.
- **Cat:** a ginger tabby asleep on the floor at the lower right, beside Rachel's chair.
- **Composition:** Rachel in the centre and in focus, with slight background softness. Gazes balanced, not everyone looking left. Corners kept open (the edge feathers them).

## 5. Working rules
- **Roles:** Wren (Claude) does art direction, QC, tasks, Higgsfield jobs and commits. Quinn (ChatGPT) draws, with read-only GitHub access. Fable (Claude Fable 5.2 in Claude Code on the Mac) builds the site. Foreman (Grok) dispatches Cursor agents for PRs into site branches. The user carries files and makes the calls.
- **Money:** a cost quote and the user's approval before every paid Higgsfield job.
- **Merging:** nothing merges into `main` without Wren's review and the user's OK.
- **Prompts for the user:** one short paste-ready prompt per step. Details live in the repo, not the paste.
- **Art edits:** every pose is an edit of a green anchor at the approved scene's exact size, never a redraw. Get the scene approved before drawing poses.
- **Never commit:** secrets, cookies or real people's photos used as character references.

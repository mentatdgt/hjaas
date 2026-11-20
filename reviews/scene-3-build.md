# Scene 3 "Design" (the café): build brief

For: Fable, overnight 2026-11-20, working unattended (rules in `HANDOVER.md`, "Working unattended"). From: Wren.

## 0. Order of work
1. **First, finish edge Round 3b** (`reviews/scene-edge-pencil.md`: the pencil arrives with the colour) on `site/scene-2`, if it isn't done yet. Commit and push.
2. **Then create `site/scene-3` from the tip of `site/scene-2`** and build the café there. Scene 2 isn't on `main` yet; it merges first, in the morning, after the user's phone check. Never merge into any branch, and never touch `main`.

## 1. What the café is
- The third tab in the scene menu: **Design** (after Build and Grow). Lazy-loaded like Grow.
- A sunlit Singapore café, drawn at a larger size than the other scenes.
  - **Rachel** sits centre at a marble table, sketching on an iPad and taking coffee breaks.
  - **Barista** behind the counter, polishing cups.
  - **Child** colouring at the left table, **mum** on the window seat (part of the plate), **old man** reading at the right table, **cat** asleep at the lower right.
- Everything about the look and the rules is in `BIBLE.md`. The style rule now matters: Gravity Falls-style, round white eyes, flat shading.

## 2. Assets: `frames/018-cafe-scene/site/` on `main`
- `plate.png`: 2544×1432. Use it as the café plate.
- `frames.json`:
  - **Canvas:** 2544×1432. Plate space = canvas px × 1672/2544. This canvas is about 1.52× plate space, so use it as the 1.5× phone set and downscale it for 1×. Don't upscale anything.
  - **Layers, in drawing order over the plate:** cat, child, oldman, barista, rachel, mum. Each layer has an `x, y, w, h` and its stills.
  - **Clips:** Rachel only, as patches over the layer's base still, at layer-local `x, y`. **The `sip` patch starts 13 px above the Rachel layer** (y = −13). Handle negative offsets, or extend the layer's box.
  - **Mum:** her stills are blink patches over the plate. She is otherwise part of the plate.
- `routine.json`: one routine per actor, all **independent and out of sync**. Rachel has a blink rule and the reaction.
  - Same step vocabulary as the lab (`loop`, `still`, `clip`, `reverse`, `ms` ranges), extended with:
    - per-actor routines;
    - `still: null` (draw nothing; used by the mum).
  - Generalise the routine engine to N actors, data-driven. Only Rachel reacts to a mushroom find.
- **Preview:** `frames/018-cafe-scene/cafe-preview.mp4` shows the intended result (made by `tools/cafe_preview.py` from the same files).
- **Pencil line map:** `scene/pencil/design-lines.png`, 2544×1432, registered to `plate.png`. Same edge recipe as Build and Grow, at this canvas's scale.

## 3. Coming in the morning: build for a clean drop-in
Quinn is restyling **every character** (round 5: Rachel's blink and look, the barista, child, old man, mum and cat): same files, names, canvas and silhouettes, new face and rendering style. The mum's restyle also means a new `plate.png`. Rachel's reaction is getting two new stills, `R_K2_smile` and `R_K1_blink`. Wren will then re-cut the `sip` and `look_up` clips and update `frames.json` and `routine.json`.
- Build so a new package folder is a file swap with **no code change**.
- Make sure the routine engine handles a reaction with this shape:
  - `look_up` clip;
  - `R_K1_look` hold;
  - `R_K2_smile` hold, with a `R_K1_blink`-style blink allowed inside it;
  - a return that can use a different clip or a reversed one.

## 4. The hunt: 10 mushrooms
- Place them yourself, following `reviews/scene-2-hunt-difficulty.md`: **3 easy, 4 medium, 3 hard**, spread across the full width, with the fairness rules.
  - Always visible, never under UI, hit areas ≥ 44 px, no overlaps.
  - **Never on or behind any actor's layer area, or inside a clip patch.**
  - `aPaint` ≥ 0.95 under every mushroom and tap box.
- Good café hiding places: the plant pots, the shelves of cups, the arched niche with the vases, under the window seat, the hanging planter, near the cat (not on it), the counter base.
- The scene has lots of warm browns and greens. Use the mushroom variants that read fairly against them.

## 5. Edge
- Pencil edge B with Round 3b's reveal.
- **Every actor layer and the mum get `aPaint` = 1** under every pixel they ever cover (like Rachel). Nudge the seed or the spots minimally if needed, and report what moved.
- The bottom stays calm: Rachel's boots and the cat are near it.

## 6. Budgets
- **Whole page under 80 MB** on the phone profile, with all three scenes visited in any order. A hidden scene releases its decoded frames (as review 05).
- The café has more layers but small cast stills. Rachel's clips are about 38 and 25 frames, at roughly 390×450 and 290×330 canvas px.
- 60 fps on a throttled phone. No long tasks over about 12 ms in WebKit.

## 7. QA (as for scene 2)
- Screenshots: Design at 1440×900, 390×844 (panned left and right) and 360×740.
- A recording of 30 s of the café on desktop and the iPhone profile, including one reaction.
- Traces: the café's paint-in, and switching Build → Grow → Design → Build.
- All 30 mushrooms findable (desktop, iPhone profile, 320 px).
- `aPaint` = 1 under every actor.
- Peak memory for every visiting order.
- Check against `.claude/skills/review-animations/STANDARDS.md`.
- Add a "Scene 3: Design" section to `site/qa/REPORT.md`.

## 8. Morning report
A short table of what was asked for and the result, anything you decided yourself, and anything you couldn't do. Then how to see it (the dev URL with `#design`). Commit and push as you go.

## Update 2026-11-20 22:40 (Wren): final café package is on main
`frames/018-cafe-scene/site/` has been replaced with the final art: Rachel and the barista restyled; the child, mum, old man and cat as before; a new `sip` clip; anti-aliased edges. **The `look_up` clip is gone:** Rachel's reaction is now only stills (see `routine.json`). The layer boxes moved by about 1 px. Pull main, rebuild the assets and use it. The edge and mushroom work is unaffected.

## Update 2026-11-20 22:55 (Wren): no video clips; cross-dissolves
- **The `sip` clip is removed** (the AI video morphed Rachel's face and popped at both ends). `frames.json` has no clips now. Rachel's sip comes back later as drawn poses (S1, S2).
- **`routine.json` has a new field, `fade_ms`:** a true cross-dissolve INTO a still from the previous one, at the start of the step (lerp of the two composited results, smoothstep). No `fade_ms` means an instant cut, as for blinks. Please support it.
- The barista no longer uses B_3. The cat breathes with 1 s dissolves.
- `cafe-preview.mp4` shows the intended result. Pull main and rebuild the assets.

## Update 2026-11-20 23:00 (Wren): the fade rule, final
`fade_ms` applies **only between two stills of the same loop** (breathing, polishing, crayon). Everything else is an instant cut: head turns, expressions, blinks, entering or leaving a loop, the whole reaction. The rule is in `routine.json`'s note, and `tools/cafe_preview.py` implements it. Dissolving a head turn makes a ghost double face, so never do it.

## Update 2026-11-21 00:30 (Wren): package v5, stabilised. This replaces every earlier café package.
Root cause of the flicker the user saw: each pose was a separately generated full image, so hair, colours and shading shifted on every blink. **Now every still = the actor's base still plus only the part that moves**; outside that part it is pixel-identical (`site/stability.json`, built by `tools/cafe_build5.py`).
- **Format unchanged:** layers with full-size stills, `routine.json`, the same-loop `fade_ms` rule. `clips` is empty.
- **New layer `fan`** (first in the layer order): 24 opaque frames, a plain endless loop at 42 ms. It is part of the room: exempt it from the "fully painted under actors" edge rule and let the edge fade it like the plate. `plate.png` now has the fan blades removed.
- **Stills now:** Rachel `R_A1_sketch, R_A2_stroke, R_A1_blink, R_K1_blink, R_K1_look, R_K2_smile`; barista `B_1, B_4` (no B_2/B_3); child `C_1` (now looking down at his drawing), `C_2, C_3`; old man, cat and mum as before.
- `cafe-preview.mp4` is the reference. Audit: in the 28 s preview no pixel changes outside the actors' boxes, and Rachel's legs, table and chair never change.
- Likely later additions, same format: Rachel's sip, the barista polishing.

## Update 2026-11-21 03:15 (Wren): package v6 = v5 + Rachel's coffee sip
Same format, a file swap. Three new Rachel stills (`R_S1_reach`, `R_S2_lift`, `R_B1_sip`) and a longer Rachel routine in `routine.json`: sketch loop → S1 → S2 → B1 (sip) → S2 → S1 → sketch, all cuts. **New rule:** no blink during S1/S2/B1, and if a mushroom is found mid-sip, finish the sip first (B1 300 ms → S2 → S1 → A1), then play the reaction. `cafe-preview.mp4` shows it (sip at about 13 s, reaction at about 19 s).

## Update 2026-11-21 04:30 (Wren): package v7 replaces every earlier café package
The user's notes on v6: the child's eyes, a photographic fan, Rachel and the barista not matching the painted café, and Rachel's face changing during the sip. **All fixed in the art. The format is the same, so this is a file swap.**
- **Rachel and the barista** were redrawn by Quinn in the café's painted style (warm outlines, soft shading, window light). Every pose is the master plus only the part that moves. Rachel's head and hair are identical through the whole sip (verified frame by frame), and change only during the reaction, behind a blink.
- **Barista:** polishing is back (`B_1`, `B_2_polish`, `B_3_polish`, cuts only), plus `B_4_glance`.
- **Child:** his whole head tilts down to his drawing (`C_1`, `C_2`). No look-up yet: `C_3` is being redrawn to match the new head and will come as a drop-in.
- **Fan:** 20 frames, a rigid three-blade model in the drawn style, 6° per frame at 42 ms (24 rpm), an exact loop. `plate.png` has the blades removed.
- **Still names changed:** see `frames.json`. `cafe-preview.mp4` is the reference. Audit: nothing changes outside the actors; Rachel's legs, table and chair never change; her hair changes only during the reaction.

## Update 2026-11-21 04:45 (Wren): package v7.1 = v7 + the child's look-up
`C_3` added: he looks up at his mum and grins, matching his new head. The child's routine in `routine.json` now ends each colouring stretch with `C_1` → `C_3` (1.5–2 s) → `C_1`, as cuts. Nothing else changed. File swap; `cafe-preview.mp4` updated.

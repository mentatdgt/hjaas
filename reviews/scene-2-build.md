# Scene 2 build ("Grow", the mushroom lab): structure, overnight run

For: **Fable**, after review 03 (elegant) and `reviews/logo-swap.md` are done on `site/scene-1-elegant`.
- Create the branch `site/scene-2` from `site/scene-1-elegant`. Commit per item and push.
- Never merge into any other branch.

## User decisions (2026-11-19)
- **Moving between scenes:** a small **scene menu** (tabs). For now: **Build** (scene 1) and **Grow** (scene 2). Later: Film, Design, Travel. Show only the scenes that exist.
- **Hunt:** **10 mushrooms in each scene,** each with its own count.
- **Contact unlock (Wren's assumption, easy to change):** the Contact button unlocks the first time **any** scene reaches 10/10, and stays unlocked.
- **Scene 2 routine:** Rachel mists her mushroom tray, then writes on a clipboard, then rotates back. **Slow and unhurried.**

## Not available yet
Rachel's lab animation frames (`tasks/017-lab-keyposes.md`) are still being drawn. Build everything so her frames drop in later as files plus a manifest, exactly as scene 1 works.

## 1. Make the scene engine reusable
- Refactor `src/scene1/` into a shared scene engine plus per-scene config. A config holds: the plate image; the character frames and their placement; the idle routine (a data-driven list of loops and transitions, see 4); the reaction manifest; the 10 mushroom SPOTS; and the paint-in strokes.
- Scene 1 must behave exactly as before. Verify that with the existing QA screenshots and a recording.

## 2. Scene menu and transitions
- A small, quiet tab menu on the paper page above the painting, in the elegant style: flat, plainly labelled, keyboard accessible, with the current scene marked. On phones it must fit one row.
- **Switching scenes:** the new painting is brushed in over the old one with the same procedural brush, **about 1.2–1.6 s**. Skippable by clicking again. Reduced motion: a 200 ms crossfade.
- **The first visit to a scene** gets its full paint-in (as scene 1's first visit). Revisits get the short brush or the fade.
- The URL reflects the scene (e.g. `#grow`), so links and the back button work.
- Remember each scene's state per visitor: found mushrooms and pan position.

## 3. Scene 2: the lab
- **Plate:** `scene/mushroom-lab.png` (1672×941), framed the same way as scene 1 in the elegant page.
- **Rachel's spot:** open floor at about 45–68% of the width, lower half, in front of the shelving (see `tasks/008-backdrop-mushroom-lab.md`). Until her frames exist, show a **placeholder**: a cut-out of the three-quarter pose from `reference/hjaas6.png`, at a believable scale for her spot. Mark it clearly `// PLACEHOLDER until tasks/017` and list it in the report. No reaction in scene 2 until real frames exist; finds still count and animate the caption.
- **10 mushrooms:** choose believable hiding spots in the lab, e.g. under the bottom shelf, behind a jar, beside the humidifier, on a bench corner, by the floor drain. Spread them across the whole width so phone visitors swipe. Same depth scaling, tap-box and no-glow rules as scene 1. White mushrooms are hard to see on white surfaces, so use them sparingly and fairly.
- **Lighting tint:** the lab is cool white. Tint the mushrooms so they sit in that light, not scene 1's warm tint.
- **Phones:** the same pannable 2:3 window, initially centred on Rachel's spot.

## 4. Data-driven idle routine (ready for the frames)
The routine engine reads a manifest such as `routine.json` describing:
- **Loops**, for example misting (A1 → A2 → A3 → A1 with per-frame hold ranges) and writing (B1 ↔ B2).
- **How many cycles** each loop runs (randomised within a range).
- **Transitions** between loops (frame lists, from video in-betweening later).
- **Where blinks may happen** (only on named rest frames).
- **Which frame the reaction starts from.**

Implement and unit-test the engine with a small fake manifest (e.g. scene 1's frames rearranged). Leave scene 2's real `routine.json` as a stub with the target timings:
- Misting: 2–4 sprays, each about 0.9–1.3 s (aim → squeeze → lift), then a 1–2 s pause.
- Writing: about 4–7 s, with one glance.
- Then transition back.
- Blinks on A1, about every 3–6 s.

Unhurried throughout.

## 5. QA and report
- Screenshots of both scenes at 1440×900, 390×844 and 360×740.
- A recording of switching Build → Grow → Build on desktop and on an iPhone (WebKit).
- All 20 mushrooms findable (10 per scene).
- Contact unlocks after the first 10/10.
- State survives a reload.
- WebKit cold-load check of the scene-switch transition: no frame over about 50 ms.
- Add a "Scene 2 (structure)" section to `site/qa/REPORT.md` with ✅/❌ and evidence, and list what is placeholder.

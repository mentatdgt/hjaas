# Scene 4 "Film" (the Merlion at night): build brief

For: Fable. From: Wren (scene-4 chat), 2026-11-21.
Rules for unattended work are in `HANDOVER.md`. The look and the rules are in `BIBLE.md` (§3 row 4 and §4b).

## 0. When and where
- **Branch:** create `site/scene-4` from the tip of `origin/site/scene-3` (café v7.3, committed). The user doesn't want to wait for the café merge (agreed 2026-11-21). The branches merge in order later: scene 3, then scene 4.
- **Bring in the scene-4 files from `main`** (they aren't on the site branches):
  `git fetch origin && git checkout origin/main -- frames/020-film-scene/site scene/pencil/film-lines.png tools/film_preview.py frames/020-film-scene/film-preview.mp4`
  Don't merge `main` into the branch. Read this brief and `BIBLE.md` from `origin/main`.
- Never merge into any branch, and never touch `main`.

## 1. What scene 4 is
The fourth tab in the scene menu: **Film**, after Build, Grow and Design. Lazy-load it like Grow and Design.

Merlion Park at night, with Marina Bay Sands lit up behind.
- **The presenter:** a young man in glasses, an original character. He stands in front of a silver fastback car, talking to camera with lively gestures and blinks.
- **Rachel:** seen from behind in the right foreground, cropped at the thighs. She films him with a DSLR.
- **The Merlion:** its water flows constantly.
- **On a mushroom find:** Rachel turns to look back over her shoulder at the visitor and smiles, then goes back to filming.

Preview of the intent: `frames/020-film-scene/film-preview.mp4`, made by `tools/film_preview.py` from the same frames.

## 2. Assets: `frames/020-film-scene/site/` on `main`
- **`plate.png`:** 1672×941, the empty scene (car, landmarks, the presenter's ground shadow).
- **`frames.json`:**
  - **Canvas:** 1672×941. This is the 1× set, and there is no larger master. **Don't upscale it for phones**: use the same files.
  - **Layers, in drawing order over the plate:**
    - `water`: x 402, y 111;
    - `presenter`: x 601, y 254;
    - `rachel`: x 997, y 258.
  - Each still is **RGBA with a soft 1 px edge**. Draw it at its layer's x, y with normal alpha blending.
  - Within a layer, every still is pixel-identical to the first outside the part that moves (`stability.json`), so **every change is an instant cut and nothing flickers**.
- **`camera_screen`** (new, see §3): the live viewfinder on Rachel's DSLR.
- **`routine.json`:** one routine per actor, independent and out of sync. The step vocabulary is the café's (`loop`, `repeat`, `still`, `ms` ranges, `blink`, `reaction`).
  - **No `fade_ms` anywhere** in this scene.
  - The presenter's `blink.on` is a **list** of stills (the blink may replace any of his three M_1 mouth stills). Accept a string or a list.
- **Pencil line map:** `scene/pencil/film-lines.png`, 1672×941, registered to `plate.png`.

## 3. The live camera screen (the new piece)
Every frame, after drawing the plate, water and presenter (and **before** Rachel's layer is drawn over them), copy the canvas region `camera_screen.source` (x 600, y 250, 320×290: the presenter and the bay behind him). Then:
1. Draw Rachel's current still.
2. Draw the copied region, scaled, into `camera_screen.rect_by_still[<Rachel's current still>]`, inset by 2 px on every side.
3. Draw the REC dot: a 6 px red circle (#EB1E1E), 2 px in from the top-left of the screen picture, 500 ms on and 500 ms off. It keeps blinking during the reaction.

The rect moves when she turns (K1 lowers the camera), so look it up per still.
- It's tiny (about 40×36 px), so a cheap drawImage from an offscreen canvas is enough.
- Keep it at the main loop's frame rate; don't add a second loop.
- Reduced motion: show a still copy, and keep the REC dot on without blinking.

## 4. Routines (summary; the data is authoritative)
- **Water:** W_1 → W_2 → W_3, 110 ms each, forever (a hand-drawn boil). It's scenery: the edge treats it like the plate.
- **Presenter:** talks all the time.
  - Lip-flap: M_1 / M_1_mid / M_1_closed, with pauses, and random blinks every 2.5–6 s.
  - Every few seconds he gestures: M_1 → M_12 (100 ms) → M_2, points at the view and talks (M_2 / M_2_closed), then M_12 → M_1.
  - Later, the same through M_13 → M_3 (hands together).
  - He doesn't react to finds.
- **Rachel:** holds R_A1_film. The user dropped her head-tip glance on purpose (it looked choppy), so don't add idle motion to her.
  - **Reaction on a find:** R_K0_turn 90 ms → R_K1_look 1.6–2.0 s → R_K0_turn 90 ms → R_A1_film.
  - If a second find lands mid-reaction, extend the K1 hold. Don't restart the turn.

## 5. The hunt: 10 mushrooms
Place them yourself, following `reviews/scene-2-hunt-difficulty.md`: **3 easy, 4 medium, 3 hard**, spread across the full width.
- **Fairness rules:** always visible, never under UI, hit areas ≥ 44 px, no overlaps.
- **Never on or behind any actor's layer area** (water, presenter, Rachel), and **never inside the camera screen**.
- `aPaint` ≥ 0.95 under every mushroom and tap box.
- **Good hiding places:**
  - the car's wheel arches and its sill;
  - the two bollard lamps and the railing posts on the left;
  - the kerb and flowers of the hedge planter;
  - the lit steps and the kiosk base on the right;
  - cracks in the paving;
  - the tree at the top right;
  - the ArtScience Museum's base on the far left.
- It's a night scene: use the mushroom variants that read fairly against warm paving and navy water, and check the hard ones aren't simply invisible in the dark.

## 6. Edge and phones
- Pencil edge B with Round 3b's reveal, using `film-lines.png`.
- **The presenter, and Rachel above her waist (canvas y < 760), get `aPaint` = 1** under every pixel they ever cover.
  - Rachel is cropped by the bottom of the painting, so let the edge fade her legs into the paper there, like the rest of the bottom edge. Don't add a hard cut.
- **Phones:** the default view shows canvas x about 620–1420 (37–85%), so both people are in frame. Panning works as in the other scenes.

## 7. Budgets
- **Whole page under 80 MB** on the phone profile, with all four scenes visited in any order. A hidden scene releases its decoded frames.
- Scene 4 is light: 16 small RGBA stills (about 4 MB as PNG; convert to WebP as for the other scenes).
- 60 fps on a throttled phone. No long tasks over about 12 ms in WebKit.

## 8. QA (as for scenes 2 and 3)
- **Screenshots:** Film at 1440×900, 390×844 (panned left and right) and 360×740.
- **Playwright recording** of 20 s, including one find (the reaction) and one gesture each way.
- **Chrome DevTools trace** on the throttled phone profile.
- **Check against `.claude/skills/review-animations/STANDARDS.md`.** In particular:
  - no flicker on cuts;
  - the camera screen updates smoothly;
  - the REC dot blinks evenly;
  - the water loops without a hitch.
- **Report** in `reviews/scene-4-review-01.md`, then Wren reviews.

## 9. Not yet
- **Sean's consent:** the presenter is an original character, but he's inspired by a real friend. The user confirms before launch. Build normally.
- **Copy:** none for this scene yet.

## Update 2026-11-21 (after build 01): new plate
The user had the car reshaped (a shorter bonnet, a longer cabin, the door split midway between the wheels). **Re-import from `origin/main`:** `frames/020-film-scene/site/plate.png` (→ `room.webp`) and `scene/pencil/film-lines.png` (→ `pencil-lr`/`pencil-tb`), using the same checkout-by-path as in section 0. Nothing else changed: the layers, routines, wheels, sill and every mushroom spot stay valid. Rebuild, re-run the scene-4 screenshots, and push.

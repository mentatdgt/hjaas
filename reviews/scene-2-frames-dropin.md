# Scene 2: drop in Rachel's real lab frames

For: Fable, on `site/scene-2`, after the structure work is done. Run `git pull origin main` first.

- **Source:** `frames/017-lab-keyposes/site/`.
  - `frames.json`: 7 stills on a 980×1380 canvas (2×). Each clip frame is a **patch** drawn over its base still at (x, y).
  - `routine.json`: the idle routine (misting ↔ writing), blinks and the reaction timings.
  - Reference video: `frames/017-lab-keyposes/lab-routine-preview.mp4`.
- **Placement:** draw Rachel's canvas at plate (680, 210), sized 490×690 plate px, on `scene/mushroom-lab.png`. **Remove the mock-up placeholder plate.**
- **Engine:** extend the routine engine to read this format. A frame is a base still plus an optional patch; decode each patch once and composite onto the base, or layer the patch over the base. Respect the ranges and the reaction entry rule in `routine.json`.
- **Assets:** convert to WebP (q≈92–95, exact alpha) via `npm run assets`. Lazy-load scene 2's frames when the Grow tab is first opened (stills first, then clips), so scene 1's first load stays light.
- **QA:**
  - Record the routine and one reaction on desktop and iPhone (WebKit), and compare against the preview video.
  - Check that nothing jumps when switching between the clip patch and the still.
  - Check frame timing in a WebKit trace.
- **Reaction gesture:** thumbs-up for now (see `reviews/user-notes-pending.md`).

You are Quinn, illustrator for HJaaS. These are Rachel's Build drawings (no glasses, approved), on flat green #00FF00, 1536x1024. The site's browser checks found faults in three drawings and two small blemishes. Fix them. Work in parallel with subagents, one per output, and use an independent QC subagent at the end (see AGENTS.md).

The hammer swing, in order: green_frame_01 (hammer on the box) → green_frame_01_02 → green_frame_02 (just lifted) → green_frame_02_03a → green_frame_02_03b → green_frame_03 (raised high, hand above her forehead).
The thumbs-up, in order: green_rx_K1 → green_rx_K1_B36 → green_rx_B36 → green_rx_B36_B39 → green_rx_B39 (thumbs up).

Make these 5 drawings:

1. out/frame_01_02.png: REDO this in-between. The current green_frame_01_02 has a dark cut line across her upper arm where the edit was pasted, ragged outlines, and loose pixels by the hammer. Make it an EDIT of green_frame_01 in which ONLY her hammer arm, hand and the hammer move, to exactly halfway between frame_01 and frame_02. Outlines must be clean and continuous. No seams, no stray pixels.

2. out/frame_02_03b.png: REDO this in-between. In the current one her forearm and fist cover her eyes, and scraps of eye show around the fist, so her eyes vanish in every swing. Make it an EDIT of green_frame_02_03a in which ONLY her hammer arm, hand and the hammer move, two thirds of the way from frame_02 to frame_03.
   - Her raised forearm must pass ABOVE her eyes, at headband/forehead height, going up toward frame_03's pose.
   - Her elbow is out to the side, and the hammer head is above her head.
   - Both eyes, the brows and the nose stay fully visible and exactly as in the input.

3. out/rx_B36.png: an EDIT of green_rx_B36 in which ONLY her lifting forearm and hand are redrawn, in exactly the same position and pose. Today that hand is blurred and greenish, and it stands out between two sharp drawings.
   - Make it crisp, in the same flat cartoon style as the hand in green_rx_B39: thick even outline, flat skin colour with one shadow tone.
   - No green or grey tint anywhere on the skin.

4. out/rx_A52.png: an EDIT of green_rx_A52 in which ONLY the eye whites change. Remove the faint grey rings beside the pupils so the whites are clean, like the eyes in green_rx_A53. Pupils, outlines and everything else stay pixel for pixel.

5. out/rx_K1_B36.png: an EDIT of green_rx_K1_B36 in which ONLY the hammer's metal head changes. Its outline is stair-stepped and jagged; give it a smooth, clean outline of the same shape, size, angle and colours.

WHAT MUST NOT CHANGE in each: everything outside the named part, pixel for pixel as in the input. That covers her face (no glasses, round white eyes with dot pupils), hair, headband, earrings, pendant, tank top, the other arm, cargo shorts, boots, the wooden box and the green background. Same frame, position and size. Same flat cartoon style: thick even outlines, flat colour with one shadow tone.

GENERAL RULES (automated job, do it in one go, ask no questions):
- Use $imagegen (the built-in image_gen tool) to EDIT the named input, using the neighbouring drawings as references. Never draw from scratch, never use SVG/HTML/code.
- After each edit, check with Python that nothing outside the named part changed from the input. If it did, paste the input back over everything else, with a soft edge that leaves no seam. Check the arm and hammer sit between the two references.
- No glasses on Rachel, ever.
- At most 2 attempts per output.
- Save PNGs, 1536x1024, in ./out/ with exactly these names.
- Then write ./out/report.md: one honest line per file, plus the QC subagent's verdict per file.

You are Quinn, illustrator for HJaaS. These are Rachel's Build drawings (no glasses, approved), on flat green #00FF00, 1536x1024. Some steps of her movement jump too far between two drawings, so the motion looks jerky. Draw the missing in-betweens.

The hammer swing:
- in/green_frame_01.png: hammer resting on the box (contact).
- in/green_frame_02.png: hammer just lifted.
- in/green_frame_03.png: hammer raised high behind her head (wind-up).

The thumbs-up (reaction to a find):
- in/green_K1.png: smiling at the viewer, hands on the hammer and box.
- in/green_rx_B36.png: her arm partway up.
- in/green_rx_B39.png: thumbs up.

Make these 5 drawings:
1. out/frame_01_02.png: an EDIT of green_frame_01 in which ONLY her hammer arm, hand and the hammer move, to exactly halfway between frame_01 and frame_02.
2. out/frame_02_03a.png: an EDIT of green_frame_02 in which ONLY her hammer arm, hand and the hammer move, one third of the way from frame_02 to frame_03.
3. out/frame_02_03b.png: the same, two thirds of the way from frame_02 to frame_03.
4. out/K1_B36.png: an EDIT of green_K1 in which ONLY the arm that lifts (and its hand) moves, exactly halfway between K1 and rx_B36.
5. out/B36_B39.png: an EDIT of green_rx_B36 in which ONLY that arm and hand move, exactly halfway between rx_B36 and rx_B39.

"Halfway" / "a third" means everything along the natural curved path: shoulder, elbow, wrist, hand, fingers and the hammer's position and angle. The hammer keeps its exact shape, size and colours (wooden handle, yellow grip band, metal head).

WHAT MUST NOT CHANGE in each: everything except the named arm, hand and hammer, pixel for pixel as in the input: her face (no glasses, round white eyes with dot pupils), hair, headband, earrings, pendant, tank top, other arm, cargo shorts, boots, the wooden box and the green background. Same frame, position and size. Same flat cartoon style: thick even outlines, flat colour with one shadow tone.

GENERAL RULES (automated job, do it in one go, ask no questions):
- Use $imagegen (the built-in image_gen tool) to EDIT the named input, using the two neighbouring drawings as references. Never draw from scratch, never use SVG/HTML/code.
- After each edit, check with Python that nothing outside the arm, hand and hammer changed from the input; if it did, paste the input back over everything else. Check the arm and hammer sit between the two references.
- No glasses on Rachel, ever.
- Max 2 attempts per output. Save PNGs 1536x1024 in ./out/ with exactly these names, then write ./out/report.md: one honest line per file.

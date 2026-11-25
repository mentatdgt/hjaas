You are Quinn, illustrator for HJaaS. These are Rachel's Build drawings (no glasses, approved), on flat green #00FF00, 1536x1024. One step of her hammer swing still jumps too far. Draw ONE in-between. Use an independent QC subagent at the end (see AGENTS.md).

- in/green_frame_02_03a.png: hammer hand at the right side of her chin, hammer up beside her face.
- in/green_frame_02_03b.png: arm raised over her head, hand above her forehead, hammer head high. (This is the drawing you redid in job 038.)
- in/green_frame_03.png: the wind-up, for reference.

Make out/frame_02_03ab.png: an EDIT of green_frame_02_03a in which ONLY her hammer arm, hand and the hammer move, to exactly halfway between frame_02_03a and frame_02_03b.
- **Path:** the hand travels up the side of her head on the viewer's right. At this halfway point the fist is beside her temple, at about eye-to-brow height, OUTSIDE the outline of her face. Her elbow is raised and out to the side, and the hammer head points up beside her head.
- **Her face:** both eyes, the brows, the nose and the mouth stay fully visible and pixel-identical to the input. No part of the arm, hand or hammer may cover them.
- **The hammer:** it keeps its exact shape, size and colours (wooden handle, yellow grip band, metal head). Its angle is halfway between the two drawings.

WHAT MUST NOT CHANGE: everything except that arm, hand and hammer, pixel for pixel as in the input. That covers her face (no glasses, round white eyes with dot pupils), hair, headband, earrings, pendant, tank top, the other arm, cargo shorts, boots, the wooden box and the green background. Same frame, position and size. Same flat cartoon style: thick even outlines, flat colour with one shadow tone.

GENERAL RULES (automated job, do it in one go, ask no questions):
- Use $imagegen (the built-in image_gen tool) to EDIT the input, using the two neighbouring drawings as references. Never draw from scratch, never use SVG/HTML/code.
- After the edit, check with Python that nothing outside the arm, hand and hammer changed from the input. If it did, paste the input back over everything else, with a soft edge that leaves no seam.
- Check that the hand and the hammer head sit about halfway between the two references.
- No glasses on Rachel, ever.
- At most 3 attempts.
- Save out/frame_02_03ab.png, 1536x1024. Then write ./out/report.md: an honest line on the result, plus the QC subagent's verdict.

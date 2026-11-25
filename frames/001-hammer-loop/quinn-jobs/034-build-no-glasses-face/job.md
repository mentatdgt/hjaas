You are Quinn, illustrator for HJaaS. In the Build scene, Rachel was drawn wearing round glasses, but the rule for the whole site is: Rachel NEVER wears glasses. in/green_K1.png is her key pose in Build (hammering a box, smiling at the viewer), on flat green #00FF00, 1536x1024. in/model_sheet.png is her approved model sheet: her eyes are round white eyes with dot pupils, no lashes or eyeliner, no glasses.

Make out/K1_noglasses.png: an EDIT of in/green_K1.png in which ONLY her glasses are removed:
- Remove the glasses completely: both rims, the bridge over the nose, and the arms running back over her temples and ears. Where the glasses were, show what is under them: skin, eyebrows, hair, exactly in the colours around them.
- Her eyes stay the same size, place and gaze (looking at the viewer, happy), drawn as in the model sheet: round white eyes with a dark dot pupil and the same outline weight as the rest of her face. No lashes, no eyeliner, no new glasses of any kind.
- EVERYTHING else stays pixel for pixel as in the input: her face shape, smile, eyebrows, hair, headband, earrings, pendant, tank top, arms, hammer, box, cargo shorts, boots, and the green background. Same frame, same position and size.
- Same flat cartoon style (round white eyes, thick even outlines, flat colour with one shadow tone).

GENERAL RULES (automated job, do it in one go, ask no questions):
- Use $imagegen (the built-in image_gen tool) to EDIT in/green_K1.png, using in/model_sheet.png as the reference for her eyes. Never draw from scratch, never use SVG/HTML/code to draw her.
- After the edit, compare with in/green_K1.png (Python or ffmpeg): outside her eyes and the old glasses it must be unchanged. If anything else changed, paste the input back over everything except the eye/glasses area.
- Max 3 attempts. Save the best as out/K1_noglasses.png (1536x1024 PNG), then write out/report.md: one honest line per attempt.

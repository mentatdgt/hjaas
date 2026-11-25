You are Quinn, illustrator for HJaaS. In job 034 you removed Rachel's glasses from her Build key pose; the user's rule is that Rachel never wears glasses. in/approved_eyes_K1.png is that approved result (a crop of her face): round white eyes, dark dot pupils, even black outline, no rims, no bridge, no lashes. Now do the same for the other distinct expressions in the Build scene.

Each in/green_<name>.png is one Build drawing on flat green #00FF00, 1536x1024. For EACH of these 10 files, make out/<name>_noglasses.png: an EDIT of that file in which ONLY the glasses are removed and the eyes are redrawn in the approved style:
1. green_frame_01: head tilted down, eyes looking down-right at the hammer.
2. green_blink_half: eyes half closed (heavy lids), same head.
3. green_blink_closed: eyes closed, same head.
4. green_rx_A24: head still down, eyes glancing up at the viewer.
5. green_rx_A25: eyes further up at the viewer.
6. green_rx_A49: head turning up towards the viewer (in between).
7. green_rx_A52: squinting as the smile pops.
8. green_rx_A53: facing the viewer, eyes wide and happy.
9. green_rx_wink: one eye open, the other winking closed.
10. green_rx_wink_half: the winking eye half closed.

For every file:
- Remove the glasses completely (both rims, the bridge over the nose, the arms over the temples, any eyelash strokes on the rims). Fill what was under them with the surrounding skin, eyebrow and hair colours.
- Keep each eye's own state exactly as in that drawing: where it looks, how open or closed it is, lid shape, squint, wink. Same size and place.
- Draw open eyes exactly like in/approved_eyes_K1.png and the model sheet (in/model_sheet.png): round white eyes, dark dot pupils, the same outline weight. Closed or half-closed eyes are simple lid lines in the same outline weight, no lashes. No eyeliner, no glasses of any kind.
- EVERYTHING else stays pixel for pixel as in that input: face, eyebrows, nose, mouth, hair, headband, body, arms, hands, hammer, box, background. Same frame, position and size.

GENERAL RULES (automated job, do it in one go, ask no questions):
- Use $imagegen (the built-in image_gen tool) to EDIT each input, with in/approved_eyes_K1.png and in/model_sheet.png as the style reference for the eyes. Never draw from scratch, never use SVG/HTML/code.
- After each edit, composite only the eye and old-glasses area back onto the original input, as you did in job 034, and check with Python that nothing outside that area changed.
- Keep the eyes consistent across all 10: same white, outline weight and pupil size as the approved K1 eyes.
- Max 2 attempts per file. Save PNGs 1536x1024 in ./out/ with exactly these names, then write ./out/report.md: one honest line per file.

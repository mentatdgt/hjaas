You are Quinn, illustrator for the HJaaS theatre scene. The in/green_*.png images are your approved green-screen cut-outs of Rachel on the ladder (job 022f), all in the same 1024x1024 frame:
- green_A1: at rest, brush raised;
- green_A2_stroke_low: the brush brought down in a low stroke;
- green_A3_stroke_out: the arm stretched far out;
- green_B2_dip: dipping the brush in the pot on the ladder;
- green_K1_salute: the brush raised to her face in a salute.

On the website she cuts straight from one of these to the next, and her brush hand jumps: the user finds it jerky. Draw IN-BETWEENS, so her hand moves smoothly from one pose to the next.

Every in-between is an EDIT of in/green_A1.png in which ONLY her brush arm (the right arm, from the shoulder down), her hand and the brush change. Her head, face, hair, pendant, torso, other arm, trousers, boots and the green background stay exactly as in green_A1 (I only use the arm and brush from your drawings). The arm is placed part of the way between green_A1's arm and the target pose's arm, as given, following a natural, curved path (elbow leads, wrist follows), with the brush held the same way.

Make these 11 drawings:
1. out/T_A1_A2_1.png: 1/3 of the way from green_A1's arm to green_A2_stroke_low's arm.
2. out/T_A1_A2_2.png: 2/3 of the way from A1 to A2.
3. out/T_A2_A3_1.png: 1/4 of the way from green_A2_stroke_low's arm to green_A3_stroke_out's arm.
4. out/T_A2_A3_2.png: halfway from A2 to A3.
5. out/T_A2_A3_3.png: 3/4 of the way from A2 to A3.
6. out/T_A1_B2_1.png: 1/4 of the way from green_A1's arm to green_B2_dip's arm (the brush going down towards the pot).
7. out/T_A1_B2_2.png: halfway from A1 to B2.
8. out/T_A1_B2_3.png: 3/4 of the way from A1 to B2.
9. out/T_A1_K1_1.png: 1/4 of the way from green_A1's arm to green_K1_salute's arm (the brush coming up towards her face).
10. out/T_A1_K1_2.png: halfway from A1 to K1.
11. out/T_A1_K1_3.png: 3/4 of the way from A1 to K1. The brush must not cover her face.

WHAT MUST NOT CHANGE: everything except the brush arm, hand and brush, as above. Same frame (1024x1024), same position and size, flat pure green #00FF00 background. Her arm is drawn in the same style as the cut-outs: same skin tone, outline, shading and the same brush (wooden handle, blue paint on the bristles). No glasses, ever.

GENERAL RULES (automated job, do it in one go, ask no questions):
- Use $imagegen (the built-in image_gen tool) to EDIT in/green_A1.png for every output, using the two named poses as references for where the arm goes. Never draw from scratch, never use SVG/HTML/code.
- After each edit, check that the head, face and hair are unchanged from green_A1 (for example with ffmpeg). If they changed, paste green_A1 back over everything except the arm and brush.
- Save each output as PNG in ./out/ with exactly the name given (copy from ~/.codex/generated_images/... if needed), at 1024x1024.
- Also save ./out/T_contact_sheet.png: the three sequences in order (A1, T_A1_A2_1, T_A1_A2_2, A2, T_A2_A3_1..3, A3 / A1, T_A1_B2_1..3, B2 / A1, T_A1_K1_1..3, K1).
- Max 2 attempts per output. Then write ./out/report.md: one honest line per file.

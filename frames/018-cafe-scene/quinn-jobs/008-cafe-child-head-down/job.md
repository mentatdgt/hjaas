You are Quinn, illustrator for the HJaaS café scene.

INPUTS
- in/1_child_green.png: a boy colouring with a green crayon at a café table, on green. THIS is the image to edit.
- in/2_child_in_scene.png: the same crop in the café, so you can see the paper on the table in front of him and below his hands.
- in/3_eyes_reference.png: an earlier try where only his eyes looked down. It looked wrong because his HEAD still faced sideways. Use it only for how the lowered eyelids and closed mouth look.

TASK: make him look naturally focused on his drawing.
- Tilt his whole head forward and down, about 15-20 degrees, so his face points at the paper under his crayon (down and slightly to his left, our right). His hair moves with his head naturally.
- Eyes looking down at the paper: lowered upper eyelids, pupils low, aimed at the paper (like in/3).
- Mouth closed in a small, content smile.
- The neck, shoulders, shirt, arms, hands and crayon stay EXACTLY as they are. Only the head (face, ears and hair) changes.
- Same drawing style, line colour and painted shading as the original.

OUTPUTS (1024x1536, flat #00FF00 background):
- out/C_1_head_down_a.png and out/C_1_head_down_b.png: two attempts of the same request.

GENERAL RULES (automated job, do it in one go, ask no questions):
- Use $imagegen (the built-in image_gen tool) to EDIT in/1_child_green.png. Do not draw with SVG, HTML or code.
- The green background stays flat #00FF00, with no shadows on it.
- Save each output as PNG in ./out/ with exactly the given name (copy from ~/.codex/generated_images/... if needed).
- Max 2 attempts per output. Then write ./out/report.md: one honest line per file.

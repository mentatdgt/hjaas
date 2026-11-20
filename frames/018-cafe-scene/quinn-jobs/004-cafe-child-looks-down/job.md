You are Quinn, illustrator for the HJaaS café scene.

INPUTS
- in/1_child_green.png: a boy colouring with a green crayon at a café table, on green. THIS is the image to edit.
- in/2_child_in_scene.png: the same crop in the café, so you can see the paper on the table in front of him.

PROBLEM: he is colouring while looking off to the side with his mouth open. That looks wrong.
TASK: change ONLY his eyes and mouth so he is focused on his drawing:
- He looks DOWN at the paper under his crayon: his upper eyelids come down over the top third of each eye (a natural, relaxed downward look, not sleepy), and the pupils sit low in the eyes, aimed at the paper.
- Mouth closed in a small, content smile.
- Draw the eyes and eyelids in exactly the same style, line weight and colours as his current eyes and face. It must look like the same artist drew it.
KEEP EXACTLY: his head angle and position, face shape, eyebrows, nose, ears, hair, shirt, arms, hands, crayon, everything else. Only the eyes and mouth change.

OUTPUTS (1024x1536, flat #00FF00 background):
- out/C_1_down_a.png and out/C_1_down_b.png: two attempts of the same request.

GENERAL RULES (automated job, do it in one go, ask no questions):
- Use $imagegen (the built-in image_gen tool) to EDIT the attached images. Do not draw with SVG, HTML or code.
- Each output is an edit of the input named, not a new drawing. Keep the canvas size of the input (1024x1536 portrait unless stated).
- Background that is flat pure green #00FF00 must stay flat #00FF00: no shadows, gradients or texture on it.
- Save every output as PNG in ./out/ with exactly the file name given. The image tool saves to ~/.codex/generated_images/...: copy the chosen result into ./out/ under the right name.
- Max 2 attempts per output. Then write ./out/report.md: one line per file saying what changed and anything that is not right. Be honest.

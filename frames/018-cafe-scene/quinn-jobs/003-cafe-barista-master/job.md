You are Quinn, illustrator for the HJaaS café scene.

INPUTS
- in/1_barista_green.png: the barista (young Indian woman, deep brown skin, long dark hair with curtain bangs, silver hoops, white top, dark apron, polishing a white cup with a white cloth) on green. THIS is the image to edit.
- in/2_barista_in_scene.png: the same crop with the café behind her. Problem: she looks pasted in. Her black outlines and flat colours stand out against the warm painted café.
- in/3_scene_style.png: the café's own characters (child, mum). THIS is the target look.

TASK: re-render the barista so she looks painted by the same artist as in/3, in the café's warm afternoon light.
KEEP EXACTLY (same position, size and shape): her pose and silhouette, face shape, the round white eyes with small dot pupils looking down at the cup (no lashes), eyebrows, nose, mouth, hair outline and big shapes, hoops, top, apron, the cup, the cloth, her hands. The counter edge stays where it is.
CHANGE ONLY THE RENDERING:
1. Outlines: dark warm brown, a little thinner, like the child's and mum's (not black).
2. Shading: soft painted shading with gentle gradients, like in/3. Warm light from the upper left; soft warm shadow on the right.
3. Colours: warmer and softer so her skin, hair, top and apron sit in the same palette as in/3. Keep her skin a warm deep brown. Hair: soft painted highlights, but keep the outline and big shapes.

OUTPUTS (1024x1536, flat #00FF00 background):
- out/B_1_master_a.png: a subtle version.
- out/B_1_master_b.png: a stronger version (fully matching in/3).

GENERAL RULES (automated job, do it in one go, ask no questions):
- Use $imagegen (the built-in image_gen tool) to EDIT the attached images. Do not draw with SVG, HTML or code.
- Each output is an edit of the input named, not a new drawing. Keep the canvas size of the input (1024x1536 portrait unless stated).
- Background that is flat pure green #00FF00 must stay flat #00FF00: no shadows, gradients or texture on it.
- Save every output as PNG in ./out/ with exactly the file name given. The image tool saves to ~/.codex/generated_images/...: copy the chosen result into ./out/ under the right name.
- Max 2 attempts per output. Then write ./out/report.md: one line per file saying what changed and anything that is not right. Be honest.

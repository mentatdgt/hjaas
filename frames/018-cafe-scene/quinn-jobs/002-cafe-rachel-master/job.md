You are Quinn, illustrator for the HJaaS café scene.

INPUTS
- in/1_rachel_green.png: Rachel (cartoon woman sketching on a tablet) on green. THIS is the image to edit.
- in/2_rachel_in_scene.png: the same crop with the café behind her. Problem: she looks pasted in. Her black outlines, flat colours and cool shading stand out against the warm painted café.
- in/3_scene_style.png: the café's own characters (child, mum). THIS is the target look.

TASK: re-render Rachel so she looks painted by the same artist as in/3 and lit by the same warm afternoon light coming from the windows on the left.
KEEP EXACTLY (same position, size and shape): her pose and silhouette, face shape, the round white eyes with small dot pupils (no lashes, no glasses), eyebrows, nose, smile, hair outline and its big shapes, pendant, black tank top, olive cargo trousers, boots, the tablet, stylus, cup and saucer, the marble table and the rattan chair.
CHANGE ONLY THE RENDERING:
1. Outlines: dark warm brown, a little thinner, like the child's and mum's (not black, not thick).
2. Shading: soft painted shading with gentle gradients, like in/3. Warm golden light on the left side of her face, arms and hair; soft warm-brown shadow on the right.
3. Colours: warmer and slightly softer so her skin, hair, top and trousers sit in the same palette as in/3. Hair: soft painted highlights, but keep the hair's outer outline and big shapes as they are.
4. Table and chair: rendered like the café's other marble tables and rattan chairs in in/2.

OUTPUTS (1024x1536, flat #00FF00 background):
- out/R_A1_master_a.png: a subtle version (closest to the current drawing).
- out/R_A1_master_b.png: a stronger version (fully matching in/3).

GENERAL RULES (automated job, do it in one go, ask no questions):
- Use $imagegen (the built-in image_gen tool) to EDIT the attached images. Do not draw with SVG, HTML or code.
- Each output is an edit of the input named, not a new drawing. Keep the canvas size of the input (1024x1536 portrait unless stated).
- Background that is flat pure green #00FF00 must stay flat #00FF00: no shadows, gradients or texture on it.
- Save every output as PNG in ./out/ with exactly the file name given. The image tool saves to ~/.codex/generated_images/...: copy the chosen result into ./out/ under the right name.
- Max 2 attempts per output. Then write ./out/report.md: one line per file saying what changed and anything that is not right. Be honest.

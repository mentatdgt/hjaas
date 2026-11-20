You are Quinn, illustrator for the HJaaS café scene.

INPUTS
- in/1_fan_drawn.png (1536x1024): your hand-drawn ceiling fan in the café. THIS is the image to edit.
- in/2_fan_green.png: the same fan alone on green, for reference.

The blades will be animated separately, so I need the fan's centre WITHOUT any blades.
TASK: one output, an EDIT of in/1_fan_drawn.png:
- out/hub_green.png (1536x1024): only the downrod, the motor casing, the ring/collar and the round lower cap with its small hole, in exactly the same place, size, shape and drawing style as now (same dark warm outline, same simple flat bronze tones, no extra gloss or realism). Remove all three blades AND their metal brackets completely. Where a blade or bracket covered part of the casing, collar or cap, draw that part in so the casing is a complete, clean, symmetrical shape. EVERYTHING else (ceiling, beams, background) becomes flat pure green #00FF00.

GENERAL RULES (automated job, do it in one go, ask no questions):
- Use $imagegen to EDIT in/1_fan_drawn.png. Do not draw with SVG, HTML or code. Keep it 1536x1024, with a flat #00FF00 background and no shadows on it.
- Save as PNG in ./out/ with exactly that name (copy from ~/.codex/generated_images/... if needed). Max 2 attempts. Then write ./out/report.md: one honest line.

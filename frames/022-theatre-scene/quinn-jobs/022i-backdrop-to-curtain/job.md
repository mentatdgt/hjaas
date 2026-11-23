You are Quinn, illustrator for the HJaaS theatre scene. in/plate.png is the approved theatre stage (Rachel removed) with the backdrop's bare right-hand part; in/plate_finished.png is the same stage with the backdrop fully painted. Both are 1536x1024.

THE PROBLEM: between the backdrop's right edge and the red curtain there is a dark slot (marked magenta in in/guide_plate_slot.png and in/guide_plate_finished_slot.png; exact area = white in in/slot_mask.png). A stagehand walks behind the backdrop, and in that slot he would be seen whole, which we don't want.

THE FIX: make the backdrop wider so it runs behind the curtain. Paint ONLY inside the white area of in/slot_mask.png:
1. out/plate_ext.png: an edit of in/plate.png. Continue the bare cream canvas into the slot, with the same texture, soft vertical folds and warm light, and carry the faint pencil lines (the cloud line, the hill line and the tree line) on to the curtain. The backdrop's old right edge (its outline) disappears: the canvas simply continues until it goes behind the curtain.
2. out/plate_finished_ext.png: an edit of in/plate_finished.png. Continue the painted landscape (sky, clouds, the far hills, the yellow-green trees) into the slot in the same painting style and colours, so it runs on behind the curtain.
In both: the backdrop's bottom edge (its hem, at about y = 630) continues straight across the slot at the same height and with the same look, until it meets the curtain. Below the hem, the dark gap and the floor stay exactly as they are.

WHAT MUST NOT CHANGE: everything outside the white area of slot_mask.png: the curtain and its gold tassel and rope, the lamp, the paint cart and brushes, the rest of the backdrop, the floor. Same size (1536x1024), same framing.

GENERAL RULES (automated job, do it in one go, ask no questions):
- Use $imagegen (the built-in image_gen tool) to EDIT the named in/ image, with in/slot_mask.png as the edit mask if the tool accepts one. Never draw from scratch, never use SVG/HTML/code.
- Save each output as PNG in ./out/ with exactly the name given (copy from ~/.codex/generated_images/... if needed), at 1536x1024.
- Max 2 attempts per output. Then write ./out/report.md: one honest line per file.

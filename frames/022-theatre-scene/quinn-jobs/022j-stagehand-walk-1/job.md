You are Quinn, illustrator for the HJaaS theatre scene. in/stagehand_sheet.png is the stagehand you designed (job 021h): a friendly middle-aged contractor with short grey-brown hair, round glasses, stubble, a grey T-shirt, a brown tool belt with a tape measure, light-wash jeans and tan work boots.

In the scene he walks behind the theatre backdrop. Under its hem only his boots show (that walk is done: the boots in these images are those exact walk drawings). Near the curtain there is a gap where his WHOLE BODY is seen for a moment, so now draw his whole body walking, standing in those boots.

Each in/BNN_boots.png is a 1024x1536 green canvas with his two boots already placed exactly where they are at one moment of his stride, walking LEFT. The darker boot is his far leg; the brighter boot is his near leg. Draw him standing in those boots, in that moment of the walk.

DO THIS ORDER:
1. out/B05.png FIRST (the passing pose: feet side by side, near leg upright under him, far leg passing). This is the master: him in full, in profile facing LEFT, as on the sheet's walking poses.
2. Then B01, B02, B03, B04, B06, B07, B08: each an EDIT of in/BNN_boots.png for that pose, using your out/B05.png as the reference for his look, so he is the same man in every pose (same face, glasses, hair, shirt, belt, jeans, size and line style). Only his legs, arms and a slight up-down of the body change between poses.

HOW HE MOVES (an ordinary, purposeful walk):
- The legs go INTO the boots exactly as placed: the near leg into the bright boot, the far leg into the dark boot. The leg whose boot is flat on the floor is nearly straight and carries his weight; the leg whose boot is lifted bends at the knee.
- Arms swing opposite to the legs: when the near leg is forward, the near arm is back, and the other way round. Relaxed hands, empty (no plank, no rope).
- Torso upright, leaning very slightly forward. Head in profile looking LEFT, where he's going, calm, mouth closed.
- His body is lowest just after a heel lands (B02, B03) and highest when the back foot pushes off (B07, B08). Only about 2% of his height up or down.

WHAT MUST NOT CHANGE:
- The two boots: their position, shape, angle and colour. Only paint where in/BNN_mask.png is white (the mask protects the boots). The jeans above each boot cuff may be repainted to join his legs.
- Canvas 1024x1536, flat pure green #00FF00 background, no shadow, no floor drawn. The boots' soles stay on y = 1490.
- His size: about 1400 px tall from sole to the top of his head (as the boots imply: each boot is about 1/6 of his height).
- The style: like the sheet, but painted to match the boots (the same soft shading and line weight).

GENERAL RULES (automated job, do it in one go, ask no questions):
- Use $imagegen (the built-in image_gen tool) to EDIT the named in/ image (with its mask if the tool accepts one). Never draw from scratch, never use SVG/HTML/code.
- Save each output as PNG in ./out/ with exactly the names B01.png ... B08.png (copy from ~/.codex/generated_images/... if needed), at 1024x1536.
- Also save ./out/B_contact_sheet.png: B01 to B08 side by side, in order.
- Max 2 attempts per output. Then write ./out/report.md: one honest line per file (same man? legs in the boots? boots unchanged?).

You are Quinn, illustrator for the HJaaS theatre scene. Round 2 of job 022k (the second step of the stagehand's walk, B09 to B16). Your first round had the right man but three faults, so it can't be used. Please redo all eight.

THE FAULTS TO FIX:
1. THE BOOTS MOVED. In every pose the two boots must stay EXACTLY as they are in in/BNN_boots.png: same pixels, same place. Round 1 redrew and shifted them (B11, B13, B14 worst). Only paint where in/BNN_mask.png is white. I will paste the original boots back over your drawing, so his legs MUST line up with the boots exactly where they are in in/BNN_boots.png, not where you would prefer them.
2. THE ARMS. Arms swing opposite to the legs. In these eight the bright boot (near leg) is the one swinging from behind to in front, so the NEAR ARM goes from FORWARD (B09, B10, B11) through hanging down (B12, B13) to BACK (B14, B15, B16). Round 1's B10 had it backwards. Arm swing stays ordinary and relaxed: hands no higher than his belt (round 1's B15 reached far too high).
3. THE BOB. His body is lowest just after the dark boot's heel lands (B10, B11: about 25 px lower than in B13) and highest when the bright boot pushes off and the dark boot rises onto its toe (B15, B16: about 25 px higher than in B13). Round 1 kept his head at the same height throughout. in/ref_B01.png, in/ref_B03.png and in/ref_B07.png (the approved first step) show the same rise and fall.

KEEP: the same man as in/B05_master.png (face, glasses, pencil, hair, shirt, belt, jeans, size, line style, shading), walking LEFT in profile, calm, mouth closed, hands empty. Canvas 1024x1536, flat pure green #00FF00, no shadow, soles on y = 1490. The darker boot is his far leg, the bright boot his near leg.

GENERAL RULES (automated job, do it in one go, ask no questions):
- Use $imagegen (the built-in image_gen tool) to EDIT in/BNN_boots.png with in/BNN_mask.png as the mask (white = may paint), using in/B05_master.png as the reference for his look. Never draw from scratch, never use SVG/HTML/code.
- After each edit, CHECK the boots: compare your output with in/BNN_boots.png inside the black area of the mask (for example with ffmpeg). If they differ, paste the original boots back from in/BNN_boots.png and make sure the legs still meet them; if they don't, redo that pose.
- Save B09.png ... B16.png in ./out/ at 1024x1536 (copy from ~/.codex/generated_images/... if needed), and ./out/B_contact_sheet.png with the eight in order.
- Max 2 attempts per output. Then write ./out/report.md: one honest line per file (boots identical? arms right? height?).

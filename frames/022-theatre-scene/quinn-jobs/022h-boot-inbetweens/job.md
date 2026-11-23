You are Quinn, illustrator for the HJaaS theatre scene. in/W01_contact.png ... in/W08_late_swing.png are your 8 walk-cycle drawings of the stagehand's boot from job 022g (approved). They work, but 8 drawings per step make the walk look jerky. Draw the 8 IN-BETWEENS, so the cycle has 16 drawings.

Each in-between sits exactly halfway between its two neighbours: halfway in the foot's angle, the ankle bend, the crease, the lift, and the shin and cuff's lean. Make each one as an EDIT of the first neighbour named, moving it halfway towards the second.

1. out/W01b.png: halfway from W01_contact to W02_flat. Heel on the floor, toe up about 7°, the shin leaning back a little less than in W01.
2. out/W02b.png: halfway from W02_flat to W03_midstance. Foot flat on the floor, the shin leaning back about 5°.
3. out/W03b.png: halfway from W03_midstance to W04_heel_rise. Foot still flat, heel just about to lift, the shin leaning forward about 9°.
4. out/W04b.png: halfway from W04_heel_rise to W05_toe_off. Heel up about 28°, on the ball and toe, the crease at the ball deeper, the shin leaning forward about 25°.
5. out/W05b.png: halfway from W05_toe_off to W06_early_swing. The toe tip just off the floor (lowest point about 15 px above y = 880), foot steep (about 30° toe down), the shin leaning forward.
6. out/W06b.png: halfway from W06_early_swing to W07_mid_swing. Lifted (lowest point about 70 px above y = 880), toe down about 8°.
7. out/W07b.png: halfway from W07_mid_swing to W08_late_swing. Lifted (lowest point about 55 px above y = 880), toe up about 5°, the shin starting to lean back.
8. out/W08b.png: halfway from W08_late_swing to W01_contact. The heel just above the floor (lowest point about 12 px above y = 880), toe up about 13°, the shin leaning back.

WHAT MUST NOT CHANGE: everything about the boot and jeans as in your 022g drawings: design, colours, laces, stitching, the dark lug sole, the single rolled cuff, line weight, shading and size. Plain side view, toe to the LEFT.

LAYOUT (exactly as in 022g, so all 16 line up):
- Canvas 1024x1024, flat pure green #00FF00, no shadow, no floor line drawn.
- The floor is at y = 880. In W01b, W02b, W03b and W04b, whatever touches the floor touches y = 880 exactly; in W05b to W08b the lowest point is the height given above.
- The ankle (the middle of the cuff's bottom edge) stays near x = 560. Jeans shown up to about 330 px above the cuff, cut off flat, as in 022g.

GENERAL RULES (automated job, do it in one go, ask no questions):
- Use $imagegen (the built-in image_gen tool) to EDIT the named in/ drawing for every output. Never draw from scratch, never use SVG/HTML/code.
- Save each output as PNG in ./out/ with exactly the name given (copy from ~/.codex/generated_images/... if needed).
- Also save ./out/W16_contact_sheet.png: all 16 in cycle order (W01, W01b, W02, W02b, ... W08, W08b) on green, each with a thin grey line at y = 880.
- Max 2 attempts per output. Then write ./out/report.md: one honest line per file (is it truly halfway? does the boot still match?).

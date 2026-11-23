You are Quinn, illustrator for the HJaaS theatre scene. in/boot_base.png is the approved stagehand's boot (your own design from job 022d): a tan leather work boot with dark laces and a dark lug sole, under a rolled jean cuff, seen from the side, toe pointing LEFT, on flat green.

The stagehand walks behind a theatre backdrop. Only his boots show, in the dark gap under its hem (see in/scene_context.png). Today the boot is one picture slid and tilted along the floor, and it looks stiff and unnatural. Draw one boot's full WALK CYCLE, so the foot really flexes: the ankle bends, the boot creases at the ball of the foot as the heel lifts, and the jean cuff tilts and sways with the shin.

Make these 8 poses, in order. in/walk_guide.png shows each one as a diagram: the sole's angle (blue), the shin's lean (orange, the cuff follows it), and what touches the floor (red).

1. out/W01_contact.png: heel strike. Only the heel on the floor, toe up about 15°. The leg reaches forward, so the shin leans back (its top towards the right).
2. out/W02_flat.png: the foot flat on the floor, taking the weight. The shin leans back a little.
3. out/W03_midstance.png: the foot flat, the shin upright.
4. out/W04_heel_rise.png: the heel lifting about 14°. The ball of the foot and the toe stay flat on the floor, and the leather creases across the ball of the foot. The shin leans forward (its top towards the left).
5. out/W05_toe_off.png: only the toe tip on the floor, the foot steep (about 40°), the heel high. The shin leans well forward.
6. out/W06_early_swing.png: the boot lifted off the floor, toe pointing down about 20°, the ankle relaxed. The shin leans forward a little.
7. out/W07_mid_swing.png: the boot lifted, nearly level, passing under the body. The shin about upright.
8. out/W08_late_swing.png: the leg reaching forward, toe up about 10°, about to land heel first. The shin leans back.

WHAT MUST NOT CHANGE: the boot's design (shape, tan colour, stitching, laces and eyelets, the dark lug sole), the jeans' colour and the single rolled cuff, the line weight and colour, the soft shading, and the size: the boot is the same size in every pose as in boot_base.png. The view stays a plain side view, toe to the LEFT. Only the pose changes: the foot's angle, the ankle bend, the crease at the ball, and the cuff's tilt.

LAYOUT (the same for all 8, so I can line them up):
- Canvas 1024x1024, flat pure green #00FF00 background, no shadow, no floor line drawn.
- The floor is at y = 880. In poses 1 to 5, whatever touches the floor touches y = 880 exactly. In poses 6, 7 and 8, the lowest point of the sole is about 60, 80 and 30 px above y = 880.
- The boot's ankle (the middle of the cuff's bottom edge) stays near x = 560 in every pose.
- Show the jeans up to about 330 px above the cuff, cut off flat at the top of the image area like boot_base.png; nothing else (no other leg, no body).

GENERAL RULES (automated job, do it in one go, ask no questions):
- Use $imagegen (the built-in image_gen tool) to EDIT in/boot_base.png for every output, so the design stays identical. Never draw from scratch, never use SVG/HTML/code.
- in/walk_guide.png and in/scene_context.png only explain the poses and where the boot is seen. Don't copy anything from them into the drawings.
- Save each output as PNG in ./out/ with exactly the name given (copy from ~/.codex/generated_images/... if needed).
- Also save ./out/W_contact_sheet.png: the 8 poses side by side in order, on green, each with a thin grey line at y = 880.
- Max 2 attempts per output. Then write ./out/report.md: one honest line per file (does the pose match the guide? does the boot still match boot_base.png?).

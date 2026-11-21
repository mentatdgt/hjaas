You are "Quinn", the illustrator for the HJaaS project. This is an automated job: do it in one go, ask no questions, and save files exactly as named.

INPUT (attached, also in ./in/): in/plate_car.png, 1536x1024: part of a cartoon night scene, a silver electric car parked side-on (its tail on our left, its nose on our right). Two small RED TRIANGLE markers have been added: one on the wall just above the roof, one on the paving just below the sill. Both point at the same x position, x = 797 px, which is exactly halfway between the centres of the two wheels.

PROBLEM: the front door is far too long. The line between the front and rear doors (and the window pillar above it) sits too far back, close to the rear wheel.

TASK: use $imagegen to EDIT in/plate_car.png:
1. Move the split between the front and rear doors to x = 797 px, exactly where the red markers point. The vertical door seam on the body and the dark window pillar (B-pillar) between the two side windows both sit on that line, from the roof down to the sill. Remove the old seam and the old pillar completely, filling them with the body's silver and the window's dark glass.
2. The front door now runs from the new seam forward to the windscreen's base; the rear door runs from the new seam back toward the rear wheel. Both are roughly equal in length.
3. Move each door handle to the rear part of its own door, at the same height as now: the front door's handle just in front of the new seam, and the rear door's handle a little in front of the rear door's rear edge.
4. REMOVE both red triangle markers completely, restoring the wall and the paving behind them.

KEEP EXACTLY AS THEY ARE: both wheels and their red brake callipers, the wheel arches, the black sill and lower trim, the nose, the bonnet, the windscreen, the roofline, the tail and its red light bar, the door mirror, the car's colours, its reflections and the warm light from the left, and everything that isn't the car. Same thick dark outlines and flat colour style. No badges, no text. Same canvas, 1536x1024.

RULES
- The output is an edit of in/plate_car.png, not a new drawing.
- Save exactly a 1536x1024 PNG named out/plate_car.png in ./out/. If the image tool writes elsewhere, copy the file there under that name.
- Then write ./out/report.md: one line saying where the new seam is (x px), and anything that isn't right. Be honest; max 2 attempts.

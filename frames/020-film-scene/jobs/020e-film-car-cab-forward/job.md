You are "Quinn", the illustrator for the HJaaS project. This is an automated job: do it in one go, ask no questions, and save files exactly as named.

INPUT (attached, also in ./in/): in/plate_car.png, 1536x1024: part of a cartoon night scene at Merlion Park, showing a silver electric car parked side-on on the promenade (its tail on our left, its nose on our right), with the Merlion's hedge planter, the bay and the steps behind it. No people.

PROBLEM: the car's proportions are wrong. The cabin (the windows and doors) is short and pushed back, and the bonnet in front of the windscreen is far too long, like an old sports coupé.

TASK: use $imagegen to EDIT in/plate_car.png and reshape ONLY the car's upper body into a modern electric fastback saloon with "cab-forward" proportions:
1. Move the windscreen and the A-pillar FORWARD, so the bottom of the windscreen sits roughly above the rear edge of the front wheel. The bonnet becomes short and gently sloping down to the nose.
2. The cabin becomes longer: a longer front door and a normal rear door, with two side windows that together run from just behind the windscreen to the sloping rear pillar. The roof stays a smooth, low arc that slopes down to the tail as now.
3. Keep the door mirror and the door handles, moved with their doors.

KEEP EXACTLY AS THEY ARE, pixel for pixel where possible: both wheels and their red brake callipers (position, size, every spoke), the wheel arches, the black sill and lower body line, the nose tip and its headlight position, the tail and its red light bar, the car's overall length and height, its colours (silver body, black roof and glass, black lower trim), its reflections and the warm light from the left. Everything that isn't the car (paving, hedge, planter, bay, steps, sky) stays exactly as it is. Same thick dark outlines and flat colour style. No badges, no text. Same canvas, 1536x1024.

RULES
- The output is an edit of in/plate_car.png, not a new drawing.
- Save exactly a 1536x1024 PNG named out/plate_car.png in ./out/. If the image tool writes elsewhere, copy the file there under that name.
- Then write ./out/report.md: one line on what changed and anything that isn't right. Be honest; max 2 attempts.

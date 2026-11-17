# Scene

`room-empty.png` is the **background plate** for the site: an unfinished apartment room in warm late-afternoon light. Rachel is never drawn into it. She is composited on top from her own transparent frames.

`reference/scene-keyframe-hammering.png` shows the target look when she is in the room: same lighting, same colour grade, same line quality. Use it as the lighting reference for every character task.

## Where she can stand
The open tiled floor, centre to centre-right (roughly the middle 40-80% of the image width, lower half of the image). Her feet sit on the floor plane, so frames get placed by their baseline (feet line), not their centre.

## Layers on the site (back to front)
1. `room-empty.png`
2. soft ground shadow under her feet (added on the site, not drawn by Quinn)
3. Rachel's animation frames
4. optional foreground props that she must go behind or inside (only if a task calls for one)

## Props she touches travel with her
If Rachel's hands touch a prop (the wooden box she hammers), the prop is drawn inside her frames, not as a separate layer, so hands and prop always line up. Wren keeps the prop pixel-steady across frames during QC.

## Mobile (decided 2026-11-17)
- Desktop, tablet and landscape phones show the whole room.
- Portrait phones show a crop of about 4:5 centred on Rachel (roughly x 514–1267 of the 1672-wide plate for the hammering spot), and visitors swipe sideways to explore the rest of the room.
- Consequence: on phones Rachel is shown about 1.5× larger than her keyframe size, so her frames should be drawn larger than the keyframe (target ~900 px tall when kneeling). The room plate stays as is; upscale later only if it looks soft.
- Mushroom tap areas are at least 44 px even when the mushroom itself is tiny.

## Lighting rule for character tasks
Warm golden light from the window on the LEFT. Rachel's frames must be lit to match: warm highlights on her left side, slightly deeper warm shadow on her right, same overall colour warmth as the room. Her outline style stays as on the model sheets.

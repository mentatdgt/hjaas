# Wren review of Engine job 008 (Build without glasses + in-betweens), 2026-11-25

The engineering passes: patches, memory peak of 78.1 MB, hunt 50/50, no seams. The art had faults I missed when I checked it; Engine's art-notes-3x.png is right.

**Held from the phone preview** until the art below is fixed. The preview keeps the previous Build.

- **frame_03:** scratch marks left of her eye, a leftover of the glasses' arm. Fixed by Wren on main (33 pixels painted with the nearby skin colour; nothing else touched).
- **frame_01_02:** a cut line on the upper arm, ragged outlines and loose pixels. Being redrawn in Quinn job 038.
- **frame_02_03b:** the forearm covered her eyes, so they vanished in every swing. Quinn 038 redraws it with the arm passing above the eyes.
- **rx_B36:** a blurred, greenish hand. Quinn 038 redraws the hand crisp.
- **rx_A52:** faint rings beside the pupils. Quinn 038 cleans them.
- **rx_K1_B36:** a jagged edge on the hammer head. Quinn 038 smooths it.

**Timing, for the next Engine job, with the fixed art:**
- Take 90 ms off frame_03's hold, so a swing is back to about 890 ms.
- Change the reaction steps of 25 and 30 ms to 33 ms, an even two frames at 60 Hz.

**Memory:** the margin is under 2 MB. Any further in-between in Build or Grow ships as a patch.

## Quinn 038 checked by Wren (2026-11-25)
- **frame_01_02:** the cut line, ragged outlines and loose pixels are gone. The steps measure 46 and 49, as before.
- **rx_B36:** the hand is crisp, with no green tint. **rx_A52:** the whites are clean. **rx_K1_B36:** the hammer edge is smooth.
- **frame_02_03b:** both eyes now stay visible. But the arm has gone 95% of the way to frame_03, so the step from 02_03a is 117 against 40 after it, and 92 if 02_03b were skipped.
  - Quinn job 039 is drawing `frame_02_03ab` halfway between them, with the fist beside her temple, outside her face.
  - The swing becomes 02 → 02_03a → 02_03ab → 02_03b → 03.
- **Pasting:** only the changed zone went in, keyed with a soft 3 px edge. Nothing outside the zone changed (0 levels).

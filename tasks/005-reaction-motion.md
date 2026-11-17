---
id: 005-reaction-motion
status: draft            # opens once 004 is approved
frames: 0                # comes from video; Wren extracts and decides
grid: n/a
fps: 12
loop: false
references:
  - frames/001-hammer-loop/approved/frame_01.png   # start of the reaction (the loop's contact pose)
  - frames/004-reaction-keyposes/approved/frame_01.png   # K1: beaming at the viewer
  - frames/004-reaction-keyposes/approved/frame_02.png   # K2: thumbs up
used_on: contracting scene; plays when a visitor collects a mushroom
---

# 005 — Reaction motion (video in-betweens)

**Not a Quinn task.** This one uses a video model with **start and end frame** control (Kling start/end frames, e.g. on Higgsfield, or Seedance 2.0 first/last frame). The person running it uploads two approved images per clip and pastes the prompt below. Wren then turns the videos into frames.

## The reaction, beat by beat (what the site plays)
| Beat | Time | What happens |
|---|---|---|
| Notice | ~0.15 s | Hammer loop stops on its contact frame; her eyes flick up first |
| Look up | ~0.35 s | Head lifts to the camera, easing out; smile grows into a beam (clip A) |
| Thumbs up | ~0.30 s | Steadying hand leaves the box, thumb up, tiny overshoot and settle (clip B) |
| Hold | ~0.9 s | Holds the thumbs up; one blink |
| Back to work | ~0.5 s | Clip B then clip A played in reverse, eased; loop resumes on its contact frame |

## Clips to generate
| Clip | Start frame | End frame |
|---|---|---|
| A | 001 approved `frame_01.png` | 004 approved `frame_01.png` (K1) |
| B | 004 approved `frame_01.png` (K1) | 004 approved `frame_02.png` (K2) |

Settings: shortest duration (5 s is fine; Wren re-times it), highest resolution available, no audio.

### Prompt, clip A
> 2D hand-drawn cartoon animation in exactly the style of the input frames: flat colours, thick dark outlines. Locked-off static camera, no camera movement, no zoom. The background stays flat pure green. The kneeling woman glances up, then lifts her head to look straight into the camera and breaks into a big beaming smile. Her body, hands, hammer and the wooden box stay completely still.

### Prompt, clip B
> 2D hand-drawn cartoon animation in exactly the style of the input frames: flat colours, thick dark outlines. Locked-off static camera, no camera movement, no zoom. The background stays flat pure green. Still beaming at the camera, the woman lifts her free hand off the wooden box and gives a confident thumbs up. Her head, body, hammer and the box stay still.

Negative prompt (if the tool has one): camera movement, zoom, background change, realistic, 3D, extra fingers, extra hands, morphing, flicker.

## What Wren does with the videos
1. Extract every frame, key out the green, remove green spill.
2. Re-time to 12 fps with ease-in/ease-out, matching the beat timings above.
3. Stabilise: keep the approved box and lower body from 001 frame 1 fixed, so only her head and arms move.
4. Check first and last frames match the approved key poses so the reaction joins the loop with no jump.
5. Build a preview of loop → reaction → loop.

## QC pass criteria (Wren checks these)
- No style drift: outlines and flat colour stay consistent with the key poses through the whole clip
- No morphing hands, extra fingers or face distortion in any frame
- Motion has a clear ease-in and ease-out (no robotic constant speed)
- Joins to the loop seamlessly both ways

## Revision notes
_(Wren writes here after each QC round)_

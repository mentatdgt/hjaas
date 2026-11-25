# Quinn's standing rules for every job in this folder

These apply to every job Wren drops in `jobs/` (the user asked for them on 2026-11-25).

## Use subagents
- **Speed:** when a job has several independent outputs (several drawings, several fixes, several review areas), spawn one subagent per output and run them in parallel, then collect the results. Keep each subagent to its own output files.
- **QC by someone who didn't make it:** before you save the final outputs, spawn a separate QC subagent that did not draw or write them. Give it the job's rules and the inputs, and have it check every output:
  - only the named part changed (pixel comparison against the input outside that part);
  - the part lines up with its references (position, size, halfway where asked);
  - the style matches (outline weight, colours, flat shading) and nothing is more detailed or realistic;
  - Rachel never wears glasses;
  - the file names, sizes and green background are exactly as asked.
  Fix or redo anything it fails, then have it check again. Put its findings in `out/report.md`.
- If a tool (for example image generation) isn't available inside a subagent, do that step yourself and still use a subagent for the QC.

## Always
- Work only inside the job folder. Never change anything in `~/hjaas` outside it.
- Edit the given drawings; never draw from scratch, never use SVG/HTML/code to draw.
- Write `out/report.md`: one honest line per output, plus the QC subagent's result.

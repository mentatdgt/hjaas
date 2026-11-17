# QC report — 001-hammer-loop-batch01.png

**Automated checks: FAIL**

- Sheet 1536x1024, grid 2x2, cell 768x512.

| Check | Result | Detail |
|---|---|---|
| frames same size | PASS | sizes: [(768, 512)] |
| no empty frames | PASS | all frames have content |
| character height consistent | PASS | variation 3.3% (limit 4%); heights [429, 429, 442, 428] |
| baseline steady | PASS | drift 0.0% of cell (limit 2%); baselines [462, 462, 462, 462] |
| horizontal centre | PASS | centre x per frame [357, 334, 358, 335] (info: intentional motion is fine) |
| nothing touches cell edge | PASS | clear |
| margin ≥ spec | WARN | frames under 8% margin: [1, 2, 3, 4] |
| palette matches frame 1 | PASS | similarity [1.0, 0.98, 0.96, 0.96] (limit 0.8); low: [] |
| palette vs reference | PASS | similarity [0.64, 0.64, 0.63, 0.64] (info: reference has other poses/text) |
| no green fringe | FAIL | fringe [0.02004, 0.021, 0.02066, 0.02086]; bad: [1, 2, 3, 4] |
| background | PASS | modes per frame: ['keyed'] |

_Automated checks only. Wren's visual review (identity, style, motion) is recorded in the task file._

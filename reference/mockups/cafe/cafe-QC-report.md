# Café staging mock-ups — self-check

Source: `mentatdgt/hjaas`, `reviews/user-notes-pending.md`, Scene 3, read 20 November 2026. Background: the original `scene/cafe.png`, 1672×941. Wardrobe/identity: `reference/hjaas1.png`, outfit 1. Rendering guide: `frames/001-hammer-loop/approved/frame_01.png`.

## User corrections applied

- Rachel has **no glasses**, superseding the original café brief's glasses requirement. Loose wavy dark brown hair, black tank, gold round pendant, olive cargo trousers and brown boots remain her look; legs/boots are naturally hidden by furniture in Option 1.
- The mother is a little plumper, with a short tousled bob. Her coffee, tote and warm, mildly frazzled expression remain.

## Final checks

| Check | Option 1: facing us | Option 2: three-quarter | Option 3: relaxed |
|---|---|---|---|
| Full original canvas, 1672×941 | Pass | Pass | Pass |
| Uncovered café pixels unchanged | Pass: zero changes | Pass: zero changes | Pass: zero changes |
| Loose-haired Rachel, no glasses, outfit 1 | Pass; trousers/boots occluded | Pass | Pass |
| Rachel is foreground focus | Pass | Pass | Pass |
| Same fixed cast and places | Pass | Pass | Pass |
| Cast never overlaps Rachel or her furniture | Pass: 0 overlapping pixels | Pass: 0 overlapping pixels | Pass: 0 overlapping pixels |
| Barista behind original curved counter, polishing cup | Pass | Pass | Pass |
| Mum and child by left windows; child kneeling on existing chair | Pass | Pass | Pass |
| Old man at original right table, newspaper, reading glasses and kopi | Pass | Pass | Pass |
| Left window light and soft floor shadows | Pass visually | Pass visually | Pass visually |
| iPad room sketch, right-hand stylus, ceramic hot coffee | Pass | Pass; stylus hovers beside screen | Pass |
| No readable text or logos | Pass | Pass | Pass |
| Requested staging | Front-facing, legs hidden | Turned toward left windows | Rattan armchair, crossed leg, lap iPad, side-table coffee |

All extra people are original fictional characters. The supporting cast was rendered once, softened slightly in contrast and reused at exactly the same coordinates in all options. Existing café tables/counter were preserved and used for the supporting cast; only Rachel's own furniture was added. The barista is correctly occluded by the original counter/equipment. The newspaper uses abstract layout bars, not readable writing.

## Attempts and limits

- Option 1 Rachel: three generation attempts — initial staging, no-glasses correction, then a final frontal/leg-occlusion correction.
- Option 2 Rachel: two generation attempts — staging and no-glasses correction.
- Option 3 Rachel: two generation attempts — staging and no-glasses correction.
- The shared child pose was corrected once to read as kneeling on a chair rather than colouring on the floor. The shared mother was revised for the user's bob/fullness correction.

The model generated the character/furniture/prop additions. They were composited over the original plate rather than regenerating the café. This allows the unchanged-background and fixed-cast checks to be measured rather than inferred from visual similarity.

## Honest limits

The three Rachel drawings are separate illustration variants, so minor face, hair and furniture-rendering differences remain. They share the approved line/cel style closely but are not pixel-identical character turnarounds. In Option 2 the stylus is poised near the tablet, rather than visibly contacting its screen. These are staging mock-ups, not animation keyframes or green anchors.

`composition-qc.json` records canvas size, layer positions, uncovered-pixel checks and zero cast/Rachel overlap. Outputs are ready for the user to select and upload to the repository; this workflow did not modify GitHub.

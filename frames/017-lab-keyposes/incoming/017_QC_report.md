# 017 — Mushroom lab key poses

Completed in task order: 0a, 0b, then poses 1–8, generated individually as edits of the green anchor. No animation or in-between frames were made.

Source: `mentatdgt/hjaas`, `tasks/017-lab-keyposes.md`, task blob `ade0f766a28f7766419cf4deeb805cd64a55ce02`, read 19 November 2026. The chosen repository mock-up was downloaded and inspected before editing.

**User override:** no glasses. The task's remaining references to glasses were not followed, in accordance with the user's explicit correction and chosen mock-up.

## Delivery

All ten requested PNGs are **1672 × 941**. Every green image has a flat `#00FF00` background, no room, no floor or floor shadow, and no text. Each image used one generation attempt, followed by localized compositing/cleanup where needed. No image exceeded the task's three-attempt limit.

The image model also altered areas it had been told to preserve. To prevent that from becoming accumulated drift, unchanged areas were restored from the anchor. For B2 and K2, the green anchor was the first edit reference; B1 and K1 were secondary continuity references. Final B2 and K2 retain the unchanged parts of B1 and K1 respectively.

## Self-check

✅ = passes the stated check. ⚠️ = useful and coherent, with the disclosed variation. The scores assess the final delivered files, not discarded intermediate versions.

| File | Canvas / placement | Only requested change | Outfit / ponytail / no glasses | Green, no shadow | Clipboard faces her | Result / limitation |
|---|---|---|---|---|---|---|
| `017_anchor_scene.png` | ✅ | ✅ | ✅ | N/A — scene retained | ✅ | Metal clip moved to the front/viewer end, farthest from Rachel. Only the clipboard region was replaced; zero changes outside x914–1024, y575–638. |
| `017_anchor_green.png` | ✅ | ✅ | ✅ | ✅ | ✅ | Original retained foreground pixels restored to the original coordinates; background and floor shadows removed. Very fine original anti-aliased edges may need normal chroma-key cleanup. |
| `017_A1_mist_aim.png` | ✅ | ✅ | ✅ | ✅ | ✅ | Byte-identical to the green anchor; ready-to-spray pose without active mist. |
| `017_A2_mist_squeeze.png` | ✅ | ✅ | ✅ | ✅ | ✅ | Fine mist is visible and feathered. Trigger compression is subtle at this working scale. The first local mist crop was repaired before delivery. |
| `017_A3_mist_lift.png` | ✅ | ⚠️ | ✅ | ✅ | ✅ | Small bottle lift and forearm adjustment read correctly. A tiny sleeve transition remains near x990/y407. |
| `017_B1_write.png` | ✅ — lower assembly exact | ⚠️ | ⚠️ — same design, local redraw | ✅ | ✅ | Right hand writes; left holds board at chest; blank wooden back faces viewer. Bottle upright beside tray. Small head/hair and coat-construction variations remain within the changed upper-body area. |
| `017_B2_glance.png` | ✅ — lower assembly exact | ⚠️ | ⚠️ — same design, local redraw | ✅ | ✅ | Coherent down-left tray glance; B1 arms, props and lower body retained. Slight full-head construction drift versus B1. Earlier face splice was repaired and independently rechecked. |
| `017_A1_blink_half.png` | ✅ | ✅ | ✅ | ✅ | ✅ | Half-lowered skin-coloured lids, both pupils visible. Only eye-region pixels changed. |
| `017_K1_beam.png` | ✅ — lower assembly exact | ⚠️ | ⚠️ — same design, head turn | ✅ | ✅ | Looks at viewer and beams; bottle slightly lowered; left hand rests on trolley. Small hair/face construction changes accompany the turn. |
| `017_K2_thumbs.png` | ✅ | ✅ versus K1 | ✅ versus K1 | ✅ | ✅ | Anatomical left hand gives thumbs-up; old resting hand removed. Head and bottle/right-hand pixels match K1 exactly. One missing far-right background column in the raw generation was padded green, without scaling the character. |

## Registration evidence

- Every green pose has **zero changed pixels at or below y645** relative to the green anchor: lower legs, boots, wheels and lower trolley stay fixed.
- A1 is exactly identical to the green anchor.
- The main tray comparison rectangle x725–913, y536–608 is exact in A1, A3, B1, B2 and blink. A2 changes 374 pixels there where mist crosses green gaps; K1/K2 change 204 pixels where the slightly lowered bottle overlaps that region. Do not describe those three rectangles as pixel-identical.
- B2 has zero changes below y427 relative to B1; writing hands, board, pen and standing bottle remain fixed.
- K2's head rectangle x912–1097, y227–389 and bottle/right-hand rectangle x829–922, y453–551 are pixel-identical to K1.
- The large left background margin is exactly `#00FF00` in every green image.

The machine-readable measurements are in `017_registration.json`. Two independent sub-agents checked visuals and registration, including the repaired images.

## Handoff

These are key-pose assets for review and the stated Wren QC/stabilisation stage. The writing and head-turn variations mean the set should not be labelled fully pixel-identical or final animation-ready without that next review.

`017_contact_sheet.png` is a cropped comparison preview only. Its labels and cropped framing are not present in any of the ten full-canvas delivery PNGs.

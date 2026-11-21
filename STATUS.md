# HJaaS: status

Where everything stands. Update this whenever a scene changes state. **Last updated: 2026-11-21 19:30 (Wren, café chat, handing scene 5 to a new chat).**

New session? Read this, then `BIBLE.md` (what's fixed), `SCENE-RECIPE.md` (how a scene gets made) and the handover for your scene: `HANDOVER-scene-3.md` (café, finishing in the original Wren chat) `HANDOVER-next-scene.md` (scene 4, Film) or `HANDOVER-scene-5.md` (scene 5, set design: **start here for the new chat**).

## Scenes

| # | Tab | Scene | Art | Site build | On `main`? |
|---|---|---|---|---|---|
| 1 | Build | Contracting: Rachel hammers a box in an unfinished room | ✅ Approved, but **needs glasses removed and a restyle to the model sheet** | ✅ Built (elegant version) | ✅ Merged 2026-11-21 |
| 2 | Grow | Mushroom lab: misting, writing, rotating the rack | ✅ Approved (task 017); later, a light restyle to the model sheet | ✅ Pencil edge done; Round 3b (pencil arrives with the colour) overnight | ✅ Merged 2026-11-21 (no phone check yet) |
| 3 | Design | Café: Rachel sketches, sips coffee and reacts; barista, mum, child, old man, cat, ceiling fan | ✅ Art final: package v7.5 on `main` (v7.3 user OK; v7.4 shadow; v7.5 floor seam) | 🔧 Fable: v7.4 integrated on `site/scene-3`; v7.5 file swap next | — |
| 4 | Film | Merlion at night: Rachel (from behind) films a presenter by a silver car | ✅ **Art final** (your OK 2026-11-21 14:28) | ✅ **Approved on your phone 2026-11-21 16:56** (round 2, `site/scene-4` 2e19df6). Paused here | ⏳ Merges right after `site/scene-3` |
| 5 | (Set / Stage, TBD) | **Set design, replacing Travel**: Rachel paints a theatre backdrop; the backdrop fills in with the hunt; a stagehand's boots cross behind it; the lamp swings | ✅ Package `frames/022-theatre-scene/site/` + preview v3 (all QA passing). ⏳ Waiting for the user's verdict on v3 and the tab name | ⏳ Fable brief not written yet | — |

## Now
- **Fable:** swap café v7.5 into `site/scene-3`, then merge into `site/scene-4`; finish the scene-4 report.
- **You:** phone-check scenes 1–3; then `site/scene-3` merges into `main`, then `site/scene-4`.
- **Scene 5 (set design):** handed to a new Wren chat (`HANDOVER-scene-5.md`). Next: the user's verdict on preview v3 and the tab name, then Fable's brief.

## Next
1. Merge `site/scene-3` into `main` after your phone check, then `site/scene-4` after Wren reviews Fable's scene-4 report.
2. Scene 5 set design: approve the final scene, then plate, anchors, poses, the stagehand's walk cycle and the backdrop stages.
3. Model-sheet pass on scenes 1–2 (scene 1 loses its glasses).

## Branches
| Branch | Holds |
|---|---|
| `main` | Art pipeline, docs, and the site with scenes 1–2 (merged 2026-11-21). |
| `site/scene-1` → `site/scene-1-elegant` → `site/scene-2` → `site/scene-3` → `site/scene-4` | Site builds, stacked. Each includes the ones before. Merge in order. |
| `pr1`, `pr2` | Merged Foreman/Cursor PRs. Safe to delete. |

## Open decisions and launch list
- [ ] **Model-sheet pass for scenes 1 and 2:** restyle Rachel to `M01_rachel_model.png` (scene 1 also loses its glasses).
- [ ] **Scene 1 still has glasses → remove them.** Decided: no glasses anywhere. Scene 1's frames (hammer loop, blink, reaction, wink, 2× set) were drawn with glasses and need a no-glasses re-edit. Plan this as its own task after the café.
- [ ] Copy: about text, services, taglines (marked `TODO(copy)` in the code).
- [ ] Contact form endpoint (Formspree suggested).
- [ ] Hosting: Vercel Hobby is non-commercial only; Netlify or Cloudflare Pages at launch.
- [ ] Domain.
- [ ] At launch: open up `robots.txt`; set `og:image` to the full URL.
- [ ] Film scene: consent from Sean before he appears.
- [ ] Travel scene: confirm the location.
- [ ] Optional: polish frames for the reaction; switch the lab's thumbs-up to a peace sign.
- [ ] Your design notes from 2026-11-19 (too cartoonish, paint-in too fast, full-bleed): partly addressed by the elegant version and the edge. Re-check once scene 2 merges.

## Credits
Higgsfield: **126 credits** on 2026-11-20 night (the Film chat may have spent since; check). Starter plan: 4 jobs at a time; std mode only.

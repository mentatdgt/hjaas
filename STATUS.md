# HJaaS: status

Where everything stands. Update this whenever a scene changes state. **Last updated: 2026-11-21 13:15 (Wren, café chat).**

New session? Read this, then `BIBLE.md` (what's fixed), `SCENE-RECIPE.md` (how a scene gets made) and the handover for your scene: `HANDOVER-scene-3.md` (café, finishing in the original Wren chat) `HANDOVER-next-scene.md` (scene 4, Film) or `HANDOVER-scene-5.md` (scene 5, Travel, new chat).

## Scenes

| # | Tab | Scene | Art | Site build | On `main`? |
|---|---|---|---|---|---|
| 1 | Build | Contracting: Rachel hammers a box in an unfinished room | ✅ Approved, but **needs glasses removed and a restyle to the model sheet** | ✅ Built (elegant version) | ✅ Merged 2026-11-21 |
| 2 | Grow | Mushroom lab: misting, writing, rotating the rack | ✅ Approved (task 017); later, a light restyle to the model sheet | ✅ Pencil edge done; Round 3b (pencil arrives with the colour) overnight | ✅ Merged 2026-11-21 (no phone check yet) |
| 3 | Design | Café: Rachel sketches, sips coffee and reacts; barista, mum, child, old man, cat, ceiling fan | ✅ Art final: package v7.5 on `main` (v7.3 user OK; v7.4 shadow; v7.5 floor seam) | 🔧 Fable: v7.4 integrated on `site/scene-3`; v7.5 file swap next | — |
| 4 | Film | Merlion at night: Rachel (from behind) films a presenter by a silver car | ✅ Art done, preview v2 approved by you. ✅ Package `frames/020-film-scene/site/` + pencil map + Fable brief (`reviews/scene-4-build.md`). No AI video, 0 credits | 🔧 Fable built it on `site/scene-4` (stacked on `site/scene-3`); report `reviews/scene-4-review-01.md` due | — |
| 5 | Travel | Lookout | ⏳ Next: new Wren chat with `HANDOVER-scene-5.md`. Backdrop only (`scene/travel-lookout.png`); location to confirm | ⏳ | — |

## Now
- **Fable:** swap café v7.5 into `site/scene-3`, then merge into `site/scene-4`; finish the scene-4 report.
- **You:** phone-check scenes 1–3; then `site/scene-3` merges into `main`, then `site/scene-4`.
- **Scene 5 (Travel):** start a new Wren chat with `HANDOVER-scene-5.md`.

## Next
1. Merge `site/scene-3` into `main` after your phone check, then `site/scene-4` after Wren reviews Fable's scene-4 report.
2. Scene 5 Travel: settle location, outfit, loop and reaction, then staging (task 021).
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

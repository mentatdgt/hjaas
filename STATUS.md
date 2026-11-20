# HJaaS: status

Where everything stands. Update this whenever a scene changes state. **Last updated: 2026-11-21 00:45 (Wren, café chat).**

New session? Read this, then `BIBLE.md` (what's fixed), `SCENE-RECIPE.md` (how a scene gets made) and the handover for your scene: `HANDOVER-scene-3.md` (café, finishing in the original Wren chat) or `HANDOVER-next-scene.md` (scene 4, new chat).

## Scenes

| # | Tab | Scene | Art | Site build | On `main`? |
|---|---|---|---|---|---|
| 1 | Build | Contracting: Rachel hammers a box in an unfinished room | ✅ Approved, but **needs glasses removed and a restyle to the model sheet** | ✅ Built (elegant version) | ❌ Waiting to merge |
| 2 | Grow | Mushroom lab: misting, writing, rotating the rack | ✅ Approved (task 017); later, a light restyle to the model sheet | ✅ Pencil edge done; Round 3b (pencil arrives with the colour) overnight | ❌ Waiting for your phone check, then merge |
| 3 | Design | Café: Rachel sketches and reacts; barista, mum, child, old man, cat, ceiling fan | ✅ Package v5, stabilised (no flicker by construction). 🔧 Still to add: Rachel's coffee sip, the barista polishing | 🔧 Fable building on `site/scene-3`; v5 is a file swap (`reviews/scene-3-build.md`) | — |
| 4 | Film | Merlion at night: Rachel (from behind) films a presenter by a silver car | ✅ All art approved, including the drawn in-betweens (loop jobs 020a, 020b). Preview: `frames/020-film-scene/film-preview.mp4`. No AI video, 0 credits | ⏳ Package + Fable brief after the café merge | — |
| 5 | Travel | Lookout | ⏳ Backdrop only (`scene/travel-lookout.png`); location to confirm | ⏳ | — |

## Now
- **You:** watch `frames/018-cafe-scene/cafe-preview.mp4` (v5). Start the Quinn loop with one Terminal command (`QUINN-LOOP.md`). Phone-check scene 2, then say "merge".
- **Quinn loop:** smoke test, then job 001 (Rachel's sip poses).
- **Fable:** café build on `site/scene-3`; swap in package v5.
- **Wren (café chat):** run the Quinn loop, add the sip and the barista's polishing, final preview.
- **Film chat:** scene 4 art done; you check `frames/020-film-scene/film-preview.mp4`. Then Wren packages it and writes the Fable brief (Fable builds on `site/scene-4` after the café merges).

## Next
1. Approve scene 2 on a phone → merge `site/scene-2` into `main` (it includes scene 1).
2. Merge `site/scene-3` after scene 2, once the restyled café is in and you've checked it.
3. Scene 4 is **Film** (chosen 2026-11-20), run by the scene-4 Wren chat: task 019 staging → pick → task 020 pieces. Travel moves to scene 5.

## Branches
| Branch | Holds |
|---|---|
| `main` | Art pipeline (tasks, frames, references, tools) and these docs. The site joins it once scene 2 is approved. |
| `site/scene-1` → `site/scene-1-elegant` → `site/scene-2` → `site/scene-3` | Site builds, stacked. Each includes the ones before. Merge in order. |
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

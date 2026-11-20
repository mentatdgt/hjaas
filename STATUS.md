# HJaaS: status

Where everything stands. Update this whenever a scene changes state. **Last updated: 2026-11-20 (Wren).**

New session? Read this, then `BIBLE.md` (what's fixed) and `SCENE-RECIPE.md` (how a scene gets made).

## Scenes

| # | Tab | Scene | Art | Site build | On `main`? |
|---|---|---|---|---|---|
| 1 | Build | Contracting: Rachel hammers a box in an unfinished room | ✅ Approved, but **needs glasses removed** | ✅ Built (elegant version) | ❌ Waiting to merge |
| 2 | Grow | Mushroom lab: misting, writing, rotating the rack | ✅ Approved (task 017) | 🔧 Fable is on review 05 (memory) and the organic edge | ❌ Waiting to merge |
| 3 | Design | Café: Rachel sketches on an iPad, then sips coffee; barista, mum, child, old man, cat | 🔧 Task 018, round 1: fixes to `018_scene` | ⏳ Not started | — |
| 4 | Film | Merlion: video production | ⏳ Backdrop only (`scene/merlion.png`) | ⏳ | — |
| 5 | Travel | Lookout | ⏳ Backdrop only (`scene/travel-lookout.png`); location to confirm | ⏳ | — |

## Now
- **Quinn:** task 018, round 1 fixes to the café scene: the old man's chair and gaze, the barista between the machine and the grinder with a real cup, the child on the middle chair facing Rachel, the iPad edge. Quinn stops for approval before steps 2–4.
- **Fable (on `site/scene-2`):** review 05 (whole-page memory under 80 MB on phones) plus the organic edge (`reviews/scene-edge-organic.md`). Wren reviews when the report arrives.
- **Wren:** QC the café scene → approve → Quinn does steps 2–4 → QC → Higgsfield clips (with a quote first) → package → Fable brief.

## Next
1. Approve scene 2 on a phone → merge `site/scene-2` into `main` (it includes scene 1).
2. Finish the café art → cut `site/scene-3` from `main` → Fable builds the Design tab.
3. Choose scene 4 or 5.

## Branches
| Branch | Holds |
|---|---|
| `main` | Art pipeline (tasks, frames, references, tools) and these docs. The site joins it once scene 2 is approved. |
| `site/scene-1` → `site/scene-1-elegant` → `site/scene-2` | Site builds, stacked. `site/scene-2` is the newest and includes the others. |
| `pr1`, `pr2` | Merged Foreman/Cursor PRs. Safe to delete. |

## Open decisions and launch list
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
Higgsfield: **148.5 credits** (Starter plan: 4 jobs at a time; std mode only). Kling 3.0 std 3 s = 4.5 credits; upscale = 2.

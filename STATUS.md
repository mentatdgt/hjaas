# HJaaS: status

Where everything stands. Update this whenever a scene changes state. **Last updated: 2026-11-25 03:45 (Wren, main chat: scene 5 rounds 3–4 and the counter round 1 reviewed; counter round 2 running on the Fable bridge).**

New session? Read this, then `BIBLE.md` (what's fixed), `SCENE-RECIPE.md` (how a scene gets made) and the handover for your scene: `HANDOVER-scene-3.md` (café, finishing in the original Wren chat) `HANDOVER-next-scene.md` (scene 4, Film) or `HANDOVER-scene-5.md` (scene 5, set design). For the counter and the phone crop: `HANDOVER-hunt-counter.md`. For sending Fable build jobs without the user pasting: `FABLE-LOOP.md`.

## Scenes

| # | Tab | Scene | Art | Site build | On `main`? |
|---|---|---|---|---|---|
| 1 | Build | Contracting: Rachel hammers a box in an unfinished room | ✅ Approved, but **needs glasses removed and a restyle to the model sheet** | ✅ Built (elegant version) | ✅ Merged 2026-11-21 |
| 2 | Grow | Mushroom lab: misting, writing, rotating the rack | ✅ Approved (task 017); later, a light restyle to the model sheet | ✅ Pencil edge done; Round 3b (pencil arrives with the colour) overnight | ✅ Merged 2026-11-21 (no phone check yet) |
| 3 | Design | Café: Rachel sketches, sips coffee and reacts; barista, mum, child, old man, cat, ceiling fan | ✅ Art final: package v7.5 on `main` (v7.3 user OK; v7.4 shadow; v7.5 floor seam) | ✅ `site/scene-3` at d102899 (package v7.5) | — |
| 4 | Film | Merlion at night: Rachel (from behind) films a presenter by a silver car | ✅ **Art final** (your OK 2026-11-21 14:28) | ✅ **Approved on your phone 2026-11-21 16:56** (round 2, `site/scene-4` 2e19df6) | ⏳ Merges right after `site/scene-3` |
| 5 | Set Design | Rachel paints a theatre backdrop; the backdrop fills in with the hunt; the stagehand crosses behind it; the lamp swings | ✅ **Art final**, plus the stagehand's drawn walk and 14 in-betweens for Rachel's arm | ✅ Rounds 1–4 reviewed by Wren on `site/scene-5` (528746a): build, stagehand, Rachel's in-betweens (review 03), Rachel painted in with the room in all scenes (review 04) | — |

## Site-wide work

| Item | State | Next |
|---|---|---|
| **Rachel painted in with the room** (all scenes; she no longer fades in after the painting) | ✅ Round 4 on `site/scene-5`, reviewed | Your phone check. Watch Design 1.6–2.1 s (half her face painted for a moment) and Build 0.8–2 s (top of her head) |
| **Hunt counter:** two stacked mushrooms (cream = this scene /10, red = all /50) that turn into the Contact button at 50 | ✅ Round 1 built on `site/counter` (5d4adf1), reviewed | Round 2 running (bridge job 004): Film's phone framing back to the approved two faces, Build's box in view, fresh evidence |
| **Phone crop:** portrait shows a zoomed scene that pans sideways, opening on Rachel; landscape shows the whole scene | ✅ Built with the counter (58–63% of the screen height; drift instead of the "Swipe sideways" text) | Your phone check. Landscape is small (465×262 on a 844×390 phone) |

## Now
- **Fable bridge:** job 004 (counter round 2) running. Wren reviews its report.
- **You:** one phone check of `site/counter` (it carries all five scenes, round 4 and the counter): the portrait crop and panning, the counter, a scene completing, the paint-in.

## Next
1. After your phone check: merge in order `site/scene-3` → `site/scene-4` → `site/scene-5` → `site/counter` into `main` (each needs Wren's review and your OK).
2. Model-sheet pass on scenes 1–2 (scene 1 loses its glasses).

## Branches
| Branch | Holds |
|---|---|
| `main` | Art pipeline, docs, and the site with scenes 1–2 (merged 2026-11-21). |
| `site/scene-1` → `site/scene-1-elegant` → `site/scene-2` → `site/scene-3` → `site/scene-4` → `site/scene-5` → `site/counter` | Site builds, stacked. Each includes the ones before. Merge in order. |
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
- [ ] Optional: polish frames for the reaction; switch the lab's thumbs-up to a peace sign.
- [ ] Optional: in-betweens for Rachel's lean in Set Design (still a single cut, shown at least 500 ms).
- [ ] Your design notes from 2026-11-19 (too cartoonish, paint-in too fast, full-bleed): partly addressed by the elegant version and the edge. Re-check once scene 2 merges.

## Credits
Higgsfield: **126 credits** on 2026-11-20 night (the Film chat may have spent since; check). Starter plan: 4 jobs at a time; std mode only.

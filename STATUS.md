# HJaaS: status

Where everything stands. Update this whenever a scene changes state. **Last updated: 2026-11-26 17:50 SGT (Wren: jobs 015–018 live; load speed part 2 built but unverified; café round 10 and the lab mister approved and queued).**

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

## Engine queue (2026-11-26 evening)
- **Live on hjaas.com (`deploy`):** copy round 2 (short tagline, Reset mushrooms with a 500 ms double-tap guard, 404 text), iPad side lines fixed + phone view on iPad mini (016), favicon / home-screen icon / title "Hui Jie as a Service (HJaaS)" (017), black border after a logo tap fixed: the stylesheet race, and the logo no longer reloads the home page (018).
- **On `site/review-fixes` but NOT live:** load speed part 2: A (`3dffd05`, Film's cast with its room, Film's room downloaded once) and B (`ec0a94a`, Set Design's backdrop streamed, next room ahead, Grow's clips yield to taps). Both ended before their checks: **020b-verify-load** runs them before anything deploys.
- **Queued after it:** 021 art rebuild (presenter speck, Build pixels: `c10c0f1` on main), 022 lab mister (`art/lab-mister`, `142bae9`), 023 café round 10 (`art/cafe-round10`, `6979614`, with the new blink `avoid` rule so Rachel never blinks while the mum sips).
- **Lesson:** Engine runs headless, so ending its turn ends the job and kills its subagents. That rule is now in `fable_rules.md`.

## Waiting on the user
- A real test message through the contact form (it goes to the +hjaas address until launch).
- iPad check in Safari and Chrome, landscape, after reloads and logo taps (016 and 018 are unconfirmed on a device).
- Whether to do "scene finished" payoff animations (suggested: start with Grow).

## Now
- **You:** one phone check of **`site/review-fixes`** (699c8c0). It carries all five scenes, round 4, the counter (round 2) and Quinn's 11 code/security fixes (checked by Fable in Chrome and WebKit: `reviews/review-fixes-01.md`). Phone preview: `npm run build && npm run preview:lan` in `site/`.
- **You:** decide on Quinn's UI/UX findings (`reviews/quinn-site-review-030.md`, U1–U9). Wren suggests U1, U5, U6, U7, U9 as one small round (plus the failed-opening message and pausing the paint-in when the tab is hidden); U2, U3, U4 need your call; U8 waits for the form service.
- **Launch blocker:** the contact form needs a host and form service (S1).

## Next
1. After your phone check: merge in order `site/scene-3` → `site/scene-4` → `site/scene-5` → `site/counter` → `site/review-fixes` into `main` (each needs Wren's review and your OK).
2. Model-sheet pass on scenes 1–2 (scene 1's glasses are already gone; Grow never had any).

## Branches
| Branch | Holds |
|---|---|
| `main` | Art pipeline, docs, and the site with scenes 1–2 (merged 2026-11-21). |
| `site/scene-1` → `site/scene-1-elegant` → `site/scene-2` → `site/scene-3` → `site/scene-4` → `site/scene-5` → `site/counter` → `site/review-fixes` | Site builds, stacked. Each includes the ones before. Merge in order. |
| `pr1`, `pr2` | Merged Foreman/Cursor PRs. Safe to delete. |

## Open decisions and launch list
- [ ] **Model-sheet pass for scenes 1 and 2:** restyle Rachel to `M01_rachel_model.png` (scene 1 also loses its glasses).
- [x] **Scene 1 glasses removed 2026-11-25** (Quinn 034/035; eye area only, checked for drift). Was: **Scene 1 still has glasses → remove them.** Decided: no glasses anywhere. Scene 1's frames (hammer loop, blink, reaction, wink, 2× set) were drawn with glasses and need a no-glasses re-edit. Plan this as its own task after the café.
- [x] Copy round 1 + Instrument Sans site-wide (Engine 013b, live 2026-11-25). Wording for Skip / Pause / Replay / Scenes is unchanged.
- [x] 404 page: Rachel sketching in front of a solid black Anton "404" (Quinn 044–046, Engine 014, live 2026-11-25). Text: "This page doesn't exist. Back to the start".
- [x] Faster opening, part 1 (Engine 011b, live). Part 2 (cast with the room, Film's double download, Set Design's backdrop wait) is on `wip/011-load-speed`.
- [ ] Contact form: live on Resend (Engine 012b), Vercel settings present. Needs one real test message from the user's phone. `CONTACT_TO` switches to Hui Jie at launch.
- [ ] Contact form: **Resend** (Vercel Marketplace integration, Free plan, sending domain hjaas.com in the Tokyo region; DNS auto-configured 2026-11-25, verification pending). Vercel env vars set: `RESEND_API_KEY` (integration), `MAIL_FROM`, and `CONTACT_TO`, which is the user's inbox while private (**switch to Hui Jie's at launch**). The code is Engine job 012.
- [ ] Hosting: **Vercel (user decided 2026-11-25).** Private preview on hjaas.com and www.hjaas.com from the `deploy` branch (`site/review-fixes` plus `site/middleware.js`, a password gate driven by the `PREVIEW_PASSWORD` env var). After each approved Engine job, Wren merges `site/review-fixes` into `deploy`. At launch: delete the middleware and the env var. Hobby fits, since this is a personal, non-commercial gift. Settings come from Quinn's load review (job 041).
- [ ] Domain.
- [ ] At launch: open up `robots.txt`; set `og:image` to the full URL.
- [x] Film scene: Sean's consent received (user, 2026-11-25).
- [ ] Optional: polish frames for the reaction; switch the lab's thumbs-up to a peace sign.
- [ ] Optional: in-betweens for Rachel's lean in Set Design (still a single cut, shown at least 500 ms).
- [ ] Your design notes from 2026-11-19 (too cartoonish, paint-in too fast, full-bleed): partly addressed by the elegant version and the edge. Re-check once scene 2 merges.

## Credits
Higgsfield: **126 credits** on 2026-11-20 night (the Film chat may have spent since; check). Starter plan: 4 jobs at a time; std mode only.

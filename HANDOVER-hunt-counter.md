# Handover: the hunt counter (two mushrooms) and the mobile scene crop

For the **main Wren chat** (orchestrator). From Wren (counter design chat), 2026-11-24 23:20 JST.
Read first: `STATUS.md`, `BIBLE.md` (updated with this design, §2 "UI"), then this file.
**Approved by the user 2026-11-24:** "this is fine", with one correction for mobile (§4).

## 1. What was decided
The old counter (enamel pin, then "You found all 10" next to the Contact button) is replaced by **two small mushrooms stacked in the bottom bar**, where the Contact button sits now:

| Row | Mushroom | Counts | Example |
|---|---|---|---|
| Top | **Cream** button mushroom, no spots | this scene, out of 10 | `7/10  3 more in Build` |
| Bottom | **Red** mushroom with three white spots (same look as the current Contact button icon) | all scenes, out of 50 | `17/50  find all 50 to contact Hui Jie` |

When all 50 are found, both rows turn into the existing **Contact Hui Jie** button (with the red mushroom, now full, as its icon) and the line "You found all 50". The counter and the button are one element. "Pause animation" and "Replay painting" stay on the right, unchanged.

Path the user took, so nobody reopens it: gallery label with ten mushrooms (rejected: too many mushrooms) → five alternatives (they picked option 1, one mushroom that fills) → red version in the real page → **two counters, cream for the scene and red for all 50** (approved).

**Mockups (the spec, interactive):** the canvas "HJaaS mushroom hunt: counter mockups", https://claude.ai/artifact/JzaDqGVtRS5PN8L7ukCfT9. First page, "Two counters in your page": live demo (`Page`), state by state (`BarStates`), phone (`PagePhone`). The phone artboard there is **out of date** (it squeezes the whole scene; see §4). The mockups say "Travel" for scene 5; the real tab is **"Set Design"**.

## 2. Exact spec (from the mockups)
**Drawing:** CSS or inline SVG in code, no new art needed. Outline in the page ink (`#2B2622` in the mockup), 1.5 px. Cap about 28×17 px, stem 12×12 px.
- Cream: cap fill `#E2C792`, stem fill `#F0E3C6`.
- Red: cap fill `#C8372D` with three cream spots, stem fill `#E7D3B3`.
- Unfilled parts: the page's paper colour.

**Filling:** bottom-up, stem first, then cap. `transform: scaleY()`, 500 ms, `cubic-bezier(.23, 1, .32, 1)`.
- Cream: stem fills over finds 1–3, cap over finds 4–10.
- Red: stem fills over finds 1–15, cap over finds 16–50.

**Numbers:** site serif (Spectral-like) 22 px, with "/10" and "/50" muted. Fixed width so the two labels line up. On each find the number rolls: the old one goes up 8 px and fades (160 ms), the new one comes from 8 px below (200 ms). The red row rolls 90 ms after the cream row.

**Labels (sans, 15 px, muted):** these follow the small-area research: under halfway, say what's found; past halfway, say what's left.
- Cream: `found in Build` while found < remaining; `3 more in Build` from halfway on; `Build complete` at 10/10.
- Red: `find all 50 to contact Hui Jie` while more than 25 are left; `24 more to contact Hui Jie` from 25 left down to 1.

**Scene complete (10/10):**
- **+450 ms:** a soft light glint sweeps across the cream cap (900 ms, `cubic-bezier(.645, .045, .355, 1)`).
- The scene's **menu tab gets a 5 px cream dot**, filled cream with a darker cream ring.
- A quiet **"Next: Grow →"** link fades in after the label. It goes to the next unfinished scene and needs a tap target of at least 44 px.

**All 50:**
- **+900 ms:** a glint sweeps across the red cap.
- **+2000 ms:** both rows crossfade (450 ms, 4 px rise) into the **Contact Hui Jie** button and "You found all 50".
- On a return visit after unlocking, show the button straight away, with no animation.

**Saving progress:** both counters read the existing saved hunt (per-scene counts). A return visit shows the saved state at once, with no roll or glint.

**Reduced motion:** no roll, no glint, no rise; fills and the crossfade change instantly or by opacity only.

**Accessibility:**
- Each mushroom gets `role="img"` with a label such as "7 of 10 found in Build" or "17 of 50 found in all scenes".
- One polite live region for the cream label.
- The Next link and the button are real links or buttons.

**Remove:** the enamel-pin counter if it still exists anywhere, and "You found all 10".

## 3. The unlock rule
The unlock is at all 50 (BIBLE §1). The scene-5 brief (`reviews/scene-5-build.md`) already moves the unlock to 50. This counter must use the same saved data and the same rule. It must not create a second one.

## 4. Mobile: the correction the user asked for
**User, 2026-11-24:** on a phone, the scene should be **more zoomed in**, not the whole landscape scene squeezed into the portrait frame. The exception is a phone turned sideways: then show the whole scene, as on desktop.

Wren's call, needed so the hunt stays fair (BIBLE: every mushroom always reachable):
- **Portrait:** the scene is shown taller, with its width running past the screen. Choose the height that looks right (about 55–65% of the screen height is a good start), so roughly the middle half of the scene is in view.
- **Panning:** the visitor swipes sideways to look around, with native momentum scrolling. Vertical page scrolling must still work, and no scrollbar shows.
- **Start position:** the scene opens centred on Rachel. Put a focal x for each scene in its package data.
- **Showing it can move:** after the paint-in, on the first visit only, the scene drifts gently about 40 px one way and back, once. No text.
- **Edges:** the painting's feathered watercolour edge still shows at the far left and far right ends.
- **Tap targets:** mushroom tap boxes stay at least 44 px. They get bigger at this zoom, which helps.
- **Hint wiggle:** it picks an unfound mushroom that is currently on screen. If none is on screen, it skips.
- **Counters on a phone:** stacked under the scene (cream above red), with "Pause animation" and "Replay painting" on a row below. Landscape uses the desktop layout.
- **Tell the user plainly** that panning is how the zoomed view keeps every mushroom findable. If they'd rather not pan, the alternative is placing every mushroom inside a portrait-safe middle zone. That means re-placing mushrooms in all five scenes, so ask before doing it.

## 5. What to do (in order)
1. **Write Fable's brief:** `reviews/hunt-counter-build.md`, in the pattern of the other build briefs. It covers §2–4.
   - **Branch:** `site/counter`, stacked on `site/scene-5`. Or stack it on whatever is newest when you write the brief, since the scene-5 brief already moves the unlock to 50.
   - **Evidence:** Playwright recordings of a find, a scene completing and the 50 unlock, on desktop and on a phone in portrait and in landscape; a Chrome DevTools trace on a throttled phone (60 fps); a check of the review-animations standards; and reduced-motion recordings.
2. Give the user **one short paste** for Fable, with the details living in the brief.
3. Review Fable's report: evidence first, then a short note for the user.
4. The user does a phone check, especially the portrait crop and the panning. Then merge in order after the scene branches. Nothing goes to `main` without your review and the user's OK.
5. Update `STATUS.md` as each step lands.

## 6. Working style (the user)
- One clear recommendation; don't jump between plans.
- Low effort for them: one paste per step.
- Check work properly before showing it.
- Mockups help them a lot. If something is hard to picture, put it on the canvas above rather than describing it in words.

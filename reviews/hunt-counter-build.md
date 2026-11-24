# Build brief: the two-mushroom hunt counter, and the phone view

From: Wren. For: Fable. 2026-11-24. Approved by the user 2026-11-24.
**The spec is `HANDOVER-hunt-counter.md` §2–4 (on `main`); read it in full.** This brief says where it goes and how it's checked. Interactive mockups: https://claude.ai/artifact/JzaDqGVtRS5PN8L7ukCfT9 (its phone artboard is out of date; §4 below wins; "Travel" there is "Set Design").

## 0. Branch
- Make `site/counter` from `origin/site/scene-5` **after round 4 is on it** (`reviews/scene-5-review-04.md` exists: Rachel painted in with the room). It then carries all five scenes, the unlock at 50 and the new paint-in.
- Bring `HANDOVER-hunt-counter.md` and `BIBLE.md` from `main` by path.
- Push `site/counter`. Don't merge anything; don't touch `main`.

## 1. The counter (spec §2)
Replace the caption's tally (`site/src/engine/caption.ts`: "N of 10 found" with one icon, and "You found all 10") with the two stacked counters, in the place the Contact button sits.
- **Cream** (this scene, /10) above **red** (all scenes, /50). Drawn in code (inline SVG or CSS), sizes, colours, fill thresholds, easing and timings exactly as the spec.
- **Numbers** roll (old up 8 px and out in 160 ms, new up from 8 px in 200 ms); the red row 90 ms after the cream. Fixed-width numerals so the rows line up.
- **Labels** switch from "found" to "more" at halfway, as the spec's rules say, with the scene's real tab name ("Set Design" for scene 5).
- **The flying mushroom** from a find (`mushrooms.ts`, it lands on `caption.targetRect()`) now lands on the **cream** mushroom, and the fill starts as it lands.
- **10/10:** cream glint at +450 ms; a 5 px cream dot on that scene's menu tab (stays on return visits); the quiet "Next: <tab> →" link to the next unfinished scene (44 px tap target). No link when every scene is done.
- **50/50:** red glint at +900 ms; at +2000 ms both rows crossfade (450 ms, 4 px rise) into the existing **Contact Hui Jie** button and "You found all 50". One element: the counter becomes the button.
- **Return visits** show the saved state at once: no roll, no glint, no crossfade; after the unlock, the button straight away.
- **Reduced motion:** no roll, glint or rise; changes are instant or opacity only.
- **Accessibility:** `role="img"` and labels on both mushrooms ("7 of 10 found in Build", "17 of 50 found in all scenes"); one polite live region for the cream label (reuse `.hj-sr`); the Next link and the button are real link/button elements.
- **Remove** the enamel-pin counter wherever it still exists, and "You found all 10".
- "Pause animation" and "Replay painting" stay where they are on desktop.

## 2. The unlock (spec §3)
Use the existing saved hunt (per-scene counts) and the existing all-50 rule. **Don't add a second store or a second rule.** The red count is the sum of the saved per-scene counts. Add a test that the counter, the tab dots and the unlock all read the same data.

## 3. The phone (spec §4)
**Most of this is already built** (`pan.ts`, the portrait rules in `site.css`): in portrait the window is as tall as the screen allows (4:5 to 2:3) and the room pans sideways natively, opening on each scene's `phoneStart`. The mockup's squeezed phone view is not what the site does. Keep that system; change only this:
- **Height:** check the window is about 55–65% of the screen height on 375×667, 390×844 and 430×932, with the counters and controls still on screen under it without scrolling. Adjust the clamp if not; say what you chose.
- **Start:** each scene opens centred on Rachel. If a scene's `phoneStart` isn't centred on her, fix it (give each package a focal x if that's cleaner).
- **"It moves" cue:** replace the "Swipe sideways" text with a gentle drift after the paint-in, **first visit only**: about 40 px one way and back, once, eased, no text. Never during the paint-in; never with reduced motion; not after the visitor has panned.
- **Hint wiggle** (`mushrooms.ts` `hint()`): it already prefers a mushroom on screen. Make it **skip** when no unfound mushroom is on screen, instead of wiggling one out of view.
- **Counters on a phone:** under the scene, cream above red, with "Pause animation" and "Replay painting" on a row below. Raise `--caption-h` to fit; nothing may overlap the scene.
- **Landscape phones** show the whole scene with the desktop layout. Check it at 844×390 and 932×430.
- Unchanged and still required: native momentum, vertical page scroll under the same finger, no scrollbar, the feathered edge at both ends, mushroom tap boxes at least 44 px.

## 4. Evidence (in `site/qa/counter/`)
- **Playwright recordings, 60 fps** (the screencast method from round 2), for desktop 1440×900, phone portrait 390×844 and phone landscape 844×390:
  - a find (the flying mushroom landing on the cream counter, both rolls);
  - a scene completing (glint, tab dot, Next link);
  - the 50 unlock (red glint, crossfade into the button), using the `?all=` QA preset;
  - a return visit after the unlock (button at once).
- **Reduced motion:** the same three, recorded once on desktop.
- **Phone:** stills of each scene's opening frame in portrait at the three sizes (Rachel centred, counters visible), and a recording of the first-visit drift.
- **Trace:** Chrome DevTools, throttled phone profile (4×), through a find and the 50 unlock: no dropped frames.
- **Standards:** go through `.claude/skills/review-animations/STANDARDS.md` item by item for the counter's motion and write the result in the report.
- `npm test`, type check, no console errors; WebKit check of a find and the unlock.

## 5. Report
`reviews/hunt-counter-review-01.md`, in the shape of `reviews/scene-5-review-02.md` (how to see it, asked-for vs result vs evidence, what changed, frame times, anything not done). Push `site/counter`.

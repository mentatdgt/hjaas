# HANDOVER — build the HJaaS website, scene 1 (MVP)

For: **Fable** (Claude Fable 5.2 in Claude Code, local session on the user's Mac).
From: **Wren** (art director / QC). Date: 2026-11-17.

Read this whole file, then `CLAUDE.md`, `scene/README.md` and `tasks/001-hammer-loop.md` before writing code.

---

## 1. What we're making

**HJaaS — Hui Jie As a Service.** A playful, highly polished one-page site for Hui Jie (English name **Rachel**), an interior designer who also does odd jobs: contracting/carpentry, interior design, video production, mushroom farming and travel. It's a gift from a close friend, so it should feel handmade, warm and delightful, not like a template.

The art is hand-drawn 2D in the style of the character sheets in `reference/`: flat colours, thick dark outlines and warm light. The site is a living illustrated scene, not a page of cards.

**This MVP is scene 1 only, the contracting scene.** Rachel kneels in an unfinished apartment room, hammering a nail into a wooden box. Visitors hunt for tiny mushrooms hidden around the room. Each find makes her look up at the viewer, beam, give a thumbs-up, then go back to work.

The bar is "smooth and professional, never clunky". The user rejected an earlier prototype for jerky motion, unnatural blinks, a hand disconnected from the body, and over-tight framing. Motion quality matters more than feature count.

## 2. Assets (all approved: use them, never edit them)

Coordinates below are in **plate pixels**. The room plate is 1672×941 and is the scene's coordinate system.

| What | File(s) | Notes |
|---|---|---|
| Room plate | `scene/room-empty.png` (1672×941) | Background. Rachel is never drawn into it. Warm light from the left window. |
| Hammer loop | `frames/001-hammer-loop/approved/frame_01..04.png` (573×458, transparent) | 1 contact, 2 lift, 3 wind-up, 4 down-swing. The box and nail are inside her frames, and the box is pixel-steady across frames. |
| Blink | `frames/002-blink/approved/blink_half.png`, `blink_closed.png` (573×458) | Same canvas as frame_01 (contact pose). Only use them while frame_01 is showing. |
| Reaction key poses | `frames/004-reaction-keyposes/approved/frame_01.png` (K1, beaming at the viewer), `frame_02.png` (K2, thumbs-up), both 573×458 | Same canvas and registration as the loop frames. |
| Mushrooms | `frames/003-mushrooms/approved/mushroom_01..09.png` | Red, white and yellow, all drawn at the same size. You scale them for depth. `preview-in-room.png` shows the intended look. |
| Other backdrops | `scene/merlion.png`, `cafe.png`, `mushroom-lab.png`, `travel-lookout.png` (1672×941) | For later scenes. Only used in the optional stretch item below. |
| Timing references | `frames/001-hammer-loop/approved/in-scene-timing.mp4`, `frames/002-blink/approved/in-scene-with-blinks.mp4` | Watch these. They show the target placement and rhythm. |

**Placement of Rachel** (port exactly from `composite()` in `tools/preview_timing.py`):
- Let `top` and `bot` be the first and last rows of frame_01 whose alpha is above 10.
- Scale every Rachel frame by `s = 455 / (bot - top)`.
- Draw each frame with its left edge at x = 600 and its top at y = 868 − bot·s.
- Every Rachel frame uses this same transform, so poses line up automatically.
- Add a soft, warm ground shadow under her: a blurred ellipse in rgba(60,30,10,~0.43) about 0.95 × the frame width, as in that function. The shadow is drawn in code, not baked into the art.

**Known limitation:** Rachel's frames are about 430 px tall at source. That's fine on desktop and slightly soft on phones. Do not upscale or regenerate art; Wren will supply sharper frames later. Build so that swapping in higher-resolution files is a file replacement, with the scale computed from the image, not hard-coded.

## 3. What to build

### 3.1 The living scene (core)
- The room plate fills the stage. Desktop, tablet and landscape phones show the whole room.
- **Hammer loop with human timing.** Do not play the frames at a fixed fps. Port `schedule()` from `tools/preview_timing.py` to JS and run it endlessly with live randomness:
  - Per swing: contact 260–460 ms, lift 110–150, wind-up 240–420, down-swing 60–80. Each swing is ×0.9–1.15 overall.
  - About 1 in 5 swings is preceded by 1–2 small taps: contact 160–220 ms, then lift 80–100 ms.
  - Every 3–6 swings she pauses on contact for 1.1–2.0 s.
  - Blinks are half (40 ms) → closed (70 ms) → half (40 ms), slipped into a pause or a long contact hold, about 30% of the time. Blinks never happen on other poses.
- **Pose switching must be instant and glitch-free.** Preload every frame and `await img.decode()` before the scene starts. Switch poses by toggling stacked, pre-decoded layers, or by drawing to one canvas. Never change `src` mid-animation. Drive timing from `requestAnimationFrame` with accumulated time, not `setTimeout` chains, so a delayed frame doesn't shift the rhythm.
- Pause the loop when the tab is hidden, and resume cleanly.

### 3.2 Mushroom hunt
- Place the 9 mushrooms in believable hiding spots: tucked behind or under things, on shelves and sills, in corners and at the floor edges.
- Scale them for depth. Further back (higher on the floor plane) means smaller; the nearest is about 34–44 px tall in plate px, the furthest about 16–20 px. Use `preview-in-room.png` as the feel reference.
- They should be findable but not obvious: no glow and no outline. A slight warm tint per spot is OK so they sit in the light.
- Hit areas are at least 44×44 CSS px even when the mushroom is tiny. They must not overlap.
- Show a small found counter in the UI, e.g. "🍄 3 / 9" (style it; don't use a raw emoji if it clashes).
- **On a find:**
  - The mushroom gives a quick, satisfying collect: a small lift and pop, then it flies or fades towards the counter. Keep it under ~450 ms.
  - The counter ticks.
  - Rachel reacts (3.3).
  - If she is already reacting, the find still counts but doesn't restart the reaction.
- **All 9 found:** a short, tasteful finale (for example a gentle shower of tiny mushrooms, plus one line of text such as "You found them all!") and a "hunt again" reset.
- Remember finds per visitor with `localStorage`, wrapped in try/catch, as a light convenience only.
- Optional: if nothing has been found after ~25 s, one mushroom does a single tiny wiggle as a hint.

### 3.3 Reaction (look up → beam → thumbs-up → back to work)
The real in-between frames are still being made (`tasks/005-reaction-motion.md`, via video in-betweening). **Build the reaction as a data-driven player now, so the real frames drop in later with no code changes:**
- Store the reaction in a manifest, e.g. `reaction.json`: an ordered list of `{frame, ms}` plus the beat markers from task 005.
- The beats are: notice 0.15 s → look up 0.35 s → thumbs-up 0.30 s → hold 0.9 s → back to work 0.5 s (look-up and thumbs-up reversed, eased).
- The loop always enters the reaction from, and returns to, the contact frame (frame_01). Wait for the current swing to reach contact before starting, so the hammer never teleports.
- **Interim content (placeholder until 005 lands):** contact → K1 → K2 and back, using very short dissolves of 120–180 ms between poses.
  - Long crossfades between different poses look ghostly (a double arm), so keep them short.
  - Add a tiny settle on K2: a 2–3 px vertical overshoot of the whole layer, about 120 ms. Don't scale her.
  - Mark this clearly in code (`// PLACEHOLDER until tasks/005 frames`) and in your report.

### 3.4 Intro: "painted into existence"
On first load the room should appear as if painted in by brush strokes, in chunks:
- Large, loose strokes reveal the plate region by region, roughly back wall → window light → floor → props. Total about 1.8–2.4 s.
- Rachel appears last with a short fade and settle (no paint on her), then the loop starts.
- Then the UI (logo, counter) fades in.
- Build the brush masks procedurally in code: stroke paths revealed through an SVG or canvas mask, or animated `mask-image`, whichever holds frame rate. There are no hand-painted mask assets.
- It must hold 60 fps on a throttled mobile profile (see 5). If a technique can't, simplify it rather than ship jank.
- Play the full intro once per visit, with a quick version on repeat visits.
- `prefers-reduced-motion`: a simple 300 ms fade, no strokes, and the hammer loop slowed to occasional taps.

### 3.5 Mobile (decided)
- Portrait phones show a 4:5 crop of the plate, initially centred on Rachel (plate x 514–1267 at full plate height). Visitors swipe sideways to explore the rest of the room.
- Panning should feel native: it follows the finger 1:1, has momentum, eases into the plate edges and has no vertical scroll fighting. Use `touch-action` correctly.
- Show a subtle one-time swipe hint, like a small hand or arrow nudge, that disappears after the first pan.
- Mushroom hit areas stay at least 44 px at the phone scale.
- No horizontal page scroll and no layout shift. Test at 390×844 (iPhone) and 412×915 (Android).

### 3.6 Logo, with the enamel-pin glint
- The final logo is a retro soft-enamel pin and isn't approved yet (`tasks/011-logo-enamel-pin.md`).
- Build a logo slot with a placeholder: "HJaaS" set in a tasteful retro display face (self-host an open-licence font), on a simple pin-shaped badge.
- Implement the **glint** in code now:
  - A diagonal highlight sweeps across, clipped to the logo's shape via mask, every ~9 s and on hover/focus.
  - Each sweep takes about 600–700 ms, with an ease-in-out that is fast in the middle.
  - Swapping in the final PNG later must need only a file swap.
- Tagline under or beside it, placeholder: "Hui Jie As a Service — design, build, film, grow, explore."

### 3.7 Light page chrome
- A small header with the logo.
- A minimal services strip or menu listing the five services, with only "Build" (contracting) live. Mark the others "coming soon" in a charming way.
- A short "about Rachel" line and a contact link. Use placeholder copy marked `TODO(copy)`; never invent testimonials, clients or prices.
- Keep chrome minimal so the scene is the hero. Use Impeccable to critique and polish this UI.

### Stretch (only after everything above passes QA)
The "coming soon" services can show their backdrop (`scene/*.png`) behind a soft scrim on hover/tap, using a quick painted wipe built with the same brush-mask system. This previews scene transitions. Skip it if time is short.

## 4. Technical decisions (already made)
- **Stack:** Vite + vanilla TypeScript + GSAP (free, including plugins, from npm). No framework. Other dependencies only if clearly needed; say why in your report.
- **Location:** everything goes in a new `site/` folder. Copy approved PNGs into `site/public/assets/` and convert them to lossless or near-lossless WebP. Keep the originals untouched.
- **Output:** a static build (`npm run build` → `site/dist/`), hostable on GitHub Pages, Netlify or Vercel later. No backend, no analytics, no trackers.
- **Motion rules:** read `.claude/skills/emil-design-eng`, `choreograph` and `animation-performance` before building motion.
  - Animate only `transform`, `opacity` and filter/mask where it is proven cheap.
  - No layout-triggering animation.
  - Use `will-change` only on active layers.
- **Accessibility:** mushrooms are buttons with labels ("Hidden mushroom"), the counter is announced politely, and everything works with a keyboard (Tab cycles mushrooms in a sensible order) and with reduced motion.
- **Don't touch** `reference/`, `scene/`, `frames/`, `tasks/` or `tools/`. Run no paid image or video generation. Use no Gravity Falls names, logos, fonts or characters; the style inspiration stays unspoken.

## 5. QA: required before you call anything done
Use the tools installed in this repo (see `CLAUDE.md`). Save all evidence under `site/qa/`.

1. **Playwright:**
   - Record a video of the intro, a full minute of the hammer loop, one reaction and the all-found finale. Do this on desktop (1440×900) and iPhone portrait (390×844, WebKit).
   - Take screenshots of every state.
2. **Chrome DevTools performance traces:**
   - Trace the intro reveal, a reaction and a phone pan with 4× CPU throttling and mobile emulation.
   - Target: no dropped frames during motion, and no long tasks (>50 ms) while anything is animating.
   - Report the numbers.
3. **Motion review:** go through `.claude/skills/review-animations/STANDARDS.md` item by item and record pass/fail per item.
4. **Impeccable:** run a critique or audit on the page chrome and fix what it finds.
5. **Watch your own recordings** for the user's past complaints: jerky rhythm, unnatural blinks, pose pops, disconnected hands, framing that's too tight, flicker on pose switch, and any edge fringe around Rachel.

## 6. How to work
- Create the branch `site/scene-1`. Commit at each milestone with clear messages, and push. **Don't merge to `main`**; Wren reviews first. If a push fails on authentication, stop and tell the user.
- **Milestones** (finish and verify each before the next):
  1. Scaffold and asset pipeline, with the static room and Rachel placed correctly.
  2. Hammer loop and blinks.
  3. Mushroom hunt and placeholder reaction.
  4. Intro reveal.
  5. Mobile crop and pan.
  6. Logo glint and chrome.
  7. Full QA pass.
- Start by posting a short plan, then proceed without waiting for approval. Ask the user only when genuinely blocked.
- The user is non-technical. Tell them how to view the site: the exact command (`cd site && npm install && npm run dev`) and the local URL.

## 7. Final report (paste in chat, also save as `site/qa/REPORT.md`)
- ✅ / ❌ / ⚠️ for every requirement in sections 3 and 5, each with an evidence path.
- The performance numbers from the traces.
- **What is placeholder:** the reaction frames, the logo and the copy.
- Anything you'd change in the art pipeline to make the site better. Address that to Wren.

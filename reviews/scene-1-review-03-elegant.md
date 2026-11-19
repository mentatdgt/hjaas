# Scene 1, review 03: the elegant version ("a painting on a page")

For: **Fable**, building a **separate version** so the user can compare it side by side with the current one.
- Create the branch `site/scene-1-elegant` from `site/scene-1`. Commit per item and push.
- Don't merge into `site/scene-1` or `main`.
- Background: the research report in the user's Drive (summarised here) and `reviews/user-notes-pending.md`.

**The user's notes:** too cartoonish, not elegant; the paint-in is too fast to enjoy; full-screen feels like a game; they'd like a smaller scene, like a painting on a page.

**Direction:** option (a) from the research. Present the room as **one framed illustration on a warm paper page**, give the first painting time to unfold, then let the page go quiet. No new art; reuse every asset.

**Out of scope this round:**
- **The logo.** Keep it exactly as it is, glint included; it's the user's call later. Only its position on the page may change.
- **New copy.** Placeholders only, marked `TODO(copy)`.

## 1. The page and the frame
- **Paper:** a chalk-coloured page around the art, about `#F6F3EC`, with warm charcoal text, about `#302E29`. Mustard is a small accent only.
  - Optional: a static, very faint paper grain around the artwork. Never animated, and never over text or the hiding spots.
- **Desktop:** the full room shown as a framed picture, about 1040 px wide on a 1440 px window, centred.
  - A pale mat (the blank border around a picture) and a fine border, with generous margins.
  - Scale it sensibly from 1024 up to 2560 px windows. The whole room is always visible.
- **Above the picture:** the logo plus "Hui Jie" in a restrained serif. A second line is a placeholder: `TODO(copy)`.
- **Below the picture:** the hunt caption (see 3).
- **Remove** the full-screen dark surround and the ambient glow layer.

## 2. Phones
- About 16–20 px page margins.
- The picture window is a tall crop, up to 2:3 (keep review 01's framing on Rachel and the box), inside a thin mat. The visitor still swipes sideways inside it to explore; keep the native panning.
- **The page scrolls vertically now.** Make sure vertical page scrolling and sideways panning both work smoothly; revisit `touch-action` for that. Test on WebKit.
- The swipe hint: small and quiet, shown once, and placed in the caption area rather than over the box.
- **Tap areas:** the research found that the invisible 44 px tap boxes for `tiles` and `screed` (and possibly `toolbox`) get clipped at the bottom edge of the window. Move those boxes inward while keeping each drawing in place, and keep the keyboard focus outlines visible.

## 3. Quieter interface
- **The counter becomes a caption under the picture:** "3 of 10 found", with the existing small mushroom icon.
  - Equal-width digits.
  - No enamel depth, metallic rim, squash or rolling number. One quick, quiet update per find: a short fade or nudge, under 300 ms.
  - A collected mushroom can still travel to the caption, but faster and more subtly.
- **The 10/10 unlock:** replace the mushroom shower with Rachel's reaction plus a clear, calm change from the caption into a "Contact Hui Jie" button. The form opens from it as now.
- **Buttons and the form:** flat, clearly labelled, restrained outlines, press feedback of about 100–160 ms. Restyle the form to match the paper page.
- **Glints:** the logo keeps its glint. Remove the glint everywhere else (counter, button).
- **Cursor:** the normal cursor. Hovering must never reveal a mushroom.

## 4. The paint-in
**First visit, about 5 s in total:**
| Element | Timing |
|---|---|
| Paper page, identity, a quiet "Skip" control | Present from the start; no entrance sequence |
| Brushwork | Double every stroke's current start time and duration (0.48–1.28 s per stroke), so it runs 0–4.32 s. Keep the uneven, overlapping schedule. |
| Each stroke's easing | `cubic-bezier(0.645, 0.045, 0.355, 1)` |
| Wash | About 4.06–4.48 s |
| Rachel | About 4.40–4.68 s: opacity plus a 4 px settle |
| Mushrooms | Become visible and usable with the wash |
| Caption | About 4.56–4.76 s, with `cubic-bezier(0.23, 1, 0.32, 1)` |
| First hammer swing | About 5.0 s, after a brief still moment |

- Tune the values on a recording; they're starting points.
- **Return visits:** no brushwork, just a 200 ms reveal. Keep found mushrooms, the unlock and the pan position. Offer a quiet "Replay painting" link.
- **Skip:** jumps to the finished state immediately at any point. The opening never blocks interaction.
- **Keep review 02's WebKit fix:** the canvas stays on as the room, with no swap at the end. Re-measure on a cold load in WebKit: no frame over about 50 ms at the end of the intro.

## 5. Motion control and reduced motion
- **Pause:** add a quiet "Pause animation" control for the hammer loop. Automatic motion over 5 s needs a way to stop it.
- **Reduced motion:** everything shows together in 200 ms. No strokes, glints, flights or falling pieces. Rachel holds her working pose, and counts update instantly.

## 6. QA and report
- Screenshots at 1440×900, 1024×768, 2560×1440, 390×844, 412×915 and 360×740.
- **One recording of the new first-visit intro** on desktop and one on an iPhone (WebKit). Motion is the point of this round.
- A WebKit cold-load check of the end of the intro.
- All 10 mushrooms findable on a phone, with the tap boxes unclipped.
- Vertical scroll plus sideways pan working on a phone.
- Add a "Review 03 (elegant)" section to `site/qa/REPORT.md` with ✅/❌ per item and evidence paths.
- Put the before and after first screens side by side in one image: `site/qa/review-03/compare.jpg`.

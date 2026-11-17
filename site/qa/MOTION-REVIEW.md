# Motion review against `.claude/skills/review-animations/STANDARDS.md`

Reviewed 2026-11-18 on the final code of `site/scene-1`. Each section of the standards is one row or
more. ✅ pass, ⚠️ deliberate departure (reason given), ❌ fail. There are no ❌.

## Should it animate?

| Item | Verdict | Notes |
|---|---|---|
| Frequency fits the motion | ✅ | Nothing here is a 100-times-a-day action. The hammer loop is the artwork itself. A find happens ten times per visitor. The intro is a first-run moment, and repeat visits get the 0.8 s quick version. |
| Every animation has a purpose | ✅ | Flight = "collected" (spatial: it lands on the pin's own mushroom). Roll, squash and glint = feedback. Morph = state change (the counter becomes the button). Dialog = it comes from the button. Wiggle = the one hint. |
| Never animate keyboard-initiated actions | ⚠️ | Opening the form from the keyboard and closing it with Escape are instant (`form.ts`, `open(event.detail === 0)`, `close(true)`). A find made with Enter still plays the flight and the counter: there it is the reward and the only feedback, and it happens at most ten times. |
| Idle loops wait and repeat rarely | ✅ | Logo glint every 9 s (brief). Swipe hint waits 1.1 s, rests 3.2 s between nudges and stops at the first pan. The wiggle is once per quiet minute. |

## Easing

| Item | Verdict | Notes |
|---|---|---|
| Entering/exiting use ease-out | ✅ | Logo, counter, Rachel's settle, prompt line and dialog all use `cubic-bezier(0.23, 1, 0.32, 1)`. |
| On-screen movement uses ease-in-out | ✅ | Pin morph and glints use `cubic-bezier(0.77, 0, 0.175, 1)`; the flight uses `power2.inOut`. |
| Hover and colour changes use `ease` | ✅ | Chips, close button, field borders, the count-to-label cross-fade. |
| Constant motion is linear | ✅ | The intro's paint clock; plain opacity fades. |
| Never ease-in on UI | ⚠️ | One use: the finale's falling mushrooms use `sine.in`, because things that fall speed up. It is a decoration, not a response to an action. Nothing a visitor triggers starts slowly. |
| Strong custom curves, one family | ✅ | Two curves, defined once in `scene.css` and mirrored in `motion.ts`. The phone sheet uses the iOS drawer curve `cubic-bezier(0.32, 0.72, 0, 1)`. |

## Duration

| Item | Verdict | Notes |
|---|---|---|
| Press feedback 100–160 ms | ✅ | 160 ms on the pin button, Send, chips, close and logo. |
| Small popovers 125–200 ms | ✅ | Prompt line: 200 ms in, 160 ms out. |
| Modals/sheets 200–500 ms | ✅ | Desktop sheet 300 ms in, 200 ms out. Phone sheet 440 ms in, 240 ms out. |
| UI under 300 ms otherwise | ⚠️ | The counter-to-button morph is 500 ms. It happens once per visitor, is the celebration, and the brief asks for one continuous motion: the pin widens by about 70 px while the label slides in with the icon, which needs the room. The flight (560 ms) and glint (650 ms) are the brief's own numbers. The odometer is 500 ms on a strong ease-out, so the new digit is readable within about 150 ms. |

## Physicality

| Item | Verdict | Notes |
|---|---|---|
| Never from `scale(0)` | ✅ | Smallest starting scales: logo 0.97, dialog 0.96. The flying mushroom only shrinks as it leaves, and fades over the last 7%. |
| Popovers are origin-aware | ✅ | The sheet scales from the button's corner (`transform-origin: calc(100% - 60px) 0`); on phones it rises from the bottom edge. |
| Pressable things answer the press | ✅ | `scale(0.97)` on the pin button and Send, 0.96 on chips, 0.94 on close, 0.98 on the logo link. Mushrooms answer with the pop itself. |

## Springs

| Item | Verdict | Notes |
|---|---|---|
| Bounce kept subtle | ✅ | The pin's squash settles on a spring with damping 0.82 (about 1% overshoot). Peak scale 1.055 (brief: ≤ 1.06). |
| Momentum where gestures need it | ✅ | Phone panning is the browser's own scroll physics. Mouse dragging carries the hand's speed and decays. |

## Interruptibility

| Item | Verdict | Notes |
|---|---|---|
| Rapidly triggered UI uses transitions | ✅ | Prompt line, dialog and pin morph are CSS transitions. Reopening the sheet while it closes carries on from where the exit had got to. |
| Sequences survive a re-trigger | ✅ | A second find while Rachel is reacting counts and does not restart her. Two landings close together: the squash restarts from its current scale; the roll restarts from the digit that was arriving (a jump of a few pixels at most). A glint in progress is left to finish (logo) or restarted cleanly (pin). |
| Loop resumes cleanly | ✅ | The hammer loop stops on its pose when the tab is hidden and continues from it. A reaction waits for the swing to land, and the loop takes over again from the contact frame. |

## Asymmetric timing

| Item | Verdict | Notes |
|---|---|---|
| Exit faster than enter | ✅ | Prompt 200/160 ms, desktop sheet 300/200 ms, phone sheet 440/240 ms. |

## Performance

| Item | Verdict | Notes |
|---|---|---|
| `transform` and `opacity` by default | ✅ | Exceptions, each measured: `clip-path` for the pin morph (a documented exception; a 190 × 44 px element); a 2 px blur on the leaving number; the intro and Rachel are canvas draws. |
| No layout-triggering animation | ✅ | Nothing animates size or position properties. In the final traces the most layout inside any animation frame is 13 ms at 4× throttling (the moment the counter's state changes). |
| No CSS variable driving per-frame child transforms | ✅ | `--u` changes only on resize; `--d` changes once, at unlock. |
| No `transition: all` | ✅ | Every transition lists its properties. |
| `will-change` only where measured | ✅ | On the pin (without it the pin was re-rasterised on every frame of the squash), and on the short-lived flying mushroom and finale pieces. |
| No `filter` over moving children | ✅ | Found and fixed during QA: a `drop-shadow` on the pin caused a 480 ms stall during the glint. The shadow is now its own layer. |
| Numbers | ✅ | See `traces/SUMMARY.md`. |

## Transforms and clip-path

| Item | Verdict | Notes |
|---|---|---|
| Percent translates over fixed pixels | ✅ | Sheet `translateY(100%)`, odometer `yPercent`. |
| `clip-path` used as a reveal | ✅ | The pin is laid out at button width and clipped to the counter, so its text never reflows as it widens. |

## Gestures and drag

| Item | Verdict | Notes |
|---|---|---|
| Follows the finger 1:1, momentum, soft edges | ✅ | Native horizontal scrolling on phones (`touch-action: pan-x`, `overscroll-behavior-x: contain`). |
| Pointer capture, multi-touch safety | ✅ | Capture on mouse drags; touch is handled by the browser. A drag never picks a mushroom on release. |
| Friction rather than a hard stop | ⚠️ | True on touch. Mouse dragging in a narrow desktop window stops at the room's edge without a rubber band; it is a fallback for an unusual window shape. |

## Masking crossfades

| Item | Verdict | Notes |
|---|---|---|
| Blur to join two states | ✅ | The number dissolves with a 2 px blur as the label takes its place. Rachel's poses are never cross-faded: real in-between frames are swapped whole. |

## Stagger

| Item | Verdict | Notes |
|---|---|---|
| Short, non-uniform, one entrance per container | ✅ | Intro: logo, then the counter 140 ms later, then the prompt 360 ms after that. The counter arrives as one object. Finale pieces start at uneven times. |
| Never blocks interaction | ✅ | Mushrooms can be found from the moment they are visible (the wash), before Rachel and the logo have arrived. |

## Accessibility

| Item | Verdict | Notes |
|---|---|---|
| `prefers-reduced-motion` | ✅ | A 300 ms fade instead of the painting; occasional taps instead of full swings; the reaction shows its held pose only; a found mushroom fades instead of flying; the number cross-fades; no glints, shower or nudging hand; the hint is a dip in opacity; the morph and the sheet only fade. |
| Hover gated to real pointers | ✅ | Hover styles sit behind `(hover: hover) and (pointer: fine)`; glints on hover only fire for a mouse. |

## Cohesion

| Item | Verdict | Notes |
|---|---|---|
| Motion matches the object | ✅ | The pin and logo are small, heavy, polished things: short travel, almost no bounce, one glint. The room is hand-painted: loose strokes with ragged edges. |

## What still needs a person's eye

Three things a recording on this Mac cannot settle: whether the paint strokes read as brushwork or as
a wipe on a small phone; whether the 500 ms morph feels like one gesture; and how panning feels under a
real thumb. Videos are in `video/`; the morph frozen at six points is in `m6/`.

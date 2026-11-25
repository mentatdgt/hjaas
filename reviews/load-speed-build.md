# Load speed, build brief (user approved 2026-11-25)

**Scope (user):** faster opening and faster scene changes only.

**Not now:**
- the loading message and the "tap was heard" signal;
- Vercel setup;
- AVIF;
- service worker;
- the other suggestions in the review.

**Background:**
- `reviews/load-review-wren.md` is the summary.
- `reviews/load-review-041-astra.md` (L1 and L2) is the detail.

## 1. Faster opening (L1)
- Start Build's paint-in once the room, the hunt's art and Rachel's **rest pose** (the still she is painted in) are decoded and drawn.
- Download her other poses and clips after that, then decode and rehearse them in small batches between paint frames. No long task during the brush.
- Her routine starts only when its first sequence is ready, including after Skip. Until then she holds the rest pose, with pixels identical to today.
- **Scope:** Build first. The same rule for every scene's first painting where the code is shared.

## 2. Faster scene changes (L2)
- **Cast with the room:** on a switch, start the new scene's cast manifest and rest-pose art together with its room, not after the room and the hunt.
- **Next room ahead:**
  - After a scene has settled (painting done, routine running), download the most likely next room's picture in the background at low priority, into the HTTP cache only. Do not decode it, and release any temporary blob at once.
  - At most one room at a time. Cancel it on any tap.
  - Skip it when the browser asks to save data.
  - The most likely next room is the next tab in the menu that has not been visited this visit.
- **Theatre backdrop:** fetch only the pieces already earned plus the next one; stream the rest in hunt order.
- **Grow's later clips:** they must never delay a tap. Taps come first.

## Must not change
- How it looks.
- The paint-in on every change (job 009).
- Round 4's rule: "room painted but she isn't" stays 0.
- Memory: the 30 orders and the rapid-tap peak stay under 80 MB. Never two casts or two edges decoded at once.
- 60 fps in the paintings.

## Checks
- **Throttled runs,** phone 390x844 WebKit and Chrome, at Fast 4G (9 Mbps, 60 ms) and Slow 4G (1.6 Mbps, 150 ms), against the current build:
  - tap-to-first-stroke for the opening;
  - for a cold switch to Grow, Design and Theatre;
  - for a switch after the next room was fetched ahead.
- **Bytes and requests** before the first stroke, against today's.
- **Network log:** the next room is downloaded exactly once and never twice (Safari included).
- **Trace,** phone at 4x slower: dropped frames in the opening and in a switch, against today's.
- **Memory:** the 30 orders and rapid tapping.
- **Tests,** type check and build; the hunt 50 of 50 on desktop and phone.

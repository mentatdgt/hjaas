# Build brief: load speed part 2 (Film and Set Design open faster on slow data)

**Approved by the user 2026-11-26** ("queue load speed part 2"). This is L2 from `reviews/load-speed-build.md` §2, split into two jobs so neither runs out of time (job 011 did, with L1 and L2 together).

**Starting point:** `wip/011-load-speed` (`a009ff9`) has job 011's L1 + L2 code, its tests, the slow-line server and the timing tool. L1 shipped differently in job 011b, so **don't merge the WIP branch.** Use it as a reference: port its L2 parts onto today's `site/review-fixes`, adapting them to 011b's design.

Job 011b's numbers (Slow 4G, page load to first stroke, WebKit phone): Film 15.93 s, Set Design 15.72 s, against Build 10.08 s. Job 011's version of "cast with the room" got Film to 9.97 s.

## Part A, job 019: Film (and every scene change)
1. **Cast with the room:** on a switch, start the new scene's cast manifest and rest-pose art together with its room, not after the room and the hunt.
2. **Film's room downloaded twice** (011b report, item 3): find why and make it download once.

## Part B, job 020: Set Design, next room ahead, Grow
1. **Theatre backdrop:** fetch only the pieces already earned plus the next one; stream the rest in hunt order. The stagehand must not hold up the first stroke: he joins when ready (Rachel's rule still applies: never "room painted but she isn't").
2. **Next room ahead:** after a scene has settled (painting done, routine running), download the most likely next room's picture in the background at low priority, into the HTTP cache only. Don't decode it, and release any temporary blob at once. At most one room at a time. Cancel it on any tap. Skip it when the browser asks to save data. The most likely next room is the next tab in the menu not yet visited this visit.
3. **Grow's later clips** must never delay a tap. Taps come first.

## Must not change (both parts)
Everything in `reviews/load-speed-build.md` "Must not change": the look, the paint-in on every change, "room painted but she isn't" stays 0, memory under 80 MB (30 orders and rapid taps), never two casts or two edges decoded at once, 60 fps in the paintings.

## Checks (each part, against the build before it)
- WebKit phone 390x844 and Chrome, Fast 4G and Slow 4G: tap-to-first-stroke for the opening and for a cold switch to Grow, Design, Film and Set Design (Part B: also a switch after the next room was fetched ahead). Median of 3.
- Bytes and requests before the first stroke. Network log: every room, and the next room ahead, downloaded exactly once (Safari included).
- Trace, phone at 4x slower: dropped frames in the opening and in a switch.
- Memory: the 30 orders and rapid tapping.
- Tests, type check and build. The hunt is 50 of 50 on desktop and phone.

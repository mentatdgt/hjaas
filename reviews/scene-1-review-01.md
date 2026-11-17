# Scene 1: Wren's review 01 (2026-11-18)

For: **Fable**, on the branch `site/scene-1`. Do these on that branch, commit each item separately, push. Don't merge to `main`.

Overall: a strong first build. The rhythm, the hunt, the counter, the paint-in and the form all match the brief, and the QA evidence is thorough. Below are the fixes and decisions from review. Items marked **(user)** are the user's own calls.

## 1. Bring in the new art from `main`
`git merge origin/main` into `site/scene-1`, then `npm run assets`. That brings:
- **The wink (task 015, approved):** `frames/005-reaction-motion/approved/rx_wink_half.png` and `rx_wink.png`. `reaction.json` now plays K2 300 ms → half-wink 50 → wink 260 → half-wink 50 → K2 240 inside the thumbs-up hold. The player should need no code change; confirm it.
- **A fixed 2× K2 (thumbs-up):** the old K2 had a lumpy thumb outline. Both `frames/016-upscale/approved/K2.png` and `rx_K2.png` are replaced.
- Re-record one find on desktop and on an iPhone in WebKit, and check the wink frame by frame (`?slow=`).

## 2. Load each duplicate frame once
`rx_frame_01`, `rx_K1` and `rx_K2` are byte-identical to the loop's `frame_01`, `K1` and `K2`. Have the asset script or the player map them to the same decoded image, so they're downloaded and decoded only once. Leave the manifest format as it is.

## 3. Production must ignore the QA switches
Right now `?found=10` works on the live site, so anyone could skip the hunt and open the form, which is the whole prize. Honour the URL switches only in dev builds (`import.meta.env.DEV`). Keep them all working on `npm run dev`.

## 4. Phones: use the screen height (recommended; the user can veto)
On a 390×844 iPhone the room is a 4:5 band with large empty dark areas above and below it (`qa/screens/iphone-01-fresh.jpg`). Make the stage **as tall as the available space allows, up to 2:3** (width:height):
- Start on Rachel and the box: plate x ≈ 590–1220 fits a 2:3 crop of the full plate height.
- Keep the native sideways panning and the swipe hint.
- 4:5 remains the minimum on short screens. Logo and counter stay in the top row.
- Check at 390×844, 412×915 and 360×740. No page scroll, no layout shift.

## 5. Hint: one wiggle per visit (user)
The user asked for one small wiggle after 60 s and nothing more. Make it **once per visit**, not once every quiet minute.

## 6. The mushroom at the ladder foot reads as a nail
At spot `ladder-foot`, drawing 5 (the very slender one) looks like a nail standing on the tiles. Swap that spot to a drawing that reads as a mushroom at that size, or move drawing 5 somewhere its shape reads clearly, e.g. growing from a crack in the screed. Keep ten spots and depth scaling.

## 7. Page weight: approved
Use lossy WebP at quality ~95 for Rachel's loop and reaction frames (your suggestion: about 4 MB less). Check outlines at 3× for halos or banding; if any appear, raise the quality until they're gone. Keep the mushrooms, logo and favicon lossless.

## 8. Coming soon from Wren (no action until the files land on `main`)
- **A 2× room plate** (`scene/room-empty@2x.png`, 3344×1882). Make sure SPOTS, Rachel's placement and the pan crop work in plate-relative units, so switching the plate is a file swap.
- **The final logo** (task 014 round 3) in `assets/logo/`. Run `npm run assets` when it lands.

## 9. Not changing now
- The Contact button's position on phones (top row). Fine for v1.
- Hunt-only access to the form. That's the concept.

## Done means
Append a short "Review 01" section to `site/qa/REPORT.md`: ✅/❌ for items 1–7, with evidence paths. Push.

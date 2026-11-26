# Lab mister: what Grow needs to play a room loop like Film's water

Wren, 2026-11-26. No engine code was changed. Line numbers are from `origin/site/review-fixes`.

## What's delivered

`frames/024-lab-mister/site/` is a cast package in the same format as `frames/020-film-scene/site/`:

- `frames.json`: canvas 1672x941 (plate space), one layer `mister` at x 1245, y 336, w 123, h 159, stills `M1`..`M4`, `"scenery": true`, `"clips": {}`. It has **no `plate`**: the lab's plate is still `scene/mushroom-lab.png`, which the site ships as `scene2/room.webp`.
- `routine.json`: `actors.mister`, one loop `M1 → M2 → M3 → M4` at 140 ms each, repeated `[1000, 1000]`, with the same "part of the scenery" note as the water.
- `mister/M1..M4.png`: RGBA, 123x159. Outside the mist, each patch is the room itself (`room.webp` pixels). Its alpha is solid, feathered to clear over the outer 10 px. Drawn at its box over the plate, it differs from the room only where the mist is.

## Why Grow can't play it today

Film plays its water through no special engine code. The water is just one more actor in a `kind: 'cast'` package (a "troupe"). `scene.ts` `troupe()` (line 333) turns every layer into an actor with `splitCast()` (`cast.ts`, ~line 143) and plays each with `actorCast()`. The only things "scenery" changes are in the build:

- `build-assets.mjs` lists the layer under `room` in `film-cast.json`, not under `covers` (lines ~255-280).
- So `film.ts` puts only the presenter and Rachel in `keep`, and the edge fades the water with the plate.
- The pencil map gets the "moving lines" cleanup inside its box (`withoutMovingLines`, `castLines`, line 332).

Grow uses `kind: 'clips'` (`grow.ts`, `character: { kind: 'clips', dir: 'rachel/', … }`). `Scene.castFor()` (`scene.ts` line 773) turns that into a list of exactly one actor (`clipCast()`, line 311). A clips cast can't carry a second layer.

## What to add (smallest change, keeping Rachel's clips package and her 1.5x set as they are)

1. **`src/engine/types.ts`, `ClipCast`** (line ~88): add an optional room-loop package:
   ```ts
   /** Moving parts of the room (a cast package of scenery layers: the lab's mist), drawn under her. */
   scenery?: { dir: string; frames: string; routine: string };
   ```
2. **`src/engine/scene.ts`, `Scene.castFor()`** (line 773): for `kind: 'clips'` with `scenery`, load that package with the existing `troupe()` and put its actors **before** Rachel:
   ```ts
   const room = cast.kind === 'clips' && cast.scenery ? await troupe(config, { kind: 'cast', ...cast.scenery }, host) : null;
   const one = await (cast.kind === 'clips' ? clipCast(…) : frameCast(…));
   return async () => [...(room ? await room() : []), await one()];
   ```
   This needs care in two places:
   - **Class name.** Inside its own one-layer troupe the mister is the lead, so `troupe()` (line 341) would give it `className: 'hj-rachel'`. QA scripts use `document.querySelector('.hj-rachel')` (qa/tools/review04.mjs, scene3.mjs), and the mister would be first in the DOM. Give `troupe()` a flag, or a `lead` override, so scenery layers always get `hj-actor`.
   - **Failure.** If `room()` fails, release what's already decoded, as `troupe()` does for its own actors, and still return Rachel. Better yet, catch it and show the room without the mist: a missing mist should never cost the scene its character.

   Nothing else in `scene.ts` needs to change:
   - `attach()` (line ~909) takes a list already, and `leadOf()` picks the first actor that reacts, which is Rachel.
   - Cast elements are inserted in list order, so the mist sits under her and over the mushrooms. That's the same as Film's water.
   - `stagger()`, `drawn()`, `work()`, `hold()`, `rest()` and the memory count all loop over `this.casts`.
3. **`src/scenes/grow.ts`**: `character: { kind: 'clips', dir: 'rachel/', …, scenery: { dir: 'cast/', frames: 'frames.json', routine: 'routine.json' } }`. Leave `keep` unset: the mist is scenery, so it fades with the plate. The edge doesn't reach it anyway (edge-band 152 px; the box is x 1245-1368, y 336-495).
4. **`scripts/build-assets.mjs`**: add the package to `PACKAGES` (line 136) as `{ dir: 'frames/024-lab-mister/site', to: 'scene2', json: 'grow-cast.json', lines: null }`, and make the loop accept a package without a plate or lines:
   - Line 191: `if (delivered.plate) add(…room.webp…)`. Otherwise it would try to encode `frames/024-lab-mister/site/undefined` over `scene2/room.webp`.
   - Line 332: filter `castLines` to packages with `pack.lines`. Grow's pencil map is already made from `['grow-lines.png', 'scene2']`, and the mist is nowhere near the pencil strips, so no line cleanup is needed.
   - The loop then writes `scene2/cast/frames.json`, `routine.json` and `mister/M1..M4.webp`, plus `src/scenes/grow-cast.json` with `room: ['mister']`.
   - Optional: encode these stills at `patchFrame` (quality 99) or lossless rather than `castFrame` (93). They're tiny (123x159), and most of each one is the plate repeated, so a higher quality keeps the patch's interior within a level of the plate's.
5. **Tests** (`src/scenes/scenes.test.ts`):
   - Mirror Film's `expect(filmCast.room).toEqual(['water'])` with `growCast.room` = `['mister']`.
   - Add a check that no Grow spot's drawing is inside `growCast.boxes.mister`, as Film's comment says for its water. Today's nearest is `switch-box` (x 1293, base y 314, so its drawing is y 296-314), 22 px above the box's top. The others are well clear.
   - `qa/tools/scene2.mjs` counts the lab's downloads by path (`/scene2/rachel/`). The new `scene2/cast/` files will need adding to its budget if it asserts totals.

## Where Film does the same thing

| Grow (to add) | Film (already there) |
|---|---|
| `frames/024-lab-mister/site/` (layer `mister`, `scenery: true`) | `frames/020-film-scene/site/` (layer `water`, `scenery: true`) |
| `routine.json` → `actors.mister` loop, 140 ms | `routine.json` → `actors.water` loop `flow`, 110 ms |
| `build-assets.mjs` `PACKAGES` entry → `scene2/cast/`, `grow-cast.json` | `PACKAGES` entry → `scene4/cast/`, `film-cast.json` (`room: ['water']`) |
| `grow.ts` `character.scenery` (new) | `film.ts` `character: { kind: 'cast', … }` (water is one of the cast) |
| `castFor()` joins scenery actors + Rachel's clip actor | `castFor()` → `troupe()` plays every layer |
| `keep` unset: the edge fades it with the plate | `film.ts` `KEEP` holds only presenter, Rachel, Merlion head, so the water fades with the plate |

**Alternative:** turn the whole lab into one `kind: 'cast'` package, with Rachel as a `scale: 2` layer and her clips given `layer: 'rachel'`. That is closer to Film but larger, and it loses her `rachel-1.5x/` set for narrow screens: troupes have no `small`. Not recommended for this.

# HJaaS site

One painting on a paper page, its edges fading into the paper, and a small menu to move between scenes. Each scene is a room with
Rachel at work in it and ten hidden mushrooms; finding all ten in any scene unlocks the contact form.

| Scene | Address | State |
|---|---|---|
| **Build**: Rachel hammering in a flat under renovation | `/` or `/#build` | Complete |
| **Grow**: Rachel in her mushroom lab, misting a tray and taking notes | `/#grow` | Complete, with task 017's frames. Her frames load when the scene is first opened |

Built from `HANDOVER.md`, reworked from `reviews/scene-1-review-03-elegant.md`, and given a second scene
from `reviews/scene-2-build.md` on the branch `site/scene-2`. Earlier versions: `site/scene-1-elegant`
(one scene, same look) and `site/scene-1` (full-screen).

## See it

```
cd site
npm install
npm run dev
```

Then open **http://localhost:5173/** (the same address works from a phone on the same Wi-Fi if you
replace `localhost` with the Mac's IP address, which the command prints as "Network").

`npm run build` makes the static site in `site/dist/`; `npm run preview` serves that build on
http://localhost:4173/. `npm test` runs the unit tests.

## Where things are

| Path | What |
|---|---|
| `src/main.ts`, `index.html` | The host page. It only mounts the site. |
| `src/engine/` | Everything that shows a scene and the page around it. It knows nothing about any one scene. |
| `src/scenes/` | One file per scene, which only describes it, and `index.ts`, the list of scenes in menu order. |
| `public/assets/` | WebP copies of the approved art, made by `npm run assets`: `scene1/`, `scene2/`, and `shared/` (mushrooms, logo). Never edit these by hand. |
| `scripts/build-assets.mjs` | Reads `frames/`, `scene/`, `reference/` and `assets/` (never writes there) and makes the WebP copies, the favicon and the link-preview image (`og-image.png`). |
| `public/robots.txt` | Blocks all crawling until launch. Open it up then, and give `og:image` in `index.html` the full address (`TODO(launch)`). |
| `qa/` | Evidence: recordings, screenshots, traces, reviews, and `REPORT.md`. `qa/tools/` holds the scripts that made them. |

Inside `src/engine/`:

| File | Job |
|---|---|
| `site.ts` | Builds the page (identity, scene menu, framed picture, caption, controls), keeps progress, and moves between scenes. |
| `types.ts` | What a scene is, as data: `SceneConfig`. |
| `scene.ts` | One scene built from its config: plate, character, mushrooms. |
| `transition.ts`, `paint.ts` | How a picture arrives: the first-visit painting (the edge's pencil first, then the brush), the short brush between scenes, the short fades. |
| `edge.ts` | The painting's edge: the colour fades into the paper along a wandering line, crisp in places and wide in others, and the room's lines carry on as pencil before trailing off. Rounded corners, and never a straight cut. Worked out per scene from a seed and drawn, at the plate's full size, in four strips along the plate's sides (`edge-band.json` says how deep). Also places each mushroom's tap box clear of it. |
| `character.ts`, `player.ts`, `steps.ts` | A character's canvas (whole frames, or a patch over a still), her placement on the plate, and the player that shows her poses. |
| `clips.ts` | Reads Wren's delivered format (`frames.json` + `routine.json`): stills, clips of patches, the routine, blinks, the reaction and its entry rule. |
| `reel.ts` | Keeps a clip character's memory down: her patches stay as downloaded and are decoded only a few frames ahead of being shown, then given back. |
| `routine.ts` | A simpler loop manifest for whole-frame characters: loops, cycles, transitions, blinks. |
| `reaction.ts` | Loads and plays `reaction.json` exactly as delivered. |
| `mushrooms.ts` | Tap boxes, the short trip to the caption, the hint wiggle. |
| `caption.ts` | The caption under the picture ("3 of 10 found") and the Contact button. |
| `logo.ts`, `glint.ts` | The logo and its glint, clipped to the image's own alpha. Nothing else glints. |
| `pan.ts` | The portrait-phone crop, sideways panning, and where the visitor left each room. |
| `form.ts`, `submit.ts` | The contact form, and the one function that sends it. |
| `state.ts` | Progress in `localStorage`: per scene, the mushrooms found and the pan position; shared, the unlock. |
| `flags.ts` | URL switches for QA (below). |

## Adding or changing a scene

A scene is one file in `src/scenes/` exporting a `SceneConfig` (see `types.ts`, and `build.ts` as the
worked example), listed in `src/scenes/index.ts`. The menu shows whatever is listed there. The config holds:

- the plate image and the scene's assets folder;
- the character: her frames, how they sit on the plate, her idle routine and her reaction folder;
- the ten hiding spots (`SPOTS`), with a tint for that room's light. `npm test` checks that none of them, and
  none of their tap boxes, sits in the painting's soft edge, that each is at least 14 px tall and at least
  60% in view. A spot can be tucked behind something (`tuck`), seen through glass (`opacity`), or replaced
  by another without losing anyone's saved find (`replaced`);
- optionally `edge`, a number that picks another of the room's possible edges. The colour must be whole
  under every pixel the character ever covers and under every mushroom: `node qa/tools/pencil.mjs pick`
  tries 1500 edges and lists the ones that keep the character whole, with the mushrooms each would move
  and by how much; `node qa/tools/pencil.mjs rachel` and `spots` check the result on the page;
- `lines`, the pencil lines the edge trails off in. Put the scene's line map (greyscale, the plate's size,
  made by `tools/pencil_lines.py`) in `scene/pencil/`, add it to the list in `scripts/build-assets.mjs` and
  run `npm run assets`: it cuts the map to the edge's strips. Without it the colour fades the same way,
  with no pencil;
- the paint-in strokes;
- what a phone shows first.

Also add the scene's assets folder to the small list in `index.html`, so its picture starts downloading early
when someone opens its address directly.

**A character** comes in one of two forms:

- **Whole frames** (scene 1): every pose is one image. The idle routine is code (scene 1's hammer rhythm,
  ported from `tools/preview_timing.py`) or a loop manifest (format at the top of `src/engine/routine.ts`),
  and the reaction is a `reaction.json`.
- **Stills and clips** (scene 2), as Wren's pipeline delivers them in `frames/NNN-…/site/`: `frames.json`
  (the stills, the clips as patches over a still, and where her canvas sits on the plate) and `routine.json`
  (routine, blinks, reaction). The format is described at the top of `src/engine/clips.ts`. Both files are
  copied as delivered by `npm run assets`; the config only names them.

A scene's character is fetched when the scene is first opened: her stills first, then her clips.

**Memory.** Only the scene on show keeps decoded images. When the visitor leaves a scene it gives back its
room's picture, its edge and all of its character's frames but the one on her canvas (`Scene.rest()`); the
downloaded files are kept, so coming back decodes them again while the brush is at work (`Scene.ready()`,
`enter()`), and the edge is worked out again under the picture being left (`Scene.dress()`, a few
milliseconds at a time).
A clip character's clip frames are never all decoded even then (all of the lab's would be over 200 MB): each
step of the routine names the frames that may follow it, `reel.ts` decodes those and gives the others back,
and the reaction's frames stay decoded while the scene is on show. `npm run assets` also makes a lighter set
of each character's frames at three quarters of the size (`scene1/rachel-1.5x/`, `scene2/rachel-1.5x/`),
which the scene's config (`small`) uses when the picture is shown under 900 px wide. `?debug` adds
`__hj.memory`: the page's own account of its decoded images and canvases, from their sizes.

## Swapping art

1. Replace the file in `frames/…/approved/`, `scene/` or `assets/logo/` (Wren's side).
2. Run `npm run assets` in `site/`.

Nothing in the code changes. A standing character's size and position are computed from her rest frame's own
pixels; the reaction plays whatever `reaction.json` lists; the logo's glint is clipped to whatever PNG is there.
To use different source folders, edit the paths in `scripts/build-assets.mjs`.

A reaction frame that is byte-identical to an upscaled frame (today `rx_frame_01`, `rx_K1`, `rx_K2`) is not
copied twice: the script lists it in `rachel/reaction/shared.json`, and the page downloads and decodes that
one copy once. `reaction.json` is still copied exactly as delivered.

## Wiring the contact form

`src/engine/submit.ts` is the only place that sends anything, marked `TODO(form-endpoint)`. Put the
form service's URL in `site/.env` as `VITE_FORM_ENDPOINT=https://…` and adjust the request body there
if the service wants a different shape. Until then:

- `npm run dev`: the form shows its success state in **test mode** and says nothing was sent.
- A production build: the form shows an error and never claims a message was sent.

## URL switches (for review, not for visitors)

They only work on `npm run dev`. A production build (`npm run build`, `npm run preview`, the live site)
ignores them all, so nobody can skip the hunt with `?found=10`.

| Add to the address | Effect |
|---|---|
| `?reset` | Forget saved progress first. |
| `?intro=full`, `?intro=quick`, `?intro=off` | Choose the opening: `full` is the first-visit painting, `quick` the short reveal of a return visit, `off` none. |
| `?found=9` | Start the opening scene with that many mushrooms found (not saved). `?found=10` shows the unlocked button. |
| `?hint=5` | Seconds before the hint wiggle, instead of 60. |
| `?seed=7` | Repeatable hammer rhythm and brush strokes. |
| `?edge=organic`, `?edge=a-round`, `?edge=a`, `?edge=b`, `?edge=c` | The earlier edges, for comparison: `organic` is the wash without the pencil (and with its straight cuts), the others the even feathers before it. The site ships `pencil`. |
| `?slow=6` | Play the interface motion six times slower. |
| `?debug` | Outline the mushroom hit areas and expose `window.__hj` (pose log, late-frame log). |

Combine them with `&`, for example `http://localhost:5173/?reset&intro=full`.

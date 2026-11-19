# HJaaS site

One framed picture on a paper page, and a small menu to move between scenes. Each scene is a room with
Rachel at work in it and ten hidden mushrooms; finding all ten in any scene unlocks the contact form.

| Scene | Address | State |
|---|---|---|
| **Build**: Rachel hammering in a flat under renovation | `/` or `/#build` | Complete |
| **Grow**: Rachel in her mushroom lab | `/#grow` | Structure only. The picture is the chosen mock-up, still, until `tasks/017` delivers her frames |

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
| `transition.ts`, `paint.ts` | How a picture arrives: the first-visit painting, the short brush between scenes, the 200 ms fades. |
| `character.ts`, `player.ts`, `steps.ts` | A character's placement on the plate and the player that shows her poses. |
| `routine.ts` | Turns a routine manifest (`routine.json`) into an idle routine: loops, cycles, transitions, blinks. |
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
- the ten hiding spots (`SPOTS`), with a tint for that room's light;
- the paint-in strokes;
- what a phone shows first.

Also add the scene's assets folder to the small list in `index.html`, so its picture starts downloading early
when someone opens its address directly.

**The idle routine** is either code (scene 1's hammer rhythm, ported from `tools/preview_timing.py`) or a
manifest, `routine.json`, in the character's folder. The manifest format is described at the top of
`src/engine/routine.ts`. `public/assets/scene2/rachel/routine.json` is scene 2's, a stub with the target timings.

**When Rachel's lab frames arrive (`tasks/017`):** the three steps are in the comment above `LAB_CAST` in
`src/scenes/grow.ts`.

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
| `?intro=full`, `?intro=quick`, `?intro=off` | Choose the opening: `full` is the first-visit painting, `quick` the 200 ms reveal of a return visit, `off` none. |
| `?found=9` | Start the opening scene with that many mushrooms found (not saved). `?found=10` shows the unlocked button. |
| `?hint=5` | Seconds before the hint wiggle, instead of 60. |
| `?seed=7` | Repeatable hammer rhythm and brush strokes. |
| `?slow=6` | Play the interface motion six times slower. |
| `?debug` | Outline the mushroom hit areas and expose `window.__hj` (pose log, late-frame log). |

Combine them with `&`, for example `http://localhost:5173/?reset&intro=full`.

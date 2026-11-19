# HJaaS site — scene 1

The contracting scene: Rachel hammering in the room, ten hidden mushrooms, a counter, and the contact
form as the prize. Built from `HANDOVER.md`.

## See it

```
cd site
npm install
npm run dev
```

Then open **http://localhost:5173/** (the same address works from a phone on the same Wi-Fi if you
replace `localhost` with the Mac's IP address, which the command prints as "Network").

`npm run build` makes the static site in `site/dist/`; `npm run preview` serves that build on
http://localhost:4173/.

## Where things are

| Path | What |
|---|---|
| `src/main.ts`, `index.html` | The host page. It only mounts the scene. |
| `src/scene1/` | Everything the scene needs: markup, styles, state, motion. Mount it anywhere with `mountScene1(element)`. |
| `public/assets/scene1/` | WebP copies of the approved art, made by `npm run assets`. Never edit these by hand. |
| `scripts/build-assets.mjs` | Reads `frames/`, `scene/` and `assets/` (never writes there) and makes the WebP copies and the favicon. |
| `qa/` | Evidence: recordings, screenshots, traces, reviews, and `REPORT.md`. `qa/tools/` holds the scripts that made them. |

Inside `src/scene1/`:

| File | Job |
|---|---|
| `index.ts` | Puts the scene together and runs the hunt. |
| `rachel.ts`, `player.ts`, `schedule.ts` | Rachel's placement, the pose player, and the hammer rhythm (ported from `tools/preview_timing.py`). |
| `reaction.ts` | Loads and plays `reaction.json` exactly as delivered. |
| `mushrooms.ts` | The ten hiding spots (`SPOTS`), hit areas, the flight into the counter, the hint wiggle. |
| `counter.ts`, `glint.ts` | The enamel-pin counter and its glint; the same pin becomes the Contact button. |
| `logo.ts` | The logo and its glint, clipped to the image's own alpha. |
| `intro.ts`, `paint.ts` | The painted-in opening. |
| `pan.ts` | The portrait-phone crop and sideways panning. |
| `finale.ts`, `form.ts`, `submit.ts` | The 10/10 finale, the contact form, and the one function that sends it. |
| `state.ts` | Progress in `localStorage`. |
| `flags.ts` | URL switches for QA (below). |

## Swapping art

1. Replace the file in `frames/…/approved/`, `scene/` or `assets/logo/` (Wren's side).
2. Run `npm run assets` in `site/`.

Nothing in the code changes. Rachel's size and position are computed from `frame_01`'s own pixels; the
reaction plays whatever `reaction.json` lists; the logo's glint is clipped to whatever PNG is there.
To use different source folders, edit the paths at the top of `scripts/build-assets.mjs`.

## Wiring the contact form

`src/scene1/submit.ts` is the only place that sends anything, marked `TODO(form-endpoint)`. Put the
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
| `?intro=full`, `?intro=quick`, `?intro=off` | Choose the intro. Normally: full the first time, quick afterwards. |
| `?found=9` | Start with that many mushrooms found (not saved). `?found=10` shows the unlocked button. |
| `?hint=5` | Seconds before the hint wiggle, instead of 60. |
| `?seed=7` | Repeatable hammer rhythm and brush strokes. |
| `?slow=6` | Play the interface motion six times slower. |
| `?debug` | Outline the mushroom hit areas and expose `window.__hj` (pose log, late-frame log). |

Combine them with `&`, for example `http://localhost:5173/?reset&intro=full`.

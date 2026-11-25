# HJaaS site

One painting on a paper page, its edges fading into the paper, and a small menu to move between scenes. Each scene is a room with
Rachel at work in it and ten hidden mushrooms; finding all of them, in every scene, unlocks the contact form.

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

Then open **http://127.0.0.1:5173/**. `npm run build` makes the static site in `site/dist/`.
`npm run preview` serves that build on http://127.0.0.1:4173/. `npm test` runs the unit tests.

For a phone session, use `npm run dev:lan` or `npm run preview:lan` and open the URL printed as
"Network" on a phone connected to the same Wi-Fi.

## Where things are

| Path | What |
|---|---|
| `src/main.ts`, `index.html` | The host page. It only mounts the site. |
| `src/engine/` | Everything that shows a scene and the page around it. It knows nothing about any one scene. |
| `src/scenes/` | One file per scene, which only describes it, and `index.ts`, the list of scenes in menu order. |
| `public/assets/` | WebP copies of the approved art, made by `npm run assets`: `scene1/` to `scene5/`, and `shared/` (mushrooms, logo). Never edit these by hand. |
| `scripts/build-assets.mjs` | Reads `frames/`, `scene/`, `reference/` and `assets/` (never writes there) and makes the WebP copies, the favicon and the link-preview image (`og-image.png`). |
| `public/robots.txt` | Blocks all crawling until launch. Open it up then, and give `og:image` in `index.html` the full address (`TODO(launch)`). |
| `qa/` | Evidence: recordings, screenshots, traces, reviews, and `REPORT.md`. `qa/tools/` holds the scripts that made them. |

Inside `src/engine/`:

| File | Job |
|---|---|
| `site.ts` | Builds the page (identity, scene menu, framed picture, caption, controls), keeps progress, and moves between scenes. |
| `types.ts` | What a scene is, as data: `SceneConfig`. |
| `scene.ts` | One scene built from its config: plate, character, mushrooms. |
| `transition.ts`, `paint.ts` | How a picture arrives: the first-visit painting (the brush, and the edge's pencil sketched in beside each stroke as it gets there), the short brush between scenes, the short fades. |
| `edge.ts` | The painting's edge: the colour fades into the paper along a wandering line, crisp in places and wide in others, and the room's lines carry on as pencil before trailing off. Rounded corners, and never a straight cut. Worked out per scene from a seed and drawn, at the plate's full size, in four strips along the plate's sides (`edge-band.json` says how deep). Also places each mushroom's tap box clear of it. |
| `character.ts`, `player.ts`, `steps.ts` | A character's canvas (whole frames, a patch over a still, or two poses part-way through a cross-dissolve), her placement on the plate, and the player that shows her poses. |
| `clips.ts` | Reads Wren's delivered format (`frames.json` + `routine.json`): stills, clips of patches, the routine, blinks, dissolves (`fade_ms`), the reaction and its entry rule. |
| `cast.ts` | Takes a package with a whole cast apart (scenes 3 and 4): each actor becomes a pair of manifests that `clips.ts` plays as if it were alone on the plate. Also reads the package's live screen, if it has one, and a layer's `scale` (scene 4's presenter: stills at twice his box, the first whole and the rest kept as patches over it). |
| `progress.ts` | The hunt's progress in the picture (scene 5: the backdrop, one more swath per find): every swath reached drawn once on one canvas, a new one fading in over it and drawn in when the fade ends. |
| `walk.ts` | A sprite-track layer (scene 5: the stagehand): frame by frame from a track, a list of sprites placed, turned and perhaps mirrored; the far boot darker; kept inside the gap mask (boots) or the body mask (the whole man); when it walks, from its routine entry. Its pictures are decoded only while the scene shows. |
| `screen.ts` | A live screen in the picture (scene 4: the back of Rachel's camera): a small canvas on the actor who holds it, showing the room and the actors drawn before her, redrawn whenever one of them is, moved with her pose, with the blinking REC dot. |
| `reel.ts` | Keeps a clip character's memory down: her patches stay as downloaded and are decoded only a few frames ahead of being shown, then given back. |
| `routine.ts` | A simpler loop manifest for whole-frame characters: loops, cycles, transitions, blinks. |
| `reaction.ts` | Loads and plays `reaction.json` exactly as delivered. |
| `mushrooms.ts` | Tap boxes, the short trip to the cream counter, the hint wiggle (only a mushroom on screen; none, no wiggle). |
| `caption.ts` | The two counters under the picture (cream: this scene; red: all scenes) and the Contact button they turn into: the fills, the rolls, the glints, the "Next" link. The timings are at the top of the file. |
| `logo.ts`, `glint.ts` | The logo and its glint, clipped to the image's own alpha. Nothing else glints. |
| `pan.ts` | The portrait-phone crop, sideways panning, where the visitor left each room, and a new visitor's one small drift. |
| `form.ts`, `submit.ts` | The contact form, and the one function that sends it. |
| `state.ts` | Progress in `localStorage`: per scene, the mushrooms found and the pan position. The unlock is worked out from the finds (every spot of every scene), never trusted from storage. `huntView` is the one place the counters, the tab dots, the "Next" link and the unlock are worked out. |
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
- optionally `keep`, rectangles of the plate the painting must be whole in. Only for a scene whose cast comes
  nearer the plate's rim than any edge leaves whole (the café: Rachel's boots and the cat are 35 px from the
  bottom, and the fringe of her shadow 18 px). Around each rectangle the painting reaches out toward the rim, as far as it needs to; the rim
  itself stays paper, and everywhere else the edge is the ordinary one. The rule is at `KeepBox` in
  `src/engine/edge.ts`;
  A box with a fifth value, `'hug'`, is a part of the room rather than the cast that reaches into the edge
  (the film scene's Merlion): a few stacked boxes follow its outline, and the painting bulges out around
  them, whole up to a few px away, fading a few dozen px beyond, its line wandering as the edge's does.
- `lines`, the pencil lines the edge trails off in. Put the scene's line map (greyscale, the plate's size,
  made by `tools/pencil_lines.py`) in `scene/pencil/`, add it to the list in `scripts/build-assets.mjs` and
  run `npm run assets`: it cuts the map to the edge's strips. Without it the colour fades the same way,
  with no pencil;
- the paint-in strokes;
- `focusX`, the plate x a phone opens centred on (Rachel).

Also add the scene's assets folder to the small list in `index.html`, so its picture starts downloading early
when someone opens its address directly.

**A character** comes in one of three forms:

- **Whole frames** (scene 1): every pose is one image. (An in-between that is another drawing but for an arm is cut to
  the part that differs and drawn over that drawing, to save memory: `PATCHES` in `scripts/build-assets.mjs` lists them.) The idle routine is code (scene 1's hammer rhythm,
  ported from `tools/preview_timing.py`) or a loop manifest (format at the top of `src/engine/routine.ts`),
  and the reaction is a `reaction.json`.
- **Stills and clips** (scene 2), as Wren's pipeline delivers them in `frames/NNN-…/site/`: `frames.json`
  (the stills, the clips as patches over a still, and where her canvas sits on the plate) and `routine.json`
  (routine, blinks, reaction). The format is described at the top of `src/engine/clips.ts`. Both files are
  copied as delivered by `npm run assets`; the config only names them.

- **A whole cast** (scene 3, the café, and scene 4, the film shoot), delivered as one package in `frames/NNN-…/site/`: `frames.json`
  lists the actors as layers, bottom to top, each with its box on the scene's canvas and its stills (and any
  clips, each belonging to one layer); `routine.json` has one routine per actor under `actors`. The format is
  described at the top of `src/engine/cast.ts`. Every actor has a canvas and a player of its own and they run
  out of step. The actor with a `reaction` answers a find and is the one a first-visit painting brings in at
  the end; actors drawn before her are painted with the room. An actor whose every still is a solid
  rectangle, with nothing cut out, is a piece of the room that moves (the café's ceiling fan): the edge
  fades it as it fades the plate. So is a layer marked `"scenery": true` (the Merlion's water). A layer's
  stills are the ones it lists and any other still its routine names (the presenter's blink stills). Nothing in the engine names an actor.
  Two kinds of layer are not actors: `"hunt_progress": k` (a still shown once k mushrooms of the scene are
  found; fades in over the routine entry's `fade_ms`, 700 ms if none) and `"sprite_track"` (no stills: a
  track, `sprites`, a `mask` for the boots and a `body_mask` for the whole man; its routine entry has `first_ms`, `return_after_ms`, `every_ms` and a
  `sequence` of tracks). `npm run assets` keeps the swaths and the masks lossless (the masks as alpha).
  A package may have a live screen: `"camera_screen": { "source": {x, y, w, h}, "rect_by_still": { "<still>":
  {x, y, w, h} } }` in `frames.json`. `source` is the part of the scene it shows; each rect is where the
  screen is while the actor who holds it is on that still. The picture is drawn 2 px inside the rect, with
  the REC dot (6 px, 500 ms on, 500 ms off; lit and still when motion is paused or reduced).

**The routine vocabulary** (`routine.json`, for a clip character or each actor of a cast):

| Step | What it does |
|---|---|
| `{ "still": "A", "ms": 900 }` or `"ms": [600, 900]` | Hold a still: a fixed time, or one rolled in the range each time. |
| `"fade_ms": 150` on a still of a loop | Dissolve into it from the loop's still before it, over that long, at the start of the hold: a true cross-dissolve of the two drawings. Only between two stills of the same loop: coming into the loop, on a still by itself and in the reaction it is ignored, and the pose cuts. Without it, an instant cut. |
| `"blink_ok": true` on a still | She may blink in the middle of this hold (the `blink` rule says how, and how often). |
| `{ "still": null, "ms": … }` | Draw nothing: an actor who is part of the plate and only drawn for a moment. |
| `{ "loop": "name", "repeat": [6, 12], "steps": [ … ] }` | A few stills, round and round, a rolled number of times. |
| `{ "clip": "name", "ms": 70 }`, with `"reverse": true` | Play a clip of patches, forwards or backwards. |
| `{ "loop": "name", "repeat": 2, "clip": "name", "ms": 70 }` | Play a clip round and round. |

`"blink"` is one rule or a list: `{ "on": "A" or ["A", "B"], "frames": [{ "still": "A_blink", "ms": 90 }], "every_ms": [3000, 6000] }`,
or with a blink still for each still it names: `{ "on": ["A", "B"], "still_for": { "A": "A_blink", "B": "B_blink" }, "ms": 110, … }`.
`"reaction": { "steps": [ … ] }` is a fixed list of stills (with `ms` or a range) and clips, all cuts; a held
still may blink (`"blink_ok": true`, or `"blink": "A_blink"`). It starts from `enter_from`, or if that is left
out from the still the routine opens on (or the base still of the reaction's first clip). A hold on another
still of that still's own loop (the stroke of her sketching) is cut to 300 ms when a find is waiting. Away from that
still on poses the routine goes through one after another, with no loop on the way back (the café's sip:
reach, lift, sip, lift, reach, sketch), a find does not interrupt: she finishes, with any hold on the way cut
to 300 ms, and reacts once she is back. She blinks only on a still the `blink` rule names, in a hold marked
`blink_ok`. A routine that marks no hold at all with `blink_ok` (the film scene's presenter, whose holds are
a tenth of a second) may blink on any hold of a still the rule names: in the middle of a long one, or in place
of the first 110 ms of a short one. Only the stills the manifests show are downloaded.

A reaction may also say how it is come into from the middle of a routine (scene 5, whose moves are drawn
through in-betweens), in a scene that answers `at-once`:

| In `reaction` | What it does |
|---|---|
| `"lead_in": { "A": [{ "still": "B", "ms": 33 }, … ] }` | The steps from still A back to rest, played before the reaction's own. Not listed: the reaction starts straight away. A second find never replays it. |
| `"min_show_ms": 120`, `"min_show_by_still": { "A": 500 }` | The still on screen when the find comes is first shown at least this long, or for its own time if that is shorter. |

With either of them she picks the routine up after the reaction at its next rest step (never in the middle of
a move), and the drawings a move passes through (60 ms or less) are shown evenly and never skipped: a late
frame holds the move up instead. Paused or reduced, the one held pose comes at once, with none of this.

A scene's config may say `answer: 'at-once'`: the reaction cuts straight in from whatever pose she is in,
instead of waiting for her rest pose (scene 5; with the two above it goes by way of them). And `again: 'hold'`: a mushroom found while she is still answering the last one starts
the reaction's held look again from now (she never turns twice). Without it a reaction under way is left as
it is.

**A new delivery of the café or of the film scene** is a file swap: replace `frames/018-cafe-scene/site/` or
`frames/020-film-scene/site/` (and the line map in `scene/pencil/` if the plate changed), run
`npm run assets` and `npm test`. `npm run assets` shrinks the
plate to the page's size, uses the cast at the size delivered, grows an actor's box to hold any clip patch
that reaches outside it, and writes `src/scenes/design-cast.json` (`film-cast.json`): each actor's box, the rectangle of
every pixel it ever covers, and which actors are pieces of the room. Inside a moving piece's box it also
rubs out of the line map any pencil line the delivered plate does not have (a fan blade cannot be drawn in
pencil: it would stand still). The scene's config reads that file for `keep`, and `npm test` holds the hunt to
it (no mushroom in any actor's box), so the tests say so if new drawings cover a hiding place. If they do,
or if the edge no longer leaves every mushroom clear, `node qa/tools/pencil.mjs pick 400 design` (or
`film`) lists the edges that do.

A scene's character is fetched when the scene is first opened (or its tab is hovered): her stills first,
then her clips. The files are only downloaded then. They are decoded when the scene goes on the plate, after
the scene being left has given its own decoded frames back, so two scenes' frames are never in memory
together.

**Memory.** Only the scene on show keeps decoded images. When the visitor leaves a scene it gives back its
room's picture, its edge and all of its character's frames but the one on her canvas (`Scene.rest()`; a
cast keeps not even those, and every actor starts its routine afresh when the scene comes back, because
three scenes' kept frames would not fit a phone's budget); the downloaded files are kept, so coming back decodes them again while the brush is at work (`Scene.ready()`,
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

When publishing `site/dist/` to Netlify or Cloudflare Pages, the build includes `_headers`. Set
`VITE_FORM_ENDPOINT` in the build environment or in `site/.env` before `npm run build`. The build adds
the URL's origin to `connect-src` for an external HTTP(S) endpoint. A relative path such as `/api/contact`
uses the existing same-origin allowance. Rebuild after changing the endpoint.

## URL switches (for review, not for visitors)

They only work on `npm run dev`. A production build (`npm run build`, `npm run preview`, the live site)
ignores them all, so nobody can skip the hunt with `?found=10`.

| Add to the address | Effect |
|---|---|
| `?reset` | Forget saved progress first. |
| `?intro=full`, `?intro=quick`, `?intro=off` | Choose the opening: `full` is the first-visit painting, `quick` the short reveal of a return visit, `off` none. |
| `?found=9` | Start the opening scene with that many mushrooms found (not saved). It no longer unlocks anything by itself. |
| `?all=49` | That many finds across the scenes in menu order (not saved; wins over `?found`). `?all=49#set` leaves only Set Design's last spot. |
| `?hint=5` | Seconds before the hint wiggle, instead of 60. |
| `?seed=7` | Repeatable hammer rhythm and brush strokes. |
| `?edge=organic`, `?edge=a-round`, `?edge=a`, `?edge=b`, `?edge=c` | The earlier edges, for comparison: `organic` is the wash without the pencil (and with its straight cuts), the others the even feathers before it. The site ships `pencil`. |
| `?slow=6` | Play the interface motion six times slower. |
| `?debug` | Outline the mushroom hit areas and expose `window.__hj` (pose log, late-frame log). |

Combine them with `&`, for example `http://localhost:5173/?reset&intro=full`.

// Scene 4, "Film": Merlion Park at night. A presenter talks to camera in front of a silver car; Rachel, seen
// from behind in the foreground, films him, and the back of her camera shows him live. Everything here is
// data for the engine in src/engine/; nothing in this file draws or moves anything.
import type { KeepBox } from '../engine/edge';
import type { SceneConfig, Spot, StrokePlan } from '../engine/types';
// Where each actor is on the plate, worked out from the package by npm run assets.
import cast from './film-cast.json';

// Night, lit by sodium lamps: the mushrooms take the paving's warm cast.
const LIT = 'brightness(0.98) saturate(1.05) sepia(0.26)';
// Sitting on a lamp, in its own glow.
const GLOW = 'brightness(1.06) saturate(1.12) sepia(0.22)';
// In the car's shadow, but not so dark that yellow stops reading.
const SHADE = 'brightness(0.8) saturate(0.9) sepia(0.2)';
// On the dark wheel: a little dimmer, the red left as red as the brake calipers.
const RIM = 'brightness(0.88) saturate(1.05)';
// Across the bay: paler, like the museum's lit petals.
const FAR = 'brightness(1.04) saturate(0.72) sepia(0.12)';
// On the Merlion: pushed towards its peach stone.
const STONE = 'brightness(1.07) saturate(1.05) sepia(0.34)';
// On the kiosk roof, against the dark trees: dim and a little blue.
const DUSK = 'brightness(0.74) saturate(0.7) hue-rotate(-14deg)';
// Among the lit flowers.
const BLOOM = 'brightness(1.02) saturate(1.1) sepia(0.1)';

// The same curve as the lab's hunt (reviews/scene-2-hunt-difficulty.md): three easy finds, four that take a
// second look, three that take a proper one. Left to right, which is also the Tab order.
//
//   easy    paving, forecourt, steps: red on the open paving and on the lit steps.
//   medium  shore, lamp, sill, kiosk: small, far off, or yellow where something else is yellow.
//   hard    wheel, merlion, flowers: the colour of what they stand beside. Red beside the red brake
//           calipers; cream among the Merlion's cream scales; a chanterelle among the orange flowers.
//
// None is on, behind or inside the box of the water, the presenter or Rachel (film-cast.json: the test
// holds them to it), so none can be in the camera's screen either. Every one is at least 18 px tall and in
// full view.
const SPOTS: Spot[] = [
  // Medium. Across the bay, in front of the dark trees beside the ArtScience Museum.
  { id: 'shore', art: 4, x: 176, y: 364, h: 18, tint: FAR },
  { id: 'paving', art: 1, x: 255, y: 774, h: 32, tint: LIT, grounded: true },
  // Medium. Yellow, on the cap of the second bollard lamp: it reads as part of the lamp.
  { id: 'lamp', art: 7, x: 347, y: 459, h: 20, tint: GLOW },
  // Hard. Red, on the rear wheel beside its red brake calipers (left of the presenter's box).
  { id: 'wheel', art: 1, x: 584, y: 700, h: 19, tint: RIM },
  // Medium. Yellow, on the ground under the car's sill, between the presenter and Rachel.
  { id: 'sill', art: 7, x: 960, y: 758, h: 22, tint: SHADE, grounded: true },
  // Hard. Cream, against the Merlion's lowest scales, standing on the blue wave.
  { id: 'merlion', art: 4, x: 966, y: 357, h: 20, tint: STONE },
  // Hard. A chanterelle at the right-hand end of the hedge, among the orange flowers.
  { id: 'flowers', art: 8, x: 1450, y: 393, h: 22, tint: BLOOM },
  // Medium. A pale cluster on the kiosk's roof, against the trees.
  { id: 'kiosk', art: 6, x: 1470, y: 247, h: 20, tint: DUSK },
  { id: 'forecourt', art: 3, x: 1478, y: 744, h: 34, tint: LIT, grounded: true },
  // Easy. On the lowest lit step, in front of the glow of the one above.
  { id: 'steps', art: 1, x: 1492, y: 530, h: 28, tint: LIT, grounded: true },
];

// The night sky and the towers -> the bay and its lights -> the Merlion, the hedge and the kiosk -> the car
// -> the paving, left to right. The same unhurried pace as the other scenes: 4.32 s.
const STROKES: StrokePlan[] = [
  // The sky, the tree and the towers' tops
  { via: [[1690, 50], [-10, 55], [-10, 170], [640, 175]], width: 200, at: 0, takes: 1.16 },
  { via: [[700, 120], [1300, 110], [1680, 190]], width: 200, at: 0.3, takes: 0.7 },
  // The towers, the museum and the bay
  { via: [[40, 270], [700, 265], [710, 380], [50, 390], [40, 500], [470, 505]], width: 230, at: 0.62, takes: 1.28 },
  // The Merlion and its water
  { via: [[780, 250], [1060, 240], [1050, 420], [800, 400]], width: 220, at: 1.3, takes: 0.7 },
  // The kiosk, the hedge and the steps
  { via: [[1150, 270], [1650, 260], [1640, 400], [1160, 410], [1170, 540], [1650, 545]], width: 240, at: 1.5, takes: 1.24 },
  // The railing and the car
  { via: [[40, 600], [470, 590], [1400, 580]], width: 220, at: 2.1, takes: 1.04 },
  { via: [[470, 690], [1400, 700]], width: 210, at: 2.36, takes: 0.8 },
  // The paving
  { via: [[40, 700], [420, 715], [430, 820], [50, 810]], width: 215, at: 2.6, takes: 0.84 },
  { via: [[1420, 650], [1650, 670], [1640, 810], [1420, 800]], width: 235, at: 2.94, takes: 0.76 },
  { via: [[1660, 860], [330, 850]], width: 225, at: 3.1, takes: 0.9 },
  { via: [[60, 950], [1560, 953]], width: 150, at: 3.42, takes: 0.6 },
  { via: [[40, 880], [300, 925]], width: 200, at: 3.6, takes: 0.5 },
  { via: [[1540, 905], [1690, 930]], width: 210, at: 3.78, takes: 0.54 },
];

// Rachel is cropped by the bottom of the painting: from her waist up (above this plate y) the painting is
// whole under her; below it the edge fades her legs into the paper with the rest of the bottom edge
// (reviews/scene-4-build.md, section 6).
const WAIST = 760;
// The Merlion's head comes to plate y 23 (its outline; the lit stone from y 25), inside the reach of the
// painting's top edge, which faded its crown into pencil (Wren's review of build 01). The painting now
// hugs the statue (edge.ts, KeepBox 'hug'): these boxes follow its outline, row band by row band, as traced
// on the plate, and the colour is whole around them and fades a few dozen px beyond, its line wandering as
// the edge's does. The top two rows of the crown are in the rim's own 28 px fade, which keeps the plate's
// rim bare paper all round, as everywhere: there it is as whole as the rim allows (0.92 to 0.95).
const MERLION: KeepBox[] = [
  [984, 23, 1020, 27, 'hug'],
  [966, 27, 1038, 31, 'hug'],
  [948, 31, 1060, 55, 'hug'],
  [936, 55, 1068, 71, 'hug'],
  [904, 71, 1082, 111, 'hug'],
  [898, 111, 1097, 195, 'hug'],
  [900, 195, 1090, 230, 'hug'],
];
const { presenter, rachel } = cast.covers;
const KEEP: KeepBox[] = [presenter as unknown as KeepBox, [rachel[0], rachel[1], rachel[2], Math.min(rachel[3], WAIST)], ...MERLION];

export const film: SceneConfig = {
  id: 'film',
  label: 'Film',
  picture: 'Hui Jie filming a presenter in front of a car at Merlion Park at night. Ten mushrooms are hidden in the scene.',
  assets: 'scene4/',
  plate: 'room.webp',
  // The whole cast as delivered by task 020 (frames/020-film-scene/site/): frames.json has every actor's
  // layer and stills, and where the camera's live screen is on each of Rachel's; routine.json has a routine
  // for each, the presenter's blink and Rachel's reaction. The Merlion's water is one of the "actors": it is
  // scenery, and the edge fades it with the plate (npm run assets lists it under `room`).
  character: { kind: 'cast', dir: 'cast/', frames: 'frames.json', routine: 'routine.json' },
  spots: SPOTS,
  // The presenter's shoes come within 80 px of the plate's bottom, so the painting is told where he is; and
  // Rachel above her waist; and the Merlion's head, at the top, is hugged.
  keep: KEEP,
  // Of the edges the scene could have, the first that fits the strips the edge is drawn in and leaves every
  // mushroom and tap box where it is (qa/tools/pencil.mjs pick 600 film).
  edge: 5,
  lines: 'pencil',
  // A second find while she is looking back holds the look longer; she never turns twice.
  again: 'hold',
  strokes: STROKES,
  // The one scene that does not open centred on Rachel: the framing the user approved on a phone, with the
  // presenter's face, her camera and Rachel all in view (reviews/hunt-counter-review-01.md, round 2). Centred on
  // her, he would be down to a hand.
  focusX: 977,
};

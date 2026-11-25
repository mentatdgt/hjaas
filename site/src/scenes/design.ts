// Scene 3, "Design": Rachel at a café table, sketching on her iPad between sips of coffee, with the café's
// own people around her. Everything here is data for the engine in src/engine/; nothing in this file draws
// or moves anything.
import type { KeepBox } from '../engine/edge';
import type { SceneConfig, Spot, StrokePlan } from '../engine/types';
// Where each actor is on the plate, worked out from the package by npm run assets.
import cast from './design-cast.json';

// The café's light is warm and low: the mushrooms take a little of it.
const LIT = 'brightness(1.03) saturate(1.04) sepia(0.16)';
// Out of the sun: under a chair, at the foot of the counter.
const SHADE = 'brightness(0.86) saturate(0.9) sepia(0.14)';
// On a shelf against the green wall, in its soft shade.
const SHELF = 'brightness(0.95) saturate(0.88) sepia(0.1)';

// The same curve as the lab's hunt (reviews/scene-2-hunt-difficulty.md): three easy finds, four that take a
// second look, three that take a proper one. Left to right, which is also the Tab order.
//
//   easy    floor, window-seat, corner: red on the pale floor, where nothing else is red.
//   medium  bench, chair, niche, cat: small, in shade, or yellow beside something yellow.
//   hard    sunlight, cups, counter: the colour of what they stand in or beside. A cream cluster on the
//           terrazzo among the patches of sun; a cream toadstool at the end of a row of cream cups; a
//           chanterelle against the counter's orange wood.
//
// None is on, behind or inside the box of any actor (design-cast.json: the test holds them to it), so a new
// set of drawings with the same silhouettes moves nothing here. Every one is at least 18 px tall and in full
// view.
const SPOTS: Spot[] = [
  { id: 'floor', art: 1, x: 150, y: 868, h: 30, tint: LIT, grounded: true },
  // Medium. On the window seat, between the child and the back of the next chair.
  { id: 'bench', art: 7, x: 330, y: 566, h: 18, tint: LIT },
  // Medium. In the shade under the chair in front.
  { id: 'chair', art: 4, x: 352, y: 800, h: 22, tint: SHADE, grounded: true },
  // Hard. Cream, on the terrazzo, at the edge of a patch of sun.
  { id: 'sunlight', art: 6, x: 520, y: 842, h: 20, tint: LIT, grounded: true },
  { id: 'window-seat', art: 3, x: 645, y: 694, h: 24, tint: LIT, grounded: true },
  // Hard. On the top shelf, at the end of the row of cups: a cream toadstool, the height of a cup.
  { id: 'cups', art: 4, x: 1006, y: 287, h: 18, tint: SHELF },
  // Hard. At the foot of the counter, orange against its orange wood.
  { id: 'counter', art: 8, x: 1185, y: 664, h: 24, tint: SHADE, grounded: true },
  // Medium. In the niche, beside the tall vase.
  { id: 'niche', art: 9, x: 1325, y: 340, h: 18, tint: SHELF },
  // Medium. Yellow, on the floor by the sleeping cat (not on it, and outside its box).
  { id: 'cat', art: 7, x: 1402, y: 884, h: 22, tint: LIT, grounded: true },
  { id: 'corner', art: 2, x: 1575, y: 815, h: 28, tint: LIT, grounded: true },
];

// Ceiling and fan -> the top of the window wall and of the counter wall -> across the middle of both, and the niche
// -> the floor, left to right -> the palm and the table on the right. The same unhurried pace as the other rooms: 4.32 s.
// Her head (813 to 1010 across, 391 to 578 down) is painted by one stroke, the long one across the middle, which is at
// its quickest there; no other stroke may reach it before (qa/tools/face.mjs).
const STROKES: StrokePlan[] = [
  // Ceiling, beams and the fan
  { via: [[1690, 50], [-10, 55], [-10, 160], [620, 165]], width: 200, at: 0, takes: 1.16 },
  { via: [[700, 110], [1280, 120], [1310, 250]], width: 190, at: 0.3, takes: 0.7 },
  // The top of the window wall
  { via: [[60, 260], [720, 255]], width: 220, at: 0.62, takes: 0.8 },
  // The top of the doorway and the shelves of cups
  { via: [[740, 242], [1290, 240]], width: 200, at: 1, takes: 0.8 },
  // Across the windows, the doorway, her head and the counter
  { via: [[-60, 488], [700, 486], [1310, 478]], width: 290, at: 1.4, takes: 1.1 },
  // The niche, the palm and the right-hand wall
  { via: [[1400, 190], [1650, 210], [1640, 370], [1400, 360], [1395, 520], [1660, 540]], width: 240, at: 2.1, takes: 1.04 },
  // The floor
  { via: [[40, 650], [640, 665], [650, 790], [60, 800]], width: 215, at: 2.36, takes: 0.8 },
  { via: [[720, 690], [1320, 680], [1330, 800], [730, 815]], width: 215, at: 2.6, takes: 0.84 },
  { via: [[1390, 650], [1650, 670], [1640, 810], [1410, 800]], width: 235, at: 2.94, takes: 0.76 },
  { via: [[1660, 905], [330, 900]], width: 225, at: 3.1, takes: 0.9 },
  { via: [[60, 950], [1560, 953]], width: 150, at: 3.42, takes: 0.6 },
  { via: [[40, 860], [300, 915]], width: 200, at: 3.6, takes: 0.5 },
  { via: [[1540, 905], [1690, 930]], width: 210, at: 3.78, takes: 0.54 },
];

export const design: SceneConfig = {
  id: 'design',
  label: 'Design',
  picture: 'Hui Jie sketching at a café table. Ten mushrooms are hidden in the café.',
  assets: 'scene3/',
  plate: 'room.webp',
  // The whole cast as delivered by task 018 (frames/018-cafe-scene/site/): frames.json has every actor's
  // layer, stills and clips; routine.json has a routine for each, and Rachel's blink and reaction. Who is in
  // the café, where, and what they do is all in those two files: a new delivery is a file swap
  // (npm run assets), with nothing to change here unless the mushrooms' hiding places are drawn over.
  character: { kind: 'cast', dir: 'cast/', frames: 'frames.json', routine: 'routine.json' },
  spots: SPOTS,
  // Rachel's boots and the cat come within 35 px of the plate's bottom, and the old man's chair within 62 px
  // of its side: nearer than any of the room's possible edges leaves whole. So the painting is told where
  // its cast is, and reaches out around them (edge.ts, KeepBox). Her shadow is part of her stills, and its
  // faint outer fringe comes to 18 px from the bottom: inside the rim's own fade, where the painting is as
  // whole as the rim allows.
  keep: Object.values(cast.covers) as unknown as KeepBox[],
  // Of the edges the room could have, the first that fits the strips the edge is drawn in and leaves every
  // mushroom and tap box where it is (qa/tools/pencil.mjs pick).
  edge: 95,
  lines: 'pencil',
  strokes: STROKES,
  // Rachel and the hand she draws with (780 to 1005).
  focusX: 900,
};

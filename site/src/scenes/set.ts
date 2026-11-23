// Scene 5, "Set Design": a theatre stage, lit warm from the floodlight on the left. Rachel, on a wooden
// A-frame ladder, paints a huge backdrop; its right part is still bare canvas with pencil lines, and each
// mushroom found here paints one more swath of it. A stagehand crosses behind it now and then (seen whole in the
// dark slot by the curtain, and from there on only his boots, in the gap under its hem), and a caged work lamp
// swings on its rope. Everything here is data for the engine in src/engine/; nothing in this file draws or
// moves anything.
import type { KeepBox } from '../engine/edge';
import type { SceneConfig, Spot, StrokePlan } from '../engine/types';
// Where each actor is on the plate, worked out from the package by npm run assets.
import cast from './set-cast.json';

// The stage's warm light: the mushrooms take a little of it.
const LIT = 'brightness(1.02) saturate(1.05) sepia(0.22)';
// In the floodlight's pool, front left: brighter and warmer.
const GLOW = 'brightness(1.06) saturate(1.1) sepia(0.26)';
// On the cart's lower shelf, under the top shelf.
const SHADE = 'brightness(0.86) saturate(0.92) sepia(0.2)';
// On the ladder's wood.
const WOOD = 'brightness(0.96) saturate(1.05) sepia(0.18)';
// High on the leaning flat, against the dark curtain behind it.
const DIM = 'brightness(0.82) saturate(0.85) sepia(0.12)';

// The same curve as the lab's hunt (reviews/scene-2-hunt-difficulty.md): three easy finds, four that take a
// second look, three that take a proper one. Left to right, which is also the Tab order.
//
//   easy    boards, drop-cloth, cart-front: red on the lit boards and the pale drop cloths.
//   medium  flats, ladder, cart-shelf, splatter: up high, under the cart's shelf, or yellow beside something yellow.
//   hard    coil, pots, paint-pail: the colour of what they stand among. Yellow in the cable coil by the
//           yellow tripod, on the floodlit boards; a pale cap at the foot of the pale paint pots; a pale cap
//           on the pale cloth beside the paint pail.
//
// None is on, behind or inside Rachel's layer, the backdrop's swaths (they would paint over it), the lamp's
// swing, the dark gap under the backdrop's hem where the stagehand's boots walk, or the slot by the curtain
// where he is seen whole (the test holds them to it). Every one is at least 19 px tall and in full view.
const SPOTS: Spot[] = [
  // Hard. Yellow, inside the coiled cable at the floodlight's foot, beside the yellow tripod.
  { id: 'coil', art: 7, x: 240, y: 748, h: 22, tint: GLOW, grounded: true },
  // Medium. A pale cluster on top of the shorter leaning flat, against the dark curtain behind it.
  { id: 'flats', art: 6, x: 272, y: 270, h: 20, tint: DIM },
  { id: 'boards', art: 3, x: 360, y: 806, h: 32, tint: GLOW, grounded: true },
  // Hard. A pale cap on the drop cloth at the foot of the tall paint pot.
  { id: 'pots', art: 4, x: 482, y: 718, h: 20, tint: LIT, grounded: true },
  { id: 'drop-cloth', art: 1, x: 640, y: 751, h: 30, tint: LIT, grounded: true },
  // Medium. A chanterelle on the ladder's back cross brace, below Rachel.
  { id: 'ladder', art: 8, x: 958, y: 669, h: 19, tint: WOOD },
  // Hard. A pale cap on the pale cloth beside the paint pail in front of the cart.
  { id: 'paint-pail', art: 4, x: 1086, y: 743, h: 20, tint: LIT, grounded: true },
  // Medium. Yellow, on the cart's lower shelf between its two paint pots.
  { id: 'cart-shelf', art: 7, x: 1289, y: 677, h: 20, tint: SHADE },
  { id: 'cart-front', art: 2, x: 1345, y: 801, h: 30, tint: LIT, grounded: true },
  // Medium. Yellow, among the blue splatters at the right-hand end of the drop cloth.
  { id: 'splatter', art: 7, x: 1468, y: 774, h: 21, tint: LIT, grounded: true },
];

// The fly ropes and the flats -> the backdrop's painted sky and hills -> its bare canvas and the lamp -> the
// curtain -> the floodlight, the pots, the ladder and the cart -> the boards and the seats. The same
// unhurried pace as the other scenes: 4.32 s.
const STROKES: StrokePlan[] = [
  { via: [[-10, 50], [1690, 55], [1690, 170], [-10, 175]], width: 200, at: 0, takes: 1.16 },
  { via: [[300, 230], [960, 225], [970, 400], [310, 410]], width: 230, at: 0.3, takes: 0.9 },
  { via: [[40, 260], [260, 255], [250, 600], [40, 610]], width: 220, at: 0.62, takes: 0.9 },
  // The far left, down the flats and the floodlight's side to the boards.
  { via: [[30, 190], [45, 520], [30, 870]], width: 200, at: 0.95, takes: 0.85 },
  { via: [[980, 230], [1540, 230], [1530, 520], [990, 520]], width: 240, at: 1.0, takes: 1.1 },
  { via: [[1520, 150], [1660, 160], [1650, 700], [1540, 720]], width: 230, at: 1.5, takes: 0.9 },
  { via: [[300, 430], [960, 440], [960, 560], [320, 560]], width: 220, at: 1.8, takes: 0.9 },
  { via: [[40, 650], [700, 640], [710, 760], [50, 770]], width: 220, at: 2.3, takes: 0.9 },
  { via: [[700, 560], [1100, 560], [1100, 740], [700, 740]], width: 230, at: 2.6, takes: 0.8 },
  { via: [[1100, 520], [1600, 520], [1600, 760], [1100, 770]], width: 235, at: 2.9, takes: 0.8 },
  { via: [[1660, 860], [330, 850]], width: 225, at: 3.1, takes: 0.9 },
  { via: [[60, 950], [1560, 953]], width: 150, at: 3.42, takes: 0.6 },
  { via: [[40, 880], [300, 925]], width: 200, at: 3.6, takes: 0.5 },
  { via: [[1540, 905], [1690, 930]], width: 210, at: 3.78, takes: 0.54 },
];

// The lamp hangs from the top rim (its layer: plate x 1327 to 1427, y 0 to 101). Its rope fades into the
// paper with the rim, as the fly ropes do; its hood and cage, from plate y 24 down, across its whole swing,
// are kept painted by hugging them (edge.ts, KeepBox 'hug'): these boxes follow the swing's outline, band by
// band, as traced on all 36 stills.
const LAMP_CAGE: KeepBox[] = [
  [1352, 24, 1401, 30, 'hug'],
  [1345, 30, 1409, 40, 'hug'],
  [1331, 40, 1423, 58, 'hug'],
  [1340, 58, 1413, 86, 'hug'],
  [1347, 86, 1404, 97, 'hug'],
];

export const set: SceneConfig = {
  id: 'set',
  label: 'Set Design',
  picture: 'Hui Jie on a ladder painting a theatre backdrop. Ten mushrooms are hidden on the stage.',
  assets: 'scene5/',
  plate: 'room.webp',
  // The whole cast as delivered by task 022 (frames/022-theatre-scene/site/): frames.json has the backdrop's
  // ten swaths (shown as the hunt goes on), the stagehand (a track, his drawings and the two masks he shows
  // in), the lamp and Rachel; routine.json has the lamp's swing, her routine, blink and reaction, and when the
  // stagehand walks.
  character: { kind: 'cast', dir: 'cast/', frames: 'frames.json', routine: 'routine.json' },
  spots: SPOTS,
  // The painting is whole under every pixel Rachel ever covers; and the lamp's cage.
  keep: [cast.covers.rachel as unknown as KeepBox, ...LAMP_CAGE],
  // (No `edge`: the scene's first edge already fits the strips the edge is drawn in and leaves every mushroom
  // and tap box where it is: qa/tools/pencil.mjs pick 800 set.)
  lines: 'pencil',
  // She turns to the visitor at once, from whatever pose she is in; a second find holds her salute longer.
  answer: 'at-once',
  again: 'hold',
  strokes: STROKES,
  // A phone starts on plate x 930: all of Rachel's layer (702 to 1096) and the start of the bare canvas.
  phoneStart: { wide: [554, 1306], tall: [617, 1243] },
};

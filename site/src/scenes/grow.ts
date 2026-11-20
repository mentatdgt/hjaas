// Scene 2, "Grow": Rachel in her mushroom lab, misting a tray on a steel trolley.
// Everything here is data for the engine in src/engine/; nothing in this file draws or moves anything.
import type { SceneConfig, Spot, StrokePlan } from '../engine/types';

// The lab's light is cool and white, so the mushrooms lose scene 1's warm cast: a little less colour, a
// touch brighter, and a few degrees towards blue.
const LIT = 'brightness(1.04) saturate(0.86) hue-rotate(-6deg)';
// Under a shelf or a bench: dimmer and greyer.
const SHADE = 'brightness(0.84) saturate(0.74) hue-rotate(-8deg)';
// Deep under the shelves, where the floor is in full shadow.
const DEEP = 'brightness(0.68) saturate(0.6) hue-rotate(-10deg)';
// Among the crop on a shelf: the shelves' soft light, with most of the warmth taken out, so a cream
// toadstool sits in the same greys and creams as the oyster mushrooms around it.
const SHELF = 'brightness(0.97) saturate(0.7) hue-rotate(-8deg)';

// The hunt has a curve: three easy finds, four that take a second look, and three that take a proper one
// (reviews/scene-2-hunt-difficulty.md). Left to right, which is also the Tab order.
//
//   easy    door, bench, switch-box: colour on white, where the eye goes first.
//   medium  under-shelf, floor, pipe, drain: small, in shade, or the colour of what they stand beside.
//   hard    crop-hood, crop-shelf, crop-rack: imposters among Rachel's own oyster mushrooms. They are
//           cream toadstools (a round cap on a stem), never fan-shaped, so a close look tells them apart.
//
// Every one is at least 14 px tall and at least 60% in view; none is ever behind Rachel (her arms and head
// move over plate x 690-1140, y 215-650; below that only the trolley is drawn, and it never moves).
const SPOTS: Spot[] = [
  { id: 'door', art: 3, x: 128, y: 806, h: 28, tint: LIT, grounded: true },
  // 34 px further right than first placed, so that on the smallest phones its tap box clears the door's.
  { id: 'bench', art: 8, x: 270, y: 791, h: 22, tint: SHADE, grounded: true },
  // Hard. Inside the fume hood, between the two jars of oyster mushrooms: seen through the glass.
  { id: 'crop-hood', art: 4, x: 418, y: 527, h: 18, tint: SHELF, opacity: 0.85 },
  // Medium. In the dark under the shelves.
  { id: 'under-shelf', art: 7, x: 652, y: 656, h: 16, tint: DEEP, grounded: true },
  // Hard. On the middle shelf, between the first two grow bags; its foot is behind the shelf's lip.
  { id: 'crop-shelf', art: 6, x: 694, y: 474, h: 20, tint: SHELF, tuck: 'polygon(0 0, 100% 0, 100% 85%, 0 85%)' },
  // Medium. Under the trolley's bottom shelf, half behind its back wheel. (The wheel is part of Rachel's
  // frames, which are drawn over the mushrooms, so it covers the mushroom by itself.)
  { id: 'floor', art: 6, x: 802, y: 830, h: 24, tint: SHADE, grounded: true },
  // Medium. Yellow, on the pipe beside its coupling: it reads as a fitting until looked at.
  { id: 'pipe', art: 7, x: 990, y: 117, h: 16, tint: LIT },
  { id: 'switch-box', art: 9, x: 1293, y: 314, h: 18, tint: LIT },
  // Medium. Cream on the pale floor, in the lee of the drain's grate.
  { id: 'drain', art: 4, x: 1388, y: 846, h: 21, tint: SHADE, grounded: true },
  // Hard. On the right-hand rack's middle shelf, against the foot of the pink oysters' bag.
  { id: 'crop-rack', art: 4, x: 1415, y: 493, h: 18, tint: SHELF },
];

// Spots of the first hunt that the harder one replaced. A visitor who had found one keeps the find.
const REPLACED = { 'bench-corner': 'crop-hood', humidifier: 'crop-shelf', rack: 'crop-rack' };

// Back wall and ceiling -> the shelves in the middle -> window, door and bench -> floor -> the rack on the right.
// The same unhurried pace as scene 1: each stroke takes 0.5 to 1.28 s, and the painting runs 4.32 s.
const STROKES: StrokePlan[] = [
  // Ceiling and back wall
  { via: [[1690, 55], [-10, 60], [-10, 165], [560, 170]], width: 200, at: 0, takes: 1.16 },
  { via: [[650, 120], [1260, 135], [1300, 300]], width: 190, at: 0.3, takes: 0.7 },
  // The shelves in the middle
  { via: [[600, 255], [1200, 260], [1215, 400], [605, 410], [595, 555], [1215, 565]], width: 245, at: 0.62, takes: 1.28 },
  { via: [[1300, 330], [1290, 640]], width: 200, at: 1.3, takes: 0.6 },
  // Window, door and bench
  { via: [[40, 250], [500, 245], [520, 400], [50, 410], [30, 560], [530, 560]], width: 235, at: 1.5, takes: 1.24 },
  { via: [[60, 640], [70, 860]], width: 200, at: 2.1, takes: 0.5 },
  { via: [[200, 640], [520, 655], [330, 790], [160, 800]], width: 205, at: 2.3, takes: 0.76 },
  // Floor
  { via: [[1250, 705], [560, 695], [560, 805], [1320, 815]], width: 200, at: 2.5, takes: 1 },
  { via: [[1340, 905], [330, 900]], width: 225, at: 2.86, takes: 0.8 },
  { via: [[60, 950], [1500, 953]], width: 150, at: 3.1, takes: 0.6 },
  // The rack on the right
  { via: [[1420, 150], [1660, 175], [1640, 330], [1405, 320], [1400, 480], [1660, 500]], width: 235, at: 3.04, takes: 1.04 },
  { via: [[1405, 630], [1660, 650], [1640, 810], [1430, 800]], width: 235, at: 3.4, takes: 0.76 },
  { via: [[1540, 905], [1690, 930]], width: 210, at: 3.78, takes: 0.54 },
];

export const grow: SceneConfig = {
  id: 'grow',
  label: 'Grow',
  picture: 'Hui Jie in her mushroom lab. Ten mushrooms are hidden in the room.',
  assets: 'scene2/',
  plate: 'room.webp',
  // Rachel as delivered by task 017 (frames/017-lab-keyposes/site/): frames.json has her stills, her clips
  // and where her canvas sits on the plate; routine.json has her routine, her blinks and her reaction.
  // Under 900 px she is drawn from the 1.5x set: a little over half the memory, and still as sharp as a
  // phone shows her.
  character: { kind: 'clips', dir: 'rachel/', frames: 'frames.json', routine: 'routine.json', small: { dir: 'rachel-1.5x/', below: 900 } },
  spots: SPOTS,
  replaced: REPLACED,
  // Of the edges this room could have, one that keeps the colour solid under every pixel Rachel ever covers
  // (her feet are 63 px from the bottom) and leaves every mushroom where it is (qa/tools/pencil.mjs pick).
  edge: 129,
  lines: 'pencil',
  strokes: STROKES,
  // A phone starts on Rachel and the trolley (about plate x 680-1180): centred on x 930 at either shape.
  phoneStart: { wide: [554, 1306], tall: [616, 1244] },
};

// Scene 2, "Grow": Rachel in her mushroom lab, misting a tray on a steel trolley.
// Everything here is data for the engine in src/engine/; nothing in this file draws or moves anything.
import type { SceneConfig, Spot, StrokePlan } from '../engine/types';

// The lab's light is cool and white, so the mushrooms lose scene 1's warm cast: a little less colour, a
// touch brighter, and a few degrees towards blue.
const LIT = 'brightness(1.04) saturate(0.86) hue-rotate(-6deg)';
// Under a shelf or a bench: dimmer and greyer.
const SHADE = 'brightness(0.84) saturate(0.74) hue-rotate(-8deg)';

// Left to right, which is also the Tab order. Sizes follow depth, as in scene 1: about 18 px on the back
// wall, about 40 px at the front of the floor. White drawings are used twice only (the lab is white), and
// both stand where their outline shows: on the sunlit floor and beside the humidifier's base.
// None is on the trolley or behind Rachel: her frames cover that part of the plate (x 680-1170, y 210-900).
const SPOTS: Spot[] = [
  { id: 'door', art: 3, x: 128, y: 806, h: 28, tint: LIT, grounded: true },
  // 34 px further right than first placed, so that on the smallest phones its tap box clears the door's.
  { id: 'bench', art: 8, x: 270, y: 791, h: 22, tint: SHADE, grounded: true },
  { id: 'floor', art: 6, x: 470, y: 905, h: 40, tint: LIT, grounded: true },
  { id: 'bench-corner', art: 1, x: 506, y: 524, h: 18, tint: LIT },
  { id: 'under-shelf', art: 7, x: 652, y: 656, h: 18, tint: SHADE, grounded: true },
  { id: 'pipe', art: 2, x: 985, y: 115, h: 18, tint: LIT },
  { id: 'switch-box', art: 9, x: 1293, y: 314, h: 18, tint: LIT },
  { id: 'humidifier', art: 4, x: 1352, y: 660, h: 22, tint: SHADE, grounded: true },
  { id: 'drain', art: 1, x: 1372, y: 850, h: 34, flip: true, tint: LIT, grounded: true },
  { id: 'rack', art: 9, x: 1528, y: 770, h: 28, flip: true, tint: SHADE, grounded: true },
];

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
  character: { kind: 'clips', dir: 'rachel/', frames: 'frames.json', routine: 'routine.json' },
  spots: SPOTS,
  strokes: STROKES,
  // A phone starts on Rachel and the trolley (about plate x 680-1180): centred on x 930 at either shape.
  phoneStart: { wide: [554, 1306], tall: [616, 1244] },
};

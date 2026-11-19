// Scene 1, "Build": Rachel hammering a box together in a flat under renovation.
// Everything here is data for the engine in src/engine/; nothing in this file draws or moves anything.
import type { SceneConfig, Spot, StrokePlan } from '../engine/types';
import { CONTACT_POSE, hammerSchedule } from './build-rhythm';

// Left to right, which is also the Tab order.
// Sizes follow depth: about 18 px at the back wall, about 42 px at the front edge of the floor.
const SHADE = 'brightness(0.84) saturate(0.92) sepia(0.12)';
const LIT = 'brightness(1.02) saturate(1.05) sepia(0.14)';
const SPOTS: Spot[] = [
  { id: 'sill', art: 7, x: 421, y: 549, h: 18, tint: LIT },
  { id: 'drape', art: 8, x: 388, y: 753, h: 28, tint: SHADE, tuck: 'polygon(17% 0, 100% 0, 100% 100%, 57% 100%)' },
  { id: 'skirting', art: 2, x: 574, y: 643, h: 20, tint: LIT, grounded: true },
  { id: 'screed', art: 6, x: 588, y: 921, h: 40, tint: SHADE, grounded: true },
  { id: 'tiles', art: 3, x: 1152, y: 929, h: 42, tint: LIT, grounded: true },
  { id: 'conduit', art: 9, x: 1181, y: 642, h: 20, tint: LIT },
  { id: 'socket', art: 1, x: 1270, y: 345, h: 18, tint: SHADE },
  // Not drawing 5: at this size its slender stem reads as a nail standing on the tiles.
  { id: 'ladder-foot', art: 7, x: 1312, y: 845, h: 36, tint: SHADE, grounded: true },
  { id: 'ladder-step', art: 4, x: 1404, y: 472, h: 24, tint: LIT },
  // The tenth is drawing 1 again, mirrored and twice the size of the one in the socket.
  { id: 'toolbox', art: 1, x: 1432, y: 909, h: 40, flip: true, tint: SHADE, tuck: 'polygon(0 0, 61% 0, 69% 100%, 0 100%)', grounded: true },
];

// Back wall -> window light -> floor -> props. Walls and floor leave the props' corners for the last strokes.
// Unhurried: each stroke takes 0.48 to 1.28 s, and they overlap unevenly, so the painting runs 4.32 s.
const STROKES: StrokePlan[] = [
  // Back wall
  { via: [[890, 80], [1250, 95], [1275, 255], [905, 265], [890, 425], [1275, 440]], width: 250, at: 0, takes: 1.24 },
  { via: [[1690, 40], [-10, 45], [-10, 165], [700, 170]], width: 195, at: 0.28, takes: 1.12 },
  { via: [[1275, 590], [900, 565]], width: 225, at: 0.72, takes: 0.6 },
  // Window light
  { via: [[30, 265], [700, 255], [725, 400], [40, 405], [20, 545], [720, 545]], width: 235, at: 1.12, takes: 1.28 },
  { via: [[805, 130], [795, 640]], width: 245, at: 1.68, takes: 0.68 },
  // Floor
  { via: [[900, 690], [545, 655], [545, 765], [1265, 775]], width: 195, at: 2.12, takes: 1 },
  { via: [[1275, 880], [520, 870]], width: 225, at: 2.48, takes: 0.8 },
  { via: [[560, 948], [1275, 952]], width: 150, at: 2.8, takes: 0.56 },
  // Props
  { via: [[60, 440], [265, 600], [60, 720], [335, 800], [120, 925], [490, 905]], width: 235, at: 2.88, takes: 1.04 },
  { via: [[425, 615], [505, 700], [645, 700]], width: 150, at: 3.24, takes: 0.48 },
  { via: [[1345, 90], [1320, 420]], width: 180, at: 3.12, takes: 0.56 },
  { via: [[1485, 60], [1400, 480], [1300, 865]], width: 235, at: 3.24, takes: 0.76 },
  { via: [[1605, 80], [1640, 500], [1505, 700], [1645, 905]], width: 245, at: 3.52, takes: 0.8 },
];

export const build: SceneConfig = {
  id: 'build',
  label: 'Build',
  picture: 'Hui Jie at work. Ten mushrooms are hidden in the room.',
  assets: 'scene1/',
  plate: 'room.webp',
  character: {
    dir: 'rachel/',
    frames: ['frame_01', 'frame_02', 'frame_03', 'frame_04', 'blink_half', 'blink_closed'],
    rest: CONTACT_POSE,
    // Where Rachel sits on the plate (HANDOVER §2), ported from composite() in tools/preview_timing.py:
    // the figure is 455 plate px tall, her frame's left edge is at x = 600 and her feet line is at y = 868.
    placement: { kind: 'standing', left: 600, baseline: 868, height: 455, shadow: true },
    routine: { kind: 'code', schedule: hammerSchedule },
    reaction: 'reaction/',
  },
  spots: SPOTS,
  strokes: STROKES,
  // The crop starts on Rachel and the box. A 4:5 window shows plate x 514-1267 (scene/README.md), a 2:3
  // window x 590-1220 (review 01).
  phoneStart: { wide: [514, 1267], tall: [590, 1220] },
};

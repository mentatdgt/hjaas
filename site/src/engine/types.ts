// What a scene is, as data. The engine (this folder) knows how to show any scene; a scene's own file in
// src/scenes/ only describes it: its plate, its character, its hiding spots and its brush strokes.
import type { Rng, Step } from './steps';

/** One brush stroke of a scene's paint-in. */
export interface StrokePlan {
  /** Control points in plate px. The brush follows a smooth curve through them. */
  via: Array<[number, number]>;
  width: number;
  /** Seconds from the start of the painting. */
  at: number;
  /** Seconds the stroke takes. */
  takes: number;
}

/** One hidden mushroom. */
export interface Spot {
  /** Stable id, saved in localStorage. Never reuse or renumber within a scene. */
  id: string;
  /** Which drawing: frames/003-mushrooms/approved/mushroom_NN.png */
  art: number;
  /** Plate px: the centre of the drawing, left to right. */
  x: number;
  /** Plate px: where the drawing's base rests. */
  y: number;
  /** Height in plate px. Further back in the room means smaller. */
  h: number;
  flip?: boolean;
  /** CSS filter so it sits in that spot's light. Static, never animated. */
  tint?: string;
  /** CSS clip-path, in % of the drawing's box: hides the part tucked behind something in the plate. */
  tuck?: string;
  /** Draw a small contact shadow (for mushrooms standing on a surface). */
  grounded?: boolean;
  /** Less than 1 for a mushroom seen through glass. Static, never animated. */
  opacity?: number;
}

/** How a character's frames sit on the plate. */
export type Placement =
  /** Frames fill a fixed rectangle of the plate, given in plate px (scene 2, from its frames.json). */
  | { kind: 'box'; x: number; y: number; width: number; height: number }
  /**
   * Frames are cut-outs of the figure. She is `height` plate px tall, her frame's left edge is at `left`
   * and her feet are on `baseline`; the scale comes from the rest frame's own pixels (scene 1).
   */
  | { kind: 'standing'; left: number; baseline: number; height: number; shadow: boolean };

/** An idle routine written as data: what the character does when nobody is finding mushrooms. */
export type Routine =
  /** A generator written in code (scene 1's hammer rhythm, ported from Wren's timing script). */
  | { kind: 'code'; schedule: (rnd: Rng) => Iterator<Step> }
  /** A loop manifest in the character's folder, played by routine.ts. */
  | { kind: 'manifest'; file: string };

/** A character whose every pose is one whole image (scene 1). */
export interface FrameCast {
  kind: 'frames';
  /** Folder under the scene's assets that holds the frames, with a trailing slash. */
  dir: string;
  /** The frames the idle routine uses. They are decoded before the scene is shown. */
  frames: readonly string[];
  /** The frame she rests on: where the routine starts, and where a reaction starts and ends. */
  rest: string;
  placement: Placement;
  routine: Routine;
  /** Folder (under `dir`) holding reaction.json and its frames. Leave out for no reaction. */
  reaction?: string;
  /**
   * A lighter copy of the same folder (made by `npm run assets`), used when the picture is shown less
   * than `below` CSS px wide: phones, where memory is short.
   */
  small?: { dir: string; below: number };
}

/**
 * A character delivered as stills and clips of patches, with her routine and reaction in a manifest
 * (scene 2; the format is described in clips.ts). Her placement, rest pose and reaction all come from the
 * two files, so the config only says where they are.
 */
export interface ClipCast {
  kind: 'clips';
  /** Folder under the scene's assets that holds everything, with a trailing slash. */
  dir: string;
  /** The frame manifest, in that folder. */
  frames: string;
  /** The routine manifest, in that folder. */
  routine: string;
  /**
   * A lighter copy of the same frames (made by `npm run assets`, with its own frame manifest), used when
   * the picture is shown less than `below` CSS px wide: phones, where memory is short.
   */
  small?: { dir: string; below: number };
}

export type CharacterConfig = FrameCast | ClipCast;

export interface SceneConfig {
  /** Short name used in the address (`#grow`) and in saved progress. Never change it once live. */
  id: string;
  /** The scene menu's label. */
  label: string;
  /** What the picture shows, for screen readers. */
  picture: string;
  /** The scene's folder under the assets root, with a trailing slash. */
  assets: string;
  /** The plate image, 1672 × 941, in that folder. */
  plate: string;
  /** Leave out for a scene whose character is not drawn yet. */
  character?: CharacterConfig;
  /** The ten hiding spots, left to right (which is also the Tab order). */
  spots: readonly Spot[];
  /**
   * Hiding spots that were replaced: the old id, and the id of the spot that took its place. A visitor who
   * had found the old one keeps the find.
   */
  replaced?: Readonly<Record<string, string>>;
  /**
   * Which of its possible edges the painting has. Each number gives the scene a different wandering edge;
   * the one chosen keeps the wander clear of the mushrooms and of the character (qa/tools/edge.mjs pick).
   * Leave out for the first.
   */
  edge?: number;
  /**
   * The pencil lines the painting's edge trails off in: the name its two line maps start with, in `assets`
   * (`pencil` for `pencil-tb.webp` and `pencil-lr.webp`; npm run assets cuts them from scene/pencil/).
   * Leave out and the colour fades the same way, with no pencil.
   */
  lines?: string;
  /** The first-visit painting. The same strokes, played quickly, brush the scene in over another one. */
  strokes: readonly StrokePlan[];
  /**
   * What a portrait phone shows first, as plate x ranges: at a 4:5 window and at a 2:3 window.
   * Windows in between are framed in between.
   */
  phoneStart: { wide: readonly [number, number]; tall: readonly [number, number] };
}

// A whole cast in one package: the routine engine's manifests for a scene with several actors (the café,
// frames/018-cafe-scene/site/).
//
//   frames.json   the canvas the scene was drawn on; the actors as layers, in drawing order, each with its
//                 box on that canvas and its stills; and the clips, each belonging to one layer, its patches
//                 placed in that layer's own pixels.
//   routine.json  one routine per actor ("actors"), in the vocabulary of clips.ts. Each runs by itself and
//                 out of step with the others. An actor with a "reaction" answers a mushroom find.
//
// A package may also have a live screen in its picture (the film scene: the back of Rachel's camera):
//
//   "camera_screen": { "source": { x, y, w, h }, "rect_by_still": { "<still>": { x, y, w, h }, … } }
//
// `source` is the part of the scene the screen shows; each rect is where the screen is when the actor who
// holds it is on that still. It belongs to the layer those stills are from, and shows the plate and the
// layers drawn before that one (screen.ts draws it).
//
// A layer may be drawn larger than the canvas it stands on (the film scene's presenter, for phones):
//
//   "scale": s           its stills are s × w by s × h, drawn into its box, which stays in canvas px. Its canvas on
//                        the page has the pixels it covers on the screen, and never more than s × its box; so a phone
//                        shows the extra sharpness and an ordinary screen costs what it did. npm run assets keeps
//                        the layer's first still whole and cuts each of the others down to the rectangle where it
//                        differs ("patches" in the page's own frames.json, in the layer's own px, s to a canvas px).
//
// And two kinds of layer that are not actors (the theatre, scene 5):
//
//   "hunt_progress": k   a still shown once k mushrooms of the scene are found (the backdrop, painted swath
//                        by swath as the visitor hunts). The fade's length is the routine entry `backdrop`'s
//                        `fade_ms`, if the package has one.
//   "sprite_track"       no stills: a track of frames (a list of sprites each, placed and turned), the sprites,
//                        and the masks the drawing is kept inside: `mask` (the stagehand's boots, in the gap
//                        under the backdrop's hem) and `body_mask` (the whole man, in the slot beside it). Its
//                        routine entry says when it walks (walk.ts).
//
// Nothing here knows who the actors are. This file only takes the package apart: each actor becomes a pair
// of manifests in the form clips.ts already plays, as if it were alone on the plate. So a new delivery in
// the same layout, with other actors, stills, clips or routines, is played without any code changing.
import { checkClips, type ClipFrames, type ClipRoutine } from './clips';

export interface CastFrames {
  /** The canvas the scene was drawn on. The plate is the same picture, whatever size the page shows it at. */
  canvas: { w: number; h: number };
  /** The actors, bottom to top. */
  layers: ReadonlyArray<{
    actor: string;
    x: number;
    y: number;
    w: number;
    h: number;
    /** (A sprite-track layer has none: npm run assets writes an empty list for it.) */
    stills: readonly string[];
    /** How many of its stills' px make one canvas px. Left out: 1. */
    scale?: number;
    /** Stills whose file holds only what differs from `base` (npm run assets writes these), in the layer's own px. */
    patches?: Readonly<Record<string, { base: string; x: number; y: number }>>;
    scenery?: boolean;
    hunt_progress?: number;
    sprite_track?: string;
    sprites?: Readonly<Record<string, string>>;
    mask?: string;
    body_mask?: string;
  }>;
  /** Still name -> file. */
  stills: Readonly<Record<string, string>>;
  /** Clip name -> the layer it belongs to, its base still, where its patches go in the layer, and the files. */
  clips?: Readonly<Record<string, { layer: string; base: string; x: number; y: number; frames: readonly string[] }>>;
  /** A live screen in the picture, in the canvas's px (see the top of this file). */
  camera_screen?: { source: Rect; rect_by_still: Readonly<Record<string, Rect>> };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A package's live screen, in plate px: who holds it, what it shows, and where it is on each of her stills. */
export interface CastScreen {
  actor: string;
  source: Rect;
  rects: Readonly<Record<string, Rect>>;
}

export interface CastRoutines {
  actors: Readonly<Record<string, ClipRoutine | WalkRoutine | { fade_ms?: number }>>;
}

/** When a sprite-track layer walks: the first time, how long until it comes back, how long until the next time; and its tracks in order. */
export interface WalkRoutine {
  first_ms: readonly [number, number];
  return_after_ms: readonly [number, number];
  every_ms: readonly [number, number];
  sequence: readonly string[];
}

/** A still shown once this many mushrooms of the scene are found, at its place on the plate (plate px). */
export interface ProgressPiece {
  at: number;
  name: string;
  file: string;
  box: Rect;
}

/** A sprite-track layer, in the package's own files and plate px: what walk.ts needs to play it. */
export interface Walker {
  name: string;
  track: string;
  sprites: Readonly<Record<string, string>>;
  mask?: string;
  bodyMask?: string;
  routine: WalkRoutine;
  /** Plate px per canvas px. */
  scale: number;
}

export interface Actor {
  name: string;
  frames: ClipFrames;
  routine: ClipRoutine;
  /** Answers a mushroom find. */
  reacts: boolean;
}

/**
 * The package, one actor at a time, bottom to top, and everything wrong with it in plain words (an empty
 * list means it can be played). `plateWidth` is the page's plate, in the px its scenes are laid out in.
 */
export interface SplitCast {
  actors: Actor[];
  problems: string[];
  screen: CastScreen | null;
  /** The hunt's progress pieces, in the order they are shown (empty for a scene without). */
  progress: ProgressPiece[];
  /** How long a progress piece takes to fade in, in ms. */
  progressFade: number;
  walkers: Walker[];
}

/** A progress piece fades in over this long when the package does not say. */
const PROGRESS_FADE_MS = 700;

export function splitCast(frames: CastFrames, routines: CastRoutines, plateWidth: number): SplitCast {
  const problems: string[] = [];
  const actors: Actor[] = [];
  const progress: ProgressPiece[] = [];
  const walkers: Walker[] = [];
  const empty = (problem: string): SplitCast => ({ actors, problems: [problem], screen: null, progress, progressFade: PROGRESS_FADE_MS, walkers });
  const canvas = frames?.canvas;
  if (!canvas || !(canvas.w > 0 && canvas.h > 0)) return empty('frames.json needs a "canvas" with its size.');
  if (!Array.isArray(frames.layers) || frames.layers.length === 0) return empty('frames.json needs "layers": the actors, bottom to top.');
  const k = plateWidth / canvas.w;
  const names = new Set(frames.layers.map((layer) => layer.actor));
  // The progress pieces share one routine entry, named after them without their number (backdrop_01: backdrop).
  const progressEntries = new Set(frames.layers.filter((layer) => layer.hunt_progress !== undefined).map((layer) => layer.actor.replace(/[_-]?\d+$/, '')));
  for (const name of Object.keys(routines?.actors ?? {})) {
    if (!names.has(name) && !progressEntries.has(name)) problems.push(`routine.json has a routine for "${name}", who has no layer in frames.json.`);
  }
  for (const [name, clip] of Object.entries(frames.clips ?? {})) {
    if (!names.has(clip.layer)) problems.push(`The clip "${name}" belongs to the layer "${clip.layer}", which frames.json does not have.`);
  }
  for (const layer of frames.layers) {
    if (!(layer.w > 0 && layer.h > 0)) {
      problems.push(`The layer "${layer.actor}" needs its box: x, y, w and h.`);
      continue;
    }
    if (layer.hunt_progress !== undefined) {
      const still = layer.stills?.[0];
      if (!Number.isInteger(layer.hunt_progress) || layer.hunt_progress < 1) problems.push(`The layer "${layer.actor}" needs a "hunt_progress" of 1 or more.`);
      else if (!still || !frames.stills?.[still]) problems.push(`The layer "${layer.actor}" needs one still, which "stills" has.`);
      else progress.push({ at: layer.hunt_progress, name: still, file: frames.stills[still], box: { x: layer.x * k, y: layer.y * k, w: layer.w * k, h: layer.h * k } });
      continue;
    }
    if (layer.sprite_track) {
      const routine = routines?.actors?.[layer.actor] as WalkRoutine | undefined;
      const range = (r: unknown): boolean => Array.isArray(r) && r.length === 2 && r.every((n) => typeof n === 'number' && n >= 0) && r[0] <= r[1];
      if (!routine || !range(routine.first_ms) || !range(routine.return_after_ms) || !range(routine.every_ms) || !Array.isArray(routine.sequence) || routine.sequence.length === 0) {
        problems.push(`routine.json needs, for "${layer.actor}", "first_ms", "return_after_ms" and "every_ms" (each [least, most]) and a "sequence" of tracks.`);
      } else if (!layer.sprites || Object.keys(layer.sprites).length === 0) {
        problems.push(`The layer "${layer.actor}" needs its "sprites".`);
      } else {
        walkers.push({ name: layer.actor, track: layer.sprite_track, sprites: layer.sprites, mask: layer.mask, bodyMask: layer.body_mask, routine, scale: k });
      }
      continue;
    }
    const scale = layer.scale ?? 1;
    if (!(scale >= 1)) {
      problems.push(`The layer "${layer.actor}" has a "scale" of ${String(layer.scale)}: it must be 1 or more.`);
      continue;
    }
    const stills: Record<string, string> = {};
    for (const still of layer.stills ?? []) {
      if (frames.stills?.[still]) stills[still] = frames.stills[still];
      else problems.push(`The layer "${layer.actor}" lists the still "${still}", which "stills" does not have.`);
    }
    const clips: Record<string, ClipFrames['clips'][string]> = {};
    for (const [name, clip] of Object.entries(frames.clips ?? {})) {
      if (clip.layer === layer.actor) clips[name] = { base: clip.base, x: clip.x, y: clip.y, frames: clip.frames };
    }
    const own: ClipFrames = {
      canvas: { w: layer.w * scale, h: layer.h * scale, plate_x: layer.x * k, plate_y: layer.y * k, plate_w: layer.w * k, plate_h: layer.h * k },
      stills,
      ...(layer.patches ? { patches: layer.patches } : {}),
      clips,
    };
    // An actor nobody wrote a routine for simply stands there.
    const first = layer.stills?.[0];
    const routine: ClipRoutine = (routines?.actors?.[layer.actor] as ClipRoutine | undefined) ?? { routine: [{ still: first ?? null, ms: 1000 }] };
    for (const problem of checkClips(own, routine)) problems.push(`${layer.actor}: ${problem}`);
    actors.push({ name: layer.actor, frames: own, routine, reacts: routine.reaction !== undefined });
  }
  progress.sort((a, b) => a.at - b.at);
  for (let i = 0; i < progress.length; i++) if (progress[i].at !== i + 1) problems.push(`The "hunt_progress" layers must be numbered 1 to ${progress.length}, one each.`);
  const fade = progressEntries.size ? (routines?.actors?.[[...progressEntries][0]] as { fade_ms?: number } | undefined)?.fade_ms : undefined;
  return { actors, problems, screen: screenOf(frames, k, problems), progress, progressFade: typeof fade === 'number' && fade >= 0 ? fade : PROGRESS_FADE_MS, walkers };
}

/** The package's live screen in plate px, or null when it has none (or it cannot be drawn: `problems` says why). */
function screenOf(frames: CastFrames, k: number, problems: string[]): CastScreen | null {
  const spec = frames.camera_screen;
  if (!spec) return null;
  const whole = (r: Rect | undefined): r is Rect => !!r && [r.x, r.y, r.w, r.h].every(Number.isFinite) && r.w > 0 && r.h > 0;
  const stills = Object.keys(spec.rect_by_still ?? {});
  if (!whole(spec.source) || stills.length === 0 || !stills.every((still) => whole(spec.rect_by_still[still]))) {
    problems.push('"camera_screen" needs a "source" and a "rect_by_still", each rectangle with x, y, w and h.');
    return null;
  }
  // It is held by the layer its stills are from.
  const holder = frames.layers.find((layer) => stills.every((still) => layer.stills?.includes(still)));
  if (!holder) {
    problems.push(`"camera_screen" is placed by the stills ${stills.map((still) => `"${still}"`).join(', ')}, which no one layer has.`);
    return null;
  }
  const scaled = (r: Rect): Rect => ({ x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k });
  return { actor: holder.actor, source: scaled(spec.source), rects: Object.fromEntries(stills.map((still) => [still, scaled(spec.rect_by_still[still])])) };
}

/** The actor a find is answered by, and the picture is about: the first one with a reaction, or else the top one. */
export function leadOf<T extends { reacts: boolean }>(actors: readonly T[]): T | undefined {
  return actors.find((actor) => actor.reacts) ?? actors[actors.length - 1];
}

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
// Nothing here knows who the actors are. This file only takes the package apart: each actor becomes a pair
// of manifests in the form clips.ts already plays, as if it were alone on the plate. So a new delivery in
// the same layout, with other actors, stills, clips or routines, is played without any code changing.
import { checkClips, type ClipFrames, type ClipRoutine } from './clips';

export interface CastFrames {
  /** The canvas the scene was drawn on. The plate is the same picture, whatever size the page shows it at. */
  canvas: { w: number; h: number };
  /** The actors, bottom to top. */
  layers: ReadonlyArray<{ actor: string; x: number; y: number; w: number; h: number; stills: readonly string[]; scenery?: boolean }>;
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
  actors: Readonly<Record<string, ClipRoutine>>;
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
export function splitCast(frames: CastFrames, routines: CastRoutines, plateWidth: number): { actors: Actor[]; problems: string[]; screen: CastScreen | null } {
  const problems: string[] = [];
  const actors: Actor[] = [];
  const canvas = frames?.canvas;
  if (!canvas || !(canvas.w > 0 && canvas.h > 0)) return { actors, problems: ['frames.json needs a "canvas" with its size.'], screen: null };
  if (!Array.isArray(frames.layers) || frames.layers.length === 0) return { actors, problems: ['frames.json needs "layers": the actors, bottom to top.'], screen: null };
  const k = plateWidth / canvas.w;
  const names = new Set(frames.layers.map((layer) => layer.actor));
  for (const name of Object.keys(routines?.actors ?? {})) {
    if (!names.has(name)) problems.push(`routine.json has a routine for "${name}", who has no layer in frames.json.`);
  }
  for (const [name, clip] of Object.entries(frames.clips ?? {})) {
    if (!names.has(clip.layer)) problems.push(`The clip "${name}" belongs to the layer "${clip.layer}", which frames.json does not have.`);
  }
  for (const layer of frames.layers) {
    if (!(layer.w > 0 && layer.h > 0)) {
      problems.push(`The layer "${layer.actor}" needs its box: x, y, w and h.`);
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
      canvas: { w: layer.w, h: layer.h, plate_x: layer.x * k, plate_y: layer.y * k, plate_w: layer.w * k, plate_h: layer.h * k },
      stills,
      clips,
    };
    // An actor nobody wrote a routine for simply stands there.
    const first = layer.stills?.[0];
    const routine: ClipRoutine = routines?.actors?.[layer.actor] ?? { routine: [{ still: first ?? null, ms: 1000 }] };
    for (const problem of checkClips(own, routine)) problems.push(`${layer.actor}: ${problem}`);
    actors.push({ name: layer.actor, frames: own, routine, reacts: routine.reaction !== undefined });
  }
  return { actors, problems, screen: screenOf(frames, k, problems) };
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

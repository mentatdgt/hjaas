// One scene, built from its config: the plate, the character on it, and the ten hidden mushrooms.
// A scene knows nothing about the page around it; site.ts puts it in the window and takes it out again.
import { FrameStore, PLATE, type Frame, asset, assetSignal, decodeBlob, decodePart, fetchBlob, fetchFrame, frameSize, idle, loadImage, loadPlate, releaseFrame, requiredAsset } from './assets';
import { leadOf, splitCast, type CastFrames, type CastRoutines, type CastScreen } from './cast';
import { Character } from './character';
import { edgeAlpha, edgeName, makeEdge, type Edge, type EdgeStyle } from './edge';
import { checkClips, clipEntry, clipPose, clipReaction, clipSchedule, clipsInUse, restOf, stillsInUse, type ClipFrames, type ClipRoutine, type Entry } from './clips';
import { Hunt, type HuntArt } from './mushrooms';
import { Player, type Schedule } from './player';
import { Reel } from './reel';
import { loadReaction, type Reaction } from './reaction';
import { Viewfinder } from './screen';
import { Progress } from './progress';
import { Walk, type TrackFile } from './walk';
import { checkRoutine, routineFrames, routineSchedule, type RoutineManifest } from './routine';
import { holdSchedule, type Rng, type Step } from './steps';
import type { Sheets } from './transition';
import type { ClipCast, FrameCast, SceneConfig, Spot, Troupe } from './types';

/** What a scene needs from the page it is shown on. */
export interface SceneHost {
  /** Layer above everything, where a collected mushroom travels. */
  flyLayer: HTMLElement;
  /** The ids of this scene's mushrooms already found. */
  found: ReadonlySet<string>;
  /** Screen rect a collected mushroom travels to. */
  target: () => DOMRect;
  rnd: Rng;
  /** Paused, or reduced motion: the character holds her rest pose and answers a find with one held pose. */
  still: () => boolean;
  onFind: (spot: Spot) => void;
  onLand: (spot: Spot) => void;
  /** The plate has changed size. */
  onLayout: () => void;
  /** QA: called on every pose change. */
  onPose?: (pose: string, at: number) => void;
  /** How wide the picture is shown, in CSS px (the window onto the room, not the room itself). */
  shownWidth: () => number;
  /** The painting's edge: which style, and the paper it fades into, as red, green, blue. */
  edge: { style: EdgeStyle; seed: (scene: string) => number; paper: [number, number, number] };
}

/**
 * A character ready to go on the plate, and what is still to be fetched for her. A scene has one, or a whole cast of
 * them. She can be painted as soon as the drawing she rests on is here: the rest of her drawings come after it, and
 * until they all have (`stocked`) she holds it.
 */
interface Cast {
  character: Character;
  routine: () => Schedule;
  /** Every drawing her routine shows has been decoded once. */
  stocked: () => boolean;
  /** Download those drawings (no decoding). Called off by the signal, it carries on from there the next time. */
  download: (signal: AbortSignal) => Promise<void>;
  /** Download them and decode them, a few at a time in quiet moments between frames. */
  stock: (signal: AbortSignal) => Promise<void>;
  /** She answers a mushroom find. */
  reacts: boolean;
  /**
   * The reaction, once it can be played in full. Until then `still` stands in, if there is one. `roll`,
   * when it is there, gives the steps afresh each time (times that are ranges, a blink that may or may not come).
   */
  reaction: () => (Pick<Reaction, 'steps' | 'still'> & { roll?: (rnd?: Rng) => Step[] }) | null;
  still: Reaction['still'];
  /** How her reaction is come into from the middle of her routine, if her package says (clips.ts, Entry). */
  entry?: Entry | null;
  /**
   * Fetches what the first showing did not need (clips, reaction frames), one image at a time in quiet
   * moments. `reactions: false` leaves out what only a reaction uses.
   */
  more: (reactions: boolean) => Promise<void>;
  /** The poses that may be shown soon (see steps.ts). Only a character with a reel listens. */
  ahead?: (poses: readonly string[]) => void;
  /**
   * The scene is out of sight: give back every decoded frame but the one on her canvas (or that one too:
   * see `keeps`). The downloaded files are kept, so wake() brings the frames back by decoding alone, while
   * the brush is at work. wake() resolves when she can be drawn again: at once if her canvas's frame was kept.
   */
  sleep: (keepShown?: boolean) => void;
  wake: () => Promise<void>;
  /**
   * Out of sight she keeps the frame on her canvas, and carries on from it when the scene comes back. False:
   * she keeps nothing at all, and starts her routine afresh from her rest pose (the café's cast: three scenes'
   * kept frames would be more than the page's memory allows on a phone).
   */
  keeps: boolean;
  /**
   * She holds a live screen that shows the scene under her (the film scene's camera: see screen.ts), and the
   * part of the plate it shows, cut out once and kept.
   */
  screen?: CastScreen;
  backdrop?: ImageBitmap | null;
  /** QA: decoded image memory, in bytes. */
  memory?: () => Record<string, number>;
}

/**
 * A whole cast, and what else its package puts in the picture: the hunt's progress pieces (the theatre's
 * backdrop) and its walkers (the stagehand). Painted with the room, under the cast.
 */
type CastList = Cast[] & { progress?: Progress; walks?: Walk[] };

function releaseCastList(casts: CastList): void {
  for (const actor of casts) {
    actor.sleep(false);
    actor.backdrop?.close();
  }
  casts.progress?.sleep();
  for (const walk of casts.walks ?? []) walk.sleep();
}

const json = async <T>(path: string): Promise<T> => {
  const response = await fetch(asset(path), { signal: assetSignal() });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return (await response.json()) as T;
};
/** How many drawings are decoded at a time before they are rehearsed. */
const BATCH = 4;
/** What one quiet moment between two frames is given to: so many of the drawings' pixels, and no more than so long. */
const TURN_PIXELS = 400_000;
const TURN_MS = 4;
let turn: Promise<void> = Promise.resolve();
/**
 * Rehearse these drawings (`put` draws each for the first time) in quiet moments between frames, one small turn to a
 * frame: a brush may be at work. Several actors take turns, and never share a frame.
 */
function quietly(frames: readonly Frame[], put: (n: number) => void, active: () => boolean): Promise<void> {
  const pixels = (n: number): number => {
    const { w, h } = frameSize(frames[n]);
    return w * h;
  };
  const mine = turn.then(async () => {
    for (let n = 0; n < frames.length; ) {
      await idle();
      if (!active()) return;
      const until = performance.now() + TURN_MS;
      let spent = 0;
      do {
        spent += pixels(n);
        put(n++);
      } while (n < frames.length && spent + pixels(n) <= TURN_PIXELS && performance.now() < until);
      await nextFrame();
    }
  });
  turn = mine.catch(() => {});
  return mine;
}
/** (In a tab out of sight no frame comes: it goes on without.) */
const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    if (document.hidden) resolve();
    else {
      const late = setTimeout(resolve, 100);
      requestAnimationFrame(() => {
        clearTimeout(late);
        resolve();
      });
    }
  });
/** The site serves WebP copies of the delivered PNGs. */
const webp = (file: string): string => file.replace(/\.png$/i, '.webp');

/**
 * A cast whose files are here but not yet decoded. The destination's files can download while another scene
 * is still on show. They are decoded once the scene goes on the plate and the old scene has rested. The two sets are never in memory
 * together: that is what keeps the page inside a phone's budget.
 */
type Decode<T> = () => Promise<T>;

/** A character whose every pose is one image (scene 1): the whole drawing, or the part of it that differs from another. */
async function frameCast(config: SceneConfig, cast: FrameCast, host: SceneHost): Promise<Decode<Cast>> {
  let names = [...cast.frames];
  let routine: () => Schedule;
  if (cast.routine.kind === 'manifest') {
    const manifest = await json<RoutineManifest>(config.assets + cast.dir + cast.routine.file);
    const problems = checkRoutine(manifest);
    if (problems.length) throw new Error(`${config.id}: ${cast.routine.file}: ${problems.join(' ')}`);
    names = [...new Set([...names, ...routineFrames(manifest)])];
    routine = () => routineSchedule(manifest, host.rnd);
  } else {
    const { schedule } = cast.routine;
    routine = () => schedule(host.rnd);
  }
  // A narrow screen gets the lighter copy of the folder, if the scene has one.
  const light = cast.small && host.shownWidth() < cast.small.below ? cast.small.dir : null;
  // The drawing she rests on (and the one under it, should it be a patch): she is painted on it. The rest come later.
  const fetchRest = async (folder: string): Promise<string> => {
    await Promise.all(restPoses(cast, folder).map((name) => fetchFrame(asset(`${config.assets}${folder}${name}.webp`))));
    return folder;
  };
  const dir = await (light ? fetchRest(light).catch(() => fetchRest(cast.dir)) : fetchRest(cast.dir));
  const urlOf = (name: string): string => asset(`${config.assets}${dir}${name}.webp`);
  const rest = restPoses(cast, dir);
  const later = names.filter((name) => !rest.includes(name));
  const cut = cast.patches?.[dir] ?? {};
  return async () => {
    // Every pose's file that has been asked for, the rest pose first: the order they are brought back in after a sleep.
    const files = new Map(rest.map((name) => [name, urlOf(name)]));
    const decoded = new FrameStore();
    let character: Character;
    const put = (pose: string, frame: Frame): void => {
      if (pose in cut) character.addPatch(pose, { ...cut[pose], frame, still: true });
      else character.add(pose, frame);
    };
    try {
      const poses = await Promise.all(rest.map(async (name) => [name, await decoded.load(files.get(name)!)] as const));
      character = new Character(new Map(poses.filter(([name]) => !(name in cut))), cast);
      for (const [name, frame] of poses) if (name in cut) put(name, frame);
    } catch (error) {
      decoded.releaseExcept(new Set());
      throw error;
    }
    let reaction: Reaction | null = null;
    let loading: Promise<void> | null = null;
    let awake = true;
    let generation = 0;
    const loadPose = async (pose: string, url: string, at: number): Promise<void> => {
      files.set(pose, url);
      const frame = await decoded.load(url);
      if (at === generation && awake && !character.has(pose)) put(pose, frame);
    };
    let stocked = later.length === 0;
    let stocking: { by: AbortSignal; done: Promise<void> } | null = null;
    const download = async (by: AbortSignal): Promise<void> => {
      if (!stocked) await Promise.all(later.map((name) => requiredAsset(() => fetchFrame(urlOf(name), by))));
    };
    const stock = async (by: AbortSignal): Promise<void> => {
      const at = generation;
      const active = (): boolean => awake && generation === at && !by.aborted;
      const missing = later.filter((name) => !character.has(name));
      // (One that cannot be fetched this way: an <img> tries, as it is decoded.)
      const here = missing.map((name) => requiredAsset(() => fetchFrame(urlOf(name), by)).catch(() => {}));
      for (let i = 0; i < missing.length; i += BATCH) {
        const batch = missing.slice(i, i + BATCH);
        await Promise.all(here.slice(i, i + BATCH));
        if (!active()) return;
        for (const name of batch) files.set(name, urlOf(name));
        const frames = await Promise.all(batch.map((name) => decoded.load(urlOf(name))));
        await quietly(frames, (n) => void (character.has(batch[n]) || put(batch[n], frames[n])), active);
        if (!active()) return;
      }
      stocked = names.every((name) => character.has(name));
    };
    return {
      character,
      routine,
      stocked: () => stocked,
      download,
      stock: (by) => {
        if (stocked || !awake || by.aborted) return Promise.resolve();
        if (stocking?.by !== by) {
          const mine = { by, done: stock(by).finally(() => void (stocking === mine && (stocking = null))) };
          stocking = mine;
        }
        return stocking.done;
      },
      reacts: true,
      keeps: true,
      // (Not while her frames are still coming back after a sleep: she would skip the ones not there yet.)
      reaction: () => (reaction && reaction.steps.every((step) => character.has(step.pose)) ? reaction : null),
      still: [],
      more: (reactions) => {
        if (!cast.reaction || !reactions || !awake || reaction) return Promise.resolve();
        const at = generation;
        const active = (): boolean => awake && generation === at;
        loading ??= loadReaction(config.assets, dir + cast.reaction, active, (pose, url) => loadPose(pose, url, at))
          .then((ready) => {
            if (active() && ready) reaction = ready;
          }, (error) => {
            if (active()) console.warn(`[hjaas] ${config.id}: reaction frames unavailable; finds still count`, error);
          })
          .finally(() => {
            if (active()) loading = null;
          });
        return loading;
      },
      sleep: (keepShown = true) => {
        awake = false;
        generation++;
        loading = null;
        stocking = null;
        const keep = new Set(keepShown ? character.showing : []);
        const kept = new Set([...keep].map((name) => files.get(name)).filter((url): url is string => url !== undefined));
        for (const name of files.keys()) {
          if (keep.has(name)) continue;
          if (name in cut) character.dropPatch(name, true);
          else character.drop(name);
        }
        decoded.releaseExcept(kept);
        character.sleep();
      },
      wake: () => {
        if (awake) return Promise.resolve();
        awake = true;
        const at = generation;
        void (async () => {
          for (const [name, url] of files) {
            if (at !== generation) return;
            if (character.has(name)) continue;
            await loadPose(name, url, at).catch(() => {});
          }
        })();
        return Promise.resolve();
      },
      memory: () => ({ ...character.bytes, clipFrames: 0, clipFramesPeak: 0, canvasWidth: character.sourceWidth }),
    };
  };
}

/** A character delivered as stills and clips of patches (scene 2; see clips.ts and reel.ts). */
async function clipCast(config: SceneConfig, cast: ClipCast, host: SceneHost): Promise<Decode<Cast>> {
  const dir = config.assets + cast.dir;
  // A narrow screen gets the lighter set of the same frames, if the scene has one.
  const light = cast.small && host.shownWidth() < cast.small.below ? config.assets + cast.small.dir : null;
  let art = light ?? dir;
  const [frames, routine] = await Promise.all([
    json<ClipFrames>(art + cast.frames).catch((error) => {
      if (!light) throw error;
      art = dir;
      return json<ClipFrames>(dir + cast.frames);
    }),
    json<ClipRoutine>(dir + cast.routine),
  ]);
  const problems = checkClips(frames, routine);
  if (problems.length) throw new Error(`${config.id}: ${problems.join(' ')}`);
  return actorCast(config.id, frames, routine, host, (file, priority, by) => fetchBlob(asset(art + webp(file)), priority, by), { keeps: true });
}

/**
 * A whole cast delivered in one package (scene 3; see cast.ts): every actor is played by the same code as the
 * lab's Rachel, each from its own share of the two manifests. Bottom to top.
 */
async function troupe(config: SceneConfig, cast: Troupe, host: SceneHost): Promise<Decode<CastList>> {
  const dir = config.assets + cast.dir;
  const [frames, routines] = await Promise.all([json<CastFrames>(dir + cast.frames), json<CastRoutines>(dir + cast.routine)]);
  const { actors, problems, screen, progress, progressFade, walkers } = splitCast(frames, routines, PLATE.w);
  if (problems.length) throw new Error(`${config.id}: ${problems.join(' ')}`);
  const lead = leadOf(actors);
  const load: LoadFile = (file, priority, by) => fetchBlob(asset(dir + webp(file)), priority, by);
  const fetched = await Promise.all(
    actors.map((actor) => actorCast(`${config.id}, ${actor.name}`, actor.frames, actor.routine, host, load, { keeps: false, className: actor === lead ? 'hj-rachel' : 'hj-actor', name: actor.name })),
  );
  // A live screen shows a part of the plate: the plate's file once more (from the browser's cache), to cut
  // that part from when the scene goes on the plate.
  const plate = screen ? await fetchBlob(asset(config.assets + config.plate)).catch(() => null) : null;
  // The hunt's progress pieces and the walkers' files: downloaded now, decoded when the scene goes on.
  const pieceFiles = await Promise.all(progress.map((piece) => load(piece.file)));
  const walkFiles = await Promise.all(
    walkers.map(async (walker) => ({
      walker,
      track: await json<TrackFile>(dir + walker.track),
      files: {
        sprites: new Map(await Promise.all(Object.entries(walker.sprites).map(async ([name, file]) => [name, await load(file)] as const))),
        mask: walker.mask ? await load(walker.mask) : null,
        bodyMask: walker.bodyMask ? await load(walker.bodyMask) : null,
      },
    })),
  );
  return async () => {
    const [results, backdrop] = await Promise.all([
      Promise.allSettled(fetched.map((decode) => decode())),
      screen && plate ? decodePart(plate, screen.source) : null,
    ]);
    const casts: CastList = [];
    let failure: PromiseRejectedResult | undefined;
    for (const result of results) {
      if (result.status === 'fulfilled') casts.push(result.value);
      else failure ??= result;
    }
    if (failure) {
      for (const actor of casts) actor.sleep(false);
      backdrop?.close();
      throw failure.reason;
    }
    const holder = screen ? actors.findIndex((actor) => actor.name === screen.actor) : -1;
    if (screen && holder >= 0) {
      casts[holder].screen = screen;
      casts[holder].backdrop = backdrop;
    } else backdrop?.close();
    if (progress.length) casts.progress = new Progress(progress, pieceFiles, progressFade, () => host.found.size);
    if (walkFiles.length) casts.walks = walkFiles.map(({ walker, track, files }) => new Walk(walker, track, files, frames.canvas, host.rnd, host.still));
    return casts;
  };
}

type LoadFile = (file: string, priority?: RequestInit['priority'], signal?: AbortSignal) => Promise<Blob>;

/** The poses that must be here for a character to be drawn on her rest pose: it, and the drawing under it if it is a patch. */
function restPoses(cast: FrameCast, folder: string): string[] {
  const base = cast.patches?.[folder]?.[cast.rest]?.base;
  return base ? [cast.rest, base] : [cast.rest];
}

/** One actor from her two manifests: the still she rests on now, the others after it, her clips when asked. */
async function actorCast(
  id: string,
  frames: ClipFrames,
  routine: ClipRoutine,
  host: SceneHost,
  load: LoadFile,
  options: { keeps: boolean; className?: string; name?: string },
): Promise<Decode<Cast>> {
  // The stills first: they are all she needs to start her routine, and they stay decoded while the scene
  // is on show. Their files are kept, so they can be decoded again after a sleep. Only the stills the
  // routine, the blinks and the reaction ever show: a package may carry others (a pose for a later routine).
  const names = stillsInUse(frames, routine);
  const rest = restOf(frames, routine);
  // Most are whole drawings; some are only the part that differs from one (clips.ts, `patches`).
  const cut = frames.patches ?? {};
  // Before all the others, the one she rests on (and the one under it): she is painted on it.
  const first = names.filter((name) => name === rest || name === cut[rest]?.base);
  const stillFiles: Array<Promise<Blob> | undefined> = names.map(() => undefined);
  const stillFile = (i: number, by?: AbortSignal): Promise<Blob> => {
    const here = stillFiles[i];
    if (here) return here;
    const file = requiredAsset(() => load(frames.stills[names[i]], undefined, by));
    stillFiles[i] = file;
    const forget = (): void => {
      if (stillFiles[i] === file) stillFiles[i] = undefined;
    };
    // (Called off: whoever asks for it next starts afresh.)
    by?.addEventListener('abort', forget, { once: true });
    void file.then(() => by?.removeEventListener('abort', forget), forget);
    return file;
  };
  await Promise.all(first.map((name) => stillFile(names.indexOf(name))));
  return async () => {
    const stills: Array<Frame | null> = names.map(() => null);
    const results = await Promise.allSettled(first.map(async (name) => {
      const i = names.indexOf(name);
      stills[i] = await stillFile(i).then(decodeBlob);
    }));
    for (const result of results) {
      if (result.status === 'fulfilled') continue;
      for (const frame of stills) if (frame) releaseFrame(frame);
      throw result.reason;
    }
    const c = frames.canvas;
    const character = new Character(new Map(names.flatMap((name, i) => (name in cut || !stills[i] ? [] : [[name, stills[i]] as const]))), {
      rest,
      placement: { kind: 'box', x: c.plate_x, y: c.plate_y, width: c.plate_w, height: c.plate_h },
      size: { w: c.w, h: c.h },
      fine: frames.patches !== undefined,
      className: options.className,
    });
    const put = (i: number, frame: Frame): void => {
      const name = names[i];
      stills[i] = frame;
      if (name in cut) character.addPatch(name, { ...cut[name], frame, still: true });
      else character.add(name, frame);
    };
    names.forEach((name, i) => {
      if (name in cut && stills[i]) put(i, stills[i]);
    });
    if (options.name) character.el.dataset.actor = options.name;

    // Then the clips, when asked: the routine's own, then the reaction's. They are only downloaded here;
    // the reel decodes each frame shortly before it is shown.
    const reel = new Reel(character);
    reel.wake();
    let awake = true;
    let generation = 0;
    const loaded = new Set<string>();
    const inUse = clipsInUse(routine);
    const fetching = new Map<string, Promise<void>>();
    const offsets = new Map<string, number>();
    const fetchClip = (name: string, active: () => boolean): Promise<void> => {
      if (loaded.has(name)) return Promise.resolve();
      const pending = fetching.get(name);
      if (pending) return pending;
      const clip = frames.clips[name];
      const task = (async () => {
        for (let i = offsets.get(name) ?? 0; i < clip.frames.length; i++) {
          await idle();
          if (!active()) return;
          const blob = await load(clip.frames[i], 'low');
          if (!active()) return;
          reel.add(clipPose(name, i), { blob, base: clip.base, x: clip.x, y: clip.y });
          offsets.set(name, i + 1);
        }
        loaded.add(name);
      })();
      const handled = task.catch((error) => {
        if (active()) console.warn(`[hjaas] ${id}: the clip "${name}" could not be loaded; she keeps to her stills`, error);
      }).finally(() => {
        if (fetching.get(name) === handled) fetching.delete(name);
      });
      fetching.set(name, handled);
      return handled;
    };
    let stocked = names.every((_, i) => stills[i] !== null);
    let stocking: { by: AbortSignal; done: Promise<void> } | null = null;
    /** Her stills being decoded again after a sleep. */
    let waking: Promise<void> = Promise.resolve();
    const stock = async (by: AbortSignal): Promise<void> => {
      const at = generation;
      const active = (): boolean => awake && generation === at && !by.aborted;
      names.forEach((name, i) => void (character.has(name) || stillFile(i, by).catch(() => {})));
      await waking;
      const missing = [...names.keys()].filter((i) => !character.has(names[i]));
      for (let from = 0; from < missing.length; from += BATCH) {
        const batch = missing.slice(from, from + BATCH);
        const blobs = await Promise.all(batch.map((i) => stillFile(i, by)));
        if (!active()) return;
        const decoded = await Promise.allSettled(blobs.map(decodeBlob));
        const frames = decoded.flatMap((each) => (each.status === 'fulfilled' ? [each.value] : []));
        if (frames.length < batch.length || !active()) {
          frames.forEach(releaseFrame);
          if (active()) throw new Error('a drawing could not be decoded');
          return;
        }
        let n = 0;
        await quietly(frames, (each) => {
          n = each + 1;
          if (character.has(names[batch[each]])) releaseFrame(frames[each]);
          else put(batch[each], frames[each]);
        }, active);
        // (She went out of sight meanwhile, or is wanted elsewhere: what was not put in place is given back.)
        for (; n < frames.length; n++) releaseFrame(frames[n]);
        if (!active()) return;
      }
      stocked = names.every((name) => character.has(name));
    };
    const full = clipReaction(frames, routine);
    // A reaction can start at any moment, so its clip frames stay decoded while the scene is on show.
    const reactionFrames = [...new Set((full?.steps ?? []).map((step) => step.pose).filter((pose) => !(pose in frames.stills)))];
    return {
      character,
      stocked: () => stocked,
      download: async (by) => {
        if (!stocked) await Promise.all(names.map((_, i) => stillFile(i, by)));
      },
      stock: (by) => {
        if (stocked || !awake || by.aborted) return Promise.resolve();
        if (stocking?.by !== by) {
          const mine = { by, done: stock(by).finally(() => void (stocking === mine && (stocking = null))) };
          stocking = mine;
        }
        return stocking.done;
      },
      routine: () => clipSchedule(frames, routine, host.rnd, (name) => loaded.has(name)),
      reacts: full !== null,
      keeps: options.keeps,
      // The full reaction needs every clip: its own, decoded, and the routine's for the way back from writing.
      reaction: () =>
        full && [...inUse.routine, ...inUse.reaction].every((name) => loaded.has(name)) && reel.ready(reactionFrames) && names.every((name) => character.has(name))
          ? full
          : null,
      still: full?.still ?? [],
      entry: clipEntry(routine),
      more: async (reactions) => {
        const at = generation;
        const active = (): boolean => awake && at === generation;
        for (const name of inUse.routine) {
          if (!active()) return;
          await fetchClip(name, active);
        }
        if (!active() || !reactions || !full) return;
        reel.pin(reactionFrames);
        for (const name of inUse.reaction) {
          if (!active()) return;
          await fetchClip(name, active);
        }
      },
      ahead: (poses) => reel.want(poses),
      sleep: (keepShown = true) => {
        awake = false;
        generation++;
        fetching.clear();
        stocking = null;
        if (keepShown) reel.sleep();
        else reel.release();
        const keep = new Set(keepShown && options.keeps ? character.showing : []);
        names.forEach((name, i) => {
          if (keep.has(name) || !character.has(name)) return;
          if (name in cut) character.dropPatch(name, true);
          else {
            character.drop(name);
            const frame = stills[i];
            if (frame) releaseFrame(frame);
          }
          stills[i] = null;
        });
        character.sleep();
      },
      wake: () => {
        if (awake) return Promise.resolve();
        awake = true;
        const at = generation;
        // The frame her canvas needs comes back first (and the still under it): until it has, she cannot be drawn.
        const needed = new Set(character.showing);
        const order = [...names.keys()].sort((a, b) => Number(needed.has(names[b])) - Number(needed.has(names[a])));
        const last = Math.max(0, names.filter((name) => needed.has(name)).length - 1);
        let shown: () => void = () => {};
        const back = new Promise<void>((resolve) => (shown = resolve));
        waking = (async () => {
          try {
            for (const i of order) {
              if (at !== generation) return;
              if (!character.has(names[i])) {
                // (Not those still to be downloaded: stock() brings them.)
                const file = needed.has(names[i]) || stocked ? stillFile(i) : null;
                const frame = file && await file.then(decodeBlob).catch(() => null);
                if (!frame) continue;
                // She went out of sight again while this one was being decoded.
                if (at !== generation) {
                  releaseFrame(frame);
                  return;
                }
                put(i, frame);
              }
              if (i === order[last]) shown();
            }
            if (at === generation) reel.wake();
          } finally {
            shown();
          }
        })();
        return options.keeps ? Promise.resolve() : back;
      },
      memory: () => ({ ...character.bytes, clipFrames: reel.bytes, clipFramesPeak: reel.peak, canvasWidth: c.w }),
    };
  };
}

export class Scene {
  readonly config: SceneConfig;
  /** The scene's coordinate system: children are placed in percentages of 1672 × 941. */
  readonly plate: HTMLDivElement;
  readonly hunt: Hunt;
  /**
   * The character the scene is about, and who answers a find: the only one, or the lead of a cast. Null
   * until her frames are on the plate (see enter()), and for a scene with no character.
   */
  character: Character | null = null;
  player: Player | null = null;
  /**
   * Where a first-visit painting's sheet of paper goes: straight after this. Everything in the picture is under
   * it, and so painted together: the room, the mushrooms, the character and the rest of her cast. Over it: only
   * the painting's edge.
   */
  readonly mark: Comment = document.createComment('sheet');
  private readonly host: SceneHost;
  /** The room's picture, and its address: a scene out of sight lets go of the decoded picture (see rest()). */
  private readonly room: HTMLImageElement;
  private readonly roomSrc: string;
  /** The painting's edge: always the plate's top layer. Drawn while the scene is on show (see dress()). */
  private readonly edge: Edge;
  private readonly layout: ResizeObserver;
  /** Everyone on the plate, bottom to top, each with their own player; `cast` is the lead among them. */
  private casts: Cast[] = [];
  private readonly players = new Map<Cast, Player>();
  /** Those whose routine has been given them, now that their drawings are here (see stock()). */
  private readonly begun = new Set<Cast>();
  private cast: Cast | null = null;
  /** The live screen one of the cast holds, if the scene has one. */
  private finder: Viewfinder | null = null;
  /** Their first frames' files being fetched. (They are decoded when the scene goes on the plate: see Decode.) */
  private casting: Promise<Decode<CastList> | null> | null = null;
  /** The hunt's progress, shown in the picture (the theatre's backdrop), if the scene has it. */
  private progress: Progress | null = null;
  /** Its walkers (the stagehand), if it has any. */
  private walks: Walk[] = [];
  /** Her drawings still to be downloaded (see stock()) are called off by this: the visitor has asked for another scene. */
  private fetching = new AbortController();
  private paused = false;
  /** The scene has settled: loadMore() has been asked for. */
  private settled = false;
  /** The room's picture is being decoded again. */
  private readying: Promise<unknown> | null = null;
  /** She is being put on the plate. */
  private entering: Promise<void> | null = null;
  private soft = false;
  private reacting: Promise<void> = Promise.resolve();
  private working = false;
  private generation = 0;
  private destroyed = false;

  private constructor(config: SceneConfig, host: SceneHost, plate: HTMLDivElement, room: HTMLImageElement, hunt: Hunt, edge: Edge) {
    this.config = config;
    this.host = host;
    this.plate = plate;
    this.room = room;
    this.roomSrc = room.src;
    this.hunt = hunt;
    this.edge = edge;
    // Bottom to top: the room, her shadow, the mushrooms, the character (or her cast), a first-visit painting's
    // sheet of paper, and over them all the painting's edge.
    plate.append(hunt.el, this.mark, this.edge.el);

    this.layout = new ResizeObserver(() => {
      if (!plate.clientWidth) return;
      // One plate pixel in CSS pixels. Only changes on resize, never during animation.
      plate.style.setProperty('--u', `${plate.clientWidth / PLATE.w}px`);
      hunt.layout(plate.clientWidth / PLATE.w);
      for (const cast of this.casts) cast.character.resize();
      this.finder?.resize();
      host.onLayout();
    });
    this.layout.observe(plate);
  }

  /**
   * Downloads and decodes the plate and the mushrooms, with the edge's files alongside. `withCharacter` fetches and
   * decodes the drawing she rests on as well, and draws the edge (the opening scene); otherwise they are left until the
   * scene is first opened (see enter() and dress()), so that a scene nobody has visited yet costs only its plate.
   */
  static async load(config: SceneConfig, host: SceneHost, withCharacter: boolean): Promise<Scene> {
    const roomImage = loadPlate(config.assets + config.plate);
    const art = Hunt.art(config.spots);
    art.catch(() => {});
    const edge = makeEdge(host.edge.style, host.edge.seed(edgeName(config)), host.edge.paper, config.lines && config.assets + config.lines, config.keep);
    // (The opening scene: nothing else is on show, so its frames are decoded as soon as they are here.)
    const cast = withCharacter
      ? Scene.castFor(config, host).then((decode) => decode?.() ?? null).catch((error) => {
          console.warn(`[hjaas] ${config.id}: the character could not be loaded; the room is shown without her`, error);
          return null;
        })
      : null;

    const plate = document.createElement('div');
    plate.className = 'hj-plate';
    plate.dataset.scene = config.id;
    const discardCast = (): void => {
      void cast?.then((ready) => { if (ready) releaseCastList(ready); });
    };
    const room = await roomImage.catch((error) => {
      discardCast();
      throw error;
    });
    room.className = 'hj-room';
    room.alt = '';
    room.draggable = false;
    room.width = PLATE.w;
    room.height = PLATE.h;
    plate.append(room);

    let made: Scene | undefined;
    let drawn: HuntArt;
    try {
      drawn = await art;
    } catch (error) {
      room.removeAttribute('src');
      discardCast();
      throw error;
    }
    const hunt = new Hunt({
      spots: config.spots,
      edge: edgeAlpha(host.edge.style, host.edge.seed(edgeName(config)), config.keep),
      plate,
      flyLayer: host.flyLayer,
      found: host.found,
      target: host.target,
      // The host counts the find first; then the picture shows the hunt's progress (the backdrop's next swath,
      // fading in as she answers).
      onFind: (spot: Spot) => {
        host.onFind(spot);
        made?.progressed();
      },
      onLand: host.onLand,
    }, drawn);
    const scene = new Scene(config, host, plate, room, hunt, edge);
    made = scene;
    // The opening scene's edge is needed at once; any other scene's is made when it is opened (see dress()).
    const [ready] = await Promise.all([cast, withCharacter ? scene.dress().catch(() => {}) : null]);
    if (ready) {
      scene.attach(ready);
      await scene.progress?.wake().catch(() => {});
    }
    return scene;
  }

  private static async castFor(config: SceneConfig, host: SceneHost): Promise<Decode<CastList> | null> {
    const cast = config.character;
    if (!cast) return null;
    if (cast.kind === 'cast') return troupe(config, cast, host);
    const one = await (cast.kind === 'clips' ? clipCast(config, cast, host) : frameCast(config, cast, host));
    return async () => [await one()];
  }

  syncFinds(): void {
    this.hunt.syncFinds();
    this.progressed();
  }

  /** A mushroom of this scene was found (the host has counted it): the picture shows the hunt's progress. */
  private progressed(): void {
    this.progress?.reach();
  }

  /**
   * Fetch her first frames once the visitor asks for this scene, while the current picture can stay up.
   */
  preload(): void {
    if (this.cast || this.casting || !this.config.character) return;
    this.casting = Scene.castFor(this.config, this.host);
    // If it fails (the network), the next call tries again; enter() reports it.
    this.casting.catch(() => {
      this.casting = null;
      this.entering = null;
    });
  }

  /**
   * The scene is on the page, or about to be: put the character on the plate as soon as her first frames
   * are decoded. Resolves when she is there. The first time this fetches them (unless preload() already
   * has); after that it resolves at once. (Before a first-visit painting the sheet is on the plate already,
   * and she goes under it.)
   */
  enter(): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    this.paused = false;
    // A scene come back to: its frames are decoded again while the brush is still at work. (A cast that kept
    // nothing can be drawn again once each actor's rest frame is back.)
    const back = Promise.all([...this.casts.map((cast) => cast.wake()), this.progress?.wake(), ...this.walks.map((walk) => walk.wake())]).then(() => {});
    if (this.character || !this.config.character) return back;
    this.preload();
    const at = this.generation;
    this.entering ??= this.casting!
      .then((decode) => decode?.() ?? null)
      .then(async (casts) => {
        if (at !== this.generation) {
          if (casts) releaseCastList(casts);
          return;
        }
        if (casts && !this.character) this.attach(casts);
        // The progress pieces the hunt has reached are drawn before the scene shows, and the walkers' pictures decoded.
        await Promise.all([this.progress?.wake(), ...this.walks.map((walk) => walk.wake())]);
      }).catch((error) => {
        if (at === this.generation) {
          this.entering = null;
          this.casting = null;
        }
        throw error;
      });
    return this.entering;
  }

  /** Resolves when her first frames' files are here (they are decoded, and she is put on the plate, by enter()). */
  loaded(): Promise<void> {
    if (this.cast || !this.config.character) return Promise.resolve();
    this.preload();
    return this.casting!.then(() => {});
  }

  /**
   * Her other drawings (and the rest of her cast's), which the first painting does not need: downloaded, then decoded and
   * rehearsed a few at a time in quiet moments, while the brush is at work. When an actor has all of hers her routine
   * starts; until then she holds her rest pose. Resolves when that is done, or called off (see pause()).
   */
  async stock(): Promise<void> {
    if (this.paused || this.destroyed) return;
    const { signal } = this.fetching;
    const at = this.generation;
    // (Not in the brush's first frame.)
    await idle();
    if (signal.aborted || at !== this.generation) return;
    const lead = this.cast;
    for (const { character } of this.casts) character.painting = !this.working;
    await Promise.all(
      [...this.casts].sort((a, b) => Number(b === lead) - Number(a === lead)).map(async (cast) => {
        if (this.begun.has(cast)) return;
        try {
          await cast.stock(signal);
        } catch (error) {
          if (!signal.aborted) console.warn(`[hjaas] ${this.config.id}: some drawings could not be loaded; she stays as she is`, error);
        }
        // (Once, however many have waited for it.)
        if (!cast.stocked() || at !== this.generation || this.begun.has(cast)) return;
        this.begun.add(cast);
        const player = this.players.get(cast);
        // (Already at work, holding still: out of step with the others from here, as they would have been.)
        if (this.working && cast !== lead) player?.delay(this.host.rnd() * 900);
        player?.setLoop(this.rhythm(cast));
      }),
    );
  }

  /** Only the downloading of what stock() decodes. */
  private download(): void {
    if (this.paused) return;
    const { signal } = this.fetching;
    const lead = this.cast;
    for (const cast of [...this.casts].sort((a, b) => Number(b === lead) - Number(a === lead))) void cast.download(signal).catch(() => {});
  }

  /** Another scene has been asked for: this one's drawings still to come wait, so that the tap has the network. (Clips go on, as before.) */
  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.fetching.abort();
    this.fetching = new AbortController();
  }

  /** The visitor stays after all: carry on downloading. */
  resume(): void {
    if (!this.paused || this.destroyed) return;
    this.paused = false;
    if (this.settled) void this.loadMore();
    else void this.stock();
  }

  /** She is arriving after the picture is already on show (a slow network): let her fade in. */
  arriveSoftly(): void {
    this.soft = true;
  }

  private attach(casts: CastList): void {
    const lead = leadOf(casts);
    if (!lead) return;
    this.casts = casts;
    this.cast = lead;
    this.character = lead.character;
    // The hunt's progress lies on the room, under the mushrooms; the walkers over it, under the cast.
    if (casts.progress) {
      this.progress = casts.progress;
      this.plate.insertBefore(casts.progress.el, this.hunt.el);
    }
    for (const walk of casts.walks ?? []) {
      this.walks.push(walk);
      this.plate.insertBefore(walk.el, this.mark);
      void walk.wake();
    }
    casts.forEach((cast) => {
      const { character } = cast;
      if (character.shadow) this.plate.insertBefore(character.shadow, this.hunt.el);
      this.plate.insertBefore(character.el, this.mark);
      const player = new Player(character, this.rhythm(cast));
      player.onStep = (step) => cast.ahead?.(step.soon ?? []);
      player.entry = cast.entry ?? null;
      this.players.set(cast, player);
      character.resize();
      if (this.soft) character.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
    });
    this.player = this.players.get(lead)!;
    if (this.host.onPose) this.player.onPose = this.host.onPose;
    // The walkers keep time on the lead's player's frames.
    if (this.walks.length) {
      const walks = this.walks;
      this.player.onFrame = (now) => {
        for (const walk of walks) walk.frame(now);
      };
    }
    // A live screen: it shows the room and whoever is drawn before the actor who holds it, and its
    // recording dot keeps time on her player's own frames.
    const holder = casts.find((cast) => cast.screen);
    if (holder?.screen) {
      const finder = new Viewfinder(holder.screen, holder.character, casts.slice(0, casts.indexOf(holder)).map((cast) => cast.character), holder.backdrop ?? null, this.host.still);
      this.finder = finder;
      this.players.get(holder)!.onFrame = (now) => finder.frame(now);
    }
    this.stagger();
    this.download();
    // The scene was set to work before she arrived.
    if (this.working) this.work();
  }

  /** The rest of a cast start out of step: each one's first move is put off by a different part of a second. */
  private stagger(): void {
    for (const [cast, player] of this.players) if (cast !== this.cast) player.delay(this.host.rnd() * 900);
  }

  /**
   * Everything the painting will uncover has been drawn once: every still that is here of every actor (her others are
   * rehearsed as they come: see stock()), and the hunt's progress. Await it under the blank sheet, before a first-visit painting's clock starts, so
   * that none of it is left to be done in the painting's own frames. (The scene must be on the page.)
   */
  async drawn(): Promise<void> {
    await Promise.all([this.progress?.wake(), ...this.walks.map((walk) => walk.wake())]);
    for (const cast of this.casts) await cast.character.rehearse();
  }

  get total(): number {
    return this.config.spots.length;
  }

  /** Start, or carry on with, the idle routine. Nothing runs while the tab is hidden. */
  work(): void {
    if (this.destroyed) return;
    this.working = true;
    for (const cast of this.casts) {
      cast.character.painting = false;
      void cast.wake();
    }
    if (!document.hidden) for (const player of this.players.values()) player.start();
  }

  /** Stop on the current pose (the visitor is leaving for another scene). work() carries on from it. */
  hold(): void {
    this.working = false;
    for (const player of this.players.values()) player.stop();
  }

  /**
   * The scene is out of sight (off the page, or under a copy of itself that the brush is rubbing away):
   * give back its decoded images. Only the visible scene keeps any: the two together are more than an
   * older phone will give one page. What comes back, and when: the room's picture in ready(), the edge in
   * dress(), her frames from enter() on. All from files already downloaded.
   */
  rest(): void {
    if (this.destroyed) return;
    this.generation++;
    this.entering = null;
    this.settled = false;
    this.pause();
    for (const cast of this.casts) {
      // An actor who keeps nothing while out of sight goes back to her rest pose, and starts afresh from it.
      if (!cast.keeps) this.restart(cast);
      cast.sleep();
    }
    this.finder?.sleep();
    this.progress?.sleep();
    for (const walk of this.walks) walk.sleep();
    this.stagger();
    this.room.removeAttribute('src');
    this.readying = null;
    this.edge.release();
  }

  /** The scene is about to go on the page: resolves when its room's picture is decoded again. */
  async ready(): Promise<void> {
    if (!this.room.getAttribute('src')) this.readying = requiredAsset(() => loadImage(this.roomSrc, this.room));
    // (Asked for again while it is still being decoded: the same wait.)
    await this.readying;
  }

  /**
   * Draw the painting's edge: resolves when it is complete (at once if it already is). It is worked out
   * afresh each time the scene comes back, a few milliseconds at a time, which takes less of the page's
   * time than keeping it would take of its memory. Call it once the scene being left has rested, and
   * before anything of this one can be seen: until its edge is drawn, a plate shows right to its rim.
   */
  dress(): Promise<void> {
    return this.destroyed ? Promise.resolve() : this.edge.make();
  }

  /**
   * Copy the edge as it is drawn onto another canvas, over a plate at this rectangle. False, and nothing
   * drawn, while the edge is not all there (see dress()).
   */
  edgeOnto(ctx: CanvasRenderingContext2D, left: number, top: number, width: number, height: number): boolean {
    if (!this.edge.whole) return false;
    this.edge.draw(ctx, left, top, width, height);
    return true;
  }

  /**
   * Stop and go back to the rest pose, dropping any reaction (the room is about to be painted again). Her
   * routine then starts from the top: carried on from the middle of a clip, it would jump.
   */
  settle(): void {
    this.working = false;
    for (const cast of this.casts) this.restart(cast);
    this.stagger();
  }

  private restart(cast: Cast): void {
    const player = this.players.get(cast);
    player?.settle();
    player?.setLoop(this.rhythm(cast));
  }

  /** QA: ask for clip frames by name, as a step of her routine would (she must be stopped, or she asks again). */
  ahead(poses: readonly string[]): void {
    this.cast?.ahead?.(poses);
  }

  /** QA: what this scene's decoded images and canvases take, in bytes, from their sizes. */
  get memory(): Record<string, number> {
    const hers = { stills: 0, canvases: 0, clipFrames: 0, clipFramesPeak: 0, canvasWidth: 0 };
    for (const cast of this.casts) {
      const m = cast.memory?.();
      if (!m) continue;
      for (const key of ['stills', 'canvases', 'clipFrames', 'clipFramesPeak'] as const) hers[key] += m[key] ?? 0;
      if (cast === this.cast) hers.canvasWidth = m.canvasWidth ?? 0;
    }
    hers.canvases += (this.finder?.bytes ?? 0) + (this.progress?.bytes ?? 0) + this.walks.reduce((sum, walk) => sum + walk.bytes, 0);
    return { ...hers, room: this.room.getAttribute('src') ? PLATE.w * PLATE.h * 4 : 0, edge: this.edge.bytes };
  }

  /** The tab was hidden or shown: she picks up on the same pose when it comes back. */
  visibility(): void {
    if (!this.working) return;
    for (const player of this.players.values()) {
      if (document.hidden) player.stop();
      else player.start();
    }
  }

  finishMotion(resetRoutine: boolean): void {
    for (const [cast, player] of this.players) {
      if (resetRoutine || player.reacting) player.finishMotion(this.rhythm(cast), resetRoutine, this.working && !document.hidden);
    }
    this.progress?.finishMotion();
    if (resetRoutine) {
      for (const walk of this.walks) walk.frame(performance.now());
      this.finder?.frame(performance.now());
    }
  }

  /** Pause, play, or a change of the reduced-motion setting: takes effect at each one's next step. */
  refresh(): void {
    for (const [cast, player] of this.players) player.setLoop(this.rhythm(cast));
    this.finder?.draw();
  }

  /**
   * A mushroom was found: she reacts, if this scene has a reaction and it has loaded. If she is already
   * reacting, that reaction carries on and its promise is returned (a scene may ask for the held look to be
   * held again from now: `again` in its config).
   */
  react(): Promise<void> {
    if (!this.player || !this.cast || document.hidden) return Promise.resolve();
    if (this.player.reacting) {
      // A second find while she is still answering the first: she holds the look a while longer.
      if (this.config.again === 'hold') this.player.prolong();
      return this.reacting;
    }
    const reaction = this.cast.reaction();
    // Still (paused, reduced motion, or the reaction's frames not here yet): one held pose acknowledges the
    // find, without the head and arm travel.
    const full = reaction !== null && !this.host.still();
    const steps = full ? (reaction.roll?.(this.host.rnd) ?? reaction.steps) : (reaction?.still ?? this.cast.still);
    // (The find counts. She answers it only with drawings that are here.)
    const { character } = this.cast;
    if (steps.length === 0 || (!full && !steps.every((step) => character.has(step.pose)))) return Promise.resolve();
    // A scene may have her answer at once, from whatever pose she is in (`answer` in its config).
    this.reacting = this.player.react(steps, this.config.answer === 'at-once', full);
    return this.reacting;
  }

  get reactingNow(): boolean {
    return this.player?.reacting ?? false;
  }

  /**
   * Fetches what the first showing did not need: her clips, and the reaction's frames. One image at a time,
   * in quiet moments, so it is called once the scene has settled. (A scene with every mushroom found never
   * reacts, so the reaction's frames are not fetched for it.)
   */
  async loadMore(): Promise<void> {
    const at = this.generation;
    this.settled = true;
    if (!this.cast) await this.entering?.catch(() => {});
    if (at !== this.generation || this.paused) return;
    const { signal } = this.fetching;
    await this.stock();
    if (at !== this.generation || signal.aborted) return;
    // The lead's first: hers are the clips that matter.
    const reactions = this.hunt.remaining > 0;
    await this.cast?.more(reactions);
    for (const cast of this.casts) {
      if (at !== this.generation) return;
      if (cast !== this.cast) await cast.more(reactions);
    }
  }

  /**
   * Copy the scene, as it looks now, onto another canvas: the sheet the brush rubs away when the visitor
   * leaves for another scene. `origin` is that canvas's place on the page; the context works in CSS px. `left`: what
   * still lies over it, if its painting was left part way.
   */
  sketch(ctx: CanvasRenderingContext2D, origin: DOMRect, left?: Sheets): void {
    const { room } = this;
    const r = this.plate.getBoundingClientRect();
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(room, r.left - origin.left, r.top - origin.top, r.width, r.height);
    this.progress?.sketch(ctx, origin);
    for (const walk of this.walks) {
      if (!walk.el.width) continue;
      const w = walk.el.getBoundingClientRect();
      ctx.drawImage(walk.el, w.left - origin.left, w.top - origin.top, w.width, w.height);
    }
    this.hunt.sketch(ctx, origin);
    for (const cast of this.casts) cast.character.sketch(ctx, origin);
    this.finder?.sketch(ctx, origin);
    // Its painting was left part way: the sheet still over it, in its place under the edge, and the pencil's veil over that.
    const over = (canvas: HTMLCanvasElement | null | undefined): void => {
      if (canvas) ctx.drawImage(canvas, r.left - origin.left, r.top - origin.top, r.width, r.height);
    };
    if (!left?.overWindow) over(left?.sheet);
    // A pixel wider all round, so no sliver of the room shows where the two drawings' rims meet.
    this.edge.draw(ctx, r.left - origin.left - 1, r.top - origin.top - 1, r.width + 2, r.height + 2);
    over(left?.veil);
    // A brush-over's sheet is as large as the window, which is what is being drawn on.
    if (left?.overWindow && left.sheet) ctx.drawImage(left.sheet, 0, 0, origin.width, origin.height);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.generation++;
    this.working = false;
    this.layout.disconnect();
    for (const player of this.players.values()) player.settle();
    for (const actor of this.casts) {
      actor.sleep(false);
      actor.backdrop?.close();
    }
    this.finder?.sleep();
    this.progress?.sleep();
    for (const walk of this.walks) walk.sleep();
    this.room.removeAttribute('src');
    this.edge.release();
    this.hunt.destroy();
    this.plate.remove();
    this.plate.replaceChildren();
    this.casts = [];
    this.walks = [];
    this.players.clear();
    this.character = this.cast = this.player = this.finder = this.progress = null;
    this.casting = this.entering = null;
    this.fetching.abort();
  }

  private rhythm(cast: Cast): Schedule {
    return this.host.still() || !cast.stocked() ? holdSchedule(cast.character.rest) : cast.routine();
  }
}

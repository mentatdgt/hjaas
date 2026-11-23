// One scene, built from its config: the plate, the character on it, and the ten hidden mushrooms.
// A scene knows nothing about the page around it; site.ts puts it in the window and takes it out again.
import { PLATE, asset, decodeBlob, decodePart, fetchBlob, fetchFrame, idle, loadFrame, loadPlate, releaseFrame, unloadFrame } from './assets';
import { leadOf, splitCast, type CastFrames, type CastRoutines, type CastScreen } from './cast';
import { Character } from './character';
import { edgeAlpha, edgeName, makeEdge, type Edge, type EdgeStyle } from './edge';
import { checkClips, clipPose, clipReaction, clipSchedule, clipsInUse, restOf, stillsInUse, type ClipFrames, type ClipRoutine } from './clips';
import { Hunt } from './mushrooms';
import { Player, type Schedule } from './player';
import { Reel } from './reel';
import { loadReaction, type Reaction } from './reaction';
import { Viewfinder } from './screen';
import { Progress } from './progress';
import { Walk, type TrackFile } from './walk';
import { checkRoutine, routineFrames, routineSchedule, type RoutineManifest } from './routine';
import { holdSchedule, type Rng, type Step } from './steps';
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

/** A character ready to go on the plate, and what is still to be fetched for her. A scene has one, or a whole cast of them. */
interface Cast {
  character: Character;
  routine: () => Schedule;
  /** She answers a mushroom find. */
  reacts: boolean;
  /**
   * The reaction, once it can be played in full. Until then `still` stands in, if there is one. `roll`,
   * when it is there, gives the steps afresh each time (times that are ranges, a blink that may or may not come).
   */
  reaction: () => (Pick<Reaction, 'steps' | 'still'> & { roll?: (rnd?: Rng) => Step[] }) | null;
  still: Reaction['still'];
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
  sleep: () => void;
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

const json = async <T>(path: string): Promise<T> => {
  const response = await fetch(asset(path));
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return (await response.json()) as T;
};
/** The site serves WebP copies of the delivered PNGs. */
const webp = (file: string): string => file.replace(/\.png$/i, '.webp');

/**
 * A cast whose files are here but not yet decoded. A scene's files are fetched as soon as it looks as if it
 * will be opened, while another scene is still on show; they are decoded only when the scene goes on the
 * plate, after the one being left has given its own decoded frames back. The two sets are never in memory
 * together: that is what keeps the page inside a phone's budget.
 */
type Decode<T> = () => Promise<T>;

/** A character whose every pose is one whole image (scene 1). */
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
  const fetchAll = async (folder: string): Promise<string> => {
    await Promise.all(names.map((name) => fetchFrame(asset(`${config.assets}${folder}${name}.webp`))));
    return folder;
  };
  const dir = await (light ? fetchAll(light).catch(() => fetchAll(cast.dir)) : fetchAll(cast.dir));
  // Every pose's file, routine first: the order they are brought back in after a sleep.
  const files = new Map(names.map((name) => [name, asset(`${config.assets}${dir}${name}.webp`)]));
  return async () => {
    const frames = await Promise.all(names.map((name) => loadFrame(files.get(name)!)));
    const character = new Character(new Map(names.map((name, i) => [name, frames[i]])), cast);
    let reaction: Reaction | null = null;
    let loading: Promise<void> | null = null;
    let awake = true;
    return {
      character,
      routine,
      reacts: true,
      keeps: true,
      // (Not while her frames are still coming back after a sleep: she would skip the ones not there yet.)
      reaction: () => (reaction && reaction.steps.every((step) => character.has(step.pose)) ? reaction : null),
      still: [],
      more: (reactions) => {
        if (!cast.reaction || !reactions) return Promise.resolve();
        loading ??= loadReaction(character, config.assets, dir + cast.reaction).then(
          (ready) => {
            reaction = ready;
            for (const [pose, url] of ready.files) files.set(pose, url);
          },
          (error) => console.warn(`[hjaas] ${config.id}: reaction frames unavailable; finds still count`, error),
        );
        return loading;
      },
      sleep: () => {
        awake = false;
        const keep = new Set(character.showing);
        const kept = new Set([...keep].map((name) => files.get(name)));
        for (const name of files.keys()) if (!keep.has(name)) character.drop(name);
        // One file can stand for two poses (a reaction frame that is also a routine frame).
        for (const url of new Set(files.values())) if (!kept.has(url)) unloadFrame(url);
        character.sleep();
      },
      wake: () => {
        if (awake) return Promise.resolve();
        awake = true;
        void (async () => {
          for (const [name, url] of files) {
            if (!awake) return;
            if (character.has(name)) continue;
            const frame = await loadFrame(url).catch(() => null);
            // She went out of sight again while this one was being decoded: sleep() has dealt with it.
            if (!awake) return;
            if (frame) character.add(name, frame);
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
  return actorCast(config.id, frames, routine, host, (file) => fetchBlob(asset(art + webp(file))), { keeps: true });
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
  const load = (file: string): Promise<Blob> => fetchBlob(asset(dir + webp(file)));
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
    const [casts, backdrop] = await Promise.all([
      Promise.all(fetched.map((decode) => decode())) as Promise<CastList>,
      screen && plate ? decodePart(plate, screen.source) : null,
    ]);
    const holder = screen ? actors.findIndex((actor) => actor.name === screen.actor) : -1;
    if (screen && holder >= 0) {
      casts[holder].screen = screen;
      casts[holder].backdrop = backdrop;
    }
    if (progress.length) casts.progress = new Progress(progress, pieceFiles, progressFade, () => host.found.size);
    if (walkFiles.length) casts.walks = walkFiles.map(({ walker, track, files }) => new Walk(walker, track, files, frames.canvas, host.rnd, host.still));
    return casts;
  };
}

/** One actor from her two manifests: her stills' files now, her clips' when asked. */
async function actorCast(
  id: string,
  frames: ClipFrames,
  routine: ClipRoutine,
  host: SceneHost,
  load: (file: string) => Promise<Blob>,
  options: { keeps: boolean; className?: string; name?: string },
): Promise<Decode<Cast>> {
  // The stills first: they are all she needs to start her routine, and they stay decoded while the scene
  // is on show. Their files are kept, so they can be decoded again after a sleep. Only the stills the
  // routine, the blinks and the reaction ever show: a package may carry others (a pose for a later routine).
  const names = stillsInUse(frames, routine);
  const stillFiles = await Promise.all(names.map((name) => load(frames.stills[name])));
  return async () => {
    const stills = await Promise.all(stillFiles.map(decodeBlob));
    const c = frames.canvas;
    const rest = restOf(frames, routine);
    const character = new Character(new Map(names.map((name, i) => [name, stills[i]])), {
      rest,
      placement: { kind: 'box', x: c.plate_x, y: c.plate_y, width: c.plate_w, height: c.plate_h },
      size: { w: c.w, h: c.h },
      className: options.className,
    });
    if (options.name) character.el.dataset.actor = options.name;

    // Then the clips, when asked: the routine's own, then the reaction's. They are only downloaded here;
    // the reel decodes each frame shortly before it is shown.
    const reel = new Reel(character);
    reel.wake();
    let awake = true;
    const loaded = new Set<string>();
    const inUse = clipsInUse(routine);
    const fetching = new Map<string, Promise<void>>();
    const fetchClip = (name: string): Promise<void> => {
      let pending = fetching.get(name);
      if (!pending) {
        pending = (async () => {
          const clip = frames.clips[name];
          for (let i = 0; i < clip.frames.length; i++) {
            await idle();
            reel.add(clipPose(name, i), { blob: await load(clip.frames[i]), base: clip.base, x: clip.x, y: clip.y });
          }
          loaded.add(name);
        })();
        fetching.set(name, pending);
        pending.catch((error) => {
          fetching.delete(name);
          console.warn(`[hjaas] ${id}: the clip "${name}" could not be loaded; she keeps to her stills`, error);
        });
      }
      return pending;
    };
    const full = clipReaction(frames, routine);
    // A reaction can start at any moment, so its clip frames stay decoded while the scene is on show.
    const reactionFrames = [...new Set((full?.steps ?? []).map((step) => step.pose).filter((pose) => !(pose in frames.stills)))];
    return {
      character,
      routine: () => clipSchedule(frames, routine, host.rnd, (name) => loaded.has(name)),
      reacts: full !== null,
      keeps: options.keeps,
      // The full reaction needs every clip: its own, decoded, and the routine's for the way back from writing.
      reaction: () =>
        full && [...inUse.routine, ...inUse.reaction].every((name) => loaded.has(name)) && reel.ready(reactionFrames) && names.every((name) => character.has(name))
          ? full
          : null,
      still: full?.still ?? [],
      more: async (reactions) => {
        for (const name of inUse.routine) await fetchClip(name).catch(() => {});
        if (!reactions || !full) return;
        reel.pin(reactionFrames);
        for (const name of inUse.reaction) await fetchClip(name).catch(() => {});
      },
      ahead: (poses) => reel.want(poses),
      sleep: () => {
        awake = false;
        reel.sleep();
        const keep = new Set(options.keeps ? character.showing : []);
        names.forEach((name, i) => {
          if (keep.has(name) || !character.has(name)) return;
          character.drop(name);
          releaseFrame(stills[i]);
        });
        character.sleep();
      },
      wake: () => {
        if (awake) return Promise.resolve();
        awake = true;
        // The frame her canvas needs comes back first: until it has, she cannot be drawn.
        const order = [...names.keys()].sort((a, b) => Number(names[b] === character.current) - Number(names[a] === character.current));
        let shown: () => void = () => {};
        const back = new Promise<void>((resolve) => (shown = resolve));
        void (async () => {
          try {
            for (const i of order) {
              if (!awake) return;
              if (!character.has(names[i])) {
                const frame = await decodeBlob(stillFiles[i]).catch(() => null);
                if (!frame) continue;
                // She went out of sight again while this one was being decoded.
                if (!awake) {
                  releaseFrame(frame);
                  return;
                }
                stills[i] = frame;
                character.add(names[i], frame);
              }
              if (i === order[0]) shown();
            }
            if (awake) reel.wake();
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
   * Where a first-visit painting's sheet of paper goes: straight after this. Under the sheet, and so painted
   * with the room: the room, the mushrooms and the actors of a cast drawn before its lead. Over it: the lead
   * and whoever is drawn after her, who come in when the painting is done.
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
  private cast: Cast | null = null;
  /** The live screen one of the cast holds, if the scene has one. */
  private finder: Viewfinder | null = null;
  /** Their first frames' files being fetched. (They are decoded when the scene goes on the plate: see Decode.) */
  private casting: Promise<Decode<CastList> | null> | null = null;
  /** The hunt's progress, shown in the picture (the theatre's backdrop), if the scene has it. */
  private progress: Progress | null = null;
  /** Its walkers (the stagehand), if it has any. */
  private walks: Walk[] = [];
  /** She is being put on the plate. */
  private entering: Promise<void> | null = null;
  private soft = false;
  private reacting: Promise<void> = Promise.resolve();
  private working = false;

  private constructor(config: SceneConfig, host: SceneHost, plate: HTMLDivElement, room: HTMLImageElement, hunt: Hunt) {
    this.config = config;
    this.host = host;
    this.plate = plate;
    this.room = room;
    this.roomSrc = room.src;
    this.hunt = hunt;
    // Bottom to top: the room, her shadow, the mushrooms, (the actors of a cast drawn before its lead,
    // a first-visit painting's sheet of paper,) the character, and over them all the painting's edge.
    this.edge = makeEdge(host.edge.style, host.edge.seed(edgeName(config)), host.edge.paper, config.lines && config.assets + config.lines, config.keep);
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
   * Downloads and decodes the plate and the mushrooms. `withCharacter` fetches her first frames alongside
   * (the opening scene); otherwise they are left until the scene is first opened (see enter()), so that a
   * scene nobody has visited yet costs only its plate.
   */
  static async load(config: SceneConfig, host: SceneHost, withCharacter: boolean): Promise<Scene> {
    const plateSrc = loadPlate(config.assets + config.plate);
    // (The opening scene: nothing else is on show, so its frames are decoded as soon as they are here.)
    const cast = withCharacter ? Scene.castFor(config, host).then((decode) => decode?.() ?? null) : null;

    const plate = document.createElement('div');
    plate.className = 'hj-plate';
    plate.dataset.scene = config.id;
    const room = document.createElement('img');
    room.className = 'hj-room';
    room.alt = '';
    room.draggable = false;
    room.width = PLATE.w;
    room.height = PLATE.h;
    room.src = await plateSrc;
    await room.decode().catch(() => {});
    plate.append(room);

    let made: Scene | undefined;
    const hunt = await Hunt.create({
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
    });
    const scene = new Scene(config, host, plate, room, hunt);
    made = scene;
    // The opening scene's edge is needed at once; any other scene's is made when it is opened (see dress()).
    const [ready] = await Promise.all([cast, withCharacter ? scene.dress() : null]);
    if (ready) {
      scene.attach(ready);
      await scene.progress?.wake();
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

  /** A mushroom of this scene was found (the host has counted it): the picture shows the hunt's progress. */
  private progressed(): void {
    this.progress?.reach();
  }

  /**
   * Start fetching her first frames' files, without decoding them or putting her on the plate: called as
   * soon as it looks as if the scene will be opened (the pointer is on its tab), so the wait at the tap is
   * short.
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
   * has); after that it resolves at once. `hidden` puts her there unseen, for a painting to bring her in.
   */
  enter(options: { hidden?: boolean } = {}): Promise<void> {
    // A scene come back to: its frames are decoded again while the brush is still at work. (A cast that kept
    // nothing can be drawn again once each actor's rest frame is back.)
    const back = Promise.all([...this.casts.map((cast) => cast.wake()), this.progress?.wake(), ...this.walks.map((walk) => walk.wake())]).then(() => {});
    if (this.character || !this.config.character) return back;
    this.preload();
    this.entering ??= this.casting!
      .then((decode) => decode?.() ?? null)
      .then(async (casts) => {
        if (casts && !this.character) this.attach(casts, options.hidden === true);
        // The progress pieces the hunt has reached are drawn before the scene shows, and the walkers' pictures decoded.
        await Promise.all([this.progress?.wake(), ...this.walks.map((walk) => walk.wake())]);
      });
    return this.entering;
  }

  /** Resolves when her first frames' files are here (they are decoded, and she is put on the plate, by enter()). */
  loaded(): Promise<void> {
    if (this.cast || !this.config.character) return Promise.resolve();
    this.preload();
    return this.casting!.then(() => {});
  }

  /** She is arriving after the picture is already on show (a slow network): let her fade in. */
  arriveSoftly(): void {
    this.soft = true;
  }

  private attach(casts: CastList, hidden = false): void {
    const lead = leadOf(casts);
    if (!lead) return;
    this.casts = casts;
    this.cast = lead;
    this.character = lead.character;
    const leadAt = casts.indexOf(lead);
    // The hunt's progress lies on the room, under the mushrooms; the walkers over it, under the cast. Both are
    // painted with the room.
    if (casts.progress) {
      this.progress = casts.progress;
      this.plate.insertBefore(casts.progress.el, this.hunt.el);
    }
    for (const walk of casts.walks ?? []) {
      this.walks.push(walk);
      this.plate.insertBefore(walk.el, this.mark);
      void walk.wake();
    }
    casts.forEach((cast, i) => {
      const { character } = cast;
      // The lead, and whoever is drawn over her, stay above a painting's sheet; the rest are painted with the room.
      const front = i >= leadAt;
      if (hidden && front) {
        character.el.style.opacity = '0';
        if (character.shadow) character.shadow.style.opacity = '0';
      }
      if (character.shadow) this.plate.insertBefore(character.shadow, this.hunt.el);
      this.plate.insertBefore(character.el, front ? this.edge.el : this.mark);
      const player = new Player(character, this.rhythm(cast));
      player.onStep = (step) => cast.ahead?.(step.soon ?? []);
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
    // The scene was set to work before she arrived.
    if (this.working) this.work();
  }

  /** The rest of a cast start out of step: each one's first move is put off by a different part of a second. */
  private stagger(): void {
    for (const [cast, player] of this.players) if (cast !== this.cast) player.delay(this.host.rnd() * 900);
  }

  /**
   * What a first-visit painting brings in when it is done: the lead, her shadow, and anyone drawn over her.
   * (The rest of a cast is under the sheet, and painted with the room.)
   */
  get entrance(): HTMLElement[] {
    const from = this.cast ? this.casts.indexOf(this.cast) : 0;
    return this.casts.slice(from).flatMap(({ character }) => (character.shadow ? [character.el, character.shadow] : [character.el]));
  }

  get total(): number {
    return this.config.spots.length;
  }

  /** Start, or carry on with, the idle routine. Nothing runs while the tab is hidden. */
  work(): void {
    this.working = true;
    for (const cast of this.casts) void cast.wake();
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
    this.edge.release();
  }

  /** The scene is about to go on the page: resolves when its room's picture is decoded again. */
  async ready(): Promise<void> {
    if (this.room.getAttribute('src')) return;
    this.room.src = this.roomSrc;
    await this.room.decode().catch(() => {});
  }

  /**
   * Draw the painting's edge: resolves when it is complete (at once if it already is). It is worked out
   * afresh each time the scene comes back, a few milliseconds at a time, which takes less of the page's
   * time than keeping it would take of its memory. Call it once the scene being left has rested, and
   * before anything of this one can be seen: until its edge is drawn, a plate shows right to its rim.
   */
  dress(): Promise<void> {
    return this.edge.make();
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
    if (!this.player || !this.cast) return Promise.resolve();
    if (this.player.reacting) {
      // A second find while she is still answering the first: she holds the look a while longer.
      if (this.config.again === 'hold') this.player.prolong();
      return this.reacting;
    }
    const reaction = this.cast.reaction();
    // Still (paused, reduced motion, or the reaction's frames not here yet): one held pose acknowledges the
    // find, without the head and arm travel.
    const steps = reaction && !this.host.still() ? (reaction.roll?.(this.host.rnd) ?? reaction.steps) : (reaction?.still ?? this.cast.still);
    if (steps.length === 0) return Promise.resolve();
    // A scene may have her answer at once, from whatever pose she is in (`answer` in its config).
    this.reacting = this.player.react(steps, this.config.answer === 'at-once');
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
    // The lead's first: hers are the clips that matter.
    const reactions = this.hunt.remaining > 0;
    await this.cast?.more(reactions);
    for (const cast of this.casts) if (cast !== this.cast) await cast.more(reactions);
  }

  /**
   * Copy the scene, as it looks now, onto another canvas: the sheet the brush rubs away when the visitor
   * leaves for another scene. `origin` is that canvas's place on the page; the context works in CSS px.
   */
  sketch(ctx: CanvasRenderingContext2D, origin: DOMRect): void {
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
    // A pixel wider all round, so no sliver of the room shows where the two drawings' rims meet.
    this.edge.draw(ctx, r.left - origin.left - 1, r.top - origin.top - 1, r.width + 2, r.height + 2);
  }

  destroy(): void {
    for (const player of this.players.values()) player.stop();
    this.layout.disconnect();
    this.plate.remove();
  }

  private rhythm(cast: Cast): Schedule {
    return this.host.still() ? holdSchedule(cast.character.rest) : cast.routine();
  }
}

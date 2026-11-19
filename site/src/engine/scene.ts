// One scene, built from its config: the plate, the character on it, and the ten hidden mushrooms.
// A scene knows nothing about the page around it; site.ts puts it in the window and takes it out again.
import { PLATE, asset, decodeBlob, fetchBlob, idle, loadFrames, loadPlate } from './assets';
import { Character } from './character';
import { edgeAlpha, edgeCanvas, type EdgeStyle } from './edge';
import { checkClips, clipPose, clipReaction, clipSchedule, clipsInUse, type ClipFrames, type ClipRoutine } from './clips';
import { Hunt } from './mushrooms';
import { Player, type Schedule } from './player';
import { Reel } from './reel';
import { loadReaction, type Reaction } from './reaction';
import { checkRoutine, routineFrames, routineSchedule, type RoutineManifest } from './routine';
import { holdSchedule, type Rng } from './steps';
import type { ClipCast, FrameCast, SceneConfig, Spot } from './types';

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

/** A character ready to go on the plate, and what is still to be fetched for her. */
interface Cast {
  character: Character;
  routine: () => Schedule;
  /** The reaction, once it can be played in full. Until then `still` stands in, if there is one. */
  reaction: () => Reaction | null;
  still: Reaction['still'];
  /**
   * Fetches what the first showing did not need (clips, reaction frames), one image at a time in quiet
   * moments. `reactions: false` leaves out what only a reaction uses.
   */
  more: (reactions: boolean) => Promise<void>;
  /** The poses that may be shown soon (see steps.ts). Only a character with a reel listens. */
  ahead?: (poses: readonly string[]) => void;
  /** The scene is on show, or out of sight: a reel decodes its frames, or gives them back. */
  wake?: () => void;
  sleep?: () => void;
  /** QA: decoded image memory, in bytes. */
  memory?: () => Record<string, number>;
}

const json = async <T>(path: string): Promise<T> => {
  const response = await fetch(asset(path));
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return (await response.json()) as T;
};
/** The site serves WebP copies of the delivered PNGs. */
const webp = (file: string): string => file.replace(/\.png$/i, '.webp');

/** A character whose every pose is one whole image (scene 1). */
async function frameCast(config: SceneConfig, cast: FrameCast, host: SceneHost): Promise<Cast> {
  const dir = config.assets + cast.dir;
  let names = [...cast.frames];
  let routine: () => Schedule;
  if (cast.routine.kind === 'manifest') {
    const manifest = await json<RoutineManifest>(dir + cast.routine.file);
    const problems = checkRoutine(manifest);
    if (problems.length) throw new Error(`${config.id}: ${cast.routine.file}: ${problems.join(' ')}`);
    names = [...new Set([...names, ...routineFrames(manifest)])];
    routine = () => routineSchedule(manifest, host.rnd);
  } else {
    const { schedule } = cast.routine;
    routine = () => schedule(host.rnd);
  }
  const character = new Character(await loadFrames(dir, names), cast);
  let reaction: Reaction | null = null;
  let loading: Promise<void> | null = null;
  return {
    character,
    routine,
    reaction: () => reaction,
    still: [],
    more: (reactions) => {
      if (!cast.reaction || !reactions) return Promise.resolve();
      loading ??= loadReaction(character, config.assets, cast.dir + cast.reaction).then(
        (loaded) => void (reaction = loaded),
        (error) => console.warn(`[hjaas] ${config.id}: reaction frames unavailable; finds still count`, error),
      );
      return loading;
    },
  };
}

/** A character delivered as stills and clips of patches (scene 2; see clips.ts and reel.ts). */
async function clipCast(config: SceneConfig, cast: ClipCast, host: SceneHost): Promise<Cast> {
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
  const load = (file: string): Promise<Blob> => fetchBlob(asset(art + webp(file)));

  // The stills first: they are all she needs to start her routine, and they stay decoded.
  const names = Object.keys(frames.stills);
  const stills = await Promise.all(names.map((name) => load(frames.stills[name]).then(decodeBlob)));
  const c = frames.canvas;
  const character = new Character(new Map(names.map((name, i) => [name, stills[i]])), {
    rest: routine.reaction?.enter_from ?? names[0],
    placement: { kind: 'box', x: c.plate_x, y: c.plate_y, width: c.plate_w, height: c.plate_h },
  });

  // Then the clips, when asked: the routine's own, then the reaction's. They are only downloaded here;
  // the reel decodes each frame shortly before it is shown.
  const reel = new Reel(character);
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
        console.warn(`[hjaas] ${config.id}: the clip "${name}" could not be loaded; she keeps to her stills`, error);
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
    // The full reaction needs every clip: its own, decoded, and the routine's for the way back from writing.
    reaction: () => (full && [...inUse.routine, ...inUse.reaction].every((name) => loaded.has(name)) && reel.ready(reactionFrames) ? full : null),
    still: full?.still ?? [],
    more: async (reactions) => {
      for (const name of inUse.routine) await fetchClip(name).catch(() => {});
      if (!reactions) return;
      reel.pin(reactionFrames);
      for (const name of inUse.reaction) await fetchClip(name).catch(() => {});
    },
    ahead: (poses) => reel.want(poses),
    wake: () => reel.wake(),
    sleep: () => reel.sleep(),
    memory: () => ({ ...character.bytes, clipFrames: reel.bytes, clipFramesPeak: reel.peak, canvasWidth: c.w }),
  };
}


export class Scene {
  readonly config: SceneConfig;
  /** The scene's coordinate system: children are placed in percentages of 1672 × 941. */
  readonly plate: HTMLDivElement;
  readonly hunt: Hunt;
  /** Null until her frames are on the plate (see enter()), and for a scene with no character. */
  character: Character | null = null;
  player: Player | null = null;
  private readonly host: SceneHost;
  /** The painting's soft edge: always the plate's top layer. */
  private readonly edge: HTMLCanvasElement;
  private readonly layout: ResizeObserver;
  private cast: Cast | null = null;
  /** Her first frames being fetched and decoded. */
  private casting: Promise<Cast | null> | null = null;
  /** She is being put on the plate. */
  private entering: Promise<void> | null = null;
  private soft = false;
  private reacting: Promise<void> = Promise.resolve();
  private working = false;

  private constructor(config: SceneConfig, host: SceneHost, plate: HTMLDivElement, hunt: Hunt) {
    this.config = config;
    this.host = host;
    this.plate = plate;
    this.hunt = hunt;
    // Bottom to top: the room, her shadow, the mushrooms, (a first-visit painting's sheet of paper,) the
    // character, and over them all the painting's soft edge.
    this.edge = edgeCanvas(host.edge.style, host.edge.seed(config.id), host.edge.paper);
    plate.append(hunt.el, this.edge);

    this.layout = new ResizeObserver(() => {
      if (!plate.clientWidth) return;
      // One plate pixel in CSS pixels. Only changes on resize, never during animation.
      plate.style.setProperty('--u', `${plate.clientWidth / PLATE.w}px`);
      hunt.layout(plate.clientWidth / PLATE.w);
      this.character?.resize();
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
    const cast = withCharacter ? Scene.castFor(config, host) : null;

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

    const hunt = await Hunt.create({
      spots: config.spots,
      edge: edgeAlpha(host.edge.style, host.edge.seed(config.id)),
      plate,
      flyLayer: host.flyLayer,
      found: host.found,
      target: host.target,
      onFind: host.onFind,
      onLand: host.onLand,
    });
    const scene = new Scene(config, host, plate, hunt);
    const ready = await cast;
    if (ready) scene.attach(ready);
    return scene;
  }

  private static castFor(config: SceneConfig, host: SceneHost): Promise<Cast | null> {
    const cast = config.character;
    if (!cast) return Promise.resolve(null);
    return cast.kind === 'clips' ? clipCast(config, cast, host) : frameCast(config, cast, host);
  }

  /**
   * Start fetching and decoding her first frames, without putting her on the plate: called as soon as it
   * looks as if the scene will be opened (the pointer is on its tab), so the wait at the tap is short.
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
    // A scene come back to: its clip frames are decoded again while the brush is still at work.
    this.cast?.wake?.();
    if (this.character || !this.config.character) return Promise.resolve();
    this.preload();
    this.entering ??= this.casting!.then((cast) => {
      if (cast && !this.character) this.attach(cast, options.hidden === true);
    });
    return this.entering;
  }

  /** Resolves when her first frames are fetched and decoded (she is not put on the plate by this). */
  loaded(): Promise<void> {
    if (this.cast || !this.config.character) return Promise.resolve();
    this.preload();
    return this.casting!.then(() => {});
  }

  /** She is arriving after the picture is already on show (a slow network): let her fade in. */
  arriveSoftly(): void {
    this.soft = true;
  }

  private attach(cast: Cast, hidden = false): void {
    const { character } = cast;
    this.cast = cast;
    this.character = character;
    if (hidden) {
      character.el.style.opacity = '0';
      if (character.shadow) character.shadow.style.opacity = '0';
    }
    if (character.shadow) this.plate.insertBefore(character.shadow, this.hunt.el);
    this.plate.insertBefore(character.el, this.edge);
    this.player = new Player(character, this.rhythm());
    this.player.onStep = (step) => cast.ahead?.(step.soon ?? []);
    if (this.host.onPose) this.player.onPose = this.host.onPose;
    character.resize();
    if (this.soft) character.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
    // The scene was set to work before she arrived.
    if (this.working) this.work();
  }

  get total(): number {
    return this.config.spots.length;
  }

  /** Start, or carry on with, the idle routine. Nothing runs while the tab is hidden. */
  work(): void {
    this.working = true;
    this.cast?.wake?.();
    if (!document.hidden) this.player?.start();
  }

  /**
   * Stop on the current pose (the visitor has left for another scene). work() carries on from it. Clip
   * frames held in memory are given back until then.
   */
  hold(): void {
    this.working = false;
    this.player?.stop();
    this.cast?.sleep?.();
  }

  /**
   * Stop and go back to the rest pose, dropping any reaction (the room is about to be painted again). Her
   * routine then starts from the top: carried on from the middle of a clip, it would jump.
   */
  settle(): void {
    this.working = false;
    this.player?.settle();
    this.player?.setLoop(this.rhythm());
  }

  /** QA: ask for clip frames by name, as a step of her routine would (she must be stopped, or she asks again). */
  ahead(poses: readonly string[]): void {
    this.cast?.ahead?.(poses);
  }

  /** QA: what her decoded images take, in bytes. */
  get memory(): Record<string, number> | null {
    return this.cast?.memory?.() ?? null;
  }

  /** The tab was hidden or shown: she picks up on the same pose when it comes back. */
  visibility(): void {
    if (!this.working) return;
    if (document.hidden) this.player?.stop();
    else this.player?.start();
  }

  /** Pause, play, or a change of the reduced-motion setting: takes effect at her next step. */
  refresh(): void {
    this.player?.setLoop(this.rhythm());
  }

  /**
   * A mushroom was found: she reacts, if this scene has a reaction and it has loaded. If she is already
   * reacting, that reaction carries on and its promise is returned.
   */
  react(): Promise<void> {
    if (!this.player || !this.cast) return Promise.resolve();
    if (this.player.reacting) return this.reacting;
    const reaction = this.cast.reaction();
    // Still (paused, reduced motion, or the reaction's frames not here yet): one held pose acknowledges the
    // find, without the head and arm travel.
    const steps = reaction && !this.host.still() ? reaction.steps : (reaction?.still ?? this.cast.still);
    if (steps.length === 0) return Promise.resolve();
    this.reacting = this.player.react(steps);
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
  loadMore(): Promise<void> {
    return this.cast?.more(this.hunt.remaining > 0) ?? Promise.resolve();
  }

  /**
   * Copy the scene, as it looks now, onto another canvas: the sheet the brush rubs away when the visitor
   * leaves for another scene. `origin` is that canvas's place on the page; the context works in CSS px.
   */
  sketch(ctx: CanvasRenderingContext2D, origin: DOMRect): void {
    const room = this.plate.querySelector<HTMLImageElement>('.hj-room')!;
    const r = this.plate.getBoundingClientRect();
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(room, r.left - origin.left, r.top - origin.top, r.width, r.height);
    this.hunt.sketch(ctx, origin);
    this.character?.sketch(ctx, origin);
    // A pixel wider all round, so no sliver of the room shows where the two drawings' rims meet.
    ctx.drawImage(this.edge, r.left - origin.left - 1, r.top - origin.top - 1, r.width + 2, r.height + 2);
  }

  destroy(): void {
    this.player?.stop();
    this.layout.disconnect();
    this.plate.remove();
  }

  private rhythm(): Schedule {
    const rest = this.character?.rest ?? '';
    return this.host.still() || !this.cast ? holdSchedule(rest) : this.cast.routine();
  }
}

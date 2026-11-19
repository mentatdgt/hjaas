// One scene, built from its config: the plate, the character on it, and the ten hidden mushrooms.
// A scene knows nothing about the page around it; site.ts puts it in the window and takes it out again.
import { PLATE, asset, loadFrames, loadPlate } from './assets';
import { Character } from './character';
import { Hunt } from './mushrooms';
import { Player } from './player';
import { loadReaction, type Reaction } from './reaction';
import { checkRoutine, routineFrames, routineSchedule, type RoutineManifest } from './routine';
import { holdSchedule, type Rng, type Step } from './steps';
import type { SceneConfig, Spot } from './types';

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
}

export class Scene {
  readonly config: SceneConfig;
  /** The scene's coordinate system: children are placed in percentages of 1672 × 941. */
  readonly plate: HTMLDivElement;
  readonly hunt: Hunt;
  readonly character: Character | null;
  readonly player: Player | null;
  private readonly host: SceneHost;
  private readonly routine: (() => Iterator<Step>) | null;
  private readonly layout: ResizeObserver;
  private reaction: Reaction | null = null;
  private loadingReaction: Promise<void> | null = null;
  private reacting: Promise<void> = Promise.resolve();
  private working = false;

  private constructor(
    config: SceneConfig,
    host: SceneHost,
    plate: HTMLDivElement,
    hunt: Hunt,
    character: Character | null,
    routine: (() => Iterator<Step>) | null,
  ) {
    this.config = config;
    this.host = host;
    this.plate = plate;
    this.hunt = hunt;
    this.character = character;
    this.routine = routine;
    // Bottom to top: the room, her shadow, the mushrooms, (a first-visit painting's sheet of paper,) the character.
    if (character?.shadow) plate.append(character.shadow);
    plate.append(hunt.el);
    if (character) plate.append(character.el);
    this.player = character ? new Player(character, this.rhythm()) : null;

    this.layout = new ResizeObserver(() => {
      if (!plate.clientWidth) return;
      // One plate pixel in CSS pixels. Only changes on resize, never during animation.
      plate.style.setProperty('--u', `${plate.clientWidth / PLATE.w}px`);
      character?.resize();
      host.onLayout();
    });
    this.layout.observe(plate);
  }

  /** Downloads and decodes everything the scene shows at rest. Resolves with the scene, ready to go on the page. */
  static async load(config: SceneConfig, host: SceneHost): Promise<Scene> {
    const dir = config.assets;
    const plateSrc = loadPlate(dir + config.plate);

    let character: Character | null = null;
    let routine: (() => Iterator<Step>) | null = null;
    const cast = config.character;
    if (cast) {
      let names = [...cast.frames];
      if (cast.routine.kind === 'manifest') {
        const response = await fetch(asset(dir + cast.dir + cast.routine.file));
        if (!response.ok) throw new Error(`${cast.routine.file}: ${response.status}`);
        const manifest = (await response.json()) as RoutineManifest;
        const problems = checkRoutine(manifest);
        if (problems.length) throw new Error(`${config.id}: ${cast.routine.file}: ${problems.join(' ')}`);
        names = [...new Set([...names, ...routineFrames(manifest)])];
        routine = () => routineSchedule(manifest, host.rnd);
      } else {
        const { schedule } = cast.routine;
        routine = () => schedule(host.rnd);
      }
      character = new Character(await loadFrames(dir + cast.dir, names), cast);
    }

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
      plate,
      flyLayer: host.flyLayer,
      found: host.found,
      target: host.target,
      onFind: host.onFind,
      onLand: host.onLand,
    });
    return new Scene(config, host, plate, hunt, character, routine);
  }

  get total(): number {
    return this.config.spots.length;
  }

  /** Start, or carry on with, the idle routine. Nothing runs while the tab is hidden. */
  work(): void {
    this.working = true;
    if (!document.hidden) this.player?.start();
  }

  /** Stop on the current pose (the visitor has left for another scene). work() carries on from it. */
  hold(): void {
    this.working = false;
    this.player?.stop();
  }

  /** Stop and go back to the rest pose, dropping any reaction (the room is about to be painted again). */
  settle(): void {
    this.working = false;
    this.player?.settle();
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
    if (!this.player || !this.reaction) return Promise.resolve();
    if (this.player.reacting) return this.reacting;
    // Still: one held pose acknowledges the find, without the head and arm travel.
    this.reacting = this.player.react(this.host.still() ? this.reaction.still : this.reaction.steps);
    return this.reacting;
  }

  get reactingNow(): boolean {
    return this.player?.reacting ?? false;
  }

  /**
   * Loads the reaction's frames, one at a time in quiet moments. Not needed for the first seconds, so it is
   * called once the scene has settled. (A scene with every mushroom found never reacts, so nothing is fetched.)
   */
  loadReaction(): Promise<void> {
    const cast = this.config.character;
    if (!cast?.reaction || !this.character || this.hunt.remaining === 0) return Promise.resolve();
    this.loadingReaction ??= loadReaction(this.character, this.config.assets, cast.dir + cast.reaction).then(
      (reaction) => void (this.reaction = reaction),
      (error) => console.warn(`[hjaas] ${this.config.id}: reaction frames unavailable; finds still count`, error),
    );
    return this.loadingReaction;
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
  }

  destroy(): void {
    this.player?.stop();
    this.layout.disconnect();
    this.plate.remove();
  }

  private rhythm(): Iterator<Step> {
    const rest = this.character?.rest ?? '';
    return this.host.still() || !this.routine ? holdSchedule(rest) : this.routine();
  }
}

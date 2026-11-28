// A scene's finale (job 006): when its tenth mushroom is found, Rachel leaves her routine and plays a short run of
// drawings, plain cuts each shown for its own time, ending on a pose she holds, blinking now and then.
//
// The format, as Wren delivers it in frames/finale/<name>/finale.json (npm run assets copies it, and makes a lighter
// set at three quarters of the size beside it):
//
//   plate      {x, y, w, h}: where a whole frame goes, in plate px.
//   size       [W, H]: a whole frame's own pixels. (`density`: px per plate px; only for the record.)
//   frames     [{file, ms}]: show this drawing for so long. The last is the pose she holds.
//   blink      the held pose with her eyes closed, shown for BLINK_MS every 3 to 6 s; null for none.
//   hide       the layers she replaces, by actor name (`rachel` is the scene's lead in any scene). Default ["rachel"].
//   transition "flash": the cut to the first frame comes under a quick white camera flash.
//   parts      stills: {file: file} whole frames. patches: {file: {base, x, y, w, h}}: draw `base`, then this file
//              over its rectangle (in frame px), replacing what was there; or {base, same: true}: just `base`.
//
// Nothing of it is downloaded with the scene. Its files come once the scene has six of its ten (or, for a scene already
// complete, the held pose and its blink alone), at low priority, kept as downloaded; a few frames ahead are decoded, in
// the decoder worker, and given back once shown. The held pose and the blink stay decoded while the scene is on show.
//
// `Director` is the clock and the rules (no DOM: finale.test.ts); `Finale` is the view and the memory.
import { type Frame, asset, decodeBlob, fetchBlob, frameSize, releaseFrame } from './assets';
import { Character } from './character';

export interface FinaleManifest {
  scene?: string;
  plate: { x: number; y: number; w: number; h: number };
  density?: number;
  size: [number, number];
  frames: ReadonlyArray<{ file: string; ms: number }>;
  blink?: string | null;
  hide?: readonly string[];
  transition?: 'flash' | null;
  parts?: {
    stills?: Readonly<Record<string, string>>;
    patches?: Readonly<Record<string, { base: string; x?: number; y?: number; w?: number; h?: number; same?: boolean }>>;
  };
}

/** How long a blink shows, and how long between blinks (rolled each time). */
export const BLINK_MS = 133;
export const BLINK_EVERY: readonly [number, number] = [3000, 6000];
/** A find that comes before the finale is here: she keeps her routine this long, waiting for it, at most. */
export const WAIT_MS = 3000;
/** The camera flash: up, then down. The cut comes at its peak. */
export const FLASH_UP_MS = 60;
export const FLASH_DOWN_MS = 250;
/** Finds in a scene after which its finale is fetched. */
export const FETCH_AT = 6;
/** Frames decoded ahead of the one on show. */
export const AHEAD = 3;

/**
 * What of a scene's finale to fetch: nothing yet; the whole of it (six or more found); or, for a scene that was already
 * complete when it was shown, only the held pose and its blink (`live`: its tenth was found just now, so the whole).
 */
export function fetchScope(found: number, total: number, live = false): 'none' | 'all' | 'held' {
  if (found >= total && !live) return 'held';
  return found >= FETCH_AT ? 'all' : 'none';
}

/** The base under a patch, if the file is one. */
export function baseOf(manifest: FinaleManifest, file: string): string | null {
  return manifest.parts?.patches?.[file]?.base ?? null;
}

/** The pose a frame shows: itself, or for a patch that is `same`, its base. */
export function poseOf(manifest: FinaleManifest, file: string): string {
  const patch = manifest.parts?.patches?.[file];
  return patch?.same ? patch.base : file;
}

/** The files a pose needs decoded to be drawn: its base first, if it is a patch. */
export function needs(manifest: FinaleManifest, file: string): string[] {
  const pose = poseOf(manifest, file);
  const base = baseOf(manifest, pose);
  return base && base !== pose ? [...needs(manifest, base), pose] : [pose];
}

export function heldOf(manifest: FinaleManifest): string {
  return manifest.frames[manifest.frames.length - 1].file;
}

/**
 * The order its files are downloaded in: the first frame and the held pose (each with its base), the blink, then
 * the rest in the order they are shown. `held`: the held pose and the blink only.
 */
export function fetchOrder(manifest: FinaleManifest, scope: 'all' | 'held'): string[] {
  const held = heldOf(manifest);
  const blink = manifest.blink ? [manifest.blink] : [];
  const first = scope === 'all' ? [manifest.frames[0].file] : [];
  const rest = scope === 'all' ? manifest.frames.map((f) => f.file) : [];
  return [...new Set([...first, held, ...blink, ...rest].flatMap((file) => needs(manifest, file)))];
}

export type Phase = 'routine' | 'waiting' | 'playing' | 'held';

/** What the director is told each frame about the frames being in memory. */
export interface Readiness {
  /** Paused by the visitor, or reduced motion: the held pose at once, no flash, no blinks. */
  still: boolean;
  /** Every file is downloaded and the first frame decoded. */
  playable: boolean;
  heldReady: boolean;
  blinkReady: boolean;
}

/**
 * The finale's clock and rules. Times are performance.now() values, never a count of frames. `update()` says what to
 * show now: a file, or null for her routine (the layers she replaces stay as they are).
 */
export class Director {
  phase: Phase = 'routine';
  /** A flash to start, at this time (the view starts it and clears this). */
  flashAt: number | null = null;
  private readonly frames: ReadonlyArray<{ file: string; ms: number }>;
  private readonly starts: number[];
  private readonly total: number;
  private readonly blink: string | null;
  private readonly flash: boolean;
  private readonly rnd: () => number;
  /** waiting: when the find came. playing: when the first frame shows. held: when the held pose shows. */
  private t0 = 0;
  private blinkAt = Infinity;
  private pausedAt: number | null = null;

  constructor(manifest: Pick<FinaleManifest, 'frames' | 'blink' | 'transition'>, rnd: () => number) {
    if (!manifest.frames.length) throw new Error('finale: no frames');
    this.frames = manifest.frames;
    this.starts = [];
    let at = 0;
    for (const frame of manifest.frames) {
      this.starts.push(at);
      at += Math.max(0, frame.ms);
    }
    this.total = at;
    this.blink = manifest.blink ?? null;
    this.flash = manifest.transition === 'flash';
    this.rnd = rnd;
  }

  get held(): string {
    return this.frames[this.frames.length - 1].file;
  }

  /** The tenth find has landed (or QA asks for it). */
  trigger(now: number, ready: Readiness): void {
    if (this.phase !== 'routine') return;
    if (ready.still) this.hold(now, false);
    else if (ready.playable) this.play(now);
    else if (ready.heldReady) this.hold(now, true);
    else {
      this.phase = 'waiting';
      this.t0 = now;
    }
  }

  /** A scene already complete when shown: the held pose, without the run before it. */
  complete(now: number): void {
    if (this.phase === 'held') return;
    this.hold(now, false);
  }

  /** Whatever is under way ends on the held pose (the scene is out of sight, or motion stops). */
  finish(now: number): void {
    if (this.phase === 'waiting' || this.phase === 'playing') this.hold(now, false);
    this.flashAt = null;
  }

  /** The hunt was reset: back to her routine. */
  reset(): void {
    this.phase = 'routine';
    this.flashAt = null;
    this.blinkAt = Infinity;
    this.pausedAt = null;
  }

  pause(now: number): void {
    this.pausedAt ??= now;
  }

  /** Carry on where it stopped: every time ahead moves on by the pause. */
  resume(now: number): void {
    if (this.pausedAt === null) return;
    const by = now - this.pausedAt;
    this.pausedAt = null;
    this.t0 += by;
    if (Number.isFinite(this.blinkAt)) this.blinkAt += by;
    if (this.flashAt !== null) this.flashAt += by;
  }

  get paused(): boolean {
    return this.pausedAt !== null;
  }

  /** What to show now: a file, or null for her routine. */
  update(now: number, ready: Readiness): string | null {
    if (this.phase === 'waiting') {
      if (ready.still) this.hold(now, false);
      else if (ready.playable && now - this.t0 < WAIT_MS) this.play(now);
      else if (now - this.t0 >= WAIT_MS && ready.heldReady) this.hold(now, true);
      else return null;
    }
    if (this.phase === 'playing') {
      if (ready.still) this.hold(now, false);
      else {
        const e = now - this.t0;
        if (e < 0) return null;
        if (e < this.total) return this.frames[this.index(e)].file;
        this.phase = 'held';
        this.t0 += this.total;
        this.blinkAt = this.t0 + this.roll();
      }
    }
    if (this.phase === 'held') {
      if (now < this.t0) return null;
      if (ready.still || !this.blink) return this.held;
      if (now >= this.blinkAt + BLINK_MS) this.blinkAt = now + this.roll();
      if (now >= this.blinkAt && ready.blinkReady) return this.blink;
      return this.held;
    }
    return null;
  }

  /** When the picture next changes, if nothing else does (for a timer between blinks). Infinity: never by itself. */
  nextChange(now: number): number {
    if (this.phase === 'waiting' || this.phase === 'playing') return now;
    if (this.phase === 'held') {
      if (now < this.t0) return this.t0;
      if (!this.blink) return Infinity;
      return now < this.blinkAt ? this.blinkAt : this.blinkAt + BLINK_MS;
    }
    return Infinity;
  }

  /** The frames to have decoded now, soonest first: the one due and the next few; the held pose; the blink. */
  upcoming(now: number, ahead = AHEAD): string[] {
    const list: string[] = [];
    if (this.phase === 'routine' || this.phase === 'waiting') list.push(this.frames[0].file);
    if (this.phase === 'playing') {
      const i = this.index(Math.max(0, now - this.t0));
      for (let k = i; k < Math.min(this.frames.length, i + 1 + ahead); k++) list.push(this.frames[k].file);
    }
    list.push(this.held);
    if (this.blink) list.push(this.blink);
    return [...new Set(list)];
  }

  private index(elapsed: number): number {
    let i = 0;
    while (i + 1 < this.starts.length && this.starts[i + 1] <= elapsed) i++;
    return i;
  }

  private play(now: number): void {
    this.phase = 'playing';
    if (this.flash) {
      this.flashAt = now;
      this.t0 = now + FLASH_UP_MS;
    } else this.t0 = now;
  }

  private hold(now: number, flash: boolean): void {
    this.phase = 'held';
    if (flash && this.flash) {
      this.flashAt = now;
      this.t0 = now + FLASH_UP_MS;
    } else {
      this.t0 = now;
      this.flashAt = null;
    }
    this.blinkAt = this.t0 + this.roll();
  }

  private roll(): number {
    const [a, b] = BLINK_EVERY;
    return a + this.rnd() * (b - a);
  }
}

/** Where a scene's finale is, in its config. */
export interface FinaleConfig {
  /** Its name in frames/finale/ (and for the QA switch `?finale=`). */
  name: string;
  /** Folder under the scene's assets, with a trailing slash. */
  dir: string;
  /** The lighter set, used when the picture is shown less than `below` CSS px wide. */
  small?: { dir: string; below: number };
}

export interface FinaleHost {
  rnd: () => number;
  still: () => boolean;
  shownWidth: () => number;
  /** Put her canvas on the plate, where the layer she replaces is. */
  place: (el: HTMLElement) => void;
  /** Put the flash on the plate: over the cast, under the painting's edge (and a first painting's sheet). */
  overlay: (el: HTMLElement) => void;
  /** Hide (true) or show again (false) the layers she replaces; `box` is where her frames go, in plate px. */
  cover: (on: boolean, hide: readonly string[], box: FinaleManifest['plate']) => void;
}

const webp = (file: string): string => file.replace(/\.png$/i, '.webp');

/** A scene's finale, on its plate. */
export class Finale {
  readonly config: FinaleConfig;
  private readonly host: FinaleHost;
  private readonly root: string;
  private manifest: FinaleManifest | null = null;
  private manifesting: Promise<FinaleManifest> | null = null;
  private director: Director | null = null;
  private character: Character | null = null;
  private readonly blobs = new Map<string, Blob>();
  private readonly decoded = new Map<string, { frame: Frame; bytes: number }>();
  private readonly failed = new Set<string>();
  private scope: 'none' | 'held' | 'all' = 'none';
  private fetching: AbortController | null = null;
  private decoding = false;
  /** The scene is on show (its frames may be decoded). */
  private awake = false;
  /** The scene is at work, and the tab visible: the clock runs. */
  private running = false;
  /** A trigger that came before the manifest. */
  private pendingTrigger: number | null = null;
  private pendingComplete = false;
  private covering = false;
  private shown = '';
  private raf = 0;
  private timer = 0;
  private flashEl: HTMLDivElement | null = null;
  /** The most the decoded frames have taken at one time, in bytes. */
  peak = 0;
  /** QA: every pose shown, with its time. */
  readonly log: Array<[string, number]> = [];
  /** QA: every decode, with how long it took (ms). */
  readonly decodes: Array<[string, number]> = [];

  constructor(config: FinaleConfig, sceneAssets: string, host: FinaleHost) {
    this.config = config;
    this.host = host;
    const small = config.small && host.shownWidth() < config.small.below ? config.small.dir : config.dir;
    this.root = sceneAssets + small;
  }

  get phase(): Phase {
    return this.director?.phase ?? (this.pendingTrigger !== null ? 'waiting' : this.pendingComplete ? 'held' : 'routine');
  }

  /** She is in the finale's place (her own layers hidden). */
  get covers(): boolean {
    return this.covering;
  }

  /** What the decoded frames take now, in bytes. */
  get bytes(): number {
    let sum = 0;
    for (const { bytes } of this.decoded.values()) sum += bytes;
    return sum;
  }

  get canvasBytes(): number {
    return this.character?.bytes.canvases ?? 0;
  }

  /** Fetch this much of it (never less than already asked for), at low priority. */
  want(scope: 'held' | 'all'): void {
    if (this.scope === 'all' || this.scope === scope) {
      if (!this.fetching) void this.download();
      return;
    }
    this.scope = scope;
    this.fetching?.abort();
    this.fetching = null;
    void this.download();
  }

  /** Another scene has the network: what is under way stops (want() carries on from there). */
  halt(): void {
    this.fetching?.abort();
    this.fetching = null;
  }

  /** The tenth find has landed. */
  trigger(at = performance.now()): void {
    this.want('all');
    if (!this.director) {
      this.pendingTrigger ??= at;
      return;
    }
    this.director.trigger(at, this.readiness());
    this.kick();
  }

  /** The scene was complete when shown: the held pose, as soon as it is here. */
  complete(): void {
    this.want('held');
    if (!this.director) {
      this.pendingComplete = true;
      return;
    }
    this.director.complete(performance.now());
    this.kick();
  }

  /** The hunt starts over: her own layers come back. */
  reset(): void {
    this.pendingTrigger = null;
    this.pendingComplete = false;
    this.director?.reset();
    this.flashEl?.remove();
    this.flashEl = null;
    this.apply(null);
    this.stopClock();
    this.scope = 'none';
    this.halt();
    this.tidy();
  }

  /** The scene is at work (true) or stopped (false; the tab is hidden, or another scene asked for). */
  run(on: boolean): void {
    if (on === this.running) return;
    this.running = on;
    const now = performance.now();
    if (on) {
      this.director?.resume(now);
      this.kick();
    } else {
      this.director?.pause(now);
      this.stopClock();
    }
  }

  /** Paused or reduced motion changed: takes effect now. */
  refresh(): void {
    this.kick();
  }

  /**
   * The scene is out of sight: anything under way ends on the held pose, and every decoded frame is given back
   * (the downloaded files are kept).
   */
  sleep(): void {
    this.awake = false;
    this.running = false;
    this.stopClock();
    this.flashEl?.remove();
    this.flashEl = null;
    if (this.director) {
      this.director.resume(performance.now());
      this.director.finish(performance.now());
    } else if (this.pendingTrigger !== null) {
      this.pendingTrigger = null;
      this.pendingComplete = true;
    }
    this.tidy();
    this.character?.sleep();
  }

  /** The scene is going on show: resolves when the held pose is decoded again, if she is holding it (or soon anyway). */
  wake(): Promise<void> {
    this.awake = true;
    this.character?.resize();
    void this.pump();
    if (this.phase !== 'held') return Promise.resolve();
    return this.whenReady(this.manifest ? needs(this.manifest, heldOf(this.manifest)) : null, 1200);
  }

  /** Resolves when the held pose is here (downloaded and decoded), or after `ms` anyway. */
  heldReady(ms: number): Promise<void> {
    return this.whenReady(this.manifest ? needs(this.manifest, heldOf(this.manifest)) : null, ms);
  }

  resize(): void {
    this.character?.resize();
  }

  /** Copy her onto another canvas (the sheet a brush rubs away). */
  sketch(ctx: CanvasRenderingContext2D, origin: DOMRect): void {
    if (this.covering) this.character?.sketch(ctx, origin);
  }

  /** QA: fetch everything, then play it from the top, without finding ten mushrooms. */
  async rehearse(): Promise<void> {
    this.reset();
    this.want('all');
    const manifest = await this.loadManifest();
    await this.whenReady(manifest.frames.flatMap((f) => needs(manifest, f.file)), 30_000, true);
    await this.whenReady(needs(manifest, manifest.frames[0].file), 5000);
    this.trigger();
  }

  destroy(): void {
    this.reset();
    for (const { frame } of this.decoded.values()) releaseFrame(frame);
    this.decoded.clear();
    this.blobs.clear();
    this.character?.sleep();
    this.character?.el.remove();
    this.character = null;
  }

  private readiness(): Readiness {
    const m = this.manifest;
    const ready = (file: string | null | undefined): boolean => !!m && !!file && needs(m, file).every((f) => this.decoded.has(f));
    const all = !!m && fetchOrder(m, 'all').every((f) => this.blobs.has(f) || this.failed.has(f));
    return {
      still: this.host.still(),
      playable: all && ready(m?.frames[0].file),
      heldReady: ready(m ? heldOf(m) : null),
      blinkReady: ready(m?.blink),
    };
  }

  private loadManifest(): Promise<FinaleManifest> {
    // (Low priority, like its frames.)
    this.manifesting ??= fetchBlob(asset(`${this.root}finale.json`), 'low').then(async (blob) => JSON.parse(await blob.text()) as FinaleManifest).then((manifest) => {
      this.manifest = manifest;
      this.director = new Director(manifest, this.host.rnd);
      if (this.pendingComplete) this.director.complete(performance.now());
      if (this.pendingTrigger !== null) this.director.trigger(this.pendingTrigger, this.readiness());
      this.pendingComplete = false;
      this.pendingTrigger = null;
      return manifest;
    }).catch((error) => {
      this.manifesting = null;
      throw error;
    });
    return this.manifesting;
  }

  private async download(): Promise<void> {
    if (this.scope === 'none' || this.fetching) return;
    const control = new AbortController();
    this.fetching = control;
    const { signal } = control;
    try {
      const manifest = await this.loadManifest();
      this.kick();
      const order = fetchOrder(manifest, this.scope === 'all' ? 'all' : 'held');
      // Two at a time, in order: the first frame and the held pose come first.
      let next = 0;
      const lane = async (): Promise<void> => {
        while (next < order.length && !signal.aborted) {
          const file = order[next++];
          if (this.blobs.has(file) || this.failed.has(file)) continue;
          try {
            const blob = await fetchBlob(asset(this.root + webp(manifest.parts?.stills?.[file] ?? file)), 'low', signal);
            this.blobs.set(file, blob);
            void this.pump();
            this.kick();
          } catch (error) {
            if (signal.aborted) return;
            // She never shows this one: the frame before it stays up a little longer.
            this.failed.add(file);
            console.warn(`[hjaas] the finale's "${file}" could not be fetched`, error);
          }
        }
      };
      await Promise.all([lane(), lane()]);
    } catch (error) {
      if (!signal.aborted) console.warn('[hjaas] the finale could not be fetched; she keeps her routine', error);
    } finally {
      if (this.fetching === control) this.fetching = null;
    }
  }

  /** The files to have decoded now, soonest first (each pose's base before it). */
  private wanted(): string[] {
    const m = this.manifest;
    if (!m || !this.awake) return [];
    const now = performance.now();
    const list = this.director ? this.director.upcoming(now) : [m.frames[0].file, heldOf(m), ...(m.blink ? [m.blink] : [])];
    // Before the finale is asked for, and only the held pose fetched: nothing else.
    const files = (this.scope === 'all' || this.phase !== 'routine') ? list : [];
    const keep = files.flatMap((file) => needs(m, file));
    if (this.shown) keep.unshift(...needs(m, this.shown));
    return [...new Set(keep)];
  }

  /** Give back every decoded frame that is no longer wanted. */
  private tidy(): void {
    const keep = new Set(this.wanted());
    for (const [file, { frame }] of [...this.decoded]) {
      if (keep.has(file)) continue;
      this.decoded.delete(file);
      const character = this.character;
      if (character && this.isPatch(file)) character.dropPatch(file, true);
      else {
        character?.drop(file);
        releaseFrame(frame);
      }
    }
    if (!this.decoded.size && this.shown && !this.covering) this.shown = '';
  }

  private isPatch(file: string): boolean {
    const m = this.manifest;
    return !!m && !!m.parts?.patches?.[file] && !m.parts.patches[file].same;
  }

  private ensureCharacter(): Character {
    if (this.character) return this.character;
    const m = this.manifest!;
    const [w, h] = m.size;
    const character = new Character(new Map(), {
      rest: heldOf(m),
      size: { w, h },
      placement: { kind: 'box', x: m.plate.x, y: m.plate.y, width: m.plate.w, height: m.plate.h },
      className: 'hj-actor hj-finale',
    });
    character.el.style.visibility = 'hidden';
    this.host.place(character.el);
    character.resize();
    this.character = character;
    return character;
  }

  /** Decode what is wanted and not yet there, one frame at a time, soonest first, in the decoder worker. */
  private async pump(): Promise<void> {
    if (this.decoding) return;
    this.decoding = true;
    try {
      for (;;) {
        this.tidy();
        const file = this.wanted().find((name) => !this.decoded.has(name) && this.blobs.has(name) && !this.failed.has(name));
        if (!file) return;
        let frame: Frame;
        const began = performance.now();
        try {
          frame = await decodeBlob(this.blobs.get(file)!);
          this.decodes.push([file, Math.round(performance.now() - began)]);
        } catch (error) {
          this.failed.add(file);
          console.warn(`[hjaas] the finale's "${file}" could not be decoded`, error);
          continue;
        }
        if (!this.wanted().includes(file) || !this.manifest) {
          releaseFrame(frame);
          continue;
        }
        const character = this.ensureCharacter();
        const patch = this.manifest.parts?.patches?.[file];
        if (patch && !patch.same) character.addPatch(file, { base: patch.base, x: patch.x ?? 0, y: patch.y ?? 0, frame });
        else character.add(file, frame);
        const { w, h } = frameSize(frame);
        this.decoded.set(file, { frame, bytes: w * h * 4 });
        this.peak = Math.max(this.peak, this.bytes);
        this.kick();
      }
    } finally {
      this.decoding = false;
    }
  }

  private whenReady(files: string[] | null, ms: number, downloadedOnly = false): Promise<void> {
    return new Promise((resolve) => {
      const until = performance.now() + ms;
      const check = (): void => {
        const list = files ?? (this.manifest ? needs(this.manifest, heldOf(this.manifest)) : null);
        const done = list?.every((f) => (downloadedOnly ? this.blobs.has(f) : this.decoded.has(f)) || this.failed.has(f));
        if (done || performance.now() >= until) resolve();
        else window.setTimeout(check, 30);
      };
      check();
    });
  }

  /** Look at the clock now, and keep looking while something is due. */
  private kick(): void {
    if (!this.running || !this.awake || !this.director || this.raf) return;
    window.clearTimeout(this.timer);
    this.timer = 0;
    this.raf = requestAnimationFrame((now) => this.tick(now));
  }

  private stopClock(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.timer) clearTimeout(this.timer);
    this.raf = 0;
    this.timer = 0;
  }

  private tick(_frameTime: number): void {
    this.raf = 0;
    const director = this.director;
    if (!director || !this.running || !this.awake) return;
    const now = performance.now();
    const before = this.phase;
    const was = this.shown;
    const pose = director.update(now, this.readiness());
    if (director.flashAt !== null) {
      this.flashUp(director.flashAt);
      director.flashAt = null;
    }
    this.apply(pose);
    // (The next frames are decoded, and the ones shown given back, as she moves on.)
    if (before !== this.phase || this.shown !== was || (pose !== null && this.manifest && poseOf(this.manifest, pose) !== this.shown)) void this.pump();
    const next = director.nextChange(now);
    if (next === Infinity) return;
    const wait = next - now;
    if (wait < 50) this.raf = requestAnimationFrame((t) => this.tick(t));
    else this.timer = window.setTimeout(() => {
      this.timer = 0;
      this.kick();
    }, wait - 20);
  }

  /** Show this pose (her own layers hidden), or null: her own layers again. A frame not decoded yet: the last one stays. */
  private apply(pose: string | null): void {
    const m = this.manifest;
    if (pose === null || !m) {
      if (this.covering) {
        this.covering = false;
        if (this.character) this.character.el.style.visibility = 'hidden';
        if (m) this.host.cover(false, m.hide ?? ['rachel'], m.plate);
      }
      return;
    }
    const files = needs(m, pose);
    const character = this.character;
    if (!character || !files.every((f) => this.decoded.has(f))) return;
    const name = poseOf(m, pose);
    if (name !== this.shown || !this.covering) {
      character.show(name);
      this.shown = name;
      this.log.push([name, Math.round(performance.now())]);
    }
    if (!this.covering) {
      // (For a performance trace: where the finale starts.)
      performance.mark('hj-finale');
      this.covering = true;
      character.el.style.visibility = '';
      this.host.cover(true, m.hide ?? ['rachel'], m.plate);
    }
  }

  /** The camera flash: white over the picture, up in FLASH_UP_MS, down in FLASH_DOWN_MS. Opacity only. */
  private flashUp(at: number): void {
    this.flashEl?.remove();
    const el = document.createElement('div');
    el.className = 'hj-flash';
    el.setAttribute('aria-hidden', 'true');
    this.host.overlay(el);
    this.flashEl = el;
    const duration = FLASH_UP_MS + FLASH_DOWN_MS;
    const fade = el.animate(
      [
        { opacity: 0, easing: 'linear' },
        { opacity: 0.92, offset: FLASH_UP_MS / duration, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
        { opacity: 0 },
      ],
      { duration, delay: Math.max(0, at - performance.now()), fill: 'both' },
    );
    void fade.finished.then(() => {
      if (this.flashEl === el) this.flashEl = null;
      el.remove();
    }, () => el.remove());
  }
}

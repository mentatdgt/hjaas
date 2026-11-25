import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/spectral/latin-400.css';
import './site.css';
import { retainAssets, setAssetBase, warmPlate } from './assets';
import { Caption, MUSHROOM_ICON, type CaptionCopy } from './caption';
import { DEFAULT_EDGE, EDGE_STYLES, edgeSeed, type EdgeStyle } from './edge';
import { flags } from './flags';
import { ContactForm } from './form';
import { Logo } from './logo';
import { onReducedMotionChange, reducedMotion } from './motion';
import { Pan } from './pan';
import { Scene } from './scene';
import { freshScene, huntView, isProgressKey, loadProgress, presetAll, resetProgress, saveFind, savePan, saveSeen, type HuntView, type SceneProgress } from './state';
import { seeded } from './steps';
import { Transition } from './transition';
import type { SceneConfig, Spot } from './types';

declare global {
  interface Window {
    hjaasRoom(fragment: string): { id: string; folder: string };
  }
}

export interface SiteOptions {
  /** The scenes that exist, in menu order. The first is the one a plain address opens. */
  scenes: readonly SceneConfig[];
  /** Folder holding the site's assets. Defaults to `<site base>/assets/`. */
  assetBase?: string;
  /** Where the logo links to. Without it the logo is not a link. */
  homeHref?: string;
}

export interface Site {
  destroy(): void;
}

const HINT_AFTER_S = 60;
/** The first visit's drift (pan.ts), after the painting has ended. */
const DRIFT_AFTER_MS = 700;
// QA: the nine mushroom drawings, decoded (see scripts/build-assets.mjs for their size).
const SPRITE_BYTES = 9 * 166 * 154 * 4;

// TODO(copy): every word on the page is a placeholder until the real copy arrives. They are all here,
// except the scene names (src/scenes/) and the form's (form.ts).
const COPY = {
  name: 'Hui Jie',
  tagline: 'TODO(copy): what Hui Jie does, in one line',
  menu: 'Scenes',
  skip: 'Skip',
  pause: 'Pause animation',
  play: 'Play animation',
  replay: 'Replay painting',
  /** A tab whose scene is finished, for screen readers (its mushroom says it to everyone else). */
  tabDone: (scene: string) => `${scene}, scene complete`,
};

/** The two counters, the link to the next scene, and the button they turn into. */
const COUNTER: CaptionCopy = {
  hereFound: (scene) => `found in ${scene}`,
  hereMore: (left, scene) => `${left} more in ${scene}`,
  hereDone: (scene) => `${scene} complete`,
  siteAll: (total) => `find all ${total} to contact Hui Jie`,
  siteMore: (left) => `${left} more to contact Hui Jie`,
  siteDone: (total) => `You found all ${total}`,
  next: 'Next:',
  contact: 'Contact Hui Jie',
  hereSpoken: (found, total, scene) => `${found} of ${total} found in ${scene}`,
  siteSpoken: (found, total) => `${found} of ${total} found in all scenes`,
  unlock: (total) => `All ${total} mushrooms found. The Contact Hui Jie button is now available.`,
};

/**
 * Resolves when the page has kept up with the screen for `calmMs` in a row (never sooner than two frames,
 * never later than `limitMs`). Whatever was set up just before has then been drawn, so the motion that
 * follows does not start with a stalled frame.
 */
function waitForFrames(signal: AbortSignal, calmMs = 130, minimum = 2, limitMs = 1500): Promise<void> {
  if (signal.aborted || document.hidden) return Promise.resolve();
  return new Promise((resolve) => {
    const start = performance.now();
    let last = start;
    let calmSince = start;
    let frames = 0;
    let raf = 0;
    const done = (): void => {
      cancelAnimationFrame(raf);
      signal.removeEventListener('abort', done);
      resolve();
    };
    signal.addEventListener('abort', done, { once: true });
    const tick = (now: number): void => {
      if (now - last > 30) calmSince = now;
      last = now;
      if (++frames >= minimum && (now - calmSince >= calmMs || now - start >= limitMs)) done();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}

/** Resolves once the tab is in front (at once if it is), or the signal is aborted. */
function whenVisible(signal: AbortSignal): Promise<void> {
  if (signal.aborted || !document.hidden) return Promise.resolve();
  return new Promise((resolve) => {
    const check = (): void => {
      if (document.hidden && !signal.aborted) return;
      document.removeEventListener('visibilitychange', check);
      signal.removeEventListener('abort', check);
      resolve();
    };
    document.addEventListener('visibilitychange', check);
    signal.addEventListener('abort', check);
  });
}

/**
 * Mounts the site into `host`: a paper page with one framed picture, and a small menu to move between the
 * scenes. Everything it needs lives under `.hj-scene`: markup, styles, state and assets. It takes its
 * width from the host element and is as tall as its content, so the host page scrolls if it has to.
 */
export function mountSite(host: HTMLElement, options: SiteOptions): Site {
  if (options.assetBase) setAssetBase(options.assetBase);
  const scenes = options.scenes;
  const sceneById = (id: string): SceneConfig | undefined => scenes.find((scene) => scene.id === id);
  /** Resolve the same room as the early image preload, falling back to Build. */
  const sceneInAddress = (): SceneConfig =>
    sceneById(window.hjaasRoom(location.hash).id) ?? sceneById('build') ?? scenes[0];

  const root = document.createElement('div');
  root.className = 'hj-scene is-pre';
  root.innerHTML = `
    <div class="hj-page">
      <header class="hj-masthead">
        <div class="hj-logo-slot"></div>
        <div class="hj-ident">
          <h1 class="hj-name">${COPY.name}</h1>
          <p class="hj-tagline">${COPY.tagline}</p>
        </div>
        ${
          // Only the scenes that exist are listed; with one scene there is nowhere to go and no menu.
          scenes.length > 1
            ? `<nav class="hj-menu" aria-label="${COPY.menu}">${scenes
                .map((scene) => `<a class="hj-tab" href="#${scene.id}" data-scene="${scene.id}">${scene.label}<span class="hj-tab-mark" aria-hidden="true">${MUSHROOM_ICON}</span></a>`)
                .join('')}</nav>`
            : ''
        }
      </header>
      <figure class="hj-frame" role="group">
        <div class="hj-window">
          <div class="hj-viewport"></div>
        </div>
      </figure>
      <div class="hj-caption">
        <div class="hj-controls"></div>
      </div>
    </div>
    <div class="hj-fly" aria-hidden="true"></div>
  `;
  host.append(root);

  const q = <T extends HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const page = q<HTMLDivElement>('.hj-page');
  const figure = q<HTMLElement>('.hj-frame');
  const frame = q<HTMLDivElement>('.hj-window');
  const viewport = q<HTMLDivElement>('.hj-viewport');
  const logoSlot = q<HTMLDivElement>('.hj-logo-slot');
  const captionRow = q<HTMLDivElement>('.hj-caption');
  const flyLayer = q<HTMLDivElement>('.hj-fly');
  const tabs = [...root.querySelectorAll<HTMLAnchorElement>('.hj-tab')];

  let destroyed = false;
  let logo: Logo | undefined;
  /** The scene in the window. */
  let current: Scene | undefined;
  const cleanup: Array<() => void> = [retainAssets()];

  // ---- Progress: each scene has its own found mushrooms and pan position; the unlock is shared. ----

  if (flags.reset) resetProgress();
  const progress = loadProgress(scenes);
  const stateOf = (id: string): SceneProgress => (progress.scenes[id] ??= freshScene());
  const first = sceneInAddress();
  /** Nothing has been painted for this visitor before: their first visit. */
  const newcomer = Object.values(progress.scenes).every((scene) => !scene.seen);
  // QA presets. `?all=N`: the first N mushrooms of the whole site, scene by scene in menu order (it wins over
  // `?found`). `?found=N`: the opening scene starts with this many found.
  const preset = flags.all !== undefined || flags.found !== undefined;
  if (flags.all !== undefined) {
    const finds = presetAll(scenes, flags.all);
    for (const scene of scenes) stateOf(scene.id).found = finds[scene.id];
  } else if (flags.found !== undefined) {
    stateOf(first.id).found = first.spots.slice(0, Math.max(0, Math.min(first.spots.length, flags.found))).map((spot) => spot.id);
  }
  const foundIn = new Map<string, Set<string>>(scenes.map((scene) => [scene.id, new Set(stateOf(scene.id).found)]));
  const findsOf = (id: string): ReadonlySet<string> => foundIn.get(id) ?? new Set();
  // The Contact button is earned by every mushroom of every scene, and worked out from the finds themselves:
  // a saved flag is never trusted (one saved by the old rule, the first scene to reach 10, means nothing now).
  // The counters, the mushrooms on the tabs and the "Next" link read the same view.
  const viewOf = (config: SceneConfig): HuntView => huntView(scenes, findsOf, config.id);
  progress.unlocked = viewOf(first).unlocked;

  // QA: with ?debug, every frame that arrives late is logged (start time and length, in ms).
  const jank: Array<[number, number]> = [];
  const longTasks: Array<[number, number]> = [];
  const poses: Array<[string, number]> = [];
  const marks: Record<string, number> = { introStart: 0, introEnd: 0, switchStart: 0, switchEnd: 0, dressMs: 0 };
  let ready = false;
  if (flags.debug) {
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longTasks.push([Math.round(entry.startTime), Math.round(entry.duration)]);
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      // Long-task timing is Chromium-only; the frame log below still works everywhere.
    }
    let last = performance.now();
    const watch = (now: number): void => {
      if (now - last > 25) jank.push([Math.round(last), Math.round(now - last)]);
      last = now;
      if (!destroyed) requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
    (window as unknown as { __hj: unknown }).__hj = {
      get scene() { return current; },
      get player() { return current?.player; },
      get rachel() { return current?.character; },
      get hunt() { return current?.hunt; },
      get logo() { return logo; },
      get ready() { return ready; },
      get busy() { return busy; },
      caption: null as Caption | null,
      /** What the page's decoded images and canvases take, in bytes, from their sizes. */
      get memory() {
        const parts: Record<string, number> = { sprites: SPRITE_BYTES, logo: logo?.bytes ?? 0, sheet: transition.sheetBytes };
        for (const [id, scene] of scenesLoaded) {
          const m = scene.memory;
          parts[`${id}.frames`] = m.stills + m.clipFrames;
          parts[`${id}.canvases`] = m.canvases;
          parts[`${id}.room`] = m.room;
          parts[`${id}.edge`] = m.edge;
        }
        return { total: Object.values(parts).reduce((a, b) => a + b, 0), parts };
      },
      poses,
      jank,
      longTasks,
      marks,
    };
  }

  // The painting's edge. One style ships; the others can be asked for in development, to compare.
  const edgeStyle: EdgeStyle = EDGE_STYLES.find((style) => style === flags.edge) ?? DEFAULT_EDGE;
  const paper = (getComputedStyle(root).backgroundColor.match(/[\d.]+/g) ?? ['246', '243', '236']).slice(0, 3).map(Number) as [number, number, number];

  const rnd = flags.seed === undefined ? Math.random : seeded(flags.seed);
  // The visitor can pause the routine; reduced motion never starts it. Either way she holds her rest pose.
  let paused = false;
  const still = (): boolean => paused || reducedMotion();

  // ---- The caption: the two counters, and (once earned) the Contact button they turn into. ----

  /** A finished scene's tab has a tiny red mushroom. `live`: one that comes now, with the scene's tenth find, fades in. */
  const markTabs = (live = false): void => {
    const { done } = viewOf(current?.config ?? first);
    for (const tab of tabs) {
      const on = done.includes(tab.dataset.scene ?? '');
      tab.classList.toggle('is-mark-new', live && on && !tab.classList.contains('is-done'));
      tab.classList.toggle('is-done', on);
      const label = sceneById(tab.dataset.scene ?? '')?.label;
      if (on && label) tab.setAttribute('aria-label', COPY.tabDone(label));
      else tab.removeAttribute('aria-label');
    }
  };
  const caption: Caption = new Caption(COUNTER, {
    onDone: () => markTabs(true),
    onButton: () => {
      // Keyboard and screen-reader users land on the prize, and it is brought on screen if it was not.
      caption.action.focus({ preventScroll: true });
      caption.action.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
    },
  });
  captionRow.prepend(caption.el);
  if (flags.debug) (window as unknown as { __hj: { caption: Caption } }).__hj.caption = caption;
  caption.set(viewOf(first));
  markTabs();

  const form = new ContactForm(root, caption.action);
  cleanup.push(() => form.destroy());
  // A click with detail 0 came from the keyboard: keyboard actions open at once, with no entrance.
  caption.action.addEventListener('click', (event) => form.open(event.detail === 0));

  // Where a phone visitor leaves a room is where they find it next time.
  let panSave = 0;
  const pendingPan = new Map<string, number>();
  const flushPan = (): void => {
    window.clearTimeout(panSave);
    for (const [id, x] of pendingPan) savePan(id, x);
    pendingPan.clear();
  };
  window.addEventListener('pagehide', flushPan);
  cleanup.push(() => {
    window.removeEventListener('pagehide', flushPan);
    flushPan();
  });
  const pan = new Pan(viewport, progress.panned, (centreX) => {
    if (!current) return;
    progress.panned = true;
    const id = current.config.id;
    const x = Math.round(centreX);
    stateOf(id).panX = x;
    if (preset) return;
    pendingPan.set(id, x);
    window.clearTimeout(panSave);
    panSave = window.setTimeout(flushPan, 300);
  });
  cleanup.push(() => pan.destroy());

  // ---- The quiet controls at the end of the caption. ----

  // All three are laid out from the start and swapped by visibility alone (site.css), so showing or hiding
  // one never moves anything on the page.
  const control = (label: string): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hj-link is-off';
    button.textContent = label;
    q('.hj-controls').append(button);
    return button;
  };
  const show = (button: HTMLButtonElement, on: boolean): void => void button.classList.toggle('is-off', !on);
  const shown = (button: HTMLButtonElement): boolean => !button.classList.contains('is-off');
  const skip = control(COPY.skip);
  const pause = control(COPY.pause);
  const replay = control(COPY.replay);

  // "Pause animation" stops everything that moves by itself: the character's routine and the logo's idle
  // glint. (A find still gets its short answer, and the logo still glints under the pointer.)
  pause.addEventListener('click', () => {
    paused = !paused;
    pause.textContent = paused ? COPY.play : COPY.pause;
    current?.refresh();
    if (paused) logo?.stop();
    else startLogoIdle();
  });

  const transition = new Transition({ root, window: frame, viewport, caption: caption.el, seed: flags.seed });
  const cropChanged = (): void => transition.cropChanged(pan.view);
  const cropLayout = new ResizeObserver(cropChanged);
  cropLayout.observe(frame);
  viewport.addEventListener('scroll', cropChanged, { passive: true });
  cleanup.push(() => {
    cropLayout.disconnect();
    viewport.removeEventListener('scroll', cropChanged);
  });
  /**
   * Skip while a brush is at work; afterwards, Pause and the way to see the room painted again.
   * With reduced motion nothing moves by itself and nothing is painted, so neither is offered.
   */
  const showControls = (painting: boolean): void => {
    const focused = document.activeElement;
    show(skip, painting);
    show(pause, !painting && !reducedMotion());
    show(replay, !painting && !reducedMotion());
    // Keyboard focus follows the control that took the other's place.
    if (focused === skip && !shown(skip) && shown(replay)) replay.focus({ preventScroll: true });
    if (focused === replay && !shown(replay) && shown(skip)) skip.focus({ preventScroll: true });
  };
  let paintWait = new AbortController();
  let leaving: Animation | undefined;
  const rush = (signal: AbortSignal): boolean => signal.aborted || document.hidden;
  const finishTransition = (): void => {
    paintWait.abort();
    paintWait = new AbortController();
    leaving?.finish();
    transition.skip();
  };
  const startLogoIdle = (): void => {
    if (!paused && !reducedMotion() && !document.hidden) logo?.startIdle();
  };
  const settleMotion = (resetRoutine: boolean): void => {
    finishTransition();
    pan.finishMotion();
    logo?.stop();
    const justEarned = unlockEarned;
    for (const scene of scenesLoaded.values()) scene.hunt.finishMotion();
    current?.finishMotion(resetRoutine);
    const view = viewOf(current?.config ?? first);
    caption.settle(view, justEarned);
    unlockEarned = false;
    markTabs();
    showControls(false);
  };
  cleanup.push(onReducedMotionChange(() => {
    settleMotion(true);
    startLogoIdle();
  }));

  // How the opening scene arrives. A first visit gets the painting. A return visit, or reduced motion,
  // gets the edge's pencil and then everything else together, in 300 ms.
  const opening: 'paint' | 'reveal' | 'off' =
    flags.intro === 'off'
      ? 'off'
      : reducedMotion()
        ? 'reveal'
        : flags.intro === 'full'
          ? 'paint'
          : flags.intro === 'quick' || stateOf(first.id).seen
            ? 'reveal'
            : 'paint';
  // "Skip" is there from the first moment of a painting, even while the art is still loading.
  show(skip, opening === 'paint');
  skip.addEventListener('click', finishTransition);

  // ---- The hunt. ----

  // The hint: after a minute with no find, one unfound mushroom wiggles once, and only once per visit.
  // Time only counts while the tab is visible and nothing is being painted.
  let quietSeconds = 0;
  const hintAfter = flags.hintSeconds ?? HINT_AFTER_S;
  let begun = false; // the opening's painting (or reveal) has started
  let settled = false; // the opening has finished
  const hintClock = window.setInterval(() => {
    if (document.hidden || !settled || busy || !current || current.hunt.remaining === 0) return;
    quietSeconds++;
    if (quietSeconds >= hintAfter) {
      // With none on screen it skips, and is due again after another quiet minute.
      if (current.hunt.hint()) window.clearInterval(hintClock);
      else quietSeconds = 0;
    }
  }, 1000);
  cleanup.push(() => window.clearInterval(hintClock));

  /** The find that completed the whole site has been made; its mushroom has not landed yet. */
  let unlockEarned = false;

  const loading = new Map<string, Promise<Scene>>();
  const scenesLoaded = new Map<string, Scene>();
  /** A scene, loaded once. Its mushrooms report back here. */
  const sceneFor = (config: SceneConfig): Promise<Scene> => {
    let scene = loading.get(config.id);
    if (scene) return scene;
    const found = foundIn.get(config.id)!;
    const of = config.spots.length;
    let self: Scene | undefined;
    // The opening scene comes with its character; any other scene fetches hers when it is first opened.
    scene = Scene.load(
      config,
      {
      flyLayer,
      found,
      target: () => caption.targetRect(),
      rnd,
      still,
      shownWidth: () => frame.clientWidth,
      onFind: (spot: Spot) => {
        quietSeconds = 0;
        found.add(spot.id);
        stateOf(config.id).found = [...found];
        // Worked out again after every find: this one may have been the last of the whole site.
        const was = progress.unlocked;
        progress.unlocked = viewOf(config).unlocked;
        if (progress.unlocked && !was) unlockEarned = true;
        if (!preset) saveFind(config.id, spot.id);
        if (!self) return;
        const wasReacting = self.reactingNow;
        const done = self.react();
        // The last find always gets its own reaction, even if she was still busy with the one before.
        if (found.size === of && wasReacting) {
          const signal = paintWait.signal;
          void done.then(() => {
            if (!rush(signal) && current === self) return self?.react();
          });
        }
      },
      onLand: () => {
        // (A mushroom still in the air when the visitor changes scene has been counted; the caption has moved on.)
        if (destroyed || !self || self !== current) return;
        unlockEarned = false;
        caption.land(viewOf(config));
      },
      onLayout: () => {
        if (self === current) {
          pan.layout();
          cropChanged();
        }
      },
      onPose: flags.debug ? (pose, at) => poses.push([pose, Math.round(at)]) : undefined,
      edge: { style: edgeStyle, seed: edgeSeed, paper },
      },
      !current,
    ).then((loaded) => {
      if (destroyed) {
        loaded.destroy();
        return loaded;
      }
      self = loaded;
      loaded.syncFinds();
      scenesLoaded.set(config.id, loaded);
      return loaded;
    });
    loading.set(config.id, scene);
    void scene.catch(() => loading.delete(config.id));
    return scene;
  };

  const syncProgress = (event: StorageEvent): void => {
    if (preset || event.storageArea !== localStorage || !isProgressKey(event.key)) return;
    const saved = loadProgress(scenes);
    progress.panned ||= saved.panned;
    if (progress.panned) pan.markPanned();
    let changed = false;
    for (const { id } of scenes) {
      const theirs = saved.scenes[id];
      const mine = stateOf(id);
      mine.seen ||= theirs.seen;
      if (!pendingPan.has(id) && theirs.panX !== null) mine.panX = theirs.panX;
      const found = foundIn.get(id)!;
      const before = found.size;
      for (const spot of theirs.found) found.add(spot);
      if (found.size === before) continue;
      mine.found = [...found];
      scenesLoaded.get(id)?.syncFinds();
      changed = true;
    }
    if (changed) {
      const view = viewOf(current?.config ?? first);
      progress.unlocked = view.unlocked;
      unlockEarned = false;
      caption.set(view);
      markTabs();
    }
  };
  window.addEventListener('storage', syncProgress);
  cleanup.push(() => window.removeEventListener('storage', syncProgress));

  /** Put a scene in the window: its plate, its pan position, its name. */
  const place = (scene: Scene): void => {
    current = scene;
    scene.hunt.el.inert = true;
    viewport.replaceChildren(scene.plate);
    figure.setAttribute('aria-label', scene.config.picture);
    for (const tab of tabs) {
      if (tab.dataset.scene === scene.config.id) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    pan.use(scene.plate, scene.config.focusX, stateOf(scene.config.id).panX);
  };

  const seen = (scene: Scene): void => {
    const state = stateOf(scene.config.id);
    if (state.seen) return;
    state.seen = true;
    if (!preset) saveSeen(scene.config.id);
  };

  // ---- Moving between scenes. ----

  /** A painting or a switch is under way. A click on the menu, or Skip, finishes it at once. */
  let busy = true;
  let wanted = first;
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'hj-link';
  retry.hidden = true;
  retry.textContent = 'Retry room';
  captionRow.append(retry);

  const roomFailed = (config: SceneConfig, error: unknown): void => {
    console.warn(`[hjaas] ${config.id}: the room could not be loaded`, error);
    if (destroyed) return;
    retry.hidden = false;
    retry.setAttribute('aria-label', `Retry ${config.label}`);
    show(skip, false);
  };

  const frame1 = (signal: AbortSignal): Promise<void> => waitForFrames(signal, 0, 1);
  const leaveRoom = (plate: HTMLElement, signal: AbortSignal): Animation | undefined => {
    if (rush(signal)) return;
    leaving = plate.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease', fill: 'forwards' });
    return leaving;
  };
  const warn = (config: SceneConfig) => (error: unknown) => console.warn(`[hjaas] ${config.id}: the character could not be loaded; the room is shown without her`, error);
  const WAIT_TO_DRAW_MS = 1500;
  /**
   * Everything a painting will uncover, drawn once under its sheet before its clock starts. It never waits for
   * long: a painting that starts a little roughly is better than a page that stays blank.
   */
  const allDrawn = (scene: Scene): Promise<void> => Promise.race([scene.drawn().catch(() => {}), new Promise<void>((resolve) => window.setTimeout(resolve, WAIT_TO_DRAW_MS))]);
  /** How long a switch waits, under the old picture, for the new scene's character before going on without her. */
  const WAIT_FOR_HER_MS = 600;

  const switchTo = async (config: SceneConfig): Promise<void> => {
    const signal = paintWait.signal;
    const old = current!;
    const next = await sceneFor(config);
    if (destroyed) return;
    // Fetch her first frames once this room has been requested.
    next.preload();
    // A scene out of sight holds no decoded picture: its room is decoded again here, from the browser's
    // own copy of the file, before anything is put on the page.
    await next.ready();
    if (destroyed) return;
    const firstVisit = !stateOf(config.id).seen && flags.intro !== 'quick';
    const calm = reducedMotion() || flags.intro === 'off' || rush(signal);
    /** The caption for the scene arrived at. Its state is read as it goes up: a find may land meanwhile. */
    const retitle = (): void => {
      const view = viewOf(config);
      // Screen readers hear where they have arrived, and this scene's own count (and the prize, if the last
      // mushroom was still in the air).
      const arriving = `${config.label}. ${COUNTER.hereSpoken(view.here.found, view.here.total, view.label)}.${unlockEarned ? ` ${COUNTER.unlock(view.site.total)}` : ''}`;
      unlockEarned = false;
      // Keyboard focus on a link that is about to go moves to the tab it led to.
      if (document.activeElement === caption.next) tabs.find((tab) => tab.dataset.scene === config.id)?.focus({ preventScroll: true });
      caption.change(view, arriving, rush(signal));
      markTabs();
    };
    // The new scene's parts are drawn for the first time one frame after another, under the old picture
    // (or the blank sheet), not all in the frame of the tap: the room first, then her.
    const her = (): Promise<void> => next.enter().catch(warn(config));
    /** The new scene's edge, drawn. (QA: how long that took.) */
    const dress = (): Promise<void> => {
      const from = performance.now();
      return next.dress().catch(warn(config)).then(() => void (marks.dressMs = Math.round(performance.now() - from)));
    };

    if (firstVisit && !calm) {
      // A scene never seen before gets its full painting, from a blank sheet. She is painted with the room,
      // so it waits for her frames; the picture being left stays up until they are here.
      await next.loaded().catch(warn(config));
      if (destroyed) return;
      marks.switchStart = Math.round(performance.now());
      old.hold();
      const leave = leaveRoom(old.plate, signal);
      await leave?.finished;
      leaving = undefined;
      if (destroyed) return;
      place(next);
      leave?.cancel();
      transition.prepare(next);
      retitle();
      if (!rush(signal)) showControls(true);
      await frame1(signal);
      // The scene just left is off the page: it gives its decoded images back now, before the new scene's
      // arrive, so the two sets are never in memory together. (A frame of its own: not in the tap's.)
      old.rest();
      await frame1(signal);
      // Its own edge is drawn now that the other scene's has been given back, under the blank sheet.
      await Promise.all([her(), dress()]);
      await allDrawn(next);
      await waitForFrames(signal);
      if (destroyed) return;
      if (rush(signal)) transition.finish(next);
      else await transition.paint(next, false);
    } else {
      marks.switchStart = Math.round(performance.now());
      old.hold();
      // A copy of the old picture goes over the window, and the new one is put together underneath it.
      transition.cover((ctx, origin) => old.sketch(ctx, origin), next);
      place(next);
      retitle();
      if (!calm) showControls(true);
      await frame1(signal);
      // The old picture is on the sheet now, as a copy: the scene itself gives its decoded images back
      // before the new scene's arrive, so the two sets are never in memory together. (A frame of its own:
      // not in the tap's.)
      old.rest();
      await frame1(signal);
      // Her frames are usually decoded by now. If the network is slow the brush does not wait for long:
      // she fades in when she arrives.
      // The new scene's edge is drawn meanwhile, now that the old one's has been given back: nothing of the
      // new picture shows until it is complete.
      const dressed = dress();
      const inTime = await Promise.race([her().then(() => true), new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), WAIT_FOR_HER_MS))]);
      if (!inTime) next.arriveSoftly();
      await dressed;
      if (destroyed) return;
      if (rush(signal)) {
        transition.finish(next);
      } else if (calm) {
        // No brushwork: the old picture fades off the new one in 200 ms.
        await transition.fadeOver(next);
      } else {
        // A scene seen before is brushed in over the one being left.
        await waitForFrames(signal, 70);
        if (destroyed) return;
        if (rush(signal)) transition.finish(next);
        else await transition.brushOver(next, pan.view);
      }
    }
    if (destroyed) return;
    marks.switchEnd = Math.round(performance.now());
    seen(next);
    showControls(false);
    quietSeconds = 0;
    void next.loadMore();
  };

  /** Go to a scene. Asked again while a brush is at work, it finishes that picture at once and carries on. */
  const go = async (config: SceneConfig): Promise<void> => {
    wanted = config;
    if (busy) {
      finishTransition();
      return;
    }
    busy = true;
    retry.hidden = true;
    try {
      while (!destroyed && current && wanted.id !== current.config.id) {
        const requested = wanted;
        try {
          await switchTo(requested);
        } catch (error) {
          if (wanted !== requested) continue;
          roomFailed(requested, error);
          break;
        }
      }
    } finally {
      busy = false;
    }
  };

  // The address names the scene (#grow), so links and the back button work. A click on the menu changes
  // the address; the address changing is what moves the picture.
  const onAddress = (): void => {
    const config = sceneInAddress();
    if (!current && !busy) void open(config);
    else void go(config);
  };
  window.addEventListener('hashchange', onAddress);
  cleanup.push(() => window.removeEventListener('hashchange', onAddress));
  for (const tab of tabs) {
    // Clicking again while the brush is at work skips to the finished picture.
    tab.addEventListener('click', () => {
      if (busy) finishTransition();
      else if (tab.hash === location.hash) onAddress();
    });
  }
  // "Replay painting": she stops, the picture clears to a blank sheet, and it is painted again.
  replay.addEventListener('click', () => {
    const scene = current;
    if (!scene || busy) return;
    busy = true;
    const signal = paintWait.signal;
    scene.settle();
    const leave = leaveRoom(scene.plate, signal);
    void (async () => {
      await leave?.finished;
      leaving = undefined;
      if (destroyed) return;
      leave?.cancel();
      if (rush(signal)) transition.finish(scene);
      else {
        transition.prepare(scene);
        showControls(true);
        await allDrawn(scene);
        await waitForFrames(signal, 70);
        if (destroyed) return;
        if (rush(signal)) transition.finish(scene);
        else await transition.paint(scene);
      }
      if (destroyed) return;
      showControls(false);
      busy = false;
      // A scene asked for while this one was being painted.
      if (wanted.id !== scene.config.id) void go(wanted);
    })();
  });

  const onVisibility = (): void => {
    // (Before the opening there is no motion to settle: its painting waits for the tab to be looked at.)
    if (!document.hidden) startLogoIdle();
    else if (begun) settleMotion(false);
    current?.visibility();
  };
  document.addEventListener('visibilitychange', onVisibility);
  cleanup.push(() => document.removeEventListener('visibilitychange', onVisibility));

  // ---- The opening. ----

  const open = async (config: SceneConfig): Promise<void> => {
    busy = true;
    const signal = paintWait.signal;
    retry.hidden = true;
    wanted = config;
    let scene: Scene;
    let theLogo: Logo | undefined;
    try {
      [scene, theLogo] = await Promise.all([
        sceneFor(config),
        Logo.create(options.homeHref).catch(() => undefined),
      ]);
    } catch (error) {
      busy = false;
      roomFailed(config, error);
      return;
    }
    if (destroyed) return;
    place(scene);
    // Before a painting each part of the setting up gets a frame to itself, not one long task for all of it.
    const breath = (): Promise<void> => opening === 'paint' ? frame1(signal) : Promise.resolve();
    await breath();
    if (destroyed) return;
    logo = theLogo;
    // The logo keeps its own proportions; the page reserves exactly that space for it.
    if (theLogo) {
      page.style.setProperty('--logo-ratio', theLogo.el.style.aspectRatio);
      logoSlot.append(theLogo.el);
      theLogo.prepare();
      startLogoIdle();
      cleanup.push(() => theLogo?.stop());
    }
    caption.set(viewOf(config));

    // While nothing is on screen yet: lay the contact sheet out once (with its real font), so that
    // opening it later never costs a frame of the character's routine, and get the brush ready.
    await document.fonts?.ready;
    await breath();
    form.prepare();
    caption.prepare(scenes.map((each) => each.label), viewOf(first).site.total);
    await breath();
    if (destroyed) return;
    const painting = opening === 'paint' && !signal.aborted;
    if (painting) {
      transition.prepare(scene);
      await frame1(signal);
      await allDrawn(scene);
    }
    // Let the setup above reach the screen before any motion starts. Before a painting that includes the
    // whole picture being drawn for the first time, under the blank sheet: wait until frames arrive on time.
    await waitForFrames(signal, painting ? 130 : 0);
    // Opened in a background tab, or left while it loads: the first visit's painting is kept for when it is seen.
    while (painting && document.hidden && !signal.aborted && !destroyed) {
      await whenVisible(signal);
      await waitForFrames(signal);
    }
    if (destroyed) return;
    begun = true;
    marks.introStart = Math.round(performance.now());
    if (rush(signal)) transition.finish(scene);
    else if (painting) await transition.paint(scene);
    else if (opening === 'reveal') await transition.reveal(scene);
    else transition.show(scene);
    if (destroyed) return;
    marks.introEnd = Math.round(performance.now());
    settled = true;
    showControls(false);
    // A new visitor on a phone sees, once, that the room can be panned: a moment after the paint is dry.
    if (painting && newcomer) {
      window.setTimeout(() => {
        if (!destroyed && !busy && !paused && current === scene && !rush(signal)) pan.drift();
      }, DRIFT_AFTER_MS);
    }
    seen(scene);
    busy = false;
    // A scene asked for while the opening was being painted.
    if (wanted.id !== scene.config.id) void go(wanted);

    const nextId = viewOf(config).next?.id;
    const likelyNext = nextId && sceneById(nextId);
    if (likelyNext) {
      void warmPlate(likelyNext.assets + likelyNext.plate, () =>
        !destroyed && !busy && !document.hidden && current === scene,
      );
    }
    await scene.loadMore();
    ready = true;
  };
  retry.addEventListener('click', () => {
    if (current) void go(wanted);
    else void open(wanted);
  });
  void open(first);

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      paintWait.abort();
      leaving?.finish();
      transition.clear();
      cleanup.forEach((fn) => fn());
      for (const scene of scenesLoaded.values()) scene.destroy();
      loading.clear();
      scenesLoaded.clear();
      root.remove();
    },
  };
}

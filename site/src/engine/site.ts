import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/spectral/latin-400.css';
import './site.css';
import { setAssetBase } from './assets';
import { Caption } from './caption';
import { DEFAULT_EDGE, EDGE_STYLES, edgeSeed, type EdgeStyle } from './edge';
import { flags } from './flags';
import { ContactForm } from './form';
import { Logo } from './logo';
import { onReducedMotionChange, reducedMotion } from './motion';
import { Pan } from './pan';
import { Scene } from './scene';
import { freshScene, loadProgress, saveProgress, type SceneProgress } from './state';
import { seeded } from './steps';
import { Transition } from './transition';
import type { SceneConfig, Spot } from './types';

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

// TODO(copy): every word on the page is a placeholder until the real copy arrives. They are all here,
// except the scene names (src/scenes/), the form's (form.ts) and the count itself, "3 of 10 found" (caption.ts).
const COPY = {
  name: 'Hui Jie',
  tagline: 'TODO(copy): what Hui Jie does, in one line',
  menu: 'Scenes',
  skip: 'Skip',
  pause: 'Pause animation',
  play: 'Play animation',
  replay: 'Replay painting',
  prompt: (total: number) => `Find the ${total} hidden mushrooms`,
  prize: (total: number) => `Find all ${total} to reach Hui Jie`,
  done: (total: number) => `You found all ${total}`,
};

/**
 * Resolves when the page has kept up with the screen for `calmMs` in a row (never sooner than two frames,
 * never later than `limitMs`). Whatever was set up just before has then been drawn, so the motion that
 * follows does not start with a stalled frame.
 */
function steadyFrames(calmMs = 130, limitMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    let last = start;
    let calmSince = start;
    let frames = 0;
    const tick = (now: number): void => {
      if (now - last > 30) calmSince = now;
      last = now;
      if (++frames >= 2 && (now - calmSince >= calmMs || now - start >= limitMs)) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
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
  /** The scene the address asks for: `#grow`. A plain address, or an unknown name, is the first scene. */
  const sceneInAddress = (): SceneConfig => sceneById(decodeURIComponent(location.hash.slice(1))) ?? scenes[0];

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
                .map((scene) => `<a class="hj-tab" href="#${scene.id}" data-scene="${scene.id}">${scene.label}</a>`)
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
  const cleanup: Array<() => void> = [];

  // ---- Progress: each scene has its own found mushrooms and pan position; the unlock is shared. ----

  const progress = loadProgress();
  const stateOf = (id: string): SceneProgress => (progress.scenes[id] ??= freshScene());
  const first = sceneInAddress();
  for (const scene of scenes) {
    const state = stateOf(scene.id);
    // A find of a hiding spot that has since been replaced counts for the spot that took its place.
    const now = state.found.map((id) => scene.replaced?.[id] ?? id);
    state.found = [...new Set(now)].filter((id) => scene.spots.some((spot) => spot.id === id));
  }
  if (flags.found !== undefined) {
    // A QA preset: the opening scene starts with this many found.
    stateOf(first.id).found = first.spots.slice(0, Math.max(0, Math.min(first.spots.length, flags.found))).map((spot) => spot.id);
    if (flags.found >= first.spots.length) progress.unlocked = true;
  }
  // Progress saved before the unlock was shared between scenes.
  if (scenes.some((scene) => stateOf(scene.id).found.length >= scene.spots.length)) progress.unlocked = true;
  const save = (): void => {
    if (flags.found !== undefined) return; // a QA preset is never written back
    saveProgress(progress);
  };
  const foundIn = new Map<string, Set<string>>(scenes.map((scene) => [scene.id, new Set(stateOf(scene.id).found)]));

  // QA: with ?debug, every frame that arrives late is logged (start time and length, in ms).
  const jank: Array<[number, number]> = [];
  const longTasks: Array<[number, number]> = [];
  const poses: Array<[string, number]> = [];
  const marks: Record<string, number> = { introStart: 0, introEnd: 0, switchStart: 0, switchEnd: 0 };
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

  // ---- The caption: this scene's count, what the hunt is for, and (once earned) the Contact button. ----

  const total = first.spots.length;
  const caption = new Caption(total);
  captionRow.prepend(caption.el);
  if (flags.debug) (window as unknown as { __hj: { caption: Caption } }).__hj.caption = caption;
  /** The line beside the count: what to look for, then what the hunt is for, then that this scene is done. */
  const noteFor = (count: number, of: number): string =>
    count >= of ? COPY.done(of) : progress.unlocked ? '' : count === 0 ? COPY.prompt(of) : COPY.prize(of);
  const captionFor = (config: SceneConfig): [number, string, boolean] => {
    const count = foundIn.get(config.id)!.size;
    return [count, noteFor(count, config.spots.length), progress.unlocked];
  };
  caption.set(...captionFor(first));

  const form = new ContactForm(root, caption.action);
  // A click with detail 0 came from the keyboard: keyboard actions open at once, with no entrance.
  caption.action.addEventListener('click', (event) => form.open(event.detail === 0));

  // Where a phone visitor leaves a room is where they find it next time.
  let panSave = 0;
  const pan = new Pan(viewport, captionRow, progress.panned, (centreX) => {
    if (!current) return;
    progress.panned = true;
    stateOf(current.config.id).panX = Math.round(centreX);
    window.clearTimeout(panSave);
    panSave = window.setTimeout(save, 300);
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
    else logo?.startIdle();
  });

  const transition = new Transition({ root, window: frame, viewport, caption: caption.el, seed: flags.seed });
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
  cleanup.push(
    onReducedMotionChange(() => {
      showControls(transition.running);
      current?.refresh();
    }),
  );

  // How the opening scene arrives. A first visit gets the painting. A return visit, or reduced motion,
  // gets everything together in 200 ms.
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
  let skipped = false;
  show(skip, opening === 'paint');
  skip.addEventListener('click', () => {
    skipped = true;
    transition.skip();
  });

  // ---- The hunt. ----

  // The hint: after a minute with no find, one unfound mushroom wiggles once, and only once per visit.
  // Time only counts while the tab is visible and nothing is being painted.
  let quietSeconds = 0;
  const hintAfter = flags.hintSeconds ?? HINT_AFTER_S;
  let settled = false; // the opening has finished
  const hintClock = window.setInterval(() => {
    if (document.hidden || !settled || busy || !current || current.hunt.remaining === 0) return;
    quietSeconds++;
    if (quietSeconds >= hintAfter) {
      window.clearInterval(hintClock);
      current.hunt.hint();
    }
  }, 1000);
  cleanup.push(() => window.clearInterval(hintClock));

  /** A scene's tenth mushroom has landed. The first scene to get there earns the Contact button, for good. */
  const finish = (scene: Scene): void => {
    const earned = !progress.unlocked;
    progress.unlocked = true;
    save();
    const calm = reducedMotion();
    const of = scene.total;
    // Her reaction is the celebration. Once she has looked up, the caption quietly changes.
    window.setTimeout(
      () => {
        if (scene !== current) return;
        caption.change(of, COPY.done(of), true, earned ? `All ${of} mushrooms found. The Contact Hui Jie button is now available.` : '');
        if (!earned) return;
        // Keyboard and screen-reader users land on the prize, and it is brought on screen if it was not.
        window.setTimeout(
          () => {
            caption.action.focus({ preventScroll: true });
            caption.action.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
          },
          calm ? 0 : 420,
        );
      },
      calm ? 0 : 900,
    );
  };

  const loading = new Map<string, Promise<Scene>>();
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
        save();
        if (!self) return;
        const wasReacting = self.reactingNow;
        const done = self.react();
        // The last find always gets its own reaction, even if she was still busy with the one before.
        if (found.size === of && wasReacting) void done.then(() => self?.react());
      },
      onLand: () => {
        // (A mushroom still in the air when the visitor changes scene has been counted; the caption has moved on.)
        if (!self || self !== current) return;
        const next = Math.min(of, caption.current + 1);
        const firstFind = next === 1;
        caption.land(next, firstFind && next < of && !progress.unlocked ? COPY.prize(of) : '');
        // The prompt has done its job: from the first find on, the caption says what the hunt is for.
        if (next < of) caption.say(noteFor(next, of));
        else finish(self);
      },
      onLayout: () => {
        if (self === current) pan.layout();
      },
      onPose: flags.debug ? (pose, at) => poses.push([pose, Math.round(at)]) : undefined,
      edge: { style: edgeStyle, seed: edgeSeed, paper },
      },
      config.id === first.id,
    ).then((loaded) => {
      self = loaded;
      return loaded;
    });
    loading.set(config.id, scene);
    return scene;
  };

  /** Put a scene in the window: its plate, its pan position, its name. */
  const place = (scene: Scene): void => {
    current = scene;
    viewport.replaceChildren(scene.plate);
    figure.setAttribute('aria-label', scene.config.picture);
    for (const tab of tabs) {
      if (tab.dataset.scene === scene.config.id) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    pan.use(scene.plate, scene.config.phoneStart, stateOf(scene.config.id).panX);
  };

  const seen = (scene: Scene): void => {
    const state = stateOf(scene.config.id);
    if (state.seen) return;
    state.seen = true;
    save();
  };

  // ---- Moving between scenes. ----

  /** A painting or a switch is under way. A click on the menu, or Skip, finishes it at once. */
  let busy = true;
  let wanted = first;

  const frame1 = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const warn = (config: SceneConfig) => (error: unknown) => console.warn(`[hjaas] ${config.id}: the character could not be loaded; the room is shown without her`, error);
  /** How long a switch waits, under the old picture, for the new scene's character before going on without her. */
  const WAIT_FOR_HER_MS = 600;

  const switchTo = async (config: SceneConfig): Promise<void> => {
    const old = current!;
    const next = await sceneFor(config);
    if (destroyed) return;
    // Her first frames, the first time the scene is opened: fetched and decoded from here on, off the
    // page's thread. (Usually they are on their way already: see the menu's pointer listeners.)
    next.preload();
    const firstVisit = !stateOf(config.id).seen && flags.intro !== 'quick';
    const calm = reducedMotion() || flags.intro === 'off';
    const state = captionFor(config);
    // Screen readers hear where they have arrived, and this scene's own count.
    const arriving = `${config.label}. ${state[0]} of ${config.spots.length} mushrooms found.`;
    // The new scene's parts are drawn for the first time one frame after another, under the old picture
    // (or the blank sheet), not all in the frame of the tap: the room first, then her.
    const her = (hidden: boolean): Promise<void> => next.enter({ hidden }).catch(warn(config));

    if (firstVisit && !calm) {
      // A scene never seen before gets its full painting, from a blank sheet. The painting brings her in,
      // so it waits for her frames; the picture being left stays up until they are here.
      await next.loaded().catch(warn(config));
      if (destroyed) return;
      marks.switchStart = Math.round(performance.now());
      old.hold();
      const leave = old.plate.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease', fill: 'forwards' });
      await leave.finished;
      place(next);
      leave.cancel();
      transition.prepare(next);
      caption.change(...state, arriving);
      showControls(true);
      await frame1();
      await her(true);
      await steadyFrames();
      await transition.paint(next);
    } else {
      marks.switchStart = Math.round(performance.now());
      old.hold();
      // A copy of the old picture goes over the window, and the new one is put together underneath it.
      transition.cover((ctx, origin) => old.sketch(ctx, origin), next);
      place(next);
      caption.change(...state, arriving);
      if (!calm) showControls(true);
      await frame1();
      // Her frames are usually decoded by now. If the network is slow the brush does not wait for long:
      // she fades in when she arrives.
      const inTime = await Promise.race([her(false).then(() => true), new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), WAIT_FOR_HER_MS))]);
      if (!inTime) next.arriveSoftly();
      if (destroyed) return;
      if (calm) {
        // No brushwork: the old picture fades off the new one in 200 ms.
        await transition.fadeOver(next);
      } else {
        // A scene seen before is brushed in over the one being left.
        await steadyFrames(70);
        await transition.brushOver(next, pan.view);
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
      transition.skip();
      return;
    }
    busy = true;
    while (!destroyed && current && wanted.id !== current.config.id) await switchTo(wanted);
    busy = false;
  };

  // The address names the scene (#grow), so links and the back button work. A click on the menu changes
  // the address; the address changing is what moves the picture.
  const onAddress = (): void => void go(sceneInAddress());
  window.addEventListener('hashchange', onAddress);
  cleanup.push(() => window.removeEventListener('hashchange', onAddress));
  for (const tab of tabs) {
    // Clicking again while the brush is at work skips to the finished picture.
    tab.addEventListener('click', () => {
      if (busy) transition.skip();
    });
    // The pointer on a tab, a finger going down on it, or keyboard focus: the scene will probably be opened.
    // Its character's first frames start downloading and decoding now, a moment ahead of the click.
    const config = sceneById(tab.dataset.scene ?? '');
    if (!config) continue;
    // (Not while a painting is under way: nothing may compete with the brush for the page's time.)
    const soon = (): void => {
      if (!busy) void sceneFor(config).then((scene) => scene.preload(), () => {});
    };
    for (const type of ['pointerenter', 'pointerdown', 'focus'] as const) tab.addEventListener(type, soon, { passive: true });
  }

  // "Replay painting": she stops, the picture clears to a blank sheet, and it is painted again.
  replay.addEventListener('click', () => {
    const scene = current;
    if (!scene || busy) return;
    busy = true;
    scene.settle();
    const leave = scene.plate.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease', fill: 'forwards' });
    void leave.finished.then(async () => {
      if (destroyed) return;
      transition.prepare(scene);
      leave.cancel();
      showControls(true);
      await steadyFrames(70);
      await transition.paint(scene);
      if (destroyed) return;
      showControls(false);
      busy = false;
      // A scene asked for while this one was being painted.
      if (wanted.id !== scene.config.id) void go(wanted);
    });
  });

  // Nothing runs while the tab is hidden; she picks up on the same pose when it comes back.
  const onVisibility = (): void => current?.visibility();
  document.addEventListener('visibilitychange', onVisibility);
  cleanup.push(() => document.removeEventListener('visibilitychange', onVisibility));

  // ---- The opening. ----

  void (async () => {
    const [scene, theLogo] = await Promise.all([sceneFor(first), Logo.create(options.homeHref)]);
    if (destroyed) return;
    place(scene);
    logo = theLogo;
    // The logo keeps its own proportions; the page reserves exactly that space for it.
    page.style.setProperty('--logo-ratio', theLogo.el.style.aspectRatio);
    logoSlot.append(theLogo.el);
    theLogo.prepare();
    if (!paused) theLogo.startIdle();
    cleanup.push(() => theLogo.stop());

    // While nothing is on screen yet: lay the contact sheet out once (with its real font), so that
    // opening it later never costs a frame of the character's routine, and get the brush ready.
    await document.fonts?.ready;
    form.prepare();
    const painting = opening === 'paint' && !skipped;
    if (painting) transition.prepare(scene);
    // Let the setup above reach the screen before any motion starts. Before a painting that includes the
    // whole picture being drawn for the first time, under the blank sheet: wait until frames arrive on time.
    await (painting ? steadyFrames() : steadyFrames(0));
    if (destroyed) return;
    marks.introStart = Math.round(performance.now());
    if (painting) {
      const painted = transition.paint(scene);
      // Skip pressed while the art was still loading: the finished picture, at once.
      if (skipped) transition.skip();
      await painted;
    } else if (opening === 'reveal' && !skipped) await transition.reveal(scene);
    else transition.show(scene);
    if (destroyed) return;
    marks.introEnd = Math.round(performance.now());
    settled = true;
    showControls(false);
    pan.showHint();
    seen(scene);
    busy = false;
    // A scene asked for while the opening was being painted.
    if (wanted.id !== scene.config.id) void go(wanted);

    // The reaction frames (and any clips) are not needed for the first seconds, so they load once the
    // opening is over and nothing else is competing for the frame. Then the other scenes' plates, so that
    // moving to one does not wait for its picture; their characters are fetched when they are first opened.
    await scene.loadMore();
    ready = true;
    for (const other of scenes) {
      if (destroyed) return;
      await sceneFor(other).catch((error) => console.warn(`[hjaas] ${other.id}: could not be loaded`, error));
    }
  })();

  return {
    destroy() {
      destroyed = true;
      transition.clear();
      cleanup.forEach((fn) => fn());
      for (const scene of loading.values()) void scene.then((loaded) => loaded.destroy());
      root.remove();
    },
  };
}

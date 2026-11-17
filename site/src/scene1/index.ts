import '@fontsource-variable/bricolage-grotesque';
import './scene.css';
import { PLATE, asset, loadLoopFrames, loadRoom, setAssetBase } from './assets';
import { Counter } from './counter';
import { shower } from './finale';
import { flags } from './flags';
import { ContactForm } from './form';
import { playIntro, type IntroMode } from './intro';
import { Logo } from './logo';
import { onReducedMotionChange, reducedMotion } from './motion';
import { Hunt, SPOTS } from './mushrooms';
import { Pan } from './pan';
import { RachelPlayer } from './player';
import { Rachel } from './rachel';
import { loadReaction, type Reaction } from './reaction';
import { gentleSchedule, hammerSchedule, seeded, type Step } from './schedule';
import { loadProgress, saveProgress } from './state';

export interface Scene1Options {
  /** Folder holding the scene's assets. Defaults to `<site base>/assets/scene1/`. */
  assetBase?: string;
  /** Where the logo links to. Without it the logo is not a link. */
  homeHref?: string;
}

export interface Scene1 {
  destroy(): void;
}

const TOTAL = SPOTS.length;
const HINT_AFTER_S = 60;

// All the words on screen, in one place, until the real copy arrives.
const COPY = {
  prompt: `Find the ${TOTAL} hidden mushrooms`,
  prize: `Find all ${TOTAL} to reach Hui Jie`,
  done: `You found all ${TOTAL}`,
};

/**
 * Mounts scene 1 (the contracting scene) into `host`. Everything the scene needs lives under
 * `.hj-scene`: markup, styles, state and assets. It sizes itself to the host element.
 */
export function mountScene1(host: HTMLElement, options: Scene1Options = {}): Scene1 {
  if (options.assetBase) setAssetBase(options.assetBase);

  const root = document.createElement('section');
  root.className = 'hj-scene is-pre';
  root.setAttribute('aria-label', 'Hui Jie at work. Ten mushrooms are hidden in the room.');
  root.innerHTML = `
    <div class="hj-ambient" aria-hidden="true"></div>
    <div class="hj-stage">
      <div class="hj-hud"></div>
      <div class="hj-viewport">
        <div class="hj-plate">
          <img class="hj-room" alt="" draggable="false" width="${PLATE.w}" height="${PLATE.h}" />
        </div>
      </div>
    </div>
    <div class="hj-fly" aria-hidden="true"></div>
  `;
  host.append(root);

  const q = <T extends HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const viewport = q<HTMLDivElement>('.hj-viewport');
  const plate = q<HTMLDivElement>('.hj-plate');
  const room = q<HTMLImageElement>('.hj-room');
  const hud = q<HTMLDivElement>('.hj-hud');
  const flyLayer = q<HTMLDivElement>('.hj-fly');
  const ambient = q<HTMLDivElement>('.hj-ambient');
  ambient.style.backgroundImage = `url("${asset('room-ambient.webp')}")`;

  let destroyed = false;
  let rachel: Rachel | undefined;
  let player: RachelPlayer | undefined;
  let reaction: Reaction | undefined;
  const cleanup: Array<() => void> = [];
  let debug: Record<string, unknown> | undefined;

  const progress = loadProgress();
  const found = new Set(progress.found.filter((id) => SPOTS.some((spot) => spot.id === id)));
  if (flags.found !== undefined) {
    found.clear();
    for (const spot of SPOTS.slice(0, Math.max(0, Math.min(TOTAL, flags.found)))) found.add(spot.id);
  }
  const save = (): void => {
    if (flags.found !== undefined) return; // a QA preset is never written back
    saveProgress({ ...progress, found: [...found] });
  };

  // QA: with ?debug, every frame that arrives late is logged (start time and length, in ms).
  const jank: Array<[number, number]> = [];
  const longTasks: Array<[number, number]> = [];
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
  }

  const rnd = flags.seed === undefined ? Math.random : seeded(flags.seed);
  const rhythm = (): Iterator<Step> => (reducedMotion() ? gentleSchedule(rnd) : hammerSchedule(rnd));

  const counter = new Counter(TOTAL, found.size);
  hud.append(counter.el);
  counter.measure();
  // A returning visitor who already found them all goes straight to the button.
  if (found.size === TOTAL) counter.unlock(false);
  void document.fonts?.ready.then(() => counter.measure());

  const pan = new Pan(viewport, plate, progress.panned, () => {
    progress.panned = true;
    save();
  });
  cleanup.push(() => pan.destroy());

  const layout = new ResizeObserver(() => {
    // One plate pixel in CSS pixels. Only changes on resize, never during animation.
    plate.style.setProperty('--u', `${plate.clientWidth / PLATE.w}px`);
    rachel?.resize();
    pan.layout();
  });
  layout.observe(plate);
  layout.observe(viewport);

  // The hint: after a minute with no find, one unfound mushroom wiggles once. Time only counts while the tab is visible.
  let quietSeconds = 0;
  let hunt: Hunt | undefined;
  const hintAfter = flags.hintSeconds ?? HINT_AFTER_S;
  let settled = false; // the intro has finished
  const hintClock = window.setInterval(() => {
    if (document.hidden || !settled || !hunt || hunt.remaining === 0) return;
    quietSeconds++;
    if (quietSeconds >= hintAfter) {
      quietSeconds = 0;
      hunt.hint();
    }
  }, 1000);
  cleanup.push(() => window.clearInterval(hintClock));

  let reacting: Promise<void> = Promise.resolve();
  const react = (): Promise<void> => {
    if (!player || !reaction) return Promise.resolve();
    if (player.reacting) return reacting; // already reacting: the find counts, the reaction carries on
    reacting = player.react(reducedMotion() ? reaction.still : reaction.steps);
    return reacting;
  };

  const form = new ContactForm(root, counter.action);
  // A click with detail 0 came from the keyboard: keyboard actions open at once, with no entrance.
  counter.action.addEventListener('click', (event) => form.open(event.detail === 0));

  // 10/10: one last reaction, a short shower of mushrooms, and the counter becomes the way to reach Hui Jie.
  const celebrate = (): void => {
    progress.unlocked = true;
    save();
    const calm = reducedMotion();
    if (!calm) window.setTimeout(() => shower(flyLayer, viewport.getBoundingClientRect()), 160);
    window.setTimeout(
      () => {
        counter.unlock(true);
        counter.say(COPY.done, 4200);
        // Keyboard and screen-reader users land on the prize.
        window.setTimeout(() => counter.action.focus({ preventScroll: true }), calm ? 0 : 600);
      },
      calm ? 400 : 1250,
    );
  };

  void (async () => {
    const [roomImage, frames, logo] = await Promise.all([loadRoom(), loadLoopFrames(), Logo.create(options.homeHref)]);
    if (destroyed) return;
    room.src = roomImage.src;
    await room.decode().catch(() => {});
    rachel = new Rachel(frames);
    const theRachel = rachel;

    hunt = await Hunt.create({
      plate,
      flyLayer,
      found,
      target: () => counter.targetRect(),
      onFind: (spot) => {
        quietSeconds = 0;
        found.add(spot.id);
        save();
        const busy = player?.reacting ?? false;
        const done = react();
        // The last find always gets its own reaction, even if she was still busy with the one before.
        if (found.size === TOTAL && busy) void done.then(() => react());
      },
      onLand: () => {
        const first = counter.current === 0;
        const next = Math.min(TOTAL, counter.current + 1);
        counter.land(next, first && next < TOTAL ? COPY.prize : '');
        if (counter.noteText === COPY.prompt) {
          // The prompt has done its job. Once, briefly, say what the hunt is for.
          if (first && next < TOTAL) counter.say(COPY.prize, 5200);
          else counter.hush();
        }
        if (counter.current === TOTAL) celebrate();
      },
    });
    if (destroyed) return;

    plate.append(rachel.shadow, hunt.el, rachel.el);
    hud.prepend(logo.el);
    rachel.resize();
    logo.prepare();
    counter.prime(found.size === 0 ? COPY.prompt : COPY.prize);
    cleanup.push(() => logo.stop());

    player = new RachelPlayer(rachel, rhythm());
    const thePlayer = player;
    cleanup.push(onReducedMotionChange(() => thePlayer.setLoop(rhythm())));

    // Nothing runs while the tab is hidden; she picks up on the same pose when it comes back.
    let working = false;
    const onVisibility = (): void => {
      if (!working) return;
      if (document.hidden) thePlayer.stop();
      else thePlayer.start();
    };
    document.addEventListener('visibilitychange', onVisibility);
    cleanup.push(() => document.removeEventListener('visibilitychange', onVisibility));

    if (flags.debug) {
      const poses: Array<[string, number]> = [];
      player.onPose = (pose, at) => poses.push([pose, Math.round(at)]);
      debug = { player, rachel, poses, hunt, counter, logo, jank, longTasks, marks: { introStart: 0, introEnd: 0 }, ready: false };
      (window as unknown as { __hj: unknown }).__hj = debug;
    }

    const introMode: IntroMode =
      flags.intro === 'off'
        ? 'off'
        : reducedMotion()
          ? 'reduced'
          : (flags.intro ?? (progress.seenIntro ? 'quick' : 'full'));

    // Let the setup above reach the screen before any motion starts.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (destroyed) return;
    if (debug) (debug.marks as Record<string, number>).introStart = Math.round(performance.now());
    await playIntro(introMode, {
      root,
      plate,
      room,
      roomPixels: roomImage.pixels,
      ambient,
      rachel: theRachel.el,
      shadow: theRachel.shadow,
      mushrooms: hunt.el,
      logo: logo.el,
      counter: counter.el,
      seed: flags.seed,
      onRachel: () => {
        working = true;
        if (!document.hidden) thePlayer.start();
      },
      onLogo: () => {
        logo.glint();
        logo.startIdle();
      },
      onCounter: () => {
        // A new visitor keeps the prompt until the first find; a returning one is reminded what the hunt is for.
        if (found.size === 0) counter.say(COPY.prompt);
        else if (found.size < TOTAL) counter.say(COPY.prize, 6000);
      },
    });
    if (destroyed) return;
    if (debug) (debug.marks as Record<string, number>).introEnd = Math.round(performance.now());
    settled = true;
    pan.showHint(hud);
    if (!progress.seenIntro) {
      progress.seenIntro = true;
      save();
    }

    // The reaction frames are not needed for the first seconds, so they load once the intro is over
    // and nothing else is competing for the frame.
    try {
      reaction = await loadReaction(theRachel);
    } catch (error) {
      console.warn('[hjaas] reaction frames unavailable; finds still count', error);
    }
    if (debug) debug.ready = true;
  })();

  return {
    destroy() {
      destroyed = true;
      player?.stop();
      cleanup.forEach((fn) => fn());
      layout.disconnect();
      root.remove();
    },
  };
}

import '@fontsource-variable/bricolage-grotesque';
import './scene.css';
import { PLATE, asset, loadImage, loadLoopFrames, setAssetBase } from './assets';
import { Counter } from './counter';
import { flags } from './flags';
import { onReducedMotionChange, reducedMotion } from './motion';
import { Hunt, SPOTS } from './mushrooms';
import { RachelPlayer } from './player';
import { Rachel } from './rachel';
import { loadReaction, type Reaction } from './reaction';
import { gentleSchedule, hammerSchedule, seeded, type Step } from './schedule';
import { loadProgress, saveProgress } from './state';

export interface Scene1Options {
  /** Folder holding the scene's assets. Defaults to `<site base>/assets/scene1/`. */
  assetBase?: string;
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
};

/**
 * Mounts scene 1 (the contracting scene) into `host`. Everything the scene needs lives under
 * `.hj-scene`: markup, styles, state and assets. It sizes itself to the host element.
 */
export function mountScene1(host: HTMLElement, options: Scene1Options = {}): Scene1 {
  if (options.assetBase) setAssetBase(options.assetBase);

  const root = document.createElement('section');
  root.className = 'hj-scene';
  root.setAttribute('aria-label', 'Hui Jie at work. Ten mushrooms are hidden in the room.');
  root.innerHTML = `
    <div class="hj-ambient" aria-hidden="true"></div>
    <div class="hj-stage">
      <div class="hj-viewport">
        <div class="hj-plate">
          <img class="hj-room" alt="" draggable="false" width="${PLATE.w}" height="${PLATE.h}" />
        </div>
      </div>
      <div class="hj-hud"></div>
    </div>
    <div class="hj-fly" aria-hidden="true"></div>
  `;
  host.append(root);

  const q = <T extends HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
  const plate = q<HTMLDivElement>('.hj-plate');
  const room = q<HTMLImageElement>('.hj-room');
  const hud = q<HTMLDivElement>('.hj-hud');
  const flyLayer = q<HTMLDivElement>('.hj-fly');
  q<HTMLDivElement>('.hj-ambient').style.backgroundImage = `url("${asset('room-ambient.webp')}")`;

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

  const rnd = flags.seed === undefined ? Math.random : seeded(flags.seed);
  const rhythm = (): Iterator<Step> => (reducedMotion() ? gentleSchedule(rnd) : hammerSchedule(rnd));

  const counter = new Counter(TOTAL, found.size);
  hud.append(counter.el);
  counter.measure();
  void document.fonts?.ready.then(() => counter.measure());

  const layout = new ResizeObserver(() => {
    // One plate pixel in CSS pixels. Only changes on resize, never during animation.
    plate.style.setProperty('--u', `${plate.clientWidth / PLATE.w}px`);
    rachel?.resize();
  });
  layout.observe(plate);

  // The hint: after a minute with no find, one unfound mushroom wiggles once. Time only counts while the tab is visible.
  let quietSeconds = 0;
  let hunt: Hunt | undefined;
  const hintAfter = flags.hintSeconds ?? HINT_AFTER_S;
  const hintClock = window.setInterval(() => {
    if (document.hidden || !hunt || hunt.remaining === 0) return;
    quietSeconds++;
    if (quietSeconds >= hintAfter) {
      quietSeconds = 0;
      hunt.hint();
    }
  }, 1000);
  cleanup.push(() => window.clearInterval(hintClock));

  const react = (): void => {
    if (!player || !reaction) return;
    void player.react(reducedMotion() ? reaction.still : reaction.steps);
  };

  void (async () => {
    const [roomImage, frames] = await Promise.all([loadImage(asset('room.webp')), loadLoopFrames()]);
    if (destroyed) return;
    room.src = roomImage.src;
    rachel = new Rachel(frames);

    hunt = await Hunt.create({
      plate,
      flyLayer,
      found,
      target: () => counter.targetRect(),
      onFind: (spot) => {
        quietSeconds = 0;
        found.add(spot.id);
        save();
        react(); // if she is already reacting, the find still counts and her reaction carries on
      },
      onLand: () => {
        const first = counter.current === 0;
        counter.land(Math.min(TOTAL, counter.current + 1));
        if (counter.noteText === COPY.prompt) {
          // The prompt has done its job. Once, briefly, say what the hunt is for.
          if (first && counter.current < TOTAL) counter.say(COPY.prize, 5200);
          else counter.hush();
        }
      },
    });
    if (destroyed) return;

    plate.append(rachel.shadow, hunt.el, rachel.el);
    rachel.resize();
    root.classList.add('is-ready');

    if (found.size < TOTAL) counter.say(COPY.prompt, found.size === 0 ? undefined : 6000);

    player = new RachelPlayer(rachel, rhythm());
    cleanup.push(onReducedMotionChange(() => player?.setLoop(rhythm())));

    // Nothing runs while the tab is hidden; she picks up on the same pose when it comes back.
    const onVisibility = (): void => {
      if (document.hidden) player?.stop();
      else player?.start();
    };
    document.addEventListener('visibilitychange', onVisibility);
    cleanup.push(() => document.removeEventListener('visibilitychange', onVisibility));

    if (flags.debug) {
      const poses: Array<[string, number]> = [];
      player.onPose = (pose, at) => poses.push([pose, Math.round(at)]);
      debug = { player, rachel, poses, hunt, counter, ready: false };
      (window as unknown as { __hj: unknown }).__hj = debug;
    }
    if (!document.hidden) player.start();

    // The reaction frames are not needed for the first seconds, so they load after the loop is running.
    try {
      reaction = await loadReaction(rachel);
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

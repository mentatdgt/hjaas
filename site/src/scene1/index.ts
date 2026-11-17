import './scene.css';
import { PLATE, asset, loadImage, loadLoopFrames, setAssetBase } from './assets';
import { flags } from './flags';
import { onReducedMotionChange, reducedMotion } from './motion';
import { RachelPlayer } from './player';
import { Rachel } from './rachel';
import { gentleSchedule, hammerSchedule, seeded } from './schedule';

export interface Scene1Options {
  /** Folder holding the scene's assets. Defaults to `<site base>/assets/scene1/`. */
  assetBase?: string;
}

export interface Scene1 {
  destroy(): void;
}

/**
 * Mounts scene 1 (the contracting scene) into `host`. Everything the scene needs lives under
 * `.hj-scene`: markup, styles, state and assets. It sizes itself to the host element.
 */
export function mountScene1(host: HTMLElement, options: Scene1Options = {}): Scene1 {
  if (options.assetBase) setAssetBase(options.assetBase);

  const root = document.createElement('section');
  root.className = 'hj-scene';
  root.setAttribute('aria-label', 'Hui Jie at work');
  root.innerHTML = `
    <div class="hj-ambient" aria-hidden="true"></div>
    <div class="hj-stage">
      <div class="hj-viewport">
        <div class="hj-plate">
          <img class="hj-room" alt="" draggable="false" width="${PLATE.w}" height="${PLATE.h}" />
        </div>
      </div>
    </div>
  `;
  host.append(root);

  const plate = root.querySelector<HTMLDivElement>('.hj-plate')!;
  const room = root.querySelector<HTMLImageElement>('.hj-room')!;
  root.querySelector<HTMLDivElement>('.hj-ambient')!.style.backgroundImage = `url("${asset('room-ambient.webp')}")`;

  let destroyed = false;
  let rachel: Rachel | undefined;
  let player: RachelPlayer | undefined;
  const cleanup: Array<() => void> = [];

  const rnd = flags.seed === undefined ? Math.random : seeded(flags.seed);
  const rhythm = (): Iterator<ReturnType<typeof hammerSchedule> extends Iterator<infer S> ? S : never> =>
    reducedMotion() ? gentleSchedule(rnd) : hammerSchedule(rnd);

  const layout = new ResizeObserver(() => {
    // One plate pixel in CSS pixels. Only changes on resize, never during animation.
    plate.style.setProperty('--u', `${plate.clientWidth / PLATE.w}px`);
    rachel?.resize();
  });
  layout.observe(plate);

  void (async () => {
    const [roomImage, frames] = await Promise.all([loadImage(asset('room.webp')), loadLoopFrames()]);
    if (destroyed) return;
    room.src = roomImage.src;
    rachel = new Rachel(frames);
    plate.append(rachel.shadow, rachel.el);
    rachel.resize();
    root.classList.add('is-ready');

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
      (window as unknown as { __hj: unknown }).__hj = { player, rachel, poses };
    }
    if (!document.hidden) player.start();
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

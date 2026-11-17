import './scene.css';
import { PLATE, asset, loadImage, loadLoopFrames, setAssetBase } from './assets';
import { Rachel } from './rachel';

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
  })();

  return {
    destroy() {
      destroyed = true;
      layout.disconnect();
      root.remove();
    },
  };
}

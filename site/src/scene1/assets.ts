// Asset loading for scene 1. Everything Rachel shows is decoded before it is needed,
// so a pose switch is only ever a draw call.

export const PLATE = { w: 1672, h: 941 } as const;

export type Frame = ImageBitmap | HTMLImageElement;

let base = `${import.meta.env.BASE_URL}assets/scene1/`;

export function setAssetBase(url: string): void {
  base = url.endsWith('/') ? url : `${url}/`;
}

export function asset(path: string): string {
  return base + path;
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}

const frameCache = new Map<string, Promise<Frame>>();

/**
 * A decoded frame. An ImageBitmap made from the file's bytes is decoded off the main thread and keeps its
 * pixels in memory, so loading never stalls an animation and the browser can't evict a pose mid-loop.
 * Each URL is fetched and decoded once; asking again returns the same frame.
 */
export function loadFrame(url: string): Promise<Frame> {
  let frame = frameCache.get(url);
  if (!frame) {
    frame = decodeFrame(url);
    frameCache.set(url, frame);
    frame.catch(() => frameCache.delete(url));
  }
  return frame;
}

async function decodeFrame(url: string): Promise<Frame> {
  if (typeof createImageBitmap === 'function') {
    try {
      const response = await fetch(url);
      if (response.ok) return await createImageBitmap(await response.blob());
    } catch {
      // Fall through to a decoded <img>.
    }
  }
  return loadImage(url);
}

/** The room plate, downloaded and decoded. Resolves with the address to give the scene's <img>. */
export async function loadRoom(): Promise<string> {
  // An <img> request, not fetch(): it is the only kind WebKit matches to the image preload in index.html
  // (a fetch() downloaded the room a second time).
  const img = new Image();
  img.setAttribute('fetchpriority', 'high');
  img.decoding = 'async';
  img.src = asset('room.webp');
  await img.decode();
  return img.src;
}

/** Resolves when the browser has a quiet moment (or soon enough anyway). */
export function idle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout: 400 });
    else setTimeout(resolve, 60);
  });
}

export function frameSize(frame: Frame): { w: number; h: number } {
  return frame instanceof HTMLImageElement
    ? { w: frame.naturalWidth, h: frame.naturalHeight }
    : { w: frame.width, h: frame.height };
}

export const LOOP_FRAMES = ['frame_01', 'frame_02', 'frame_03', 'frame_04', 'blink_half', 'blink_closed'] as const;
export type LoopFrame = (typeof LOOP_FRAMES)[number];

export async function loadLoopFrames(): Promise<Map<string, Frame>> {
  const frames = await Promise.all(LOOP_FRAMES.map((name) => loadFrame(asset(`rachel/${name}.webp`))));
  return new Map(LOOP_FRAMES.map((name, i) => [name, frames[i]]));
}

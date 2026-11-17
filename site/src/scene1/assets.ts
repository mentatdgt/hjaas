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

/** A decoded frame. ImageBitmap keeps its pixels in memory, so the browser can't evict them mid-loop. */
export async function loadFrame(url: string): Promise<Frame> {
  const img = await loadImage(url);
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(img);
    } catch {
      // Fall through to the decoded <img>.
    }
  }
  return img;
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

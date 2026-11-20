// Asset loading. Everything a character shows is decoded before it is needed, so a pose switch is only
// ever a draw call. Paths are relative to the site's assets folder: `shared/…` or a scene's own `scene1/…`.

export const PLATE = { w: 1672, h: 941 } as const;

export type Frame = ImageBitmap | HTMLImageElement;

let base = `${import.meta.env.BASE_URL}assets/`;

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
/** Each frame's file as downloaded, kept so that a frame given back can be decoded again without the network. */
const blobCache = new Map<string, Promise<Blob>>();

function blobOf(url: string): Promise<Blob> {
  let blob = blobCache.get(url);
  if (!blob) {
    blob = fetchBlob(url);
    blobCache.set(url, blob);
    blob.catch(() => blobCache.delete(url));
  }
  return blob;
}

/**
 * A decoded frame. An ImageBitmap made from the file's bytes is decoded in a worker and keeps its pixels in
 * memory, so loading never stalls an animation and the browser can't evict a pose mid-loop.
 * Each URL is fetched once and decoded once; asking again returns the same frame, until unloadFrame().
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

/**
 * Download a frame's file without decoding it: loadFrame() then only has to decode. (A scene's frames are
 * fetched while the scene before it is still on show, and decoded once that one has given its own back.)
 */
export function fetchFrame(url: string): Promise<void> {
  return blobOf(url).then(() => {});
}

/**
 * Give a frame's pixels back (a scene out of sight keeps none). Its downloaded bytes stay, so loadFrame()
 * brings it back by decoding alone. The frame must not be drawn again.
 */
export function unloadFrame(url: string): void {
  const frame = frameCache.get(url);
  if (!frame) return;
  frameCache.delete(url);
  void frame.then(releaseFrame, () => {});
}

async function decodeFrame(url: string): Promise<Frame> {
  try {
    return await decodeBlob(await blobOf(url));
  } catch {
    // The file could not be fetched this way: let an <img> try.
    return loadImage(url);
  }
}

/** A file's bytes, as downloaded: an image kept this way takes a fraction of its decoded size. */
export async function fetchBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.blob();
}

// Decoding happens in a worker, so the page never waits for it. (Measured in WebKit, review 04: decoding
// one of Rachel's lab frames on the page's own thread took about 11 ms and made frames of about 30 ms; in a
// worker the page's frames stayed at 16 to 18 ms.) The worker is one small script, made from the text below,
// and is started the first time something is decoded. Where it cannot run (an old browser, or a host
// page whose rules forbid it), decoding falls back to the page's own thread.
const DECODER = `self.onmessage = async (event) => {
  const { id, blob } = event.data;
  try {
    const bitmap = await createImageBitmap(blob);
    self.postMessage({ id, bitmap }, [bitmap]);
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};`;
let decoder: Worker | null | undefined;
let nextDecode = 0;
const decodes = new Map<number, { resolve: (bitmap: ImageBitmap) => void; reject: (reason: unknown) => void }>();

function startDecoder(): Worker | null {
  try {
    const url = URL.createObjectURL(new Blob([DECODER], { type: 'text/javascript' }));
    const worker = new Worker(url);
    worker.onmessage = (event: MessageEvent<{ id: number; bitmap?: ImageBitmap; error?: string }>) => {
      const waiting = decodes.get(event.data.id);
      decodes.delete(event.data.id);
      if (event.data.bitmap) waiting?.resolve(event.data.bitmap);
      else waiting?.reject(new Error(event.data.error));
    };
    worker.onerror = () => {
      // It could not start, or it broke: everything waiting, and everything after, is decoded on the page.
      decoder = null;
      for (const waiting of decodes.values()) waiting.reject(new Error('decoder unavailable'));
      decodes.clear();
    };
    return worker;
  } catch {
    return null;
  }
}

function decodeInWorker(blob: Blob): Promise<ImageBitmap> {
  if (decoder === undefined) decoder = typeof Worker === 'function' ? startDecoder() : null;
  const worker = decoder;
  if (!worker) return Promise.reject(new Error('decoder unavailable'));
  return new Promise((resolve, reject) => {
    const id = nextDecode++;
    decodes.set(id, { resolve, reject });
    worker.postMessage({ id, blob });
  });
}

/** Decode an image from its downloaded bytes. Give the pixels back with releaseFrame() when done with it. */
export async function decodeBlob(blob: Blob): Promise<Frame> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await decodeInWorker(blob);
    } catch {
      // Fall through to the page's own thread.
    }
    try {
      return await createImageBitmap(blob);
    } catch {
      // Fall through to a decoded <img>.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Give a frame's pixels back to the browser. The frame must not be drawn again. */
export function releaseFrame(frame: Frame): void {
  if (!(frame instanceof HTMLImageElement)) frame.close();
}

/** A scene's plate, downloaded and decoded. Resolves with the address to give the scene's <img>. */
export async function loadPlate(path: string): Promise<string> {
  // An <img> request, not fetch(): it is the only kind WebKit matches to the image preload in index.html
  // (a fetch() downloaded the room a second time).
  const img = new Image();
  img.setAttribute('fetchpriority', 'high');
  img.decoding = 'async';
  img.src = asset(path);
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

/** Decodes the named frames in `dir` (a folder under the assets root, with a trailing slash). */
export async function loadFrames(dir: string, names: readonly string[]): Promise<Map<string, Frame>> {
  const frames = await Promise.all(names.map((name) => loadFrame(asset(`${dir}${name}.webp`))));
  return new Map(names.map((name, i) => [name, frames[i]]));
}

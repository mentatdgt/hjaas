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

const ASSET_DEADLINE_MS = 8000;

/** Required art gets one fresh attempt before the visitor is offered a retry. */
export async function requiredAsset<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch {
    return load();
  }
}

export async function loadImage(url: string, img = new Image()): Promise<HTMLImageElement> {
  img.decoding = 'async';
  img.src = url;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      img.decode(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          img.removeAttribute('src');
          reject(new Error(`${url}: image deadline exceeded`));
        }, ASSET_DEADLINE_MS);
      }),
    ]);
    return img;
  } catch (error) {
    img.removeAttribute('src');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function assetSignal(): AbortSignal {
  return AbortSignal.timeout(ASSET_DEADLINE_MS);
}

/** Compressed bytes can be reused across rooms and are evicted least-recently used. */
const BLOB_CACHE_LIMIT = 192;
const blobCache = new Map<string, Promise<Blob>>();

function blobOf(url: string): Promise<Blob> {
  let blob = blobCache.get(url);
  if (blob) blobCache.delete(url);
  else {
    blob = fetchBlob(url);
    const pending = blob;
    void pending.catch(() => {
      if (blobCache.get(url) === pending) blobCache.delete(url);
    });
  }
  blobCache.set(url, blob);
  if (blobCache.size > BLOB_CACHE_LIMIT) blobCache.delete(blobCache.keys().next().value!);
  return blob;
}

/** One cast owns its decoded frames. Several poses may use the same file. */
export class FrameStore {
  private readonly frames = new Map<string, Promise<Frame>>();

  load(url: string): Promise<Frame> {
    let frame = this.frames.get(url);
    if (!frame) {
      const pending = decodeFrame(url);
      this.frames.set(url, pending);
      void pending.catch(() => {
        if (this.frames.get(url) === pending) this.frames.delete(url);
      });
      frame = pending;
    }
    return frame;
  }

  releaseExcept(keep: ReadonlySet<string>): void {
    for (const [url, frame] of this.frames) {
      if (keep.has(url)) continue;
      this.frames.delete(url);
      void frame.then(releaseFrame, () => {});
    }
  }
}

/** Download a frame without decoding it. */
export function fetchFrame(url: string): Promise<void> {
  return blobOf(url).then(() => {});
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
export async function fetchBlob(url: string, priority?: RequestInit['priority']): Promise<Blob> {
  const response = await fetch(url, { signal: assetSignal(), priority });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.blob();
}

// Decoding happens in a worker, so the page never waits for it. (Measured in WebKit, review 04: decoding
// one of Rachel's lab frames on the page's own thread took about 11 ms and made frames of about 30 ms; in a
// worker the page's frames stayed at 16 to 18 ms.) The worker is one small script, made from the text below,
// and is started the first time something is decoded. Where it cannot run (an old browser, or a host
// page whose rules forbid it), decoding falls back to the page's own thread.
const DECODER = `self.onmessage = async (event) => {
  const { id, blob, crop } = event.data;
  try {
    const bitmap = crop ? await createImageBitmap(blob, crop.x, crop.y, crop.w, crop.h) : await createImageBitmap(blob);
    self.postMessage({ id, bitmap }, [bitmap]);
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};`;
let decoder: Worker | null | undefined;
let decoderUrl: string | undefined;
let assetUsers = 0;
export function retainAssets(): () => void {
  assetUsers++;
  return () => {
    if (--assetUsers > 0) return;
    stopDecoder();
    decoder = undefined;
    blobCache.clear();
  };
}

function stopDecoder(): void {
  decoder?.terminate();
  decoder = null;
  if (decoderUrl) URL.revokeObjectURL(decoderUrl);
  decoderUrl = undefined;
  for (const waiting of decodes.values()) waiting.reject(new Error('decoder unavailable'));
  decodes.clear();
}
let nextDecode = 0;
const decodes = new Map<number, { resolve: (bitmap: ImageBitmap) => void; reject: (reason: unknown) => void }>();

function startDecoder(): Worker | null {
  try {
    decoderUrl = URL.createObjectURL(new Blob([DECODER], { type: 'text/javascript' }));
    const worker = new Worker(decoderUrl);
    worker.onmessage = (event: MessageEvent<{ id: number; bitmap?: ImageBitmap; error?: string }>) => {
      const waiting = decodes.get(event.data.id);
      decodes.delete(event.data.id);
      if (event.data.bitmap) {
        if (waiting) waiting.resolve(event.data.bitmap);
        else event.data.bitmap.close();
      }
      else waiting?.reject(new Error(event.data.error));
    };
    worker.onerror = () => { if (decoder === worker) stopDecoder(); };
    return worker;
  } catch {
    stopDecoder();
    return null;
  }
}

function decodeInWorker(blob: Blob, crop?: Crop): Promise<ImageBitmap> {
  if (assetUsers === 0) return Promise.reject(new Error('decoder unavailable'));
  if (decoder === undefined) decoder = typeof Worker === 'function' ? startDecoder() : null;
  const worker = decoder;
  if (!worker) return Promise.reject(new Error('decoder unavailable'));
  const id = nextDecode++;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return new Promise<ImageBitmap>((resolve, reject) => {
    decodes.set(id, { resolve, reject });
    timeout = setTimeout(() => reject(new Error('decode deadline exceeded')), ASSET_DEADLINE_MS);
    worker.postMessage({ id, blob, crop });
  }).finally(() => {
    clearTimeout(timeout);
    decodes.delete(id);
  });
}

/** A rectangle of an image, in its own pixels. */
interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
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
/**
 * Decode only a rectangle of an image (whole pixels): a small picture cut from a large one, without the
 * page ever holding the large one. Null where the browser cannot do it.
 */
export async function decodePart(blob: Blob, part: Crop): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== 'function') return null;
  const crop = { x: Math.round(part.x), y: Math.round(part.y), w: Math.round(part.w), h: Math.round(part.h) };
  try {
    return await decodeInWorker(blob, crop);
  } catch {
    // Fall through to the page's own thread.
  }
  try {
    return await createImageBitmap(blob, crop.x, crop.y, crop.w, crop.h);
  } catch {
    // Fall through: the whole image, and the part cut from that.
  }
  try {
    const whole = await createImageBitmap(blob);
    try {
      return await createImageBitmap(whole, crop.x, crop.y, crop.w, crop.h);
    } finally {
      whole.close();
    }
  } catch {
    return null;
  }
}

export function releaseFrame(frame: Frame): void {
  if ('close' in frame) frame.close();
}

/** A scene's plate, downloaded and decoded. Resolves with the address to give the scene's <img>. */
export function loadPlate(path: string): Promise<HTMLImageElement> {
  // An <img> request is the only kind WebKit matches to the document's image preload.
  return requiredAsset(() => {
    const img = new Image();
    img.setAttribute('fetchpriority', 'high');
    return loadImage(asset(path), img);
  });
}

/** Warm a single likely room when the browser has time and the opening room is still on show. */
export async function warmPlate(path: string, stillHere: () => boolean): Promise<void> {
  await idle();
  if (!stillHere()) return;
  const img = new Image();
  img.setAttribute('fetchpriority', 'low');
  await loadImage(asset(path), img).catch(() => {});
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

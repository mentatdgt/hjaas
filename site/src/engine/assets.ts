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

/**
 * How long a file may take to arrive before it counts as lost. Long enough for a slow phone: at 400 kbit/s the
 * opening room and her first frames take about 45 s between them, and a request given up on starts again from
 * nothing. (A refused or broken request fails at once, whatever this says.)
 */
const NETWORK_DEADLINE_MS = 60_000;
const DECODE_DEADLINE_MS = 8000;

class DeadlineError extends Error {}

/** Required art gets one fresh attempt before the visitor is offered a retry (but not a second long wait). */
export async function requiredAsset<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof DeadlineError || (error as Error)?.name === 'TimeoutError') throw error;
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
        // (Rejected first: taking the source away makes decode() fail too, in its own words.)
        timeout = setTimeout(() => {
          reject(new DeadlineError(`${url}: image deadline exceeded`));
        }, NETWORK_DEADLINE_MS);
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
  return AbortSignal.timeout(NETWORK_DEADLINE_MS);
}

/** Runs a request under the network deadline, and gives it up at once if `signal` says so. */
async function underDeadline<T>(signal: AbortSignal | undefined, request: (signal: AbortSignal) => Promise<T>): Promise<T> {
  if (!signal) return request(assetSignal());
  const control = new AbortController();
  const deadline = assetSignal();
  const stop = (): void => control.abort(signal.reason);
  const expire = (): void => control.abort(deadline.reason);
  signal.addEventListener('abort', stop, { once: true });
  deadline.addEventListener('abort', expire, { once: true });
  if (signal.aborted) stop();
  try {
    return await request(control.signal);
  } finally {
    signal.removeEventListener('abort', stop);
    deadline.removeEventListener('abort', expire);
  }
}

/** Compressed bytes can be reused across rooms and are evicted least-recently used. */
const BLOB_CACHE_LIMIT = 192;
const blobCache = new Map<string, Promise<Blob>>();

function blobOf(url: string, signal?: AbortSignal): Promise<Blob> {
  let blob = blobCache.get(url);
  if (blob) blobCache.delete(url);
  else {
    blob = fetchBlob(url, undefined, signal);
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
export function fetchFrame(url: string, signal?: AbortSignal): Promise<void> {
  return blobOf(url, signal).then(() => {});
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
export function fetchBlob(url: string, priority?: RequestInit['priority'], signal?: AbortSignal): Promise<Blob> {
  return underDeadline(signal, async (limit) => {
    const response = await fetch(url, { signal: limit, priority });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return response.blob();
  });
}

/** A small JSON file. */
export function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  return underDeadline(signal, async (limit) => {
    const response = await fetch(url, { signal: limit });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return (await response.json()) as T;
  });
}

// Decode off the main thread. Browsers that cannot run the worker decode on the page instead.
let decoder: Worker | null | undefined;
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
  for (const waiting of decodes.values()) waiting.reject(new Error('decoder unavailable'));
  decodes.clear();
}
let nextDecode = 0;
const decodes = new Map<number, { resolve: (bitmap: ImageBitmap) => void; reject: (reason: unknown) => void }>();

function startDecoder(): Worker | null {
  try {
    const worker = new Worker(new URL('./decoder.worker.ts', import.meta.url));
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
    timeout = setTimeout(() => reject(new Error('decode deadline exceeded')), DECODE_DEADLINE_MS);
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

/** How many times a plate has been waited for in vain. */
const stalled = new Map<string, number>();

/** A scene's plate, downloaded and decoded. Resolves with the address to give the scene's <img>. */
export async function loadPlate(path: string): Promise<HTMLImageElement> {
  await warming.get(path)?.catch(() => {});
  // An <img> request is the only kind WebKit matches to the document's image preload.
  // After a stall it is asked for under another address: under its own it would be given the same stalled request,
  // which the document's preload keeps open.
  const again = stalled.get(path);
  return requiredAsset(() => {
    const img = new Image();
    img.setAttribute('fetchpriority', 'high');
    return loadImage(asset(path) + (again ? `?again=${again}` : ''), img);
  }).catch((error) => {
    if (error instanceof DeadlineError) stalled.set(path, (again ?? 0) + 1);
    throw error;
  });
}

/** Rooms being downloaded ahead of time (see warmRoom). */
const warming = new Map<string, Promise<void>>();
/** A download ahead of time that brings nothing for this long is given up: the room's own request starts afresh. */
const WARM_STALL_MS = 8000;

/**
 * Download a room's picture into the browser's own cache, at low priority, and keep nothing of it: the bytes are let
 * go as they arrive and nothing is decoded. Should its scene be asked for meanwhile, loadPlate() waits for this to
 * finish and takes the file from the cache, so that it never crosses the network twice.
 */
export function warmRoom(path: string, signal: AbortSignal): Promise<void> {
  const under = warming.get(path);
  if (under) return under;
  const control = new AbortController();
  const stop = (): void => control.abort();
  const job = (async () => {
    let stall: ReturnType<typeof setTimeout> | undefined;
    const alive = (): void => {
      clearTimeout(stall);
      stall = setTimeout(stop, WARM_STALL_MS);
    };
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop();
    try {
      alive();
      const response = await fetch(asset(path), { signal: control.signal, priority: 'low' });
      const body = response.body?.getReader();
      if (!body) return;
      while (!(await body.read()).done) alive();
    } finally {
      clearTimeout(stall);
      signal.removeEventListener('abort', stop);
      warming.delete(path);
    }
  })();
  warming.set(path, job);
  return job;
}

/**
 * Whether this browser keeps a room it has downloaded: asked of its cache alone, never of the network. A private tab
 * in Safari (and some apps' own browsers) keeps nothing of what fetch() brings, and a room fetched ahead there would
 * be downloaded twice.
 */
export async function keepsRooms(path: string): Promise<boolean> {
  const control = new AbortController();
  try {
    const { ok } = await fetch(asset(path), { cache: 'only-if-cached', mode: 'same-origin', signal: control.signal });
    return ok;
  } catch {
    return false;
  } finally {
    // (The answer is enough.)
    control.abort();
  }
}

/** The visitor has asked the browser to use less data. */
export function savesData(): boolean {
  const { connection } = navigator as Navigator & { connection?: { saveData?: boolean } };
  return connection?.saveData === true || matchMedia('(prefers-reduced-data: reduce)').matches;
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

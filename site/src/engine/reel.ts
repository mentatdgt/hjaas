// A character's clips, kept in memory the cheap way.
//
// Rachel's lab clips are 84 patches which, all decoded, take about 205 MB at full size: more than an older
// phone will give one page. So a patch is kept as it was downloaded (about 9 MB for all of them), decoded
// only shortly before it is shown, and its pixels are given back as soon as it is no longer wanted.
//
// Two lists say what is wanted. The routine's is short and moves with her: each step names the frames that
// may follow it (clips.ts, `soon`). The reaction's is fixed: it can start at any moment, so its frames stay
// decoded for as long as the scene is on show. When the visitor leaves for another scene the reel sleeps
// and gives everything back except the frame she is standing on.
import { decodeBlob, frameSize, releaseFrame } from './assets';
import type { Character } from './character';

/** A patch as downloaded: its bytes, and where it goes (see Patch in character.ts). */
export interface PatchSource {
  blob: Blob;
  base: string;
  x: number;
  y: number;
}

export class Reel {
  private readonly character: Character;
  private readonly sources = new Map<string, PatchSource>();
  /** Decoded poses, and the bytes each one's pixels take. */
  private readonly decoded = new Map<string, number>();
  private readonly failed = new Set<string>();
  private wanted: readonly string[] = [];
  private pinned: readonly string[] = [];
  private awake = false;
  private decoding = false;
  private released = false;
  /** The most the decoded patches have taken at one time, in bytes. */
  peak = 0;

  constructor(character: Character) {
    this.character = character;
  }

  /** A patch has been downloaded. */
  add(pose: string, source: PatchSource): void {
    if (this.released) return;
    this.sources.set(pose, source);
    void this.pump();
  }

  /** The routine's list: the frames that may be shown soon, soonest first. It replaces the last list. */
  want(poses: readonly string[]): void {
    this.wanted = poses;
    this.tidy();
    void this.pump();
  }

  /** The frames to keep decoded for as long as the reel is awake. */
  pin(poses: readonly string[]): void {
    this.pinned = poses;
    this.tidy();
    void this.pump();
  }

  /** True when every one of these poses can be shown now. */
  ready(poses: readonly string[]): boolean {
    return poses.every((pose) => this.decoded.has(pose));
  }

  /** The scene is on show: decode what is wanted. */
  wake(): void {
    if (this.awake) return;
    this.awake = true;
    void this.pump();
  }

  /** The scene is out of sight: give the pixels back. What was wanted is remembered for wake(). */
  sleep(): void {
    this.awake = false;
    this.tidy();
  }

  release(): void {
    this.released = true;
    this.awake = false;
    for (const pose of this.decoded.keys()) this.character.dropPatch(pose, true);
    this.decoded.clear();
    this.sources.clear();
  }

  /** What the decoded patches take now, in bytes. */
  get bytes(): number {
    let sum = 0;
    for (const size of this.decoded.values()) sum += size;
    return sum;
  }

  private needed(): string[] {
    return this.awake ? [...this.wanted, ...this.pinned] : [];
  }

  /** Give back every decoded patch that is no longer wanted. The pose on her canvas is always kept. */
  private tidy(): void {
    const keep = new Set(this.needed());
    keep.add(this.character.current);
    for (const pose of [...this.decoded.keys()]) {
      if (keep.has(pose)) continue;
      this.character.dropPatch(pose);
      this.decoded.delete(pose);
    }
  }

  /** Decode what is wanted and not yet there, one patch at a time, soonest first. */
  private async pump(): Promise<void> {
    if (this.decoding) return;
    this.decoding = true;
    try {
      for (;;) {
        const pose = this.needed().find((name) => !this.decoded.has(name) && this.sources.has(name) && !this.failed.has(name));
        if (!pose) return;
        const source = this.sources.get(pose)!;
        try {
          const frame = await decodeBlob(source.blob);
          // The list may have moved on while this one was being decoded.
          if (!this.needed().includes(pose)) {
            releaseFrame(frame);
            continue;
          }
          this.character.addPatch(pose, { base: source.base, x: source.x, y: source.y, frame });
          const { w, h } = frameSize(frame);
          this.decoded.set(pose, w * h * 4);
          this.peak = Math.max(this.peak, this.bytes);
        } catch (error) {
          // She simply never shows this frame: the one before it stays up a little longer.
          this.failed.add(pose);
          console.warn(`[hjaas] the frame "${pose}" could not be decoded`, error);
        }
      }
    } finally {
      this.decoding = false;
    }
  }
}

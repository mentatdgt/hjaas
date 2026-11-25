// The reaction (look up -> beam -> thumbs-up -> back to work) is data. Wren's reaction.json lists the
// frames and their hold times; new in-betweens or the wink (tasks/015) arrive as a new manifest plus
// image files, with no code changes.
import { asset, fetchJson, idle } from './assets';
import type { Step } from './steps';

interface ReactionManifest {
  canvas?: [number, number];
  frames: Array<{ file: string; ms: number; beat?: string }>;
}

export interface Reaction {
  /** The full motion. */
  steps: Step[];
  /** Paused or reduced motion: only the held pose, so she acknowledges the find without the head and arm travel. */
  still: Step[];
}

/**
 * Loads the manifest and decodes every frame it names. Resolves once the reaction is ready to play.
 * `sceneDir` is the scene's assets folder and `dir` the reaction's folder inside it (both end in a slash).
 */
export async function loadReaction(
  sceneDir: string,
  dir: string,
  active: () => boolean,
  loadPose: (pose: string, url: string) => Promise<void>,
  signal?: AbortSignal,
): Promise<Reaction | null> {
  const DIR = sceneDir + dir;
  const sharing = loadShared(DIR, signal);
  const manifest = await fetchJson<ReactionManifest>(asset(`${DIR}reaction.json`), signal);
  const shared = await sharing;

  // Frames with ms 0 only mark where the loop hands over and takes back (the contact frame).
  const held = manifest.frames.filter((frame) => frame.ms > 0);
  const files = [...new Set(held.map((frame) => frame.file))];
  // One at a time, in quiet moments: Rachel is already hammering while these arrive.
  for (const file of files) {
    await idle();
    if (!active()) return null;
    // The site serves WebP copies of the delivered PNGs. A copy shared with the loop is the loop's own decoded frame.
    const url = asset(file in shared ? sceneDir + shared[file] : DIR + file.replace(/\.png$/i, '.webp'));
    await loadPose(poseName(file), url);
  }

  const steps = held.map((frame) => ({ pose: poseName(frame.file), ms: frame.ms }));
  return active() ? { steps, still: stillOf(steps) } : null;
}

/** Reaction files that are byte-identical to an upscaled frame, mapped to that one copy (made by `npm run assets`). */
async function loadShared(DIR: string, signal?: AbortSignal): Promise<Record<string, string>> {
  try {
    return await fetchJson<Record<string, string>>(asset(`${DIR}shared.json`), signal);
  } catch {
    return {};
  }
}

/**
 * The pose the reaction holds longest (the thumbs-up), for as long as the manifest stays with it: from its
 * first appearance to its last, including whatever plays inside the hold (the wink).
 */
function stillOf(steps: Step[]): Step[] {
  if (steps.length === 0) return [];
  const longest = steps.reduce((a, b) => (b.ms > a.ms ? b : a));
  const first = steps.findIndex((step) => step.pose === longest.pose);
  const last = steps.map((step) => step.pose).lastIndexOf(longest.pose);
  const ms = steps.slice(first, last + 1).reduce((sum, step) => sum + step.ms, 0);
  return [{ pose: longest.pose, ms }];
}

function poseName(file: string): string {
  return `reaction/${file}`;
}

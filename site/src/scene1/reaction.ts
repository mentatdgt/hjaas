// The reaction (look up -> beam -> thumbs-up -> back to work) is data. Wren's reaction.json lists the
// frames and their hold times; new in-betweens or the wink (tasks/015) arrive as a new manifest plus
// image files, with no code changes.
import { asset, idle, loadFrame } from './assets';
import type { Rachel } from './rachel';
import type { Step } from './schedule';

interface ReactionManifest {
  canvas?: [number, number];
  frames: Array<{ file: string; ms: number; beat?: string }>;
}

export interface Reaction {
  /** The full motion. */
  steps: Step[];
  /** Reduced motion: only the held pose, so she acknowledges the find without the head and arm travel. */
  still: Step[];
}

const DIR = 'rachel/reaction/';

/** Loads the manifest and decodes every frame it names. Resolves once the reaction is ready to play. */
export async function loadReaction(rachel: Rachel): Promise<Reaction> {
  const response = await fetch(asset(`${DIR}reaction.json`));
  if (!response.ok) throw new Error(`reaction.json: ${response.status}`);
  const manifest = (await response.json()) as ReactionManifest;

  // Frames with ms 0 only mark where the loop hands over and takes back (the contact frame).
  const held = manifest.frames.filter((frame) => frame.ms > 0);
  const files = [...new Set(held.map((frame) => frame.file))];
  // One at a time, in quiet moments: Rachel is already hammering while these arrive.
  for (const file of files) {
    await idle();
    // The site serves WebP copies of the delivered PNGs.
    rachel.add(poseName(file), await loadFrame(asset(DIR + file.replace(/\.png$/i, '.webp'))));
  }

  const steps = held.map((frame) => ({ pose: poseName(frame.file), ms: frame.ms }));
  const longest = steps.reduce((a, b) => (b.ms > a.ms ? b : a), steps[0]);
  return { steps, still: longest ? [longest] : [] };
}

function poseName(file: string): string {
  return `reaction/${file}`;
}

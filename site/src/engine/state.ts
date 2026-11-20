// Per-visitor progress, kept in localStorage. Storage can be blocked or full, so every access is guarded
// and the site works the same without it (progress just lasts for the visit).
import { flags } from './flags';

const KEY = 'hjaas:site:v2';
/** Scene 1 on its own, before there were scenes to move between. Read once, to carry progress over. */
const KEY_V1 = 'hjaas:scene1:v1';

export interface SceneProgress {
  found: string[];
  /** The scene has been painted in for this visitor, so it is not painted in full again. */
  seen: boolean;
  /** Where they left the room on a phone: the plate x at the middle of the window. Null until they pan. */
  panX: number | null;
}

export interface Progress {
  /** By scene id. */
  scenes: Record<string, SceneProgress>;
  /** Some scene has reached 10 of 10: the Contact button is theirs, in every scene, for good. */
  unlocked: boolean;
  /** The visitor has panned a room on a phone, so the swipe hint is not shown again. */
  panned: boolean;
}

export const freshScene = (): SceneProgress => ({ found: [], seen: false, panX: null });
const empty = (): Progress => ({ scenes: {}, unlocked: false, panned: false });

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
const position = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

export function loadProgress(): Progress {
  try {
    if (flags.reset) {
      localStorage.removeItem(KEY);
      localStorage.removeItem(KEY_V1);
    }
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw) as Partial<Progress>;
      const scenes: Record<string, SceneProgress> = {};
      for (const [id, scene] of Object.entries(data.scenes ?? {})) {
        scenes[id] = { found: strings(scene?.found), seen: scene?.seen === true, panX: position(scene?.panX) };
      }
      return { scenes, unlocked: data.unlocked === true, panned: data.panned === true };
    }
    // Progress from before the scene menu belongs to scene 1 ("build").
    const old = localStorage.getItem(KEY_V1);
    if (!old) return empty();
    const v1 = JSON.parse(old) as Record<string, unknown>;
    return {
      scenes: { build: { found: strings(v1.found), seen: v1.seenIntro === true, panX: position(v1.panX) } },
      unlocked: v1.unlocked === true,
      panned: v1.panned === true,
    };
  } catch {
    return empty();
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Private mode or a full disk: carry on without saving.
  }
}

// Per-visitor progress, kept in localStorage. Storage can be blocked or full, so every access is guarded
// and the scene works the same without it (progress just lasts for the visit).
import { flags } from './flags';

const KEY = 'hjaas:scene1:v1';

export interface Progress {
  found: string[];
  unlocked: boolean;
  seenIntro: boolean;
  /** The visitor has panned the room on a phone, so the swipe hint is not shown again. */
  panned: boolean;
  /** Where they left the room on a phone: the plate x at the middle of the window. Null until they pan. */
  panX: number | null;
}

const empty = (): Progress => ({ found: [], unlocked: false, seenIntro: false, panned: false, panX: null });

export function loadProgress(): Progress {
  try {
    if (flags.reset) localStorage.removeItem(KEY);
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw) as Partial<Progress>;
    return {
      found: Array.isArray(data.found) ? data.found.filter((id): id is string => typeof id === 'string') : [],
      unlocked: data.unlocked === true,
      seenIntro: data.seenIntro === true,
      panned: data.panned === true,
      panX: typeof data.panX === 'number' && Number.isFinite(data.panX) ? data.panX : null,
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

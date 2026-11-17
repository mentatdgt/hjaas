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
}

const empty = (): Progress => ({ found: [], unlocked: false, seenIntro: false, panned: false });

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

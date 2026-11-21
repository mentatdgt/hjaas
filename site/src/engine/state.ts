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
  /**
   * Every mushroom of every scene is found: the Contact button is theirs. Never trusted when read back: the
   * page works it out from the finds (unlockedBy) and only ever saves what that says. (Before scene 5 it was
   * set by the first scene to reach 10 of 10; a saved `true` from then means nothing now.)
   */
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

// ---- The hunt across the whole site. Pure, so the rules can be checked without a page. ----

/** A scene as the hunt sees it: its id, and its hiding spots in order. */
export interface HuntScene {
  id: string;
  spots: ReadonlyArray<{ id: string }>;
}

/** How many mushrooms the site has, and how many of them are found. `found` gives a scene's finds by its id. */
export function siteCount(scenes: readonly HuntScene[], found: (id: string) => ReadonlySet<string>): { found: number; total: number } {
  let count = 0;
  let total = 0;
  for (const scene of scenes) {
    const mine = found(scene.id);
    total += scene.spots.length;
    count += scene.spots.filter((spot) => mine.has(spot.id)).length;
  }
  return { found: count, total };
}

/** The Contact button is earned once every mushroom in every scene is found (BIBLE section 1, 2026-11-21). */
export function unlockedBy(scenes: readonly HuntScene[], found: (id: string) => ReadonlySet<string>): boolean {
  const { found: count, total } = siteCount(scenes, found);
  return total > 0 && count === total;
}

/**
 * QA (`?all=N`): the first N hiding spots of the whole site, scene by scene in menu order, each scene's in
 * its own order. N is held to 0 and the site's total.
 */
export function presetAll(scenes: readonly HuntScene[], n: number): Record<string, string[]> {
  let left = Math.max(0, Math.floor(n));
  const out: Record<string, string[]> = {};
  for (const scene of scenes) {
    const take = Math.min(left, scene.spots.length);
    out[scene.id] = scene.spots.slice(0, take).map((spot) => spot.id);
    left -= take;
  }
  return out;
}

/** The words the line beside the count is made from (the copy itself lives in site.ts). */
export interface NoteCopy {
  /** Nothing found here yet: what to look for. */
  prompt: (here: number) => string;
  /** Some found here: what the hunt is for, counting the whole site. */
  prize: (site: number) => string;
  /** All found here, some still to find elsewhere: how many, and where. */
  doneHere: (here: number, elsewhere: number) => string;
  /** Every mushroom of the site found. */
  done: (here: number) => string;
}

/** The line beside a scene's count, from this scene's finds and the whole site's. */
export function noteFor(copy: NoteCopy, count: number, of: number, site: { found: number; total: number }): string {
  if (count >= of) return site.found >= site.total ? copy.done(of) : copy.doneHere(of, site.total - site.found);
  return count === 0 ? copy.prompt(of) : copy.prize(site.total);
}

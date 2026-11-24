// Per-visitor progress, kept in localStorage. Storage can be blocked or full, so every access is guarded
// and the site works the same without it (progress just lasts for the visit).

const KEY = 'hjaas:site:v2';
const PREFIX = 'hjaas:site:v3:';
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
   * page works it out from the finds (unlockedBy). (Before scene 5 it was
   * set by the first scene to reach 10 of 10; a saved `true` from then means nothing now.)
   */
  unlocked: boolean;
  /** The visitor has panned a room on a phone, so the room does not drift to show that it can be. */
  panned: boolean;
}

export const freshScene = (): SceneProgress => ({ found: [], seen: false, panX: null });
const empty = (): Progress => ({ scenes: Object.create(null), unlocked: false, panned: false });

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
const position = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function readLegacy(): Progress {
  const value = localStorage.getItem(KEY);
  if (value) {
    const data = JSON.parse(value) as Partial<Progress>;
    const scenes: Record<string, SceneProgress> = Object.create(null);
    for (const [id, scene] of Object.entries(data.scenes ?? {})) {
      scenes[id] = { found: strings(scene?.found), seen: scene?.seen === true, panX: position(scene?.panX) };
    }
    return { scenes, unlocked: false, panned: data.panned === true };
  }
  const old = localStorage.getItem(KEY_V1);
  if (!old) return empty();
  const v1 = JSON.parse(old) as Record<string, unknown>;
  return {
    scenes: { build: { found: strings(v1.found), seen: v1.seenIntro === true, panX: position(v1.panX) } },
    unlocked: false,
    panned: v1.panned === true,
  };
}

const sceneKey = (id: string, kind: 'found' | 'pan' | 'seen'): string =>
  `${PREFIX}${kind}:${encodeURIComponent(id)}`;
const findKey = (scene: string, spot: string): string => `${sceneKey(scene, 'found')}:${encodeURIComponent(spot)}`;

export function resetProgress(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(KEY_V1);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Storage is optional.
  }
}

export function isProgressKey(key: string | null): boolean {
  return key === null || key === KEY || key === KEY_V1 || key.startsWith(PREFIX);
}

export function loadProgress(scenes: readonly HuntScene[]): Progress {
  let progress = empty();
  try {
    progress = readLegacy();
  } catch {
    // A damaged legacy snapshot does not affect the new records.
  }
  for (const scene of scenes) {
    const state = Object.hasOwn(progress.scenes, scene.id) ? progress.scenes[scene.id] : freshScene();
    const valid = new Set(scene.spots.map((spot) => spot.id));
    const renamed = (id: string): string => scene.replaced && Object.hasOwn(scene.replaced, id) ? scene.replaced[id] : id;
    const finds = new Set(state.found.map(renamed).filter((id) => valid.has(id)));
    try {
      for (const id of [...valid, ...Object.keys(scene.replaced ?? {})]) {
        if (valid.has(renamed(id)) && localStorage.getItem(findKey(scene.id, id)) === '1') finds.add(renamed(id));
      }
      state.seen ||= localStorage.getItem(sceneKey(scene.id, 'seen')) === '1';
      const pan = localStorage.getItem(sceneKey(scene.id, 'pan'));
      if (pan !== null && Number.isFinite(Number(pan))) {
        state.panX = Number(pan);
        progress.panned = true;
      }
    } catch {
      // The legacy state, or progress held by the caller, is still usable.
    }
    state.found = [...finds];
    progress.scenes[scene.id] = state;
  }
  progress.unlocked = unlockedBy(scenes, (id) => new Set(progress.scenes[id]?.found));
  return progress;
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or a full disk: carry on without saving.
  }
}

// Each find is its own atomic write. Two tabs can save different mushrooms concurrently.
export const saveFind = (scene: string, spot: string): void => write(findKey(scene, spot), '1');
export const saveSeen = (scene: string): void => write(sceneKey(scene, 'seen'), '1');
export const savePan = (scene: string, centreX: number): void => write(sceneKey(scene, 'pan'), String(centreX));

// ---- The hunt across the whole site. Pure, so the rules can be checked without a page. ----

/** A scene as the hunt sees it: its id, and its hiding spots in order. */
export interface HuntScene {
  id: string;
  spots: ReadonlyArray<{ id: string }>;
  replaced?: Readonly<Record<string, string>>;
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

/** A scene as the counter sees it: the hunt's scene, and its name in the menu. */
export interface NamedScene extends HuntScene {
  label: string;
}

/**
 * Everything the page shows of the hunt: the two counters, the dots on the menu's tabs, the "Next" link and the
 * Contact button. All of it is worked out here, from the one set of finds, so no two parts of the page can
 * disagree (reviews/hunt-counter-build.md, section 2).
 */
export interface HuntView {
  /** This scene's name in the menu. */
  label: string;
  /** The cream counter: this scene. */
  here: { found: number; total: number };
  /** The red counter: the sum of every scene's finds. */
  site: { found: number; total: number };
  /** The scenes with nothing left to find: the tabs with a dot. */
  done: readonly string[];
  /** The next scene in the menu (round to the first) with something left to find, or null if there is none. */
  next: { id: string; label: string } | null;
  unlocked: boolean;
}

export function huntView(scenes: readonly NamedScene[], found: (id: string) => ReadonlySet<string>, hereId: string): HuntView {
  const at = scenes.findIndex((scene) => scene.id === hereId);
  const here = scenes[at];
  const left = (scene: HuntScene): number => {
    const count = siteCount([scene], found);
    return count.total - count.found;
  };
  const others = [...scenes.slice(at + 1), ...scenes.slice(0, at)];
  const next = others.find((scene) => left(scene) > 0);
  return {
    label: here.label,
    here: siteCount([here], found),
    site: siteCount(scenes, found),
    done: scenes.filter((scene) => scene.spots.length > 0 && left(scene) === 0).map((scene) => scene.id),
    next: next ? { id: next.id, label: next.label } : null,
    unlocked: unlockedBy(scenes, found),
  };
}

/** The words beside the two counters (the copy itself lives in site.ts). */
export interface CounterCopy {
  /** Under half of this scene found, half or more found, and all of it. */
  hereFound: (scene: string) => string;
  hereMore: (left: number, scene: string) => string;
  hereDone: (scene: string) => string;
  /** More than half of the site left, half or less left, and none. */
  siteAll: (total: number) => string;
  siteMore: (left: number) => string;
  siteDone: (total: number) => string;
}

/** The cream counter's label: what has been found, and from halfway on, what is left. */
export function hereLabel(copy: CounterCopy, scene: string, { found, total }: { found: number; total: number }): string {
  const left = total - found;
  if (left <= 0) return copy.hereDone(scene);
  return found < left ? copy.hereFound(scene) : copy.hereMore(left, scene);
}

/** The red counter's label. */
export function siteLabel(copy: CounterCopy, { found, total }: { found: number; total: number }): string {
  const left = total - found;
  if (left <= 0) return copy.siteDone(total);
  return left > total / 2 ? copy.siteAll(total) : copy.siteMore(left);
}

/** How much of a mushroom is full: the stem over the first `stemAt` finds, the cap over the rest. 0 to 1 each. */
export function fillOf(found: number, total: number, stemAt: number): { stem: number; cap: number } {
  const part = (n: number, of: number): number => Math.min(1, Math.max(0, n / of));
  return { stem: part(found, stemAt), cap: part(found - stemAt, total - stemAt) };
}

/** The stem's share of the finds: 3 of a scene's 10, 15 of the site's 50. */
export const stemFinds = (total: number): number => Math.round(total * 0.3);

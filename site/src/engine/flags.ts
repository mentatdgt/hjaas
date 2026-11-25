// Switches read from the page URL. They exist for QA and for Wren's reviews; visitors never need them.
//   ?seed=7        repeatable hammer rhythm and brush strokes
//   ?intro=quick   the 200 ms reveal, and the brush-over for every switch   (off: no painting at all; full: as without it)
//   ?reset         forget saved progress before starting
//   ?found=9       start with this many mushrooms already found in the opening scene (not saved)
//   ?all=49        start with this many found across the whole site, scene by scene in menu order (not saved).
//                  With both, ?all wins. `?all=49#set` leaves only Set Design's last mushroom to find.
//   ?hint=5        seconds before the hint wiggle (default 60)
//   ?slow=5        play the UI motion (GSAP) this many times slower, for frame-by-frame review
//   ?edge=organic  the painting's edge: pencil (the one that ships) | organic | a-round | a | b | c, for comparison
//   ?debug         outline mushroom hit areas and expose window.__hj
// Production builds ignore them all: `?all=50` would otherwise skip the hunt and open the form.

const params = new URLSearchParams(import.meta.env.DEV && typeof location !== 'undefined' ? location.search : '');

const num = (key: string): number | undefined => {
  const raw = params.get(key);
  if (raw === null || raw === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
};

export const flags = {
  seed: num('seed'),
  intro: params.get('intro') as 'full' | 'quick' | 'off' | null,
  reset: params.has('reset'),
  found: num('found'),
  all: num('all'),
  hintSeconds: num('hint'),
  slow: num('slow'),
  edge: params.get('edge'),
  debug: params.has('debug'),
};

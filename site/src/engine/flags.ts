// Switches read from the page URL. They exist for QA and for Wren's reviews; visitors never need them.
//   ?seed=7        repeatable hammer rhythm and brush strokes
//   ?intro=full    force the first-visit painting   (quick: the 200 ms reveal of a return visit | off: no intro)
//   ?reset         forget saved progress before starting
//   ?found=9       start with this many mushrooms already found (not saved)
//   ?hint=5        seconds before the hint wiggle (default 60)
//   ?slow=5        play the UI motion (GSAP) this many times slower, for frame-by-frame review
//   ?edge=b        the painting's edge: organic (the one that ships) | a-round | a | b | c, for comparison
//   ?debug         outline mushroom hit areas and expose window.__hj
// Production builds ignore them all: `?found=10` would otherwise skip the hunt and open the form.

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
  hintSeconds: num('hint'),
  slow: num('slow'),
  edge: params.get('edge'),
  debug: params.has('debug'),
};

// Switches read from the page URL. They exist for QA and for Wren's reviews; visitors never need them.
//   ?seed=7        repeatable hammer rhythm and intro strokes
//   ?intro=full    force the full intro   (quick | off also work)
//   ?reset         forget saved progress before starting
//   ?found=9       start with this many mushrooms already found (not saved)
//   ?hint=5        seconds before the hint wiggle (default 60)
//   ?slow=5        play the UI motion (GSAP) this many times slower, for frame-by-frame review
//   ?debug         outline mushroom hit areas and expose window.__hj
//   ?fakesend      pretend the contact form sends (dev builds do this by default)

const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

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
  debug: params.has('debug'),
  fakeSend: params.has('fakesend'),
};

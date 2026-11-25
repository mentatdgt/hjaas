// The page's paper colour, and waiting for the stylesheet that sets it.
//
// WebKit (every browser on an iPad) runs a module script before a stylesheet that is still on its way; Chrome and
// Firefox wait for it. Until it is here the page's background computes to `rgba(0, 0, 0, 0)`, which read as a colour is
// black: the edge was drawn with black paper (reviews/logo-black-edge-01.md). So nothing is mounted before the
// stylesheet is here, and a background that is not a solid colour is never taken for the paper.

export type Rgb = [number, number, number];

/** The paper: `--hj-paper` in site.css. */
export const PAPER: Readonly<Rgb> = [246, 243, 236];

/** The paper in a computed `background-color`: the colour it names, or PAPER if it names none or a see-through one. */
export function paperFrom(css: string): Rgb {
  const parts = css.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  const alpha = parts?.[4] === undefined ? 1 : parseFloat(parts[4]) / (parts[4].endsWith('%') ? 100 : 1);
  return parts && alpha === 1 ? [Number(parts[1]), Number(parts[2]), Number(parts[3])] : [...PAPER];
}

export const paperOf = (el: Element): Rgb => paperFrom(getComputedStyle(el).backgroundColor);
/** The same, for a canvas's fill or a style. */
export const paperCss = (el: Element): string => `rgb(${paperOf(el).join(', ')})`;

/**
 * Resolves when every stylesheet the document links to is here (or has failed). At the latest when the document has
 * loaded: an address that failed before anyone listened is never waited for after that.
 */
export function stylesheets(doc: Document = document): Promise<void> {
  const waiting = [...doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].filter((link) => !link.sheet);
  if (!waiting.length || doc.readyState === 'complete') return Promise.resolve();
  const each = waiting.map(
    (link) =>
      new Promise<void>((resolve) => {
        link.addEventListener('load', () => resolve(), { once: true });
        link.addEventListener('error', () => resolve(), { once: true });
      }),
  );
  const loaded = new Promise<void>((resolve) => doc.defaultView?.addEventListener('load', () => resolve(), { once: true }));
  return Promise.race([Promise.all(each).then(() => {}), loaded]);
}

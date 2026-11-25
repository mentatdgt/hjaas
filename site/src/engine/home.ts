/** Two addresses of the same page: only what follows `?` or `#` differs (and a folder is its own index.html). */
export function samePage(a: string | URL, b: string | URL): boolean {
  const [x, y] = [new URL(a), new URL(b)];
  const path = (url: URL): string => url.pathname.replace(/\/index\.html$/, '/');
  return x.origin === y.origin && path(x) === path(y);
}

/** An ordinary tap, click or Enter on a link: not one that asks for a new tab or window, a download, or a menu. */
export const plainClick = (event: Pick<MouseEvent, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'defaultPrevented'>): boolean =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.defaultPrevented;

// What the caption shows, read from the page: for every QA tool that asks "how many found" or "is the button there".
//   const c = await page.evaluate(CAPTION);   // { here: '3/10', site: '13/50', hereLabel, siteLabel, counterShown, contactShown, next, dots, note, said, text }
// The counters are the two-mushroom ones (src/engine/caption.ts). Runs in the page, so it uses nothing from here.
export const CAPTION = () => {
  const text = (s) => document.querySelector(s)?.textContent.replace(/\s+/g, ' ').trim() ?? null;
  const seen = (s) => { const el = document.querySelector(s); return !!el && getComputedStyle(el).visibility === 'visible' && el.getClientRects().length > 0; };
  const row = (k) => ({ n: `${text(`.hj-row.is-${k} .hj-num-now`)}${text(`.hj-row.is-${k} .hj-num-of`)}`, label: text(`.hj-row.is-${k} .hj-label`) });
  const here = row('cream'); const site = row('red');
  const contactShown = seen('.hj-contact'); const counterShown = seen('.hj-row');
  const next = document.querySelector('.hj-next');
  return {
    here: here.n, hereLabel: here.label, site: site.n, siteLabel: site.label, counterShown, contactShown,
    next: seen('.hj-next') ? next.getAttribute('href') : null,
    dots: [...document.querySelectorAll('.hj-tab.is-done')].map((t) => t.dataset.scene),
    note: contactShown ? text('.hj-prize-note') : null,
    said: text('.hj-caption-main [role=status]'),
    text: contactShown && !counterShown ? `${text('.hj-contact')} · ${text('.hj-prize-note')}` : `${here.n} ${here.label} · ${site.n} ${site.label}`,
  };
};
/** For waitForFunction: the "Contact Hui Jie" button has come. */
export const CONTACT_SHOWN = () => { const el = document.querySelector('.hj-contact'); return !!el && getComputedStyle(el).visibility === 'visible'; };

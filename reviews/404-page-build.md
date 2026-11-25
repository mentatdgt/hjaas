# Build brief: the 404 page (Rachel sketching)

**Approved by the user 2026-11-25.** Art: Quinn 044 (table), 045 + 046 (poses). Packaged by Wren, checked in a real browser at desktop, phone and reduced-motion sizes.

## What it is
A custom "page not found" page. A huge solid black **404** (Anton, as a vector path, no font download) with Rachel standing in front of it at her drafting table, quietly sketching in a 3.6 s loop: three short pencil strokes, two small hatching marks, a pause with a blink, one more stroke, a rest. Below it, one line of text and a link home.

## Where things go
- `frames/031-404-sketch/package/` holds everything. Copy these files, unchanged, to `site/public/assets/404/`: `figure.webp`, `arm-S1.webp` … `arm-S5.webp`, `blink.webp`, `404.json`, `routine.json`.
- `frames/031-404-sketch/package/404.reference.html` is a working reference page. Copy it to **`site/public/404.html`**, so Vite puts it at the root of `dist/`. Vercel serves a root `404.html` automatically for every missing path (no `vercel.json` needed; see https://vercel.com/docs/routing/custom-404-pages).
- **The font:** copy Instrument Sans's Latin variable `.woff2` (from the `@fontsource-variable/instrument-sans` package that job 013b installed, in `node_modules/@fontsource-variable/instrument-sans/files/`) to `site/public/assets/404/instrument-sans.woff2`. The page references that exact path.

## Rules (why the page is built this way)
1. **Absolute URLs only** (`/assets/404/...`, `/favicon-32.png`, `/`). The site's Vite `base` is `./`, but this page is served at ANY missing address, such as `/a/b/c`, where relative URLs break. Do NOT turn this into a Vite entry or a bundled script; keep it one static file with inline CSS and JS.
2. **One coordinate system.** All layers live inside one `<svg viewBox="0 0 1672 941">`, positioned from `404.json`. Back to front: the 404 path; `figure.webp`; exactly ONE visible arm patch; the blink patch (only during a blink). `figure.webp` has a transparent hole where the arm goes; each arm patch fills it with a 2 px overlap, so there is no seam and never a second arm. Do not resize, re-encode or re-crop any image.
3. **Motion:** cuts between poses (`visibility`), no fades, no transforms. Timings come from `routine.json`. Start the loop only after every frame has decoded. Pause while the tab is hidden. With `prefers-reduced-motion: reduce`, show the rest pose (S1) and never animate.
4. **Phones:** in portrait (`max-aspect-ratio: 1/1`), switch the viewBox to `404.json` → `phone_viewbox`, which crops the empty sides so the art is bigger.
5. **Text:** "This page doesn't exist. Back to the start" (link to `/`) in Instrument Sans, `#111` on `#F6F3EC`. The user may change this wording later. Keep it as one easy-to-find string.
6. `<meta name="robots" content="noindex">` stays.
7. The password gate (`site/middleware.js`) is unchanged and still covers this page.

## Must not change
Nothing outside `site/public/404.html` and `site/public/assets/404/`. No other page, no scene, no `vite.config.ts`, no `middleware.js`, no `api/`.

## Checks for the report
1. `npm run build` passes and `dist/404.html` plus `dist/assets/404/` (9 files) exist.
2. Playwright against `vite preview` (or any static server that serves `404.html` for missing paths, with status 404): open `/this/does/not/exist` at 1280x800 and at iPhone 13 size. Screenshot both. Zero console errors, zero failed requests, and the font loaded (`document.fonts.check('16px "Instrument Sans"')`).
3. Record the loop for 8 s with Playwright video at 1280x800. Confirm: exactly one arm visible in every frame, no blank frames, at least one blink.
4. Chrome DevTools performance trace of 10 s on a throttled mobile profile: no long tasks over 50 ms from the loop, no layout shifts.
5. Reduced motion: two screenshots 2 s apart are identical.
6. Check the motion against `.claude/skills/review-animations/STANDARDS.md` and note anything it flags.

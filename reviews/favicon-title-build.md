# Build brief: favicon, home-screen icon and tab title

**Approved by the user 2026-11-26.** Icons made by Wren in `assets/logo/favicon/` (on `main`).

## 1. Icons
Copy into `site/public/`, replacing the old ones:
- `favicon.ico` (16, 32, 48: the red mushroom), `favicon-16.png`, `favicon-32.png` (the red mushroom, transparent): the **browser tab** icon.
- `apple-touch-icon.png` (180, opaque) and `icon-192.png` (opaque): her head and hair, for **home screens** (iPhone/iPad and Android).

In `site/index.html`, the icon links become (absolute paths, so they also work from any deep URL):
```
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
```
In `site/public/404.html`, the same five links. (Check the site's Vite `base: './'` doesn't rewrite them; absolute paths in `index.html` are left alone by Vite.)

## 2. Tab title
- `site/index.html`: `<title>` and `og:title` become `Hui Jie as a Service (HJaaS)`.
- `site/public/404.html`: `<title>Page not found · HJaaS</title>` stays as it is (short, so the tab still shows "Page not found").
- If the site sets `document.title` anywhere in code (per scene, for example), make it the same string.

## 3. Reset mushrooms: no accidental double tap
Job 015 found that the confirming second tap counts however soon it comes, so a quick accidental double tap (easy on an iPad) resets all 50 at once. **The second tap only counts if it comes at least 500 ms after the first.** A tap sooner than that is ignored, and the label stays on "Tap again to reset all 50". The 4 s window is unchanged. Add a test, and check it in WebKit with a 150 ms double tap (nothing cleared) and taps 1 s apart (reset). Also update `qa/tools/paint-in.mjs` and `review03.mjs`, which still click the old "Replay painting" button.

## Must not change
Anything else.

## Checks for the report
- `dist/` has all five files at the root, and the built `index.html` has the five links and the new title.
- Chrome and WebKit: the tab shows the mushroom and the new title on `/` and on a deep missing path; the network log shows each icon answered 200.
- Tests, type check and build pass.

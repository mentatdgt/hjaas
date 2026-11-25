`f37159e Build report 01: wording` — file and manifest measurements from production archive `007-film-presenter-2x`, checked against the reviewed source and archived throttled runs. New timings are estimates.

## Verdict

- A cold iPhone-sized opening needs about **2.44 MB before the first stroke** on the reviewed revision.
- Rachel stands still through the paint-in. Loading only her opening pose first could bring that stroke forward by **up to 3.45 s on Slow 4G**.
- A first visit to Set can wait on **123 scene files**. Keep the current picture playable while the next one downloads.
- The latest phone-profile peak is **78.1 MB of counted images and canvases**. One extra decoded room takes 6.29 MB. [30 visiting orders](../repo/site/qa/build-no-glasses/memory/memory.json)
- Keep full-resolution plates, cropped animation patches, worker decoding and pre-paint drawing. Archived 4× CPU Film tests recorded zero dropped paint frames in five runs. [Film traces](../repo/site/qa/film-2x/trace.json)

## What crosses the connection

The archive contains **462 files, 34.49 MB**. With cache reuse, a complete five-room tour that lets every clip load totals **339 unique URLs**, 21.67 MB phone or 24.41 MB desktop before text compression. The following archive measurements exclude shared files from individual rooms. MB are decimal.

| Room | Phone files / MB to prepare room | Phone files / MB after all clips and reactions load, cumulative |
|---|---:|---:|
| Build | 9 / 2.03 | 25 / 3.62 |
| Grow | 12 / 2.34 | 96 / 8.93 |
| Design | 49 / 2.87 | 49 / 2.87 |
| Film | 29 / 2.22 | 29 / 2.22 |
| Set | 123 / 3.59 | 123 / 3.59 |

**Cold opening, default Build.** The 26 distinct files on phone include HTML, parser-blocking `room-route.js`, two render-blocking stylesheets, deferred module, decoder worker, two Latin WOFF2s (63 kB), room (1.256 MB), two pencil strips, six poses, eight mushroom drawings and logo. The route script preloads the hash-selected room once. Despite `font-display: swap`, startup awaits `document.fonts.ready`, logo, rehearsal and calm frames. Other font subsets and the social preview are outside this budget.

At 390×844, archive bodies total 2.477 MB raw, **2.32 MB estimated on wire** with Brotli text. At 1440×900 they total 2.683 MB raw, 2.52 MB compressed. The reviewed Build adds three poses, bringing estimates to 29 requests and **2.44/2.68 MB** phone/desktop. Counts exclude optional favicon, retries and headers. Allowing for discovery, decode and setup, budget roughly **13–15 s phone / 14–16 s desktop** on Slow 4G (1.6 Mbps, 150 ms RTT), or **3–4 s on either** on Fast 4G (9 Mbps, 60 ms). Earlier phone QA measured 12.67 s at 1.6 Mbps and 48.02 s at 0.4 Mbps. [Recorded first strokes](../repo/site/qa/review-fixes/slow.json)

## In priority order

**L1 · before launch · medium.** Gate Build's brush on the rest pose. Download the other eight poses once critical art arrives, then decode and rehearse in small batches outside the brush animation. Start the routine only when ready, including after Skip. This moves **690 kB** off the phone opening path (up to 3.45/0.61 s slow/fast) with identical pixels. Rachel may hold still longer on hotel Wi-Fi.

**L2 · before launch · medium.** On selection, start the destination's cast manifest/rest art alongside its plate. Today a new switch waits for plate and mushrooms before starting the cast. Cold Grow–Set entries need roughly **11–18 s of payload alone** at 1.6 Mbps. After each settled switch, warm at most the next unfinished plate at low priority into HTTP cache, streaming and discarding the body. Today's opening-only warmer calls `Image.decode()`. Cancel stale work, honor data-saving preferences and give taps priority over Grow's 84 deferred clip files (6.59 MB). A correct Grow prediction moves **up to 6.2 s** before the tap. Verify one body transfer in Safari and release the old cast before decoding the new one. A wrong prediction costs ~1.2 MB. Set also fetches ten future backdrop pieces (675 kB) upfront. Fetch earned pieces and the next one first, then stream the rest in hunt order.

**L3 · before launch · small.** Show a loading status during long waits and a reload link in the HTML shell if the route script or bundle fails. Give a newer room selection precedence over a stalled one. Healthy-load savings **0 s**. Keep the 60 s asset deadline and the 8 s worker-decode timeout with main-thread fallback. Required room/sprite loads retry an early failure once. A missing mushroom borrows another drawing. Losing the plate or every sprite exposes “Retry room” and preserves the previous hunt on switches. Missing cast or clips degrade to the hunt or stills. Guard late completions against replacing the selected room.

**L4 · before launch · medium.** Use Vercel project root `site`, Vite build and output `dist`. In `site/vercel.json`, set `headers` for fingerprinted JS/CSS/worker/fonts to `Cache-Control: public, max-age=31536000, immutable`. Version the art, manifests and their preload URLs together. Until then, give stable art/JSON, shell files, `/` and `/index.html` `public, max-age=0, must-revalidate`. A fresh browser cache can serve nearly all 339 tour URLs locally, avoiding revalidation round trips and up to 21 MB versus a cold visit. Copy all four policies from the built `_headers` to a `/(.*)` rule, including CSP (keep `worker-src 'self'`, `img-src 'self' blob:` and `frame-ancestors 'none'`), nosniff, Referrer-Policy and Permissions-Policy. Hash routes need no redirects or catch-all rewrite. Let Vercel negotiate Brotli/gzip. [Configuration](https://vercel.com/docs/project-configuration/vercel-json) · [Compression](https://vercel.com/docs/how-vercel-cdn-works/compression)

Tokyo and Osaka edge delivery reduces round trips. Hobby includes 100 GB transfer and 1M CDN requests monthly (~2,950 cold complete tours by requests). Its 100 MB CLI source-upload cap makes excluding QA recordings worthwhile. Use a same-origin Function at `VITE_FORM_ENDPOINT=/api/contact` to validate, rate-limit and send mail with a server-side secret. It fits the existing JSON POST, 15 s timeout and CSP. [Regions](https://vercel.com/docs/regions) · [CDN usage](https://vercel.com/docs/manage-cdn-usage) · [Limits](https://vercel.com/docs/limits)

**L5 · nice to have · medium.** Trial AVIF on opaque plates only. Build's original at full size yielded **1,046,880 B** at Q99, 4:4:4 versus **1,256,288 B** WebP, a 209 kB saving (~1.05 s slow). RGB PSNR was 48.83 versus 48.54 dB. Compare pencil grain while panning and time iPhone decode before shipping. Select one format consistently for preload, room and Film crop, with WebP fallback. Current effort-6 WebPs use near-lossless Q60 plates, Q93–95 figures, Q99 selected patches and lossless pencils. The five 1.18–1.26 MB plates support panning. Build/Grow choose 1.5× below 900 CSS px, otherwise 2×, independent of DPR. Normal loads select one set. Build can fetch both after one light-frame failure. Retry the selected file first to protect phone memory. Film uses one patched 2× presenter and sizes the canvas for DPR.

**L6 · skip · medium.** A whole-site service worker would precache up to 34.49 MB and risk pairing stale manifests with newer art. First-visit gain **0 s**. If offline revisits become essential, cache the versioned shell and successfully visited rooms only.

**Release check.** Repeat the 30 visiting orders and check tap-to-stroke, frame intervals through paint/Skip and peak allocations on a real iPhone.

**Verification limits.** Localhost binding was denied and Chrome aborted. Actual iPhone Safari/in-app frame times, process/GPU memory, AVIF appearance, and deployed Japanese edge/cache behavior remain unverified.

**Independent QC passed.** The reviewer reproduced the inventory, opening budgets, deferred bytes and AVIF comparison in this report. `commit.txt` identifies the source and `build-used.txt` identifies the measured archive.

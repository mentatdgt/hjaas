Reviewed `f37159e` (“Build report 01: wording”) using source inspection, file inventories and codec tests on the older job 007 build (`60f19b8`), and prior throttled Chrome QA. New timing estimates are modeled.

- The archived Build opening needs about 2.32 MB on a cold 390×844 phone visit. The plate and six poses dominate.
- Paint the opening pose with the room and start the routine once its first sequence is ready.
- Keep the old scene visible while one likely next plate downloads as compressed bytes.
- Keep releasing the old cast and edge before decoding the next. Current QA peaks at 78.1 MB of decoded art and canvases.
- Use Cloudflare Pages and versioned HTTP caching. Make stalls visible and retryable before adding offline storage.

## Measured files and estimated waits

The archive contains 462 files, 34,493,920 B. Build’s inferred opening uses 26 unique URLs plus a possible favicon. Phone (390×844) and desktop (1440×900) payload is **2.48/2.69 MB raw**, **2.32/2.53 MB** with simulated Brotli on text. The 1,256,288 B plate, 682/889 kB of poses, 88 kB of pencil maps, 96 kB of mushrooms and 49 kB logo dominate. The parser-blocking 775 B router issues a hash-aware, high-priority plate preload. Shell and app CSS block rendering, and the module is deferred. Two local Latin WOFF2 fonts total 63 kB and use `swap`. `document.fonts.ready` still gates paint. The branch adds three opening poses (+120/159 kB phone/desktop).

**First stroke estimate, archive.** At 4 Mbps/75 ms (Fast 4G), phone ~5–6 s, desktop ~5.5–6.5 s. At 1.6 Mbps/150 ms (Slow 4G), phone ~12–13 s, desktop ~13–14 s. For the current poses add ~0.25–0.8 s of payload time depending on profile. Earlier 390×844 DPR 3 Chrome QA measured 12.7 s at 1.6 Mbps and 48.0 s at 0.4 Mbps.

| Archive room | Unique scene-local gate, phone | Eventual phone / desktop MB |
|---|---:|---:|
| Build | 2.03 MB / 9 | 3.62 / 4.31 |
| Grow | 2.34 MB / 12 | 8.93 / 10.97 |
| Design | 2.87 MB / 49 | 2.87 / 2.87 |
| Film | 2.22 MB / 29 | 2.22 / 2.22 |
| Set | 3.59 MB / 123 | 3.59 / 3.59 |

Counts exclude shared shell and art and count Film’s same-URL plate fetch once. Estimated full five-room transfer with all routines/reactions loaded is **~21.5 MB phone / 24.3 MB desktop**, including shared files and simulated text compression, before revalidation or duplicates. Cold first-visit switches can wait ~4–7 s fast or ~10–18 s slow for that scene’s payload alone. Build and Grow gate at 2.23 and 2.56 MB on archive desktop.

## Priorities

**L1 · before launch · medium — Shorten the opening gate.** Paint with Rachel’s existing rest pose at the selected density. Move other poses, logo and contact preparation off the gate, start mushrooms and pencil requests alongside the plate, and bound the font wait with reserved space. Keep the route-aware preload matched to the consuming image. Current phone poses alone move **690 kB**, ~1.4/3.4 s fast/slow if prioritized. Hold the pose until the first beat is decoded and warmed, and schedule preparation between frames to avoid jumps and dropped frames.

**L2 · before launch · medium — Overlap switch downloads and defer future art.** A cold tap waits for the plate and hunt before requesting cast, then awaits all first-visit cast files. Start compressed cast and plate together. Replace the opening-only `warmPlate()` decode with one low-priority, cancellable, byte-capped next-plate warm after each settled scene. Share the request with navigation and release any temporary blob after decode. This moves up to **1.18–1.26 MB** ahead of the tap (~2.4/6.2 s fast/slow). A decoded plate costs 6.29 MB against 1.9 MB of QA headroom. Retain release-before-decode for the cast and edge. Set can defer **675 kB** of future-find overlays while keeping saved progress, and stage its 48 walker sprites. Grow’s **6.59 MB / 84** later clip frames can delay reactions. Prioritize playable sequences and keep the still fallback.

**L3 · before launch · medium — Show loading and recover per asset.** The plate and mushroom sprites retry once on ordinary failure. A missing mushroom gets a substitute. Loss of the plate or all mushrooms shows **Retry room**. Cast or clips can fall back to room or stills. Images and fetches have a **60 s** deadline. Worker decode gets **8 s** before fallback. Earlier QA recovered via Retry after ~60.2 s. Carry the opening plate’s stalled-URL cache bust into revisits, cancel superseded loads and bound optional waits to avoid up to ~60 s on a stalled file. Keep time for required art that is still downloading and preserve the old room during switches.

**L4 · before launch · medium — Ship on Cloudflare Pages.** Use HTTP/2 with HTTP/3 enabled and Brotli/gzip at the edge. The network includes Tokyo, Osaka, Seoul and Singapore. Text compression saves ~160 kB cold. `_headers` currently holds security rules. Add `public, max-age=31536000, immutable` for hashed JS/CSS/worker/fonts and versioned art plus manifests. Keep HTML, stable router/shell and unversioned assets at `no-cache` with ETags. Retain prior asset versions for open sessions and add a top-level `404.html` so a missing image returns 404. Verify protocol, encoding and cache headers from Japan. Art and animation risk is low if URLs and versions agree. [Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/) · [HTTP/3](https://developers.cloudflare.com/speed/optimization/protocol/http3/) · [Edge map](https://www.cloudflare.com/en-gb/network/)

**L5 · nice to have · medium — Test AVIF on plates first.** The five 1672×941 plates are the largest files (1.18–1.26 MB each). WebP uses effort 6, near-lossless plates, Q93–95 sprites/stills with full alpha, Q99 seam-sensitive patches and lossless pencil maps. Same-size 4:4:4 AVIF Q99 saved **0.23 MB on Build and 1.42 MB across plates** (~0.5/1.2 s opening). RGB PSNR was within 0.9 dB. Check pencil detail, color and iPhone decode before shipping one selected URL with WebP fallback. Film’s second plate fetch risks **1.23 MB** on a cache miss. A pixel-matched 320×290 camera crop reduces decode work. [iOS Safari AVIF](https://webkit.org/blog/13152/webkit-features-in-safari-16-0/)

Build/Grow pick 1.5× below 900 CSS px regardless of DPR. Healthy loads select one set. Build can request both if a small pose fails, and Grow falls back on a failed small manifest. Full Grow stills are 980×1380 (up to 175 kB on disk, 5.4 MB RGBA each). Favor retrying the selected set over an automatic full upgrade on phones. Test sharpness at DPR 3 before resizing.

**L6 · skip · medium — Service worker for launch.** Zero cold savings. Browser caching covers repeat transfers. Offline support would add update and eviction paths. Consider an opt-in cache of visited-room bytes if offline becomes a requirement.

## Verification limits

Local serving failed with `EPERM`, and both Playwright engines aborted. Real iPhone Safari, in-app browsing, packet loss, CDN timings, codec visual parity and process memory remain unverified. The earlier Film trace recorded zero dropped frames during paint and routine under 4× Chrome CPU throttling. Recheck 60 fps and ≤80 MB on iPhone before shipping changes.

Independent QC passed after revisions. The reviewer checked scope, format, scene totals, fallback paths and evidence limits.

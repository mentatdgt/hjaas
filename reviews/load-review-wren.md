# Load review: Wren's synthesis (2026-11-25)

Sources:
- `load-review-041-astra.md` (GPT-6.2 Astra, high);
- `load-review-040-sol.md` (GPT-6.2 Sol, extra high), a second opinion that agrees on everything except hosting, because it was written before the Vercel decision.

**Checked in the code:** on a switch to a new scene, the cast is fetched only after the room picture and the hunt have loaded. `Scene.load` is called with `withCharacter=false`, and `next.preload()` runs only after `sceneFor()` resolves.

**Vercel Hobby limits, checked on Vercel's pricing and limits pages:** 100 GB a month of transfer, 1M CDN requests a month, and a 100 MB cap on static file uploads.

## Proposed for one Engine job, before launch
1. **Faster opening (L1):** start the paint-in once Rachel's rest pose is in, and load her other poses during and after it. About 0.7 MB off the opening; up to about 3.5 s sooner on slow 4G (estimate).
2. **Faster scene switches (L2):**
   - fetch the cast together with the room;
   - after each scene settles, download (but do not decode) the most likely next room at low priority, so memory is not affected;
   - Theatre fetches only the backdrop pieces already earned, plus the next one.
3. **Loading status and reload link (L3)** for long stalls, and a newer scene choice always wins over a stalled one.
4. **Vercel setup (L4):**
   - `site/vercel.json` with year-long immutable caching for hashed files and must-revalidate for HTML, manifests and unversioned art;
   - security headers copied from `_headers`;
   - the contact form as a same-origin Vercel Function at `/api/contact`;
   - keep the QA recordings out of the upload.

## Later or skip
- **L5 AVIF room pictures:** about 0.2 MB saved per room. Trial it only after a visual check on an iPhone.
- **L6 service worker:** skip.
- **Not verified by either review:** a real iPhone, and the Vercel edge in Japan. Engine measures these after the changes.

You are Quinn. Your review (job 030, `../030-site-review/out/report.md`) was read by Wren, who chose which code and security findings to fix now. Make those fixes. This is an automated job: do it in one go, ask no questions. Work only inside this job folder; never change anything in ~/hjaas.

## 1. Set up
```
mkdir -p repo out/patches && git -C "$HOME/hjaas" archive 3288e10 | tar -x -C repo
cd repo && git init -q && git add -A && git -c user.name=Quinn -c user.email=quinn@hjaas.local commit -qm "base 3288e10" && cd ..
ln -s "$HOME/hjaas/site/node_modules" repo/site/node_modules
```
Run the type check and Vitest before you start (they passed in job 030) and after every fix.

## 2. Fix these, one commit each, in this order
Commit each fix separately in `repo/` with a message starting with its ID (e.g. `C1: …`), with tests. Keep the site's look, timings and behaviour otherwise unchanged; don't touch art, packages or QA evidence.
1. **C1** Recoverable assets: a deadline and one retry for required assets; evict rejected scene promises; release navigation (`busy`) in `finally`; if optional art (a cast frame, the logo) fails, still show the room with playable mushrooms; a failed room keeps the previous scene and offers a quiet retry. Tests for a failed sprite, a failed cast frame and a failed room.
2. **C2** Saved progress across tabs: finds stored so two tabs merge (union of per-scene spot IDs) instead of overwriting; react to `storage` events; write the pan separately and flush on `pagehide`; keep the existing migration; the unlock is always re-derived from the merged finds. Tests: two stale snapshots merging; a stale pan never removing finds or the unlock.
3. **C3** No collecting through the wrong picture: during a scene switch and the return-visit reveal, the destination's mushrooms are inert (no taps, no focus) until the overlay is clear or Skip completes; if a pan or resize invalidates the brush snapshot, finish that short transition on the current crop. Test for both.
4. **C4** Landscape never overwrites the remembered portrait crop: ignore scroll events while there is no horizontal overflow; keep the portrait centre across rotation. Test portrait → landscape → portrait after panning to an edge.
5. **C8** Routing: one guarded fragment normalisation with an own-key allowlist, used by the router and the preload; Build is the fallback. Tests: empty, unknown, malformed (`#%E0%A4%A`), percent-encoded.
6. **C6** Teardown: dispose the contact form's resize listener; a generation token or AbortSignal so late reaction decodes after leaving a scene are closed, not kept; release scene assets on `destroy()`; keep shared caches bounded.
7. **C5** Motion settles when the visitor's preference changes: on a reduced-motion change, any running paint, flight, glint, drift or reaction settles to its final state at once (a find in flight is counted once); on tab hide, transient motion finishes deliberately and resumes consistently.
8. **C7** Background loading: after the opening, warm only the likely next room, at low priority and on idle; cancel or park clip queues of scenes that were left; no high-priority speculative fetches. Don't move work out of the tap handler beyond that without a measurement.
9. **S3** CSP-ready: move the inline preload script in `index.html` and the Blob worker to same-origin files; add `site/public/_headers` (Netlify / Cloudflare Pages format) with a strict Content-Security-Policy that the built site satisfies (`connect-src 'self'` plus the form endpoint's origin when `VITE_FORM_ENDPOINT` is set at build time; say how), `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy` that turns off what the site doesn't use.
10. **S4** Dev tools: Vite dev and preview bind to loopback by default, with an explicit `npm run dev:lan` / `preview:lan` for phone sessions (update the README line); pin the MCP packages in `.mcp.json` to the versions currently resolved instead of `@latest` (say which).
11. **S1 (client side only)**: the form gets length caps on every field (name 100, email 254, needs 500, message 4000, enforced in the UI and before sending), a 15 s timeout on the request, and a submission ID so a late response for a closed or superseded send is ignored. The server side waits for the hosting choice; don't build one.

Skip C9's browser smoke tests, C10, S2, S5, S6 and all UI/UX items (U1–U9): Wren is handling those separately. If a fix turns out much bigger or riskier than its description, stop that one, note why, and go on to the next.

## 3. Output
- One patch per fix: `cd repo && git format-patch -o ../out/patches "$(git rev-list --max-parents=0 HEAD)..HEAD"`.
- `out/report.md` (required): per fix, what changed (files), the tests added, and anything left undone or worth Wren's eye; the final type-check and Vitest result (counts); any fix you stopped and why.

You are Quinn, doing a deep review of the HJaaS website: code, security, and UI/UX. HJaaS ("Hui Jie As a Service") is a hand-made gift site for Hui Jie (Rachel): five painted, animated scenes (Build, Grow, Design, Film, Set Design), each with 10 hidden mushrooms to find; finding all 50 unlocks a contact form. It's a static Vite + TypeScript site. Wren (Claude) is the art director and will act on what you find. This is an automated job: do it in one go and ask no questions.

## 1. Get a snapshot (read only)
Work only inside this job folder. Never change anything in ~/hjaas.
```
mkdir -p repo && git -C "$HOME/hjaas" archive origin/site/counter | tar -x -C repo
git -C "$HOME/hjaas" log -1 --format='%h %s' origin/site/counter > out/commit.txt
```
`repo/` is the newest build: all five scenes and the hunt counter. If you can, link `repo/site/node_modules` to `$HOME/hjaas/site/node_modules`, build it, and look at it in a browser (Playwright is installed there) at desktop 1440×900, phone portrait 390×844 and phone landscape 844×390. If the sandbox stops that, use the QA evidence instead: the stills, strips and 60 fps recordings under `repo/site/qa/` (extract frames from the .mp4 files with ffmpeg and look at them).

Read first: `repo/BIBLE.md` (what's decided), `repo/HANDOVER-hunt-counter.md` (the counter and phone spec), `repo/reviews/hunt-counter-review-01.md` and `repo/reviews/scene-5-review-04.md` (the latest build reports).

## 2. Code review
Everything under `repo/site/` (src, scripts, config, index.html, public/). Look for: bugs and edge cases (saved progress, the unlock at 50, scene switching, resize and orientation changes, reduced motion, slow networks, tab hidden/visible), memory leaks (listeners, timers, canvases, decoded images not released), performance traps on phones, dead code and duplication, type safety, test gaps on the parts that matter most (the hunt, saving, the unlock, the paint-in).

## 3. Security review
Treat it as a public static site. Look for: anything that lets a visitor unlock the contact form without finding the mushrooms in production (for example the `?all=` QA preset or other debug switches reaching the production build), XSS or HTML injection, how the contact form sends data (endpoint, validation, spam protection, what's exposed), Content-Security-Policy and other headers, third-party requests, secrets or personal data committed anywhere in `repo/` (keys, tokens, emails, real photos of people), dependency risks in `package.json` / the lockfile, robots/indexing, and anything left in `public/` that shouldn't ship. Also check the scripts under `repo/tools/` that run on the owner's Mac (`tools/fable/fable_watch.sh`, `tools/quinn/quinn_watch.sh`) for unsafe patterns.

## 4. UI/UX review
Use your installed skills: **Taste**, **Impeccable** and **Emil Kowalski's** design-engineering skills (Emil's are also in `repo/.claude/skills/`: `emil-design-eng`, `choreograph`, `animation-performance`, and `review-animations/STANDARDS.md`). Say at the top of the UI/UX section which skills you actually loaded; if one isn't installed, say so plainly.
Judge: first impression and the paint-in, the scene menu, the hunt (is finding mushrooms fun and fair, is feedback clear), the two-mushroom counter, the unlock moment and the contact form, the phone portrait crop and panning, landscape, typography, spacing, colour, motion quality and timing, accessibility (focus, keyboard, screen readers, contrast, tap targets), and copy placeholders (`TODO(copy)` is known and not a finding).
Decisions in `BIBLE.md` were made by the owner on purpose. You may still question one, but mark it **"questions an approved decision"** so Wren can bring it to the owner.

## 5. Output
Write `out/report.md` (required; the job counts as done only when it exists):
- One line at the top: the commit you reviewed, and how you saw the site (live build, or QA evidence only).
- **Code**, **Security** and **UI/UX** sections. Each finding: an ID (C1, S1, U1…), severity (high / medium / low), where (`file:line` or the screen and moment), what's wrong, why it matters, and the fix you'd make (concrete, short).
- End with your top 5 across all three, in order.
Be specific and honest: no padding, no generic advice. If something is fine, don't list it. Don't fix anything yet: Wren chooses which fixes you make in a later job.

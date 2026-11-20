# HJaaS — notes for Claude (Wren)

> **Start here:** `STATUS.md` (where things stand), `BIBLE.md` (what's decided; it wins over older notes), `SCENE-RECIPE.md` (how a scene is made).

Pipeline and roles: see README.md. Quinn = ChatGPT (read-only GitHub access; the user uploads its images).

## Building the website
Start with `HANDOVER.md`: scope, assets, placement, timing, QA and how to report.

## Site build tooling (for whoever builds the website)
Installed in this repo (2026-11-17):
- **Skills** in `.claude/skills/` (Emil Kowalski, MIT): `emil-design-eng` (easing, duration, whether to animate), `choreograph` (sequencing several moving parts, e.g. the paint-in reveal), `animation-performance` (keeping motion inside the frame budget), `review-animations` (strict motion review; it is set to manual invocation, so read `.claude/skills/review-animations/STANDARDS.md` directly as the sign-off checklist).
- **MCP servers** in `.mcp.json`, pre-approved in `.claude/settings.json`: `chrome-devtools` (performance traces: prove animations hold 60 fps) and `playwright` (screenshots, phone emulation, video recordings, WebKit/Safari checks).
- **Plugin** declared in `.claude/settings.json`: Impeccable (`impeccable@impeccable`) for critique, audit and polish of the non-scene UI. Each person installs it once with `/plugin install impeccable@impeccable`.

Use them: record every transition with Playwright, trace the intro reveal and scene transitions with Chrome DevTools on a throttled mobile profile, and check motion against the review-animations standards before calling any animation done.

## QC procedure ("QC NNN")
1. Take the newest file in `frames/NNN-*/incoming/`.
2. Run `python3 tools/qc_frames.py <sheet> --grid <grid> --frames <n> --fps <fps> --reference <ref> --out frames/NNN-*/approved` with values from the task's front matter. Raise `--max-baseline-drift` only if the task's motion intends vertical movement (jumps, crouches).
3. Always look at `contact.png` and several individual frames yourself: the script can't judge identity, face, hands, outfit details or style match against `reference/`.
4. PASS → keep `approved/`, set task `status: approved`. FAIL → delete `approved/` output, add a numbered "Round N" under Revision notes with specific, frame-numbered fixes, set `status: changes-requested`.

# The Fable loop: Wren ↔ Fable without the user pasting prompts

**Status: built 2026-11-24, waiting for its smoke test (job 000-smoke).** Fable is Claude Code on the user's Mac, run headless (`claude -p`) in `~/hjaas` with the Fable model. It mirrors the Quinn loop (`QUINN-LOOP.md`).

## How it works
1. **Wren writes a job** into `~/hjaas/wren-inbox/quinn/fable-jobs/NNN-name/job.md` on the Mac (over the device bridge). A job is a complete, self-contained instruction: which branch, which brief to read (`git show origin/main:reviews/...`), what to build, what to check, where to write the report. It's what Wren used to give the user to paste.
2. **The watcher** (`fable_watch.sh`, in `wren-inbox/quinn/`; source in `tools/fable/`) runs each new job once, one at a time, 3-hour limit:
   `claude -p --model fable --permission-mode acceptEdits --allowedTools "Bash,mcp__playwright__*,mcp__chrome-devtools__*" --append-system-prompt-file fable_rules.md < job.md`
   in `~/hjaas`, under `caffeinate -i` so the Mac doesn't idle-sleep mid-job. Fable's final message goes to `report.md`, errors to `log.txt`, then `DONE` or `FAILED`.
3. **The watcher tells Wren** by queuing a message into Wren's chat: `claude -p --cloud <session-id>` with the job name, status and the start of the report. The chat ID is in `wren-inbox/quinn/wren-session.txt`; a new Wren chat replaces that one line.
4. **Wren reviews** the pushed branch and evidence. If it isn't right, Wren writes the next round as a new job (max 3 rounds per piece, then Wren reports to the user). If it is, Wren tells the user it's ready for their phone check.
5. **The user sees only finished work** and decides merges. Nothing merges into main without Wren's review and the user's OK.

## Safety
- `fable_rules.md` is appended to every run: don't ask, never touch main, start from a clean pull, finish committed and pushed, leave `wren-inbox/` alone, no secrets, no paid generation jobs, short report.
- The watcher installs a `pre-push` hook in `~/hjaas/.git/hooks` that blocks pushes to `main`/`master` **only** when `FABLE_JOB` is set (i.e. inside a bridge job). The user's own pushes are untouched. If a different pre-push hook already exists, the watcher leaves it and prints a note.
- The watcher adds `wren-inbox/` to `~/hjaas/.git/info/exclude`, so job folders are never committed.
- Fable runs with the shell allowed (`Bash`) because builds need npm, git, ffmpeg and Playwright. This is the same trust as the user's own Claude Code sessions, without anyone watching.

## Conditions
- The Mac is awake and online; the **Claude desktop app is open** (Wren's bridge to the folder).
- The watcher is running in its own Terminal window: `bash ~/hjaas/wren-inbox/quinn/fable_watch.sh`. It runs next to `quinn_watch.sh`; each has its own window.
- Claude Code is installed and signed in (`claude auth login`) with the user's Claude account; `fable` is available on the plan.
- While the loop is on, the user leaves the interactive Claude Code session in `~/hjaas` idle, so two Fables don't edit the same checkout at once.
- Wren can't start the watcher itself: its shell on the Mac is a sandbox that can't run Mac apps.

## Writing jobs (Wren)
- One job = one round of one scene. Name it `NNN-sceneN-roundM`. Keep job numbers rising (000 is the smoke test).
- Start the job with the branch and the brief to read; end with where the report goes and "push before you finish".
- Commit the brief to main first, so the job can say `git show origin/main:<path>`.
- After a job, read `report.md`, then fetch the branch and check the evidence before telling the user anything.

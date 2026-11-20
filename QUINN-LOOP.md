# The Quinn loop: Wren ↔ Quinn without the user carrying files

**Status: built 2026-11-21, waiting for its first smoke test.** Quinn here is the Codex CLI on the user's Mac, signed in with their ChatGPT account. It has the same image model as ChatGPT (`$imagegen`, gpt-image-2).

## How it works
1. **Wren writes a job** into `~/hjaas/wren-inbox/quinn/jobs/NNN-name/` on the Mac (over the device bridge): `job.md` (the full instructions) and `in/*.png` (the images to edit).
2. **The watcher** (`quinn_watch.sh`, in that folder; source in `tools/quinn/`) runs each new job once: `codex exec --sandbox workspace-write --skip-git-repo-check -C <job> -i <images> -o quinn-report.md "<job.md>"`. Results land in the job's `out/`. It then writes `DONE` or `FAILED`. Jobs run one at a time, with a 30-minute limit each.
3. **Wren wakes itself** with a timed check-in (every 10 minutes while a job is open), reads `out/`, runs QC, and either accepts the files or writes the next round as a new job. Max 3 rounds per piece, then Wren reports to the user instead of looping.
4. **The user sees only finished work:** one preview or one question.

## Conditions
- The Mac is awake (lid open or on power with an external display), online, and the **Claude desktop app is open** (that's Wren's bridge to the folder).
- The watcher is running in a Terminal window: `bash ~/hjaas/wren-inbox/quinn/quinn_watch.sh`.
- The Codex CLI is installed and signed in (`codex login`) on a plan with image generation. Image jobs use the ChatGPT plan's Codex limits faster than text jobs.
- Wren can't start the watcher itself: its shell on the Mac is a sandbox that can't run Mac apps.

## Rules for jobs (learned on the café)
- **Ask for crops, not scenes.** Send a 1024×1024 crop of the one character; ask for an edit of that crop.
- **Never use a returned image whole.** Wren pastes only the part that moves onto the approved base and colour-matches it (`tools/cafe_build5.py`). Whatever else Quinn changed is discarded.
- **One job = one character's poses.** Say what must not change, name every output file, ask for an honest report.
- No paid Higgsfield job is ever started from the loop without the user's approval.

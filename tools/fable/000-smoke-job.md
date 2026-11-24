# Job 000-smoke: bridge test (read-only)

This is a test of the Fable bridge. Change nothing: no edits, no commits, no pushes, no stash.

1. Run `claude --version`, `git -C . rev-parse --abbrev-ref HEAD`, `git status --short | head -20` and `git log -1 --oneline`.
2. Run `git fetch origin` and list the remote `site/*` branches with their latest commit (`git branch -r -v | grep site/`).
3. Check whether `reviews/scene-5-review-02.md` and `reviews/scene-5-review-03.md` exist in the working tree or in any local or remote branch (`git log --all --oneline -- reviews/scene-5-review-0*.md | head`), and say which branch each is on and whether that branch has commits not yet pushed (`git status -sb`, `git log origin/site/scene-5..site/scene-5 --oneline` if both exist).
4. Confirm the MCP servers `playwright` and `chrome-devtools` are available to you in this run (list their tool names; don't call them).

Report each result in one or two lines.

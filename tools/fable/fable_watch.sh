#!/bin/bash
# Fable loop: runs each job Wren drops into ./fable-jobs through Claude Code (claude -p) in the HJaaS repo,
# one at a time, then tells Wren's chat that it finished. Mirrors quinn_watch.sh.
# Start once:  bash ~/hjaas/wren-inbox/quinn/fable_watch.sh      Stop: Ctrl+C
ROOT="$(cd "$(dirname "$0")" && pwd)"            # ~/hjaas/wren-inbox/quinn
REPO="$(cd "$ROOT/../.." && pwd)"                 # ~/hjaas
JOBS="$ROOT/fable-jobs"
LIMIT="${FABLE_LIMIT:-10800}"                     # 3 hours per job
MODEL="${FABLE_MODEL:-fable}"
mkdir -p "$JOBS"

command -v claude >/dev/null 2>&1 || { echo "Claude Code not found (the 'claude' command). Install or update it, then start this again."; exit 1; }
[ -d "$REPO/.git" ] || { echo "Can't find the HJaaS repo at $REPO"; exit 1; }
claude auth status >/dev/null 2>&1 || { echo "Claude Code isn't signed in. Run:  claude auth login   then start this again."; exit 1; }

# Keep the inbox out of git, so a job can never commit Quinn's or Fable's job folders.
grep -qx 'wren-inbox/' "$REPO/.git/info/exclude" 2>/dev/null || echo 'wren-inbox/' >> "$REPO/.git/info/exclude"

# Guard: a Fable job can never push to main (only applies when FABLE_JOB is set, so your own pushes are untouched).
HOOK="$REPO/.git/hooks/pre-push"
if [ ! -f "$HOOK" ] || grep -q 'FABLE_JOB' "$HOOK"; then
  cat > "$HOOK" <<'EOF'
#!/bin/bash
[ -n "$FABLE_JOB" ] || exit 0
while read -r lref lsha rref rsha; do
  case "$rref" in refs/heads/main|refs/heads/master) echo "Blocked: Fable jobs never push to main."; exit 1;; esac
done
exit 0
EOF
  chmod +x "$HOOK"
else
  echo "Note: $HOOK already exists and isn't ours, so the main-branch guard wasn't installed."
fi

notify_wren() {   # $1 = message. Queues it into Wren's chat; Wren's chat ID is in wren-session.txt
  local sid; sid="$(tr -d '[:space:]' < "$ROOT/wren-session.txt" 2>/dev/null)"
  [ -n "$sid" ] || { echo "   (no wren-session.txt, so Wren wasn't told)"; return; }
  printf '%s' "$1" | claude -p --cloud "$sid" > "$ROOT/.last-notify.txt" 2>&1 \
    && echo "   told Wren" || echo "   couldn't tell Wren (see $ROOT/.last-notify.txt)"
}

echo "Fable loop running in $REPO, model $MODEL. Watching $JOBS  (Ctrl+C to stop)"
while true; do
  for job in "$JOBS"/*/; do
    [ -f "$job/job.md" ] || continue
    [ -f "$job/DONE" ] && continue
    [ -f "$job/FAILED" ] && continue
    [ -f "$job/RUNNING" ] && continue
    job="${job%/}"; name="$(basename "$job")"
    echo "$(date '+%H:%M:%S')  start  $name"
    date > "$job/RUNNING"
    ( cd "$REPO" && FABLE_JOB="$name" caffeinate -i perl -e 'alarm shift; exec @ARGV' "$LIMIT" \
        claude -p --model "$MODEL" \
          --permission-mode acceptEdits \
          --allowedTools "Bash,mcp__playwright__*,mcp__chrome-devtools__*" \
          --append-system-prompt-file "$ROOT/fable_rules.md" \
          < "$job/job.md" ) > "$job/report.md" 2> "$job/log.txt"
    rc=$?
    rm -f "$job/RUNNING"
    if [ $rc -eq 0 ]; then
      date > "$job/DONE"; echo "$(date '+%H:%M:%S')  DONE   $name"; status="DONE"
    else
      echo "exit code $rc" > "$job/FAILED"; echo "$(date '+%H:%M:%S')  FAILED $name (see $job/log.txt)"; status="FAILED (exit $rc)"
    fi
    notify_wren "[Fable bridge] Job $name finished: $status. Full report: wren-inbox/quinn/fable-jobs/$name/report.md
--- report (first 6000 characters) ---
$(head -c 6000 "$job/report.md")
--- log tail ---
$(tail -n 15 "$job/log.txt")"
    [ "$name" = "000-smoke" ] && [ $rc -ne 0 ] && { echo "The smoke test failed, so the loop is stopping. Tell Wren: 'fable smoke failed'."; exit 1; }
  done
  sleep 20
done

#!/bin/bash
# Quinn loop: runs each job Wren drops into ./jobs through the Codex CLI (image generation included),
# one at a time, and leaves the results in the job's out/ folder for Wren to check.
# Start once:  bash ~/hjaas/wren-inbox/quinn/quinn_watch.sh      Stop: Ctrl+C
ROOT="$(cd "$(dirname "$0")" && pwd)"
if ! command -v codex >/dev/null 2>&1; then
  echo "Codex CLI not found. Install it with:  npm i -g @openai/codex   then run:  codex login"; exit 1
fi
notify_wren() {   # tells Wren's chat a job finished (same wren-session.txt as the Fable loop); skipped if Claude Code is missing
  local sid; sid="$(tr -d '[:space:]' < "$ROOT/wren-session.txt" 2>/dev/null)"
  [ -n "$sid" ] && command -v claude >/dev/null 2>&1 || return 0
  printf '%s' "$1" | claude -p --cloud "$sid" > "$ROOT/.last-notify-quinn.txt" 2>&1 || true
}
echo "Quinn loop running. Watching $ROOT/jobs  (Ctrl+C to stop)"
while true; do
  for job in "$ROOT"/jobs/*/; do
    [ -f "$job/job.md" ] || continue
    [ -f "$job/DONE" ] && continue
    [ -f "$job/FAILED" ] && continue
    [ -f "$job/RUNNING" ] && continue
    name="$(basename "$job")"
    echo "$(date '+%H:%M:%S')  start  $name"
    mkdir -p "$job/out/_generated"; date > "$job/RUNNING"
    imgs=""
    for f in "$job"/in/*.png; do [ -f "$f" ] && imgs="${imgs:+$imgs,}$f"; done
    # Optional per job: codex-args (extra Codex flags, one per line, e.g. -m / gpt-6.2-sol) and limit (seconds)
    extra=(); [ -f "$job/codex-args" ] && while IFS= read -r a; do [ -n "$a" ] && extra+=("$a"); done < "$job/codex-args"
    limit="$(tr -dc 0-9 < "$job/limit" 2>/dev/null)"; limit="${limit:-1800}"
    imgargs=(); [ -n "$imgs" ] && imgargs=(-i "$imgs")
    perl -e 'alarm shift; exec @ARGV' "$limit" caffeinate -i codex exec --sandbox workspace-write --skip-git-repo-check \
      "${extra[@]}" -C "$job" "${imgargs[@]}" -o "$job/quinn-report.md" "$(cat "$job/job.md")" > "$job/log.txt" 2>&1
    rc=$?
    # Codex keeps generated images in its own folder; copy any from this run so nothing is lost
    find "$HOME/.codex/generated_images" -type f -newer "$job/RUNNING" \( -name '*.png' -o -name '*.webp' -o -name '*.jpg' \) -exec cp {} "$job/out/_generated/" \; 2>/dev/null
    rm -f "$job/RUNNING"
    # Done = Codex succeeded and left an image, or (review/text jobs) out/report.md
    if [ $rc -eq 0 ] && { [ -f "$job/out/report.md" ] || [ -n "$(find "$job/out" -type f \( -name '*.png' -o -name '*.webp' -o -name '*.jpg' \) | head -1)" ]; }; then
      date > "$job/DONE"; echo "$(date '+%H:%M:%S')  DONE   $name"
      notify_wren "[Quinn bridge] Job $name finished: DONE. Results in wren-inbox/quinn/jobs/$name/out/"
    else
      echo "exit code $rc" > "$job/FAILED"; echo "$(date '+%H:%M:%S')  FAILED $name (see $job/log.txt)"
      notify_wren "[Quinn bridge] Job $name finished: FAILED (exit $rc). See wren-inbox/quinn/jobs/$name/log.txt"
      [ "$name" = "000-smoke" ] && { echo "The smoke test failed, so the loop is stopping. Tell Wren: 'smoke failed'."; exit 1; }
    fi
  done
  sleep 20
done

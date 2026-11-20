#!/bin/bash
# Quinn loop: runs each job Wren drops into ./jobs through the Codex CLI (image generation included),
# one at a time, and leaves the results in the job's out/ folder for Wren to check.
# Start once:  bash ~/hjaas/wren-inbox/quinn/quinn_watch.sh      Stop: Ctrl+C
ROOT="$(cd "$(dirname "$0")" && pwd)"
if ! command -v codex >/dev/null 2>&1; then
  echo "Codex CLI not found. Install it with:  npm i -g @openai/codex   then run:  codex login"; exit 1
fi
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
    if [ -n "$imgs" ]; then
      perl -e 'alarm shift; exec @ARGV' 1800 codex exec --sandbox workspace-write --skip-git-repo-check \
        -C "$job" -i "$imgs" -o "$job/quinn-report.md" "$(cat "$job/job.md")" > "$job/log.txt" 2>&1
    else
      perl -e 'alarm shift; exec @ARGV' 1800 codex exec --sandbox workspace-write --skip-git-repo-check \
        -C "$job" -o "$job/quinn-report.md" "$(cat "$job/job.md")" > "$job/log.txt" 2>&1
    fi
    rc=$?
    # Codex keeps generated images in its own folder; copy any from this run so nothing is lost
    find "$HOME/.codex/generated_images" -type f -newer "$job/RUNNING" \( -name '*.png' -o -name '*.webp' -o -name '*.jpg' \) -exec cp {} "$job/out/_generated/" \; 2>/dev/null
    rm -f "$job/RUNNING"
    if [ $rc -eq 0 ] && [ -n "$(find "$job/out" -type f \( -name '*.png' -o -name '*.webp' -o -name '*.jpg' \) | head -1)" ]; then
      date > "$job/DONE"; echo "$(date '+%H:%M:%S')  DONE   $name"
    else
      echo "exit code $rc" > "$job/FAILED"; echo "$(date '+%H:%M:%S')  FAILED $name (see $job/log.txt)"
      [ "$name" = "000-smoke" ] && { echo "The smoke test failed, so the loop is stopping. Tell Wren: 'smoke failed'."; exit 1; }
    fi
  done
  sleep 20
done

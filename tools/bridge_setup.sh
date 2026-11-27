#!/bin/bash
# Sets up Wren's bridge (Quinn loop + Fable/Engine loop) on a new Mac. Run once after cloning the repo to ~/hjaas:
#   bash ~/hjaas/tools/bridge_setup.sh
# Then start the loops (each in its own Terminal tab):
#   bash ~/hjaas/wren-inbox/quinn/quinn_watch.sh
#   bash ~/hjaas/wren-inbox/quinn/fable_watch.sh
set -e
REPO="$(cd "$(dirname "$0")/.." && pwd)"
Q="$REPO/wren-inbox/quinn"
mkdir -p "$Q/jobs" "$Q/fable-jobs"
cp "$REPO/tools/quinn/quinn_watch.sh" "$Q/"
cp "$REPO/tools/fable/fable_watch.sh" "$REPO/tools/fable/fable_rules.md" "$Q/"
cp "$REPO/tools/quinn/AGENTS.md" "$Q/jobs/"
echo "session_01D6nkZgPMpsdYhHQXBycayq" > "$Q/wren-session.txt"   # Wren's chat, for "job finished" notes
for t in git node npm codex claude; do command -v $t >/dev/null || echo "MISSING: $t"; done
echo "Bridge folder ready: $Q"

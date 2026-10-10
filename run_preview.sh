#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# AGRICONNECT preview supervisor  (./run_preview.sh)
#
# Keeps the Flask preview server up:
#   * if the server exits (crash, edit to a file, Ctrl+C) -> restarted in 2s
#   * if the server hangs and stops answering            -> killed + restarted
# Logs are written to server.log (reset when the supervisor starts).
#
# Environment:
#   PORT=5000   (default)    CHECK_INTERVAL=15   MAX_FAILS=3
#
# Stop it with Ctrl+C, or:  pkill -f "[r]un_preview.sh"
# ---------------------------------------------------------------------------
cd "$(dirname "$0")" || exit 1

LOG="$(pwd)/server.log"
PORT="${PORT:-5000}"
CHECK_INTERVAL="${CHECK_INTERVAL:-15}"
MAX_FAILS="${MAX_FAILS:-3}"

echo "=== AGRICONNECT supervisor started $(date) ===" > "$LOG"
echo "=== port $PORT, health check every ${CHECK_INTERVAL}s ===" >> "$LOG"

cleanup() {
  echo "=== supervisor stopped $(date) ===" >> "$LOG"
  [ -n "$CHILD" ] && kill "$CHILD" 2>/dev/null
  exit 0
}
trap cleanup INT TERM

while true; do
  echo "--- starting server $(date) ---" >> "$LOG"
  PORT="$PORT" python3 preview_app.py --no-reloader >> "$LOG" 2>&1 &
  CHILD=$!
  fails=0

  # Parent loop: watch the child, restarting it if it dies OR goes unresponsive.
  while kill -0 "$CHILD" 2>/dev/null; do
    sleep "$CHECK_INTERVAL"

    if python3 - "$PORT" <<'PY'
import sys, urllib.request
try:
    urllib.request.urlopen("http://127.0.0.1:%s/" % sys.argv[1], timeout=8)
    sys.exit(0)
except Exception:
    sys.exit(1)
PY
    then
      fails=0
    else
      fails=$((fails + 1))
      echo "--- health check failed ($fails/$MAX_FAILS) at $(date) ---" >> "$LOG"
      if [ "$fails" -ge "$MAX_FAILS" ]; then
        echo "--- server unresponsive; killing pid $CHILD ---" >> "$LOG"
        kill "$CHILD" 2>/dev/null
        sleep 1
        kill -9 "$CHILD" 2>/dev/null
        break
      fi
    fi
  done

  wait "$CHILD" 2>/dev/null
  echo "--- server (pid $CHILD) stopped at $(date); restarting in 2s ---" >> "$LOG"
  sleep 2
done

#!/usr/bin/env bash
# The support notification watch's scheduler for a local server (docs/support-portal/09-portal-guide.md §4g): POST
# /api/support/notify/watch every 60 s with the cron secret from .env, one line per pass in scripts/.watch.log.
# scripts/serve.sh starts it with the server and stops it with the server; a hosted deployment uses its own scheduler instead.
set -uo pipefail
cd "$(dirname "$0")/.."
SECRET=$(grep -m1 '^CRON_SECRET=' .env | cut -d= -f2- | tr -d '"'"'")
[ ${#SECRET} -ge 16 ] || { echo "CRON_SECRET in .env is unset or shorter than 16 characters" >&2; exit 1; }
URL="${WATCH_URL:-http://localhost:3000/api/support/notify/watch}"
while true; do
  out=$(curl -s -X POST -H "Authorization: Bearer $SECRET" --max-time 110 "$URL" 2>&1 | head -c 400)
  echo "$(date -u +%FT%TZ) $out"
  # Keep the log short: the last 2,000 passes.
  if [ "$(wc -l < scripts/.watch.log 2>/dev/null || echo 0)" -gt 4000 ]; then tail -n 2000 scripts/.watch.log > scripts/.watch.log.tmp && mv scripts/.watch.log.tmp scripts/.watch.log; fi
  sleep 60
done

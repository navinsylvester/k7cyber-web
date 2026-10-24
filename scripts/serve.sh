#!/usr/bin/env bash
# The production server on :3000 for testers behind the tunnel (docs/support-portal/09-portal-guide.md §1, "How testers are served").
#   scripts/serve.sh up        start `next start` detached (log: scripts/.server.log)
#   scripts/serve.sh down      stop it (SIGTERM, then SIGKILL after 10 s: next start can sit on open connections)
#   scripts/serve.sh rebuild   down, pnpm build, up
#   scripts/serve.sh status
# Use it instead of `pkill -f "next …"`, which also matches the shell that runs it.
set -euo pipefail
cd "$(dirname "$0")/.."
LOG=scripts/.server.log

pids() { pgrep -f '^next-server' || true; pgrep -f 'cross-env\.js NODE_OPTIONS=--no-deprecation next (start|dev)' || true; }
running() { [ -n "$(pids)" ]; }

down() {
  if ! running; then echo "not running"; return; fi
  kill $(pids) 2>/dev/null || true
  for _ in $(seq 1 10); do running || break; sleep 1; done
  if running; then kill -9 $(pids) 2>/dev/null || true; sleep 1; fi
  echo "stopped"
}

up() {
  if running; then echo "already running (pids $(pids | tr '\n' ' '))"; return; fi
  [ -f .next/BUILD_ID ] || { echo "no production build: run scripts/serve.sh rebuild" >&2; exit 1; }
  # Without it NODE_ENV=production turns off the probe service identity, the on-screen code and the partner portal (src/lib/env.ts).
  grep -q '^K7_LOCAL_BUILD=1' .env || { echo "refusing: set K7_LOCAL_BUILD=1 in .env for a local production build" >&2; exit 1; }
  (setsid nohup pnpm start > "$LOG" 2>&1 < /dev/null &)
  for _ in $(seq 1 30); do
    sleep 1
    if curl -s -o /dev/null --max-time 5 http://localhost:3000/support/sign-in; then echo "serving on :3000 (build $(cat .next/BUILD_ID))"; return; fi
  done
  echo "did not answer within 30 s; see $LOG" >&2; exit 1
}

case "${1:-status}" in
  up) up ;;
  down) down ;;
  rebuild) down; pnpm build; up ;;
  status) if running; then echo "running (pids $(pids | tr '\n' ' '))"; else echo "not running"; fi ;;
  *) echo "usage: $0 up|down|rebuild|status" >&2; exit 2 ;;
esac

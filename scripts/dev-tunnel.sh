#!/usr/bin/env bash
# The dev server behind a Cloudflare quick tunnel for a few testers (docs/support-portal/11-staging-readiness.md §7).
#   scripts/dev-tunnel.sh up     start cloudflared, wait for its URL, set AUTH_URL in .env, print what to register in Entra
#   scripts/dev-tunnel.sh down   stop it and remove AUTH_URL so localhost sign-in works again
#   scripts/dev-tunnel.sh status
# The URL changes on every start, so `up` must be followed by registering the new callback on the app registration.
# `pnpm dev` keeps running in its own terminal; Next reloads .env on change.
set -euo pipefail
cd "$(dirname "$0")/.."
LOG=scripts/.tunnel.log
# IPv4 and HTTP/2 over TCP: this network has no IPv6 to Cloudflare, and the default QUIC connection stalled for 40–80 s after idle.
CMD='cloudflared tunnel --url http://localhost:3000 --edge-ip-version 4 --protocol http2'

# setsid may fork, so the launcher's pid is not the tunnel's: find it by its command line.
pid() { pgrep -n -f "^cloudflared tunnel --url http://localhost:3000" || true; }
running() { [ -n "$(pid)" ]; }

case "${1:-status}" in
  up)
    if running; then echo "already running: $(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | head -1)"; exit 0; fi
    if ! grep -q '^SUPPORT_MAIL_ALLOWLIST=.\+' .env || grep -q '^SUPPORT_DEV_AGENT=probe' .env; then
      echo "refusing: .env must have SUPPORT_MAIL_ALLOWLIST set and SUPPORT_DEV_AGENT empty before the server is reachable" >&2; exit 1
    fi
    : > "$LOG"
    setsid nohup $CMD --no-autoupdate > "$LOG" 2>&1 < /dev/null &
    for _ in $(seq 1 30); do
      sleep 1
      URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | head -1 || true)
      [ -n "$URL" ] && break
    done
    [ -n "${URL:-}" ] || { echo "no tunnel URL after 30 s; see $LOG" >&2; exit 1; }
    if grep -q '^AUTH_URL=' .env; then sed -i "s|^AUTH_URL=.*|AUTH_URL=$URL|" .env; else printf 'AUTH_URL=%s\n' "$URL" >> .env; fi
    echo "tunnel:        $URL"
    echo "testers open:  $URL/support/sign-in?agent=1"
    echo "register:      $URL/api/auth/callback/microsoft-entra-id   (app registration → Authentication → Web redirect URIs)"
    ;;
  down)
    if running; then kill "$(pid)" && echo "tunnel stopped"; else echo "tunnel was not running"; fi
    sed -i '/^AUTH_URL=/d' .env && echo "AUTH_URL removed from .env (localhost sign-in works again)"
    ;;
  status)
    if running; then echo "running: $(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | head -1)"; else echo "not running"; fi
    ;;
  *) echo "usage: $0 up|down|status" >&2; exit 2 ;;
esac

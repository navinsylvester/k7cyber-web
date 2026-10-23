#!/usr/bin/env bash
# Nightly backup of the portal's system of record (docs/partner-portal/05-staging-and-go-live.md §6; non-functional
# requirement 9 in 02-build-plan.md §11): one pg_dump in custom format of DATABASE_URL and one tar of the upload directories,
# in a dated folder under BACKUP_DIR (default ./backups), older folders pruned after BACKUP_KEEP_DAYS (default 30).
#
#   DATABASE_URL=postgres://… scripts/backup.sh            # reads .env when DATABASE_URL is not exported
#   BACKUP_DIR=/srv/backups BACKUP_KEEP_DAYS=30 scripts/backup.sh
#
# Restore with scripts/restore.sh. Needs pg_dump 17 (the server's major) on the PATH, or BACKUP_PG_DUMP pointing at one.
set -euo pipefail

cd "$(dirname "$0")/.."
if [[ -z "${DATABASE_URL:-}" && -f .env ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
fi
[[ -n "${DATABASE_URL:-}" ]] || { echo "backup: DATABASE_URL is not set" >&2; exit 2; }

BACKUP_DIR="${BACKUP_DIR:-backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
PG_DUMP="${BACKUP_PG_DUMP:-pg_dump}"
UPLOADS="${BACKUP_UPLOADS:-uploads}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/$STAMP"
mkdir -p "$OUT"

echo "backup: database → $OUT/db.dump"
"$PG_DUMP" --format=custom --no-owner --no-privileges --file="$OUT/db.dump" "$DATABASE_URL"

if [[ -d "$UPLOADS" ]]; then
  echo "backup: $UPLOADS → $OUT/uploads.tar.gz"
  tar -czf "$OUT/uploads.tar.gz" "$UPLOADS"
else
  echo "backup: no $UPLOADS directory; skipping files"
fi

( cd "$OUT" && sha256sum ./* > SHA256SUMS )
du -sh "$OUT" | sed 's/^/backup: /'

if [[ "$KEEP_DAYS" -gt 0 ]]; then
  find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*T*Z' -mtime "+$KEEP_DAYS" -print -exec rm -rf {} + | sed 's/^/backup: pruned /' || true
fi
echo "backup: done $STAMP"

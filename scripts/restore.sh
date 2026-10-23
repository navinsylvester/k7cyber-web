#!/usr/bin/env bash
# Restore one backup folder made by scripts/backup.sh (docs/partner-portal/05-staging-and-go-live.md §6).
#
#   scripts/restore.sh backups/20261023T120000Z postgres://user:pass@host:5432/k7_restore [uploads-target-dir]
#
# The database is restored with --clean --if-exists into the URL given (make the database first; never the live one while
# the app runs). The uploads tar is unpacked into the target directory (default: a sibling "uploads" of the folder you name,
# so the live directory is never overwritten by accident). Needs pg_restore of the server's major on the PATH.
set -euo pipefail

SRC="${1:?backup folder}"
TARGET_URL="${2:?target DATABASE_URL}"
UPLOADS_TARGET="${3:-$SRC/restored-uploads}"
PG_RESTORE="${BACKUP_PG_RESTORE:-pg_restore}"

[[ -f "$SRC/db.dump" ]] || { echo "restore: $SRC/db.dump not found" >&2; exit 2; }
( cd "$SRC" && sha256sum --check --quiet SHA256SUMS ) && echo "restore: checksums match"

echo "restore: database ← $SRC/db.dump → $TARGET_URL"
"$PG_RESTORE" --clean --if-exists --no-owner --no-privileges --dbname="$TARGET_URL" "$SRC/db.dump"

if [[ -f "$SRC/uploads.tar.gz" ]]; then
  mkdir -p "$UPLOADS_TARGET"
  echo "restore: files → $UPLOADS_TARGET"
  tar -xzf "$SRC/uploads.tar.gz" -C "$UPLOADS_TARGET"
fi
echo "restore: done"

#!/usr/bin/env bash
set -euo pipefail

JOURNAL="apps/web/drizzle/meta/_journal.json"
MIGRATIONS_DIR="apps/web/drizzle"

if [[ ! -f "$JOURNAL" ]]; then
  echo "No migration journal found at $JOURNAL"
  exit 1
fi

SQL_COUNT=$(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' | wc -l)
JOURNAL_COUNT=$(python3 -c "import json; print(len(json.load(open('$JOURNAL'))['entries']))")

if [[ "$SQL_COUNT" -ne "$JOURNAL_COUNT" ]]; then
  echo "Migration journal mismatch: $JOURNAL_COUNT journal entries, $SQL_COUNT SQL files"
  exit 1
fi

echo "Migration journal OK ($JOURNAL_COUNT migrations)"

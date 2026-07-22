#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgres://postgres@127.0.0.1:5432/cryptobin_test}"

read -r DB_NAME ADMIN_URL <<< "$(python3 - <<PY
from urllib.parse import urlparse
url = urlparse("${TEST_DATABASE_URL}")
db_name = url.path.lstrip("/") or "cryptobin_test"
admin = url._replace(path="/postgres").geturl()
print(db_name)
print(admin)
PY
)"

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${DB_NAME}\""

echo "Dropped test database: $DB_NAME"

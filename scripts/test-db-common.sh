#!/usr/bin/env bash
set -euo pipefail

# Prints: DB_NAME PGHOST PGPORT PGUSER PGPASSWORD (password may be empty)
parse_test_database_url() {
  local url="${1:?TEST_DATABASE_URL required}"
  python3 - <<PY "$url"
import sys
from urllib.parse import urlparse

url = urlparse(sys.argv[1])
db_name = url.path.lstrip("/") or "cryptobin_test"
host = url.hostname or "127.0.0.1"
port = url.port or 5432
user = url.username or "postgres"
password = url.password or ""
print(db_name)
print(host)
print(port)
print(user)
print(password)
PY
}

run_psql_admin() {
  local sql="$1"
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 -c "$sql"
}

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=test-db-common.sh
source "$ROOT/scripts/test-db-common.sh"

TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgres://postgres@127.0.0.1:5432/cryptobin_test}"

mapfile -t _parsed < <(parse_test_database_url "$TEST_DATABASE_URL")
DB_NAME="${_parsed[0]}"
PGHOST="${_parsed[1]}"
PGPORT="${_parsed[2]}"
PGUSER="${_parsed[3]}"
PGPASSWORD="${_parsed[4]:-}"
export PGPASSWORD

run_psql_admin "DROP DATABASE IF EXISTS \"${DB_NAME}\""

echo "Dropped test database: $DB_NAME"

#!/usr/bin/env bash
# Runs the migration + flow tests against a throwaway database.
# Usage: DATABASE_URL=postgres://... supabase/tests/run.sh   (needs PostGIS installed)
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
DB="${DATABASE_URL:?set DATABASE_URL to an empty scratch database}"
psql "$DB" -v ON_ERROR_STOP=1 -q -f "$DIR/supabase_stub.sql"
psql "$DB" -v ON_ERROR_STOP=1 -q -f "$DIR/../migrations/20260928000000_init.sql"
psql "$DB" -v ON_ERROR_STOP=1 -q -f "$DIR/flows.sql"

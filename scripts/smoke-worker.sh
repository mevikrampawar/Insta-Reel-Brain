#!/usr/bin/env bash
# Smoke test for the deployed worker. Verifies auth failure modes and routing
# WITHOUT needing a Firebase ID token or provider keys.
#
# Usage:   WORKER_URL=https://reel-brain-relay.your.workers.dev scripts/smoke-worker.sh
# Exits 0 if all checks pass, 1 otherwise.

set -u
WORKER_URL="${WORKER_URL:-https://reel-brain-relay.vikrampawar5972.workers.dev}"

pass=0
fail=0
check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    pass=$((pass + 1))
    echo "PASS $name (HTTP $actual)"
  else
    fail=$((fail + 1))
    echo "FAIL $name — expected HTTP $expected, got $actual"
  fi
}

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

check "GET / → 405"             405 "$(code "$WORKER_URL/")"
check "POST / no secret → 401"  401 "$(code -X POST "$WORKER_URL/" -H 'Content-Type: application/json' -d '{"url":"https://www.instagram.com/reel/abc/","userId":"testuser123"}')"
check "POST / wrong secret → 401" 401 "$(code -X POST "$WORKER_URL/" -H 'Content-Type: application/json' -H 'X-Relay-Secret: wrong' -d '{"url":"https://www.instagram.com/reel/abc/","userId":"testuser123"}')"
check "GET /api/me no token → 401" 401 "$(code "$WORKER_URL/api/me")"
check "POST /api/usage/reserve no token → 401" 401 "$(code -X POST "$WORKER_URL/api/usage/reserve")"
check "POST /api/usage/release no token → 401" 401 "$(code -X POST "$WORKER_URL/api/usage/release")"
check "POST /api/ingest/enqueue no token → 401" 401 "$(code -X POST "$WORKER_URL/api/ingest/enqueue" -H 'Content-Type: application/json' -d '{"url":"https://www.instagram.com/reel/abc/"}')"
check "POST /api/ingest/cancel no token → 401" 401 "$(code -X POST "$WORKER_URL/api/ingest/cancel" -H 'Content-Type: application/json' -d '{"jobId":"job_1"}')"
check "GET /api/ingest/jobs no token → 401" 401 "$(code "$WORKER_URL/api/ingest/jobs")"
check "POST webhook missing params → 400" 400 "$(code -X POST "$WORKER_URL/api/ingest/webhook" -H 'Content-Type: application/json' -d '{}')"
check "POST webhook unknown job → 404" 404 "$(code -X POST "$WORKER_URL/api/ingest/webhook?jobId=job_nope&uid=testuser123" -H 'Content-Type: application/json' -d '{"eventType":"SUCCEEDED"}')"
check "GET /nope → 404"         404 "$(code "$WORKER_URL/nope")"

echo
echo "$pass passed, $fail failed"
exit $((fail > 0 ? 1 : 0))

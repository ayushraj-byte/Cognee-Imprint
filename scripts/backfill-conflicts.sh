#!/usr/bin/env bash
# Drives the conflict-backfill endpoint across a user's whole memory store in
# resumable chunks. Real-time detection only runs on NEW saves, so this is how
# you populate conflict links for memories saved before the detection fix.
#
# Usage:
#   IMPRINT_USER=<userId> [DRY=1] [BATCH=8] [KEY=<backfill key>] [BASE=<url>] \
#     bash scripts/backfill-conflicts.sh
#
#   DRY=1   → dry run: detect & report, write nothing (recommended first).
#   BATCH   → memories processed per request (default 8; lower if requests time out).
#   KEY     → must match BACKFILL_KEY env on the server, if that env is set.
#   BASE    → API base (default https://imprint-ebon.vercel.app).
set -u
BASE="${BASE:-https://imprint-ebon.vercel.app}"
USER="${IMPRINT_USER:?set IMPRINT_USER to the userId}"
DRY="${DRY:-0}"; BATCH="${BATCH:-8}"; KEY="${KEY:-}"
dry=false; [ "$DRY" = "1" ] && dry=true
cursor=0; total="?"; found=0; writes=0
echo "Backfill start (dryRun=$dry, batch=$BATCH) on $BASE for user $USER"
while :; do
  resp=$(curl -s -X POST "$BASE/api/memories/backfill" -H "Content-Type: application/json" \
    -d "{\"userId\":\"$USER\",\"cursor\":$cursor,\"batchSize\":$BATCH,\"dryRun\":$dry,\"key\":\"$KEY\"}")
  nc=$(echo "$resp"  | grep -o '"nextCursor":[0-9]*' | grep -o '[0-9]*$')
  tt=$(echo "$resp"  | grep -o '"total":[0-9]*'      | grep -o '[0-9]*$')
  fc=$(echo "$resp"  | grep -o '"foundCount":[0-9]*' | grep -o '[0-9]*$')
  wr=$(echo "$resp"  | grep -o '"writes":[0-9]*'     | grep -o '[0-9]*$')
  dn=$(echo "$resp"  | grep -o '"done":[a-z]*'       | grep -o 'true\|false')
  if [ -z "$nc" ]; then echo "  ! error at cursor $cursor: $(echo "$resp" | head -c 300)"; sleep 6; continue; fi
  total=$tt; found=$((found + ${fc:-0})); writes=$((writes + ${wr:-0}))
  echo "$resp" | grep -o '"reason":"[^"]*"' | sed 's/"reason":"/    • /; s/"$//'
  echo "[$cursor/$total] +${fc:-0} this chunk  (running: $found found, $writes writes)"
  cursor=$nc
  [ "$dn" = "true" ] && break
done
echo "DONE. total=$total  found=$found  writes=$writes  dryRun=$dry"

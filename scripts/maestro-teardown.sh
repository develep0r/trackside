#!/usr/bin/env bash
# Purges whatever the ephemeral client test account left behind. The
# client_delete_account flow already deletes the account itself via the
# app's own delete-account function — this is a defensive backstop in case
# a flow fails partway (e.g. onboarding assertion fails before the delete
# flow ever runs), plus cleanup of side effects the delete function doesn't
# own (invites created BY the trainer flows, feedback sent to the review
# client during trainer_roster_and_feedback).
#
# Required env: SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN
set -euo pipefail

: "${SUPABASE_PROJECT_REF:?set SUPABASE_PROJECT_REF}"
: "${SUPABASE_ACCESS_TOKEN:?set SUPABASE_ACCESS_TOKEN}"

CLIENT_TEST_PHONE="919000000901"

echo "==> Purging any leftover ephemeral test account + invite"
curl -sf -X POST "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$(python3 -c "
import json
sql = '''
delete from auth.users where phone = '${CLIENT_TEST_PHONE}';
delete from public.invites where phone = '${CLIENT_TEST_PHONE}' or client_name = 'Maestro E2E';
delete from public.feedback where body ilike '%maestro e2e%';
'''
print(json.dumps({'query': sql}))
")" > /dev/null

echo "==> Teardown complete"

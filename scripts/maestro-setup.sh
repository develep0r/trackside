#!/usr/bin/env bash
# Seeds the fixed state the Maestro suite needs before every run:
#   - a pending invite for the ephemeral client test phone (signup is
#     invite-gated, so onboarding can't be exercised without one)
#   - test OTPs for the trainer + ephemeral client numbers, so the suite
#     never sends a real SMS or costs Twilio credit
#
# Idempotent — safe to run before every suite execution.
#
# Required env: SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN (management API
# token — same scope used to run migrations, NOT the anon/service key)
set -euo pipefail

: "${SUPABASE_PROJECT_REF:?set SUPABASE_PROJECT_REF}"
: "${SUPABASE_ACCESS_TOKEN:?set SUPABASE_ACCESS_TOKEN}"

TRAINER_PHONE="919000000101"
CLIENT_TEST_PHONE="919000000901"
TEST_OTP_CODE="123456"

echo "==> Seeding pending invite for the ephemeral client test account"
curl -sf -X POST "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$(python3 -c "
import json
sql = '''
delete from auth.users where phone = '${CLIENT_TEST_PHONE}';
delete from public.invites where phone = '${CLIENT_TEST_PHONE}';
insert into public.invites (trainer_id, phone, client_name)
select id, '${CLIENT_TEST_PHONE}', 'Maestro E2E'
from public.trainer_profiles where name = 'Arjun Rao';
'''
print(json.dumps({'query': sql}))
")" > /dev/null

echo "==> Configuring test OTPs (trainer + ephemeral client)"
curl -sf -X PATCH "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"sms_test_otp\": \"${TRAINER_PHONE}=${TEST_OTP_CODE},${CLIENT_TEST_PHONE}=${TEST_OTP_CODE}\",
    \"sms_test_otp_valid_until\": \"2027-12-31T00:00:00Z\"
  }" > /dev/null

echo "==> Setup complete"

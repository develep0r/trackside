# E2E test suite (Maestro)

Six flows covering both roles end-to-end: client sign-up (photo capture,
multi-select goals, auto-accepted invite), returning sign-in + check-in +
coach tab, account deletion; trainer sign-in + roster + manual feedback +
AI-draft graceful-failure, sending a new invite, editing the coach page.

## Why Maestro

It's Expo's own recommended E2E tool for this exact stack (Expo Router +
Expo Go / dev client), driven by black-box UI interaction (tap/type/assert
on visible text or `testID`) rather than React internals — so the same
flow files run unmodified against iOS, Android, **and** this Metro/web
build, and against a EAS production build later without touching the test
code.

## Prerequisites

1. A **real build** installed on a simulator/emulator/device — Maestro
   drives an installed app, it doesn't run Metro/`expo start` directly.
   Either `eas build --profile preview` (or `development` with a dev
   client) for the target platform, or a local Xcode/Android Studio build.
2. Seeded test data — signup is invite-gated at the DB level, so the
   client flow can't run without a pending invite waiting for it:
   ```bash
   SUPABASE_PROJECT_REF=pncfdjtsgovbbvhsbqru \
   SUPABASE_ACCESS_TOKEN=sbp_... \
   ./scripts/maestro-setup.sh
   ```
   This also configures `sms_test_otp` for the trainer + ephemeral client
   numbers, so the suite never sends a real SMS or spends Twilio credit.
3. [Maestro CLI](https://maestro.mobile.dev) installed locally if running
   outside EAS Workflows (`curl -Ls "https://get.maestro.mobile.dev" | bash`).

## Running

```bash
# whole suite, in order (client flows must run before delete-account)
maestro test .maestro/config.yaml

# a single flow, while iterating
maestro test .maestro/flows/client_onboarding.yaml
```

Then clean up:
```bash
SUPABASE_PROJECT_REF=pncfdjtsgovbbvhsbqru \
SUPABASE_ACCESS_TOKEN=sbp_... \
./scripts/maestro-teardown.sh
```

## Test accounts

| Phone | Role | Lifespan |
|---|---|---|
| `9000000101` | Trainer (Arjun Rao) | Persistent — also the App Store review demo account. `trainer_mypage.yaml` self-restores its headline after editing. |
| `9000000201` | Client (Rohan Mehta) | Persistent — App Store review demo account. Trainer flows read/write against this client; never deleted by the suite. |
| `9000000901` | Client (ephemeral) | Created fresh by `client_onboarding.yaml`, used by `client_checkin_and_coach.yaml`, deleted by `client_delete_account.yaml`. `maestro-teardown.sh` is a backstop if a flow fails partway. |

## What this does *not* cover

Native OS chrome — the camera/photo-library picker sheet, permission
prompts, keyboard behavior — is outside Maestro's app sandbox and differs
per platform. `client_onboarding.yaml` only confirms the picker opens
without crashing; photo-upload correctness itself (the blob actually
reaches storage with the right path) is covered by the scripted web dry
run, not by this suite. Before submitting to either store, do one manual
pass on a real device for exactly this reason — camera permission dialogs,
keyboard-avoidance, and safe-area insets are where native-only bugs live,
and no amount of automation replaces holding the phone.

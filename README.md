# Trackside

**Daily progress, coached weekly.** Invite-only B2B SaaS for personal trainers to track
client progress (photos, measurements, wellness) and send actionable feedback.

## Repo layout

```
supabase/
  migrations/        # schema history — mirrors the live "Trackside MVP" project
  functions/         # edge functions (Deno)
    send-invite/       # DB webhook → invite SMS via MSG91 (guarded by x-webhook-secret)
    draft-feedback/    # AI feedback draft; Anthropic key server-side, RLS-scoped reads
    delete-account/    # DPDP right-to-erasure: storage purge + auth user delete
    razorpay-webhook/  # HMAC-verified subscription status sync
  config.toml        # project ref + per-function verify_jwt flags
packages/api/        # shared TypeScript data-access layer (Expo + Next.js import this)
prototype/           # the original React single-file prototype (reference implementation)
docs/                # founding-coach pitch and other collateral
.github/workflows/   # CI: push to main → supabase db push + functions deploy
```

## Architecture decisions

- **One coach per client**, switch only via a new invite (`accept_invite()` RPC —
  the sole linking path; clients can never write `trainer_id` directly).
- **RLS everywhere.** Trainers see only their roster; `is_my_client()` is the
  single helper behind trainer-scoped policies.
- **Photos are sensitive data (DPDP Act).** Private `media` bucket, path-scoped
  policies, signed URLs only, hard-delete via `delete-account`.
- **Billing**: per active client/month via Razorpay subscriptions; webhook keeps
  `trainer_billing.status` in sync.

## Local development

```bash
npm i -g supabase
supabase login
supabase link --project-ref pncfdjtsgovbbvhsbqru
supabase db pull          # sanity-check drift vs migrations/
supabase functions serve  # run edge functions locally
```

## Deployment

Push to `main` (anything under `supabase/`) and GitHub Actions runs
`supabase db push` + `supabase functions deploy`.

Required **GitHub secrets**: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`.

Required **Supabase function secrets** (`supabase secrets set KEY=value`):
`INVITE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `MSG91_AUTHKEY`,
`MSG91_TEMPLATE_ID`, `RAZORPAY_WEBHOOK_SECRET`, `APP_LINK`.

Manual (one-time) dashboard config: enable Phone auth + SMS provider, create the
Database Webhook `invites INSERT → send-invite` with the `x-webhook-secret` header.

## Roadmap

- [ ] Expo client app (port `prototype/` screens, swap storage for `packages/api`)
- [ ] Next.js trainer console + marketing site
- [ ] WhatsApp Business API reminders (Gupshup/Interakt)
- [ ] Razorpay subscription creation flow + monthly active-client reconciliation
- [ ] Lock trainer role creation behind approval (see note in init migration)

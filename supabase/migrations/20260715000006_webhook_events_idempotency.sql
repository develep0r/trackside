-- Idempotency ledger for externally-delivered webhooks (Razorpay redelivers
-- on timeout/5xx, and a captured request could be replayed). Written only by
-- service-role edge functions; RLS enabled with no policies keeps every
-- client-facing role out.

create table public.webhook_events (
  id          text primary key,           -- provider event id (x-razorpay-event-id)
  source      text not null,
  received_at timestamptz not null default now()
);

alter table public.webhook_events enable row level security;

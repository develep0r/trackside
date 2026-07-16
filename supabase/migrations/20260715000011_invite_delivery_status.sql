-- The send-invite webhook fires MSG91 and swallows failures (console.error +
-- 200), so a coach believes the client was invited while no SMS ever went
-- out. Record delivery state on the invite row; the coach console can then
-- surface failures and offer a resend.

alter table public.invites
  add column delivery_status text not null default 'queued'
    check (delivery_status in ('queued', 'sent', 'failed')),
  add column delivery_error text,
  add column delivered_at   timestamptz;

-- No policy changes: trainers already read their own invites, and the
-- send-invite function writes with the service role.

-- Per-trainer daily AI draft usage counter for the draft-feedback edge
-- function. Written only by the service-role edge function; RLS enabled with
-- no policies keeps every client-facing role out (same pattern as
-- webhook_events).

create table public.ai_draft_usage (
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  day        date not null,
  count      int  not null default 0,
  primary key (trainer_id, day)
);

alter table public.ai_draft_usage enable row level security;

-- Atomic upsert-increment. Returns the post-increment count so the caller can
-- enforce the daily cap without a read-modify-write race. Day follows the
-- product's IST calendar-day convention (see 20260715000004).
create function public.increment_ai_draft(p_trainer uuid)
returns int
language sql
security definer
set search_path = public
as $$
  insert into public.ai_draft_usage (trainer_id, day, count)
  values (p_trainer, (now() at time zone 'Asia/Kolkata')::date, 1)
  on conflict (trainer_id, day)
  do update set count = ai_draft_usage.count + 1
  returning count;
$$;

-- Service-role only: not an API surface for any client-facing role
-- (advisor lints 0028/0029 style, see 20260711000002).
revoke execute on function public.increment_ai_draft(uuid) from public, anon, authenticated;
grant execute on function public.increment_ai_draft(uuid) to service_role;

-- Check-ins are the data coaches act on (streaks, compliance, weight trends in
-- roster_stats), but clients had unrestricted CRUD on their own rows with a
-- client-controlled `date` — history could be fabricated for any past day or
-- logged into the future. Constrain client writes to a small window anchored
-- on the product's calendar day, which is IST
-- (see 20260715000004_roster_stats_ist_dates.sql):
--
--   window = [IST-today - 1 day, IST-today]
--
--   * INSERT: new.date must fall inside the window — yesterday catch-up is
--     allowed, future logs and deeper backfill are not.
--   * UPDATE: only rows whose date is still inside the window may be edited,
--     and the row cannot be moved outside it.
--   * DELETE: intentionally untouched — deleting your own data is a DPDP
--     right, and a deletion cannot fabricate compliance.
--
-- Escape hatch: the guard only applies when auth.uid() is not null, i.e. to
-- end-user JWT writes (the `authenticated` role). Service-role / admin
-- connections carry no auth.uid(), so migrations, support backfills and
-- data imports remain possible.

create or replace function public.enforce_checkin_date_window()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  ist_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  -- No end-user JWT (service-role/admin/postgres): skip the guard so
  -- operational backfills and imports keep working.
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.date > ist_today then
      raise exception 'Check-ins cannot be logged for a future date.';
    end if;
    if new.date < ist_today - 1 then
      raise exception 'Check-ins can only be logged for today or yesterday.';
    end if;
  elsif tg_op = 'UPDATE' then
    if old.date < ist_today - 1 then
      raise exception 'Check-ins older than yesterday are locked and can no longer be edited.';
    end if;
    if new.date > ist_today then
      raise exception 'Check-ins cannot be moved to a future date.';
    end if;
    if new.date < ist_today - 1 then
      raise exception 'Check-ins can only be dated today or yesterday.';
    end if;
  end if;

  return new;
end $$;

-- Function-grant hardening, same pattern as 20260711000002: this is
-- trigger-only — no role should be able to call it via RPC.
revoke execute on function public.enforce_checkin_date_window()
  from public, anon, authenticated;

create trigger checkins_date_window_guard
  before insert or update on public.checkins
  for each row execute function public.enforce_checkin_date_window();

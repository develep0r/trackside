-- roster_stats compared client-written dates against current_date in the DB
-- session zone (UTC on Supabase), while clients write `date` from device time
-- (IST). Between 00:00 and 05:30 IST, "logged today", days_since_log and the
-- 7-day windows were all off by a day. Anchor the view on the IST calendar day.

create or replace view public.roster_stats
with (security_invoker = on) as
select
  cp.id                                   as client_id,
  cp.trainer_id,
  cp.name,
  cp.sex,
  cp.goal,
  date_part('year', age(cp.dob))::int     as age,
  last7.logs_7d,
  latest.date                             as last_log_date,
  (ist.today - latest.date)               as days_since_log,
  latest.weight                           as weight_now,
  week_ago.weight                         as weight_7d_ago,
  round(latest.weight - week_ago.weight, 1) as weight_delta_7d
from public.client_profiles cp
cross join lateral (
  select (now() at time zone 'Asia/Kolkata')::date as today
) ist
left join lateral (
  select date, weight from public.checkins c
  where c.client_id = cp.id order by date desc limit 1
) latest on true
left join lateral (
  select weight from public.checkins c
  where c.client_id = cp.id and c.date <= ist.today - 7
  order by date desc limit 1
) week_ago on true
left join lateral (
  select count(*)::int as logs_7d from public.checkins c
  where c.client_id = cp.id and c.date > ist.today - 7
) last7 on true;

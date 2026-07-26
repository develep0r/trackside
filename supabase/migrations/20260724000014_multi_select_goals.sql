-- Fitness goals become multi-select: a client can work toward more than one
-- goal at once (e.g. lose_fat + stay_consistent). Converts the existing
-- single-value goal_type column to an array, preserving existing data by
-- wrapping each non-null value in a single-element array. Column name and
-- grants are unaffected — only the type changes.
-- roster_stats depends on the column (plain passthrough select), so it has
-- to be dropped and recreated around the type change. Definition below is
-- byte-for-byte the current one (confirmed via pg_get_viewdef before writing
-- this migration) — only cp.goal's underlying type changes.
drop view public.roster_stats;

alter table public.client_profiles
  alter column goal type goal_type[] using (case when goal is null then null else array[goal] end);

create view public.roster_stats
with (security_invoker = on) as
select
  cp.id as client_id,
  cp.trainer_id,
  cp.name,
  cp.sex,
  cp.goal,
  date_part('year', age(cp.dob::timestamp with time zone))::int as age,
  last7.logs_7d,
  latest.date as last_log_date,
  ist.today - latest.date as days_since_log,
  latest.weight as weight_now,
  week_ago.weight as weight_7d_ago,
  round(latest.weight - week_ago.weight, 1) as weight_delta_7d
from client_profiles cp
cross join lateral (select (now() at time zone 'Asia/Kolkata')::date as today) ist
left join lateral (
  select c.date, c.weight from checkins c
  where c.client_id = cp.id order by c.date desc limit 1
) latest on true
left join lateral (
  select c.weight from checkins c
  where c.client_id = cp.id and c.date <= (ist.today - 7)
  order by c.date desc limit 1
) week_ago on true
left join lateral (
  select count(*)::int as logs_7d from checkins c
  where c.client_id = cp.id and c.date > (ist.today - 7)
) last7 on true;

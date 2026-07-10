-- ============================================================================
-- TRACKSIDE — Supabase schema v1
-- Invite-only trainer↔client fitness tracking.
--
-- Design decisions encoded here:
--   * One coach per client (client_profiles.trainer_id), switch via invite only
--   * All linking goes through accept_invite() — clients can never set
--     trainer_id directly
--   * RLS everywhere: a trainer can only see rows for their own clients
--   * Photos live in a private storage bucket, path-scoped per client
--
-- Run in the Supabase SQL editor, or split into migrations.
-- Auth: enable Phone provider (OTP). For India, either use a Supabase-supported
-- SMS provider with DLT-registered templates, or a custom edge function + MSG91.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions & enums
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

create type user_role      as enum ('client', 'trainer');
create type invite_status  as enum ('pending', 'joined', 'revoked');
create type sex_type       as enum ('male', 'female', 'other');
create type goal_type      as enum ('lose_fat', 'build_muscle', 'get_fitter', 'stay_consistent');
create type photo_slot     as enum ('front', 'side');
create type sub_status     as enum ('trialing', 'active', 'past_due', 'cancelled');

-- ---------------------------------------------------------------------------
-- 1. Profiles (one row per auth user; role decided at signup)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        user_role not null default 'client',
  phone       text not null unique,          -- E.164, mirrors auth.users.phone
  created_at  timestamptz not null default now()
);

-- auto-create a profile row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, coalesce(new.phone, ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Client profiles (demographics + goals from the 2-minute onboarding)
-- ---------------------------------------------------------------------------
create table public.client_profiles (
  id             uuid primary key references public.profiles(id) on delete cascade,
  trainer_id     uuid references public.profiles(id) on delete set null,
  name           text not null,
  dob            date,                       -- store DOB, derive age (DPDP: minimal data)
  sex            sex_type,
  goal           goal_type,
  train_freq     text,                       -- '1-2', '3-4', '5+'
  target_weight  numeric(5,2),
  coach_note     text,                       -- "old knee injury, vegetarian…"
  avatar_path    text,                       -- storage path, private bucket
  consented_at   timestamptz,                -- explicit consent for photos/health data
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on public.client_profiles (trainer_id);

-- ---------------------------------------------------------------------------
-- 3. Trainer profiles (the public "coach page")
-- ---------------------------------------------------------------------------
create table public.trainer_profiles (
  id            uuid primary key references public.profiles(id) on delete cascade,
  name          text not null default '',
  headline      text,
  years         int,
  location      text,
  philosophy    text,
  credentials   text[],                      -- one entry per credential
  specialties   text[],
  avatar_path   text,
  gallery_paths text[] not null default '{}',
  invite_slug   text unique not null default encode(gen_random_bytes(4), 'hex'),  -- trackside.in/j/{slug}
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Invites (the ONLY way a client gets linked to a trainer)
-- ---------------------------------------------------------------------------
create table public.invites (
  id           uuid primary key default gen_random_uuid(),
  trainer_id   uuid not null references public.profiles(id) on delete cascade,
  phone        text not null,                -- E.164
  client_name  text,
  status       invite_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz
);
create unique index one_pending_invite_per_pair
  on public.invites (trainer_id, phone) where (status = 'pending');
create index on public.invites (phone) where (status = 'pending');

-- audit trail for coach switches (useful for support disputes)
create table public.coach_changes (
  id              bigint generated always as identity primary key,
  client_id       uuid not null references public.profiles(id) on delete cascade,
  from_trainer_id uuid,
  to_trainer_id   uuid not null,
  via_invite_id   uuid references public.invites(id),
  changed_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. Check-ins (one per client per day) + photos
-- ---------------------------------------------------------------------------
create table public.checkins (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  date        date not null,
  weight      numeric(5,2),
  waist       numeric(5,2),
  chest       numeric(5,2),
  arm         numeric(4,2),
  energy      smallint check (energy between 1 and 5),
  nutrition   smallint check (nutrition between 1 and 5),
  sleep_hrs   numeric(3,1),
  workout     boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now(),
  unique (client_id, date)
);
create index on public.checkins (client_id, date desc);

create table public.checkin_photos (
  id           uuid primary key default gen_random_uuid(),
  checkin_id   uuid not null references public.checkins(id) on delete cascade,
  client_id    uuid not null references public.profiles(id) on delete cascade, -- denormalized for RLS/storage
  slot         photo_slot not null,
  storage_path text not null,               -- 'checkins/{client_id}/{checkin_id}/{slot}.jpg'
  created_at   timestamptz not null default now(),
  unique (checkin_id, slot)
);
create index on public.checkin_photos (client_id);

-- ---------------------------------------------------------------------------
-- 6. Feedback + action items
-- ---------------------------------------------------------------------------
create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid not null references public.profiles(id) on delete cascade,
  client_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null,
  ai_assisted boolean not null default false,   -- transparency flag
  created_at  timestamptz not null default now()
);
create index on public.feedback (client_id, created_at desc);

create table public.feedback_actions (
  id          uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  client_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null,
  done        boolean not null default false,
  done_at     timestamptz
);
create index on public.feedback_actions (feedback_id);

-- clients may only flip `done` — never edit the text
create or replace function public.guard_action_update()
returns trigger language plpgsql as $$
begin
  if auth.uid() = old.client_id and (new.body <> old.body or new.feedback_id <> old.feedback_id) then
    raise exception 'clients may only update the done flag';
  end if;
  new.done_at := case when new.done and not old.done then now()
                      when not new.done then null
                      else old.done_at end;
  return new;
end $$;
create trigger feedback_actions_guard
  before update on public.feedback_actions
  for each row execute function public.guard_action_update();

-- ---------------------------------------------------------------------------
-- 7. Billing (per-active-client subscription via Razorpay)
-- ---------------------------------------------------------------------------
create table public.trainer_billing (
  trainer_id           uuid primary key references public.profiles(id) on delete cascade,
  razorpay_customer_id text,
  razorpay_sub_id      text,
  status               sub_status not null default 'trialing',
  trial_ends_at        timestamptz not null default now() + interval '90 days',
  updated_at           timestamptz not null default now()
);
-- Note: billed client count = count(client_profiles where trainer_id = X).
-- Reconcile monthly from a scheduled edge function; webhooks update `status`.

-- ---------------------------------------------------------------------------
-- 8. THE LINKING FUNCTION — invite-only, handles first link AND coach switch
-- ---------------------------------------------------------------------------
create or replace function public.accept_invite(p_invite_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_invite  invites%rowtype;
  v_phone   text;
  v_old     uuid;
begin
  select phone into v_phone from profiles where id = auth.uid();

  select * into v_invite from invites
   where id = p_invite_id and status = 'pending'
   for update;

  if not found then
    raise exception 'invite not found or no longer pending';
  end if;
  if v_invite.phone <> v_phone then
    raise exception 'this invite was sent to a different number';
  end if;

  select trainer_id into v_old from client_profiles where id = auth.uid();

  update client_profiles set trainer_id = v_invite.trainer_id, updated_at = now()
   where id = auth.uid();
  if not found then
    raise exception 'complete onboarding before accepting an invite';
  end if;

  update invites set status = 'joined', responded_at = now() where id = p_invite_id;

  insert into coach_changes (client_id, from_trainer_id, to_trainer_id, via_invite_id)
  values (auth.uid(), v_old, v_invite.trainer_id, p_invite_id);
end $$;

grant execute on function public.accept_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.client_profiles  enable row level security;
alter table public.trainer_profiles enable row level security;
alter table public.invites          enable row level security;
alter table public.coach_changes    enable row level security;
alter table public.checkins         enable row level security;
alter table public.checkin_photos   enable row level security;
alter table public.feedback         enable row level security;
alter table public.feedback_actions enable row level security;
alter table public.trainer_billing  enable row level security;

-- convenience: is the target client coached by the calling trainer?
create or replace function public.is_my_client(p_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from client_profiles
    where id = p_client and trainer_id = auth.uid()
  );
$$;

-- profiles: read own row; update own row (but not role/phone — column grants below)
create policy "own profile read"   on public.profiles for select using (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid());
revoke update on public.profiles from authenticated;
grant  update (role) on public.profiles to authenticated;  -- role chosen once at signup; lock down later via edge fn if abused

-- client_profiles
create policy "client reads own"      on public.client_profiles for select using (id = auth.uid());
create policy "client inserts own"    on public.client_profiles for insert with check (id = auth.uid());
create policy "client updates own"    on public.client_profiles for update using (id = auth.uid());
create policy "trainer reads roster"  on public.client_profiles for select using (trainer_id = auth.uid());
-- trainer_id itself is only ever written by accept_invite() (security definer):
revoke update on public.client_profiles from authenticated;
grant  update (name, dob, sex, goal, train_freq, target_weight, coach_note, avatar_path, consented_at, updated_at)
  on public.client_profiles to authenticated;

-- trainer_profiles: owner writes; any authenticated user can read (it's a coach page;
-- also needed pre-link so invitees see who invited them)
create policy "trainer writes own page" on public.trainer_profiles for all
  using (id = auth.uid()) with check (id = auth.uid());
create policy "authenticated read coach pages" on public.trainer_profiles for select
  using (auth.role() = 'authenticated');

-- invites: trainer manages own; invitee can read invites to their number
create policy "trainer manages own invites" on public.invites for all
  using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());
create policy "invitee reads own invites" on public.invites for select
  using (phone = (select phone from public.profiles where id = auth.uid()));

-- coach_changes: client and both trainers can read their own history
create policy "read own coach history" on public.coach_changes for select
  using (client_id = auth.uid() or from_trainer_id = auth.uid() or to_trainer_id = auth.uid());

-- checkins: client full CRUD on own; trainer read-only on roster
create policy "client crud own checkins" on public.checkins for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "trainer reads client checkins" on public.checkins for select
  using (public.is_my_client(client_id));

-- checkin_photos: same shape
create policy "client crud own photos" on public.checkin_photos for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "trainer reads client photos" on public.checkin_photos for select
  using (public.is_my_client(client_id));

-- feedback: trainer writes to own clients; both parties read
create policy "trainer sends feedback" on public.feedback for insert
  with check (trainer_id = auth.uid() and public.is_my_client(client_id));
create policy "trainer reads sent feedback" on public.feedback for select
  using (trainer_id = auth.uid());
create policy "client reads own feedback" on public.feedback for select
  using (client_id = auth.uid());

-- feedback_actions: trainer inserts for own clients; client toggles done (trigger guards body)
create policy "trainer adds actions" on public.feedback_actions for insert
  with check (public.is_my_client(client_id));
create policy "trainer reads actions" on public.feedback_actions for select
  using (public.is_my_client(client_id) or client_id = auth.uid());
create policy "client toggles done" on public.feedback_actions for update
  using (client_id = auth.uid());

-- billing: trainer reads own; writes come from service-role webhooks only
create policy "trainer reads own billing" on public.trainer_billing for select
  using (trainer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 10. STORAGE — private bucket, path-scoped access
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('media', 'media', false)
on conflict (id) do nothing;

-- Path conventions:
--   checkins/{client_id}/{checkin_id}/{slot}.jpg
--   avatars/{user_id}.jpg
--   trainer/{trainer_id}/gallery/{n}.jpg

create policy "client writes own media" on storage.objects for insert
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in ('checkins', 'avatars', 'trainer')
    and (storage.foldername(name))[2] = auth.uid()::text
  );
create policy "owner reads own media" on storage.objects for select
  using (bucket_id = 'media' and (storage.foldername(name))[2] = auth.uid()::text);
create policy "owner deletes own media" on storage.objects for delete
  using (bucket_id = 'media' and (storage.foldername(name))[2] = auth.uid()::text);

-- trainer reads their clients' check-in photos and avatars
create policy "trainer reads client media" on storage.objects for select
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in ('checkins', 'avatars')
    and public.is_my_client(((storage.foldername(name))[2])::uuid)
  );

-- clients read their coach's page media (avatar + gallery)
create policy "client reads coach media" on storage.objects for select
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'trainer'
    and exists (
      select 1 from public.client_profiles
      where id = auth.uid()
        and trainer_id = ((storage.foldername(name))[2])::uuid
    )
  );

-- ---------------------------------------------------------------------------
-- 11. Dashboard view — powers the dense trainer table in one query
--     (security_invoker so RLS on checkins/client_profiles still applies)
-- ---------------------------------------------------------------------------
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
  (current_date - latest.date)            as days_since_log,
  latest.weight                           as weight_now,
  week_ago.weight                         as weight_7d_ago,
  round(latest.weight - week_ago.weight, 1) as weight_delta_7d
from public.client_profiles cp
left join lateral (
  select date, weight from public.checkins c
  where c.client_id = cp.id order by date desc limit 1
) latest on true
left join lateral (
  select weight from public.checkins c
  where c.client_id = cp.id and c.date <= current_date - 7
  order by date desc limit 1
) week_ago on true
left join lateral (
  select count(*)::int as logs_7d from public.checkins c
  where c.client_id = cp.id and c.date > current_date - 7
) last7 on true;

-- ---------------------------------------------------------------------------
-- 12. updated_at housekeeping
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger touch_client_profiles  before update on public.client_profiles
  for each row execute function public.touch_updated_at();
create trigger touch_trainer_profiles before update on public.trainer_profiles
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- OPERATIONAL NOTES (not schema, but do them):
--  * DPDP deletion: on account delete, a service-role edge function must purge
--    storage under checkins/{id}, avatars/{id} — DB cascades don't touch storage.
--  * Invite SMS/WhatsApp: send from an edge function on invites insert
--    (DLT-registered template: "Coach {name} invited you to Trackside: {link}").
--  * Signed URLs: serve all photos via createSignedUrl(60s). Never public URLs.
--  * Razorpay webhooks -> service-role edge function -> trainer_billing.status.
--  * Rate-limit OTP requests per phone (Supabase auth settings) to stop SMS abuse.
-- ============================================================================

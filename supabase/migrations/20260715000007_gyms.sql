-- ============================================================================
-- GYMS — organizations that onboard/offboard trainers.
--
-- Design decisions:
--   * A gym is a membership layer over trainers; independent trainers keep
--     working exactly as before (no gym rows anywhere).
--   * Trainer onboarding to a gym is invite-only (same phone-invite mechanics
--     as client invites) and doubles as a trainer-role approval path:
--     accept_gym_invite() promotes the accepter to 'trainer' server-side.
--   * Offboarding deactivates the membership; the gym's clients of that
--     trainer are reassigned to a successor or left unassigned for the admin.
--     coach_changes keeps the audit trail either way, so a future
--     "clients follow the trainer" mode stays buildable.
--   * Gym admins manage members; they get NO access to client health data
--     (checkins/photos/feedback stay trainer+client only — DPDP posture).
--   * Billing stays per-trainer in v1; gyms.id is the anchor for gym-level
--     billing later.
-- ============================================================================

create type gym_member_role   as enum ('owner', 'admin', 'trainer');
create type gym_member_status as enum ('active', 'removed');

create table public.gyms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.gym_members (
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  trainer_id  uuid not null references public.profiles(id) on delete cascade,
  member_role gym_member_role   not null default 'trainer',
  status      gym_member_status not null default 'active',
  joined_at   timestamptz not null default now(),
  removed_at  timestamptz,
  primary key (gym_id, trainer_id)
);
create index on public.gym_members (trainer_id) where (status = 'active');

create table public.gym_trainer_invites (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms(id) on delete cascade,
  phone        text not null,
  trainer_name text,
  status       invite_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz
);
create unique index one_pending_gym_invite_per_pair
  on public.gym_trainer_invites (gym_id, phone) where (status = 'pending');
create index on public.gym_trainer_invites (phone) where (status = 'pending');

-- reuse the invites phone normalizer (it only touches new.phone)
create trigger gym_trainer_invites_normalize_phone
  before insert or update of phone on public.gym_trainer_invites
  for each row execute function public.invites_normalize_phone();

-- which gym a client belongs to (set at link time from the invite context);
-- null = independent-trainer client. Powers "clients stay with the gym".
alter table public.invites         add column gym_id uuid references public.gyms(id) on delete set null;
alter table public.client_profiles add column gym_id uuid references public.gyms(id) on delete set null;
create index on public.client_profiles (gym_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_gym_member(p_gym uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from gym_members
    where gym_id = p_gym and trainer_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.is_gym_admin(p_gym uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from gym_members
    where gym_id = p_gym and trainer_id = auth.uid()
      and member_role in ('owner', 'admin') and status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- RPCs (all linking/membership writes go through these, like accept_invite)
-- ---------------------------------------------------------------------------

-- Anyone with an account can open a gym and becomes its owner.
create or replace function public.create_gym(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_gym uuid;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'gym name is required';
  end if;
  insert into gyms (name, owner_id) values (trim(p_name), auth.uid())
  returning id into v_gym;
  insert into gym_members (gym_id, trainer_id, member_role)
  values (v_gym, auth.uid(), 'owner');
  return v_gym;
end $$;

-- Trainer accepts a gym invite: promoted to trainer role + active membership.
-- This is an approved path for role granting (see role-lockdown follow-up).
create or replace function public.accept_gym_invite(p_invite_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_invite gym_trainer_invites%rowtype;
  v_phone  text;
begin
  select phone into v_phone from profiles where id = auth.uid();

  select * into v_invite from gym_trainer_invites
   where id = p_invite_id and status = 'pending'
   for update;

  if not found then
    raise exception 'invite not found or no longer pending';
  end if;
  if v_invite.phone <> v_phone then
    raise exception 'this invite was sent to a different number';
  end if;

  update profiles set role = 'trainer' where id = auth.uid();
  insert into trainer_profiles (id, name)
  values (auth.uid(), coalesce(v_invite.trainer_name, ''))
  on conflict (id) do nothing;

  insert into gym_members (gym_id, trainer_id)
  values (v_invite.gym_id, auth.uid())
  on conflict (gym_id, trainer_id) do update
    set status = 'active', member_role = 'trainer',
        joined_at = now(), removed_at = null;

  update gym_trainer_invites
     set status = 'joined', responded_at = now()
   where id = p_invite_id;
end $$;

-- Offboard a trainer. Their clients IN THIS GYM go to p_successor (must be an
-- active member) or are left unassigned (trainer_id = null) for reassignment.
-- Independent clients of the same trainer are untouched.
create or replace function public.offboard_trainer(
  p_gym uuid, p_trainer uuid, p_successor uuid default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_gym_admin(p_gym) then
    raise exception 'only a gym owner or admin can offboard trainers';
  end if;
  if p_trainer = auth.uid() then
    raise exception 'admins cannot offboard themselves';
  end if;
  if exists (select 1 from gym_members
             where gym_id = p_gym and trainer_id = p_trainer and member_role = 'owner') then
    raise exception 'the gym owner cannot be offboarded';
  end if;
  if p_successor is not null and not exists (
    select 1 from gym_members
    where gym_id = p_gym and trainer_id = p_successor and status = 'active'
  ) then
    raise exception 'successor must be an active member of this gym';
  end if;

  update gym_members
     set status = 'removed', removed_at = now()
   where gym_id = p_gym and trainer_id = p_trainer and status = 'active';
  if not found then
    raise exception 'trainer is not an active member of this gym';
  end if;

  -- audit every reassignment, then move the gym's clients off the trainer
  insert into coach_changes (client_id, from_trainer_id, to_trainer_id)
  select id, p_trainer, p_successor
    from client_profiles
   where gym_id = p_gym and trainer_id = p_trainer
     and p_successor is not null;

  update client_profiles
     set trainer_id = p_successor, updated_at = now()
   where gym_id = p_gym and trainer_id = p_trainer;

  -- revoke the trainer's outstanding gym-context client invites
  update invites
     set status = 'revoked', responded_at = now()
   where trainer_id = p_trainer and gym_id = p_gym and status = 'pending';
end $$;

revoke execute on function public.create_gym(text)                     from public, anon;
revoke execute on function public.accept_gym_invite(uuid)              from public, anon;
revoke execute on function public.offboard_trainer(uuid, uuid, uuid)   from public, anon;
revoke execute on function public.is_gym_member(uuid)                  from public, anon;
revoke execute on function public.is_gym_admin(uuid)                   from public, anon;
grant execute on function public.create_gym(text)                   to authenticated;
grant execute on function public.accept_gym_invite(uuid)            to authenticated;
grant execute on function public.offboard_trainer(uuid, uuid, uuid) to authenticated;
grant execute on function public.is_gym_member(uuid)                to authenticated;
grant execute on function public.is_gym_admin(uuid)                 to authenticated;

-- accept_invite: carry the gym context onto the client at link time
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

  update client_profiles
     set trainer_id = v_invite.trainer_id, gym_id = v_invite.gym_id, updated_at = now()
   where id = auth.uid();
  if not found then
    raise exception 'complete onboarding before accepting an invite';
  end if;

  update invites set status = 'joined', responded_at = now() where id = p_invite_id;

  insert into coach_changes (client_id, from_trainer_id, to_trainer_id, via_invite_id)
  values (auth.uid(), v_old, v_invite.trainer_id, p_invite_id);
end $$;

-- trainers stamp their gym on client invites they send (nullable, optional)
-- enforced: you can only tag a gym you're an active member of
create or replace function public.invites_check_gym()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.gym_id is not null and not exists (
    select 1 from gym_members
    where gym_id = new.gym_id and trainer_id = new.trainer_id and status = 'active'
  ) then
    raise exception 'trainer is not an active member of that gym';
  end if;
  return new;
end $$;
revoke execute on function public.invites_check_gym() from public, anon, authenticated;
create trigger invites_check_gym
  before insert or update of gym_id on public.invites
  for each row execute function public.invites_check_gym();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.gyms                enable row level security;
alter table public.gym_members         enable row level security;
alter table public.gym_trainer_invites enable row level security;

-- gyms: members see their gym; owner/admin can rename
create policy "members read own gym" on public.gyms for select
  using (public.is_gym_member(id));
create policy "admins update own gym" on public.gyms for update
  using (public.is_gym_admin(id));

-- gym_members: visible to fellow members; all writes via RPCs
create policy "members read gym roster" on public.gym_members for select
  using (public.is_gym_member(gym_id));

-- gym_trainer_invites: admins manage; invitee reads invites to their number
create policy "admins read gym invites" on public.gym_trainer_invites for select
  using (public.is_gym_admin(gym_id));
create policy "admins create gym invites" on public.gym_trainer_invites for insert
  with check (public.is_gym_admin(gym_id));
create policy "admins update gym invites" on public.gym_trainer_invites for update
  using (public.is_gym_admin(gym_id));
create policy "admins delete gym invites" on public.gym_trainer_invites for delete
  using (public.is_gym_admin(gym_id));
create policy "invitee reads gym invites" on public.gym_trainer_invites for select
  using (phone = (select phone from public.profiles where id = (select auth.uid())));

-- NOTE deliberately absent: gym admins get no policies on checkins,
-- checkin_photos, feedback, or client_profiles. Client health data stays
-- between the client and their current trainer.

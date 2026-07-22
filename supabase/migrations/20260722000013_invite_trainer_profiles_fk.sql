-- PostgREST embedding requires a direct FK between the two embedded tables.
-- invites.trainer_id and gym_members.trainer_id both only had an FK to
-- profiles(id) — trainer_profiles(id) also references profiles(id), but
-- that's a sibling relationship, not a path PostgREST can traverse. Any
-- `select("trainer:trainer_profiles(...)")` off these tables failed with
-- "Could not find a relationship between 'invites' and 'trainer_profiles'
-- in the schema cache" (getMyPendingInvites), and would fail identically
-- for getGymMembers once exercised.
--
-- Safe to add: every trainer_id here is guaranteed to already have a
-- trainer_profiles row (accept_invite/promote_to_trainer/accept_gym_invite
-- all upsert trainer_profiles whenever a profile becomes a trainer), so
-- this FK can never be violated by existing or future data.

alter table public.invites
  add constraint invites_trainer_id_trainer_profiles_fkey
  foreign key (trainer_id) references public.trainer_profiles(id) on delete cascade;

alter table public.gym_members
  add constraint gym_members_trainer_id_trainer_profiles_fkey
  foreign key (trainer_id) references public.trainer_profiles(id) on delete cascade;

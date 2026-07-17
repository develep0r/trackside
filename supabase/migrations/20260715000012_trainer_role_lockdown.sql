-- Close the trainer role-escalation hole flagged in the init migration
-- ("role chosen once at signup; lock down later via edge fn if abused"):
-- `grant update (role) on profiles to authenticated` let ANY signed-in user
-- flip themselves to 'trainer' — free product access, fake coaches, and a
-- bypass of the whole trust model.
--
-- After this migration, the trainer role is granted ONLY via:
--   (a) accept_gym_invite()   — gym-invited trainers (see 20260715000007)
--   (b) promote_to_trainer()  — founder-approved independents, service-role
--                               only (SQL editor / admin script)
--
-- The 'role' column was the only profiles column granted for update to
-- authenticated (the blanket update was revoked in the init migration), so
-- profiles becomes effectively read-only to end users. That is correct:
-- id/phone mirror auth, role is managed, created_at is history. The
-- "own profile update" RLS policy is left in place — harmless without a
-- column grant, and future user-editable columns will want it.

revoke update (role) on public.profiles from authenticated;

create or replace function public.promote_to_trainer(p_phone text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_phone text;
  v_id    uuid;
begin
  v_phone := normalize_phone(p_phone);
  if v_phone is null then
    raise exception 'unrecognizable phone number: %', p_phone;
  end if;

  select id into v_id from profiles where phone = v_phone;
  if not found then
    raise exception 'no account exists with phone % — the user must sign up first', v_phone;
  end if;

  update profiles set role = 'trainer' where id = v_id;
  insert into trainer_profiles (id) values (v_id)
  on conflict (id) do nothing;
end $$;

-- Service-role only: intentionally NOT granted to authenticated. Founders
-- provision independent coaches from the SQL editor / an admin script.
revoke execute on function public.promote_to_trainer(text) from public, anon, authenticated;

-- Invite-gated signup, enforced server-side.
--
-- Bug: "client inserts own" (20260711000003) only checked
-- id = (select auth.uid()), so anyone who passed phone-OTP signup could
-- insert a client_profiles row and start using Trackside without ever being
-- invited. PR #1 gated this in the prototype UI only — the database (and
-- therefore the API surface) still accepted the row.
--
-- Fix: the insert policy now also requires a PENDING invite whose phone
-- matches the caller's profiles.phone.
--
-- Flow-ordering nuance (why status = 'pending'):
--   1. trainer creates invite (invites.status = 'pending')
--   2. client signs up via phone OTP -> handle_new_user() creates profiles row
--   3. client completes onboarding -> INSERT into client_profiles  <-- gate here
--   4. client calls accept_invite() -> links trainer, flips invite to 'joined'
-- accept_invite() itself refuses to run before onboarding ("complete
-- onboarding before accepting an invite"), so at insert time the matching
-- invite is necessarily still 'pending' — the gate must check
-- status = 'pending', not 'joined'.
--
-- Phone matching: profiles.phone mirrors auth.users.phone, and invites.phone
-- is normalized on write (20260715000005); both are E.164 digits WITHOUT the
-- leading '+', so plain equality is correct.
--
-- RLS-in-RLS note: the exists() subquery runs under the caller's own RLS.
-- That's fine — "trainer or invitee reads" on invites lets an invitee read
-- exactly the invites addressed to their own number, which are the only rows
-- this gate needs to see. No security-definer helper required, and no policy
-- recursion (client_profiles -> invites/profiles only).
--
-- Trainers never insert client_profiles rows (they only appear as trainer_id,
-- written exclusively by accept_invite), so no trainer exception is needed.
-- UPDATEs stay ungated: column grants + accept_invite() already own that path.

drop policy "client inserts own" on public.client_profiles;

create policy "invited client inserts own" on public.client_profiles for insert
  with check (
    id = (select auth.uid())
    and exists (
      select 1
      from public.invites i
      where i.status = 'pending'
        and i.phone = (select phone from public.profiles where id = (select auth.uid()))
    )
  );

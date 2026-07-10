-- 1) Missing FK indexes
create index if not exists coach_changes_client_id_idx on public.coach_changes (client_id);
create index if not exists coach_changes_via_invite_id_idx on public.coach_changes (via_invite_id);
create index if not exists feedback_trainer_id_idx on public.feedback (trainer_id);
create index if not exists feedback_actions_client_id_idx on public.feedback_actions (client_id);

-- 2) Rewrite policies: wrap auth.uid() in (select ...) for initplan caching,
--    and merge duplicate permissive SELECT policies into single OR policies.

-- profiles
drop policy "own profile read" on public.profiles;
drop policy "own profile update" on public.profiles;
create policy "own profile read" on public.profiles for select
  using (id = (select auth.uid()));
create policy "own profile update" on public.profiles for update
  using (id = (select auth.uid()));

-- client_profiles
drop policy "client reads own" on public.client_profiles;
drop policy "trainer reads roster" on public.client_profiles;
drop policy "client inserts own" on public.client_profiles;
drop policy "client updates own" on public.client_profiles;
create policy "client or coach reads" on public.client_profiles for select
  using (id = (select auth.uid()) or trainer_id = (select auth.uid()));
create policy "client inserts own" on public.client_profiles for insert
  with check (id = (select auth.uid()));
create policy "client updates own" on public.client_profiles for update
  using (id = (select auth.uid()));

-- trainer_profiles (split FOR ALL to avoid double SELECT policies)
drop policy "trainer writes own page" on public.trainer_profiles;
drop policy "authenticated read coach pages" on public.trainer_profiles;
create policy "coach pages readable" on public.trainer_profiles for select
  to authenticated using (true);
create policy "trainer inserts own page" on public.trainer_profiles for insert
  to authenticated with check (id = (select auth.uid()));
create policy "trainer updates own page" on public.trainer_profiles for update
  to authenticated using (id = (select auth.uid()));
create policy "trainer deletes own page" on public.trainer_profiles for delete
  to authenticated using (id = (select auth.uid()));

-- invites (split FOR ALL; merge SELECTs)
drop policy "trainer manages own invites" on public.invites;
drop policy "invitee reads own invites" on public.invites;
create policy "trainer or invitee reads" on public.invites for select
  using (
    trainer_id = (select auth.uid())
    or phone = (select phone from public.profiles where id = (select auth.uid()))
  );
create policy "trainer creates invites" on public.invites for insert
  with check (trainer_id = (select auth.uid()));
create policy "trainer updates invites" on public.invites for update
  using (trainer_id = (select auth.uid()));
create policy "trainer deletes invites" on public.invites for delete
  using (trainer_id = (select auth.uid()));

-- coach_changes
drop policy "read own coach history" on public.coach_changes;
create policy "read own coach history" on public.coach_changes for select
  using (
    client_id = (select auth.uid())
    or from_trainer_id = (select auth.uid())
    or to_trainer_id = (select auth.uid())
  );

-- checkins (split FOR ALL; merge SELECTs)
drop policy "client crud own checkins" on public.checkins;
drop policy "trainer reads client checkins" on public.checkins;
create policy "client or coach reads checkins" on public.checkins for select
  using (client_id = (select auth.uid()) or public.is_my_client(client_id));
create policy "client inserts own checkins" on public.checkins for insert
  with check (client_id = (select auth.uid()));
create policy "client updates own checkins" on public.checkins for update
  using (client_id = (select auth.uid()));
create policy "client deletes own checkins" on public.checkins for delete
  using (client_id = (select auth.uid()));

-- checkin_photos (same shape)
drop policy "client crud own photos" on public.checkin_photos;
drop policy "trainer reads client photos" on public.checkin_photos;
create policy "client or coach reads photos" on public.checkin_photos for select
  using (client_id = (select auth.uid()) or public.is_my_client(client_id));
create policy "client inserts own photos" on public.checkin_photos for insert
  with check (client_id = (select auth.uid()));
create policy "client updates own photos" on public.checkin_photos for update
  using (client_id = (select auth.uid()));
create policy "client deletes own photos" on public.checkin_photos for delete
  using (client_id = (select auth.uid()));

-- feedback (merge SELECTs)
drop policy "trainer sends feedback" on public.feedback;
drop policy "trainer reads sent feedback" on public.feedback;
drop policy "client reads own feedback" on public.feedback;
create policy "sender or recipient reads" on public.feedback for select
  using (trainer_id = (select auth.uid()) or client_id = (select auth.uid()));
create policy "trainer sends feedback" on public.feedback for insert
  with check (trainer_id = (select auth.uid()) and public.is_my_client(client_id));

-- feedback_actions
drop policy "trainer adds actions" on public.feedback_actions;
drop policy "trainer reads actions" on public.feedback_actions;
drop policy "client toggles done" on public.feedback_actions;
create policy "coach or client reads actions" on public.feedback_actions for select
  using (client_id = (select auth.uid()) or public.is_my_client(client_id));
create policy "trainer adds actions" on public.feedback_actions for insert
  with check (public.is_my_client(client_id));
create policy "client toggles done" on public.feedback_actions for update
  using (client_id = (select auth.uid()));

-- trainer_billing
drop policy "trainer reads own billing" on public.trainer_billing;
create policy "trainer reads own billing" on public.trainer_billing for select
  using (trainer_id = (select auth.uid()));

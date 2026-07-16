-- Invite matching is a raw string compare against profiles.phone (which
-- mirrors auth.users.phone: E.164 digits WITHOUT the leading '+', e.g.
-- '919876543210'). A trainer typing '+91 98765 43210', '098765...' or a bare
-- 10-digit number created an invite that would never match at sign-in —
-- silently fatal once signup is invite-gated. Normalize at write time.

create or replace function public.normalize_phone(p text)
returns text language plpgsql immutable set search_path = public as $$
declare d text;
begin
  d := regexp_replace(coalesce(p, ''), '\D', '', 'g');
  if length(d) = 10 and d ~ '^[6-9]' then return '91' || d; end if;       -- bare Indian mobile
  if length(d) = 11 and d ~ '^0[6-9]' then return '91' || substr(d, 2); end if;  -- trunk-0 prefix
  if length(d) = 12 and d ~ '^91[6-9]' then return d; end if;             -- already 91-prefixed
  if length(d) between 8 and 15 and left(trim(coalesce(p, '')), 1) = '+' then
    return d;                                                             -- other intl numbers, keep digits
  end if;
  return null;                                                            -- unrecognizable
end $$;

revoke execute on function public.normalize_phone(text) from public, anon;
grant execute on function public.normalize_phone(text) to authenticated;

create or replace function public.invites_normalize_phone()
returns trigger language plpgsql set search_path = public as $$
declare n text;
begin
  n := normalize_phone(new.phone);
  if n is null then
    raise exception 'invalid phone number for invite: %', new.phone;
  end if;
  new.phone := n;
  return new;
end $$;

revoke execute on function public.invites_normalize_phone() from public, anon, authenticated;

create trigger invites_normalize_phone
  before insert or update of phone on public.invites
  for each row execute function public.invites_normalize_phone();

-- Best-effort backfill of existing rows (pending invites created before this
-- migration would otherwise never match). Rows that can't be normalized are
-- left untouched rather than destroyed.
-- Guard against the one_pending_invite_per_pair unique index: if a trainer
-- somehow has pending invites in two formats that normalize to the same
-- number, keep the first and skip the duplicate instead of failing the push.
update public.invites i
   set phone = public.normalize_phone(i.phone)
 where public.normalize_phone(i.phone) is not null
   and i.phone <> public.normalize_phone(i.phone)
   and not exists (
     select 1 from public.invites j
      where j.id <> i.id
        and j.trainer_id = i.trainer_id
        and j.status = 'pending' and i.status = 'pending'
        and public.normalize_phone(j.phone) = public.normalize_phone(i.phone)
        and j.id < i.id
   );

-- Lock down SECURITY DEFINER function execution (advisor lints 0028/0029)

-- accept_invite: authenticated only — it's the one legitimate client-callable RPC
revoke execute on function public.accept_invite(uuid) from public, anon;
grant execute on function public.accept_invite(uuid) to authenticated;

-- handle_new_user: trigger-only, no role should call it via RPC
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- rls_auto_enable: internal helper, not an API surface
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- is_my_client: needed by RLS policy evaluation for signed-in users only
revoke execute on function public.is_my_client(uuid) from public, anon;
grant execute on function public.is_my_client(uuid) to authenticated;

-- Pin search_path on the two trigger functions (advisor lint 0011)
alter function public.touch_updated_at() set search_path = public;
alter function public.guard_action_update() set search_path = public;

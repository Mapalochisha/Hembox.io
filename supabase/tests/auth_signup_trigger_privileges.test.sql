-- The auth signup trigger remains attached, but cannot be invoked through
-- the PostgREST RPC surface by anon or authenticated users.
\set ON_ERROR_STOP on
begin;

do $test$
begin
  if has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE') then
    raise exception 'anon must not be able to execute public.handle_new_user()';
  end if;
  if has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE') then
    raise exception 'authenticated must not be able to execute public.handle_new_user()';
  end if;
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'on_auth_user_created'
      and n.nspname = 'auth'
      and c.relname = 'users'
      and t.tgfoid = 'public.handle_new_user()'::regprocedure
      and not t.tgisinternal
  ) then
    raise exception 'The auth user creation trigger must remain attached';
  end if;
end;
$test$;

rollback;

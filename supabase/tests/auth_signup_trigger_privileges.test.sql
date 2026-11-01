-- The auth signup trigger remains functional but is not an exposed RPC.
\set ON_ERROR_STOP on
begin;

do $test$
declare
  v_user_id uuid := 'ab111111-1111-4111-8111-111111111111';
  v_search_path text;
begin
  if has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE') then
    raise exception 'anon must not be able to execute public.handle_new_user()';
  end if;
  if has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE') then
    raise exception 'authenticated must not be able to execute public.handle_new_user()';
  end if;

  select array_to_string(p.proconfig, ',') into v_search_path
  from pg_proc p where p.oid = 'public.handle_new_user()'::regprocedure;
  if v_search_path is distinct from 'search_path=""' then
    raise exception 'handle_new_user must use an empty search_path; got %', v_search_path;
  end if;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'on_auth_user_created' and n.nspname = 'auth'
      and c.relname = 'users' and t.tgfoid = 'public.handle_new_user()'::regprocedure
      and not t.tgisinternal
  ) then
    raise exception 'The auth user creation trigger must remain attached';
  end if;

  insert into auth.users (id, email, raw_user_meta_data)
  values (v_user_id, 'signup-trigger@example.test',
    jsonb_build_object('full_name', 'Signup Trigger Test', 'avatar_url', 'https://example.test/avatar.png'));

  if not exists (
    select 1 from public.profiles p
    where p.id = v_user_id and p.email = 'signup-trigger@example.test'
      and p.full_name = 'Signup Trigger Test' and p.avatar_url = 'https://example.test/avatar.png'
      and p.role = 'user'
  ) then
    raise exception 'Auth signup trigger no longer creates the expected user profile';
  end if;
end;
$test$;

rollback;

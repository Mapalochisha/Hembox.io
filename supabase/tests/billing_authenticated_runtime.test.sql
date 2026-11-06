\set ON_ERROR_STOP on
begin;

insert into auth.users(id,email) values
  ('88888888-8888-4888-8888-888888888881','runtime-customer@example.test'),
  ('88888888-8888-4888-8888-888888888882','runtime-admin@example.test')
on conflict (id) do update set email=excluded.email;
insert into public.profiles(id,email,role) values
  ('88888888-8888-4888-8888-888888888881','runtime-customer@example.test','user'),
  ('88888888-8888-4888-8888-888888888882','runtime-admin@example.test','admin')
on conflict (id) do update set email=excluded.email, role=excluded.role;

-- A customer may read their own role, but cannot use this helper to enumerate another user's role.
select set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888881',true);
set local role authenticated;
do $test$
begin
  if public.get_user_role('88888888-8888-4888-8888-888888888881') is distinct from 'user' then
    raise exception 'Customer must be able to read their own role';
  end if;
  if public.get_user_role('88888888-8888-4888-8888-888888888882') is not null then
    raise exception 'Customer must not be able to read another user role';
  end if;
end
$test$;
reset role;

-- Administrators may inspect another user's role; anonymous callers may not execute the helper.
select set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888882',true);
set local role authenticated;
do $test$
begin
  if public.get_user_role('88888888-8888-4888-8888-888888888881') is distinct from 'user' then
    raise exception 'Administrator must be able to inspect customer role';
  end if;
  if public.get_user_role('88888888-8888-4888-8888-888888888882') is distinct from 'admin' then
    raise exception 'Administrator must be able to read their own role';
  end if;
  if has_function_privilege('anon', 'public.get_user_role(uuid)', 'EXECUTE') then
    raise exception 'Anonymous role must not execute get_user_role';
  end if;
end
$test$;
reset role;

-- Authenticated non-admins may execute the wrapper but cannot invoke the privileged operation.
select set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888881',true);
set local role authenticated;
do $test$
declare v_denied boolean := false;
begin
  begin
    perform * from public.authenticated_review_billing_payment_claim(
      '88888888-8888-4888-8888-888888888899','verified',null
    );
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then raise exception 'Non-admin authenticated billing review was not denied'; end if;
end
$test$;
reset role;

-- The real admin passes the identity guard; the nonexistent claim then fails with P0002.
select set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888882',true);
set local role authenticated;
do $test$
declare v_missing boolean := false;
begin
  begin
    perform * from public.authenticated_review_billing_payment_claim(
      '88888888-8888-4888-8888-888888888899','verified',null
    );
  exception when no_data_found then
    v_missing := true;
  end;
  if not v_missing then raise exception 'Admin wrapper did not reach claim lookup'; end if;
end
$test$;
reset role;

rollback;

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

begin;
do $$
declare
  v_table regclass := to_regclass('public.domain_sandbox_management_requests');
  v_rls boolean;
  v_service_grant boolean;
  v_user_grant boolean;
  v_constraint_count integer;
begin
  if v_table is null then raise exception 'sandbox management request table is missing'; end if;
  select relrowsecurity into v_rls from pg_class where oid = v_table;
  if not v_rls then raise exception 'sandbox management requests must have RLS enabled'; end if;
  select has_table_privilege('service_role', v_table, 'select,insert,update,delete') into v_service_grant;
  if not v_service_grant then raise exception 'service_role must manage sandbox requests'; end if;
  select has_table_privilege('authenticated', v_table, 'select,insert,update,delete') into v_user_grant;
  if v_user_grant then raise exception 'authenticated users must not access sandbox requests directly'; end if;
  select count(*) into v_constraint_count from pg_constraint
    where conrelid = v_table and contype = 'c';
  if v_constraint_count < 3 then raise exception 'expected request payload, idempotency and status constraints'; end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='domain_sandbox_management_customer_idempotency_idx') then
    raise exception 'customer idempotency index is missing';
  end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='domain_sandbox_management_status_created_idx') then
    raise exception 'management queue index is missing';
  end if;
end $$;
rollback;

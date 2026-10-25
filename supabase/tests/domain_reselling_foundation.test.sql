-- Integration checks for 20261016093000_domain_reselling_foundation.sql.
-- Runs against a disposable PostgreSQL/Supabase-compatible test database.
\set ON_ERROR_STOP on

begin;

do $test$
declare
  table_name text;
  has_rls boolean;
begin
  foreach table_name in array array['domain_tld_catalog', 'domain_orders', 'domain_audit_events']
  loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'Expected table public.% is missing', table_name;
    end if;
    select c.relrowsecurity into has_rls
      from pg_class c where c.oid = to_regclass(format('public.%I', table_name));
    if not has_rls then
      raise exception 'RLS is not enabled for public.%', table_name;
    end if;
  end loop;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'domain_orders'
      and policyname = 'Customers can read their own domain orders' and cmd = 'SELECT'
  ) then
    raise exception 'Customer-owned order SELECT policy is missing';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'domain_orders'
      and policyname = 'Admins can read domain orders' and cmd = 'SELECT'
  ) then
    raise exception 'Admin order SELECT policy is missing';
  end if;

  if has_table_privilege('anon', 'public.domain_tld_catalog', 'SELECT')
     or has_table_privilege('authenticated', 'public.domain_tld_catalog', 'SELECT') then
    raise exception 'Public/authenticated roles must not read the TLD catalogue';
  end if;

  if not has_table_privilege('service_role', 'public.domain_tld_catalog', 'SELECT')
     or not has_table_privilege('service_role', 'public.domain_orders', 'INSERT') then
    raise exception 'service_role is missing expected server-side privileges';
  end if;

  insert into public.domain_orders (customer_email, domain_name)
  values ('schema-test@example.com', 'example.com');

  begin
    insert into public.domain_tld_catalog (tld, provider_id, wholesale_currency, enabled)
    values ('.invalid', 'test-provider', 'USD', true);
    raise exception 'Enabled TLD without retail prices was unexpectedly accepted';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.domain_orders (customer_email, domain_name)
    values ('schema-test@example.com', 'Invalid Domain.COM');
    raise exception 'Invalid domain syntax was unexpectedly accepted';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.domain_orders (customer_email, domain_name, status)
    values ('schema-test@example.com', 'quoted.example', 'quoted');
    raise exception 'Quoted order without price snapshots was unexpectedly accepted';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.domain_orders (
      customer_email, domain_name, status, registration_retail_minor, renewal_retail_minor
    ) values ('schema-test@example.com', 'registered.example', 'registered', 1000, 1000);
    raise exception 'Registered order without provider/registration timestamp was unexpectedly accepted';
  exception when check_violation then
    null;
  end;

  insert into public.domain_orders (
    customer_email, domain_name, provider_id, provider_order_reference
  ) values ('schema-test@example.com', 'provider-one.example', 'test-provider', 'order-ref-1');

  begin
    insert into public.domain_orders (
      customer_email, domain_name, provider_id, provider_order_reference
    ) values ('schema-test@example.com', 'provider-two.example', 'test-provider', 'order-ref-1');
    raise exception 'Duplicate provider order reference was unexpectedly accepted';
  exception when unique_violation then
    null;
  end;
end;
$test$;

rollback;

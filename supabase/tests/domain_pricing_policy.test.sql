-- Integration checks for 20261018090000_domain_pricing_policy.sql.
\set ON_ERROR_STOP on

begin;

do $test$
declare
  has_rls boolean;
begin
  if to_regclass('public.domain_price_snapshots') is null then
    raise exception 'domain_price_snapshots table is missing';
  end if;

  select c.relrowsecurity into has_rls
    from pg_class c where c.oid = to_regclass('public.domain_price_snapshots');
  if not has_rls then
    raise exception 'RLS must be enabled on domain_price_snapshots';
  end if;

  if has_table_privilege('anon', 'public.domain_price_snapshots', 'SELECT')
     or has_table_privilege('authenticated', 'public.domain_price_snapshots', 'SELECT') then
    raise exception 'Price history must not be directly readable by public/authenticated roles';
  end if;

  if not has_table_privilege('service_role', 'public.domain_price_snapshots', 'INSERT') then
    raise exception 'service_role must be able to write price history';
  end if;

  begin
    insert into public.domain_tld_catalog (
      tld, provider_id, wholesale_currency, retail_currency,
      registration_wholesale_minor, renewal_wholesale_minor,
      registration_retail_minor, renewal_retail_minor, enabled
    ) values (
      '.invalid', 'test-provider', 'USD', 'ZMW', 100, 100, 1000, 1000, true
    );
    raise exception 'Enabled TLD without FX/margin/source/timestamp was unexpectedly accepted';
  exception when check_violation then
    null;
  end;
end;
$test$;

rollback;

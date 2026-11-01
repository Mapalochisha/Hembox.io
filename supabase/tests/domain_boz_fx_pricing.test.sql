begin;

do $$
declare
  v_columns integer;
begin
  select count(*) into v_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'domain_fx_rate_snapshots'
    and column_name in ('published_rate','buffer_zmw','effective_rate','rate_date','official_source_url','retrieval_source_url');
  if v_columns <> 6 then
    raise exception 'Expected complete BoZ FX audit columns, found %', v_columns;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='domain_tld_catalog'
      and column_name='minimum_margin_zmw_minor'
  ) then
    raise exception 'TLD catalogue minimum margin column is missing';
  end if;

  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='domain_fx_rate_snapshots' and c.relrowsecurity
  ) then
    raise exception 'BoZ FX history must have RLS enabled';
  end if;

  if has_table_privilege('anon','public.domain_fx_rate_snapshots','SELECT')
     or has_table_privilege('authenticated','public.domain_fx_rate_snapshots','SELECT') then
    raise exception 'BoZ FX history must not be directly readable by API roles';
  end if;

  if not has_table_privilege('service_role','public.domain_fx_rate_snapshots','INSERT') then
    raise exception 'Service role must be able to persist FX snapshots';
  end if;
end;
$$;

rollback;

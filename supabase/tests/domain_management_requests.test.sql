begin;

do $$
begin
  if to_regclass('public.domain_management_requests') is null then
    raise exception 'domain_management_requests table is missing';
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'domain_management_requests' and c.relrowsecurity
  ) then
    raise exception 'domain_management_requests must have RLS enabled';
  end if;
  if not has_table_privilege('authenticated', 'public.domain_management_requests', 'SELECT') then
    raise exception 'authenticated users should have SELECT subject to owner/admin RLS policies';
  end if;
  if has_table_privilege('anon', 'public.domain_management_requests', 'SELECT') then
    raise exception 'anon must not read domain management requests';
  end if;
  if not has_table_privilege('service_role', 'public.domain_management_requests', 'SELECT') then
    raise exception 'service_role must read domain management requests';
  end if;
  if has_function_privilege('anon', 'public.create_domain_management_request(uuid,uuid,text,integer,text[],text,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.create_domain_management_request(uuid,uuid,text,integer,text[],text,text)', 'EXECUTE') then
    raise exception 'customers must not execute the service-only management request RPC directly';
  end if;
  if not has_function_privilege('service_role', 'public.create_domain_management_request(uuid,uuid,text,integer,text[],text,text)', 'EXECUTE') then
    raise exception 'service_role must execute the management request RPC';
  end if;
  if has_function_privilege('anon', 'public.record_domain_management_outcome(uuid,uuid,text,text,text[],timestamp with time zone,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.record_domain_management_outcome(uuid,uuid,text,text,text[],timestamp with time zone,jsonb)', 'EXECUTE') then
    raise exception 'management outcome RPC must not be directly executable by API roles';
  end if;
  if not has_function_privilege('service_role', 'public.record_domain_management_outcome(uuid,uuid,text,text,text[],timestamp with time zone,jsonb)', 'EXECUTE') then
    raise exception 'service_role must execute the management outcome RPC';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='domain_orders' and column_name='nameservers') then
    raise exception 'domain_orders.nameservers column is missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='domain_management_requests' and policyname='Customers can read their own domain management requests') then
    raise exception 'owner-scoped customer read policy is missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='domain_management_requests' and policyname='Admins can read domain management requests') then
    raise exception 'admin read policy is missing';
  end if;
end;
$$;

rollback;

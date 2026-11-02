begin;

insert into auth.users (id, email)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sandbox-owner@example.test')
on conflict (id) do nothing;

insert into public.domain_sandbox_orders (
  id, customer_id, domain_name, term_years, status, registrant_details, idempotency_key
) values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'sandbox-journey-check.com',
  1,
  'quoted',
  '{"firstName":"Test","lastName":"Owner","email":"sandbox-owner@example.test","countryCode":"ZM"}'::jsonb,
  'sandbox-test-key-0001'
);

do $$
begin
  if not exists (
    select 1 from public.domain_sandbox_orders
    where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and payment_mode = 'sandbox_simulated'
      and payment_status = 'not_started'
      and provider_environment = 'test'
  ) then
    raise exception 'sandbox orders must default to test-only provider and payment modes';
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relname='domain_sandbox_orders' and c.relrowsecurity
  ) then
    raise exception 'sandbox orders must have RLS enabled';
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relname='domain_sandbox_events' and c.relrowsecurity
  ) then
    raise exception 'sandbox events must have RLS enabled';
  end if;
  if has_table_privilege('anon','public.domain_sandbox_orders','SELECT')
     or has_table_privilege('authenticated','public.domain_sandbox_orders','SELECT') then
    raise exception 'registrant details and sandbox order records must not be directly readable by API roles';
  end if;
  if has_table_privilege('anon','public.domain_sandbox_events','SELECT')
     or has_table_privilege('authenticated','public.domain_sandbox_events','SELECT') then
    raise exception 'sandbox event ledger must not be directly readable by API roles';
  end if;
  if not has_table_privilege('service_role','public.domain_sandbox_orders','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'service_role must manage sandbox orders';
  end if;
  if not has_table_privilege('service_role','public.domain_sandbox_events','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'service_role must manage sandbox events';
  end if;
end;
$$;

do $$
begin
  begin
    insert into public.domain_sandbox_orders (
      customer_id, domain_name, term_years, status, payment_mode,
      registrant_details, idempotency_key
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'invalid-payment-mode.com',
      1,
      'quoted',
      'real_payment',
      '{}'::jsonb,
      'sandbox-test-key-0002'
    );
    raise exception 'a live payment mode must be rejected';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.domain_sandbox_orders (
      customer_id, domain_name, term_years, status, registrant_details, idempotency_key
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'sandbox-journey-check.com',
      1,
      'registration_pending',
      '{}'::jsonb,
      'sandbox-test-key-0003'
    );
    raise exception 'a second active sandbox order for the same domain must be rejected';
  exception when unique_violation then
    null;
  end;
end;
$$;

rollback;

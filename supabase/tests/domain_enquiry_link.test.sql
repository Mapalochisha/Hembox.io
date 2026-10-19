-- Integration checks for 20261018100000_domain_enquiry_link.sql.
\set ON_ERROR_STOP on

begin;

do $test$
declare
  inserted_order_id uuid;
  audit_count integer;
begin
  insert into public.domain_orders (
    customer_contact, customer_name, domain_name, status, idempotency_key
  ) values (
    '+260971234567', 'Schema Test', 'enquiry.example', 'enquiry',
    'a1111111-1111-4111-8111-111111111111'
  )
  returning id into inserted_order_id;

  select count(*) into audit_count
  from public.domain_audit_events
  where domain_audit_events.order_id = inserted_order_id
    and event_type = 'domain_order.created';

  if audit_count <> 1 then
    raise exception 'A new domain order must create exactly one audit event';
  end if;

  begin
    insert into public.domain_orders (
      customer_contact, domain_name, status, idempotency_key
    ) values (
      'contact@example.com', 'duplicate.example', 'enquiry',
      'a1111111-1111-4111-8111-111111111111'
    );
    raise exception 'Duplicate domain enquiry idempotency key was unexpectedly accepted';
  exception when unique_violation then
    null;
  end;

  begin
    insert into public.domain_orders (customer_contact, domain_name, status)
    values ('x', 'short-contact.example', 'enquiry');
    raise exception 'Invalid customer contact length was unexpectedly accepted';
  exception when check_violation then
    null;
  end;
end;
$test$;


do $test$
declare
  has_rls boolean;
  blocked boolean;
  order_key uuid;
  quote_key uuid;
begin
  select c.relrowsecurity into has_rls from pg_class c where c.oid = 'public.domain_order_quotes'::regclass;
  if not has_rls then raise exception 'RLS missing on domain_order_quotes'; end if;
  select c.relrowsecurity into has_rls from pg_class c where c.oid = 'public.domain_payment_attempts'::regclass;
  if not has_rls then raise exception 'RLS missing on domain_payment_attempts'; end if;

  if has_table_privilege('anon', 'public.domain_order_quotes', 'SELECT')
     or has_table_privilege('authenticated', 'public.domain_order_quotes', 'INSERT')
     or has_table_privilege('anon', 'public.domain_payment_attempts', 'SELECT')
     or has_table_privilege('authenticated', 'public.domain_payment_attempts', 'INSERT') then
    raise exception 'Public roles have excessive quote/payment privileges';
  end if;

  insert into public.domain_orders (customer_email, domain_name)
  values ('quote-test@example.com', 'quote-test.example')
  returning id into order_key;

  insert into public.domain_order_quotes (
    order_id, sequence, idempotency_key, domain_name, currency,
    registration_price_minor, renewal_price_minor, term_years, total_due_minor,
    pricing_source, pricing_captured_at, created_at, expires_at
  ) values (
    order_key, 1, 'quote-idem-key-0001', 'quote-test.example', 'ZMW',
    15000, 18000, 1, 15000, 'test-fixture', now(), now(), now() + interval '15 minutes'
  ) returning id into quote_key;

  blocked := false;
  begin
    update public.domain_order_quotes set registration_price_minor = 1 where id = quote_key;
  exception when raise_exception then
    blocked := true;
  end;
  if not blocked then raise exception 'Quote snapshot UPDATE was not blocked'; end if;

  blocked := false;
  begin
    delete from public.domain_order_quotes where id = quote_key;
  exception when raise_exception then
    blocked := true;
  end;
  if not blocked then raise exception 'Quote snapshot DELETE was not blocked'; end if;

  insert into public.domain_payment_attempts (
    order_id, provider_id, idempotency_key, provider_payment_id, amount_minor,
    currency, status, last_webhook_event_id
  ) values (
    order_key, 'test-gateway', 'payment-idem-key-0001', 'payment-ref-1',
    15000, 'ZMW', 'pending', 'event-ref-1'
  );

  begin
    insert into public.domain_payment_attempts (
      order_id, provider_id, idempotency_key, provider_payment_id, amount_minor,
      currency, status, last_webhook_event_id
    ) values (
      order_key, 'test-gateway', 'payment-idem-key-0002', 'payment-ref-2',
      15000, 'ZMW', 'pending', 'event-ref-1'
    );
    raise exception 'Duplicate provider webhook event was accepted';
  exception when unique_violation then
    null;
  end;
end;
$test$;
rollback;

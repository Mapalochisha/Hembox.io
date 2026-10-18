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

rollback;

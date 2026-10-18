-- Durable domain enquiry contact data and transactional order-created audit.
-- Feature branch only: do not apply to production without explicit authorization.

alter table public.domain_orders
  alter column customer_email drop not null,
  add column customer_contact text;

alter table public.domain_orders
  add constraint domain_orders_customer_contact_length
    check (customer_contact is null or length(trim(customer_contact)) between 3 and 254);

create or replace function public.record_domain_order_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.domain_audit_events (order_id, actor_user_id, event_type, details)
  values (
    new.id,
    new.customer_id,
    'domain_order.created',
    jsonb_build_object('status', new.status, 'domain_name', new.domain_name)
  );
  return new;
end;
$$;

revoke all on function public.record_domain_order_created() from public, anon, authenticated;

drop trigger if exists domain_order_created_audit on public.domain_orders;
create trigger domain_order_created_audit
  after insert on public.domain_orders
  for each row execute function public.record_domain_order_created();

comment on column public.domain_orders.customer_contact is
  'Customer-supplied email or phone contact for enquiries; keep separate from customer_email.';

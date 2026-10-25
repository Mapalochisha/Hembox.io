-- Database-enforced domain order lifecycle rules and transactional status audit.
-- Feature branch only. Do not apply to production without explicit authorization.

create or replace function public.guard_domain_order_status_transition()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status = old.status then return new; end if;
  if not (
    (old.status = 'enquiry' and new.status = any(array['quoted', 'cancelled', 'manual_review']))
    or (old.status = 'quoted' and new.status = any(array['awaiting_payment', 'cancelled', 'manual_review']))
    or (old.status = 'awaiting_payment' and new.status = any(array['payment_confirmed', 'cancelled', 'manual_review']))
    or (old.status = 'payment_confirmed' and new.status = any(array['registration_pending', 'refunded', 'manual_review']))
    or (old.status = 'registration_pending' and new.status = any(array['registered', 'registration_failed', 'manual_review']))
    or (old.status = 'registered' and new.status = 'manual_review')
    or (old.status = 'registration_failed' and new.status = any(array['registration_pending', 'refunded', 'cancelled', 'manual_review']))
    or (old.status = 'manual_review' and new.status = any(array['quoted', 'awaiting_payment', 'payment_confirmed', 'registration_pending', 'registered', 'registration_failed', 'cancelled', 'refunded']))
  ) then
    raise exception 'Invalid domain order status transition: % -> %', old.status, new.status using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_domain_order_status_transition() from public, anon, authenticated;
drop trigger if exists guard_domain_order_status_transition on public.domain_orders;
create trigger guard_domain_order_status_transition before update of status on public.domain_orders
for each row execute function public.guard_domain_order_status_transition();

create or replace function public.audit_domain_order_status_transition()
returns trigger language plpgsql set search_path = ''
as $$
begin
  insert into public.domain_audit_events (order_id, actor_user_id, event_type, details)
  values (new.id, null, 'domain_order.status_changed',
    jsonb_build_object('from_status', old.status, 'to_status', new.status));
  return new;
end;
$$;
revoke all on function public.audit_domain_order_status_transition() from public, anon, authenticated;
drop trigger if exists audit_domain_order_status_transition on public.domain_orders;
create trigger audit_domain_order_status_transition after update of status on public.domain_orders
for each row when (old.status is distinct from new.status)
execute function public.audit_domain_order_status_transition();

comment on function public.guard_domain_order_status_transition() is
  'Rejects order-state changes not present in the domain order lifecycle graph.';
comment on function public.audit_domain_order_status_transition() is
  'Records successful order-state transitions in the same transaction as the update.';

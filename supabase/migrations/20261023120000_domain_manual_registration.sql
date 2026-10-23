-- Audited human-in-the-loop fulfillment for the initial release.
-- An administrator records a registration completed in the registrar's own console.
-- This function does not call the registrar API and must never be used to invent a registration.
create or replace function public.record_domain_manual_registration(
  p_order_id uuid,
  p_admin_user_id uuid,
  p_provider_id text,
  p_provider_order_reference text,
  p_provider_domain_reference text,
  p_registered_at timestamptz,
  p_expires_at timestamptz,
  p_availability_rechecked boolean,
  p_price_rechecked boolean,
  p_admin_note text default null
)
returns table (order_id uuid, order_status text, already_recorded boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.domain_orders%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = p_admin_user_id and p.role = 'admin'
  ) then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  if p_provider_id is null or length(trim(p_provider_id)) not between 1 and 80 then
    raise exception 'Provider identifier is required' using errcode = '22023';
  end if;
  if p_provider_order_reference is not null and length(trim(p_provider_order_reference)) > 200 then
    raise exception 'Provider order reference is too long' using errcode = '22023';
  end if;
  if p_provider_domain_reference is null or length(trim(p_provider_domain_reference)) not between 3 and 253 then
    raise exception 'Provider domain reference is required' using errcode = '22023';
  end if;
  if p_registered_at is null or p_registered_at > v_now or p_expires_at is null or p_expires_at <= p_registered_at then
    raise exception 'Registration and expiry timestamps are invalid' using errcode = '22023';
  end if;
  if p_availability_rechecked is not true or p_price_rechecked is not true then
    raise exception 'Availability and final price must be rechecked before registration' using errcode = '23514';
  end if;
  if p_admin_note is not null and length(p_admin_note) > 500 then
    raise exception 'Admin note is too long' using errcode = '22023';
  end if;

  select * into v_order from public.domain_orders where id = p_order_id for update;
  if not found then raise exception 'Domain order not found' using errcode = 'P0002'; end if;

  if v_order.status = 'registered'
     and v_order.provider_id = p_provider_id
     and v_order.provider_order_reference is not distinct from nullif(trim(p_provider_order_reference), '')
     and v_order.provider_domain_reference = lower(trim(p_provider_domain_reference))
     and v_order.registered_at = p_registered_at
     and v_order.expires_at = p_expires_at then
    return query select v_order.id, v_order.status, true;
    return;
  end if;

  if v_order.status <> 'payment_confirmed' then
    raise exception 'Only payment-confirmed orders can be manually fulfilled' using errcode = '23514';
  end if;
  if v_order.provider_id is distinct from p_provider_id then
    raise exception 'Fulfillment provider must match the saved quote provider' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.domain_manual_payment_claims c
    where c.order_id = v_order.id and c.status = 'verified'
  ) then
    raise exception 'A verified manual payment claim is required for this release workflow' using errcode = '23514';
  end if;
  if lower(trim(p_provider_domain_reference)) <> v_order.domain_name then
    raise exception 'Provider domain reference must match the ordered domain' using errcode = '23514';
  end if;

  update public.domain_orders
    set status = 'registration_pending',
        provider_order_reference = nullif(trim(p_provider_order_reference), ''),
        provider_domain_reference = lower(trim(p_provider_domain_reference))
    where id = v_order.id;

  update public.domain_orders
    set status = 'registered',
        registered_at = p_registered_at,
        expires_at = p_expires_at
    where id = v_order.id;

  insert into public.domain_audit_events (order_id, actor_user_id, event_type, details)
  values (v_order.id, p_admin_user_id, 'domain_registration.manually_recorded',
    jsonb_build_object(
      'provider_id', p_provider_id,
      'provider_order_reference', nullif(trim(p_provider_order_reference), ''),
      'provider_domain_reference', lower(trim(p_provider_domain_reference)),
      'registered_at', p_registered_at,
      'expires_at', p_expires_at,
      'availability_rechecked', p_availability_rechecked,
      'price_rechecked', p_price_rechecked,
      'admin_note', nullif(trim(p_admin_note), '')
    ));

  return query select v_order.id, 'registered'::text, false;
end;
$$;
revoke all on function public.record_domain_manual_registration(uuid, uuid, text, text, text, timestamptz, timestamptz, boolean, boolean, text) from public, anon, authenticated;
grant execute on function public.record_domain_manual_registration(uuid, uuid, text, text, text, timestamptz, timestamptz, boolean, boolean, text) to service_role;

comment on function public.record_domain_manual_registration(uuid, uuid, text, text, text, timestamptz, timestamptz, boolean, boolean, text) is
  'Audited human-in-the-loop fulfillment record. It never contacts a registrar; an admin must register externally, recheck availability/pricing, then record the real provider references and dates.';

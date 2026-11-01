-- Reconcile guarded manual fulfilment with the unified billing ledger.
-- Source-controlled migration matching the production migration version 20261101141742.
--
-- Problem this migration fixes:
--   * Every live domain quote now creates a unified billing invoice and the
--     initial payment is verified through that ledger (Bills), not through the
--     legacy domain_manual_payment_claims table.
--   * A paid domain invoice advances the order to payment_confirmed, but the
--     previous record_domain_manual_registration() only accepted a verified
--     legacy domain claim as payment evidence. Fulfilment was therefore
--     impossible for every order paid through the real (unified) flow.
--
-- This migration accepts settled payment evidence from either source while
-- keeping every existing guard:
--   1. domain_manual_claim      - a legacy verified domain_manual_payment_claims row, or
--   2. unified_billing_invoice  - the order's linked billing invoice is paid,
--                                 belongs to this order and customer, matches the
--                                 order currency, and its allocations fully settle it.
--
-- It still never contacts a registrar, still requires an explicit
-- availability/price recheck, still requires payment_confirmed state, and still
-- records the actor, references, dates and evidence source in the audit trail.

drop function if exists public.record_domain_manual_registration(uuid, uuid, text, text, text, timestamptz, timestamptz, boolean, boolean, text);

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
returns table (order_id uuid, order_status text, already_recorded boolean, payment_evidence text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.domain_orders%rowtype;
  v_now timestamptz := clock_timestamp();
  v_claim_id uuid;
  v_invoice public.billing_invoices%rowtype;
  v_allocated bigint;
  v_evidence text;
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
  if p_registered_at is null or p_registered_at > v_now or p_expires_at is null or p_expires_at <= p_registered_at or p_expires_at <= v_now then
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
    return query select v_order.id, v_order.status, true, 'previously_recorded'::text;
    return;
  end if;

  if v_order.status <> 'payment_confirmed' then
    raise exception 'Only payment-confirmed orders can be manually fulfilled' using errcode = '23514';
  end if;
  if v_order.provider_id is distinct from p_provider_id then
    raise exception 'Fulfillment provider must match the saved quote provider' using errcode = '23514';
  end if;
  if lower(trim(p_provider_domain_reference)) <> v_order.domain_name then
    raise exception 'Provider domain reference must match the ordered domain' using errcode = '23514';
  end if;

  -- Payment evidence is required in every case; the guard below is defence in
  -- depth so a future refactor cannot fulfil an order on a payment claim alone.
  select c.id into v_claim_id
  from public.domain_manual_payment_claims c
  where c.order_id = v_order.id and c.status = 'verified'
  order by c.created_at desc
  limit 1;

  if v_claim_id is not null then
    v_evidence := 'domain_manual_claim';
  elsif v_order.billing_invoice_id is not null then
    select * into v_invoice from public.billing_invoices i where i.id = v_order.billing_invoice_id;
    if not found then
      raise exception 'Linked billing invoice is missing' using errcode = '23514';
    end if;
    if v_invoice.source_type is distinct from 'domain_registration' or v_invoice.source_id is distinct from v_order.id then
      raise exception 'Linked billing invoice does not belong to this domain order' using errcode = '23514';
    end if;
    if v_order.customer_id is null or v_invoice.customer_id is distinct from v_order.customer_id then
      raise exception 'Linked billing invoice customer does not match the domain order' using errcode = '23514';
    end if;
    if v_invoice.currency <> v_order.retail_currency then
      raise exception 'Linked billing invoice currency does not match the domain order' using errcode = '23514';
    end if;
    select coalesce(sum(case when a.allocation_type = 'allocate' then a.amount_minor else -a.amount_minor end), 0)::bigint
      into v_allocated
    from public.billing_payment_allocations a
    where a.invoice_id = v_invoice.id;
    if v_invoice.status <> 'paid' or v_invoice.paid_at is null
       or v_invoice.total_minor <= 0 or v_allocated < v_invoice.total_minor then
      raise exception 'The linked billing invoice is not fully settled; registration cannot be recorded' using errcode = '23514';
    end if;
    v_evidence := 'unified_billing_invoice';
  end if;

  if v_evidence is null then
    raise exception 'Settled payment evidence is required before manual registration' using errcode = '23514';
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
      'admin_note', nullif(trim(p_admin_note), ''),
      'payment_evidence', v_evidence,
      'payment_evidence_details', case
        when v_evidence = 'domain_manual_claim' then jsonb_build_object('claim_id', v_claim_id)
        else jsonb_build_object(
          'billing_invoice_id', v_invoice.id,
          'invoice_number', v_invoice.invoice_number,
          'invoice_status', v_invoice.status,
          'invoice_total_minor', v_invoice.total_minor,
          'invoice_allocated_minor', v_allocated,
          'invoice_currency', v_invoice.currency,
          'invoice_paid_at', v_invoice.paid_at
        )
      end
    ));

  return query select v_order.id, 'registered'::text, false, v_evidence;
end;
$$;
revoke all on function public.record_domain_manual_registration(uuid, uuid, text, text, text, timestamptz, timestamptz, boolean, boolean, text) from public, anon, authenticated;
grant execute on function public.record_domain_manual_registration(uuid, uuid, text, text, text, timestamptz, timestamptz, boolean, boolean, text) to service_role;

comment on function public.record_domain_manual_registration(uuid, uuid, text, text, text, timestamptz, timestamptz, boolean, boolean, text) is
  'Audited human-in-the-loop fulfillment record. It never contacts a registrar; an admin must register externally, recheck availability/pricing, then record the real provider references and dates. Settled-payment evidence must be a verified legacy domain claim or the order''s fully paid unified billing invoice.';

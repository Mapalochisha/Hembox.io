-- Domain registrant details and checkout review data.
-- Feature branch only. Do not apply to production without explicit authorization.
--
-- Why this exists:
--   A registrar registration legally requires registrant contact details
--   (name, organisation, address, phone, email, country). Before this migration
--   the customer flow captured none of them, so an administrator could not
--   complete a real registration at all, and there was no recorded consent to
--   pass the customer's details to the registrar.
--
-- Scope of this migration:
--   * one immutable-per-order snapshot of the registrant details and the
--     consent/terms version the customer accepted,
--   * owner-scoped reads only; writes go through a server-side function,
--   * minimal audit events that never copy the full address into the audit log,
--   * a hard guard so a registration cannot be recorded without registrant
--     details, independent of any UI.

create table if not exists public.domain_order_registrant_details (
  order_id uuid primary key references public.domain_orders(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete restrict,
  registrant_type text not null check (registrant_type in ('individual', 'organisation')),
  first_name text not null check (length(trim(first_name)) between 1 and 60),
  last_name text not null check (length(trim(last_name)) between 1 and 60),
  organisation_name text check (organisation_name is null or length(trim(organisation_name)) between 1 and 120),
  email text not null check (length(email) between 3 and 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  phone text not null check (phone ~ '^[+][0-9]{7,15}$'),
  address_line1 text not null check (length(trim(address_line1)) between 3 and 120),
  address_line2 text check (address_line2 is null or length(trim(address_line2)) between 1 and 120),
  city text not null check (length(trim(city)) between 2 and 80),
  region text not null check (length(trim(region)) between 2 and 80),
  postal_code text check (postal_code is null or length(trim(postal_code)) between 2 and 20),
  country_code text not null default 'ZM' check (country_code ~ '^[A-Z]{2}$'),
  consent_version text not null check (length(trim(consent_version)) between 3 and 60),
  consent_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_by uuid references auth.users(id) on delete set null,
  check (registrant_type <> 'organisation' or organisation_name is not null)
);

alter table public.domain_order_registrant_details enable row level security;
revoke all on public.domain_order_registrant_details from anon, authenticated;
grant select on public.domain_order_registrant_details to authenticated;
grant all on public.domain_order_registrant_details to service_role;

drop policy if exists "Customers can read their own domain registrant details" on public.domain_order_registrant_details;
create policy "Customers can read their own domain registrant details"
  on public.domain_order_registrant_details for select to authenticated
  using (customer_id = (select auth.uid()));

drop policy if exists "Admins can read domain registrant details" on public.domain_order_registrant_details;
create policy "Admins can read domain registrant details"
  on public.domain_order_registrant_details for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

drop trigger if exists set_domain_order_registrant_details_updated_at on public.domain_order_registrant_details;
create trigger set_domain_order_registrant_details_updated_at
  before update on public.domain_order_registrant_details
  for each row execute function public.set_domain_updated_at();

-- Save or replace the registrant details for an order the customer owns.
-- Editing stays possible until the order is registered; after that the recorded
-- registrant is the legal record and must not be rewritten.
create or replace function public.save_domain_order_registrant_details(
  p_order_id uuid,
  p_customer_id uuid,
  p_registrant_type text,
  p_first_name text,
  p_last_name text,
  p_organisation_name text,
  p_email text,
  p_phone text,
  p_address_line1 text,
  p_address_line2 text,
  p_city text,
  p_region text,
  p_postal_code text,
  p_country_code text,
  p_consent_version text
)
returns table (saved_order_id uuid, saved_at timestamptz, created boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.domain_orders%rowtype;
  v_existing public.domain_order_registrant_details%rowtype;
  v_saved_at timestamptz := clock_timestamp();
  v_created boolean := false;
begin
  if p_customer_id is null then
    raise exception 'Customer is required' using errcode = '42501';
  end if;

  select * into v_order from public.domain_orders where id = p_order_id for update;
  if not found then raise exception 'Domain order not found' using errcode = 'P0002'; end if;
  if v_order.customer_id is distinct from p_customer_id then
    raise exception 'Domain order does not belong to this customer' using errcode = '42501';
  end if;
  if v_order.status not in ('enquiry', 'quoted', 'awaiting_payment', 'payment_confirmed', 'manual_review') then
    raise exception 'Registrant details cannot change after registration starts' using errcode = '23514';
  end if;
  if p_registrant_type is null or p_registrant_type not in ('individual', 'organisation') then
    raise exception 'Registrant type must be individual or organisation' using errcode = '22023';
  end if;
  if p_consent_version is null or length(trim(p_consent_version)) not between 3 and 60 then
    raise exception 'A consent version is required' using errcode = '22023';
  end if;

  select d.* into v_existing from public.domain_order_registrant_details d where d.order_id = p_order_id;
  v_created := not found;

  insert into public.domain_order_registrant_details (
    order_id, customer_id, registrant_type, first_name, last_name, organisation_name,
    email, phone, address_line1, address_line2, city, region, postal_code, country_code,
    consent_version, consent_accepted_at, created_at, updated_at, submitted_by
  ) values (
    p_order_id, p_customer_id, p_registrant_type, trim(p_first_name), trim(p_last_name),
    nullif(trim(coalesce(p_organisation_name, '')), ''),
    lower(trim(p_email)), trim(p_phone), trim(p_address_line1),
    nullif(trim(coalesce(p_address_line2, '')), ''), trim(p_city), trim(p_region),
    nullif(trim(coalesce(p_postal_code, '')), ''), upper(trim(p_country_code)),
    trim(p_consent_version), v_saved_at, v_saved_at, v_saved_at, p_customer_id
  )
  on conflict (order_id) do update set
    registrant_type = excluded.registrant_type,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    organisation_name = excluded.organisation_name,
    email = excluded.email,
    phone = excluded.phone,
    address_line1 = excluded.address_line1,
    address_line2 = excluded.address_line2,
    city = excluded.city,
    region = excluded.region,
    postal_code = excluded.postal_code,
    country_code = excluded.country_code,
    consent_version = excluded.consent_version,
    consent_accepted_at = excluded.consent_accepted_at,
    updated_at = excluded.updated_at,
    submitted_by = excluded.submitted_by;

  -- Personal data minimisation: the audit trail records that details were
  -- captured, by whom, under which consent version, and for which country,
  -- without copying the address or contact values into the log.
  insert into public.domain_audit_events (order_id, actor_user_id, event_type, details)
  values (p_order_id, p_customer_id,
    case when v_created then 'domain_order.registrant_details_added' else 'domain_order.registrant_details_updated' end,
    jsonb_build_object(
      'registrant_type', p_registrant_type,
      'country_code', upper(trim(p_country_code)),
      'consent_version', trim(p_consent_version)
    ));

  return query select p_order_id, v_saved_at, v_created;
end;
$$;
revoke all on function public.save_domain_order_registrant_details(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_domain_order_registrant_details(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text) to service_role;

-- Registration cannot be recorded without the registrant details the registrar
-- requires. This is the same function contract as the previous definition; only
-- the guard and audit detail change.
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
  v_registrant_id uuid;
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

  select d.order_id into v_registrant_id
  from public.domain_order_registrant_details d
  where d.order_id = v_order.id
    and d.customer_id is not distinct from v_order.customer_id;
  if v_registrant_id is null then
    raise exception 'Registrant details are required before a registration can be recorded' using errcode = '23514';
  end if;

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
      'registrant_details_present', true,
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

comment on table public.domain_order_registrant_details is
  'Registrant contact details supplied by the customer for one domain order. Read-only for the owning customer; writes happen only through save_domain_order_registrant_details(). Treat as personal data.';
comment on function public.save_domain_order_registrant_details(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text) is
  'Upserts the registrant details for a customer-owned domain order before registration, with an audit event that excludes the address and contact values.';

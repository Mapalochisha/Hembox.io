-- Production migration 20261101142524: customer-owned registrant details save function.
-- The corresponding migration is already present in the production history.

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

comment on function public.save_domain_order_registrant_details(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text) is
  'Upserts the registrant details for a customer-owned domain order before registration, with an audit event that excludes the address and contact values.';

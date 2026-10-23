-- Atomic quote-to-order creation with provider evidence, cost-basis traceability,
-- customer-scoped idempotency, and customer read access to their own quote snapshots.
-- Feature branch only. Do not apply to production without explicit authorization.

alter table public.domain_order_quotes
  add column if not exists provider_id text,
  add column if not exists availability_checked_at timestamptz,
  add column if not exists wholesale_currency text,
  add column if not exists registration_wholesale_minor bigint,
  add column if not exists renewal_wholesale_minor bigint,
  add column if not exists fx_rate_micros bigint,
  add column if not exists margin_basis_points integer;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'domain_order_quotes_provider_evidence_pair'
      and conrelid = 'public.domain_order_quotes'::regclass
  ) then
    alter table public.domain_order_quotes
      add constraint domain_order_quotes_provider_evidence_pair
      check (
        (provider_id is null and availability_checked_at is null)
        or (
          provider_id is not null
          and length(trim(provider_id)) between 1 and 80
          and availability_checked_at is not null
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'domain_order_quotes_pricing_basis_complete'
      and conrelid = 'public.domain_order_quotes'::regclass
  ) then
    alter table public.domain_order_quotes
      add constraint domain_order_quotes_pricing_basis_complete
      check (
        (
          wholesale_currency is null
          and registration_wholesale_minor is null
          and renewal_wholesale_minor is null
          and fx_rate_micros is null
          and margin_basis_points is null
        )
        or (
          wholesale_currency ~ '^[A-Z]{3}$'
          and registration_wholesale_minor is not null
          and registration_wholesale_minor >= 0
          and renewal_wholesale_minor is not null
          and renewal_wholesale_minor >= 0
          and fx_rate_micros is not null
          and fx_rate_micros > 0
          and margin_basis_points is not null
          and margin_basis_points between 0 and 100000
        )
      );
  end if;
end;
$constraints$;

drop policy if exists "Customers can read their own domain quotes" on public.domain_order_quotes;
create policy "Customers can read their own domain quotes"
  on public.domain_order_quotes for select to authenticated
  using (
    exists (
      select 1
      from public.domain_orders o
      where o.id = domain_order_quotes.order_id
        and o.customer_id = (select auth.uid())
    )
  );

create or replace function public.create_domain_quote_order(
  p_customer_id uuid,
  p_customer_email text,
  p_customer_contact text,
  p_domain_name text,
  p_provider_id text,
  p_availability_checked_at timestamptz,
  p_idempotency_key text,
  p_registration_price_minor bigint,
  p_renewal_price_minor bigint,
  p_term_years integer,
  p_total_due_minor bigint,
  p_wholesale_currency text,
  p_registration_wholesale_minor bigint,
  p_renewal_wholesale_minor bigint,
  p_fx_rate_micros bigint,
  p_margin_basis_points integer,
  p_pricing_source text,
  p_pricing_captured_at timestamptz,
  p_created_at timestamptz,
  p_expires_at timestamptz
)
returns table (order_id uuid, quote_id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order_id uuid;
  v_quote_id uuid;
  v_existing_customer_id uuid;
  v_existing_domain_name text;
begin
  if p_customer_id is null then
    raise exception 'Authenticated customer is required' using errcode = '22023';
  end if;
  if p_domain_name is null
     or p_domain_name <> lower(trim(p_domain_name))
     or length(p_domain_name) not between 3 and 253
     or p_domain_name !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$' then
    raise exception 'Invalid domain name' using errcode = '22023';
  end if;
  if p_provider_id is null or length(trim(p_provider_id)) not between 1 and 80 then
    raise exception 'Invalid provider identifier' using errcode = '22023';
  end if;
  if p_idempotency_key is null
     or length(trim(p_idempotency_key)) not between 8 and 200 then
    raise exception 'Invalid idempotency key' using errcode = '22023';
  end if;
  if p_registration_price_minor is null or p_registration_price_minor <= 0
     or p_renewal_price_minor is null or p_renewal_price_minor <= 0
     or p_term_years not between 1 and 10
     or p_total_due_minor is null
     or p_total_due_minor::numeric <> p_registration_price_minor::numeric * p_term_years::numeric then
    raise exception 'Invalid quote amount' using errcode = '22023';
  end if;
  if p_wholesale_currency is null or p_wholesale_currency !~ '^[A-Z]{3}$'
     or p_registration_wholesale_minor is null or p_registration_wholesale_minor < 0
     or p_renewal_wholesale_minor is null or p_renewal_wholesale_minor < 0
     or p_fx_rate_micros is null or p_fx_rate_micros <= 0
     or p_margin_basis_points is null or p_margin_basis_points not between 0 and 100000 then
    raise exception 'Incomplete price calculation evidence' using errcode = '22023';
  end if;
  if p_pricing_source is null or length(trim(p_pricing_source)) not between 1 and 160
     or p_pricing_captured_at is null or p_created_at is null or p_expires_at is null
     or p_pricing_captured_at > p_created_at
     or p_created_at - p_pricing_captured_at > interval '24 hours'
     or p_expires_at <= p_created_at
     or p_expires_at > p_created_at + interval '60 minutes'
     or p_created_at > clock_timestamp() + interval '30 seconds' then
    raise exception 'Invalid or stale pricing snapshot' using errcode = '22023';
  end if;
  if p_availability_checked_at is null
     or p_availability_checked_at > clock_timestamp() + interval '5 seconds'
     or p_availability_checked_at < clock_timestamp() - interval '2 minutes' then
    raise exception 'Availability evidence is missing or stale' using errcode = '22023';
  end if;
  if p_customer_email is not null and length(trim(p_customer_email)) not between 3 and 254 then
    raise exception 'Invalid customer email' using errcode = '22023';
  end if;
  if p_customer_contact is not null and length(trim(p_customer_contact)) not between 3 and 254 then
    raise exception 'Invalid customer contact' using errcode = '22023';
  end if;

  -- Concurrent requests with the same key serialize; other requests proceed normally.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key, 0));

  select o.id, o.customer_id, o.domain_name
    into v_order_id, v_existing_customer_id, v_existing_domain_name
  from public.domain_orders o
  where o.idempotency_key = p_idempotency_key;

  if found then
    if v_existing_customer_id is distinct from p_customer_id
       or v_existing_domain_name is distinct from p_domain_name then
      raise exception 'Idempotency key was reused for a different customer or domain' using errcode = '22023';
    end if;

    select q.id into v_quote_id
    from public.domain_order_quotes q
    where q.order_id = v_order_id
      and q.idempotency_key = p_idempotency_key
    order by q.sequence desc
    limit 1;

    if v_quote_id is null then
      raise exception 'Existing quote order has no matching quote snapshot' using errcode = 'P0001';
    end if;

    return query select v_order_id, v_quote_id, false;
    return;
  end if;

  insert into public.domain_orders (
    customer_id,
    customer_email,
    customer_contact,
    domain_name,
    status,
    retail_currency,
    registration_retail_minor,
    renewal_retail_minor,
    quote_expires_at,
    provider_id,
    idempotency_key
  ) values (
    p_customer_id,
    p_customer_email,
    p_customer_contact,
    p_domain_name,
    'quoted',
    'ZMW',
    p_registration_price_minor,
    p_renewal_price_minor,
    p_expires_at,
    p_provider_id,
    p_idempotency_key
  )
  returning id into v_order_id;

  insert into public.domain_order_quotes (
    order_id,
    sequence,
    idempotency_key,
    domain_name,
    currency,
    registration_price_minor,
    renewal_price_minor,
    term_years,
    total_due_minor,
    pricing_source,
    pricing_captured_at,
    created_at,
    expires_at,
    provider_id,
    availability_checked_at,
    wholesale_currency,
    registration_wholesale_minor,
    renewal_wholesale_minor,
    fx_rate_micros,
    margin_basis_points
  ) values (
    v_order_id,
    1,
    p_idempotency_key,
    p_domain_name,
    'ZMW',
    p_registration_price_minor,
    p_renewal_price_minor,
    p_term_years,
    p_total_due_minor,
    trim(p_pricing_source),
    p_pricing_captured_at,
    p_created_at,
    p_expires_at,
    p_provider_id,
    p_availability_checked_at,
    p_wholesale_currency,
    p_registration_wholesale_minor,
    p_renewal_wholesale_minor,
    p_fx_rate_micros,
    p_margin_basis_points
  )
  returning id into v_quote_id;

  return query select v_order_id, v_quote_id, true;
end;
$function$;

revoke all on function public.create_domain_quote_order(
  uuid, text, text, text, text, timestamptz, text, bigint, bigint, integer,
  bigint, text, bigint, bigint, bigint, integer, text, timestamptz, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.create_domain_quote_order(
  uuid, text, text, text, text, timestamptz, text, bigint, bigint, integer,
  bigint, text, bigint, bigint, bigint, integer, text, timestamptz, timestamptz, timestamptz
) to service_role;

comment on function public.create_domain_quote_order(
  uuid, text, text, text, text, timestamptz, text, bigint, bigint, integer,
  bigint, text, bigint, bigint, bigint, integer, text, timestamptz, timestamptz, timestamptz
) is 'Atomically creates a quoted domain order and immutable quote snapshot after server-side live availability and current pricing have been verified; does not accept payment or register domains.';

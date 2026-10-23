\set ON_ERROR_STOP on
begin;

do $test$
declare
  v_customer_id uuid := '11111111-1111-4111-8111-111111111111';
  v_order_id uuid;
  v_quote_id uuid;
  v_second_order_id uuid;
  v_second_quote_id uuid;
  v_created boolean;
  v_second_created boolean;
  v_rejected boolean := false;
  v_count integer;
  v_function_oid oid;
  v_status text;
  v_saved_price bigint;
begin
  insert into auth.users (id) values (v_customer_id) on conflict (id) do nothing;

  select q.order_id, q.quote_id, q.created
    into v_order_id, v_quote_id, v_created
  from public.create_domain_quote_order(
    p_customer_id => v_customer_id,
    p_customer_email => 'quote-customer@example.test',
    p_customer_contact => 'quote-customer@example.test',
    p_domain_name => 'quote-customer.com',
    p_provider_id => 'namesilo',
    p_availability_checked_at => clock_timestamp(),
    p_idempotency_key => 'domain-quote:11111111-1111-4111-8111-111111111111:idem-key-0001',
    p_registration_price_minor => 30000,
    p_renewal_price_minor => 36000,
    p_term_years => 1,
    p_total_due_minor => 30000,
    p_wholesale_currency => 'USD',
    p_registration_wholesale_minor => 1000,
    p_renewal_wholesale_minor => 1200,
    p_fx_rate_micros => 25000000,
    p_margin_basis_points => 2000,
    p_pricing_source => 'provider-price-sheet-and-fx-snapshot',
    p_pricing_captured_at => clock_timestamp() - interval '1 hour',
    p_created_at => clock_timestamp(),
    p_expires_at => clock_timestamp() + interval '15 minutes'
  ) q;

  if v_order_id is null or v_quote_id is null or v_created is not true then
    raise exception 'First quote request must create exactly one order and quote';
  end if;

  select status into v_status from public.domain_orders where id = v_order_id;
  if v_status <> 'quoted' then
    raise exception 'A new quote order must start in quoted state';
  end if;

  select registration_price_minor into v_saved_price
  from public.domain_order_quotes where id = v_quote_id;
  if v_saved_price <> 30000 then
    raise exception 'The initial registration price snapshot is incorrect';
  end if;

  select count(*) into v_count from public.domain_order_quotes
  where id = v_quote_id and provider_id = 'namesilo'
    and availability_checked_at is not null
    and wholesale_currency = 'USD'
    and registration_wholesale_minor = 1000
    and renewal_wholesale_minor = 1200
    and fx_rate_micros = 25000000
    and margin_basis_points = 2000;
  if v_count <> 1 then
    raise exception 'Quote must preserve provider availability evidence and cost/FX/margin basis';
  end if;

  select count(*) into v_count from public.domain_audit_events
  where order_id = v_order_id and event_type = 'domain_order.created';
  if v_count <> 1 then
    raise exception 'Creating a quote order must create exactly one order audit event';
  end if;

  -- An idempotent retry returns the first snapshot, even if submitted prices changed.
  select q.order_id, q.quote_id, q.created
    into v_second_order_id, v_second_quote_id, v_second_created
  from public.create_domain_quote_order(
    p_customer_id => v_customer_id,
    p_customer_email => 'quote-customer@example.test',
    p_customer_contact => 'quote-customer@example.test',
    p_domain_name => 'quote-customer.com',
    p_provider_id => 'namesilo',
    p_availability_checked_at => clock_timestamp(),
    p_idempotency_key => 'domain-quote:11111111-1111-4111-8111-111111111111:idem-key-0001',
    p_registration_price_minor => 31000,
    p_renewal_price_minor => 37000,
    p_term_years => 1,
    p_total_due_minor => 31000,
    p_wholesale_currency => 'USD',
    p_registration_wholesale_minor => 1050,
    p_renewal_wholesale_minor => 1250,
    p_fx_rate_micros => 25000000,
    p_margin_basis_points => 2000,
    p_pricing_source => 'a-new-price-sheet',
    p_pricing_captured_at => clock_timestamp() - interval '1 minute',
    p_created_at => clock_timestamp(),
    p_expires_at => clock_timestamp() + interval '15 minutes'
  ) q;

  if v_second_order_id <> v_order_id or v_second_quote_id <> v_quote_id or v_second_created is not false then
    raise exception 'Idempotent retry must return the original order/quote IDs without creating new records';
  end if;

  select registration_price_minor into v_saved_price
  from public.domain_order_quotes where id = v_second_quote_id;
  if v_saved_price <> 30000 then
    raise exception 'Idempotent retry must not mutate the original quote amount';
  end if;

  select count(*) into v_count from public.domain_orders where idempotency_key = 'domain-quote:11111111-1111-4111-8111-111111111111:idem-key-0001';
  if v_count <> 1 then
    raise exception 'Repeated requests must not create duplicate domain orders';
  end if;
  select count(*) into v_count from public.domain_order_quotes where idempotency_key = 'domain-quote:11111111-1111-4111-8111-111111111111:idem-key-0001';
  if v_count <> 1 then
    raise exception 'Repeated requests must not create duplicate quote snapshots';
  end if;

  v_rejected := false;
  begin
    perform public.create_domain_quote_order(
      p_customer_id => v_customer_id,
      p_customer_email => 'quote-customer@example.test',
      p_customer_contact => 'quote-customer@example.test',
      p_domain_name => 'different-domain.com',
      p_provider_id => 'namesilo',
      p_availability_checked_at => clock_timestamp(),
      p_idempotency_key => 'domain-quote:11111111-1111-4111-8111-111111111111:idem-key-0001',
      p_registration_price_minor => 30000,
      p_renewal_price_minor => 36000,
      p_term_years => 1,
      p_total_due_minor => 30000,
      p_wholesale_currency => 'USD',
      p_registration_wholesale_minor => 1000,
      p_renewal_wholesale_minor => 1200,
      p_fx_rate_micros => 25000000,
      p_margin_basis_points => 2000,
      p_pricing_source => 'provider-price-sheet-and-fx-snapshot',
      p_pricing_captured_at => clock_timestamp() - interval '1 hour',
      p_created_at => clock_timestamp(),
      p_expires_at => clock_timestamp() + interval '15 minutes'
    );
  exception when invalid_parameter_value then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Reusing an idempotency key for another domain must be rejected';
  end if;

  v_rejected := false;
  begin
    perform public.create_domain_quote_order(
      p_customer_id => v_customer_id,
      p_customer_email => 'quote-customer@example.test',
      p_customer_contact => 'quote-customer@example.test',
      p_domain_name => 'stale-availability.com',
      p_provider_id => 'namesilo',
      p_availability_checked_at => clock_timestamp() - interval '5 minutes',
      p_idempotency_key => 'domain-quote:11111111-1111-4111-8111-111111111111:idem-key-0002',
      p_registration_price_minor => 30000,
      p_renewal_price_minor => 36000,
      p_term_years => 1,
      p_total_due_minor => 30000,
      p_wholesale_currency => 'USD',
      p_registration_wholesale_minor => 1000,
      p_renewal_wholesale_minor => 1200,
      p_fx_rate_micros => 25000000,
      p_margin_basis_points => 2000,
      p_pricing_source => 'provider-price-sheet-and-fx-snapshot',
      p_pricing_captured_at => clock_timestamp() - interval '1 hour',
      p_created_at => clock_timestamp(),
      p_expires_at => clock_timestamp() + interval '15 minutes'
    );
  exception when invalid_parameter_value then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Stale registrar availability evidence must be rejected';
  end if;

  select p.oid into v_function_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_domain_quote_order';

  if v_function_oid is null then
    raise exception 'Atomic quote creation function is missing';
  end if;
  if has_function_privilege('anon', v_function_oid, 'EXECUTE')
     or has_function_privilege('authenticated', v_function_oid, 'EXECUTE')
     or not has_function_privilege('service_role', v_function_oid, 'EXECUTE') then
    raise exception 'Quote creation RPC must be service-role-only';
  end if;

  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'domain_order_quotes'
    and policyname = 'Customers can read their own domain quotes';
  if v_count <> 1 then
    raise exception 'Customer quote read policy is missing';
  end if;
end;
$test$;

rollback;
